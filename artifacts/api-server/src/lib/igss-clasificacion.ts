/**
 * lib/igss-clasificacion.ts
 *
 * Fuente única para clasificar la elegibilidad IGSS de un colaborador en un
 * período. Antes la lógica vivía duplicada en:
 *   - routes/pre-planilla.ts  (CASE expressions dentro de QUERY_CONSOLIDADO)
 *   - routes/planilla.ts      (función `clasificarIgss` en TS/JS)
 *
 * Reglas (en orden):
 *   1. e.aplica_igss_general = FALSE              → "Colaborador sin IGSS activado"
 *   2. e.estado_igss = 'pendiente_regularizacion' → "Colaborador en proceso de regularización IGSS"
 *   3. e.estado_igss != 'activo'                  → "Estado IGSS del colaborador: no activo"
 *   4. el puesto no cubre IGSS                    → "Servicio/puesto no incluye IGSS (tarifa)"
 *        (no cubre = ni po.aplica_igss ni el cliente registrado como Centro de Trabajo IGSS)
 *   5. caso contrario                             → aplica IGSS (motivo = NULL)
 *
 * Importante: cualquier cambio en estas reglas debe hacerse aquí; ambos
 * call sites (SQL y JS) consumen las mismas constantes/expresiones.
 */

// ─── Mensajes (fuente única) ──────────────────────────────────────────────────
export const IGSS_MOTIVO = {
  SIN_IGSS_ACTIVADO:        "Colaborador sin IGSS activado",
  EN_REGULARIZACION:        "Colaborador en proceso de regularización IGSS",
  ESTADO_NO_ACTIVO:         "Estado IGSS del colaborador: no activo",
  PUESTO_NO_INCLUYE:        "Servicio/puesto no incluye IGSS (tarifa)",
} as const;

// ─── Expresiones SQL (para usarse dentro de queries) ─────────────────────────
//
// Asumen que `e` alias = employees y `po` alias = puestos_operativos titular
// (con LEFT JOIN, por lo que pueden ser NULL).
//
// El "puesto cubre IGSS" se inyecta como expresión SQL (`puestoCubreSql`) para
// que cada consulta decida cómo se cumple: por el flag del propio puesto
// (po.aplica_igss) y/o porque su cliente está registrado como Centro de Trabajo
// IGSS (clients.igss_aplica). Por defecto usa solo el flag del puesto.
//
// Uso en pre-planilla.ts QUERY_CONSOLIDADO:
//   ${igssAplicaCaseSql(PUESTO_CUBRE_IGSS_SQL)}   AS aplica_igss,
//   ${igssMotivoCaseSql(PUESTO_CUBRE_IGSS_SQL)}   AS motivo_exclusion_igss,
const PUESTO_CUBRE_DEFAULT = "COALESCE(po.aplica_igss, FALSE)";

export function igssAplicaCaseSql(puestoCubreSql: string = PUESTO_CUBRE_DEFAULT): string {
  return `
    CASE
      WHEN COALESCE(e.aplica_igss_general, FALSE) = FALSE
        THEN FALSE
      WHEN COALESCE(e.estado_igss, 'no_activo') != 'activo'
        THEN FALSE
      WHEN (${puestoCubreSql}) = FALSE
        THEN FALSE
      ELSE TRUE
    END`;
}

export function igssMotivoCaseSql(puestoCubreSql: string = PUESTO_CUBRE_DEFAULT): string {
  return `
    CASE
      WHEN COALESCE(e.aplica_igss_general, FALSE) = FALSE
        THEN '${IGSS_MOTIVO.SIN_IGSS_ACTIVADO}'
      WHEN COALESCE(e.estado_igss, 'no_activo') = 'pendiente_regularizacion'
        THEN '${IGSS_MOTIVO.EN_REGULARIZACION}'
      WHEN COALESCE(e.estado_igss, 'no_activo') != 'activo'
        THEN '${IGSS_MOTIVO.ESTADO_NO_ACTIVO}'
      WHEN (${puestoCubreSql}) = FALSE
        THEN '${IGSS_MOTIVO.PUESTO_NO_INCLUYE}'
      ELSE NULL
    END`;
}

