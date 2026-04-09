/**
 * CarnetesQR.tsx
 * Módulo unificado de carnets de identificación PVC.
 * Pertenece a RRHH — ruta /admin/rrhh/carnets
 *
 * UX:      Lista con checkboxes (selección individual / seleccionar todos)
 * Acción:  Descarga ZIP con subcarpetas por agente
 *          zip/01_Juan_Perez/01_frente.jpg + 02_reverso.jpg
 * Diseño:  Carnet Moderno portrait CR-80 (53.98×85.6mm) — navy/dorado
 * Motor:   html2canvas (escala 3×, ~305 DPI) → JPEG 95%
 */

import { useState, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "../layout/AdminLayout";
import {
  Download, Search, CheckCircle, Users, CreditCard, BadgeCheck,
  MapPin, X, Camera, Loader2, Eye, RotateCcw,
} from "lucide-react";

// ── API ───────────────────────────────────────────────────────────────────────
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
  carnet_impreso_at: string | null;
  carnet_impreso_por: string | null;
  puesto_nombre: string | null;
  cliente_nombre: string | null;
  foto_url: string | null;
}

// ── Compresión de imagen client-side ─────────────────────────────────────────
async function comprimirFoto(file: File, maxSize = 300, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Error al comprimir")), "image/jpeg", quality);
    };
    img.onerror = reject;
    img.src = url;
  });
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

async function toBase64Url(url: string): Promise<string> {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch { return url; }
}

function safeFolderName(nombre: string) {
  return nombre
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_");
}

// ── Constructores de elementos DOM para html2canvas ───────────────────────────
// Usan estilos inline (sin CSS de clase) para que html2canvas los capture bien.
// Base: 96 DPI × escala 3 → ~288 DPI de salida.

const _MM = (mm: number) => Math.round(mm * 4);
const _PT = (pt: number) => Math.round(pt * 4 / 3.78);

