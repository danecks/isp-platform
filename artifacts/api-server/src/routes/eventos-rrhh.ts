import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { calcularKPIDisciplinario } from "../services/disciplinary-kpi";
import { restaurarRollbackFalta } from "./operaciones/anular-falta";

export const eventosRrhhRouter = Router();

const TIPOS_FALTA = ["falta", "falta_total", "falta_injustificada", "abandono_parcial", "permiso_sin_goce"];
const TIPOS_SUSPENSION = ["suspension"];
const TIPOS_INCAPACIDAD = ["incapacidad"];

async function propagarEstadoANovedades(
  evento: { id: number; tipo_evento: string; employee_id: number; evento_par_id: number | null },
  estado: "aprobado" | "rechazado",
  usuario?: string,
  client?: any,
) {
  const q = client ?? pool;
  const eventoId = evento.id;
  const tipo = evento.tipo_evento;
  const esSuspension = TIPOS_SUSPENSION.includes(tipo);

  const { rows: novedadesDirectas } = await q.query(
    `SELECT id FROM novedades_nomina_diarias WHERE evento_rrhh_id = $1`,
    [eventoId],
  );

  if (estado === "aprobado") {
    if (TIPOS_FALTA.includes(tipo)) {
      // Calcular dias_descuento según turno del puesto del empleado
      const { rows: turnoRows } = await q.query(`
        SELECT COALESCE(t.horas_trabajo, 24) AS turno_horas
        FROM puesto_titulares pt
        JOIN puestos_operativos po ON po.id = pt.puesto_id
        LEFT JOIN turnos t ON t.id = po.tipo_turno_id
        WHERE pt.employee_id = $1 AND pt.activo = TRUE
        LIMIT 1
      `, [evento.employee_id]);
      const turnoHoras = parseFloat(turnoRows[0]?.turno_horas ?? 24);
      const diasDesc = turnoHoras >= 24 ? 3 : (turnoHoras >= 12 ? 2 : 1);

      await q.query(
        `UPDATE novedades_nomina_diarias
         SET falta = TRUE, trabajo_dia = FALSE, horas_trabajadas = 0,
             impacto_nomina = 'aprobado_rrhh',
             dias_descuento = COALESCE(NULLIF(dias_descuento, 0), $2),
             updated_at = NOW()
         WHERE evento_rrhh_id = $1`,
        [eventoId, diasDesc],
      );
      logger.info({ eventoId, tipo, diasDesc, updated: novedadesDirectas.length }, "Falta aprobada → novedades actualizadas");
    } else if (esSuspension) {
      await q.query(
        `UPDATE novedades_nomina_diarias
         SET suspension = TRUE, falta = FALSE, impacto_nomina = 'aprobado_rrhh', updated_at = NOW()
         WHERE evento_rrhh_id = $1`,
        [eventoId],
      );
      logger.info({ eventoId, tipo, updated: novedadesDirectas.length }, "Suspensión aprobada → novedades actualizadas");
    } else if (TIPOS_INCAPACIDAD.includes(tipo)) {
      await q.query(
        `UPDATE novedades_nomina_diarias
         SET impacto_nomina = 'aprobado_rrhh', updated_at = NOW()
         WHERE evento_rrhh_id = $1`,
        [eventoId],
      );
      logger.info({ eventoId, tipo, updated: novedadesDirectas.length }, "Incapacidad aprobada → novedades actualizadas");
    } else if (tipo === "horas_extra") {
      await q.query(
        `UPDATE novedades_nomina_diarias
         SET horas_extra_estado = 'aprobado',
             horas_extra_aprobadas_por = $1,
             horas_extra_aprobadas_at = NOW(),
             impacto_nomina = 'aprobado_rrhh',
             updated_at = NOW()
         WHERE evento_rrhh_id = $2`,
        [usuario ?? "RRHH", eventoId],
      );
      logger.info({ eventoId, tipo, updated: novedadesDirectas.length }, "HE aprobada → novedades actualizadas");
    }
  } else {
    if (TIPOS_FALTA.includes(tipo) || TIPOS_INCAPACIDAD.includes(tipo)) {
      await q.query(
        `UPDATE novedades_nomina_diarias
         SET falta = FALSE, impacto_nomina = 'rechazado_rrhh', updated_at = NOW()
         WHERE evento_rrhh_id = $1`,
        [eventoId],
      );
      logger.info({ eventoId, tipo, updated: novedadesDirectas.length }, "Falta/incapacidad rechazada → novedades actualizadas");
    } else if (esSuspension) {
      await q.query(
        `UPDATE novedades_nomina_diarias
         SET suspension = FALSE, falta = FALSE, impacto_nomina = 'rechazado_rrhh', updated_at = NOW()
         WHERE evento_rrhh_id = $1`,
        [eventoId],
      );
      logger.info({ eventoId, tipo, updated: novedadesDirectas.length }, "Suspensión rechazada → novedades actualizadas");
    } else if (tipo === "horas_extra") {
      await q.query(
        `UPDATE novedades_nomina_diarias
         SET horas_extra_estado = 'rechazado', horas_extra = 0, impacto_nomina = 'rechazado_rrhh', updated_at = NOW()
         WHERE evento_rrhh_id = $1`,
        [eventoId],
      );
      logger.info({ eventoId, tipo, updated: novedadesDirectas.length }, "HE rechazada → novedades actualizadas");
    }
  }

  if (novedadesDirectas.length === 0) {
    if (TIPOS_FALTA.includes(tipo) || TIPOS_SUSPENSION.includes(tipo) || TIPOS_INCAPACIDAD.includes(tipo)) {
      const { rows: novedadesFecha } = await q.query(
        `SELECT id FROM novedades_nomina_diarias
         WHERE employee_id = $1
           AND fecha = (SELECT fecha::date FROM eventos_rrhh WHERE id = $2)
           AND COALESCE(impacto_nomina, 'pendiente') = 'pendiente'
         LIMIT 1`,
        [evento.employee_id, eventoId],
      );
      if (novedadesFecha.length > 0) {
        const setFields = esSuspension
          ? (estado === "aprobado"
            ? `suspension = TRUE, falta = FALSE, impacto_nomina = 'aprobado_rrhh'`
            : `suspension = FALSE, falta = FALSE, impacto_nomina = 'rechazado_rrhh'`)
          : (estado === "aprobado"
            ? `falta = ${TIPOS_FALTA.includes(tipo) ? 'TRUE' : 'FALSE'}, impacto_nomina = 'aprobado_rrhh'`
            : `falta = FALSE, impacto_nomina = 'rechazado_rrhh'`);
        await q.query(
          `UPDATE novedades_nomina_diarias
           SET ${setFields}, evento_rrhh_id = $1, updated_at = NOW()
           WHERE id = $2`,
          [eventoId, novedadesFecha[0].id],
        );
        logger.info({ eventoId, novedadId: novedadesFecha[0].id }, "Novedad vinculada por fecha+empleado (falta/susp/incap)");
      }
    } else if (tipo === "horas_extra") {
      const { rows: novedadesFecha } = await q.query(
        `SELECT id FROM novedades_nomina_diarias
         WHERE employee_id = $1
           AND fecha = (SELECT fecha::date FROM eventos_rrhh WHERE id = $2)
           AND COALESCE(horas_extra_estado, 'pendiente') = 'pendiente'
           AND horas_extra::numeric > 0
         LIMIT 1`,
        [evento.employee_id, eventoId],
      );
      if (novedadesFecha.length > 0) {
        if (estado === "aprobado") {
          await q.query(
            `UPDATE novedades_nomina_diarias
             SET horas_extra_estado = 'aprobado', horas_extra_aprobadas_por = $1,
                 horas_extra_aprobadas_at = NOW(), impacto_nomina = 'aprobado_rrhh',
                 evento_rrhh_id = $2, updated_at = NOW()
             WHERE id = $3`,
            [usuario ?? "RRHH", eventoId, novedadesFecha[0].id],
          );
        } else {
          await q.query(
            `UPDATE novedades_nomina_diarias
             SET horas_extra_estado = 'rechazado', horas_extra = 0,
                 impacto_nomina = 'rechazado_rrhh', evento_rrhh_id = $1, updated_at = NOW()
             WHERE id = $2`,
            [eventoId, novedadesFecha[0].id],
          );
        }
        logger.info({ eventoId, novedadId: novedadesFecha[0].id }, "Novedad vinculada por fecha+empleado (HE)");
      }
    }
  }
}

