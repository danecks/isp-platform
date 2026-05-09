import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { AdminLayout } from "../layout/AdminLayout";
import {
  GitMerge, RefreshCw, Loader2, X, CheckCircle, XCircle,
  AlertTriangle, Shield, Users, Building2,
  Plus, FileText, Search,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getSessionToken } from "@/lib/httpClient";

const API = "/api";
const getSession = () => getSessionToken();
const h = () => ({ "x-isp-session": getSession(), "Content-Type": "application/json" });

type Estado = "pendiente_rrhh" | "pendiente_operaciones" | "escalado_admin" | "aprobado" | "rechazado";

interface Solicitud {
  id: number;
  employee_id: number;
  employee_nombre: string;
  origen_modulo: string;
  tipo_cambio: string;
  estado: Estado;
  datos_antes: Record<string, unknown> | null;
  datos_despues: Record<string, unknown> | null;
  creado_por: string | null;
  motivo: string | null;
  validado_por_rrhh: string | null;
  validado_por_operaciones: string | null;
  decidido_por_admin: string | null;
  notas_rrhh: string | null;
  notas_operaciones: string | null;
  notas_admin: string | null;
  fecha_validacion_rrhh_str: string | null;
  fecha_validacion_operaciones_str: string | null;
  fecha_decision_admin_str: string | null;
  puesto_id: number | null;
  puesto_nombre: string | null;
  cliente_nombre: string | null;
  created_at_str: string;
}

interface Stats { [estado: string]: number }

const ESTADO_CFG: Record<Estado, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  pendiente_rrhh:         { label: "Pendiente RRHH",       color: "text-purple-300", bg: "bg-purple-500/10", border: "border-purple-500/30", icon: Users },
  pendiente_operaciones:  { label: "Pendiente Operaciones", color: "text-blue-300",   bg: "bg-blue-500/10",   border: "border-blue-500/30",   icon: Shield },
  escalado_admin:         { label: "Escalado Admin",        color: "text-amber-300",  bg: "bg-amber-500/10",  border: "border-amber-500/30",  icon: AlertTriangle },
  aprobado:               { label: "Aprobado",              color: "text-green-300",  bg: "bg-green-500/10",  border: "border-green-500/30",  icon: CheckCircle },
  rechazado:              { label: "Rechazado",             color: "text-red-300",    bg: "bg-red-500/10",    border: "border-red-500/30",    icon: XCircle },
};

const TIPO_CFG: Record<string, string> = {
  cambio_titular:     "Cambio de titular",
  cambio_cliente:     "Cambio de cliente",
  cambio_puesto:      "Cambio de puesto",
  cambio_sede:        "Cambio de sede",
  sick_note:          "Sick note / IGSS",
  suspension:         "Suspensión",
  baja:               "Baja",
  reasignacion:       "Reasignación permanente",
  otro:               "Otro",
};

const MODULO_CFG: Record<string, { label: string; color: string }> = {
  operaciones: { label: "Operaciones", color: "text-blue-400" },
  rrhh:        { label: "RRHH",        color: "text-purple-400" },
  empleados:   { label: "Colaboradores", color: "text-green-400" },
};

const TABS: { key: Estado | "todos"; label: string }[] = [
  { key: "todos",                label: "Todos" },
  { key: "pendiente_rrhh",       label: "Pendiente RRHH" },
  { key: "pendiente_operaciones", label: "Pend. Operaciones" },
  { key: "escalado_admin",       label: "Escalados Admin" },
  { key: "aprobado",             label: "Aprobados" },
  { key: "rechazado",            label: "Rechazados" },
];

// ─── Modal: Nueva solicitud manual ────────────────────────────────────────────
interface ModalNuevaProps {
  onClose: () => void;
  onCreated: () => void;
  currentUser: { nombre?: string; username?: string } | null;
}

