import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { calcularKPIDisciplinario } from "../services/disciplinary-kpi";

export const eventosRrhhRouter = Router();

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

    // fecha: usar fechaInicio si se provee, de lo contrario NOW()
    const fechaValor = fechaInicio ? `'${fechaInicio}'::date` : "NOW()";

    const { rows } = await pool.query(
      `INSERT INTO eventos_rrhh
         (employee_id, employee_nombre, employee_dpi,
          tipo_evento, cliente_nombre, puesto_nombre,
          supervisor_nombre, generado_desde, movimiento_id,
          estado, observaciones, notas, usuario_generador,
          documentos_generados, fecha, fecha_fin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendiente',$10,$11,$12,'[]',${fechaValor},$13)
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
        fechaFin || null,
      ],
    );

    const eventoCreado = rows[0];
    logger.info({ id: eventoCreado.id, tipo: tipoEvento }, "Evento RRHH creado");

    // Fix E2E-04: Auto-generar novedad en nómina para eventos que afectan el pago.
    // Tipos relevantes: falta, falta_injustificada, incapacidad, suspension.
    // Se hace fuera de la inserción principal (best effort) para no bloquear.
    const TIPOS_CON_NOVEDAD = ["falta", "falta_injustificada", "incapacidad", "suspension"];
    if (TIPOS_CON_NOVEDAD.includes(tipoEvento)) {
      try {
        const hoy = new Date().toISOString().split("T")[0];

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
  const { estado, notas } = req.body;

  const VALID = ["pendiente", "en_proceso", "aprobado", "cerrado"];
  if (!VALID.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Válidos: ${VALID.join(", ")}` });
  }

  try {
    // No permitir modificar eventos anulados
    const { rows: check } = await pool.query(`SELECT estado FROM eventos_rrhh WHERE id=$1`, [id]);
    if (!check.length) return res.status(404).json({ error: "Evento no encontrado" });
    if (check[0].estado === "anulado") {
      return res.status(409).json({ error: "No se puede modificar un evento anulado" });
    }

    const { rows } = await pool.query(
      `UPDATE eventos_rrhh
       SET estado=$1, notas=COALESCE($2, notas), updated_at=NOW()
       WHERE id=$3
       RETURNING *`,
      [estado, notas || null, id],
    );

    res.json({ ok: true, evento: rows[0] });
  } catch (err) {
    logger.error({ err }, "PATCH /rrhh/eventos/:id/estado error");
    res.status(500).json({ error: "Error al actualizar estado" });
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

    res.json({ ok: true, evento: rows[0] });
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
