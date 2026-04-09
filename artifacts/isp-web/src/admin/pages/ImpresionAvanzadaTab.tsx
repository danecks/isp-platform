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
  Save, X, AlertTriangle, CheckCircle, CreditCard, RefreshCw, Download,
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
const DEFAULT_CARD_W = 53.98; // CR-80 ancho portrait (mm)
const DEFAULT_CARD_H = 85.60; // CR-80 alto portrait (mm)
// En la bandeja las tarjetas van LANDSCAPE (acostadas): ancho=85.6, alto=53.98
const CARD_LS_W = DEFAULT_CARD_H; // 85.60 mm
const CARD_LS_H = DEFAULT_CARD_W; // 53.98 mm

const BUILTIN_PROFILES: PrinterProfile[] = [
  {
    id: "canon-ts702a-2cards",
    name: "Canon TS702a — 2 tarjetas (bandeja MP)",
    // Hoja carta 216×279 mm, tarjetas LANDSCAPE apiladas verticalmente
    pageWidth: 216,
    pageHeight: 279,
    orientation: "portrait",
    slots: [
      // Slot superior landscape: X centrado = (216 − 85.6) / 2 ≈ 65mm  |  Y ≈ 25mm
      { x: 65, y: 25,  width: CARD_LS_W, height: CARD_LS_H },
      // Slot inferior landscape: mismo X, Y = 25 + 53.98 + 10 ≈ 89mm
      { x: 65, y: 89,  width: CARD_LS_W, height: CARD_LS_H },
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
 * CSS del diseño Moderno ISP — PORTRAIT CR-80 (53.98×85.6mm).
 * El slot en la hoja es landscape (85.6×53.98mm) pero el diseño interior
 * es portrait y se rota -90° para imprimir correctamente cuando la tarjeta
 * se toma en posición vertical.
 */
function getCardInnerCSS(): string {
  return `
    /*
     * ROTACIÓN: el slot en la hoja es landscape (85.6×53.98mm).
     * El diseño es portrait (53.98×85.6mm) rotado -90° (CCW) para imprimir
     * correctamente. Al tomar la tarjeta en vertical el diseño queda derecho.
     *
     * Matemática: position:absolute, left=0, top=53.98mm (=slot height),
     * transform-origin:0 0, rotate(-90deg) → llena exactamente el slot.
     */
    .icard, .rcard {
      position: absolute;
      left: 0;
      top: 53.98mm;           /* = alto del slot landscape = CR-80 portrait width */
      transform-origin: 0 0;
      transform: rotate(-90deg);
    }

    /* ── FRENTE portrait (Moderno) ─────────────────────────────────────────── */
    .icard {
      width: 53.98mm; height: 85.6mm;
      display:flex; flex-direction:row; overflow:hidden;
      font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      background:#fff;
    }

    /* Franja navy izquierda */
    .i-stripe {
      width:10.5mm;
      background:linear-gradient(180deg,#0f2044 0%,#132a5a 100%);
      display:flex; flex-direction:column; align-items:center;
      flex-shrink:0; position:relative;
    }
    .i-bar-t { position:absolute; top:0; left:0; right:0; height:1mm; background:#f5c842; }
    .i-bar-b { position:absolute; bottom:0; left:0; right:0; height:1mm; background:#f5c842; }
    .i-stripe-in {
      display:flex; flex-direction:column; align-items:center;
      justify-content:space-between; padding:3mm 0; width:100%; height:100%;
    }
    .i-slogo { width:7mm; object-fit:contain; filter:brightness(0) invert(1); }
    .i-snum {
      writing-mode:vertical-rl; transform:rotate(180deg);
      font-size:4pt; color:rgba(255,255,255,.4);
      font-family:"Courier New",monospace; font-weight:700; letter-spacing:.1em;
    }

    /* Columna de contenido portrait */
    .i-content { flex:1; display:flex; flex-direction:column; overflow:hidden; background:#fff; }

    /* Header: avatar centrado + nombre + cargo */
    .i-head {
      padding:2.5mm 2mm 2mm;
      display:flex; flex-direction:column; align-items:center; flex-shrink:0;
    }
    .i-av {
      width:13mm; height:13mm; border-radius:50%;
      background:linear-gradient(135deg,#0f2044,#1e4a9a);
      border:.8pt solid #f5c842;
      display:flex; align-items:center; justify-content:center; margin-bottom:1.5mm;
    }
    .i-av-i { font-size:8pt; font-weight:900; color:#f5c842; }
    .i-nom {
      font-size:6pt; font-weight:900; color:#0f2044;
      text-align:center; line-height:1.2; text-transform:uppercase; margin-bottom:.8mm;
    }
    .i-cargo {
      font-size:4pt; font-weight:700; color:#b8860b;
      text-align:center; letter-spacing:.1em; text-transform:uppercase;
    }

    /* Línea dorada */
    .i-gold { height:.6pt; background:linear-gradient(90deg,#d4a017,#f5c842,#e8b820); flex-shrink:0; }

    /* Área de datos */
    .i-datos { padding:1.5mm 2mm; flex:1; }
    .i-dlbl {
      font-size:3.5pt; color:#94a3b8; font-weight:700;
      letter-spacing:.1em; text-transform:uppercase; margin-bottom:.5mm;
    }
    .i-dval {
      font-size:5.5pt; color:#0f2044; font-weight:800;
      font-family:"Courier New",monospace; margin-bottom:1.5mm;
    }
    .i-div { height:.3pt; background:#f1f5f9; margin-bottom:1.5mm; }

    /* QR centrado */
    .i-qr { display:flex; flex-direction:column; align-items:center; gap:1mm; }
    .i-qrbox { background:#fff; border:.4pt solid #e2e8f0; border-radius:1mm; padding:.5mm; }
    .i-qrbox svg { width:18mm; height:18mm; display:block; }
    .i-qrhint { font-size:3pt; color:#94a3b8; text-align:center; }

    /* Footer navy */
    .i-foot {
      background:#0f2044; padding:1mm 2mm;
      display:flex; align-items:center; justify-content:space-between; flex-shrink:0;
    }
    .i-fdate { font-size:3pt; color:rgba(255,255,255,.35); }
    .i-flbl { font-size:3pt; font-weight:800; color:#f5c842; letter-spacing:.08em; }

    /* ── REVERSO portrait (Moderno) ─────────────────────────────────────────── */
    .rcard {
      width: 53.98mm; height: 85.6mm;
      display:flex; flex-direction:column; overflow:hidden;
      font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      background:#fff;
    }
    .r-top {
      padding:4mm 3mm 2mm;
      display:flex; flex-direction:column; align-items:center; flex-shrink:0;
    }
    .r-logo { height:18mm; object-fit:contain; }
    .r-org {
      font-size:3.8pt; color:#0f2044; letter-spacing:.1em;
      font-weight:700; text-align:center; margin-top:1.5mm;
    }
    .r-gold { height:.8pt; background:linear-gradient(90deg,#d4a017,#f5c842,#d4a017); flex-shrink:0; }
    .r-body {
      flex:1; display:flex; align-items:center; justify-content:center; padding:2.5mm 4mm;
    }
    .r-legal { font-size:5.5pt; color:#1e3a5f; text-align:center; line-height:1.65; }
    .r-legal strong { font-weight:800; color:#0f2044; }
    .r-divider {
      height:.5pt;
      background:linear-gradient(90deg,transparent,rgba(245,200,66,.5),#f5c842,rgba(245,200,66,.5),transparent);
      margin:0 4mm; flex-shrink:0;
    }
    .r-footer {
      padding:1.5mm 3mm 2mm;
      display:flex; flex-direction:column; align-items:center; flex-shrink:0;
    }
    .r-web { font-size:6.5pt; font-weight:900; color:#0f2044; letter-spacing:.06em; }
    .r-email { font-size:3.8pt; color:#94a3b8; letter-spacing:.04em; margin-top:.5mm; }
    .r-bottom { background:#0f2044; height:2mm; flex-shrink:0; }
  `;
}

/**
 * Genera el HTML del FRENTE — diseño Moderno PORTRAIT (53.98×85.6mm).
 * El slot físico es landscape; el contenido se rota -90° vía CSS de impresión.
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
  const dpiRow = a.dpi
    ? `<div class="i-dlbl">DPI</div><div class="i-dval">${a.dpi}</div>`
    : "";
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
 * Genera el HTML del REVERSO — diseño Moderno PORTRAIT (53.98×85.6mm).
 * Logo ISP centrado · texto legal · web/email · banda navy inferior.
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
      de sus funciones en el puesto asignado.
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

// ────────────────────────────────────────────────────────────────────────────
// AGENTE LOCAL DE IMPRESIÓN  (http://localhost:7821)
// Cuando el agente está corriendo en la PC del usuario, se usa en lugar
// del popup del navegador — impresión silenciosa sin diálogos.
// ────────────────────────────────────────────────────────────────────────────

const AGENT_URL = "http://localhost:7821";

interface AgentStatus {
  ok: boolean;
  version?: string;
  hostname?: string;
  browser?: string | null;
  printers?: string[];
  canon?: string | null;
}

/** Comprueba si el agente local está corriendo. Timeout 1s para no bloquear la UI. */
async function checkAgent(): Promise<AgentStatus | null> {
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 1500);
    const r = await fetch(`${AGENT_URL}/status`, { signal: ctrl.signal });
    clearTimeout(id);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/**
 * Genera el HTML completo de la página de impresión y lo manda al agente local.
 * Si el agente no responde, cae al popup del navegador.
 */
async function sendToAgent(
  title: string,
  css: string,
  slots: string[],
  agentStatus: AgentStatus | null,
): Promise<"agent" | "popup"> {
  if (agentStatus?.ok) {
    const slotDivs = slots.map((h, i) => `<div class="slot slot-${i}">${h}</div>`).join("\n");
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>${title}</title><style>${css}</style></head>
<body><div class="print-page">${slotDivs}</div>
<script>window.onload=function(){window.print();setTimeout(function(){window.close();},3000);};<\/script>
</body></html>`;
    try {
      const r = await fetch(`${AGENT_URL}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      });
      if (r.ok) return "agent";
    } catch {}
  }
  // Fallback: popup del navegador
  openPrintPopup(title, css, slots);
  return "popup";
}

