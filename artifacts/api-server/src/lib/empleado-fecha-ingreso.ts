/**
 * empleado-fecha-ingreso.ts
 *
 * Helper compartido para validar que un colaborador YA inició labores antes de
 * permitir asignarlo a puestos, slots, custodias, segmentos o titularidades.
 *
 * Regla de negocio:
 *   - Un colaborador con fecha_ingreso > fecha_objetivo NO debe poder ser
 *     asignado operativamente para esa fecha. Aún no inició según contrato.
 *   - Si la asignación se permitiera, al cerrar el día se le generaría día
 *     trabajado (vía segmentos) o día titular (vía slots/titulares), pagando
 *     un día que no corresponde.
 *
 * Uso típico:
 *   const v = await validarEmpleadoAsignable(pool, employeeId, fechaISO);
 *   if (!v.ok) return res.status(400).json({ error: v.error });
 */

import type { Pool, PoolClient } from "pg";

export interface ValidacionEmpleadoAsignable {
  ok: boolean;
  error?: string;
  /** Fecha de ingreso del empleado en formato YYYY-MM-DD. Solo presente si la BD la tiene. */
  fechaIngreso?: string | null;
  /** Nombre del empleado para mensajes legibles. Solo presente si se encontró el empleado. */
  nombre?: string | null;
}

type DbExec = Pool | PoolClient;

/**
 * Valida que el empleado pueda ser asignado operativamente para la fecha dada.
 *
 * @param db        pool o client de PG (acepta ambos para uso dentro de transacciones)
 * @param employeeId  id del empleado a validar
 * @param fechaISO    fecha objetivo en formato YYYY-MM-DD (la fecha del puesto/segmento/slot)
 * @returns { ok: true } si puede asignarse, { ok: false, error } si su fecha_ingreso es posterior
 *
 * Devuelve ok=true en estos casos seguros:
 *   - El empleado no tiene fecha_ingreso registrada (legacy / dato faltante).
 *   - La fecha de ingreso es <= fecha objetivo.
 *
 * Devuelve ok=false con mensaje claro si la fecha de ingreso es futura respecto al objetivo.
 */
export async function validarEmpleadoAsignable(
  db: DbExec,
  employeeId: number | string,
  fechaISO: string,
): Promise<ValidacionEmpleadoAsignable> {
  const empId = Number(employeeId);
  if (!Number.isFinite(empId) || empId <= 0) {
    return { ok: false, error: "ID de colaborador inválido" };
  }
  if (!fechaISO || typeof fechaISO !== "string") {
    return { ok: false, error: "Fecha objetivo inválida" };
  }

  const { rows } = await db.query(
    `SELECT nombre_completo,
            TO_CHAR(fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso_iso,
            (fecha_ingreso > $2::date)            AS aun_no_inicia
       FROM employees
      WHERE id = $1`,
    [empId, fechaISO]
  );

  if (rows.length === 0) {
    return { ok: false, error: "Colaborador no encontrado" };
  }

  const r = rows[0];
  const nombre = r.nombre_completo ?? null;
  const fechaIngreso = r.fecha_ingreso_iso ?? null;

  if (r.aun_no_inicia === true) {
    const fechaBonita = formatearFechaCorta(fechaIngreso);
    return {
      ok: false,
      error: `${nombre ?? "El colaborador"} inicia el ${fechaBonita}. No es posible asignarle puestos, custodias o coberturas con fechas anteriores a su ingreso.`,
      fechaIngreso,
      nombre,
    };
  }

  return { ok: true, fechaIngreso, nombre };
}

/**
 * Formatea una fecha ISO (YYYY-MM-DD) a un texto legible en español: "30 abr 2026".
 * Devuelve la propia cadena si no se puede formatear.
 */
function formatearFechaCorta(fechaISO: string | null): string {
  if (!fechaISO) return "(sin fecha)";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaISO);
  if (!m) return fechaISO;
  const meses = ["ene", "feb", "mar", "abr", "may", "jun",
                 "jul", "ago", "sep", "oct", "nov", "dic"];
  const mi = Math.max(0, Math.min(11, parseInt(m[2], 10) - 1));
  const dia = String(parseInt(m[3], 10));
  return `${dia} ${meses[mi]} ${m[1]}`;
}
