import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "../layout/AdminLayout";
import {
  Landmark, Building2, MapPin, Phone, Mail, Fax,
  Loader2, CheckCircle, AlertTriangle, Save, Edit3,
  ExternalLink, Plus, RefreshCw, Shield, X,
  FileText, Download, Eye, Users, DollarSign, Calendar
} from "lucide-react";
import { getSessionToken } from "@/lib/httpClient";

const API = "/api";
const getSession = () => getSessionToken();
const h = () => ({ "x-isp-session": getSession(), "Content-Type": "application/json" });

const DEPTOS_GT: Record<number, string> = {
  1: "Guatemala", 2: "El Progreso", 3: "Sacatepéquez", 4: "Chimaltenango",
  5: "Escuintla", 6: "Santa Rosa", 7: "Sololá", 8: "Totonicapán",
  9: "Quetzaltenango", 10: "Suchitepéquez", 11: "Retalhuleu", 12: "San Marcos",
  13: "Huehuetenango", 14: "El Quiché", 15: "Baja Verapaz", 16: "Alta Verapaz",
  17: "El Petén", 18: "Izabal", 19: "Zacapa", 20: "Chiquimula",
  21: "Jalapa", 22: "Jutiapa",
};

interface ConfigPatrono {
  id?: number;
  numero_patronal: string | null;
  nit_patrono: string | null;
  nombre_comercial: string | null;
  correo_igss: string | null;
  codigo_actividad_principal: string | null;
}

interface CentroIGSS {
  id: number;
  nombre: string;
  nombre_comercial: string | null;
  nit: string | null;
  igss_codigo_centro: string | null;
  igss_direccion: string | null;
  igss_zona: string | null;
  igss_departamento: number | null;
  igss_municipio: number | null;
  igss_codigo_actividad: string | null;
  igss_contacto: string | null;
  igss_fax: string | null;
  igss_email: string | null;
  igss_telefono: string | null;
}

