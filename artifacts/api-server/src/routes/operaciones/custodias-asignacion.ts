import { Router } from "express";
import { pool, todayGT } from "@workspace/db";
import { logger } from "../../lib/logger";

import {
  liberarTitularidadAgente,
  lockTitularidadAgente,
} from "./_helpers/titularidad";

import { validarEmpleadoAsignable } from "../../lib/empleado-fecha-ingreso";

const router = Router();

router.post("/operaciones/asignar-custodia", async (req, res) => {
  const { clienteId, slotNumero, employeeId, fecha, notas, soloCobertura } = req.body;
  if (!clienteId || !slotNumero) {
    return res.status(400).json({ error: "clienteId y slotNumero son requeridos" });
  }
  const fechaAsig = fecha || todayGT();

  // Bloqueo fecha_ingreso: si se asigna empleado, debe haber iniciado labores para esa fecha
  if (employeeId) {
    const _v = await validarEmpleadoAsignable(pool, employeeId, fechaAsig);
    if (!_v.ok) return res.status(400).json({ error: _v.error });
  }

  try {
    if (!employeeId) {
      await pool.query(`DELETE FROM custodia_asignacion_diaria WHERE cliente_id = $1 AND fecha = $2::date AND slot_numero = $3`, [clienteId, fechaAsig, slotNumero]);
      return res.json({ ok: true });
    }

    const tx = await pool.connect();
    try {
      await tx.query("BEGIN");
      await lockTitularidadAgente(tx, Number(employeeId));

      const { rows: titularRows } = await tx.query(
        `SELECT employee_id FROM custodia_titulares WHERE cliente_id = $1 AND slot_numero = $2 AND activo = TRUE`,
        [clienteId, slotNumero]
      );
      const titularExistente = titularRows[0]?.employee_id ?? null;

      let liberado: { puestos: any[]; custodias: any[] } = { puestos: [], custodias: [] };

      if (soloCobertura || titularExistente) {
        // Cobertura diaria: NO toca titularidad ni libera nada — es solo un día.
        await tx.query(`
          INSERT INTO custodia_asignacion_diaria (cliente_id, fecha, employee_id, slot_numero, notas)
          VALUES ($1, $2::date, $3, $4, $5)
          ON CONFLICT (cliente_id, fecha, slot_numero)
          DO UPDATE SET employee_id = $3, notas = $5
        `, [clienteId, fechaAsig, employeeId, slotNumero, notas ?? null]);
      } else {
        // Nuevo titular: liberar titularidad previa y asignar — todo atómico.
        liberado = await liberarTitularidadAgente(tx, Number(employeeId), {
          custodia: { clienteId, slotNumero },
        });

        await tx.query(
          `INSERT INTO custodia_titulares (cliente_id, slot_numero, employee_id) VALUES ($1, $2, $3)
           ON CONFLICT (cliente_id, slot_numero, employee_id) DO UPDATE SET activo = TRUE`,
          [clienteId, slotNumero, employeeId]
        );
        await tx.query(`
          INSERT INTO custodia_asignacion_diaria (cliente_id, fecha, employee_id, slot_numero, notas)
          VALUES ($1, $2::date, $3, $4, $5)
          ON CONFLICT (cliente_id, fecha, slot_numero)
          DO UPDATE SET employee_id = $3, notas = COALESCE(EXCLUDED.notas, custodia_asignacion_diaria.notas)
        `, [clienteId, fechaAsig, employeeId, slotNumero, notas ?? null]);
      }

      await tx.query("COMMIT");
      res.json({ ok: true, esTitular: !titularExistente && !soloCobertura, liberado });
    } catch (e) {
      await tx.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      tx.release();
    }
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Este agente ya está asignado a otro slot" });
    }
    logger.error({ err }, "[Custodias/asignar]");
    res.status(500).json({ error: "Error al asignar custodia" });
  }
});


