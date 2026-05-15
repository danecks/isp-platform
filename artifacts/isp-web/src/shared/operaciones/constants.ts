/**
 * Constantes compartidas entre Admin, Portal Cliente y PWA Agente.
 *
 * Mantener acá las listas que aparecen en formularios paralelos (catálogo de
 * tipos de incidencia, meses, etiquetas de período) evita que un cambio se
 * aplique sólo en una pantalla y se quede desincronizado en otras.
 */

import type { Periodo } from "./types";

/**
 * Catálogo de tipos de incidencia ofrecido al CLIENTE en el portal.
 * Histórico: la versión usada por `PortalIncidencias`. Se mantiene tal cual
 * para no cambiar las etiquetas que el cliente ya conoce.
 */
export const TIPOS_INCIDENCIA: ReadonlyArray<string> = [
  "Robo / Hurto",
  "Intrusión / Acceso no autorizado",
  "Vandalismo",
  "Daño a propiedad",
  "Persona sospechosa",
  "Vehículo sospechoso",
  "Falla de equipo / sistema",
  "Falla de servicio del agente",
  "Emergencia médica",
  "Incendio / amago de incendio",
  "Otro",
];

/**
 * Catálogo de tipos de incidencia ofrecido en el panel ADMIN
 * (NuevaIncidenciaModal). Difiere del catálogo del cliente: usa nombres
 * operativos internos. NO unificar sin coordinarlo con operaciones — el
 * texto se persiste tal cual en `incidents.tipo` y cualquier renombrado
 * rompe filtros y reportes históricos.
 */
export const TIPOS_INCIDENCIA_ADMIN: ReadonlyArray<string> = [
  "Intrusión detectada",
  "Robo / Intento de robo",
  "Vandalismo",
  "Alerta médica",
  "Incendio / Emergencia",
  "Comportamiento sospechoso",
  "Falla en sistema de acceso",
  "Accidente de tránsito",
  "Conflicto entre personas",
  "Pérdida de material",
  "Otro",
];

/** Catálogo de tipos para el modal de emergencias (admin). */
export const TIPOS_EMERGENCIA: ReadonlyArray<string> = [
  "Emergencia — Robo / Asalto",
  "Emergencia — Intrusión no autorizada",
  "Emergencia — Incidente armado",
  "Emergencia — Emergencia médica",
  "Emergencia — Incendio",
  "Emergencia — Evacuación",
  "Emergencia — Disturbio / Altercado",
  "Emergencia — Otro",
];

export const MESES: ReadonlyArray<string> = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const PERIODO_LABEL: Record<Periodo, string> = {
  hoy: "Hoy",
  "7d": "Últimos 7 días",
  "15d": "Últimos 15 días",
};
