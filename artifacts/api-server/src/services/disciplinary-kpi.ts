/**
 * disciplinary-kpi.ts
 * ────────────────────────────────────────────────────────
 * Cálculo dinámico del KPI disciplinario de un empleado.
 *
 * LÓGICA DE SCORE:
 *  - Base: 100 puntos
 *  - Falta (no anulada):       −10 puntos c/u
 *  - Suspensión (no anulada):  −20 puntos c/u
 *  - Mínimo: 0 puntos
 *
 * CLASIFICACIÓN VISUAL:
 *  - 90–100 → Excelente (verde)
 *  - 70–89  → Regular (amarillo)
 *  - < 70   → Riesgo (rojo)
 *
 * NIVEL DE RIESGO:
 *  - alto:   score < 70  | faltas_30d >= 3 | suspensiones_total > 0
 *  - medio:  score < 90  | faltas_30d >= 2 | faltas_90d >= 3
 *  - bajo:   resto
 *
 * ALERTAS AUTOMÁTICAS:
 *  - 3+ faltas en 30 días → alerta_30d
 *  - 5+ faltas en total   → sugerencia_suspension
 *  - 1+ suspensión activa → alerta_suspension
 */

import { pool } from "@workspace/db";

export interface EventoKPI {
  id: number;
  tipoEvento: string;
  fecha: string;
  estado: string;
  anulado: boolean;
  clienteNombre: string | null;
  puestoNombre: string | null;
  supervisorNombre: string | null;
  observaciones: string | null;
}

export interface KPIDisciplinario {
  score: number;
  clasificacion: "excelente" | "regular" | "riesgo";
  nivelRiesgo: "bajo" | "medio" | "alto";
  totalFaltas: number;
  totalSuspensiones: number;
  faltas30d: number;
  faltas90d: number;
  suspensiones90d: number;
  tendencia: "sube" | "baja" | "estable";
  alertas: string[];
  eventos: EventoKPI[];
}

export async function calcularKPIDisciplinario(employeeId: number): Promise<KPIDisciplinario> {
  const { rows } = await pool.query<{
    id: number;
    tipo_evento: string;
    fecha: string;
    estado: string;
    anulado_por: string | null;
    cliente_nombre: string | null;
    puesto_nombre: string | null;
    supervisor_nombre: string | null;
    observaciones: string | null;
  }>(
    `SELECT id, tipo_evento, fecha, estado, anulado_por,
            cliente_nombre, puesto_nombre, supervisor_nombre, observaciones
     FROM eventos_rrhh
     WHERE employee_id = $1
     ORDER BY fecha DESC`,
    [employeeId],
  );

  const ahora = new Date();
  const hace30 = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
  const hace90 = new Date(ahora.getTime() - 90 * 24 * 60 * 60 * 1000);

  const eventos: EventoKPI[] = rows.map((r) => ({
    id: r.id,
    tipoEvento: r.tipo_evento,
    fecha: r.fecha,
    estado: r.estado,
    anulado: !!r.anulado_por,
    clienteNombre: r.cliente_nombre,
    puestoNombre: r.puesto_nombre,
    supervisorNombre: r.supervisor_nombre,
    observaciones: r.observaciones,
  }));

  const activos = eventos.filter((e) => !e.anulado);

  const totalFaltas       = activos.filter((e) => e.tipoEvento === "falta").length;
  const totalSuspensiones = activos.filter((e) => e.tipoEvento === "suspension").length;
  const faltas30d         = activos.filter((e) => e.tipoEvento === "falta" && new Date(e.fecha) >= hace30).length;
  const faltas90d         = activos.filter((e) => e.tipoEvento === "falta" && new Date(e.fecha) >= hace90).length;
  const suspensiones90d   = activos.filter((e) => e.tipoEvento === "suspension" && new Date(e.fecha) >= hace90).length;

  // Score
  const score = Math.max(0, 100 - totalFaltas * 10 - totalSuspensiones * 20);

  // Clasificación visual
  const clasificacion: KPIDisciplinario["clasificacion"] =
    score >= 90 ? "excelente" : score >= 70 ? "regular" : "riesgo";

  // Nivel de riesgo
  let nivelRiesgo: KPIDisciplinario["nivelRiesgo"] = "bajo";
  if (score < 70 || faltas30d >= 3 || totalSuspensiones > 0) {
    nivelRiesgo = "alto";
  } else if (score < 90 || faltas30d >= 2 || faltas90d >= 3) {
    nivelRiesgo = "medio";
  }

  // Tendencia: comparar faltas últimos 30d vs 30–60d
  const hace60 = new Date(ahora.getTime() - 60 * 24 * 60 * 60 * 1000);
  const faltas30a60 = activos.filter(
    (e) => e.tipoEvento === "falta" && new Date(e.fecha) >= hace60 && new Date(e.fecha) < hace30,
  ).length;

  let tendencia: KPIDisciplinario["tendencia"] = "estable";
  if (faltas30d > faltas30a60) tendencia = "sube";
  else if (faltas30d < faltas30a60) tendencia = "baja";

  // Alertas automáticas
  const alertas: string[] = [];
  if (faltas30d >= 3) {
    alertas.push(`${faltas30d} faltas en los últimos 30 días — alerta de reincidencia`);
  }
  if (totalFaltas >= 5) {
    alertas.push(`${totalFaltas} faltas acumuladas — se sugiere considerar suspensión`);
  }
  if (totalSuspensiones > 0) {
    alertas.push(`${totalSuspensiones} suspensión(es) registrada(s) en el historial`);
  }

  return {
    score,
    clasificacion,
    nivelRiesgo,
    totalFaltas,
    totalSuspensiones,
    faltas30d,
    faltas90d,
    suspensiones90d,
    tendencia,
    alertas,
    eventos,
  };
}
