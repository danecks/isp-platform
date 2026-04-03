import { Router } from "express";
import { pool } from "@workspace/db";
import { generarAlertas } from "../services/alert-generator";

const rrhhAlertasRouter = Router();

// POST /api/rrhh/alertas/generar — disparar generación de alertas ──────────────
rrhhAlertasRouter.post("/rrhh/alertas/generar", async (_req, res) => {
  try {
    const resultado = await generarAlertas();
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: "Error al generar alertas" });
  }
});

// GET /api/rrhh/alertas — listar alertas con filtros opcionales ────────────────
// Query params: estado (nueva|en_revision|resuelta|todas), prioridad (alta|media|baja)
rrhhAlertasRouter.get("/rrhh/alertas", async (req, res) => {
  try {
    const estado = (req.query.estado as string) ?? "activas";
    const prioridad = req.query.prioridad as string | undefined;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (estado === "activas") {
      conditions.push(`a.estado IN ('nueva', 'en_revision')`);
    } else if (estado !== "todas") {
      params.push(estado);
      conditions.push(`a.estado = $${params.length}`);
    }

    if (prioridad) {
      params.push(prioridad);
      conditions.push(`a.prioridad = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT
         a.id, a.employee_id, a.employee_nombre,
         a.tipo, a.prioridad, a.estado,
         a.datos_clave, a.sugerencia,
         a.generada_at, a.vista_at, a.resuelta_at, a.resuelta_por,
         e.puesto, e.area, e.sede, e.estado_laboral
       FROM rrhh_alertas a
       LEFT JOIN employees e ON e.id = a.employee_id
       ${where}
       ORDER BY
         CASE a.prioridad WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
         a.generada_at DESC`,
      params,
    );

    // Contar por estado para el resumen
    const { rows: conteos } = await pool.query(`
      SELECT estado, COUNT(*) as total FROM rrhh_alertas GROUP BY estado
    `);
    const { rows: conteosPrioridad } = await pool.query(`
      SELECT prioridad, COUNT(*) as total FROM rrhh_alertas WHERE estado IN ('nueva','en_revision') GROUP BY prioridad
    `);

    const resumen = {
      nueva:       parseInt(conteos.find((c: any) => c.estado === "nueva")?.total ?? "0"),
      en_revision: parseInt(conteos.find((c: any) => c.estado === "en_revision")?.total ?? "0"),
      resuelta:    parseInt(conteos.find((c: any) => c.estado === "resuelta")?.total ?? "0"),
      alta:        parseInt(conteosPrioridad.find((c: any) => c.prioridad === "alta")?.total ?? "0"),
      media:       parseInt(conteosPrioridad.find((c: any) => c.prioridad === "media")?.total ?? "0"),
      baja:        parseInt(conteosPrioridad.find((c: any) => c.prioridad === "baja")?.total ?? "0"),
    };

    res.json({
      alertas: rows.map((r: any) => ({
        id: r.id,
        employeeId: r.employee_id,
        employeeNombre: r.employee_nombre,
        puesto: r.puesto,
        area: r.area,
        sede: r.sede,
        estadoLaboral: r.estado_laboral,
        tipo: r.tipo,
        prioridad: r.prioridad,
        estado: r.estado,
        datosClave: r.datos_clave ? JSON.parse(r.datos_clave) : {},
        sugerencia: r.sugerencia,
        generadaAt: r.generada_at,
        vistaAt: r.vista_at,
        resueltaAt: r.resuelta_at,
        resueltaPor: r.resuelta_por,
      })),
      resumen,
    });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener alertas" });
  }
});

// PATCH /api/rrhh/alertas/:id — actualizar estado ─────────────────────────────
rrhhAlertasRouter.patch("/rrhh/alertas/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const { estado, resueltaPor } = req.body as { estado: string; resueltaPor?: string };
  const estadosValidos = ["en_revision", "resuelta", "nueva"];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: "Estado inválido" });
  }

  try {
    const sets: string[] = ["estado = $1"];
    const params: unknown[] = [estado];

    if (estado === "resuelta") {
      sets.push("resuelta_at = NOW()");
      if (resueltaPor) {
        params.push(resueltaPor);
        sets.push(`resuelta_por = $${params.length}`);
      }
    }

    params.push(id);
    const { rows } = await pool.query(
      `UPDATE rrhh_alertas SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params,
    );

    if (!rows.length) return res.status(404).json({ error: "Alerta no encontrada" });
    res.json({ ok: true, alerta: rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar alerta" });
  }
});

// POST /api/rrhh/alertas/:id/vista — marcar como vista ────────────────────────
rrhhAlertasRouter.post("/rrhh/alertas/:id/vista", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  try {
    const { rows } = await pool.query(
      `UPDATE rrhh_alertas SET vista_at = COALESCE(vista_at, NOW())
       WHERE id = $1 RETURNING id, vista_at`,
      [id],
    );
    if (!rows.length) return res.status(404).json({ error: "Alerta no encontrada" });
    res.json({ ok: true, vistaAt: rows[0].vista_at });
  } catch (err) {
    res.status(500).json({ error: "Error al marcar alerta como vista" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// INCIDENCIAS PENDIENTES DE REVISIÓN RRHH
// Flujo: pizarrón libera agente → novedad queda impacto_nomina='pendiente'
//        RRHH clasifica aquí → falta/descuento se aplican en nómina
// ────────────────────────────────────────────────────────────────────────────

// GET /api/rrhh/incidencias/pendientes — listar novedades pendientes de revisión
rrhhAlertasRouter.get("/rrhh/incidencias/pendientes", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        nnd.id,
        nnd.fecha,
        nnd.employee_id,
        nnd.empleado_nombre,
        nnd.tipo_novedad,
        nnd.impacto_nomina,
        nnd.requiere_revision_rrhh,
        nnd.evento_rrhh_id,
        nnd.puesto_titular_id,
        nnd.puesto_titular_nombre,
        nnd.fuente,
        nnd.cierre_id,
        nnd.created_at,
        nnd.updated_at,
        -- Datos del empleado
        e.dpi,
        e.puesto       AS empleado_cargo,
        -- Datos del evento RRHH vinculado
        er.tipo_evento         AS evento_tipo,
        er.estado              AS evento_estado,
        er.cliente_nombre      AS evento_cliente,
        er.puesto_nombre       AS evento_puesto,
        er.generado_desde      AS evento_origen,
        er.observaciones       AS evento_observaciones,
        er.usuario_generador   AS evento_usuario
      FROM novedades_nomina_diarias nnd
      LEFT JOIN employees e ON e.id = nnd.employee_id
      LEFT JOIN eventos_rrhh er ON er.id = nnd.evento_rrhh_id
      WHERE nnd.requiere_revision_rrhh = TRUE
        AND nnd.impacto_nomina = 'pendiente'
      ORDER BY nnd.fecha DESC, nnd.empleado_nombre
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al cargar incidencias pendientes" });
  }
});

// GET /api/rrhh/incidencias/pendientes/count — conteo para badge de navegación
rrhhAlertasRouter.get("/rrhh/incidencias/pendientes/count", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM novedades_nomina_diarias
      WHERE requiere_revision_rrhh = TRUE
        AND impacto_nomina = 'pendiente'
    `);
    res.json({ total: rows[0]?.total ?? 0 });
  } catch (err) {
    res.status(500).json({ error: "Error al contar incidencias" });
  }
});

