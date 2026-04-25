import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Shield, Plus, RefreshCw, Search, X, XCircle, ChevronRight,
  MapPin, User, Clock, AlertTriangle, CheckCircle2, Loader2,
  Edit, History, ArrowRightLeft, Package, FileText, Hash, Target,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useDeleteMode } from "@/contexts/DeleteModeContext";
import { AdminLayout } from "../layout/AdminLayout";

const API = "/api";
const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "x-isp-session": getSession() } });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw e; }
  return res.json();
}
async function apiPost<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw e; }
  return res.json();
}
async function apiPatch<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH", headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw e; }
  return res.json();
}

function fmtFecha(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDatetime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("es-GT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function hoy() { return new Date().toISOString().slice(0, 10); }

const TIPO_ARMA = ["pistola", "revolver", "escopeta", "rifle", "otro"] as const;
const TIPO_LABELS: Record<string, string> = {
  pistola: "Pistola", revolver: "Revólver", escopeta: "Escopeta", rifle: "Rifle", otro: "Otro",
};
const ESTADO_CONFIG: Record<string, { label: string; cls: string }> = {
  activo:          { label: "Activo",          cls: "text-teal-400 bg-teal-400/10 border-teal-400/20" },
  en_mantenimiento:{ label: "En mantenimiento",cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  baja:            { label: "Baja",             cls: "text-red-400 bg-red-400/10 border-red-400/20" },
};
const ORIGEN_LABELS: Record<string, string> = {
  turno_normal:       "Turno normal",
  relevo:             "Relevo",
  relevo_ausencia:    "Relevo por ausencia",
  cobertura_parcial:  "Cobertura parcial",
  cobertura_supervisor: "Cobertura supervisor",
  cobertura_jefe:     "Cobertura jefe",
  manual:             "Manual",
  automatico_turno:   "Automático turno",
};

type EstadoDocumental = "vigente" | "proximo_a_vencer" | "vencida" | "pendiente" | "en_tramite" | "sin_registro";

interface Arma {
  id: number; codigo: string; tipo: string; marca: string | null; modelo: string | null;
  calibre: string | null; serie: string | null; estado: string; activo: boolean;
  observaciones: string | null; puesto_id: number | null;
  puesto_nombre: string | null; cliente_nombre: string | null; puesto_direccion: string | null;
  titular_id: number | null; titular_nombre: string | null;
  custodia_id: number | null; custodio_id: number | null;
  custodio_nombre: string | null; custodio_tipo: string | null;
  custodia_desde: string | null; custodia_tipo_origen: string | null;
  numero_tenencia: string | null;
  fecha_vencimiento_tenencia: string | null;
  estado_documental: EstadoDocumental;
  dias_restantes: number | null;
  numero_portacion: string | null;
  fecha_emision_portacion: string | null;
  fecha_vencimiento_portacion: string | null;
  estado_documental_portacion: EstadoDocumental;
  dias_restantes_portacion: number | null;
  tenencia_en_tramite: boolean;
  portacion_en_tramite: boolean;
  sugerencias_pendientes: number;
}
interface EstadoArma extends Arma {
  zona_nombre: string | null;
  responsable_turno: { id: number; nombre_completo: string; tipo_personal: string; tipo_origen: string } | null;
  descanso_por_ciclo: boolean;
}
interface Puesto { id: number; nombre: string; cliente_nombre: string; agente_id: number | null; agente_nombre: string | null; zona_nombre: string | null; direccion: string | null; }
interface CustodiaEntry {
  id: number; arma_id: number; employee_id: number | null; puesto_id: number | null;
  fecha_inicio: string; fecha_fin: string | null; tipo_origen: string; notas: string | null;
  custodio_nombre: string | null; custodio_tipo: string | null;
  puesto_nombre: string | null; cliente_nombre: string | null;
  codigo: string | null; tipo: string | null; marca: string | null; modelo: string | null; calibre: string | null;
}

// ── Badge estado ────────────────────────────────────────────────────────────
function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, cls: "text-gray-400 bg-gray-400/10 border-gray-400/20" };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>;
}

// ── Badge documental de tenencia ────────────────────────────────────────────
const TENENCIA_CONFIG: Record<EstadoDocumental, { label: string; cls: string; dot: string }> = {
  vigente:          { label: "Tenencia vigente",          cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", dot: "bg-emerald-400" },
  proximo_a_vencer: { label: "Por vencer",                cls: "text-amber-400 bg-amber-400/10 border-amber-400/20",   dot: "bg-amber-400"  },
  vencida:          { label: "Tenencia vencida",          cls: "text-red-400 bg-red-400/10 border-red-400/20",         dot: "bg-red-400"    },
  pendiente:        { label: "Tenencia pendiente",        cls: "text-rose-400 bg-rose-400/10 border-rose-400/30",      dot: "bg-rose-400"   },
  en_tramite:       { label: "Tenencia en trámite",       cls: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",      dot: "bg-cyan-400"   },
  sin_registro:     { label: "Tenencia pendiente",        cls: "text-rose-400 bg-rose-400/10 border-rose-400/30",      dot: "bg-rose-400"   },
};
function TenenciaBadge({ arma, showDays = true }: { arma: Pick<Arma, "estado_documental" | "dias_restantes">; showDays?: boolean }) {
  const ed = arma.estado_documental ?? "sin_registro";
  const cfg = TENENCIA_CONFIG[ed];
  const label = (ed === "proximo_a_vencer" && showDays && arma.dias_restantes != null)
    ? `Vence en ${arma.dias_restantes}d`
    : (ed === "vencida" && showDays && arma.dias_restantes != null)
      ? `Vencida hace ${Math.abs(arma.dias_restantes)}d`
      : cfg.label;
  return (
    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {label}
    </span>
  );
}

const PORTACION_CONFIG: Record<EstadoDocumental, { label: string; cls: string; dot: string }> = {
  vigente:          { label: "Portación vigente",   cls: "text-violet-400 bg-violet-400/10 border-violet-400/20", dot: "bg-violet-400" },
  proximo_a_vencer: { label: "Por vencer",           cls: "text-amber-400 bg-amber-400/10 border-amber-400/20",    dot: "bg-amber-400"  },
  vencida:          { label: "Portación vencida",   cls: "text-red-400 bg-red-400/10 border-red-400/20",          dot: "bg-red-400"    },
  pendiente:        { label: "Portación pendiente", cls: "text-rose-400 bg-rose-400/10 border-rose-400/30",       dot: "bg-rose-400"   },
  en_tramite:       { label: "Portación en trámite",cls: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",       dot: "bg-cyan-400"   },
  sin_registro:     { label: "Portación pendiente", cls: "text-rose-400 bg-rose-400/10 border-rose-400/30",       dot: "bg-rose-400"   },
};
function PortacionBadge({ arma, showDays = true }: { arma: Pick<Arma, "estado_documental_portacion" | "dias_restantes_portacion">; showDays?: boolean }) {
  const ed = arma.estado_documental_portacion ?? "sin_registro";
  const cfg = PORTACION_CONFIG[ed];
  const label = (ed === "proximo_a_vencer" && showDays && arma.dias_restantes_portacion != null)
    ? `Vence en ${arma.dias_restantes_portacion}d`
    : (ed === "vencida" && showDays && arma.dias_restantes_portacion != null)
      ? `Vencida hace ${Math.abs(arma.dias_restantes_portacion)}d`
      : cfg.label;
  return (
    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {label}
    </span>
  );
}

// ── Chip responsable ────────────────────────────────────────────────────────
function ResponsableChip({ responsable, descansa, enArmeria = false }: {
  responsable: EstadoArma["responsable_turno"]; descansa: boolean; enArmeria?: boolean;
}) {
  if (!responsable) {
    if (enArmeria) return (
      <span className="flex items-center gap-1 text-[11px] text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded-full border border-indigo-400/20">
        <Shield className="w-3 h-3" />En Armería
      </span>
    );
    if (descansa) return (
      <span className="flex items-center gap-1 text-[11px] text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full border border-blue-400/20">
        <Clock className="w-3 h-3" />Titular en descanso
      </span>
    );
    return (
      <span className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-700/40 px-2 py-0.5 rounded-full border border-gray-700">
        <AlertTriangle className="w-3 h-3" />Sin responsable
      </span>
    );
  }
  const origenLabel = ORIGEN_LABELS[responsable.tipo_origen] ?? responsable.tipo_origen;
  const isRelevo = responsable.tipo_origen.includes("relevo") || responsable.tipo_origen.includes("cobertura");
  return (
    <span className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
      isRelevo ? "text-amber-300 bg-amber-400/10 border-amber-400/20" : "text-teal-300 bg-teal-400/10 border-teal-400/20"
    }`}>
      <User className="w-3 h-3" />
      {responsable.nombre_completo}
      <span className="opacity-60">· {origenLabel}</span>
    </span>
  );
}

// ── Modal Crear/Editar arma ─────────────────────────────────────────────────
function ModalArma({
  arma, puestos, onClose, onSaved, usuario,
}: {
  arma: Arma | null; puestos: Puesto[]; onClose: () => void; onSaved: () => void; usuario: string;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    codigo:                     arma?.codigo ?? "",
    tipo:                       arma?.tipo ?? "pistola",
    marca:                      arma?.marca ?? "",
    modelo:                     arma?.modelo ?? "",
    calibre:                    arma?.calibre ?? "",
    serie:                      arma?.serie ?? "",
    estado:                     arma?.estado ?? "activo",
    activo:                     arma?.activo ?? true,
    puesto_id:                  arma?.puesto_id ? String(arma.puesto_id) : "",
    observaciones:              arma?.observaciones ?? "",
    numero_tenencia:            arma?.numero_tenencia ?? "",
    fecha_vencimiento_tenencia: arma?.fecha_vencimiento_tenencia
      ? arma.fecha_vencimiento_tenencia.slice(0, 10)
      : "",
    numero_portacion:           arma?.numero_portacion ?? "",
    fecha_emision_portacion:    arma?.fecha_emision_portacion
      ? arma.fecha_emision_portacion.slice(0, 10)
      : "",
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const selectedPuesto = puestos.find(p => String(p.id) === form.puesto_id);

  async function save() {
    setSaving(true);
    try {
      // El código del arma lo genera el sistema; nunca lo enviamos al backend.
      const { codigo: _ignorado, ...rest } = form;
      const body = {
        ...rest,
        puesto_id: form.puesto_id ? Number(form.puesto_id) : null,
        usuario,
      };
      if (arma) {
        await apiPatch(`${API}/armas/${arma.id}`, body);
        toast({ title: "Arma actualizada" });
      } else {
        await apiPost(`${API}/armas`, body);
        toast({ title: "Arma registrada", description: "El código se asignó automáticamente." });
      }
      onSaved();
    } catch (e: any) {
      toast({ title: e.error || "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-semibold text-white">{arma ? "Editar arma" : "Registrar arma"}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Código + tipo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Código interno</label>
              {arma ? (
                <input
                  value={form.codigo} readOnly
                  title="El código se generó automáticamente y no puede modificarse"
                  className="w-full bg-gray-800/40 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 text-sm font-mono cursor-not-allowed"
                />
              ) : (
                <div className="w-full bg-gray-800/30 border border-dashed border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-500 italic flex items-center h-[38px]">
                  Se generará al guardar (ARM-####)
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Tipo *</label>
              <select value={form.tipo} onChange={e => set("tipo", e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                {TIPO_ARMA.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
              </select>
            </div>
          </div>

          {/* Marca + modelo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Marca</label>
              <input value={form.marca} onChange={e => set("marca", e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="Ej. Glock" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Modelo</label>
              <input value={form.modelo} onChange={e => set("modelo", e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="Ej. 17" />
            </div>
          </div>

          {/* Calibre + serie */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Calibre</label>
              <input value={form.calibre} onChange={e => set("calibre", e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="Ej. 9mm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Número de serie</label>
              <input value={form.serie} onChange={e => set("serie", e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="Ej. ISP-SN-001" />
            </div>
          </div>

          {/* Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Estado</label>
              <select value={form.estado} onChange={e => set("estado", e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                <option value="activo">Activo</option>
                <option value="en_mantenimiento">En mantenimiento</option>
                <option value="baja">Baja</option>
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div className={`w-10 h-5 rounded-full transition-colors ${form.activo ? "bg-blue-600" : "bg-gray-600"}`}
                  onClick={() => set("activo", !form.activo)}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mt-0.5 ${form.activo ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
                <span className="text-sm text-gray-300">{form.activo ? "Activa" : "Inactiva"}</span>
              </label>
            </div>
          </div>

          {/* Puesto operativo */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Puesto operativo asignado</label>
            <select value={form.puesto_id} onChange={e => set("puesto_id", e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
              <option value="">— En Armería (sin puesto) —</option>
              {puestos.map(p => (
                <option key={p.id} value={String(p.id)}>
                  {p.cliente_nombre ? `${p.cliente_nombre} — ` : ""}{p.nombre}
                  {p.agente_nombre ? ` (Titular: ${p.agente_nombre})` : ""}
                </option>
              ))}
            </select>
            {selectedPuesto?.agente_nombre && (
              <p className="text-xs text-teal-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Titular del puesto: {selectedPuesto.agente_nombre} — el responsable del arma se calculará automáticamente.
              </p>
            )}
          </div>

          {/* Tenencia de arma */}
          <div className="border-t border-gray-700/60 pt-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5" />Tenencia de arma
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">N° de tenencia</label>
                <input value={form.numero_tenencia} onChange={e => set("numero_tenencia", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
                  placeholder="Ej. T-12345-2024" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Vencimiento tenencia</label>
                <input type="date" value={form.fecha_vencimiento_tenencia} onChange={e => set("fecha_vencimiento_tenencia", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>

          {/* Portación de arma */}
          <div className="border-t border-gray-700/60 pt-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5" />Portación de arma
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">N° de portación</label>
                <input value={form.numero_portacion} onChange={e => set("numero_portacion", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
                  placeholder="Ej. P-12345-2024" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Fecha de emisión</label>
                <input type="date" value={form.fecha_emision_portacion} onChange={e => set("fecha_emision_portacion", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            {form.fecha_emision_portacion && (
              <p className="text-xs text-blue-400/80 mt-2 flex items-center gap-1">
                <span className="opacity-60">Vencimiento auto-calculado:</span>
                {(() => {
                  const d = new Date(form.fecha_emision_portacion + "T00:00:00");
                  d.setFullYear(d.getFullYear() + 1);
                  return d.toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
                })()}
                {arma?.fecha_vencimiento_portacion && !form.fecha_emision_portacion.startsWith(arma.fecha_emision_portacion?.slice(0, 10) ?? "") ? null : null}
              </p>
            )}
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Observaciones</label>
            <textarea value={form.observaciones} onChange={e => set("observaciones", e.target.value)}
              rows={2}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Notas adicionales..." />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-700 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {arma ? "Guardar cambios" : "Registrar arma"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Campo de ficha (componente auxiliar) ─────────────────────────────────────
function FichaCampo({ label, value, mono = false }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="bg-gray-800/50 rounded-lg px-3 py-2.5">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm ${mono ? "font-mono font-semibold text-white" : "text-gray-200"} truncate`}>
        {value || <span className="text-gray-600 italic">—</span>}
      </p>
    </div>
  );
}

// ── Ficha completa del arma (datos + historial) ───────────────────────────────
function ModalFichaArma({ arma, onClose, onEdit }: {
  arma: Arma; onClose: () => void; onEdit: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: detalle } = useQuery<Arma>({
    queryKey: ["arma-detalle", arma.id],
    queryFn: () => apiFetch(`${API}/armas/${arma.id}`),
    initialData: arma,
  });
  const { data: historial = [], isLoading } = useQuery<CustodiaEntry[]>({
    queryKey: ["arma-custodia", arma.id],
    queryFn: () => apiFetch(`${API}/armas/${arma.id}/custodia`),
  });

  const a = detalle ?? arma;
  const [togglingTen, setTogglingTen] = useState(false);
  const [togglingPort, setTogglingPort] = useState(false);

  async function toggleTramite(campo: "tenencia_en_tramite" | "portacion_en_tramite") {
    const setter = campo === "tenencia_en_tramite" ? setTogglingTen : setTogglingPort;
    setter(true);
    try {
      await apiPatch(`${API}/armas/${a.id}`, { [campo]: !a[campo] });
      qc.invalidateQueries({ queryKey: ["arma-detalle", a.id] });
      qc.invalidateQueries({ queryKey: ["armas"] });
      qc.invalidateQueries({ queryKey: ["armas-estado"] });
      toast({
        title: !a[campo]
          ? (campo === "tenencia_en_tramite" ? "Tenencia marcada en trámite" : "Portación marcada en trámite")
          : (campo === "tenencia_en_tramite" ? "Tenencia ya no está en trámite" : "Portación ya no está en trámite"),
      });
    } catch (e: any) {
      toast({ title: e.error || "No se pudo actualizar", variant: "destructive" });
    } finally {
      setter(false);
    }
  }

  return createPortal(
    <div
      role="dialog" aria-modal="true" aria-label={`Ficha del arma ${a.codigo}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700/80 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/15 border border-blue-500/25 rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold text-white font-mono tracking-wider">{a.codigo}</span>
                <span className="text-xs text-gray-400 bg-gray-700/60 px-2 py-0.5 rounded-md">
                  {TIPO_LABELS[a.tipo] ?? a.tipo}
                </span>
                <EstadoBadge estado={a.estado} />
                {!a.activo && (
                  <span className="text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full">Inactiva</span>
                )}
                {!a.puesto_id && (
                  <span
                    title="Esta arma no está asignada a ningún puesto operativo"
                    className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-300 bg-indigo-500/15 border border-indigo-400/30 px-2 py-0.5 rounded-full"
                  >
                    <Shield className="w-3 h-3" />En Armería
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {[a.marca, a.modelo].filter(Boolean).join(" ") || "Sin marca/modelo"}
                {a.calibre ? ` · ${a.calibre}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={onEdit} title="Editar arma" aria-label="Editar arma"
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
              <Edit className="w-4 h-4" />
            </button>
            <button onClick={onClose} aria-label="Cerrar ficha"
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">

          {/* ── Datos del arma ── */}
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-3.5 h-3.5 text-gray-500" />
              <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Datos del arma</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <FichaCampo label="Código" value={a.codigo} mono />
              <FichaCampo label="Tipo" value={TIPO_LABELS[a.tipo] ?? a.tipo} />
              <FichaCampo label="Calibre" value={a.calibre} />
              <FichaCampo label="Marca" value={a.marca} />
              <FichaCampo label="Modelo" value={a.modelo} />
              <FichaCampo label="Serie" value={a.serie} mono />
            </div>
          </div>

          {/* ── Tenencia ── */}
          <div className="px-5 pb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-gray-500" />
                <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Tenencia de arma</h3>
              </div>
              <TenenciaBadge arma={a} showDays />
            </div>
            {a.numero_tenencia ? (
              <div className="grid grid-cols-2 gap-2">
                <FichaCampo label="N° de tenencia" value={a.numero_tenencia} mono />
                <FichaCampo label="Vencimiento" value={a.fecha_vencimiento_tenencia ? fmtFecha(a.fecha_vencimiento_tenencia) : null} />
              </div>
            ) : (
              <div className={`rounded-lg px-3 py-2.5 flex items-center gap-2 border ${
                a.tenencia_en_tramite
                  ? "bg-cyan-500/5 border-cyan-500/25"
                  : "bg-rose-500/5 border-rose-500/25"
              }`}>
                <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${a.tenencia_en_tramite ? "text-cyan-400" : "text-rose-400"}`} />
                <p className={`text-xs flex-1 ${a.tenencia_en_tramite ? "text-cyan-300/90" : "text-rose-300/90"}`}>
                  {a.tenencia_en_tramite
                    ? "En trámite — los datos se están gestionando. Edita el arma cuando llegue el número y la fecha."
                    : "Sin datos de tenencia. Edita el arma para registrarlos o marca que ya está en trámite."}
                </p>
                <button
                  onClick={() => toggleTramite("tenencia_en_tramite")}
                  disabled={togglingTen}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors flex-shrink-0 disabled:opacity-50 ${
                    a.tenencia_en_tramite
                      ? "text-gray-300 bg-gray-700/40 border-gray-600 hover:bg-gray-700/70"
                      : "text-cyan-300 bg-cyan-500/15 border-cyan-500/30 hover:bg-cyan-500/25"
                  }`}>
                  {togglingTen && <Loader2 className="w-3 h-3 animate-spin" />}
                  {a.tenencia_en_tramite ? "Quitar trámite" : "En trámite"}
                </button>
              </div>
            )}
          </div>

          {/* ── Portación ── */}
          <div className="px-5 pb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-gray-500" />
                <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Portación de arma</h3>
              </div>
              <PortacionBadge arma={a} showDays />
            </div>
            {a.numero_portacion ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <FichaCampo label="N° de portación" value={a.numero_portacion} mono />
                <FichaCampo label="Emisión" value={a.fecha_emision_portacion ? fmtFecha(a.fecha_emision_portacion) : null} />
                <FichaCampo label="Vencimiento" value={a.fecha_vencimiento_portacion ? fmtFecha(a.fecha_vencimiento_portacion) : null} />
              </div>
            ) : (
              <div className={`rounded-lg px-3 py-2.5 flex items-center gap-2 border ${
                a.portacion_en_tramite
                  ? "bg-cyan-500/5 border-cyan-500/25"
                  : "bg-rose-500/5 border-rose-500/25"
              }`}>
                <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${a.portacion_en_tramite ? "text-cyan-400" : "text-rose-400"}`} />
                <p className={`text-xs flex-1 ${a.portacion_en_tramite ? "text-cyan-300/90" : "text-rose-300/90"}`}>
                  {a.portacion_en_tramite
                    ? "En trámite — los datos se están gestionando. Edita el arma cuando llegue el número y la fecha de emisión."
                    : "Sin datos de portación. Edita el arma para registrarlos o marca que ya está en trámite."}
                </p>
                <button
                  onClick={() => toggleTramite("portacion_en_tramite")}
                  disabled={togglingPort}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors flex-shrink-0 disabled:opacity-50 ${
                    a.portacion_en_tramite
                      ? "text-gray-300 bg-gray-700/40 border-gray-600 hover:bg-gray-700/70"
                      : "text-cyan-300 bg-cyan-500/15 border-cyan-500/30 hover:bg-cyan-500/25"
                  }`}>
                  {togglingPort && <Loader2 className="w-3 h-3 animate-spin" />}
                  {a.portacion_en_tramite ? "Quitar trámite" : "En trámite"}
                </button>
              </div>
            )}
          </div>

          {/* ── Puesto asignado ── */}
          <div className="px-5 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-3.5 h-3.5 text-gray-500" />
              <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Puesto asignado</h3>
            </div>
            {a.puesto_nombre ? (
              <div className="bg-gray-800/50 rounded-lg px-3 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{a.puesto_nombre}</p>
                  {a.cliente_nombre && <p className="text-xs text-gray-400 truncate">{a.cliente_nombre}</p>}
                  {a.puesto_direccion && (
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />{a.puesto_direccion}
                    </p>
                  )}
                </div>
                {a.custodio_nombre && (
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-1 text-xs text-teal-400">
                      <User className="w-3 h-3" />
                      <span className="truncate max-w-[140px]">{a.custodio_nombre}</span>
                    </div>
                    {a.custodia_desde && (
                      <p className="text-[10px] text-gray-500 mt-0.5">desde {fmtDatetime(a.custodia_desde)}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-lg px-3 py-2.5 flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-400/60 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-indigo-300/80">En Armería</p>
                  <p className="text-xs text-indigo-300/40">Sin puesto operativo asignado</p>
                </div>
              </div>
            )}
            {a.observaciones && (
              <div className="mt-2 bg-yellow-500/5 border border-yellow-500/15 rounded-lg px-3 py-2">
                <p className="text-[10px] text-yellow-400/70 uppercase tracking-wider mb-0.5">Observaciones</p>
                <p className="text-xs text-gray-300">{a.observaciones}</p>
              </div>
            )}
          </div>

          {/* ── Historial completo ── */}
          <div className="px-5 pb-5 border-t border-gray-700/40 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-gray-500" />
                <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Historial de custodia</h3>
              </div>
              <span className="text-[10px] text-gray-600 bg-gray-800/50 px-2 py-0.5 rounded-full">
                {isLoading ? "…" : `${historial.length} registro(s)`}
              </span>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              </div>
            ) : historial.length === 0 ? (
              <div className="text-center py-8 text-gray-600">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sin registros de custodia aún</p>
              </div>
            ) : (
              <div className="space-y-0">
                {historial.map((h, i) => {
                  const isActiva = h.fecha_fin === null;
                  return (
                    <div key={h.id} className="flex gap-3">
                      {/* línea de tiempo */}
                      <div className="flex flex-col items-center pt-2.5 flex-shrink-0">
                        <div className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 ${
                          isActiva ? "bg-teal-400 border-teal-400" : "bg-gray-800 border-gray-600"
                        }`} />
                        {i < historial.length - 1 && (
                          <div className="w-px flex-1 bg-gray-700/50 my-1 min-h-[12px]" />
                        )}
                      </div>

                      {/* contenido */}
                      <div className={`flex-1 min-w-0 pb-3 ${i < historial.length - 1 ? "" : ""}`}>
                        <div className={`rounded-lg px-3 py-2.5 border ${
                          isActiva
                            ? "bg-teal-500/5 border-teal-500/20"
                            : "bg-gray-800/30 border-gray-700/40"
                        }`}>
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="min-w-0">
                              <p className={`text-sm font-medium ${isActiva ? "text-teal-200" : "text-gray-300"}`}>
                                {h.custodio_nombre ?? <span className="italic text-gray-600">Sin custodio</span>}
                              </p>
                              {h.custodio_tipo && (
                                <p className="text-[10px] text-gray-500 capitalize">{h.custodio_tipo.replace(/_/g, " ")}</p>
                              )}
                              {(h.puesto_nombre || h.cliente_nombre) && (
                                <p className="text-xs text-gray-500 mt-0.5 truncate">
                                  {h.puesto_nombre ?? "—"}{h.cliente_nombre ? ` · ${h.cliente_nombre}` : ""}
                                </p>
                              )}
                            </div>
                            <div className="flex-shrink-0 text-right">
                              {isActiva
                                ? <span className="text-[10px] text-teal-400 bg-teal-400/10 border border-teal-400/20 px-2 py-0.5 rounded-full font-medium">En curso</span>
                                : <span className="text-[10px] text-gray-600">Cerrada</span>
                              }
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[10px] text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {fmtDatetime(h.fecha_inicio)}
                              {!isActiva && h.fecha_fin && <> → {fmtDatetime(h.fecha_fin)}</>}
                              {isActiva && <span className="text-teal-400/60 ml-0.5">→ en curso</span>}
                            </span>
                            <span className="text-[10px] text-blue-300/70 bg-blue-400/8 border border-blue-400/15 px-1.5 py-0.5 rounded">
                              {ORIGEN_LABELS[h.tipo_origen] ?? h.tipo_origen}
                            </span>
                          </div>
                          {h.notas && (
                            <p className="text-[10px] text-gray-500 mt-1 italic">"{h.notas}"</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Tab: Estado Operativo ─────────────────────────────────────────────────────
type FiltroDocumental = "todos" | "vencida" | "proximo_a_vencer" | "pendiente" | "en_tramite";

function TabEstado({ fecha, onFicha }: { fecha: string; onFicha: (a: EstadoArma) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { active: deleteModeActive, requestDelete } = useDeleteMode();
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [filtroDoc, setFiltroDoc] = useState<FiltroDocumental>("todos");

  const { data: estado = [], isLoading, refetch } = useQuery<EstadoArma[]>({
    queryKey: ["armas-estado", fecha],
    queryFn: () => apiFetch(`${API}/armas/estado-operativo?fecha=${fecha}`),
    refetchInterval: 60_000,
  });

  // Cuenta armas que están en cualquiera de los dos documentos (tenencia o portación)
  // en un estado dado. Así "Pendientes" incluye armas a las que les falta tenencia
  // O portación, no solo portación.
  const porDoc = (ed: EstadoDocumental) =>
    estado.filter(a => a.estado_documental_portacion === ed || a.estado_documental === ed).length;
  // "Sin registro" legacy se trata como pendiente para retrocompatibilidad
  const porPendiente = estado.filter(a =>
    ["pendiente", "sin_registro"].includes(a.estado_documental_portacion)
    || ["pendiente", "sin_registro"].includes(a.estado_documental)
  ).length;
  const alertas = porDoc("vencida") + porDoc("proximo_a_vencer") + porPendiente;

  const filtered = estado.filter(a => {
    const matchDoc = filtroDoc === "todos"
      || (filtroDoc === "pendiente"
        ? ["pendiente", "sin_registro"].includes(a.estado_documental_portacion)
          || ["pendiente", "sin_registro"].includes(a.estado_documental)
        : a.estado_documental_portacion === filtroDoc || a.estado_documental === filtroDoc);
    const matchSearch = !search || a.codigo.toLowerCase().includes(search.toLowerCase())
      || (a.puesto_nombre ?? "").toLowerCase().includes(search.toLowerCase())
      || (a.cliente_nombre ?? "").toLowerCase().includes(search.toLowerCase())
      || (a.responsable_turno?.nombre_completo ?? "").toLowerCase().includes(search.toLowerCase());
    return matchDoc && matchSearch;
  });

  async function syncTodas() {
    setSyncing(true);
    try {
      const r: any = await apiPost(`${API}/armas/sync-custodias`, {
        fecha, usuario: (user as any)?.username ?? "admin",
      });
      toast({ title: `Sync completado: ${r.cambios} cambio(s) de custodia aplicado(s)` });
      qc.invalidateQueries({ queryKey: ["armas-estado"] });
      qc.invalidateQueries({ queryKey: ["armas"] });
    } catch (e: any) {
      toast({ title: "Error al sincronizar", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  if (isLoading) return (
    <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>
  );

  if (estado.length === 0) return (
    <div className="text-center py-16 text-gray-500">
      <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p>No hay armas asignadas a puestos aún.</p>
      <p className="text-sm mt-1">Registra un arma y asígnala a un puesto operativo.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar arma, puesto o responsable..."
            className="w-full bg-gray-800/60 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg hover:border-gray-500 transition-colors">
          <RefreshCw className="w-4 h-4" />Refrescar
        </button>
        <button onClick={syncTodas} disabled={syncing}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-orange-600/10 hover:bg-orange-600/20 text-orange-400 border border-orange-500/20 rounded-lg transition-colors disabled:opacity-50"
          title="Herramienta de ajuste excepcional — el flujo normal ocurre al cierre del pizarrón">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
          Sincronización extraordinaria
        </button>
      </div>

      {/* Filtros documentales */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { id: "todos",             label: "Todas",           count: estado.length,              cls: "border-gray-600 text-gray-300" },
          { id: "vencida",           label: "Vencidas",        count: porDoc("vencida"),          cls: "border-red-500/30 text-red-400" },
          { id: "proximo_a_vencer",  label: "Por vencer",      count: porDoc("proximo_a_vencer"), cls: "border-amber-500/30 text-amber-400" },
          { id: "pendiente",         label: "Pendientes",      count: porPendiente,                cls: "border-rose-500/30 text-rose-400" },
          { id: "en_tramite",        label: "En trámite",      count: porDoc("en_tramite"),       cls: "border-cyan-500/30 text-cyan-400" },
        ] as { id: FiltroDocumental; label: string; count: number; cls: string }[]).map(f => (
          <button key={f.id} onClick={() => setFiltroDoc(f.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filtroDoc === f.id
                ? "bg-gray-700 border-gray-500 text-white"
                : `bg-gray-800/40 hover:bg-gray-700/60 ${f.cls}`
            }`}>
            {f.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filtroDoc === f.id ? "bg-gray-600 text-white" : "bg-gray-700/60 text-gray-400"}`}>
              {f.count}
            </span>
          </button>
        ))}
        {alertas > 0 && filtroDoc === "todos" && (
          <span className="ml-auto text-[11px] text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {alertas} arma(s) con alerta documental
          </span>
        )}
      </div>

      <div className="grid gap-3">
        {filtered.map(arma => (
          <div key={arma.id} className={`bg-gray-800/50 border rounded-xl p-4 hover:border-gray-600 transition-colors group ${
            arma.estado_documental_portacion === "vencida" ? "border-red-500/25" : arma.estado_documental_portacion === "proximo_a_vencer" ? "border-amber-500/20" : "border-gray-700/60"
          }`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${arma.responsable_turno ? "bg-teal-400" : arma.descanso_por_ciclo ? "bg-blue-400" : "bg-gray-600"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold text-sm">{arma.codigo}</span>
                    <span className="text-gray-400 text-xs">{TIPO_LABELS[arma.tipo] ?? arma.tipo}</span>
                    {arma.marca && <span className="text-gray-500 text-xs">{arma.marca} {arma.modelo}</span>}
                    {arma.calibre && <span className="text-[10px] text-gray-500 bg-gray-700/50 px-1.5 py-0.5 rounded">{arma.calibre}</span>}
                    <EstadoBadge estado={arma.estado} />
                    <PortacionBadge arma={arma} showDays />
                    {arma.sugerencias_pendientes > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 animate-pulse">
                        ⚠ {arma.sugerencias_pendientes} sugerencia{arma.sugerencias_pendientes > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {arma.puesto_nombre ? (
                      <>
                        <span className="truncate">{arma.puesto_nombre}</span>
                        {arma.cliente_nombre && (
                          <>
                            <ChevronRight key={`chr-cli-${arma.id}`} className="w-3 h-3 flex-shrink-0" />
                            <span key={`cli-${arma.id}`} className="truncate text-gray-500">{arma.cliente_nombre}</span>
                          </>
                        )}
                        {arma.zona_nombre && (
                          <>
                            <ChevronRight key={`chr-zona-${arma.id}`} className="w-3 h-3 flex-shrink-0" />
                            <span key={`zona-${arma.id}`} className="text-gray-500 truncate">{arma.zona_nombre}</span>
                          </>
                        )}
                      </>
                    ) : (
                      <span className="text-indigo-300/70 font-medium">En Armería</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <ResponsableChip
                  responsable={arma.responsable_turno}
                  descansa={arma.descanso_por_ciclo}
                  enArmeria={!arma.puesto_id}
                />
                <button
                  onClick={() => onFicha(arma)}
                  title="Ver ficha del arma"
                  className="p-1.5 text-gray-600 hover:text-blue-400 hover:bg-blue-400/10 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                  <FileText className="w-3.5 h-3.5" />
                </button>
                {deleteModeActive && (
                  <button
                    onClick={() => requestDelete({ entidad: "arma", entidad_id: arma.id, entidad_descripcion: arma.codigo })}
                    title="Solicitar eliminación"
                    className="p-1.5 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors border border-red-500/20">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            {arma.custodio_nombre && (
              <div className="mt-2 pt-2 border-t border-gray-700/40 text-[11px] text-gray-500 flex items-center gap-1.5">
                <User className="w-3 h-3" />
                Custodia registrada: <span className="text-gray-400">{arma.custodio_nombre}</span>
                {arma.custodia_desde && <span>desde {fmtDatetime(arma.custodia_desde)}</span>}
                {arma.custodia_tipo_origen && <span className="text-blue-400/70">· {ORIGEN_LABELS[arma.custodia_tipo_origen] ?? arma.custodia_tipo_origen}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && search && (
        <p className="text-center text-gray-500 py-6">Sin resultados para "{search}"</p>
      )}
    </div>
  );
}

// ── Tab: Lista de Armas ───────────────────────────────────────────────────────
function TabArmas({ onEdit, onFicha }: {
  onEdit: (a: Arma) => void; onFicha: (a: Arma) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { active: deleteModeActive, requestDelete } = useDeleteMode();
  const [search, setSearch] = useState("");
  const [soloActivas, setSoloActivas] = useState(true);

  const { data: armas = [], isLoading, refetch } = useQuery<Arma[]>({
    queryKey: ["armas"],
    queryFn: () => apiFetch(`${API}/armas`),
  });

  const filtered = armas.filter(a => {
    if (soloActivas && !a.activo) return false;
    if (!search) return true;
    return a.codigo.toLowerCase().includes(search.toLowerCase())
      || (a.marca ?? "").toLowerCase().includes(search.toLowerCase())
      || (a.modelo ?? "").toLowerCase().includes(search.toLowerCase())
      || (a.puesto_nombre ?? "").toLowerCase().includes(search.toLowerCase())
      || (a.custodio_nombre ?? "").toLowerCase().includes(search.toLowerCase());
  });

  async function syncArma(arma: Arma) {
    try {
      const r: any = await apiPost(`${API}/armas/${arma.id}/sync-custodia`, {
        fecha: hoy(), usuario: (user as any)?.username ?? "admin",
      });
      toast({ title: r.cambio ? `Custodia actualizada: ${r.responsable_nuevo?.nombre ?? "Sin responsable"}` : r.motivo });
      qc.invalidateQueries({ queryKey: ["armas"] });
      qc.invalidateQueries({ queryKey: ["armas-estado"] });
    } catch {
      toast({ title: "Error al sincronizar", variant: "destructive" });
    }
  }

  if (isLoading) return (
    <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por código, marca, puesto..."
            className="w-full bg-gray-800/60 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
          <input type="checkbox" checked={soloActivas} onChange={e => setSoloActivas(e.target.checked)} className="accent-blue-500" />
          Solo activas
        </label>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg hover:border-gray-500 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No hay armas registradas aún.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-700/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/80 text-gray-400 text-xs">
                <th className="text-left px-4 py-3 font-medium">Código</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Tipo</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Marca / Modelo</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Calibre / Serie</th>
                <th className="text-left px-4 py-3 font-medium">Puesto</th>
                <th className="text-left px-4 py-3 font-medium">Custodio actual</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Tenencia</th>
                <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Portación</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {filtered.map(arma => (
                <tr key={arma.id} className={`hover:bg-gray-700/30 transition-colors ${!arma.activo ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-mono font-semibold text-white">{arma.codigo}</td>
                  <td className="px-4 py-3 text-gray-300 hidden sm:table-cell">{TIPO_LABELS[arma.tipo] ?? arma.tipo}</td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{[arma.marca, arma.modelo].filter(Boolean).join(" ") || "—"}</td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell text-xs">{arma.calibre ?? "—"}{arma.serie ? ` / ${arma.serie}` : ""}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {arma.puesto_nombre
                      ? <><p className="text-gray-300">{arma.puesto_nombre}</p><p className="text-gray-500">{arma.cliente_nombre}</p></>
                      : <span className="text-indigo-300/60 flex items-center gap-1"><Shield className="w-3 h-3" />En Armería</span>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {arma.custodio_nombre
                      ? <><p className="text-gray-300">{arma.custodio_nombre}</p><p className="text-gray-500">{fmtFecha(arma.custodia_desde)}</p></>
                      : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell"><TenenciaBadge arma={arma} showDays /></td>
                  <td className="px-4 py-3 hidden xl:table-cell"><PortacionBadge arma={arma} showDays /></td>
                  <td className="px-4 py-3"><EstadoBadge estado={arma.estado} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {arma.puesto_id && (
                        <button onClick={() => syncArma(arma)} title="Sincronización extraordinaria (ajuste excepcional)"
                          className="p-1.5 text-gray-500 hover:text-orange-400 hover:bg-orange-400/10 rounded-md transition-colors">
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => onFicha(arma)} title="Ver ficha"
                        className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-md transition-colors">
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onEdit(arma)} title="Editar"
                        className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded-md transition-colors">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      {deleteModeActive && (
                        <button
                          onClick={() => requestDelete({ entidad: "arma", entidad_id: arma.id, entidad_descripcion: arma.codigo })}
                          title="Solicitar eliminación"
                          className="p-1.5 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors border border-red-500/20">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-600 text-right">{filtered.length} arma(s) mostrada(s)</p>
    </div>
  );
}

// ── Tab: Historial Global ─────────────────────────────────────────────────────
function TabHistorial() {
  const [search, setSearch] = useState("");

  const { data: historial = [], isLoading } = useQuery<CustodiaEntry[]>({
    queryKey: ["armas-historial"],
    queryFn: () => apiFetch(`${API}/armas/historial/global?limite=200`),
    refetchInterval: 60_000,
  });

  const filtered = historial.filter(h =>
    !search
    || (h.codigo ?? "").toLowerCase().includes(search.toLowerCase())
    || (h.custodio_nombre ?? "").toLowerCase().includes(search.toLowerCase())
    || (h.puesto_nombre ?? "").toLowerCase().includes(search.toLowerCase())
    || (h.cliente_nombre ?? "").toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return (
    <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Filtrar por arma, custodio o puesto..."
          className="w-full bg-gray-800/60 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Sin registros de custodia aún.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(h => (
            <div key={h.id} className={`flex items-start gap-4 p-3 rounded-lg border transition-colors ${h.fecha_fin === null ? "border-teal-500/25 bg-teal-500/5" : "border-gray-700/40 bg-gray-800/20"}`}>
              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${h.fecha_fin === null ? "bg-teal-400" : "bg-gray-600"}`} />
              <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-mono text-sm font-semibold">{h.codigo}</span>
                    <span className="text-gray-500 text-xs">{h.tipo ? TIPO_LABELS[h.tipo] ?? h.tipo : ""}</span>
                    {h.marca && <span className="text-gray-500 text-xs">{h.marca} {h.modelo}</span>}
                  </div>
                  <p className="text-xs text-gray-300">{h.custodio_nombre ?? "— Sin custodio —"}</p>
                  <p className="text-xs text-gray-500">{h.puesto_nombre ?? "—"}{h.cliente_nombre ? ` · ${h.cliente_nombre}` : ""}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {h.fecha_fin === null
                    ? <span className="text-[10px] text-teal-400 bg-teal-400/10 border border-teal-400/20 px-2 py-0.5 rounded-full">Activa</span>
                    : null}
                  <p className="text-[10px] text-gray-500 mt-0.5">{fmtDatetime(h.fecha_inicio)}</p>
                  {h.fecha_fin && <p className="text-[10px] text-gray-600">{fmtDatetime(h.fecha_fin)}</p>}
                  <span className="text-[10px] text-blue-400/70">{ORIGEN_LABELS[h.tipo_origen] ?? h.tipo_origen}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-600 text-right">{filtered.length} registro(s)</p>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Armeria() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<"estado" | "armas" | "historial">("estado");
  const [fechaConsulta, setFechaConsulta] = useState(hoy());
  const [modalArma, setModalArma] = useState<Arma | null | "nuevo">(null);
  const [modalFicha, setModalFicha] = useState<Arma | null>(null);

  const { data: puestos = [] } = useQuery<Puesto[]>({
    queryKey: ["armas-puestos"],
    queryFn: () => apiFetch(`${API}/armas/puestos/disponibles`),
  });

  interface Sugerencia {
    id: number; arma_id: number; supervisor_nombre: string; estado_sugerido: string;
    observacion: string | null; created_at: string;
    arma_codigo: string; arma_tipo: string; puesto_nombre: string | null; cliente_nombre: string | null;
  }
  const { data: sugerencias = [], refetch: refetchSugerencias } = useQuery<Sugerencia[]>({
    queryKey: ["arma-sugerencias"],
    queryFn: () => apiFetch(`${API}/armeria/sugerencias`),
    refetchInterval: 30_000,
  });

  async function atenderSugerencia(id: number) {
    await apiPatch(`${API}/armeria/sugerencias/${id}/atender`, { atendido_por: (user as any)?.username ?? "admin" });
    refetchSugerencias();
    qc.invalidateQueries({ queryKey: ["armas"] });
    qc.invalidateQueries({ queryKey: ["armas-estado"] });
  }

  function handleSaved() {
    setModalArma(null);
    qc.invalidateQueries({ queryKey: ["armas"] });
    qc.invalidateQueries({ queryKey: ["armas-estado"] });
    qc.invalidateQueries({ queryKey: ["armas-historial"] });
  }

  const TABS = [
    { id: "estado",    label: "Estado Operativo", icon: Shield },
    { id: "armas",     label: "Armas",             icon: Package },
    { id: "historial", label: "Historial",          icon: History },
  ] as const;

  return (
    <AdminLayout title="Armería">
      {/* Header con tabs */}
      <div className="border-b border-gray-800/60 bg-gray-900/50 -m-4 md:-m-6 mb-4 md:mb-6 px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500/15 border border-blue-500/30 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">Armería</h1>
              <p className="text-[11px] text-gray-500 hidden sm:block">Control operativo de armas asignadas a puestos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tab === "estado" && (
              <input type="date" value={fechaConsulta} onChange={e => setFechaConsulta(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500" />
            )}
            <button onClick={() => setModalArma("nuevo")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nueva arma</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 -mb-px">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "text-blue-400 border-blue-400"
                  : "text-gray-500 border-transparent hover:text-gray-300"
              }`}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Banner sugerencias pendientes de supervisores ── */}
      {sugerencias.length > 0 && (
        <div className="mx-4 md:mx-6 mt-4 bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-orange-400 font-semibold text-sm">⚠ {sugerencias.length} sugerencia{sugerencias.length > 1 ? "s" : ""} de supervisor pendiente{sugerencias.length > 1 ? "s" : ""}</span>
          </div>
          {sugerencias.map(s => (
            <div key={s.id} className="flex items-start gap-3 bg-orange-500/5 border border-orange-500/20 rounded-lg p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-semibold text-xs font-mono">{s.arma_codigo}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-semibold border ${
                    s.estado_sugerido === "bodega" ? "bg-blue-500/15 text-blue-300 border-blue-500/30" : "bg-orange-500/15 text-orange-300 border-orange-500/30"
                  }`}>
                    {s.estado_sugerido === "bodega" ? "Enviar a bodega" : "Mal estado"}
                  </span>
                  {s.puesto_nombre && <span className="text-xs text-gray-400">{s.puesto_nombre}</span>}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Supervisor: {s.supervisor_nombre}
                  {s.observacion && <span className="text-gray-500"> — {s.observacion}</span>}
                </p>
              </div>
              <button onClick={() => atenderSugerencia(s.id)}
                className="px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-300 rounded-lg text-xs font-medium transition-colors flex-shrink-0">
                Atender
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {tab === "estado"    && <TabEstado fecha={fechaConsulta} onFicha={a => setModalFicha(a)} />}
      {tab === "armas"     && <TabArmas onEdit={a => setModalArma(a)} onFicha={a => setModalFicha(a)} />}
      {tab === "historial" && <TabHistorial />}

      {/* Modales */}
      {modalArma && (
        <ModalArma
          arma={modalArma === "nuevo" ? null : modalArma}
          puestos={puestos}
          onClose={() => setModalArma(null)}
          onSaved={handleSaved}
          usuario={(user as any)?.username ?? "admin"}
        />
      )}
      {modalFicha && (
        <ModalFichaArma
          arma={modalFicha}
          onClose={() => setModalFicha(null)}
          onEdit={() => { setModalArma(modalFicha); setModalFicha(null); }}
        />
      )}
    </AdminLayout>
  );
}
