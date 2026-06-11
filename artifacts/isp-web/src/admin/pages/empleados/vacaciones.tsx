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
  
export interface VacSaldo {
  id: number;
  nombre_completo: string;
  fecha_ingreso: string;
  sueldo_base: string;
  estado_laboral: string;
  dias_servicio: number;
  anios_servicio: number;
  fecha_aniversario: string;
  dias_para_aniversario: number;
  es_elegible: boolean;
  dias_ganados_proporcional: string;
  dias_ganados_completo: number;
  total_autorizados: number;
  balance_proporcional: string;
  balance_completo: number;
  es_anticipada: boolean;
  dias_en_deuda: string;
  tasa_diaria: string;
  monto_en_deuda: string;
  vacacion_activa: {
    id: number; tipo_evento: string;
    fecha_inicio: string; fecha_fin: string | null;
    estado: string; dias: number;
  } | null;
  historial: Array<{
    id: number; tipo_evento: string;
    fecha_inicio: string; fecha_fin: string | null;
    estado: string; observaciones: string | null; dias: number;
  }> | null;
}

export const TIPO_VAC_LABEL: Record<string, string> = {
  vacaciones:             "Vacaciones",
  vacaciones_programadas: "Programadas",
  vacaciones_trabajadas:  "Trabajadas",
};

export const VAC_TIPO_COLOR: Record<string, string> = {
  vacaciones:             "bg-green-400/10 text-green-300 border-green-400/20",
  vacaciones_programadas: "bg-blue-400/10 text-blue-300 border-blue-400/20",
  vacaciones_trabajadas:  "bg-amber-400/10 text-amber-300 border-amber-400/20",
};

export const VAC_EST_COLOR: Record<string, string> = {
  aprobado:   "text-green-400",
  pendiente:  "text-yellow-400",
  completado: "text-blue-400",
  cancelado:  "text-white/30 line-through",
  anulado:    "text-white/20 line-through",
};

export function fmtFechaVac(d: string | null | undefined) {
  if (!d) return "—";
  const s = d.length <= 10 ? d + "T00:00:00Z" : d;
  return new Date(s).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}


