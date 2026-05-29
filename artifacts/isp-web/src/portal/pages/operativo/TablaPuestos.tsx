import { Building2, ShieldCheck, AlertCircle, User, MapPin } from "lucide-react";

export interface AgenteLive {
  nombre: string;
  horas_turno: number | null;
  programado_hoy: boolean;
  en_servicio: boolean;
}

export interface PuestoLive {
  puesto_id: number;
  nombre: string;
  turno: string | null;
  sede: string | null;
  agentes: AgenteLive[];
  estado: "cubierto" | "descubierto";
}

function EstadoBadge({ estado }: { estado: PuestoLive["estado"] }) {
  if (estado === "cubierto") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border text-green-300 bg-green-400/10 border-green-400/20 font-medium">
        <ShieldCheck className="w-3 h-3" /> Cubierto
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border text-red-300 bg-red-400/10 border-red-400/20 font-medium">
      <AlertCircle className="w-3 h-3" /> Descubierto
    </span>
  );
}

function TurnoBadge({ agente }: { agente: AgenteLive }) {
  if (agente.en_servicio) {
    return (
      <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 border border-green-500/25 text-green-300 font-bold shrink-0">
        EN TURNO
      </span>
    );
  }
  if (agente.programado_hoy) {
    return (
      <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/25 text-blue-300 font-medium shrink-0">
        HOY
      </span>
    );
  }
  return <span className="ml-auto text-[9px] text-white/30 shrink-0">Descanso</span>;
}

function AgenteFila({ agente }: { agente: AgenteLive }) {
  const activo = agente.en_servicio || agente.programado_hoy;
  return (
    <li className={`flex items-center gap-1.5 ${activo ? "" : "opacity-50"}`}>
      <User className="w-3 h-3 text-white/40 shrink-0" />
      <span className="text-xs text-white/85 truncate">{agente.nombre}</span>
      {agente.horas_turno != null && (
        <span className="text-[9px] px-1.5 py-0.5 rounded border border-white/10 text-white/50 shrink-0">
          {agente.horas_turno}h
        </span>
      )}
      <TurnoBadge agente={agente} />
    </li>
  );
}

function PuestoCard({ puesto }: { puesto: PuestoLive }) {
  return (
    <div
      className={`rounded-xl border p-3 transition-colors ${
        puesto.estado === "cubierto"
          ? "bg-[#071a0f] border-green-500/20"
          : "bg-[#1a0a0f] border-red-500/25"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-white/40 shrink-0" />
            <p className="text-sm font-semibold text-white truncate">{puesto.nombre}</p>
          </div>
          {puesto.sede && (
            <p className="text-[10px] text-white/40 mt-0.5 flex items-center gap-1 truncate">
              <MapPin className="w-2.5 h-2.5 shrink-0" /> {puesto.sede}
            </p>
          )}
          {puesto.turno && (
            <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded border border-white/10 text-white/50 uppercase tracking-wider">
              {puesto.turno}
            </span>
          )}
        </div>
        <EstadoBadge estado={puesto.estado} />
      </div>

      <div className="mt-2.5 pt-2.5 border-t border-white/5">
        <p className="text-[9px] uppercase tracking-wider text-white/30 mb-1.5">
          {puesto.agentes.length > 1 ? "Agentes asignados" : "Agente"}
        </p>
        {puesto.agentes.length > 0 ? (
          <ul className="space-y-1.5">
            {puesto.agentes.map((a, i) => (
              <AgenteFila key={`${a.nombre}-${i}`} agente={a} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-red-300/70 italic">Sin agente asignado</p>
        )}
      </div>
    </div>
  );
}

export function TablaPuestos({ puestos }: { puestos: PuestoLive[] }) {
  if (puestos.length === 0) {
    return (
      <div className="text-center py-8 text-white/40 text-sm">
        No hay puestos fijos contratados.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {puestos.map(p => (
        <PuestoCard key={p.puesto_id} puesto={p} />
      ))}
    </div>
  );
}
