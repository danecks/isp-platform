import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  QrCode, RefreshCw, Printer, Trash2, CheckCircle, XCircle,
  Search, Users, ClipboardList, MapPin, Star, Shield,
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
}

// ── PrintView ─────────────────────────────────────────────────────────────────
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

// ── Página principal ──────────────────────────────────────────────────────────
export default function FichajeQR() {
  const [tab, setTab] = useState<"tokens" | "fichajes">("tokens");
  const [agentes, setAgentes] = useState<AgenteToken[]>([]);
  const [fichajes, setFichajes] = useState<Fichaje[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [printAgente, setPrintAgente] = useState<AgenteToken | null>(null);
  const [generando, setGenerando] = useState<number | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<"" | "fichaje" | "supervision">("");

  async function cargarTokens() {
    setCargando(true);
    try {
      const res = await f("/agente/tokens");
      if (res.ok) setAgentes(await res.json());
    } finally { setCargando(false); }
  }

  async function cargarFichajes() {
    setCargando(true);
    try {
      const params = filtroTipo ? `?tipo=${filtroTipo}` : "";
      const res = await f(`/agente/fichajes${params}`);
      if (res.ok) setFichajes(await res.json());
    } finally { setCargando(false); }
  }

  useEffect(() => { cargarTokens(); }, []);
  useEffect(() => { if (tab === "fichajes") cargarFichajes(); }, [tab, filtroTipo]);

  async function generarToken(employeeId: number) {
    setGenerando(employeeId);
    try {
      const res = await f("/agente/tokens/generate", {
        method: "POST",
        body: JSON.stringify({ employee_id: employeeId }),
      });
      if (res.ok) await cargarTokens();
    } finally { setGenerando(null); }
  }

  async function revocarToken(tokenId: number) {
    if (!confirm("¿Revocar este token? El agente no podrá fichar hasta que se genere uno nuevo.")) return;
    await f(`/agente/tokens/${tokenId}`, { method: "DELETE" });
    await cargarTokens();
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
          <p className="text-white/40 text-sm">Credenciales QR para registro de asistencia y supervisión</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["tokens", "fichajes"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors flex items-center gap-2 ${
              tab === t
                ? "bg-blue-600/20 border-blue-500/30 text-blue-300"
                : "bg-white/5 border-white/10 text-white/50 hover:text-white/70"
            }`}>
            {t === "tokens" ? <><Users className="w-4 h-4" /> Credenciales</> : <><ClipboardList className="w-4 h-4" /> Historial</>}
          </button>
        ))}
      </div>

      {/* ── TAB TOKENS ──────────────────────────────────────────────────────── */}
      {tab === "tokens" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar agente..."
                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 outline-none"
              />
            </div>
            <span className="text-white/30 text-sm">{agentesFiltrados.length} agentes</span>
          </div>

          <div className="space-y-2">
            {cargando && <p className="text-white/30 text-sm text-center py-8">Cargando...</p>}
            {!cargando && agentesFiltrados.map(ag => (
              <div key={ag.employee_id} className="bg-white/4 border border-white/8 rounded-xl p-4 flex items-center gap-4">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-slate-700 border border-white/10 flex items-center justify-center shrink-0">
                  <span className="text-white/70 text-sm font-semibold">{ag.nombre_completo.charAt(0)}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{ag.nombre_completo}</p>
                  <p className="text-white/40 text-xs">{ag.cargo || ag.tipo_personal}</p>
                  {ag.puesto_nombre && (
                    <p className="text-blue-300/60 text-xs flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />{ag.puesto_nombre} · {ag.cliente_nombre}
                    </p>
                  )}
                </div>

                {/* Token status */}
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
                  {ag.created_at && (
                    <p className="text-white/20 text-xs">{new Date(ag.created_at).toLocaleDateString("es-HN")}</p>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1 shrink-0">
                  {ag.qr_token && (
                    <button
                      onClick={() => setPrintAgente(ag)}
                      title="Ver e imprimir QR"
                      className="p-2 rounded-lg bg-white/5 hover:bg-blue-600/20 border border-white/10 hover:border-blue-500/30 transition-colors"
                    >
                      <Printer className="w-4 h-4 text-white/50 hover:text-blue-300" />
                    </button>
                  )}
                  <button
                    onClick={() => generarToken(ag.employee_id)}
                    disabled={generando === ag.employee_id}
                    title={ag.qr_token ? "Regenerar token" : "Generar token"}
                    className="p-2 rounded-lg bg-white/5 hover:bg-green-600/20 border border-white/10 hover:border-green-500/30 transition-colors disabled:opacity-40"
                  >
                    <RefreshCw className={`w-4 h-4 text-white/50 hover:text-green-300 ${generando === ag.employee_id ? "animate-spin" : ""}`} />
                  </button>
                  {ag.token_id && (
                    <button
                      onClick={() => revocarToken(ag.token_id!)}
                      title="Revocar token"
                      className="p-2 rounded-lg bg-white/5 hover:bg-red-600/20 border border-white/10 hover:border-red-500/30 transition-colors"
                    >
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

      {/* ── TAB FICHAJES ────────────────────────────────────────────────────── */}
      {tab === "fichajes" && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex gap-1">
              {(["", "fichaje", "supervision"] as const).map(tipo => (
                <button key={tipo} onClick={() => setFiltroTipo(tipo)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    filtroTipo === tipo
                      ? "bg-blue-600/20 border-blue-500/30 text-blue-300"
                      : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
                  }`}>
                  {tipo === "" ? "Todos" : tipo === "fichaje" ? "Fichajes" : "Supervisiones"}
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
                      fich.tipo === "supervision" ? "bg-purple-600/20 border border-purple-500/30" : "bg-blue-600/20 border border-blue-500/30"
                    }`}>
                      {fich.tipo === "supervision" ? <Shield className="w-4 h-4 text-purple-400" /> : <CheckCircle className="w-4 h-4 text-blue-400" />}
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

                {/* Detalles de supervisión */}
                {fich.tipo === "supervision" && (
                  <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-2 gap-2 text-xs">
                    {fich.supervisor_nombre && (
                      <p className="text-white/50">Supervisor: <span className="text-white/80">{fich.supervisor_nombre}</span></p>
                    )}
                    {fich.calificacion && (
                      <div className="flex items-center gap-1">
                        <span className="text-white/50">Calificación:</span>
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
                      <p className="col-span-2 text-white/50">
                        Obs: <span className="text-white/70">{fich.observaciones}</span>
                      </p>
                    )}
                  </div>
                )}
                {fich.tipo === "fichaje" && fich.distancia_metros != null && (
                  <div className="mt-2 pt-2 border-t border-white/5">
                    <p className="text-white/30 text-xs flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {fich.distancia_metros}m del puesto
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

      {/* Print modal */}
      {printAgente && <PrintView agente={printAgente} onClose={() => setPrintAgente(null)} />}
    </div>
  );
}
