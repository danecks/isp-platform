/**
 * SIMULADOR DE WHATSAPP — Panel Administrativo
 *
 * Permite al administrador simular conversaciones con el bot de WhatsApp
 * usando diferentes perfiles, números y mensajes, sin conectar la API real.
 *
 * ─── COMPONENTES ──────────────────────────────────────────────────────────
 *   ChatPanel       — conversación estilo WhatsApp
 *   ConfigPanel     — selector de perfil, usuario, modo
 *   DebugPanel      — detalles técnicos de la última respuesta
 *   QuickScenarios  — botones de escenarios comunes
 *
 * ─── LÓGICA BACKEND REUTILIZADA ───────────────────────────────────────────
 *   POST /api/simulador con:
 *   · validarNumeroWA() real
 *   · classifyMessage() real
 *   · getWaMessage() configurable
 *   · anticipo-session en memoria
 *
 * ─── MODOS ────────────────────────────────────────────────────────────────
 *   Simulado  → dry-run, no escribe en DB
 *   Real      → persiste entidades en DB (marcadas como simulador_admin)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import {
  MessageSquare, Send, User, Phone, RefreshCw, ChevronRight,
  CheckCircle2, XCircle, AlertCircle, Bug, Zap, Database,
  Shield, Clock, Tag, ChevronDown, ChevronUp, Trash2,
  Activity, Bot, Info,
} from "lucide-react";

const API = "/api";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface UsuarioSimulador {
  id: number;
  nombre: string;
  rol: string;
  telefono: string | null;
  estado: string;
}

interface DebugInfo {
  validacion: { telefono: string; autorizado: boolean; motivo: string | null };
  usuario: { id: number | null; nombre: string | null; rol: string | null; estado: string | null; tieneTelefono: boolean } | null;
  clasificacion: { intencion: string; mensajeOriginal: string };
  sesion: { activa: boolean; estado: string | null };
  entidad: { creada: boolean; tabla: string | null; id: string | number | null; dryRun: boolean };
  alias: string | null;
  persistencia: "real" | "simulado";
  errores: string[];
  duracionMs: number;
}

interface ChatMessage {
  id: string;
  from: "user" | "bot";
  text: string;
  ts: Date;
  tipo?: string;
  debug?: DebugInfo;
  error?: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const INTENCION_LABELS: Record<string, string> = {
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

const ROL_COLORS: Record<string, string> = {
  admin:      "bg-red-500/20 text-red-300 border-red-500/30",
  operaciones:"bg-blue-500/20 text-blue-300 border-blue-500/30",
  rrhh:       "bg-purple-500/20 text-purple-300 border-purple-500/30",
  comercial:  "bg-green-500/20 text-green-300 border-green-500/30",
  supervisor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  guardia:    "bg-orange-500/20 text-orange-300 border-orange-500/30",
  cliente:    "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  externo:    "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

const QUICK_SCENARIOS: {
  label: string;
  icon: string;
  msg: string;
  color: string;
  group: "interno" | "externo" | "dpi";
  skipValidacion?: boolean;
}[] = [
  // ── Internos (usuario registrado) ──────────────────────────────────────────
  { group: "interno", label: "Anticipo",          icon: "💸", msg: "quiero solicitar anticipo",                          color: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300" },
  { group: "interno", label: "Emergencia",        icon: "🚨", msg: "emergencia en custodia, persona sospechosa",         color: "bg-red-500/10 border-red-500/30 text-red-300" },
  { group: "interno", label: "Incidencia",        icon: "⚠️", msg: "reporto incidencia en planta norte, intruso",        color: "bg-orange-500/10 border-orange-500/30 text-orange-300" },
  { group: "interno", label: "Alias cliente",     icon: "🏢", msg: "custodio gallo necesita apoyo urgente",              color: "bg-teal-500/10 border-teal-500/30 text-teal-300" },

  // ── Externos permitidos (número desconocido, intención válida) ─────────────
  { group: "externo", label: "Externo comercial",  icon: "💼", msg: "buenos días, necesito cotización para seguridad de mi empresa",  color: "bg-green-500/10 border-green-500/30 text-green-300" },
  { group: "externo", label: "Externo empleo",     icon: "👷", msg: "kisiera trabajo como guardia de seguridad",                      color: "bg-blue-500/10 border-blue-500/30 text-blue-300" },
  { group: "externo", label: "Externo info",       icon: "ℹ️", msg: "hola quiero informacion sobre sus servicios de seguridad",       color: "bg-indigo-500/10 border-indigo-500/30 text-indigo-300" },
  { group: "externo", label: "Externo asesor",     icon: "📞", msg: "quiero hablar con un asesor de ventas",                          color: "bg-purple-500/10 border-purple-500/30 text-purple-300" },
  // Externos que ahora disparan flujo DPI (antes daban "no autorizado")
  { group: "externo", label: "🔐 Anticipo externo",    icon: "🔐", msg: "quiero mi anticipo salarial",                         color: "bg-amber-500/10 border-amber-500/30 text-amber-300" },
  { group: "externo", label: "🔐 Emergencia externo",  icon: "🔐", msg: "emergencia hay un intruso en las instalaciones",       color: "bg-amber-500/10 border-amber-500/30 text-amber-300" },
  { group: "externo", label: "Saludo / menú",      icon: "👋", msg: "hola",                                                         color: "bg-gray-500/10 border-gray-500/30 text-gray-300" },

  // ── Respuestas rápidas para flujo DPI (se usan cuando hay sesión DPI activa)
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

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function MsgBubble({ msg }: { msg: ChatMessage }) {
  const [showDebug, setShowDebug] = useState(false);
  const isUser = msg.from === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-2`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center mr-2 mt-1 shrink-0">
          <Bot size={14} className="text-white" />
        </div>
      )}
      <div className={`max-w-[75%]`}>
        <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-[#005c4b] text-white rounded-tr-sm"
            : msg.error
              ? "bg-red-900/50 border border-red-600/30 text-red-200 rounded-tl-sm"
              : "bg-[#1f2c34] text-gray-100 rounded-tl-sm"
        }`}>
          <pre className="whitespace-pre-wrap font-sans text-sm">{msg.text}</pre>
        </div>
        <div className={`flex items-center gap-2 mt-0.5 ${isUser ? "justify-end" : "justify-start"}`}>
          <span className="text-[10px] text-gray-500">
            {msg.ts.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {msg.tipo && !isUser && (
            <span className="text-[10px] text-green-600 font-mono">
              {INTENCION_LABELS[msg.tipo] ?? msg.tipo}
            </span>
          )}
          {msg.debug && !isUser && (
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="text-[10px] text-gray-600 hover:text-gray-400 flex items-center gap-0.5"
            >
              <Bug size={10} />
              {showDebug ? "cerrar" : "debug"}
            </button>
          )}
        </div>

        {showDebug && msg.debug && (
          <div className="mt-2 bg-gray-900/80 border border-gray-700/50 rounded-xl p-3 text-xs font-mono space-y-1.5">
            <div className="flex items-center gap-2 text-gray-400 mb-2 font-sans">
              <Bug size={12} /> <span className="font-semibold">Información de depuración</span>
              <span className="ml-auto text-gray-600">{msg.debug.duracionMs}ms</span>
            </div>
            <DebugRow label="Teléfono" value={msg.debug.validacion.telefono} />
            <DebugRow
              label="Autorizado"
              value={msg.debug.validacion.autorizado ? "✓ Sí" : `✗ No (${msg.debug.validacion.motivo})`}
              color={msg.debug.validacion.autorizado ? "text-green-400" : "text-red-400"}
            />
            <DebugRow
              label="Usuario"
              value={msg.debug.usuario?.nombre ?? "Externo / No registrado"}
            />
            <DebugRow
              label="Rol"
              value={msg.debug.usuario?.rol ?? "—"}
            />
            <DebugRow label="Intención" value={INTENCION_LABELS[msg.debug.clasificacion.intencion] ?? msg.debug.clasificacion.intencion} />
            {msg.debug.alias && <DebugRow label="Alias resuelto" value={msg.debug.alias} color="text-teal-400" />}
            {msg.debug.sesion.activa && <DebugRow label="Sesión anticipo" value={`Activa · ${msg.debug.sesion.estado}`} color="text-yellow-400" />}
            <DebugRow
              label="Entidad"
              value={
                msg.debug.entidad.dryRun
                  ? `DRY RUN — ${msg.debug.entidad.tabla ?? "n/a"}`
                  : msg.debug.entidad.creada
                    ? `✓ Creada en ${msg.debug.entidad.tabla} #${msg.debug.entidad.id}`
                    : "No creada"
              }
              color={msg.debug.entidad.dryRun ? "text-blue-400" : msg.debug.entidad.creada ? "text-green-400" : "text-gray-500"}
            />
            <DebugRow label="Persistencia" value={msg.debug.persistencia === "real" ? "✓ Real (DB)" : "⬡ Simulado (DRY RUN)"} color={msg.debug.persistencia === "real" ? "text-amber-400" : "text-blue-400"} />
            {msg.debug.errores.length > 0 && (
              <div className="bg-red-900/30 rounded px-2 py-1 mt-1">
                <p className="text-red-400 font-sans font-semibold mb-0.5">Errores:</p>
                {msg.debug.errores.map((e, i) => <p key={i} className="text-red-300">{e}</p>)}
              </div>
            )}
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-[#2a3942] flex items-center justify-center ml-2 mt-1 shrink-0">
          <User size={14} className="text-gray-300" />
        </div>
      )}
    </div>
  );
}

function DebugRow({ label, value, color = "text-gray-300" }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 shrink-0 w-28">{label}:</span>
      <span className={color}>{value}</span>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

export default function SimuladorWhatsApp() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioSimulador[]>([]);
  const [usuarioSel, setUsuarioSel] = useState<UsuarioSimulador | null>(null);
  const [telManual, setTelManual] = useState("");
  const [nombreManual, setNombreManual] = useState("Externo Simulado");
  const [persistir, setPersistir] = useState(false);
  const [skipValidacion, setSkipValidacion] = useState(false);
  const [showConfig, setShowConfig] = useState(true);
  const [lastDebug, setLastDebug] = useState<DebugInfo | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const telefonoActivo = usuarioSel?.telefono ?? telManual;
  const nombreActivo = usuarioSel?.nombre ?? nombreManual;

  useEffect(() => {
    fetch(`${API}/simulador/usuarios`)
      .then(r => r.json())
      .then(setUsuarios)
      .catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const enviar = useCallback(async (texto: string, opts?: { skipVal?: boolean }) => {
    if (!texto.trim() || loading) return;
    const tel = telefonoActivo.trim();
    if (!tel) {
      alert("Por favor selecciona un usuario o ingresa un número de teléfono.");
      return;
    }

    const msgId = `msg-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: msgId + "-u",
      from: "user",
      text: texto.trim(),
      ts: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/simulador`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefono: tel,
          nombre: nombreActivo,
          mensaje: texto.trim(),
          persistir,
          skipValidacion: opts?.skipVal ?? skipValidacion,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages(prev => [...prev, {
          id: msgId + "-e",
          from: "bot",
          text: `Error: ${data.error ?? "Error desconocido"}`,
          ts: new Date(),
          error: true,
        }]);
      } else {
        setLastDebug(data.debug);
        setMessages(prev => [...prev, {
          id: msgId + "-b",
          from: "bot",
          text: data.respuesta ?? "(Sin respuesta generada)",
          ts: new Date(),
          tipo: data.tipo,
          debug: data.debug,
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: msgId + "-err",
        from: "bot",
        text: "Error de conexión con el servidor.",
        ts: new Date(),
        error: true,
      }]);
    }
    setLoading(false);
  }, [telefonoActivo, nombreActivo, persistir, skipValidacion, loading]);

  async function limpiarSesion() {
    if (!telefonoActivo) return;
    await fetch(`${API}/simulador/sesion`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefono: telefonoActivo }),
    });
    setMessages(prev => [...prev, {
      id: `sys-${Date.now()}`,
      from: "bot",
      text: "🔄 Sesión de anticipo limpiada. El próximo mensaje iniciará un flujo nuevo.",
      ts: new Date(),
    }]);
  }

  const rolActivo = usuarioSel?.rol ?? "externo";

  return (
    <AdminLayout title="Simulador WhatsApp">
      <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#0b141a]">

        {/* ── CONFIG SIDEBAR (izquierda) ───────────────────────────────── */}
        <div className={`shrink-0 border-r border-gray-700/30 bg-[#111b21] flex flex-col transition-all duration-200 ${showConfig ? "w-72" : "w-10"}`}>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="h-10 flex items-center justify-center text-gray-500 hover:text-white border-b border-gray-700/30 shrink-0"
          >
            {showConfig ? <ChevronLeft16 /> : <ChevronRight size={16} />}
          </button>

          {showConfig && (
            <div className="flex-1 overflow-y-auto p-4 space-y-5">

              {/* Header */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 bg-green-500/20 rounded-lg">
                    <MessageSquare size={16} className="text-green-400" />
                  </div>
                  <h2 className="text-sm font-bold text-white">Simulador WA</h2>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed">
                  Simula el comportamiento del bot con distintos perfiles y mensajes.
                </p>
              </div>

              {/* Modo */}
              <div>
                <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-2 font-semibold">Modo de simulación</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setPersistir(false)}
                    className={`py-2 px-2 rounded-lg text-xs font-medium border transition-all ${
                      !persistir
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                        : "text-gray-500 border-gray-700/40 hover:text-gray-300 hover:border-gray-600"
                    }`}
                  >
                    <Zap size={12} className="mx-auto mb-1" />
                    Sin persistir
                  </button>
                  <button
                    onClick={() => setPersistir(true)}
                    className={`py-2 px-2 rounded-lg text-xs font-medium border transition-all ${
                      persistir
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "text-gray-500 border-gray-700/40 hover:text-gray-300 hover:border-gray-600"
                    }`}
                  >
                    <Database size={12} className="mx-auto mb-1" />
                    Con persistir
                  </button>
                </div>
                <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
                  {persistir
                    ? "⚠ Creará registros reales en la base de datos."
                    : "✓ DRY RUN: no escribe nada en la DB."}
                </p>
              </div>

              {/* Validación */}
              <div>
                <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-2 font-semibold">Validación de número</p>
                <button
                  onClick={() => setSkipValidacion(!skipValidacion)}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-medium border transition-all flex items-center gap-2 ${
                    skipValidacion
                      ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                      : "bg-green-500/10 text-green-400 border-green-500/30"
                  }`}
                >
                  <Shield size={12} />
                  {skipValidacion ? "Validación: OMITIDA" : "Validación: ACTIVA (real)"}
                </button>
                <p className="text-[10px] text-gray-600 mt-1 leading-relaxed">
                  {skipValidacion
                    ? "Todos los números pasan sin revisión."
                    : "Valida que el número esté registrado y activo."}
                </p>
              </div>

              {/* Selector de usuario */}
              <div>
                <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-2 font-semibold">Usuario simulado</p>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  <button
                    onClick={() => setUsuarioSel(null)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all ${
                      !usuarioSel
                        ? "bg-gray-600/30 text-white border-gray-500/40"
                        : "text-gray-400 border-gray-700/30 hover:text-gray-200 hover:bg-gray-700/20"
                    }`}
                  >
                    <span className="font-medium">✎ Manual</span>
                    <span className="text-gray-600 ml-1">(número libre)</span>
                  </button>

                  {usuarios.map(u => (
                    <button
                      key={u.id}
                      onClick={() => setUsuarioSel(u)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all ${
                        usuarioSel?.id === u.id
                          ? "bg-green-900/30 border-green-500/40"
                          : "text-gray-400 border-gray-700/30 hover:text-gray-200 hover:bg-gray-700/20"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded border ${ROL_COLORS[u.rol] ?? ROL_COLORS.externo}`}>
                          {u.rol.toUpperCase()}
                        </span>
                        <span className="truncate font-medium text-white">{u.nombre}</span>
                      </div>
                      {u.telefono && (
                        <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                          <Phone size={9} /> {u.telefono}
                        </p>
                      )}
                      {!u.telefono && (
                        <p className="text-[10px] text-orange-500 mt-0.5">Sin teléfono</p>
                      )}
                    </button>
                  ))}
                </div>

                {/* Manual phone + name */}
                {!usuarioSel && (
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      placeholder="Nombre del contacto"
                      value={nombreManual}
                      onChange={e => setNombreManual(e.target.value)}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50"
                    />
                    <input
                      type="text"
                      placeholder="Número (ej: 50255551234)"
                      value={telManual}
                      onChange={e => setTelManual(e.target.value)}
                      className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50"
                    />
                  </div>
                )}
              </div>

              {/* Estado activo */}
              {(usuarioSel || telManual) && (
                <div className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-3">
                  <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-2 font-semibold">Identidad activa</p>
                  <p className="text-xs text-white font-medium">{nombreActivo}</p>
                  <p className="text-[10px] text-green-400 flex items-center gap-1 mt-0.5">
                    <Phone size={10} /> {telefonoActivo || "—"}
                  </p>
                  <span className={`mt-1.5 inline-flex text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${ROL_COLORS[rolActivo] ?? ROL_COLORS.externo}`}>
                    {rolActivo}
                  </span>
                </div>
              )}

              {/* Limpiar sesión */}
              <div className="pt-1">
                <button
                  onClick={() => setMessages([])}
                  className="w-full text-xs text-gray-500 hover:text-white border border-gray-700/30 hover:border-gray-600 rounded-lg py-2 flex items-center justify-center gap-2 transition-all"
                >
                  <Trash2 size={12} /> Limpiar conversación
                </button>
                <button
                  onClick={limpiarSesion}
                  className="w-full text-xs text-gray-500 hover:text-amber-300 border border-gray-700/30 hover:border-amber-500/30 rounded-lg py-2 flex items-center justify-center gap-2 transition-all mt-1.5"
                >
                  <RefreshCw size={12} /> Resetear sesión anticipo
                </button>
              </div>

            </div>
          )}
        </div>

        {/* ── CHAT AREA (centro) ───────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Chat header */}
          <div className="h-14 bg-[#202c33] border-b border-gray-700/30 flex items-center px-4 gap-3 shrink-0">
            <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Bot ISP, S.A.</p>
              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                <Activity size={9} className="text-green-400" /> Sistema activo
                <span className="mx-1 text-gray-600">·</span>
                {persistir
                  ? <span className="text-amber-400">Con persistencia (DB)</span>
                  : <span className="text-blue-400">Modo simulado (DRY RUN)</span>
                }
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {telefonoActivo ? (
                <span className="text-[10px] text-gray-400 flex items-center gap-1 bg-gray-800/50 px-2 py-1 rounded-lg">
                  <Phone size={10} className="text-green-400" />
                  {telefonoActivo}
                  <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded border ${ROL_COLORS[rolActivo] ?? ROL_COLORS.externo}`}>
                    {rolActivo.toUpperCase()}
                  </span>
                </span>
              ) : (
                <span className="text-[10px] text-orange-400 bg-orange-900/20 border border-orange-700/30 px-2 py-1 rounded-lg">
                  Selecciona un usuario
                </span>
              )}
            </div>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto p-4"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
                <MessageSquare size={36} className="text-gray-600 mb-3" />
                <p className="text-gray-400 font-medium">Simulador listo</p>
                <p className="text-gray-600 text-xs mt-1 max-w-xs">
                  Selecciona un usuario y escribe un mensaje, o usa los escenarios rápidos del panel derecho.
                </p>
              </div>
            )}
            {messages.map(msg => <MsgBubble key={msg.id} msg={msg} />)}
            {loading && (
              <div className="flex justify-start mb-2">
                <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center mr-2 mt-1">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="bg-[#1f2c34] rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick scenarios */}
          <div className="bg-[#111b21] border-t border-gray-700/20 px-4 py-2.5 shrink-0">
            <div className="flex flex-wrap gap-3">
              <div>
                <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-1.5 font-semibold">Internos (registrado)</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SCENARIOS.filter(s => s.group === "interno").map(s => (
                    <button
                      key={s.label}
                      onClick={() => enviar(s.msg, { skipVal: s.skipValidacion })}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all hover:opacity-80 ${s.color}`}
                      title={s.msg}
                    >
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-px bg-gray-700/30 self-stretch" />
              <div>
                <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-1.5 font-semibold">Externos (número desconocido)</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SCENARIOS.filter(s => s.group === "externo").map(s => (
                    <button
                      key={s.label}
                      onClick={() => enviar(s.msg, { skipVal: s.skipValidacion })}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all hover:opacity-80 ${s.color}`}
                      title={s.msg}
                    >
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-px bg-gray-700/30 self-stretch" />
              <div>
                <p className="text-[9px] uppercase tracking-widest text-cyan-700 mb-1.5 font-semibold">
                  Flujo DPI <span className="text-gray-600">(respuestas rápidas)</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SCENARIOS.filter(s => s.group === "dpi").map(s => (
                    <button
                      key={s.label}
                      onClick={() => enviar(s.msg)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all hover:opacity-80 ${s.color}`}
                      title={`Enviar: "${s.msg}"`}
                    >
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-gray-700 mt-1">
                  Primero activa "🔐 Anticipo/Emergencia externo" con número desconocido, luego usa DPI o SI/NO
                </p>
              </div>
            </div>
          </div>

          {/* Input */}
          <div className="bg-[#202c33] px-3 py-3 shrink-0">
            <div className="flex items-end gap-2">
              <div className="flex-1 bg-[#2a3942] rounded-2xl px-4 py-2.5 flex items-end gap-2">
                <textarea
                  rows={1}
                  placeholder="Escribe un mensaje…"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviar(input);
                    }
                  }}
                  className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 resize-none outline-none max-h-28 leading-relaxed"
                  style={{ minHeight: "22px" }}
                />
              </div>
              <button
                onClick={() => enviar(input)}
                disabled={loading || !input.trim() || !telefonoActivo}
                className="w-10 h-10 rounded-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:opacity-50 flex items-center justify-center transition-all shrink-0"
              >
                <Send size={16} className="text-white ml-0.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── DEBUG PANEL (derecha) ─────────────────────────────────────── */}
        <DebugSidePanel debug={lastDebug} />
      </div>
    </AdminLayout>
  );
}

// ─── Debug side panel ─────────────────────────────────────────────────────────

function DebugSidePanel({ debug }: { debug: DebugInfo | null }) {
  const [open, setOpen] = useState(true);

  return (
    <div className={`shrink-0 border-l border-gray-700/30 bg-[#111b21] flex flex-col transition-all duration-200 ${open ? "w-64" : "w-10"}`}>
      <button
        onClick={() => setOpen(!open)}
        className="h-10 flex items-center justify-center text-gray-500 hover:text-white border-b border-gray-700/30 shrink-0"
        title={open ? "Cerrar debug" : "Ver debug"}
      >
        {open ? <ChevronRight size={16} /> : <Bug size={16} />}
      </button>

      {open && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-2 font-semibold flex items-center gap-1">
              <Bug size={10} /> Último mensaje
            </p>
          </div>

          {!debug ? (
            <div className="text-center py-10">
              <Info size={24} className="mx-auto text-gray-700 mb-2" />
              <p className="text-[11px] text-gray-600">Envía un mensaje para ver los detalles técnicos aquí.</p>
            </div>
          ) : (
            <div className="space-y-3">

              {/* Validación */}
              <Section title="Validación" icon={<Shield size={11} />}>
                <Row label="Teléfono" value={debug.validacion.telefono} mono />
                <Row
                  label="Autorizado"
                  value={debug.validacion.autorizado ? "✓ Sí" : `✗ No`}
                  color={debug.validacion.autorizado ? "text-green-400" : "text-red-400"}
                />
                {debug.validacion.motivo && (
                  <Row label="Motivo" value={debug.validacion.motivo} color="text-orange-400" />
                )}
              </Section>

              {/* Usuario */}
              {debug.usuario && (
                <Section title="Usuario detectado" icon={<User size={11} />}>
                  <Row label="Nombre" value={debug.usuario.nombre ?? "—"} />
                  <Row label="Rol" value={debug.usuario.rol ?? "externo"} />
                  <Row label="Estado" value={debug.usuario.estado ?? "externo"} />
                  <Row label="Teléfono" value={debug.usuario.tieneTelefono ? "✓ Registrado" : "✗ No tiene"} color={debug.usuario.tieneTelefono ? "text-green-400" : "text-orange-400"} />
                </Section>
              )}

              {/* Clasificación */}
              <Section title="Clasificación" icon={<Tag size={11} />}>
                <Row
                  label="Intención"
                  value={INTENCION_LABELS[debug.clasificacion.intencion] ?? debug.clasificacion.intencion}
                />
                {debug.alias && <Row label="Alias" value={debug.alias} color="text-teal-400" />}
              </Section>

              {/* Sesión */}
              {debug.sesion.activa && (
                <Section title="Sesión anticipo" icon={<Activity size={11} />}>
                  <Row label="Activa" value="Sí" color="text-yellow-400" />
                  <Row label="Estado" value={debug.sesion.estado ?? "—"} />
                </Section>
              )}

              {/* Entidad */}
              <Section title="Entidad" icon={<Database size={11} />}>
                <Row
                  label="Modo"
                  value={debug.entidad.dryRun ? "DRY RUN" : "REAL"}
                  color={debug.entidad.dryRun ? "text-blue-400" : "text-amber-400"}
                />
                <Row label="Tabla" value={debug.entidad.tabla ?? "—"} />
                <Row
                  label="Creada"
                  value={debug.entidad.dryRun ? "No (simulado)" : debug.entidad.creada ? `Sí — #${debug.entidad.id}` : "No"}
                  color={debug.entidad.creada ? "text-green-400" : "text-gray-500"}
                />
              </Section>

              {/* Tiempos */}
              <Section title="Performance" icon={<Clock size={11} />}>
                <Row label="Duración" value={`${debug.duracionMs} ms`} />
                <Row label="Persistencia" value={debug.persistencia === "real" ? "BD Real" : "Simulado"} color={debug.persistencia === "real" ? "text-amber-400" : "text-blue-400"} />
              </Section>

              {/* Errores */}
              {debug.errores.length > 0 && (
                <Section title="Errores" icon={<AlertCircle size={11} />} headerColor="text-red-400">
                  {debug.errores.map((e, i) => (
                    <p key={i} className="text-[10px] text-red-300 font-mono break-all leading-relaxed">{e}</p>
                  ))}
                </Section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children, headerColor = "text-gray-400" }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  headerColor?: string;
}) {
  return (
    <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-2.5">
      <div className={`flex items-center gap-1.5 mb-2 ${headerColor}`}>
        {icon}
        <span className="text-[9px] uppercase tracking-widest font-semibold">{title}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value, color = "text-gray-300", mono = false }: {
  label: string;
  value: string;
  color?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-1 items-start">
      <span className="text-[10px] text-gray-600 shrink-0">{label}</span>
      <span className={`text-[10px] text-right break-all ${color} ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

// Tiny icon helper
function ChevronLeft16() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