function ModalNuevaSolicitud({ onClose, onCreated, currentUser }: ModalNuevaProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    employee_id: "",
    origen_modulo: "rrhh",
    tipo_cambio: "sick_note",
    estado: "pendiente_operaciones",
    motivo: "",
  });
  const [employees, setEmployees] = useState<{ id: number; nombre_completo: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}/employees?limit=200`, { headers: h() })
      .then(r => r.ok ? r.json() : [])
      .then((d: any[]) => setEmployees((Array.isArray(d) ? d : (d.data ?? [])).map((e: any) => ({ id: e.id, nombre_completo: e.nombreCompleto ?? e.nombre_completo ?? e.nombre ?? "" }))))
      .catch(() => {});
  }, []);

  const sel = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const selCls = "w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employee_id) { toast({ title: "Selecciona un colaborador", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await fetch(`${API}/solicitudes-cambio`, {
        method: "POST", headers: h(),
        body: JSON.stringify({
          ...form,
          employee_id: Number(form.employee_id),
          creado_por: currentUser?.nombre ?? currentUser?.username ?? "usuario",
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: "Solicitud creada", description: `${TIPO_CFG[form.tipo_cambio] ?? form.tipo_cambio}` });
      onCreated(); onClose();
    } catch { toast({ title: "Error al crear solicitud", variant: "destructive" }); }
    finally { setSaving(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-white">Nueva solicitud de cambio</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-white/50 font-medium">Colaborador *</label>
            <select value={form.employee_id} onChange={e => sel("employee_id", e.target.value)} className={selCls}>
              <option value="">Seleccionar colaborador…</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.nombre_completo}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-white/50 font-medium">Módulo origen</label>
              <select value={form.origen_modulo} onChange={e => sel("origen_modulo", e.target.value)} className={selCls}>
                <option value="operaciones">Operaciones</option>
                <option value="rrhh">RRHH</option>
                <option value="empleados">Colaboradores</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50 font-medium">Tipo de cambio</label>
              <select value={form.tipo_cambio} onChange={e => sel("tipo_cambio", e.target.value)} className={selCls}>
                {Object.entries(TIPO_CFG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-white/50 font-medium">Estado inicial</label>
            <select value={form.estado} onChange={e => sel("estado", e.target.value)} className={selCls}>
              <option value="pendiente_rrhh">Pendiente RRHH</option>
              <option value="pendiente_operaciones">Pendiente Operaciones</option>
              <option value="escalado_admin">Escalar a Admin directamente</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-white/50 font-medium">Motivo / descripción</label>
            <textarea
              rows={3}
              value={form.motivo}
              onChange={e => sel("motivo", e.target.value)}
              placeholder="Describe el motivo del cambio…"
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-white/10 rounded-xl text-sm text-white/50 hover:text-white transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-primary hover:bg-primary/90 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Crear solicitud
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Detalle / Acciones ────────────────────────────────────────────────
function ModalDetalle({ sol, onClose, onUpdate, currentUser, currentRol }: {
  sol: Solicitud;
  onClose: () => void;
  onUpdate: () => void;
  currentUser: { nombre?: string; username?: string } | null;
  currentRol: string | null;
}) {
  const { toast } = useToast();
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const usuario = currentUser?.nombre ?? currentUser?.username ?? "usuario";
  const cfg = ESTADO_CFG[sol.estado] ?? ESTADO_CFG.pendiente_rrhh;
  const Icon = cfg.icon;

  async function accion(endpoint: string, payload: Record<string, unknown>) {
    setSaving(endpoint);
    try {
      const r = await fetch(`${API}/solicitudes-cambio/${sol.id}/${endpoint}`, {
        method: "PATCH", headers: h(),
        body: JSON.stringify({ ...payload, notas: notas || undefined }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: "Solicitud actualizada" });
      onUpdate(); onClose();
    } catch { toast({ title: "Error al actualizar", variant: "destructive" }); }
    finally { setSaving(null); }
  }

  const esAdmin = currentRol === "admin";
  const esRrhh  = currentRol === "rrhh" || esAdmin;
  const esOp    = currentRol === "operaciones" || esAdmin;

  const puedeAprobarRrhh  = sol.estado === "pendiente_rrhh"        && (esRrhh || esAdmin);
  const puedeAprobarOp    = sol.estado === "pendiente_operaciones"  && (esOp   || esAdmin);
  const puedeDecidirAdmin = sol.estado === "escalado_admin"         && esAdmin;
  const puedeEscalar      = ["pendiente_rrhh", "pendiente_operaciones"].includes(sol.estado);
  const puedeRechazar     = ["pendiente_rrhh", "pendiente_operaciones"].includes(sol.estado);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 sticky top-0 bg-[#07111f]">
          <div className="flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-white">Solicitud #{sol.id}</h3>
            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
              {cfg.label}
            </span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Info básica */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0c1929] border border-white/6 rounded-xl p-3">
              <p className="text-[9px] text-white/30 uppercase tracking-wide mb-1">Colaborador</p>
              <p className="text-xs font-semibold text-white">{sol.employee_nombre}</p>
            </div>
            <div className="bg-[#0c1929] border border-white/6 rounded-xl p-3">
              <p className="text-[9px] text-white/30 uppercase tracking-wide mb-1">Tipo de cambio</p>
              <p className="text-xs font-semibold text-white">{TIPO_CFG[sol.tipo_cambio] ?? sol.tipo_cambio}</p>
            </div>
            {sol.puesto_nombre && (
              <div className="bg-[#0c1929] border border-white/6 rounded-xl p-3">
                <p className="text-[9px] text-white/30 uppercase tracking-wide mb-1">Puesto</p>
                <p className="text-xs text-white">{sol.puesto_nombre}</p>
                {sol.cliente_nombre && <p className="text-[10px] text-white/40">{sol.cliente_nombre}</p>}
              </div>
            )}
            <div className="bg-[#0c1929] border border-white/6 rounded-xl p-3">
              <p className="text-[9px] text-white/30 uppercase tracking-wide mb-1">Origen</p>
              <p className={`text-xs font-semibold ${MODULO_CFG[sol.origen_modulo]?.color ?? "text-white"}`}>
                {MODULO_CFG[sol.origen_modulo]?.label ?? sol.origen_modulo}
              </p>
              {sol.creado_por && <p className="text-[10px] text-white/30 mt-0.5">por {sol.creado_por}</p>}
            </div>
          </div>

          {sol.motivo && (
            <div className="bg-[#0c1929] border border-white/6 rounded-xl p-3">
              <p className="text-[9px] text-white/30 uppercase tracking-wide mb-1">Motivo</p>
              <p className="text-xs text-white/70">{sol.motivo}</p>
            </div>
          )}

          {/* Datos antes/después */}
          {(sol.datos_antes || sol.datos_despues) && (
            <div className="grid grid-cols-2 gap-3">
              {sol.datos_antes && (
                <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-3">
                  <p className="text-[9px] text-red-300/50 uppercase tracking-wide mb-2">Situación anterior</p>
                  {Object.entries(sol.datos_antes).map(([k, v]) => (
                    <div key={k} className="mb-1">
                      <span className="text-[9px] text-white/25 capitalize">{k.replace(/_/g, " ")}:</span>
                      <span className="text-[10px] text-white/60 ml-1">{String(v ?? "—")}</span>
                    </div>
                  ))}
                </div>
              )}
              {sol.datos_despues && (
                <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-3">
                  <p className="text-[9px] text-green-300/50 uppercase tracking-wide mb-2">Nueva situación</p>
                  {Object.entries(sol.datos_despues).map(([k, v]) => (
                    <div key={k} className="mb-1">
                      <span className="text-[9px] text-white/25 capitalize">{k.replace(/_/g, " ")}:</span>
                      <span className="text-[10px] text-white/60 ml-1">{String(v ?? "—")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Timeline de validaciones */}
          <div className="space-y-2">
            <p className="text-[9px] text-white/30 uppercase tracking-wide">Trazabilidad</p>
            <div className="space-y-1.5">
              {sol.validado_por_rrhh && (
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-white/60">RRHH: <span className="text-white/80">{sol.validado_por_rrhh}</span></p>
                    {sol.notas_rrhh && <p className="text-[10px] text-white/30 italic">"{sol.notas_rrhh}"</p>}
                    {sol.fecha_validacion_rrhh_str && <p className="text-[10px] text-white/20">{sol.fecha_validacion_rrhh_str}</p>}
                  </div>
                </div>
              )}
              {sol.validado_por_operaciones && (
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-white/60">Operaciones: <span className="text-white/80">{sol.validado_por_operaciones}</span></p>
                    {sol.notas_operaciones && <p className="text-[10px] text-white/30 italic">"{sol.notas_operaciones}"</p>}
                    {sol.fecha_validacion_operaciones_str && <p className="text-[10px] text-white/20">{sol.fecha_validacion_operaciones_str}</p>}
                  </div>
                </div>
              )}
              {sol.decidido_por_admin && (
                <div className="flex items-start gap-2">
                  <Shield className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-white/60">Admin: <span className="text-white/80">{sol.decidido_por_admin}</span></p>
                    {sol.notas_admin && <p className="text-[10px] text-white/30 italic">"{sol.notas_admin}"</p>}
                    {sol.fecha_decision_admin_str && <p className="text-[10px] text-white/20">{sol.fecha_decision_admin_str}</p>}
                  </div>
                </div>
              )}
              {!sol.validado_por_rrhh && !sol.validado_por_operaciones && !sol.decidido_por_admin && (
                <p className="text-[10px] text-white/20 italic">Sin validaciones aún</p>
              )}
            </div>
          </div>

          {/* Acciones */}
          {(puedeAprobarRrhh || puedeAprobarOp || puedeDecidirAdmin || puedeEscalar || puedeRechazar) && (
            <div className="border-t border-white/8 pt-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-white/50">Notas (opcional)</label>
                <textarea
                  rows={2}
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  placeholder="Agregar comentario a esta acción…"
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-primary/50 resize-none"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {puedeAprobarRrhh && (
                  <button
                    onClick={() => accion("aprobar", { area: "rrhh", usuario })}
                    disabled={!!saving}
                    className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {saving === "aprobar" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Aprobar (RRHH)
                  </button>
                )}
                {puedeAprobarOp && (
                  <button
                    onClick={() => accion("aprobar", { area: "operaciones", usuario })}
                    disabled={!!saving}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {saving === "aprobar" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Aprobar (Operaciones)
                  </button>
                )}
                {puedeDecidirAdmin && (
                  <>
                    <button
                      onClick={() => accion("decidir", { decision: "aprobado", usuario })}
                      disabled={!!saving}
                      className="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-50"
                    >
                      {saving === "decidir" ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : "Aprobar (Admin)"}
                    </button>
                    <button
                      onClick={() => accion("decidir", { decision: "rechazado", usuario })}
                      disabled={!!saving}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-50"
                    >
                      {saving === "decidir" ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : "Rechazar (Admin)"}
                    </button>
                  </>
                )}
                {puedeEscalar && (esAdmin || esRrhh || esOp) && (
                  <button
                    onClick={() => accion("escalar", { usuario })}
                    disabled={!!saving}
                    className="py-2 px-4 bg-amber-600/20 border border-amber-500/30 hover:border-amber-500/60 rounded-xl text-xs font-bold text-amber-300 transition-colors disabled:opacity-50"
                  >
                    Escalar a Admin
                  </button>
                )}
                {puedeRechazar && (
                  <button
                    onClick={() => accion("rechazar", { area: currentRol === "rrhh" ? "rrhh" : "operaciones", usuario })}
                    disabled={!!saving}
                    className="py-2 px-4 bg-red-500/10 border border-red-500/20 hover:border-red-500/40 rounded-xl text-xs font-bold text-red-400 transition-colors disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                )}
              </div>
            </div>
          )}

          <p className="text-[10px] text-white/20 text-right">Creado {sol.created_at_str}</p>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Tarjeta de solicitud ─────────────────────────────────────────────────────
function SolicitudCard({ sol, onClick }: { sol: Solicitud; onClick: () => void }) {
  const cfg = ESTADO_CFG[sol.estado] ?? ESTADO_CFG.pendiente_rrhh;
  const Icon = cfg.icon;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-[#0a1628] border rounded-xl p-4 hover:border-white/20 transition-all group ${cfg.border}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
              {cfg.label}
            </span>
            <span className="text-[10px] text-white/30">{TIPO_CFG[sol.tipo_cambio] ?? sol.tipo_cambio}</span>
            <span className={`text-[10px] ${MODULO_CFG[sol.origen_modulo]?.color ?? "text-white/30"}`}>
              desde {MODULO_CFG[sol.origen_modulo]?.label ?? sol.origen_modulo}
            </span>
          </div>
          <p className="text-sm font-semibold text-white truncate group-hover:text-primary transition-colors">{sol.employee_nombre}</p>
          {sol.puesto_nombre && (
            <p className="text-[11px] text-white/40 mt-0.5 truncate">
              <Building2 className="w-3 h-3 inline mr-1" />{sol.cliente_nombre} · {sol.puesto_nombre}
            </p>
          )}
          {sol.motivo && (
            <p className="text-[10px] text-white/30 mt-1 truncate italic">"{sol.motivo}"</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Icon className={`w-4 h-4 ${cfg.color}`} />
          <span className="text-[9px] text-white/20">{sol.created_at_str}</span>
        </div>
      </div>
    </button>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function CambiosEstructurales() {
  const { currentUser } = useAuth();
  const rol = (currentUser as any)?.rol ?? null;

  const [items, setItems] = useState<Solicitud[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Estado | "todos">("todos");
  const [busqueda, setBusqueda] = useState("");
  const [modalNueva, setModalNueva] = useState(false);
  const [detalleId, setDetalleId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = tab === "todos"
        ? `${API}/solicitudes-cambio?limit=200`
        : `${API}/solicitudes-cambio?estado=${tab}&limit=200`;
      const [dataR, statsR] = await Promise.all([
        fetch(url, { headers: h() }),
        fetch(`${API}/solicitudes-cambio/stats`, { headers: h() }),
      ]);
      setItems(dataR.ok ? await dataR.json() : []);
      setStats(statsR.ok ? await statsR.json() : {});
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const filtrados = items.filter(s =>
    !busqueda || s.employee_nombre.toLowerCase().includes(busqueda.toLowerCase())
    || (s.motivo ?? "").toLowerCase().includes(busqueda.toLowerCase())
    || (s.puesto_nombre ?? "").toLowerCase().includes(busqueda.toLowerCase())
  );

  const detalle = detalleId !== null ? items.find(s => s.id === detalleId) ?? null : null;

  const totalPendientes = (stats["pendiente_rrhh"] ?? 0) + (stats["pendiente_operaciones"] ?? 0) + (stats["escalado_admin"] ?? 0);

  return (
    <AdminLayout title="Cambios Estructurales">
      <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <GitMerge className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-bold text-white">Cambios Estructurales</h1>
              {totalPendientes > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                  {totalPendientes} pendientes
                </span>
              )}
            </div>
            <p className="text-xs text-white/40 mt-0.5">
              Workflow de validación cruzada entre Operaciones, RRHH y Admin
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-white/10 rounded-xl text-white/40 hover:text-white hover:border-white/20 transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setModalNueva(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-xl text-xs font-bold text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nueva solicitud
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-5 gap-2">
          {(Object.entries(ESTADO_CFG) as [Estado, typeof ESTADO_CFG[Estado]][]).map(([key, cfg]) => {
            const Icon = cfg.icon;
            return (
              <div
                key={key}
                onClick={() => setTab(key)}
                className={`cursor-pointer rounded-xl p-3 border transition-all ${tab === key ? `${cfg.bg} ${cfg.border}` : "bg-[#0a1628] border-white/6 hover:border-white/15"}`}
              >
                <Icon className={`w-4 h-4 mb-1.5 ${cfg.color}`} />
                <p className="text-lg font-bold text-white">{stats[key] ?? 0}</p>
                <p className="text-[9px] text-white/35 leading-tight">{cfg.label}</p>
              </div>
            );
          })}
        </div>

        {/* Tabs + búsqueda */}
        <div className="flex items-center gap-3">
          <div className="flex bg-[#0a1628] border border-white/8 rounded-xl p-1 gap-0.5 overflow-x-auto">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${tab === t.key ? "bg-primary text-white" : "text-white/40 hover:text-white/70"}`}
              >
                {t.label}
                {t.key !== "todos" && stats[t.key] > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white/15 text-[9px]">{stats[t.key]}</span>
                )}
              </button>
            ))}
          </div>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar colaborador, puesto, motivo…"
              className="w-full bg-[#0a1628] border border-white/8 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-white/25 outline-none focus:border-primary/40"
            />
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="bg-[#0a1628] border border-white/6 rounded-2xl p-10 text-center">
            <GitMerge className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/30">No hay solicitudes en esta categoría</p>
            <p className="text-xs text-white/20 mt-1">
              {tab === "todos" ? "Los cambios estructurales aparecerán aquí automáticamente o puedes crear uno manualmente." : "Prueba cambiando el filtro o la búsqueda."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] text-white/25">{filtrados.length} solicitud{filtrados.length !== 1 ? "es" : ""}</p>
            {filtrados.map(s => (
              <SolicitudCard key={s.id} sol={s} onClick={() => setDetalleId(s.id)} />
            ))}
          </div>
        )}

        {/* Info box */}
        <div className="bg-[#0a1628] border border-primary/10 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <FileText className="w-4 h-4 text-primary/50 shrink-0 mt-0.5" />
            <div className="space-y-2 text-[11px] text-white/40 leading-relaxed">
              <p><span className="text-white/60 font-semibold">¿Qué es un cambio estructural?</span> Un cambio que afecta la asignación base de un colaborador: cambio de titular, cliente, puesto, sede, sick note IGSS, suspensión o baja. Los relevos temporales y coberturas diarias NO son cambios estructurales.</p>
              <p><span className="text-white/60 font-semibold">Validación cruzada:</span> Si el cambio viene de Operaciones y afecta estatus laboral → requiere validación de RRHH. Si viene de RRHH y afecta cobertura → requiere validación de Operaciones. Si hay conflicto → se escala a Admin.</p>
              <p><span className="text-white/60 font-semibold">Auto-registro:</span> Al convertir un colaborador en titular desde el pizarrón, el sistema crea automáticamente una solicitud aquí para que RRHH tenga visibilidad del impacto en pre-planilla y nómina.</p>
            </div>
          </div>
        </div>
      </div>

      {modalNueva && (
        <ModalNuevaSolicitud
          onClose={() => setModalNueva(false)}
          onCreated={load}
          currentUser={currentUser as any}
        />
      )}
      {detalle && (
        <ModalDetalle
          sol={detalle}
          onClose={() => setDetalleId(null)}
          onUpdate={load}
          currentUser={currentUser as any}
          currentRol={rol}
        />
      )}
    </AdminLayout>
  );
}
