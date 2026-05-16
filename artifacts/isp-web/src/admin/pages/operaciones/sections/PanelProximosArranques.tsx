import { Zap, ChevronRight, Building2, Shield, ExternalLink } from "lucide-react";
import { TIPO_SSA_LABELS } from "../types";
import { useOperacionesContext } from "../OperacionesContext";

export function PanelProximosArranques() {
  const { proximosArranques, esFuturo, colArranques, toggleColArranques, irAFecha } = useOperacionesContext();
  if (esFuturo || !proximosArranques || proximosArranques.total === 0) return null;
  const { arranques, total } = proximosArranques;

  return (
    <div className="bg-amber-500/4 border border-amber-500/20 rounded-xl overflow-hidden">
      <button
        onClick={toggleColArranques}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-amber-500/15 text-left group hover:bg-amber-500/4 transition-colors"
      >
        <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-xs font-bold text-amber-300/80 uppercase tracking-widest">Próximos arranques</span>
        <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 border border-amber-500/25 text-amber-300">
          {total} en 60 días
        </span>
        {colArranques && <span className="text-[10px] text-amber-400/30 ml-1">— minimizado</span>}
        <ChevronRight className={`w-3.5 h-3.5 text-amber-400/30 group-hover:text-amber-400/60 ml-auto shrink-0 transition-transform ${colArranques ? "" : "rotate-90"}`} />
      </button>
      {!colArranques && (
        <div>
          <div className="p-3 flex flex-col gap-1.5">
            {arranques.map((ip) => {
              const diasRestantes = ip.dias_para_inicio ?? 99;
              const fechaInicio   = ip.fecha_inicio_contrato?.slice(0, 10) ?? "";
              const esSSA         = ip.tipo === "ssa";
              const itemKey       = esSSA ? `ssa_${ip.ssa_id}` : `cli_${ip.cliente_id}`;
              const colorChip     = diasRestantes <= 7
                ? "bg-red-500/15 text-red-300 border border-red-500/20"
                : diasRestantes <= 14
                ? "bg-amber-500/15 text-amber-300 border border-amber-500/20"
                : "bg-white/5 text-white/40 border border-white/10";
              const iconBg        = esSSA
                ? "bg-blue-500/15 border-blue-500/25 group-hover:border-blue-400/50 group-hover:bg-blue-500/25"
                : "bg-amber-500/15 border-amber-500/25 group-hover:border-amber-400/50 group-hover:bg-amber-500/25";
              const hoverBg       = esSSA ? "hover:bg-blue-500/10" : "hover:bg-amber-500/10";
              const nombreColor   = esSSA ? "text-blue-200 group-hover:text-blue-100" : "text-amber-200 group-hover:text-amber-100";
              const puestosLabel  = esSSA ? "guardias" : "puestos";
              return (
                <button
                  key={itemKey}
                  onClick={() => irAFecha(fechaInicio, esSSA ? undefined : ip.cliente_id)}
                  title={esSSA ? `SSA — ${TIPO_SSA_LABELS[ip.tipo_solicitud ?? ""] ?? ip.tipo_solicitud} — ${fechaInicio}` : `Arranque nuevo — ${fechaInicio}`}
                  className={`group flex items-center gap-2 text-[11px] w-full text-left rounded-lg px-1.5 py-1 -mx-1.5 ${hoverBg} transition-colors cursor-pointer`}
                >
                  <div className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors ${iconBg}`}>
                    {esSSA
                      ? <Shield className="w-3 h-3 text-blue-400" />
                      : <Building2 className="w-3 h-3 text-amber-400" />
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className={`font-medium truncate block transition-colors ${nombreColor}`}>
                      {ip.cliente_nombre_comercial || ip.cliente_nombre}
                    </span>
                    <span className="text-white/25 text-[9px] group-hover:text-white/40 transition-colors">
                      {esSSA
                        ? (TIPO_SSA_LABELS[ip.tipo_solicitud ?? ""] ?? ip.tipo_solicitud ?? "SSA")
                        : (fechaInicio ? fechaInicio.split("-").reverse().join("/") : "")
                      }
                      {esSSA && ip.hora_inicio ? ` · ${ip.hora_inicio}–${ip.hora_fin ?? ""}` : ""}
                    </span>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <span className="text-white/30 text-[10px]">{ip.total_puestos} {puestosLabel}</span>
                    <span className={`font-semibold px-1.5 py-0.5 rounded text-[9px] ${colorChip}`}>
                      {diasRestantes === 0 ? "Hoy" : `${diasRestantes}d`}
                    </span>
                    <ExternalLink className={`w-3 h-3 ${esSSA ? "text-blue-400/0 group-hover:text-blue-400/60" : "text-amber-400/0 group-hover:text-amber-400/60"} transition-colors`} />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="px-4 pb-3 text-[9px] text-white/20 flex items-center gap-1">
            <Building2 className="w-2.5 h-2.5 text-amber-400/50" />
            <span>Arranque nuevo</span>
            <span className="mx-1">·</span>
            <Shield className="w-2.5 h-2.5 text-blue-400/50" />
            <span>Servicio adicional (SSA)</span>
          </div>
        </div>
      )}
    </div>
  );
}
