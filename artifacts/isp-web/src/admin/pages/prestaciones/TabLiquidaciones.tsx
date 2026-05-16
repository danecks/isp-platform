import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CalendarX, ChevronRight, Search, UserX,
} from "lucide-react";
import { apiGet, fmt, fmtDate, ESTADO_BADGE, TIPO_EGRESO_LABELS } from "./helpers";
import type { LiquidacionItem } from "./types";
import { ModalLiquidacion } from "./ModalLiquidacion";
import { ModalDetalleLiquidacion } from "./ModalDetalleLiquidacion";

export function TabLiquidaciones() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [busEmp, setBusEmp] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todas");

  const { data, isLoading } = useQuery<{ rows: LiquidacionItem[]; total: number }>({
    queryKey: ["prestaciones-liqlist"],
    queryFn: () => apiGet("/prestaciones/liquidaciones"),
    staleTime: 30_000,
  });

  const todas = data?.rows ?? [];

  // Estadísticas rápidas — "confirmada" es el estado activo en la BD
  const activas = todas.filter((l) => l.estado === "confirmada" || l.estado === "activa");
  const totalPagado = activas.reduce((s, l) => s + parseFloat(String(l.total_general) || "0"), 0);

  const liqFilt = todas.filter((l) => {
    const matchNombre = !busEmp || (l.empleado ?? "").toLowerCase().includes(busEmp.toLowerCase());
    const matchEstado = filtroEstado === "todas" || l.estado === filtroEstado;
    return matchNombre && matchEstado;
  });

  return (
    <div className="p-6 space-y-6">

      {/* Banner informativo */}
      <div className="flex items-start gap-3 bg-orange-500/8 border border-orange-500/20 rounded-2xl px-4 py-3">
        <UserX className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-orange-300">Módulo de Bajas y Liquidaciones</p>
          <p className="text-[11px] text-white/40 mt-0.5">
            Aquí se registra la baja formal de un colaborador. Al confirmar, el sistema calcula su liquidación según la ley guatemalteca, actualiza su estado a <span className="text-white/60">BAJA</span> y guarda el registro para auditoría.
          </p>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
          <p className="text-[11px] text-white/40 uppercase tracking-wide">Total Bajas</p>
          <p className="text-2xl font-bold text-white mt-1">{activas.length}</p>
          <p className="text-[10px] text-white/30 mt-0.5">registros activos</p>
        </div>
        <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
          <p className="text-[11px] text-white/40 uppercase tracking-wide">Total Pagado</p>
          <p className="text-xl font-bold text-orange-300 mt-1">{fmt(totalPagado)}</p>
          <p className="text-[10px] text-white/30 mt-0.5">en liquidaciones activas</p>
        </div>
        <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
          <p className="text-[11px] text-white/40 uppercase tracking-wide">Renuncias</p>
          <p className="text-2xl font-bold text-white mt-1">{activas.filter(l => l.causal_egreso === "renuncia").length}</p>
          <p className="text-[10px] text-white/30 mt-0.5">por renuncia voluntaria</p>
        </div>
        <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
          <p className="text-[11px] text-white/40 uppercase tracking-wide">Despidos</p>
          <p className="text-2xl font-bold text-white mt-1">{activas.filter(l => l.causal_egreso?.includes("despido")).length}</p>
          <p className="text-[10px] text-white/30 mt-0.5">justificados e injustificados</p>
        </div>
      </div>

      {/* Barra de búsqueda y acción */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <Input
              className="bg-[#060e1c] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-white outline-none focus:border-orange-500/40"
              placeholder="Buscar colaborador…"
              value={busEmp}
              onChange={(e) => setBusEmp(e.target.value)}
            />
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/70 outline-none focus:border-orange-500/40 appearance-none"
          >
            <option value="todas">Todas</option>
            <option value="confirmada">Confirmadas</option>
            <option value="anulada">Anuladas</option>
          </select>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-semibold"
        >
          <UserX className="w-4 h-4 mr-2" /> Dar de Baja a Empleado
        </Button>
      </div>

      {/* Historial de bajas */}
      <div className="rounded-2xl border border-white/8 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
          <CalendarX className="w-3.5 h-3.5 text-white/30" />
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Historial de Bajas</span>
          {liqFilt.length > 0 && (
            <Badge className="ml-auto bg-white/5 text-white/40 border-white/10 text-[10px]">{liqFilt.length} registro{liqFilt.length !== 1 ? "s" : ""}</Badge>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-white/8 hover:bg-transparent">
              <TableHead className="text-white/40 text-xs">#</TableHead>
              <TableHead className="text-white/40 text-xs">Colaborador</TableHead>
              <TableHead className="text-white/40 text-xs">Motivo de Egreso</TableHead>
              <TableHead className="text-white/40 text-xs">Fecha de Baja</TableHead>
              <TableHead className="text-white/40 text-xs text-right">Liquidación</TableHead>
              <TableHead className="text-white/40 text-xs">Estado</TableHead>
              <TableHead className="text-white/40 text-xs" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-white/30 text-xs py-10">Cargando…</TableCell></TableRow>
            )}
            {!isLoading && liqFilt.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-white/25 text-xs py-14">
                <div className="flex flex-col items-center gap-2">
                  <UserX className="w-7 h-7 text-white/15" />
                  <span className="text-white/30">No hay bajas registradas</span>
                  <button
                    onClick={() => setModalOpen(true)}
                    className="mt-2 text-orange-400 hover:text-orange-300 text-xs underline underline-offset-2 transition-colors"
                  >
                    Registrar primera baja
                  </button>
                </div>
              </TableCell></TableRow>
            )}
            {liqFilt.map((l) => {
              const badge = ESTADO_BADGE[l.estado] ?? { label: l.estado, cls: "bg-white/10 text-white/50" };
              return (
                <TableRow key={l.id} className="border-white/5 hover:bg-white/3 cursor-pointer" onClick={() => setDetalleId(l.id)}>
                  <TableCell className="text-xs text-white/40">{l.id}</TableCell>
                  <TableCell className="text-sm text-white/80 font-medium">{l.empleado}</TableCell>
                  <TableCell className="text-sm text-white/60">{TIPO_EGRESO_LABELS[l.causal_egreso] ?? l.causal_egreso}</TableCell>
                  <TableCell className="text-sm text-white/60">{fmtDate(l.fecha_egreso)}</TableCell>
                  <TableCell className="text-sm font-semibold text-orange-300 text-right">{fmt(l.total_general)}</TableCell>
                  <TableCell>
                    <Badge className={`${badge.cls} text-xs border`}>{badge.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-teal-400" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {modalOpen && (
        <ModalLiquidacion
          onClose={() => setModalOpen(false)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["prestaciones-liqlist"] });
            qc.invalidateQueries({ queryKey: ["employees-activos"] });
          }}
        />
      )}
      {detalleId !== null && (
        <ModalDetalleLiquidacion liqId={detalleId} onClose={() => setDetalleId(null)} />
      )}
    </div>
  );
}
