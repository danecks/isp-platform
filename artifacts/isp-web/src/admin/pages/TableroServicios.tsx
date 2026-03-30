import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  LayoutGrid,
  MapPin,
  Clock,
  Calendar,
  Shield,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileText,
  DollarSign,
  Building2,
  UserCheck,
  Loader2,
  ExternalLink,
} from "lucide-react";

const API = "http://localhost:8080/api";
const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";
const h = () => ({ "Content-Type": "application/json", "x-isp-session": getSession() });

// ── Helpers ──────────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<string, string> = {
  guardia_extra: "Guardia Extra",
  ampliacion_horario: "Ampliación de Horario",
  cobertura_evento: "Cobertura de Evento",
  custodia_extra: "Custodia Extra",
  apoyo_temporal: "Apoyo Temporal",
  servicio_especial: "Servicio Especial",
  guardia_extraordinario: "Cobertura Extraordinaria",
};

const PRIORIDAD_COLOR: Record<string, string> = {
  urgente: "bg-red-500/20 text-red-300 border-red-500/40",
  alta: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  normal: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  baja: "bg-slate-500/20 text-slate-300 border-slate-500/40",
};

const ESTADO_COLOR: Record<string, string> = {
  nueva: "bg-slate-500/20 text-slate-300",
  en_revision: "bg-blue-500/20 text-blue-300",
  cubierta: "bg-emerald-500/20 text-emerald-300",
  pendiente_facturacion: "bg-amber-500/20 text-amber-300",
  cerrada: "bg-purple-500/20 text-purple-300",
  cancelada: "bg-red-500/20 text-red-300",
};

const ESTADO_LABEL: Record<string, string> = {
  nueva: "Nueva",
  en_revision: "En Revisión",
  cubierta: "Cubierta",
  pendiente_facturacion: "Pend. Facturación",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
  pendiente_operaciones: "Pend. Operaciones",
  pendiente_rrhh: "Pend. RRHH",
};

const COBERTURA_LABEL: Record<string, string> = {
  disponible: "Agente Disponible",
  relevo: "Relevo",
  horas_extra: "Horas Extra",
  cambio_titular: "Cambio de Titular",
  contratacion_nueva: "Contratación Nueva",
};