router.post("/operaciones/registrar-falta-custodia", async (req, res) => {
  const { clienteId, slotNumero, empleadoId, motivo, notas, usuario, fecha } = req.body;
  if (!clienteId || !slotNumero || !empleadoId) {
    return res.status(400).json({ error: "clienteId, slotNumero y empleadoId son requeridos" });
  }
  const fechaHoy = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ? fecha
    : todayGT();
  const motivoNorm = motivo ?? "inasistencia";

  try {
    const { rows: emp } = await pool.query(`SELECT id, nombre_completo FROM employees WHERE id = $1`, [empleadoId]);
    if (emp.length === 0) return res.status(404).json({ error: "Empleado no encontrado" });

    const { rows: cl } = await pool.query(`SELECT id, nombre FROM clients WHERE id = $1`, [clienteId]);
    const clienteNombre = cl[0]?.nombre ?? `Cliente ${clienteId}`;
    const notaEvento = notas
      ? `${motivoNorm} — Custodio ${slotNumero} (${clienteNombre}). ${notas}`
      : `${motivoNorm} — Custodio ${slotNumero} (${clienteNombre})`;

    const tx = await pool.connect();
    try {
      await tx.query("BEGIN");

      const { rows: evRows } = await tx.query(`
        INSERT INTO eventos_rrhh (employee_id, employee_nombre, employee_dpi, tipo_evento, fecha, observaciones, notas, usuario_generador, generado_desde, cliente_nombre, puesto_nombre)
        VALUES ($1, $2, $3, 'falta', $4::date, $5, $6, $7, 'operaciones', $8, $9)
        RETURNING id
      `, [empleadoId, emp[0].nombre_completo, '', fechaHoy, motivoNorm, notaEvento, usuario ?? 'sistema', clienteNombre, `Custodio ${slotNumero}`]);
      const eventoId = evRows[0]?.id ?? null;

      // Descuento por falta de custodio: la jornada de custodios es de 12h ⇒ 2 días
      // de descuento (igual que un guardia de 12h). Se crea como incidencia PENDIENTE
      // de RRHH, idéntica a las faltas de guardia diferidas en el cierre:
      // falta=FALSE + requiere_revision_rrhh=TRUE. Al resolverla RRHH en
      // /rrhh/incidencias/:id/resolver se pone falta=TRUE y el dias_descuento=2 entra
      // al cálculo de pre-planilla/planilla. puesto_titular_id es NULL porque los
      // custodios no son titulares de un puesto operativo. La anulación del evento
      // (vía /rrhh/eventos/:id/anular) revierte la novedad (falta=FALSE) por fecha+empleado.
      await tx.query(`
        INSERT INTO novedades_nomina_diarias
          (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
           falta, descuento_dia, impacto_nomina, requiere_revision_rrhh,
           tipo_novedad, evento_rrhh_id, puesto_titular_id, puesto_titular_nombre, fuente,
           dias_descuento)
        VALUES ($1, $2, $3, FALSE, 0, 0, FALSE, FALSE, 'pendiente', TRUE,
                'falta_total', $4, NULL, $5, 'falta_custodia', 2)
        ON CONFLICT (fecha, employee_id) DO UPDATE SET
          trabajo_dia            = FALSE,
          horas_trabajadas       = 0,
          tipo_novedad           = COALESCE(novedades_nomina_diarias.tipo_novedad, 'falta_total'),
          evento_rrhh_id         = COALESCE(novedades_nomina_diarias.evento_rrhh_id, EXCLUDED.evento_rrhh_id),
          dias_descuento         = EXCLUDED.dias_descuento,
          puesto_titular_nombre  = COALESCE(novedades_nomina_diarias.puesto_titular_nombre, EXCLUDED.puesto_titular_nombre),
          fuente                 = COALESCE(novedades_nomina_diarias.fuente, EXCLUDED.fuente),
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
          updated_at             = NOW()
      `, [fechaHoy, empleadoId, emp[0].nombre_completo, eventoId, `Custodio ${slotNumero}`]);

      await tx.query("COMMIT");
    } catch (e) {
      await tx.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      tx.release();
    }

    logger.info({ clienteId, slotNumero, empleadoId, motivo: motivoNorm }, "Falta custodia registrada (descuento 2 días pendiente RRHH)");
    res.json({ ok: true, empleado: emp[0].nombre_completo, slot: `Custodio ${slotNumero}` });
  } catch (err) {
    logger.error({ err }, "POST /operaciones/registrar-falta-custodia error");
    res.status(500).json({ error: "Error al registrar falta custodia" });
  }
});


