import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Link, Wallet } from "lucide-react";
import { fmtQ } from "./helpers";
import type { PlanillaLinea } from "./types";

export function TabAnticipos({ lineas }: { lineas: PlanillaLinea[] }) {
  const conAnticipo = lineas.filter(l => parseFloat(l.anticipos) > 0);
  if (!conAnticipo.length) {
    return (
      <div className="text-center py-12 text-[#8bacc8]">
        <Wallet className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>No hay anticipos registrados en este período</p>
      </div>
    );
  }

  const totalVinculados = conAnticipo.reduce((acc, l) => acc + (l.anticipo_ids?.length ?? 0), 0);

  return (
    <div className="space-y-0">
      {totalVinculados > 0 && (
        <div className="bg-green-950/30 border-b border-green-800/40 p-3 flex gap-2 text-xs text-green-300">
          <Link className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            <strong>{totalVinculados} anticipo(s)</strong> vinculados a esta planilla y marcados como <em>descontados</em>.
            No pueden editarse mientras la planilla esté activa. Si necesitas corregir, revierte la planilla.
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-[#1e3a5f] hover:bg-transparent">
              <TableHead className="text-[#8bacc8] text-xs">Colaborador</TableHead>
              <TableHead className="text-[#8bacc8] text-xs">Puesto</TableHead>
              <TableHead className="text-[#8bacc8] text-xs text-right">Total Bruto</TableHead>
              <TableHead className="text-[#8bacc8] text-xs text-right font-bold">Anticipo</TableHead>
              <TableHead className="text-[#8bacc8] text-xs text-right">Total Neto</TableHead>
              <TableHead className="text-[#8bacc8] text-xs text-center">Anticipos Vinculados</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conAnticipo.map((l) => {
              const ids = l.anticipo_ids ?? [];
              return (
                <TableRow key={l.id} className="border-[#1e3a5f] hover:bg-[#1e3a5f]/20">
                  <TableCell>
                    <div className="text-sm font-medium text-white">{l.nombre_completo}</div>
                    <div className="text-xs text-[#8bacc8]">{l.dpi ?? "—"}</div>
                  </TableCell>
                  <TableCell className="text-xs text-[#8bacc8]">{l.puesto ?? "—"}</TableCell>
                  <TableCell className="text-right text-sm text-white">{fmtQ(l.total_bruto)}</TableCell>
                  <TableCell className="text-right text-sm font-bold text-orange-400">{fmtQ(l.anticipos)}</TableCell>
                  <TableCell className="text-right text-sm font-bold text-green-400">{fmtQ(l.total_neto)}</TableCell>
                  <TableCell className="text-center">
                    {ids.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-900/40 text-green-300 border border-green-800 px-2 py-0.5 rounded">
                        <Link className="h-3 w-3" />
                        {ids.length} vinculado{ids.length !== 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="text-xs text-[#8bacc8]">Sin vínculo</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
