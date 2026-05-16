import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, ArrowRight } from "lucide-react";
import { apiFetch } from "./helpers";
import { ACCION_LABEL, EstadoBadge, SIGUIENTE_ESTADO } from "./badges";
import type { PlanillaDetalle } from "./types";

export function CambiarEstadoModal({
  open, planilla, onClose, onSuccess, sesionUsuario,
}: {
  open: boolean;
  planilla: PlanillaDetalle | null;
  onClose: () => void;
  onSuccess: () => void;
  sesionUsuario: string;
}) {
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const siguienteEstado = planilla ? SIGUIENTE_ESTADO[planilla.estado] : null;

  async function handleCambiar() {
    if (!planilla || !siguienteEstado) return;
    setError(null);
    setLoading(true);
    try {
      await apiFetch(`/nomina/planilla/${planilla.id}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ estado: siguienteEstado, aprobadoPor: sesionUsuario, observaciones: obs || null }),
      });
      onSuccess();
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!planilla || !siguienteEstado) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0d1b2a] border-[#1e3a5f] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-amber-400">{ACCION_LABEL[siguienteEstado]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3 text-sm">
            <EstadoBadge estado={planilla.estado} />
            <ArrowRight className="h-4 w-4 text-zinc-500" />
            <EstadoBadge estado={siguienteEstado} />
          </div>
          <div>
            <Label className="text-xs text-[#8bacc8] mb-1 block">Observaciones (opcional)</Label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
              placeholder="Comentario para el registro de auditoría"
              className="bg-[#0a1628] border-[#1e3a5f] text-white resize-none" />
          </div>
          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded p-3 text-sm text-red-200 flex gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="text-[#8bacc8]">Cancelar</Button>
          <Button onClick={handleCambiar} disabled={loading}
            className="bg-amber-600 hover:bg-amber-500 text-white">
            {loading ? "Procesando…" : ACCION_LABEL[siguienteEstado]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