// ─── Resolución del puesto titular (prioridad) ───────────────────────────────
// Devuelve el sub-SELECT ranqueado `( ... ) tu` con la MISMA prioridad en
// pre-planilla y planilla, para que la clasificación IGSS coincida en ambas:
//   0 histórico vigente en período > 1 puesto_slots > 2 puesto_titulares > 3 legacy titular.
// `empCol`: expresión del id de empleado (p.ej. "e.id"); `desde`/`hasta`: refs SQL
// ($N, CURRENT_DATE, etc.). El consumidor debe envolverlo con:
//   JOIN puestos_operativos po2 ON po2.id = tu.puesto_id AND po2.activo = TRUE
//   ... ORDER BY tu.prio ASC, tu.orden ASC, po2.updated_at DESC NULLS LAST LIMIT 1.
export function igssTitularChainSQL(empCol: string, desde: string, hasta: string): string {
  return `(
      SELECT pth.puesto_id, 0 AS prio, 0 AS orden
        FROM puesto_titular_historico pth
        WHERE pth.employee_id = ${empCol}
          AND pth.fecha_inicio <= ${hasta}::date
          AND (pth.fecha_fin IS NULL OR pth.fecha_fin >= ${desde}::date)
      UNION ALL
      SELECT ps.puesto_id, 1 AS prio, ps.slot_numero AS orden
        FROM puesto_slots ps
        WHERE ps.empleado_id = ${empCol} AND ps.activo = TRUE
      UNION ALL
      SELECT pt.puesto_id, 2 AS prio, COALESCE(pt.orden, 99) AS orden
        FROM puesto_titulares pt
        WHERE pt.employee_id = ${empCol} AND pt.activo = TRUE
      UNION ALL
      SELECT po3.id AS puesto_id, 3 AS prio, 0 AS orden
        FROM puestos_operativos po3
        WHERE po3.titular_employee_id = ${empCol} AND po3.activo = TRUE
    ) tu`;
}

// ─── Helper JS/TS (para usarse después de SELECT individual) ──────────────────
export interface IgssEligibilidadInput {
  aplica_igss_general?: boolean | null;
  estado_igss?: string | null;
  puesto_aplica_igss?: boolean | null;
}

export interface IgssEligibilidadOutput {
  aplica_igss: boolean;
  motivo_exclusion_igss: string | null;
}

/**
 * Aplica las mismas reglas que IGSS_*_CASE_SQL pero en TypeScript.
 * Se espera recibir el row con los campos `aplica_igss_general`, `estado_igss`,
 * y `puesto_aplica_igss` (ya con COALESCE si vienen de un JOIN).
 */
export function clasificarIgssDesdeRow(row: IgssEligibilidadInput): IgssEligibilidadOutput {
  const aplicaGeneral = row.aplica_igss_general === true;
  const estado = row.estado_igss ?? "no_activo";
  const puestoAplica = row.puesto_aplica_igss === true;

  if (!aplicaGeneral) {
    return { aplica_igss: false, motivo_exclusion_igss: IGSS_MOTIVO.SIN_IGSS_ACTIVADO };
  }
  if (estado === "pendiente_regularizacion") {
    return { aplica_igss: false, motivo_exclusion_igss: IGSS_MOTIVO.EN_REGULARIZACION };
  }
  if (estado !== "activo") {
    return { aplica_igss: false, motivo_exclusion_igss: IGSS_MOTIVO.ESTADO_NO_ACTIVO };
  }
  if (!puestoAplica) {
    return { aplica_igss: false, motivo_exclusion_igss: IGSS_MOTIVO.PUESTO_NO_INCLUYE };
  }
  return { aplica_igss: true, motivo_exclusion_igss: null };
}
