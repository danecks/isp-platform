import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Landmark, Plus, AlertCircle, Eye, Loader2 } from "lucide-react";
import { ESTADO_COLOR, TIPO_LABEL, fmtDate, fmtNum } from "./helpers";
import type { PlanillaEspecial } from "./types";

interface Props {
  planillas: PlanillaEspecial[];
  loading: boolean;
  error: string | null;
  onSelect: (id: number) => void;
  onNueva: () => void;
}

export function ListaPlanillasEspeciales({
  planillas, loading, error, onSelect, onNueva,
}: Props) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Landmark className="w-6 h-6 text-yellow-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Planillas Especiales</h1>
            <p className="text-sm text-gray-400">Bono 14 y Aguinaldo — pagos fraccionados</p>
          </div>
        </div>
        <Button
          onClick={onNueva}
          className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold gap-2"
        >
          <Plus className="w-4 h-4" /> Generar Planilla
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-[#0f1623] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Cargando planillas...</span>
          </div>
        ) : planillas.length === 0 ? (
          <div className="py-20 text-center text-gray-500">
            <Landmark className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay planillas especiales generadas</p>
            <p className="text-xs text-gray-600 mt-1">
              Generá la primera planilla de Bono 14 o Aguinaldo
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-gray-400">Tipo</TableHead>
                <TableHead className="text-gray-400">Año</TableHead>
                <TableHead className="text-gray-400">Período</TableHead>
                <TableHead className="text-gray-400 text-right">Colaboradores</TableHead>
                <TableHead className="text-gray-400 text-right">Total Bruto</TableHead>
                <TableHead className="text-gray-400 text-center">Pagos</TableHead>
                <TableHead className="text-gray-400">Estado</TableHead>
                <TableHead className="text-gray-400">Generado por</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {planillas.map((p) => (
                <TableRow key={p.id} className="border-white/5 hover:bg-white/5">
                  <TableCell>
                    <span className="font-semibold text-yellow-300">
                      {TIPO_LABEL[p.tipo]}
                    </span>
                  </TableCell>
                  <TableCell className="text-white font-mono">{p.anio}</TableCell>
                  <TableCell className="text-gray-400 text-sm">
                    {fmtDate(p.periodo_inicio)} – {fmtDate(p.periodo_fin)}
                  </TableCell>
                  <TableCell className="text-right text-white">
                    {p.total_colaboradores}
                  </TableCell>
                  <TableCell className="text-right text-white font-semibold">
                    {fmtNum(p.total_bruto)}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-gray-300 text-sm">
                      {p.pagos_realizados}/{p.num_pagos}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`text-xs border ${ESTADO_COLOR[p.estado] ?? ""}`}
                      variant="outline"
                    >
                      {p.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-400 text-sm">{p.generado_por}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-yellow-400 hover:text-yellow-300 gap-1"
                      onClick={() => onSelect(p.id)}
                    >
                      <Eye className="w-3.5 h-3.5" /> Ver
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
