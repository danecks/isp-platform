/**
 * ImpresionAvanzadaTab.tsx
 * Módulo de impresión avanzada para tarjetas PVC.
 *
 * ARQUITECTURA:
 *  ┌─────────────────────────────────────────────┐
 *  │  PERFILES      → definen tamaño de hoja     │
 *  │                   y posiciones X/Y de cards │
 *  │  CALIBRACIÓN   → offset X/Y global (mm)     │
 *  │  PRINT SERVICE → genera HTML con @page y    │
 *  │                   position:absolute en mm   │
 *  │  DISEÑO CARD   → CSS/HTML del carnet ISP    │
 *  └─────────────────────────────────────────────┘
 */

import { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  Printer, Settings, Target, Plus, Minus, ChevronDown,
  Save, X, AlertTriangle, CheckCircle, CreditCard, RefreshCw,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

interface CardPosition {
  /** X desde el borde izquierdo de la hoja (mm) */
  x: number;
  /** Y desde el borde superior de la hoja (mm) */
  y: number;
  /** Ancho de la tarjeta CR-80 portrait (mm) */
  width: number;
  /** Alto de la tarjeta CR-80 portrait (mm) */
  height: number;
}

interface PrinterProfile {
  id: string;
  name: string;
  /** Ancho total de hoja (mm) */
  pageWidth: number;
  /** Alto total de hoja (mm) */
  pageHeight: number;
  orientation: "portrait" | "landscape";
  /** Posiciones absolutas de cada slot de tarjeta en la hoja */
  slots: CardPosition[];
  custom?: boolean;
}

interface CalibrationOffset {
  /** Desplazamiento global horizontal (mm) — positivo = derecha */
  x: number;
  /** Desplazamiento global vertical (mm) — positivo = abajo */
  y: number;
}

interface AgenteCarnet {
  employee_id: number;
  nombre_completo: string;
  cargo: string | null;
  tipo_personal: string;
  dpi: string | null;
  empl_numero: number | null;
  qr_token: string | null;
  activo: boolean | null;
  carnet_impreso_at: string | null;
  carnet_impreso_por: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PERFILES PREDEFINIDOS
// Ajustar X/Y hasta que las tarjetas queden centradas sobre los slots físicos.
// Canon TS702a con bandeja aftermarket MP (marcada en foto).
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_CARD_W = 53.98; // CR-80 portrait width (mm)
const DEFAULT_CARD_H = 85.60; // CR-80 portrait height (mm)

const BUILTIN_PROFILES: PrinterProfile[] = [
  {
    id: "canon-ts702a-2cards",
    name: "Canon TS702a — 2 tarjetas (bandeja MP)",
    // Hoja carta 216×279 mm
    pageWidth: 216,
    pageHeight: 279,
    orientation: "portrait",
    slots: [
      // Slot izquierdo: X = (216 − 53.98×2 − 10) / 2 ≈ 49mm  |  Y ≈ 25mm  (ajustar con calibración)
      { x: 49,  y: 25, width: DEFAULT_CARD_W, height: DEFAULT_CARD_H },
      // Slot derecho: mismo Y, desplazado horizontalmente por ancho de tarjeta + separación (≈10mm)
      { x: 113, y: 25, width: DEFAULT_CARD_W, height: DEFAULT_CARD_H },
    ],
  },
  {
    id: "canon-ts8220-2cards",
    name: "Canon TS8220 / TS8320 — 2 tarjetas",
    pageWidth: 216,
    pageHeight: 279,
    orientation: "portrait",
    slots: [
      { x: 25,  y: 20, width: DEFAULT_CARD_W, height: DEFAULT_CARD_H },
      { x: 137, y: 20, width: DEFAULT_CARD_W, height: DEFAULT_CARD_H },
    ],
  },
  {
    id: "a4-3cards",
    name: "A4 genérico — 3 tarjetas",
    pageWidth: 210,
    pageHeight: 297,
    orientation: "portrait",
    slots: [
      { x: 10,  y: 15, width: DEFAULT_CARD_W, height: DEFAULT_CARD_H },
      { x: 10, y: 115, width: DEFAULT_CARD_W, height: DEFAULT_CARD_H },
      { x: 10, y: 215, width: DEFAULT_CARD_W, height: DEFAULT_CARD_H },
    ],
  },
  {
    id: "a4-4cards",
    name: "A4 genérico — 4 tarjetas (2×2)",
    pageWidth: 210,
    pageHeight: 297,
    orientation: "portrait",
    slots: [
      { x: 10,  y: 15, width: DEFAULT_CARD_W, height: DEFAULT_CARD_H },
      { x: 80,  y: 15, width: DEFAULT_CARD_W, height: DEFAULT_CARD_H },
      { x: 10, y: 115, width: DEFAULT_CARD_W, height: DEFAULT_CARD_H },
      { x: 80, y: 115, width: DEFAULT_CARD_W, height: DEFAULT_CARD_H },
    ],
  },
];

const STORAGE_KEY_PROFILES = "isp_print_profiles_v1";
const STORAGE_KEY_CALIB    = "isp_print_calibration_v1";
const STORAGE_KEY_ACTIVE   = "isp_print_active_profile_v1";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const getSession = () => {
  try { return sessionStorage.getItem("isp_admin_session_v2") ?? ""; } catch { return ""; }
};

const apiFetch = (path: string, opts?: RequestInit) =>
  fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
    ...opts,
  });

