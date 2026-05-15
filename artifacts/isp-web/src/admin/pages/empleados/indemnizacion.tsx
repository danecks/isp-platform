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
  
export interface CausaJusta {
  causal: string;
  articulo: string;
  descripcion: string;
  evidencia: string[];
}

export interface EvalCausaJusta {
  sugerencia: string;
  causas: CausaJusta[];
  resumen: {
    total_faltas: number;
    faltas_mes_actual: number;
    llamadas_atencion_1: number;
    llamadas_atencion_2: number;
    actas_previas: number;
    total_eventos: number;
  };
}

export interface HistDisciplinario {
  fecha: string;
  tipo_evento: string;
  observaciones: string | null;
  notas: string | null;
  numero_acta: number | null;
}

export const LABEL_TIPO_EVENTO: Record<string, string> = {
  falta: "Falta",
  falta_injustificada: "Falta Injustificada",
  llamada_atencion_1: "Llamada de Atención 1 (verbal)",
  llamada_atencion_2: "Llamada de Atención 2 (escrita)",
  acta_administrativa: "Acta Administrativa",
  amonestacion: "Amonestación",
  suspension: "Suspensión",
  suspension_disciplinaria: "Suspensión Disciplinaria",
  abandono_parcial: "Abandono Parcial",
};