function createFrenteElement(
  agent: AgenteCarnet,
  qrSvgStr: string,
  logoIconB64: string,
  fecha: string,
  fotoB64: string | null = null,
): HTMLDivElement {
  const W = _MM(53.98), H = _MM(85.6), SW = _MM(10.5);
  const initials = getInitials(agent.nombre_completo);
  const cargo    = getCargoLabel(agent.tipo_personal, agent.cargo);
  const num      = agent.empl_numero ? `#${String(agent.empl_numero).padStart(4, "0")}` : "";
  const qrSize   = _MM(20);
  const qrFixed  = qrSvgStr
    ? qrSvgStr.replace(/<svg([^>]*)>/, `<svg$1 width="${qrSize}" height="${qrSize}" style="display:block">`)
    : "";

  // Foto circular con borde dorado
  const fotoHtml = fotoB64
    ? `<img src="${fotoB64}" style="width:${_MM(16)}px;height:${_MM(16)}px;border-radius:50%;object-fit:cover;border:${_MM(0.7)}px solid #f5c842;box-shadow:0 ${_MM(1)}px ${_MM(3)}px rgba(15,32,68,.35);margin-bottom:${_MM(2)}px;display:block" crossorigin="anonymous" />`
    : `<div style="width:${_MM(16)}px;height:${_MM(16)}px;border-radius:50%;background:linear-gradient(135deg,#0f2044,#1e4a9a);border:${_MM(0.7)}px solid #f5c842;box-shadow:0 ${_MM(1)}px ${_MM(3)}px rgba(15,32,68,.35);display:flex;align-items:center;justify-content:center;margin-bottom:${_MM(2)}px"><span style="font-size:${_PT(10)}px;font-weight:900;color:#f5c842">${initials}</span></div>`;

  // Medallón del logo en la stripe (círculo blanco con logo)
  const logoMedaillon = `<div style="width:${_MM(7.5)}px;height:${_MM(7.5)}px;border-radius:50%;background:#fff;box-shadow:0 ${_MM(0.5)}px ${_MM(1.5)}px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;margin-top:${_MM(3)}px;flex-shrink:0;overflow:hidden"><img src="${logoIconB64}" style="width:${_MM(6)}px;height:${_MM(6)}px;object-fit:contain" /></div>`;

  const el = document.createElement("div");
  el.style.cssText = `width:${W}px;height:${H}px;display:flex;flex-direction:row;overflow:hidden;font-family:Arial,Helvetica,sans-serif;background:#fff;box-sizing:border-box`;
  el.innerHTML = `
  <!-- STRIPE LATERAL NAVY -->
  <div style="width:${SW}px;height:${H}px;background:linear-gradient(180deg,#0a1a3d 0%,#0f2044 60%,#0a1a3d 100%);display:flex;flex-direction:column;align-items:center;flex-shrink:0;position:relative;box-sizing:border-box">
    <div style="position:absolute;top:0;left:0;right:0;height:${_MM(0.8)}px;background:linear-gradient(90deg,#d4a017,#f5c842,#d4a017)"></div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:${_MM(0.8)}px;background:linear-gradient(90deg,#d4a017,#f5c842,#d4a017)"></div>
    ${logoMedaillon}
    <span style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:${_PT(3.8)}px;color:#f5c842;font-weight:800;margin-top:${_MM(2.5)}px;flex:1;display:flex;align-items:center;justify-content:center;letter-spacing:1.2px;text-transform:uppercase">INVESTIGACIONES Y SEGURIDAD PROFESIONAL S.A</span>
    <span style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:${_PT(3.5)}px;color:rgba(255,255,255,.35);font-family:monospace;font-weight:700;margin-bottom:${_MM(3.5)}px;letter-spacing:1px">${num}</span>
  </div>
  <!-- CUERPO BLANCO -->
  <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;background:#fff">
    <!-- SECCIÓN FOTO + NOMBRE: gradiente sutil -->
    <div style="padding:${_MM(3.5)}px ${_MM(2.5)}px ${_MM(2.5)}px;display:flex;flex-direction:column;align-items:center;flex-shrink:0;background:linear-gradient(180deg,#f8faff 0%,#fff 100%)">
      ${fotoHtml}
      <div style="font-size:${_PT(6)}px;font-weight:900;color:#0f2044;text-align:center;line-height:1.2;text-transform:uppercase;letter-spacing:.3px;margin-bottom:${_MM(0.8)}px">${agent.nombre_completo}</div>
      <div style="font-size:${_PT(3.8)}px;font-weight:700;color:#b8860b;text-align:center;letter-spacing:.12em;text-transform:uppercase">${cargo}</div>
    </div>
    <!-- DIVISOR DORADO -->
    <div style="height:${_MM(0.4)}px;background:linear-gradient(90deg,#d4a017,#f5c842,#d4a017);flex-shrink:0"></div>
    <!-- DPI -->
    <div style="padding:${_MM(2)}px ${_MM(2.5)}px ${_MM(1)}px;flex-shrink:0;text-align:center">
      <div style="font-size:${_PT(3.2)}px;color:#94a3b8;font-weight:700;letter-spacing:.15em;text-transform:uppercase;margin-bottom:${_MM(0.5)}px">DPI</div>
      <div style="font-size:${_PT(6)}px;color:#0f2044;font-weight:800;font-family:monospace;letter-spacing:.05em">${agent.dpi || "—"}</div>
    </div>
    <div style="height:${_MM(0.25)}px;background:#f1f5f9;margin:0 ${_MM(2.5)}px;flex-shrink:0"></div>
    <!-- QR CENTRADO -->
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:${_MM(1.5)}px ${_MM(2.5)}px ${_MM(1)}px;gap:${_MM(1.2)}px">
      <div style="background:#0f2044;border-radius:${_MM(1.8)}px;padding:${_MM(2)}px;display:inline-flex;box-shadow:0 ${_MM(0.8)}px ${_MM(3)}px rgba(15,32,68,.25)">${qrFixed}</div>
      <span style="font-size:${_PT(3)}px;color:#94a3b8;text-align:center;letter-spacing:.03em">Escanea para verificar identidad</span>
    </div>
    <!-- FOOTER NAVY -->
    <div style="background:#0f2044;padding:${_MM(1.3)}px ${_MM(2.5)}px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
      <span style="font-size:${_PT(3)}px;color:rgba(255,255,255,.3)">${fecha}</span>
      <span style="font-size:${_PT(3.2)}px;font-weight:800;color:#f5c842;letter-spacing:.08em;text-transform:uppercase">Carnet de Identificación</span>
    </div>
  </div>`;
  return el;
}