// ─── Panel de configuración del patrono ──────────────────────────────────────
function PanelConfigPatrono() {
  const qc = useQueryClient();
  const { data: config, isLoading } = useQuery<ConfigPatrono | null>({
    queryKey: ["igss-config-patrono"],
    queryFn: () => fetch(`${API}/igss/config-patrono`, { headers: { "x-isp-session": getSession() } }).then((r) => r.json()),
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ConfigPatrono>({
    numero_patronal: null, nit_patrono: null,
    nombre_comercial: null, correo_igss: null,
    codigo_actividad_principal: null,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const startEdit = () => {
    setForm({
      numero_patronal: config?.numero_patronal ?? "",
      nit_patrono: config?.nit_patrono ?? "",
      nombre_comercial: config?.nombre_comercial ?? "",
      correo_igss: config?.correo_igss ?? "",
      codigo_actividad_principal: config?.codigo_actividad_principal ?? "",
    });
    setEditing(true);
  };

  const up = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true); setError("");
    try {
      const r = await fetch(`${API}/igss/config-patrono`, {
        method: "PATCH",
        headers: h(),
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Error");
      qc.invalidateQueries({ queryKey: ["igss-config-patrono"] });
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-primary/40";
  const lbl = "text-[10px] text-white/40 uppercase tracking-wide block mb-1";

  return (
    <div className="bg-[#0c1829] border border-white/5 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <p className="text-sm font-bold text-white">Configuración del Patrono</p>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle className="w-3 h-3" /> Guardado
            </span>
          )}
          {!editing && (
            <button
              onClick={startEdit}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-primary/70 hover:text-primary border border-white/8 hover:border-primary/30 transition-all"
            >
              <Edit3 className="w-3 h-3" /> Editar
            </button>
          )}
          {editing && (
            <button
              onClick={() => setEditing(false)}
              className="p-1.5 text-white/30 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-white/30" />
        </div>
      ) : editing ? (
        <div className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Número Patronal *</label>
              <input value={form.numero_patronal ?? ""} onChange={(e) => up("numero_patronal", e.target.value)}
                placeholder="Ej: 1234567" className={inp} />
              <p className="text-[9px] text-white/25 mt-1">Número asignado por el IGSS al empleador</p>
            </div>
            <div>
              <label className={lbl}>NIT del Patrono</label>
              <input value={form.nit_patrono ?? ""} onChange={(e) => up("nit_patrono", e.target.value)}
                placeholder="1234567-8" className={inp} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Nombre Comercial</label>
              <input value={form.nombre_comercial ?? ""} onChange={(e) => up("nombre_comercial", e.target.value)}
                placeholder="ISP S.A." className={inp} />
            </div>
            <div>
              <label className={lbl}>Código Actividad Económica Principal</label>
              <input value={form.codigo_actividad_principal ?? ""} onChange={(e) => up("codigo_actividad_principal", e.target.value)}
                placeholder="803011" className={inp} />
            </div>
          </div>
          <div>
            <label className={lbl}>Correo Electrónico (registrado en el IGSS)</label>
            <input type="email" value={form.correo_igss ?? ""} onChange={(e) => up("correo_igss", e.target.value)}
              placeholder="administracion@isp.gt" className={`${inp} max-w-sm`} />
          </div>
          {error && (
            <p className="text-xs text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />{error}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setEditing(false)}
              className="px-3 py-2 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white transition-colors">
              Cancelar
            </button>
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-black text-xs font-bold transition-all disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Guardar
            </button>
          </div>
        </div>
      ) : (
        <div className="p-5">
          {!config || !config.numero_patronal ? (
            <div className="flex items-start gap-3 bg-amber-500/8 border border-amber-500/20 rounded-xl p-4">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-300">Configuración incompleta</p>
                <p className="text-[11px] text-amber-300/60 mt-0.5">
                  Ingresa el número patronal y demás datos del IGSS para poder generar la planilla.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { label: "Número Patronal", value: config.numero_patronal },
                { label: "NIT Patrono", value: config.nit_patrono },
                { label: "Nombre Comercial", value: config.nombre_comercial },
                { label: "Código Actividad Principal", value: config.codigo_actividad_principal },
                { label: "Correo IGSS", value: config.correo_igss },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-2 border-b border-white/4 pb-2">
                  <p className="text-[10px] text-white/35">{label}</p>
                  <p className="text-xs text-white/80 font-medium text-right">{value || "—"}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tarjeta de un centro de trabajo ─────────────────────────────────────────
function TarjetaCentro({ centro }: { centro: CentroIGSS }) {
  const [, navigate] = useLocation();
  const depto = centro.igss_departamento ? DEPTOS_GT[centro.igss_departamento] : null;

  return (
    <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {centro.igss_codigo_centro && (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/20">
                Centro #{centro.igss_codigo_centro}
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-white mt-1 leading-tight">
            {centro.nombre_comercial || centro.nombre}
          </p>
          {centro.nombre_comercial && (
            <p className="text-[10px] text-white/30">{centro.nombre}</p>
          )}
        </div>
        <button
          onClick={() => navigate(`/admin/clientes/${centro.id}?tab=igss`)}
          className="shrink-0 flex items-center gap-1 text-[10px] text-primary/50 hover:text-primary transition-colors px-1.5 py-0.5 rounded hover:bg-primary/8"
        >
          <ExternalLink className="w-2.5 h-2.5" /> Editar
        </button>
      </div>

      <div className="space-y-1.5 text-[10px] text-white/40">
        {centro.igss_direccion && (
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
            <span>{centro.igss_direccion}{centro.igss_zona && `, Zona ${centro.igss_zona}`}</span>
          </div>
        )}
        {depto && (
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3 h-3 shrink-0" />
            <span>{depto}{centro.igss_municipio ? ` — Mun. ${centro.igss_municipio}` : ""}</span>
          </div>
        )}
        {centro.igss_telefono && (
          <div className="flex items-center gap-1.5">
            <Phone className="w-3 h-3 shrink-0" />
            <span>{centro.igss_telefono}</span>
          </div>
        )}
        {centro.igss_email && (
          <div className="flex items-center gap-1.5">
            <Mail className="w-3 h-3 shrink-0" />
            <span>{centro.igss_email}</span>
          </div>
        )}
        {centro.igss_codigo_actividad && (
          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 shrink-0" />
            <span>Actividad: {centro.igss_codigo_actividad}</span>
          </div>
        )}
      </div>

      {centro.igss_contacto && (
        <p className="text-[10px] text-white/30 border-t border-white/5 pt-2">
          Contacto: <span className="text-white/50">{centro.igss_contacto}</span>
        </p>
      )}
    </div>
  );
}

// ─── Generador de Planilla TXT ────────────────────────────────────────────────
interface PreviewData {
  preview: boolean;
  periodo: string;
  totalEmpleados: number;
  totalDevengado: string;
  cuotaLaboral: string;
  cuotaPatronal: string;
  totalAPagar: string;
  centros: { codigo: string; nombre: string; empleados: number }[];
  lineasArchivo: number;
  empleados: { nombre: string; igss: string; sueldoBase: string; devengado: string; dias: number; cuotaLaboral: string; cuotaPatronal: string; centro: string }[];
}

function PanelGenerarPlanilla() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState("");

  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  const doPreview = async () => {
    setPreviewing(true); setError(""); setPreview(null);
    try {
      const r = await fetch(`${API}/igss/generar-planilla?mes=${mes}&anio=${anio}&preview=true`, {
        headers: { "x-isp-session": getSession() },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error");
      setPreview(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPreviewing(false);
    }
  };

  const doDownload = async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`${API}/igss/generar-planilla?mes=${mes}&anio=${anio}`, {
        headers: { "x-isp-session": getSession() },
      });
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error || "Error");
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `planilla_igss_${anio}_${String(mes).padStart(2, "0")}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inp = "bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary/40";

  return (
    <div className="bg-[#0c1829] border border-white/5 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          <p className="text-sm font-bold text-white">Generar Planilla TXT</p>
          <span className="text-[9px] text-emerald-400/60 bg-emerald-400/8 border border-emerald-400/20 px-2 py-0.5 rounded-full font-mono">
            v2.2.0
          </span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-end gap-3">
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1">Mes</label>
            <select value={mes} onChange={(e) => { setMes(Number(e.target.value)); setPreview(null); }}
              className={`${inp} w-40`}>
              {meses.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1">Año</label>
            <input type="number" value={anio} onChange={(e) => { setAnio(Number(e.target.value)); setPreview(null); }}
              min={2020} max={2030} className={`${inp} w-24`} />
          </div>
          <button onClick={doPreview} disabled={previewing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/8 border border-white/10 text-xs text-white/70 hover:text-white transition-all disabled:opacity-50">
            {previewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
            Vista previa
          </button>
          <button onClick={doDownload} disabled={loading || !preview}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Descargar TXT
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-500/8 border border-red-500/20 rounded-xl p-3">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {preview && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#060e1c] rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3 h-3 text-blue-400" />
                  <span className="text-[9px] text-white/30 uppercase">Período</span>
                </div>
                <p className="text-sm font-bold text-white">{preview.periodo}</p>
              </div>
              <div className="bg-[#060e1c] rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className="w-3 h-3 text-cyan-400" />
                  <span className="text-[9px] text-white/30 uppercase">Empleados</span>
                </div>
                <p className="text-sm font-bold text-white">{preview.totalEmpleados}</p>
              </div>
              <div className="bg-[#060e1c] rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="w-3 h-3 text-emerald-400" />
                  <span className="text-[9px] text-white/30 uppercase">Total Devengado</span>
                </div>
                <p className="text-sm font-bold text-emerald-400">Q{Number(preview.totalDevengado).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-[#060e1c] rounded-xl p-3 border border-white/5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Shield className="w-3 h-3 text-primary" />
                  <span className="text-[9px] text-white/30 uppercase">Total a Pagar</span>
                </div>
                <p className="text-sm font-bold text-primary">Q{Number(preview.totalAPagar).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="bg-[#060e1c] rounded-xl p-3 border border-white/5">
                <p className="text-[10px] text-white/30 mb-2 uppercase">Cuotas</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/50">Cuota Laboral (4.83%)</span>
                    <span className="text-cyan-400 font-medium">Q{Number(preview.cuotaLaboral).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/50">Cuota Patronal (12.67%)</span>
                    <span className="text-amber-400 font-medium">Q{Number(preview.cuotaPatronal).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-xs pt-1.5 border-t border-white/5">
                    <span className="text-white/70 font-semibold">Total</span>
                    <span className="text-primary font-bold">Q{Number(preview.totalAPagar).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
              <div className="bg-[#060e1c] rounded-xl p-3 border border-white/5">
                <p className="text-[10px] text-white/30 mb-2 uppercase">Centros de Trabajo</p>
                <div className="space-y-1.5">
                  {preview.centros.map((c) => (
                    <div key={c.codigo} className="flex justify-between text-xs">
                      <span className="text-white/50">
                        <span className="text-primary/60 font-mono mr-1">#{c.codigo}</span>
                        {c.nombre}
                      </span>
                      <span className="text-white/70">{c.empleados} emp.</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-[#060e1c] rounded-xl border border-white/5 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
                <Users className="w-3 h-3 text-white/30" />
                <p className="text-[10px] text-white/30 uppercase">Detalle de Empleados (Libro de Salarios)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-4 py-2 text-white/30 font-normal text-[10px] uppercase">Nombre</th>
                      <th className="text-left px-4 py-2 text-white/30 font-normal text-[10px] uppercase">No. IGSS</th>
                      <th className="text-right px-4 py-2 text-white/30 font-normal text-[10px] uppercase">Días</th>
                      <th className="text-right px-4 py-2 text-white/30 font-normal text-[10px] uppercase">Devengado</th>
                      <th className="text-right px-4 py-2 text-white/30 font-normal text-[10px] uppercase">Cuota Lab.</th>
                      <th className="text-right px-4 py-2 text-white/30 font-normal text-[10px] uppercase">Cuota Pat.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.empleados.map((emp, i) => (
                      <tr key={i} className={`border-b border-white/3 hover:bg-white/2 ${Number(emp.devengado) === 0 ? "opacity-40" : ""}`}>
                        <td className="px-4 py-2 text-white/80">{emp.nombre}</td>
                        <td className="px-4 py-2 text-white/50 font-mono text-[10px]">{emp.igss}</td>
                        <td className="px-4 py-2 text-right text-white/60">{emp.dias}</td>
                        <td className="px-4 py-2 text-right text-emerald-400">Q{Number(emp.devengado).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2 text-right text-cyan-400">Q{Number(emp.cuotaLaboral).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2 text-right text-amber-400">Q{Number(emp.cuotaPatronal).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-white/25">
              <FileText className="w-3 h-3" />
              <span>El archivo TXT contendrá {preview.lineasArchivo} líneas en formato IGSS v2.2.0 (delimitado por pipes).</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Página principal IGSS ────────────────────────────────────────────────────
export default function IGSS() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: centros = [], isLoading, refetch } = useQuery<CentroIGSS[]>({
    queryKey: ["igss-centros"],
    queryFn: () => fetch(`${API}/igss/centros`, { headers: { "x-isp-session": getSession() } }).then((r) => r.json()),
  });

  return (
    <AdminLayout title="IGSS — Planilla Laboral">
      <div className="space-y-5 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Landmark className="w-5 h-5 text-primary" />
              Módulo IGSS
            </h1>
            <p className="text-xs text-white/35 mt-1">
              Configuración del patrono y centros de trabajo para la planilla mensual IGSS
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-white/3 hover:bg-white/6 border border-white/8 text-white/40 hover:text-white transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Generar Planilla TXT */}
        <PanelGenerarPlanilla />

        {/* Panel patrono */}
        <PanelConfigPatrono />

        {/* Centros de trabajo */}
        <div className="bg-[#0c1829] border border-white/5 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              <p className="text-sm font-bold text-white">Centros de Trabajo</p>
              <span className="text-[10px] text-white/30 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">
                {centros.length} activos
              </span>
            </div>
            <button
              onClick={() => navigate("/admin/clientes")}
              className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary border border-primary/20 hover:border-primary/40 px-2.5 py-1.5 rounded-lg transition-all"
            >
              <Plus className="w-3 h-3" /> Agregar centro
            </button>
          </div>

          <div className="p-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-white/30" />
              </div>
            ) : centros.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <Landmark className="w-8 h-8 text-white/10 mx-auto" />
                <p className="text-sm text-white/30">No hay centros de trabajo configurados</p>
                <p className="text-[11px] text-white/20 max-w-sm mx-auto">
                  Ve a la ficha de un cliente, abre la tab "Centro IGSS" y activa la opción para registrarlo como centro de trabajo.
                </p>
                <button
                  onClick={() => navigate("/admin/clientes")}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 text-xs font-semibold hover:bg-primary/20 transition-all mt-2"
                >
                  <ExternalLink className="w-3 h-3" /> Ir a Clientes
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {centros.map((c) => (
                  <TarjetaCentro key={c.id} centro={c} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info footer */}
        <div className="bg-blue-950/20 border border-blue-500/15 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <Landmark className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-[10px] text-blue-300/70 leading-relaxed space-y-1">
            <p><strong>Centro de Trabajo = Cliente:</strong> Cada cliente donde laboran los agentes es un centro de trabajo del IGSS. Los datos se configuran desde la ficha del cliente en la tab "Centro IGSS".</p>
            <p className="text-blue-300/40">El archivo TXT generado sigue el formato 2.2.0 con campos delimitados por pipes (|) y puede subirse directamente al portal del IGSS.</p>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
