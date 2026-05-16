import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Info } from "lucide-react";
import { fmtQ } from "./helpers";
import type { PlanillaLinea } from "./types";

export function TabIGSS({ lineas }: { lineas: PlanillaLinea[] }) {
  const conIgss    = lineas.filter(l => l.aplica_igss);
  const sinIgss    = lineas.filter(l => !l.aplica_igss);

  const getMotivoCfg = (motivo: string | null) => {
    if (!motivo) return null;
    if (motivo.includes("IGSS activado") || motivo.includes("no activo"))
      return "text-white/40 bg-white/5 border-white/10";
    if (motivo.includes("regularización"))
      return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    if (motivo.includes("tarifa"))
      return "text-blue-400 bg-blue-500/10 border-blue-500/20";
    return "text-white/40 bg-white/5 border-white/10";
  };

  return (
    <div className="space-y-0">
      {/* Banner resumen */}
      <div className="bg-blue-950/30 border-b border-blue-800/40 p-3 flex gap-2 text-xs text-blue-300">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          <strong>{conIgss.length}</strong> colaborador(es) con IGSS activo · <strong>{sinIgss.length}</strong> excluidos.
          Los cálculos de IGSS (4.83% laboral + 12.67% patronal) se habilitarán en una versión futura.
          Esta vista es solo de clasificación y trazabilidad.
        </span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-[#1e3a5f] hover:bg-transparent">
              <TableHead className="text-[#8bacc8] text-xs">Colaborador</TableHead>
              <TableHead className="text-[#8bacc8] text-xs">Puesto / Cliente</TableHead>
              <TableHead className="text-[#8bacc8] text-xs text-center">¿Aplica IGSS?</TableHead>
              <TableHead className="text-[#8bacc8] text-xs">Motivo / Estado</TableHead>
              <TableHead className="text-[#8bacc8] text-xs text-right">Total Bruto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineas.map((l) => (
              <TableRow key={l.id} className="border-[#1e3a5f] hover:bg-[#1e3a5f]/20">
                <TableCell>
                  <div className="text-sm font-medium text-white">{l.nombre_completo}</div>
                  <div className="text-xs text-[#8bacc8]">{l.dpi ?? "—"}</div>
                </TableCell>
                <TableCell>
                  <div className="text-xs text-[#8bacc8]">{l.puesto ?? "—"}</div>
                  <div className="text-xs text-white/30">{l.cliente ?? "—"}</div>
                </TableCell>
                <TableCell className="text-center">
                  {l.aplica_igss ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Aplica
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-white/40 border border-white/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                      No aplica
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {l.motivo_exclusion_igss ? (
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${getMotivoCfg(l.motivo_exclusion_igss) ?? ""}`}>
                      {l.motivo_exclusion_igss}
                    </span>
                  ) : (
                    <span className="text-xs text-emerald-400/60">Elegible para cálculo</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm text-white">{fmtQ(l.total_bruto)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
