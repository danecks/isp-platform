/**
 * Dominio Clientes — ficha maestra del cliente
 *
 * - alias: gestión de aliases (`client_aliases`, `position_aliases`) y
 *          resolutor de texto libre.
 * - ficha: ficha maestra (datos, contractuales, puestos, cobertura del día,
 *          rentabilidad).
 * - sedes: sedes del cliente (`client_sedes`) y puestos por sede.
 *
 * Estos tres módulos comparten la tabla `clients` y se reorganizan juntos
 * porque son distintas vistas del mismo dominio (ficha maestra del cliente).
 */
export { aliasRouter } from "./alias";
export { default as fichaRouter } from "./ficha";
export { default as sedesRouter } from "./sedes";