router.post("/operaciones/cambiar-titular-custodia", async (req, res) => {
  const { clienteId, slotNumero, nuevoTitularId, anteriorTitularId, motivo, notas, usuario } = req.body;
  if (!clienteId || !slotNumero || !nuevoTitularId) {
    return res.status(400).json({ error: "clienteId, slotNumero y nuevoTitularId son requeridos" });
  }
  const { rows: empCheck } = await pool.query(`SELECT id FROM employees WHERE id = $1 AND estado_laboral = 'activo'`, [nuevoTitularId]);
  if (empCheck.length === 0) {
    return res.status(400).json({ error: "El agente no existe o no está activo" });
  }
  // Bloqueo fecha_ingreso: el nuevo titular debe haber iniciado labores hoy
  {
    const _v = await validarEmpleadoAsignable(pool, nuevoTitularId, todayGT());
    if (!_v.ok) return res.status(400).json({ error: _v.error });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lockTitularidadAgente(client, Number(nuevoTitularId));

    // Modo estricto: liberar otra titularidad del nuevo titular dentro de la
    // misma transacción para evitar estado intermedio.
    const liberado = await liberarTitularidadAgente(client, Number(nuevoTitularId), {
      custodia: { clienteId, slotNumero },
    });

    await client.query(
      `UPDATE custodia_titulares SET activo = FALSE WHERE cliente_id = $1 AND slot_numero = $2 AND activo = TRUE`,
      [clienteId, slotNumero]
    );
    await client.query(
      `INSERT INTO custodia_titulares (cliente_id, slot_numero, employee_id) VALUES ($1, $2, $3)
       ON CONFLICT (cliente_id, slot_numero, employee_id) DO UPDATE SET activo = TRUE`,
      [clienteId, slotNumero, nuevoTitularId]
    );
    const fechaHoy = todayGT();
    await client.query(
      `DELETE FROM custodia_asignacion_diaria WHERE cliente_id = $1 AND fecha = $2::date AND slot_numero = $3`,
      [clienteId, fechaHoy, slotNumero]
    );
    // Reflejamos el nuevo titular como asignación diaria de hoy
    await client.query(
      `INSERT INTO custodia_asignacion_diaria (cliente_id, fecha, employee_id, slot_numero)
       VALUES ($1, $2::date, $3, $4)
       ON CONFLICT (cliente_id, fecha, slot_numero) DO UPDATE SET employee_id = $3`,
      [clienteId, fechaHoy, nuevoTitularId, slotNumero]
    );
    await client.query("COMMIT");
    logger.info({ clienteId, slotNumero, nuevoTitularId, anteriorTitularId }, "Titular custodia cambiado");
    res.json({ ok: true, liberado });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    if (err.code === "23505") {
      return res.status(409).json({ error: "Este agente ya es titular de otro slot" });
    }
    logger.error({ err }, "POST /operaciones/cambiar-titular-custodia error");
    res.status(500).json({ error: "Error al cambiar titular" });
  } finally {
    client.release();
  }
});

