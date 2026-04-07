import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRoute, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import {
  Building2, MapPin, Shield, Users, ChevronRight, ChevronDown,
  Plus, Trash2, X, Loader2, CheckCircle, AlertTriangle,
  Edit3, Save, ArrowLeft, Clock, Banknote, RefreshCw,
  UserCheck, Zap, Calendar, FileText, LayoutGrid, Activity,
  ChevronLeft, History, UserCog, Mail, Phone, Power, PowerOff,
  KeyRound, Lock, AlertCircle, Check, Landmark, ToggleLeft, ToggleRight
} from "lucide-react";

const API = "/api";
const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";
const h = () => ({ "x-isp-session": getSession(), "Content-Type": "application/json" });

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface ClienteFicha {
  id: number;
  nombre: string;
  nombreComercial: string | null;
  nit: string | null;
  sector: string | null;
  estado: string;
  observaciones_contractuales: string | null;
  fecha_inicio_contrato: string | null;
  tarifa_base_mensual: string | null;
  estado_contrato: string | null;
  notas: string | null;
  dotacion_uniforme_num: number | null;
  dotacion_uniforme_frecuencia_meses: number | null;
  igss_aplica: boolean;
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

interface Sede {
  id: number;
  client_id: number;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  contacto: string | null;
  telefono: string | null;
  activo: boolean;
  notas: string | null;
  total_puestos: number;
  puestos_cubiertos: number;
  puestos_con_titular: number;
}

interface Puesto {
  id: number;
  nombre: string;
  turno: string | null;
  jornada: string | null;
  horario: string | null;
  hora_entrada: string | null;
  hora_salida: string | null;
  descanso_inicio: string | null;
  descanso_fin: string | null;
  cantidad_contratada: number;
  tarifa_puesto: string | null;
  tipo_servicio: string | null;
  elegible_horas_extra: boolean;
  costo_hora: string | null;
  sede_id: number | null;
  sede_nombre: string | null;
  titular_employee_id: number | null;
  titular_nombre: string | null;
  titular_nombre_completo: string | null;
  titular_telefono: string | null;
  titular_estado_laboral: string | null;
  agente_id: number | null;
  agente_nombre: string | null;
  estado: string;
  notas: string | null;
  zona_operativa_id: number | null;
  zona_nombre: string | null;
  tipo_turno_id: number | null;
  tipo_turno_nombre: string | null;
  fecha_inicio_ciclo: string | null;
}

interface PuestoSlot {
  id: number;
  puesto_id: number;
  puesto_nombre: string;
  sede_id: number | null;
  sede_nombre: string | null;
  slot_numero: number;
  horas_turno: number;
  hora_entrada: string;
  dias_trabajo: number[];
  longitud_ciclo: number;
  fecha_inicio_ciclo: string | null;
  empleado_id: number | null;
  empleado_nombre: string | null;
  empleado_estado: string | null;
  empleado_telefono: string | null;
  notas: string | null;
}

// Ciclo de 14 días: D1..D14
const DIAS_SEM_FC = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DIAS_CICLO = Array.from({ length: 14 }, (_, i) => ({ n: i + 1, label: DIAS_SEM_FC[i % 7] }));
const SEMANA1 = DIAS_CICLO.slice(0, 7);
const SEMANA2 = DIAS_CICLO.slice(7, 14);

interface CoberturaHoy {
  puestos: Array<{
    puesto_id: number;
    puesto_nombre: string;
    sede_nombre: string | null;
    turno: string | null;
    horario: string | null;
    hora_entrada: string | null;
    hora_salida: string | null;
    cantidad_contratada: number;
    titular_employee_id: number | null;
    titular_nombre: string | null;
    agente_id: number | null;
    agente_nombre: string | null;
    estado: string;
    tipo_cobertura: "titular" | "relevo" | "descubierto";
  }>;
  resumen: {
    totalPuestos: number;
    cubiertos: number;
    conTitular: number;
    conRelevo: number;
    descubiertos: number;
  };
}

interface FichaData {
  cliente: ClienteFicha;
  sedes: Sede[];
  puestos: Puesto[];
  coberturaHoy: CoberturaHoy;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtQ = (v: string | null | number) =>
  v ? `Q ${Number(v).toLocaleString("es-GT", { minimumFractionDigits: 2 })}` : "—";

const estadoContratoColor = (e: string | null) => {
  const map: Record<string, string> = {
    activo: "text-green-400 bg-green-400/10 border-green-400/20",
    suspendido: "text-red-400 bg-red-400/10 border-red-400/20",
    negociacion: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    inactivo: "text-white/30 bg-white/4 border-white/10",
  };
  return map[e ?? "activo"] ?? map.activo;
};

const coberturaColor = (tipo: string) => {
  if (tipo === "titular") return "bg-green-500/8 border-green-500/20";
  if (tipo === "relevo") return "bg-amber-500/8 border-amber-500/20";
  return "bg-red-500/8 border-red-500/20";
};

const coberturaBadge = (tipo: string) => {
  if (tipo === "titular") return "text-green-400 bg-green-400/10 border-green-400/20";
  if (tipo === "relevo") return "text-amber-400 bg-amber-400/10 border-amber-400/20";
  return "text-red-400 bg-red-400/10 border-red-400/20";
};

const coberturaTxt = (tipo: string) => {
  if (tipo === "titular") return "Titular cubriendo";
  if (tipo === "relevo") return "Relevo activo";
  return "Descubierto";
};

// ─── Modal: Nuevo/Editar Puesto ───────────────────────────────────────────────
interface ZonaDisponible { id: number; nombre: string; }

function ModalPuesto({
  clientId,
  sedes,
  puesto,
  onClose,
  onSaved,
}: {
  clientId: number;
  sedes: Sede[];
  puesto: Puesto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = puesto !== null;
  const [form, setForm] = useState({
    nombre: puesto?.nombre ?? "",
    hora_entrada: puesto?.hora_entrada ?? "",
    hora_salida: puesto?.hora_salida ?? "",
    descanso_inicio: puesto?.descanso_inicio ?? "",
    descanso_fin: puesto?.descanso_fin ?? "",
    cantidad_contratada: puesto?.cantidad_contratada ?? 1,
    tarifa_puesto: puesto?.tarifa_puesto ?? "",
    tipo_servicio: puesto?.tipo_servicio ?? "",
    elegible_horas_extra: puesto?.elegible_horas_extra ?? false,
    costo_hora: puesto?.costo_hora ?? "",
    sede_id: puesto?.sede_id ? String(puesto.sede_id) : "",
    zona_operativa_id: puesto?.zona_operativa_id ? String(puesto.zona_operativa_id) : "",
    notas: puesto?.notas ?? "",
    tipo_turno_id: puesto?.tipo_turno_id ? String(puesto.tipo_turno_id) : "",
    fecha_inicio_ciclo: puesto?.fecha_inicio_ciclo ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [turnosDisponibles, setTurnosDisponibles] = useState<Array<{ id: number; nombre: string; horas_trabajo: number; horas_descanso: number }>>([]);

  // Cargar catálogo de turnos
  useEffect(() => {
    fetch(`${API}/turnos`, { headers: { "x-isp-session": getSession() } })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setTurnosDisponibles((data ?? []).filter((t: any) => t.activo)))
      .catch(() => {});
  }, []);

  // Zonas operativas disponibles
  const [zonas, setZonas] = useState<ZonaDisponible[]>([]);
  useEffect(() => {
    fetch(`${API}/operaciones/zonas/disponibles`, { headers: { "x-isp-session": getSession() } })
      .then((r) => r.json())
      .then((d) => setZonas(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Cargar datos frescos del servidor al abrir en modo edición
  useEffect(() => {
    if (!isEdit || !puesto?.id) return;
    setLoading(true);
    fetch(`${API}/puestos/${puesto.id}`, { headers: { "x-isp-session": getSession() } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setForm({
          nombre: d.nombre ?? "",
          hora_entrada: d.hora_entrada ?? "",
          hora_salida: d.hora_salida ?? "",
          descanso_inicio: d.descanso_inicio ?? "",
          descanso_fin: d.descanso_fin ?? "",
          cantidad_contratada: d.cantidad_contratada ?? 1,
          tarifa_puesto: d.tarifa_puesto ?? "",
          tipo_servicio: d.tipo_servicio ?? "",
          elegible_horas_extra: d.elegible_horas_extra ?? false,
          costo_hora: d.costo_hora ?? "",
          sede_id: d.sede_id ? String(d.sede_id) : "",
          zona_operativa_id: d.zona_operativa_id ? String(d.zona_operativa_id) : "",
          notas: d.notas ?? "",
          tipo_turno_id: d.tipo_turno_id ? String(d.tipo_turno_id) : "",
          fecha_inicio_ciclo: d.fecha_inicio_ciclo ?? "",
        });
        setBusquedaTitular(d.titular_nombre_completo ?? d.titular_nombre ?? "");
        setTitularId(d.titular_employee_id ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Búsqueda de titular
  const [busquedaTitular, setBusquedaTitular] = useState(
    puesto?.titular_nombre_completo ?? puesto?.titular_nombre ?? ""
  );
  const [titularId, setTitularId] = useState<number | null>(puesto?.titular_employee_id ?? null);
  const [sugerencias, setSugerencias] = useState<{ id: number; nombre_completo: string }[]>([]);
  const [showSugerencias, setShowSugerencias] = useState(false);

  useEffect(() => {
    if (busquedaTitular.length < 2) { setSugerencias([]); return; }
    if (titularId) return;
    const timer = setTimeout(() => {
      fetch(`${API}/employees?q=${encodeURIComponent(busquedaTitular)}&limit=6`, {
        headers: { "x-isp-session": getSession() },
      })
        .then((r) => r.json())
        .then((d) => setSugerencias(Array.isArray(d) ? d : (d.employees ?? [])))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [busquedaTitular, titularId]);

  const up = (k: string, v: string | boolean | number) =>
    setForm((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!form.nombre.trim()) { setErr("El nombre del puesto es requerido"); return; }
    if (!isEdit && !form.zona_operativa_id) { setErr("Debes seleccionar una zona operativa"); return; }
    setSaving(true); setErr("");
    try {
      const turnoSeleccionado = turnosDisponibles.find(t => String(t.id) === form.tipo_turno_id);
      const body = {
        nombre: form.nombre,
        sede_id: form.sede_id ? Number(form.sede_id) : null,
        zona_operativa_id: form.zona_operativa_id ? Number(form.zona_operativa_id) : null,
        titular_employee_id: titularId ?? null,
        cantidad_contratada: Number(form.cantidad_contratada) || 1,
        tarifa_puesto: form.tarifa_puesto ? Number(form.tarifa_puesto) : null,
        costo_hora: form.costo_hora ? Number(form.costo_hora) : null,
        turno: turnoSeleccionado?.nombre || null,
        jornada: null,
        horario: null,
        hora_entrada: form.hora_entrada || null,
        hora_salida: form.hora_salida || null,
        descanso_inicio: form.descanso_inicio || null,
        descanso_fin: form.descanso_fin || null,
        tipo_servicio: form.tipo_servicio || null,
        notas: form.notas || null,
        tipo_turno_id: form.tipo_turno_id ? Number(form.tipo_turno_id) : null,
        fecha_inicio_ciclo: form.fecha_inicio_ciclo || null,
        elegible_horas_extra: form.elegible_horas_extra,
      };
      const url = isEdit ? `${API}/puestos/${puesto!.id}` : `${API}/clientes/${clientId}/puestos`;
      const method = isEdit ? "PATCH" : "POST";
      const r = await fetch(url, { method, headers: h(), body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      onSaved();
    } catch (e: any) {
      setErr("Error al guardar el puesto");
    }
    setSaving(false);
  }

  const Field = ({ label, k, type = "text", placeholder = "" }: { label: string; k: string; type?: string; placeholder?: string }) => (
    <div className="space-y-1">
      <label className="text-[10px] text-white/40 uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={(form as any)[k]}
        onChange={(e) => up(k, e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
      />
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl my-4">
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            {isEdit ? "Editar puesto" : "Nuevo puesto"}
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-white/40" />}
          </h3>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Identificación */}
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Identificación</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] text-white/40 uppercase tracking-wide">Nombre del puesto *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => up("nombre", e.target.value)}
                  placeholder="Ej: Garita Principal, Recepción..."
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/40 uppercase tracking-wide">Tipo de servicio</label>
                <select
                  value={form.tipo_servicio}
                  onChange={(e) => up("tipo_servicio", e.target.value)}
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                >
                  <option value="">Seleccionar...</option>
                  <option value="puesto_fijo">Puesto fijo</option>
                  <option value="ronda_movil">Ronda móvil</option>
                  <option value="escolta">Escolta</option>
                  <option value="custodia_transporte">Custodia transporte</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/40 uppercase tracking-wide">Sede</label>
                <select
                  value={form.sede_id}
                  onChange={(e) => up("sede_id", e.target.value)}
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                >
                  <option value="">Sin sede asignada</option>
                  {sedes.filter(s => s.activo).map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/40 uppercase tracking-wide">Zona operativa</label>
                <select
                  value={form.zona_operativa_id}
                  onChange={(e) => up("zona_operativa_id", e.target.value)}
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                >
                  <option value="">Sin zona asignada</option>
                  {zonas.map(z => (
                    <option key={z.id} value={z.id}>{z.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Empleado titular */}
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Empleado titular</p>
            <div className="relative">
              <input
                type="text"
                value={busquedaTitular}
                onChange={(e) => { setBusquedaTitular(e.target.value); setTitularId(null); setShowSugerencias(true); }}
                onFocus={() => setShowSugerencias(true)}
                onBlur={() => setTimeout(() => setShowSugerencias(false), 150)}
                placeholder="Buscar empleado por nombre..."
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
              />
              {titularId && (
                <button
                  type="button"
                  onClick={() => { setTitularId(null); setBusquedaTitular(""); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                  title="Quitar titular"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {showSugerencias && sugerencias.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-[#0c1829] border border-white/10 rounded-xl shadow-xl overflow-hidden">
                  {sugerencias.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onMouseDown={() => { setTitularId(emp.id); setBusquedaTitular(emp.nombre_completo); setSugerencias([]); setShowSugerencias(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/5 transition-colors"
                    >
                      {emp.nombre_completo}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {titularId && (
              <p className="text-[10px] text-emerald-400/70 mt-1 flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                Titular seleccionado — ID #{titularId}
              </p>
            )}
          </div>

          {/* Ciclo de nómina */}
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Ciclo de nómina (para planilla)</p>
            <p className="text-[10px] text-white/20 mb-2">Define el patrón de descansos compensatorios para el cálculo de planilla. El horario operativo real se gestiona en la pestaña "Plantilla de Turnos".</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-white/40 uppercase tracking-wide">Ciclo de nómina</label>
                <select
                  value={form.tipo_turno_id}
                  onChange={(e) => up("tipo_turno_id", e.target.value)}
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                >
                  <option value="">Sin ciclo asignado</option>
                  {turnosDisponibles.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} ({t.horas_trabajo}h + {t.horas_descanso}h)
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/40 uppercase tracking-wide">Fecha inicio de ciclo</label>
                <input
                  type="date"
                  value={form.fecha_inicio_ciclo}
                  onChange={(e) => up("fecha_inicio_ciclo", e.target.value)}
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                />
                <p className="text-[10px] text-white/25">Solo para ciclos &gt; 24h (24x24, 24x48…)</p>
              </div>
            </div>
          </div>

          {/* Nota horario operativo */}
          <div className="bg-primary/5 border border-primary/15 rounded-xl px-4 py-3 flex items-start gap-2">
            <Calendar className="w-3.5 h-3.5 text-primary/50 shrink-0 mt-0.5" />
            <p className="text-[11px] text-white/40 leading-relaxed">
              El horario operativo (días y horas exactas por slot) se define en la pestaña <span className="text-primary/70 font-medium">Plantilla de Turnos</span> de esta misma ficha. Los agentes heredan automáticamente el horario del puesto al que están asignados.
            </p>
          </div>

          {/* Datos contractuales */}
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Datos contractuales</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-white/40 uppercase tracking-wide">Guardias contratados</label>
                <input
                  type="number" min={1}
                  value={form.cantidad_contratada}
                  onChange={(e) => up("cantidad_contratada", Number(e.target.value))}
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                />
              </div>
              <Field label="Tarifa del puesto (Q)" k="tarifa_puesto" placeholder="0.00" />
              <Field label="Costo hora colaborador (Q)" k="costo_hora" placeholder="0.00" />
              <div className="flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  id="horas_extra"
                  checked={form.elegible_horas_extra}
                  onChange={(e) => up("elegible_horas_extra", e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <label htmlFor="horas_extra" className="text-xs text-white/60">Elegible para horas extra</label>
              </div>
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wide">Notas internas</label>
            <textarea
              value={form.notas}
              onChange={(e) => up("notas", e.target.value)}
              rows={2}
              placeholder="Observaciones del puesto..."
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 resize-none"
            />
          </div>

          {err && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{err}</p>}
        </div>

        <div className="flex gap-2 p-5 border-t border-white/8">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-sm font-bold text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Crear puesto"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Editar Cliente ────────────────────────────────────────────────────
function ModalEditarCliente({
  cliente,
  onClose,
  onSaved,
}: {
  cliente: ClienteFicha;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    nombre: cliente.nombre ?? "",
    nombreComercial: cliente.nombreComercial ?? "",
    nit: cliente.nit ?? "",
    sector: cliente.sector ?? "",
    observaciones_contractuales: cliente.observaciones_contractuales ?? "",
    fecha_inicio_contrato: cliente.fecha_inicio_contrato?.substring(0, 10) ?? "",
    tarifa_base_mensual: cliente.tarifa_base_mensual ?? "",
    estado_contrato: cliente.estado_contrato ?? "activo",
    notas: cliente.notas ?? "",
    dotacion_uniforme_num: String(cliente.dotacion_uniforme_num ?? 0),
    dotacion_uniforme_frecuencia_meses: String(cliente.dotacion_uniforme_frecuencia_meses ?? 0),
  });
  const [saving, setSaving] = useState(false);

  const up = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function submit() {
    setSaving(true);
    try {
      await fetch(`${API}/clientes/${cliente.id}/contrato`, {
        method: "PATCH",
        headers: h(),
        body: JSON.stringify({
          ...form,
          tarifa_base_mensual: form.tarifa_base_mensual ? Number(form.tarifa_base_mensual) : null,
          fecha_inicio_contrato: form.fecha_inicio_contrato || null,
          nombreComercial: form.nombreComercial || null,
          nit: form.nit || null,
          sector: form.sector || null,
        }),
      });
      // Guardar configuración de dotación uniforme (UNIF-01)
      await fetch(`${API}/uniformes/config-cliente/${cliente.id}`, {
        method: "PATCH",
        headers: h(),
        body: JSON.stringify({
          dotacion_uniforme_num: parseInt(form.dotacion_uniforme_num) || 0,
          dotacion_uniforme_frecuencia_meses: parseInt(form.dotacion_uniforme_frecuencia_meses) || 0,
        }),
      });
      onSaved();
    } catch { /* ignore */ }
    setSaving(false);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h3 className="text-sm font-bold text-white">Editar cliente</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
          {[
            { label: "Nombre legal *", k: "nombre", type: "text" },
            { label: "Nombre comercial", k: "nombreComercial", type: "text" },
            { label: "NIT", k: "nit", type: "text" },
            { label: "Sector", k: "sector", type: "text" },
            { label: "Tarifa base mensual (Q)", k: "tarifa_base_mensual", type: "number" },
            { label: "Fecha inicio de contrato", k: "fecha_inicio_contrato", type: "date" },
          ].map(({ label, k, type }) => (
            <div key={k} className="space-y-1">
              <label className="text-[10px] text-white/40 uppercase tracking-wide">{label}</label>
              <input
                type={type}
                value={(form as any)[k]}
                onChange={(e) => up(k, e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
              />
            </div>
          ))}
          {/* Dotación de uniformes */}
          <div className="pt-1 pb-0.5">
            <p className="text-[10px] text-orange-400/70 uppercase tracking-widest font-semibold">Dotación de Uniformes</p>
            <p className="text-[10px] text-white/30 mt-0.5">Uniforme pagado por el cliente (titulares). 0 = no aplica.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-white/40 uppercase tracking-wide">Uniformes por dotación</label>
              <input
                type="number" min="0" max="10"
                value={form.dotacion_uniforme_num}
                onChange={(e) => up("dotacion_uniforme_num", e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-white/40 uppercase tracking-wide">Cada (meses)</label>
              <input
                type="number" min="0" max="36"
                value={form.dotacion_uniforme_frecuencia_meses}
                onChange={(e) => up("dotacion_uniforme_frecuencia_meses", e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                placeholder="6"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wide">Estado del contrato</label>
            <select
              value={form.estado_contrato}
              onChange={(e) => up("estado_contrato", e.target.value)}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
            >
              <option value="activo">Activo</option>
              <option value="negociacion">En negociación</option>
              <option value="suspendido">Suspendido</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wide">Observaciones contractuales</label>
            <textarea
              value={form.observaciones_contractuales}
              onChange={(e) => up("observaciones_contractuales", e.target.value)}
              rows={3}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 resize-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wide">Notas internas</label>
            <textarea
              value={form.notas}
              onChange={(e) => up("notas", e.target.value)}
              rows={2}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 resize-none"
            />
          </div>
        </div>
        <div className="flex gap-2 p-5 border-t border-white/8">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">Cancelar</button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-sm font-bold text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Nueva Sede ────────────────────────────────────────────────────────
function ModalNuevaSede({ clientId, onClose, onSaved }: { clientId: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ nombre: "", direccion: "", ciudad: "", contacto: "", telefono: "" });
  const [saving, setSaving] = useState(false);
  const up = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      await fetch(`${API}/clientes/${clientId}/sedes`, {
        method: "POST", headers: h(),
        body: JSON.stringify(form),
      });
      onSaved();
    } catch { /* ignore */ }
    setSaving(false);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Nueva sede</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        {[
          { k: "nombre", label: "Nombre de la sede *", ph: "Ej: Sede Central" },
          { k: "direccion", label: "Dirección", ph: "Dirección física" },
          { k: "ciudad", label: "Ciudad / Municipio", ph: "Guatemala, Mixco..." },
          { k: "contacto", label: "Contacto", ph: "Nombre de contacto" },
          { k: "telefono", label: "Teléfono", ph: "+502..." },
        ].map(({ k, label, ph }) => (
          <div key={k} className="space-y-1">
            <label className="text-xs text-white/40">{label}</label>
            <input
              type="text"
              value={(form as any)[k]}
              onChange={(e) => up(k, e.target.value)}
              placeholder={ph}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
            />
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">Cancelar</button>
          <button
            onClick={submit}
            disabled={saving || !form.nombre.trim()}
            className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-sm font-bold text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Guardar sede
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Tipos para usuarios de cliente ──────────────────────────────────────────
interface UsuarioCliente {
  id: number;
  nombre: string;
  username: string;
  correo: string | null;
  telefono: string | null;
  rol: string;
  estado: string;
  cliente_id: string | null;
  created_at: string;
}

// ─── Modal: Nuevo usuario para el cliente ─────────────────────────────────────
function ModalNuevoUsuarioCliente({ clienteDbId, onClose, onCreated }: {
  clienteDbId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ nombre: "", username: "", correo: "", password: "", confirmPassword: "", telefono: "", estado: "activo" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usernameError, setUsernameError] = useState("");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function checkUsername(u: string) {
    if (!u.trim()) return;
    try {
      const r = await fetch(`${API}/users/check?username=${encodeURIComponent(u.trim())}`, { headers: h() });
      const data = await r.json();
      setUsernameError(data.available ? "" : "Este username ya está en uso");
    } catch { /* ignorar */ }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (usernameError) { setError(usernameError); return; }
    if (form.password !== form.confirmPassword) { setError("Las contraseñas no coinciden"); return; }
    if (form.password.length < 4) { setError("Contraseña mínimo 4 caracteres"); return; }
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${API}/clientes/${clienteDbId}/usuarios`, {
        method: "POST",
        headers: h(),
        body: JSON.stringify({ nombre: form.nombre, username: form.username.toLowerCase(), correo: form.correo || undefined, password: form.password, telefono: form.telefono || undefined, estado: form.estado }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Error al crear usuario"); }
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#07111f] z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
              <Plus className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Nuevo Usuario del Cliente</h2>
              <p className="text-[10px] text-white/40">Acceso al Portal de Clientes</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] text-white/50 font-medium">Nombre completo *</label>
            <input value={form.nombre} onChange={e => set("nombre", e.target.value)} required
              className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none focus:border-primary/50"
              placeholder="Ej: Ana García" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50 font-medium">Username *</label>
              <input value={form.username} onChange={e => { set("username", e.target.value.toLowerCase()); setUsernameError(""); }}
                onBlur={e => checkUsername(e.target.value)} required
                className={`w-full h-9 bg-[#060e1c] border text-white text-sm rounded-md px-3 outline-none ${usernameError ? "border-red-500/60" : "border-white/10 focus:border-primary/50"}`}
                placeholder="ana.garcia" />
              {usernameError && <p className="text-[10px] text-red-400">{usernameError}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50 font-medium">Estado</label>
              <select value={form.estado} onChange={e => set("estado", e.target.value)}
                className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none focus:border-primary/50">
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] text-white/50 font-medium flex items-center gap-1"><Mail className="w-3 h-3" />Correo</label>
            <input type="email" value={form.correo} onChange={e => set("correo", e.target.value)}
              className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none focus:border-primary/50"
              placeholder="correo@empresa.gt" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] text-white/50 font-medium flex items-center gap-1"><Phone className="w-3 h-3" />Teléfono</label>
            <input value={form.telefono} onChange={e => set("telefono", e.target.value)}
              className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 font-mono outline-none focus:border-primary/50"
              placeholder="50212345678" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50 font-medium flex items-center gap-1"><Lock className="w-3 h-3" />Contraseña *</label>
              <input type="password" value={form.password} onChange={e => set("password", e.target.value)} required
                className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none focus:border-primary/50"
                placeholder="Mínimo 4 car." />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50 font-medium">Confirmar *</label>
              <input type="password" value={form.confirmPassword} onChange={e => set("confirmPassword", e.target.value)} required
                className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none focus:border-primary/50"
                placeholder="Repita" />
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-9 border border-white/10 text-white/60 rounded-md text-xs hover:text-white hover:border-white/20 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 h-9 bg-primary text-[#050d1a] font-bold rounded-md text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" />Crear Usuario</>}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─── Tab: Usuarios del Cliente ────────────────────────────────────────────────
function TabUsuariosCliente({ clienteDbId }: { clienteDbId: number }) {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [resettingPw, setResettingPw] = useState<UsuarioCliente | null>(null);
  const [newPw, setNewPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const { data: usuarios = [], isLoading } = useQuery<UsuarioCliente[]>({
    queryKey: ["clientes-usuarios", clienteDbId],
    queryFn: async () => {
      const r = await fetch(`${API}/clientes/${clienteDbId}/usuarios`, { headers: h() });
      if (!r.ok) throw new Error();
      return r.json();
    },
    staleTime: 30_000,
  });

  async function toggleEstado(u: UsuarioCliente) {
    const nuevoEstado = u.estado === "activo" ? "inactivo" : "activo";
    await fetch(`${API}/users/${u.id}`, {
      method: "PATCH",
      headers: h(),
      body: JSON.stringify({ estado: nuevoEstado }),
    });
    qc.invalidateQueries({ queryKey: ["clientes-usuarios", clienteDbId] });
  }

  async function resetPassword() {
    if (!resettingPw || newPw.length < 4) return;
    setPwLoading(true);
    try {
      await fetch(`${API}/users/${resettingPw.id}`, {
        method: "PATCH",
        headers: h(),
        body: JSON.stringify({ password: newPw }),
      });
      setResettingPw(null);
      setNewPw("");
    } finally {
      setPwLoading(false);
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-5 h-5 animate-spin text-white/30" />
    </div>
  );

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-white/70">Usuarios del Portal</p>
          <p className="text-[10px] text-white/30 mt-0.5">Cuentas con acceso al portal de clientes vinculadas a este cliente</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary rounded-lg text-xs font-semibold hover:bg-primary/20 transition-colors">
          <Plus className="w-3 h-3" />Nuevo Usuario
        </button>
      </div>

      {/* Lista */}
      {usuarios.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
          <UserCog className="w-7 h-7 text-white/10 mx-auto mb-3" />
          <p className="text-white/40 text-sm font-medium">Sin usuarios registrados</p>
          <p className="text-white/20 text-xs mt-1">Crea un usuario para que este cliente acceda al portal.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {usuarios.map(u => (
            <div key={u.id} className="bg-[#070f1c] border border-white/8 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-white truncate">{u.nombre}</p>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                      u.estado === "activo"
                        ? "text-green-400 bg-green-400/10 border-green-400/20"
                        : "text-red-400 bg-red-400/10 border-red-400/20"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.estado === "activo" ? "bg-green-400" : "bg-red-400"}`} />
                      {u.estado === "activo" ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <code className="text-[11px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">@{u.username}</code>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {u.correo && (
                      <span className="flex items-center gap-1 text-[10px] text-white/40">
                        <Mail className="w-3 h-3" />{u.correo}
                      </span>
                    )}
                    {u.telefono && (
                      <span className="flex items-center gap-1 text-[10px] text-white/40">
                        <Phone className="w-3 h-3" />{u.telefono}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => { setResettingPw(u); setNewPw(""); }}
                    title="Cambiar contraseña"
                    className="p-1.5 rounded-lg text-white/30 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors border border-white/8 hover:border-yellow-400/20"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleEstado(u)}
                    title={u.estado === "activo" ? "Desactivar" : "Activar"}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      u.estado === "activo"
                        ? "text-white/30 hover:text-red-400 border-white/8 hover:bg-red-400/10 hover:border-red-400/20"
                        : "text-white/30 hover:text-green-400 border-white/8 hover:bg-green-400/10 hover:border-green-400/20"
                    }`}
                  >
                    {u.estado === "activo" ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Regla de negocio */}
      <div className="bg-blue-950/20 border border-blue-500/15 rounded-xl px-4 py-3 flex items-start gap-2">
        <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-blue-300/70 leading-relaxed">
          Los usuarios creados aquí tienen rol <strong>cliente</strong> y acceso únicamente al portal de clientes.
          Quedan ligados automáticamente al ID de portal de este cliente.
        </p>
      </div>

      {/* Modal nueva contraseña */}
      {resettingPw && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-xs p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">Cambiar contraseña</p>
              <button onClick={() => setResettingPw(null)} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[11px] text-white/40">Nueva contraseña para <strong className="text-white/70">{resettingPw.nombre}</strong></p>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="Mínimo 4 caracteres"
                className="flex-1 h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none focus:border-primary/50"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setResettingPw(null)} className="flex-1 h-9 border border-white/10 text-white/60 rounded-md text-xs hover:text-white">Cancelar</button>
              <button onClick={resetPassword} disabled={pwLoading || newPw.length < 4}
                className="flex-1 h-9 bg-yellow-500 text-black font-bold rounded-md text-xs hover:bg-yellow-400 disabled:opacity-40 flex items-center justify-center gap-1">
                {pwLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><KeyRound className="w-3.5 h-3.5" />Cambiar</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal crear usuario */}
      {showModal && (
        <ModalNuevoUsuarioCliente
          clienteDbId={clienteDbId}
          onClose={() => setShowModal(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["clientes-usuarios", clienteDbId] });
          }}
        />
      )}
    </div>
  );
}

// ─── Departamentos de Guatemala ──────────────────────────────────────────────
const DEPTOS_GT = [
  { cod: 1, nombre: "Guatemala" }, { cod: 2, nombre: "El Progreso" },
  { cod: 3, nombre: "Sacatepéquez" }, { cod: 4, nombre: "Chimaltenango" },
  { cod: 5, nombre: "Escuintla" }, { cod: 6, nombre: "Santa Rosa" },
  { cod: 7, nombre: "Sololá" }, { cod: 8, nombre: "Totonicapán" },
  { cod: 9, nombre: "Quetzaltenango" }, { cod: 10, nombre: "Suchitepéquez" },
  { cod: 11, nombre: "Retalhuleu" }, { cod: 12, nombre: "San Marcos" },
  { cod: 13, nombre: "Huehuetenango" }, { cod: 14, nombre: "El Quiché" },
  { cod: 15, nombre: "Baja Verapaz" }, { cod: 16, nombre: "Alta Verapaz" },
  { cod: 17, nombre: "El Petén" }, { cod: 18, nombre: "Izabal" },
  { cod: 19, nombre: "Zacapa" }, { cod: 20, nombre: "Chiquimula" },
  { cod: 21, nombre: "Jalapa" }, { cod: 22, nombre: "Jutiapa" },
];

// ─── Tab IGSS Centro de Trabajo ───────────────────────────────────────────────
function TabIGSSCentro({ cliente, onSaved }: { cliente: ClienteFicha; onSaved: () => void }) {
  const [form, setForm] = useState({
    igss_aplica: cliente.igss_aplica ?? false,
    igss_codigo_centro: cliente.igss_codigo_centro ?? "",
    igss_direccion: cliente.igss_direccion ?? "",
    igss_zona: cliente.igss_zona ?? "",
    igss_departamento: cliente.igss_departamento?.toString() ?? "",
    igss_municipio: cliente.igss_municipio?.toString() ?? "",
    igss_codigo_actividad: cliente.igss_codigo_actividad ?? "",
    igss_contacto: cliente.igss_contacto ?? "",
    igss_fax: cliente.igss_fax ?? "",
    igss_email: cliente.igss_email ?? "",
    igss_telefono: cliente.igss_telefono ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const up = (k: string, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setError(""); setSaved(false);
    try {
      const r = await fetch(`${API}/igss/clientes/${cliente.id}/centro`, {
        method: "PATCH",
        headers: h(),
        body: JSON.stringify({
          ...form,
          igss_departamento: form.igss_departamento ? Number(form.igss_departamento) : null,
          igss_municipio: form.igss_municipio ? Number(form.igss_municipio) : null,
          igss_codigo_centro: form.igss_codigo_centro || null,
          igss_direccion: form.igss_direccion || null,
          igss_zona: form.igss_zona || null,
          igss_codigo_actividad: form.igss_codigo_actividad || null,
          igss_contacto: form.igss_contacto || null,
          igss_fax: form.igss_fax || null,
          igss_email: form.igss_email || null,
          igss_telefono: form.igss_telefono || null,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Error al guardar");
      setSaved(true);
      onSaved();
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
    <div className="p-6 space-y-6">
      {/* Toggle principal */}
      <div className="flex items-center justify-between bg-white/3 border border-white/8 rounded-xl px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">Registrar como Centro de Trabajo IGSS</p>
          <p className="text-[11px] text-white/35 mt-0.5">
            Al activar, este cliente aparecerá en el módulo IGSS como un centro de trabajo en el archivo de planilla.
          </p>
        </div>
        <button
          onClick={() => up("igss_aplica", !form.igss_aplica)}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
            form.igss_aplica
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              : "bg-white/5 border-white/15 text-white/40 hover:text-white/60"
          }`}
        >
          {form.igss_aplica
            ? <><ToggleRight className="w-4 h-4" /> Activo</>
            : <><ToggleLeft className="w-4 h-4" /> Inactivo</>}
        </button>
      </div>

      {form.igss_aplica && (
        <div className="space-y-5">
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold border-b border-white/5 pb-2">
            Datos del Centro de Trabajo — se usan en el archivo TXT del IGSS
          </p>

          {/* Fila 1: código + actividad económica */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Código del Centro *</label>
              <input
                value={form.igss_codigo_centro}
                onChange={(e) => up("igss_codigo_centro", e.target.value)}
                placeholder="1"
                className={inp}
              />
              <p className="text-[9px] text-white/25 mt-1">Número secuencial asignado por el patrono (1, 2, 3…)</p>
            </div>
            <div>
              <label className={lbl}>Código Actividad Económica</label>
              <input
                value={form.igss_codigo_actividad}
                onChange={(e) => up("igss_codigo_actividad", e.target.value)}
                placeholder="803011"
                className={inp}
              />
              <p className="text-[9px] text-white/25 mt-1">Ej: 803011 (vigilancia y seguridad)</p>
            </div>
          </div>

          {/* Fila 2: dirección + zona */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className={lbl}>Dirección física del centro</label>
              <input
                value={form.igss_direccion}
                onChange={(e) => up("igss_direccion", e.target.value)}
                placeholder="9ª Av. 11-65 Zona 1"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Zona</label>
              <input
                value={form.igss_zona}
                onChange={(e) => up("igss_zona", e.target.value)}
                placeholder="1"
                className={inp}
              />
            </div>
          </div>

          {/* Fila 3: departamento + municipio */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Departamento</label>
              <select
                value={form.igss_departamento}
                onChange={(e) => up("igss_departamento", e.target.value)}
                className={inp}
              >
                <option value="">Seleccionar departamento…</option>
                {DEPTOS_GT.map((d) => (
                  <option key={d.cod} value={d.cod}>{d.cod} — {d.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Código de Municipio</label>
              <input
                type="number"
                min={1}
                value={form.igss_municipio}
                onChange={(e) => up("igss_municipio", e.target.value)}
                placeholder="1"
                className={inp}
              />
              <p className="text-[9px] text-white/25 mt-1">Código IGSS del municipio dentro del departamento</p>
            </div>
          </div>

          {/* Fila 4: contacto + teléfono + fax */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Persona de contacto</label>
              <input
                value={form.igss_contacto}
                onChange={(e) => up("igss_contacto", e.target.value)}
                placeholder="Nombre del encargado"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Teléfono IGSS</label>
              <input
                value={form.igss_telefono}
                onChange={(e) => up("igss_telefono", e.target.value)}
                placeholder="2234-5678"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Fax</label>
              <input
                value={form.igss_fax}
                onChange={(e) => up("igss_fax", e.target.value)}
                placeholder="2234-5679"
                className={inp}
              />
            </div>
          </div>

          {/* Fila 5: email */}
          <div>
            <label className={lbl}>Correo electrónico IGSS</label>
            <input
              type="email"
              value={form.igss_email}
              onChange={(e) => up("igss_email", e.target.value)}
              placeholder="administracion@empresa.gt"
              className={`${inp} max-w-sm`}
            />
          </div>
        </div>
      )}

      {/* Alerta info */}
      {!form.igss_aplica && (
        <div className="bg-white/3 border border-white/8 rounded-xl p-4 flex items-start gap-3">
          <Landmark className="w-4 h-4 text-white/20 shrink-0 mt-0.5" />
          <div className="text-xs text-white/30 leading-relaxed">
            Este cliente no está configurado como Centro de Trabajo del IGSS. Activa la opción arriba para registrar los datos que aparecerán en la planilla mensual.
          </div>
        </div>
      )}

      {/* Guardar */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-black text-xs font-bold transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Guardar configuración IGSS
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle className="w-3.5 h-3.5" /> Guardado
          </span>
        )}
        {error && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />{error}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
type Tab = "general" | "estructura" | "cobertura" | "titulares" | "turnos" | "usuarios" | "igss";

export default function FichaCliente() {
  const [, params] = useRoute("/admin/clientes/:id");
  const [, navigate] = useLocation();
  const clientId = Number(params?.id);

  const [data, setData] = useState<FichaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("general");
  const [expandedSede, setExpandedSede] = useState<number | null>(null);

  const [modalEditar, setModalEditar] = useState(false);
  const [modalNuevaSede, setModalNuevaSede] = useState(false);
  const [modalPuesto, setModalPuesto] = useState<Puesto | null | "nuevo">(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/clientes/${clientId}/ficha`, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setData(null);
    }
    setLoading(false);
  }

  useEffect(() => { if (clientId) load(); }, [clientId]);

  async function desactivarPuesto(puestoId: number) {
    if (!confirm("¿Desactivar este puesto? El pizarrón ya no lo mostrará.")) return;
    await fetch(`${API}/puestos/${puestoId}`, { method: "DELETE", headers: { "x-isp-session": getSession() } });
    load();
  }

  async function desactivarSede(sedeId: number) {
    if (!confirm("¿Desactivar esta sede?")) return;
    await fetch(`${API}/sedes/${sedeId}`, { method: "DELETE", headers: { "x-isp-session": getSession() } });
    load();
  }

  if (loading) return (
    <AdminLayout title="Ficha de Cliente">
      <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
    </AdminLayout>
  );

  if (!data) return (
    <AdminLayout title="Ficha de Cliente">
      <div className="text-center py-20">
        <AlertTriangle className="w-8 h-8 text-red-400/40 mx-auto mb-3" />
        <p className="text-white/40">Cliente no encontrado</p>
        <button onClick={() => navigate("/admin/clientes")} className="mt-4 text-xs text-primary hover:text-primary/80 flex items-center gap-1 mx-auto">
          <ChevronLeft className="w-3 h-3" /> Volver a clientes
        </button>
      </div>
    </AdminLayout>
  );

  const { cliente, sedes, puestos, coberturaHoy } = data;
  const nombreMostrar = cliente.nombreComercial || cliente.nombre;
  const puestosActivosTotal = puestos.length;
  const guardiasTotales = puestos.reduce((s, p) => s + (p.cantidad_contratada || 1), 0);
  const puestosConTitular = puestos.filter(p => p.titular_employee_id).length;
  const tarifaTotal = puestos.reduce((s, p) => s + Number(p.tarifa_puesto || 0), 0);

  return (
    <AdminLayout title={`Ficha — ${nombreMostrar}`}>
      <div className="space-y-4 max-w-5xl mx-auto">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <button
              onClick={() => navigate("/admin/clientes")}
              className="mt-1 p-1.5 rounded-lg bg-white/4 hover:bg-white/8 border border-white/8 text-white/40 hover:text-white transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">{nombreMostrar}</h1>
              {cliente.nombreComercial && <p className="text-xs text-white/40 mt-0.5">{cliente.nombre}</p>}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {cliente.sector && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/6 border border-white/10 text-white/40">{cliente.sector}</span>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${estadoContratoColor(cliente.estado_contrato)}`}>
                  Contrato: {cliente.estado_contrato ?? "activo"}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cliente.estado === "activo" ? "text-green-400 bg-green-400/10 border-green-400/20" : "text-white/30 bg-white/4 border-white/10"}`}>
                  {cliente.estado}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 rounded-lg bg-white/3 hover:bg-white/6 border border-white/8 text-white/40 hover:text-white transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setModalEditar(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/8 border border-white/10 text-xs text-white/70 hover:text-white transition-all"
            >
              <Edit3 className="w-3 h-3" /> Editar cliente
            </button>
          </div>
        </div>

        {/* ── Stats rápidas ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Sedes activas", value: sedes.filter(s => s.activo).length, icon: MapPin, color: "text-blue-400" },
            { label: "Puestos activos", value: puestosActivosTotal, icon: Shield, color: "text-primary" },
            { label: "Guardias contratados", value: guardiasTotales, icon: Users, color: "text-purple-400" },
            { label: "Puestos con titular", value: `${puestosConTitular}/${puestosActivosTotal}`, icon: UserCheck, color: "text-green-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-[#0c1829] border border-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-3.5 h-3.5 ${color}`} />
                <p className="text-[10px] text-white/30 uppercase tracking-wide">{label}</p>
              </div>
              <p className="text-xl font-bold text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────────── */}
        <div className="bg-[#0c1829] border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 flex items-center gap-1 flex-wrap">
            {([
              { id: "general", label: "General + Contrato", icon: FileText },
              { id: "estructura", label: "Sedes y Estructura", icon: LayoutGrid },
              { id: "cobertura", label: "Cobertura Hoy", icon: Activity },
              { id: "titulares", label: "Titulares", icon: UserCheck },
              { id: "turnos", label: "Plantilla de Turnos", icon: Calendar },
              { id: "usuarios", label: "Usuarios del Cliente", icon: UserCog },
              { id: "igss", label: "Centro IGSS", icon: Landmark },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${tab === id ? "bg-primary/15 text-primary border border-primary/30" : "text-white/40 hover:text-white/70 hover:bg-white/3"}`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab General + Contrato ─────────────────────────────────────── */}
          {tab === "general" && (
            <div className="p-6 space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                {/* Datos generales */}
                <div className="space-y-3">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">Datos generales</p>
                  {[
                    { label: "Nombre legal", value: cliente.nombre },
                    { label: "Nombre comercial", value: cliente.nombreComercial },
                    { label: "NIT", value: cliente.nit },
                    { label: "Sector", value: cliente.sector },
                    { label: "Estado operativo", value: cliente.estado },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between gap-2 border-b border-white/4 pb-2">
                      <p className="text-xs text-white/35">{label}</p>
                      <p className="text-xs text-white/80 font-medium text-right max-w-[60%]">{value || "—"}</p>
                    </div>
                  ))}
                </div>

                {/* Datos contractuales */}
                <div className="space-y-3">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">Datos contractuales</p>
                  {[
                    { label: "Estado del contrato", value: cliente.estado_contrato ?? "activo" },
                    { label: "Inicio de contrato", value: cliente.fecha_inicio_contrato ? new Date(cliente.fecha_inicio_contrato).toLocaleDateString("es-GT") : null },
                    { label: "Tarifa base mensual", value: cliente.tarifa_base_mensual ? fmtQ(cliente.tarifa_base_mensual) : null },
                    { label: "Tarifa total puestos", value: tarifaTotal > 0 ? fmtQ(tarifaTotal) : null },
                    {
                      label: "Dotación de uniformes",
                      value: (cliente.dotacion_uniforme_num ?? 0) > 0
                        ? `${cliente.dotacion_uniforme_num} uniforme(s) c/${cliente.dotacion_uniforme_frecuencia_meses} meses`
                        : "No aplica (agente asume costo)",
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between gap-2 border-b border-white/4 pb-2">
                      <p className="text-xs text-white/35">{label}</p>
                      <p className="text-xs text-white/80 font-medium text-right">{value || "—"}</p>
                    </div>
                  ))}
                  {cliente.observaciones_contractuales && (
                    <div className="mt-2">
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Observaciones contractuales</p>
                      <p className="text-xs text-white/50 bg-white/3 rounded-lg p-3 leading-relaxed">{cliente.observaciones_contractuales}</p>
                    </div>
                  )}
                  {cliente.notas && (
                    <div className="mt-2">
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1.5">Notas internas</p>
                      <p className="text-xs text-white/50 bg-white/3 rounded-lg p-3 leading-relaxed">{cliente.notas}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Resumen operativo */}
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3 font-semibold">Estructura contratada — resumen</p>
                <div className="grid sm:grid-cols-3 gap-3">
                  {sedes.filter(s => s.activo).map(sede => (
                    <div key={sede.id} className="bg-[#070f1c] border border-white/8 rounded-xl p-3">
                      <p className="text-xs font-semibold text-white mb-1">{sede.nombre}</p>
                      {sede.ciudad && <p className="text-[10px] text-white/30 mb-2">{sede.ciudad}</p>}
                      <div className="flex gap-3 text-[10px] text-white/40">
                        <span>{sede.total_puestos} puesto{sede.total_puestos !== 1 ? "s" : ""}</span>
                        <span className={sede.puestos_cubiertos === sede.total_puestos && sede.total_puestos > 0 ? "text-green-400" : "text-amber-400"}>
                          {sede.puestos_cubiertos}/{sede.total_puestos} cubiertos
                        </span>
                      </div>
                    </div>
                  ))}
                  {sedes.filter(s => s.activo).length === 0 && (
                    <div className="col-span-3 text-xs text-white/25 text-center py-4 italic">Sin sedes registradas</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Tab Sedes y Estructura ─────────────────────────────────────── */}
          {tab === "estructura" && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/30">Estructura base del servicio contratado — sedes y puestos operativos</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setModalNuevaSede(true)}
                    className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 text-white/60 hover:text-white transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Nueva sede
                  </button>
                  <button
                    onClick={() => setModalPuesto("nuevo")}
                    className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Nuevo puesto
                  </button>
                </div>
              </div>

              {/* Puestos sin sede */}
              {puestos.filter(p => !p.sede_id).length > 0 && (
                <div className="border border-white/8 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-white/3 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-white/30" />
                    <p className="text-xs text-white/50 font-semibold">Sin sede asignada</p>
                    <span className="text-[10px] text-white/25">{puestos.filter(p => !p.sede_id).length} puestos</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {puestos.filter(p => !p.sede_id).map(puesto => (
                      <PuestoRow key={puesto.id} puesto={puesto} onEdit={() => setModalPuesto(puesto)} onDelete={() => desactivarPuesto(puesto.id)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Sedes con sus puestos */}
              {sedes.filter(s => s.activo).map(sede => {
                const misPuestos = puestos.filter(p => p.sede_id === sede.id);
                const isOpen = expandedSede === sede.id;
                return (
                  <div key={sede.id} className="border border-white/8 rounded-xl overflow-hidden">
                    <div
                      className="px-4 py-3 bg-white/3 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => setExpandedSede(isOpen ? null : sede.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-white/30 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-white/30 shrink-0" />}
                        <MapPin className="w-3.5 h-3.5 text-primary/50 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">{sede.nombre}</p>
                          {(sede.ciudad || sede.direccion) && (
                            <p className="text-[10px] text-white/30">{[sede.ciudad, sede.direccion].filter(Boolean).join(" — ")}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className={`text-[9px] px-2 py-0.5 rounded-full font-semibold border ${
                          sede.puestos_cubiertos === sede.total_puestos && sede.total_puestos > 0
                            ? "text-green-400 bg-green-500/10 border-green-500/20"
                            : sede.total_puestos > 0
                              ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                              : "text-white/25 bg-white/5 border-white/8"
                        }`}>
                          {sede.puestos_cubiertos}/{sede.total_puestos} cubiertos
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); desactivarSede(sede.id); }}
                          className="text-red-400/30 hover:text-red-400 transition-colors p-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <div>
                        {misPuestos.length === 0 ? (
                          <div className="px-5 py-6 text-center text-xs text-white/25 italic">
                            Sin puestos en esta sede —{" "}
                            <button
                              onClick={() => setModalPuesto("nuevo")}
                              className="text-primary hover:text-primary/80 underline"
                            >crear uno</button>
                          </div>
                        ) : (
                          <div className="divide-y divide-white/5">
                            {misPuestos.map(puesto => (
                              <PuestoRow key={puesto.id} puesto={puesto} onEdit={() => setModalPuesto(puesto)} onDelete={() => desactivarPuesto(puesto.id)} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {sedes.filter(s => s.activo).length === 0 && puestos.length === 0 && (
                <div className="text-center py-12">
                  <Building2 className="w-8 h-8 text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">Sin sedes ni puestos registrados</p>
                  <p className="text-white/15 text-xs mt-1">Crea una sede y luego agrega puestos operativos.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Tab Cobertura Hoy ─────────────────────────────────────────── */}
          {tab === "cobertura" && (
            <div className="p-5 space-y-4">
              {/* Resumen del día */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Cubiertos", value: coberturaHoy.resumen.cubiertos, color: "text-green-400", bg: "bg-green-500/8 border-green-500/20" },
                  { label: "Titular cubriendo", value: coberturaHoy.resumen.conTitular, color: "text-blue-400", bg: "bg-blue-500/8 border-blue-500/20" },
                  { label: "Con relevo", value: coberturaHoy.resumen.conRelevo, color: "text-amber-400", bg: "bg-amber-500/8 border-amber-500/20" },
                  { label: "Descubiertos", value: coberturaHoy.resumen.descubiertos, color: "text-red-400", bg: "bg-red-500/8 border-red-500/20" },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`border rounded-xl p-3 ${bg}`}>
                    <p className="text-[10px] text-white/35 uppercase tracking-wide mb-1">{label}</p>
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Puestos */}
              <div className="space-y-2">
                {coberturaHoy.puestos.map(p => (
                  <div key={p.puesto_id} className={`border rounded-xl p-3 ${coberturaColor(p.tipo_cobertura)}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-white">{p.puesto_nombre}</p>
                          {p.sede_nombre && <span className="text-[10px] text-white/30">· {p.sede_nombre}</span>}
                        </div>
                        <p className="text-[10px] text-white/40">
                          {[p.turno, p.hora_entrada && p.hora_salida ? `${p.hora_entrada}–${p.hora_salida}` : p.horario].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold shrink-0 ${coberturaBadge(p.tipo_cobertura)}`}>
                        {coberturaTxt(p.tipo_cobertura)}
                      </span>
                    </div>
                    {p.tipo_cobertura !== "descubierto" && (
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-white/50">
                        <UserCheck className="w-3 h-3" />
                        <span className="font-medium">{p.agente_nombre}</span>
                        {p.tipo_cobertura === "relevo" && p.titular_nombre && (
                          <span className="text-white/30">(titular: {p.titular_nombre})</span>
                        )}
                      </div>
                    )}
                    {p.tipo_cobertura === "descubierto" && p.titular_nombre && (
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-white/35">
                        <Users className="w-3 h-3" />
                        <span>Titular asignado: {p.titular_nombre} — ausente hoy</span>
                      </div>
                    )}
                    {p.tipo_cobertura === "descubierto" && !p.titular_nombre && (
                      <p className="mt-2 text-[11px] text-red-400/60">Sin titular asignado — puesto pendiente de cobertura</p>
                    )}
                  </div>
                ))}
                {coberturaHoy.puestos.length === 0 && (
                  <div className="text-center py-10">
                    <Activity className="w-7 h-7 text-white/10 mx-auto mb-3" />
                    <p className="text-white/30 text-sm">Sin puestos operativos registrados</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tab Plantilla de Turnos ───────────────────────────────────── */}
          {tab === "turnos" && (
            <TabPlantillaTurnos clienteId={clientId} puestos={puestos} />
          )}

          {/* ── Tab Usuarios del Cliente ──────────────────────────────────── */}
          {tab === "usuarios" && (
            <TabUsuariosCliente clienteDbId={clientId} />
          )}

          {/* ── Tab Titulares ─────────────────────────────────────────────── */}
          {tab === "titulares" && (
            <TabTitulares puestos={puestos} clienteId={clientId} />
          )}

          {/* ── Tab IGSS ──────────────────────────────────────────────────── */}
          {tab === "igss" && (
            <TabIGSSCentro cliente={cliente} onSaved={load} />
          )}
        </div>

        {/* Modales */}
        {modalEditar && (
          <ModalEditarCliente
            cliente={cliente}
            onClose={() => setModalEditar(false)}
            onSaved={() => { setModalEditar(false); load(); }}
          />
        )}
        {modalNuevaSede && (
          <ModalNuevaSede
            clientId={clientId}
            onClose={() => setModalNuevaSede(false)}
            onSaved={() => { setModalNuevaSede(false); load(); }}
          />
        )}
        {modalPuesto !== null && (
          <ModalPuesto
            clientId={clientId}
            sedes={sedes}
            puesto={modalPuesto === "nuevo" ? null : modalPuesto}
            onClose={() => setModalPuesto(null)}
            onSaved={() => { setModalPuesto(null); load(); }}
          />
        )}
      </div>
    </AdminLayout>
  );
}

// ─── PuestoRow: fila de puesto en la tab de estructura ───────────────────────
interface PuestoTitularHistorico {
  id: number;
  employee_id: number;
  empleado_nombre: string;
  numero_empleado?: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  motivo?: string;
  creado_por?: string;
}

function fmtFechaCorta(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function HistorialTitularPuesto({ puestoId }: { puestoId: number }) {
  const [rows, setRows] = useState<PuestoTitularHistorico[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (loaded) return;
    setLoaded(true);
    fetch(`${API}/operaciones/puestos/${puestoId}/titular-historico`, { headers: h() })
      .then(r => r.ok ? r.json() : [])
      .then(setRows)
      .catch(() => {});
  }, [puestoId, loaded]);

  const activo = rows.find(r => !r.fecha_fin);
  const anteriores = rows.filter(r => r.fecha_fin);
  const visibles = showAll ? anteriores : anteriores.slice(0, 3);

  return (
    <div className="col-span-2 sm:col-span-4 border-t border-white/6 pt-2 mt-1">
      <div className="flex items-center gap-1.5 mb-2">
        <History className="w-3 h-3 text-white/20" />
        <p className="text-[9px] text-white/25 uppercase tracking-wide">Historial de titularidad</p>
      </div>
      {rows.length === 0 && (
        <p className="text-[10px] text-white/25">Sin historial registrado</p>
      )}
      {activo && (
        <div className="flex items-start gap-2 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1 shrink-0" />
          <div>
            <p className="text-[11px] text-green-300/80 font-medium">{activo.empleado_nombre}</p>
            <p className="text-[10px] text-white/30">Titular desde {fmtFechaCorta(activo.fecha_inicio)}{activo.motivo ? ` · ${activo.motivo.replace(/_/g, " ")}` : ""}</p>
          </div>
        </div>
      )}
      {visibles.map(r => (
        <div key={r.id} className="flex items-start gap-2 mb-1 opacity-60">
          <div className="w-1.5 h-1.5 rounded-full bg-white/20 mt-1 shrink-0" />
          <div>
            <p className="text-[10px] text-white/50">{r.empleado_nombre}</p>
            <p className="text-[9px] text-white/25">{fmtFechaCorta(r.fecha_inicio)} → {fmtFechaCorta(r.fecha_fin)}{r.motivo ? ` · ${r.motivo.replace(/_/g, " ")}` : ""}</p>
          </div>
        </div>
      ))}
      {anteriores.length > 3 && !showAll && (
        <button onClick={() => setShowAll(true)} className="text-[9px] text-white/25 hover:text-white/50 transition-colors">
          +{anteriores.length - 3} anteriores…
        </button>
      )}
    </div>
  );
}

function PuestoRow({ puesto, onEdit, onDelete }: { puesto: Puesto; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const tieneCobertura = puesto.agente_id !== null;
  const esRelevo = tieneCobertura && puesto.agente_id !== puesto.titular_employee_id;

  return (
    <div>
      <div
        className="px-4 py-3 flex items-center gap-3 hover:bg-white/2 transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${tieneCobertura ? (esRelevo ? "bg-amber-400" : "bg-green-400") : (puesto.titular_employee_id ? "bg-red-400" : "bg-white/20")}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-semibold text-white">{puesto.nombre}</p>
            {puesto.tipo_servicio && (
              <span className="text-[9px] text-white/30 bg-white/4 px-1.5 py-0.5 rounded-full">{puesto.tipo_servicio.replace("_", " ")}</span>
            )}
            {puesto.cantidad_contratada > 1 && (
              <span className="text-[9px] text-purple-300/60 bg-purple-500/8 px-1.5 py-0.5 rounded-full">{puesto.cantidad_contratada} guardias</span>
            )}
            {puesto.zona_nombre && (
              <span className="text-[9px] text-primary/60 bg-primary/8 border border-primary/15 px-1.5 py-0.5 rounded-full">
                {puesto.zona_nombre}
              </span>
            )}
          </div>
          <p className="text-[10px] text-white/30 mt-0.5">
            {puesto.tipo_turno_nombre ? `Nómina: ${puesto.tipo_turno_nombre}` : "Sin ciclo de nómina"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {puesto.tarifa_puesto && (
            <span className="text-[10px] text-primary/60">{fmtQ(puesto.tarifa_puesto)}</span>
          )}
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1 text-white/25 hover:text-white/70 transition-colors">
            <Edit3 className="w-3 h-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 text-red-400/30 hover:text-red-400 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white/1.5 border-t border-white/4">
          {[
            { label: "Cubre hoy", value: puesto.agente_nombre },
            { label: "Ciclo de nómina", value: puesto.tipo_turno_nombre ?? null },
            { label: "Costo/hora", value: puesto.costo_hora ? fmtQ(puesto.costo_hora) : null },
            { label: "HE elegible", value: puesto.elegible_horas_extra ? "Sí" : "No" },
            { label: "Estado", value: puesto.estado },
          ].map(({ label, value }) => (
            <div key={label} className="py-2">
              <p className="text-[9px] text-white/25 uppercase tracking-wide">{label}</p>
              <p className="text-[11px] text-white/60 mt-0.5">{value || "—"}</p>
            </div>
          ))}
          {puesto.notas && (
            <div className="col-span-2 sm:col-span-4 py-1">
              <p className="text-[9px] text-white/25 uppercase tracking-wide">Notas</p>
              <p className="text-[11px] text-white/50 mt-0.5">{puesto.notas}</p>
            </div>
          )}
          {/* Historial de titularidad por puesto */}
          <HistorialTitularPuesto puestoId={puesto.id} />
        </div>
      )}
    </div>
  );
}

// ─── TabTitulares ──────────────────────────────────────────────────────────────
function TabTitulares({ puestos, clienteId }: { puestos: Puesto[]; clienteId: number }) {
  const [slots, setSlots] = useState<PuestoSlot[]>([]);

  useEffect(() => {
    fetch(`${API}/clientes/${clienteId}/slots`, { headers: { "x-isp-session": getSession() } })
      .then(r => r.ok ? r.json() : { slots: [] })
      .then(d => setSlots(d.slots || []))
      .catch(() => {});
  }, [clienteId]);

  const slotsPorPuesto = (puestoId: number) => slots.filter(s => s.puesto_id === puestoId);
  const puestosConTitular = puestos.filter(p => p.titular_employee_id);

  if (puestosConTitular.length === 0) {
    return (
      <div className="p-5 text-center py-12">
        <UserCheck className="w-7 h-7 text-white/10 mx-auto mb-3" />
        <p className="text-white/30 text-sm">Sin colaboradores titulares asignados</p>
        <p className="text-white/15 text-xs mt-1">Asigna titulares desde el pizarrón operativo.</p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-3">
      {puestosConTitular.map(p => {
        const pSlots = slotsPorPuesto(p.id);
        return (
          <div key={p.id} className="bg-[#070f1c] border border-white/8 rounded-xl p-4">
            {/* Cabecera: agente titular */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <p className="text-sm font-semibold text-white">{p.titular_nombre_completo || p.titular_nombre}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {p.titular_estado_laboral && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${p.titular_estado_laboral === "activo" ? "text-green-400 bg-green-400/10" : "text-white/30 bg-white/5"}`}>
                      {p.titular_estado_laboral}
                    </span>
                  )}
                  {p.titular_telefono && (
                    <span className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full">{p.titular_telefono}</span>
                  )}
                  {p.elegible_horas_extra && (
                    <span className="text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-400/20 px-2 py-0.5 rounded-full">
                      <Zap className="w-2.5 h-2.5 inline-block mr-0.5" />HE elegible
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-white/70">{p.nombre}</p>
                {p.sede_nombre && <p className="text-[10px] text-white/30 mt-0.5">Sede: {p.sede_nombre}</p>}
                {p.tipo_turno_nombre && (
                  <p className="text-[9px] text-white/20 mt-0.5">Nómina: {p.tipo_turno_nombre}</p>
                )}
              </div>
            </div>

            {/* Plantilla de turnos del puesto (heredada) */}
            <div className="border-t border-white/5 pt-3">
              <p className="text-[9px] text-white/25 uppercase tracking-widest mb-2">Plantilla de turnos del puesto (heredada por el agente)</p>
              {pSlots.length === 0 ? (
                <p className="text-[11px] text-white/20 italic">Sin slots definidos — configura en la pestaña "Plantilla de Turnos"</p>
              ) : (
                <div className="space-y-2.5">
                  {pSlots.map(slot => {
                    return (
                      <div key={slot.id} className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] text-white/30">#{slot.slot_numero}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${slot.horas_turno === 24 ? "bg-blue-500/15 text-blue-300 border border-blue-400/20" : "bg-purple-500/15 text-purple-300 border border-purple-400/20"}`}>
                            {slot.horas_turno}h
                          </span>
                          <span className="text-[10px] text-white/40">{slot.hora_entrada}</span>
                          {slot.fecha_inicio_ciclo && (
                            <span className="text-[9px] text-white/20">inicio: {slot.fecha_inicio_ciclo}</span>
                          )}
                          {slot.empleado_nombre && (
                            <span className="text-[9px] text-emerald-400/60 bg-emerald-400/8 px-2 py-0.5 rounded-full">{slot.empleado_nombre}</span>
                          )}
                        </div>
                        {/* Mini cuadrícula 14 días — 2 filas de 7 */}
                        <div className="space-y-0.5">
                          {[SEMANA1, SEMANA2].map((semana, si) => (
                            <div key={si} className="flex gap-0.5">
                              <span className="text-[8px] text-white/20 w-4 flex items-center">S{si + 1}</span>
                              {semana.map(({ n, label }) => {
                                const trabaja = slot.dias_trabajo.includes(n);
                                return (
                                  <span
                                    key={n}
                                    title={trabaja ? `${label} trabaja` : `${label} descansa`}
                                    className={`w-5 h-5 flex items-center justify-center rounded text-[8px] font-bold ${trabaja ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/3 text-white/10 border border-white/6"}`}
                                  >
                                    {trabaja ? label : "·"}
                                  </span>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── ModalCrearSlot ────────────────────────────────────────────────────────────
function ModalCrearSlot({
  puestos,
  defaultPuestoId,
  onClose,
  onSaved,
}: {
  puestos: Puesto[];
  defaultPuestoId?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [puestoId, setPuestoId] = useState<number>(defaultPuestoId || puestos[0]?.id || 0);
  const [horasTurno, setHorasTurno] = useState<12 | 24>(24);
  const [horaEntrada, setHoraEntrada] = useState("07:00");
  const [diasTrabajo, setDiasTrabajo] = useState<number[]>([]);
  const [fechaInicioCiclo, setFechaInicioCiclo] = useState<string>(() => {
    const hoy = new Date();
    return hoy.toISOString().split("T")[0];
  });
  const [empleadoBusqueda, setEmpleadoBusqueda] = useState("");
  const [empleadoId, setEmpleadoId] = useState<number | null>(null);
  const [empleadoResultados, setEmpleadoResultados] = useState<any[]>([]);
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const toggleDia = (d: number) =>
    setDiasTrabajo(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b)
    );

  useEffect(() => {
    if (empleadoBusqueda.length < 2) { setEmpleadoResultados([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/employees?q=${encodeURIComponent(empleadoBusqueda)}&limit=8`, { headers: h() });
        const data = await r.json();
        setEmpleadoResultados(Array.isArray(data) ? data : (data.employees || []));
      } catch { setEmpleadoResultados([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [empleadoBusqueda]);

  async function save() {
    if (!puestoId) { setErr("Selecciona un puesto"); return; }
    if (diasTrabajo.length === 0) { setErr("Marca al menos un día de trabajo"); return; }
    setSaving(true); setErr("");
    try {
      const r = await fetch(`${API}/puestos/${puestoId}/slots`, {
        method: "POST",
        headers: h(),
        body: JSON.stringify({
          horas_turno: horasTurno,
          hora_entrada: horaEntrada,
          dias_trabajo: diasTrabajo,
          fecha_inicio_ciclo: fechaInicioCiclo || null,
          empleado_id: empleadoId || null,
          notas: notas || null,
        }),
      });
      if (!r.ok) { const e = await r.json(); setErr(e.error || "Error al guardar"); return; }
      onSaved();
    } catch { setErr("Error de red"); }
    setSaving(false);
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Nuevo slot de turno
          </p>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          {/* Puesto */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1">Puesto</label>
            <select
              value={puestoId}
              onChange={e => setPuestoId(Number(e.target.value))}
              className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-xs rounded-lg px-3 outline-none focus:border-primary/50"
            >
              {puestos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}{p.sede_nombre ? ` — ${p.sede_nombre}` : ""}</option>
              ))}
            </select>
          </div>

          {/* Tipo y hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1">Tipo de turno</label>
              <div className="flex gap-2">
                {([12, 24] as const).map(hrs => (
                  <button
                    key={hrs}
                    onClick={() => setHorasTurno(hrs)}
                    className={`flex-1 h-9 rounded-lg text-sm font-bold border transition-all ${horasTurno === hrs ? "bg-primary/15 border-primary/40 text-primary" : "bg-white/4 border-white/10 text-white/50 hover:text-white/80"}`}
                  >
                    {hrs}h
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1">Hora de entrada</label>
              <input
                type="time"
                value={horaEntrada}
                onChange={e => setHoraEntrada(e.target.value)}
                className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-lg px-3 outline-none focus:border-primary/50"
              />
            </div>
          </div>

          {/* Fecha de inicio del ciclo */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1">
              Fecha de inicio del ciclo <span className="text-white/20">(el Día 1 del ciclo corresponde a esta fecha)</span>
            </label>
            <input
              type="date"
              value={fechaInicioCiclo}
              onChange={e => setFechaInicioCiclo(e.target.value)}
              className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-lg px-3 outline-none focus:border-primary/50"
            />
          </div>

          {/* Días que trabaja — cuadrícula 14 días */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-2">
              Días que trabaja en el ciclo de 14 días
            </label>
            <div className="space-y-1.5">
              {[SEMANA1, SEMANA2].map((semana, si) => (
                <div key={si} className="flex items-center gap-1.5">
                  <span className="text-[9px] text-white/25 w-6 shrink-0">S{si + 1}</span>
                  <div className="flex gap-1 flex-1">
                    {semana.map(({ n, label }) => (
                      <button
                        key={n}
                        onClick={() => toggleDia(n)}
                        className={`flex-1 h-8 rounded-lg text-[10px] font-bold border transition-all ${diasTrabajo.includes(n) ? "bg-primary/20 border-primary/50 text-primary" : "bg-white/4 border-white/8 text-white/30 hover:text-white/60"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[10px] text-white/25">
                {diasTrabajo.length} días trabaja · {14 - diasTrabajo.length} días descansa
              </p>
              <div className="flex gap-2">
                <button onClick={() => setDiasTrabajo(DIAS_CICLO.map(d => d.n))} className="text-[9px] text-white/30 hover:text-white/60 underline">todos</button>
                <button onClick={() => setDiasTrabajo([])} className="text-[9px] text-white/30 hover:text-white/60 underline">ninguno</button>
              </div>
            </div>
          </div>

          {/* Agente */}
          <div className="relative">
            <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1">Agente asignado (opcional)</label>
            <input
              type="text"
              value={empleadoBusqueda}
              onChange={e => {
                setEmpleadoBusqueda(e.target.value);
                if (!e.target.value) setEmpleadoId(null);
              }}
              placeholder="Buscar por nombre…"
              className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-xs rounded-lg px-3 outline-none focus:border-primary/50"
            />
            {empleadoResultados.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#07111f] border border-white/10 rounded-lg divide-y divide-white/5 max-h-36 overflow-y-auto z-10">
                {empleadoResultados.map((emp: any) => (
                  <button
                    key={emp.id}
                    onClick={() => { setEmpleadoId(emp.id); setEmpleadoBusqueda(emp.nombre_completo); setEmpleadoResultados([]); }}
                    className="w-full text-left px-3 py-2 text-xs text-white/70 hover:bg-white/5 transition-colors flex items-center justify-between"
                  >
                    <span>{emp.nombre_completo}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${emp.estado_laboral === "activo" ? "text-green-400 bg-green-400/10" : "text-white/30 bg-white/5"}`}>{emp.estado_laboral}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1">Notas (opcional)</label>
            <input
              type="text"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Observaciones…"
              className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-xs rounded-lg px-3 outline-none focus:border-primary/50"
            />
          </div>
        </div>

        {err && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 h-9 border border-white/10 text-white/60 rounded-lg text-xs hover:text-white transition-colors">Cancelar</button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 h-9 bg-primary text-black font-bold rounded-lg text-xs hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-1"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> Guardar slot</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── TabPlantillaTurnos ────────────────────────────────────────────────────────
function TabPlantillaTurnos({ clienteId, puestos }: { clienteId: number; puestos: Puesto[] }) {
  const [slots, setSlots] = useState<PuestoSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [defaultPuestoId, setDefaultPuestoId] = useState<number | undefined>();
  const [savingSlotId, setSavingSlotId] = useState<number | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const r = await fetch(`${API}/clientes/${clienteId}/slots`, { headers: h() });
      if (r.ok) { const d = await r.json(); setSlots(d.slots || []); }
    } catch {}
    if (!silent) setLoading(false);
  }

  useEffect(() => { load(); }, [clienteId]);

  async function toggleDia(slot: PuestoSlot, dia: number) {
    const nuevos = slot.dias_trabajo.includes(dia)
      ? slot.dias_trabajo.filter(d => d !== dia)
      : [...slot.dias_trabajo, dia].sort((a, b) => a - b);

    setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, dias_trabajo: nuevos } : s));
    setSavingSlotId(slot.id);
    try {
      await fetch(`${API}/slots/${slot.id}`, {
        method: "PUT", headers: h(),
        body: JSON.stringify({ dias_trabajo: nuevos }),
      });
    } catch {}
    setSavingSlotId(null);
  }

  async function deleteSlot(id: number) {
    if (!confirm("¿Eliminar este slot de turno?")) return;
    await fetch(`${API}/slots/${id}`, { method: "DELETE", headers: h() });
    load();
  }

  function openModalForPuesto(pid: number) {
    setDefaultPuestoId(pid);
    setShowModal(true);
  }

  // Agrupar slots por puesto; incluir puestos sin slots
  const grouped = new Map<number, { nombre: string; sedeNombre: string | null; slots: PuestoSlot[] }>();
  for (const p of puestos) {
    grouped.set(p.id, { nombre: p.nombre, sedeNombre: p.sede_nombre, slots: [] });
  }
  for (const s of slots) {
    if (!grouped.has(s.puesto_id)) {
      grouped.set(s.puesto_id, { nombre: s.puesto_nombre, sedeNombre: s.sede_nombre, slots: [] });
    }
    grouped.get(s.puesto_id)!.slots.push(s);
  }
  const puestosOrdenados = Array.from(grouped.entries()).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre));

  const slotsConAgente = slots.filter(s => s.empleado_id).length;

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs text-white/30">Cuadrícula de ciclo 14 días: ✓ = trabaja, vacío = descansa (disponible para cobertura)</p>
          <p className="text-[10px] text-white/20 mt-0.5">
            {slots.length} slots · {slotsConAgente} con agente · {slots.length - slotsConAgente} sin asignar
          </p>
        </div>
        <button
          onClick={() => { setDefaultPuestoId(puestos[0]?.id); setShowModal(true); }}
          className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary transition-colors"
        >
          <Plus className="w-3 h-3" /> Nuevo slot
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 text-white/20 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {puestosOrdenados.map(([pId, grupo]) => (
            <div key={pId} className="bg-[#070f1c] border border-white/8 rounded-xl overflow-hidden">
              {/* Cabecera del puesto */}
              <div className="px-4 py-2.5 bg-white/3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-primary/50" />
                  <p className="text-xs font-semibold text-white">{grupo.nombre}</p>
                  {grupo.sedeNombre && (
                    <span className="text-[9px] text-white/30 bg-white/4 px-1.5 py-0.5 rounded-full">{grupo.sedeNombre}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] text-white/25">{grupo.slots.length} slot{grupo.slots.length !== 1 ? "s" : ""}</span>
                  <button
                    onClick={() => openModalForPuesto(pId)}
                    className="text-[9px] text-primary/60 hover:text-primary transition-colors flex items-center gap-0.5"
                  >
                    <Plus className="w-2.5 h-2.5" /> slot
                  </button>
                </div>
              </div>

              {grupo.slots.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-white/25 italic">Sin slots definidos</p>
                  <button
                    onClick={() => openModalForPuesto(pId)}
                    className="mt-1.5 text-[10px] text-primary hover:text-primary/80 underline"
                  >
                    Agregar primer slot
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[900px]">
                    <thead>
                      {/* Fila 1 — agrupadores de semana */}
                      <tr className="border-b border-white/3">
                        <th colSpan={2} className="w-36" />
                        <th colSpan={7} className="py-1 text-[9px] text-white/30 font-semibold text-center border-l border-white/5">
                          — Semana 1 —
                        </th>
                        <th colSpan={7} className="py-1 text-[9px] text-white/30 font-semibold text-center border-l border-white/5">
                          — Semana 2 —
                        </th>
                        <th colSpan={2} className="w-44" />
                      </tr>
                      {/* Fila 2 — columnas individuales */}
                      <tr className="border-b border-white/5">
                        <th className="text-left px-4 py-2 text-[9px] text-white/25 font-semibold uppercase tracking-wide w-14">Slot</th>
                        <th className="text-left px-2 py-2 text-[9px] text-white/25 font-semibold uppercase tracking-wide w-20">Turno</th>
                        {DIAS_CICLO.map(({ n, label }) => (
                          <th key={n} className={`py-2 text-[9px] text-white/25 font-semibold w-8 text-center ${n === 8 ? "border-l border-white/5" : ""}`}>
                            {label}
                          </th>
                        ))}
                        <th className="text-left px-3 py-2 text-[9px] text-white/25 font-semibold uppercase tracking-wide">Agente</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/4">
                      {grupo.slots.map(slot => {
                        const saving = savingSlotId === slot.id;
                        return (
                          <tr key={slot.id} className="hover:bg-white/1.5 transition-colors">
                            {/* # slot */}
                            <td className="px-4 py-2.5 text-white/35 text-[10px] font-mono">
                              #{slot.slot_numero}
                            </td>

                            {/* Tipo turno + hora */}
                            <td className="px-2 py-2.5">
                              <div className="flex flex-col gap-0.5">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full w-fit ${slot.horas_turno === 24 ? "text-blue-300 bg-blue-500/10 border border-blue-500/20" : "text-purple-300 bg-purple-500/10 border border-purple-500/20"}`}>
                                  {slot.horas_turno}h
                                </span>
                                <span className="text-[9px] text-white/25">{slot.hora_entrada}</span>
                                {slot.fecha_inicio_ciclo && (
                                  <span className="text-[8px] text-white/15 leading-tight">D1={slot.fecha_inicio_ciclo}</span>
                                )}
                              </div>
                            </td>

                            {/* 14 días — toggle interactivo */}
                            {DIAS_CICLO.map(({ n, label }) => {
                              const trabaja = slot.dias_trabajo.includes(n);
                              return (
                                <td key={n} className={`py-2.5 text-center ${n === 8 ? "border-l border-white/5" : ""}`}>
                                  <button
                                    title={trabaja ? `${label} trabaja — clic para descanso` : `${label} descansa — clic para trabajo`}
                                    disabled={saving}
                                    onClick={() => toggleDia(slot, n)}
                                    className={`w-6 h-6 rounded flex items-center justify-center mx-auto text-[10px] font-bold border transition-all ${
                                      trabaja
                                        ? "bg-primary/20 border-primary/50 text-primary hover:bg-primary/10"
                                        : "bg-white/3 border-white/8 text-white/10 hover:border-white/20 hover:text-white/25"
                                    } ${saving ? "opacity-40 cursor-wait" : "cursor-pointer"}`}
                                  >
                                    {trabaja ? "✓" : ""}
                                  </button>
                                </td>
                              );
                            })}

                            {/* Agente */}
                            <td className="px-3 py-2.5 min-w-[140px]">
                              {slot.empleado_nombre ? (
                                <div>
                                  <p className="text-[11px] text-white/70 font-medium leading-tight truncate max-w-[150px]">{slot.empleado_nombre}</p>
                                  <span className={`text-[9px] ${slot.empleado_estado === "activo" ? "text-green-400" : "text-white/30"}`}>
                                    {slot.empleado_estado}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-white/20 italic">Sin asignar</span>
                              )}
                            </td>

                            {/* Eliminar */}
                            <td className="pr-3">
                              <button onClick={() => deleteSlot(slot.id)} className="p-1 text-red-400/20 hover:text-red-400 transition-colors" title="Eliminar slot">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Leyenda */}
      <div className="bg-blue-950/20 border border-blue-500/15 rounded-xl px-4 py-3 flex items-start gap-2.5">
        <Zap className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-[10px] text-blue-300/70 leading-relaxed">
          <p><strong>Ciclo de 14 días</strong>: cada slot tiene una fecha de inicio que ancla el Día 1 del ciclo. El patrón se repite cada 14 días automáticamente.</p>
          <p><strong>✓ Trabaja</strong> ese día → agente en servicio activo. <strong>Vacío = Descansa</strong> → disponible para cobertura de horas extra.</p>
          <p className="mt-1 text-blue-300/40">Los cambios en los días se guardan automáticamente al hacer clic. La columna "D1=fecha" muestra cuándo empieza el ciclo.</p>
        </div>
      </div>

      {showModal && (
        <ModalCrearSlot
          puestos={puestos}
          defaultPuestoId={defaultPuestoId}
          onClose={() => { setShowModal(false); setDefaultPuestoId(undefined); }}
          onSaved={() => { setShowModal(false); setDefaultPuestoId(undefined); load(true); }}
        />
      )}
    </div>
  );
}
