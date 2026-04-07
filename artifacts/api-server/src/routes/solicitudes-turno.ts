import { Router } from "express";
import { pool } from "@workspace/db";

export const solicitudesTurnoRouter = Router();

// GET /puestos/:id/solicitud-turno — solicitud pendiente del puesto
solicitudesTurnoRouter.get("/puestos/:id/solicitud-turno", async (req, res) => {
  const puestoId = parseInt(req.params.id);
  if (isNaN(puestoId)) return res.status(400).json({ error: "id inválido" });
  try {
    const { rows: [sol] } = await pool.query(`
      SELECT sct.*,
        t_actual.nombre AS turno_actual_nombre,
        t_nuevo.nombre  AS turno_nuevo_nombre,
        t_nuevo.num_titulares AS turno_nuevo_titulares,
        t_nuevo.tipo_ciclo    AS turno_nuevo_ciclo,
        t_nuevo.horas_trabajo AS turno_nuevo_horas
      FROM solicitudes_cambio_turno sct
      LEFT JOIN turnos t_actual ON t_actual.id = sct.turno_actual_id
      JOIN  turnos t_nuevo      ON t_nuevo.id  = sct.turno_nuevo_id
      WHERE sct.puesto_id = $1 AND sct.estado = 'pendiente'
      ORDER BY sct.created_at DESC
      LIMIT 1
    `, [puestoId]);
    res.json(sol ?? null);
  } catch (err: any) {
    res.status(500).json({ error: "Error al obtener solicitud", detail: err.message });
  }
});

// POST /puestos/:id/solicitar-turno — crear solicitud de cambio de turno
solicitudesTurnoRouter.post("/puestos/:id/solicitar-turno", async (req, res) => {
  const puestoId = parseInt(req.params.id);
  if (isNaN(puestoId)) return res.status(400).json({ error: "id inválido" });
  const { turno_nuevo_id, motivo } = req.body;
  if (!turno_nuevo_id) return res.status(400).json({ error: "turno_nuevo_id requerido" });
  const usuario: string = (req as any).user?.username ?? "admin";
  try {
    const { rows: existing } = await pool.query(
      "SELECT id FROM solicitudes_cambio_turno WHERE puesto_id = $1 AND estado = 'pendiente'",
      [puestoId]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: "Ya existe una solicitud pendiente para este puesto" });
    }
    const { rows: [puesto] } = await pool.query(
      "SELECT tipo_turno_id FROM puestos_operativos WHERE id = $1", [puestoId]
    );
    if (!puesto) return res.status(404).json({ error: "Puesto no encontrado" });

    const { rows: [sol] } = await pool.query(`
      INSERT INTO solicitudes_cambio_turno
        (puesto_id, turno_actual_id, turno_nuevo_id, estado, motivo, creado_por)
      VALUES ($1, $2, $3, 'pendiente', $4, $5)
      RETURNING *
    `, [puestoId, puesto.tipo_turno_id, turno_nuevo_id, motivo || null, usuario]);
    res.status(201).json(sol);
  } catch (err: any) {
    res.status(500).json({ error: "Error al crear solicitud", detail: err.message });
  }
});

// GET /solicitudes-turno/pendientes — listado global para panel admin
solicitudesTurnoRouter.get("/solicitudes-turno/pendientes", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT sct.*,
        po.nombre AS puesto_nombre,
        t_actual.nombre AS turno_actual_nombre,
        t_nuevo.nombre  AS turno_nuevo_nombre,
        t_nuevo.num_titulares AS turno_nuevo_titulares
      FROM solicitudes_cambio_turno sct
      JOIN  puestos_operativos po ON po.id = sct.puesto_id
      LEFT JOIN turnos t_actual ON t_actual.id = sct.turno_actual_id
      JOIN  turnos t_nuevo      ON t_nuevo.id  = sct.turno_nuevo_id
      WHERE sct.estado = 'pendiente'
      ORDER BY sct.created_at DESC
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: "Error al listar solicitudes" });
  }
});

