import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import {
  Palmtree, Clock, CheckCircle2, AlertTriangle, Loader2,
  Plus, RefreshCw, X, Search, Calendar, User,
  ChevronRight, Umbrella, Briefcase, Bell, XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const API = "/api";
const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";

async function apiFetch<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { "x-isp-session": getSession() } });
  if (!r.ok) throw new Error(`Error ${r.status}`);
  return r.json();
}
async function apiPost(url: string, body: object): Promise<any> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw data;
  return data;
}
async function apiPatch(url: string, body: object): Promise<any> {
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw data;
  return data;
}

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-GT", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return iso; }
}

const TIPO_VAC_CONFIG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  vacaciones: {
    label: "Vacaciones",
    icon: <Palmtree className="w-3.5 h-3.5" />,
    cls: "text-teal-400 bg-teal-400/10 border-teal-400/20",
  },
  vacaciones_programadas: {
    label: "Programadas",
    icon: <Calendar className="w-3.5 h-3.5" />,
    cls: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  },
  vacaciones_trabajadas: {
    label: "Trabajadas",
    icon: <Briefcase className="w-3.5 h-3.5" />,
    cls: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  },
};

const ESTADO_VAC_CONFIG: Record<string, { label: string; cls: string }> = {
  pendiente:  { label: "Pendiente",  cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  aprobado:   { label: "Aprobado",   cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  completado: { label: "Completado", cls: "text-green-400 bg-green-400/10 border-green-400/20" },
  cancelado:  { label: "Cancelado",  cls: "text-red-400 bg-red-400/10 border-red-400/20" },
  anulado:    { label: "Anulado",    cls: "text-red-400/60 bg-red-400/5 border-red-400/10" },
};

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface ElegibilidadRow {
  id: number;
  nombre_completo: string;
  tipo_personal: string;
  fecha_ingreso: string;
  es_elegible: boolean;
  anios_servicio: number;
  dias_para_aniversario: number;
  fecha_aniversario: string;
  /** @deprecated Usar dias_gozados — se mantiene por backward compat */
  dias_vacaciones_usados_anio: number;
  faltas_ultimo_anio: number;
  vacacion_activa_tipo: string | null;
  vacacion_activa_inicio: string | null;
  vacacion_activa_fin: string | null;
  proximas_programadas_inicio: string | null;
  /** Saldo: días ganados por ley (15 × años completos de servicio) */
  dias_ganados: number;
  /** Saldo: días ya gozados (vacaciones normales aprobadas, todos los períodos) */
  dias_gozados: number;
  /** Saldo: días programados futuros aún no iniciados */
  dias_programados: number;
  /** Vacaciones trabajadas: días laborados en período vacacional — NO consumen saldo */
  dias_trabajados_vac: number;
  /** Saldo disponible = ganados − gozados − programados */
  saldo_disponible: number;
}

interface VacacionEvento {
  id: number;
  employee_id: number;
  employee_nombre: string;
  tipo_evento: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: string;
  observaciones: string | null;
  notas: string | null;
  dias_habiles_calculados: number;
  tipo_personal: string;
  fecha_ingreso: string;
}

interface AlertaProxima {
  employee_id: number;
  nombre_completo: string;
  tipo_personal: string;
  fecha_aniversario: string;
  dias_restantes: number;
  ya_tiene_programadas: boolean;
}

// ─── Modal Nuevo Vacaciones ───────────────────────────────────────────────────
function ModalNuevoVacaciones({
  onClose,
  usuario,
  initialEmpleadoId,
}: {
  onClose: () => void;
  usuario: string;
  initialEmpleadoId?: number;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [empleadoId, setEmpleadoId] = useState(initialEmpleadoId ? String(initialEmpleadoId) : "");
  const [busEmp, setBusEmp] = useState("");
  const [empFijo, setEmpFijo] = useState(!!initialEmpleadoId);
  const [tipo, setTipo] = useState<"vacaciones" | "vacaciones_programadas" | "vacaciones_trabajadas">("vacaciones");
  const [fechaInicio, setFechaInicio] = useState(() => new Date().toISOString().slice(0, 10));
  const [fechaFin, setFechaFin] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: empleados = [] } = useQuery<Array<{ id: number; nombre_completo: string; tipo_personal: string; es_elegible: boolean; dias_vacaciones_usados_anio: number }>>({
    queryKey: ["vacaciones-elegibilidad"],
    queryFn: () => apiFetch(`${API}/vacaciones/elegibilidad`),
    staleTime: 60_000,
  });

  const filtrados = empleados.filter((e) =>
    !busEmp || e.nombre_completo.toLowerCase().includes(busEmp.toLowerCase())
  );

  const empSel = empleados.find((e) => String(e.id) === empleadoId);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!empleadoId || !fechaInicio) return;
    setLoading(true);
    try {
      await apiPost(`${API}/vacaciones`, {
        employee_id: Number(empleadoId),
        tipo,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin || undefined,
        observaciones: observaciones.trim() || undefined,
        usuario,
      });
      qc.invalidateQueries({ queryKey: ["vacaciones-lista"] });
      qc.invalidateQueries({ queryKey: ["vacaciones-elegibilidad"] });
      qc.invalidateQueries({ queryKey: ["vacaciones-alertas"] });
      qc.invalidateQueries({ queryKey: ["vacaciones-resumen"] });
      toast({ title: "Vacaciones registradas correctamente" });
      onClose();
    } catch (e: any) {
      toast({
        title: "Error al registrar",
        description: e?.error || "Intenta de nuevo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500/40 transition-colors";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-teal-500/20 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-5 py-4 border-b border-teal-500/10 bg-teal-500/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palmtree className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-bold text-white">Registrar Vacaciones</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Tipo */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {(["vacaciones", "vacaciones_programadas", "vacaciones_trabajadas"] as const).map((t) => {
                const cfg = TIPO_VAC_CONFIG[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-[10px] font-medium transition-all ${
                      tipo === t
                        ? `${cfg.cls} border-current`
                        : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
                    }`}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Empleado */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-white/50">
                Empleado <span className="text-red-400">*</span>
              </label>
              {empFijo && (
                <button
                  type="button"
                  onClick={() => { setEmpFijo(false); setEmpleadoId(""); setBusEmp(""); }}
                  className="text-[10px] text-white/30 hover:text-white/60 transition-colors"
                >
                  Cambiar empleado
                </button>
              )}
            </div>

            {empFijo && empSel ? (
              /* ── Empleado bloqueado (viene pre-seleccionado desde tarjeta) ── */
              <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                <User className="w-4 h-4 text-white/30 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-white">{empSel.nombre_completo}</p>
                  <p className="text-[10px] text-white/30 capitalize">{empSel.tipo_personal?.replace(/_/g, " ")}</p>
                </div>
              </div>
            ) : (
              /* ── Selector libre ── */
              <>
                <input
                  type="text"
                  placeholder="Buscar por nombre..."
                  value={busEmp}
                  onChange={(e) => { setBusEmp(e.target.value); setEmpleadoId(""); }}
                  className={inputCls}
                />
                <select
                  value={empleadoId}
                  onChange={(e) => setEmpleadoId(e.target.value)}
                  className={inputCls}
                  required
                >
                  <option value="">— selecciona un empleado —</option>
                  {filtrados.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre_completo}
                      {e.es_elegible ? " ✓" : " (aún no elegible)"}
                    </option>
                  ))}
                </select>
              </>
            )}

            {empSel && (
              <div className={`text-[11px] px-3 py-1.5 rounded-lg border ${
                empSel.es_elegible
                  ? "text-teal-400 bg-teal-400/10 border-teal-400/20"
                  : "text-yellow-400 bg-yellow-400/10 border-yellow-400/20"
              }`}>
                {empSel.es_elegible
                  ? `✓ Elegible · ${empSel.saldo_disponible ?? 0} día${(empSel.saldo_disponible ?? 0) !== 1 ? "s" : ""} disponible${(empSel.saldo_disponible ?? 0) !== 1 ? "s" : ""} (de ${empSel.dias_ganados ?? 15} ganados)`
                  : `⚠ Aún no cumple 1 año de servicio`}
              </div>
            )}
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50">
                Fecha inicio <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className={inputCls + " [color-scheme:dark]"}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50">Fecha fin</label>
              <input
                type="date"
                value={fechaFin}
                min={fechaInicio}
                onChange={(e) => setFechaFin(e.target.value)}
                className={inputCls + " [color-scheme:dark]"}
              />
            </div>
          </div>

          {/* Observaciones */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Notas opcionales..."
              className={inputCls + " resize-none"}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl text-sm text-white/60 transition-all">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !empleadoId}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Registrar
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

// ─── VacacionEvento Card ──────────────────────────────────────────────────────
function VacacionCard({ ev, onAprobar, onCancelar }: {
  ev: VacacionEvento;
  onAprobar: (id: number) => void;
  onCancelar: (id: number) => void;
}) {
  const tipoCfg = TIPO_VAC_CONFIG[ev.tipo_evento] ?? TIPO_VAC_CONFIG.vacaciones;
  const estadoCfg = ESTADO_VAC_CONFIG[ev.estado] ?? { label: ev.estado, cls: "text-white/40" };

  return (
    <div className="bg-[#07111f] border border-white/8 rounded-2xl p-4 flex flex-col gap-3 hover:border-white/14 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{ev.employee_nombre}</p>
          <p className="text-[11px] text-white/40 capitalize">{(ev.tipo_personal ?? "guardia").replace("_", " ")}</p>
        </div>
        <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tipoCfg.cls}`}>
          {tipoCfg.icon}
          {tipoCfg.label}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-white/50">
        <Calendar className="w-3.5 h-3.5 shrink-0" />
        <span>
          {fmtFecha(ev.fecha_inicio)}
          {ev.fecha_fin ? ` → ${fmtFecha(ev.fecha_fin)}` : ""}
        </span>
        {ev.dias_habiles_calculados > 0 && (
          <span className="ml-auto text-[10px] text-white/30">
            {ev.dias_habiles_calculados} día{ev.dias_habiles_calculados !== 1 ? "s" : ""} háb.
          </span>
        )}
      </div>

      {ev.observaciones && (
        <p className="text-[11px] text-white/35 italic leading-snug">{ev.observaciones}</p>
      )}

      <div className="flex items-center justify-between mt-auto">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${estadoCfg.cls}`}>
          {estadoCfg.label}
        </span>
        <div className="flex gap-1.5">
          {ev.tipo_evento === "vacaciones_programadas" && ev.estado === "pendiente" && (
            <button
              onClick={() => onAprobar(ev.id)}
              className="flex items-center gap-1 px-2.5 py-1 bg-teal-600/20 hover:bg-teal-600/30 border border-teal-500/20 rounded-lg text-[10px] text-teal-400 font-semibold transition-colors"
            >
              <CheckCircle2 className="w-3 h-3" /> Aprobar
            </button>
          )}
          {(ev.estado === "pendiente" || ev.estado === "aprobado") && (
            <button
              onClick={() => onCancelar(ev.id)}
              className="flex items-center gap-1 px-2.5 py-1 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 rounded-lg text-[10px] text-red-400 font-semibold transition-colors"
            >
              <X className="w-3 h-3" /> Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ElegibilidadCard ─────────────────────────────────────────────────────────
function ElegibilidadRow({ emp, onProgramar }: { emp: ElegibilidadRow; onProgramar?: (id: number) => void }) {
  const diasRestantes = emp.dias_para_aniversario;
  const urgente = emp.es_elegible && emp.vacacion_activa_tipo === null && emp.proximas_programadas_inicio === null && (emp.saldo_disponible ?? 0) > 0;

  // Desglose de saldo
  const ganados   = emp.dias_ganados ?? 0;
  const gozados   = emp.dias_gozados ?? 0;
  const programados = emp.dias_programados ?? 0;
  const trabajados  = emp.dias_trabajados_vac ?? 0;
  const disponible  = emp.saldo_disponible ?? Math.max(0, ganados - gozados - programados);

  // Barra proporcional: divide ganados en gozados / programados / disponible
  const pctGozados     = ganados > 0 ? Math.min(100, Math.round((gozados / ganados) * 100)) : 0;
  const pctProgramados = ganados > 0 ? Math.min(100 - pctGozados, Math.round((programados / ganados) * 100)) : 0;
  const pctDisponible  = Math.max(0, 100 - pctGozados - pctProgramados);

  return (
    <div className={`bg-[#07111f] border rounded-xl p-3.5 flex flex-col gap-2.5 ${
      urgente ? "border-yellow-400/20" : "border-white/7"
    }`}>
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white truncate">{emp.nombre_completo}</p>
          <p className="text-[10px] text-white/35 capitalize mt-0.5">
            {(emp.tipo_personal ?? "guardia").replace(/_/g, " ")}
            {emp.anios_servicio != null && ` · ${emp.anios_servicio} año${emp.anios_servicio !== 1 ? "s" : ""} de servicio`}
          </p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          {emp.es_elegible ? (
            <span className="text-[10px] font-semibold text-teal-400 bg-teal-400/10 border border-teal-400/20 px-2 py-0.5 rounded-full">
              ✓ Elegible
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-white/30 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
              Elegible en {Math.abs(diasRestantes)}d
            </span>
          )}
        </div>
      </div>

      {/* ── Desglose de saldo ─────────────────────────────────────── */}
      {emp.es_elegible ? (
        <div className="space-y-2">
          {/* Barra de composición */}
          <div className="h-2 bg-white/6 rounded-full overflow-hidden flex">
            {pctGozados > 0 && (
              <div className="h-full bg-teal-500/70 transition-all" style={{ width: `${pctGozados}%` }} />
            )}
            {pctProgramados > 0 && (
              <div className="h-full bg-blue-500/70 transition-all" style={{ width: `${pctProgramados}%` }} />
            )}
            {pctDisponible > 0 && (
              <div className="h-full bg-white/10 transition-all" style={{ width: `${pctDisponible}%` }} />
            )}
          </div>

          {/* Grid de cifras */}
          <div className="grid grid-cols-4 gap-1">
            <div className="text-center">
              <p className="text-[13px] font-bold text-white/70 leading-none">{ganados}</p>
              <p className="text-[9px] text-white/25 mt-0.5">Ganados</p>
            </div>
            <div className="text-center">
              <p className="text-[13px] font-bold text-teal-400/80 leading-none">{gozados}</p>
              <p className="text-[9px] text-white/25 mt-0.5">Gozados</p>
            </div>
            <div className="text-center">
              <p className="text-[13px] font-bold text-blue-400/80 leading-none">{programados}</p>
              <p className="text-[9px] text-white/25 mt-0.5">Programados</p>
            </div>
            <div className="text-center">
              <p className={`text-[13px] font-bold leading-none ${
                disponible === 0 ? "text-white/25" : disponible < 5 ? "text-yellow-400" : "text-emerald-400"
              }`}>{disponible}</p>
              <p className="text-[9px] text-white/25 mt-0.5">Disponibles</p>
            </div>
          </div>

          {/* Leyenda de colores */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1 text-[9px] text-white/20">
              <span className="w-2 h-2 rounded-sm bg-teal-500/60 inline-block" /> Gozados
            </span>
            <span className="flex items-center gap-1 text-[9px] text-white/20">
              <span className="w-2 h-2 rounded-sm bg-blue-500/60 inline-block" /> Programados
            </span>
            <span className="flex items-center gap-1 text-[9px] text-white/20">
              <span className="w-2 h-2 rounded-sm bg-white/10 inline-block" /> Disponible
            </span>
          </div>
        </div>
      ) : (
        /* No elegible — solo mostrar fecha de aniversario */
        <div className="text-[10px] text-white/25 flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-white/20" />
          Elegible a partir del {fmtFecha(emp.fecha_aniversario)}
        </div>
      )}

      {/* ── Vacaciones trabajadas pendientes ──────────────────────── */}
      {trabajados > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-orange-500/6 border border-orange-500/15">
          <Briefcase className="w-3 h-3 text-orange-400/60 shrink-0" />
          <p className="text-[10px] text-orange-300/60">
            <span className="font-semibold text-orange-300/80">{trabajados} día{trabajados !== 1 ? "s" : ""}</span> de vacaciones trabajadas
            — pendientes de reprogramar
          </p>
        </div>
      )}

      {/* ── Estado de vacaciones activo hoy ──────────────────────── */}
      {emp.vacacion_activa_tipo === "vacaciones" && (
        <div className="flex items-center gap-1.5 text-[10px] text-teal-400/80">
          <Palmtree className="w-3 h-3" />
          Gozando vacaciones: {fmtFecha(emp.vacacion_activa_inicio)} → {fmtFecha(emp.vacacion_activa_fin)}
        </div>
      )}
      {emp.vacacion_activa_tipo === "vacaciones_trabajadas" && (
        <div className="flex items-center gap-1.5 text-[10px] text-orange-400/70">
          <Briefcase className="w-3 h-3" />
          Trabajando en período vacacional: {fmtFecha(emp.vacacion_activa_inicio)} → {fmtFecha(emp.vacacion_activa_fin)}
        </div>
      )}
      {emp.vacacion_activa_tipo === "vacaciones_programadas" && (
        <div className="flex items-center gap-1.5 text-[10px] text-blue-400/70">
          <Calendar className="w-3 h-3" />
          Vacaciones en curso (programadas): {fmtFecha(emp.vacacion_activa_inicio)} → {fmtFecha(emp.vacacion_activa_fin)}
        </div>
      )}
      {!emp.vacacion_activa_tipo && emp.proximas_programadas_inicio && (
        <div className="flex items-center gap-1.5 text-[10px] text-blue-400/70">
          <Calendar className="w-3 h-3" />
          Próximas programadas: {fmtFecha(emp.proximas_programadas_inicio)}
        </div>
      )}

      {/* ── Alerta: elegible sin planificación ──────────────────── */}
      {urgente && (
        <div className="flex items-center gap-1.5 text-[10px] text-yellow-400/80 px-2 py-1 rounded-lg bg-yellow-400/5 border border-yellow-400/15">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Elegible con {disponible} día{disponible !== 1 ? "s" : ""} disponible{disponible !== 1 ? "s" : ""} — sin programación
        </div>
      )}

      {/* ── Faltas en el último año (aviso si alto) ──────────────── */}
      {emp.faltas_ultimo_anio > 2 && (
        <div className="flex items-center gap-1.5 text-[10px] text-red-400/60">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          {emp.faltas_ultimo_anio} falta{emp.faltas_ultimo_anio !== 1 ? "s" : ""} en el último año
        </div>
      )}

      {/* ── Acción: programar vacaciones ─────────────────────────── */}
      {onProgramar && (
        <div className="pt-1.5 border-t border-white/5">
          <button
            onClick={() => onProgramar(emp.id)}
            className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              emp.es_elegible && disponible > 0
                ? "bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/20 hover:border-teal-500/35"
                : "bg-white/4 hover:bg-white/7 text-white/30 border border-white/8"
            }`}
          >
            <Plus className="w-3 h-3" />
            Registrar vacaciones
          </button>
        </div>
      )}
    </div>
  );
}

