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
  
// ─── Tarjeta de Empleado ──────────────────────────────────────────────────────

export function EmpleadoCard({ emp, onClick }: { emp: Empleado; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-[#0c1929] border border-white/8 rounded-xl p-4 hover:border-primary/30 hover:bg-primary/5 cursor-pointer transition-all group"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0 ${avatarColor(emp.nombreCompleto)}`}>
          {iniciales(emp.nombreCompleto)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate group-hover:text-primary transition-colors">
            {emp.nombreCompleto}
          </p>
          <p className="text-[11px] text-white/40 truncate">{emp.puesto ?? "Colaborador"}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          <EstadoBadge estado={emp.estadoLaboral} />
          {emp.area && (
            <span className="text-[10px] px-2 py-0.5 rounded-full border text-white/40 bg-white/4 border-white/8">
              {emp.area}
            </span>
          )}
        </div>
        {emp.telefono && (
          <span className="flex items-center gap-1 text-[10px] text-white/25">
            <Phone className="w-2.5 h-2.5" />
            {emp.telefono}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Fila de Empleado (tabla) ─────────────────────────────────────────────────

export function EmpleadoRow({ emp, onClick, onEdit }: { emp: Empleado; onClick: () => void; onEdit: () => void }) {
  const { active: deleteModeActive, requestDelete } = useDeleteMode();
  return (
    <tr className="border-b border-white/5 hover:bg-white/2 transition-colors group cursor-pointer" onClick={onClick}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 ${avatarColor(emp.nombreCompleto)}`}>
            {iniciales(emp.nombreCompleto)}
          </div>
          <div>
            <p className="text-sm text-white font-medium group-hover:text-primary transition-colors">{emp.nombreCompleto}</p>
            {emp.correo && <p className="text-[11px] text-white/30">{emp.correo}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <code className="text-xs text-white/40 font-mono">{maskDpi(emp.dpi)}</code>
      </td>
      <td className="px-4 py-3">
        <div>
          {emp.telefono ? <p className="text-xs text-white/70">{emp.telefono}</p> : <span className="text-xs text-white/20">—</span>}
          {emp.telefonoSecundario && <p className="text-[10px] text-white/30">{emp.telefonoSecundario}</p>}
        </div>
      </td>
      <td className="px-4 py-3">
        <div>
          <p className="text-xs text-white/70">{emp.puesto ?? "—"}</p>
          {emp.area && <p className="text-[10px] text-white/35">{emp.area}</p>}
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="text-xs text-white/60">{emp.supervisorNombre ?? "—"}</p>
      </td>
      <td className="px-4 py-3">
        <TipoPersonalBadge tipo={emp.tipoPersonal ?? "guardia"} />
      </td>
      <td className="px-4 py-3">
        <EstadoBadge estado={emp.estadoLaboral} />
      </td>
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onEdit}
            className="text-white/25 hover:text-primary transition-colors p-1"
            title="Editar"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {deleteModeActive && (
            <button
              onClick={() => requestDelete({ entidad: "empleado", entidad_id: emp.id, entidad_descripcion: emp.nombreCompleto })}
              title="Solicitar eliminación"
              className="p-1 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors border border-red-500/20"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
