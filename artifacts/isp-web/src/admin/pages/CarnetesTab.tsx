import { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  Printer, Search, CheckCircle, X, BadgeCheck, Users, CreditCard, RefreshCw,
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

// ── CSS impresión FRENTE (Moderno — portrait CR-80) ───────────────────────────
const FRENTE_CSS = `
  @page { size: 53.98mm 85.6mm portrait; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 53.98mm; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; background: #fff; }
  .card { width: 53.98mm; height: 85.6mm; display: flex; flex-direction: row; overflow: hidden; }
  .stripe { width: 10.5mm; background: linear-gradient(180deg, #0f2044 0%, #132a5a 100%); display: flex; flex-direction: column; align-items: center; flex-shrink: 0; position: relative; }
  .stripe-bar-t { position: absolute; top: 0; left: 0; right: 0; height: 1mm; background: #f5c842; }
  .stripe-bar-b { position: absolute; bottom: 0; left: 0; right: 0; height: 1mm; background: #f5c842; }
  .stripe-inner { display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 3mm 0; width: 100%; height: 100%; }
  .stripe-logo { width: 7mm; object-fit: contain; filter: brightness(0) invert(1); }
  .stripe-num { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 4pt; color: rgba(255,255,255,0.4); font-family: "Courier New", monospace; font-weight: 700; letter-spacing: 0.1em; }
  .content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .c-header { background: #fff; padding: 2.5mm 2mm 2mm; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
  .avatar { width: 13mm; height: 13mm; border-radius: 50%; background: linear-gradient(135deg, #0f2044, #1e4a9a); border: 0.8pt solid #f5c842; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5mm; }
  .avatar-i { font-size: 8pt; font-weight: 900; color: #f5c842; }
  .nombre { font-size: 6pt; font-weight: 900; color: #0f2044; text-align: center; line-height: 1.2; text-transform: uppercase; margin-bottom: 0.8mm; }
  .cargo { font-size: 4pt; font-weight: 700; color: #b8860b; text-align: center; letter-spacing: 0.1em; text-transform: uppercase; }
  .gold-line { height: 0.6pt; background: linear-gradient(90deg, #d4a017, #f5c842, #e8b820); flex-shrink: 0; }
  .datos { padding: 1.5mm 2mm; flex: 1; }
  .d-label { font-size: 3.5pt; color: #94a3b8; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5mm; }
  .d-value { font-size: 5.5pt; color: #0f2044; font-weight: 800; font-family: "Courier New", monospace; margin-bottom: 1.5mm; }
  .hdivider { height: 0.3pt; background: #f1f5f9; margin-bottom: 1.5mm; }
  .qr-row { display: flex; flex-direction: column; align-items: center; gap: 1mm; }
  .qr-hint { font-size: 3pt; color: #94a3b8; text-align: center; }
  .qr-box { background: #fff; border: 0.4pt solid #e2e8f0; border-radius: 1mm; padding: 0.5mm; }
  .qr-box svg { width: 18mm; height: 18mm; display: block; }
  .c-footer { background: #0f2044; padding: 1mm 2mm; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
  .f-date { font-size: 3pt; color: rgba(255,255,255,0.35); }
  .f-label { font-size: 3pt; font-weight: 800; color: #f5c842; letter-spacing: 0.08em; }
`;

// ── CSS impresión REVERSO (Moderno — portrait CR-80) ──────────────────────────
const REVERSO_CSS = `
  @page { size: 53.98mm 85.6mm portrait; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 53.98mm; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; background: #fff; }
  .card { width: 53.98mm; height: 85.6mm; display: flex; flex-direction: column; overflow: hidden; }
  .r-top { background: #fff; padding: 4mm 3mm 2mm; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
  .r-logo { height: 18mm; object-fit: contain; }
  .r-org { font-size: 3.8pt; color: #0f2044; letter-spacing: 0.1em; font-weight: 700; text-align: center; margin-top: 1.5mm; }
  .r-gold { height: 0.8pt; background: linear-gradient(90deg, #d4a017, #f5c842, #d4a017); flex-shrink: 0; }
  .r-body { flex: 1; background: #fff; display: flex; align-items: center; justify-content: center; padding: 2.5mm 4mm; }
  .r-legal { font-size: 5.5pt; color: #1e3a5f; text-align: center; line-height: 1.65; }
  .r-legal strong { font-weight: 800; color: #0f2044; }
  .r-divider { height: 0.5pt; background: linear-gradient(90deg, transparent, rgba(245,200,66,0.5), #f5c842, rgba(245,200,66,0.5), transparent); margin: 0 4mm; flex-shrink: 0; }
  .r-footer { background: #fff; padding: 1.5mm 3mm 2mm; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
  .r-web { font-size: 6.5pt; font-weight: 900; color: #0f2044; letter-spacing: 0.06em; }
  .r-email { font-size: 3.8pt; color: #94a3b8; letter-spacing: 0.04em; margin-top: 0.5mm; }
  .r-bottom { background: #0f2044; height: 2mm; flex-shrink: 0; }
`;

// ── Helper: convierte imagen a base64 para popups ─────────────────────────────
async function toBase64Url(url: string): Promise<string> {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

// ── Generadores HTML ───────────────────────────────────────────────────────────
function buildFrenteBlock(
  a: { nombre_completo: string; dpi?: string | null; empl_numero?: number | null },
  initials: string,
  cargoLabel: string,
  fechaEmision: string,
  svgHtml: string,
  logoIconUrl: string,
) {
  const emplNum = a.empl_numero ? `#${String(a.empl_numero).padStart(4, "0")}` : "";
  const dpiSection = a.dpi
    ? `<div class="d-label">DPI</div><div class="d-value">${a.dpi}</div>`
    : "";

  return `<div class="card">
  <div class="stripe">
    <div class="stripe-bar-t"></div>
    <div class="stripe-inner">
      <img class="stripe-logo" src="${logoIconUrl}" />
      <span class="stripe-num">${emplNum}</span>
    </div>
    <div class="stripe-bar-b"></div>
  </div>
  <div class="content">
    <div class="c-header">
      <div class="avatar"><span class="avatar-i">${initials}</span></div>
      <div class="nombre">${a.nombre_completo}</div>
      <div class="cargo">${cargoLabel}</div>
    </div>
    <div class="gold-line"></div>
    <div class="datos">
      ${dpiSection}
      <div class="hdivider"></div>
      <div class="qr-row">
        <div class="qr-box">${svgHtml}</div>
        <div class="qr-hint">Escanea para verificar identidad</div>
      </div>
    </div>
    <div class="c-footer">
      <span class="f-date">${fechaEmision}</span>
      <span class="f-label">CARNET DE IDENTIFICACIÓN</span>
    </div>
  </div>
</div>`;
}

function buildReversoBlock(logoFullUrl: string) {
  return `<div class="card">
  <div class="r-top">
    <img class="r-logo" src="${logoFullUrl}" />
    <div class="r-org">INVESTIGACIONES Y SEGURIDAD PROFESIONAL S.A.</div>
  </div>
  <div class="r-gold"></div>
  <div class="r-body">
    <div class="r-legal">
      El presente acredita como colaborador de <strong>ISP S.A.</strong>
      Se solicita a las Autoridades <strong>Civiles y Militares</strong>
      la colaboración en caso de ser requerida. Válido en el cumplimiento
      de sus funciones en el puesto.
    </div>
  </div>
  <div class="r-divider"></div>
  <div class="r-footer">
    <div class="r-web">www.ispsa.net</div>
    <div class="r-email">contacto@isp-guatemala.com</div>
  </div>
  <div class="r-bottom"></div>
</div>`;
}

function openPrintWindow(title: string, css: string, body: string) {
  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) return;
  win.document.write(
    `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head><body>${body}</body></html>`
  );
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}

// ── CarnetView: modal individual con flujo FRENTE → REVERSO ──────────────────
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
  const [fase, setFase] = useState<"frente" | "reverso">("frente");

  const initials = getInitials(agente.nombre_completo);
  const cargoLabel = getCargoLabel(agente.tipo_personal, agente.cargo);
  const fechaEmision = new Date().toLocaleDateString("es-GT", { month: "long", year: "numeric" });

  const logoIconUrl = `${origin}/images/logo-icon.png`;
  const logoFullUrl = `${origin}/images/logo-isp.png`;

  async function handlePrintFrente() {
    const svgEl = svgRef.current?.querySelector("svg");
    const svgHtml = svgEl ? new XMLSerializer().serializeToString(svgEl) : "<span>QR</span>";
    const logoB64 = await toBase64Url(logoIconUrl);
    const block = buildFrenteBlock(agente, initials, cargoLabel, fechaEmision, svgHtml, logoB64);
    openPrintWindow(`Frente · ${agente.nombre_completo}`, FRENTE_CSS, block);
    setFase("reverso");
  }

  async function handlePrintReverso() {
    const logoB64 = await toBase64Url(logoFullUrl);
    const block = buildReversoBlock(logoB64);
    openPrintWindow(`Reverso · ${agente.nombre_completo}`, REVERSO_CSS, block);
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

        {/* Vista previa Moderno — portrait */}
        <div className="flex justify-center mb-4 gap-3">
          {/* Frente mini portrait */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-white/30 text-[9px] uppercase tracking-wider">Frente</span>
            <div style={{ width: 100, height: 158, borderRadius: 5, overflow: "hidden", display: "flex", flexDirection: "row", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>
              <div style={{ width: 16, background: "linear-gradient(180deg,#0f2044,#132a5a)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "5px 0", position: "relative", flexShrink: 0 }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "#f5c842" }} />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "#f5c842" }} />
                <img src="/images/logo-icon.png" style={{ width: 12, filter: "brightness(0) invert(1)" }} />
                <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 5, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>
                  {agente.empl_numero ? `#${String(agente.empl_numero).padStart(4, "0")}` : ""}
                </span>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fff" }}>
                <div style={{ padding: "5px 4px 4px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg,#0f2044,#1e4a9a)", border: "1px solid #f5c842", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 3 }}>
                    <span style={{ color: "#f5c842", fontSize: 7, fontWeight: 900 }}>{initials}</span>
                  </div>
                  <div style={{ fontSize: 5, fontWeight: 900, color: "#0f2044", textAlign: "center", lineHeight: 1.2, textTransform: "uppercase", marginBottom: 1 }}>{agente.nombre_completo}</div>
                  <div style={{ fontSize: 4, fontWeight: 700, color: "#b8860b", letterSpacing: "0.05em" }}>{cargoLabel}</div>
                </div>
                <div style={{ height: 1, background: "linear-gradient(90deg,#d4a017,#f5c842,#e8b820)" }} />
                <div style={{ padding: "4px", flex: 1 }}>
                  {agente.dpi && <><div style={{ fontSize: 3, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", marginBottom: 1 }}>DPI</div><div style={{ fontSize: 5, color: "#0f2044", fontWeight: 800, fontFamily: "monospace", marginBottom: 3 }}>{agente.dpi}</div></>}
                  <div style={{ height: 0.5, background: "#f1f5f9", marginBottom: 3 }} />
                  <div ref={svgRef} style={{ display: "flex", justifyContent: "center" }}>
                    <div style={{ background: "#fff", border: "0.5px solid #e2e8f0", borderRadius: 2, padding: 1 }}>
                      <QRCodeSVG value={url} size={38} />
                    </div>
                  </div>
                </div>
                <div style={{ background: "#0f2044", padding: "2px 4px", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 3, color: "rgba(255,255,255,0.3)" }}>{fechaEmision.split(" ").slice(-1)[0]}</span>
                  <span style={{ fontSize: 3, color: "#f5c842", fontWeight: 800 }}>ISP</span>
                </div>
              </div>
            </div>
          </div>

          {/* Reverso mini portrait */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-white/30 text-[9px] uppercase tracking-wider">Reverso</span>
            <div style={{ width: 100, height: 158, borderRadius: 5, overflow: "hidden", display: "flex", flexDirection: "column", background: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>
              <div style={{ padding: "8px 6px 4px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <img src="/images/logo-isp.png" style={{ height: 32, objectFit: "contain" }} />
                <div style={{ fontSize: 3.5, color: "#0f2044", fontWeight: 700, textAlign: "center", marginTop: 3 }}>INVESTIGACIONES Y SEGURIDAD<br />PROFESIONAL S.A.</div>
              </div>
              <div style={{ height: 1, background: "linear-gradient(90deg,#d4a017,#f5c842,#d4a017)" }} />
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 6px" }}>
                <div style={{ fontSize: 4, color: "#1e3a5f", textAlign: "center", lineHeight: 1.5 }}>
                  El presente acredita como colaborador de <strong style={{ color: "#0f2044" }}>ISP S.A.</strong> Se solicita a las Autoridades Civiles y Militares la colaboración en caso de ser requerida.
                </div>
              </div>
              <div style={{ padding: "3px 6px 5px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontSize: 5.5, fontWeight: 900, color: "#0f2044" }}>www.ispsa.net</div>
              </div>
              <div style={{ height: 3, background: "#0f2044" }} />
            </div>
          </div>
        </div>

        {/* Instrucciones según fase */}
        {fase === "frente" ? (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2.5 mb-4 space-y-1">
            <p className="text-blue-300/80 text-[10px] font-bold uppercase tracking-wide">Canon TS702a — Paso 1 de 2</p>
            <p className="text-blue-300/60 text-[10px] leading-relaxed">Coloca el PVC en la bandeja A61I e imprime el frente. Luego dale la vuelta para imprimir el reverso.</p>
          </div>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5 mb-4 space-y-1">
            <div className="flex items-center gap-1.5 mb-1">
              <RefreshCw className="w-3 h-3 text-amber-400" />
              <p className="text-amber-300/90 text-[10px] font-bold uppercase tracking-wide">Dale la vuelta al PVC — Paso 2 de 2</p>
            </div>
            <p className="text-amber-300/60 text-[10px] leading-relaxed">Retira la tarjeta, dale vuelta e insértala de nuevo en la bandeja. Luego imprime el reverso.</p>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-2">
          {fase === "frente" ? (
            <button
              onClick={handlePrintFrente}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#f5c842]/10 hover:bg-[#f5c842]/20 border border-[#f5c842]/30 rounded-xl text-sm text-[#f5c842] font-semibold transition-colors"
            >
              <Printer className="w-4 h-4" /> Imprimir Frente
            </button>
          ) : (
            <button
              onClick={handlePrintReverso}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-sm text-amber-300 font-semibold transition-colors"
            >
              <Printer className="w-4 h-4" /> Imprimir Reverso
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white/50 transition-colors">
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
  const [faseLote, setFaseLote] = useState<"idle" | "reverso">("idle");
  const [listaLote, setListaLote] = useState<AgenteCarnet[]>([]);
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

  function seleccionarTodos() { setSeleccionados(new Set(conQR.map(a => a.employee_id))); }
  function deseleccionarTodos() { setSeleccionados(new Set()); }

  // ── Lote: Paso 1 — imprimir frentes ──────────────────────────────────────
  async function imprimirFrentesLote() {
    const lista = agentes.filter(a => seleccionados.has(a.employee_id) && a.qr_token);
    if (lista.length === 0) return;
    setImprimiendo(true);

    const origin = window.location.origin;
    const logoIconUrl = await toBase64Url(`${origin}/images/logo-icon.png`);
    const fechaEmision = new Date().toLocaleDateString("es-GT", { month: "long", year: "numeric" });

    const qrMap: Record<number, string> = {};
    if (qrContainerRef.current) {
      qrContainerRef.current.querySelectorAll<HTMLElement>("[data-emp-id]").forEach(div => {
        const empId = Number(div.getAttribute("data-emp-id"));
        const svg = div.querySelector("svg");
        if (svg) qrMap[empId] = new XMLSerializer().serializeToString(svg);
      });
    }

    const blocks = lista.map(a => {
      const initials = getInitials(a.nombre_completo);
      const cargoLabel = getCargoLabel(a.tipo_personal, a.cargo);
      const svgHtml = qrMap[a.employee_id] || "<span style='font-size:8pt;color:#999'>QR</span>";
      return buildFrenteBlock(a, initials, cargoLabel, fechaEmision, svgHtml, logoIconUrl);
    }).join("\n");

    openPrintWindow(`Frentes ISP (${lista.length})`, FRENTE_CSS, blocks);

    setListaLote(lista);
    setFaseLote("reverso");
    setImprimiendo(false);
  }

  // ── Lote: Paso 2 — imprimir reversos ─────────────────────────────────────
  async function imprimirReversosLote() {
    const origin = window.location.origin;
    const logoFullUrl = await toBase64Url(`${origin}/images/logo-isp.png`);
    const blocks = listaLote.map(() => buildReversoBlock(logoFullUrl)).join("\n");
    openPrintWindow(`Reversos ISP (${listaLote.length})`, REVERSO_CSS, blocks);

    await registrarImpresion(listaLote.map(a => a.employee_id));
    setSeleccionados(new Set());
    setFaseLote("idle");
    setListaLote([]);
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
        <button onClick={seleccionarTodos} className="px-3 py-2 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/60 transition-colors whitespace-nowrap">
          Todos ({conQR.length})
        </button>
        <button onClick={deseleccionarTodos} className="px-3 py-2 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/60 transition-colors">
          Ninguno
        </button>

        {/* Botón lote — cambia según fase */}
        {faseLote === "idle" ? (
          <button
            onClick={imprimirFrentesLote}
            disabled={seleccionados.size === 0 || imprimiendo}
            className="flex items-center gap-1.5 px-4 py-2 text-xs bg-[#f5c842]/10 hover:bg-[#f5c842]/20 border border-[#f5c842]/20 text-[#f5c842] rounded-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            {seleccionados.size > 0 ? `Imprimir frentes (${seleccionados.size})` : "Imprimir seleccionados"}
          </button>
        ) : (
          <button
            onClick={imprimirReversosLote}
            className="flex items-center gap-1.5 px-4 py-2 text-xs bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl font-semibold transition-colors whitespace-nowrap animate-pulse"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Dale vuelta al PVC → Imprimir reversos ({listaLote.length})
          </button>
        )}
      </div>

      {/* Banner de aviso si está en fase reverso */}
      {faseLote === "reverso" && (
        <div className="flex items-start gap-3 bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 mb-4">
          <RefreshCw className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-amber-300 text-xs font-bold mb-0.5">Paso 2 de 2 — Dale la vuelta a los PVC</p>
            <p className="text-amber-300/60 text-[11px] leading-relaxed">
              Retira las {listaLote.length} tarjeta{listaLote.length !== 1 ? "s" : ""} impresas, dales vuelta e insértalas de nuevo en la bandeja A61I.
              Cuando estén listas, haz clic en <span className="text-amber-300 font-semibold">"Dale vuelta al PVC → Imprimir reversos"</span>.
            </p>
          </div>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <p className="text-white/30 text-sm text-center py-10">Cargando colaboradores...</p>
      ) : (
        <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
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
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                  seleccionado ? "bg-[#f5c842]/30 border-[#f5c842]/60" : "border-white/20"
                }`}>
                  {seleccionado && <CheckCircle className="w-4 h-4 text-[#f5c842]" />}
                </div>

                <div className="w-8 h-8 rounded-full bg-[#0f2044] border border-[#f5c842]/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#f5c842] text-xs font-bold">{initials}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{a.nombre_completo}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white/40 text-xs truncate">{getCargoLabel(a.tipo_personal, a.cargo)}</p>
                    {a.dpi && <span className="text-white/25 text-[10px] font-mono">{a.dpi}</span>}
                    {a.empl_numero && <span className="text-white/20 text-[10px]">#{String(a.empl_numero).padStart(4, "0")}</span>}
                  </div>
                </div>

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

                {tieneQR && (
                  <button
                    onClick={e => { e.stopPropagation(); setPrintAgente(a); }}
                    title="Imprimir carnet individual"
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-[#f5c842]/20 border border-white/10 hover:border-[#f5c842]/30 transition-colors flex-shrink-0"
                  >
                    <Printer className="w-3.5 h-3.5 text-white/40" />
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

      {/* QR ocultos para lote */}
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

      {/* Modal individual */}
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
