import { useState } from "react";
import {
  AlertTriangle, Ban, BookOpen, Briefcase, Building2, Calendar, ChevronDown,
  ClipboardList, Download, FileText, Loader2, Shield, User, XCircle,
} from "lucide-react";
import type { EventoRrhh } from "@/lib/pdfRrhh";
import { MOTIVO_ANULACION_LABELS } from "@/lib/pdfRrhh";
import { fmtDateTime, fmtFecha, fmtHora } from "./helpers";
import { ESTADO_CONFIG, TIPO_CONFIG } from "./constants";

export function EventoCard({
  evento,
  onEstadoChange,
  onDescargarBoleta,
  onDescargarActa,
  onDescargarAnulacion,
  onAnular,
  compact,
  label,
}: {
  evento: EventoRrhh;
  onEstadoChange: (id: number, estado: string) => Promise<void>;
  onDescargarBoleta: (evento: EventoRrhh) => void;
  onDescargarActa: (evento: EventoRrhh) => void;
  onDescargarAnulacion: (evento: EventoRrhh) => void;
  onAnular: (evento: EventoRrhh) => void;
  compact?: boolean;
  label?: string;
}) {
  const [showEstadoMenu, setShowEstadoMenu] = useState(false);
  const [loadingEstado, setLoadingEstado] = useState(false);

  const isAnulado = evento.estado === "anulado";
  const estadoCfg = ESTADO_CONFIG[evento.estado] ?? ESTADO_CONFIG.pendiente;
  const tipoCfg = TIPO_CONFIG[evento.tipo_evento] ?? TIPO_CONFIG.falta;
  const numEvento = `ERH-${String(evento.id).padStart(4, "0")}`;
  const docsGenerados = (evento.documentos_generados ?? []) as Array<{ tipo: string; usuario: string; fecha: string }>;

  async function cambiarEstado(nuevoEstado: string) {
    setLoadingEstado(true);
    setShowEstadoMenu(false);
    try {
      await onEstadoChange(evento.id, nuevoEstado);
    } finally {
      setLoadingEstado(false);
    }
  }

  return (
    <div className={`${compact ? "rounded-xl" : "border rounded-2xl"} overflow-hidden transition-colors
      ${isAnulado
        ? `bg-[#0a0a0a] ${compact ? "" : "border-red-500/15"} opacity-80`
        : `${compact ? "bg-[#0b1525]" : "bg-[#07111f] border-white/8 hover:border-white/15"}`}`}
    >
      {label && (
        <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
          evento.tipo_evento === 'horas_extra' ? "text-emerald-400/70 bg-emerald-500/5" : "text-orange-400/70 bg-orange-500/5"
        }`}>
          {label}
        </div>
      )}
      {isAnulado && (
        <div className="bg-red-900/30 border-b border-red-500/20 px-5 py-2.5 flex items-center gap-2">
          <Ban className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-red-400 tracking-widest">ANULADO</span>
            {evento.motivo_anulacion && (
              <span className="text-[11px] text-red-400/60 ml-2">
                — {MOTIVO_ANULACION_LABELS[evento.motivo_anulacion] ?? evento.motivo_anulacion}
              </span>
            )}
          </div>
          {evento.anulado_at && (
            <span className="text-[10px] text-red-400/40 shrink-0">{fmtFecha(evento.anulado_at)}</span>
          )}
        </div>
      )}

      <div className={`${compact ? "px-3 py-2.5" : "px-5 py-3.5"} border-b border-white/6`}>
        <div className="flex items-center gap-2 min-w-0">
          {!compact && (
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center
              ${isAnulado ? "bg-red-500/10 border border-red-500/20" : "bg-purple-500/15 border border-purple-500/20"}`}
            >
              {isAnulado
                ? <XCircle className="w-4 h-4 text-red-400/60" />
                : <ClipboardList className="w-4 h-4 text-purple-400" />
              }
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className={`${compact ? "text-xs" : "text-sm"} font-semibold truncate ${isAnulado ? "text-white/50 line-through" : "text-white"}`}>
              {evento.employee_nombre}
            </p>
            <p className={`${compact ? "text-[10px]" : "text-[11px]"} text-white/30`}>{numEvento} · {fmtFecha(evento.fecha)} {fmtHora(evento.fecha)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${tipoCfg.className} ${isAnulado ? "opacity-40" : ""}`}>
            <AlertTriangle className="w-2.5 h-2.5" />
            {tipoCfg.label}
          </span>
          {isAnulado ? (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${estadoCfg.className}`}>
              {estadoCfg.icon}
              {estadoCfg.label}
            </span>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowEstadoMenu((p) => !p)}
                disabled={loadingEstado}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border cursor-pointer hover:opacity-80 transition-opacity ${estadoCfg.className}`}
              >
                {loadingEstado ? <Loader2 className="w-3 h-3 animate-spin" /> : estadoCfg.icon}
                {estadoCfg.label}
                <ChevronDown className="w-2.5 h-2.5" />
              </button>
              {showEstadoMenu && (
                <div className="absolute left-0 top-full mt-1 z-20 bg-[#0c1929] border border-white/10 rounded-xl shadow-xl min-w-[140px] overflow-hidden">
                  {(["pendiente_aprobacion", "aprobado", "rechazado"] as const)
                    .map((key) => [key, ESTADO_CONFIG[key]] as const)
                    .map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => cambiarEstado(key)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors
                          ${key === evento.estado ? "text-white/80 bg-white/5" : "text-white/50"}`}
                      >
                        {cfg.icon}
                        {cfg.label}
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={`${compact ? "px-3 py-2.5 space-y-2.5" : "p-5 space-y-4"}`}>
        {compact ? (
          <div className="space-y-1 text-[11px]">
            {evento.employee_dpi && (
              <div className="flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-white/20 shrink-0" />
                <span className="text-white/30">DPI</span>
                <span className="text-white/50 font-mono">{evento.employee_dpi}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-white/20 shrink-0" />
              <span className="text-white/30">Por</span>
              <span className="text-white/50">{evento.usuario_generador || "sistema"}</span>
              <span className="text-white/20">·</span>
              <span className="text-white/30 capitalize">{evento.generado_desde || "operaciones"}</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {evento.employee_dpi && (
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-white/25 shrink-0" />
                <div>
                  <p className="text-[10px] text-white/30">DPI</p>
                  <p className="text-xs text-white/60 font-mono">{evento.employee_dpi}</p>
                </div>
              </div>
            )}
            {evento.cliente_nombre && (
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-white/25 shrink-0" />
                <div>
                  <p className="text-[10px] text-white/30">Cliente</p>
                  <p className="text-xs text-white/60 truncate">{evento.cliente_nombre}</p>
                </div>
              </div>
            )}
            {evento.puesto_nombre && (
              <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-white/25 shrink-0" />
                <div>
                  <p className="text-[10px] text-white/30">Puesto</p>
                  <p className="text-xs text-white/60 truncate">{evento.puesto_nombre}</p>
                </div>
              </div>
            )}
            {evento.supervisor_nombre && (
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-white/25 shrink-0" />
                <div>
                  <p className="text-[10px] text-white/30">Supervisor</p>
                  <p className="text-xs text-white/60 truncate">{evento.supervisor_nombre}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-white/25 shrink-0" />
              <div>
                <p className="text-[10px] text-white/30">Registrado por</p>
                <p className="text-xs text-white/60">{evento.usuario_generador || "Sistema"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-white/25 shrink-0" />
              <div>
                <p className="text-[10px] text-white/30">Origen</p>
                <p className="text-xs text-white/60 capitalize">{evento.generado_desde || "operaciones"}</p>
              </div>
            </div>
          </div>
        )}

        {evento.observaciones && (
          <div className={`bg-[#0c1929] border border-white/6 rounded-xl ${compact ? "p-2" : "p-3"}`}>
            <p className="text-[10px] text-white/30 mb-0.5">Observaciones</p>
            <p className={`${compact ? "text-[11px] line-clamp-2" : "text-xs leading-relaxed"} text-white/55`}>{evento.observaciones}</p>
          </div>
        )}

        {!compact && isAnulado && evento.anulado_por && (
          <div className="bg-red-900/10 border border-red-500/15 rounded-xl p-3.5 space-y-2">
            <p className="text-[10px] font-semibold text-red-400/70 uppercase tracking-wide">Auditoría de anulación</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-white/25">Anulado por</p>
                <p className="text-xs text-white/55">{evento.anulado_por}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/25">Fecha / hora</p>
                <p className="text-xs text-white/55">{fmtDateTime(evento.anulado_at || "")}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/25">Motivo</p>
                <p className="text-xs text-white/55">{MOTIVO_ANULACION_LABELS[evento.motivo_anulacion ?? ""] ?? evento.motivo_anulacion}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/25">Estado anterior</p>
                <p className="text-xs text-white/55 capitalize">{evento.estado_anterior?.replace("_", " ") || "—"}</p>
              </div>
            </div>
          </div>
        )}

        {!compact && docsGenerados.length > 0 && (
          <div className={`border rounded-xl p-3 ${isAnulado ? "bg-red-500/5 border-red-500/10 opacity-60" : "bg-purple-500/5 border-purple-500/15"}`}>
            <p className={`text-[10px] mb-2 font-medium ${isAnulado ? "text-red-400/50" : "text-purple-400/60"}`}>
              Documentos generados {isAnulado ? "(anulados)" : ""}
            </p>
            <div className="space-y-1">
              {docsGenerados.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <FileText className={`w-3 h-3 ${isAnulado ? "text-red-400/30" : "text-purple-400/50"}`} />
                  <span className={`text-[11px] capitalize ${isAnulado ? "text-white/25 line-through" : "text-white/40"}`}>{d.tipo}</span>
                  <span className="text-[10px] text-white/20">—</span>
                  <span className="text-[10px] text-white/20">{fmtFecha(d.fecha)} por {d.usuario}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isAnulado ? (
          <button
            onClick={() => onDescargarAnulacion(evento)}
            className={`w-full flex items-center justify-center gap-1.5 ${compact ? "py-1.5 rounded-lg text-[11px]" : "py-2 rounded-xl text-xs"} bg-red-900/20 hover:bg-red-900/30 border border-red-500/15 text-red-400/70 hover:text-red-400 transition-all`}
          >
            <Download className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
            {compact ? "Acta anulación" : "Descargar acta de anulación"}
          </button>
        ) : (
          <>
            <div className="flex gap-1.5">
              <button
                onClick={() => onDescargarBoleta(evento)}
                className={`flex-1 flex items-center justify-center gap-1 ${compact ? "py-1.5 rounded-lg text-[11px]" : "py-2 rounded-xl text-xs"} bg-[#0c1929] hover:bg-[#0f1e34] border border-white/8 hover:border-primary/30 text-white/60 hover:text-white transition-all`}
              >
                <Download className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
                {evento.tipo_evento === "horas_extra" ? "Constancia HE" : "Boleta"}
              </button>
              {evento.tipo_evento !== "horas_extra" && (
                <button
                  onClick={() => onDescargarActa(evento)}
                  className={`flex-1 flex items-center justify-center gap-1 ${compact ? "py-1.5 rounded-lg text-[11px]" : "py-2 rounded-xl text-xs"} bg-[#0c1929] hover:bg-[#0f1e34] border border-white/8 hover:border-primary/30 text-white/60 hover:text-white transition-all`}
                >
                  <FileText className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
                  Acta
                </button>
              )}
            </div>
            <button
              onClick={() => onAnular(evento)}
              className={`w-full flex items-center justify-center gap-1.5 ${compact ? "py-1.5 rounded-lg text-[11px]" : "py-2 rounded-xl text-xs"} bg-transparent hover:bg-red-500/8 border border-red-500/15 hover:border-red-500/30 text-red-400/50 hover:text-red-400 transition-all`}
            >
              <Ban className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
              Anular evento
            </button>
          </>
        )}
      </div>
    </div>
  );
}
