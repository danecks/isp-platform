import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { apiFetch, fmtDate, fmtNum } from "./helpers";
import type { PlanillaPago } from "./types";

interface Props {
  pago: PlanillaPago | null;
  onClose: () => void;
  onSuccess: () => void;
  onError?: (msg: string) => void;
}

export function RegistrarPagoModal({ pago, onClose, onSuccess, onError }: Props) {
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  async function handleConfirmar() {
    if (!pago) return;
    setSaving(true);
    setModalError(null);
    try {
      await apiFetch(`/nomina/planillas-especiales/pagos/${pago.id}/pagar`, {
        method: "PATCH",
        body: JSON.stringify({ observaciones: obs || null }),
      });
      setObs("");
      onSuccess();
    } catch (e) {
      const msg = String(e);
      setModalError(msg);
      onError?.(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!pago} onOpenChange={(o) => { if (!o) { setObs(""); onClose(); } }}>
      <DialogContent className="bg-[#0f1623] border border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-green-400 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Registrar Pago {pago?.numero_pago}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {pago && (
            <div className="bg-white/5 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Cuota</span>
                <span className="text-white">Pago {pago.numero_pago} ({parseFloat(pago.porcentaje).toFixed(1)}%)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Monto a pagar</span>
                <span className="text-yellow-300 font-bold text-lg">{fmtNum(pago.total_este_pago)}</span>
              </div>
              {pago.fecha_programada && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Fecha programada</span>
                  <span className="text-white">{fmtDate(pago.fecha_programada)}</span>
                </div>
              )}
            </div>
          )}
          <div>
            <Label className="text-gray-300 mb-2 block">Observaciones (opcional)</Label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ej. Pago realizado por transferencia bancaria..."
              className="bg-white/5 border-white/10 text-white resize-none"
              rows={3}
            />
          </div>
          {modalError && (
            <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="text-sm">{modalError}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" className="text-gray-400" onClick={() => { setObs(""); onClose(); }}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={saving}
            className="bg-green-600 hover:bg-green-700 gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Confirmar Pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
