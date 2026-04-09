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
  MapPin, X, Camera, Loader2,
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
  const qrFixed  = qrSvgStr
    ? qrSvgStr.replace(/<svg([^>]*)>/, `<svg$1 width="${_MM(18)}" height="${_MM(18)}" style="display:block">`)
    : "";

  const fotoHtml = fotoB64
    ? `<img src="${fotoB64}" style="width:${_MM(13)}px;height:${_MM(13)}px;border-radius:50%;object-fit:cover;border:${_MM(0.5)}px solid #f5c842;margin-bottom:${_MM(1.5)}px;display:block" crossorigin="anonymous" />`
    : `<div style="width:${_MM(13)}px;height:${_MM(13)}px;border-radius:50%;background:linear-gradient(135deg,#0f2044,#1e4a9a);border:1px solid #f5c842;display:flex;align-items:center;justify-content:center;margin-bottom:${_MM(1.5)}px"><span style="font-size:${_PT(8)}px;font-weight:900;color:#f5c842">${initials}</span></div>`;

  const el = document.createElement("div");
  el.style.cssText = `width:${W}px;height:${H}px;display:flex;flex-direction:row;overflow:hidden;font-family:Arial,Helvetica,sans-serif;background:#fff;box-sizing:border-box`;
  el.innerHTML = `
  <div style="width:${SW}px;height:${H}px;background:linear-gradient(180deg,#0f2044 0%,#132a5a 100%);display:flex;flex-direction:column;align-items:center;flex-shrink:0;position:relative;box-sizing:border-box">
    <div style="position:absolute;top:0;left:0;right:0;height:${_MM(1)}px;background:#f5c842"></div>
    <div style="position:absolute;bottom:0;left:0;right:0;height:${_MM(1)}px;background:#f5c842"></div>
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:${_MM(3)}px 0;width:100%;height:100%;box-sizing:border-box">
      <img src="${logoIconB64}" style="width:${_MM(7)}px;object-fit:contain;filter:brightness(0) invert(1)" />
      <span style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:${_PT(4)}px;color:rgba(255,255,255,.4);font-family:monospace;font-weight:700">${num}</span>
    </div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;background:#fff">
    <div style="padding:${_MM(2.5)}px ${_MM(2)}px ${_MM(2)}px;display:flex;flex-direction:column;align-items:center;flex-shrink:0">
      ${fotoHtml}
      <div style="font-size:${_PT(6)}px;font-weight:900;color:#0f2044;text-align:center;line-height:1.2;text-transform:uppercase;margin-bottom:${_MM(0.8)}px">${agent.nombre_completo}</div>
      <div style="font-size:${_PT(4)}px;font-weight:700;color:#b8860b;text-align:center;letter-spacing:.1em;text-transform:uppercase">${cargo}</div>
    </div>
    <div style="height:1px;background:linear-gradient(90deg,#d4a017,#f5c842,#e8b820);flex-shrink:0"></div>
    <div style="padding:${_MM(1.5)}px ${_MM(2)}px;flex:1">
      ${agent.dpi ? `
      <div style="font-size:${_PT(3.5)}px;color:#94a3b8;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:${_MM(0.5)}px">DPI</div>
      <div style="font-size:${_PT(5.5)}px;color:#0f2044;font-weight:800;font-family:monospace;margin-bottom:${_MM(1.5)}px">${agent.dpi}</div>
      ` : ""}
      <div style="height:1px;background:#f1f5f9;margin-bottom:${_MM(1.5)}px"></div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:${_MM(1)}px">
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:${_MM(1)}px;padding:${_MM(0.5)}px;display:inline-block">${qrFixed}</div>
        <span style="font-size:${_PT(3)}px;color:#94a3b8;text-align:center">Escanea para verificar identidad</span>
      </div>
    </div>
    <div style="background:#0f2044;padding:${_MM(1)}px ${_MM(2)}px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
      <span style="font-size:${_PT(3)}px;color:rgba(255,255,255,.35)">${fecha}</span>
      <span style="font-size:${_PT(3)}px;font-weight:800;color:#f5c842;letter-spacing:.08em">CARNET DE IDENTIFICACIÓN</span>
    </div>
  </div>`;
  return el;
}

function createReversoElement(logoFullB64: string): HTMLDivElement {
  const W = _MM(53.98), H = _MM(85.6);
  const el = document.createElement("div");
  el.style.cssText = `width:${W}px;height:${H}px;display:flex;flex-direction:column;overflow:hidden;font-family:Arial,Helvetica,sans-serif;background:#fff;box-sizing:border-box`;
  el.innerHTML = `
  <div style="padding:${_MM(4)}px ${_MM(3)}px ${_MM(2)}px;display:flex;flex-direction:column;align-items:center;flex-shrink:0">
    <img src="${logoFullB64}" style="height:${_MM(18)}px;object-fit:contain" />
    <div style="font-size:${_PT(3.8)}px;color:#0f2044;letter-spacing:.1em;font-weight:700;text-align:center;margin-top:${_MM(1.5)}px">INVESTIGACIONES Y SEGURIDAD PROFESIONAL S.A.</div>
  </div>
  <div style="height:1px;background:linear-gradient(90deg,#d4a017,#f5c842,#d4a017);flex-shrink:0"></div>
  <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:${_MM(2.5)}px ${_MM(4)}px">
    <div style="font-size:${_PT(5.5)}px;color:#1e3a5f;text-align:center;line-height:1.65">
      El presente acredita como colaborador de <strong style="font-weight:800;color:#0f2044">ISP S.A.</strong>
      Se solicita a las Autoridades <strong style="font-weight:800;color:#0f2044">Civiles y Militares</strong>
      la colaboración en caso de ser requerida. Válido en el cumplimiento de sus funciones en el puesto asignado.
    </div>
  </div>
  <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(245,200,66,.5),#f5c842,rgba(245,200,66,.5),transparent);margin:0 ${_MM(4)}px;flex-shrink:0"></div>
  <div style="padding:${_MM(1.5)}px ${_MM(3)}px ${_MM(2)}px;display:flex;flex-direction:column;align-items:center;flex-shrink:0">
    <div style="font-size:${_PT(6.5)}px;font-weight:900;color:#0f2044;letter-spacing:.06em">www.ispsa.net</div>
    <div style="font-size:${_PT(3.8)}px;color:#94a3b8;letter-spacing:.04em;margin-top:${_MM(0.5)}px">contacto@isp-guatemala.com</div>
  </div>
  <div style="background:#0f2044;height:${_MM(2)}px;flex-shrink:0"></div>`;
  return el;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CarnetesQR() {
  const [busqueda, setBusqueda]           = useState("");
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [generando, setGenerando]         = useState(false);
  const [progreso, setProgreso]           = useState(0);
  const [uploadingId, setUploadingId]     = useState<number | null>(null);
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
    <AdminLayout>
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
                  <div className="flex-shrink-0 text-right">
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

        {/* Contenedor oculto de QRs para captura */}
        <div ref={qrContainerRef} style={{ position: "absolute", top: -9999, left: -9999, pointerEvents: "none" }}>
          {agentes.filter(a => a.qr_token).map(a => (
            <div key={a.employee_id} data-emp-id={a.employee_id}>
              <QRCodeSVG
                value={`${window.location.origin}/agente?token=${a.qr_token}`}
                size={_MM(18)}
              />
            </div>
          ))}
        </div>

      </div>
    </AdminLayout>
  );
}
