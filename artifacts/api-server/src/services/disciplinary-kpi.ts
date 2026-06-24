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

export interface Cobertura {
  /** Persona (con HE) que cubrió la falta. employee_id null = agente externo. */
  cubridorId: number | null;
  cubridorNombre: string;
  /** Horas extra de cobertura (planilla). Null si solo se pagó en efectivo sin horas. */
  horas: number | null;
  /** Monto pagado en efectivo (Q). Null si la HE fue por planilla. */
  monto: number | null;
  /** Evento RRHH de horas_extra correspondiente (para enlazar). Null si solo efectivo. */
  heEventoId: number | null;
}

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
  /** Solo en faltas: quién(es) la cubrió(eron) y cuánto/cuántas horas. */
  coberturas?: Cobertura[];
}

/**
 * Resuelve, para un conjunto de faltas (eventos_rrhh.id), quién las cubrió.
 * Usa SOLO los enlaces durables — no el fallback por puesto+fecha — para no atribuir
 * coberturas a faltas equivocadas:
 *  - HE de planilla: eventos_rrhh(tipo='horas_extra').evento_par_id → falta.
 *  - HE en efectivo: incentivos_cash_cobertura(tipo='he_efectivo').evento_falta_id → falta.
 * Misma persona con horas (planilla) y monto (efectivo) se fusiona en una fila.
 */
async function resolverCoberturasPorFalta(
  faltaIds: number[],
): Promise<Map<number, Cobertura[]>> {
  const mapa = new Map<number, Cobertura[]>();
  if (faltaIds.length === 0) return mapa;

  const { rows } = await pool.query<{
    falta_id: number;
    he_evento_id: number | null;
    cubridor_id: number | null;
    cubridor_nombre: string | null;
    horas: string | null;
    monto: string | null;
  }>(
    `SELECT
        he.evento_par_id   AS falta_id,
        he.id              AS he_evento_id,
        he.employee_id     AS cubridor_id,
        he.employee_nombre AS cubridor_nombre,
        he.cantidad_horas  AS horas,
        NULL::numeric      AS monto
      FROM eventos_rrhh he
      WHERE he.tipo_evento = 'horas_extra'
        AND he.evento_par_id = ANY($1::int[])
        AND he.estado NOT IN ('anulado','cancelado')

      UNION ALL

      SELECT
        ic.evento_falta_id AS falta_id,
        NULL::int          AS he_evento_id,
        ic.employee_id     AS cubridor_id,
        ic.employee_nombre AS cubridor_nombre,
        NULL::numeric      AS horas,
        ic.monto::numeric  AS monto
      FROM incentivos_cash_cobertura ic
      WHERE ic.tipo = 'he_efectivo'
        AND ic.estado <> 'cancelado'
        AND ic.evento_falta_id = ANY($1::int[])`,
    [faltaIds],
  );

  for (const r of rows) {
    const faltaId = r.falta_id;
    if (faltaId == null) continue;
    const nombre = (r.cubridor_nombre ?? "").trim() || "Agente externo";
    const claveCubridor = r.cubridor_id != null ? `id:${r.cubridor_id}` : `nom:${nombre.toLowerCase()}`;
    const lista = mapa.get(faltaId) ?? [];
    const horas = r.horas != null ? Number(r.horas) : null;
    const monto = r.monto != null ? Number(r.monto) : null;

    // Fusiona horas (planilla) + monto (efectivo) de la misma persona en una fila.
    const existente = lista.find(
      (c) => (c.cubridorId != null ? `id:${c.cubridorId}` : `nom:${c.cubridorNombre.toLowerCase()}`) === claveCubridor,
    );
    if (existente) {
      if (horas != null) existente.horas = (existente.horas ?? 0) + horas;
      if (monto != null) existente.monto = (existente.monto ?? 0) + monto;
      if (existente.heEventoId == null && r.he_evento_id != null) existente.heEventoId = r.he_evento_id;
    } else {
      lista.push({
        cubridorId: r.cubridor_id,
        cubridorNombre: nombre,
        horas,
        monto,
        heEventoId: r.he_evento_id,
      });
    }
    mapa.set(faltaId, lista);
  }

  return mapa;
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

  // Enriquecer faltas con quién las cubrió (HE planilla y/o efectivo).
  const faltaIds = eventos.filter((e) => e.tipoEvento === "falta").map((e) => e.id);
  if (faltaIds.length > 0) {
    const coberturasPorFalta = await resolverCoberturasPorFalta(faltaIds);
    for (const ev of eventos) {
      if (ev.tipoEvento !== "falta") continue;
      const cobs = coberturasPorFalta.get(ev.id);
      if (cobs && cobs.length > 0) ev.coberturas = cobs;
    }
  }

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
