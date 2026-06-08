import { Router } from "express";
import { pool, todayGT } from "@workspace/db";
import { logger } from "../../lib/logger";

import { calcularEstadoCiclo } from "../../lib/turno-calc";
import { notificarAsignacionTurnoPush } from "../../services/push-notificaciones";
import {
  liberarTitularidadAgente,
  lockTitularidadAgente,
} from "./_helpers/titularidad";
import { registrarImpactoSalarial } from "./_helpers/salarios";
import { verificarDiaCerrado } from "./_helpers/fechas";
import { materializarHEDesdeNovedad } from "./_helpers/horas-extra";

import { validarEmpleadoAsignable } from "../../lib/empleado-fecha-ingreso";

const router = Router();

router.post("/operaciones/asignar", async (req, res) => {
  // soloCobertura=true → relevo temporal de un día, NO cambia titular ni EOA, NO toca agente_id
  // soloCobertura=false (default) → asigna como titular si el puesto no tiene uno
  // oldTitularAccion → qué hacer con el EOA del titular previo
  // fechaEfectiva   → "YYYY-MM-DD" o null (usa hoy si null)
  // motivoCambio    → texto libre del motivo del cambio de titular
  // fechaOperacion  → "YYYY-MM-DD" de la fecha a cubrir (si es distinta a hoy, modo retroactivo)
  const { puestoId, agenteId, usuario, notas, forzar,
          soloCobertura = false,
          oldTitularAccion,
          fechaEfectiva,
          motivoCambio,
          horaInstalacion,
          fechaOperacion } = req.body;
  const hoyGT = todayGT();
  const fechaCobertura = fechaOperacion ?? hoyGT;
  const esRetroactivo = fechaCobertura < hoyGT;
  if (!puestoId || !agenteId) return res.status(400).json({ error: "puestoId y agenteId son requeridos" });

  // Bloqueo fecha_ingreso: el agente debe haber iniciado labores para la fecha de cobertura
  {
    const _v = await validarEmpleadoAsignable(pool, agenteId, fechaCobertura);
    if (!_v.ok) return res.status(400).json({ error: _v.error });
  }

  try {
    if (await verificarDiaCerrado()) {
      return res.status(423).json({ error: "Día operativo cerrado. Reabre el día para continuar.", diaCerrado: true });
    }
    const { rows: puestoRows } = await pool.query(`SELECT * FROM puestos_operativos WHERE id=$1`, [puestoId]);
    if (!puestoRows.length) return res.status(404).json({ error: "Puesto no encontrado" });
    const puesto = puestoRows[0];

    const { rows: agenteRows } = await pool.query(`SELECT * FROM employees WHERE id=$1`, [agenteId]);
    if (!agenteRows.length) return res.status(404).json({ error: "Agente no encontrado" });
    const agente = agenteRows[0];

    // SSA es bloqueante incluso en modo estricto: cubre un servicio especial
    // que no se puede liberar silenciosamente. Hay que cancelarlo aparte.
    {
      const { rows: yaEnSSA } = await pool.query(
        `SELECT s.id, c.nombre AS cliente_nombre, s.tipo_solicitud, s.fecha
         FROM solicitudes_servicio_adicional s
         LEFT JOIN clients c ON c.id = s.cliente_id
         WHERE s.agente_id = $1
           AND s.estado_general NOT IN ('cancelada', 'cerrada')
           AND CURRENT_DATE BETWEEN s.fecha AND COALESCE(s.fecha_fin, s.fecha)`,
        [agenteId]
      );
      if (yaEnSSA.length > 0) {
        const ssa = yaEnSSA[0];
        return res.status(409).json({
          error: `${agente.nombre_completo} ya cubre un Servicio Especial (${ssa.cliente_nombre ?? "—"} · ${ssa.id}). Cancele el SSA antes de reasignar.`,
          advertencia: true,
          ssaId: ssa.id,
        });
      }
    }

    const sinTitular = !puesto.titular_employee_id;
    const titularPrevioId: number | null = puesto.titular_employee_id ?? null;

    if (soloCobertura) {
      // ── Solo cobertura temporal (relevo): NO toca agente_id ni titular en puestos_operativos.
      // El agente cubre SOLO la fecha indicada (fechaCobertura).
      // El tablero lee el relevo desde cobertura_segmentos; al día siguiente el puesto vuelve
      // automáticamente a su estado normal (vacante o con titular) sin intervención manual.
      //
      // No se hace ningún UPDATE a puestos_operativos aquí.
      // (La cobertura queda registrada en el bloque A-04 de abajo)
    } else {
      // ── Asignación normal (puede convertir en titular) ─────────────────────
      //
      // Modo estricto (Opción A): un agente solo puede ser titular en UN lugar.
      // SOLO liberamos titularidad previa cuando el agente efectivamente se
      // convertirá en titular del destino (sinTitular === true). Si el puesto
      // ya tiene titular, esta asignación es solo cobertura diaria (`agente_id`)
      // y NO debe afectar las titularidades del agente en otros lugares.
      //
      // El helper + el UPDATE del puesto destino + el lock advisory corren en
      // UNA misma transacción para garantizar atomicidad y evitar carreras.

      const fechaEfectivaDate = fechaEfectiva
        ? fechaEfectiva  // "YYYY-MM-DD" string → PostgreSQL lo parsea como DATE
        : todayGT();

      // `seConvirtioEnTitular` se determina DENTRO de la transacción tras
      // hacer SELECT ... FOR UPDATE del puesto destino, no de la lectura previa.
      let seConvirtioEnTitular = false;

      const tx = await pool.connect();
      try {
        await tx.query("BEGIN");
        await lockTitularidadAgente(tx, Number(agenteId));

        // Re-leer puesto destino con candado de fila para evitar race condition
        // entre la lectura inicial (sinTitular) y el UPDATE.
        const { rows: puestoLk } = await tx.query(
          `SELECT id, titular_employee_id FROM puestos_operativos WHERE id = $1 FOR UPDATE`,
          [puestoId]
        );
        if (!puestoLk.length) throw new Error("Puesto no encontrado al bloquear");
        const puestoYaTieneTitular = puestoLk[0].titular_employee_id !== null;
        const titularPrevioReal: number | null = puestoLk[0].titular_employee_id ?? null;
        seConvirtioEnTitular = !puestoYaTieneTitular;

        // Solo si el agente efectivamente se convierte en titular: liberar su
        // titularidad previa (modo estricto) y registrar TH/EOA/slot.
        if (seConvirtioEnTitular) {
          const _liberadoTitular = await liberarTitularidadAgente(tx, Number(agenteId), {
            puestoId: Number(puestoId),
          });
          if (_liberadoTitular.puestos.length > 0 || _liberadoTitular.custodias.length > 0) {
            logger.info({
              agenteId, puestoDestino: puestoId, liberado: _liberadoTitular,
            }, "Asignación: titularidad previa liberada automáticamente");
          }

          await tx.query(
            `UPDATE puestos_operativos
             SET agente_id      = $1,
                 agente_nombre  = $2,
                 estado         = 'cubierto',
                 titular_employee_id = $1,
                 titular_nombre      = $2,
                 updated_at     = NOW()
             WHERE id = $3`,
            [agenteId, agente.nombre_completo, puestoId]
          );

          // ── TH: cerrar histórico previo y abrir el del nuevo titular ────
          if (titularPrevioReal) {
            await tx.query(
              `UPDATE puesto_titular_historico
               SET fecha_fin = $1, updated_at = NOW()
               WHERE puesto_id = $2 AND fecha_fin IS NULL`,
              [fechaEfectivaDate, puestoId]
            );
          }
          await tx.query(
            `INSERT INTO puesto_titular_historico
               (puesto_id, employee_id, fecha_inicio, motivo, creado_por)
             VALUES ($1, $2, $3, $4, $5)`,
            [puestoId, agenteId, fechaEfectivaDate, motivoCambio || null, usuario || 'sistema']
          );

          // ── EOA del agente entrante (tipo titular) ──────────────────────
          await tx.query(
            `UPDATE employee_operational_assignments
             SET activa = FALSE, updated_at = NOW()
             WHERE employee_id = $1 AND activa = TRUE`,
            [agenteId]
          );
          await tx.query(
            `INSERT INTO employee_operational_assignments
               (employee_id, puesto_id, sede_id, cliente_id, zona_operativa_id, tipo_turno_id,
                tipo_asignacion, activa, fecha_inicio, notas, created_at, updated_at)
             SELECT $1, $2, po.sede_id, po.cliente_id, po.zona_operativa_id, po.tipo_turno_id,
                    'titular', TRUE, NOW(), 'Asignado desde pizarrón operativo', NOW(), NOW()
             FROM puestos_operativos po WHERE po.id = $2`,
            [agenteId, puestoId]
          );

          // ── Auto-asignar al primer slot vacío de la plantilla ────────────
          const { rows: slotAsignado } = await tx.query(
            `UPDATE puesto_slots
             SET empleado_id = $1
             WHERE id = (
               SELECT id FROM puesto_slots
               WHERE puesto_id = $2 AND activo = TRUE AND empleado_id IS NULL
               ORDER BY slot_numero ASC LIMIT 1
             ) AND empleado_id IS NULL
             RETURNING id, slot_numero`,
            [agenteId, puestoId]
          );
          if (slotAsignado.length > 0) {
            logger.info({ agenteId, slotId: slotAsignado[0].id, slotNumero: slotAsignado[0].slot_numero, puestoId }, "Auto-asignado a slot vacío de plantilla");
          }

          // ── Mover titular previo a nueva categoría EOA si se indicó ─────
          if (titularPrevioReal && titularPrevioReal !== Number(agenteId) && oldTitularAccion) {
            const nuevoTipo = oldTitularAccion === 'disponible'   ? 'disponible'
                            : oldTitularAccion === 'pool_relevo'  ? 'pool_relevo'
                            : 'sin_asignacion';
            await tx.query(
              `UPDATE employee_operational_assignments
               SET activa = FALSE, updated_at = NOW()
               WHERE employee_id = $1 AND activa = TRUE`,
              [titularPrevioReal]
            );
            await tx.query(
              `INSERT INTO employee_operational_assignments
                 (employee_id, puesto_id, sede_id, cliente_id, zona_operativa_id, tipo_turno_id,
                  tipo_asignacion, activa, fecha_inicio, notas, created_at, updated_at)
               VALUES ($1, NULL, NULL, NULL, NULL, NULL, $2, TRUE, NOW(),
                       'Movido al cambiar titular en pizarrón', NOW(), NOW())`,
              [titularPrevioReal, nuevoTipo]
            );
          }
        } else {
          // Puesto YA tiene titular → solo cobertura diaria, no toca titularidad.
          await tx.query(
            `UPDATE puestos_operativos
             SET agente_id      = $1,
                 agente_nombre  = $2,
                 estado         = 'cubierto',
                 updated_at     = NOW()
             WHERE id = $3`,
            [agenteId, agente.nombre_completo, puestoId]
          );
        }

        await tx.query("COMMIT");
      } catch (e) {
        await tx.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        tx.release();
      }
    }

    // Registrar movimiento
    await pool.query(
      `INSERT INTO movimientos_operativos
         (puesto_id, cliente_nombre, puesto_nombre, agente_entrante_id, agente_entrante_nombre, tipo, usuario_cambio, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [puestoId, puesto.cliente_nombre, puesto.nombre, agenteId, agente.nombre_completo,
       soloCobertura ? 'relevo' : 'asignacion', usuario || 'sistema', notas || null]
    );

    // A-04: Auto-crear / actualizar segmento de cobertura para fechaCobertura (hoy o fecha retroactiva)
    try {
      const hoy = fechaCobertura;  // puede ser hoy o una fecha retroactiva
      const turno = (puesto.turno ?? "día").toLowerCase();
      const horaFinTurno = turno === "noche" ? "06:00" : "18:00";
      const horaInicioDefault = turno === "noche" ? "20:00" : "08:00";

      // Usar hora real de instalación si se proporcionó, si no la del turno
      const horaInicioFinal = horaInstalacion || horaInicioDefault;

      // Calcular horas trabajadas (maneja cruce de medianoche)
      function calcHoras(inicio: string, fin: string): number {
        const [h1, m1] = inicio.split(":").map(Number);
        const [h2, m2] = fin.split(":").map(Number);
        let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (mins < 0) mins += 24 * 60;
        return Math.round(mins / 6) / 10;
      }
      const horasCalcFinal  = calcHoras(horaInicioFinal, horaFinTurno);
      const horasStandard   = 10;

      let agenteEnDescansoOVacaciones = false;
      try {
        const { rows: ptRows } = await pool.query(
          `SELECT pt.puesto_id, po.tipo_turno_id, po.fecha_inicio_ciclo::text AS fic,
                  t.horas_trabajo::float AS ht, t.horas_descanso::float AS hd,
                  t.nombre AS turno_nombre,
                  ps.dias_trabajo AS slot_dias_trabajo, ps.fecha_inicio_ciclo::text AS slot_fecha_inicio,
                  COALESCE(ps.longitud_ciclo, 14)::int AS slot_longitud_ciclo
           FROM puesto_titulares pt
           JOIN puestos_operativos po ON po.id = pt.puesto_id
           LEFT JOIN turnos t ON t.id = po.tipo_turno_id
           LEFT JOIN puesto_slots ps ON ps.puesto_id = po.id AND ps.empleado_id = $1 AND ps.activo = TRUE
           WHERE pt.employee_id = $1 AND pt.activo = TRUE
           LIMIT 1`,
          [agenteId]
        );
        if (ptRows.length > 0) {
          const ptRow = ptRows[0];
          const slotFechaInicio = ptRow.slot_fecha_inicio ?? ptRow.fic;
          if (ptRow.slot_dias_trabajo && Array.isArray(ptRow.slot_dias_trabajo) && ptRow.slot_dias_trabajo.length > 0 && slotFechaInicio) {
            const lc = Number(ptRow.slot_longitud_ciclo) || 14;
            const [iy,im,id2] = slotFechaInicio.slice(0,10).split("-").map(Number);
            const [cy,cm,cd2] = fechaCobertura.split("-").map(Number);
            const inicio = Date.UTC(iy, im-1, id2);
            const consulta = Date.UTC(cy, cm-1, cd2);
            const daysElapsed = Math.floor((consulta - inicio) / 86400000);
            const cycleDay = ((daysElapsed % lc) + lc) % lc + 1;
            const trabaja = (ptRow.slot_dias_trabajo as number[]).includes(cycleDay);
            agenteEnDescansoOVacaciones = !trabaja;
          } else if (ptRow.ht && ptRow.hd && ptRow.fic) {
            const turnoObj = { horas_trabajo: ptRow.ht, horas_descanso: ptRow.hd };
            const estado = calcularEstadoCiclo(turnoObj as any, ptRow.fic.slice(0, 10), fechaCobertura);
            agenteEnDescansoOVacaciones = estado.descansoPorCiclo;
          }
        }
        if (!agenteEnDescansoOVacaciones) {
          const { rows: vacRows } = await pool.query(
            `SELECT 1 FROM eventos_rrhh
             WHERE employee_id = $1
               AND tipo_evento IN ('vacaciones', 'vacaciones_trabajadas')
               AND estado NOT IN ('anulado', 'cancelado')
               AND $2::date BETWEEN fecha::date AND COALESCE(fecha_fin::date, fecha::date)
             LIMIT 1`,
            [agenteId, fechaCobertura]
          );
          if (vacRows.length > 0) agenteEnDescansoOVacaciones = true;
        }
      } catch (heCheckErr) {
        logger.warn({ heCheckErr, agenteId }, "A-04: no se pudo verificar descanso/vacaciones del agente (fallback: sin HE)");
      }

      const generaExtra     = agenteEnDescansoOVacaciones && horasCalcFinal > horasStandard;
      const horasExtraCalc  = generaExtra ? Math.round((horasCalcFinal - horasStandard) * 10) / 10 : 0;
      // Marcar cobertura especial cuando es supervisor o jefe de servicio — trazabilidad
      const tipoPersonalAgente = agente.tipo_personal ?? 'guardia';
      const tipoSegmento = tipoPersonalAgente === 'supervisor'
        ? 'cobertura_supervisor'
        : tipoPersonalAgente === 'jefe_servicio'
          ? 'cobertura_jefe_servicio'
          : soloCobertura ? 'relevo' : 'titular';
      const obsSegmento = [
        tipoPersonalAgente === 'supervisor'   ? '⚠ Cobertura por Supervisor de Zona' : null,
        tipoPersonalAgente === 'jefe_servicio' ? '⚠ Cobertura por Jefe de Servicio' : null,
        horaInstalacion ? `Instalación real: ${horaInstalacion}` : null,
      ].filter(Boolean).join(' | ') || null;

      // Intentar insertar; si ya existe (mismo empleado+puesto+fecha), actualizar
      const ins = await pool.query(
        `INSERT INTO cobertura_segmentos
           (fecha, puesto_id, client_id, employee_id, empleado_nombre,
            tipo_cobertura, hora_inicio, hora_fin, horas_calculadas,
            fue_en_dia_descanso, genera_horas_extra, observaciones, usuario_registro)
         SELECT $1,$2,$3,$4,$5,$9,$6,$7,$8,$12,$10,$11,'asignacion_pizarron'
         WHERE NOT EXISTS (
           SELECT 1 FROM cobertura_segmentos
           WHERE fecha=$1 AND puesto_id=$2 AND employee_id=$4
         )`,
        [hoy, puestoId, puesto.cliente_id ?? null, agenteId,
         agente.nombre_completo, horaInicioFinal, horaFinTurno, horasCalcFinal,
         tipoSegmento, generaExtra, obsSegmento, agenteEnDescansoOVacaciones]
      );

      // Si el registro ya existía y se indicó hora real, actualizar horas
      if (horaInstalacion && ins.rowCount === 0) {
        await pool.query(
          `UPDATE cobertura_segmentos
           SET hora_inicio = $1, horas_calculadas = $2, genera_horas_extra = $3,
               observaciones = $4, fue_en_dia_descanso = $8, updated_at = NOW()
           WHERE fecha = $5 AND puesto_id = $6 AND employee_id = $7`,
          [horaInstalacion, horasCalcFinal, generaExtra, obsSegmento, hoy, puestoId, agenteId, agenteEnDescansoOVacaciones]
        );
      }

      // Registrar novedad de nómina para el colaborador que cubre
      try {
        await pool.query(
          `INSERT INTO novedades_nomina_diarias
             (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
              puesto_cubierto_id, puesto_cubierto_nombre, num_puestos_cubiertos, fuente)
           VALUES ($1, $2, $3, TRUE, $4, $5, $6, $7, 1, 'asignacion_pizarron')
           ON CONFLICT (fecha, employee_id) DO UPDATE SET
             trabajo_dia           = TRUE,
             falta                 = FALSE,
             descuento_dia         = FALSE,
             horas_trabajadas      = GREATEST(novedades_nomina_diarias.horas_trabajadas, $4),
             horas_extra           = GREATEST(novedades_nomina_diarias.horas_extra, $5),
             num_puestos_cubiertos = novedades_nomina_diarias.num_puestos_cubiertos + 1,
             updated_at            = NOW()`,
          [hoy, agenteId, agente.nombre_completo, horasCalcFinal, horasExtraCalc, puestoId, puesto.nombre]
        );
      } catch (nomErr) {
        logger.warn({ nomErr }, "A-04: no se pudo actualizar novedad nómina (no bloqueante)");
      }

      // A-04b: materializar el evento RRHH de HE en vivo, para que aparezca como
      // tarjeta en RRHH > Eventos (junto a la falta) sin esperar al cierre.
      // Idempotente con el cierre: si ya existe, solo enlaza; no duplica (no doble pago).
      if (generaExtra && horasExtraCalc > 0) {
        await materializarHEDesdeNovedad(pool, {
          fecha: hoy,
          employeeId: Number(agenteId),
          empleadoNombre: agente.nombre_completo,
          employeeDpi: agente.dpi ?? null,
          puestoNombre: puesto.nombre,
          clienteNombre: puesto.cliente_nombre ?? null,
          usuario: usuario ?? null,
        });
      }

      logger.info({ puestoId, agenteId, hoy, horaInstalacion, horasCalcFinal, generaExtra }, "A-04: segmento registrado en asignación");
    } catch (segErr) {
      logger.warn({ segErr }, "A-04: no se pudo crear segmento al asignar (no bloqueante)");
    }

    // SAL-01: Detectar impacto salarial (no bloqueante)
    const impacto = await registrarImpactoSalarial({
      agenteId:      agenteId,
      agenteNombre:  agente.nombre_completo,
      puestoId:      puestoId,
      puestoNombre:  puesto.nombre,
      clienteNombre: puesto.cliente_nombre ?? "",
      salarioPuesto: puesto.salario_puesto  ? Number(puesto.salario_puesto)  : null,
      salarioActual: agente.sueldo_base     ? Number(agente.sueldo_base)     : null,
      usuario:       usuario ?? null,
      tipoMovimiento: soloCobertura ? "cobertura" : "asignacion_titular",
      snapshotPuesto: { nombre: puesto.nombre, cliente_nombre: puesto.cliente_nombre, salario_puesto: puesto.salario_puesto },
    });

    // SAL-02: solo admin/rrhh ven el impacto salarial en la respuesta
    let rolSesion = "";
    try { rolSesion = JSON.parse(req.headers["x-isp-session"] as string ?? "")?.rol ?? ""; } catch {}
    const puedeVerImpacto = rolSesion === "admin" || rolSesion === "rrhh";

    // Push al colaborador asignado — fire and forget para no bloquear la respuesta.
    notificarAsignacionTurnoPush({
      agenteId,
      agenteNombre: agente.nombre_completo,
      puestoId,
      puestoNombre: puesto.nombre,
      clienteNombre: puesto.cliente_nombre ?? null,
      fecha: fechaCobertura,
      soloCobertura: Boolean(soloCobertura),
      horaInicio: horaInstalacion ?? null,
    }).catch((err) => {
      logger.warn({ err, agenteId, puestoId }, "Push de asignación falló (no bloqueante)");
    });

    res.json({
      ok: true,
      mensaje: `${agente.nombre_completo} asignado a ${puesto.nombre}`,
      asignadoComoTitular: !soloCobertura && sinTitular,
      soloCobertura,
      ...(puedeVerImpacto && {
        impactoSalarial: impacto.tieneImpacto
          ? { detectado: true, impactoId: impacto.impactoId }
          : { detectado: false },
      }),
    });
  } catch (err) {
    logger.error({ err }, "POST /operaciones/asignar error");
    res.status(500).json({ error: "Error al asignar agente" });
  }
});

// ─── POST /api/operaciones/registrar-falta ───────────────────────────────────
// Registrar inasistencia de un titular en su puesto para el día de hoy.
// Para puestos normales (no-24x24): también actualiza estado_operativo_puesto='faltando'.
// Para puestos 24x24: solo registra el evento de RRHH (el ciclo se auto-corrige mañana).

router.post("/operaciones/registrar-falta", async (req, res) => {
  const { puestoId, empleadoId, motivo, notas, es_24x24, usuario, fecha } = req.body;
  if (!puestoId || !empleadoId) {
    return res.status(400).json({ error: "puestoId y empleadoId son requeridos" });
  }
  const motivoNorm = motivo ?? "inasistencia";
  try {
    const { rows: emp } = await pool.query(
      `SELECT id, nombre_completo FROM employees WHERE id = $1`,
      [empleadoId]
    );
    if (emp.length === 0) return res.status(404).json({ error: "Empleado no encontrado" });
    const { rows: po } = await pool.query(
      `SELECT id, nombre, cliente_nombre FROM puestos_operativos WHERE id = $1`,
      [puestoId]
    );
    if (po.length === 0) return res.status(404).json({ error: "Puesto no encontrado" });

    const hoyGT = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
      ? fecha
      : new Date(Date.now() - 6 * 3_600_000).toISOString().slice(0, 10);
    const nota  = notas
      ? `${motivoNorm} — ${po[0].nombre} (${po[0].cliente_nombre}). ${notas}`
      : `${motivoNorm} — ${po[0].nombre} (${po[0].cliente_nombre})`;

    // Marcar puesto como 'faltando' con metadata del empleado y motivo.
    // El evento RRHH se genera al cierre del pizarrón, NO aquí.
    // Esto permite que si durante el día se cubre con sustitución, la falta
    // ya no se genera al cerrar (la sustitución genera su propio par de eventos).
    await pool.query(`
      UPDATE puestos_operativos
      SET estado_operativo_puesto = 'faltando',
          falta_employee_id       = $2,
          falta_motivo            = $3,
          falta_notas             = $4,
          falta_usuario           = $5,
          updated_at              = NOW()
      WHERE id = $1
    `, [puestoId, empleadoId, motivoNorm, nota, usuario ?? 'sistema']);

    logger.info({ puestoId, empleadoId, motivo: motivoNorm, es_24x24, diferido: true }, "Falta marcada (evento diferido al cierre)");
    res.json({ ok: true, empleado: emp[0].nombre_completo, puesto: po[0].nombre, diferido: true });
  } catch (err) {
    logger.error({ err }, "POST /operaciones/registrar-falta error");
    res.status(500).json({ error: "Error al registrar falta" });
  }
});

// ─── POST /api/operaciones/sustituir ─────────────────────────────────────────
// Sustituir agente en un puesto (hay uno previo)
// fechaOperacion: "YYYY-MM-DD" — si es un día pasado, la cobertura se registra en esa fecha

router.post("/operaciones/sustituir", async (req, res) => {
  const { puestoId, agenteEntranteId, motivo, usuario, notas, forzar, tipoSustitucion,
          tipoNovedad, coberturaTipo, fechaOperacion,
          horaInicioParcial, horaFinParcial,
          agenteSalienteId: bodySalienteId, agenteSalienteNombre: bodySalienteNombre,
          generaHE } = req.body;
  if (!puestoId || !agenteEntranteId) return res.status(400).json({ error: "puestoId y agenteEntranteId son requeridos" });

  // tipoSustitucion: 'relevo' = solo cambia agente_id (titular no cambia)
  //                 'reasignacion' = cambia agente_id Y titular_employee_id
  const esRelevo = tipoSustitucion === 'relevo';

  // Operación retroactiva: la fecha de la cobertura es en el pasado.
  // En ese caso NO se toca agente_id en puestos_operativos — el tablero lo resuelve
  // desde el ciclo (puesto_slots) y los overrides de cobertura_segmentos.
  const hoyGT = todayGT();
  const fechaCobertura = (fechaOperacion && /^\d{4}-\d{2}-\d{2}$/.test(fechaOperacion))
    ? fechaOperacion
    : hoyGT;
  const esRetroactivoSustitucion = fechaCobertura < hoyGT;

  // Bloqueo fecha_ingreso: el agente entrante debe haber iniciado labores para esa fecha
  {
    const _v = await validarEmpleadoAsignable(pool, agenteEntranteId, fechaCobertura);
    if (!_v.ok) return res.status(400).json({ error: _v.error });
  }

  try {
    if (await verificarDiaCerrado()) {
      return res.status(423).json({ error: "Día operativo cerrado. Reabre el día para continuar.", diaCerrado: true });
    }
    const { rows: puestoRows } = await pool.query(`SELECT * FROM puestos_operativos WHERE id=$1`, [puestoId]);
    if (!puestoRows.length) return res.status(404).json({ error: "Puesto no encontrado" });
    const puesto = puestoRows[0];

    const { rows: entranteRows } = await pool.query(`SELECT * FROM employees WHERE id=$1`, [agenteEntranteId]);
    if (!entranteRows.length) return res.status(404).json({ error: "Agente entrante no encontrado" });
    const entrante = entranteRows[0];

    // Advertir si el entrante ya está en otro puesto (a menos que forzar=true)
    if (!forzar) {
      const { rows: yaRows } = await pool.query(
        `SELECT po.nombre, po.cliente_nombre FROM puestos_operativos po
         WHERE po.agente_id=$1 AND po.activo=TRUE AND po.id!=$2`,
        [agenteEntranteId, puestoId]
      );
      if (yaRows.length > 0) {
        return res.status(409).json({
          error: `${entrante.nombre_completo} ya tiene el puesto ${yaRows[0].nombre} en ${yaRows[0].cliente_nombre}`,
          advertencia: true,
        });
      }

      // Bloquear si el entrante cubre un SSA vigente HOY — no se puede forzar
      const { rows: yaSSA } = await pool.query(
        `SELECT s.id, c.nombre AS cliente_nombre
         FROM solicitudes_servicio_adicional s
         LEFT JOIN clients c ON c.id = s.cliente_id
         WHERE s.agente_id = $1
           AND s.estado_general NOT IN ('cancelada', 'cerrada')
           AND CURRENT_DATE BETWEEN s.fecha AND COALESCE(s.fecha_fin, s.fecha)`,
        [agenteEntranteId]
      );
      if (yaSSA.length > 0) {
        return res.status(409).json({
          error: `${entrante.nombre_completo} ya cubre un Servicio Especial (${yaSSA[0].cliente_nombre ?? "—"} · ${yaSSA[0].id})`,
          advertencia: true,
          ssaId: yaSSA[0].id,
        });
      }
    }

    const agenteSalienteId     = puesto.agente_id ?? bodySalienteId ?? null;
    const agenteSalienteNombre = puesto.agente_nombre ?? bodySalienteNombre ?? null;

    // REGLA FUNDAMENTAL DE RELEVOS:
    // Un relevo es SIEMPRE un evento de un solo día — no importa si es hoy, ayer o retroactivo.
    // El agente sustituto cubre SOLO esa fecha; al día siguiente el ciclo retoma normalmente.
    // Por esto, un relevo NUNCA toca puestos_operativos.agente_id.
    // Solo queda registrado en cobertura_segmentos para esa fecha específica.
    //
    // Una reasignación permanente (esRelevo=false) SÍ actualiza agente_id,
    // pero solo si es para hoy o futuro (no retroactiva).
    if (!esRelevo && !esRetroactivoSustitucion) {
      // Modo estricto: liberar titularidad previa del entrante (puestos/custodias)
      // ANTES de hacerlo titular aquí. Todo dentro de UNA transacción con lock.
      const txS = await pool.connect();
      try {
        await txS.query("BEGIN");
        await lockTitularidadAgente(txS, Number(agenteEntranteId));
        const _libS = await liberarTitularidadAgente(txS, Number(agenteEntranteId), {
          puestoId: Number(puestoId),
        });
        if (_libS.puestos.length > 0 || _libS.custodias.length > 0) {
          logger.info({ agenteEntranteId, puestoDestino: puestoId, liberado: _libS },
            "Sustitución: titularidad previa del entrante liberada automáticamente");
        }
        await txS.query(
          `UPDATE puestos_operativos
           SET agente_id             = $1,
               agente_nombre         = $2,
               titular_employee_id   = $1,
               titular_nombre        = $2,
               estado                = 'cubierto',
               updated_at            = NOW()
           WHERE id = $3`,
          [agenteEntranteId, entrante.nombre_completo, puestoId]
        );
        await txS.query("COMMIT");
      } catch (e) {
        await txS.query("ROLLBACK").catch(() => {});
        throw e;
      } finally {
        txS.release();
      }
    }

    // Registrar movimiento de sustitución
    await pool.query(
      `INSERT INTO movimientos_operativos
         (puesto_id, cliente_nombre, puesto_nombre,
          agente_saliente_id, agente_saliente_nombre,
          agente_entrante_id, agente_entrante_nombre,
          tipo, motivo, usuario_cambio, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'sustitucion', $8, $9, $10)`,
      [
        puestoId, puesto.cliente_nombre, puesto.nombre,
        agenteSalienteId, agenteSalienteNombre,
        agenteEntranteId, entrante.nombre_completo,
        motivo || null, usuario || 'sistema', notas || null,
      ]
    );

    // Obtener ID del movimiento recién insertado
    const { rows: movRows } = await pool.query(
      `SELECT id FROM movimientos_operativos
       WHERE puesto_id=$1 AND tipo='sustitucion'
       ORDER BY created_at DESC LIMIT 1`,
      [puestoId],
    );
    const movimientoId = movRows[0]?.id || null;

    // ── Auto-crear evento RRHH (expandido: tipoNovedad + motivo legacy) ────────
    const tiposRrhhSaliente: Record<string, string> = {
      falta_total:      "falta",
      abandono_parcial: "abandono_parcial",
      suspension_disc:  "suspension_disciplinaria",
      suspension:       "suspension_disciplinaria",
      incapacidad:      "incapacidad",
      permiso_sin_goce: "permiso_sin_goce",
      permiso_con_goce: "permiso_con_goce",
    };
    const tipoEventoRrhh = tipoNovedad
      ? tiposRrhhSaliente[tipoNovedad] ?? null
      : (["falta","suspension"].includes((motivo || "").toLowerCase()) ? motivo?.toLowerCase() : null);

    let turnoHorasPuesto = 24;
    if (puesto.tipo_turno_id) {
      try {
        const { rows: tRows } = await pool.query(`SELECT horas_trabajo::float FROM turnos WHERE id=$1`, [puesto.tipo_turno_id]);
        if (tRows.length) turnoHorasPuesto = Number(tRows[0].horas_trabajo);
      } catch {}
    }

    let eventoRrhhSalienteId: number | null = null;
    if (tipoEventoRrhh && agenteSalienteId) {
      try {
        let employeeId: number | null = Number(agenteSalienteId);
        let employeeNombre = agenteSalienteNombre || "Colaborador desconocido";
        let employeeDpi: string | null = null;
        const { rows: empRows } = await pool.query(
          `SELECT id, nombre_completo, dpi FROM employees WHERE id=$1`, [employeeId]
        );
        if (empRows.length) {
          employeeNombre = empRows[0].nombre_completo;
          employeeDpi    = empRows[0].dpi || null;
        }
        const estadoEvento = "pendiente_aprobacion";
        const { rows: evSalRows } = await pool.query(
          `INSERT INTO eventos_rrhh
             (employee_id, employee_nombre, employee_dpi,
              tipo_evento, fecha, cliente_nombre, puesto_nombre,
              generado_desde, movimiento_id, estado, usuario_generador, documentos_generados,
              cantidad_horas)
           VALUES ($1,$2,$3,$4,NOW(),$5,$6,'operaciones',$7,'pendiente_aprobacion',$8,'[]',$9)
           RETURNING id`,
          [employeeId, employeeNombre, employeeDpi, tipoEventoRrhh,
           puesto.cliente_nombre || null, puesto.nombre || null,
           movimientoId, usuario || "sistema", turnoHorasPuesto]
        );
        eventoRrhhSalienteId = evSalRows[0]?.id ?? null;
        logger.info({ tipoEventoRrhh, empleado: employeeNombre, estadoEvento, eventoRrhhSalienteId }, "Evento RRHH auto-generado desde sustitución");
      } catch (errRrhh: any) {
        logger.error({ err: errRrhh?.message ?? errRrhh }, "Error al auto-generar evento RRHH (no bloqueante)");
      }
    }

    // A-04: Auto-crear segmento de cobertura para hoy al sustituir agente
    // Determinar el estado operativo real del puesto basado en tipo_novedad
    const estadoOpPuesto = (() => {
      if (!esRelevo) return "normal";
      switch (tipoNovedad) {
        case "falta_total":      return "relevo_completo";
        case "abandono_parcial": return "abandono_parcial";
        case "incapacidad":      return "incapacidad";
        case "suspension_disc":  return "suspension_disciplinaria";
        case "suspension":       return "suspension_disciplinaria";
        case "permiso_sin_goce": return "permiso_sin_goce";
        case "permiso_con_goce": return "permiso_con_goce";
        case "relevo_parcial":   return "relevo_parcial";
        case "relevo_completo":  return "relevo_completo";
        case "horas_extra_puras":return "horas_extra";
        case "cierre_tarde_cliente": return "horas_extra";
        default: return "relevo_completo";
      }
    })();

    await pool.query(
      `UPDATE puestos_operativos
       SET estado_operativo_puesto = $1,
           falta_employee_id = NULL,
           falta_motivo = NULL,
           falta_notas = NULL,
           falta_usuario = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [estadoOpPuesto, puestoId]
    );

    // A-04: Auto-crear segmento de cobertura (para fechaCobertura: hoy o fecha retroactiva)
    try {
      const hoy = fechaCobertura;
      const turno = (puesto.turno ?? "día").toLowerCase();
      const horaInicioDefault = turno === "noche" ? "20:00" : "08:00";
      const horaFinDefault    = turno === "noche" ? "06:00" : "18:00";
      // Relevo parcial: el fin toma como base la hora de salida del turno original del puesto.
      // Si el puesto no la tiene configurada, cae al default por turno.
      const esHHMM = (v: unknown): v is string => typeof v === "string" && /^\d{1,2}:\d{2}/.test(v.trim());
      const finTurnoBase = esHHMM(puesto.hora_salida) ? String(puesto.hora_salida).trim() : horaFinDefault;
      // Basta la hora de inicio para registrar el relevo parcial; el fin se deriva del turno.
      const usaParcial = coberturaTipo === "parcial" && !!horaInicioParcial;
      const horaInicio = usaParcial ? horaInicioParcial : horaInicioDefault;
      const horaFin    = usaParcial ? (horaFinParcial || finTurnoBase) : horaFinDefault;
      const calcHorasCobertura = (hi: string, hf: string) => {
        const [h1,m1] = hi.split(":").map(Number);
        const [h2,m2] = hf.split(":").map(Number);
        let diff = (h2*60+m2) - (h1*60+m1);
        if (diff <= 0) diff += 1440;
        return Math.round((diff / 60) * 100) / 100;
      };
      const horasCalc = usaParcial ? calcHorasCobertura(horaInicio, horaFin) : turnoHorasPuesto;
      // Marcar cobertura especial cuando el entrante es supervisor o jefe de servicio
      const tipoPersonalEntrante = entrante.tipo_personal ?? 'guardia';
      const tipoSeg = tipoPersonalEntrante === 'supervisor'
        ? 'cobertura_supervisor'
        : tipoPersonalEntrante === 'jefe_servicio'
          ? 'cobertura_jefe_servicio'
          : esRelevo ? "relevo" : "titular";
      const alcance    = coberturaTipo || "completo";
      await pool.query(
        `INSERT INTO cobertura_segmentos
           (fecha, puesto_id, client_id, employee_id, empleado_nombre,
            tipo_cobertura, hora_inicio, hora_fin, horas_calculadas,
            fue_en_dia_descanso, genera_horas_extra, usuario_registro,
            tipo_novedad, cobertura_alcance)
         SELECT $1,$2,$3,$4,$5,$6::VARCHAR,$7,$8,$9,FALSE,FALSE,'sustitucion_pizarron',$10,$11
         WHERE NOT EXISTS (
           SELECT 1 FROM cobertura_segmentos
           WHERE fecha=$1 AND puesto_id=$2 AND employee_id=$4
         )`,
        [hoy, puestoId, puesto.cliente_id ?? null, agenteEntranteId,
         entrante.nombre_completo, tipoSeg, horaInicio, horaFin, horasCalc,
         tipoNovedad ?? null, alcance]
      );
      logger.info({ puestoId, agenteEntranteId, tipoSeg, tipoNovedad, hoy }, "A-04: segmento auto-creado en sustitución");

      // Determinar si el agente entrante está en descanso o vacaciones (server-side)
      // Solo esos estados generan HE; disponible/trabajando NO genera HE
      let entranteEnDescansoOVacaciones = false;
      if (esRelevo) {
        try {
          const { rows: vacRows } = await pool.query(
            `SELECT 1 FROM vacaciones
             WHERE employee_id = $1 AND estado = 'aprobada'
               AND $2::date BETWEEN fecha_inicio AND fecha_fin LIMIT 1`,
            [agenteEntranteId, hoy]
          );
          if (vacRows.length > 0) {
            entranteEnDescansoOVacaciones = true;
          } else {
            // TURNOS-04: alineado con el modelo nuevo (dias_trabajo + longitud_ciclo).
            // Antes este bloque usaba ps.dia_trabaja (columna inexistente), por lo que
            // siempre era no-op. Ahora calcula correctamente si trabaja hoy.
            const { rows: slotRows } = await pool.query(
              `SELECT ps.dias_trabajo,
                      COALESCE(ps.longitud_ciclo, 14)::int AS longitud_ciclo,
                      ps.fecha_inicio_ciclo::text AS slot_fecha_inicio
               FROM puesto_slots ps
               JOIN puestos_operativos po ON po.id = ps.puesto_id
               WHERE po.titular_employee_id = $1 AND po.activo = TRUE AND ps.activo = TRUE
               LIMIT 1`,
              [agenteEntranteId]
            );
            if (slotRows.length > 0) {
              const slotData = slotRows[0];
              const dias = Array.isArray(slotData.dias_trabajo) ? slotData.dias_trabajo as number[] : null;
              const lc = Number(slotData.longitud_ciclo) || 14;
              const fechaInicioCiclo = slotData.slot_fecha_inicio
                ?? entrante.fecha_inicio_ciclo
                ?? entrante.fecha_ingreso;
              if (dias && dias.length > 0 && fechaInicioCiclo) {
                const fic = String(fechaInicioCiclo).slice(0, 10);
                const [iy, im, id2] = fic.split("-").map(Number);
                const [cy, cm, cd2] = hoy.split("-").map(Number);
                const inicio = Date.UTC(iy, im - 1, id2);
                const consulta = Date.UTC(cy, cm - 1, cd2);
                const diffDays = Math.floor((consulta - inicio) / 86400000);
                const cycleDay = ((diffDays % lc) + lc) % lc + 1; // 1-based
                const trabajaHoy = dias.includes(cycleDay);
                if (!trabajaHoy) entranteEnDescansoOVacaciones = true;
              }
            }
          }
        } catch (heCheckErr) {
          logger.warn({ heCheckErr, agenteEntranteId }, "No se pudo verificar estado HE del entrante, defaulting to no-HE");
        }
      }
      const creaEventoHE = esRelevo && entranteEnDescansoOVacaciones;
      let eventoRrhhEntranteId: number | null = null;
      if (creaEventoHE) {
        try {
          const { rows: evEntRows } = await pool.query(
            `INSERT INTO eventos_rrhh
               (employee_id, employee_nombre, employee_dpi,
                tipo_evento, fecha, cliente_nombre, puesto_nombre,
                generado_desde, movimiento_id, estado, usuario_generador,
                observaciones, documentos_generados, evento_par_id, cantidad_horas)
             VALUES ($1,$2,$3,'horas_extra',$4::date,$5,$6,'operaciones',$7,'pendiente_aprobacion',$8,
                     $9,'[]',$10,$11)
             RETURNING id`,
            [agenteEntranteId, entrante.nombre_completo, entrante.dpi ?? null,
             hoy, puesto.cliente_nombre || null, puesto.nombre || null,
             movimientoId, usuario || "sistema",
             `Cobertura HE: ${tipoNovedad ?? 'relevo'} en ${puesto.nombre} (${puesto.cliente_nombre})`,
             eventoRrhhSalienteId, horasCalc]
          );
          eventoRrhhEntranteId = evEntRows[0]?.id ?? null;
          if (eventoRrhhSalienteId && eventoRrhhEntranteId) {
            await pool.query(`UPDATE eventos_rrhh SET evento_par_id = $1 WHERE id = $2`, [eventoRrhhEntranteId, eventoRrhhSalienteId]);
          }
          logger.info({ agenteEntranteId, eventoRrhhEntranteId, eventoRrhhSalienteId, tipoNovedad }, "Evento RRHH HE creado para entrante (par vinculado)");
        } catch (errEvEnt) {
          logger.warn({ errEvEnt }, "No se pudo crear evento RRHH para entrante (no bloqueante)");
        }
      }

      // Registrar novedad de nómina para el agente entrante (limpia cualquier falta previa)
      try {
        await pool.query(
          `INSERT INTO novedades_nomina_diarias
             (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
              puesto_cubierto_id, puesto_cubierto_nombre, num_puestos_cubiertos, fuente,
              requiere_revision_rrhh, impacto_nomina, evento_rrhh_id, tipo_novedad)
           VALUES ($1, $2, $3, TRUE, $4, $11, $5, $6, 1, 'sustitucion_pizarron',
                   $7, $8, $9, $10)
           ON CONFLICT (fecha, employee_id) DO UPDATE SET
             trabajo_dia           = TRUE,
             falta                 = FALSE,
             descuento_dia         = FALSE,
             horas_trabajadas      = GREATEST(novedades_nomina_diarias.horas_trabajadas, $4),
             horas_extra           = GREATEST(novedades_nomina_diarias.horas_extra, $11),
             num_puestos_cubiertos = novedades_nomina_diarias.num_puestos_cubiertos + 1,
             requiere_revision_rrhh = CASE
               WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
               THEN novedades_nomina_diarias.requiere_revision_rrhh
               ELSE COALESCE($7, novedades_nomina_diarias.requiere_revision_rrhh)
             END,
             impacto_nomina = CASE
               WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
               THEN novedades_nomina_diarias.impacto_nomina
               ELSE COALESCE($8, novedades_nomina_diarias.impacto_nomina)
             END,
             evento_rrhh_id = COALESCE(novedades_nomina_diarias.evento_rrhh_id, $9),
             updated_at            = NOW()`,
          [hoy, agenteEntranteId, entrante.nombre_completo, horasCalc, puestoId, puesto.nombre,
           creaEventoHE ? true : null, creaEventoHE ? 'pendiente' : null, eventoRrhhEntranteId,
           tipoNovedad ?? 'relevo_completo', creaEventoHE ? horasCalc : 0]
        );
      } catch (nomEntranteErr) {
        logger.warn({ nomEntranteErr }, "A-04: no se pudo actualizar novedad nómina del entrante (no bloqueante)");
      }

      // Red de seguridad: materializar/enlazar el evento RRHH de HE del entrante en
      // vivo. Cubre los casos en que el bloque creaEventoHE no detectó la HE o su
      // insert falló. Idempotente: si el evento ya existe, solo asegura el par.
      await materializarHEDesdeNovedad(pool, {
        fecha: hoy,
        employeeId: Number(agenteEntranteId),
        empleadoNombre: entrante.nombre_completo,
        employeeDpi: entrante.dpi ?? null,
        puestoNombre: puesto.nombre,
        clienteNombre: puesto.cliente_nombre ?? null,
        usuario: usuario ?? null,
      });

      // Registrar novedad de falta/ausencia para el agente SALIENTE (titular que sale)
      if (agenteSalienteId && tipoEventoRrhh && esRelevo) {
        try {
          const TIPOS_SIN_DESCUENTO = ["vacaciones", "relevo_vacaciones", "incapacidad", "permiso_con_goce", "permiso", "descanso"];
          const sinDescuento = TIPOS_SIN_DESCUENTO.includes(tipoNovedad ?? "");
          const esSuspension = ["suspension", "suspension_disciplinaria"].includes(tipoEventoRrhh);
          const esFalta      = !sinDescuento && !esSuspension;
          const diasDesc     = esFalta ? (turnoHorasPuesto >= 24 ? 3 : turnoHorasPuesto >= 12 ? 2 : 1) : null;

          let salienteNombre = agenteSalienteNombre || "Desconocido";
          try {
            const { rows: sRows } = await pool.query(`SELECT nombre_completo FROM employees WHERE id=$1`, [agenteSalienteId]);
            if (sRows.length) salienteNombre = sRows[0].nombre_completo;
          } catch {}

          const ptId = puesto.titular_employee_id === Number(agenteSalienteId) ? puestoId : null;
          const ptNombre = ptId ? puesto.nombre : null;

          await pool.query(
            `INSERT INTO novedades_nomina_diarias
               (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
                falta, suspension, descanso_trabajado, afecta_septimo, descuento_dia,
                puesto_titular_id, puesto_titular_nombre,
                tipo_novedad, fuente, evento_rrhh_id, dias_descuento,
                requiere_revision_rrhh, impacto_nomina, updated_at)
             VALUES ($1,$2,$3, FALSE, 0, 0,
                     $4, $5, FALSE, $6, $7,
                     $8, $9,
                     $10, 'sustitucion_pizarron', $11, $12,
                     TRUE, 'pendiente', NOW())
             ON CONFLICT (fecha, employee_id) DO UPDATE SET
               trabajo_dia      = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.trabajo_dia
                 ELSE FALSE END,
               horas_trabajadas = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.horas_trabajadas
                 ELSE 0 END,
               horas_extra      = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.horas_extra
                 ELSE 0 END,
               falta            = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.falta
                 ELSE $4 END,
               suspension       = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.suspension
                 ELSE $5 END,
               afecta_septimo   = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.afecta_septimo
                 ELSE $6 END,
               descuento_dia    = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.descuento_dia
                 ELSE $7 END,
               tipo_novedad     = COALESCE(novedades_nomina_diarias.tipo_novedad, $10),
               fuente           = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.fuente
                 ELSE 'sustitucion_pizarron' END,
               evento_rrhh_id   = COALESCE(novedades_nomina_diarias.evento_rrhh_id, $11),
               dias_descuento   = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.dias_descuento
                 ELSE $12 END,
               requiere_revision_rrhh = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.requiere_revision_rrhh
                 ELSE TRUE END,
               impacto_nomina   = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.impacto_nomina
                 ELSE 'pendiente' END,
               updated_at       = NOW()`,
            [hoy, agenteSalienteId, salienteNombre,
             esFalta, esSuspension, esFalta, esFalta,
             ptId, ptNombre,
             tipoNovedad ?? 'falta_total', eventoRrhhSalienteId, diasDesc]
          );
          logger.info({ agenteSalienteId, fecha: hoy, tipoNovedad, diasDesc, esFalta, esSuspension },
            "A-04: novedad de falta/ausencia creada para titular saliente");
        } catch (nomSalienteErr) {
          logger.warn({ nomSalienteErr }, "A-04: no se pudo crear novedad nómina del saliente (no bloqueante)");
        }
      }
    } catch (segErr) {
      logger.warn({ segErr }, "A-04: no se pudo auto-crear segmento al sustituir (no bloqueante)");
    }

    // SAL-01: Detectar impacto salarial (no bloqueante)
    const impacto = await registrarImpactoSalarial({
      agenteId:      agenteEntranteId,
      agenteNombre:  entrante.nombre_completo,
      puestoId:      puestoId,
      puestoNombre:  puesto.nombre,
      clienteNombre: puesto.cliente_nombre ?? "",
      salarioPuesto: puesto.salario_puesto ? Number(puesto.salario_puesto) : null,
      salarioActual: entrante.sueldo_base  ? Number(entrante.sueldo_base)  : null,
      usuario:       usuario ?? null,
      tipoMovimiento: esRelevo ? "relevo" : "reasignacion",
      snapshotPuesto: { nombre: puesto.nombre, cliente_nombre: puesto.cliente_nombre, salario_puesto: puesto.salario_puesto },
    });

    // SAL-02: solo admin/rrhh ven el impacto salarial en la respuesta
    let rolSesionSus = "";
    try { rolSesionSus = JSON.parse(req.headers["x-isp-session"] as string ?? "")?.rol ?? ""; } catch {}
    const puedeVerImpactoSus = rolSesionSus === "admin" || rolSesionSus === "rrhh";

    res.json({
      ok: true,
      mensaje: `Sustitución registrada: ${agenteSalienteNombre} → ${entrante.nombre_completo}`,
      eventoRrhhGenerado: !!tipoEventoRrhh,
      tipoNovedad: tipoNovedad ?? null,
      estadoOperativoPuesto: estadoOpPuesto,
      ...(puedeVerImpactoSus && {
        impactoSalarial: impacto.tieneImpacto
          ? { detectado: true, impactoId: impacto.impactoId }
          : { detectado: false },
      }),
    });
  } catch (err) {
    logger.error({ err }, "POST /operaciones/sustituir error");
    res.status(500).json({ error: "Error al registrar sustitución" });
  }
});

