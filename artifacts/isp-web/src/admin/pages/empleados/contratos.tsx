import { useState, useEffect, useRef, type ElementType } from "react";
  import { QRCodeSVG } from "qrcode.react";
  import { createPortal } from "react-dom";
  import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
  import {
    Users, Search, X, Loader2, RefreshCw,
    Building2, MapPin, Phone, Mail, Calendar, Hash,
    Shield, Briefcase, BarChart2, CheckSquare, Wallet,
    AlertTriangle, Zap, Activity, Clock, TrendingUp,
    UserCheck, BadgeCheck, Plus, Pencil, LayoutList,
    LayoutGrid, ChevronDown, UserX, UserCheck2, MessageSquare,
    Link2, Unlink, Lock, Save, Banknote, MessageCircle, XCircle,
    TrendingDown, Minus, ShieldAlert, ShieldCheck, ShieldOff,
    ArrowUpRight, ArrowDownRight, Repeat2, ArrowLeftRight, MapPinned, Map, History,
    UserCog, Sun, Umbrella, CheckCircle2, Info, ChevronRight, QrCode, Download,
    ClipboardList, FileText, Scale, FileSignature, Printer, Camera,
    CalendarClock, Trash2,
  } from "lucide-react";
  import { useToast } from "@/hooks/use-toast";
  import { generarContratoLaboral, cargarPatronoDesdeConfig, type DatosContratoLaboral } from "@/lib/pdfRrhh";
  import { useDeleteMode } from "@/contexts/DeleteModeContext";
  import DescansoSemanalEditor from "../../components/DescansoSemanalEditor";
  import { getSessionToken } from "@/lib/httpClient";
  import {
    type Empleado, type KpiData, type Asignacion, type UserVinculado, type PuestoTitular, type HistorialRelevo,
    type OperacionData, type EventoKPIFront, type KPIDisciplinario, type MovimientoRotacion, type KPIRotacion,
    type FormState, type AsignacionOperativa, type TipoPersonalConfig,
    API_BASE, sessionHeader, iniciales, fmtFecha, fmtRelativa, fmtQ, maskDpi,
    ESTADO_LAB, AVATAR_COLORS, avatarColor, FORM_EMPTY, TIPO_PERSONAL_CFG,
    VALID_TIPOS_PERSONAL, useTiposPersonal, TipoPersonalBadge, EstadoBadge,
    KpiCard, ProgressBar,
  } from "./shared";
  