// Mapeo de tipo_resolucion → campos de novedad
const RESOLUCION_MAP: Record<string, { falta: boolean; suspension: boolean; descuento_dia: boolean; afecta_septimo: boolean }> = {
  falta_injustificada: { falta: true,  suspension: false, descuento_dia: true,  afecta_septimo: true  },
  permiso_con_goce:    { falta: false, suspension: false, descuento_dia: false, afecta_septimo: false },
  permiso_sin_goce:    { falta: false, suspension: false, descuento_dia: true,  afecta_septimo: true  },
  incapacidad:         { falta: false, suspension: false, descuento_dia: false, afecta_septimo: false },
  suspension:          { falta: false, suspension: true,  descuento_dia: true,  afecta_septimo: true  },
  descuento_horas:     { falta: false, suspension: false, descuento_dia: false, afecta_septimo: false },
  amonestacion:        { falta: false, suspension: false, descuento_dia: false, afecta_septimo: false },
  sin_impacto:         { falta: false, suspension: false, descuento_dia: false, afecta_septimo: false },
};

// PATCH /api/rrhh/incidencias/:id/resolver — RRHH clasifica la incidencia
rrhhAlertasRouter.patch("/rrhh/incidencias/:id/resolver", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const { tipo_resolucion, observaciones, cantidad_horas, cantidad_dias, usuario } = req.body;

  if (!tipo_resolucion || !RESOLUCION_MAP[tipo_resolucion]) {
    return res.status(400).json({
      error: "tipo_resolucion inválido",
      validos: Object.keys(RESOLUCION_MAP),
    });
  }

  const efecto = RESOLUCION_MAP[tipo_resolucion];

  try {
    // Obtener novedad actual
    const { rows: novRows } = await pool.query(
      `SELECT * FROM novedades_nomina_diarias WHERE id = $1`,
      [id]
    );
    if (!novRows.length) return res.status(404).json({ error: "Novedad no encontrada" });
    const novedad = novRows[0];

    if (novedad.impacto_nomina !== 'pendiente') {
      return res.status(409).json({
        error: "Esta incidencia ya fue resuelta",
        impacto_actual: novedad.impacto_nomina,
      });
    }

    // Actualizar novedad con la resolución RRHH
    const { rows: updatedRows } = await pool.query(`
      UPDATE novedades_nomina_diarias SET
        falta                  = $2,
        suspension             = $3,
        descuento_dia          = $4,
        afecta_septimo         = $5,
        impacto_nomina         = 'aprobado_rrhh',
        requiere_revision_rrhh = FALSE,
        tipo_novedad           = COALESCE(tipo_novedad, $6),
        updated_at             = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, efecto.falta, efecto.suspension, efecto.descuento_dia, efecto.afecta_septimo, tipo_resolucion]);

    // Actualizar evento RRHH vinculado si existe
    if (novedad.evento_rrhh_id) {
      await pool.query(`
        UPDATE eventos_rrhh SET
          tipo_resolucion   = $2,
          afecta_nomina     = $3,
          cantidad_horas    = $4,
          cantidad_dias     = $5,
          afecta_septimo_res = $6,
          rrhh_resuelto_por  = $7,
          rrhh_resuelto_at   = NOW(),
          estado             = 'revisado',
          updated_at         = NOW()
        WHERE id = $1
      `, [
        novedad.evento_rrhh_id,
        tipo_resolucion,
        efecto.falta || efecto.descuento_dia || efecto.suspension,
        cantidad_horas ?? null,
        cantidad_dias ?? null,
        efecto.afecta_septimo,
        usuario || 'rrhh',
      ]);
    }

    res.json({
      ok: true,
      novedad: updatedRows[0],
      tipo_resolucion,
      efecto,
    });
  } catch (err) {
    res.status(500).json({ error: "Error al resolver incidencia" });
  }
});

// GET /api/rrhh/incidencias/historial — incidencias ya resueltas (últimos 30 días)
rrhhAlertasRouter.get("/rrhh/incidencias/historial", async (req, res) => {
  try {
    const dias = parseInt(req.query.dias as string) || 30;
    const { rows } = await pool.query(`
      SELECT
        nnd.id,
        nnd.fecha,
        nnd.employee_id,
        nnd.empleado_nombre,
        nnd.tipo_novedad,
        nnd.impacto_nomina,
        nnd.falta,
        nnd.suspension,
        nnd.descuento_dia,
        nnd.afecta_septimo,
        nnd.puesto_titular_nombre,
        nnd.fuente,
        nnd.updated_at,
        er.tipo_resolucion,
        er.rrhh_resuelto_por,
        er.rrhh_resuelto_at,
        er.observaciones AS resolucion_observaciones
      FROM novedades_nomina_diarias nnd
      LEFT JOIN eventos_rrhh er ON er.id = nnd.evento_rrhh_id
      WHERE nnd.impacto_nomina IN ('aprobado_rrhh', 'rechazado_rrhh')
        AND nnd.fecha >= CURRENT_DATE - $1::int
      ORDER BY nnd.fecha DESC, nnd.updated_at DESC
    `, [dias]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al cargar historial de incidencias" });
  }
});

export { rrhhAlertasRouter };
