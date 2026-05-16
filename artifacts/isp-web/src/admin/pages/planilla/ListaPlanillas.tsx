import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileSpreadsheet, Lock, Plus } from "lucide-react";
import { fmtFecha, fmtQ } from "./helpers";
import { EstadoBadge } from "./badges";
import type { PlanillaResumen } from "./types";

export function ListaPlanillas({
  planillas, onSelect, onNueva, loading,
}: {
  planillas: PlanillaResumen[];
  onSelect: (p: PlanillaResumen) => void;
  onNueva: () => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Planilla Final de Nómina</h1>
          <p className="text-[#8bacc8] text-sm mt-1">
            Planillas generadas desde períodos cerrados de pre-planilla
          </p>
        </div>
        <Button onClick={onNueva} className="bg-amber-600 hover:bg-amber-500 text-white gap-2">
          <Plus className="h-4 w-4" />
          Generar planilla
        </Button>
      </div>

      {/* Nota informativa */}
      <div className="bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg p-4 flex gap-3 text-sm text-[#8bacc8]">
        <Lock className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
        <div>
          <strong className="text-white">Ciclo completo:</strong> Operación diaria → Novedades de nómina → Pre-Planilla (cierre) → <strong className="text-amber-400">Planilla Final</strong>.
          La planilla se genera automáticamente desde el snapshot del período cerrado. No se edita directamente.
          Si hay un error, se regresa a la pre-planilla, se corrige y se cierra nuevamente.
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-[#8bacc8]">Cargando planillas…</div>
      ) : !planillas.length ? (
        <div className="text-center py-16 text-[#8bacc8]">
          <FileSpreadsheet className="h-14 w-14 mx-auto mb-4 opacity-30" />
          <p className="text-lg">No hay planillas generadas todavía</p>
          <p className="text-sm mt-2">Cierra un período en Pre-Planilla y luego genera la planilla aquí.</p>
          <Button onClick={onNueva} className="mt-6 bg-amber-600 hover:bg-amber-500 text-white gap-2">
            <Plus className="h-4 w-4" />
            Generar planilla
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {planillas.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className="w-full text-left bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg p-4 hover:border-amber-600/50 hover:bg-[#1e3a5f]/30 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-semibold">
                      {fmtFecha(p.periodo_desde)} — {fmtFecha(p.periodo_hasta)}
                    </span>
                    <EstadoBadge estado={p.estado} />
                  </div>
                  <div className="text-xs text-[#8bacc8] mt-1">
                    Generada por <strong>{p.generado_por}</strong> el {fmtFecha(p.fecha_generacion)}
                    &nbsp;·&nbsp; {p.total_colaboradores} colaboradores
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-green-400">{fmtQ(p.total_neto)}</div>
                  <div className="text-xs text-[#8bacc8]">neto a pagar</div>
                </div>
              </div>
              <Separator className="my-3 bg-[#1e3a5f]" />
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-[#8bacc8]">Sueldo período: </span>
                  <span className="text-white">{fmtQ(p.total_sueldo_periodo)}</span>
                </div>
                <div>
                  <span className="text-[#8bacc8]">Desc. faltas: </span>
                  <span className="text-red-400">{fmtQ(p.total_desc_faltas)}</span>
                </div>
                <div>
                  <span className="text-[#8bacc8]">Anticipos: </span>
                  <span className="text-orange-400">{fmtQ(p.total_anticipos)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