function createReversoElement(logoFullB64: string): HTMLDivElement {
  const W = _MM(53.98), H = _MM(85.6);
  const el = document.createElement("div");
  el.style.cssText = `width:${W}px;height:${H}px;display:flex;flex-direction:column;overflow:hidden;font-family:Arial,Helvetica,sans-serif;background:#fff;box-sizing:border-box`;
  el.innerHTML = `
  <!-- BANDA NAVY SUPERIOR -->
  <div style="background:linear-gradient(180deg,#0a1a3d,#0f2044);padding:${_MM(2)}px ${_MM(4)}px ${_MM(1.5)}px;display:flex;flex-direction:column;align-items:center;flex-shrink:0">
    <div style="font-size:${_PT(8)}px;font-weight:900;color:#fff;letter-spacing:.08em">ISP, S.A.</div>
    <div style="font-size:${_PT(3.5)}px;color:rgba(255,255,255,.45);letter-spacing:.15em;margin-top:${_MM(0.5)}px;text-align:center">INVESTIGACIONES Y SEGURIDAD PROFESIONAL, S.A.</div>
  </div>
  <!-- DIVISOR DORADO -->
  <div style="height:${_MM(0.5)}px;background:linear-gradient(90deg,#d4a017,#f5c842,#d4a017);flex-shrink:0"></div>
  <!-- LOGO GRANDE -->
  <div style="display:flex;align-items:center;justify-content:center;padding:${_MM(2)}px ${_MM(3)}px ${_MM(1)}px;flex-shrink:0">
    <img src="${logoFullB64}" style="max-height:${_MM(22)}px;max-width:88%;object-fit:contain;display:block" />
  </div>
  <!-- TEXTO -->
  <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:${_MM(1)}px ${_MM(4.5)}px ${_MM(3)}px">
    <div style="font-size:${_PT(5.5)}px;color:#334155;text-align:center;line-height:1.7">
      El presente acredita como colaborador de <strong style="font-weight:800;color:#0f2044">ISP S.A.</strong> Se solicita a las Autoridades <strong style="font-weight:800;color:#0f2044">Civiles y Militares</strong> su colaboración. Válido en el cumplimiento de sus funciones en el puesto asignado.
    </div>
  </div>
  <!-- DIVISOR TENUE DORADO -->
  <div style="height:${_MM(0.25)}px;background:linear-gradient(90deg,transparent,#f5c842,transparent);margin:0 ${_MM(5)}px;flex-shrink:0"></div>
  <!-- FOOTER CONTACTO -->
  <div style="padding:${_MM(2.5)}px ${_MM(4)}px ${_MM(3.5)}px;display:flex;flex-direction:column;align-items:center;gap:${_MM(0.8)}px;flex-shrink:0">
    <div style="font-size:${_PT(7)}px;font-weight:900;color:#0f2044;letter-spacing:.06em">www.ispsa.net</div>
    <div style="font-size:${_PT(4)}px;color:#25D366;font-weight:700;letter-spacing:.04em">+502 2200-0000</div>
  </div>
  <!-- BARRA INFERIOR NAVY -->
  <div style="background:#0f2044;height:${_MM(2)}px;flex-shrink:0"></div>`;
  return el;
}

// ── Preview JSX del carnet (para modal, no para impresión) ────────────────────
// Usa la misma escala _MM/_PT pero multiplica por SC=1.8 para pantalla.

const SC = 1.8;
const _M = (mm: number) => Math.round(mm * 4 * SC);
const _P = (pt: number) => Math.round((pt * 4 / 3.78) * SC);

