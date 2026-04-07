import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  QrCode, RefreshCw, Printer, Trash2, CheckCircle, XCircle,
  Search, Users, ClipboardList, MapPin, Star, Shield,
  Smartphone, Plus, Copy, Check, MapPinned, ShieldCheck, Footprints,
} from "lucide-react";

const API = "/api";
const getSession = () => {
  try { return sessionStorage.getItem("isp_admin_session_v2") ?? ""; } catch { return ""; }
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
  tipo: "supervisor" | "puesto";
  puesto_id: number | null;
  puesto_nombre: string | null;
  cliente_nombre: string | null;
  activo: boolean;
  tiene_token: boolean;
  ultimo_uso: string | null;
  created_at: string;
}

// ── PrintView (credencial de agente) ──────────────────────────────────────────
function PrintView({ agente, onClose }: { agente: AgenteToken; onClose: () => void }) {
  const origin = window.location.origin;
  const url = `${origin}/agente?token=${agente.qr_token}`;
  const svgRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const svgEl = svgRef.current?.querySelector("svg");
    const svgHtml = svgEl ? new XMLSerializer().serializeToString(svgEl) : "";
    const win = window.open("", "_blank", "width=480,height=700");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Credencial QR · ${agente.nombre_completo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fff; display: flex; justify-content: center; padding: 32px 24px; }
    .card { width: 340px; text-align: center; border: 2px solid #1e3a5f; border-radius: 16px; padding: 28px 20px; }
    .org-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #1e3a5f; margin-bottom: 4px; }
    .nombre { font-size: 20px; font-weight: 900; color: #111827; margin: 8px 0 2px; }
    .cargo { font-size: 12px; color: #4b5563; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
    .puesto { font-size: 11px; color: #9ca3af; margin-bottom: 4px; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 12px 0; }
    .qr-wrap { display: flex; justify-content: center; margin: 12px 0; }
    .qr-wrap svg { display: block; border-radius: 8px; }
    .instruccion { font-size: 10px; color: #9ca3af; line-height: 1.5; margin-top: 8px; }
    .token-id { font-size: 8px; color: #d1d5db; margin-top: 8px; font-family: monospace; }
    @media print { @page { size: 90mm 130mm; margin: 0; } body { padding: 8mm; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="org-label">ISP — Investigaciones y Seguridad Profesional S.A.</div>
    <hr class="divider">
    <div class="nombre">${agente.nombre_completo}</div>
    <div class="cargo">${agente.cargo || agente.tipo_personal || "Agente"}</div>
    ${agente.puesto_nombre ? `<div class="puesto">${agente.puesto_nombre}${agente.cliente_nombre ? " · " + agente.cliente_nombre : ""}</div>` : ""}
    <hr class="divider">
    <div class="qr-wrap">${svgHtml}</div>
    <div class="instruccion">Escanea este código para registrar tu fichaje o supervisión.</div>
    <div class="token-id">ID: ${agente.qr_token?.slice(0, 12)}…</div>
  </div>
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f1724] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
        <div className="text-center mb-4">
          <p className="text-white font-semibold">{agente.nombre_completo}</p>
          <p className="text-white/50 text-sm">{agente.cargo || agente.tipo_personal}</p>
          {agente.puesto_nombre && <p className="text-blue-300/70 text-xs mt-1">{agente.puesto_nombre} · {agente.cliente_nombre}</p>}
        </div>
        <div ref={svgRef} className="flex justify-center bg-white rounded-xl p-4 mb-4">
          <QRCodeSVG value={url} size={200} />
        </div>
        <p className="text-white/30 text-xs text-center mb-4 break-all">{url}</p>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl text-sm text-blue-300 font-semibold transition-colors">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/60 transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

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
function NuevoDispositivoModal({
  onCreado,
  onClose,
}: {
  onCreado: (device: Dispositivo, token: string) => void;
  onClose: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<"supervisor" | "puesto" | "maestro">("supervisor");
  const [puestos, setPuestos] = useState<{ id: number; nombre: string; cliente_nombre: string }[]>([]);
  const [puestoId, setPuestoId] = useState<number | "">("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (tipo === "puesto") {
      f("/puestos-gps").then(r => r.json()).then(data => setPuestos(data)).catch(() => {});
    }
  }, [tipo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!nombre.trim()) { setError("El nombre es requerido"); return; }
    setGuardando(true);
    try {
      const body: Record<string, unknown> = { supervisor_nombre: nombre.trim(), descripcion: descripcion.trim() || undefined, tipo };
      if (tipo === "puesto" && puestoId) body.puesto_id = puestoId;
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
          <div className="flex gap-1.5 flex-wrap">
            <button type="button" onClick={() => setTipo("supervisor")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors min-w-[80px] ${
                tipo === "supervisor" ? "bg-purple-600/20 border-purple-500/40 text-purple-300" : "bg-white/5 border-white/10 text-white/40"
              }`}>
              <ShieldCheck className="w-3.5 h-3.5" /> Supervisor
            </button>
            <button type="button" onClick={() => setTipo("puesto")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors min-w-[80px] ${
                tipo === "puesto" ? "bg-blue-600/20 border-blue-500/40 text-blue-300" : "bg-white/5 border-white/10 text-white/40"
              }`}>
              <MapPinned className="w-3.5 h-3.5" /> Puesto
            </button>
            <button type="button" onClick={() => setTipo("maestro")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors min-w-[80px] ${
                tipo === "maestro" ? "bg-amber-600/20 border-amber-500/40 text-amber-300" : "bg-white/5 border-white/10 text-white/40"
              }`}>
              <span className="text-sm">🧪</span> Maestro
            </button>
          </div>
          <p className="text-white/25 text-xs mt-1.5">
            {tipo === "supervisor" ? "Puede registrar supervisiones en cualquier puesto"
             : tipo === "maestro" ? "Para pruebas: puede fichar, supervisar y marcar rondas"
             : "Solo puede registrar fichajes de llegada"}
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
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 outline-none focus:border-white/20"
            >
              <option value="">Sin puesto específico</option>
              {puestos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre} · {p.cliente_nombre}</option>
              ))}
            </select>
          </div>
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

// ── Página principal ──────────────────────────────────────────────────────────
export default function FichajeQR() {
  const [tab, setTab] = useState<"tokens" | "dispositivos" | "fichajes">("tokens");
  const [agentes, setAgentes] = useState<AgenteToken[]>([]);
  const [fichajes, setFichajes] = useState<Fichaje[]>([]);
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [printAgente, setPrintAgente] = useState<AgenteToken | null>(null);
  const [generando, setGenerando] = useState<number | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<"" | "fichaje" | "supervision" | "ronda">("");
  const [nuevoDispositivoOpen, setNuevoDispositivoOpen] = useState(false);
  const [activacionModal, setActivacionModal] = useState<{ device: Dispositivo; token: string } | null>(null);

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

  useEffect(() => { cargarTokens(); }, []);
  useEffect(() => { if (tab === "fichajes") cargarFichajes(); }, [tab, filtroTipo]);
  useEffect(() => { if (tab === "dispositivos") cargarDispositivos(); }, [tab]);

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

  function handleDispositivoCreado(device: Dispositivo, token: string) {
    setNuevoDispositivoOpen(false);
    setDispositivos(prev => [device as Dispositivo, ...prev]);
    setActivacionModal({ device, token });
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
        {(["tokens", "dispositivos", "fichajes"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors flex items-center gap-2 ${
              tab === t
                ? "bg-blue-600/20 border-blue-500/30 text-blue-300"
                : "bg-white/5 border-white/10 text-white/50 hover:text-white/70"
            }`}>
            {t === "tokens" && <><Users className="w-4 h-4" /> Credenciales</>}
            {t === "dispositivos" && <><Smartphone className="w-4 h-4" /> Dispositivos</>}
            {t === "fichajes" && <><ClipboardList className="w-4 h-4" /> Historial</>}
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
                  {ag.qr_token && (
                    <button onClick={() => setPrintAgente(ag)} title="Ver e imprimir QR"
                      className="p-2 rounded-lg bg-white/5 hover:bg-blue-600/20 border border-white/10 hover:border-blue-500/30 transition-colors">
                      <Printer className="w-4 h-4 text-white/50 hover:text-blue-300" />
                    </button>
                  )}
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
                  {dev.ultimo_uso ? (
                    <p className="text-white/20 text-xs mt-1">Último uso: {new Date(dev.ultimo_uso).toLocaleString("es-HN")}</p>
                  ) : (
                    <p className="text-white/20 text-xs mt-1">Sin uso registrado · {new Date(dev.created_at).toLocaleDateString("es-HN")}</p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!dev.activo ? null : (
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
                  <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 gap-2 text-xs">
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
                    {fich.observaciones && (
                      <p className="col-span-2 text-white/50">Obs: <span className="text-white/70">{fich.observaciones}</span></p>
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

      {/* Modales */}
      {printAgente && <PrintView agente={printAgente} onClose={() => setPrintAgente(null)} />}
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
    </div>
  );
}
