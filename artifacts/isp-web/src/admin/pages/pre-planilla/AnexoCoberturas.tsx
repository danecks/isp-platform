import { useEffect, useState } from "react";
import { Loader2, Repeat2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, fmtFecha } from "./helpers";
import { TablaVacia, TipoCobBadge } from "./badges";
import type { AnexoCobertura } from "./types";

export function AnexoCoberturas({ desde, hasta }: { desde: string; hasta: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<AnexoCobertura[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/nomina/pre-planilla/anexo/coberturas?desde=${desde}&hasta=${hasta}`)
      .then(setRows)
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [desde, hasta]);

  if (loading) return (
    <div className="flex items-center justify-center gap-2 p-10 text-white/30 text-sm">
      <Loader2 className="w-5 h-5 animate-spin" /> Cargando coberturas…
    </div>
  );

  if (!rows?.length) return <TablaVacia msg="No hay relevos ni coberturas registrados en el período." />;

  const totalHoras = rows.reduce((s, r) => s + Number(r.horas), 0);
  const totalRel = rows.filter((r) => r.tipo_cobertura === "relevo").length;

  return (
    <div>
      <div className="px-4 py-3 border-b border-white/6 flex items-center gap-4">
        <Repeat2 className="w-4 h-4 text-purple-400" />
        <span className="text-xs"><span className="text-purple-400 font-bold">{totalRel}</span><span className="text-white/40"> relevos</span></span>
        <span className="text-xs"><span className="text-white font-bold">{rows.length}</span><span className="text-white/40"> coberturas total</span></span>
        <span className="text-xs text-white/40">{totalHoras.toFixed(1)} h cubiertas</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-[#060e1c] border-b border-white/6">
            <tr>
              {["Fecha", "Colaborador que cubrió", "Cliente / Sede", "Puesto cubierto", "Puesto titular", "Horas", "H. Extra", "Tipo"].map((h) => (
                <th key={h} className="text-left text-[10px] text-white/40 font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/3 transition-colors">
                <td className="px-3 py-2.5 whitespace-nowrap text-white/50">{fmtFecha(r.fecha)}</td>
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-white">{r.nombre_completo}</p>
                  <p className="text-white/30">{r.sede ?? "—"}</p>
                </td>
                <td className="px-3 py-2.5 text-white/50">{r.cliente_nombre ?? "—"}</td>
                <td className="px-3 py-2.5 text-white/60">{r.puesto_cubierto_nombre ?? "—"}</td>
                <td className="px-3 py-2.5 text-white/30">{r.puesto_titular_nombre ?? "—"}</td>
                <td className="px-3 py-2.5 text-right text-white/60">{Number(r.horas).toFixed(1)} h</td>
                <td className="px-3 py-2.5 text-right">
                  {Number(r.horas_extra) > 0
                    ? <span className="text-orange-400 font-semibold">{Number(r.horas_extra).toFixed(1)} h</span>
                    : <span className="text-white/20">—</span>}
                </td>
                <td className="px-3 py-2.5"><TipoCobBadge tipo={r.tipo_cobertura} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
