/**
 * Fuente única de "¿está cubierto este puesto operativo?".
 *
 * Un puesto está cubierto si tiene un slot de turno con empleado asignado
 * (modelo 24x24, `puesto_slots`) o, como fallback legacy, su columna
 * `agente_id` está poblada. Es la MISMA regla que usa el pizarrón en vivo y el
 * cierre operativo (ver `routes/operaciones/cierre.ts`).
 *
 * La columna legacy `puestos_operativos.estado` ('cubierto'/'descubierto')
 * quedó obsoleta al migrar al modelo de turnos: reportaba casi todo
 * "descubierto" y divergía del pizarrón. No usar esa columna para decidir
 * cobertura — usar este helper en su lugar.
 *
 * Devuelve una expresión SQL booleana embebible en un WHERE / CASE / SELECT.
 *
 * @param alias alias de la tabla `puestos_operativos` en la query (default "po")
 */
export function puestoCubiertoSql(alias = "po"): string {
  return `(
    EXISTS (
      SELECT 1 FROM puesto_slots ps_cob
       WHERE ps_cob.puesto_id = ${alias}.id
         AND ps_cob.activo = TRUE
         AND ps_cob.empleado_id IS NOT NULL
    )
    OR ${alias}.agente_id IS NOT NULL
  )`;
}

/**
 * Expresión SQL que devuelve el texto 'cubierto' / 'descubierto' a partir del
 * estado real de cobertura por slots. Sustituye a la columna legacy `estado`
 * en respuestas que el frontend todavía pinta como string.
 */
export function puestoEstadoCoberturaSql(alias = "po"): string {
  return `(CASE WHEN ${puestoCubiertoSql(alias)} THEN 'cubierto' ELSE 'descubierto' END)`;
}
