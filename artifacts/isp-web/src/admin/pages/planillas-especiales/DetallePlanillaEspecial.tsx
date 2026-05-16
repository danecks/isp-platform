import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Landmark, ChevronLeft, CheckCircle2, Clock, Users, Wallet,
  CalendarDays, Loader2, BadgeCheck,
} from "lucide-react";
import { ESTADO_COLOR, PAGO_COLOR, TIPO_LABEL, fmtDate, fmtNum } from "./helpers";
import type { PlanillaEspecialDetalle, PlanillaPago } from "./types";

interface Props {
  detalle: PlanillaEspecialDetalle | null;
  loading: boolean;
  aprobandoId: number | null;
  onBack: () => void;
  onAprobar: (id: number) => void;
  onAnular: (id: number) => void;
  onRegistrarPago: (pago: PlanillaPago) => void;
}

export function DetallePlanillaEspecial({
  detalle, loading, aprobandoId, onBack, onAprobar, onAnular, onRegistrarPago,
}: Props) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          className="text-gray-400 hover:text-white gap-2"
          onClick={onBack}
        >
          <ChevronLeft className="w-4 h-4" /> Volver
        </Button>
      </div>

      {loading || !detalle ? (
        <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Cargando detalle...</span>
        </div>
      ) : (
        <>
          <div className="bg-[#0f1623] border border-white/10 rounded-xl p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Landmark className="w-6 h-6 text-yellow-400" />
                  <h1 className="text-xl font-bold text-white">
                    {TIPO_LABEL[detalle.planilla.tipo]} {detalle.planilla.anio}
                  </h1>
                  <Badge
                    className={`text-xs border ${ESTADO_COLOR[detalle.planilla.estado] ?? ""}`}
                    variant="outline"
                  >
                    {detalle.planilla.estado}
                  </Badge>
                </div>
                <p className="text-gray-400 text-sm">
                  Período: {fmtDate(detalle.planilla.periodo_inicio)} – {fmtDate(detalle.planilla.periodo_fin)}
                </p>
                {detalle.planilla.observaciones && (
                  <p className="text-gray-500 text-sm mt-1">{detalle.planilla.observaciones}</p>
                )}
              </div>

              <div className="flex items-center gap-3">
                {detalle.planilla.estado === "borrador" && (
                  <Button
                    onClick={() => onAprobar(detalle.planilla.id)}
                    disabled={aprobandoId === detalle.planilla.id}
                    className="bg-blue-600 hover:bg-blue-700 gap-2"
                  >
                    {aprobandoId === detalle.planilla.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <BadgeCheck className="w-4 h-4" />}
                    Aprobar Planilla
                  </Button>
                )}
                {["borrador", "aprobada"].includes(detalle.planilla.estado) && (
                  <Button
                    variant="ghost"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => onAnular(detalle.planilla.id)}
                  >
                    Anular
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-5">
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <Users className="w-4 h-4" /> Colaboradores
                </div>
                <p className="text-2xl font-bold text-white">
                  {detalle.planilla.total_colaboradores}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <Wallet className="w-4 h-4" /> Total Bruto
                </div>
                <p className="text-2xl font-bold text-yellow-300">
                  {fmtNum(detalle.planilla.total_bruto)}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <CalendarDays className="w-4 h-4" /> Cuotas
                </div>
                <p className="text-2xl font-bold text-white">
                  {detalle.pagos.filter((p) => p.estado === "pagado").length}
                  <span className="text-gray-500 text-lg">/{detalle.planilla.num_pagos}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#0f1623] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-white font-semibold">Cuotas de Pago</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-gray-400">Cuota</TableHead>
                  <TableHead className="text-gray-400 text-right">Porcentaje</TableHead>
                  <TableHead className="text-gray-400 text-right">Monto</TableHead>
                  <TableHead className="text-gray-400">Fecha Programada</TableHead>
                  <TableHead className="text-gray-400">Estado</TableHead>
                  <TableHead className="text-gray-400">Pagado por</TableHead>
                  <TableHead className="text-gray-400">Fecha Pago</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalle.pagos.map((p) => (
                  <TableRow key={p.id} className="border-white/5 hover:bg-white/5">
                    <TableCell className="text-white font-semibold">
                      Pago {p.numero_pago}
                    </TableCell>
                    <TableCell className="text-right text-gray-300">
                      {parseFloat(p.porcentaje).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right text-yellow-300 font-semibold">
                      {fmtNum(p.total_este_pago)}
                    </TableCell>
                    <TableCell className="text-gray-400">
                      {fmtDate(p.fecha_programada)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs border ${PAGO_COLOR[p.estado] ?? ""}`}
                        variant="outline"
                      >
                        {p.estado === "pagado"
                          ? <><CheckCircle2 className="w-3 h-3 inline mr-1" />Pagado</>
                          : <><Clock className="w-3 h-3 inline mr-1" />Pendiente</>}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">{p.pagado_por ?? "—"}</TableCell>
                    <TableCell className="text-gray-400 text-sm">
                      {p.pagado_at ? new Date(p.pagado_at).toLocaleDateString("es-GT") : "—"}
                    </TableCell>
                    <TableCell>
                      {p.estado === "pendiente" &&
                        ["borrador", "aprobada"].includes(detalle.planilla.estado) && (
                          <Button
                            size="sm"
                            onClick={() => onRegistrarPago(p)}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Registrar Pago
                          </Button>
                        )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="bg-[#0f1623] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-white font-semibold">Detalle por Colaborador</h2>
              <span className="text-gray-400 text-sm">{detalle.lineas.length} registros</span>
            </div>

            {detalle.pagos.length > 1 && (
              <div className="px-5 py-3 bg-blue-500/5 border-b border-white/10">
                <p className="text-xs text-blue-400">
                  Los montos de cada cuota se calculan como porcentaje del monto total.
                  El saldo restante se aplica en la última cuota para corregir redondeos.
                </p>
              </div>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-gray-400">Colaborador</TableHead>
                    <TableHead className="text-gray-400">Sede / Cliente</TableHead>
                    <TableHead className="text-gray-400 text-center">Días Laborados</TableHead>
                    <TableHead className="text-gray-400 text-right">Salario Ref.</TableHead>
                    <TableHead className="text-gray-400 text-right">Monto Total</TableHead>
                    {detalle.pagos.map((pg) => (
                      <TableHead key={pg.id} className="text-gray-400 text-right text-xs">
                        Pago {pg.numero_pago}
                        <br />
                        <span className="text-gray-600">
                          ({parseFloat(pg.porcentaje).toFixed(0)}%)
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="text-gray-400 text-right">Ya Pagado</TableHead>
                    <TableHead className="text-gray-400 text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalle.lineas.map((l) => {
                    const total    = parseFloat(l.monto_total);
                    const yaPagado = parseFloat(l.monto_ya_pagado);
                    const saldo    = Math.max(0, total - yaPagado);
                    return (
                      <TableRow key={l.id} className="border-white/5 hover:bg-white/5">
                        <TableCell>
                          <div className="text-white text-sm">{l.nombre_completo}</div>
                          {l.fecha_egreso_emp && (
                            <div className="text-xs text-yellow-500">
                              Baja: {fmtDate(l.fecha_egreso_emp)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-400 text-sm">
                          {l.sede || "—"}
                          {l.cliente && <div className="text-xs text-gray-600">{l.cliente}</div>}
                        </TableCell>
                        <TableCell className="text-center text-gray-300 text-sm">
                          {l.dias_laborados}
                          <span className="text-gray-600">/{l.dias_periodo_total}</span>
                        </TableCell>
                        <TableCell className="text-right text-gray-300 text-sm">
                          {fmtNum(l.salario_referencia)}
                        </TableCell>
                        <TableCell className="text-right text-white font-semibold">
                          {fmtNum(l.monto_total)}
                        </TableCell>
                        {detalle.pagos.map((pg) => {
                          const montoEsta = Math.round(total * (parseFloat(pg.porcentaje) / 100) * 100) / 100;
                          return (
                            <TableCell key={pg.id} className="text-right text-sm">
                              <span className={pg.estado === "pagado" ? "text-green-400" : "text-gray-400"}>
                                {fmtNum(montoEsta)}
                              </span>
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-right text-sm">
                          {yaPagado > 0
                            ? <span className="text-green-400">{fmtNum(yaPagado)}</span>
                            : <span className="text-gray-600">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm">
                          {saldo > 0
                            ? <span className="text-yellow-300">{fmtNum(saldo)}</span>
                            : <span className="text-green-500">Completo</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