export const IGSS_ESTADO_CFG: Record<string, { label: string; color: string; dot: string }> = {
  activo:                   { label: "Activo",               color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400" },
  no_activo:                { label: "Sin IGSS",             color: "text-white/40 bg-white/5 border-white/10",                  dot: "bg-white/30" },
  pendiente_regularizacion: { label: "En regularización",   color: "text-amber-400 bg-amber-500/10 border-amber-500/20",         dot: "bg-amber-400" },
};

// ─── Sección Contratos (solo lectura) ────────────────────────────────────────
export interface Contrato {
  id: number;
  tipo_contrato: string;
  etiqueta: string;
  fecha_contrato: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  puesto: string | null;
  sueldo_base: string | null;
  observaciones: string | null;
  generado_automatico: boolean;
}

export function ContratosSection({ empId }: { empId: number }) {
  const API_BASE = (import.meta as Record<string, unknown>).env?.VITE_API_BASE as string ?? "/api";
  const { data: contratos = [], isLoading } = useQuery<Contrato[]>({
    queryKey: ["contratos", empId],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/employees/${empId}/contratos`, {
        headers: { "x-isp-session": getSessionToken() },
      });
      if (!r.ok) throw new Error("Error al cargar contratos");
      return r.json();
    },
    staleTime: 60_000,
  });

  if (isLoading) return null;
  if (!contratos.length) return null;

  const tipoColor: Record<string, string> = {
    inicial:    "bg-primary/15 text-primary border border-primary/30",
    post_prueba:"bg-emerald-900/30 text-emerald-400 border border-emerald-700/30",
  };

  return (
    <div>
      <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2">Contratos</p>
      <div className="space-y-2">
        {contratos.map((c) => (
          <div key={c.id} className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-white">{c.etiqueta}</p>
              <div className="flex items-center gap-1.5">
                {c.generado_automatico && (
                  <span className="text-[9px] text-white/20 bg-white/5 border border-white/8 px-1.5 py-0.5 rounded">Auto</span>
                )}
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${tipoColor[c.tipo_contrato] ?? "bg-white/5 text-white/40 border border-white/10"}`}>
                  {c.tipo_contrato === "post_prueba" ? "Post-prueba" : "Inicial"}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              <p className="text-[10px] text-white/30">Fecha: <span className="text-white/60">{c.fecha_contrato}</span></p>
              <p className="text-[10px] text-white/30">Inicio: <span className="text-white/60">{c.fecha_inicio}</span></p>
              {c.puesto && <p className="text-[10px] text-white/30 col-span-2">Puesto: <span className="text-white/60">{c.puesto}</span></p>}
              {c.sueldo_base && <p className="text-[10px] text-white/30">Sueldo: <span className="text-white/60">Q{Number(c.sueldo_base).toLocaleString("es-GT")}</span></p>}
            </div>
            {c.observaciones && (
              <p className="text-[10px] text-white/25 mt-1 italic">{c.observaciones}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sección IGSS inline (con edición) ───────────────────────────────────────
export function IgssSection({ emp }: { emp: Empleado }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editando, setEditando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    aplicaIgssGeneral: emp.aplicaIgssGeneral ?? false,
    estadoIgss:        emp.estadoIgss ?? "no_activo",
    fechaInicioIgss:   emp.fechaInicioIgss ?? "",
    observacionesIgss: emp.observacionesIgss ?? "",
  });

  const cfg = IGSS_ESTADO_CFG[emp.estadoIgss] ?? IGSS_ESTADO_CFG.no_activo;

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...sessionHeader() },
        body: JSON.stringify({
          aplicaIgssGeneral: form.aplicaIgssGeneral,
          estadoIgss:        form.estadoIgss,
          fechaInicioIgss:   form.fechaInicioIgss || null,
          observacionesIgss: form.observacionesIgss || null,
        }),
      }).then((r) => {
        if (!r.ok) throw new Error("Error al guardar");
        return r.json();
      });
      toast({ title: "IGSS actualizado", description: emp.nombreCompleto });
      qc.invalidateQueries({ queryKey: ["empleados"] });
      setEditando(false);
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar el IGSS", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-white/25 uppercase tracking-widest">Seguridad Social — IGSS</p>
        {!editando && (
          <button
            onClick={() => { setForm({ aplicaIgssGeneral: emp.aplicaIgssGeneral ?? false, estadoIgss: emp.estadoIgss ?? "no_activo", fechaInicioIgss: emp.fechaInicioIgss ?? "", observacionesIgss: emp.observacionesIgss ?? "" }); setEditando(true); }}
            className="flex items-center gap-1 text-[10px] text-white/30 hover:text-primary transition-colors"
          >
            <Pencil className="w-3 h-3" /> Editar
          </button>
        )}
      </div>

      {!editando ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
            <p className="text-[10px] text-white/30 mb-1">Estado IGSS</p>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
          <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
            <p className="text-[10px] text-white/30 mb-1">Aplica IGSS general</p>
            <p className={`text-sm font-semibold ${emp.aplicaIgssGeneral ? "text-emerald-400" : "text-white/40"}`}>
              {emp.aplicaIgssGeneral ? "Sí" : "No"}
            </p>
          </div>
          {emp.fechaInicioIgss && (
            <div className="bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Inicio IGSS</p>
              <p className="text-sm text-white/80">{emp.fechaInicioIgss}</p>
            </div>
          )}
          {emp.observacionesIgss && (
            <div className="col-span-2 bg-[#0c1929] border border-white/6 rounded-lg p-3">
              <p className="text-[10px] text-white/30 mb-0.5">Observaciones</p>
              <p className="text-xs text-white/60 leading-relaxed">{emp.observacionesIgss}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#0c1929] border border-primary/15 rounded-xl p-4 space-y-3">
          {/* Aplica IGSS */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.aplicaIgssGeneral}
              onChange={(e) => setForm((p) => ({ ...p, aplicaIgssGeneral: e.target.checked }))}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-xs text-white/70">Aplica IGSS general (colaborador inscrito)</span>
          </label>
          {/* Estado IGSS */}
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-widest">Estado IGSS</label>
            <select
              value={form.estadoIgss}
              onChange={(e) => setForm((p) => ({ ...p, estadoIgss: e.target.value }))}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-primary/40 appearance-none"
            >
              <option value="no_activo">Sin IGSS</option>
              <option value="activo">Activo</option>
              <option value="pendiente_regularizacion">En proceso de regularización</option>
            </select>
          </div>
          {/* Fecha inicio */}
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-widest">Fecha inicio IGSS</label>
            <input
              type="date"
              value={form.fechaInicioIgss}
              onChange={(e) => setForm((p) => ({ ...p, fechaInicioIgss: e.target.value }))}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-primary/40"
            />
          </div>
          {/* Observaciones */}
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-widest">Observaciones</label>
            <textarea
              rows={2}
              value={form.observacionesIgss}
              onChange={(e) => setForm((p) => ({ ...p, observacionesIgss: e.target.value }))}
              placeholder="Motivo, pendiente, acuerdo con cliente…"
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/20 outline-none focus:border-primary/40 resize-none"
            />
          </div>
          {/* Botones */}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditando(false)} className="text-xs text-white/40 hover:text-white transition-colors px-3 py-1.5">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs bg-primary text-black font-medium px-4 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Comprime una imagen a JPEG 480px max, calidad 0.82 (igual al kiosco/carnet).

export async function comprimirFotoEmpleado(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const SIZE = 480;
      const cv = document.createElement("canvas");
      const sc = Math.min(1, SIZE / Math.max(img.width, img.height));
      cv.width = Math.round(img.width * sc);
      cv.height = Math.round(img.height * sc);
      const ctx = cv.getContext("2d");
      if (!ctx) return reject(new Error("Canvas no disponible"));
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob((b) => (b ? resolve(b) : reject(new Error("Error al comprimir"))), "image/jpeg", 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Imagen inválida")); };
    img.src = url;
  });
}

// Carga segura de foto privada desde object storage (mismo patrón que CarnetesQR.SecureFoto).
export function useFotoSegura(fotoUrl: string | null): string | null {
  const [src, setSrc] = useState<string | null>(
    fotoUrl && fotoUrl.startsWith("data:") ? fotoUrl : null
  );
  useEffect(() => {
    if (!fotoUrl) { setSrc(null); return; }
    if (fotoUrl.startsWith("data:")) { setSrc(fotoUrl); return; }
    if (/^https?:\/\//i.test(fotoUrl)) { setSrc(fotoUrl); return; }
    let active = true;
    const session = getSessionToken();
    fetch(`${API_BASE}/storage${fotoUrl}`, { headers: { "x-isp-session": session } })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("foto no disponible"))))
      .then((blob) => { if (active) setSrc(URL.createObjectURL(blob)); })
      .catch(() => { if (active) setSrc(null); });
    return () => { active = false; };
  }, [fotoUrl]);
  return src;
}

