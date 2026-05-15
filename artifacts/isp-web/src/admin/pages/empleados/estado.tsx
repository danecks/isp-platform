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
import { type EvalCausaJusta } from "./indemnizacion";
  
export const TIPO_EGRESO_BAJA = [
  { v: "renuncia",               l: "Renuncia Voluntaria" },
  { v: "despido_justificado",    l: "Despido Justificado" },
  { v: "despido_injustificado",  l: "Despido Injustificado" },
  { v: "mutuo_acuerdo",          l: "Mutuo Acuerdo" },
  { v: "finalizacion_contrato",  l: "Finalización de Contrato" },
];

export interface RubroBaja { rubro: string; descripcion: string; monto: number; }
export interface SimBaja {
  empleado_nombre: string; tipo_egreso: string; fecha_egreso: string;
  rubros: RubroBaja[]; totalGeneral: number;
}

// ─── Modal: Suspender empleado (pide rango de fechas + motivo) ───────────────
// Cuando se cambia estado a "suspendido" desde la ficha, debe crear el
// evento RRHH equivalente al de RRHH > Eventos para que la nómina descuente
// los días y aparezca en planilla IGSS con fechas reales.
export function ModalSuspenderEmpleado({
  emp, onClose, onConfirm,
}: {
  emp: Empleado;
  onClose: () => void;
  onConfirm: (extras: { fechaDesde: string; fechaHasta: string; observaciones: string }) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const in7d  = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().split("T")[0]; })();
  const [fechaDesde, setFechaDesde] = useState(today);
  const [fechaHasta, setFechaHasta] = useState(in7d);
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);

  const dias = (() => {
    if (!fechaDesde || !fechaHasta || fechaDesde > fechaHasta) return 0;
    const a = new Date(fechaDesde + "T00:00:00");
    const b = new Date(fechaHasta + "T00:00:00");
    return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  })();

  function submit() {
    if (!fechaDesde || !fechaHasta) { setError("Ambas fechas son requeridas"); return; }
    if (fechaDesde > fechaHasta)   { setError("La fecha desde no puede ser mayor que la fecha hasta"); return; }
    onConfirm({ fechaDesde, fechaHasta, observaciones: observaciones.trim() });
  }

  const inputCls = "w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-amber-500/40";

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-amber-500/20 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Suspender Colaborador</p>
            <p className="text-[11px] text-white/40 truncate">{emp.nombreCompleto}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-2.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-300/80">
              Se creará un <span className="font-semibold">evento RRHH de suspensión aprobado</span> con las fechas indicadas. Los días del rango se descontarán automáticamente en nómina y planilla IGSS.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-white/50 mb-1 block">Suspensión desde</label>
              <input type="date" value={fechaDesde} onChange={(e) => { setError(null); setFechaDesde(e.target.value); }} className={inputCls} />
            </div>
            <div>
              <label className="text-[11px] text-white/50 mb-1 block">Suspensión hasta</label>
              <input type="date" value={fechaHasta} onChange={(e) => { setError(null); setFechaHasta(e.target.value); }} min={fechaDesde} className={inputCls} />
            </div>
          </div>

          {dias > 0 && (
            <div className="text-[11px] text-white/50 text-center">
              <span className="text-amber-300 font-semibold">{dias}</span> {dias === 1 ? "día" : "días"} de suspensión
            </div>
          )}

          <div>
            <label className="text-[11px] text-white/50 mb-1 block">Motivo / observaciones (opcional)</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={3}
              placeholder="Ej. Suspensión por incumplimiento de procedimientos..."
              className={inputCls + " resize-none"}
            />
          </div>

          {error && (
            <div className="text-[11px] text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl text-xs text-white/60 transition-colors">
              Cancelar
            </button>
            <button onClick={submit} className="flex-1 py-2.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 rounded-xl text-xs text-amber-300 font-semibold transition-colors">
              Confirmar suspensión
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ModalBajaEmpleado({
  emp, onClose, onSuccess,
}: {
  emp: Empleado;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep]           = useState<"form" | "preview">("form");
  const [tipoEgreso, setTipo]     = useState("renuncia");
  const [fechaEgreso, setFecha]   = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading]     = useState(false);
  const [sim, setSim]             = useState<SimBaja | null>(null);
  const [evalCausa, setEvalCausa] = useState<EvalCausaJusta | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const sess = () => getSessionToken();
  const hdr  = () => ({ "Content-Type": "application/json", "x-isp-session": sess() });

  useEffect(() => {
    setEvalLoading(true);
    fetch(`${API_BASE}/empleados/${emp.id}/evaluar-causa-justa`, { headers: hdr() })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setEvalCausa(data);
        if (data?.sugerencia && data.sugerencia !== tipoEgreso) {
          setTipo(data.sugerencia);
        }
      })
      .finally(() => setEvalLoading(false));
  }, [emp.id]);

  async function handleSimular() {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/prestaciones/simular-liquidacion`, {
        method: "POST", headers: hdr(),
        body: JSON.stringify({ employee_id: emp.id, tipo_egreso: tipoEgreso, fecha_egreso: fechaEgreso }),
      }).then(async (res) => { if (!res.ok) throw new Error((await res.json()).error ?? "Error"); return res.json(); });
      setSim({
        empleado_nombre: r.nombre_completo,
        tipo_egreso: tipoEgreso,
        fecha_egreso: fechaEgreso,
        rubros: r.liquidacion?.rubros ?? [],
        totalGeneral: r.liquidacion?.totalGeneral ?? 0,
      });
      setStep("preview");
    } catch (e: unknown) {
      toast({ title: "Error al calcular", description: (e as Error).message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function handleConfirmar() {
    if (!sim) return;
    setLoading(true);
    try {
      await fetch(`${API_BASE}/prestaciones/liquidaciones`, {
        method: "POST", headers: hdr(),
        body: JSON.stringify({ employee_id: emp.id, tipo_egreso: tipoEgreso, fecha_egreso: fechaEgreso }),
      }).then(async (res) => { if (!res.ok) throw new Error((await res.json()).error ?? "Error"); return res.json(); });
      toast({ title: "Baja confirmada", description: `${emp.nombreCompleto} ha sido dado de baja y su liquidación ha sido registrada.` });
      onSuccess();
      onClose();
    } catch (e: unknown) {
      toast({ title: "Error al confirmar baja", description: (e as Error).message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  const inputCls = "w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-orange-500/40";

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-orange-500/20 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
            <UserX className="w-4 h-4 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Dar de Baja a Colaborador</p>
            <p className="text-[11px] text-white/40 truncate">{emp.nombreCompleto}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Banner de advertencia */}
          <div className="flex items-start gap-2 bg-orange-500/8 border border-orange-500/20 rounded-xl px-3 py-2.5">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-orange-300/80">
              Esta acción marcará al colaborador como <span className="font-semibold text-orange-300">BAJA</span> y generará su liquidación final conforme a la ley guatemalteca.
            </p>
          </div>

          {step === "form" && (
            <>
              {/* Info del empleado */}
              <div className="bg-white/3 rounded-xl p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-white/40">Colaborador</span>
                  <span className="text-white/80 font-medium">{emp.nombreCompleto}</span>
                </div>
                {emp.puesto && (
                  <div className="flex justify-between">
                    <span className="text-white/40">Puesto</span>
                    <span className="text-white/60">{emp.puesto}</span>
                  </div>
                )}
                {emp.sueldoBase && (
                  <div className="flex justify-between">
                    <span className="text-white/40">Sueldo Base</span>
                    <span className="text-white/60">{fmtQ(Number(emp.sueldoBase))}</span>
                  </div>
                )}
                {emp.fechaIngreso && (
                  <div className="flex justify-between">
                    <span className="text-white/40">Ingreso</span>
                    <span className="text-white/60">{fmtFecha(emp.fechaIngreso)}</span>
                  </div>
                )}
              </div>

              {/* Sugerencia del sistema */}
              {evalLoading ? (
                <div className="flex items-center gap-2 bg-white/3 border border-white/8 rounded-xl px-3 py-2.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white/30" />
                  <span className="text-xs text-white/30">Evaluando historial...</span>
                </div>
              ) : evalCausa && evalCausa.causas.length > 0 ? (
                <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-3 py-2.5 space-y-1.5">
                  <p className="text-[11px] font-semibold text-amber-300 uppercase tracking-wide flex items-center gap-1">
                    <Scale className="w-3 h-3" /> Sugerencia del Sistema
                  </p>
                  <p className="text-[11px] text-white/50">
                    Se detectaron <span className="text-amber-300 font-semibold">{evalCausa.causas.length}</span> causa(s) justa(s).
                    {" "}Recomendación: <span className="text-amber-300 font-semibold">{evalCausa.sugerencia === "despido_justificado" ? "Despido Justificado" : "Despido Injustificado"}</span>.
                  </p>
                  <div className="space-y-1">
                    {evalCausa.causas.slice(0, 3).map((c, i) => (
                      <p key={i} className="text-[10px] text-white/30 pl-2 border-l-2 border-amber-500/20">
                        {c.descripcion} — <span className="font-mono text-amber-300/60">{c.articulo}</span>
                      </p>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/20 italic">
                    Resumen: {evalCausa.resumen.total_faltas} faltas, {evalCausa.resumen.llamadas_atencion_1 + evalCausa.resumen.llamadas_atencion_2} llamadas atención, {evalCausa.resumen.actas_previas} actas previas.
                    La decisión final es suya.
                  </p>
                </div>
              ) : evalCausa ? (
                <div className="flex items-center gap-2 bg-white/3 border border-white/8 rounded-xl px-3 py-2.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  <span className="text-[11px] text-white/40">Sin causas justas detectadas en el historial.</span>
                </div>
              ) : null}

              {/* Tipo de egreso */}
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">Motivo de Egreso</label>
                <select value={tipoEgreso} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
                  {TIPO_EGRESO_BAJA.map(({ v, l }) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              {/* Fecha de baja */}
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">Fecha de Baja</label>
                <input type="date" value={fechaEgreso} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
              </div>

              {/* Acciones */}
              <div className="flex gap-2 pt-1">
                <button onClick={onClose} className="flex-1 py-2 text-xs text-white/40 hover:text-white/70 border border-white/10 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleSimular}
                  disabled={loading || !fechaEgreso}
                  className="flex-1 py-2 text-xs font-semibold bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Calcular Liquidación →
                </button>
              </div>
            </>
          )}

          {step === "preview" && sim && (
            <>
              {/* Desglose de rubros */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {sim.rubros.map((r) => (
                  <div key={r.rubro} className="flex items-start justify-between px-3 py-2 rounded-xl bg-white/3 border border-white/6 gap-2">
                    <span className="text-[11px] text-white/50 leading-tight">{r.descripcion}</span>
                    <span className="text-xs font-semibold text-white/80 shrink-0">{fmtQ(r.monto)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
                  <span className="text-sm font-bold text-orange-300">TOTAL LIQUIDACIÓN</span>
                  <span className="text-base font-bold text-orange-300">{fmtQ(sim.totalGeneral)}</span>
                </div>
              </div>

              {/* Acción irreversible */}
              <div className="flex items-start gap-2 bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-red-300/80">
                  Al confirmar, <span className="font-semibold text-red-200">{emp.nombreCompleto}</span> quedará marcado como <span className="font-semibold text-red-200">BAJA</span> en el sistema. Esta acción es irreversible.
                </p>
              </div>

              {/* Acciones */}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setStep("form")} className="py-2 px-3 text-xs text-white/40 hover:text-white/70 border border-white/10 rounded-xl transition-colors">
                  ← Atrás
                </button>
                <button
                  onClick={handleConfirmar}
                  disabled={loading}
                  className="flex-1 py-2 text-xs font-semibold bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                  Confirmar Baja y Liquidar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Ficha de Empleado (5 pestañas) ────────────────────────────────────

// ── TabAmonestacionesEmpleado ────────────────────────────────────────────────

// ─── Modal: Confirmación de Reingreso ─────────────────────────────────────────
export function ReingresoModal({
  existing,
  onConfirm,
  onCancel,
}: {
  existing: {
    id: number; nombreCompleto: string; estadoLaboral: string;
    fechaIngreso: string | null; fechaBaja: string | null; motivoBaja: string | null;
    puesto: string | null; area: string | null; periodosPrevios: number;
  };
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  async function handleConfirm() {
    setSaving(true);
    try { await onConfirm(); } finally { setSaving(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/80 backdrop-blur-sm p-4 pt-12 overflow-auto">
      <div className="bg-[#07111f] border border-amber-500/30 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-5 py-4 border-b border-white/8 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white">Reingreso de colaborador</h3>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-200/90 leading-relaxed">
            Ya existe un colaborador con ese DPI que fue dado de baja. Puede registrar este ingreso como un <b>reingreso</b> (nueva alta laboral). Se conservará su historial de períodos anteriores, pero los saldos de vacaciones y prestaciones acumuladas inician en cero.
          </div>

          <div className="space-y-2">
            <p className="text-[10px] text-white/30 uppercase tracking-widest">Empleado anterior</p>
            <div className="bg-[#060e1c] border border-white/10 rounded-lg p-3 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-white/50">Nombre</span><span className="text-white font-medium">{existing.nombreCompleto}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Último puesto</span><span className="text-white">{existing.puesto ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Área</span><span className="text-white">{existing.area ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Fecha ingreso anterior</span><span className="text-white">{fmtDate(existing.fechaIngreso)}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Fecha de baja</span><span className="text-rose-300">{fmtDate(existing.fechaBaja)}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Motivo de baja</span><span className="text-white/80">{existing.motivoBaja ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Períodos previos</span><span className="text-white">{existing.periodosPrevios}</span></div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] text-emerald-400/70 uppercase tracking-widest">Se conserva</p>
            <ul className="text-[11px] text-white/60 space-y-0.5 pl-2">
              <li>• Datos personales (DPI, contacto, foto)</li>
              <li>• Historial de períodos laborales</li>
              <li>• Liquidaciones previas pagadas</li>
              <li>• Eventos RRHH y disciplinarios</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] text-amber-400/70 uppercase tracking-widest">Se reinicia (nueva alta)</p>
            <ul className="text-[11px] text-white/60 space-y-0.5 pl-2">
              <li>• Saldo de vacaciones → 0 días</li>
              <li>• Prestaciones acumuladas → 0</li>
              <li>• Antigüedad para indemnización</li>
              <li>• Nuevo contrato inicial + post-prueba</li>
            </ul>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-white/8 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1.5 text-xs text-white/60 hover:text-white transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="px-3 py-1.5 text-xs bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 rounded-lg font-medium transition-colors disabled:opacity-40"
          >
            {saving ? "Procesando…" : "Registrar reingreso"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