function fmtFecha(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMonto(n: number | null) {
  if (n == null) return "—";
  return `Q${Number(n).toLocaleString("es-GT", { minimumFractionDigits: 2 })}`;
}

// ── Tipo de tarjeta ───────────────────────────────────────────────────────────
interface Tarjeta {
  id: string;
  tipo_solicitud: string;
  fecha: string;
  fecha_fin: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  cantidad_guardias: number;
  prioridad: string;
  descripcion: string | null;
  estado_general: string;
  estado_operaciones: string;
  estado_rrhh: string;
  estado_comercial: string;
  estado_facturacion: string;
  agente_id: number | null;
  agente_nombre: string | null;
  agente_nombre_completo: string | null;
  agente_telefono: string | null;
  tipo_cobertura: string | null;
  cubierta_con: string | null;
  monto_estimado: number | null;
  tarifa_aplicada: string | null;
  observaciones_operaciones: string | null;
  observaciones_comercial: string | null;
  tarjeta_activa: boolean;
  resumen_final: string | null;
  resumen_generado_at: string | null;
  fecha_inicio_real: string | null;
  fecha_fin_real: string | null;
  cliente_nombre: string | null;
  cliente_portal_id: string | null;
  sede_nombre: string | null;
  sede_direccion: string | null;
  puesto_nombre: string | null;
  tarea_ops_estado: string | null;
  tarea_rrhh_estado: string | null;
  tarea_comercial_estado: string | null;
  estado_contabilidad?: string;
}

// ── Modal de detalle / acción ─────────────────────────────────────────────────
function ModalDetalle({
  tarjeta,
  onClose,
  onRefresh,
}: {
  tarjeta: Tarjeta;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"info" | "resumen" | "contabilidad">("info");
  const [obsResumen, setObsResumen] = useState("");
  const [estadoContab, setEstadoContab] = useState(tarjeta.estado_contabilidad ?? "pendiente_autorizacion");

  const resumenMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/solicitudes-servicio/${tarjeta.id}/resumen`, {
        method: "POST",
        headers: h(),
        body: JSON.stringify({ observacionesFinales: obsResumen || undefined }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Resumen generado", description: "El resumen final fue creado exitosamente." });
      qc.invalidateQueries({ queryKey: ["tablero-servicios"] });
      onRefresh();
      onClose();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: String(e.message) }),
  });

  const contabMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/solicitudes-servicio/${tarjeta.id}/contabilidad`, {
        method: "PATCH",
        headers: h(),
        body: JSON.stringify({ estadoContabilidad: estadoContab }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Contabilidad actualizada" });
      qc.invalidateQueries({ queryKey: ["tablero-servicios"] });
      onRefresh();
      onClose();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: String(e.message) }),
  });

  const resumenParsed = (() => {
    if (!tarjeta.resumen_final) return null;
    try { return JSON.parse(tarjeta.resumen_final); } catch { return null; }
  })();

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#0d1b2e] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Shield className="w-4 h-4 text-primary" />
            {TIPO_LABEL[tarjeta.tipo_solicitud] ?? tarjeta.tipo_solicitud}
            <span className="text-white/40 text-xs font-mono ml-1">#{tarjeta.id.slice(-8)}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Tabs: sin "Asignar Agente" — la cobertura se gestiona desde el Pizarrón */}
        <div className="flex gap-1 border-b border-white/10 mb-4">
          {(["info", "resumen", "contabilidad"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs rounded-t transition-colors ${
                tab === t ? "bg-primary/20 text-primary border-b-2 border-primary" : "text-white/50 hover:text-white"
              }`}
            >
              {t === "info" ? "Información" : t === "resumen" ? "Resumen Final" : "Contabilidad"}
            </button>
          ))}
        </div>

        {/* Tab: Información */}
        {tab === "info" && (
          <div className="space-y-3 text-sm">
            {/* Banner: cobertura se gestiona desde el Pizarrón */}
            <Link href="/admin/operaciones" onClick={onClose}>
              <div className="flex items-center gap-2.5 bg-primary/8 border border-primary/20 rounded-xl px-3 py-2.5 hover:bg-primary/12 transition-colors cursor-pointer group">
                <LayoutGrid className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-primary/90">Cobertura operativa → Pizarrón Operativo</p>
                  <p className="text-[10px] text-white/40 mt-0.5">La asignación de agentes y gestión diaria se hacen desde el Pizarrón.</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-primary/40 group-hover:text-primary/70 shrink-0" />
              </div>
            </Link>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-lg p-3 space-y-1">
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Cliente</p>
                <p className="font-medium">{tarjeta.cliente_nombre ?? "—"}</p>
                {tarjeta.sede_nombre && <p className="text-white/50 text-xs">{tarjeta.sede_nombre}</p>}
                {tarjeta.sede_direccion && <p className="text-white/30 text-xs">{tarjeta.sede_direccion}</p>}
              </div>
              <div className="bg-white/5 rounded-lg p-3 space-y-1">
                <p className="text-[10px] text-white/40 uppercase tracking-wider">Puesto / Fechas</p>
                <p className="font-medium">{tarjeta.puesto_nombre ?? "No especificado"}</p>
                <p className="text-white/50 text-xs">
                  {fmtFecha(tarjeta.fecha)}
                  {tarjeta.fecha_fin && ` → ${fmtFecha(tarjeta.fecha_fin)}`}
                </p>
                {(tarjeta.hora_inicio || tarjeta.hora_fin) && (
                  <p className="text-white/40 text-xs">{tarjeta.hora_inicio} – {tarjeta.hora_fin}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Guardias</p>
                <p className="text-lg font-bold text-primary">{tarjeta.cantidad_guardias}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Prioridad</p>
                <span className={`text-xs px-2 py-0.5 rounded border ${PRIORIDAD_COLOR[tarjeta.prioridad] ?? ""}`}>
                  {tarjeta.prioridad}
                </span>
              </div>
              <div className="bg-white/5 rounded-lg p-2 text-center">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Estado</p>
                <span className={`text-xs px-2 py-0.5 rounded ${ESTADO_COLOR[tarjeta.estado_general] ?? "bg-white/10 text-white"}`}>
                  {ESTADO_LABEL[tarjeta.estado_general] ?? tarjeta.estado_general}
                </span>
              </div>
            </div>

            {tarjeta.descripcion && (
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Descripción</p>
                <p className="text-white/70 text-xs">{tarjeta.descripcion}</p>
              </div>
            )}

            {tarjeta.agente_nombre_completo ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-center gap-3">
                <UserCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs text-emerald-300 font-semibold">{tarjeta.agente_nombre_completo}</p>
                  {tarjeta.tipo_cobertura && (
                    <p className="text-[11px] text-white/50">{COBERTURA_LABEL[tarjeta.tipo_cobertura] ?? tarjeta.tipo_cobertura}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white/4 border border-white/8 rounded-lg p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400/60 shrink-0" />
                <p className="text-[11px] text-white/40">Sin agente asignado — ir al Pizarrón Operativo para cubrir</p>
              </div>
            )}

            {/* Estado por área */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { label: "Operaciones", val: tarjeta.estado_operaciones },
                { label: "RRHH", val: tarjeta.estado_rrhh },
                { label: "Comercial", val: tarjeta.estado_comercial },
              ].map(({ label, val }) => (
                <div key={label} className="bg-white/4 border border-white/8 rounded-lg p-2 text-center">
                  <p className="text-[9px] text-white/30 uppercase tracking-wider mb-1">{label}</p>
                  <span className={`text-[10px] font-medium ${
                    val === "completado" || val === "cubierta" ? "text-emerald-400" :
                    val === "pendiente" ? "text-amber-400" : "text-white/50"
                  }`}>{val ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Resumen Final */}
        {tab === "resumen" && (
          <div className="space-y-4 text-sm">
            {resumenParsed ? (
              <div className="space-y-3">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300 text-xs font-medium">
                    Resumen generado el {new Date(resumenParsed.generado_en).toLocaleString("es-GT")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ["Tipo de Servicio", resumenParsed.tipo_servicio],
                    ["Agente Asignado", resumenParsed.agente],
                    ["Tipo Cobertura", resumenParsed.tipo_cobertura],
                    ["Monto Estimado", fmtMonto(resumenParsed.monto_estimado)],
                    ["Estado Final", ESTADO_LABEL[resumenParsed.estado_final] ?? resumenParsed.estado_final],
                    ["Acepta Cobro Adicional", resumenParsed.acepta_cobro_adicional ? "Sí" : "No"],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-white/5 rounded p-2">
                      <p className="text-white/40 text-[10px] uppercase tracking-wider">{k}</p>
                      <p className="text-white/90 font-medium mt-0.5">{v ?? "—"}</p>
                    </div>
                  ))}
                </div>
                {resumenParsed.observaciones_finales && (
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Observaciones finales</p>
                    <p className="text-white/70 text-xs">{resumenParsed.observaciones_finales}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-white/50 text-xs">
                  Al generar el resumen se consolidará toda la información de esta solicitud y quedará disponible para el cliente en su portal.
                </p>
                <div>
                  <Label className="text-white/60 text-xs mb-1 block">Observaciones finales (opcional)</Label>
                  <Textarea className="bg-white/5 border-white/10 text-white text-xs min-h-[80px]" value={obsResumen} onChange={e => setObsResumen(e.target.value)} placeholder="Notas adicionales para el cliente..." />
                </div>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => resumenMut.mutate()}
                  disabled={resumenMut.isPending}
                >
                  {resumenMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                  Generar Resumen Final
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Tab: Contabilidad */}
        {tab === "contabilidad" && (
          <div className="space-y-4 text-sm">
            <div className="bg-white/5 rounded-lg p-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-white/40 uppercase tracking-wider text-[10px]">Monto Estimado</p>
                <p className="text-primary font-bold text-base">{fmtMonto(tarjeta.monto_estimado)}</p>
              </div>
              <div>
                <p className="text-white/40 uppercase tracking-wider text-[10px]">Tarifa Aplicada</p>
                <p className="font-medium">{tarjeta.tarifa_aplicada ?? "—"}</p>
              </div>
              <div>
                <p className="text-white/40 uppercase tracking-wider text-[10px]">Estado Facturación</p>
                <p className="font-medium">{tarjeta.estado_facturacion ?? "—"}</p>
              </div>
              <div>
                <p className="text-white/40 uppercase tracking-wider text-[10px]">Acepta Cobro Adicional</p>
                <p className="font-medium">{tarjeta.tipo_cobertura ? "Sí" : "No definido"}</p>
              </div>
            </div>

            <div>
              <Label className="text-white/60 text-xs mb-1 block">Estado de contabilidad</Label>
              <Select value={estadoContab} onValueChange={setEstadoContab}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0d1b2e] border-white/10 text-white">
                  <SelectItem value="pendiente_autorizacion">Pendiente de Autorización</SelectItem>
                  <SelectItem value="autorizado">Autorizado</SelectItem>
                  <SelectItem value="facturado">Facturado</SelectItem>
                  <SelectItem value="cobrado">Cobrado ✓</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full bg-primary hover:bg-primary/90 text-white"
              onClick={() => contabMut.mutate()}
              disabled={contabMut.isPending}
            >
              {contabMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <DollarSign className="w-4 h-4 mr-2" />}
              Actualizar Estado Contable
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" className="text-white/50 hover:text-white" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Tarjeta visual ────────────────────────────────────────────────────────────
function TarjetaCard({ t, onClick }: { t: Tarjeta; onClick: () => void }) {
  const tieneResumen = !!t.resumen_final;
  const tieneAgente = !!t.agente_nombre_completo || !!t.agente_nombre;
  const agenteName = t.agente_nombre_completo ?? t.agente_nombre;

  return (
    <div
      className="bg-[#0d1b2e] border border-white/10 rounded-xl p-4 hover:border-primary/40 transition-all cursor-pointer flex flex-col gap-3 group"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate">{TIPO_LABEL[t.tipo_solicitud] ?? t.tipo_solicitud}</p>
          <p className="text-[11px] text-white/40 truncate mt-0.5">{t.cliente_nombre ?? "—"}</p>
        </div>
        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase ${PRIORIDAD_COLOR[t.prioridad] ?? ""}`}>
          {t.prioridad}
        </span>
      </div>

      {/* Sede & Puesto */}
      <div className="space-y-1">
        {t.sede_nombre && (
          <div className="flex items-center gap-1.5 text-[11px] text-white/50">
            <MapPin className="w-3 h-3 shrink-0 text-white/30" />
            <span className="truncate">{t.sede_nombre}</span>
          </div>
        )}
        {t.puesto_nombre && (
          <div className="flex items-center gap-1.5 text-[11px] text-white/50">
            <Building2 className="w-3 h-3 shrink-0 text-white/30" />
            <span className="truncate">{t.puesto_nombre}</span>
          </div>
        )}
      </div>

      {/* Fechas */}
      <div className="flex items-center gap-2 text-[11px] text-white/40">
        <Calendar className="w-3 h-3 shrink-0" />
        <span>{fmtFecha(t.fecha)}{t.fecha_fin ? ` → ${fmtFecha(t.fecha_fin)}` : ""}</span>
        {(t.hora_inicio || t.hora_fin) && (
          <>
            <Clock className="w-3 h-3 ml-1" />
            <span>{t.hora_inicio} – {t.hora_fin}</span>
          </>
        )}
      </div>

      {/* Agente asignado */}
      {tieneAgente ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
          <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] text-emerald-300 font-medium truncate">{agenteName}</p>
            {t.tipo_cobertura && (
              <p className="text-[10px] text-white/40">{COBERTURA_LABEL[t.tipo_cobertura] ?? t.tipo_cobertura}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <p className="text-[11px] text-amber-300">Sin agente asignado</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 mt-auto pt-1 border-t border-white/5">
        <span className={`text-[10px] px-2 py-0.5 rounded ${ESTADO_COLOR[t.estado_general] ?? "bg-white/10 text-white"}`}>
          {ESTADO_LABEL[t.estado_general] ?? t.estado_general}
        </span>
        <div className="flex items-center gap-2">
          {t.monto_estimado != null && (
            <span className="text-[10px] text-primary font-bold">{fmtMonto(t.monto_estimado)}</span>
          )}
          {tieneResumen && (
            <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded">
              RESUMEN ✓
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function TableroServicios() {
  const { toast } = useToast();
  const [selTarjeta, setSelTarjeta] = useState<Tarjeta | null>(null);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroPrioridad, setFiltroPrioridad] = useState("todos");

  const { data: tarjetas = [], isLoading, refetch } = useQuery<Tarjeta[]>({
    queryKey: ["tablero-servicios"],
    queryFn: async () => {
      const r = await fetch(`${API}/solicitudes-servicio/tablero`, { headers: h() });
      if (!r.ok) throw new Error("Error al cargar tablero");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const filtradas = tarjetas.filter(t => {
    if (filtroEstado !== "todos" && t.estado_general !== filtroEstado) return false;
    if (filtroPrioridad !== "todos" && t.prioridad !== filtroPrioridad) return false;
    return true;
  });

  const conAgente = tarjetas.filter(t => !!t.agente_id).length;
  const sinAgente = tarjetas.filter(t => !t.agente_id).length;
  const conResumen = tarjetas.filter(t => !!t.resumen_final).length;
  const urgentes = tarjetas.filter(t => t.prioridad === "urgente").length;

  return (
    <AdminLayout title="Seguimiento de Servicios Especiales">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Seguimiento SSA
            </h1>
            <p className="text-sm text-white/40 mt-0.5">Seguimiento administrativo · resúmenes · contabilidad</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-white/10 text-white/60 hover:text-white"
            onClick={() => refetch()}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Actualizar
          </Button>
        </div>

        {/* Banner: contexto de uso */}
        <Link href="/admin/operaciones">
          <div className="flex items-center gap-3 bg-white/3 border border-white/8 rounded-xl px-4 py-3 hover:border-primary/25 transition-colors cursor-pointer group">
            <LayoutGrid className="w-4 h-4 text-primary/60 group-hover:text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-white/50 leading-relaxed">
                <span className="text-white/70 font-medium">Seguimiento administrativo:</span>{" "}
                Para cubrir, asignar o remover agentes ve al{" "}
                <span className="text-primary/80 font-medium">Pizarrón Operativo</span>.
                Esta vista es para resúmenes, contabilidad y estado por área.
              </p>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-white/20 group-hover:text-primary/60 shrink-0" />
          </div>
        </Link>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Activos", val: tarjetas.length, color: "text-primary" },
            { label: "Sin Agente", val: sinAgente, color: sinAgente > 0 ? "text-amber-400" : "text-emerald-400" },
            { label: "Con Agente", val: conAgente, color: "text-emerald-400" },
            { label: "Urgentes", val: urgentes, color: urgentes > 0 ? "text-red-400" : "text-white/60" },
          ].map(s => (
            <div key={s.label} className="bg-[#0d1b2e] border border-white/10 rounded-xl p-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-[11px] text-white/40 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-white/40 uppercase tracking-wider">Filtrar:</span>
          <div className="flex gap-1.5 flex-wrap">
            {["todos", "cubierta", "en_revision", "pendiente_facturacion"].map(e => (
              <button
                key={e}
                onClick={() => setFiltroEstado(e)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  filtroEstado === e
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "border-white/10 text-white/40 hover:text-white"
                }`}
              >
                {e === "todos" ? "Todos" : ESTADO_LABEL[e] ?? e}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 ml-2">
            {["todos", "urgente", "alta", "normal"].map(p => (
              <button
                key={p}
                onClick={() => setFiltroPrioridad(p)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  filtroPrioridad === p
                    ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                    : "border-white/10 text-white/40 hover:text-white"
                }`}
              >
                {p === "todos" ? "Todas prio." : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Grid de tarjetas */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Shield className="w-12 h-12 text-white/10 mb-4" />
            <p className="text-white/30 text-sm">
              {tarjetas.length === 0
                ? "No hay tarjetas operativas activas en este momento."
                : "No hay tarjetas que coincidan con los filtros seleccionados."}
            </p>
            {tarjetas.length === 0 && (
              <p className="text-white/20 text-xs mt-2">
                Las tarjetas se activan cuando comercial marca una solicitud como "registrado".
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtradas.map(t => (
              <TarjetaCard key={t.id} t={t} onClick={() => setSelTarjeta(t)} />
            ))}
          </div>
        )}

        {conResumen > 0 && (
          <p className="text-xs text-white/30 text-center">
            {conResumen} servicio{conResumen !== 1 ? "s" : ""} con resumen generado · disponible en portal de clientes
          </p>
        )}
      </div>

      {selTarjeta && (
        <ModalDetalle
          tarjeta={selTarjeta}
          onClose={() => setSelTarjeta(null)}
          onRefresh={() => refetch()}
        />
      )}
    </AdminLayout>
  );
}