// ─── VacacionesTab Principal ──────────────────────────────────────────────────
type SubTab = "activas" | "programadas" | "elegibilidad";

export default function VacacionesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { currentUser } = useAuth();
  const usuario = currentUser?.nombre ?? currentUser?.username ?? "rrhh";

  const [modalEmpleadoId, setModalEmpleadoId] = useState<number | null>(null);
  const [subTab, setSubTab] = useState<SubTab>("activas");
  const [busqueda, setBusqueda] = useState("");
  const [anio, setAnio] = useState(() => new Date().getFullYear());

  const { data: alertas, isLoading: loadingAlertas } = useQuery<{
    proximos: AlertaProxima[];
    alertasDB: any[];
  }>({
    queryKey: ["vacaciones-alertas"],
    queryFn: () => apiFetch(`${API}/vacaciones/alertas`),
    staleTime: 120_000,
  });

  const { data: vacaciones = [], isLoading: loadingVac, refetch: refetchVac } = useQuery<VacacionEvento[]>({
    queryKey: ["vacaciones-lista", anio],
    queryFn: () => apiFetch(`${API}/vacaciones?year=${anio}`),
    staleTime: 60_000,
  });

  const { data: elegibilidad = [], isLoading: loadingEleg } = useQuery<ElegibilidadRow[]>({
    queryKey: ["vacaciones-elegibilidad"],
    queryFn: () => apiFetch(`${API}/vacaciones/elegibilidad`),
    staleTime: 120_000,
    enabled: subTab === "elegibilidad",
  });

  const { data: resumen } = useQuery<{
    activas_hoy: string; programadas: string; anio_actual: string;
    alertas_proximas_30d: string;
  }>({
    queryKey: ["vacaciones-resumen"],
    queryFn: () => apiFetch(`${API}/vacaciones/resumen`),
    staleTime: 60_000,
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["vacaciones-lista"] });
    qc.invalidateQueries({ queryKey: ["vacaciones-elegibilidad"] });
    qc.invalidateQueries({ queryKey: ["vacaciones-alertas"] });
    qc.invalidateQueries({ queryKey: ["vacaciones-resumen"] });
  }

  async function handleAprobar(id: number) {
    try {
      await apiPost(`${API}/vacaciones/${id}/aprobar`, { usuario });
      invalidar();
      toast({ title: "Vacaciones aprobadas" });
    } catch (e: any) {
      toast({ title: "Error al aprobar", description: e?.error ?? "Intenta de nuevo", variant: "destructive" });
    }
  }

  async function handleCancelar(id: number) {
    if (!confirm("¿Cancelar estas vacaciones? Esta acción revertirá las novedades de nómina generadas.")) return;
    try {
      await apiPatch(`${API}/vacaciones/${id}`, { estado: "cancelado", usuario });
      invalidar();
      toast({ title: "Vacaciones canceladas" });
    } catch (e: any) {
      toast({ title: "Error al cancelar", description: e?.error ?? "Intenta de nuevo", variant: "destructive" });
    }
  }

  // Filtros
  const vacActivas = vacaciones.filter((v) =>
    v.tipo_evento === "vacaciones" && !["cancelado", "anulado"].includes(v.estado)
  );
  const vacProgramadas = vacaciones.filter((v) =>
    v.tipo_evento === "vacaciones_programadas" && !["cancelado", "anulado"].includes(v.estado)
  );
  const vacTrabajadas = vacaciones.filter((v) =>
    v.tipo_evento === "vacaciones_trabajadas" && !["cancelado", "anulado"].includes(v.estado)
  );

  const vacActivasFilt = vacActivas.filter((v) =>
    !busqueda || v.employee_nombre.toLowerCase().includes(busqueda.toLowerCase())
  );
  const vacProgramadasFilt = vacProgramadas.filter((v) =>
    !busqueda || v.employee_nombre.toLowerCase().includes(busqueda.toLowerCase())
  );
  const vacTrabajadasFilt = vacTrabajadas.filter((v) =>
    !busqueda || v.employee_nombre.toLowerCase().includes(busqueda.toLowerCase())
  );
  const elegFilt = elegibilidad.filter((e) =>
    !busqueda || e.nombre_completo.toLowerCase().includes(busqueda.toLowerCase())
  );

  const alertasUrgentes = alertas?.proximos?.filter((p) => !p.ya_tiene_programadas) ?? [];

  return (
    <div className="flex flex-col gap-5">

      {/* Alertas de aniversario */}
      {alertasUrgentes.length > 0 && (
        <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-yellow-400" />
            <p className="text-sm font-semibold text-yellow-300">
              {alertasUrgentes.length} colaborador{alertasUrgentes.length !== 1 ? "es" : ""} próximos a aniversario sin vacaciones programadas
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {alertasUrgentes.map((a) => (
              <button
                key={a.employee_id}
                onClick={() => setModalEmpleadoId(a.employee_id)}
                className="flex items-center gap-1.5 bg-yellow-400/10 hover:bg-yellow-400/20 border border-yellow-400/15 hover:border-yellow-400/35 rounded-lg px-2.5 py-1.5 transition-all text-left group"
                title="Clic para programar vacaciones"
              >
                <User className="w-3 h-3 text-yellow-400/70 group-hover:text-yellow-300 transition-colors" />
                <div>
                  <p className="text-[11px] font-semibold text-yellow-200 group-hover:text-yellow-100">{a.nombre_completo}</p>
                  <p className="text-[9px] text-yellow-400/60">
                    Aniversario en {a.dias_restantes} día{a.dias_restantes !== 1 ? "s" : ""} · {fmtFecha(a.fecha_aniversario)}
                  </p>
                  <p className="text-[9px] text-yellow-400/40 group-hover:text-yellow-400/70 transition-colors mt-0.5">
                    Clic para programar →
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {resumen && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "En vacaciones hoy", value: resumen.activas_hoy, icon: <Palmtree className="w-4 h-4" />, cls: "text-teal-400", bg: "bg-teal-400/5 border-teal-400/10" },
            { label: "Programadas", value: resumen.programadas, icon: <Calendar className="w-4 h-4" />, cls: "text-blue-400", bg: "bg-blue-400/5 border-blue-400/10" },
            { label: `Total año ${anio}`, value: resumen.anio_actual, icon: <Umbrella className="w-4 h-4" />, cls: "text-white", bg: "bg-white/5 border-white/8" },
            { label: "Alertas 30 días", value: resumen.alertas_proximas_30d, icon: <Bell className="w-4 h-4" />, cls: "text-yellow-400", bg: "bg-yellow-400/5 border-yellow-400/10" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} border rounded-2xl p-4 flex items-center gap-3`}>
              <span className={s.cls}>{s.icon}</span>
              <div>
                <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                <p className="text-[11px] text-white/35">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sub-tabs */}
        <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
          {([
            { key: "activas", label: "Activas & Trabajadas", count: vacActivas.length + vacTrabajadas.length },
            { key: "programadas", label: "Programadas", count: vacProgramadas.length },
            { key: "elegibilidad", label: "Elegibilidad", count: elegibilidad.filter(e => e.es_elegible).length },
          ] as const).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                subTab === key
                  ? "bg-teal-600 text-white shadow"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                  subTab === key ? "bg-white/20 text-white" : "bg-white/8 text-white/30"
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Selector de año (para activas/programadas) */}
        {subTab !== "elegibilidad" && (
          <select
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="bg-[#07111f] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/60 outline-none"
          >
            {[new Date().getFullYear() + 1, new Date().getFullYear(), new Date().getFullYear() - 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}

        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar colaborador..."
            className="w-full bg-[#07111f] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-teal-500/40"
          />
        </div>

        {/* Refrescar */}
        <button
          onClick={() => { refetchVac(); invalidar(); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl text-xs text-white/50 hover:text-white transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>

        {/* Nuevo */}
        <button
          onClick={() => setModalEmpleadoId(0)}
          className="flex items-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-500 rounded-xl text-xs font-semibold text-white transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Registrar
        </button>
      </div>

      {/* ── Sub-tab: Activas & Trabajadas ─── */}
      {subTab === "activas" && (
        <div className="space-y-4">
          {loadingVac ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* Activas */}
              {vacActivasFilt.length > 0 && (
                <div>
                  <p className="text-[10px] text-teal-400/60 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Palmtree className="w-3 h-3" /> Vacaciones aprobadas ({vacActivasFilt.length})
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {vacActivasFilt.map((ev) => (
                      <VacacionCard key={ev.id} ev={ev} onAprobar={handleAprobar} onCancelar={handleCancelar} />
                    ))}
                  </div>
                </div>
              )}

              {/* Trabajadas */}
              {vacTrabajadasFilt.length > 0 && (
                <div>
                  <p className="text-[10px] text-orange-400/60 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Briefcase className="w-3 h-3" /> Vacaciones trabajadas ({vacTrabajadasFilt.length})
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {vacTrabajadasFilt.map((ev) => (
                      <VacacionCard key={ev.id} ev={ev} onAprobar={handleAprobar} onCancelar={handleCancelar} />
                    ))}
                  </div>
                </div>
              )}

              {vacActivasFilt.length === 0 && vacTrabajadasFilt.length === 0 && (
                <div className="flex flex-col items-center justify-center py-14 gap-3">
                  <Palmtree className="w-10 h-10 text-white/10" />
                  <p className="text-sm text-white/30">Sin vacaciones para {anio}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Sub-tab: Programadas ─── */}
      {subTab === "programadas" && (
        <div>
          {loadingVac ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
          ) : vacProgramadasFilt.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <Calendar className="w-10 h-10 text-white/10" />
              <p className="text-sm text-white/30">Sin vacaciones programadas para {anio}</p>
              <button
                onClick={() => setModalEmpleadoId(0)}
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-xl text-xs font-semibold text-white transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Programar vacaciones
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {vacProgramadasFilt.map((ev) => (
                <VacacionCard key={ev.id} ev={ev} onAprobar={handleAprobar} onCancelar={handleCancelar} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Sub-tab: Elegibilidad ─── */}
      {subTab === "elegibilidad" && (
        <div>
          {loadingEleg ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
            </div>
          ) : elegFilt.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <Users2Icon className="w-10 h-10 text-white/10" />
              <p className="text-sm text-white/30">No hay resultados</p>
            </div>
          ) : (
            <>
              {/* Resumen de contadores */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <p className="text-xs text-white/30">
                  {elegFilt.filter(e => e.es_elegible).length} elegibles ·{" "}
                  {elegFilt.filter(e => !e.es_elegible).length} aún no elegibles
                </p>
                <div className="flex items-center gap-2 ml-auto flex-wrap">
                  {elegFilt.filter(e => e.saldo_disponible > 0 && !e.vacacion_activa_tipo && !e.proximas_programadas_inicio).length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-yellow-400/80 bg-yellow-400/8 border border-yellow-400/15 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {elegFilt.filter(e => e.saldo_disponible > 0 && !e.vacacion_activa_tipo && !e.proximas_programadas_inicio).length} sin programar
                    </span>
                  )}
                  {elegFilt.filter(e => e.dias_trabajados_vac > 0).length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-orange-400/70 bg-orange-400/8 border border-orange-400/15 px-2 py-0.5 rounded-full">
                      <Briefcase className="w-2.5 h-2.5" />
                      {elegFilt.filter(e => e.dias_trabajados_vac > 0).length} con vac. trabajadas
                    </span>
                  )}
                </div>
              </div>

              {/* Nota sobre cálculo del saldo */}
              <div className="mb-4 px-3 py-2.5 rounded-xl bg-white/3 border border-white/6 text-[10px] text-white/25 leading-relaxed">
                <span className="text-white/40 font-semibold">Saldo de vacaciones</span>
                {" "}— Ley GT: 15 días laborables por año completo de servicio.
                {" "}<span className="text-teal-400/50">Gozados</span> = vacaciones normales aprobadas.
                {" "}<span className="text-blue-400/50">Programados</span> = vacaciones_programadas pendientes no iniciadas.
                {" "}<span className="text-orange-400/50">Trabajadas</span> = laboró en período vacacional; no descuentan saldo pero deben reprogramarse.
                {" "}Simplificación: se cuentan Lun-Sáb (no se descuentan feriados nacionales).
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {elegFilt.map((emp) => (
                  <ElegibilidadRow key={emp.id} emp={emp} onProgramar={(id) => setModalEmpleadoId(id)} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal */}
      {modalEmpleadoId !== null && (
        <ModalNuevoVacaciones
          onClose={() => setModalEmpleadoId(null)}
          usuario={usuario}
          initialEmpleadoId={modalEmpleadoId > 0 ? modalEmpleadoId : undefined}
        />
      )}
    </div>
  );
}

// tiny shim so we don't have to import just for the empty state
function Users2Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
