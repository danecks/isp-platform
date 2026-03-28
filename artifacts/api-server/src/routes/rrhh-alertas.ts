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

export { rrhhAlertasRouter };
