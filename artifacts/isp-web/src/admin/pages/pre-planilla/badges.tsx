import { Clock } from "lucide-react";
import { REVISION_CFG } from "./helpers";

export function RevisionBadge({ estado }: { estado: string }) {
  const cfg = REVISION_CFG[estado as keyof typeof REVISION_CFG] ??
    { label: estado, cls: "text-white/40 bg-white/5 border-white/10", icon: Clock };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.cls}`}>
      <cfg.icon className="w-2.5 h-2.5" />{cfg.label}
    </span>
  );
}

export function TipoCobBadge({ tipo }: { tipo: string }) {
  const cfgs: Record<string, string> = {
    relevo:             "text-purple-300 bg-purple-400/10 border-purple-400/20",
    descanso_trabajado: "text-blue-300 bg-blue-400/10 border-blue-400/20",
    cobertura:          "text-cyan-300 bg-cyan-400/10 border-cyan-400/20",
    normal:             "text-white/40 bg-white/5 border-white/10",
  };
  const labels: Record<string, string> = {
    relevo: "Relevo", descanso_trabajado: "Dsco. Trabajado", cobertura: "Cobertura", normal: "Normal",
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${cfgs[tipo] ?? "text-white/30 bg-white/5 border-white/10"}`}>
      {labels[tipo] ?? tipo}
    </span>
  );
}

export function TablaVacia({ msg }: { msg: string }) {
  return <div className="p-10 text-center text-white/30 text-sm">{msg}</div>;
}
