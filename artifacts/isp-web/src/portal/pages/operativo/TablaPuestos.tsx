import { Building2, ShieldCheck, AlertCircle, User, MapPin } from "lucide-react";

export interface PuestoLive {
  puesto_id: number;
  nombre: string;
  turno: string | null;
  sede: string | null;
  titular_nombre: string | null;
  agente_actual: string | null;
  en_servicio: boolean;
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
        <div
          key={p.puesto_id}
          className={`rounded-xl border p-3 transition-colors ${
            p.estado === "cubierto"
              ? "bg-[#071a0f] border-green-500/20"
              : "bg-[#1a0a0f] border-red-500/25"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-white/40 shrink-0" />
                <p className="text-sm font-semibold text-white truncate">{p.nombre}</p>
              </div>
              {p.sede && (
                <p className="text-[10px] text-white/40 mt-0.5 flex items-center gap-1 truncate">
                  <MapPin className="w-2.5 h-2.5 shrink-0" /> {p.sede}
                </p>
              )}
              {p.turno && (
                <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded border border-white/10 text-white/50 uppercase tracking-wider">
                  {p.turno}
                </span>
              )}
            </div>
            <EstadoBadge estado={p.estado} />
          </div>

          <div className="mt-2.5 pt-2.5 border-t border-white/5">
            <p className="text-[9px] uppercase tracking-wider text-white/30 mb-1">
              Agente
            </p>
            {p.agente_actual ? (
              <div className="flex items-center gap-1.5">
                <User className="w-3 h-3 text-white/40 shrink-0" />
                <span className="text-xs text-white/85 truncate">{p.agente_actual}</span>
                {p.en_servicio && (
                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-green-500/15 border border-green-500/25 text-green-300 font-bold">
                    EN TURNO
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-red-300/70 italic">Sin agente asignado</p>
            )}
            {p.titular_nombre && p.titular_nombre !== p.agente_actual && (
              <p className="text-[10px] text-white/30 mt-1 truncate">
                Titular: {p.titular_nombre}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
