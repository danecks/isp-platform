import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  QrCode, RefreshCw, Trash2, CheckCircle, XCircle,
  Search, Users, ClipboardList, MapPin, Star, Shield,
  Smartphone, Plus, Copy, Check, MapPinned, ShieldCheck, Footprints, Bell, X,
  ShieldAlert, AlertTriangle, Pencil, Truck,
} from "lucide-react";
import { getSessionToken } from "@/lib/httpClient";

const API = "/api";
const getSession = () => {
  try { return getSessionToken(); } catch { return ""; }
};

const CHECK_LABELS: Record<string, string> = {
  uniforme_completo: "Uniforme completo",
  equipo_en_orden: "Equipo de comunicación",
  armamento_ok: "Armamento correcto",
  puesto_limpio: "Área limpia y ordenada",
  bitacora_actualizada: "Bitácora actualizada",
};
const f = (path: string, opts?: RequestInit) =>
  fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
    ...opts,
  });

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface AgenteToken {
  employee_id: number;
  nombre_completo: string;
  cargo: string;
  tipo_personal: string;
  estado_laboral: string;
  dpi: string | null;
  empl_numero: number | null;
  token_id: number | null;
  qr_token: string | null;
  activo: boolean | null;
  created_at: string | null;
  puesto_nombre: string | null;
  cliente_nombre: string | null;
}

interface Fichaje {
  id: number;
  tipo: string;
  resultado: string;
  distancia_metros: number | null;
  calificacion: number | null;
  checks: Record<string, boolean> | null;
  observaciones: string | null;
  registrado_en: string;
  supervisor_nombre: string | null;
  nombre_completo: string;
  cargo: string;
  puesto_nombre: string | null;
  cliente_nombre: string | null;
  device_tipo: string | null;
  device_descripcion: string | null;
}

interface Dispositivo {
  id: number;
  device_uuid: string;
  supervisor_nombre: string;
  descripcion: string | null;
  tipo: "supervisor" | "puesto" | "maestro" | "custodia";
  puesto_id: number | null;
  puesto_nombre: string | null;
  cliente_id: number | null;
  slot_numero: number | null;
  cliente_nombre: string | null;
  novedad: string | null;
  activo: boolean;
  tiene_token: boolean;
  ultimo_uso: string | null;
  created_at: string;
}

interface ClienteOpt { id: number; nombre: string; nombre_comercial: string | null; }

