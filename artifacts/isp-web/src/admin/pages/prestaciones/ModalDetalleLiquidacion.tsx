import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPatch, fmt, fmtDate, TIPO_EGRESO_LABELS } from "./helpers";
import type { LiquidacionDetalleResponse, RubroLiquidacion } from "./types";

export function ModalDetalleLiquidacion({ liqId, onClose }: { liqId: number; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<LiquidacionDetalleResponse>({
    queryKey: ["liq-detalle", liqId],
    queryFn: () => apiGet<LiquidacionDetalleResponse>(`/prestaciones/liquidaciones/${liqId}`),
  });

  const anularMut = useMutation({
    mutationFn: () => apiPatch<{ ok: boolean }>(`/prestaciones/liquidaciones/${liqId}/anular`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prestaciones-liqlist"] });
      qc.invalidateQueries({ queryKey: ["liq-detalle", liqId] });
      toast({ title: "Liquidación anulada" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const liq = data?.liquidacion;
  const detalle: RubroLiquidacion[] = data?.detalle ?? [];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#07111f] border border-teal-500/20 text-white rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-bold">
            <FileText className="w-4 h-4 text-teal-400" /> Detalle de Liquidación #{liqId}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="text-white/40 text-sm py-6 text-center">Cargando…</div>
        ) : (
          <div className="space-y-4 mt-2">
            {liq && (
              <div className="bg-white/3 rounded-xl p-3 text-xs text-white/50 space-y-0.5">
                <p><span className="text-white/30">Empleado:</span> {liq.empleado_nombre}</p>
                <p><span className="text-white/30">Egreso:</span> {TIPO_EGRESO_LABELS[liq.causal_egreso] ?? liq.causal_egreso} · {fmtDate(liq.fecha_egreso)}</p>
                <p><span className="text-white/30">Estado:</span> {liq.estado}</p>
              </div>
            )}
            <div className="space-y-2">
              {detalle.map((r) => (
                <div key={r.rubro} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/3 border border-white/6">
                  <span className="text-sm text-white/70">{r.descripcion}</span>
                  <span className="text-sm font-semibold text-white">{fmt(r.monto)}</span>
                </div>
              ))}
              {liq && (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20">
                  <span className="text-sm font-bold text-teal-300">TOTAL GENERAL</span>
                  <span className="text-lg font-bold text-teal-300">{fmt(liq.total_general)}</span>
                </div>
              )}
            </div>
            {(liq?.estado === "confirmada" || liq?.estado === "activa") && (
              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={onClose} className="text-white/50 hover:text-white rounded-xl">Cerrar</Button>
                <Button
                  onClick={() => anularMut.mutate()}
                  disabled={anularMut.isPending}
                  variant="destructive"
                  className="rounded-xl"
                >
                  {anularMut.isPending ? "Anulando…" : "Anular Liquidación"}
                </Button>
              </DialogFooter>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