router.post("/operaciones/quitar-titularidad-custodia", async (req, res) => {
  const sessionRaw = req.headers["x-isp-session"];
  let userRole = "";
  try { userRole = JSON.parse(sessionRaw as string)?.rol ?? ""; } catch {}
  if (!["admin", "operaciones"].includes(userRole)) {
    return res.status(403).json({ error: "Solo Operaciones o administradores pueden quitar la titularidad" });
  }

  const { clienteId, slotNumero, employeeId, motivo, usuario } = req.body as {
    clienteId: number; slotNumero: number; employeeId: number; motivo?: string; usuario?: string;
  };
  if (!clienteId || !slotNumero || !employeeId) {
    return res.status(400).json({ error: "clienteId, slotNumero y employeeId son requeridos" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await lockTitularidadAgente(client, Number(employeeId));

    const { rows: ctRows } = await client.query(
      `SELECT id FROM custodia_titulares
        WHERE cliente_id = $1 AND slot_numero = $2 AND employee_id = $3 AND activo = TRUE`,
      [clienteId, slotNumero, employeeId]
    );
    if (ctRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "El colaborador no es titular activo de este slot de custodia" });
    }

    const { rows: empRows } = await client.query(
      `SELECT nombre_completo FROM employees WHERE id = $1`, [employeeId]
    );
    const empNombre = empRows[0]?.nombre_completo ?? "";

    // 1) Desactivar titularidad
    await client.query(
      `UPDATE custodia_titulares SET activo = FALSE
        WHERE cliente_id = $1 AND slot_numero = $2 AND employee_id = $3`,
      [clienteId, slotNumero, employeeId]
    );

    // 2) Borrar asignación diaria de hoy si era de ese empleado
    const fechaHoy = todayGT();
    await client.query(
      `DELETE FROM custodia_asignacion_diaria
        WHERE cliente_id = $1 AND slot_numero = $2 AND fecha = $3::date AND employee_id = $4`,
      [clienteId, slotNumero, fechaHoy, employeeId]
    );

    // 3) Devolver al pool: EOA → disponible
    await client.query(
      `UPDATE employee_operational_assignments
          SET activa = FALSE, updated_at = NOW()
        WHERE employee_id = $1 AND activa = TRUE`,
      [employeeId]
    );
    await client.query(
      `INSERT INTO employee_operational_assignments
         (employee_id, puesto_id, sede_id, cliente_id, zona_operativa_id, tipo_turno_id,
          tipo_asignacion, activa, fecha_inicio, notas, created_at, updated_at)
       VALUES ($1, NULL, NULL, NULL, NULL, NULL, 'disponible', TRUE, NOW(),
               'Quitado de titularidad de custodia desde pizarrón', NOW(), NOW())`,
      [employeeId]
    );

    await client.query("COMMIT");
    logger.info({ clienteId, slotNumero, employeeId, usuario, motivo }, "Titularidad custodia removida");
    return res.json({ ok: true, mensaje: `${empNombre} ya no es titular del Custodio ${slotNumero}` });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    logger.error({ err }, "POST /operaciones/quitar-titularidad-custodia error");
    return res.status(500).json({ error: "Error al quitar titularidad de custodia" });
  } finally {
    client.release();
  }
});

// ─── GET /api/custodias/puestos ──────────────────────────────────────────────
// Lista titulares en vacaciones que regresan a su puesto en N días o menos.
// Sirve para alertar a Operaciones y RRHH con cuenta regresiva (5,4,3,2,1 días).

