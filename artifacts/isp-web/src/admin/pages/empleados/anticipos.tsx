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
  
export interface AnticipoDB {
  id: number;
  cantidad: number;
  estado: string;
  periodo: string | null;
  origen: string;
  fechaSolicitud: string;
  observaciones: string | null;
}

export interface AnticiposEmpleadoData {
  config: {
    limiteAnticipo: number | null;
    tipoLimitePeriodo: string;
    ultimaActualizacionLimiteAt: string | null;
  };
  periodoActual: {
    limite: number | null;
    solicitado: number;
    restante: number | null;
    tieneLimite: boolean;
    periodo: string | null;
  };
  historial: AnticipoDB[];
}

export const ESTADO_ANT_COLOR: Record<string, string> = {
  pendiente: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  aprobada:  "text-green-400 bg-green-400/10 border-green-400/20",
  rechazada: "text-red-400 bg-red-400/10 border-red-400/20",
  pagada:    "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

// ─── Tab: Vacaciones ──────────────────────────────────────────────────────────


export function TabAnticipo({ emp }: { emp: Empleado }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editandoLimite, setEditandoLimite] = useState(false);
  const [nuevoLimite, setNuevoLimite] = useState<string>("");
  const [guardandoLimite, setGuardandoLimite] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<AnticiposEmpleadoData>({
    queryKey: ["employee-anticipos", emp.id],
    queryFn: () => fetch(`${API_BASE}/employees/${emp.id}/anticipos`, { headers: sessionHeader() }).then((r) => r.json()),
    staleTime: 30_000,
  });

  async function guardarLimite() {
    setGuardandoLimite(true);
    try {
      const valor = nuevoLimite.trim() === "" ? null : parseInt(nuevoLimite);
      if (valor !== null && (isNaN(valor) || valor < 0)) {
        toast({ title: "Error", description: "El límite debe ser un número positivo.", variant: "destructive" });
        return;
      }
      const r = await fetch(`${API_BASE}/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...sessionHeader() },
        body: JSON.stringify({ limiteAnticipo: valor }),
      });
      if (!r.ok) throw new Error("Error");
      toast({ title: "Límite actualizado", description: valor === null ? "Sin límite configurado" : `Q${valor.toLocaleString("es-GT")}` });
      setEditandoLimite(false);
      qc.invalidateQueries({ queryKey: ["employee-anticipos", emp.id] });
      qc.invalidateQueries({ queryKey: ["empleados"] });
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar el límite.", variant: "destructive" });
    } finally {
      setGuardandoLimite(false);
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }
  if (isError || !data) {
    return <div className="text-center py-10 text-white/30 text-sm">Error al cargar información de anticipos.</div>;
  }

  const { config, periodoActual, historial } = data;
  const pct = periodoActual.tieneLimite && periodoActual.limite
    ? Math.min(100, Math.round((periodoActual.solicitado / periodoActual.limite) * 100))
    : 0;

  return (
    <div className="space-y-5">

      {/* ── Configuración de límite ── */}
      <div className="bg-[#0c1929] border border-white/8 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-primary" />
            Configuración de anticipos
          </h3>
          {!editandoLimite && (
            <button
              onClick={() => { setNuevoLimite(config.limiteAnticipo?.toString() ?? ""); setEditandoLimite(true); }}
              className="flex items-center gap-1 text-xs text-white/30 hover:text-primary transition-colors"
            >
              <Pencil className="w-3 h-3" /> Editar límite
            </button>
          )}
        </div>

        {editandoLimite ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-white/40 text-sm">Q</div>
            <input
              type="number"
              min="0"
              value={nuevoLimite}
              onChange={(e) => setNuevoLimite(e.target.value)}
              placeholder="Ej: 500 (vacío = sin límite)"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary/40"
            />
            <button
              onClick={guardarLimite}
              disabled={guardandoLimite}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-50"
            >
              <Save className="w-3 h-3" />
              {guardandoLimite ? "..." : "Guardar"}
            </button>
            <button
              onClick={() => setEditandoLimite(false)}
              className="px-2 py-1.5 rounded-lg bg-white/5 text-white/40 text-xs hover:bg-white/10"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/3 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-primary">
                {config.limiteAnticipo !== null ? `Q${config.limiteAnticipo.toLocaleString("es-GT")}` : "—"}
              </p>
              <p className="text-[10px] text-white/30 mt-0.5">Límite autorizado</p>
            </div>
            <div className="bg-white/3 rounded-lg p-3 text-center">
              <p className="text-lg font-bold text-yellow-400">
                Q{periodoActual.solicitado.toLocaleString("es-GT")}
              </p>
              <p className="text-[10px] text-white/30 mt-0.5">Solicitado en período</p>
            </div>
            <div className="bg-white/3 rounded-lg p-3 text-center">
              <p className={`text-lg font-bold ${
                !periodoActual.tieneLimite ? "text-white/30"
                : (periodoActual.restante ?? 0) > 0 ? "text-green-400" : "text-red-400"
              }`}>
                {!periodoActual.tieneLimite ? "∞"
                  : `Q${(periodoActual.restante ?? 0).toLocaleString("es-GT")}`}
              </p>
              <p className="text-[10px] text-white/30 mt-0.5">Disponible</p>
            </div>
          </div>
        )}

        {periodoActual.tieneLimite && periodoActual.limite && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-white/40">
              <span>Uso del período</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 bg-white/8 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-yellow-500" : "bg-primary"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {periodoActual.periodo && (
              <p className="text-[10px] text-white/25">Período activo: {periodoActual.periodo.replace("-dia", " — día ")}</p>
            )}
          </div>
        )}

        {config.ultimaActualizacionLimiteAt && (
          <p className="text-[10px] text-white/20 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Límite actualizado: {new Date(config.ultimaActualizacionLimiteAt).toLocaleDateString("es-GT")}
          </p>
        )}
      </div>

      {/* ── Historial ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-white/60 uppercase tracking-widest flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Historial de anticipos ({historial.length})
          </h3>
          <button onClick={() => refetch()} className="text-white/20 hover:text-white/60 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {historial.length === 0 ? (
          <div className="text-center py-8">
            <Wallet className="w-8 h-8 text-white/10 mx-auto mb-2" />
            <p className="text-xs text-white/25">Sin anticipos registrados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {historial.map((a) => (
              <div key={a.id} className="bg-[#0c1929] border border-white/6 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-white">Q{a.cantidad.toLocaleString("es-GT")}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${ESTADO_ANT_COLOR[a.estado] ?? "text-white/40 bg-white/5 border-white/10"}`}>
                      {a.estado}
                    </span>
                    {a.origen === "whatsapp" ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20">
                        <MessageCircle className="w-2.5 h-2.5" /> WA
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/20">Manual</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] text-white/30">
                      {new Date(a.fechaSolicitud).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                    {a.periodo && <span className="text-[10px] text-white/20 font-mono">{a.periodo.replace("-dia", " día")}</span>}
                  </div>
                  {a.observaciones && (
                    <p className="text-[10px] text-white/25 mt-0.5 truncate">{a.observaciones}</p>
                  )}
                </div>
                <p className="text-xs font-mono text-white/20 shrink-0">ANT-{a.id}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Asignación Operativa ────────────────────────────────────────────────

