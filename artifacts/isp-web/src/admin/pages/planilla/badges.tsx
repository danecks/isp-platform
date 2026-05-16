import { CheckCircle2, Clock, Wallet } from "lucide-react";

export const ESTADO_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  borrador:  { label: "Borrador",  color: "bg-zinc-700 text-zinc-100", icon: <Clock className="h-3 w-3" /> },
  revisada:  { label: "Revisada",  color: "bg-blue-800 text-blue-100", icon: <CheckCircle2 className="h-3 w-3" /> },
  aprobada:  { label: "Aprobada",  color: "bg-amber-700 text-amber-100", icon: <CheckCircle2 className="h-3 w-3" /> },
  pagada:    { label: "Pagada",    color: "bg-green-800 text-green-100", icon: <Wallet className="h-3 w-3" /> },
};

export function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, color: "bg-zinc-700", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

export const SIGUIENTE_ESTADO: Record<string, string> = {
  borrador: "revisada",
  revisada: "aprobada",
  aprobada: "pagada",
};

export const ACCION_LABEL: Record<string, string> = {
  revisada: "Marcar como Revisada",
  aprobada: "Aprobar Planilla",
  pagada:   "Marcar como Pagada",
};

export function KpiCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg p-4 flex items-start gap-3">
      <div className="mt-0.5 text-amber-500">{icon}</div>
      <div>
        <div className="text-xs text-[#8bacc8]">{label}</div>
        <div className="text-lg font-bold text-white">{value}</div>
        {sub && <div className="text-xs text-[#8bacc8]">{sub}</div>}
      </div>
    </div>
  );
}