// ─── GET /api/rrhh/eventos ────────────────────────────────────────────────────
// Lista todos los eventos RRHH, con filtros opcionales
eventosRrhhRouter.get("/rrhh/eventos", async (req, res) => {
  const { tipo, estado, empleado } = req.query;

  let where = "WHERE 1=1";
  const params: unknown[] = [];
  let idx = 1;

  if (tipo) { where += ` AND e.tipo_evento = $${idx++}`; params.push(tipo); }
  if (estado) { where += ` AND e.estado = $${idx++}`; params.push(estado); }
  if (empleado) {
    where += ` AND (LOWER(e.employee_nombre) LIKE $${idx++})`;
    params.push(`%${String(empleado).toLowerCase()}%`);
  }

  try {
    const { rows } = await pool.query(
      `SELECT e.*,
              emp.dpi        AS employee_dpi_db,
              emp.puesto     AS employee_puesto
       FROM eventos_rrhh e
       LEFT JOIN employees emp ON emp.id = e.employee_id
       ${where}
       ORDER BY e.fecha DESC
       LIMIT 200`,
      params,
    );

    const eventos = rows.map((r) => ({
      ...r,
      employee_dpi: r.employee_dpi_db
        ? `****${String(r.employee_dpi_db).slice(-4)}`
        : r.employee_dpi,
    }));

    res.json(eventos);
  } catch (err) {
    logger.error({ err }, "GET /rrhh/eventos error");
    res.status(500).json({ error: "Error al obtener eventos RRHH" });
  }
});

// ─── GET /api/rrhh/eventos/:id ────────────────────────────────────────────────
eventosRrhhRouter.get("/rrhh/eventos/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });

  try {
    const { rows } = await pool.query(
      `SELECT e.*,
              emp.dpi    AS employee_dpi_db,
              emp.puesto AS employee_puesto
       FROM eventos_rrhh e
       LEFT JOIN employees emp ON emp.id = e.employee_id
       WHERE e.id = $1`,
      [id],
    );

    if (!rows.length) return res.status(404).json({ error: "Evento no encontrado" });

    const evento = {
      ...rows[0],
      employee_dpi: rows[0].employee_dpi_db
        ? `****${String(rows[0].employee_dpi_db).slice(-4)}`
        : rows[0].employee_dpi,
    };

    res.json(evento);
  } catch (err) {
    logger.error({ err }, "GET /rrhh/eventos/:id error");
    res.status(500).json({ error: "Error al obtener evento" });
  }
});

// ─── POST /api/rrhh/eventos ───────────────────────────────────────────────────
// Crear evento manualmente (o llamado internamente desde operaciones)
eventosRrhhRouter.post("/rrhh/eventos", async (req, res) => {
  const {
    employeeId,
    tipoEvento,
    fechaInicio,
    fechaFin,
    clienteNombre,
    puestoNombre,
    supervisorNombre,
    generadoDesde,
    movimientoId,
    observaciones,
    notas,
    usuarioGenerador,
  } = req.body;

  if (!employeeId || !tipoEvento) {
    return res.status(400).json({ error: "employeeId y tipoEvento son requeridos" });
  }

  // Validar formatos de fecha si se proveen
  if (fechaInicio && !/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)) {
    return res.status(400).json({ error: "fechaInicio debe tener formato YYYY-MM-DD" });
  }
  if (fechaFin && !/^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) {
    return res.status(400).json({ error: "fechaFin debe tener formato YYYY-MM-DD" });
  }

  try {
    // Obtener datos del empleado
    const { rows: empRows } = await pool.query(
      `SELECT id, nombre_completo, dpi FROM employees WHERE id = $1`,
      [employeeId],
    );
    if (!empRows.length) return res.status(404).json({ error: "Empleado no encontrado" });
    const emp = empRows[0];

    const { rows } = await pool.query(
      `INSERT INTO eventos_rrhh
         (employee_id, employee_nombre, employee_dpi,
          tipo_evento, cliente_nombre, puesto_nombre,
          supervisor_nombre, generado_desde, movimiento_id,
          estado, observaciones, notas, usuario_generador,
          documentos_generados, fecha, fecha_fin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendiente',$10,$11,$12,'[]',COALESCE($13::date, NOW()),$14)
       RETURNING *`,
      [
        emp.id,
        emp.nombre_completo,
        emp.dpi || null,
        tipoEvento,
        clienteNombre || null,
        puestoNombre  || null,
        supervisorNombre || null,
        generadoDesde || "operaciones",
        movimientoId  || null,
        observaciones || null,
        notas         || null,
        usuarioGenerador || "sistema",
        fechaInicio || null,
        fechaFin || null,
      ],
    );

    const eventoCreado = rows[0];
    logger.info({ id: eventoCreado.id, tipo: tipoEvento }, "Evento RRHH creado");

    // Fix E2E-04: Auto-generar novedad en nómina para eventos que afectan el pago.
    // Tipos relevantes: falta, falta_injustificada, incapacidad, suspension.
    // SOLO auto-generar novedad si la fecha del evento es HOY o pasada.
    // Eventos FUTUROS no contaminan las novedades del día actual.
    const TIPOS_CON_NOVEDAD = ["falta", "falta_injustificada", "incapacidad", "suspension"];
    const hoy = new Date().toISOString().split("T")[0];
    const fechaEvento = fechaInicio ?? hoy; // La fecha real del evento
    const esHoyOPasado = fechaEvento <= hoy;
    if (TIPOS_CON_NOVEDAD.includes(tipoEvento) && esHoyOPasado) {
      try {

        // Determinar campos según tipo de evento:
        //   falta / falta_injustificada → falta=TRUE, descuento_dia=TRUE, trabajo_dia=FALSE
        //   incapacidad                 → incapacidad=TRUE, trabajo_dia=FALSE (sin descuento)
        //   suspension                  → suspension=TRUE, descuento_dia=TRUE, trabajo_dia=FALSE
        const esFalta      = tipoEvento === "falta" || tipoEvento === "falta_injustificada";
        const esIncapacidad = tipoEvento === "incapacidad";
        const esSuspension  = tipoEvento === "suspension";

        // Buscar puesto titular del empleado para vincular la novedad
        const { rows: puestoRows } = await pool.query(
          `SELECT id, nombre FROM puestos_operativos
           WHERE titular_employee_id = $1 AND activo = TRUE
           LIMIT 1`,
          [emp.id]
        );
        const puestoTitularId   = puestoRows[0]?.id ?? null;
        const puestoTitularNombre = puestoRows[0]?.nombre ?? puestoNombre ?? null;

        // incapacidad: no descuenta el día (el empleado sigue percibiendo salario según ley)
        // suspension / falta: descuenta el día
        const descuentoDia = esFalta || esSuspension;

        await pool.query(
          `INSERT INTO novedades_nomina_diarias
             (fecha, employee_id, empleado_nombre,
              trabajo_dia, horas_trabajadas, horas_extra,
              falta, suspension, descuento_dia,
              puesto_titular_id, puesto_titular_nombre, fuente)
           VALUES ($1, $2, $3,
                   FALSE, 0, 0,
                   $4, $5, $6,
                   $7, $8, 'rrhh_manual')
           ON CONFLICT (fecha, employee_id) DO UPDATE SET
             falta       = EXCLUDED.falta       OR novedades_nomina_diarias.falta,
             suspension  = EXCLUDED.suspension  OR novedades_nomina_diarias.suspension,
             descuento_dia = EXCLUDED.descuento_dia OR novedades_nomina_diarias.descuento_dia,
             trabajo_dia = FALSE,
             updated_at  = NOW()`,
          [
            hoy, emp.id, emp.nombre_completo,
            esFalta, esSuspension, descuentoDia,
            puestoTitularId, puestoTitularNombre,
          ]
        );
        logger.info({ employeeId: emp.id, tipoEvento, hoy }, "RRHH: novedad nómina auto-generada");
      } catch (novedadErr) {
        logger.warn({ novedadErr, employeeId: emp.id, tipoEvento }, "RRHH: no se pudo generar novedad nómina (no bloqueante)");
      }
    }

    res.status(201).json({ ok: true, evento: eventoCreado });
  } catch (err) {
    logger.error({ err }, "POST /rrhh/eventos error");
    res.status(500).json({ error: "Error al crear evento RRHH" });
  }
});

