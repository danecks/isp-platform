/**
 * Dominio Reclutamiento — flujo Kiosco → Solicitudes → Empleado
 *
 * El kiosco recibe solicitudes (`POST /solicitudes-empleo`), RRHH revisa
 * y edita los datos (`PATCH /solicitudes-empleo/:id`), y finalmente las
 * convierte en empleado (`POST /solicitudes-empleo/:id/contratar`), con
 * detección automática de reingreso por DPI (merge requests).
 *
 * Este es el reemplazo moderno del antiguo `applications` (que sigue
 * existiendo solo para el formulario público de `/reclutamiento`).
 */
export { solicitudesEmpleoRouter, limpiarFotosExpiradas } from "./solicitudes-empleo";
