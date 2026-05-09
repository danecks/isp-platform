import { Router } from "express";
import { pool } from "@workspace/db";
import { calcularEstadoCiclo } from "../../lib/turno-calc";
import { calcularResponsableTurno, syncCustodiaVehiculo } from "./_helpers";

export const vehiculosCustodiaRouter = Router();

vehiculosCustodiaRouter.get("/vehiculos/zona/:zonaId/supervisores-turno", async (req, res) => {
  const zonaId = Number(req.params.zonaId);
  const fecha  = (req.query.fecha as string) || new Date().toISOString().slice(0, 10);

  try {
    // Todos los supervisores/jefes de servicio asignados a esta zona vía eoa
    const { rows } = await pool.query(`
      SELECT
        e.id,
        e.nombre_completo,
        e.tipo_personal,
        e.telefono,
        e.estado_laboral,
        t.id             AS tipo_turno_id,
        t.nombre         AS turno_nombre,
        t.tipo_ciclo,
        t.horas_trabajo,
        t.horas_descanso,
        eoa.fecha_inicio AS fecha_inicio_ciclo
      FROM employee_operational_assignments eoa
      JOIN employees e ON e.id = eoa.employee_id
      LEFT JOIN turnos t ON t.id = eoa.tipo_turno_id
      WHERE eoa.zona_operativa_id = $1
        AND eoa.activa = TRUE
        AND e.estado_laboral IN ('activo')
        AND e.tipo_personal IN ('supervisor','jefe_servicio')
      ORDER BY e.nombre_completo
    `, [zonaId]);

    // Aplicar motor de ciclos a cada supervisor
    const enriquecidos = rows.map((sv: any) => {
      if (!sv.tipo_ciclo || !sv.horas_trabajo || !sv.fecha_inicio_ciclo) {
        return { ...sv, trabaja_hoy: null, estado_ciclo: "sin_turno" };
      }
      const turnoObj = {
        id: sv.tipo_turno_id ?? 0,
        nombre: sv.turno_nombre ?? "",
        tipo_ciclo: sv.tipo_ciclo,
        horas_trabajo:  Number(sv.horas_trabajo),
        horas_descanso: Number(sv.horas_descanso ?? sv.horas_trabajo),
      };
      const fechaStr = sv.fecha_inicio_ciclo instanceof Date
        ? sv.fecha_inicio_ciclo.toISOString().slice(0, 10)
        : String(sv.fecha_inicio_ciclo).slice(0, 10);

      const estado = calcularEstadoCiclo(turnoObj, fechaStr, fecha);
      return {
        ...sv,
        trabaja_hoy:  estado.trabaja,
        estado_ciclo: estado.trabaja
          ? "trabajando"
          : (estado.disponibleHE ? "disponible_he" : "descansando"),
      };
    });

    // El responsable actual es el que trabaja hoy (primer match)
    const responsableActual = enriquecidos.find((s: any) => s.trabaja_hoy) ?? null;

    res.json({
      zona_id:           zonaId,
      fecha,
      responsable_actual: responsableActual,
      supervisores:       enriquecidos,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/vehiculos/:id/sync-custodia ─────────────────────────────────────
// Sincroniza la custodia de UN vehículo con el supervisor que trabaja HOY en su zona.
vehiculosCustodiaRouter.post("/vehiculos/:id/sync-custodia", async (req, res) => {
  const vehiculoId = Number(req.params.id);
  const fecha   = (req.body.fecha as string) || new Date().toISOString().slice(0, 10);
  const usuario = (req.body.usuario as string) || "sistema";
  try {
    const resultado = await syncCustodiaVehiculo(vehiculoId, fecha, usuario);
    if (resultado.motivo === "Vehículo no encontrado") return res.status(404).json(resultado);
    res.json(resultado);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


vehiculosCustodiaRouter.post("/vehiculos/sync-custodias", async (req, res) => {
  const fecha   = (req.body.fecha as string) || new Date().toISOString().slice(0, 10);
  const usuario = (req.body.usuario as string) || "sistema";

  try {
    const { rows: vehiculos } = await pool.query(
      `SELECT id FROM vehiculos WHERE activo=TRUE AND zona_operativa_id IS NOT NULL`
    );
    const resultados = await Promise.all(
      vehiculos.map((v: any) => syncCustodiaVehiculo(v.id, fecha, usuario))
    );
    const cambios = resultados.filter((r: any) => r.cambio).length;
    res.json({ fecha, total: vehiculos.length, cambios, resultados });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/vehiculos/:id/relevo ────────────────────────────────────────────
// Transfiere custodia a otro supervisor (relevo manual, override excepcional)
vehiculosCustodiaRouter.post("/vehiculos/:id/relevo", async (req, res) => {
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