// ─── PATCH /api/rrhh/eventos/:id/estado ──────────────────────────────────────
eventosRrhhRouter.patch("/rrhh/eventos/:id/estado", async (req, res) => {
  const id = Number(req.params.id);
  const { estado, notas, usuario } = req.body;

  const VALID = ["pendiente_aprobacion", "aprobado", "rechazado"];
  if (!VALID.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Válidos: ${VALID.join(", ")}` });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: check } = await client.query(
      `SELECT id, estado, tipo_evento, employee_id, evento_par_id, metadata_json FROM eventos_rrhh WHERE id=$1`,
      [id],
    );
    if (!check.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Evento no encontrado" });
    }
    if (check[0].estado === "anulado") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "No se puede modificar un evento anulado" });
    }

    const evento = check[0];
    const { rows } = await client.query(
      `UPDATE eventos_rrhh
       SET estado=$1, notas=COALESCE($2, notas), updated_at=NOW()
       WHERE id=$3
       RETURNING *`,
      [estado, notas || null, id],
    );

    if ((estado === "aprobado" || estado === "rechazado") && evento.tipo_evento !== "anulacion_falta") {
      await propagarEstadoANovedades(evento, estado, usuario, client);
    }

    // Anulación de falta: rechazar = restaurar el slot a 'faltando' con los datos previos
    if (evento.tipo_evento === "anulacion_falta" && estado === "rechazado") {
      const meta = evento.metadata_json ?? {};
      const snap = typeof meta === "string" ? JSON.parse(meta) : meta;
      if (snap?.puesto_id && snap?.falta_employee_id) {
        await client.query(`
          UPDATE puestos_operativos
             SET estado_operativo_puesto = 'faltando',
                 falta_employee_id       = $2,
                 falta_motivo            = $3,
                 falta_notas             = $4,
                 falta_usuario           = $5,
                 updated_at              = NOW()
           WHERE id = $1
        `, [
          snap.puesto_id,
          snap.falta_employee_id,
          snap.falta_motivo ?? null,
          snap.falta_notas ?? null,
          snap.falta_usuario ?? null,
        ]);
        // Reponer también el evento de falta y su HE par que se habían anulado, para
        // que las dos fuentes (slot y eventos_rrhh) queden consistentes.
        const evsRestore = Array.isArray(snap.eventos_falta_anulados) ? snap.eventos_falta_anulados : [];
        for (const e of evsRestore) {
          await client.query(`
            UPDATE eventos_rrhh
               SET estado = $1, estado_anterior = NULL, anulado_por = NULL,
                   anulado_at = NULL, motivo_anulacion = NULL, updated_at = NOW()
             WHERE id = $2 AND estado = 'anulado'
          `, [e.estado_anterior ?? "pendiente_aprobacion", e.id]);
          // Reactivar TODAS las HE par (1:N). Back-compat con snapshots viejos (par_id único).
          const pares = Array.isArray(e.pares)
            ? e.pares
            : (e.par_id ? [{ id: e.par_id, estado_anterior: e.par_estado_anterior }] : []);
          for (const p of pares) {
            await client.query(`
              UPDATE eventos_rrhh
                 SET estado = $1, estado_anterior = NULL, anulado_por = NULL,
                     anulado_at = NULL, motivo_anulacion = NULL, updated_at = NOW()
               WHERE id = $2 AND estado = 'anulado'
            `, [p.estado_anterior ?? "pendiente_aprobacion", p.id]);
          }
        }
        // Restaurar simétricamente nómina + segmentos + alertas que anular revirtió.
        await restaurarRollbackFalta(client, snap);
        logger.info({ eventoId: id, puestoId: snap.puesto_id }, "Anulación de falta rechazada → slot, eventos, nómina, segmentos y alertas restaurados");
      }
    }

    // Si se rechaza un permiso (sin goce o con goce), crear evento de falta automático
    if (estado === "rechazado" && ["permiso_sin_goce", "permiso_con_goce"].includes(evento.tipo_evento)) {
      const { rows: evOrig } = await client.query(
        `SELECT employee_id, employee_nombre, employee_dpi, fecha, fecha_fin,
                puesto_nombre, cliente_nombre, usuario_generador
         FROM eventos_rrhh WHERE id = $1`, [id]
      );
      if (evOrig.length > 0) {
        const eo = evOrig[0];
        const { rows: faltaEv } = await client.query(`
          INSERT INTO eventos_rrhh
            (employee_id, employee_nombre, employee_dpi, tipo_evento, fecha, fecha_fin,
             puesto_nombre, cliente_nombre, generado_desde, estado,
             observaciones, usuario_generador, documentos_generados)
          VALUES ($1, $2, $3, 'falta', $4, $5, $6, $7, 'rechazo_permiso',
                  'pendiente_aprobacion',
                  $8, $9, '[]')
          RETURNING id
        `, [
          eo.employee_id, eo.employee_nombre, eo.employee_dpi,
          eo.fecha, eo.fecha_fin,
          eo.puesto_nombre, eo.cliente_nombre,
          `Falta generada automáticamente por rechazo de ${evento.tipo_evento === "permiso_sin_goce" ? "permiso sin goce" : "permiso con goce"} (ERH #${id})`,
          eo.usuario_generador ?? usuario ?? "sistema",
        ]);
        const faltaId = faltaEv[0]?.id;
        if (faltaId) {
          // Crear/actualizar novedad con falta pendiente de aprobación
          await client.query(`
            INSERT INTO novedades_nomina_diarias
              (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
               falta, descuento_dia, impacto_nomina, requiere_revision_rrhh,
               tipo_novedad, evento_rrhh_id, fuente)
            VALUES ($1::date, $2, $3, FALSE, 0, 0, FALSE, FALSE, 'pendiente', TRUE,
                    'falta_total', $4, 'rechazo_permiso')
            ON CONFLICT (fecha, employee_id) DO UPDATE SET
              tipo_novedad           = 'falta_total',
              evento_rrhh_id         = $4,
              impacto_nomina         = 'pendiente',
              requiere_revision_rrhh = TRUE,
              updated_at             = NOW()
          `, [eo.fecha, eo.employee_id, eo.employee_nombre, faltaId]);
          logger.info({ eventoPermisoId: id, faltaEventoId: faltaId, employeeId: eo.employee_id },
            "Permiso rechazado → evento de falta creado automáticamente");
        }
      }
    }

    await client.query("COMMIT");
    res.json({ ok: true, evento: rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "PATCH /rrhh/eventos/:id/estado error");
    res.status(500).json({ error: "Error al actualizar estado" });
  } finally {
    client.release();
  }
});

