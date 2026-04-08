import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "../layout/AdminLayout";
import {
  Landmark, Building2, MapPin, Phone, Mail, Fax,
  Loader2, CheckCircle, AlertTriangle, Save, Edit3,
  ExternalLink, Plus, RefreshCw, Shield, X,
  Upload, FileSpreadsheet, Database, BarChart3
} from "lucide-react";

const API = "/api";
const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";
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

// ─── Panel Libro de Salarios ──────────────────────────────────────────────────
const MESES = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

interface LibSalRow {
  emp_nit?: string; pla_numero?: number; empl_numero: number;
  lbl_tpla?: string; lbl_ano: number; lbl_mes: number; lbl_pla: number;
  lbl_dt?: number; lbl_dsigss?: number; lbl_dsemp?: number;
  lbl_faltas?: number; lbl_dvac?: number; lbl_hrses?: number;
  lbl_hrsed?: number; lbl_hrst?: number;
  lbl_tdev?: number; lbl_tdes?: number; lbl_liquido?: number;
  lbl_bono14?: number; lbl_aguinaldo?: number; lbl_vacaciones?: number;
  lbl_indem?: number; lbl_ordinario?: number;
  depto_codigo?: string; lbl_dsep?: number; lbl_dasu?: number; lbl_dsigssa?: number;
}

interface ResumenPeriodo {
  lbl_ano: string; lbl_mes: string; lbl_pla: string;
  empleados: string; total_ordinario: string; total_devengado: string; total_liquido: string;
}

