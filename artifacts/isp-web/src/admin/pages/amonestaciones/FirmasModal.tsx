import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PenLine } from "lucide-react";
import { generarActaPdf, type DatosActaPdf } from "../../../lib/actaPdf";
import { api } from "./helpers";
import type { Amonestacion } from "./types";

export function FirmasModal({ amon, onClose, onFirmada }: {
  amon: Amonestacion; onClose: () => void; onFirmada: () => void;
}) {
  const [firmaCol, setFirmaCol] = useState(amon.firma_colaborador || amon.empleado_nombre);
  const [firmaLev, setFirmaLev] = useState(amon.firma_levanta || amon.creado_por_username || "");
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: async () => {
      if (!firmaCol.trim() || !firmaLev.trim()) {
        throw new Error("Ambas firmas son requeridas");
      }
      // Generar PDF firmado y descargarlo
      const datos = await api<DatosActaPdf>(`/amonestaciones/${amon.id}/datos-pdf`);
      const datosFirmados: DatosActaPdf = {
        ...datos,
        amonestacion: {
          ...datos.amonestacion,
          firma_colaborador: firmaCol.trim(),
          firma_levanta: firmaLev.trim(),
          firmada_at: new Date().toISOString(),
        },
      };
      const doc = generarActaPdf(datosFirmados);
      doc.save(`acta_administrativa_${amon.acta_numero ?? amon.id}_FIRMADA_${amon.empleado_nombre.replace(/\s+/g, "_")}.pdf`);
      return api(`/amonestaciones/${amon.id}/firmar`, {
        method: "POST",
        body: JSON.stringify({
          firma_colaborador: firmaCol.trim(),
          firma_levanta: firmaLev.trim(),
        }),
      });
    },
    onSuccess: onFirmada,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-md p-4">
        <h4 className="text-white font-semibold flex items-center gap-2">
          <PenLine className="w-5 h-5 text-emerald-300" /> Registrar firmas del acta
        </h4>
        <p className="text-white/50 text-xs mt-1">
          Confirma el nombre del colaborador firmante y de quien levanta. El PDF se descargará y queda registrado el momento de la firma.
        </p>
        <div className="space-y-3 mt-3">
          <div>
            <label className="text-xs text-white/50 font-medium">Nombre completo del colaborador *</label>
            <input type="text" value={firmaCol} onChange={e => setFirmaCol(e.target.value)}
              className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-white/50 font-medium">Nombre de quien levanta (RRHH/Supervisor) *</label>
            <input type="text" value={firmaLev} onChange={e => setFirmaLev(e.target.value)}
              className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          {error && <div className="text-red-400 text-sm">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onClose} className="px-3 py-2 bg-white/5 text-white/70 rounded-lg text-sm">Cancelar</button>
          <button onClick={() => { setError(null); guardar.mutate(); }} disabled={guardar.isPending}
            className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg text-sm">
            {guardar.isPending ? "Guardando…" : "Firmar y descargar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
