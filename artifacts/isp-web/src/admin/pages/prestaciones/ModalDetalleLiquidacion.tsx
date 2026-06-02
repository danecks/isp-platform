import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { FileText, Pencil, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermisos } from "@/hooks/usePermisos";
import { apiGet, apiPatch, fmt, fmtDate, TIPO_EGRESO_LABELS } from "./helpers";
import type { LiquidacionDetalleResponse, RubroLiquidacion } from "./types";

export function ModalDetalleLiquidacion({ liqId, onClose }: { liqId: number; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { tienePermiso } = usePermisos();
  const puedeEditar = tienePermiso("editar_liquidacion");

  const [editando, setEditando] = useState(false);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState("");

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

  const editarMut = useMutation({
    mutationFn: () => {
      const montos = detalle
        .map((r) => ({ rubro: r.rubro, monto: parseFloat(valores[r.rubro] ?? String(r.monto)) }))
        .filter((m) => isFinite(m.monto));
      return apiPatch<{ ok: boolean; total_general: number }>(
        `/prestaciones/liquidaciones/${liqId}/editar-montos`,
        { montos, motivo: motivo.trim() || undefined },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prestaciones-liqlist"] });
      qc.invalidateQueries({ queryKey: ["liq-detalle", liqId] });
      toast({ title: "Liquidación actualizada" });
      setEditando(false);
      setMotivo("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const liq = data?.liquidacion;
  const detalle: RubroLiquidacion[] = data?.detalle ?? [];
  const ediciones = data?.ediciones ?? [];
  const esActiva = liq?.estado === "confirmada" || liq?.estado === "activa";

  const totalPreview = editando
    ? detalle.reduce((s, r) => {
        const v = parseFloat(valores[r.rubro] ?? String(r.monto));
        return s + (isFinite(v) ? v : 0);
      }, 0)
    : 0;

  function abrirEdicion() {
    const init: Record<string, string> = {};
    detalle.forEach((r) => { init[r.rubro] = String(r.monto); });
    setValores(init);
    setEditando(true);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#07111f] border border-teal-500/20 text-white rounded-2xl max-w-md max-h-[88vh] overflow-y-auto">
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
                {liq.editado && (
                  <p className="text-amber-300/80 flex items-center gap-1 pt-1">
                    <Pencil className="w-3 h-3" /> Editada por {liq.editado_por ?? "—"}
                    {liq.editado_at ? ` · ${fmtDate(liq.editado_at)}` : ""}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              {detalle.map((r) => {
                const original = r.monto_original != null ? parseFloat(String(r.monto_original)) : null;
                return (
                  <div key={r.rubro} className="px-3 py-2 rounded-xl bg-white/3 border border-white/6">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-white/70">{r.descripcion}</span>
                      {editando ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-white/30">Q</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={valores[r.rubro] ?? ""}
                            onChange={(e) => setValores((v) => ({ ...v, [r.rubro]: e.target.value }))}
                            className="w-28 bg-[#060e1c] border border-teal-500/30 rounded-lg px-2 py-1 text-sm text-right text-white outline-none focus:border-teal-400"
                          />
                        </div>
                      ) : (
                        <span className="text-sm font-semibold text-white">{fmt(r.monto)}</span>
                      )}
                    </div>
                    {!editando && original != null && original !== parseFloat(String(r.monto)) && (
                      <p className="text-[10px] text-white/30 mt-0.5">Calculado original: {fmt(original)}</p>
                    )}
                  </div>
                );
              })}

              {liq && (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20">
                  <span className="text-sm font-bold text-teal-300">TOTAL GENERAL</span>
                  <span className="text-lg font-bold text-teal-300">
                    {fmt(editando ? totalPreview : liq.total_general)}
                  </span>
                </div>
              )}
            </div>

            {editando && (
              <div className="space-y-1.5">
                <label className="text-[11px] text-white/50">Motivo del ajuste (opcional)</label>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={2}
                  placeholder="Ej. Acuerdo de mutuo consentimiento, ajuste de días…"
                  className="w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-teal-500/40 resize-none"
                />
              </div>
            )}

            {/* Historial de ediciones */}
            {!editando && ediciones.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wide flex items-center gap-1">
                  <History className="w-3 h-3" /> Historial de cambios
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {ediciones.map((e, i) => (
                    <div key={i} className="text-[10px] text-white/40 bg-white/3 rounded-lg px-2.5 py-1.5 border border-white/5">
                      <span className="text-white/60">{TIPO_EGRESO_LABELS[e.rubro] ?? e.rubro}</span>{": "}
                      {fmt(e.monto_anterior)} → <span className="text-amber-300/80">{fmt(e.monto_nuevo)}</span>
                      <span className="text-white/25"> · {e.editado_por ?? "—"} · {fmtDate(e.editado_at)}</span>
                      {e.motivo && <p className="text-white/30 italic">{e.motivo}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {esActiva && (
              <DialogFooter className="gap-2 pt-2">
                {editando ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => { setEditando(false); setMotivo(""); }}
                      className="text-white/50 hover:text-white rounded-xl"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => editarMut.mutate()}
                      disabled={editarMut.isPending}
                      className="bg-teal-600 hover:bg-teal-500 text-white rounded-xl"
                    >
                      {editarMut.isPending ? "Guardando…" : "Guardar montos"}
                    </Button>
                  </>
                ) : (
                  <>
                    {puedeEditar && (
                      <Button
                        type="button"
                        onClick={abrirEdicion}
                        className="bg-teal-600/20 hover:bg-teal-600/30 text-teal-200 border border-teal-500/30 rounded-xl mr-auto"
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar montos
                      </Button>
                    )}
                    <Button type="button" variant="ghost" onClick={onClose} className="text-white/50 hover:text-white rounded-xl">Cerrar</Button>
                    <Button
                      onClick={() => anularMut.mutate()}
                      disabled={anularMut.isPending}
                      variant="destructive"
                      className="rounded-xl"
                    >
                      {anularMut.isPending ? "Anulando…" : "Anular Liquidación"}
                    </Button>
                  </>
                )}
              </DialogFooter>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
