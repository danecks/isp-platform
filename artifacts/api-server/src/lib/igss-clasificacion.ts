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
 *   4. po.aplica_igss = FALSE                     → "Servicio/puesto no incluye IGSS (tarifa)"
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
// Uso en pre-planilla.ts QUERY_CONSOLIDADO:
//   ${IGSS_APLICA_CASE_SQL}        AS aplica_igss,
//   ${IGSS_MOTIVO_CASE_SQL}        AS motivo_exclusion_igss,
export const IGSS_APLICA_CASE_SQL = `
    CASE
      WHEN COALESCE(e.aplica_igss_general, FALSE) = FALSE
        THEN FALSE
      WHEN COALESCE(e.estado_igss, 'no_activo') != 'activo'
        THEN FALSE
      WHEN COALESCE(po.aplica_igss, FALSE) = FALSE
        THEN FALSE
      ELSE TRUE
    END`;

export const IGSS_MOTIVO_CASE_SQL = `
    CASE
      WHEN COALESCE(e.aplica_igss_general, FALSE) = FALSE
        THEN '${IGSS_MOTIVO.SIN_IGSS_ACTIVADO}'
      WHEN COALESCE(e.estado_igss, 'no_activo') = 'pendiente_regularizacion'
        THEN '${IGSS_MOTIVO.EN_REGULARIZACION}'
      WHEN COALESCE(e.estado_igss, 'no_activo') != 'activo'
        THEN '${IGSS_MOTIVO.ESTADO_NO_ACTIVO}'
      WHEN COALESCE(po.aplica_igss, FALSE) = FALSE
        THEN '${IGSS_MOTIVO.PUESTO_NO_INCLUYE}'
      ELSE NULL
    END`;

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