// POST /solicitudes-turno/:id/autorizar — autorizar y aplicar cambio
solicitudesTurnoRouter.post("/solicitudes-turno/:id/autorizar", async (req, res) => {
  const solicitudId = parseInt(req.params.id);
  if (isNaN(solicitudId)) return res.status(400).json({ error: "id inválido" });
  const { notas } = req.body;
  const usuario: string = (req as any).user?.username ?? "admin";
  try {
    const { rows: [sol] } = await pool.query(`
      SELECT sct.*, t_nuevo.num_titulares, t_nuevo.tipo_ciclo, t_nuevo.horas_trabajo
      FROM solicitudes_cambio_turno sct
      JOIN turnos t_nuevo ON t_nuevo.id = sct.turno_nuevo_id
      WHERE sct.id = $1 AND sct.estado = 'pendiente'
    `, [solicitudId]);
    if (!sol) return res.status(404).json({ error: "Solicitud no encontrada o ya procesada" });

    const { puesto_id, turno_nuevo_id, num_titulares, tipo_ciclo, horas_trabajo } = sol;

    // 1. Actualizar turno del puesto
    await pool.query(
      "UPDATE puestos_operativos SET tipo_turno_id = $1, updated_at = NOW() WHERE id = $2",
      [turno_nuevo_id, puesto_id]
    );

    // 2. Obtener slots actuales ordenados
    const { rows: slots } = await pool.query(
      "SELECT * FROM puesto_slots WHERE puesto_id = $1 AND activo = TRUE ORDER BY slot_numero ASC",
      [puesto_id]
    );

    const agentesLiberados: number[] = [];

    // 3. Eliminar slots sobrantes y recolectar agentes liberados
    const extras = slots.slice(num_titulares);
    for (const slot of extras) {
      if (slot.empleado_id) agentesLiberados.push(slot.empleado_id);
      await pool.query("DELETE FROM puesto_slots WHERE id = $1", [slot.id]);
    }

    // 4. Liberar agentes al pool disponibles
    for (const empId of agentesLiberados) {
      // Limpiar agente_id en puestos_operativos si coincide
      await pool.query(
        "UPDATE puestos_operativos SET agente_id = NULL, updated_at = NOW() WHERE id = $1 AND agente_id = $2",
        [puesto_id, empId]
      );
      // Desactivar asignación operativa
      await pool.query(
        `UPDATE employee_operational_assignments
         SET activa = FALSE, updated_at = NOW()
         WHERE employee_id = $1 AND puesto_id = $2 AND activa = TRUE`,
        [empId, puesto_id]
      );
    }

    // 5. Crear slots faltantes con días por defecto
    const horasT = Math.round(Number(horas_trabajo));
    const kept   = slots.slice(0, num_titulares);
    for (let i = kept.length; i < num_titulares; i++) {
      const diasDefault: number[] = tipo_ciclo === "diario"
        ? [1,2,3,4,5,6,7,8,9,10,11,12,13,14]
        : i === 0 ? [1,3,5,7,9,11,13] : [2,4,6,8,10,12,14];
      await pool.query(`
        INSERT INTO puesto_slots (puesto_id, slot_numero, horas_turno, hora_entrada, dias_trabajo, longitud_ciclo)
        VALUES ($1, $2, $3, '07:00', $4, 14)
      `, [puesto_id, i + 1, horasT, diasDefault]);
    }

    // 6. Marcar solicitud como autorizada
    await pool.query(`
      UPDATE solicitudes_cambio_turno
      SET estado = 'autorizado', autorizado_por = $1, notas = $2, fecha_autorizacion = NOW(), updated_at = NOW()
      WHERE id = $3
    `, [usuario, notas || null, solicitudId]);

    res.json({
      ok: true,
      agentes_liberados: agentesLiberados.length,
      slots_eliminados:  extras.length,
      slots_creados:     Math.max(0, num_titulares - kept.length),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Error al autorizar solicitud", detail: err.message });
  }
});

// POST /solicitudes-turno/:id/rechazar
solicitudesTurnoRouter.post("/solicitudes-turno/:id/rechazar", async (req, res) => {
  const solicitudId = parseInt(req.params.id);
  if (isNaN(solicitudId)) return res.status(400).json({ error: "id inválido" });
  const { notas } = req.body;
  const usuario: string = (req as any).user?.username ?? "admin";
  try {
    const { rowCount } = await pool.query(`
      UPDATE solicitudes_cambio_turno
      SET estado = 'rechazado', autorizado_por = $1, notas = $2, fecha_autorizacion = NOW(), updated_at = NOW()
      WHERE id = $3 AND estado = 'pendiente'
    `, [usuario, notas || null, solicitudId]);
    if (!rowCount) return res.status(404).json({ error: "Solicitud no encontrada o ya procesada" });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "Error al rechazar solicitud" });
  }
});
