import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const zonasRouter = Router();

// ─── GET /api/operaciones/zonas ───────────────────────────────────────────────
// Lista todas las zonas con estadísticas y supervisores (puede haber varios)
zonasRouter.get("/operaciones/zonas", async (req, res) => {
  try {
    const supervisorEmpId = req.query.supervisor_employee_id;

    let query = `
      SELECT
        oz.id,
        oz.nombre,
        oz.descripcion,
        oz.supervisor_employee_id,
        oz.supervisor_user_id,
        oz.estado,
        oz.created_at,
        oz.updated_at,
        e.nombre_completo  AS supervisor_nombre,
        e.puesto           AS supervisor_puesto,
        e.telefono         AS supervisor_telefono,
        COALESCE((
          SELECT json_agg(json_build_object(
            'employee_id', zs.employee_id,
            'nombre',      es.nombre_completo,
            'puesto',      es.puesto,
            'telefono',    es.telefono
          ) ORDER BY zs.orden, es.nombre_completo)
          FROM zona_supervisores zs
          JOIN employees es ON es.id = zs.employee_id
          WHERE zs.zona_id = oz.id
        ), '[]'::json) AS supervisores,
        COUNT(DISTINCT po.id)::int           AS total_puestos,
        COUNT(DISTINCT po.cliente_id)::int   AS total_clientes,
        COUNT(DISTINCT po.sede_id)::int      AS total_sedes,
        COUNT(DISTINCT CASE WHEN po.estado = 'cubierto' THEN po.id END)::int AS puestos_cubiertos,
        COUNT(DISTINCT CASE WHEN po.estado != 'cubierto' AND po.activo = TRUE THEN po.id END)::int AS puestos_descubiertos
      FROM operational_zones oz
      LEFT JOIN employees e ON e.id = oz.supervisor_employee_id
      LEFT JOIN puestos_operativos po ON po.zona_operativa_id = oz.id AND po.activo = TRUE
    `;

    const params: any[] = [];
    if (supervisorEmpId) {
      query += ` WHERE EXISTS (
        SELECT 1 FROM zona_supervisores zsq WHERE zsq.zona_id = oz.id AND zsq.employee_id = $1
      )`;
      params.push(supervisorEmpId);
    }

    query += ` GROUP BY oz.id, e.nombre_completo, e.puesto, e.telefono ORDER BY oz.nombre`;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /operaciones/zonas error");
    res.status(500).json({ error: "Error al cargar zonas" });
  }
});

// ─── GET /api/operaciones/zonas/empleados-supervisores ────────────────────────
// Lista de empleados elegibles como supervisor de zona:
// supervisores, jefes de servicio o personal administrativo.
zonasRouter.get("/operaciones/zonas/empleados-supervisores", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        e.id,
        e.nombre_completo AS "nombreCompleto",
        e.puesto,
        COALESCE(e.tipo_personal, 'guardia') AS "tipoPersonal"
      FROM employees e
      WHERE e.estado_laboral = 'activo'
        AND COALESCE(e.tipo_personal, 'guardia') NOT IN ('guardia', 'custodio')
      ORDER BY e.nombre_completo
    `);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /operaciones/zonas/empleados-supervisores error");
    res.status(500).json({ error: "Error al cargar empleados supervisores" });
  }
});

// ─── GET /api/operaciones/zonas/disponibles ───────────────────────────────────
// Lista mínima para selectores (id, nombre, estado)
zonasRouter.get("/operaciones/zonas/disponibles", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, estado FROM operational_zones WHERE estado = 'activo' ORDER BY nombre`
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /operaciones/zonas/disponibles error");
    res.status(500).json({ error: "Error al cargar zonas disponibles" });
  }
});

