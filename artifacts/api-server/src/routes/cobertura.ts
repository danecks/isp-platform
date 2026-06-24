import { Router } from "express";
import { pool, todayGT } from "@workspace/db";
import { logger } from "../lib/logger";
import { validarEmpleadoAsignable } from "../lib/empleado-fecha-ingreso";

const coberturaRouter = Router();

// Resuelve si un titular trabaja en una fecha usando su puesto_slot.dias_trabajo.
// cycleDay = (diasDesdeInicio % longitud_ciclo) + 1  (1..longitud_ciclo).
// Réplica de la lógica del pizarrón (tablero.ts) para puestos 24h multi-titular.
function calcTrabajaPorSlot(
  diasTrabajo: number[],
  fechaInicioStr: string,
  fechaConsulta: string,
  longitudCiclo = 14,
): boolean {
  const lc = (longitudCiclo && longitudCiclo > 0) ? longitudCiclo : 14;
  const [iy, im, id] = fechaInicioStr.split("-").map(Number);
  const [cy, cm, cd] = fechaConsulta.split("-").map(Number);
  const inicio   = Date.UTC(iy, im - 1, id);
  const consulta = Date.UTC(cy, cm - 1, cd);
  const daysElapsed = Math.floor((consulta - inicio) / 86400000);
  const cycleDay = ((daysElapsed % lc) + lc) % lc + 1; // 1-based, maneja offsets negativos
  return diasTrabajo.includes(cycleDay);
}

// ─── GET /api/cobertura/diaria ────────────────────────────────────────────────
// Cobertura del día (o fecha específica), opcionalmente filtrada por cliente
coberturaRouter.get("/cobertura/diaria", async (req, res) => {
  try {
    const fecha     = (req.query.fecha as string)    || todayGT();
    const clienteId = req.query.clienteId as string;

    let sql = `
      SELECT cd.*,
             et.nombre_completo AS titular_nombre_emp,
             et.telefono        AS titular_telefono,
             ec.nombre_completo AS cobertura_nombre_emp,
             ec.telefono        AS cobertura_telefono
      FROM cobertura_diaria cd
      LEFT JOIN employees et ON et.id = cd.titular_employee_id
      LEFT JOIN employees ec ON ec.id = cd.cobertura_employee_id
      WHERE cd.fecha = $1
    `;
    const params: any[] = [fecha];

    if (clienteId) {
      sql += ` AND cd.client_id = $2`;
      params.push(clienteId);
    }

    sql += ` ORDER BY cd.cliente_nombre, cd.puesto_nombre`;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /cobertura/diaria error");
    res.status(500).json({ error: "Error al cargar cobertura diaria" });
  }
});