function getInitials(nombre: string) {
  return nombre.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

function getCargoLabel(tipo: string, cargo: string | null) {
  const map: Record<string, string> = {
    guardia: "GUARDIA DE SEGURIDAD", supervisor: "SUPERVISOR",
    coordinador: "COORDINADOR", agente: "AGENTE DE SEGURIDAD", inspector: "INSPECTOR",
  };
  return map[(tipo || "").toLowerCase()] ?? (cargo || tipo || "AGENTE").toUpperCase();
}

async function toBase64Url(url: string): Promise<string> {
  try {
    const r = await fetch(url);
    const b = await r.blob();
    return new Promise(res => { const rd = new FileReader(); rd.onloadend = () => res(rd.result as string); rd.readAsDataURL(b); });
  } catch { return url; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICIO DE IMPRESIÓN
// Genera HTML con @page exacto y position:absolute en mm.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CSS del diseño interior del carnet (Moderno ISP).
 * Dimensiones relativas al tamaño del slot (53.98×85.6mm).
 */
function getCardInnerCSS(): string {
  return `
    .icard { width: 100%; height: 100%; display: flex; flex-direction: row; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; }
    .i-stripe { width: 10.5mm; background: linear-gradient(180deg,#0f2044,#132a5a); display: flex; flex-direction: column; align-items: center; flex-shrink: 0; position: relative; }
    .i-bar-t { position: absolute; top: 0; left: 0; right: 0; height: 1mm; background: #f5c842; }
    .i-bar-b { position: absolute; bottom: 0; left: 0; right: 0; height: 1mm; background: #f5c842; }
    .i-stripe-in { display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 3mm 0; width: 100%; height: 100%; }
    .i-slogo { width: 7mm; object-fit: contain; filter: brightness(0) invert(1); }
    .i-snum { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 4pt; color: rgba(255,255,255,.4); font-family: "Courier New",monospace; font-weight: 700; letter-spacing: .1em; }
    .i-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #fff; }
    .i-head { padding: 2.5mm 2mm 2mm; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
    .i-av { width: 13mm; height: 13mm; border-radius: 50%; background: linear-gradient(135deg,#0f2044,#1e4a9a); border: .8pt solid #f5c842; display: flex; align-items: center; justify-content: center; margin-bottom: 1.5mm; }
    .i-av-i { font-size: 8pt; font-weight: 900; color: #f5c842; }
    .i-nom { font-size: 6pt; font-weight: 900; color: #0f2044; text-align: center; line-height: 1.2; text-transform: uppercase; margin-bottom: .8mm; }
    .i-cargo { font-size: 4pt; font-weight: 700; color: #b8860b; text-align: center; letter-spacing: .1em; text-transform: uppercase; }
    .i-gold { height: .6pt; background: linear-gradient(90deg,#d4a017,#f5c842,#e8b820); flex-shrink: 0; }
    .i-datos { padding: 1.5mm 2mm; flex: 1; }
    .i-dlbl { font-size: 3.5pt; color: #94a3b8; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; margin-bottom: .5mm; }
    .i-dval { font-size: 5.5pt; color: #0f2044; font-weight: 800; font-family: "Courier New",monospace; margin-bottom: 1.5mm; }
    .i-div { height: .3pt; background: #f1f5f9; margin-bottom: 1.5mm; }
    .i-qr { display: flex; flex-direction: column; align-items: center; gap: 1mm; }
    .i-qrbox { background: #fff; border: .4pt solid #e2e8f0; border-radius: 1mm; padding: .5mm; }
    .i-qrbox svg { width: 18mm; height: 18mm; display: block; }
    .i-qrhint { font-size: 3pt; color: #94a3b8; text-align: center; }
    .i-foot { background: #0f2044; padding: 1mm 2mm; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
    .i-fdate { font-size: 3pt; color: rgba(255,255,255,.35); }
    .i-flbl { font-size: 3pt; font-weight: 800; color: #f5c842; letter-spacing: .08em; }

    /* Reverso */
    .rcard { width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; background: #fff; }
    .r-top { padding: 4mm 3mm 2mm; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
    .r-logo { height: 18mm; object-fit: contain; }
    .r-org { font-size: 3.8pt; color: #0f2044; letter-spacing: .1em; font-weight: 700; text-align: center; margin-top: 1.5mm; }
    .r-gold { height: .8pt; background: linear-gradient(90deg,#d4a017,#f5c842,#d4a017); flex-shrink: 0; }
    .r-body { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2.5mm 4mm; }
    .r-legal { font-size: 5.5pt; color: #1e3a5f; text-align: center; line-height: 1.65; }
    .r-legal strong { font-weight: 800; color: #0f2044; }
    .r-divider { height: .5pt; background: linear-gradient(90deg,transparent,rgba(245,200,66,.5),#f5c842,rgba(245,200,66,.5),transparent); margin: 0 4mm; flex-shrink: 0; }
    .r-footer { padding: 1.5mm 3mm 2mm; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
    .r-web { font-size: 6.5pt; font-weight: 900; color: #0f2044; letter-spacing: .06em; }
    .r-email { font-size: 3.8pt; color: #94a3b8; margin-top: .5mm; }
    .r-bottom { background: #0f2044; height: 2mm; flex-shrink: 0; }
  `;
}

/**
 * Genera el HTML interior de un carnet (frente).
 */
function buildCardFrenteHTML(
  a: AgenteCarnet,
  svgHtml: string,
  logoIconB64: string,
  fecha: string,
): string {
  const initials = getInitials(a.nombre_completo);
  const cargo = getCargoLabel(a.tipo_personal, a.cargo);
  const num = a.empl_numero ? `#${String(a.empl_numero).padStart(4, "0")}` : "";
  const dpiRow = a.dpi ? `<div class="i-dlbl">DPI</div><div class="i-dval">${a.dpi}</div>` : "";
  return `<div class="icard">
  <div class="i-stripe">
    <div class="i-bar-t"></div>
    <div class="i-stripe-in">
      <img class="i-slogo" src="${logoIconB64}" />
      <span class="i-snum">${num}</span>
    </div>
    <div class="i-bar-b"></div>
  </div>
  <div class="i-content">
    <div class="i-head">
      <div class="i-av"><span class="i-av-i">${initials}</span></div>
      <div class="i-nom">${a.nombre_completo}</div>
      <div class="i-cargo">${cargo}</div>
    </div>
    <div class="i-gold"></div>
    <div class="i-datos">
      ${dpiRow}
      <div class="i-div"></div>
      <div class="i-qr">
        <div class="i-qrbox">${svgHtml}</div>
        <div class="i-qrhint">Escanea para verificar identidad</div>
      </div>
    </div>
    <div class="i-foot">
      <span class="i-fdate">${fecha}</span>
      <span class="i-flbl">CARNET DE IDENTIFICACIÓN</span>
    </div>
  </div>
</div>`;
}

/**
 * Genera el HTML interior del reverso.
 */
function buildCardReversoHTML(logoFullB64: string): string {
  return `<div class="rcard">
  <div class="r-top">
    <img class="r-logo" src="${logoFullB64}" />
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

/**
 * CSS de impresión — define @page (tamaño de hoja) y .slot (posición de tarjeta).
 * offsetX/Y son los milímetros de calibración global.
 */
function buildPrintPageCSS(
  profile: PrinterProfile,
  offset: CalibrationOffset,
): string {
  // Genera una clase .slot-N por cada posición del perfil
  const slotClasses = profile.slots
    .map((s, i) => `.slot-${i} {
      left:   ${s.x + offset.x}mm;   /* X posición + offset calibración */
      top:    ${s.y + offset.y}mm;   /* Y posición + offset calibración */
      width:  ${s.width}mm;          /* Ancho tarjeta CR-80              */
      height: ${s.height}mm;         /* Alto tarjeta CR-80               */
    }`)
    .join("\n");

  return `
    /* ── Tamaño de hoja: definido por el perfil de impresora ── */
    @page {
      size: ${profile.pageWidth}mm ${profile.pageHeight}mm ${profile.orientation};
      margin: 0;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      /* Sin escalado: dimensiones absolutas de la hoja */
      width:  ${profile.pageWidth}mm;
      height: ${profile.pageHeight}mm;
      overflow: hidden;
    }

    /* ── Contenedor de página: posicionamiento absoluto ── */
    .print-page {
      position: relative;
      width:  ${profile.pageWidth}mm;
      height: ${profile.pageHeight}mm;
    }

    /* ── Slot genérico: position:absolute sobre la hoja ── */
    .slot {
      position: absolute;
      overflow: hidden;
    }

    /* ── Posiciones X/Y por slot (con offset de calibración) ── */
    ${slotClasses}

    ${getCardInnerCSS()}
  `;
}

/**
 * CSS de calibración — igual que el de impresión pero muestra rectángulos vacíos con crucetas.
 */
function buildCalibrationCSS(
  profile: PrinterProfile,
  offset: CalibrationOffset,
): string {
  return buildPrintPageCSS(profile, offset) + `
    .slot { border: 0.5pt dashed #0f2044; background: #f8fafc; }
    .crosshair { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
    .crosshair::before { content: ''; position: absolute; left: 0; right: 0; height: 0.3pt; background: #0f2044; }
    .crosshair::after  { content: ''; position: absolute; top: 0; bottom: 0; width: 0.3pt; background: #0f2044; left: 50%; transform: translateX(-50%); }
    .slot-label { position: absolute; top: 2mm; left: 0; right: 0; text-align: center; font-size: 6pt; color: #0f2044; font-family: monospace; font-weight: 700; }
    .slot-dim   { position: absolute; bottom: 2mm; left: 0; right: 0; text-align: center; font-size: 5pt; color: #94a3b8; font-family: monospace; }
  `;
}

/**
 * Genera y abre una ventana de impresión con las tarjetas en posición absoluta.
 */
function openPrintPage(
  title: string,
  css: string,
  slots: string[],
): void {
  const slotDivs = slots.map((html, i) => `<div class="slot slot-${i}">${html}</div>`).join("\n");
  const win = window.open("", "_blank", "width=500,height=700");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>${title}</title><style>${css}</style></head>
<body><div class="print-page">${slotDivs}</div></body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 600);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES UI
// ─────────────────────────────────────────────────────────────────────────────

/** Vista escalada de la bandeja — muestra la hoja con slots pintados. */
function TrayPreview({
  profile,
  offset,
  queue,
  isCalib = false,
}: {
  profile: PrinterProfile;
  offset: CalibrationOffset;
  queue: (AgenteCarnet | null)[];
  isCalib?: boolean;
}) {
  const MAX_W = 240; // px de ancho máximo del preview
  const scale = MAX_W / profile.pageWidth;
  const previewH = profile.pageHeight * scale;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-white/30 text-[9px] uppercase tracking-wider">
        Vista previa — {profile.pageWidth}×{profile.pageHeight}mm
      </span>
      <div
        style={{
          width: MAX_W,
          height: previewH,
          background: "#fff",
          position: "relative",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 4,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {profile.slots.map((slot, i) => {
          const agent = queue[i];
          const left = (slot.x + offset.x) * scale;
          const top  = (slot.y + offset.y) * scale;
          const w    = slot.width  * scale;
          const h    = slot.height * scale;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left, top, width: w, height: h,
                border: isCalib ? "1px dashed #0f2044" : "1px solid rgba(15,32,68,0.4)",
                borderRadius: 2,
                background: isCalib ? "#f8fafc" : agent ? "#fff" : "rgba(15,32,68,0.05)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isCalib ? (
                <>
                  <div style={{ position: "absolute", left: 0, right: 0, height: 0.5, background: "#0f2044", top: "50%" }} />
                  <div style={{ position: "absolute", top: 0, bottom: 0, width: 0.5, background: "#0f2044", left: "50%" }} />
                  <span style={{ fontSize: 6, color: "#0f2044", fontFamily: "monospace", fontWeight: 700, zIndex: 1, background: "rgba(255,255,255,0.7)", padding: "0 2px" }}>
                    Slot {i + 1}
                  </span>
                  <span style={{ fontSize: 5, color: "#94a3b8", fontFamily: "monospace", marginTop: 2, zIndex: 1 }}>
                    {slot.width}×{slot.height}mm @ ({slot.x + offset.x},{slot.y + offset.y})
                  </span>
                </>
              ) : agent ? (
                <>
                  <div style={{ fontSize: 5, fontWeight: 900, color: "#0f2044", textAlign: "center", padding: "0 3px", lineHeight: 1.2, textTransform: "uppercase" }}>
                    {agent.nombre_completo}
                  </div>
                  <div style={{ fontSize: 4, color: "#b8860b", marginTop: 1 }}>
                    {getCargoLabel(agent.tipo_personal, agent.cargo)}
                  </div>
                </>
              ) : (
                <span style={{ fontSize: 6, color: "rgba(15,32,68,0.3)" }}>Slot {i + 1} vacío</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function ImpresionAvanzadaTab() {
  const { currentUser } = useAuth();
  const qrContainerRef = useRef<HTMLDivElement>(null);

  // ── Perfiles ────────────────────────────────────────────────────────────────
  const [profiles, setProfiles] = useState<PrinterProfile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROFILES);
      const custom: PrinterProfile[] = saved ? JSON.parse(saved) : [];
      return [...BUILTIN_PROFILES, ...custom];
    } catch { return BUILTIN_PROFILES; }
  });

  const [activeProfileId, setActiveProfileId] = useState<string>(() =>
    localStorage.getItem(STORAGE_KEY_ACTIVE) ?? BUILTIN_PROFILES[0].id
  );

  const activeProfile = profiles.find(p => p.id === activeProfileId) ?? profiles[0];

  // ── Calibración ─────────────────────────────────────────────────────────────
  const [offset, setOffset] = useState<CalibrationOffset>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY_CALIB);
      return s ? JSON.parse(s) : { x: 0, y: 0 };
    } catch { return { x: 0, y: 0 }; }
  });

  function saveCalib(next: CalibrationOffset) {
    setOffset(next);
    localStorage.setItem(STORAGE_KEY_CALIB, JSON.stringify(next));
  }

  // ── Tab activo ───────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"imprimir" | "config" | "calibracion">("imprimir");

  // ── Fase (frente/reverso) ───────────────────────────────────────────────────
  const [fase, setFase] = useState<"frente" | "reverso">("frente");

  // ── Cola de agentes ─────────────────────────────────────────────────────────
  // queue[i] = agente asignado al slot i (null = vacío)
  const [queue, setQueue] = useState<(AgenteCarnet | null)[]>(
    new Array(activeProfile.slots.length).fill(null)
  );

  // Reiniciar cola cuando cambia perfil
  useEffect(() => {
    setQueue(new Array(activeProfile.slots.length).fill(null));
    setFase("frente");
    localStorage.setItem(STORAGE_KEY_ACTIVE, activeProfileId);
  }, [activeProfileId, activeProfile.slots.length]);

  // ── Datos ───────────────────────────────────────────────────────────────────
  const { data: agentes = [], isLoading } = useQuery<AgenteCarnet[]>({
    queryKey: ["agentes-carnets"],
    queryFn: async () => { const r = await apiFetch("/agente/tokens"); return r.ok ? r.json() : []; },
  });

  const [busqueda, setBusqueda] = useState("");
  const filtrados = agentes.filter(a =>
    a.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
    (a.dpi ?? "").includes(busqueda)
  ).filter(a => a.qr_token);

  const impresoPor = (currentUser as { nombre?: string; username?: string } | null)?.nombre
    ?? (currentUser as { nombre?: string; username?: string } | null)?.username
    ?? "Sistema";

  // ── Asignar / desasignar agente a slot ──────────────────────────────────────
  function assignToSlot(slotIdx: number, agent: AgenteCarnet | null) {
    setQueue(prev => {
      const next = [...prev];
      next[slotIdx] = agent;
      return next;
    });
  }

  function autoFill() {
    const sin = filtrados.filter(a => !queue.some(q => q?.employee_id === a.employee_id));
    const siguiente = [...queue];
    let ci = 0;
    for (let i = 0; i < siguiente.length && ci < sin.length; i++) {
      if (!siguiente[i]) { siguiente[i] = sin[ci++]; }
    }
    setQueue(siguiente);
  }

  function clearQueue() { setQueue(new Array(activeProfile.slots.length).fill(null)); setFase("frente"); }

  // ── Impresión ────────────────────────────────────────────────────────────────
  const [printing, setPrinting] = useState(false);

  async function handlePrintFrente() {
    const agentesEnCola = queue.filter(Boolean) as AgenteCarnet[];
    if (agentesEnCola.length === 0) return;
    setPrinting(true);

    const origin = window.location.origin;
    const logoIconB64 = await toBase64Url(`${origin}/images/logo-icon.png`);
    const fecha = new Date().toLocaleDateString("es-GT", { month: "long", year: "numeric" });

    // Capturar QRs del contenedor oculto
    const qrMap: Record<number, string> = {};
    qrContainerRef.current?.querySelectorAll<HTMLElement>("[data-emp-id]").forEach(div => {
      const id = Number(div.getAttribute("data-emp-id"));
      const svg = div.querySelector("svg");
      if (svg) qrMap[id] = new XMLSerializer().serializeToString(svg);
    });

    // Generar slot HTML: carnet si hay agente, vacío si no
    const slots = queue.map(a => {
      if (!a) return "";
      const svgHtml = qrMap[a.employee_id] ?? "<span style='font-size:8pt;color:#999'>QR</span>";
      return buildCardFrenteHTML(a, svgHtml, logoIconB64, fecha);
    });

    const css = buildPrintPageCSS(activeProfile, offset);
    openPrintPage(`Frentes ISP (${agentesEnCola.length})`, css, slots);
    setFase("reverso");
    setPrinting(false);
  }

  async function handlePrintReverso() {
    const agentesEnCola = queue.filter(Boolean) as AgenteCarnet[];
    if (agentesEnCola.length === 0) return;
    setPrinting(true);

    const origin = window.location.origin;
    const logoFullB64 = await toBase64Url(`${origin}/images/logo-isp.png`);

    const slots = queue.map(a => a ? buildCardReversoHTML(logoFullB64) : "");
    const css = buildPrintPageCSS(activeProfile, offset);
    openPrintPage(`Reversos ISP (${agentesEnCola.length})`, css, slots);

    // Registrar impresión
    await Promise.all(
      agentesEnCola.map(a =>
        apiFetch(`/agente/tokens/${a.employee_id}/registrar-impresion`, {
          method: "POST", body: JSON.stringify({ impresoPor }),
        })
      )
    );

    clearQueue();
    setPrinting(false);
  }

  // ── Calibración test print ───────────────────────────────────────────────────
  function printCalibration() {
    const css = buildCalibrationCSS(activeProfile, offset);
    const slots = activeProfile.slots.map((s, i) => `
      <div class="crosshair"></div>
      <div class="slot-label">Slot ${i + 1}</div>
      <div class="slot-dim">${s.width}×${s.height}mm @ (${(s.x + offset.x).toFixed(1)},${(s.y + offset.y).toFixed(1)})</div>
    `);
    openPrintPage(`Calibración — ${activeProfile.name}`, css, slots);
  }

  // ── Config de perfil nuevo ──────────────────────────────────────────────────
  const [newProfile, setNewProfile] = useState<Omit<PrinterProfile, "id">>({
    name: "", pageWidth: 216, pageHeight: 279, orientation: "portrait",
    slots: [{ x: 81, y: 25, width: 53.98, height: 85.6 }],
  });

  function saveNewProfile() {
    if (!newProfile.name.trim()) return;
    const prof: PrinterProfile = { ...newProfile, id: `custom-${Date.now()}`, custom: true };
    const custom = profiles.filter(p => p.custom);
    const allCustom = [...custom, prof];
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(allCustom));
    setProfiles([...BUILTIN_PROFILES, ...allCustom]);
    setActiveProfileId(prof.id);
  }

  function deleteCustomProfile(id: string) {
    const custom = profiles.filter(p => p.custom && p.id !== id);
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(custom));
    setProfiles([...BUILTIN_PROFILES, ...custom]);
    if (activeProfileId === id) setActiveProfileId(BUILTIN_PROFILES[0].id);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Selector de perfil */}
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="w-4 h-4 text-white/30 flex-shrink-0" />
        <div className="relative flex-1">
          <select
            value={activeProfileId}
            onChange={e => setActiveProfileId(e.target.value)}
            className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white pr-8 outline-none"
          >
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-white/3 p-1 rounded-xl">
        {[
          { id: "imprimir",    label: "Imprimir",    icon: Printer },
          { id: "config",      label: "Perfiles",    icon: Settings },
          { id: "calibracion", label: "Calibración", icon: Target },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as typeof tab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === id ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
            }`}
          >
            <Icon className="w-3 h-3" />{label}
          </button>
        ))}
      </div>

      {/* ── TAB: IMPRIMIR ─────────────────────────────────────────────────── */}
      {tab === "imprimir" && (
        <div className="space-y-4">
          <TrayPreview profile={activeProfile} offset={offset} queue={queue} />

          {/* Slots */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">
                Slots ({queue.filter(Boolean).length}/{activeProfile.slots.length} asignados)
              </p>
              <button onClick={autoFill} className="text-[10px] text-[#f5c842]/70 hover:text-[#f5c842] transition-colors">
                Autocompletar
              </button>
            </div>
            {activeProfile.slots.map((_, i) => (
              <div key={i} className="flex items-center gap-2 bg-white/3 border border-white/8 rounded-xl p-2.5">
                <div className="w-5 h-5 rounded-md bg-[#0f2044]/60 border border-[#f5c842]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#f5c842] text-[9px] font-black">{i + 1}</span>
                </div>
                {queue[i] ? (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-semibold truncate">{queue[i]!.nombre_completo}</p>
                      <p className="text-white/40 text-[10px]">{getCargoLabel(queue[i]!.tipo_personal, queue[i]!.cargo)}</p>
                    </div>
                    <button onClick={() => assignToSlot(i, null)} className="p-1 rounded hover:bg-white/10 transition-colors text-white/30 hover:text-white/60">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="flex-1">
                    <div className="relative">
                      <select
                        value=""
                        onChange={e => {
                          const a = agentes.find(ag => ag.employee_id === Number(e.target.value));
                          if (a) assignToSlot(i, a);
                        }}
                        className="w-full appearance-none bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/50 outline-none"
                      >
                        <option value="">— Seleccionar agente —</option>
                        {filtrados
                          .filter(a => !queue.some(q => q?.employee_id === a.employee_id))
                          .map(a => (
                            <option key={a.employee_id} value={a.employee_id}>
                              {a.nombre_completo}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Búsqueda rápida */}
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar agente por nombre o DPI..."
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 outline-none"
          />

          {/* Fase y botones */}
          {fase === "frente" ? (
            <button
              onClick={handlePrintFrente}
              disabled={queue.every(q => !q) || printing}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#f5c842]/10 hover:bg-[#f5c842]/20 border border-[#f5c842]/30 rounded-xl text-sm text-[#f5c842] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Printer className="w-4 h-4" />
              {printing ? "Preparando..." : `Imprimir frentes (${queue.filter(Boolean).length} tarjeta${queue.filter(Boolean).length !== 1 ? "s" : ""})`}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-2.5">
                <RefreshCw className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-amber-300/70 text-[11px] leading-relaxed">
                  Dale la vuelta a las tarjetas, insértalas de nuevo en la bandeja y luego imprime el reverso.
                </p>
              </div>
              <button
                onClick={handlePrintReverso}
                disabled={printing}
                className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl text-sm text-amber-300 font-semibold disabled:opacity-40 transition-colors"
              >
                <Printer className="w-4 h-4" />
                {printing ? "Preparando..." : "Imprimir reversos"}
              </button>
              <button onClick={clearQueue} className="w-full py-2 text-xs text-white/30 hover:text-white/50 transition-colors">
                Cancelar y limpiar cola
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: CONFIGURACIÓN ──────────────────────────────────────────────── */}
      {tab === "config" && (
        <div className="space-y-5">
          {/* Perfiles existentes */}
          <div className="space-y-2">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Perfiles disponibles</p>
            {profiles.map(p => (
              <div key={p.id} className={`flex items-center gap-2 p-3 rounded-xl border transition-colors ${
                p.id === activeProfileId ? "bg-[#f5c842]/5 border-[#f5c842]/20" : "bg-white/3 border-white/8"
              }`}>
                {p.id === activeProfileId && <CheckCircle className="w-3.5 h-3.5 text-[#f5c842] flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold truncate">{p.name}</p>
                  <p className="text-white/30 text-[10px]">
                    {p.pageWidth}×{p.pageHeight}mm · {p.slots.length} slot{p.slots.length !== 1 ? "s" : ""}
                    {p.slots.length > 0 && ` · CR-80 ${p.slots[0].width}×${p.slots[0].height}mm`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveProfileId(p.id)}
                    className="px-2 py-1 text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/50 transition-colors"
                  >
                    Usar
                  </button>
                  {p.custom && (
                    <button
                      onClick={() => deleteCustomProfile(p.id)}
                      className="p-1 text-red-400/50 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Crear perfil nuevo */}
          <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-3">
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Crear perfil personalizado</p>
            <input
              value={newProfile.name}
              onChange={e => setNewProfile(p => ({ ...p, name: e.target.value }))}
              placeholder="Nombre del perfil (ej: Canon TS702a - 2 tarjetas)"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-white/30 outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-white/30 text-[10px] block mb-1">Ancho hoja (mm)</label>
                <input type="number" value={newProfile.pageWidth}
                  onChange={e => setNewProfile(p => ({ ...p, pageWidth: Number(e.target.value) }))}
                  className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white outline-none" />
              </div>
              <div>
                <label className="text-white/30 text-[10px] block mb-1">Alto hoja (mm)</label>
                <input type="number" value={newProfile.pageHeight}
                  onChange={e => setNewProfile(p => ({ ...p, pageHeight: Number(e.target.value) }))}
                  className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white outline-none" />
              </div>
            </div>

            {/* Slots */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-white/30 text-[10px] uppercase tracking-wider">Slots de tarjeta</p>
                <button
                  onClick={() => setNewProfile(p => ({ ...p, slots: [...p.slots, { x: 10, y: 10, width: 53.98, height: 85.6 }] }))}
                  className="flex items-center gap-1 text-[10px] text-[#f5c842]/60 hover:text-[#f5c842] transition-colors"
                >
                  <Plus className="w-3 h-3" /> Agregar slot
                </button>
              </div>
              {newProfile.slots.map((slot, i) => (
                <div key={i} className="grid grid-cols-4 gap-1.5">
                  {(["x", "y", "width", "height"] as const).map(field => (
                    <div key={field}>
                      <label className="text-white/25 text-[9px] block mb-0.5 uppercase">{field} (mm)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={slot[field]}
                        onChange={e => setNewProfile(p => {
                          const slots = [...p.slots];
                          slots[i] = { ...slots[i], [field]: Number(e.target.value) };
                          return { ...p, slots };
                        })}
                        className="w-full px-1.5 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-white outline-none"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <button
              onClick={saveNewProfile}
              disabled={!newProfile.name.trim()}
              className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-white/60 font-semibold disabled:opacity-40 transition-colors"
            >
              <Save className="w-3.5 h-3.5" /> Guardar perfil
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: CALIBRACIÓN ────────────────────────────────────────────────── */}
      {tab === "calibracion" && (
        <div className="space-y-4">
          <TrayPreview profile={activeProfile} offset={offset} queue={[]} isCalib />

          <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 space-y-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-amber-300/80 text-xs font-bold mb-1">Calibración de posición</p>
                <p className="text-amber-300/50 text-[10px] leading-relaxed">
                  Imprime la plantilla de prueba sobre papel, compárala con la bandeja y ajusta el offset hasta que los rectángulos coincidan con los slots físicos del PVC.
                </p>
              </div>
            </div>

            {/* Offset X */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white/50 text-xs">Offset horizontal (X)</span>
                <span className="text-[#f5c842] text-xs font-mono font-bold">
                  {offset.x >= 0 ? "+" : ""}{offset.x.toFixed(1)} mm
                </span>
              </div>
              <div className="flex items-center gap-2">
                {[-1, -0.5, -0.1].map(d => (
                  <button key={d} onClick={() => saveCalib({ ...offset, x: Math.round((offset.x + d) * 10) / 10 })}
                    className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white/60 transition-colors">
                    {d}mm
                  </button>
                ))}
                <span className="text-white/20 text-xs">·</span>
                {[0.1, 0.5, 1].map(d => (
                  <button key={d} onClick={() => saveCalib({ ...offset, x: Math.round((offset.x + d) * 10) / 10 })}
                    className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white/60 transition-colors">
                    +{d}mm
                  </button>
                ))}
              </div>
            </div>

            {/* Offset Y */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white/50 text-xs">Offset vertical (Y)</span>
                <span className="text-[#f5c842] text-xs font-mono font-bold">
                  {offset.y >= 0 ? "+" : ""}{offset.y.toFixed(1)} mm
                </span>
              </div>
              <div className="flex items-center gap-2">
                {[-1, -0.5, -0.1].map(d => (
                  <button key={d} onClick={() => saveCalib({ ...offset, y: Math.round((offset.y + d) * 10) / 10 })}
                    className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white/60 transition-colors">
                    {d}mm
                  </button>
                ))}
                <span className="text-white/20 text-xs">·</span>
                {[0.1, 0.5, 1].map(d => (
                  <button key={d} onClick={() => saveCalib({ ...offset, y: Math.round((offset.y + d) * 10) / 10 })}
                    className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white/60 transition-colors">
                    +{d}mm
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={printCalibration}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#f5c842]/10 hover:bg-[#f5c842]/20 border border-[#f5c842]/30 rounded-xl text-sm text-[#f5c842] font-semibold transition-colors"
              >
                <Printer className="w-3.5 h-3.5" /> Imprimir plantilla
              </button>
              <button
                onClick={() => saveCalib({ x: 0, y: 0 })}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-white/40 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="bg-white/3 border border-white/8 rounded-xl p-3 space-y-1">
            <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider mb-2">Valores actuales guardados</p>
            <p className="text-white/30 text-[10px] font-mono">Perfil: {activeProfile.name}</p>
            <p className="text-white/30 text-[10px] font-mono">Hoja: {activeProfile.pageWidth}×{activeProfile.pageHeight}mm</p>
            {activeProfile.slots.map((s, i) => (
              <p key={i} className="text-white/30 text-[10px] font-mono">
                Slot {i + 1}: X={s.x + offset.x}mm  Y={s.y + offset.y}mm  W={s.width}mm  H={s.height}mm
              </p>
            ))}
          </div>
        </div>
      )}

      {/* QR ocultos */}
      <div ref={qrContainerRef} style={{ position: "absolute", visibility: "hidden", top: 0, left: 0, pointerEvents: "none", zIndex: -1 }}>
        {agentes.filter(a => a.qr_token).map(a => (
          <div key={a.employee_id} data-emp-id={a.employee_id}>
            <QRCodeSVG value={`${window.location.origin}/agente?token=${a.qr_token}`} size={72} />
          </div>
        ))}
      </div>

      {isLoading && <p className="text-white/30 text-xs text-center py-4">Cargando agentes...</p>}
    </div>
  );
}