// ─── POST /api/rrhh/eventos/:id/anular ───────────────────────────────────────
// Anulación controlada con auditoría completa
eventosRrhhRouter.post("/rrhh/eventos/:id/anular", async (req, res) => {
  const id = Number(req.params.id);
  const { motivoAnulacion, usuario } = req.body;

  const MOTIVOS_VALIDOS = ["error_registro", "agente_asistio", "duplicado", "otro"];
  if (!motivoAnulacion || !MOTIVOS_VALIDOS.includes(motivoAnulacion)) {
    return res.status(400).json({
      error: `motivoAnulacion requerido. Válidos: ${MOTIVOS_VALIDOS.join(", ")}`,
    });
  }
  if (!usuario) {
    return res.status(400).json({ error: "usuario requerido para anular" });
  }

  try {
    // Obtener estado actual
    const { rows: current } = await pool.query(
      `SELECT id, estado, employee_nombre FROM eventos_rrhh WHERE id=$1`,
      [id],
    );
    if (!current.length) return res.status(404).json({ error: "Evento no encontrado" });

    const estadoActual = current[0].estado;
    if (estadoActual === "anulado") {
      return res.status(409).json({ error: "El evento ya está anulado" });
    }

    // Registrar anulación con auditoría completa
    const { rows } = await pool.query(
      `UPDATE eventos_rrhh
       SET estado           = 'anulado',
           estado_anterior  = $1,
           anulado_por      = $2,
           anulado_at       = NOW(),
           motivo_anulacion = $3,
           updated_at       = NOW()
       WHERE id = $4
       RETURNING *`,
      [estadoActual, usuario, motivoAnulacion, id],
    );

    logger.info(
      { id, empleado: current[0].employee_nombre, motivo: motivoAnulacion, por: usuario },
      "Evento RRHH anulado",
    );

    // Cascada: si se anula una falta, anular TODAS sus HE enlazadas (1:N) más el
    // par legacy 1:1 (falta.evento_par_id), sin duplicar.
    let parAnulado = false;
    try {
      const evento = rows[0];
      const esFalta = evento.tipo_evento !== "horas_extra";
      if (esFalta) {
        const { rowCount } = await pool.query(
          `UPDATE eventos_rrhh
             SET estado           = 'anulado',
                 estado_anterior  = estado,
                 anulado_por      = $2,
                 anulado_at       = NOW(),
                 motivo_anulacion = $3,
                 updated_at       = NOW()
           WHERE tipo_evento = 'horas_extra'
             AND estado != 'anulado'
             AND (evento_par_id = $1 OR id = $4)`,
          [evento.id, usuario, motivoAnulacion, evento.evento_par_id ?? -1],
        );
        parAnulado = (rowCount ?? 0) > 0;
        if (parAnulado) {
          logger.info(
            { faltaId: evento.id, hesAnuladas: rowCount, motivo: motivoAnulacion, por: usuario },
            "Evento(s) par (HE) anulado(s) en cascada por anulación de falta",
          );
        }
      }
    } catch (cascErr) {
      logger.warn({ cascErr, id }, "Error al anular evento par en cascada (no bloqueante)");
    }

    // C-03: Revertir novedad de nómina si no hay otro evento activo del mismo tipo para ese empleado/fecha
    try {
      const evento = rows[0];
      if (evento.employee_id && evento.fecha) {
        const fechaDia = new Date(evento.fecha).toISOString().split("T")[0];
        const tipoEvento: string = evento.tipo_evento ?? "";

        // Verificar si hay otro evento activo (no anulado) del mismo tipo para el mismo empleado y fecha
        const { rows: otrosActivos } = await pool.query(
          `SELECT id FROM eventos_rrhh
           WHERE employee_id = $1
             AND DATE(fecha)  = $2
             AND tipo_evento  = $3
             AND estado      != 'anulado'
             AND id          != $4`,
          [evento.employee_id, fechaDia, tipoEvento, id]
        );

        if (otrosActivos.length === 0) {
          // Mapear tipo_evento al campo correspondiente en novedades_nomina_diarias
          const campoMap: Record<string, string> = {
            falta:              "falta",
            suspension:         "suspension",
            suspension_parcial: "suspension",
            suspension_con_goce:"suspension",
          };
          const campo = campoMap[tipoEvento];

          if (campo) {
            await pool.query(
              `UPDATE novedades_nomina_diarias
               SET ${campo}       = FALSE,
                   descuento_dia  = FALSE,
                   observaciones  = COALESCE(observaciones,'') || ' [Evento RRHH #' || $1 || ' anulado por ' || $2 || ']',
                   updated_at     = NOW()
               WHERE fecha       = $3
                 AND employee_id = $4`,
              [id, usuario, fechaDia, evento.employee_id]
            );
            logger.info({ id, campo, empleado: evento.employee_id, fecha: fechaDia },
              "C-03: novedad de nómina revertida por anulación de evento RRHH");
          }
        }
      }
    } catch (novedadErr) {
      logger.warn({ novedadErr, id }, "C-03: error al revertir novedad de nómina (no bloqueante)");
    }

    // Liberar el estado "faltando" del puesto si esta falta lo había marcado.
    // El pizarrón lee la falta de DOS fuentes (eventos_rrhh + puestos_operativos);
    // anular solo el evento dejaba el puesto pegado en "faltando" indefinidamente
    // (la bandera del puesto no tiene fecha), mostrándolo "descubierto" en los días
    // del titular afectado. Mismo reset que /operaciones/anular-falta. No bloqueante.
    try {
      const evento = rows[0];
      if (evento.employee_id && TIPOS_FALTA.includes(evento.tipo_evento)) {
        const { rowCount } = await pool.query(
          `UPDATE puestos_operativos
              SET estado_operativo_puesto = 'normal',
                  falta_employee_id       = NULL,
                  falta_motivo            = NULL,
                  falta_notas             = NULL,
                  falta_usuario           = NULL,
                  updated_at              = NOW()
            WHERE estado_operativo_puesto = 'faltando'
              AND falta_employee_id       = $1`,
          [evento.employee_id],
        );
        if ((rowCount ?? 0) > 0) {
          logger.info(
            { eventoId: id, employeeId: evento.employee_id, puestosLiberados: rowCount },
            "Estado 'faltando' del puesto liberado por anulación de falta (eventos-rrhh)",
          );
        }
      }
    } catch (puestoErr) {
      logger.warn({ puestoErr, id }, "Error al liberar estado 'faltando' del puesto (no bloqueante)");
    }

    res.json({ ok: true, evento: rows[0], parAnulado });
  } catch (err) {
    logger.error({ err }, "POST /rrhh/eventos/:id/anular error");
    res.status(500).json({ error: "Error al anular evento" });
  }
});