function PanelLibroSalarios() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<LibSalRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ preview: boolean; total: number; insertadas: number; actualizadas: number; errores: number } | null>(null);

  const { data: resumenData, refetch: refetchResumen } = useQuery<{ periodos: ResumenPeriodo[] }>({
    queryKey: ["lib-sal-resumen"],
    queryFn: () => fetch(`${API}/igss/lib-sal/resumen`, { headers: { "x-isp-session": getSession() } }).then(r => r.json()),
  });
  const periodos = resumenData?.periodos ?? [];

  const parseFile = useCallback((file: File) => {
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const parsed = XLSX.utils.sheet_to_json<LibSalRow>(ws, { defval: 0 });
        setRows(parsed);
        setFileName(file.name);
      } catch {
        alert("No se pudo leer el archivo. Verifica que sea un Excel .xlsx válido.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const doImport = async (preview: boolean) => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch(`${API}/igss/importar-lib-sal`, {
        method: "POST",
        headers: h(),
        body: JSON.stringify({ rows, preview }),
      });
      const d = await res.json();
      setResult(d);
      if (!preview) { setRows([]); setFileName(""); refetchResumen(); }
    } catch {
      alert("Error de red al importar");
    } finally {
      setImporting(false);
    }
  };

  const empsCnt = rows.length > 0 ? new Set(rows.map(r => r.empl_numero)).size : 0;
  const periodoMin = rows.length > 0 ? rows.reduce((m, r) => r.lbl_ano * 100 + r.lbl_mes < m ? r.lbl_ano * 100 + r.lbl_mes : m, 999999) : null;
  const periodoMax = rows.length > 0 ? rows.reduce((m, r) => r.lbl_ano * 100 + r.lbl_mes > m ? r.lbl_ano * 100 + r.lbl_mes : m, 0) : null;
  const fmtPeriodo = (n: number | null) => n ? `${MESES[n % 100] ?? n % 100} ${Math.floor(n / 100)}` : "";

  return (
    <div className="bg-[#0c1829] border border-white/5 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-white/5">
        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
        <p className="text-sm font-bold text-white">Libro de Salarios</p>
        <span className="text-[10px] text-white/30 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">Importación ODBC</span>
        {periodos.length > 0 && (
          <span className="ml-auto text-[10px] text-emerald-400/60 bg-emerald-400/8 border border-emerald-400/20 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Database className="w-2.5 h-2.5" />{periodos.reduce((s, p) => s + Number(p.empleados), 0).toLocaleString()} registros
          </span>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Drop zone */}
        {rows.length === 0 && !result && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${dragging ? "border-emerald-400/60 bg-emerald-400/5" : "border-white/10 hover:border-white/20 bg-white/2"}`}
          >
            <Upload className={`w-8 h-8 ${dragging ? "text-emerald-400" : "text-white/20"}`} />
            <div className="text-center">
              <p className="text-sm text-white/50">Arrastra el Excel aquí o haz clic para seleccionar</p>
              <p className="text-[10px] text-white/25 mt-1">Archivo dbo_LibSal_*.xlsx exportado del sistema ODBC</p>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={onFileChange} className="hidden" />
          </div>
        )}

        {/* Preview del archivo cargado */}
        {rows.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-white font-semibold">{fileName}</span>
                <span className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full">{rows.length.toLocaleString()} filas</span>
                <span className="text-[10px] text-emerald-400/60 bg-emerald-400/8 px-2 py-0.5 rounded-full">{empsCnt} empleados</span>
                {periodoMin && <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full">{fmtPeriodo(periodoMin)} → {fmtPeriodo(periodoMax)}</span>}
              </div>
              <button onClick={() => { setRows([]); setFileName(""); setResult(null); }} className="text-[10px] text-white/30 hover:text-white/60 flex items-center gap-1 transition-colors">
                <X className="w-3 h-3" /> Quitar
              </button>
            </div>

            {/* Tabla preview */}
            <div className="overflow-x-auto rounded-lg border border-white/8">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-white/5 text-white/40 border-b border-white/8">
                    <th className="px-2 py-1.5 text-left font-medium">Cód.</th>
                    <th className="px-2 py-1.5 text-left font-medium">Año</th>
                    <th className="px-2 py-1.5 text-left font-medium">Mes</th>
                    <th className="px-2 py-1.5 text-left font-medium">Q</th>
                    <th className="px-2 py-1.5 text-right font-medium">Ordinario</th>
                    <th className="px-2 py-1.5 text-right font-medium">Devengado</th>
                    <th className="px-2 py-1.5 text-right font-medium">Descuentos</th>
                    <th className="px-2 py-1.5 text-right font-medium">Líquido</th>
                    <th className="px-2 py-1.5 text-right font-medium">Bono14</th>
                    <th className="px-2 py-1.5 text-right font-medium">Aguinaldo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 15).map((r, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-2 py-1.5 font-mono text-white/60">{r.empl_numero}</td>
                      <td className="px-2 py-1.5 text-white/50">{r.lbl_ano}</td>
                      <td className="px-2 py-1.5 text-white/50">{MESES[r.lbl_mes] ?? r.lbl_mes}</td>
                      <td className="px-2 py-1.5 text-white/40">Q{r.lbl_pla}</td>
                      <td className="px-2 py-1.5 text-right text-white/60">{Number(r.lbl_ordinario).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</td>
                      <td className="px-2 py-1.5 text-right text-white/60">{Number(r.lbl_tdev).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</td>
                      <td className="px-2 py-1.5 text-right text-red-400/60">{Number(r.lbl_tdes).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</td>
                      <td className="px-2 py-1.5 text-right text-emerald-400/80 font-semibold">{Number(r.lbl_liquido).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</td>
                      <td className="px-2 py-1.5 text-right text-blue-300/60">{Number(r.lbl_bono14).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</td>
                      <td className="px-2 py-1.5 text-right text-purple-300/60">{Number(r.lbl_aguinaldo).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 15 && (
                <p className="text-center text-[9px] text-white/20 py-1.5 border-t border-white/5">
                  Mostrando 15 de {rows.length.toLocaleString()} filas
                </p>
              )}
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => doImport(false)}
                disabled={importing}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all"
              >
                {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                Importar {rows.length.toLocaleString()} registros
              </button>
              <button
                onClick={() => doImport(true)}
                disabled={importing}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white/50 hover:text-white text-xs rounded-xl border border-white/10 transition-all"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Previsualizar sin guardar
              </button>
            </div>
          </div>
        )}

        {/* Resultado de importación */}
        {result && (
          <div className={`rounded-xl border p-4 space-y-2 ${result.errores > 0 ? "bg-amber-500/5 border-amber-500/20" : "bg-emerald-500/5 border-emerald-500/20"}`}>
            <div className="flex items-center gap-2">
              {result.errores === 0
                ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                : <AlertTriangle className="w-4 h-4 text-amber-400" />}
              <p className="text-sm font-semibold text-white">
                {result.preview ? "Previsualización" : "Importación completada"}
              </p>
            </div>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="bg-white/5 rounded-lg py-2 px-1">
                <p className="text-[10px] text-white/30">Total</p>
                <p className="text-base font-bold text-white">{result.total.toLocaleString()}</p>
              </div>
              <div className="bg-emerald-400/10 rounded-lg py-2 px-1">
                <p className="text-[10px] text-emerald-300/50">{result.preview ? "Válidos" : "Nuevos"}</p>
                <p className="text-base font-bold text-emerald-300">{result.insertadas.toLocaleString()}</p>
              </div>
              {!result.preview && (
                <div className="bg-blue-400/10 rounded-lg py-2 px-1">
                  <p className="text-[10px] text-blue-300/50">Actualizados</p>
                  <p className="text-base font-bold text-blue-300">{result.actualizadas.toLocaleString()}</p>
                </div>
              )}
              <div className={`${result.errores > 0 ? "bg-red-400/10" : "bg-white/5"} rounded-lg py-2 px-1`}>
                <p className="text-[10px] text-red-300/50">Errores</p>
                <p className={`text-base font-bold ${result.errores > 0 ? "text-red-300" : "text-white/30"}`}>{result.errores}</p>
              </div>
            </div>
            {!result.preview && result.errores === 0 && (
              <button onClick={() => { setResult(null); fileRef.current && (fileRef.current.value = ""); }} className="w-full mt-1 text-[10px] text-white/30 hover:text-white/60 transition-colors">
                Importar otro archivo
              </button>
            )}
          </div>
        )}

        {/* Historial de períodos en BD */}
        {periodos.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5 text-white/30" />
              <p className="text-[10px] text-white/30 uppercase tracking-widest">Períodos en base de datos</p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-white/8">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-white/5 text-white/40 border-b border-white/8">
                    <th className="px-2 py-1.5 text-left font-medium">Período</th>
                    <th className="px-2 py-1.5 text-right font-medium">Empleados</th>
                    <th className="px-2 py-1.5 text-right font-medium">Ordinario total</th>
                    <th className="px-2 py-1.5 text-right font-medium">Devengado</th>
                    <th className="px-2 py-1.5 text-right font-medium">Líquido</th>
                  </tr>
                </thead>
                <tbody>
                  {periodos.map((p, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-2 py-1.5 font-semibold text-white/70">
                        {MESES[Number(p.lbl_mes)] ?? p.lbl_mes} {p.lbl_ano}
                        <span className="ml-1 text-[9px] text-white/25">Q{p.lbl_pla}</span>
                      </td>
                      <td className="px-2 py-1.5 text-right text-white/50">{Number(p.empleados).toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-right text-white/50">Q {Number(p.total_ordinario).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</td>
                      <td className="px-2 py-1.5 text-right text-white/50">Q {Number(p.total_devengado).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</td>
                      <td className="px-2 py-1.5 text-right text-emerald-400/70 font-semibold">Q {Number(p.total_liquido).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

        {/* Libro de salarios */}
        <PanelLibroSalarios />

        {/* Info footer */}
        <div className="bg-blue-950/20 border border-blue-500/15 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <Landmark className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-[10px] text-blue-300/70 leading-relaxed space-y-1">
            <p><strong>Centro de Trabajo = Cliente:</strong> Cada cliente donde laboran los agentes es un centro de trabajo del IGSS. Los datos se configuran desde la ficha del cliente en la tab "Centro IGSS".</p>
            <p className="text-blue-300/40">Próximamente: generación del archivo TXT de planilla mensual en formato 2.2.0 para subir directamente al portal del IGSS.</p>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
