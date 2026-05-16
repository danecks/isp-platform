import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Clock } from "lucide-react";
import { fmtQ } from "./helpers";
import type { PlanillaLinea } from "./types";

export function TabHorasExtra({ lineas }: { lineas: PlanillaLinea[] }) {
  const conHE = lineas.filter(l => parseFloat(l.horas_extra) > 0);
  if (!conHE.length) {
    return (
      <div className="text-center py-12 text-[#8bacc8]">
        <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>No hay horas extra en este período</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-[#1e3a5f] hover:bg-transparent">
            <TableHead className="text-[#8bacc8] text-xs">Colaborador</TableHead>
            <TableHead className="text-[#8bacc8] text-xs">Puesto</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">Sueldo Base</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-center">Hrs/Semana</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">H. Trabajadas</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">H. Extra</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">Tarifa HE (×1.5)</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right font-bold">Valor HE</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {conHE.map((l) => {
            const sb = parseFloat(l.sueldo_base);
            const hc = parseFloat(String(l.horas_contrato ?? 48));
            const horasDia = hc > 0 ? hc / 6 : 8;
            const sueldoDia = sb / 30;
            const tarifaHE = (sueldoDia / horasDia) * 1.5;
            return (
              <TableRow key={l.id} className="border-[#1e3a5f] hover:bg-[#1e3a5f]/20">
                <TableCell>
                  <div className="text-sm font-medium text-white">{l.nombre_completo}</div>
                </TableCell>
                <TableCell className="text-xs text-[#8bacc8]">{l.puesto ?? "—"}</TableCell>
                <TableCell className="text-right text-sm text-white">{fmtQ(l.sueldo_base)}</TableCell>
                <TableCell className="text-center text-sm text-[#8bacc8]">{l.horas_contrato ?? "—"}</TableCell>
                <TableCell className="text-right text-sm text-[#8bacc8]">{parseFloat(l.horas_trabajadas).toFixed(2)}</TableCell>
                <TableCell className="text-right text-sm font-medium text-amber-400">{parseFloat(l.horas_extra).toFixed(2)}</TableCell>
                <TableCell className="text-right text-sm text-[#8bacc8]">{fmtQ(tarifaHE)}/h</TableCell>
                <TableCell className="text-right text-sm font-bold text-amber-400">{fmtQ(l.valor_he)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