function CarnetFrentePreview({ agent, fotoSrc }: { agent: AgenteCarnet; fotoSrc?: string | null }) {
  const cargo    = getCargoLabel(agent.tipo_personal, agent.cargo);
  const num      = agent.empl_numero ? `#${String(agent.empl_numero).padStart(4, "0")}` : "";
  const initials = getInitials(agent.nombre_completo);
  const W = _M(53.98), H = _M(85.6), SW = _M(10.5);
  const fecha = new Date().toLocaleDateString("es-GT", { month: "long", year: "numeric" });

  const fotoEl = fotoSrc
    ? <img src={fotoSrc} style={{ width: _M(16), height: _M(16), borderRadius: "50%", objectFit: "cover", border: `${_M(0.7)}px solid #f5c842`, boxShadow: `0 ${_M(1)}px ${_M(3)}px rgba(15,32,68,.35)`, marginBottom: _M(2), display: "block", flexShrink: 0 }} />
    : <div style={{ width: _M(16), height: _M(16), borderRadius: "50%", background: "linear-gradient(135deg,#0f2044,#1e4a9a)", border: `${_M(0.7)}px solid #f5c842`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: _M(2), flexShrink: 0 }}><span style={{ fontSize: _P(10), fontWeight: 900, color: "#f5c842" }}>{initials}</span></div>;

  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "row", overflow: "hidden", fontFamily: "Arial,Helvetica,sans-serif", background: "#fff", boxSizing: "border-box", borderRadius: 3, boxShadow: "0 8px 32px rgba(0,0,0,.5)" }}>
      {/* STRIPE LATERAL */}
      <div style={{ width: SW, height: H, background: "linear-gradient(180deg,#0a1a3d 0%,#0f2044 60%,#0a1a3d 100%)", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, position: "relative", boxSizing: "border-box" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: _M(0.8), background: "linear-gradient(90deg,#d4a017,#f5c842,#d4a017)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: _M(0.8), background: "linear-gradient(90deg,#d4a017,#f5c842,#d4a017)" }} />
        <div style={{ width: _M(7.5), height: _M(7.5), borderRadius: "50%", background: "#fff", boxShadow: `0 ${_M(0.5)}px ${_M(1.5)}px rgba(0,0,0,.4)`, display: "flex", alignItems: "center", justifyContent: "center", marginTop: _M(3), flexShrink: 0, overflow: "hidden" }}>
          <img src="/images/logo-icon.png" style={{ width: _M(6), height: _M(6), objectFit: "contain" }} />
        </div>
        <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: _P(3.8), color: "#f5c842", fontWeight: 800, marginTop: _M(2.5), flex: 1, display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: 1.2, textTransform: "uppercase" }}>
          INVESTIGACIONES Y SEGURIDAD PROFESIONAL S.A
        </span>
        <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: _P(3.5), color: "rgba(255,255,255,.35)", fontFamily: "monospace", fontWeight: 700, marginBottom: _M(3.5), letterSpacing: 1 }}>
          {num}
        </span>
      </div>
      {/* CUERPO */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff" }}>
        <div style={{ padding: `${_M(3.5)}px ${_M(2.5)}px ${_M(2.5)}px`, display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, background: "linear-gradient(180deg,#f8faff 0%,#fff 100%)" }}>
          {fotoEl}
          <div style={{ fontSize: _P(6), fontWeight: 900, color: "#0f2044", textAlign: "center", lineHeight: 1.2, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: _M(0.8) }}>{agent.nombre_completo}</div>
          <div style={{ fontSize: _P(3.8), fontWeight: 700, color: "#b8860b", textAlign: "center", letterSpacing: "0.12em", textTransform: "uppercase" }}>{cargo}</div>
        </div>
        <div style={{ height: _M(0.4), background: "linear-gradient(90deg,#d4a017,#f5c842,#d4a017)", flexShrink: 0 }} />
        <div style={{ padding: `${_M(2)}px ${_M(2.5)}px ${_M(1)}px`, flexShrink: 0, textAlign: "center" }}>
          <div style={{ fontSize: _P(3.2), color: "#94a3b8", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: _M(0.5) }}>DPI</div>
          <div style={{ fontSize: _P(6), color: "#0f2044", fontWeight: 800, fontFamily: "monospace" }}>{agent.dpi || "—"}</div>
        </div>
        <div style={{ height: _M(0.25), background: "#f1f5f9", margin: `0 ${_M(2.5)}px`, flexShrink: 0 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: `${_M(1.5)}px ${_M(2.5)}px ${_M(1)}px`, gap: _M(1.2) }}>
          <div style={{ background: "#0f2044", borderRadius: _M(1.8), padding: _M(2), display: "inline-flex", boxShadow: `0 ${_M(0.8)}px ${_M(3)}px rgba(15,32,68,.25)` }}>
            {agent.qr_token
              ? <QRCodeSVG value={`${window.location.origin}/agente?token=${agent.qr_token}`} size={_M(20)} fgColor="#ffffff" bgColor="#0f2044" />
              : <div style={{ width: _M(20), height: _M(20), display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "rgba(255,255,255,.3)", fontSize: _P(4) }}>SIN QR</span></div>
            }
          </div>
          <span style={{ fontSize: _P(3), color: "#94a3b8", textAlign: "center" }}>Escanea para verificar identidad</span>
        </div>
        <div style={{ background: "#0f2044", padding: `${_M(1.3)}px ${_M(2.5)}px`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: _P(3), color: "rgba(255,255,255,.3)" }}>{fecha}</span>
          <span style={{ fontSize: _P(3.2), fontWeight: 800, color: "#f5c842", letterSpacing: "0.08em", textTransform: "uppercase" }}>Carnet de Identificación</span>
        </div>
      </div>
    </div>
  );
}