export function TabVacaciones({ emp }: { emp: Empleado }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const sess       = () => getSessionToken();
  const userNombre = (() => { try { return JSON.parse(sess()).nombre ?? "rrhh"; } catch { return "rrhh"; } })();

  const [modalOpen, setModalOpen]     = useState(false);
  const [tipo, setTipo]               = useState<"vacaciones" | "vacaciones_programadas" | "vacaciones_trabajadas">("vacaciones");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin]       = useState("");
  const [obs, setObs]                 = useState("");
  const [saving, setSaving]           = useState(false);
  const [confirmarAnticipada, setConfirmarAnticipada] = useState(false);

  const { data: saldo, isLoading, isError, refetch } = useQuery<VacSaldo>({
    queryKey: ["vac-saldo-emp", emp.id],
    queryFn:  () => fetch(`${API_BASE}/vacaciones/saldo/${emp.id}`, { headers: sessionHeader() }).then((r) => r.json()),
    staleTime: 30_000,
  });

  function calcDiasHabiles(ini: string, fin: string): number {
    if (!ini || !fin) return 0;
    let count = 0;
    const cur = new Date(ini + "T12:00:00Z");
    const end = new Date(fin + "T12:00:00Z");
    while (cur <= end) { if (cur.getUTCDay() !== 0) count++; cur.setUTCDate(cur.getUTCDate() + 1); }
    return count;
  }

  const diasSolicitados = fechaInicio && fechaFin ? calcDiasHabiles(fechaInicio, fechaFin) : (fechaInicio ? 1 : 0);
  const balanceProp     = saldo ? parseFloat(saldo.balance_proporcional) : 0;
  const esAnticipada    = tipo === "vacaciones" && diasSolicitados > 0 && (diasSolicitados > balanceProp || !saldo?.es_elegible);
  // Las vacaciones anticipadas requieren al menos 3 meses (90 días) de servicio.
  const cumpleMinAnticipada = (saldo?.dias_servicio ?? 0) >= 90;
  const bloqueadaPorMinimo  = esAnticipada && !cumpleMinAnticipada;

  async function handleRegistrar() {
    if (!fechaInicio) {
      toast({ title: "Fecha requerida", description: "Indica la fecha de inicio.", variant: "destructive" });
      return;
    }
    if (bloqueadaPorMinimo) {
      toast({
        title: "No permitido",
        description: "Las vacaciones anticipadas requieren al menos 3 meses de servicio.",
        variant: "destructive",
      });
      return;
    }
    if (esAnticipada && !confirmarAnticipada) { setConfirmarAnticipada(true); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        employee_id:       emp.id,
        tipo,
        fecha_inicio:      fechaInicio,
        fecha_fin:         fechaFin || fechaInicio,
        observaciones:     obs || undefined,
        usuario:           userNombre,
        forzar_anticipada: esAnticipada,
      };
      const r = await fetch(`${API_BASE}/vacaciones`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": sess() },
        body:    JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Error al registrar");
      toast({ title: "Vacaciones registradas", description: data.mensaje ?? "Evento creado." });
      setModalOpen(false);
      setFechaInicio(""); setFechaFin(""); setObs("");
      setConfirmarAnticipada(false);
      refetch();
      qc.invalidateQueries({ queryKey: ["vacaciones-lista"] });
      qc.invalidateQueries({ queryKey: ["vacaciones-elegibilidad"] });
    } catch (err: unknown) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const fmtQ = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" });

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
    </div>
  );
  if (isError || !saldo) return (
    <div className="text-center py-12 text-white/30 text-sm">Error al cargar saldo de vacaciones.</div>
  );

  const proporcional = parseFloat(saldo.dias_ganados_proporcional);
  const tasaDiaria   = parseFloat(saldo.tasa_diaria);

  return (
    <div className="space-y-4">

      {/* ── Encabezado ── */}
      <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5 text-primary" /> Estado de Vacaciones
          </h3>
          <button onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 text-xs bg-primary text-black font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Autorizar
          </button>
        </div>

        {saldo.es_elegible ? (
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Colaborador apto — {saldo.anios_servicio} año{saldo.anios_servicio !== 1 ? "s" : ""} de servicio
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-amber-400">
            <Info className="w-3.5 h-3.5" />
            Aún no cumple 1 año · aniversario {fmtFechaVac(saldo.fecha_aniversario)}
            {saldo.dias_para_aniversario > 0 && ` (faltan ${saldo.dias_para_aniversario} días)`}
          </div>
        )}

        {saldo.vacacion_activa && (
          <div className="bg-green-500/10 border border-green-400/20 rounded-lg px-3 py-2 text-xs text-green-300 flex items-center gap-2">
            <Umbrella className="w-3.5 h-3.5 shrink-0" />
            {TIPO_VAC_LABEL[saldo.vacacion_activa.tipo_evento]} desde {fmtFechaVac(saldo.vacacion_activa.fecha_inicio)}
            {saldo.vacacion_activa.fecha_fin && ` al ${fmtFechaVac(saldo.vacacion_activa.fecha_fin)}`}
            {" · "}{saldo.vacacion_activa.dias} días hábiles
          </div>
        )}

        {saldo.es_anticipada && (
          <div className="bg-red-500/10 border border-red-400/20 rounded-lg px-3 py-2 text-xs text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {parseFloat(saldo.dias_en_deuda).toFixed(1)} día(s) anticipados en deuda
            — se recuperarán {fmtQ.format(parseFloat(saldo.monto_en_deuda))} en liquidación
          </div>
        )}
      </div>

      {/* ── Métricas ── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Ganado proporcional", value: proporcional.toFixed(1), color: "text-primary" },
          { label: "Total autorizado",    value: saldo.total_autorizados, color: "text-white" },
          { label: "Balance disponible",  value: Math.max(0, balanceProp).toFixed(1),
            color: balanceProp < 0 ? "text-red-400" : "text-green-400" },
        ].map((m) => (
          <div key={m.label} className="bg-[#0c1929] border border-white/8 rounded-xl p-3 text-center">
            <div className={`text-xl font-bold ${m.color}`}>{m.value}</div>
            <div className="text-[10px] text-white/50 mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-white/30 text-center">
        Tasa diaria: {fmtQ.format(tasaDiaria)} · sueldo {fmtQ.format(parseFloat(saldo.sueldo_base))}
      </div>

      {/* ── Historial ── */}
      {saldo.historial && saldo.historial.length > 0 && (
        <div className="bg-[#0c1929] border border-white/8 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/8">
            <h4 className="text-xs font-semibold text-white/60 uppercase tracking-widest flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" /> Historial
            </h4>
          </div>
          <div className="divide-y divide-white/5">
            {saldo.historial.map((ev) => (
              <div key={ev.id} className="px-4 py-2.5 flex items-center gap-3">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${VAC_TIPO_COLOR[ev.tipo_evento] ?? "bg-white/5 text-white/40 border-white/10"}`}>
                  {TIPO_VAC_LABEL[ev.tipo_evento] ?? ev.tipo_evento}
                </span>
                <span className="text-xs text-white/70 flex-1">
                  {fmtFechaVac(ev.fecha_inicio)}
                  {ev.fecha_fin && ev.fecha_fin !== ev.fecha_inicio && ` → ${fmtFechaVac(ev.fecha_fin)}`}
                  <span className="text-white/30"> · {ev.dias} días</span>
                </span>
                <span className={`text-[10px] font-medium ${VAC_EST_COLOR[ev.estado] ?? "text-white/40"}`}>
                  {ev.estado}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal ── */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/8">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Umbrella className="w-4 h-4 text-primary" /> Autorizar Vacaciones
                <span className="text-xs font-normal text-white/40 ml-1">— {emp.nombreCompleto}</span>
              </h3>
              <button onClick={() => { setModalOpen(false); setConfirmarAnticipada(false); }}
                className="text-white/40 hover:text-white/70"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 space-y-4">

              {/* Alerta confirmación anticipada */}
              {confirmarAnticipada && (
                <div className="bg-amber-500/10 border border-amber-400/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Vacaciones anticipadas
                  </div>
                  <p className="text-xs text-amber-200/80 leading-relaxed">
                    {!saldo.es_elegible ? (
                      <>
                        El colaborador <strong>aún no cumple 1 año</strong> de servicio
                        (aniversario {fmtFechaVac(saldo.fecha_aniversario)}), por lo que estas son
                        vacaciones anticipadas. Autorizas <strong>{diasSolicitados} días</strong>;
                        lo que exceda lo ganado proporcionalmente (<strong>{balanceProp.toFixed(1)} días</strong>)
                        {" "}se <strong>recuperará automáticamente en la liquidación</strong> si se
                        da de baja antes de haber ganado ese tiempo.
                      </>
                    ) : (
                      <>
                        Autorizas <strong>{diasSolicitados} días</strong> pero el colaborador
                        solo ha ganado <strong>{balanceProp.toFixed(1)} días</strong> proporcionalmente.
                        El excedente de <strong>{(diasSolicitados - balanceProp).toFixed(1)} días</strong>
                        {" "}({fmtQ.format((diasSolicitados - balanceProp) * tasaDiaria)}) se
                        <strong> recuperará automáticamente en la liquidación</strong> si se
                        da de baja antes de haber ganado ese tiempo.
                      </>
                    )}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmarAnticipada(false)}
                      className="flex-1 text-xs text-white/50 border border-white/10 rounded-lg py-1.5 hover:bg-white/5">
                      Regresar
                    </button>
                    <button onClick={handleRegistrar} disabled={saving}
                      className="flex-1 text-xs bg-amber-500 text-black font-semibold rounded-lg py-1.5 hover:bg-amber-400 flex items-center justify-center gap-1">
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      Confirmar anticipadas
                    </button>
                  </div>
                </div>
              )}

              {!confirmarAnticipada && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs text-white/50">Tipo de evento</label>
                    <select value={tipo} onChange={(e) => { setTipo(e.target.value as typeof tipo); setConfirmarAnticipada(false); }}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50">
                      <option value="vacaciones">Vacaciones (goce inmediato)</option>
                      <option value="vacaciones_programadas">Vacaciones programadas (a futuro)</option>
                      <option value="vacaciones_trabajadas">Vacaciones trabajadas (laboró en período)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-white/50">Fecha inicio</label>
                      <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-white/50">Fecha fin</label>
                      <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} min={fechaInicio}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50" />
                    </div>
                  </div>

                  {diasSolicitados > 0 && (
                    <div className={`rounded-lg px-3 py-2 text-xs flex items-center justify-between border ${
                      esAnticipada
                        ? "bg-amber-500/10 border-amber-400/30 text-amber-300"
                        : "bg-green-500/10 border-green-400/20 text-green-300"}`}>
                      <span>{diasSolicitados} día{diasSolicitados !== 1 ? "s" : ""} hábil{diasSolicitados !== 1 ? "es" : ""} seleccionado{diasSolicitados !== 1 ? "s" : ""}</span>
                      {esAnticipada
                        ? <span className="flex items-center gap-1 font-medium"><AlertTriangle className="w-3 h-3" /> Anticipada</span>
                        : <span className="flex items-center gap-1 font-medium"><CheckCircle2 className="w-3 h-3" /> Dentro del saldo</span>}
                    </div>
                  )}

                  {bloqueadaPorMinimo && (
                    <div className="rounded-lg px-3 py-2 text-xs bg-red-500/10 border border-red-400/30 text-red-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Requiere al menos 3 meses de servicio para anticipar vacaciones
                      {typeof saldo.dias_servicio === "number" && ` (lleva ${saldo.dias_servicio} días).`}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs text-white/50">Observaciones (opcional)</label>
                    <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
                      placeholder="Motivo, instrucciones adicionales…"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-primary/50" />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setModalOpen(false)}
                      className="flex-1 text-xs text-white/50 border border-white/10 rounded-lg py-2 hover:bg-white/5">
                      Cancelar
                    </button>
                    <button onClick={handleRegistrar} disabled={saving || !fechaInicio || bloqueadaPorMinimo}
                      className="flex-1 text-xs bg-primary text-black font-semibold rounded-lg py-2 hover:bg-primary/90 flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      {bloqueadaPorMinimo ? "No permitido aún" : esAnticipada ? "Revisar · es anticipada" : "Autorizar"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

