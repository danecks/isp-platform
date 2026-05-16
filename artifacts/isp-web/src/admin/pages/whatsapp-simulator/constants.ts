/**
 * Etiquetas y colores del simulador.
 *
 * Los escenarios rápidos (botones sobre el input) ya NO viven aquí: se cargan
 * desde la base de datos vía `GET /api/simulador/escenarios` y se administran
 * desde `/admin/simulador-whatsapp/escenarios`. Este archivo conserva sólo
 * datos de presentación que no cambian con frecuencia.
 */

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

