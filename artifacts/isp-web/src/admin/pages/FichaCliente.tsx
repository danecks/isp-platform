import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRoute, useLocation } from "wouter";
import { AdminLayout } from "../layout/AdminLayout";
import {
  Building2, MapPin, Shield, Users, ChevronRight, ChevronDown,
  Plus, Trash2, X, Loader2, CheckCircle, AlertTriangle,
  Edit3, Save, ArrowLeft, Clock, Banknote, RefreshCw,
  UserCheck, Zap, Calendar, FileText, LayoutGrid, Activity,
  ChevronLeft, History
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
    turno: puesto?.turno ?? "",
    jornada: puesto?.jornada ?? "",
    horario: puesto?.horario ?? "",
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
    setSaving(true); setErr("");
    try {
      const body = {
        ...form,
        sede_id: form.sede_id ? Number(form.sede_id) : null,
        zona_operativa_id: form.zona_operativa_id ? Number(form.zona_operativa_id) : null,
        titular_employee_id: titularId ?? null,
        cantidad_contratada: Number(form.cantidad_contratada) || 1,
        tarifa_puesto: form.tarifa_puesto ? Number(form.tarifa_puesto) : null,
        costo_hora: form.costo_hora ? Number(form.costo_hora) : null,
        turno: form.turno || null,
        jornada: form.jornada || null,
        horario: form.horario || null,
        hora_entrada: form.hora_entrada || null,
        hora_salida: form.hora_salida || null,
        descanso_inicio: form.descanso_inicio || null,
        descanso_fin: form.descanso_fin || null,
        tipo_servicio: form.tipo_servicio || null,
        notas: form.notas || null,
        tipo_turno_id: form.tipo_turno_id ? Number(form.tipo_turno_id) : null,
        fecha_inicio_ciclo: form.fecha_inicio_ciclo || null,
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
          <h3 className="text-sm font-bold text-white">{isEdit ? "Editar puesto" : "Nuevo puesto"}</h3>
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

          {/* Tipo de Turno (nómina) */}
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Tipo de turno (nómina)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-white/40 uppercase tracking-wide">Turno de nómina</label>
                <select
                  value={form.tipo_turno_id}
                  onChange={(e) => up("tipo_turno_id", e.target.value)}
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                >
                  <option value="">Sin turno asignado</option>
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
                <p className="text-[10px] text-white/25">Solo para turnos &gt; 24h (24x24, 24x48…)</p>
              </div>
            </div>
          </div>

          {/* Horario / Jornada */}
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Horario y jornada</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-white/40 uppercase tracking-wide">Turno</label>
                <select
                  value={form.turno}
                  onChange={(e) => up("turno", e.target.value)}
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                >
                  <option value="">Seleccionar...</option>
                  <option value="diurno">Diurno</option>
                  <option value="nocturno">Nocturno</option>
                  <option value="mixto">Mixto</option>
                  <option value="12x12">12x12</option>
                  <option value="24h">24 horas</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/40 uppercase tracking-wide">Jornada</label>
                <select
                  value={form.jornada}
                  onChange={(e) => up("jornada", e.target.value)}
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                >
                  <option value="">Seleccionar...</option>
                  <option value="12x12">12x12</option>
                  <option value="8h">8 horas</option>
                  <option value="24x48">24x48</option>
                  <option value="diurna_completa">Diurna completa</option>
                  <option value="nocturna_completa">Nocturna completa</option>
                  <option value="lunes_viernes">Lunes-Viernes</option>
                </select>
              </div>
              <Field label="Hora entrada" k="hora_entrada" placeholder="06:00" />
              <Field label="Hora salida" k="hora_salida" placeholder="18:00" />
              <Field label="Inicio descanso" k="descanso_inicio" placeholder="18:01" />
              <Field label="Fin descanso" k="descanso_fin" placeholder="05:59" />
              <div className="col-span-2">
                <Field label="Descripción de horario" k="horario" placeholder="Ej: 06:00-18:00 diario" />
              </div>
            </div>
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

// ─── Página principal ─────────────────────────────────────────────────────────
type Tab = "general" | "estructura" | "cobertura" | "titulares";

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

          {/* ── Tab Titulares ─────────────────────────────────────────────── */}
          {tab === "titulares" && (
            <div className="p-5">
              {puestos.filter(p => p.titular_employee_id).length === 0 ? (
                <div className="text-center py-12">
                  <UserCheck className="w-7 h-7 text-white/10 mx-auto mb-3" />
                  <p className="text-white/30 text-sm">Sin colaboradores titulares asignados</p>
                  <p className="text-white/15 text-xs mt-1">Asigna titulares desde el pizarrón operativo.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {puestos.filter(p => p.titular_employee_id).map(p => (
                    <div key={p.id} className="bg-[#070f1c] border border-white/8 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-white">{p.titular_nombre_completo || p.titular_nombre}</p>
                          {p.titular_estado_laboral && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full mt-1 inline-block ${p.titular_estado_laboral === "activo" ? "text-green-400 bg-green-400/10" : "text-white/30 bg-white/5"}`}>
                              {p.titular_estado_laboral}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-white/70">{p.nombre}</p>
                          {p.sede_nombre && <p className="text-[10px] text-white/30">Sede: {p.sede_nombre}</p>}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-white/40">
                        {p.turno && <span className="bg-white/5 px-2 py-0.5 rounded-full">{p.turno}</span>}
                        {p.jornada && <span className="bg-white/5 px-2 py-0.5 rounded-full">{p.jornada}</span>}
                        {(p.hora_entrada && p.hora_salida) && (
                          <span className="bg-white/5 px-2 py-0.5 rounded-full">{p.hora_entrada}–{p.hora_salida}</span>
                        )}
                        {p.titular_telefono && <span className="bg-white/5 px-2 py-0.5 rounded-full">{p.titular_telefono}</span>}
                        {p.elegible_horas_extra && (
                          <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-400/20 px-2 py-0.5 rounded-full">
                            <Zap className="w-2.5 h-2.5 inline-block mr-0.5" />HE elegible
                          </span>
                        )}
                        {p.descanso_inicio && p.descanso_fin && (
                          <span className="bg-purple-500/10 text-purple-300 border border-purple-400/15 px-2 py-0.5 rounded-full">
                            Descanso: {p.descanso_inicio}–{p.descanso_fin}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
            {[puesto.turno, puesto.jornada, puesto.hora_entrada && puesto.hora_salida ? `${puesto.hora_entrada}–${puesto.hora_salida}` : puesto.horario].filter(Boolean).join(" · ")}
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
            { label: "Jornada", value: puesto.jornada },
            { label: "Horario", value: puesto.hora_entrada && puesto.hora_salida ? `${puesto.hora_entrada}–${puesto.hora_salida}` : puesto.horario },
            { label: "Descanso", value: puesto.descanso_inicio && puesto.descanso_fin ? `${puesto.descanso_inicio}–${puesto.descanso_fin}` : null },
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