// ─── PATCH /api/rrhh/eventos/:id/documentos ──────────────────────────────────
// Registrar que se generó un documento (para auditoría)
eventosRrhhRouter.patch("/rrhh/eventos/:id/documentos", async (req, res) => {
  const id = Number(req.params.id);
  const { tipo, usuario } = req.body; // tipo: 'boleta' | 'acta'

  if (!tipo) return res.status(400).json({ error: "tipo es requerido" });

  try {
    const entrada = {
      tipo,
      usuario: usuario || "sistema",
      fecha: new Date().toISOString(),
    };

    const { rows } = await pool.query(
      `UPDATE eventos_rrhh
       SET documentos_generados = documentos_generados || $1::jsonb,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify([entrada]), id],
    );

    if (!rows.length) return res.status(404).json({ error: "Evento no encontrado" });
    res.json({ ok: true, evento: rows[0] });
  } catch (err) {
    logger.error({ err }, "PATCH /rrhh/eventos/:id/documentos error");
    res.status(500).json({ error: "Error al registrar documento" });
  }
});

// ─── GET /api/rrhh/stats ──────────────────────────────────────────────────────
eventosRrhhRouter.get("/rrhh/stats", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)                                                        AS total,
        COUNT(*) FILTER (WHERE estado = 'pendiente')                   AS pendientes,
        COUNT(*) FILTER (WHERE estado = 'en_proceso')                  AS en_proceso,
        COUNT(*) FILTER (WHERE estado = 'cerrado')                     AS cerrados,
        COUNT(*) FILTER (WHERE estado = 'anulado')                     AS anulados,
        COUNT(*) FILTER (WHERE tipo_evento = 'falta')                  AS faltas,
        COUNT(*) FILTER (WHERE tipo_evento = 'suspension')             AS suspensiones,
        COUNT(*) FILTER (WHERE fecha >= NOW() - INTERVAL '7 days')     AS ultimos_7_dias,
        COUNT(*) FILTER (WHERE fecha >= NOW() - INTERVAL '30 days')    AS ultimos_30_dias
      FROM eventos_rrhh
    `);
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "GET /rrhh/stats error");
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

// ─── GET /api/rrhh/disciplinario — Dashboard disciplinario global ─────────────
// Retorna: top empleados con más faltas, empleados en riesgo, tendencias globales
eventosRrhhRouter.get("/rrhh/disciplinario", async (_req, res) => {
  try {
    // Top 10 empleados con más faltas/suspensiones (no anuladas)
    const { rows: topRows } = await pool.query<{
      employee_id: number;
      employee_nombre: string;
      faltas: string;
      suspensiones: string;
    }>(`
      SELECT
        employee_id,
        employee_nombre,
        COUNT(*) FILTER (WHERE tipo_evento = 'falta')       AS faltas,
        COUNT(*) FILTER (WHERE tipo_evento = 'suspension')  AS suspensiones
      FROM eventos_rrhh
      WHERE employee_id IS NOT NULL
        AND anulado_por IS NULL
      GROUP BY employee_id, employee_nombre
      HAVING COUNT(*) > 0
      ORDER BY (COUNT(*) FILTER (WHERE tipo_evento = 'suspension') * 2 +
                COUNT(*) FILTER (WHERE tipo_evento = 'falta')) DESC
      LIMIT 10
    `);

    // Tendencia mensual: eventos últimos 6 meses
    const { rows: tendenciaRows } = await pool.query<{
      mes: string;
      faltas: string;
      suspensiones: string;
    }>(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', fecha), 'YYYY-MM') AS mes,
        COUNT(*) FILTER (WHERE tipo_evento = 'falta')       AS faltas,
        COUNT(*) FILTER (WHERE tipo_evento = 'suspension')  AS suspensiones
      FROM eventos_rrhh
      WHERE fecha >= NOW() - INTERVAL '6 months'
        AND anulado_por IS NULL
      GROUP BY DATE_TRUNC('month', fecha)
      ORDER BY DATE_TRUNC('month', fecha) ASC
    `);

    // Estadísticas globales de riesgo (empleados activos con eventos)
    const { rows: riesgoRows } = await pool.query<{
      employee_id: number;
      employee_nombre: string;
      faltas_30d: string;
      faltas_total: string;
      suspensiones_total: string;
    }>(`
      SELECT
        employee_id,
        employee_nombre,
        COUNT(*) FILTER (WHERE tipo_evento = 'falta' AND fecha >= NOW() - INTERVAL '30 days')  AS faltas_30d,
        COUNT(*) FILTER (WHERE tipo_evento = 'falta')                                           AS faltas_total,
        COUNT(*) FILTER (WHERE tipo_evento = 'suspension')                                      AS suspensiones_total
      FROM eventos_rrhh
      WHERE employee_id IS NOT NULL
        AND anulado_por IS NULL
      GROUP BY employee_id, employee_nombre
      HAVING COUNT(*) > 0
    `);

    // Clasificar por nivel de riesgo
    const enRiesgo = riesgoRows
      .map((r) => {
        const f30 = Number(r.faltas_30d);
        const fTotal = Number(r.faltas_total);
        const sTotal = Number(r.suspensiones_total);
        const score = Math.max(0, 100 - fTotal * 10 - sTotal * 20);
        let nivel: "bajo" | "medio" | "alto" = "bajo";
        if (score < 70 || f30 >= 3 || sTotal > 0) nivel = "alto";
        else if (score < 90 || f30 >= 2 || fTotal >= 3) nivel = "medio";
        return {
          employeeId: r.employee_id,
          employeeNombre: r.employee_nombre,
          score,
          nivel,
          faltas30d: f30,
          faltasTotal: fTotal,
          suspensionesTotal: sTotal,
        };
      })
      .sort((a, b) => a.score - b.score);

    res.json({
      top: topRows.map((r) => ({
        employeeId: r.employee_id,
        employeeNombre: r.employee_nombre,
        faltas: Number(r.faltas),
        suspensiones: Number(r.suspensiones),
      })),
      tendencia: tendenciaRows.map((r) => ({
        mes: r.mes,
        faltas: Number(r.faltas),
        suspensiones: Number(r.suspensiones),
      })),
      enRiesgo,
      resumen: {
        totalAlto:  enRiesgo.filter((e) => e.nivel === "alto").length,
        totalMedio: enRiesgo.filter((e) => e.nivel === "medio").length,
        totalBajo:  enRiesgo.filter((e) => e.nivel === "bajo").length,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /rrhh/disciplinario error");
    res.status(500).json({ error: "Error al obtener dashboard disciplinario" });
  }
});

// ─── GET /api/rrhh/alertas-pizarron ──────────────────────────────────────────
// Faltantes sin cubrir y HE pendientes de aprobación
eventosRrhhRouter.get("/rrhh/alertas-pizarron", async (req, res) => {
  try {
    const { tipo, estado = "pendiente" } = req.query as Record<string, string>;
    const params: any[] = [estado];
    let whereExtra = "";
    if (tipo) { whereExtra = ` AND tipo = $2`; params.push(tipo); }

    const { rows } = await pool.query(
      `SELECT
         id, employee_id, employee_nombre, tipo, prioridad, estado,
         datos_clave, sugerencia,
         puesto_id, puesto_nombre, fecha_evento,
         cubierto_por_employee_id, cubierto_por_nombre, cubierto_at,
         novedad_id, generada_at, vista_at, resuelta_at, resuelta_por
       FROM rrhh_alertas
       WHERE estado = $1 ${whereExtra}
       ORDER BY
         CASE prioridad WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END,
         generada_at DESC
       LIMIT 100`,
      params
    );

    const alertas = rows.map((r: any) => ({
      ...r,
      datos_clave: (() => { try { return JSON.parse(r.datos_clave || "{}"); } catch { return {}; } })(),
    }));

    const totales = {
      faltantes : alertas.filter((a: any) => a.tipo === "faltante_sin_cubrir").length,
      horasExtra: alertas.filter((a: any) => a.tipo === "horas_extra_pendiente").length,
    };

    res.json({ alertas, totales });
  } catch (err) {
    logger.error({ err }, "GET /rrhh/alertas-pizarron error");
    res.status(500).json({ error: "Error al obtener alertas del pizarrón" });
  }
});

// ─── PATCH /api/rrhh/alertas/:id/resolver ────────────────────────────────────
eventosRrhhRouter.patch("/rrhh/alertas/:id/resolver", async (req, res) => {
  try {
    const { resuelto_por } = req.body;
    const { rows } = await pool.query(
      `UPDATE rrhh_alertas
       SET estado = 'resuelta', resuelta_at = NOW(), resuelta_por = $1
       WHERE id = $2 RETURNING *`,
      [resuelto_por ?? "RRHH", req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Alerta no encontrada" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /rrhh/alertas/:id/resolver error");
    res.status(500).json({ error: "Error al resolver alerta" });
  }
});

// ─── GET /api/rrhh/horas-extra-pendientes ────────────────────────────────────
eventosRrhhRouter.get("/rrhh/horas-extra-pendientes", async (req, res) => {
  try {
    const { desde, hasta } = req.query as Record<string, string>;

    let sql = `
      SELECT
        n.id, n.fecha, n.employee_id, n.empleado_nombre,
        n.horas_extra, n.horas_extra_estado,
        n.horas_extra_aprobadas_por, n.horas_extra_aprobadas_at,
        n.puesto_cubierto_nombre,
        n.puesto_titular_nombre
      FROM novedades_nomina_diarias n
      WHERE n.horas_extra > 0
        AND (n.horas_extra_estado = 'pendiente' OR n.horas_extra_estado IS NULL)
    `;
    const params: any[] = [];
    if (desde) { sql += ` AND n.fecha >= $${params.length + 1}`; params.push(desde); }
    if (hasta) { sql += ` AND n.fecha <= $${params.length + 1}`; params.push(hasta); }
    sql += ` ORDER BY n.fecha DESC LIMIT 200`;

    const { rows } = await pool.query(sql, params);
    res.json({ pendientes: rows, total: rows.length });
  } catch (err) {
    logger.error({ err }, "GET /rrhh/horas-extra-pendientes error");
    res.status(500).json({ error: "Error al obtener HE pendientes" });
  }
});

// ─── PATCH /api/rrhh/horas-extra/:novedadId/aprobar ──────────────────────────
eventosRrhhRouter.patch("/rrhh/horas-extra/:novedadId/aprobar", async (req, res) => {
  try {
    const { aprobado_por } = req.body;
    // Transición exclusiva: solo se puede mandar a planilla una HE aún pendiente.
    // Evita que una HE ya resuelta en efectivo (u otro canal) se pise por reintentos
    // o sesiones concurrentes → riesgo de doble pago.
    const { rows } = await pool.query(
      `UPDATE novedades_nomina_diarias
       SET horas_extra_estado       = 'aprobado',
           horas_extra_aprobadas_por = $1,
           horas_extra_aprobadas_at  = NOW(),
           updated_at               = NOW()
       WHERE id = $2
         AND (horas_extra_estado IS NULL OR horas_extra_estado = 'pendiente')
       RETURNING id, horas_extra_estado, horas_extra_aprobadas_por`,
      [aprobado_por ?? "RRHH", req.params.novedadId]
    );
    if (!rows.length) {
      const ex = await pool.query(
        `SELECT horas_extra_estado FROM novedades_nomina_diarias WHERE id = $1`,
        [req.params.novedadId]
      );
      if (!ex.rows.length) return res.status(404).json({ error: "Novedad no encontrada" });
      return res.status(409).json({ error: "Esta HE ya fue resuelta por otro canal. Refresca la lista." });
    }

    // Cerrar la alerta relacionada
    await pool.query(
      `UPDATE rrhh_alertas
       SET estado = 'resuelta', resuelta_at = NOW(), resuelta_por = $1
       WHERE tipo = 'horas_extra_pendiente' AND novedad_id = $2 AND estado = 'pendiente'`,
      [aprobado_por ?? "RRHH", req.params.novedadId]
    );

    res.json({ ok: true, novedad: rows[0] });
  } catch (err) {
    logger.error({ err }, "PATCH /rrhh/horas-extra/:id/aprobar error");
    res.status(500).json({ error: "Error al aprobar HE" });
  }
});

// ─── PATCH /api/rrhh/horas-extra/:novedadId/rechazar ─────────────────────────
eventosRrhhRouter.patch("/rrhh/horas-extra/:novedadId/rechazar", async (req, res) => {
  try {
    const { rechazado_por, motivo } = req.body;
    const { rows } = await pool.query(
      `UPDATE novedades_nomina_diarias
       SET horas_extra_estado        = 'rechazado',
           horas_extra_aprobadas_por  = $1,
           horas_extra_aprobadas_at   = NOW(),
           horas_extra               = 0,
           updated_at                = NOW()
       WHERE id = $2
         AND (horas_extra_estado IS NULL OR horas_extra_estado = 'pendiente')
       RETURNING id, horas_extra_estado`,
      [rechazado_por ?? "RRHH", req.params.novedadId]
    );
    if (!rows.length) {
      const ex = await pool.query(
        `SELECT horas_extra_estado FROM novedades_nomina_diarias WHERE id = $1`,
        [req.params.novedadId]
      );
      if (!ex.rows.length) return res.status(404).json({ error: "Novedad no encontrada" });
      return res.status(409).json({ error: "Esta HE ya fue resuelta por otro canal. Refresca la lista." });
    }

    await pool.query(
      `UPDATE rrhh_alertas
       SET estado = 'resuelta', resuelta_at = NOW(), resuelta_por = $1
       WHERE tipo = 'horas_extra_pendiente' AND novedad_id = $2 AND estado = 'pendiente'`,
      [rechazado_por ?? "RRHH", req.params.novedadId]
    );

    res.json({ ok: true, motivo });
  } catch (err) {
    logger.error({ err }, "PATCH /rrhh/horas-extra/:id/rechazar error");
    res.status(500).json({ error: "Error al rechazar HE" });
  }
});

// ─── PATCH /api/rrhh/horas-extra/:novedadId/cash ─────────────────────────────
eventosRrhhRouter.patch("/rrhh/horas-extra/:novedadId/cash", async (req, res) => {
  try {
    const { aprobado_por, monto_cash } = req.body;
    const novedadId = req.params.novedadId;

    // Transición exclusiva: solo se paga en efectivo una HE aún pendiente. Evita que
    // una HE ya enviada a planilla (u otro canal) se pise → riesgo de doble pago.
    const { rows } = await pool.query(
      `UPDATE novedades_nomina_diarias
       SET horas_extra_estado       = 'pagado_efectivo',
           horas_extra_aprobadas_por = $1,
           horas_extra_aprobadas_at  = NOW(),
           impacto_nomina           = 'pagado_efectivo',
           updated_at               = NOW()
       WHERE id = $2
         AND (horas_extra_estado IS NULL OR horas_extra_estado = 'pendiente')
       RETURNING id, employee_id, fecha, horas_extra, evento_rrhh_id`,
      [aprobado_por ?? "RRHH", novedadId]
    );
    if (!rows.length) {
      const ex = await pool.query(
        `SELECT horas_extra_estado FROM novedades_nomina_diarias WHERE id = $1`,
        [novedadId]
      );
      if (!ex.rows.length) return res.status(404).json({ error: "Novedad no encontrada" });
      return res.status(409).json({ error: "Esta HE ya fue resuelta por otro canal. Refresca la lista." });
    }

    const nov = rows[0];

    if (nov.evento_rrhh_id) {
      await pool.query(
        `UPDATE eventos_rrhh SET estado = 'resuelto_cash', updated_at = NOW() WHERE id = $1`,
        [nov.evento_rrhh_id]
      );
    }

    await pool.query(
      `UPDATE rrhh_alertas
       SET estado = 'resuelta', resuelta_at = NOW(), resuelta_por = $1
       WHERE tipo = 'horas_extra_pendiente' AND novedad_id = $2 AND estado = 'pendiente'`,
      [aprobado_por ?? "RRHH", novedadId]
    );

    logger.info({ novedadId, employeeId: nov.employee_id, horas: nov.horas_extra, monto_cash }, "HE marcada como pagada en efectivo");
    res.json({ ok: true, novedad: rows[0] });
  } catch (err) {
    logger.error({ err }, "PATCH /rrhh/horas-extra/:id/cash error");
    res.status(500).json({ error: "Error al marcar HE como cash" });
  }
});

// ─── GET /api/rrhh/horas-extra-cash ──────────────────────────────────────────
// Reporte unificado de HE pagadas en efectivo. Junta DOS fuentes:
//  1) Pizarrón/cobertura → incentivos_cash_cobertura (tipo='he_efectivo'): tiene MONTO en Q.
//  2) Anexo de HE → novedades_nomina_diarias (horas_extra_estado='pagado_efectivo'): tiene HORAS.
// Por eso cada fila trae `monto` y/o `horas_extra` (uno puede venir nulo) y un `origen`.
eventosRrhhRouter.get("/rrhh/horas-extra-cash", async (req, res) => {
  try {
    const { desde, hasta } = req.query as Record<string, string>;
    const filtra = Boolean(desde && hasta);
    const whereNov = filtra ? `AND n.fecha BETWEEN $1 AND $2` : "";
    const whereInc = filtra ? `AND ic.fecha BETWEEN $3 AND $4` : "";
    const params = filtra ? [desde, hasta, desde, hasta] : [];

    const { rows } = await pool.query(`
      SELECT * FROM (
        SELECT
          ('nov-' || n.id)                       AS id,
          'anexo'                                AS origen,
          n.fecha,
          n.employee_id,
          n.empleado_nombre,
          n.horas_extra::numeric                 AS horas_extra,
          NULL::numeric                          AS monto,
          n.horas_extra_aprobadas_por            AS pagado_por,
          n.horas_extra_aprobadas_at             AS fecha_pago,
          COALESCE(er.puesto_nombre, n.puesto_cubierto_nombre, n.puesto_titular_nombre) AS puesto_nombre,
          er.cliente_nombre
        FROM novedades_nomina_diarias n
        LEFT JOIN eventos_rrhh er ON er.id = n.evento_rrhh_id
        WHERE n.horas_extra_estado = 'pagado_efectivo'
          ${whereNov}

        UNION ALL

        SELECT
          ('inc-' || ic.id)                      AS id,
          'pizarron'                             AS origen,
          ic.fecha,
          ic.employee_id,
          ic.employee_nombre                     AS empleado_nombre,
          NULL::numeric                          AS horas_extra,
          ic.monto::numeric                      AS monto,
          COALESCE(ic.pagado_por, ic.autorizado_por) AS pagado_por,
          ic.created_at                          AS fecha_pago,
          ic.puesto_nombre,
          ic.cliente_nombre
        FROM incentivos_cash_cobertura ic
        WHERE ic.tipo = 'he_efectivo'
          AND ic.estado <> 'cancelado'
          ${whereInc}
      ) u
      ORDER BY u.fecha DESC, u.empleado_nombre
    `, params);

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /rrhh/horas-extra-cash error");
    res.status(500).json({ error: "Error al obtener HE cash" });
  }
});

// ─── POST /api/rrhh/horas-extra-cash/anular ──────────────────────────────────
// Anula una HE pagada en efectivo y revierte sus efectos. Recibe el id compuesto
// del reporte: `inc-<id>` (pizarrón → incentivos_cash_cobertura) o
// `nov-<id>` (anexo → novedades_nomina_diarias). La operación es transaccional.
//  • inc-: soft-delete del incentivo (estado='cancelado') + revierte la novedad
//    (impacto_nomina → 'pendiente') y el evento de HE (→ 'pendiente_aprobacion').
//  • nov-: revierte la novedad (horas_extra_estado/impacto_nomina → 'pendiente'),
//    el evento ('resuelto_cash' → 'pendiente') y reabre la alerta de RRHH.
eventosRrhhRouter.post("/rrhh/horas-extra-cash/anular", async (req, res) => {
  const { id, motivo, usuario } = req.body as { id?: string; motivo?: string; usuario?: string };
  const m = /^(inc|nov)-(\d+)$/.exec(String(id ?? "").trim());
  if (!m) return res.status(400).json({ error: "id inválido (esperado inc-<n> o nov-<n>)" });
  const origen = m[1];
  const realId = Number(m[2]);
  const quien = usuario ?? "RRHH";
  const nota = ` | ANULADO ${new Date().toISOString().slice(0, 10)} por ${quien}${motivo ? `: ${motivo}` : ""}`;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (origen === "inc") {
      const { rows: icRows } = await client.query(
        `SELECT id, employee_id, fecha, estado FROM incentivos_cash_cobertura
         WHERE id = $1 AND tipo = 'he_efectivo' FOR UPDATE`,
        [realId]
      );
      if (!icRows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "HE en efectivo no encontrada" });
      }
      const ic = icRows[0];
      if (ic.estado === "cancelado") {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Esta HE ya estaba anulada" });
      }

      await client.query(
        `UPDATE incentivos_cash_cobertura
         SET estado = 'cancelado',
             observaciones = COALESCE(observaciones, '') || $2
         WHERE id = $1`,
        [realId, nota]
      );

      // El impacto en novedades/eventos del pizarrón se marca por empleado+fecha
      // (no por puesto). Si aún queda OTRA HE en efectivo activa ese mismo día
      // para el colaborador, NO revertimos: esos registros siguen respaldando
      // el otro pago vigente. Solo revertimos cuando ya no queda ninguna.
      const { rows: restantes } = await client.query(
        `SELECT COUNT(*)::int AS n FROM incentivos_cash_cobertura
         WHERE employee_id = $1 AND fecha = $2::date
           AND tipo = 'he_efectivo' AND estado <> 'cancelado'`,
        [ic.employee_id, ic.fecha]
      );

      if (restantes[0].n === 0) {
        // Revierte solo el impacto que dejó el pago en efectivo del pizarrón,
        // sin tocar novedades pagadas por la vía del anexo (horas_extra_estado).
        await client.query(
          `UPDATE novedades_nomina_diarias
           SET impacto_nomina = 'pendiente', updated_at = NOW()
           WHERE fecha = $1::date AND employee_id = $2
             AND impacto_nomina = 'pagado_efectivo'
             AND horas_extra_estado <> 'pagado_efectivo'`,
          [ic.fecha, ic.employee_id]
        );

        await client.query(
          `UPDATE eventos_rrhh
           SET estado = 'pendiente_aprobacion',
               tipo_resolucion = NULL,
               rrhh_resuelto_por = NULL,
               rrhh_resuelto_at = NULL,
               updated_at = NOW()
           WHERE employee_id = $1
             AND fecha::date = $2::date
             AND tipo_evento = 'horas_extra'
             AND estado = 'pagado_efectivo'`,
          [ic.employee_id, ic.fecha]
        );
      }
    } else {
      const { rows: novRows } = await client.query(
        `SELECT id, employee_id, fecha, evento_rrhh_id, horas_extra_estado
         FROM novedades_nomina_diarias WHERE id = $1 FOR UPDATE`,
        [realId]
      );
      if (!novRows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Novedad no encontrada" });
      }
      const nov = novRows[0];
      if (nov.horas_extra_estado !== "pagado_efectivo") {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Esta HE no está pagada en efectivo o ya fue revertida" });
      }

      await client.query(
        `UPDATE novedades_nomina_diarias
         SET horas_extra_estado = 'pendiente',
             impacto_nomina = 'pendiente',
             horas_extra_aprobadas_por = NULL,
             horas_extra_aprobadas_at = NULL,
             observaciones = COALESCE(observaciones, '') || $2,
             updated_at = NOW()
         WHERE id = $1`,
        [realId, nota]
      );

      if (nov.evento_rrhh_id) {
        await client.query(
          `UPDATE eventos_rrhh SET estado = 'pendiente', updated_at = NOW()
           WHERE id = $1 AND estado = 'resuelto_cash'`,
          [nov.evento_rrhh_id]
        );
      }

      await client.query(
        `UPDATE rrhh_alertas
         SET estado = 'pendiente', resuelta_at = NULL, resuelta_por = NULL
         WHERE tipo = 'horas_extra_pendiente' AND novedad_id = $1 AND estado = 'resuelta'`,
        [realId]
      );
    }

    await client.query("COMMIT");
    logger.info({ id, origen, realId, usuario: quien, motivo }, "HE en efectivo anulada (revertida)");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err, id }, "POST /rrhh/horas-extra-cash/anular error");
    res.status(500).json({ error: "Error al anular HE en efectivo" });
  } finally {
    client.release();
  }
});

// ─── GET /api/rrhh/empleado/:id/kpi ──────────────────────────────────────────
// KPI individual del empleado: faltas, actas, suspensiones, HE aprobadas, semáforo Art.77
eventosRrhhRouter.get("/rrhh/empleado/:id/kpi", async (req, res) => {
  try {
    const employeeId = req.params.id;
    const hoy = new Date().toISOString().split("T")[0];

    // ── Conteos de eventos (últimos 12 meses) ────────────────────────────────
    const { rows: eventRows } = await pool.query(
      `SELECT tipo_evento, COUNT(*) AS total
       FROM eventos_rrhh
       WHERE employee_id = $1
         AND anulado_por IS NULL
         AND fecha >= NOW() - INTERVAL '12 months'
       GROUP BY tipo_evento`,
      [employeeId]
    );

    const counts: Record<string, number> = {};
    for (const r of eventRows as any[]) counts[r.tipo_evento] = Number(r.total);

    // ── Art.77: faltas consecutivas e inasistencias en mes actual ────────────
    const { rows: art77Rows } = await pool.query(
      `SELECT fecha, tipo_evento
       FROM eventos_rrhh
       WHERE employee_id = $1
         AND anulado_por IS NULL
         AND tipo_evento = 'falta'
         AND DATE_TRUNC('month', fecha) = DATE_TRUNC('month', NOW()::date)
       ORDER BY fecha DESC`,
      [employeeId]
    );

    const faltasEstesMes   = art77Rows.length;
    let consecutivas = 0;
    let maxConsecutivas = 0;
    let prevFecha: Date | null = null;
    for (const r of art77Rows as any[]) {
      const d = new Date(r.fecha);
      if (prevFecha) {
        const diff = Math.round((prevFecha.getTime() - d.getTime()) / 86400000);
        if (diff <= 1) consecutivas++;
        else consecutivas = 1;
      } else {
        consecutivas = 1;
      }
      if (consecutivas > maxConsecutivas) maxConsecutivas = consecutivas;
      prevFecha = d;
    }

    // Art.77: 2 días laborales consecutivos ausente → alerta
    const art77ConsecutivaAlerta  = maxConsecutivas >= 2;
    // 6 medias jornadas en el mes = 3 días; usamos 3 faltas como umbral práctico
    const art77MesAlerta = faltasEstesMes >= 3;
    const art77Nivel     = art77ConsecutivaAlerta || art77MesAlerta ? "rojo"
                         : faltasEstesMes >= 2                      ? "amarillo"
                                                                     : "verde";

    // ── HE aprobadas en el período ──────────────────────────────────────────
    const { rows: heRows } = await pool.query(
      `SELECT COALESCE(SUM(horas_extra), 0) AS total_he
       FROM novedades_nomina_diarias
       WHERE employee_id = $1
         AND horas_extra_estado = 'aprobado'
         AND fecha >= NOW() - INTERVAL '12 months'`,
      [employeeId]
    );

    // ── Historial coberturas (últimas 10) ────────────────────────────────────
    const { rows: cobRows } = await pool.query(
      `SELECT fecha, tipo_cobertura, motivo, puesto_nombre, empleado_nombre AS nombre
       FROM cobertura_segmentos
       WHERE employee_id = $1
       ORDER BY fecha DESC LIMIT 10`,
      [employeeId]
    );

    // ── Historial actas y eventos recientes ──────────────────────────────────
    const { rows: eventosRecientes } = await pool.query(
      `SELECT id, tipo_evento, estado, fecha, cliente_nombre, puesto_nombre, observaciones
       FROM eventos_rrhh
       WHERE employee_id = $1
         AND anulado_por IS NULL
       ORDER BY fecha DESC LIMIT 20`,
      [employeeId]
    );

    res.json({
      employeeId,
      faltas12m          : counts["falta"]        ?? 0,
      suspensiones12m    : counts["suspension"]   ?? 0,
      actas12m           : (counts["falta"] ?? 0) + (counts["suspension"] ?? 0) + (counts["amonestacion"] ?? 0),
      vacaciones12m      : counts["vacaciones"]   ?? 0,
      incapacidades12m   : counts["incapacidad"]  ?? 0,
      horasExtraAprobadas: parseFloat(String(heRows[0]?.total_he ?? 0)),
      faltasEsteMes      : faltasEstesMes,
      consecutivasMax    : maxConsecutivas,
      art77              : {
        nivel                    : art77Nivel,
        alertaConsecutiva        : art77ConsecutivaAlerta,
        alertaMes                : art77MesAlerta,
        faltasEsteMes,
      },
      historialCobertura : cobRows,
      eventosRecientes   : eventosRecientes,
    });
  } catch (err) {
    logger.error({ err }, "GET /rrhh/empleado/:id/kpi error");
    res.status(500).json({ error: "Error al obtener KPI del empleado" });
  }
});

// ─── GET /api/rrhh/eventos/actas ─────────────────────────────────────────────
// Datos para impresión batch de actas — filtros: desde, hasta, tipo, verificado
eventosRrhhRouter.get("/rrhh/eventos/actas", async (req, res) => {
  try {
    const { desde, hasta, tipo, verificado } = req.query as Record<string, string>;
    const params: any[] = [];
    const conds: string[] = ["anulado_por IS NULL"];

    if (desde)      { conds.push(`fecha >= $${params.length + 1}`);      params.push(desde); }
    if (hasta)      { conds.push(`fecha <= $${params.length + 1}`);      params.push(hasta); }
    if (tipo)       { conds.push(`tipo_evento = $${params.length + 1}`); params.push(tipo); }
    if (verificado === "true") {
      conds.push(`rrhh_resuelto_por IS NOT NULL`);
    }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT
         id, employee_id, employee_nombre, employee_dpi,
         tipo_evento, estado, fecha, fecha_fin,
         cliente_nombre, puesto_nombre, supervisor_nombre,
         observaciones, notas, cantidad_dias, cantidad_horas,
         afecta_nomina, rrhh_resuelto_por, rrhh_resuelto_at,
         created_at
       FROM eventos_rrhh
       ${where}
       ORDER BY fecha DESC
       LIMIT 500`,
      params
    );

    res.json({ actas: rows, total: rows.length });
  } catch (err) {
    logger.error({ err }, "GET /rrhh/eventos/actas error");
    res.status(500).json({ error: "Error al obtener actas" });
  }
});