export function FotoEmpleadoEditor({ emp, onUpdated }: { emp: Empleado; onUpdated?: (fotoUrl: string) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [fotoLocal, setFotoLocal] = useState<string | null>(emp.fotoUrl);
  useEffect(() => { setFotoLocal(emp.fotoUrl); }, [emp.fotoUrl]);
  const fotoSrc = useFotoSegura(fotoLocal);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Archivo inválido", description: "Selecciona una imagen.", variant: "destructive" });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: "Foto muy grande", description: "Máximo 15 MB.", variant: "destructive" });
      return;
    }
    setSubiendo(true);
    try {
      const session = getSessionToken();
      // El servidor recibe la foto cruda y la procesa con sharp:
      // auto-orient EXIF, resize a 480 px, JPEG q82 → guarda data URL en BD.
      // No usa Object Storage (evita el bug del sidecar en producción).
      const upRes = await fetch(`${API_BASE}/employees/${emp.id}/foto-upload`, {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "x-isp-session": session,
        },
        body: file,
      });
      if (!upRes.ok) {
        const txt = await upRes.text().catch(() => "");
        throw new Error(`No se pudo subir la foto (HTTP ${upRes.status}) ${txt}`);
      }
      const { fotoUrl } = await upRes.json();
      toast({ title: "Foto actualizada", description: emp.nombreCompleto });
      qc.invalidateQueries({ queryKey: ["empleados"] });
      setFotoLocal(fotoUrl);
      onUpdated?.(fotoUrl);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "No se pudo subir la foto", variant: "destructive" });
    } finally {
      setSubiendo(false);
    }
  }

  const initials = iniciales(emp.nombreCompleto);
  const colorClass = avatarColor(emp.nombreCompleto);

  return (
    <div className="flex items-center gap-4 p-4 bg-[#0c1929] border border-white/8 rounded-xl">
      <div className="relative">
        {fotoSrc ? (
          <img
            src={fotoSrc}
            alt={emp.nombreCompleto}
            className="w-20 h-20 rounded-full object-cover border-2 border-white/15"
          />
        ) : (
          <div className={`w-20 h-20 rounded-full ${colorClass} flex items-center justify-center text-white font-bold text-xl border-2 border-white/15`}>
            {initials}
          </div>
        )}
        {subiendo && (
          <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-1">Fotografía</p>
        <p className="text-xs text-white/50 mb-2">
          {emp.fotoUrl ? "Foto cargada. Subir una nueva la reemplaza." : "Sin foto. Sube una imagen para usarla en carnet, listas y operativos."}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={subiendo}
            className="text-[11px] px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Camera className="w-3 h-3" />
            {subiendo ? "Subiendo…" : emp.fotoUrl ? "Cambiar foto" : "Subir foto"}
          </button>
          <span className="text-[10px] text-white/25">JPG/PNG · se comprime automáticamente a 480 px</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
      </div>
    </div>
  );
}


export function TabContratos({ emp }: { emp: Empleado }) {
  const { toast } = useToast();
  const [generando, setGenerando] = useState<"inicial" | "post_prueba" | null>(null);

  async function descargarContrato(tipo: "inicial" | "post_prueba") {
    setGenerando(tipo);
    try {
      // Cargar datos del empleado, contratos previos y patrono en paralelo
      const sess = getSessionToken();
      const [resEmp, resContratos, patrono] = await Promise.all([
        fetch(`${API_BASE}/employees/${emp.id}`),
        fetch(`${API_BASE}/employees/${emp.id}/contratos`, { headers: { "x-isp-session": sess } }),
        cargarPatronoDesdeConfig(),
      ]);
      const det = resEmp.ok ? await resEmp.json() : {};
      const contratosPrev: Array<{ tipo_contrato: string; fecha_inicio: string; sueldo_base: string | null }> =
        resContratos.ok ? await resContratos.json() : [];

      // Contrato más reciente como fuente de "valores heredados" (sueldo, etc.)
      const ultimoContrato = contratosPrev[0];

      const fechaIngreso = det.fecha_ingreso || emp.fechaIngreso || new Date().toISOString().slice(0, 10);
      // Fuente de verdad para la fecha de alta: SIEMPRE la ficha del
      // empleado (fecha_ingreso). NO heredar la fecha de un contrato
      // anterior, porque pudo haberse generado con datos viejos o con
      // un bug de zona horaria. Quitar la "T..." si llega en formato ISO
      // completo ("2026-04-28T00:00:00.000Z").
      const fechaAltaBase = String(fechaIngreso).split("T")[0];
      // Fecha de inicio que se imprime en el PDF:
      //  - Inicial (60 días prueba): fecha de alta + 2 meses.
      //  - Post-prueba (indefinido): fecha de alta original.
      let fechaInicio: string;
      if (tipo === "inicial") {
        const [yB, mB, dB] = fechaAltaBase.split("-").map(Number);
        const fechaPP = new Date(yB, (mB || 1) - 1, dB || 1);
        fechaPP.setMonth(fechaPP.getMonth() + 2);
        // Reconstruir YYYY-MM-DD usando getters LOCALES (no toISOString,
        // que convierte a UTC y puede desfasar el día en zonas como GT).
        const yy = fechaPP.getFullYear();
        const mm = String(fechaPP.getMonth() + 1).padStart(2, "0");
        const dd = String(fechaPP.getDate()).padStart(2, "0");
        fechaInicio = `${yy}-${mm}-${dd}`;
      } else {
        fechaInicio = fechaAltaBase;
      }

      // Sueldo: empleado → último contrato → ficha
      const sueldoStr =
        (emp.sueldoBase && emp.sueldoBase.trim()) ||
        (ultimoContrato?.sueldo_base && String(ultimoContrato.sueldo_base).trim()) ||
        (det.sueldo_base && String(det.sueldo_base).trim()) ||
        "0";

      const datos: DatosContratoLaboral = {
        empleado_nombre: emp.nombreCompleto,
        empleado_dpi: emp.dpi ?? det.dpi ?? "",
        empleado_estado_civil: det.estado_civil ?? undefined,
        empleado_direccion: det.direccion ?? undefined,
        empleado_telefono: emp.telefono ?? det.telefono ?? null,
        fecha_inicio: fechaInicio,
        puesto: emp.puesto ?? det.puesto ?? "Guardia de Seguridad",
        tipo_personal: emp.tipoPersonal ?? "guardia",
        sueldo_base: parseFloat(sueldoStr) || 0,
        tipo_contrato: tipo,
        patrono,
      };

      if (!datos.sueldo_base) {
        toast({ title: "Falta sueldo", description: "Asigna un sueldo base al empleado antes de generar el contrato.", variant: "destructive" });
        return;
      }

      await generarContratoLaboral(datos);
    } catch (err) {
      toast({ title: "Error", description: "No se pudo generar el contrato.", variant: "destructive" });
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setGenerando(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <FileSignature className="w-4 h-4 text-emerald-400" />
        <p className="text-white/60 text-sm font-semibold uppercase tracking-wide">Contratos individuales de trabajo</p>
      </div>

      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
        <p className="text-emerald-300 text-xs font-semibold mb-1">📄 Generador conforme al Código de Trabajo de Guatemala</p>
        <p className="text-white/50 text-[11px] leading-relaxed">
          Decreto 1441. Los contratos se generan con los datos del empleado y los datos del patrono configurados en el sistema.
          Imprime, firma con el trabajador y archiva una copia en el expediente.
        </p>
      </div>

      {/* Datos que se usarán */}
      <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-2">
        <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Datos del empleado para el contrato</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <div><span className="text-white/40">Nombre:</span> <span className="text-white/80">{emp.nombreCompleto}</span></div>
          <div><span className="text-white/40">DPI:</span> <span className="text-white/80 font-mono">{emp.dpi ?? "—"}</span></div>
          <div><span className="text-white/40">Puesto:</span> <span className="text-white/80">{emp.puesto ?? "—"}</span></div>
          <div><span className="text-white/40">Tipo:</span> <span className="text-white/80">{emp.tipoPersonal ?? "guardia"}</span></div>
          <div><span className="text-white/40">Sueldo:</span> <span className="text-white/80">{emp.sueldoBase ? `Q${Number(emp.sueldoBase).toLocaleString("es-GT", { minimumFractionDigits: 2 })}` : "— (requerido)"}</span></div>
          <div><span className="text-white/40">F. ingreso:</span> <span className="text-white/80">{emp.fechaIngreso ?? "—"}</span></div>
        </div>
      </div>

      {/* Botones de descarga */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => descargarContrato("inicial")}
          disabled={generando !== null}
          className="flex items-center justify-center gap-2 px-4 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors"
        >
          {generando === "inicial" ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
          <div className="text-left leading-tight">
            <div>Contrato Inicial</div>
            <div className="text-[10px] opacity-80 font-normal">60 días de prueba (Art. 81)</div>
          </div>
        </button>
        <button
          onClick={() => descargarContrato("post_prueba")}
          disabled={generando !== null}
          className="flex items-center justify-center gap-2 px-4 py-3.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors"
        >
          {generando === "post_prueba" ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
          <div className="text-left leading-tight">
            <div>Contrato Post-Prueba</div>
            <div className="text-[10px] opacity-80 font-normal">Indefinido (Art. 25)</div>
          </div>
        </button>
      </div>

      <p className="text-yellow-500/80 text-[10px] italic">
        ⚠ Los datos del patrono (NIT, representante legal, dirección fiscal) se cargan desde la configuración del sistema.
        Si están en blanco, complétalos en el PDF a mano antes de firmar.
      </p>
    </div>
  );
}

// ─── PERS-SLOT-01: Pestaña "Plantilla de turno" para supervisores y administrativos ──