// ─── GET /api/operaciones/zonas/:id/detalle ───────────────────────────────────
// Detalle de una zona: puestos agrupados por cliente
zonasRouter.get("/operaciones/zonas/:id/detalle", async (req, res) => {
  const zonaId = Number(req.params.id);
  try {
    // Zona
    const { rows: zonaRows } = await pool.query(
      `SELECT oz.*, e.nombre_completo AS supervisor_nombre, e.telefono AS supervisor_telefono
       FROM operational_zones oz
       LEFT JOIN employees e ON e.id = oz.supervisor_employee_id
       WHERE oz.id = $1`,
      [zonaId]
    );
    if (!zonaRows.length) return res.status(404).json({ error: "Zona no encontrada" });

    // Puestos de la zona
    const { rows: puestos } = await pool.query(
      `SELECT
         po.id, po.nombre, po.cliente_id, po.cliente_nombre,
         po.estado, po.turno, po.jornada,
         po.agente_id, po.agente_nombre,
         po.titular_employee_id, po.titular_nombre,
         po.sede_id, cs.nombre AS sede_nombre
       FROM puestos_operativos po
       LEFT JOIN client_sedes cs ON cs.id = po.sede_id
       WHERE po.zona_operativa_id = $1 AND po.activo = TRUE
       ORDER BY po.cliente_nombre, cs.nombre NULLS LAST, po.nombre`,
      [zonaId]
    );

    // Agrupar por cliente
    const mapaClientes: Record<string, any> = {};
    for (const p of puestos) {
      const key = p.cliente_nombre || "Sin cliente";
      if (!mapaClientes[key]) {
        mapaClientes[key] = { cliente_id: p.cliente_id, cliente_nombre: key, puestos: [] };
      }
      mapaClientes[key].puestos.push(p);
    }

    res.json({
      zona: zonaRows[0],
      puestosAgrupados: Object.values(mapaClientes),
    });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/zonas/:id/detalle error");
    res.status(500).json({ error: "Error al cargar detalle de zona" });
  }
});

// Helper: normaliza la lista de supervisores recibida del cliente.
// Acepta supervisor_employee_ids: number[] (preferido) o supervisor_employee_id: number (legacy).
function normalizarIdsSupervisores(body: any): number[] | null {
  if (Array.isArray(body?.supervisor_employee_ids)) {
    const ids = body.supervisor_employee_ids
      .map((x: any) => Number(x))
      .filter((n: number) => Number.isInteger(n) && n > 0);
    return Array.from(new Set(ids));
  }
  if (body?.supervisor_employee_id !== undefined) {
    return body.supervisor_employee_id ? [Number(body.supervisor_employee_id)] : [];
  }
  return null; // no se tocó el campo
}

// Reemplaza la lista de supervisores de una zona y mantiene la columna legacy
// operational_zones.supervisor_employee_id sincronizada con el primero (compat).
async function reemplazarSupervisoresZona(zonaId: number, ids: number[]) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM zona_supervisores WHERE zona_id = $1`, [zonaId]);
    for (let i = 0; i < ids.length; i++) {
      await client.query(
        `INSERT INTO zona_supervisores (zona_id, employee_id, orden)
         VALUES ($1, $2, $3)
         ON CONFLICT (zona_id, employee_id) DO NOTHING`,
        [zonaId, ids[i], i]
      );
    }
    await client.query(
      `UPDATE operational_zones SET supervisor_employee_id = $1, updated_at = NOW() WHERE id = $2`,
      [ids[0] ?? null, zonaId]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// ─── POST /api/operaciones/zonas ──────────────────────────────────────────────
// Crear zona operativa global (acepta uno o varios supervisores)
zonasRouter.post("/operaciones/zonas", async (req, res) => {
  const { nombre, descripcion, supervisor_user_id } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: "nombre es requerido" });

  try {
    const ids = normalizarIdsSupervisores(req.body) ?? [];
    const { rows } = await pool.query(
      `INSERT INTO operational_zones (nombre, descripcion, supervisor_employee_id, supervisor_user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nombre.trim(), descripcion || null, ids[0] ?? null, supervisor_user_id || null]
    );
    const nueva = rows[0];
    if (ids.length > 0) {
      await reemplazarSupervisoresZona(nueva.id, ids);
    }
    res.status(201).json(nueva);
  } catch (err) {
    logger.error({ err }, "POST /operaciones/zonas error");
    res.status(500).json({ error: "Error al crear zona" });
  }
});

