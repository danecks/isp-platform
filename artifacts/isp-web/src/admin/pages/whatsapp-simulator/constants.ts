/**
 * Etiquetas, colores y escenarios rápidos del simulador.
 * Mantener aquí (en vez de inline en los componentes) para poder agregar
 * nuevas intenciones / escenarios en un solo lugar.
 */

import type { QuickScenario } from "./types";

export const API = "/api";

export const INTENCION_LABELS: Record<string, string> = {
  anticipo:                   "💸 Anticipo salarial",
  anticipo_inicio:            "💸 Anticipo (inicio)",
  anticipo_sesion:            "💸 Anticipo (sesión activa)",
  incidencia:                 "🚨 Incidencia / Emergencia",
  postulacion:                "👷 Postulación laboral",
  lead:                       "💼 Lead comercial",
  info_general:               "ℹ️ Información general",
  contacto_asesor:            "📞 Contacto con asesor",
  saludo_externo:             "👋 Saludo / Menú externo",
  no_autorizado:              "⛔ Número no autorizado",
  no_autorizado_interno:      "🔒 Función interna (externo)",
  inactivo:                   "🚫 Usuario inactivo",
  bloqueado:                  "⛔ Acceso bloqueado",
  pendiente:                  "⏳ Pendiente",
  // ── Flujo DPI ──────────────────────────────────────────────────────────────
  dpi_solicitado:             "🔐 DPI solicitado",
  dpi_wait_dpi:               "🔐 Esperando DPI",
  dpi_formato_invalido:       "❌ DPI: formato inválido",
  dpi_no_encontrado:          "❌ DPI: no encontrado",
  dpi_max_intentos:           "🔒 DPI: máx. intentos",
  dpi_valido_sin_numero_previo: "✅ DPI válido → registrar?",
  dpi_valido_numero_previo:   "✅ DPI válido → número previo",
  numero_registrado:          "✅ Número registrado",
  numero_reemplazado:         "✅ Número reemplazado",
  numero_secundario:          "📎 Número secundario guardado",
  numero_no_guardado:         "↩️ Número no guardado (temporal)",
  registro_cancelado:         "↩️ Registro cancelado",
  empleado_inactivo:          "🚫 Colaborador inactivo",
  esperando_si_no:            "⏳ Esperando SI / NO",
  esperando_opcion_reemplazo: "⏳ Esperando 1/2/3",
  sesion_dpi_activa:          "🔐 Sesión DPI activa",
};

export const ROL_COLORS: Record<string, string> = {
  admin:      "bg-red-500/20 text-red-300 border-red-500/30",
  operaciones:"bg-blue-500/20 text-blue-300 border-blue-500/30",
  rrhh:       "bg-purple-500/20 text-purple-300 border-purple-500/30",
  comercial:  "bg-green-500/20 text-green-300 border-green-500/30",
  supervisor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  guardia:    "bg-orange-500/20 text-orange-300 border-orange-500/30",
  cliente:    "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  externo:    "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

export const QUICK_SCENARIOS: QuickScenario[] = [
  // ── Internos (usuario registrado) ──────────────────────────────────────────
  { group: "interno", label: "Anticipo",          icon: "💸", msg: "quiero solicitar anticipo",                          color: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300" },
  { group: "interno", label: "Emergencia",        icon: "🚨", msg: "emergencia en custodia, persona sospechosa",         color: "bg-red-500/10 border-red-500/30 text-red-300" },
  { group: "interno", label: "Incidencia",        icon: "⚠️", msg: "reporto incidencia en planta norte, intruso",        color: "bg-orange-500/10 border-orange-500/30 text-orange-300" },
  { group: "interno", label: "Alias cliente",     icon: "🏢", msg: "custodio gallo necesita apoyo urgente",              color: "bg-teal-500/10 border-teal-500/30 text-teal-300" },

  // ── Externos permitidos ────────────────────────────────────────────────────
  { group: "externo", label: "Externo comercial",  icon: "💼", msg: "buenos días, necesito cotización para seguridad de mi empresa",  color: "bg-green-500/10 border-green-500/30 text-green-300" },
  { group: "externo", label: "Externo empleo",     icon: "👷", msg: "kisiera trabajo como guardia de seguridad",                      color: "bg-blue-500/10 border-blue-500/30 text-blue-300" },
  { group: "externo", label: "Externo info",       icon: "ℹ️", msg: "hola quiero informacion sobre sus servicios de seguridad",       color: "bg-indigo-500/10 border-indigo-500/30 text-indigo-300" },
  { group: "externo", label: "Externo asesor",     icon: "📞", msg: "quiero hablar con un asesor de ventas",                          color: "bg-purple-500/10 border-purple-500/30 text-purple-300" },
  // Externos que disparan flujo DPI
  { group: "externo", label: "🔐 Anticipo externo",    icon: "🔐", msg: "quiero mi anticipo salarial",                         color: "bg-amber-500/10 border-amber-500/30 text-amber-300" },
  { group: "externo", label: "🔐 Emergencia externo",  icon: "🔐", msg: "emergencia hay un intruso en las instalaciones",       color: "bg-amber-500/10 border-amber-500/30 text-amber-300" },
  { group: "externo", label: "Saludo / menú",      icon: "👋", msg: "hola",                                                         color: "bg-gray-500/10 border-gray-500/30 text-gray-300" },

  // ── Respuestas rápidas para flujo DPI ──────────────────────────────────────
  // DPIs sembrados: Carlos (OPS, tiene usuario)=1234567890101, Marco=2345678901202, Lucía=3456789012303
  { group: "dpi", label: "DPI Carlos (OPS)",  icon: "🪪", msg: "1234567890101",  color: "bg-blue-500/10 border-blue-500/30 text-blue-300" },
  { group: "dpi", label: "DPI Marco Tzoc",    icon: "🪪", msg: "2345678901202",  color: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300" },
  { group: "dpi", label: "DPI Lucía Ajú",     icon: "🪪", msg: "3456789012303",  color: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300" },
  { group: "dpi", label: "DPI inválido",      icon: "❌", msg: "00000000",        color: "bg-red-500/10 border-red-500/30 text-red-300" },
  { group: "dpi", label: "✅ SI (registrar)", icon: "✅", msg: "SI",             color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" },
  { group: "dpi", label: "❌ NO (temporal)",  icon: "❌", msg: "NO",             color: "bg-gray-500/10 border-gray-500/30 text-gray-300" },
  { group: "dpi", label: "1 Reemplazar",      icon: "🔄", msg: "1",              color: "bg-orange-500/10 border-orange-500/30 text-orange-300" },
  { group: "dpi", label: "2 Secundario",      icon: "📎", msg: "2",              color: "bg-blue-500/10 border-blue-500/30 text-blue-300" },
  { group: "dpi", label: "3 Cancelar",        icon: "↩️", msg: "3",              color: "bg-gray-500/10 border-gray-500/30 text-gray-300" },
];