function CarnetReversoPreview() {
  const W = _M(53.98), H = _M(85.6);
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "Arial,Helvetica,sans-serif", background: "#fff", boxSizing: "border-box", borderRadius: 3, boxShadow: "0 8px 32px rgba(0,0,0,.5)" }}>
      <div style={{ background: "linear-gradient(180deg,#0a1a3d,#0f2044)", padding: `${_M(2)}px ${_M(4)}px ${_M(1.5)}px`, display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ fontSize: _P(8), fontWeight: 900, color: "#fff", letterSpacing: "0.08em" }}>ISP, S.A.</div>
        <div style={{ fontSize: _P(3.5), color: "rgba(255,255,255,.45)", letterSpacing: "0.15em", marginTop: _M(0.5), textAlign: "center" }}>INVESTIGACIONES Y SEGURIDAD PROFESIONAL, S.A.</div>
      </div>
      <div style={{ height: _M(0.5), background: "linear-gradient(90deg,#d4a017,#f5c842,#d4a017)", flexShrink: 0 }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: `${_M(2)}px ${_M(3)}px ${_M(1)}px`, flexShrink: 0 }}>
        <img src="/images/logo-isp.png" style={{ maxHeight: _M(22), maxWidth: "88%", objectFit: "contain", display: "block" }} />
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: `${_M(1)}px ${_M(4.5)}px ${_M(3)}px` }}>
        <div style={{ fontSize: _P(5.5), color: "#334155", textAlign: "center", lineHeight: 1.7 }}>
          El presente acredita como colaborador de <strong style={{ fontWeight: 800, color: "#0f2044" }}>ISP S.A.</strong> Se solicita a las Autoridades <strong style={{ fontWeight: 800, color: "#0f2044" }}>Civiles y Militares</strong> su colaboración. Válido en el cumplimiento de sus funciones en el puesto asignado.
        </div>
      </div>
      <div style={{ height: _M(0.25), background: "linear-gradient(90deg,transparent,#f5c842,transparent)", margin: `0 ${_M(5)}px`, flexShrink: 0 }} />
      <div style={{ padding: `${_M(2.5)}px ${_M(4)}px ${_M(3.5)}px`, display: "flex", flexDirection: "column", alignItems: "center", gap: _M(0.8), flexShrink: 0 }}>
        <div style={{ fontSize: _P(7), fontWeight: 900, color: "#0f2044", letterSpacing: "0.06em" }}>www.ispsa.net</div>
        <div style={{ fontSize: _P(4), color: "#25D366", fontWeight: 700 }}>+502 2200-0000</div>
      </div>
      <div style={{ background: "#0f2044", height: _M(2), flexShrink: 0 }} />
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CarnetesQR() {
  const [busqueda, setBusqueda]           = useState("");
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [generando, setGenerando]         = useState(false);
  const [progreso, setProgreso]           = useState(0);
  const [uploadingId, setUploadingId]     = useState<number | null>(null);
  const [previewAgente, setPreviewAgente] = useState<AgenteCarnet | null>(null);
  const [previewCara, setPreviewCara]     = useState<"frente" | "reverso">("frente");
  const qrContainerRef                    = useRef<HTMLDivElement>(null);
  const fileInputRef                      = useRef<HTMLInputElement>(null);
  const uploadTargetRef                   = useRef<number | null>(null);
  const { currentUser }                   = useAuth();
  const qc                                = useQueryClient();

  // ── Subida de foto ────────────────────────────────────────────────────────
  const handleFotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const empId = uploadTargetRef.current;
    if (!file || !empId) return;
    e.target.value = "";
    setUploadingId(empId);
    try {
      // 1. Comprimir
      const blob = await comprimirFoto(file);
      const comprimida = new File([blob], "foto.jpg", { type: "image/jpeg" });
      // 2. Solicitar URL presignada
      const urlRes = await apiFetch("/storage/uploads/request-url", {
        method: "POST",
        body: JSON.stringify({ name: comprimida.name, size: comprimida.size, contentType: comprimida.type }),
      });
      if (!urlRes.ok) throw new Error("Error obteniendo URL de carga");
      const { uploadURL, objectPath } = await urlRes.json();
      // 3. Subir directamente a GCS
      await fetch(uploadURL, { method: "PUT", body: comprimida, headers: { "Content-Type": "image/jpeg" } });
      // 4. Guardar objectPath en el empleado
      const patchRes = await apiFetch(`/employees/${empId}/foto`, {
        method: "PATCH",
        body: JSON.stringify({ foto_url: objectPath }),
      });
      if (!patchRes.ok) throw new Error("Error guardando foto");
      qc.invalidateQueries({ queryKey: ["agentes-carnets"] });
    } catch (err) {
      console.error("Error subiendo foto:", err);
      alert("Error al subir la foto. Intenta de nuevo.");
    } finally {
      setUploadingId(null);
      uploadTargetRef.current = null;
    }
  }, [qc]);

  const { data: agentes = [], isLoading } = useQuery<AgenteCarnet[]>({
    queryKey: ["agentes-carnets"],
    queryFn:  async () => {
      const r = await apiFetch("/agente/tokens");
      return r.ok ? r.json() : [];
    },
  });

  const impresoPor =
    (currentUser as { nombre?: string; username?: string } | null)?.nombre ??
    (currentUser as { nombre?: string; username?: string } | null)?.username ??
    "Sistema";

  // ── Filtro ────────────────────────────────────────────────────────────────
  const filtrados = agentes.filter(a =>
    a.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
    (a.cargo ?? "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (a.dpi ?? "").includes(busqueda)
  );
  const conQR = filtrados.filter(a => a.qr_token);

  // ── Selección ─────────────────────────────────────────────────────────────
  function toggle(id: number) {
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function seleccionarTodos()    { setSeleccionados(new Set(conQR.map(a => a.employee_id))); }
  function deseleccionarTodos()  { setSeleccionados(new Set()); }
  const todosSeleccionados = conQR.length > 0 && conQR.every(a => seleccionados.has(a.employee_id));

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalConQR   = agentes.filter(a => a.qr_token).length;
  const totalImpresos = agentes.filter(a => a.carnet_impreso_at).length;
  const selCount     = seleccionados.size;

  // ── Descarga ZIP ──────────────────────────────────────────────────────────
  async function handleDescargar() {
    const lista = agentes.filter(a => seleccionados.has(a.employee_id) && a.qr_token);
    if (lista.length === 0) return;

    setGenerando(true);
    setProgreso(0);

    const origin = window.location.origin;
    const [logoIconB64, logoFullB64] = await Promise.all([
      toBase64Url(`${origin}/images/logo-icon.png`),
      toBase64Url(`${origin}/images/logo-isp.png`),
    ]);
    const fecha = new Date().toLocaleDateString("es-GT", { month: "long", year: "numeric" });

    // Capturar QRs del contenedor oculto
    const qrMap: Record<number, string> = {};
    qrContainerRef.current?.querySelectorAll<HTMLElement>("[data-emp-id]").forEach(div => {
      const id  = Number(div.getAttribute("data-emp-id"));
      const svg = div.querySelector("svg");
      if (svg) qrMap[id] = new XMLSerializer().serializeToString(svg);
    });

    // Cargar fotos de agentes (base64) en paralelo
    const fotoMap: Record<number, string | null> = {};
    await Promise.all(lista.map(async a => {
      if (a.foto_url) {
        try {
          fotoMap[a.employee_id] = await toBase64Url(`${API}/storage${a.foto_url}`);
        } catch { fotoMap[a.employee_id] = null; }
      } else {
        fotoMap[a.employee_id] = null;
      }
    }));

    const [{ default: html2canvas }, { default: JSZip }] = await Promise.all([
      import("html2canvas"),
      import("jszip"),
    ]);

    const zip       = new JSZip();
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;top:-9999px;left:-9999px;pointer-events:none;z-index:-1";
    document.body.appendChild(container);

    try {
      for (let i = 0; i < lista.length; i++) {
        const a      = lista[i];
        const nombre = safeFolderName(a.nombre_completo);
        const folder = zip.folder(`${String(i + 1).padStart(2, "0")}_${nombre}`)!;

        // Frente
        const frenteEl = createFrenteElement(a, qrMap[a.employee_id] ?? "", logoIconB64, fecha, fotoMap[a.employee_id] ?? null);
        container.appendChild(frenteEl);
        const frenteCanvas = await html2canvas(frenteEl, {
          scale: 3, useCORS: true, logging: false, backgroundColor: "#ffffff",
        });
        folder.file("01_frente.jpg", frenteCanvas.toDataURL("image/jpeg", 0.95).split(",")[1], { base64: true });
        container.removeChild(frenteEl);

        // Reverso
        const reversoEl = createReversoElement(logoFullB64);
        container.appendChild(reversoEl);
        const reversoCanvas = await html2canvas(reversoEl, {
          scale: 3, useCORS: true, logging: false, backgroundColor: "#ffffff",
        });
        folder.file("02_reverso.jpg", reversoCanvas.toDataURL("image/jpeg", 0.95).split(",")[1], { base64: true });
        container.removeChild(reversoEl);

        setProgreso(Math.round(((i + 1) / lista.length) * 100));
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href     = url;
      link.download = `carnets_ISP_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Registrar impresión en BD
      await Promise.all(
        lista.map(a =>
          apiFetch(`/agente/tokens/${a.employee_id}/registrar-impresion`, {
            method: "POST",
            body: JSON.stringify({ impresoPor }),
          })
        )
      );
      qc.invalidateQueries({ queryKey: ["agentes-carnets"] });
      setSeleccionados(new Set());
    } finally {
      document.body.removeChild(container);
      setGenerando(false);
      setProgreso(0);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AdminLayout title="Carnets QR">
      <div className="p-6 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#f5c842]/10 border border-[#f5c842]/20 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5 text-[#f5c842]" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl">Carnets QR</h1>
            <p className="text-white/40 text-sm">Generación e impresión de credenciales PVC de agentes</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white/4 border border-white/8 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-white/40 text-[10px] uppercase tracking-wider">Con credencial</span>
            </div>
            <p className="text-white text-xl font-bold">{totalConQR}</p>
          </div>
          <div className="bg-white/4 border border-white/8 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-white/40 text-[10px] uppercase tracking-wider">Impresos</span>
            </div>
            <p className="text-emerald-400 text-xl font-bold">{totalImpresos}</p>
          </div>
          <div className="bg-white/4 border border-white/8 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-white/40 text-[10px] uppercase tracking-wider">Pendientes</span>
            </div>
            <p className="text-amber-400 text-xl font-bold">{totalConQR - totalImpresos}</p>
          </div>
        </div>

        {/* Barra de acciones */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar agente, cargo o DPI..."
              className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={todosSeleccionados ? deseleccionarTodos : seleccionarTodos}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-white/60 hover:text-white transition-colors"
          >
            {todosSeleccionados
              ? <><X className="w-3.5 h-3.5" /> Deseleccionar todos</>
              : <><CheckCircle className="w-3.5 h-3.5" /> Seleccionar todos</>
            }
          </button>
          <button
            type="button"
            onClick={handleDescargar}
            disabled={selCount === 0 || generando}
            className="flex items-center gap-2 px-4 py-2 bg-[#f5c842]/10 hover:bg-[#f5c842]/20 border border-[#f5c842]/30 rounded-xl text-sm font-semibold text-[#f5c842] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            {generando
              ? `Generando... ${progreso}%`
              : selCount > 0
                ? `Descargar ZIP (${selCount} carnet${selCount !== 1 ? "s" : ""})`
                : "Descargar ZIP"}
          </button>
        </div>

        {/* Barra de progreso */}
        {generando && (
          <div className="mb-4 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-white/40">
              <span>Generando imágenes JPG · frente y reverso por agente...</span>
              <span>{progreso}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#f5c842] rounded-full transition-all duration-300"
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>
        )}

        {/* Info ZIP */}
        {selCount > 0 && !generando && (
          <div className="mb-4 bg-blue-500/8 border border-blue-500/20 rounded-xl px-3 py-2 text-[11px] text-blue-300/70">
            El ZIP incluirá una carpeta por agente con <strong className="text-blue-300">01_frente.jpg</strong> y{" "}
            <strong className="text-blue-300">02_reverso.jpg</strong> listos para importar en el software de bandeja.
          </div>
        )}

        {/* Lista de agentes */}
        {isLoading ? (
          <p className="text-white/30 text-sm text-center py-10">Cargando agentes...</p>
        ) : conQR.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-10">
            {busqueda ? "Sin resultados para la búsqueda." : "No hay agentes con credencial QR activa."}
          </p>
        ) : (
          <div className="space-y-2">
            {conQR.map(a => {
              const sel     = seleccionados.has(a.employee_id);
              const cargo   = getCargoLabel(a.tipo_personal, a.cargo);
              const impreso = !!a.carnet_impreso_at;
              const fecha   = a.carnet_impreso_at
                ? new Date(a.carnet_impreso_at).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" })
                : null;
              return (
                <div
                  key={a.employee_id}
                  onClick={() => toggle(a.employee_id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none ${
                    sel
                      ? "bg-[#f5c842]/8 border-[#f5c842]/30"
                      : "bg-white/3 border-white/8 hover:border-white/15 hover:bg-white/5"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-colors ${
                    sel ? "bg-[#f5c842] border-[#f5c842]" : "border-white/20 bg-white/5"
                  }`}>
                    {sel && (
                      <svg viewBox="0 0 10 8" className="w-3 h-3">
                        <path d="M1 4l3 3 5-6" stroke="#0f2044" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="relative flex-shrink-0 group/foto">
                    <div className="w-9 h-9 rounded-full bg-[#0f2044] border border-[#f5c842]/20 flex items-center justify-center overflow-hidden">
                      {a.foto_url
                        ? <img src={`${API}/storage${a.foto_url}`} alt="" className="w-full h-full object-cover" />
                        : <span className="text-[#f5c842] text-sm font-bold">{getInitials(a.nombre_completo)}</span>
                      }
                    </div>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); uploadTargetRef.current = a.employee_id; fileInputRef.current?.click(); }}
                      disabled={uploadingId === a.employee_id}
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#0f2044] border border-white/20 flex items-center justify-center opacity-0 group-hover/foto:opacity-100 transition-opacity hover:border-[#f5c842]/50"
                      title="Subir foto"
                    >
                      {uploadingId === a.employee_id
                        ? <Loader2 className="w-2.5 h-2.5 text-white/60 animate-spin" />
                        : <Camera className="w-2.5 h-2.5 text-white/60" />
                      }
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{a.nombre_completo}</p>
                    <p className="text-white/40 text-xs">{cargo}</p>
                    {a.puesto_nombre && (
                      <p className="text-blue-300/50 text-[10px] flex items-center gap-1 mt-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        {a.puesto_nombre} · {a.cliente_nombre}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <div className="text-right">
                      {impreso ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full mb-0.5">
                            <CheckCircle className="w-2.5 h-2.5" /> Impreso
                          </span>
                          {fecha && <p className="text-white/25 text-[9px]">{fecha}</p>}
                          {a.carnet_impreso_por && <p className="text-white/20 text-[9px]">por {a.carnet_impreso_por}</p>}
                        </>
                      ) : (
                        <span className="text-[10px] text-amber-400/70 bg-amber-400/8 px-2 py-0.5 rounded-full">
                          Pendiente
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setPreviewCara("frente"); setPreviewAgente(a); }}
                      className="w-7 h-7 rounded-lg bg-white/5 hover:bg-[#f5c842]/15 border border-white/10 hover:border-[#f5c842]/30 flex items-center justify-center transition-colors"
                      title="Ver preview del carnet"
                    >
                      <Eye className="w-3.5 h-3.5 text-white/40 hover:text-[#f5c842]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Input oculto para subir foto */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFotoUpload}
        />

        {/* Contenedor oculto de QRs para captura — blanco sobre navy */}
        <div ref={qrContainerRef} style={{ position: "absolute", top: -9999, left: -9999, pointerEvents: "none" }}>
          {agentes.filter(a => a.qr_token).map(a => (
            <div key={a.employee_id} data-emp-id={a.employee_id}>
              <QRCodeSVG
                value={`${window.location.origin}/agente?token=${a.qr_token}`}
                size={_MM(20)}
                fgColor="#ffffff"
                bgColor="#0f2044"
              />
            </div>
          ))}
        </div>

      </div>

      {/* ── MODAL PREVIEW CARNET ─────────────────────────────────────────── */}
      {previewAgente && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
          onClick={() => setPreviewAgente(null)}
        >
          <div
            className="relative flex flex-col items-center gap-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Controles */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewCara(c => c === "frente" ? "reverso" : "frente")}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl text-sm text-white/70 hover:text-white transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {previewCara === "frente" ? "Ver reverso" : "Ver frente"}
              </button>
              <span className="text-white/25 text-xs px-3">{previewCara === "frente" ? "FRENTE" : "REVERSO"}</span>
              <button
                type="button"
                onClick={() => setPreviewAgente(null)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            {/* Nombre del agente */}
            <p className="text-white/40 text-xs tracking-wider uppercase">{previewAgente.nombre_completo}</p>

            {/* Carnet */}
            <div style={{ filter: "drop-shadow(0 20px 60px rgba(0,0,0,.7))" }}>
              {previewCara === "frente"
                ? <CarnetFrentePreview
                    agent={previewAgente}
                    fotoSrc={previewAgente.foto_url ? `${API}/storage${previewAgente.foto_url}` : null}
                  />
                : <CarnetReversoPreview />
              }
            </div>

            <p className="text-white/20 text-[11px]">Click fuera para cerrar</p>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}
