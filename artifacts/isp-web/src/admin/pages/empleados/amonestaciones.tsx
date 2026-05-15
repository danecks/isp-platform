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
  
export function TabAmonestacionesEmpleado({ empId }: { empId: number }) {
  const [data, setData] = useState<any[] | "loading" | null>("loading");
  useEffect(() => {
    let cancel = false;
    fetch(`/api/amonestaciones/empleado/${empId}`, { headers: { "x-isp-session": getSessionToken() } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(j => { if (!cancel) setData(j); })
      .catch(() => { if (!cancel) setData(null); });
    return () => { cancel = true; };
  }, [empId]);

  if (data === "loading") return <div className="text-white/40 text-sm">Cargando…</div>;
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="w-10 h-10 text-white/20 mx-auto mb-2" />
        <div className="text-white/50 text-sm">Sin amonestaciones registradas</div>
        <a href="/admin/rrhh/amonestaciones" className="text-amber-300 text-xs hover:underline mt-2 inline-block">
          Ir al módulo de amonestaciones →
        </a>
      </div>
    );
  }

  const totalEcon = data.filter(a => a.tipo === "economica" && a.estado === "activa").reduce((s, a) => s + Number(a.monto || 0), 0);
  const llamadas = data.filter(a => a.tipo === "llamada_atencion" && a.estado === "activa").length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/5 border border-white/10 rounded-lg p-2 text-center">
          <div className="text-xs text-white/50">Total</div>
          <div className="text-lg text-white font-bold">{data.length}</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-center">
          <div className="text-xs text-blue-300">Llamadas atención</div>
          <div className="text-lg text-blue-200 font-bold">{llamadas}</div>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2 text-center">
          <div className="text-xs text-orange-300">Económicas activas</div>
          <div className="text-lg text-orange-200 font-bold">Q {totalEcon.toFixed(2)}</div>
        </div>
      </div>
      <div className="space-y-2">
        {data.map((a: any) => (
          <div key={a.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${a.tipo === "economica" ? "bg-orange-500/15 text-orange-300" : "bg-blue-500/15 text-blue-300"}`}>
                    {a.tipo === "economica" ? "Económica" : "Llamada"}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    a.estado === "anulada" ? "bg-gray-500/15 text-gray-300" :
                    a.descontado ? "bg-emerald-500/15 text-emerald-300" :
                    a.tipo === "economica" ? "bg-amber-500/15 text-amber-300" : "bg-white/10 text-white/70"
                  }`}>
                    {a.estado === "anulada" ? "Anulada" : a.descontado ? "Descontada" : a.tipo === "economica" ? "Pendiente planilla" : "Activa"}
                  </span>
                  <span className="text-white/40 text-xs">{new Date(a.fecha).toLocaleDateString("es-GT")}</span>
                </div>
                <div className="text-white text-sm mt-1">{a.motivo}</div>
                {a.descripcion && <div className="text-white/60 text-xs mt-1">{a.descripcion}</div>}
                <div className="text-white/30 text-[10px] mt-1">
                  Por {a.creado_por_username || "—"} ({a.creado_por_rol})
                </div>
              </div>
              {a.tipo === "economica" && (
                <div className="text-orange-300 font-semibold tabular-nums">Q {Number(a.monto).toFixed(2)}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TabSolicitudEmpleo ────────────────────────────────────────────────────────
