import { Gavel } from "lucide-react";
import type { Amonestacion } from "./types";

export function StatBox({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3">
      <div className={`flex items-center gap-2 text-xs ${color}`}>{icon}<span className="opacity-70">{label}</span></div>
      <div className={`text-xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

export function TipoBadge({ tipo, actaNumero }: { tipo: string; actaNumero?: number | null }) {
  if (tipo === "acta_administrativa") {
    return <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 text-xs font-medium inline-flex items-center gap-1"><Gavel className="w-3 h-3" /> Acta Administrativa{actaNumero ? ` #${actaNumero}` : ""}</span>;
  }
  if (tipo === "economica") {
    return <span className="px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30 text-xs font-medium">Económica</span>;
  }
  return <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 text-xs font-medium">Llamada de atención</span>;
}

export function EstadoBadge({ a }: { a: Amonestacion }) {
  if (a.estado === "anulada") {
    return <span className="px-2 py-0.5 rounded-full bg-gray-500/15 text-gray-300 border border-gray-500/30 text-xs font-medium">Anulada</span>;
  }
  if (a.descontado) {
    return <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-medium">Descontada</span>;
  }
  if (a.tipo === "economica") {
    return <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-medium">Pend. planilla</span>;
  }
  return <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/20 text-xs font-medium">Activa</span>;
}

export function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-white/40 uppercase">{label}</div>
      <div className="text-white/90">{value}</div>
    </div>
  );
}
