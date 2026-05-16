import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, RefreshCw, Search, TrendingUp } from "lucide-react";
import { apiGet, fmt } from "./helpers";
import type { Provision } from "./types";

export function TabProvisiones() {
  const hoy = new Date().toISOString().slice(0, 10);
  const primerDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  // Inputs del usuario (cambian mientras escribe/selecciona)
  const [desde, setDesde] = useState(primerDiaMes);
  const [hasta, setHasta] = useState(hoy);

  // Valores confirmados (cambian solo al hacer clic en "Ver Provisiones")
  const [queryDesde, setQueryDesde] = useState<string | null>(null);
  const [queryHasta, setQueryHasta] = useState<string | null>(null);

  const { data: provisionesData, isFetching } = useQuery<{
    rows: Provision[];
    total: number;
    total_por_tipo: Record<string, number>;
    total_general: number;
  }>({
    queryKey: ["prest-provisiones", queryDesde, queryHasta],
    queryFn: () => apiGet(`/prestaciones/provisiones?periodo_desde=${queryDesde}&periodo_hasta=${queryHasta}`),
    enabled: !!queryDesde && !!queryHasta,
  });

  const handleBuscar = () => {
    setQueryDesde(desde);
    setQueryHasta(hasta);
  };

  const TIPO_COLOR: Record<string, string> = {
    aguinaldo: "teal",
    bono14: "blue",
    vacaciones: "green",
    indemnizacion: "orange",
  };

  const inputCls = "bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500/40 transition-colors";

  const filas = provisionesData?.rows ?? [];
  const totalesPorTipo = provisionesData?.total_por_tipo ?? {};
  const totalGeneral = provisionesData?.total_general ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Info banner */}
      <div className="flex items-start gap-3 bg-teal-500/8 border border-teal-500/20 rounded-2xl px-4 py-3">
        <CheckCircle2 className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-teal-300">Generación automática</p>
          <p className="text-[11px] text-white/40 mt-0.5">
            Las provisiones se calculan y registran automáticamente cada vez que se cierra una pre-planilla. Aquí puedes consultar el historial por período.
          </p>
        </div>
      </div>

      {/* Filtro de consulta */}
      <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-teal-400" /> Consultar Provisiones del Período
        </h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Desde</Label>
            <Input type="date" className={inputCls} value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Hasta</Label>
            <Input type="date" className={inputCls} value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <Button
            variant="ghost"
            onClick={handleBuscar}
            disabled={isFetching}
            className="text-white/70 hover:text-white rounded-xl border border-white/10"
          >
            {isFetching
              ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Cargando…</>
              : <><Search className="w-4 h-4 mr-2" />Ver Provisiones</>}
          </Button>
        </div>
      </div>

      {/* Resumen por tipo (cuando hay datos) */}
      {filas.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["aguinaldo", "bono14", "vacaciones", "indemnizacion"] as const).map((tipo) => {
              const color = TIPO_COLOR[tipo] ?? "teal";
              const monto = totalesPorTipo[tipo];
              return (
                <div key={tipo} className={`bg-${color}-500/10 border border-${color}-500/20 rounded-2xl p-4`}>
                  <p className="text-xs text-white/40 capitalize">{tipo === "indemnizacion" ? "Indemnización" : tipo.charAt(0).toUpperCase() + tipo.slice(1)}</p>
                  <p className={`text-xl font-bold text-${color}-300 mt-1`}>
                    {monto != null ? fmt(monto) : "—"}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/3 border border-white/8">
            <div>
              <span className="text-xs text-white/40">Registros</span>
              <p className="text-lg font-bold text-white">{filas.length}</p>
            </div>
            <Separator orientation="vertical" className="h-8 border-white/10" />
            <div>
              <span className="text-xs text-white/40">Total General</span>
              <p className="text-lg font-bold text-teal-300">{fmt(totalGeneral)}</p>
            </div>
          </div>
        </>
      )}

      {provisionesData && filas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-white/25 gap-2">
          <TrendingUp className="w-8 h-8" />
          <p className="text-sm">Sin provisiones registradas para este período</p>
          <p className="text-xs text-white/20">Las provisiones se generan al cerrar la pre-planilla</p>
        </div>
      )}

      {/* Detalle tabla */}
      {filas.length > 0 && (
        <div className="rounded-2xl border border-white/8 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/8 hover:bg-transparent">
                <TableHead className="text-white/40 text-xs">Empleado</TableHead>
                <TableHead className="text-white/40 text-xs">Tipo</TableHead>
                <TableHead className="text-white/40 text-xs">Días</TableHead>
                <TableHead className="text-white/40 text-xs">Salario Ref.</TableHead>
                <TableHead className="text-white/40 text-xs text-right">Provisión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.slice(0, 100).map((p, i) => (
                <TableRow key={i} className="border-white/5 hover:bg-white/3">
                  <TableCell className="text-sm text-white/80">{p.empleado_nombre}</TableCell>
                  <TableCell>
                    <Badge className={`bg-${TIPO_COLOR[p.tipo] ?? "teal"}-500/20 text-${TIPO_COLOR[p.tipo] ?? "teal"}-300 border-${TIPO_COLOR[p.tipo] ?? "teal"}-500/30 capitalize`}>
                      {p.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-white/60">{p.dias_periodo}</TableCell>
                  <TableCell className="text-sm text-white/60">{fmt(p.salario_referencia)}</TableCell>
                  <TableCell className="text-sm font-semibold text-white text-right">{fmt(p.monto_provision)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
