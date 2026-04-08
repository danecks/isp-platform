import { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  Printer, Search, CheckCircle, X, Shield, BadgeCheck, Users, CreditCard,
} from "lucide-react";

const API = "/api";

const getSession = () => {
  try { return sessionStorage.getItem("isp_admin_session_v2") ?? ""; } catch { return ""; }
};

const apiFetch = (path: string, opts?: RequestInit) =>
  fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
    ...opts,
  });

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface AgenteCarnet {
  employee_id: number;
  nombre_completo: string;
  cargo: string | null;
  tipo_personal: string;
  dpi: string | null;
  empl_numero: number | null;
  qr_token: string | null;
  token_id: number | null;
  activo: boolean | null;
  created_at: string | null;
  carnet_impreso_at: string | null;
  carnet_impreso_por: string | null;
  puesto_nombre: string | null;
  cliente_nombre: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(nombre: string) {
  return nombre.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

function getCargoLabel(tipo_personal: string, cargo: string | null) {
  const map: Record<string, string> = {
    guardia: "GUARDIA DE SEGURIDAD",
    supervisor: "SUPERVISOR",
    coordinador: "COORDINADOR",
    agente: "AGENTE DE SEGURIDAD",
    inspector: "INSPECTOR",
  };
  return map[(tipo_personal || "").toLowerCase()] ?? (cargo || tipo_personal || "AGENTE").toUpperCase();
}

// ── CSS compartido para la tarjeta impresa ─────────────────────────────────────
const CARD_CSS = `
  @page { size: 53.98mm 85.6mm portrait; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 53.98mm; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; background: #ffffff; }
  .card { width: 53.98mm; height: 85.6mm; display: flex; flex-direction: column; page-break-after: always; overflow: hidden; }
  .header { background: #0f2044; padding: 3.5mm 3mm 2.5mm; text-align: center; flex-shrink: 0; }
  .header-top { display: flex; align-items: center; justify-content: center; gap: 1.5mm; margin-bottom: 1mm; }
  .shield { width: 5mm; height: 5mm; flex-shrink: 0; }
  .org-sigla { font-size: 6.5pt; font-weight: 900; color: #f5c842; letter-spacing: 0.15em; }
  .org-nombre { font-size: 4pt; color: rgba(255,255,255,0.65); letter-spacing: 0.04em; line-height: 1.2; }
  .tipo-badge { display: inline-block; background: #f5c842; color: #0f2044; font-size: 4.5pt; font-weight: 900; letter-spacing: 0.12em; padding: 0.6mm 2mm; border-radius: 1mm; margin-top: 1.5mm; }
  .avatar-wrap { display: flex; justify-content: center; margin: 3mm 0 1.5mm; flex-shrink: 0; }
  .avatar { width: 14mm; height: 14mm; border-radius: 50%; background: #0f2044; display: flex; align-items: center; justify-content: center; border: 1.2pt solid #f5c842; }
  .avatar-initials { font-size: 9pt; font-weight: 900; color: #f5c842; letter-spacing: 0.05em; }
  .datos { flex: 1; padding: 0 3mm; text-align: center; }
  .nombre { font-size: 7pt; font-weight: 900; color: #0f2044; line-height: 1.2; margin-bottom: 1mm; text-transform: uppercase; }
  .cargo-label { font-size: 5pt; font-weight: 700; color: #1e5fad; letter-spacing: 0.1em; margin-bottom: 2mm; }
  .info-row { display: flex; align-items: center; justify-content: center; gap: 1mm; margin-bottom: 1mm; }
  .info-label { font-size: 4pt; color: #9ca3af; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; }
  .info-value { font-size: 5pt; color: #111827; font-weight: 700; font-family: "Courier New", monospace; }
  .divider { border: none; border-top: 0.3pt solid #e5e7eb; margin: 1.5mm 3mm; }
  .qr-section { display: flex; flex-direction: column; align-items: center; padding: 0 3mm 1.5mm; flex-shrink: 0; }
  .qr-wrap { background: #fff; border: 0.5pt solid #e5e7eb; border-radius: 1.5mm; padding: 1mm; display: inline-flex; }
  .qr-wrap svg { width: 16mm; height: 16mm; display: block; }
  .qr-hint { font-size: 3.5pt; color: #9ca3af; margin-top: 1mm; text-align: center; }
  .footer { background: #0f2044; padding: 1.2mm 3mm; text-align: center; flex-shrink: 0; }
  .footer-text { font-size: 3.5pt; color: rgba(255,255,255,0.5); }
  .footer-emision { font-size: 3.5pt; color: #f5c842; font-weight: 700; }
`;

function buildCarnetBlock(a: {
  nombre_completo: string;
  dpi?: string | null;
  empl_numero?: number | null;
}, initials: string, cargoLabel: string, fechaEmision: string, svgHtml: string) {
  const dpiRow = a.dpi
    ? `<div class="info-row"><span class="info-label">DPI</span><span class="info-value">${a.dpi}</span></div>`
    : "";
  const emplRow = a.empl_numero
    ? `<div class="info-row"><span class="info-label">No. Empleado</span><span class="info-value">${String(a.empl_numero).padStart(4, "0")}</span></div>`
    : "";

  return `<div class="card">
  <div class="header">
    <div class="header-top">
      <svg class="shield" viewBox="0 0 24 24"><path d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V6L12 2z" fill="#f5c842"/></svg>
      <span class="org-sigla">I·S·P</span>
    </div>
    <div class="org-nombre">Investigaciones y Seguridad<br>Profesional S.A.</div>
    <div class="tipo-badge">CARNET DE IDENTIFICACIÓN</div>
  </div>
  <div class="avatar-wrap"><div class="avatar"><span class="avatar-initials">${initials}</span></div></div>
  <div class="datos">
    <div class="nombre">${a.nombre_completo}</div>
    <div class="cargo-label">${cargoLabel}</div>
    ${dpiRow}${emplRow}
  </div>
  <hr class="divider">
  <div class="qr-section">
    <div class="qr-wrap">${svgHtml}</div>
    <div class="qr-hint">Escanea para verificar identidad y estado</div>
  </div>
  <div class="footer">
    <span class="footer-text">Emitido: </span><span class="footer-emision">${fechaEmision}</span>
  </div>
</div>`;
}

// ── CarnetView: modal de previsualización + impresión individual ──────────────
function CarnetView({
  agente,
  onClose,
  onPrinted,
}: {
  agente: AgenteCarnet;
  onClose: () => void;
  onPrinted: () => void;
}) {
  const origin = window.location.origin;
  const url = `${origin}/agente?token=${agente.qr_token}`;
  const svgRef = useRef<HTMLDivElement>(null);

  const initials = getInitials(agente.nombre_completo);
  const cargoLabel = getCargoLabel(agente.tipo_personal, agente.cargo);
  const fechaEmision = new Date().toLocaleDateString("es-GT", { month: "long", year: "numeric" });

  function handlePrint() {
    const svgEl = svgRef.current?.querySelector("svg");
    const svgHtml = svgEl ? new XMLSerializer().serializeToString(svgEl) : "<span>QR</span>";
    const carnetBlock = buildCarnetBlock(agente, initials, cargoLabel, fechaEmision, svgHtml);
    const win = window.open("", "_blank", "width=300,height=480");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Carnet · ${agente.nombre_completo}</title><style>${CARD_CSS}</style></head><body>${carnetBlock}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
    onPrinted();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f1724] border border-white/10 rounded-2xl p-5 w-full max-w-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white font-semibold text-sm">{agente.nombre_completo}</p>
            <p className="text-white/40 text-xs">{cargoLabel}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Vista previa */}
        <div className="flex justify-center mb-4">
          <div className="rounded-xl overflow-hidden shadow-2xl shadow-black/60" style={{ width: 160, border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="bg-[#0f2044] px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Shield className="w-3 h-3 text-[#f5c842]" />
                <span className="text-[#f5c842] text-[8px] font-black tracking-widest">I·S·P</span>
              </div>
              <div className="text-white/50 text-[6px] leading-tight">Investigaciones y Seguridad<br />Profesional S.A.</div>
              <div className="inline-block bg-[#f5c842] text-[#0f2044] text-[5px] font-black tracking-wider px-1.5 py-0.5 rounded mt-1">CARNET DE IDENTIFICACIÓN</div>
            </div>
            <div className="bg-white flex justify-center py-2">
              <div className="w-10 h-10 rounded-full bg-[#0f2044] border border-[#f5c842] flex items-center justify-center">
                <span className="text-[#f5c842] text-xs font-black">{initials}</span>
              </div>
            </div>
            <div className="bg-white px-2 pb-1.5 text-center">
              <div className="text-[#0f2044] text-[7px] font-black uppercase leading-tight">{agente.nombre_completo}</div>
              <div className="text-[#1e5fad] text-[5px] font-bold tracking-wider mt-0.5">{cargoLabel}</div>
              {agente.dpi && <div className="text-gray-400 text-[5px] mt-1">DPI <span className="text-gray-800 font-bold font-mono">{agente.dpi}</span></div>}
              {agente.empl_numero && <div className="text-gray-400 text-[5px]">No. <span className="text-gray-800 font-bold font-mono">{String(agente.empl_numero).padStart(4, "0")}</span></div>}
            </div>
            <div className="bg-white border-t border-gray-100 flex flex-col items-center py-1.5">
              <div ref={svgRef} className="bg-white border border-gray-200 rounded p-0.5">
                <QRCodeSVG value={url} size={48} />
              </div>
              <div className="text-[5px] text-gray-400 mt-0.5">Escanea para verificar</div>
            </div>
            <div className="bg-[#0f2044] py-1 text-center">
              <span className="text-white/40 text-[5px]">Emitido: </span>
              <span className="text-[#f5c842] text-[5px] font-bold">{fechaEmision}</span>
            </div>
          </div>
        </div>

        {/* Instrucciones bandeja */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5 mb-4 space-y-1.5">
          <p className="text-amber-300/80 text-[10px] font-bold uppercase tracking-wide">Canon TS702a — Bandeja A61I</p>
          <ol className="text-amber-300/70 text-[10px] leading-relaxed space-y-0.5 list-decimal list-inside">
            <li>Coloca la tarjeta PVC en la bandeja A61I</li>
            <li>Inserta la bandeja en la ranura frontal</li>
            <li>En el diálogo selecciona:<br />
              &nbsp;&nbsp;• Fuente: <span className="font-bold text-amber-300">Bandeja trasera</span><br />
              &nbsp;&nbsp;• Tipo: <span className="font-bold text-amber-300">Tarjeta de presentación</span>
            </li>
          </ol>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#f5c842]/10 hover:bg-[#f5c842]/20 border border-[#f5c842]/30 rounded-xl text-sm text-[#f5c842] font-semibold transition-colors"
          >
            <Printer className="w-4 h-4" /> Imprimir Carnet
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/50 transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal compartido ──────────────────────────────────────────
export default function CarnetesTab() {
  const [busqueda, setBusqueda] = useState("");
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [printAgente, setPrintAgente] = useState<AgenteCarnet | null>(null);
  const [imprimiendo, setImprimiendo] = useState(false);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const { currentUser } = useAuth();
  const qc = useQueryClient();

  const { data: agentes = [], isLoading } = useQuery<AgenteCarnet[]>({
    queryKey: ["agentes-carnets"],
    queryFn: async () => {
      const r = await apiFetch("/agente/tokens");
      return r.ok ? r.json() : [];
    },
  });

  const filtrados = agentes.filter(a =>
    a.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
    (a.cargo ?? "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (a.dpi ?? "").includes(busqueda)
  );

  const impresoPor = (currentUser as { nombre?: string; username?: string } | null)?.nombre
    ?? (currentUser as { nombre?: string; username?: string } | null)?.username
    ?? "Sistema";

  async function registrarImpresion(employeeIds: number[]) {
    await Promise.all(
      employeeIds.map(id =>
        apiFetch(`/agente/tokens/${id}/registrar-impresion`, {
          method: "POST",
          body: JSON.stringify({ impresoPor }),
        })
      )
    );
    qc.invalidateQueries({ queryKey: ["agentes-carnets"] });
  }

  function toggleSeleccion(id: number) {
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const conQR = filtrados.filter(a => a.qr_token);

  function seleccionarTodos() {
    setSeleccionados(new Set(conQR.map(a => a.employee_id)));
  }

  function deseleccionarTodos() {
    setSeleccionados(new Set());
  }

  async function imprimirSeleccionados() {
    const lista = agentes.filter(a => seleccionados.has(a.employee_id) && a.qr_token);
    if (lista.length === 0) return;
    setImprimiendo(true);

    const qrMap: Record<number, string> = {};
    if (qrContainerRef.current) {
      qrContainerRef.current.querySelectorAll<HTMLElement>("[data-emp-id]").forEach(div => {
        const empId = Number(div.getAttribute("data-emp-id"));
        const svg = div.querySelector("svg");
        if (svg) qrMap[empId] = new XMLSerializer().serializeToString(svg);
      });
    }

    const fechaEmision = new Date().toLocaleDateString("es-GT", { month: "long", year: "numeric" });

    const carnetBlocks = lista.map(a => {
      const initials = getInitials(a.nombre_completo);
      const cargoLabel = getCargoLabel(a.tipo_personal, a.cargo);
      const svgHtml = qrMap[a.employee_id] || "<span style='font-size:8pt;color:#999'>QR</span>";
      return buildCarnetBlock(a, initials, cargoLabel, fechaEmision, svgHtml);
    }).join("\n");

    const win = window.open("", "_blank", "width=400,height=600");
    if (win) {
      win.document.write(
        `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Carnets ISP (${lista.length})</title><style>${CARD_CSS}</style></head><body>${carnetBlocks}</body></html>`
      );
      win.document.close();
      win.onload = () => { win.print(); };
    }

    await registrarImpresion(lista.map(a => a.employee_id));
    setSeleccionados(new Set());
    setImprimiendo(false);
  }

  const totalConQR = agentes.filter(a => a.qr_token).length;
  const totalImpresos = agentes.filter(a => a.carnet_impreso_at).length;

  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white/4 border border-white/8 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="w-3.5 h-3.5 text-white/30" />
            <p className="text-white/40 text-xs">Total activos</p>
          </div>
          <p className="text-white text-2xl font-bold">{agentes.length}</p>
        </div>
        <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <CreditCard className="w-3.5 h-3.5 text-green-400/50" />
            <p className="text-green-400/60 text-xs">Con QR</p>
          </div>
          <p className="text-green-400 text-2xl font-bold">{totalConQR}</p>
        </div>
        <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <BadgeCheck className="w-3.5 h-3.5 text-amber-400/50" />
            <p className="text-amber-400/60 text-xs">Impresos</p>
          </div>
          <p className="text-amber-400 text-2xl font-bold">{totalImpresos}</p>
        </div>
      </div>

      {/* Controles */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, DPI o cargo..."
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 outline-none"
          />
        </div>
        <button
          onClick={seleccionarTodos}
          className="px-3 py-2 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/60 transition-colors whitespace-nowrap"
        >
          Todos ({conQR.length})
        </button>
        <button
          onClick={deseleccionarTodos}
          className="px-3 py-2 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/60 transition-colors"
        >
          Ninguno
        </button>
        <button
          onClick={imprimirSeleccionados}
          disabled={seleccionados.size === 0 || imprimiendo}
          className="flex items-center gap-1.5 px-4 py-2 text-xs bg-[#f5c842]/10 hover:bg-[#f5c842]/20 border border-[#f5c842]/20 text-[#f5c842] rounded-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          <Printer className="w-3.5 h-3.5" />
          {imprimiendo
            ? "Preparando..."
            : seleccionados.size > 0
              ? `Imprimir seleccionados (${seleccionados.size})`
              : "Imprimir seleccionados"
          }
        </button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <p className="text-white/30 text-sm text-center py-10">Cargando colaboradores...</p>
      ) : (
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
          {filtrados.map(a => {
            const seleccionado = seleccionados.has(a.employee_id);
            const tieneQR = !!a.qr_token;
            const initials = getInitials(a.nombre_completo);

            return (
              <div
                key={a.employee_id}
                onClick={() => tieneQR && toggleSeleccion(a.employee_id)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  tieneQR ? "cursor-pointer" : "opacity-50 cursor-default"
                } ${
                  seleccionado
                    ? "bg-[#f5c842]/5 border-[#f5c842]/20"
                    : tieneQR
                      ? "bg-white/3 border-white/8 hover:bg-white/5"
                      : "bg-white/2 border-white/5"
                }`}
              >
                {/* Checkbox */}
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                  seleccionado ? "bg-[#f5c842]/30 border-[#f5c842]/60" : "border-white/20"
                }`}>
                  {seleccionado && <CheckCircle className="w-4 h-4 text-[#f5c842]" />}
                </div>

                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-[#0f2044] border border-[#f5c842]/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#f5c842] text-xs font-bold">{initials}</span>
                </div>

                {/* Datos */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{a.nombre_completo}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white/40 text-xs truncate">{a.cargo || a.tipo_personal || "—"}</p>
                    {a.dpi && <span className="text-white/25 text-[10px] font-mono">{a.dpi}</span>}
                    {a.empl_numero && <span className="text-white/20 text-[10px]">#{String(a.empl_numero).padStart(4, "0")}</span>}
                  </div>
                </div>

                {/* Badges de estado */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {tieneQR ? (
                    <span className="text-[10px] text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle className="w-2.5 h-2.5" /> QR
                    </span>
                  ) : (
                    <span className="text-[10px] text-white/25 bg-white/5 px-1.5 py-0.5 rounded-full">Sin QR</span>
                  )}
                  {a.carnet_impreso_at ? (
                    <span title={`Impreso por: ${a.carnet_impreso_por ?? "—"}`}
                      className="text-[9px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      <BadgeCheck className="w-2.5 h-2.5" />
                      {new Date(a.carnet_impreso_at).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "2-digit" })}
                    </span>
                  ) : (
                    tieneQR && <span className="text-[9px] text-white/20 px-1.5 py-0.5 rounded-full">Pendiente</span>
                  )}
                </div>

                {/* Botón impresión individual */}
                {tieneQR && (
                  <button
                    onClick={e => { e.stopPropagation(); setPrintAgente(a); }}
                    title="Imprimir carnet individual"
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-[#f5c842]/20 border border-white/10 hover:border-[#f5c842]/30 transition-colors flex-shrink-0"
                  >
                    <Printer className="w-3.5 h-3.5 text-white/40 group-hover:text-[#f5c842]" />
                  </button>
                )}
              </div>
            );
          })}

          {filtrados.length === 0 && (
            <p className="text-white/30 text-sm text-center py-10">Sin resultados</p>
          )}
        </div>
      )}

      {/* Contenedor QR oculto para impresión en lote */}
      <div
        ref={qrContainerRef}
        style={{ position: "absolute", visibility: "hidden", top: 0, left: 0, pointerEvents: "none", zIndex: -1 }}
      >
        {agentes.filter(a => a.qr_token).map(a => (
          <div key={a.employee_id} data-emp-id={a.employee_id}>
            <QRCodeSVG
              value={`${window.location.origin}/agente?token=${a.qr_token}`}
              size={64}
            />
          </div>
        ))}
      </div>

      {/* Modal de carnet individual */}
      {printAgente && (
        <CarnetView
          agente={printAgente}
          onClose={() => setPrintAgente(null)}
          onPrinted={() => registrarImpresion([printAgente.employee_id])}
        />
      )}
    </div>
  );
}
