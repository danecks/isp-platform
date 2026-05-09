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

    await pool.query(`
      INSERT INTO eventos_rrhh (employee_id, employee_nombre, employee_dpi, tipo_evento, fecha, observaciones, notas, usuario_generador, generado_desde, cliente_nombre, puesto_nombre)
      VALUES ($1, $2, $3, 'falta', $4::date, $5, $6, $7, 'operaciones', $8, $9)
    `, [empleadoId, emp[0].nombre_completo, '', fechaHoy, motivoNorm, notaEvento, usuario ?? 'sistema', clienteNombre, `Custodio ${slotNumero}`]);

    logger.info({ clienteId, slotNumero, empleadoId, motivo: motivoNorm }, "Falta custodia registrada");
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
