import { Shield, MapPin, Clock, CheckCircle2, XCircle, User } from "lucide-react";

export interface AgenteCustodia {
  employee_id: number;
  nombre: string;
  slot_numero: number | null;
  ruta_texto: string | null;
  hora_salida: string | null;
  hora_regreso: string | null;
  estado: "presente" | "faltante";
}

export interface Custodia {
  id: number;
  nombre: string;
  esperados: number;
  presentes: number;
  agentes: AgenteCustodia[];
}

function EstadoBadge({ estado }: { estado: AgenteCustodia["estado"] }) {
  if (estado === "presente") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border text-green-300 bg-green-400/10 border-green-400/20 font-medium">
        <CheckCircle2 className="w-3 h-3" /> Presente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border text-red-300 bg-red-400/10 border-red-400/20 font-medium">
      <XCircle className="w-3 h-3" /> Faltante
    </span>
  );
}

function FilaAgente({ a }: { a: AgenteCustodia }) {
  return (
    <tr className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <User className="w-3.5 h-3.5 text-white/30 shrink-0" />
          <span className="text-sm text-white truncate">{a.nombre}</span>
          {a.slot_numero != null && (
            <span className="text-[9px] text-white/40 font-mono">#{a.slot_numero}</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 max-w-[220px]">
        {a.ruta_texto ? (
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3 h-3 text-amber-300/60 shrink-0 mt-0.5" />
            <span className="text-xs text-white/70 line-clamp-2">{a.ruta_texto}</span>
          </div>
        ) : (
          <span className="text-xs text-white/25 italic">Sin ruta registrada</span>
        )}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {a.hora_salida ? (
          <span className="inline-flex items-center gap-1 text-xs text-white/70">
            <Clock className="w-3 h-3 text-white/30" /> {a.hora_salida}
            {a.hora_regreso && <span className="text-white/40">– {a.hora_regreso}</span>}
          </span>
        ) : (
          <span className="text-xs text-white/25">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        <EstadoBadge estado={a.estado} />
      </td>
    </tr>
  );
}

export function TablaCustodias({ custodias }: { custodias: Custodia[] }) {
  if (custodias.length === 0) {
    return (
      <div className="text-center py-8 text-white/40 text-sm">
        No hay custodias configuradas para hoy.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {custodias.map(c => {
        const tasa = c.esperados > 0 ? Math.round((c.presentes / c.esperados) * 100) : 0;
        const color = tasa >= 90 ? "text-green-300" : tasa >= 70 ? "text-amber-300" : "text-red-300";
        return (
          <div key={c.id} className="bg-white/[0.02] border border-white/8 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-white/[0.02]">
              <div className="flex items-center gap-2 min-w-0">
                <Shield className="w-4 h-4 text-amber-300/70 shrink-0" />
                <h3 className="text-sm font-semibold text-white truncate">{c.nombre}</h3>
              </div>
              <span className={`text-sm font-bold ${color} whitespace-nowrap`}>
                {c.presentes} <span className="text-white/40 font-normal">de</span> {c.esperados}{" "}
                <span className="text-white/40 font-normal text-xs">agentes</span>
              </span>
            </div>
            {c.agentes.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-white/40">
                Sin agentes asignados ni titulares pendientes.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-white/40 border-b border-white/5 bg-black/20">
                      <th className="px-3 py-2 text-left font-semibold">Agente</th>
                      <th className="px-3 py-2 text-left font-semibold">Ruta del día</th>
                      <th className="px-3 py-2 text-left font-semibold">Horario</th>
                      <th className="px-3 py-2 text-right font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.agentes.map(a => <FilaAgente key={`${c.id}-${a.employee_id}`} a={a} />)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
