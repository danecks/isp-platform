import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../../lib/logger";

export const asignacionesRecursosRouter = Router();

// GET /api/operaciones/recursos-puesto/:puestoId
// Devuelve la asignación unificada de recursos para un puesto operativo:
// arma asignada al puesto + vehículo del titular (si tiene custodia activa) +
// unidades de bodega asignadas al puesto o a alguno de sus titulares.
asignacionesRecursosRouter.get("/operaciones/recursos-puesto/:puestoId", async (req, res) => {
  const puestoId = Number(req.params.puestoId);
  if (!Number.isFinite(puestoId)) return res.status(400).json({ error: "puestoId inválido" });

  try {
    const { rows: puestoRows } = await pool.query(
      `SELECT id, nombre, cliente_nombre, titular_employee_id, agente_id, zona_operativa_id
       FROM puestos_operativos WHERE id=$1`,
      [puestoId],
    );
    if (puestoRows.length === 0) return res.status(404).json({ error: "Puesto no encontrado" });
    const puesto = puestoRows[0];

    const { rows: titularesRows } = await pool.query(
      `SELECT empleado_id AS employee_id FROM puesto_slots
        WHERE puesto_id=$1 AND activo=TRUE AND empleado_id IS NOT NULL
       UNION
       SELECT employee_id FROM puesto_titulares WHERE puesto_id=$1 AND activo=TRUE`,
      [puestoId],
    );
    const titularIds: number[] = titularesRows
      .map((r: any) => Number(r.employee_id))
      .filter((id: number) => Number.isFinite(id));
    if (puesto.titular_employee_id) titularIds.push(Number(puesto.titular_employee_id));
    const empleadoIds = Array.from(new Set(titularIds));

    const { rows: armaRows } = await pool.query(
      `SELECT id, codigo, tipo, marca, modelo, serie, estado
       FROM armas
       WHERE puesto_id=$1 AND activo=TRUE
       ORDER BY id LIMIT 1`,
      [puestoId],
    );

    let vehiculo: any = null;
    if (empleadoIds.length > 0) {
      const { rows: vehRows } = await pool.query(
        `SELECT v.id, v.placa, v.marca, v.modelo, v.tipo, vc.employee_id, vc.fecha_inicio
         FROM vehiculo_custodia vc
         JOIN vehiculos v ON v.id = vc.vehiculo_id
         WHERE vc.fecha_fin IS NULL AND vc.employee_id = ANY($1::int[])
         ORDER BY vc.fecha_inicio DESC
         LIMIT 1`,
        [empleadoIds],
      );
      vehiculo = vehRows[0] ?? null;
    }

    const { rows: equipoRows } = await pool.query(
      `SELECT u.id, u.numero_serie, u.condicion, u.estado, u.puesto_id, u.employee_id,
              a.nombre AS articulo_nombre, c.nombre AS categoria_nombre
       FROM bodega_unidades u
       JOIN bodega_articulos a ON a.id = u.articulo_id
       LEFT JOIN bodega_categorias c ON c.id = a.categoria_id
       WHERE u.estado IN ('asignado_puesto', 'asignado_colaborador')
         AND (u.puesto_id = $1 ${empleadoIds.length > 0 ? "OR u.employee_id = ANY($2::int[])" : ""})
       ORDER BY c.nombre, a.nombre`,
      empleadoIds.length > 0 ? [puestoId, empleadoIds] : [puestoId],
    );

    res.json({
      puesto: {
        id: puesto.id,
        nombre: puesto.nombre,
        cliente_nombre: puesto.cliente_nombre,
        titular_employee_id: puesto.titular_employee_id,
        agente_id: puesto.agente_id,
        zona_operativa_id: puesto.zona_operativa_id,
      },
      arma: armaRows[0] ?? null,
      vehiculo,
      equipos: equipoRows,
      empleados_asociados: empleadoIds,
    });
  } catch (err) {
    logger.error({ err, puestoId }, "GET /operaciones/recursos-puesto error");
    res.status(500).json({ error: "Error al consultar recursos del puesto" });
  }
});