// ─── POST /api/cobertura/diaria ───────────────────────────────────────────────
// Registrar o actualizar cobertura para un puesto en una fecha
coberturaRouter.post("/cobertura/diaria", async (req, res) => {
  const {
    fecha, puestoId, clientId, sedeId, clienteNombre, puestoNombre,
    titularEmployeeId, titularNombre, coberturaEmployeeId, coberturaNombre,
    tipoCobertura, motivo, horasTrabajadas, horasExtra, observaciones, usuarioRegistro
  } = req.body;

  if (!fecha || !puestoId) return res.status(400).json({ error: "fecha y puestoId son requeridos" });

  try {
    // Bloqueo fecha_ingreso: si viene un cobertura_employee_id, validar que ya inició labores a esa fecha.
    if (coberturaEmployeeId != null) {
      const _vIng = await validarEmpleadoAsignable(pool, Number(coberturaEmployeeId), String(fecha));
      if (!_vIng.ok) {
        return res.status(409).json({ error: _vIng.error ?? "Empleado aún no inicia labores." });
      }
    }

    // Upsert: si ya existe registro para ese puesto+fecha, actualiza
    const existing = await pool.query(
      `SELECT id FROM cobertura_diaria WHERE fecha = $1 AND puesto_id = $2`,
      [fecha, puestoId]
    );

    if (existing.rows.length > 0) {
      const { rows } = await pool.query(
        `UPDATE cobertura_diaria
         SET cobertura_employee_id = $1,
             cobertura_nombre      = $2,
             tipo_cobertura        = $3,
             motivo                = $4,
             horas_trabajadas      = $5,
             horas_extra           = $6,
             observaciones         = $7,
             usuario_registro      = $8,
             updated_at            = NOW()
         WHERE id = $9
         RETURNING *`,
        [coberturaEmployeeId ?? null, coberturaNombre ?? null,
         tipoCobertura || 'titular', motivo ?? null,
         horasTrabajadas ?? null, horasExtra ?? null,
         observaciones ?? null, usuarioRegistro ?? null, existing.rows[0].id]
      );
      return res.json(rows[0]);
    }

    const { rows } = await pool.query(
      `INSERT INTO cobertura_diaria
         (fecha, puesto_id, client_id, sede_id, cliente_nombre, puesto_nombre,
          titular_employee_id, titular_nombre, cobertura_employee_id, cobertura_nombre,
          tipo_cobertura, motivo, horas_trabajadas, horas_extra, observaciones, usuario_registro)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [fecha, puestoId, clientId ?? null, sedeId ?? null, clienteNombre ?? null, puestoNombre ?? null,
       titularEmployeeId ?? null, titularNombre ?? null, coberturaEmployeeId ?? null, coberturaNombre ?? null,
       tipoCobertura || 'titular', motivo ?? null, horasTrabajadas ?? null, horasExtra ?? null,
       observaciones ?? null, usuarioRegistro ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    logger.error({ err }, "POST /cobertura/diaria error");
    res.status(500).json({ error: "Error al registrar cobertura" });
  }
});

// ─── GET /api/cobertura/reporte ───────────────────────────────────────────────
// Reporte de cobertura para un rango de fechas
coberturaRouter.get("/cobertura/reporte", async (req, res) => {
  try {
    const desde     = (req.query.desde as string)    || todayGT();
    const hasta     = (req.query.hasta as string)    || desde;
    const clienteId = req.query.clienteId as string;

    let sql = `
      SELECT
        cd.fecha,
        cd.cliente_nombre,
        cd.puesto_nombre,
        cd.titular_nombre,
        cd.cobertura_nombre,
        cd.tipo_cobertura,
        cd.motivo,
        cd.horas_trabajadas,
        cd.horas_extra,
        cd.observaciones,
        CASE WHEN cd.tipo_cobertura = 'ausencia_sin_cubrir' THEN TRUE ELSE FALSE END AS faltante,
        CASE WHEN cd.tipo_cobertura = 'relevo' THEN TRUE ELSE FALSE END AS hubo_relevo
      FROM cobertura_diaria cd
      WHERE cd.fecha BETWEEN $1 AND $2
    `;
    const params: any[] = [desde, hasta];

    if (clienteId) {
      sql += ` AND cd.client_id = $3`;
      params.push(clienteId);
    }

    sql += ` ORDER BY cd.fecha DESC, cd.cliente_nombre, cd.puesto_nombre`;

    const { rows } = await pool.query(sql, params);

    const resumen = {
      totalRegistros : rows.length,
      totalTitulares : rows.filter((r: any) => r.tipo_cobertura === 'titular').length,
      totalRelevos   : rows.filter((r: any) => r.tipo_cobertura === 'relevo').length,
      totalAusencias : rows.filter((r: any) => r.tipo_cobertura === 'ausencia_sin_cubrir').length,
      horasExtra     : rows.reduce((s: number, r: any) => s + parseFloat(r.horas_extra || 0), 0),
    };

    res.json({ reporte: rows, resumen });
  } catch (err) {
    logger.error({ err }, "GET /cobertura/reporte error");
    res.status(500).json({ error: "Error al generar reporte de cobertura" });
  }
});

// ─── Helpers de cálculo ───────────────────────────────────────────────────────

/**
 * Convierte "HH:MM" a minutos desde medianoche.
 * Si hora_fin < hora_inicio → turno cruzó medianoche (+1440).
 */
function horaAMinutos(h: string): number {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + mm;
}

function calcularHoras(horaInicio: string, horaFin: string): number {
  let inicio = horaAMinutos(horaInicio);
  let fin    = horaAMinutos(horaFin);
  if (fin <= inicio) fin += 1440; // turno nocturno cruza medianoche
  return parseFloat(((fin - inicio) / 60).toFixed(2));
}

/** Verifica si un tramo [inicio, fin] solapa con la ventana de descanso del puesto */
function solapaCon(inicioSeg: string, finSeg: string, descInicio: string | null, descFin: string | null): boolean {
  if (!descInicio || !descFin) return false;
  const a1 = horaAMinutos(inicioSeg);
  let a2 = horaAMinutos(finSeg); if (a2 <= a1) a2 += 1440;
  const b1 = horaAMinutos(descInicio);
  let b2 = horaAMinutos(descFin); if (b2 <= b1) b2 += 1440;
  return a1 < b2 && a2 > b1;
}

// ─── GET /api/cobertura/segmentos ─────────────────────────────────────────────
// Tramos de cobertura para un puesto en una fecha (o todos los de un empleado en una fecha)
coberturaRouter.get("/cobertura/segmentos", async (req, res) => {
  try {
    const fecha      = (req.query.fecha as string) || todayGT();
    const puestoId   = req.query.puestoId   as string | undefined;
    const employeeId = req.query.employeeId as string | undefined;

    const clauses: string[] = ["cs.fecha = $1"];
    const params: unknown[] = [fecha];

    if (puestoId) {
      params.push(Number(puestoId));
      clauses.push(`cs.puesto_id = $${params.length}`);
    }
    if (employeeId) {
      params.push(Number(employeeId));
      clauses.push(`cs.employee_id = $${params.length}`);
    }

    const { rows } = await pool.query(`
      SELECT cs.*,
             e.nombre_completo AS empleado_nombre_join,
             po.nombre         AS puesto_nombre_join,
             po.hora_entrada, po.hora_salida,
             po.descanso_inicio, po.descanso_fin,
             po.elegible_horas_extra
      FROM cobertura_segmentos cs
      LEFT JOIN employees         e  ON e.id  = cs.employee_id
      LEFT JOIN puestos_operativos po ON po.id = cs.puesto_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY cs.hora_inicio NULLS LAST, cs.created_at
    `, params);

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /cobertura/segmentos error");
    res.status(500).json({ error: "Error al cargar segmentos de cobertura" });
  }
});

// ─── Helper: sincroniza cobertura_diaria desde los segmentos registrados ────
// Llamado cada vez que se agrega o elimina un segmento, mantiene ambas tablas
// consistentes para que los reportes y la nómina usen la misma fuente de verdad.
async function syncCoberturaDesdeSegmentos(fecha: string, puestoId: number): Promise<void> {
  // 1. Traer todos los segmentos activos del puesto para esa fecha
  const { rows: segs } = await pool.query(
    `SELECT cs.*,
            po.cliente_id, po.sede_id,
            po.nombre AS puesto_nombre_po,
            po.titular_employee_id,
            c.nombre AS cliente_nombre_c
     FROM cobertura_segmentos cs
     LEFT JOIN puestos_operativos po ON po.id = cs.puesto_id
     LEFT JOIN clients            c  ON c.id  = po.cliente_id
     WHERE cs.fecha = $1 AND cs.puesto_id = $2
     ORDER BY cs.hora_inicio NULLS LAST`,
    [fecha, puestoId]
  );

  // 2. Si no quedan segmentos → borrar el registro de cobertura_diaria
  if (segs.length === 0) {
    await pool.query(
      `DELETE FROM cobertura_diaria WHERE fecha = $1 AND puesto_id = $2`,
      [fecha, puestoId]
    );
    return;
  }

  // 3. Calcular totales agregados
  const totalHoras = segs.reduce((s: number, r: any) => s + parseFloat(r.horas_calculadas ?? 0), 0);
  const totalHE    = segs.reduce((s: number, r: any) => s + (r.genera_horas_extra ? parseFloat(r.horas_calculadas ?? 0) : 0), 0);

  // Tipo de cobertura predominante: titular > relevo > otros
  const tipos = segs.map((s: any) => s.tipo_cobertura);
  let tipoPred = tipos.includes("titular") ? "titular"
               : tipos.includes("relevo")  ? "relevo"
               : tipos[0] ?? "relevo";

  // Empleado representativo: último segmento registrado (o el titular)
  const last    = segs[segs.length - 1];
  const first   = segs[0];
  const clientId     = last.cliente_id;
  const sedeId       = last.sede_id;
  const clienteNom   = last.cliente_nombre_c ?? last.empleado_nombre;
  const puestoNom    = last.puesto_nombre_po ?? last.empleado_nombre;
  const cobEmpId     = last.employee_id;
  const cobEmpNom    = last.empleado_nombre ?? null;
  const titEmpId     = first.titular_employee_id ?? null;

  // 4. Upsert en cobertura_diaria
  const existing = await pool.query(
    `SELECT id FROM cobertura_diaria WHERE fecha = $1 AND puesto_id = $2`,
    [fecha, puestoId]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE cobertura_diaria
       SET tipo_cobertura        = $1,
           cobertura_employee_id = $2,
           cobertura_nombre      = $3,
           horas_trabajadas      = $4,
           horas_extra           = $5,
           updated_at            = NOW()
       WHERE id = $6`,
      [tipoPred, cobEmpId, cobEmpNom,
       parseFloat(totalHoras.toFixed(2)),
       parseFloat(totalHE.toFixed(2)),
       existing.rows[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO cobertura_diaria
         (fecha, puesto_id, client_id, sede_id, cliente_nombre, puesto_nombre,
          titular_employee_id, cobertura_employee_id, cobertura_nombre,
          tipo_cobertura, horas_trabajadas, horas_extra, usuario_registro)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'sistema_segmentos')`,
      [fecha, puestoId, clientId ?? null, sedeId ?? null,
       clienteNom ?? null, puestoNom ?? null,
       titEmpId ?? null, cobEmpId, cobEmpNom,
       tipoPred,
       parseFloat(totalHoras.toFixed(2)),
       parseFloat(totalHE.toFixed(2))]
    );
  }
}

// ─── POST /api/cobertura/segmentos ────────────────────────────────────────────
// Registrar un nuevo tramo de cobertura con cálculo automático de horas
coberturaRouter.post("/cobertura/segmentos", async (req, res) => {
  const {
    fecha, puestoId, clientId, sedeId, employeeId, empleadoNombre,
    tipoCobertura, horaInicio, horaFin, motivo, observaciones, usuarioRegistro,
    tipoNovedadTitular, modoPagoHE,
  } = req.body;

  if (!fecha || !puestoId || !employeeId) {
    return res.status(400).json({ error: "fecha, puestoId y employeeId son requeridos" });
  }

  // Fix P-NOM-03: hora_inicio y hora_fin son obligatorias para calcular horas
  if (!horaInicio || !horaFin) {
    return res.status(400).json({ error: "hora_inicio y hora_fin son requeridos para registrar un tramo de cobertura" });
  }

  // Bloqueo fecha_ingreso: el colaborador debe haber iniciado labores para esa fecha
  {
    const _v = await validarEmpleadoAsignable(pool, employeeId, fecha);
    if (!_v.ok) return res.status(400).json({ error: _v.error });
  }

  try {
    // Obtener datos del puesto para validaciones
    const { rows: puestos } = await pool.query(
      `SELECT po.descanso_inicio, po.descanso_fin, po.elegible_horas_extra,
              po.hora_entrada, po.hora_salida, po.titular_employee_id, po.cliente_nombre,
              po.nombre AS puesto_nombre,
              COALESCE(t.num_titulares, 1) AS num_titulares,
              t.horas_trabajo::float AS horas_trabajo
       FROM puestos_operativos po
       LEFT JOIN turnos t ON t.id = po.tipo_turno_id
       WHERE po.id = $1`,
      [puestoId]
    );
    const puesto = puestos[0];

    // Calcular horas del tramo
    let horasCalculadas: number | null = null;
    let fueEnDiaDescanso = false;
    let generaHorasExtra = false;
    let horasExtraCalculadas: number | null = null;

    if (horaInicio && horaFin) {
      horasCalculadas = calcularHoras(horaInicio, horaFin);

      // Detectar solapamiento con descanso del puesto
      if (puesto?.descanso_inicio && puesto?.descanso_fin) {
        fueEnDiaDescanso = solapaCon(horaInicio, horaFin, puesto.descanso_inicio, puesto.descanso_fin);
      }

      if (puesto?.hora_entrada && puesto?.hora_salida) {
        const jornadaBase = calcularHoras(puesto.hora_entrada, puesto.hora_salida);
        const exceso = horasCalculadas !== null && jornadaBase > 0
          ? Math.max(0, horasCalculadas - jornadaBase)
          : 0;
        generaHorasExtra = fueEnDiaDescanso || exceso > 0;
        if (generaHorasExtra) {
          horasExtraCalculadas = fueEnDiaDescanso
            ? horasCalculadas ?? 0
            : exceso;
        }
      }
    }

    const { rows } = await pool.query(`
      INSERT INTO cobertura_segmentos
        (fecha, puesto_id, client_id, sede_id, employee_id, empleado_nombre,
         tipo_cobertura, hora_inicio, hora_fin, horas_calculadas,
         motivo, fue_en_dia_descanso, genera_horas_extra, horas_extra_calculadas,
         observaciones, usuario_registro)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *
    `, [
      fecha, puestoId, clientId ?? null, sedeId ?? null, employeeId,
      empleadoNombre ?? null,
      tipoCobertura || 'relevo', horaInicio ?? null, horaFin ?? null,
      horasCalculadas, motivo ?? null, fueEnDiaDescanso, generaHorasExtra,
      horasExtraCalculadas ?? null,
      observaciones ?? null, usuarioRegistro ?? null,
    ]);

    // C-02: sincronizar cobertura_diaria con el nuevo segmento
    try {
      await syncCoberturaDesdeSegmentos(fecha, Number(puestoId));
    } catch (syncErr) {
      logger.warn({ syncErr }, "POST /cobertura/segmentos — sync cobertura_diaria falló (no bloqueante)");
    }

    // ── OPER-RRHH: lógica de alertas y descuentos ────────────────────────────
    const segTipo = tipoCobertura || "relevo";
    const numTitulares = Number(puesto?.num_titulares ?? 1);
    // Descuento: 2x si 1 titular (12h), 3x si 2 titulares (24h)
    const factorDescuento = numTitulares >= 2 ? 3 : 2;
    // Horas del turno del puesto (para evento RRHH y días de descuento del titular)
    const turnoHoras = Number(puesto?.horas_trabajo) > 0
      ? Number(puesto.horas_trabajo)
      : (puesto?.hora_entrada && puesto?.hora_salida
          ? calcularHoras(puesto.hora_entrada, puesto.hora_salida)
          : (numTitulares >= 2 ? 24 : 12));

    try {
      if (segTipo === "ausencia_sin_cubrir") {
        // Verificar si el empleado tiene evento activo que justifique la ausencia
        let tieneEventoActivo = false;
        if (employeeId) {
          const { rows: eventosActivos } = await pool.query(
            `SELECT id FROM eventos_rrhh
             WHERE employee_id = $1
               AND estado NOT IN ('anulado','cerrado')
               AND tipo_evento IN ('vacaciones','incapacidad','suspension','permiso_goce_sueldo','suspension_legal')
               AND DATE(fecha) <= $2
               AND (fecha_fin IS NULL OR DATE(fecha_fin) >= $2)
             LIMIT 1`,
            [employeeId, fecha]
          );
          tieneEventoActivo = eventosActivos.length > 0;
        }

        if (!tieneEventoActivo) {
          // Generar alerta a RRHH — faltante sin justificación
          await pool.query(
            `INSERT INTO rrhh_alertas
               (employee_id, employee_nombre, tipo, prioridad, estado,
                datos_clave, sugerencia, puesto_id, puesto_nombre, fecha_evento)
             VALUES ($1,$2,'faltante_sin_cubrir','alta','pendiente',$3,
                     'Verificar si el agente justifica la ausencia y generar acta correspondiente.',
                     $4,$5,$6)
             ON CONFLICT DO NOTHING`,
            [
              employeeId ?? null,
              empleadoNombre ?? "Agente desconocido",
              JSON.stringify({ segmento_id: rows[0].id, puesto_id: puestoId, cliente: puesto?.cliente_nombre }),
              puestoId ?? null,
              puesto?.puesto_nombre ?? null,
              fecha,
            ]
          );

          // Calcular días de descuento en novedades_nomina_diarias
          if (employeeId) {
            await pool.query(
              `UPDATE novedades_nomina_diarias
               SET dias_descuento = $1, descuento_dia = TRUE, updated_at = NOW()
               WHERE fecha = $2 AND employee_id = $3`,
              [factorDescuento, fecha, employeeId]
            );
          }
        }

      } else if (segTipo === "relevo" || segTipo === "horas_extra_puras") {
        // Marcar alertas de faltante del mismo puesto y fecha como cubiertas
        await pool.query(
          `UPDATE rrhh_alertas
           SET estado              = 'cubierto',
               cubierto_por_employee_id = $1,
               cubierto_por_nombre      = $2,
               cubierto_at              = NOW(),
               resuelta_at              = NOW()
           WHERE tipo        = 'faltante_sin_cubrir'
             AND estado      = 'pendiente'
             AND puesto_id   = $3
             AND fecha_evento = $4`,
          [employeeId ?? null, empleadoNombre ?? null, puestoId, fecha]
        );

        // ── RELEVO POR FALTA DEL TITULAR: evento + novedad de falta del titular ──
        // Igual que el flujo normal de sustitución: si el titular faltó, generar su
        // evento RRHH y su novedad de nómina (con descuento según el motivo).
        let titularId = puesto?.titular_employee_id ?? null;

        // Puestos 24h con 2+ titulares por SLOTS: titular_employee_id (legacy) es NULL.
        // Resolver el titular que trabaja HOY (el que faltó) desde puesto_slots por ciclo,
        // igual que el pizarrón. Se excluye al cubriente y se toma el primero que trabaja.
        if (!titularId && segTipo === "relevo" && tipoNovedadTitular) {
          try {
            const { rows: slotRows } = await pool.query(
              `SELECT ps.empleado_id, ps.dias_trabajo,
                      COALESCE(ps.longitud_ciclo, 14)::int AS longitud_ciclo,
                      COALESCE(ps.fecha_inicio_ciclo, po.fecha_inicio_ciclo)::text AS fecha_inicio_ciclo
               FROM puesto_slots ps
               JOIN puestos_operativos po ON po.id = ps.puesto_id
               WHERE ps.puesto_id = $1 AND ps.activo = TRUE AND ps.empleado_id IS NOT NULL
               ORDER BY ps.slot_numero`,
              [puestoId]
            );
            for (const s of slotRows) {
              if (!s.empleado_id || Number(s.empleado_id) === Number(employeeId)) continue;
              const dias: number[] = Array.isArray(s.dias_trabajo) ? s.dias_trabajo : [];
              if (!dias.length || !s.fecha_inicio_ciclo) continue;
              if (calcTrabajaPorSlot(dias, String(s.fecha_inicio_ciclo).slice(0, 10), fecha, s.longitud_ciclo)) {
                titularId = s.empleado_id;
                break;
              }
            }
          } catch (slotErr) {
            logger.warn({ slotErr }, "POST /cobertura/segmentos — resolución de titular por slot falló (no bloqueante)");
          }
        }

        // No generar falta/amonestación del titular si HOY está cubriendo en OTRO
        // puesto/custodia o está en un Servicio Especial (SSA): no puede estar en dos
        // lugares a la vez, sigue trabajando → no es falta ni descuento. Espeja la
        // detección del tablero (cubriendoOtroLado + ssaMap).
        let titularCubreOtroLado = false;
        if (segTipo === "relevo" && tipoNovedadTitular && titularId && Number(titularId) !== Number(employeeId)) {
          try {
            const { rows: otroLado } = await pool.query(
              `SELECT 1
                 FROM cobertura_segmentos
                WHERE employee_id = $1 AND fecha = $2::date AND puesto_id <> $3
                  AND tipo_cobertura <> 'ausencia_sin_cubrir'
               UNION ALL
               SELECT 1
                 FROM custodia_asignacion_diaria
                WHERE employee_id = $1 AND fecha = $2::date
               UNION ALL
               SELECT 1
                 FROM ssa_agentes sa
                 JOIN solicitudes_servicio_adicional s2 ON s2.id = sa.ssa_id
                WHERE sa.employee_id = $1 AND sa.estado IN ('asignado','confirmado')
                  AND s2.estado_general NOT IN ('cancelada','cerrada')
                  AND $2::date BETWEEN s2.fecha AND COALESCE(s2.fecha_fin, s2.fecha)
               UNION ALL
               SELECT 1
                 FROM solicitudes_servicio_adicional s
                WHERE s.agente_id = $1 AND s.estado_general NOT IN ('cancelada','cerrada')
                  AND $2::date BETWEEN s.fecha AND COALESCE(s.fecha_fin, s.fecha)
               LIMIT 1`,
              [titularId, fecha, puestoId]
            );
            titularCubreOtroLado = otroLado.length > 0;
            if (titularCubreOtroLado) {
              logger.info({ titularId, fecha, puestoId },
                "POST /cobertura/segmentos — titular cubre en otro lado/SSA: se omite falta y descuento");
            }
          } catch (otroErr) {
            logger.warn({ otroErr }, "POST /cobertura/segmentos — verificación 'titular cubre otro lado' falló (no bloqueante)");
          }
        }

        if (segTipo === "relevo" && tipoNovedadTitular && titularId && Number(titularId) !== Number(employeeId) && !titularCubreOtroLado) {
          try {
            // Mapeo motivo (front) → tipo_evento RRHH (mirror asignacion.ts)
            const tiposRrhhTitular: Record<string, string> = {
              falta_total:      "falta",
              abandono_parcial: "abandono_parcial",
              suspension_disc:  "suspension_disciplinaria",
              suspension:       "suspension_disciplinaria",
              incapacidad:      "incapacidad",
              permiso_sin_goce: "permiso_sin_goce",
              permiso_con_goce: "permiso_con_goce",
            };
            const tipoEventoRrhh = tiposRrhhTitular[tipoNovedadTitular] ?? null;
            if (tipoEventoRrhh) {
              const TIPOS_SIN_DESCUENTO = ["vacaciones", "relevo_vacaciones", "incapacidad", "permiso_con_goce", "permiso", "descanso"];
              const sinDescuento = TIPOS_SIN_DESCUENTO.includes(tipoNovedadTitular);
              const esSuspension = ["suspension", "suspension_disciplinaria"].includes(tipoEventoRrhh);
              const esFalta      = !sinDescuento && !esSuspension;
              const diasDesc     = esFalta ? (turnoHoras >= 24 ? 3 : turnoHoras >= 12 ? 2 : 1) : null;

              // Datos del titular
              let titularNombre = "Titular";
              let titularDpi: string | null = null;
              const { rows: tRows } = await pool.query(
                `SELECT nombre_completo, dpi FROM employees WHERE id = $1`, [titularId]
              );
              if (tRows.length) {
                titularNombre = tRows[0].nombre_completo ?? "Titular";
                titularDpi    = tRows[0].dpi ?? null;
              }

              // Evento RRHH del titular — idempotente: solo uno por titular+fecha desde tramos
              let eventoTitularId: number | null = null;
              const { rows: evDup } = await pool.query(
                `SELECT id FROM eventos_rrhh
                 WHERE employee_id = $1 AND fecha::date = $2::date
                   AND tipo_evento = $3 AND generado_desde = 'cobertura_tramos'
                 LIMIT 1`,
                [titularId, fecha, tipoEventoRrhh]
              );
              if (evDup.length) {
                eventoTitularId = evDup[0].id;
              } else {
                const { rows: evNew } = await pool.query(
                  `INSERT INTO eventos_rrhh
                     (employee_id, employee_nombre, employee_dpi,
                      tipo_evento, fecha, cliente_nombre, puesto_nombre,
                      generado_desde, estado, usuario_generador, documentos_generados,
                      cantidad_horas)
                   VALUES ($1,$2,$3,$4,$9::date,$5,$6,'cobertura_tramos','pendiente_aprobacion',$7,'[]',$8)
                   RETURNING id`,
                  [titularId, titularNombre, titularDpi, tipoEventoRrhh,
                   puesto?.cliente_nombre ?? null, puesto?.puesto_nombre ?? null,
                   usuarioRegistro ?? "sistema", turnoHoras, fecha]
                );
                eventoTitularId = evNew[0]?.id ?? null;
              }

              // Novedad de nómina del titular (descuento de días) — mirror asignacion.ts
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
                         $10, 'cobertura_tramos', $11, $12,
                         TRUE, 'pendiente', NOW())
                 ON CONFLICT (fecha, employee_id) DO UPDATE SET
                   trabajo_dia      = CASE WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh') THEN novedades_nomina_diarias.trabajo_dia ELSE FALSE END,
                   horas_trabajadas = CASE WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh') THEN novedades_nomina_diarias.horas_trabajadas ELSE 0 END,
                   horas_extra      = CASE WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh') THEN novedades_nomina_diarias.horas_extra ELSE 0 END,
                   falta            = CASE WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh') THEN novedades_nomina_diarias.falta ELSE $4 END,
                   suspension       = CASE WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh') THEN novedades_nomina_diarias.suspension ELSE $5 END,
                   afecta_septimo   = CASE WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh') THEN novedades_nomina_diarias.afecta_septimo ELSE $6 END,
                   descuento_dia    = CASE WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh') THEN novedades_nomina_diarias.descuento_dia ELSE $7 END,
                   tipo_novedad     = COALESCE(novedades_nomina_diarias.tipo_novedad, $10),
                   fuente           = CASE WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh') THEN novedades_nomina_diarias.fuente ELSE 'cobertura_tramos' END,
                   evento_rrhh_id   = COALESCE(novedades_nomina_diarias.evento_rrhh_id, $11),
                   dias_descuento   = CASE WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh') THEN novedades_nomina_diarias.dias_descuento ELSE $12 END,
                   requiere_revision_rrhh = CASE WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh') THEN novedades_nomina_diarias.requiere_revision_rrhh ELSE TRUE END,
                   impacto_nomina   = CASE WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh') THEN novedades_nomina_diarias.impacto_nomina ELSE 'pendiente' END,
                   updated_at       = NOW()`,
                [fecha, titularId, titularNombre,
                 esFalta, esSuspension, esFalta, esFalta,
                 puestoId,
                 puesto?.puesto_nombre ?? null,
                 tipoNovedadTitular, eventoTitularId, diasDesc]
              );
              logger.info({ titularId, fecha, tipoNovedadTitular, diasDesc, esFalta, esSuspension },
                "POST /cobertura/segmentos — novedad de falta del titular generada (relevo tramos)");
            }
          } catch (titErr) {
            logger.warn({ titErr }, "POST /cobertura/segmentos — novedad del titular falló (no bloqueante)");
          }
        }

        // ── PAGO HE DEL CUBRIENTE: asegurar fila de novedad cuando se decidió modo ──
        // Solo cuando el front envía modoPagoHE (cubriente en descanso). Garantiza que
        // exista la novedad con impacto_nomina='pendiente' para que:
        //  - efectivo: POST /api/incentivos la voltee a 'pagado_efectivo' (el cierre la preserva)
        //  - planilla: pase por revisión RRHH y se pague en nómina sin doble pago.
        if ((modoPagoHE === "efectivo" || modoPagoHE === "planilla") && employeeId) {
          const heCubriente = generaHorasExtra
            ? (horasExtraCalculadas ?? horasCalculadas ?? 0)
            : (horasCalculadas ?? 0);
          await pool.query(
            `INSERT INTO novedades_nomina_diarias
               (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
                falta, suspension, descanso_trabajado, afecta_septimo, descuento_dia,
                puesto_cubierto_id, puesto_cubierto_nombre, num_puestos_cubiertos,
                tipo_novedad, fuente, horas_extra_estado, requiere_revision_rrhh, impacto_nomina, updated_at)
             VALUES ($1,$2,$3, TRUE, $4, $5,
                     FALSE, FALSE, TRUE, FALSE, FALSE,
                     $6, $7, 1,
                     'relevo', 'cobertura_tramos', 'pendiente', TRUE, 'pendiente', NOW())
             ON CONFLICT (fecha, employee_id) DO UPDATE SET
               trabajo_dia        = CASE WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh','pagado_efectivo') THEN novedades_nomina_diarias.trabajo_dia ELSE TRUE END,
               horas_extra        = CASE WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh','pagado_efectivo') THEN novedades_nomina_diarias.horas_extra ELSE GREATEST(novedades_nomina_diarias.horas_extra, EXCLUDED.horas_extra) END,
               horas_extra_estado = CASE WHEN COALESCE(novedades_nomina_diarias.horas_extra_estado,'') IN ('aprobado','rechazado','pagado_efectivo') THEN novedades_nomina_diarias.horas_extra_estado ELSE 'pendiente' END,
               descanso_trabajado = TRUE,
               puesto_cubierto_id     = COALESCE(novedades_nomina_diarias.puesto_cubierto_id, EXCLUDED.puesto_cubierto_id),
               puesto_cubierto_nombre = COALESCE(novedades_nomina_diarias.puesto_cubierto_nombre, EXCLUDED.puesto_cubierto_nombre),
               requiere_revision_rrhh = CASE WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh','pagado_efectivo') THEN novedades_nomina_diarias.requiere_revision_rrhh ELSE TRUE END,
               impacto_nomina     = CASE WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh','pagado_efectivo') THEN novedades_nomina_diarias.impacto_nomina ELSE 'pendiente' END,
               updated_at         = NOW()`,
            [fecha, employeeId, empleadoNombre ?? null,
             Number(horasCalculadas ?? 0).toFixed(2),
             Number(heCubriente).toFixed(2),
             puestoId ?? null, puesto?.puesto_nombre ?? null]
          );
        }

        // Si generó horas extra → alerta RRHH para aprobación
        if (generaHorasExtra && employeeId) {
          // Obtener el titular del puesto para trazabilidad
          const titularId   = puesto?.titular_employee_id ?? null;

          // Actualizar novedades con HE pendiente de aprobación
          await pool.query(
            `UPDATE novedades_nomina_diarias
             SET horas_extra_estado = 'pendiente', updated_at = NOW()
             WHERE fecha = $1 AND employee_id = $2 AND horas_extra > 0`,
            [fecha, employeeId]
          );

          // Alerta a RRHH para que apruebe las HE
          await pool.query(
            `INSERT INTO rrhh_alertas
               (employee_id, employee_nombre, tipo, prioridad, estado,
                datos_clave, sugerencia, puesto_id, puesto_nombre, fecha_evento)
             VALUES ($1,$2,'horas_extra_pendiente','media','pendiente',$3,
                     'Aprobar o rechazar horas extra del colaborador que cubrió desde descanso.',
                     $4,$5,$6)`,
            [
              employeeId,
              empleadoNombre ?? "Agente",
              JSON.stringify({
                segmento_id: rows[0].id,
                horas_extra: horasExtraCalculadas,
                cubriendo_a_employee_id: titularId,
                puesto_id: puestoId,
                cliente: puesto?.cliente_nombre,
              }),
              puestoId ?? null,
              puesto?.puesto_nombre ?? null,
              fecha,
            ]
          );

          // Guardar trazabilidad en el segmento recién creado
          await pool.query(
            `UPDATE cobertura_segmentos
             SET cubriendo_a_employee_id = $1, cubriendo_a_nombre = $2
             WHERE id = $3`,
            [titularId, puesto ? `Titular de ${puesto.puesto_nombre}` : null, rows[0].id]
          );
        }
      }
    } catch (rrhhErr) {
      logger.warn({ rrhhErr }, "POST /cobertura/segmentos — lógica RRHH falló (no bloqueante)");
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    logger.error({ err }, "POST /cobertura/segmentos error");
    res.status(500).json({ error: "Error al registrar segmento de cobertura" });
  }
});

// ─── DELETE /api/cobertura/segmentos/:id ──────────────────────────────────────
coberturaRouter.delete("/cobertura/segmentos/:id", async (req, res) => {
  try {
    // Obtener fecha y puestoId antes de borrar (para re-sync)
    const { rows: pre } = await pool.query(
      `SELECT fecha, puesto_id FROM cobertura_segmentos WHERE id = $1`,
      [req.params.id]
    );
    if (!pre.length) return res.status(404).json({ error: "Segmento no encontrado" });
    const { fecha, puesto_id } = pre[0];

    await pool.query(`DELETE FROM cobertura_segmentos WHERE id = $1`, [req.params.id]);

    // C-02: re-sincronizar cobertura_diaria (puede quedar vacío → borra registro)
    try {
      await syncCoberturaDesdeSegmentos(fecha, Number(puesto_id));
    } catch (syncErr) {
      logger.warn({ syncErr }, "DELETE /cobertura/segmentos — sync cobertura_diaria falló (no bloqueante)");
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /cobertura/segmentos error");
    res.status(500).json({ error: "Error al eliminar segmento" });
  }
});

export default coberturaRouter;