export function TabIndemnizacion({ emp }: { emp: Empleado }) {
  const { toast } = useToast();
  const hdr = () => ({ "Content-Type": "application/json", "x-isp-session": getSessionToken() });
  const [evalData, setEvalData] = useState<EvalCausaJusta | null>(null);
  const [historial, setHistorial] = useState<HistDisciplinario[]>([]);
  const [loading, setLoading] = useState(true);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/empleados/${emp.id}/evaluar-causa-justa`, { headers: hdr() }).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/empleados/${emp.id}/historial-disciplinario`, { headers: hdr() }).then(r => r.ok ? r.json() : null),
    ]).then(([ev, hist]) => {
      setEvalData(ev);
      setHistorial(hist?.historial ?? []);
    }).finally(() => setLoading(false));
  }, [emp.id]);

  async function handleGenerarAviso() {
    setGenerandoPdf(true);
    try {
      const { generarAvisoInspector } = await import("@/lib/pdfRrhh");
      const [configRes, numRes] = await Promise.all([
        fetch(`${API_BASE}/actas/datos-para-pdf/${emp.id}`, { headers: hdr() }).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE}/actas/siguiente-numero`, { method: "POST", headers: hdr() }).then(r => r.ok ? r.json() : { numero: 0 }),
      ]);
      const cfg = configRes?.config || {};
      const empData = configRes?.empleado || {};
      const puesto = configRes?.puesto || {};
      const eventos = (configRes?.eventos_recientes || [])
        .filter((e: any) => ["falta","falta_injustificada","llamada_atencion_1","llamada_atencion_2","acta_administrativa","amonestacion","suspension","suspension_disciplinaria"].includes(e.tipo_evento))
        .slice(0, 15);

      const causaTexto = evalData?.causas?.map(c => `${c.descripcion} (${c.articulo})`).join("; ") || "Incumplimiento laboral reiterado";

      const datos: DatosActa = {
        numero_acta: numRes.numero || 0,
        representante_nombre: cfg.representante_nombre || "Representante Legal",
        representante_dpi: cfg.representante_dpi || "",
        direccion_empresa: cfg.direccion_empresa || "14 calle 15-52 zona 1, Barrio Gerona, Ciudad de Guatemala",
        nombre_empresa: cfg.nombre_empresa || "Investigaciones y Seguridad Profesional S.A.",
        empleado_nombre: empData.nombre_completo || emp.nombreCompleto,
        empleado_dpi: empData.dpi || emp.dpi || "",
        empleado_fecha_ingreso: empData.fecha_ingreso || emp.fechaIngreso || "",
        empleado_cargo: empData.cargo || "Agente de Seguridad",
        puesto_nombre: puesto.puesto_nombre || "",
        cliente_nombre: puesto.cliente_nombre || "",
        fecha_evento: new Date().toISOString().split("T")[0],
        hechos: causaTexto,
        notas_sistema: evalData?.causas?.flatMap(c => c.evidencia) || [],
        causal: causaTexto,
        articulo_legal: evalData?.causas?.[0]?.articulo || "Art. 77 del Código de Trabajo",
        eventos_historial: eventos.map((e: any) => ({ fecha: e.fecha, tipo: e.tipo_evento, notas: e.notas || e.observaciones || "" })),
      };

      await generarAvisoInspector(datos);
      toast({ title: "Aviso al Inspector generado", description: `Con historial de ${eventos.length} eventos disciplinarios` });
    } catch (err) {
      toast({ title: "Error al generar PDF", variant: "destructive", description: String(err) });
    } finally { setGenerandoPdf(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {evalData && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Scale className="w-4 h-4 text-amber-400" />
            <p className="text-white/60 text-sm font-semibold uppercase tracking-wide">Evaluación de Causa Justa</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/3 border border-white/8 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-white">{evalData.resumen.total_faltas}</p>
              <p className="text-[10px] text-white/40">Faltas Totales</p>
            </div>
            <div className="bg-white/3 border border-white/8 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-amber-300">{evalData.resumen.llamadas_atencion_1 + evalData.resumen.llamadas_atencion_2}</p>
              <p className="text-[10px] text-white/40">Llamadas Atención</p>
            </div>
            <div className="bg-white/3 border border-white/8 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-red-300">{evalData.resumen.actas_previas}</p>
              <p className="text-[10px] text-white/40">Actas Previas</p>
            </div>
          </div>

          {evalData.causas.length > 0 ? (
            <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-red-300 uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Causas Justas Detectadas ({evalData.causas.length})
              </p>
              {evalData.causas.map((c, i) => (
                <div key={i} className="bg-white/3 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white/80">{c.descripcion}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/20 font-mono">{c.articulo}</span>
                  </div>
                  {c.evidencia.length > 0 && (
                    <div className="text-[10px] text-white/30 space-y-0.5 pl-2 border-l border-white/8">
                      {c.evidencia.slice(0, 3).map((e, j) => <p key={j}>{e}</p>)}
                      {c.evidencia.length > 3 && <p className="text-white/20">+{c.evidencia.length - 3} más</p>}
                    </div>
                  )}
                </div>
              ))}
              <p className="text-[10px] text-white/30 italic">
                Sugerencia del sistema: <span className="text-amber-300 font-semibold">{evalData.sugerencia === "despido_justificado" ? "Despido Justificado" : "Despido Injustificado"}</span>
                {" — "}la decisión final es del administrador.
              </p>
            </div>
          ) : (
            <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <p className="text-xs text-green-300/80">No se detectan causas justas de despido en el historial de este colaborador.</p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-white/40" />
            <p className="text-white/60 text-sm font-semibold uppercase tracking-wide">Historial Disciplinario</p>
          </div>
          <span className="text-[10px] text-white/30">{historial.length} registros</span>
        </div>

        {historial.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-white/10 mb-2" />
            <p className="text-white/30 text-xs">Sin registros disciplinarios</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {historial.map((h, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-2 rounded-xl bg-white/3 border border-white/6">
                <div className="shrink-0 text-right w-16">
                  <p className="text-[10px] text-white/40">{new Date(h.fecha).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "2-digit" })}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white/70">{LABEL_TIPO_EVENTO[h.tipo_evento] || h.tipo_evento}</p>
                  {(h.notas || h.observaciones) && (
                    <p className="text-[10px] text-white/30 truncate">{h.notas || h.observaciones}</p>
                  )}
                </div>
                {h.numero_acta && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono shrink-0">#{h.numero_acta}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleGenerarAviso}
        disabled={generandoPdf}
        className="w-full py-2.5 flex items-center justify-center gap-2 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/20 rounded-xl text-xs text-amber-300 font-semibold transition-colors disabled:opacity-50"
      >
        {generandoPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
        Generar Aviso al Inspector de Trabajo
      </button>
    </div>
  );
}

// ─── Modal: Dar de Baja a Empleado (desde ficha) ─────────────────────────────