// ─── PATCH /api/operaciones/zonas/:id ─────────────────────────────────────────
// Actualizar zona (nombre, descripcion, supervisores, estado)
zonasRouter.patch("/operaciones/zonas/:id", async (req, res) => {
  const { nombre, descripcion, supervisor_user_id, estado } = req.body;
  const zonaId = Number(req.params.id);
  const idsSupervisores = normalizarIdsSupervisores(req.body);

  try {
    const { rows } = await pool.query(
      `UPDATE operational_zones
       SET nombre              = COALESCE($1, nombre),
           descripcion         = COALESCE($2, descripcion),
           supervisor_user_id  = COALESCE($3, supervisor_user_id),
           estado              = COALESCE($4, estado),
           updated_at          = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        nombre?.trim() || null,
        descripcion !== undefined ? (descripcion || null) : null,
        supervisor_user_id !== undefined ? (supervisor_user_id || null) : null,
        estado || null,
        zonaId,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: "Zona no encontrada" });

    if (idsSupervisores !== null) {
      await reemplazarSupervisoresZona(zonaId, idsSupervisores);
      // releer para devolver supervisor_employee_id sincronizado
      const refrescada = await pool.query(`SELECT * FROM operational_zones WHERE id = $1`, [zonaId]);
      return res.json(refrescada.rows[0]);
    }

    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /operaciones/zonas/:id error");
    res.status(500).json({ error: "Error al actualizar zona" });
  }
});

// ─── DELETE /api/operaciones/zonas/:id ────────────────────────────────────────
// Desactivar zona (soft-delete)
zonasRouter.delete("/operaciones/zonas/:id", async (req, res) => {
  try {
    await pool.query(
      `UPDATE operational_zones SET estado = 'inactivo', updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /operaciones/zonas/:id error");
    res.status(500).json({ error: "Error al desactivar zona" });
  }
});

// ─── POST /api/operaciones/zonas/:id/puestos ──────────────────────────────────
// Asignar puestos a una zona (reemplaza su zona actual)
zonasRouter.post("/operaciones/zonas/:id/puestos", async (req, res) => {
  const zonaId = Number(req.params.id);
  const { puesto_ids } = req.body as { puesto_ids: number[] };
  if (!Array.isArray(puesto_ids)) return res.status(400).json({ error: "puesto_ids debe ser un array" });

  try {
    // Verificar que la zona existe
    const { rows: zonaCheck } = await pool.query(
      `SELECT id FROM operational_zones WHERE id = $1`, [zonaId]
    );
    if (!zonaCheck.length) return res.status(404).json({ error: "Zona no encontrada" });

    // Asignar los puestos a esta zona
    if (puesto_ids.length > 0) {
      await pool.query(
        `UPDATE puestos_operativos SET zona_operativa_id = $1, updated_at = NOW()
         WHERE id = ANY($2::int[])`,
        [zonaId, puesto_ids]
      );
    }
    res.json({ ok: true, asignados: puesto_ids.length });
  } catch (err) {
    logger.error({ err }, "POST /operaciones/zonas/:id/puestos error");
    res.status(500).json({ error: "Error al asignar puestos a la zona" });
  }
});

// ─── DELETE /api/operaciones/zonas/:id/puestos/:puestoId ─────────────────────
// Quitar un puesto de la zona (poner zona_operativa_id = NULL)
zonasRouter.delete("/operaciones/zonas/:id/puestos/:puestoId", async (req, res) => {
  try {
    await pool.query(
      `UPDATE puestos_operativos SET zona_operativa_id = NULL, updated_at = NOW()
       WHERE id = $1 AND zona_operativa_id = $2`,
      [req.params.puestoId, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /operaciones/zonas/:id/puestos/:puestoId error");
    res.status(500).json({ error: "Error al quitar puesto de la zona" });
  }
});

// ─── GET /api/operaciones/puestos-sin-zona ────────────────────────────────────
// Puestos activos que no tienen zona asignada (para asignador)
zonasRouter.get("/operaciones/puestos-sin-zona", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT po.id, po.nombre, po.cliente_nombre, po.cliente_id,
             cs.nombre AS sede_nombre, po.estado
      FROM puestos_operativos po
      LEFT JOIN client_sedes cs ON cs.id = po.sede_id
      WHERE po.activo = TRUE AND po.zona_operativa_id IS NULL
      ORDER BY po.cliente_nombre, cs.nombre NULLS LAST, po.nombre
    `);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /operaciones/puestos-sin-zona error");
    res.status(500).json({ error: "Error al cargar puestos sin zona" });
  }
});

// ─── GET /api/operaciones/todos-puestos ───────────────────────────────────────
// Todos los puestos activos con su zona actual (para el asignador de zonas)
zonasRouter.get("/operaciones/todos-puestos", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT po.id, po.nombre, po.cliente_nombre, po.cliente_id,
             po.sede_id, cs.nombre AS sede_nombre, po.estado,
             po.zona_operativa_id, oz.nombre AS zona_nombre
      FROM puestos_operativos po
      LEFT JOIN client_sedes cs ON cs.id = po.sede_id
      LEFT JOIN operational_zones oz ON oz.id = po.zona_operativa_id
      WHERE po.activo = TRUE
      ORDER BY po.cliente_nombre, cs.nombre NULLS LAST, po.nombre
    `);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /operaciones/todos-puestos error");
    res.status(500).json({ error: "Error al cargar puestos" });
  }
});

export default zonasRouter;
