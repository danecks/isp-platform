import { Router } from "express";
import { pool } from "@workspace/db";

export const vehiculosRouter = Router();

const getSession = (req: any) =>
  (req.headers["x-isp-session"] as string) ?? "";

// ── GET /api/vehiculos ────────────────────────────────────────────────────────
vehiculosRouter.get("/vehiculos", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        v.id,
        v.placa,
        v.tipo,
        v.marca,
        v.modelo,
        v.color,
        v.anio,
        v.estado,
        v.activo,
        v.observaciones,
        v.zona_operativa_id,
        oz.nombre AS zona_nombre,
        v.created_at,
        v.updated_at,
        -- Custodia actual (la más reciente sin fecha_fin)
        c.id        AS custodia_id,
        c.employee_id AS custodio_id,
        e.nombre_completo AS custodio_nombre,
        e.tipo_personal   AS custodio_tipo,
        c.fecha_inicio    AS custodia_desde,
        c.tipo_relevo     AS custodia_tipo_relevo
      FROM vehiculos v
      LEFT JOIN operational_zones oz ON oz.id = v.zona_operativa_id
      LEFT JOIN vehiculo_custodia c  ON c.vehiculo_id = v.id AND c.fecha_fin IS NULL
      LEFT JOIN employees e          ON e.id = c.employee_id
      ORDER BY v.activo DESC, v.placa
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/vehiculos/estado-operativo ───────────────────────────────────────
vehiculosRouter.get("/vehiculos/estado-operativo", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        oz.id   AS zona_id,
        oz.nombre AS zona_nombre,
        v.id    AS vehiculo_id,
        v.placa,
        v.tipo,
        v.marca,
        v.modelo,
        v.color,
        v.estado AS vehiculo_estado,
        -- Supervisor formal de la zona
        ez.id               AS supervisor_zona_id,
        ez.nombre_completo  AS supervisor_zona_nombre,
        -- Custodio actual del vehículo
        c.id                AS custodia_id,
        ce.id               AS custodio_id,
        ce.nombre_completo  AS custodio_nombre,
        ce.tipo_personal    AS custodio_tipo,
        c.fecha_inicio       AS custodia_desde,
        c.tipo_relevo        AS custodia_tipo_relevo
      FROM operational_zones oz
      LEFT JOIN vehiculos v       ON v.zona_operativa_id = oz.id AND v.activo = true
      LEFT JOIN employees ez      ON ez.id = oz.supervisor_employee_id
      LEFT JOIN vehiculo_custodia c  ON c.vehiculo_id = v.id AND c.fecha_fin IS NULL
      LEFT JOIN employees ce      ON ce.id = c.employee_id
      WHERE oz.estado = 'activo'
      ORDER BY oz.nombre
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/vehiculos/:id ────────────────────────────────────────────────────
vehiculosRouter.get("/vehiculos/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rows } = await pool.query(`
      SELECT
        v.*,
        oz.nombre AS zona_nombre,
        c.id        AS custodia_id,
        c.employee_id AS custodio_id,
        e.nombre_completo AS custodio_nombre,
        c.fecha_inicio    AS custodia_desde,
        c.tipo_relevo     AS custodia_tipo_relevo
      FROM vehiculos v
      LEFT JOIN operational_zones oz ON oz.id = v.zona_operativa_id
      LEFT JOIN vehiculo_custodia c  ON c.vehiculo_id = v.id AND c.fecha_fin IS NULL
      LEFT JOIN employees e          ON e.id = c.employee_id
      WHERE v.id = $1
    `, [id]);
    if (!rows[0]) return res.status(404).json({ error: "Vehículo no encontrado" });
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/vehiculos/:id/custodia ───────────────────────────────────────────
vehiculosRouter.get("/vehiculos/:id/custodia", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rows } = await pool.query(`
      SELECT
        c.*,
        e.nombre_completo AS custodio_nombre,
        e.tipo_personal   AS custodio_tipo,
        oz.nombre         AS zona_nombre
      FROM vehiculo_custodia c
      LEFT JOIN employees e ON e.id = c.employee_id
      LEFT JOIN operational_zones oz ON oz.id = c.zona_operativa_id
      WHERE c.vehiculo_id = $1
      ORDER BY c.fecha_inicio DESC
      LIMIT 200
    `, [id]);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/vehiculos/historial/global ───────────────────────────────────────
vehiculosRouter.get("/vehiculos/historial/global", async (req, res) => {
  const { limite = "100", vehiculo_id, employee_id } = req.query as any;
  try {
    const conds: string[] = [];
    const params: any[] = [];
    if (vehiculo_id) { conds.push(`c.vehiculo_id = $${params.length + 1}`); params.push(vehiculo_id); }
    if (employee_id) { conds.push(`c.employee_id = $${params.length + 1}`); params.push(employee_id); }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    params.push(Math.min(Number(limite), 500));
    const { rows } = await pool.query(`
      SELECT
        c.*,
        v.placa, v.tipo, v.marca, v.modelo, v.color,
        e.nombre_completo AS custodio_nombre,
        e.tipo_personal   AS custodio_tipo,
        oz.nombre         AS zona_nombre
      FROM vehiculo_custodia c
      LEFT JOIN vehiculos v ON v.id = c.vehiculo_id
      LEFT JOIN employees e ON e.id = c.employee_id
      LEFT JOIN operational_zones oz ON oz.id = c.zona_operativa_id
      ${where}
      ORDER BY c.fecha_inicio DESC
      LIMIT $${params.length}
    `, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/vehiculos ───────────────────────────────────────────────────────
vehiculosRouter.post("/vehiculos", async (req, res) => {
  const { placa, tipo, marca, modelo, color, anio, estado, activo, zona_operativa_id, observaciones, usuario } = req.body;
  if (!placa || !tipo) return res.status(400).json({ error: "placa y tipo son requeridos" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`
      INSERT INTO vehiculos (placa, tipo, marca, modelo, color, anio, estado, activo, zona_operativa_id, observaciones)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [
      placa.toUpperCase().trim(),
      tipo, marca ?? null, modelo ?? null, color ?? null,
      anio ? Number(anio) : null,
      estado ?? "activo",
      activo !== false,
      zona_operativa_id ? Number(zona_operativa_id) : null,
      observaciones ?? null,
    ]);
    const veh = rows[0];

    // Si tiene zona, buscar supervisor y crear custodia inicial
    if (veh.zona_operativa_id) {
      const { rows: zonaRows } = await client.query(
        `SELECT supervisor_employee_id FROM operational_zones WHERE id = $1`,
        [veh.zona_operativa_id]
      );
      const supId = zonaRows[0]?.supervisor_employee_id;
      if (supId) {
        await client.query(`
          INSERT INTO vehiculo_custodia (vehiculo_id, employee_id, zona_operativa_id, tipo_relevo, notas, registrado_por)
          VALUES ($1,$2,$3,'manual','Custodia inicial al crear vehículo',$4)
        `, [veh.id, supId, veh.zona_operativa_id, usuario ?? "sistema"]);
      }
    }

    await client.query("COMMIT");
    res.status(201).json(veh);
  } catch (err: any) {
    await client.query("ROLLBACK");
    if (err.code === "23505") return res.status(409).json({ error: `Placa ${placa} ya está registrada` });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── PATCH /api/vehiculos/:id ──────────────────────────────────────────────────
vehiculosRouter.patch("/vehiculos/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { placa, tipo, marca, modelo, color, anio, estado, activo, zona_operativa_id, observaciones, usuario } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Obtener zona anterior
    const { rows: prevRows } = await client.query(`SELECT zona_operativa_id FROM vehiculos WHERE id=$1`, [id]);
    if (!prevRows[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "No encontrado" }); }
    const zonaAnterior = prevRows[0].zona_operativa_id;
    const zonaNueva = zona_operativa_id !== undefined ? (zona_operativa_id ? Number(zona_operativa_id) : null) : zonaAnterior;

    const { rows } = await client.query(`
      UPDATE vehiculos SET
        placa              = COALESCE($1, placa),
        tipo               = COALESCE($2, tipo),
        marca              = COALESCE($3, marca),
        modelo             = COALESCE($4, modelo),
        color              = COALESCE($5, color),
        anio               = COALESCE($6, anio),
        estado             = COALESCE($7, estado),
        activo             = COALESCE($8, activo),
        zona_operativa_id  = $9,
        observaciones      = COALESCE($10, observaciones),
        updated_at         = NOW()
      WHERE id = $11
      RETURNING *
    `, [
      placa ? placa.toUpperCase().trim() : null,
      tipo ?? null, marca ?? null, modelo ?? null, color ?? null,
      anio ? Number(anio) : null,
      estado ?? null,
      activo !== undefined ? activo : null,
      zonaNueva,
      observaciones ?? null,
      id,
    ]);

    // Si cambió la zona, transferir custodia automáticamente
    if (zonaNueva !== zonaAnterior && zonaNueva) {
      // Cerrar custodia anterior
      await client.query(
        `UPDATE vehiculo_custodia SET fecha_fin = NOW() WHERE vehiculo_id=$1 AND fecha_fin IS NULL`,
        [id]
      );
      // Buscar nuevo supervisor
      const { rows: zonaRows } = await client.query(
        `SELECT supervisor_employee_id FROM operational_zones WHERE id=$1`, [zonaNueva]
      );
      const supId = zonaRows[0]?.supervisor_employee_id;
      if (supId) {
        await client.query(`
          INSERT INTO vehiculo_custodia (vehiculo_id, employee_id, zona_operativa_id, tipo_relevo, notas, registrado_por)
          VALUES ($1,$2,$3,'automatico','Reasignación de zona',$4)
        `, [id, supId, zonaNueva, usuario ?? "sistema"]);
      }
    }

    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err: any) {
    await client.query("ROLLBACK");
    if (err.code === "23505") return res.status(409).json({ error: "Placa duplicada" });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── POST /api/vehiculos/:id/relevo ────────────────────────────────────────────
// Transfiere custodia a otro supervisor
vehiculosRouter.post("/vehiculos/:id/relevo", async (req, res) => {
  const vehiculoId = Number(req.params.id);
  const { nuevo_employee_id, zona_operativa_id, notas, tipo_relevo, usuario } = req.body;
  if (!nuevo_employee_id) return res.status(400).json({ error: "nuevo_employee_id es requerido" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Cerrar custodia actual
    await client.query(
      `UPDATE vehiculo_custodia SET fecha_fin = NOW() WHERE vehiculo_id=$1 AND fecha_fin IS NULL`,
      [vehiculoId]
    );

    // Obtener zona del vehículo si no se pasa
    let zona = zona_operativa_id ? Number(zona_operativa_id) : null;
    if (!zona) {
      const { rows: vRows } = await client.query(`SELECT zona_operativa_id FROM vehiculos WHERE id=$1`, [vehiculoId]);
      zona = vRows[0]?.zona_operativa_id ?? null;
    }

    // Crear nueva custodia
    const { rows } = await client.query(`
      INSERT INTO vehiculo_custodia (vehiculo_id, employee_id, zona_operativa_id, tipo_relevo, notas, registrado_por)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `, [
      vehiculoId,
      Number(nuevo_employee_id),
      zona,
      tipo_relevo ?? "manual",
      notas ?? null,
      usuario ?? "sistema",
    ]);

    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
