import { Router } from "express";
import { pool } from "@workspace/db";

export const solicitudesEliminacionRouter = Router();

// Mapa entidad → tabla real en la BD
const ENTIDAD_TABLA: Record<string, string> = {
  arma:                "armas",
  vehiculo:            "vehiculos",
  empleado:            "employees",
  cliente:             "clients",
  puesto:              "puestos_operativos",
  bodega_categoria:    "bodega_categorias",
  bodega_articulo:     "bodega_articulos",
  turno:               "turnos",
  incidencia:          "incidents",
};

// ── POST /api/solicitudes-eliminacion ─────────────────────────────────────────
solicitudesEliminacionRouter.post("/solicitudes-eliminacion", async (req, res) => {
  const { entidad, entidad_id, entidad_descripcion, motivo, solicitante_username } = req.body;
  if (!entidad || !entidad_id || !entidad_descripcion || !motivo || !solicitante_username) {
    return res.status(400).json({ error: "Todos los campos son requeridos" });
  }
  if (motivo.trim().length < 10) {
    return res.status(400).json({ error: "El motivo debe tener al menos 10 caracteres" });
  }
  try {
    const { rows } = await pool.query(`
      INSERT INTO solicitudes_eliminacion
        (entidad, entidad_id, entidad_descripcion, motivo, solicitante_username, estado)
      VALUES ($1, $2, $3, $4, $5, 'pendiente')
      RETURNING *
    `, [
      entidad.trim(),
      Number(entidad_id),
      entidad_descripcion.trim(),
      motivo.trim(),
      solicitante_username.trim(),
    ]);
    res.status(201).json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/solicitudes-eliminacion ──────────────────────────────────────────
solicitudesEliminacionRouter.get("/solicitudes-eliminacion", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM solicitudes_eliminacion
      ORDER BY created_at DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/solicitudes-eliminacion/:id ────────────────────────────────────
solicitudesEliminacionRouter.patch("/solicitudes-eliminacion/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { estado, revisado_por } = req.body;
  if (!["aprobada", "rechazada"].includes(estado)) {
    return res.status(400).json({ error: "Estado inválido" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Obtener la solicitud
    const { rows: solRows } = await client.query(
      `SELECT * FROM solicitudes_eliminacion WHERE id = $1`,
      [id]
    );
    if (!solRows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }
    const sol = solRows[0];

    if (sol.estado !== "pendiente") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Esta solicitud ya fue procesada" });
    }

    // 2. Actualizar estado de la solicitud
    const { rows } = await client.query(`
      UPDATE solicitudes_eliminacion
      SET estado = $1, revisado_por = $2, revisado_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [estado, revisado_por || null, id]);

    // 3. Si aprobada → eliminar el registro real
    if (estado === "aprobada") {
      const tabla = ENTIDAD_TABLA[sol.entidad];
      if (!tabla) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `Entidad desconocida: ${sol.entidad}` });
      }

      // Columna PK según tabla
      const pkCol = sol.entidad === "empleado" ? "id" : "id";
      await client.query(
        `DELETE FROM ${tabla} WHERE id = $1`,
        [sol.entidad_id]
      );
    }

    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
