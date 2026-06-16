import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AlertCircle, Banknote, Building2, Download } from "lucide-react";
import { apiRequest, fmtQ } from "./helpers";
import { downloadFile } from "@/lib/httpClient";
import type { ResumenTransferencias } from "./types";

export function ModalTransferencias({ planillaId, onClose }: { planillaId: number; onClose: () => void }) {
  const [resumen, setResumen] = useState<ResumenTransferencias | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiRequest(`/nomina/planilla/${planillaId}/transferencias-resumen`)
      .then((r: ResumenTransferencias) => setResumen(r))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [planillaId]);

  async function handleDescargar(banco: string) {
    setError(null);
    setDescargando(banco);
    try {
      const safe = banco.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
      await downloadFile(
        `/nomina/planilla/${planillaId}/transferencias?banco=${encodeURIComponent(banco)}`,
        `transferencias_${safe || "banco"}.csv`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar el archivo");
    } finally {
      setDescargando(null);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl bg-[#0d1b2a] border-[#1e3a5f] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-amber-400" />
            Archivos de transferencia bancaria
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="text-xs text-[#8bacc8] bg-[#07111f] border border-[#1e3a5f] rounded-md p-3">
            Se genera <strong className="text-white">un archivo por banco</strong> (no consolidado).
            Cada CSV contiene nombre, DPI, número de cuenta, tipo de cuenta y monto a transferir,
            listo para subir al portal de cada banco.
          </div>

          {loading && <div className="py-8 text-center text-[#8bacc8] text-sm">Cargando resumen...</div>}
          {error && (
            <div className="py-3 px-4 bg-red-950/40 border border-red-800 rounded text-red-300 text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}

          {resumen && resumen.bancos.length === 0 && (
            <div className="py-6 text-center text-[#8bacc8] text-sm bg-[#07111f] border border-[#1e3a5f] rounded">
              No hay empleados con forma de pago <strong>transferencia</strong> en esta planilla.
            </div>
          )}

          {resumen && resumen.bancos.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-widest text-[#8bacc8] font-semibold">
                Bancos a procesar ({resumen.bancos.length})
              </div>
              {resumen.bancos.map((b) => (
                <div key={b.banco}
                  className="flex items-center justify-between bg-[#07111f] border border-[#1e3a5f] rounded-md px-4 py-3 hover:border-amber-700/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{b.banco}</div>
                      <div className="text-xs text-[#8bacc8]">
                        {b.empleados} empleado{b.empleados === 1 ? "" : "s"} · {fmtQ(b.monto)}
                      </div>
                    </div>
                  </div>
                  <Button onClick={() => handleDescargar(b.banco)} size="sm"
                    disabled={descargando !== null}
                    className="bg-amber-600 hover:bg-amber-500 text-white gap-2">
                    <Download className="h-4 w-4" />
                    {descargando === b.banco ? "Descargando..." : "Descargar"}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {resumen && resumen.sinDatos.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-widest text-amber-300/80 font-semibold flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Transferencia sin datos completos ({resumen.sinDatos.length})
              </div>
              <div className="bg-amber-950/20 border border-amber-800/50 rounded-md divide-y divide-amber-900/40">
                {resumen.sinDatos.map((s) => (
                  <div key={s.id} className="px-4 py-2 flex items-center justify-between text-xs">
                    <div>
                      <div className="text-white font-medium">{s.nombre}</div>
                      <div className="text-amber-300/70">DPI {s.dpi || "—"} · {s.razon}</div>
                    </div>
                    <div className="text-amber-200 font-mono">{fmtQ(s.monto)}</div>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-amber-300/70">
                Estos empleados están marcados como transferencia pero les falta banco o número de cuenta.
                Complete sus datos en su ficha y vuelva a abrir este diálogo.
              </div>
            </div>
          )}

          {resumen && resumen.otrosPagos.empleados > 0 && (
            <div className="text-xs text-[#8bacc8] bg-[#07111f] border border-[#1e3a5f] rounded-md px-4 py-2.5 flex items-center justify-between">
              <span>
                <strong className="text-white">{resumen.otrosPagos.empleados}</strong> empleado(s)
                con pago en efectivo / cheque (no se incluyen aquí)
              </span>
              <span className="font-mono text-white/80">{fmtQ(resumen.otrosPagos.monto)}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}
            className="border-[#1e3a5f] text-[#8bacc8] hover:text-white">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