// ─── POST /api/operaciones/liberar ───────────────────────────────────────────
// Quitar agente de un puesto (queda descubierto)
// horaFin: "HH:MM" real de cuando salió — cierra el segmento de cobertura del día

router.post("/operaciones/liberar", async (req, res) => {
  const { puestoId, motivo, usuario, notas, horaFin, generarEventoFalta } = req.body;
  if (!puestoId) return res.status(400).json({ error: "puestoId es requerido" });

  try {
    if (await verificarDiaCerrado()) {
      return res.status(423).json({ error: "Día operativo cerrado. Reabre el día para continuar.", diaCerrado: true });
    }
    const { rows: puestoRows } = await pool.query(`SELECT * FROM puestos_operativos WHERE id=$1`, [puestoId]);
    if (!puestoRows.length) return res.status(404).json({ error: "Puesto no encontrado" });
    const puesto = puestoRows[0];

    if (!puesto.agente_id) return res.status(400).json({ error: "El puesto no tiene agente asignado" });

    const agenteId = puesto.agente_id as number;
    const agenteNombre = puesto.agente_nombre as string;
    const hoy = todayGT();

    // ── Operación atómica: limpiar agente + registrar movimiento ─────────────
    // Si cualquiera de los dos pasos falla, se hace ROLLBACK completo.
    // Segmento de cobertura y eventos RRHH son "best effort" (fuera de la tx).
    const client = await pool.connect();
    let movId: number | null = null;
    try {
      await client.query("BEGIN");

      // IMPORTANTE: solo se limpia agente_id (cobertura del día).
      // El titular_employee_id se preserva para mantener la asignación base.
      await client.query(
        `UPDATE puestos_operativos SET agente_id=NULL, agente_nombre=NULL, estado='descubierto', updated_at=NOW()
         WHERE id=$1`,
        [puestoId]
      );

      const movResult = await client.query(
        `INSERT INTO movimientos_operativos
           (puesto_id, cliente_nombre, puesto_nombre,
            agente_saliente_id, agente_saliente_nombre,
            tipo, motivo, usuario_cambio, notas)
         VALUES ($1, $2, $3, $4, $5, 'liberacion', $6, $7, $8)
         RETURNING id`,
        [
          puestoId, puesto.cliente_nombre, puesto.nombre,
          agenteId, agenteNombre,
          motivo || null, usuario || 'sistema', notas || null,
        ]
      );
      movId = movResult.rows[0]?.id ?? null;

      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      client.release();
      logger.error({ txErr, puestoId }, "liberar: transacción revertida");
      return res.status(500).json({ error: "Error al liberar puesto. La operación fue revertida." });
    }
    client.release();

    // ── Cerrar segmento de cobertura del día si se indica hora de salida ──────
    if (horaFin) {
      try {
        // Calcular horas: obtenemos hora_inicio del segmento para el cálculo
        const { rows: segRows } = await pool.query(
          `SELECT hora_inicio FROM cobertura_segmentos
           WHERE fecha=$1 AND puesto_id=$2 AND employee_id=$3 AND hora_fin IS NULL
           ORDER BY created_at DESC LIMIT 1`,
          [hoy, puestoId, agenteId]
        );
        const horaInicio = segRows[0]?.hora_inicio ?? null;
        let horasReal: number | null = null;
        if (horaInicio) {
          const [h1, m1] = horaInicio.split(":").map(Number);
          const [h2, m2] = horaFin.split(":").map(Number);
          let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
          if (mins < 0) mins += 24 * 60;
          horasReal = Math.round(mins / 6) / 10;
        }
        await pool.query(
          `UPDATE cobertura_segmentos
           SET hora_fin = $1,
               horas_calculadas = COALESCE($2, horas_calculadas),
               updated_at = NOW()
           WHERE fecha=$3 AND puesto_id=$4 AND employee_id=$5 AND hora_fin IS NULL`,
          [horaFin, horasReal, hoy, puestoId, agenteId]
        );
      } catch (segErr) {
        logger.warn({ segErr }, "liberar: no se pudo cerrar segmento (no bloqueante)");
      }
    }

    // ── Generar evento RRHH + novedad nómina si fue falta ────────────────────
    const esFalta = motivo === 'falta' || generarEventoFalta === true;
    if (esFalta) {
      try {
        const { rows: empRows } = await pool.query(`SELECT * FROM employees WHERE id=$1`, [agenteId]);
        const emp = empRows[0];
        if (emp) {
          // Capturar ID del evento RRHH para enlazarlo a la novedad
          const { rows: eventoRows } = await pool.query(
            `INSERT INTO eventos_rrhh
               (employee_id, employee_nombre, employee_dpi, tipo_evento, fecha,
                cliente_nombre, puesto_nombre, generado_desde, movimiento_id, estado,
                usuario_generador, observaciones)
             VALUES ($1, $2, $3, 'falta', NOW(), $4, $5, 'pizarron', $6, 'pendiente', $7, $8)
             RETURNING id`,
            [emp.id, emp.nombre_completo, emp.dpi ?? null,
             puesto.cliente_nombre, puesto.nombre,
             movId, usuario || 'sistema', notas || null]
          );
          const eventoRrhhId = eventoRows[0]?.id ?? null;

          // Novedad pendiente de revisión RRHH — no se descuenta hasta que RRHH resuelva
          await pool.query(
            `INSERT INTO novedades_nomina_diarias
               (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
                falta, descuento_dia, impacto_nomina, requiere_revision_rrhh,
                tipo_novedad, evento_rrhh_id, puesto_titular_id, puesto_titular_nombre, fuente)
             VALUES ($1, $2, $3, FALSE, 0, 0, FALSE, FALSE, 'pendiente', TRUE,
                     'falta_total', $6, $4, $5, 'liberacion_pizarron')
             ON CONFLICT (fecha, employee_id) DO UPDATE SET
               trabajo_dia            = FALSE,
               horas_trabajadas       = 0,
               tipo_novedad           = COALESCE(novedades_nomina_diarias.tipo_novedad, 'falta_total'),
               evento_rrhh_id         = COALESCE(novedades_nomina_diarias.evento_rrhh_id, EXCLUDED.evento_rrhh_id),
               impacto_nomina         = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.impacto_nomina
                 ELSE 'pendiente'
               END,
               requiere_revision_rrhh = CASE
                 WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                 THEN novedades_nomina_diarias.requiere_revision_rrhh
                 ELSE TRUE
               END,
               updated_at             = NOW()`,
            [hoy, emp.id, emp.nombre_completo, puesto.id, puesto.nombre, eventoRrhhId]
          );
          logger.info({ agenteId, hoy, eventoRrhhId }, "liberar: incidencia creada como pendiente RRHH");
        }
      } catch (faltaErr) {
        logger.warn({ faltaErr }, "liberar: no se pudo crear evento falta (no bloqueante)");
      }
    }

    res.json({
      ok: true,
      mensaje: `${agenteNombre} removido de ${puesto.nombre}`,
      faltaRegistrada: esFalta,
      segmentoCerrado: !!horaFin,
    });
  } catch (err) {
    logger.error({ err }, "POST /operaciones/liberar error");
    res.status(500).json({ error: "Error al liberar puesto" });
  }
});

export default router;