router.get("/custodias/puestos", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.id,
        p.nombre,
        p.cliente_id,
        p.cliente_nombre,
        p.turno,
        p.horario,
        p.tipo_puesto,
        p.agente_id,
        p.agente_nombre,
        p.titular_employee_id,
        p.titular_nombre,
        p.notas,
        p.activo,
        ext.empleado_nombre                 AS externo_nombre,
        ext.externo_dpi                     AS externo_dpi,
        (ext.empleado_nombre IS NOT NULL)   AS cubierto_externo,
        oz.nombre                           AS zona_nombre,
        cs.nombre                           AS sede_nombre,
        t.nombre                            AS turno_tipo_nombre,
        p.tipo_turno_id,
        TO_CHAR(p.fecha_inicio_ciclo,'YYYY-MM-DD') AS fecha_inicio_ciclo,
        -- Calcular estado operativo de custodia
        -- Estados activos de incident: abierta, en_proceso
        -- Estado cerrado: cerrada (y cualquier otra cosa)
        CASE
          WHEN EXISTS (
            SELECT 1 FROM incidents i
            WHERE i.puesto_id = p.id
              AND i.estado IN ('abierta','en_proceso')
          ) THEN 'incidente_activo'
          WHEN EXISTS (
            SELECT 1 FROM incidents i
            WHERE i.puesto_id = p.id
              AND i.estado NOT IN ('abierta','en_proceso')
          ) AND NOT EXISTS (
            SELECT 1 FROM incidents i
            WHERE i.puesto_id = p.id
              AND i.estado IN ('abierta','en_proceso')
          ) THEN 'incidente_completado'
          -- Cobertura por AGENTE EXTERNO hoy → en ruta (puesto cubierto por externo)
          WHEN EXISTS (
            SELECT 1 FROM cobertura_segmentos seg
            WHERE seg.puesto_id = p.id
              AND seg.fecha     = CURRENT_DATE
              AND seg.es_externo = TRUE
          ) THEN 'en_ruta'
          -- Agente tiene segmento abierto HOY y dentro de la ventana esperada de horas
          WHEN p.agente_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM cobertura_segmentos seg
            WHERE seg.puesto_id    = p.id
              AND seg.employee_id  = p.agente_id
              AND seg.fecha        = CURRENT_DATE
              AND seg.hora_fin     IS NULL
              AND (
                seg.horas_calculadas IS NULL
                OR seg.horas_calculadas = 0
                -- Turnos de 24h+: trabajan todo el día; TIME wrappea en PostgreSQL
                OR seg.horas_calculadas >= 24
                OR (seg.hora_inicio::time + (seg.horas_calculadas || ' hours')::interval) > CURRENT_TIME
              )
          ) THEN 'en_ruta'
          -- Agente tuvo turno hoy pero las horas ya terminaron (o fue liberado formalmente)
          WHEN p.agente_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM cobertura_segmentos seg
            WHERE seg.puesto_id   = p.id
              AND seg.employee_id = p.agente_id
              AND seg.fecha       = CURRENT_DATE
              AND (
                seg.hora_fin IS NOT NULL
                OR (
                  seg.hora_fin IS NULL
                  AND seg.horas_calculadas IS NOT NULL
                  AND seg.horas_calculadas > 0
                  -- Solo aplicar el chequeo de tiempo-expirado para turnos < 24h;
                  -- los de 24h+ nunca "terminan" dentro del mismo día
                  AND seg.horas_calculadas < 24
                  AND (seg.hora_inicio::time + (seg.horas_calculadas || ' hours')::interval) <= CURRENT_TIME
                )
              )
          ) THEN 'completada'
          -- Agente asignado pero sin cobertura activa hoy (turno futuro o sin registro)
          WHEN p.agente_id IS NOT NULL THEN 'planificada'
          ELSE 'planificada'
        END                                 AS estado_custodia,
        -- Contar incidentes totales asociados
        (SELECT COUNT(*) FROM incidents i WHERE i.puesto_id = p.id) AS total_incidentes,
        (SELECT COUNT(*) FROM incidents i WHERE i.puesto_id = p.id
           AND i.estado IN ('abierta','en_proceso'))                  AS incidentes_activos
      FROM puestos_operativos p
      LEFT JOIN operational_zones oz ON oz.id = p.zona_operativa_id
      LEFT JOIN client_sedes     cs ON cs.id = p.sede_id
      LEFT JOIN turnos            t  ON t.id  = p.tipo_turno_id
      LEFT JOIN LATERAL (
        SELECT seg.empleado_nombre, seg.externo_dpi
        FROM cobertura_segmentos seg
        WHERE seg.puesto_id = p.id
          AND seg.fecha     = CURRENT_DATE
          AND seg.es_externo = TRUE
        ORDER BY seg.created_at DESC
        LIMIT 1
      ) ext ON TRUE
      WHERE p.tipo_puesto = 'custodia'
        AND p.activo      = TRUE
      ORDER BY
        CASE
          WHEN EXISTS (SELECT 1 FROM incidents i WHERE i.puesto_id = p.id AND i.estado NOT IN ('cerrado','resuelto','completado')) THEN 0
          WHEN p.agente_id IS NOT NULL THEN 1
          ELSE 2
        END,
        p.cliente_nombre,
        p.nombre
    `);

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /custodias/puestos error");
    res.status(500).json({ error: "Error al obtener custodias" });
  }
});

export default router;
