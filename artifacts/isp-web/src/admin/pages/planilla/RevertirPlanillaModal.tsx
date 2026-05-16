import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Undo2 } from "lucide-react";
import { apiFetch } from "./helpers";
import type { PlanillaDetalle } from "./types";

export function RevertirPlanillaModal({
  open, planilla, onClose, onSuccess, sesionUsuario,
}: {
  open: boolean;
  planilla: PlanillaDetalle | null;
  onClose: () => void;
  onSuccess: () => void;
  sesionUsuario: string;
}) {
  const [motivo, setMotivo] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const PALABRA = "REVERTIR";

  async function handleRevertir() {
    if (!planilla) return;
    if (confirmar !== PALABRA) { setError(`Escribe ${PALABRA} para confirmar.`); return; }
    if (!motivo.trim()) { setError("El motivo es obligatorio."); return; }
    setError(null);
    setLoading(true);
    try {
      await apiFetch(`/nomina/planilla/${planilla.id}`, {
        method: "DELETE",
        body: JSON.stringify({ anuladoPor: sesionUsuario, motivo }),
      });
      onSuccess();
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!planilla) return null;

  // Contar anticipos vinculados en todas las líneas
  const totalAnticiposVinculados = planilla.lineas.reduce((acc, l) => {
    const ids = Array.isArray(l.anticipo_ids) ? l.anticipo_ids : [];
    return acc + ids.length;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0d1b2a] border-red-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-red-400 flex items-center gap-2">
            <Undo2 className="h-5 w-5" />
            Revertir Planilla
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="bg-red-950/50 border border-red-800 rounded p-4 space-y-2 text-sm">
            <p className="text-red-200 font-medium">Esta acción realizará lo siguiente:</p>
            <ul className="text-red-300 space-y-1 list-disc list-inside">
              <li>La planilla quedará marcada como anulada</li>
              <li>Se eliminarán las {planilla.total_colaboradores} líneas calculadas</li>
              {totalAnticiposVinculados > 0 && (
                <li>
                  Se desvinculan <strong>{totalAnticiposVinculados} anticipo(s)</strong> — vuelven a estado <em>aprobada</em>
                </li>
              )}
              <li>La pre-planilla del período queda abierta para corrección</li>
              <li>Después podrás volver a cerrar y generar una nueva planilla</li>
            </ul>
          </div>

          {planilla.estado === "aprobada" && (
            <div className="bg-amber-950/40 border border-amber-700 rounded p-3 text-amber-300 text-sm flex gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              Esta planilla ya fue aprobada. Asegúrate de que ningún pago haya sido procesado.
            </div>
          )}

          <div>
            <Label className="text-xs text-[#8bacc8] mb-1 block">Motivo de la reversión *</Label>
            <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
              placeholder="Ej. Error en el sueldo base del agente X, se corrige y se re-genera."
              className="bg-[#0a1628] border-[#1e3a5f] text-white resize-none" />
          </div>

          <div>
            <Label className="text-xs text-[#8bacc8] mb-1 block">
              Escribe <strong className="text-red-400">{PALABRA}</strong> para confirmar
            </Label>
            <Input value={confirmar} onChange={e => setConfirmar(e.target.value.toUpperCase())}
              placeholder={PALABRA}
              className="bg-[#0a1628] border-[#1e3a5f] text-white font-mono" />
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
          <Button onClick={handleRevertir} disabled={loading || confirmar !== PALABRA}
            className="bg-red-700 hover:bg-red-600 text-white gap-2">
            <Undo2 className="h-4 w-4" />
            {loading ? "Revirtiendo…" : "Revertir planilla"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
