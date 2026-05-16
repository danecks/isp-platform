import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CheckCircle2 } from "lucide-react";
import { fmtQ } from "./helpers";
import type { PlanillaLinea } from "./types";

export function TabFaltas({ lineas }: { lineas: PlanillaLinea[] }) {
  const conFaltas = lineas.filter(l => l.faltas > 0 || l.suspensiones > 0 || parseFloat(l.desc_faltas) > 0);
  if (!conFaltas.length) {
    return (
      <div className="text-center py-12 text-[#8bacc8]">
        <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-40 text-green-500" />
        <p>Sin faltas ni descuentos en este período</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-[#1e3a5f] hover:bg-transparent">
            <TableHead className="text-[#8bacc8] text-xs">Colaborador</TableHead>
            <TableHead className="text-[#8bacc8] text-xs">Puesto / Sede</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">Sueldo Base</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-center">Faltas</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-center">Suspensiones</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">Sueldo/Día</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right font-bold">Desc. Total</TableHead>
            <TableHead className="text-[#8bacc8] text-xs">Observaciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {conFaltas.map((l) => {
            const sueldoDia = parseFloat(l.sueldo_base) / 30;
            return (
              <TableRow key={l.id} className="border-[#1e3a5f] hover:bg-[#1e3a5f]/20">
                <TableCell>
                  <div className="text-sm font-medium text-white">{l.nombre_completo}</div>
                  <div className="text-xs text-[#8bacc8]">{l.dpi ?? "—"}</div>
                </TableCell>
                <TableCell>
                  <div className="text-xs text-[#8bacc8]">{l.puesto ?? "—"}</div>
                  <div className="text-xs text-[#8bacc8]/70">{l.sede ?? "—"}</div>
                </TableCell>
                <TableCell className="text-right text-sm text-white">{fmtQ(l.sueldo_base)}</TableCell>
                <TableCell className="text-center">
                  <span className={`text-sm font-medium ${l.faltas > 0 ? "text-red-400" : "text-[#8bacc8]"}`}>
                    {l.faltas}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className={`text-sm font-medium ${l.suspensiones > 0 ? "text-orange-400" : "text-[#8bacc8]"}`}>
                    {l.suspensiones}
                  </span>
                </TableCell>
                <TableCell className="text-right text-sm text-[#8bacc8]">{fmtQ(sueldoDia)}</TableCell>
                <TableCell className="text-right text-sm font-bold text-red-400">{fmtQ(l.desc_faltas)}</TableCell>
                <TableCell className="text-xs text-[#8bacc8]">{l.observaciones_rrhh ?? "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
