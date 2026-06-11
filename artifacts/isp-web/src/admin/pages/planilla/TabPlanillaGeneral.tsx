import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fmtQ } from "./helpers";
import type { PlanillaLinea } from "./types";

export function TabPlanillaGeneral({ lineas }: { lineas: PlanillaLinea[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-[#1e3a5f] hover:bg-transparent">
            <TableHead className="text-[#8bacc8] text-xs">ID</TableHead>
            <TableHead className="text-[#8bacc8] text-xs">Colaborador</TableHead>
            <TableHead className="text-[#8bacc8] text-xs">Puesto</TableHead>
            <TableHead className="text-[#8bacc8] text-xs">Sede / Cliente</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">Sueldo Base</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-center">Días</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-center">Vacac.</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-center">Faltas</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">Sueldo Período</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">Desc. Faltas</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">Valor HE</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">Total Bruto</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">IGSS</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">ISR</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">Anticipos</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right font-bold">Total Neto</TableHead>
            <TableHead className="text-[#8bacc8] text-xs">Rev.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lineas.map((l) => (
            <TableRow key={l.id} className="border-[#1e3a5f] hover:bg-[#1e3a5f]/20">
              <TableCell className="text-xs text-[#8bacc8] font-mono">
                {l.employee_id ? `EMP-${String(l.employee_id).padStart(4, "0")}` : "—"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <div className="text-sm font-medium text-white">{l.nombre_completo}</div>
                  {l.frecuencia_pago === "mensual" && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 shrink-0">M</span>
                  )}
                </div>
                <div className="text-xs text-[#8bacc8]">{l.dpi ?? "—"}</div>
              </TableCell>
              <TableCell className="text-xs text-[#8bacc8]">{l.puesto ?? "—"}</TableCell>
              <TableCell>
                <div className="text-xs text-[#8bacc8]">{l.sede ?? "—"}</div>
                <div className="text-xs text-[#8bacc8]/70">{l.cliente ?? "—"}</div>
              </TableCell>
              <TableCell className="text-right text-sm text-white">{fmtQ(l.sueldo_base)}</TableCell>
              <TableCell className="text-center text-sm text-white">{l.periodo_dias}</TableCell>
              <TableCell className="text-center text-sm">
                {(l.dias_vacaciones ?? 0) > 0
                  ? <span className="text-sky-400 font-medium">{l.dias_vacaciones}</span>
                  : <span className="text-[#8bacc8]/40">—</span>}
              </TableCell>
              <TableCell className="text-center">
                {l.faltas > 0 || l.suspensiones > 0 ? (
                  <span className="text-red-400 text-sm font-medium">
                    {l.faltas}{l.suspensiones > 0 ? `+${l.suspensiones}S` : ""}
                  </span>
                ) : (
                  <span className="text-green-500 text-sm">0</span>
                )}
              </TableCell>
              <TableCell className="text-right text-sm text-white">{fmtQ(l.sueldo_periodo)}</TableCell>
              <TableCell className="text-right text-sm text-red-400">{parseFloat(l.desc_faltas) > 0 ? fmtQ(l.desc_faltas) : "—"}</TableCell>
              <TableCell className="text-right text-sm text-amber-400">{parseFloat(l.valor_he) > 0 ? fmtQ(l.valor_he) : "—"}</TableCell>
              <TableCell className="text-right text-sm text-white">{fmtQ(l.total_bruto)}</TableCell>
              <TableCell className="text-right text-sm text-cyan-400">{l.igss_trabajador && parseFloat(l.igss_trabajador) > 0 ? fmtQ(l.igss_trabajador) : "—"}</TableCell>
              <TableCell className="text-right text-sm text-purple-400">{l.isr && parseFloat(l.isr) > 0 ? fmtQ(l.isr) : "—"}</TableCell>
              <TableCell className="text-right text-sm text-orange-400">{parseFloat(l.anticipos) > 0 ? fmtQ(l.anticipos) : "—"}</TableCell>
              <TableCell className="text-right text-sm font-bold text-green-400">{fmtQ(l.total_neto)}</TableCell>
              <TableCell>
                {l.revision_estado && (
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    l.revision_estado === "aprobado_rrhh" ? "bg-amber-800 text-amber-200" :
                    l.revision_estado === "revisada"      ? "bg-green-900 text-green-200" :
                    l.revision_estado === "observada"     ? "bg-red-900 text-red-200" :
                    "bg-zinc-700 text-zinc-300"
                  }`}>{l.revision_estado}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
