import { useEffect, useState } from "react";
import { Loader2, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, fmtFecha, fmtQ } from "./helpers";
import { TablaVacia } from "./badges";
import type { AnexoAnticipo } from "./types";

export function AnexoAnticipos({ desde, hasta }: { desde: string; hasta: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<AnexoAnticipo[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/nomina/pre-planilla/anexo/anticipos?desde=${desde}&hasta=${hasta}`)
      .then(setRows)
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [desde, hasta]);

  if (loading) return (
    <div className="flex items-center justify-center gap-2 p-10 text-white/30 text-sm">
      <Loader2 className="w-5 h-5 animate-spin" /> Cargando anticipos…
    </div>
  );

  if (!rows?.length) return <TablaVacia msg="No hay anticipos aprobados/pagados en el período." />;

  const totalMonto = rows.reduce((s, r) => s + Number(r.cantidad), 0);

  return (
    <div>
      <div className="px-4 py-3 border-b border-white/6 flex items-center gap-3">
        <CreditCard className="w-4 h-4 text-amber-400" />
        <span className="text-xs text-white/60">{rows.length} anticipos</span>
        <span className="text-xs font-bold text-amber-400">{fmtQ(totalMonto)} total</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-[#060e1c] border-b border-white/6">
            <tr>
              {["Fecha", "Colaborador", "Sede", "Monto", "Estado", "Período", "Origen", "¿En planilla?"].map((h) => (
                <th key={h} className="text-left text-[10px] text-white/40 font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/3 transition-colors">
                <td className="px-3 py-2.5 whitespace-nowrap text-white/50">{fmtFecha(r.fecha_solicitud)}</td>
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-white">{r.nombre_completo}</p>
                  <p className="text-white/30 text-[10px]">{r.dpi ? `****${r.dpi.slice(-4)}` : "—"}</p>
                </td>
                <td className="px-3 py-2.5 text-white/40">{r.sede ?? "—"}</td>
                <td className="px-3 py-2.5 text-right">
                  <span className="text-amber-400 font-bold">{fmtQ(r.cantidad)}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${
                    r.estado === "pagada" ? "text-green-400 bg-green-400/10 border-green-400/20" :
                    r.estado === "aprobada" ? "text-blue-400 bg-blue-400/10 border-blue-400/20" :
                    "text-white/30 bg-white/5 border-white/10"
                  }`}>{r.estado}</span>
                </td>
                <td className="px-3 py-2.5 text-white/40">{r.periodo ?? "—"}</td>
                <td className="px-3 py-2.5 text-white/40">{r.origen}</td>
                <td className="px-3 py-2.5 text-center">
                  {r.planilla_id != null
                    ? <span className="text-green-400 text-[10px] font-semibold">Sí #{r.planilla_id}</span>
                    : <span className="text-white/25 text-[10px]">Pendiente</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