// ── Modal: Activación de dispositivo ─────────────────────────────────────────
function ActivacionModal({
  device,
  deviceToken,
  onClose,
}: {
  device: Dispositivo;
  deviceToken: string;
  onClose: () => void;
}) {
  const origin = window.location.origin;
  const activationUrl = `${origin}/supervisor/activar?uuid=${device.device_uuid}&token=${deviceToken}`;
  const svgRef = useRef<HTMLDivElement>(null);
  const [copiado, setCopiado] = useState(false);

  function copiarUrl() {
    navigator.clipboard.writeText(activationUrl).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  const esPuesto = device.tipo === "puesto";
  const tipoColor = esPuesto ? "blue" : "purple";

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f1724] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
        <div className="text-center mb-5">
          <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3 ${
            esPuesto ? "bg-blue-600/20 border border-blue-500/30" : "bg-purple-600/20 border border-purple-500/30"
          }`}>
            {esPuesto ? <MapPinned className="w-5 h-5 text-blue-400" /> : <ShieldCheck className="w-5 h-5 text-purple-400" />}
          </div>
          <p className="text-white font-semibold">{device.supervisor_nombre}</p>
          <p className="text-white/40 text-sm">{device.descripcion}</p>
          {esPuesto && device.puesto_nombre && (
            <p className="text-blue-300/60 text-xs mt-1">{device.puesto_nombre} · {device.cliente_nombre}</p>
          )}
        </div>

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-4">
          <p className="text-amber-300 text-xs font-semibold mb-1">⚠️ Este enlace solo se muestra una vez</p>
          <p className="text-amber-300/60 text-xs">El token no se puede recuperar. Si lo pierdes, debes revocar y crear un nuevo dispositivo.</p>
        </div>

        <p className="text-white/40 text-xs mb-2 font-semibold uppercase tracking-wide">Escanea con el teléfono que quieres activar:</p>
        <div ref={svgRef} className="flex justify-center bg-white rounded-xl p-4 mb-3">
          <QRCodeSVG value={activationUrl} size={190} />
        </div>

        <p className="text-white/30 text-xs text-center mb-3">O copia el enlace y ábrelo en ese teléfono</p>

        <button
          onClick={copiarUrl}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/60 hover:text-white transition-colors mb-3"
        >
          {copiado ? <><Check className="w-4 h-4 text-green-400" /><span className="text-green-400">Copiado</span></> : <><Copy className="w-4 h-4" /> Copiar enlace</>}
        </button>

        <button onClick={onClose} className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/50 transition-colors">
          Listo — Cerrar
        </button>
      </div>
    </div>
  );
}

// ── Modal: Registro de nuevo dispositivo ──────────────────────────────────────
type DeviceTipo = "supervisor" | "puesto" | "maestro" | "custodia";

function NuevoDispositivoModal({
  onCreado,
  onClose,
}: {
  onCreado: (device: Dispositivo, token: string) => void;
  onClose: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<DeviceTipo>("supervisor");
  const [puestos, setPuestos] = useState<{ id: number; nombre: string; cliente_nombre: string }[]>([]);
  const [puestoId, setPuestoId] = useState<number | "">("");
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [clienteId, setClienteId] = useState<number | "">("");
  const [slotNumero, setSlotNumero] = useState<string>("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (tipo === "puesto") {
      f("/puestos-gps?todos=1").then(r => r.json()).then(data => setPuestos(data)).catch(() => {});
    }
    if (tipo === "custodia" && clientes.length === 0) {
      f("/operaciones/clientes-disponibles").then(r => r.json()).then(setClientes).catch(() => {});
    }
  }, [tipo, clientes.length]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!nombre.trim()) { setError("El nombre es requerido"); return; }
    if (tipo === "custodia" && !clienteId) { setError("Selecciona el cliente para la custodia"); return; }
    setGuardando(true);
    try {
      const body: Record<string, unknown> = { supervisor_nombre: nombre.trim(), descripcion: descripcion.trim() || undefined, tipo };
      if (tipo === "puesto" && puestoId) body.puesto_id = puestoId;
      if (tipo === "custodia") {
        body.cliente_id = clienteId;
        if (slotNumero.trim()) body.slot_numero = Number(slotNumero);
      }
      const res = await f("/supervisor-devices", { method: "POST", body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Error al registrar dispositivo"); return; }
      onCreado(data.device, data.device_token);
    } catch {
      setError("Error de conexión");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-[#0f1724] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-slate-700/50 border border-white/10 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-white/60" />
          </div>
          <div>
            <p className="text-white font-semibold">Registrar dispositivo</p>
            <p className="text-white/40 text-xs">Se generará un enlace de activación único</p>
          </div>
        </div>

        {/* Tipo */}
        <div>
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Tipo de dispositivo</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" onClick={() => setTipo("supervisor")}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                tipo === "supervisor" ? "bg-purple-600/20 border-purple-500/40 text-purple-300" : "bg-white/5 border-white/10 text-white/40"
              }`}>
              <ShieldCheck className="w-3.5 h-3.5" /> Supervisor
            </button>
            <button type="button" onClick={() => setTipo("puesto")}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                tipo === "puesto" ? "bg-blue-600/20 border-blue-500/40 text-blue-300" : "bg-white/5 border-white/10 text-white/40"
              }`}>
              <MapPinned className="w-3.5 h-3.5" /> Puesto
            </button>
            <button type="button" onClick={() => setTipo("custodia")}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                tipo === "custodia" ? "bg-emerald-600/20 border-emerald-500/40 text-emerald-300" : "bg-white/5 border-white/10 text-white/40"
              }`}>
              <Truck className="w-3.5 h-3.5" /> Custodia
            </button>
            <button type="button" onClick={() => setTipo("maestro")}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                tipo === "maestro" ? "bg-amber-600/20 border-amber-500/40 text-amber-300" : "bg-white/5 border-white/10 text-white/40"
              }`}>
              <span className="text-sm">🧪</span> Maestro
            </button>
          </div>
          <p className="text-white/25 text-xs mt-1.5">
            {tipo === "supervisor" ? "Puede registrar supervisiones en cualquier puesto"
             : tipo === "puesto" ? "Teléfono compartido del puesto: muestra los agentes del día"
             : tipo === "custodia" ? "Teléfono de custodia: muestra los custodios del cliente"
             : "Para pruebas: puede fichar, supervisar y marcar rondas"}
          </p>
        </div>

        {/* Nombre */}
        <div>
          <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">
            {tipo === "supervisor" ? "Nombre del supervisor" : "Identificación del teléfono"}
          </label>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder={tipo === "supervisor" ? "Carlos Hernández" : "Puesto Central - Samsung Galaxy"}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none focus:border-white/20"
          />
        </div>

        {/* Descripción */}
        <div>
          <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">Descripción (opcional)</label>
          <input
            type="text"
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            placeholder="iPhone 14 - Turno A"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none focus:border-white/20"
          />
        </div>

        {/* Puesto (solo para tipo puesto) */}
        {tipo === "puesto" && (
          <div>
            <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">Puesto asociado (opcional)</label>
            <select
              value={puestoId}
              onChange={e => setPuestoId(e.target.value ? Number(e.target.value) : "")}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 outline-none focus:border-white/20 [&_option]:bg-slate-800 [&_option]:text-slate-100"
            >
              <option value="">Sin puesto específico</option>
              {puestos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre} · {p.cliente_nombre}</option>
              ))}
            </select>
          </div>
        )}

        {/* Cliente + slot (solo para tipo custodia) */}
        {tipo === "custodia" && (
          <>
            <div>
              <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">Cliente de custodia</label>
              <select
                value={clienteId}
                onChange={e => setClienteId(e.target.value ? Number(e.target.value) : "")}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 outline-none focus:border-white/20 [&_option]:bg-slate-800 [&_option]:text-slate-100"
              >
                <option value="">— Selecciona un cliente —</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre_comercial || c.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">Slot de custodio (opcional)</label>
              <input
                type="number"
                min="1"
                value={slotNumero}
                onChange={e => setSlotNumero(e.target.value)}
                placeholder="Ej: 1, 2, 3 — vacío = todos los custodios del cliente"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none focus:border-white/20"
              />
              <p className="text-white/25 text-xs mt-1">Si lo dejas vacío, el teléfono mostrará la lista de todos los custodios del cliente.</p>
            </div>
          </>
        )}

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white/50 transition-colors hover:bg-white/10">
            Cancelar
          </button>
          <button type="submit" disabled={guardando}
            className="flex-1 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl text-sm text-blue-300 font-semibold transition-colors disabled:opacity-50">
            {guardando ? "Registrando..." : "Registrar"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Modal: Editar dispositivo ────────────────────────────────────────────────
function EditarDispositivoModal({
  device,
  onGuardado,
  onClose,
}: {
  device: Dispositivo;
  onGuardado: () => void;
  onClose: () => void;
}) {
  const [nombre, setNombre] = useState(device.supervisor_nombre);
  const [descripcion, setDescripcion] = useState(device.descripcion ?? "");
  const [tipo, setTipo] = useState<DeviceTipo>(device.tipo);
  const [puestos, setPuestos] = useState<{ id: number; nombre: string; cliente_nombre: string }[]>([]);
  const [puestoId, setPuestoId] = useState<number | "">(device.puesto_id ?? "");
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [clienteId, setClienteId] = useState<number | "">(device.cliente_id ?? "");
  const [slotNumero, setSlotNumero] = useState<string>(device.slot_numero != null ? String(device.slot_numero) : "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (tipo === "puesto" && puestos.length === 0) {
      f("/puestos-gps?todos=1").then(r => r.json()).then(setPuestos).catch(() => {});
    }
    if (tipo === "custodia" && clientes.length === 0) {
      f("/operaciones/clientes-disponibles").then(r => r.json()).then(setClientes).catch(() => {});
    }
  }, [tipo, puestos.length, clientes.length]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!nombre.trim()) { setError("El nombre es requerido"); return; }
    if (tipo === "custodia" && !clienteId) { setError("Selecciona el cliente para la custodia"); return; }
    setGuardando(true);
    try {
      const body: Record<string, unknown> = {
        supervisor_nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        tipo,
        puesto_id: tipo === "puesto" ? (puestoId || null) : null,
        cliente_id: tipo === "custodia" ? (clienteId || null) : null,
        slot_numero: tipo === "custodia" && slotNumero.trim() ? Number(slotNumero) : null,
      };
      const res = await f(`/supervisor-devices/${device.id}`, { method: "PATCH", body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Error al actualizar"); return; }
      onGuardado();
    } catch {
      setError("Error de conexión");
    } finally {
      setGuardando(false);
    }
  }

  const tipoOpts: { v: DeviceTipo; label: string; cls: string; icon: React.ReactNode }[] = [
    { v: "supervisor", label: "Supervisor", cls: "bg-purple-600/20 border-purple-500/40 text-purple-300", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { v: "puesto",     label: "Puesto",     cls: "bg-blue-600/20 border-blue-500/40 text-blue-300",       icon: <MapPinned className="w-3.5 h-3.5" /> },
    { v: "custodia",   label: "Custodia",   cls: "bg-emerald-600/20 border-emerald-500/40 text-emerald-300", icon: <Truck className="w-3.5 h-3.5" /> },
    { v: "maestro",    label: "Maestro",    cls: "bg-amber-600/20 border-amber-500/40 text-amber-300",    icon: <span className="text-sm">🧪</span> },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-[#0f1724] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl bg-slate-700/50 border border-white/10 flex items-center justify-center">
            <Pencil className="w-4 h-4 text-white/60" />
          </div>
          <div>
            <p className="text-white font-semibold">Editar dispositivo</p>
            <p className="text-white/40 text-xs">El token actual no cambia — el teléfono sigue activado</p>
          </div>
        </div>

        <div>
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Tipo de dispositivo</p>
          <div className="grid grid-cols-2 gap-1.5">
            {tipoOpts.map(opt => (
              <button key={opt.v} type="button" onClick={() => setTipo(opt.v)}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
                  tipo === opt.v ? opt.cls : "bg-white/5 border-white/10 text-white/40"
                }`}>
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">Nombre / identificación</label>
          <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 outline-none focus:border-white/20" />
        </div>

        <div>
          <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">Descripción</label>
          <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 outline-none focus:border-white/20" />
        </div>

        {tipo === "puesto" && (
          <div>
            <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">Puesto asociado</label>
            <select value={puestoId} onChange={e => setPuestoId(e.target.value ? Number(e.target.value) : "")}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 outline-none focus:border-white/20 [&_option]:bg-slate-800 [&_option]:text-slate-100">
              <option value="">Sin puesto específico</option>
              {puestos.map(p => <option key={p.id} value={p.id}>{p.nombre} · {p.cliente_nombre}</option>)}
            </select>
          </div>
        )}

        {tipo === "custodia" && (
          <>
            <div>
              <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">Cliente de custodia</label>
              <select value={clienteId} onChange={e => setClienteId(e.target.value ? Number(e.target.value) : "")}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 outline-none focus:border-white/20 [&_option]:bg-slate-800 [&_option]:text-slate-100">
                <option value="">— Selecciona —</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre_comercial || c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">Slot de custodio (opcional)</label>
              <input type="number" min="1" value={slotNumero} onChange={e => setSlotNumero(e.target.value)}
                placeholder="Vacío = todos"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none focus:border-white/20" />
            </div>
          </>
        )}

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white/50 hover:bg-white/10">
            Cancelar
          </button>
          <button type="submit" disabled={guardando}
            className="flex-1 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl text-sm text-blue-300 font-semibold disabled:opacity-50">
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function FichajeQR() {
  const [tab, setTab] = useState<"tokens" | "dispositivos" | "fichajes" | "municion" | "reportes">("tokens");
  const [agentes, setAgentes] = useState<AgenteToken[]>([]);
  const [fichajes, setFichajes] = useState<Fichaje[]>([]);
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [generando, setGenerando] = useState<number | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<"" | "fichaje" | "supervision" | "ronda">("");
  const [nuevoDispositivoOpen, setNuevoDispositivoOpen] = useState(false);
  const [editarDispositivo, setEditarDispositivo] = useState<Dispositivo | null>(null);
  const [activacionModal, setActivacionModal] = useState<{ device: Dispositivo; token: string } | null>(null);
  const [novedadEdit, setNovedadEdit] = useState<{ puesto_id: number; texto: string } | null>(null);
  const [guardandoNovedad, setGuardandoNovedad] = useState(false);

  // Munición
  interface MunicionPuesto {
    id: number; puesto_id: number; puesto_nombre: string; cliente_nombre: string;
    descripcion: string; cantidad_asignada: number; activo: boolean; updated_at: string;
  }
  interface ReporteTurno {
    id: number; puesto_nombre: string; cliente_nombre: string;
    zona_id: number | null; zona_nombre: string | null;
    agente_nombre: string; agente_cargo: string;
    tipo: string; arma_estado: string | null; arma_observacion: string | null;
    municion_ok: boolean | null; municion_faltante: number;
    responsable_anterior_nombre: string | null;
    uniforme_ok: boolean | null; uniforme_items_faltantes: { tipo: string; talla: string }[] | null;
    registrado_en: string;
  }
  const [municiones, setMuniciones] = useState<MunicionPuesto[]>([]);
  const [reportes, setReportes] = useState<ReporteTurno[]>([]);
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [puestosLista, setPuestosLista] = useState<{ id: number; nombre: string; cliente_nombre: string }[]>([]);
  const [municionForm, setMunicionForm] = useState<{ puesto_id: string; descripcion: string; cantidad: string } | null>(null);
  const [guardandoMunicion, setGuardandoMunicion] = useState(false);

  async function cargarTokens() {
    setCargando(true);
    try { const r = await f("/agente/tokens"); if (r.ok) setAgentes(await r.json()); }
    finally { setCargando(false); }
  }

  async function cargarFichajes() {
    setCargando(true);
    try {
      const params = filtroTipo ? `?tipo=${filtroTipo}` : "";
      const r = await f(`/agente/fichajes${params}`); if (r.ok) setFichajes(await r.json());
    } finally { setCargando(false); }
  }

  async function cargarDispositivos() {
    setCargando(true);
    try { const r = await f("/supervisor-devices"); if (r.ok) setDispositivos(await r.json()); }
    finally { setCargando(false); }
  }

  async function cargarMuniciones() {
    setCargando(true);
    try {
      const [rM, rP] = await Promise.all([f("/municion-puestos"), f("/puestos-gps")]);
      if (rM.ok) setMuniciones(await rM.json());
      // Reusar la lista de puestos del GPS endpoint (tiene id, nombre, cliente_nombre)
      if (rP.ok) {
        const data = await rP.json();
        setPuestosLista(data.map((p: any) => ({ id: p.id, nombre: p.nombre, cliente_nombre: p.cliente_nombre })));
      }
    } finally { setCargando(false); }
  }

  async function cargarReportes() {
    setCargando(true);
    try {
      const qs = soloAlertas ? "?solo_alertas=true" : "";
      const r = await f(`/agente/reportes-turno${qs}`);
      if (r.ok) setReportes(await r.json());
    } finally { setCargando(false); }
  }

  async function guardarMunicion() {
    if (!municionForm) return;
    setGuardandoMunicion(true);
    try {
      await f("/municion-puestos", {
        method: "POST",
        body: JSON.stringify({ puesto_id: Number(municionForm.puesto_id), descripcion: municionForm.descripcion, cantidad_asignada: Number(municionForm.cantidad) }),
      });
      setMunicionForm(null);
      await cargarMuniciones();
    } finally { setGuardandoMunicion(false); }
  }

  async function eliminarMunicion(id: number) {
    if (!confirm("¿Quitar la asignación de munición de este puesto?")) return;
    await f(`/municion-puestos/${id}`, { method: "DELETE" });
    await cargarMuniciones();
  }

  useEffect(() => { cargarTokens(); }, []);
  useEffect(() => { if (tab === "fichajes") cargarFichajes(); }, [tab, filtroTipo]);
  useEffect(() => { if (tab === "dispositivos") cargarDispositivos(); }, [tab]);
  useEffect(() => { if (tab === "municion") cargarMuniciones(); }, [tab]);
  useEffect(() => { if (tab === "reportes") cargarReportes(); }, [tab, soloAlertas]);

  async function generarToken(employeeId: number) {
    setGenerando(employeeId);
    try {
      const r = await f("/agente/tokens/generate", { method: "POST", body: JSON.stringify({ employee_id: employeeId }) });
      if (r.ok) await cargarTokens();
    } finally { setGenerando(null); }
  }

  async function revocarToken(tokenId: number) {
    if (!confirm("¿Revocar este token? El agente no podrá fichar hasta que se genere uno nuevo.")) return;
    await f(`/agente/tokens/${tokenId}`, { method: "DELETE" });
    await cargarTokens();
  }

  async function revocarDispositivo(id: number) {
    if (!confirm("¿Revocar este dispositivo? El teléfono no podrá fichar ni supervisar hasta ser re-registrado.")) return;
    await f(`/supervisor-devices/${id}`, { method: "DELETE" });
    await cargarDispositivos();
  }

  async function regenerarDispositivo(id: number) {
    if (!confirm("¿Generar un nuevo enlace de activación? El enlace anterior quedará inválido y el teléfono deberá ser re-activado.")) return;
    try {
      const r = await f(`/supervisor-devices/${id}/regenerate-token`, { method: "POST" });
      if (!r.ok) return;
      const data = await r.json();
      if (data.ok && data.device && data.device_token) {
        await cargarDispositivos();
        setActivacionModal({ device: data.device as Dispositivo, token: data.device_token });
      }
    } catch { /* silent */ }
  }

  function handleDispositivoCreado(device: Dispositivo, token: string) {
    setNuevoDispositivoOpen(false);
    setDispositivos(prev => [device as Dispositivo, ...prev]);
    setActivacionModal({ device, token });
  }

  async function guardarNovedad(puestoId: number, texto: string) {
    setGuardandoNovedad(true);
    try {
      const r = await f(`/agente/puesto-novedad/${puestoId}`, {
        method: "PATCH",
        body: JSON.stringify({ novedad: texto.trim() || null }),
      });
      if (r.ok) {
        setDispositivos(ds => ds.map(d =>
          d.puesto_id === puestoId ? { ...d, novedad: texto.trim() || null } : d
        ));
        setNovedadEdit(null);
      }
    } finally { setGuardandoNovedad(false); }
  }

  const agentesFiltrados = agentes.filter(a =>
    a.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
    (a.cargo || "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (a.puesto_nombre || "").toLowerCase().includes(busqueda.toLowerCase())
  );

  function ResultadoBadge({ resultado }: { resultado: string }) {
    if (resultado === "ok") return <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">ok</span>;
    if (resultado === "fuera_de_zona") return <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">fuera de zona</span>;
    return <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">sin GPS</span>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
          <QrCode className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-white font-bold text-xl">QR Fichaje de Agentes</h1>
          <p className="text-white/40 text-sm">Credenciales QR, dispositivos autenticados e historial</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(["tokens", "dispositivos", "fichajes", "municion", "reportes"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors flex items-center gap-2 ${
              tab === t
                ? "bg-blue-600/20 border-blue-500/30 text-blue-300"
                : "bg-white/5 border-white/10 text-white/50 hover:text-white/70"
            }`}>
            {t === "tokens" && <><Users className="w-4 h-4" /> Credenciales</>}
            {t === "dispositivos" && <><Smartphone className="w-4 h-4" /> Dispositivos</>}
            {t === "fichajes" && <><ClipboardList className="w-4 h-4" /> Historial</>}
            {t === "municion" && <><ShieldAlert className="w-4 h-4" /> Munición</>}
            {t === "reportes" && <><AlertTriangle className="w-4 h-4" /> Reportes de turno</>}
          </button>
        ))}
      </div>

      {/* ── TAB TOKENS ──────────────────────────────────────────────────────── */}
      {tab === "tokens" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar agente..."
                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 outline-none" />
            </div>
            <span className="text-white/30 text-sm">{agentesFiltrados.length} agentes</span>
          </div>

          <div className="space-y-2">
            {cargando && <p className="text-white/30 text-sm text-center py-8">Cargando...</p>}
            {!cargando && agentesFiltrados.map(ag => (
              <div key={ag.employee_id} className="bg-white/4 border border-white/8 rounded-xl p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-slate-700 border border-white/10 flex items-center justify-center shrink-0">
                  <span className="text-white/70 text-sm font-semibold">{ag.nombre_completo.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{ag.nombre_completo}</p>
                  <p className="text-white/40 text-xs">{ag.cargo || ag.tipo_personal}</p>
                  {ag.puesto_nombre && (
                    <p className="text-blue-300/60 text-xs flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />{ag.puesto_nombre} · {ag.cliente_nombre}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {ag.qr_token ? (
                    <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full flex items-center gap-1 mb-1">
                      <CheckCircle className="w-3 h-3" /> Token activo
                    </span>
                  ) : (
                    <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full flex items-center gap-1 mb-1">
                      <XCircle className="w-3 h-3" /> Sin token
                    </span>
                  )}
                  {ag.created_at && <p className="text-white/20 text-xs">{new Date(ag.created_at).toLocaleDateString("es-HN")}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => generarToken(ag.employee_id)} disabled={generando === ag.employee_id}
                    title={ag.qr_token ? "Regenerar token" : "Generar token"}
                    className="p-2 rounded-lg bg-white/5 hover:bg-green-600/20 border border-white/10 hover:border-green-500/30 transition-colors disabled:opacity-40">
                    <RefreshCw className={`w-4 h-4 text-white/50 hover:text-green-300 ${generando === ag.employee_id ? "animate-spin" : ""}`} />
                  </button>
                  {ag.token_id && (
                    <button onClick={() => revocarToken(ag.token_id!)} title="Revocar token"
                      className="p-2 rounded-lg bg-white/5 hover:bg-red-600/20 border border-white/10 hover:border-red-500/30 transition-colors">
                      <Trash2 className="w-4 h-4 text-white/50 hover:text-red-300" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!cargando && agentesFiltrados.length === 0 && (
              <p className="text-white/30 text-sm text-center py-12">No se encontraron agentes</p>
            )}
          </div>
        </div>
      )}

      {/* ── TAB DISPOSITIVOS ─────────────────────────────────────────────────── */}
      {tab === "dispositivos" && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-white/60 text-sm">Teléfonos registrados como dispositivos de confianza.</p>
              <p className="text-white/30 text-xs mt-0.5">Solo estos teléfonos pueden registrar fichajes o supervisiones.</p>
            </div>
            <button
              onClick={() => setNuevoDispositivoOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl text-sm text-blue-300 font-semibold transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" /> Registrar teléfono
            </button>
          </div>

          {cargando && <p className="text-white/30 text-sm text-center py-8">Cargando...</p>}
          {!cargando && dispositivos.length === 0 && (
            <div className="text-center py-12">
              <Smartphone className="w-12 h-12 text-white/10 mx-auto mb-3" />
              <p className="text-white/30 text-sm">No hay dispositivos registrados</p>
              <p className="text-white/20 text-xs mt-1">Registra el teléfono del puesto y el del supervisor para comenzar</p>
            </div>
          )}

          <div className="space-y-2">
            {!cargando && dispositivos.map(dev => (
              <div key={dev.id} className={`bg-white/4 border rounded-xl p-4 flex items-center gap-4 ${
                dev.activo ? "border-white/8" : "border-white/5 opacity-50"
              }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  dev.tipo === "supervisor" ? "bg-purple-600/20 border border-purple-500/30"
                  : dev.tipo === "maestro" ? "bg-amber-600/20 border border-amber-500/30"
                  : "bg-blue-600/20 border border-blue-500/30"
                }`}>
                  {dev.tipo === "supervisor" ? <ShieldCheck className="w-5 h-5 text-purple-400" />
                   : dev.tipo === "maestro" ? <span className="text-base">🧪</span>
                   : <MapPinned className="w-5 h-5 text-blue-400" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-semibold">{dev.supervisor_nombre}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      dev.tipo === "supervisor" ? "bg-purple-500/10 text-purple-300"
                      : dev.tipo === "maestro" ? "bg-amber-500/10 text-amber-300"
                      : "bg-blue-500/10 text-blue-300"
                    }`}>
                      {dev.tipo === "supervisor" ? "Supervisor" : dev.tipo === "maestro" ? "Maestro" : "Puesto"}
                    </span>
                    {!dev.activo && <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">Revocado</span>}
                  </div>
                  {dev.descripcion && <p className="text-white/40 text-xs mt-0.5">{dev.descripcion}</p>}
                  {dev.tipo === "puesto" && dev.puesto_nombre && (
                    <p className="text-blue-300/60 text-xs flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />{dev.puesto_nombre} · {dev.cliente_nombre}
                    </p>
                  )}
                  {dev.tipo === "puesto" && dev.novedad && novedadEdit?.puesto_id !== (dev.puesto_id ?? undefined) && (
                    <p className="text-yellow-300/50 text-xs flex items-start gap-1 mt-1">
                      <Bell className="w-3 h-3 shrink-0 mt-0.5" />
                      <span className="line-clamp-2 leading-relaxed">{dev.novedad}</span>
                    </p>
                  )}
                  {dev.tipo === "puesto" && novedadEdit?.puesto_id === dev.puesto_id && (
                    <div className="mt-2">
                      <textarea
                        value={novedadEdit.texto}
                        onChange={e => setNovedadEdit({ ...novedadEdit, texto: e.target.value })}
                        rows={3}
                        placeholder="Escribe la novedad del puesto (visible al agente al fichar)..."
                        className="w-full text-xs bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-2 text-white/70 placeholder-white/20 outline-none resize-none"
                      />
                      <div className="flex gap-1.5 mt-1.5">
                        <button
                          onClick={() => guardarNovedad(dev.puesto_id!, novedadEdit.texto)}
                          disabled={guardandoNovedad}
                          className="flex-1 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 rounded-lg text-xs text-yellow-300 font-semibold transition-colors disabled:opacity-50"
                        >
                          {guardandoNovedad ? "Guardando..." : "Guardar novedad"}
                        </button>
                        <button onClick={() => setNovedadEdit(null)}
                          className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg">
                          <X className="w-3.5 h-3.5 text-white/40" />
                        </button>
                      </div>
                    </div>
                  )}
                  {dev.ultimo_uso ? (
                    <p className="text-white/20 text-xs mt-1">Último uso: {new Date(dev.ultimo_uso).toLocaleString("es-HN")}</p>
                  ) : (
                    <p className="text-white/20 text-xs mt-1">Sin uso registrado · {new Date(dev.created_at).toLocaleDateString("es-HN")}</p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {dev.tipo === "puesto" && dev.puesto_id && (
                    <button
                      onClick={() => novedadEdit?.puesto_id === dev.puesto_id
                        ? setNovedadEdit(null)
                        : setNovedadEdit({ puesto_id: dev.puesto_id!, texto: dev.novedad ?? "" })
                      }
                      title={dev.novedad ? "Editar novedad del puesto" : "Agregar novedad al puesto"}
                      className={`p-2 rounded-lg border transition-colors ${
                        dev.novedad
                          ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
                          : "bg-white/5 border-white/10 text-white/50 hover:bg-yellow-600/20 hover:border-yellow-500/30"
                      }`}
                    >
                      <Bell className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setEditarDispositivo(dev)}
                    title="Editar dispositivo (cambiar tipo, puesto, cliente)"
                    className="p-2 rounded-lg bg-white/5 hover:bg-blue-600/20 border border-white/10 hover:border-blue-500/30 transition-colors"
                  >
                    <Pencil className="w-4 h-4 text-white/50 hover:text-blue-300" />
                  </button>
                  <button
                    onClick={() => regenerarDispositivo(dev.id)}
                    title="Generar nuevo enlace de activación"
                    className="p-2 rounded-lg bg-white/5 hover:bg-green-600/20 border border-white/10 hover:border-green-500/30 transition-colors"
                  >
                    <QrCode className="w-4 h-4 text-white/50 hover:text-green-300" />
                  </button>
                  {dev.activo && (
                    <button onClick={() => revocarDispositivo(dev.id)} title="Revocar dispositivo"
                      className="p-2 rounded-lg bg-white/5 hover:bg-red-600/20 border border-white/10 hover:border-red-500/30 transition-colors">
                      <Trash2 className="w-4 h-4 text-white/50 hover:text-red-300" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB FICHAJES ────────────────────────────────────────────────────── */}
      {tab === "fichajes" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex gap-1 flex-wrap">
              {(["", "fichaje", "supervision", "ronda"] as const).map(tipo => (
                <button key={tipo} onClick={() => setFiltroTipo(tipo)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    filtroTipo === tipo
                      ? "bg-blue-600/20 border-blue-500/30 text-blue-300"
                      : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
                  }`}>
                  {tipo === "" ? "Todos" : tipo === "fichaje" ? "Fichajes" : tipo === "supervision" ? "Supervisiones" : "🧪 Rondas"}
                </button>
              ))}
            </div>
            <button onClick={cargarFichajes} className="ml-auto p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white/70">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {cargando && <p className="text-white/30 text-sm text-center py-8">Cargando...</p>}
            {!cargando && fichajes.map(fich => (
              <div key={fich.id} className="bg-white/4 border border-white/8 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      fich.tipo === "supervision" ? "bg-purple-600/20 border border-purple-500/30"
                      : fich.tipo === "ronda" ? "bg-green-600/20 border border-green-500/30"
                      : "bg-blue-600/20 border border-blue-500/30"
                    }`}>
                      {fich.tipo === "supervision" ? <Shield className="w-4 h-4 text-purple-400" />
                       : fich.tipo === "ronda" ? <Footprints className="w-4 h-4 text-green-400" />
                       : <CheckCircle className="w-4 h-4 text-blue-400" />}
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">{fich.nombre_completo}</p>
                      {fich.puesto_nombre && <p className="text-white/40 text-xs">{fich.puesto_nombre} · {fich.cliente_nombre}</p>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <ResultadoBadge resultado={fich.resultado} />
                    <p className="text-white/30 text-xs mt-1">{new Date(fich.registrado_en).toLocaleString("es-HN")}</p>
                  </div>
                </div>

                {fich.tipo === "supervision" && (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      {fich.supervisor_nombre && (
                        <p className="text-white/50">Supervisor: <span className="text-white/80">{fich.supervisor_nombre}</span></p>
                      )}
                      {fich.calificacion && (
                        <div className="flex items-center gap-1">
                          <span className="text-white/50">Cal.:</span>
                          <div className="flex">
                            {[1,2,3,4,5].map(n => (
                              <Star key={n} className={`w-3 h-3 ${n <= fich.calificacion! ? "text-amber-400 fill-amber-400" : "text-white/15"}`} />
                            ))}
                          </div>
                        </div>
                      )}
                      {fich.distancia_metros != null && (
                        <p className="text-white/50 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {fich.distancia_metros}m del puesto
                        </p>
                      )}
                    </div>

                    {fich.checks && Object.keys(fich.checks).length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {Object.entries(fich.checks).map(([k, v]) => (
                          <span key={k} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${
                            v ? "text-green-400/80 bg-green-500/5 border-green-500/20"
                              : "text-red-400/60 bg-red-500/5 border-red-500/15 line-through opacity-60"
                          }`}>
                            {v ? "✓" : "✗"} {CHECK_LABELS[k] ?? k}
                          </span>
                        ))}
                      </div>
                    )}

                    {fich.observaciones && (
                      <p className="text-white/50 pt-1 border-t border-white/5">Obs: <span className="text-white/70">{fich.observaciones}</span></p>
                    )}
                  </div>
                )}
                {fich.tipo === "fichaje" && fich.distancia_metros != null && (
                  <div className="mt-2 pt-2 border-t border-white/5">
                    <p className="text-white/30 text-xs flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {fich.distancia_metros}m del puesto
                      {fich.device_descripcion && <span className="ml-2 text-white/20">· {fich.device_descripcion}</span>}
                    </p>
                  </div>
                )}
              </div>
            ))}
            {!cargando && fichajes.length === 0 && (
              <p className="text-white/30 text-sm text-center py-12">No hay registros todavía</p>
            )}
          </div>
        </div>
      )}

      {/* ── TAB MUNICIÓN ────────────────────────────────────────────────────── */}
      {tab === "municion" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-white/40 text-sm">{municiones.length} puestos con munición asignada</p>
            <button onClick={() => setMunicionForm({ puesto_id: "", descripcion: "9mm Luger", cantidad: "" })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/15 hover:bg-amber-600/25 border border-amber-500/25 rounded-xl text-xs text-amber-300 font-semibold transition-colors">
              <Plus className="w-3.5 h-3.5" /> Asignar munición a puesto
            </button>
          </div>

          {municionForm && (
            <div className="bg-white/5 border border-amber-500/20 rounded-2xl p-4 mb-4 space-y-3">
              <p className="text-amber-300/70 text-xs font-semibold uppercase tracking-wide">Nueva asignación de munición</p>
              <select value={municionForm.puesto_id} onChange={e => setMunicionForm(prev => prev ? { ...prev, puesto_id: e.target.value } : prev)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 outline-none [&_option]:bg-slate-800 [&_option]:text-slate-100">
                <option value="">Seleccionar puesto…</option>
                {puestosLista.map(p => <option key={p.id} value={p.id}>{p.nombre} · {p.cliente_nombre}</option>)}
              </select>
              <input value={municionForm.descripcion} onChange={e => setMunicionForm(prev => prev ? { ...prev, descripcion: e.target.value } : prev)}
                placeholder="Tipo de munición (ej: 9mm Luger)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder-white/20 outline-none" />
              <div className="flex items-center gap-2">
                <input type="number" min={0} value={municionForm.cantidad} onChange={e => setMunicionForm(prev => prev ? { ...prev, cantidad: e.target.value } : prev)}
                  placeholder="Cantidad asignada"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder-white/20 outline-none" />
                <span className="text-white/30 text-xs shrink-0">cartuchos</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setMunicionForm(null)}
                  className="flex-1 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white/50 transition-colors hover:bg-white/10">Cancelar</button>
                <button onClick={guardarMunicion} disabled={guardandoMunicion || !municionForm.puesto_id || !municionForm.cantidad}
                  className="flex-1 py-2 bg-amber-600/15 hover:bg-amber-600/25 border border-amber-500/25 rounded-xl text-sm text-amber-300 font-semibold transition-colors disabled:opacity-50">
                  {guardandoMunicion ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          )}

          {cargando && <p className="text-white/30 text-sm text-center py-8">Cargando...</p>}
          {!cargando && municiones.length === 0 && (
            <p className="text-white/20 text-sm text-center py-8">Sin puestos con munición asignada. Usa el botón de arriba para asignar.</p>
          )}
          {/* Agrupado por cliente */}
          {(() => {
            const porCliente = new Map<string, typeof municiones>();
            for (const m of municiones) {
              const cli = m.cliente_nombre || "Sin cliente";
              if (!porCliente.has(cli)) porCliente.set(cli, []);
              porCliente.get(cli)!.push(m);
            }
            return (
              <div className="space-y-5">
                {Array.from(porCliente.entries()).map(([cliente, items]) => (
                  <div key={cliente}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-px flex-1 bg-white/8" />
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                        <span className="text-amber-300/80 text-xs font-bold tracking-wide uppercase">{cliente}</span>
                        <span className="text-white/30 text-xs">{items.length} puesto{items.length !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="h-px flex-1 bg-white/8" />
                    </div>
                    <div className="space-y-2 pl-3 border-l border-amber-500/10">
                      {items.map(m => (
                        <div key={m.id} className="bg-white/3 border border-amber-500/10 rounded-xl p-4 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-amber-200/80 text-sm font-semibold">{m.puesto_nombre}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-white/70 text-sm font-mono font-semibold">{m.cantidad_asignada}</span>
                              <span className="text-white/30 text-xs">cartuchos</span>
                              <span className="text-white/40 text-xs">{m.descripcion}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button onClick={() => setMunicionForm({ puesto_id: String(m.puesto_id), descripcion: m.descripcion, cantidad: String(m.cantidad_asignada) })}
                              className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors text-white/40 hover:text-white/60">
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => eliminarMunicion(m.id)}
                              className="p-1.5 bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 rounded-lg transition-colors text-red-400/50 hover:text-red-400">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── TAB REPORTES DE TURNO ───────────────────────────────────────────── */}
      {tab === "reportes" && (() => {
        // Build nested map: cliente → zona → reportes[]
        const porCliente = new Map<string, Map<string, ReporteTurno[]>>();
        for (const r of reportes) {
          const cli = r.cliente_nombre || "Sin cliente";
          const zona = r.zona_nombre || "Sin zona asignada";
          if (!porCliente.has(cli)) porCliente.set(cli, new Map());
          const porZona = porCliente.get(cli)!;
          if (!porZona.has(zona)) porZona.set(zona, []);
          porZona.get(zona)!.push(r);
        }
        const renderReporte = (r: ReporteTurno) => {
          const tieneAlerta = r.municion_ok === false || r.arma_estado === "necesita_reparacion" || r.uniforme_ok === false;
          return (
            <div key={r.id} className={`rounded-xl border p-4 space-y-3 ${tieneAlerta ? "bg-red-500/3 border-red-500/15" : "bg-white/3 border-white/8"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-white/80 text-sm font-semibold">{r.agente_nombre}</p>
                  <p className="text-white/30 text-xs">{r.puesto_nombre}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white/30 text-xs">{new Date(r.registrado_en).toLocaleString("es-HN", { dateStyle: "short", timeStyle: "short" })}</p>
                  <span className={`text-xs font-semibold ${r.tipo === "supervision" ? "text-purple-400/60" : "text-blue-400/60"}`}>{r.tipo}</span>
                </div>
              </div>
              {r.arma_estado && (
                <div className={`flex items-start gap-2 rounded-lg p-2.5 ${r.arma_estado === "necesita_reparacion" ? "bg-red-500/8 border border-red-500/15" : "bg-green-500/5 border border-green-500/10"}`}>
                  <ShieldAlert className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${r.arma_estado === "necesita_reparacion" ? "text-red-400" : "text-green-400"}`} />
                  <div>
                    <p className={`text-xs font-semibold ${r.arma_estado === "necesita_reparacion" ? "text-red-300" : "text-green-300"}`}>
                      Arma: {r.arma_estado === "bueno" ? "Buen estado" : "Necesita reparación"}
                    </p>
                    {r.arma_observacion && <p className="text-white/50 text-xs mt-0.5">{r.arma_observacion}</p>}
                  </div>
                </div>
              )}
              {r.municion_ok !== null && (
                <div className={`flex items-start gap-2 rounded-lg p-2.5 ${r.municion_ok === false ? "bg-red-500/8 border border-red-500/15" : "bg-green-500/5 border border-green-500/10"}`}>
                  <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${r.municion_ok === false ? "text-red-400" : "text-green-400"}`} />
                  <div className="flex-1">
                    <p className={`text-xs font-semibold ${r.municion_ok === false ? "text-red-300" : "text-green-300"}`}>
                      Munición: {r.municion_ok ? "Completa" : `Faltan ${r.municion_faltante} cartuchos`}
                    </p>
                    {r.municion_ok === false && r.responsable_anterior_nombre && (
                      <p className="text-white/50 text-xs mt-1">
                        <span className="text-red-300/80 font-semibold">Responsable anterior: </span>
                        {r.responsable_anterior_nombre}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {r.uniforme_ok !== null && (
                <div className={`flex items-start gap-2 rounded-lg p-2.5 ${r.uniforme_ok === false ? "bg-amber-500/8 border border-amber-500/15" : "bg-green-500/5 border border-green-500/10"}`}>
                  <Users className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${r.uniforme_ok === false ? "text-amber-400" : "text-green-400"}`} />
                  <div>
                    <p className={`text-xs font-semibold ${r.uniforme_ok === false ? "text-amber-300" : "text-green-300"}`}>
                      Uniforme: {r.uniforme_ok ? "Completo" : "Necesita dotación"}
                    </p>
                    {r.uniforme_ok === false && r.uniforme_items_faltantes && r.uniforme_items_faltantes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {r.uniforme_items_faltantes.map((item, i) => (
                          <span key={i} className="text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-0.5 text-amber-200/60">
                            {item.tipo}{item.talla ? ` · T${item.talla}` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        };
        return (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setSoloAlertas(false)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${!soloAlertas ? "bg-blue-600/20 border-blue-500/30 text-blue-300" : "bg-white/5 border-white/10 text-white/40"}`}>
                Todos
              </button>
              <button onClick={() => setSoloAlertas(true)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 ${soloAlertas ? "bg-red-500/20 border-red-500/30 text-red-300" : "bg-white/5 border-white/10 text-white/40"}`}>
                <AlertTriangle className="w-3 h-3" /> Solo alertas
              </button>
              <span className="text-white/30 text-xs ml-auto">{reportes.length} registros</span>
            </div>
            {cargando && <p className="text-white/30 text-sm text-center py-8">Cargando...</p>}
            {!cargando && reportes.length === 0 && (
              <p className="text-white/20 text-sm text-center py-8">Sin reportes de turno{soloAlertas ? " con alertas" : ""} aún.</p>
            )}
            <div className="space-y-6">
              {Array.from(porCliente.entries()).map(([cliente, zonas]) => {
                const totalCliente = Array.from(zonas.values()).reduce((s, a) => s + a.length, 0);
                const alertasCliente = Array.from(zonas.values()).flat().filter(r =>
                  r.municion_ok === false || r.arma_estado === "necesita_reparacion" || r.uniforme_ok === false).length;
                return (
                  <div key={cliente}>
                    {/* ── Cabecera de cliente ── */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-px flex-1 bg-white/8" />
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                        <span className="text-blue-300/80 text-xs font-bold tracking-wide uppercase">{cliente}</span>
                        <span className="text-white/30 text-xs">{totalCliente}</span>
                        {alertasCliente > 0 && (
                          <span className="flex items-center gap-1 text-red-400 text-xs font-semibold">
                            <AlertTriangle className="w-3 h-3" />{alertasCliente}
                          </span>
                        )}
                      </div>
                      <div className="h-px flex-1 bg-white/8" />
                    </div>
                    {/* ── Zonas dentro del cliente ── */}
                    <div className="space-y-4">
                      {Array.from(zonas.entries()).map(([zona, items]) => {
                        const alertasZona = items.filter(r =>
                          r.municion_ok === false || r.arma_estado === "necesita_reparacion" || r.uniforme_ok === false).length;
                        return (
                          <div key={zona}>
                            <div className="flex items-center gap-2 mb-2 pl-1">
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${alertasZona > 0 ? "bg-red-400" : "bg-white/20"}`} />
                              <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">{zona}</span>
                              <span className="text-white/20 text-xs">{items.length} reporte{items.length !== 1 ? "s" : ""}</span>
                              {alertasZona > 0 && (
                                <span className="text-red-400/70 text-xs">{alertasZona} alerta{alertasZona !== 1 ? "s" : ""}</span>
                              )}
                            </div>
                            <div className="space-y-2 pl-3 border-l border-white/6">
                              {items.map(r => renderReporte(r))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Modales */}
      {nuevoDispositivoOpen && (
        <NuevoDispositivoModal onCreado={handleDispositivoCreado} onClose={() => setNuevoDispositivoOpen(false)} />
      )}
      {activacionModal && (
        <ActivacionModal
          device={activacionModal.device}
          deviceToken={activacionModal.token}
          onClose={() => setActivacionModal(null)}
        />
      )}
      {editarDispositivo && (
        <EditarDispositivoModal
          device={editarDispositivo}
          onGuardado={() => { setEditarDispositivo(null); void cargarDispositivos(); }}
          onClose={() => setEditarDispositivo(null)}
        />
      )}
    </div>
  );
}