/** Abre el popup clásico del navegador (fallback cuando no hay agente) */
function openPrintPopup(title: string, css: string, slots: string[]): void {
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

/** Mantener compatibilidad con código existente */
function openPrintPage(title: string, css: string, slots: string[]): void {
  openPrintPopup(title, css, slots);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES UI — Mini cards del diseño Moderno para la vista previa
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mini-card FRENTE: diseño portrait (96×152px) rotado -90° dentro del slot landscape.
 * El slot es w×h (landscape). El diseño portrait se escala y rota para encajar.
 */
function MiniCardFrente({ agent, w, h }: { agent: AgenteCarnet; w: number; h: number }) {
  // Portrait base: 96px wide × 152px tall
  // Slot landscape: w px wide × h px tall
  // Scale: portrait_width → slot_height, portrait_height → slot_width
  const BASE_PW = 96;   // portrait width
  const BASE_PH = 152;  // portrait height
  const s = Math.min(h / BASE_PW, w / BASE_PH); // scale so portrait fits in slot after rotation
  const initials = getInitials(agent.nombre_completo);
  const cargo    = getCargoLabel(agent.tipo_personal, agent.cargo);
  const num      = agent.empl_numero ? `#${String(agent.empl_numero).padStart(4, "0")}` : "";

  // After rotate(-90deg) with origin at (0,0):
  // portrait card at position left=0, top=h fills the landscape slot exactly
  const cardW = BASE_PW * s;
  const cardH = BASE_PH * s;

  return (
    <div style={{ width: w, height: h, overflow: "hidden", background: "#fff", position: "relative" }}>
      {/* Portrait card rotado -90° CCW para llenar el slot landscape */}
      <div style={{
        position: "absolute", left: 0, top: h,
        width: cardW, height: cardH,
        transformOrigin: "0 0",
        transform: "rotate(-90deg)",
        display: "flex", flexDirection: "row",
        fontFamily: "Arial,sans-serif", overflow: "hidden", background: "#fff",
      }}>
        {/* Franja navy izquierda */}
        <div style={{ width: cardW * 0.22, background: "linear-gradient(180deg,#0f2044,#132a5a)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "6px 0", position: "relative", flexShrink: 0 }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "#f5c842" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "#f5c842" }} />
          <img src="/images/logo-icon.png" style={{ width: "75%", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 5, color: "rgba(255,255,255,.4)", fontFamily: "monospace", fontWeight: 700 }}>{num}</span>
        </div>
        {/* Contenido portrait */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Header: avatar + nombre + cargo */}
          <div style={{ padding: "5px 4px 3px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg,#0f2044,#1e4a9a)", border: "1px solid #f5c842", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 2 }}>
              <span style={{ color: "#f5c842", fontSize: 8, fontWeight: 900 }}>{initials}</span>
            </div>
            <div style={{ fontSize: 5, fontWeight: 900, color: "#0f2044", textAlign: "center", lineHeight: 1.2, textTransform: "uppercase", marginBottom: 1 }}>{agent.nombre_completo}</div>
            <div style={{ fontSize: 3.5, fontWeight: 700, color: "#b8860b", letterSpacing: "0.04em" }}>{cargo}</div>
          </div>
          {/* Gold line */}
          <div style={{ height: 1, background: "linear-gradient(90deg,#d4a017,#f5c842,#e8b820)", flexShrink: 0 }} />
          {/* Datos + QR */}
          <div style={{ padding: "3px 4px", flex: 1 }}>
            {agent.dpi && <>
              <div style={{ fontSize: 3, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", marginBottom: 1 }}>DPI</div>
              <div style={{ fontSize: 4.5, color: "#0f2044", fontWeight: 800, fontFamily: "monospace", marginBottom: 2 }}>{agent.dpi}</div>
            </>}
            <div style={{ height: 0.5, background: "#f1f5f9", marginBottom: 3 }} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <QRCodeSVG value={`/agente?token=${agent.qr_token ?? ""}`} size={Math.round(cardW * 0.5)} />
              <span style={{ fontSize: 3, color: "#94a3b8" }}>Escanea para verificar</span>
            </div>
          </div>
          {/* Footer navy */}
          <div style={{ background: "#0f2044", padding: "2px 4px", display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
            <span style={{ fontSize: 3, color: "rgba(255,255,255,.3)" }}>2026</span>
            <span style={{ fontSize: 3, color: "#f5c842", fontWeight: 800 }}>CARNET ISP</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Mini-card REVERSO: diseño portrait (96×152px) rotado -90° dentro del slot landscape.
 */
function MiniCardReverso({ w, h }: { w: number; h: number }) {
  const BASE_PW = 96;
  const BASE_PH = 152;
  const s = Math.min(h / BASE_PW, w / BASE_PH);
  const cardW = BASE_PW * s;
  const cardH = BASE_PH * s;

  return (
    <div style={{ width: w, height: h, overflow: "hidden", background: "#fff", position: "relative" }}>
      <div style={{
        position: "absolute", left: 0, top: h,
        width: cardW, height: cardH,
        transformOrigin: "0 0",
        transform: "rotate(-90deg)",
        display: "flex", flexDirection: "column",
        fontFamily: "Arial,sans-serif", overflow: "hidden", background: "#fff",
      }}>
        {/* Logo ISP centrado */}
        <div style={{ padding: "7px 6px 4px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <img src="/images/logo-isp.png" style={{ height: cardH * 0.2, objectFit: "contain" }} />
          <div style={{ fontSize: 3.5, color: "#0f2044", fontWeight: 700, textAlign: "center", marginTop: 3, letterSpacing: "0.05em" }}>INVESTIGACIONES Y SEGURIDAD PROFESIONAL S.A.</div>
        </div>
        <div style={{ height: 1.5, background: "linear-gradient(90deg,#d4a017,#f5c842,#d4a017)", flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 6px" }}>
          <div style={{ fontSize: 4.5, color: "#1e3a5f", textAlign: "center", lineHeight: 1.55 }}>
            El presente acredita como colaborador de <strong style={{ color: "#0f2044" }}>ISP S.A.</strong> Se solicita a las Autoridades <strong>Civiles y Militares</strong> la colaboración.
          </div>
        </div>
        <div style={{ height: 0.5, background: "linear-gradient(90deg,transparent,#f5c84270,#f5c842,#f5c84270,transparent)", margin: "0 8px", flexShrink: 0 }} />
        <div style={{ padding: "3px 6px 5px", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 6, fontWeight: 900, color: "#0f2044" }}>www.ispsa.net</div>
          <div style={{ fontSize: 3.5, color: "#94a3b8", marginTop: 1 }}>contacto@isp-guatemala.com</div>
        </div>
        <div style={{ height: 4, background: "#0f2044", flexShrink: 0 }} />
      </div>
    </div>
  );
}

/** Vista escalada de la bandeja con mini-cards del diseño Moderno */
function TrayPreview({
  profile,
  offset,
  queue,
  fase = "frente",
  isCalib = false,
}: {
  profile: PrinterProfile;
  offset: CalibrationOffset;
  queue: (AgenteCarnet | null)[];
  fase?: "frente" | "reverso";
  isCalib?: boolean;
}) {
  const MAX_W = 240;
  const scale = MAX_W / profile.pageWidth;
  const previewH = profile.pageHeight * scale;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-white/30 text-[9px] uppercase tracking-wider">
        Vista previa · {profile.pageWidth}×{profile.pageHeight}mm
      </span>
      <div style={{
        width: MAX_W, height: previewH,
        background: "#f0f0f0",
        position: "relative",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 4,
        overflow: "hidden",
        flexShrink: 0,
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      }}>
        {/* Fondo papel */}
        <div style={{ position: "absolute", inset: 0, background: "#fff" }} />
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
                borderRadius: 2,
                overflow: "hidden",
                boxShadow: agent ? "0 1px 6px rgba(0,0,0,0.18)" : undefined,
                border: isCalib ? "1px dashed #0f2044"
                       : agent ? "none"
                       : "1px dashed rgba(15,32,68,0.2)",
                background: agent ? "#fff" : "rgba(15,32,68,0.03)",
              }}
            >
              {isCalib ? (
                <>
                  <div style={{ position: "absolute", left: 0, right: 0, height: 0.5, background: "#0f2044", top: "50%" }} />
                  <div style={{ position: "absolute", top: 0, bottom: 0, width: 0.5, background: "#0f2044", left: "50%" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                    <span style={{ fontSize: 7, color: "#0f2044", fontFamily: "monospace", fontWeight: 700, background: "rgba(255,255,255,.8)", padding: "0 2px" }}>Slot {i + 1}</span>
                    <span style={{ fontSize: 5.5, color: "#64748b", fontFamily: "monospace" }}>{slot.width}×{slot.height}mm</span>
                    <span style={{ fontSize: 5, color: "#94a3b8", fontFamily: "monospace" }}>({(slot.x + offset.x).toFixed(1)}, {(slot.y + offset.y).toFixed(1)})</span>
                  </div>
                </>
              ) : agent ? (
                fase === "frente"
                  ? <MiniCardFrente agent={agent} w={w} h={h} />
                  : <MiniCardReverso w={w} h={h} />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                  <span style={{ fontSize: 7, color: "rgba(15,32,68,0.25)", fontWeight: 700 }}>Slot {i + 1}</span>
                  <span style={{ fontSize: 5.5, color: "rgba(15,32,68,0.15)" }}>vacío</span>
                </div>
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

  // ── Agente local de impresión ────────────────────────────────────────────────
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [agentChecked, setAgentChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkAgent().then(s => {
      if (!cancelled) { setAgentStatus(s); setAgentChecked(true); }
    });
    // Re-verificar cada 30 segundos
    const interval = setInterval(() => {
      checkAgent().then(s => { if (!cancelled) setAgentStatus(s); });
    }, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

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

    // Generar slot HTML
    const slots = queue.map(a => {
      if (!a) return "";
      const svgHtml = qrMap[a.employee_id] ?? "<span style='font-size:8pt;color:#999'>QR</span>";
      return buildCardFrenteHTML(a, svgHtml, logoIconB64, fecha);
    });

    const css = buildPrintPageCSS(activeProfile, offset);
    await sendToAgent(`Frentes ISP (${agentesEnCola.length})`, css, slots, agentStatus);
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
    await sendToAgent(`Reversos ISP (${agentesEnCola.length})`, css, slots, agentStatus);

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

          {/* Indicador de paso */}
          <div className="flex items-center gap-0">
            {/* Paso 1 */}
            <div className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-l-xl border ${
              fase === "frente"
                ? "bg-[#f5c842]/10 border-[#f5c842]/30"
                : "bg-white/5 border-white/10"
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
                fase === "frente" ? "bg-[#f5c842] text-[#0f2044]" : "bg-emerald-500 text-white"
              }`}>
                {fase === "frente" ? "1" : "✓"}
              </div>
              <span className={`text-[10px] font-bold ${fase === "frente" ? "text-[#f5c842]" : "text-emerald-400"}`}>
                Lado frente
              </span>
            </div>
            {/* Flecha */}
            <div className="w-6 h-[1px] bg-white/15 flex-shrink-0" />
            {/* Paso 2 */}
            <div className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-r-xl border ${
              fase === "reverso"
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-white/3 border-white/8"
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
                fase === "reverso" ? "bg-amber-400 text-[#0f2044]" : "bg-white/10 text-white/30"
              }`}>
                2
              </div>
              <span className={`text-[10px] font-bold ${fase === "reverso" ? "text-amber-300" : "text-white/25"}`}>
                Lado reverso
              </span>
            </div>
          </div>

          {/* Vista previa de bandeja con diseño Moderno */}
          <TrayPreview profile={activeProfile} offset={offset} queue={queue} fase={fase} />

          {/* Asignación de slots — solo visible en paso 1 */}
          {fase === "frente" && (
            <>
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
                    )}
                  </div>
                ))}

                <input
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre o DPI..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 outline-none"
                />
              </div>

              {/* Indicador del agente de impresión */}
              {agentChecked && (
                agentStatus?.ok ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs border bg-emerald-500/8 border-emerald-500/20 text-emerald-400">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-emerald-400" />
                    Agente activo en {agentStatus.hostname ?? "esta PC"} — impresión silenciosa
                  </div>
                ) : (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" />
                      Sin agente local — se usará el diálogo del navegador
                    </div>
                    <a
                      href="/downloads/ISP-PrintAgent.exe"
                      className="flex items-center justify-center gap-2 w-full py-1.5 bg-white/5 hover:bg-white/10 border border-white/15 rounded-lg text-xs text-white/50 hover:text-white/70 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Descargar agente de impresión para Windows
                    </a>
                  </div>
                )
              )}

              <button
                onClick={handlePrintFrente}
                disabled={queue.every(q => !q) || printing}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#f5c842]/10 hover:bg-[#f5c842]/20 border border-[#f5c842]/30 rounded-xl text-sm text-[#f5c842] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Printer className="w-4 h-4" />
                {printing ? "Preparando..." : `Imprimir frentes (${queue.filter(Boolean).length} tarjeta${queue.filter(Boolean).length !== 1 ? "s" : ""})`}
              </button>
            </>
          )}

          {/* Paso 2 — reverso */}
          {fase === "reverso" && (
            <div className="space-y-3">
              {/* Instrucción flip */}
              <div className="bg-amber-500/8 border border-amber-500/25 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <p className="text-amber-300 text-sm font-bold">Dale vuelta a las tarjetas</p>
                </div>
                <ol className="text-amber-300/60 text-[11px] leading-relaxed space-y-1 ml-7">
                  <li>1. Saca las tarjetas de la bandeja</li>
                  <li>2. Dales vuelta (lado reverso hacia arriba)</li>
                  <li>3. Insértalas de nuevo en los mismos slots</li>
                  <li>4. Presiona "Imprimir reversos"</li>
                </ol>
              </div>

              <button
                onClick={handlePrintReverso}
                disabled={printing}
                className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded-xl text-sm text-amber-300 font-bold disabled:opacity-40 transition-colors"
              >
                <Printer className="w-4 h-4" />
                {printing ? "Preparando..." : "Imprimir reversos"}
              </button>

              <button onClick={clearQueue} className="w-full py-2 text-xs text-white/25 hover:text-white/50 transition-colors">
                Cancelar y empezar de nuevo
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
