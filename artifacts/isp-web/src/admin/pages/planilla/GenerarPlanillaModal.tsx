import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Info } from "lucide-react";
import { apiRequest } from "./helpers";

export function GenerarPlanillaModal({
  open, onClose, onSuccess, sesionUsuario,
}: { open: boolean; onClose: () => void; onSuccess: (id: number) => void; sesionUsuario: string }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerar() {
    if (!desde || !hasta) { setError("Debe ingresar el período completo."); return; }
    if (desde >= hasta)   { setError("La fecha de inicio debe ser anterior al fin."); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ id: number }>("/nomina/planilla", {
        method: "POST",
        json: { desde, hasta, generadoPor: sesionUsuario, observaciones: obs || null },
      });
      onSuccess(res.id);
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0d1b2a] border-[#1e3a5f] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-amber-400">Generar Planilla Final</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="bg-blue-950 border border-blue-800 rounded p-3 text-sm text-blue-200 flex gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              La planilla se genera a partir del snapshot del período cerrado en Pre-Planilla.
              Solo puede existir <strong>una planilla por período</strong>.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-[#8bacc8] mb-1 block">Período desde *</Label>
              <Input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className="bg-[#0a1628] border-[#1e3a5f] text-white" />
            </div>
            <div>
              <Label className="text-xs text-[#8bacc8] mb-1 block">Período hasta *</Label>
              <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                className="bg-[#0a1628] border-[#1e3a5f] text-white" />
            </div>
          </div>

          <div>
            <Label className="text-xs text-[#8bacc8] mb-1 block">Observaciones (opcional)</Label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
              placeholder="Ej. Período quincenal enero 2025"
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
          <Button onClick={handleGenerar} disabled={loading}
            className="bg-amber-600 hover:bg-amber-500 text-white">
            {loading ? "Generando…" : "Generar planilla"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
