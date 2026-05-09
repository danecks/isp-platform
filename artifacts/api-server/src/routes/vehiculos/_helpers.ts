import { pool } from "@workspace/db";
import { calcularEstadoCiclo } from "../../lib/turno-calc";

export async function calcularResponsableTurno(zonaId: number, fecha: string): Promise<any | null> {
  const { rows } = await pool.query(`
    SELECT
      e.id, e.nombre_completo, e.tipo_personal,
      t.id AS tipo_turno_id, t.nombre AS turno_nombre,
      t.tipo_ciclo, t.horas_trabajo, t.horas_descanso,
      eoa.fecha_inicio AS fecha_inicio_ciclo
    FROM employee_operational_assignments eoa
    JOIN employees e ON e.id = eoa.employee_id
    LEFT JOIN turnos t ON t.id = eoa.tipo_turno_id
    WHERE eoa.zona_operativa_id = $1
      AND eoa.activa = TRUE
      AND e.estado_laboral = 'activo'
      AND e.tipo_personal IN ('supervisor','jefe_servicio')
    ORDER BY e.nombre_completo
  `, [zonaId]);

  for (const sv of rows) {
    if (!sv.tipo_ciclo || !sv.horas_trabajo || !sv.fecha_inicio_ciclo) continue;
    const turno = {
      id: sv.tipo_turno_id ?? 0, nombre: sv.turno_nombre ?? "",
      tipo_ciclo: sv.tipo_ciclo,
      horas_trabajo:  Number(sv.horas_trabajo),
      horas_descanso: Number(sv.horas_descanso ?? sv.horas_trabajo),
    };
    const fechaStr = sv.fecha_inicio_ciclo instanceof Date
      ? sv.fecha_inicio_ciclo.toISOString().slice(0, 10)
      : String(sv.fecha_inicio_ciclo).slice(0, 10);
    const estado = calcularEstadoCiclo(turno, fechaStr, fecha);
    if (estado.trabaja) return sv;
  }
  return null;
}

// ── Función utilitaria: sincroniza la custodia de un vehículo (sin HTTP) ──────
export async function syncCustodiaVehiculo(
  vehiculoId: number, fecha: string, usuario: string
): Promise<any> {
  const { rows: vRows } = await pool.query(
    `SELECT id, placa, zona_operativa_id FROM vehiculos WHERE id=$1`, [vehiculoId]
  );
  if (!vRows[0]) return { cambio: false, motivo: "Vehículo no encontrado" };
  const zona_id = vRows[0].zona_operativa_id;
  if (!zona_id) return { cambio: false, placa: vRows[0].placa, motivo: "Sin zona asignada" };

  const responsable = await calcularResponsableTurno(zona_id, fecha);

  const { rows: custodiaRows } = await pool.query(
    `SELECT id, employee_id FROM vehiculo_custodia WHERE vehiculo_id=$1 AND fecha_fin IS NULL`,
    [vehiculoId]
  );
  const custodiaActual = custodiaRows[0] ?? null;

  const mismoResponsable = custodiaActual && responsable
    && Number(custodiaActual.employee_id) === Number(responsable.id);

  if (mismoResponsable) {
    return {
      cambio: false, placa: vRows[0].placa,
      motivo: "El responsable de turno ya coincide con la custodia actual",
      responsable_actual: { id: responsable.id, nombre: responsable.nombre_completo },
    };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (custodiaActual) {
      await client.query(
        `UPDATE vehiculo_custodia SET fecha_fin=NOW()
         WHERE id=$1`,
        [custodiaActual.id]
      );
    }
    let nuevaCustodia: any = null;
    if (responsable) {
      const { rows: nc } = await client.query(`
        INSERT INTO vehiculo_custodia
          (vehiculo_id, employee_id, zona_operativa_id, tipo_relevo, notas, registrado_por)
        VALUES ($1,$2,$3,'automatico_turno',$4,$5)
        RETURNING *
      `, [
        vehiculoId, responsable.id, zona_id,
        `Custodia automática por turno — ${fecha}`, usuario,
      ]);
      nuevaCustodia = nc[0];
    }
    await client.query("COMMIT");
    return {
      cambio: true, placa: vRows[0].placa,
      responsable_nuevo: responsable
        ? { id: responsable.id, nombre: responsable.nombre_completo }
        : null,
      sin_responsable: !responsable,
      nueva_custodia: nuevaCustodia,
    };
  } catch (e: any) {
    await client.query("ROLLBACK").catch(() => {});
    return { cambio: false, placa: vRows[0].placa, error: e.message };
  } finally {
    client.release();
  }
}

// ── POST /api/vehiculos/sync-custodias ────────────────────────────────────────
// Sincroniza TODOS los vehículos con zona asignada para la fecha indicada.
