/**
 * LIQUIDACIÓN ACUMULADA — Estimación de la liquidación a la fecha
 *
 * Calcula cuánto tiene "ganado" un colaborador HOY si se fuera (renuncia):
 *   aguinaldo proporcional + bono 14 proporcional + vacaciones acumuladas.
 *
 * Se usa como BASE de la garantía para el tope de anticipos. Por eso se toma
 * la causal "renuncia" (lo que el colaborador recibe seguro si se va por su
 * cuenta): NO incluye indemnización, que solo aplica en despido injustificado.
 *
 * Reutiliza las mismas funciones de cálculo y el mismo criterio de días de
 * vacaciones del ciclo vigente que la pantalla de prestaciones, para que el
 * número sea coherente con el resto del sistema.
 */

import { pool } from "@workspace/db";
import {
  calcularAguinaldo,
  calcularBono14,
  calcularVacacionesPago,
  periodoAguinaldoGuatemala,
  periodoBono14Guatemala,
} from "../lib/prestaciones-calc";

// Fecha efectiva de prestaciones: misma lógica que routes/prestaciones.ts.
// Si el colaborador fue asignado a un contrato sin período de prueba dentro
// del primer mes, cuenta desde su ingreso; si no, desde fecha_inicio_prestaciones.
const FECHA_PRESTACIONES_SQL = `
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM puesto_titulares pt_p
      JOIN puestos_operativos po_p ON po_p.id = pt_p.puesto_id
      JOIN clients cl_p ON cl_p.id = po_p.cliente_id
      WHERE pt_p.employee_id = e.id
        AND pt_p.activo = TRUE
        AND cl_p.contrato_sin_prueba = TRUE
        AND e.fecha_ingreso IS NOT NULL
        AND pt_p.created_at >= e.fecha_ingreso
        AND pt_p.created_at <= (e.fecha_ingreso + INTERVAL '1 month')
    )
    THEN e.fecha_ingreso
    ELSE COALESCE(e.fecha_inicio_prestaciones, e.fecha_ingreso)
  END
`;

export interface LiquidacionAcumulada {
  computable: boolean;       // false si falta fecha de ingreso o sueldo
  total: number;             // aguinaldo + bono14 + vacaciones
  aguinaldo: number;
  bono14: number;
  vacaciones: number;
  diasVacaciones: number;
  sueldoMensual: number;
  fechaIngreso: string | null;
  fechaCorte: string;
}

const VACIO = (corte: string): LiquidacionAcumulada => ({
  computable: false,
  total: 0,
  aguinaldo: 0,
  bono14: 0,
  vacaciones: 0,
  diasVacaciones: 0,
  sueldoMensual: 0,
  fechaIngreso: null,
  fechaCorte: corte,
});

export async function calcularLiquidacionAcumulada(
  employeeId: number,
  fechaCorte?: string
): Promise<LiquidacionAcumulada> {
  const corte = fechaCorte ?? new Date().toISOString().slice(0, 10);

  const { rows } = await pool.query(
    `SELECT (${FECHA_PRESTACIONES_SQL})::text AS fecha_ingreso, e.sueldo_base
       FROM employees e WHERE e.id = $1`,
    [employeeId]
  );
  const emp = rows[0];
  if (!emp || !emp.fecha_ingreso) return VACIO(corte);

  const sueldo = parseFloat(emp.sueldo_base);
  if (!isFinite(sueldo) || sueldo <= 0) return VACIO(corte);

  const fechaIngreso = String(emp.fecha_ingreso).slice(0, 10);
  const anoPago = new Date(corte).getUTCFullYear();
  const aguPeriodo = periodoAguinaldoGuatemala(anoPago);
  const b14Periodo = periodoBono14Guatemala(anoPago);

  const aguinaldo = calcularAguinaldo({
    sueldoMensual: sueldo,
    fechaIngreso,
    periodoInicio: aguPeriodo.inicio,
    periodoFin: aguPeriodo.fin,
    fechaEgreso: corte,
  }).montoTotal;

  const bono14 = calcularBono14({
    sueldoMensual: sueldo,
    fechaIngreso,
    periodoInicio: b14Periodo.inicio,
    periodoFin: b14Periodo.fin,
    fechaEgreso: corte,
  }).montoTotal;

  // Días de vacaciones disponibles del ciclo vigente (mismo criterio que la
  // pantalla de vacaciones: desde el corte por empleado o el inicio del último
  // ciclo cumplido, sin arrastrar años ya pagados).
  const { rows: vacRows } = await pool.query(
    `WITH base AS (
       SELECT LEAST(
         GREATEST(
           COALESCE(
             e.vacaciones_pagadas_hasta,
             (e.fecha_ingreso + (
               GREATEST(EXTRACT(YEAR FROM AGE($2::date, e.fecha_ingreso::date))::int - 1, 0)
               || ' years')::interval)::date
           ),
           e.fecha_ingreso::date
         ),
         $2::date
       ) AS vac_desde
       FROM employees e WHERE e.id = $1
     )
     SELECT GREATEST(0,
       GREATEST(0, ROUND(($2::date - b.vac_desde)::numeric / 365.0 * 15))::int
       - COALESCE((
           SELECT SUM(
             (SELECT COUNT(*)::int
              FROM generate_series(er.fecha::date, COALESCE(er.fecha_fin::date, er.fecha::date), '1 day'::interval) g(d)
              WHERE EXTRACT(DOW FROM g.d) != 0)
           )
           FROM eventos_rrhh er
           WHERE er.employee_id = $1
             AND er.tipo_evento = 'vacaciones'
             AND er.estado NOT IN ('anulado', 'cancelado')
             AND er.fecha::date >= b.vac_desde
             AND er.fecha::date <= $2::date
         ), 0)::int
     )::int AS dias_disponibles
     FROM base b`,
    [employeeId, corte]
  );
  const diasVac = parseInt(String(vacRows[0]?.dias_disponibles ?? 0)) || 0;
  const vacaciones = calcularVacacionesPago({
    sueldoMensual: sueldo,
    diasVacaciones: diasVac,
  }).montoPago;

  const total = parseFloat((aguinaldo + bono14 + vacaciones).toFixed(2));

  return {
    computable: true,
    total,
    aguinaldo,
    bono14,
    vacaciones,
    diasVacaciones: diasVac,
    sueldoMensual: sueldo,
    fechaIngreso,
    fechaCorte: corte,
  };
}
