import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, MinusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, fmtFecha } from "./helpers";
import { TablaVacia } from "./badges";
import type { AnexoFalta } from "./types";

export function AnexoFaltas({ desde, hasta }: { desde: string; hasta: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<AnexoFalta[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiRequest(`/api/nomina/pre-planilla/anexo/faltas?desde=${desde}&hasta=${hasta}`)
      .then(setRows)
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [desde, hasta]);

  if (loading) return (
    <div className="flex items-center justify-center gap-2 p-10 text-white/30 text-sm">
      <Loader2 className="w-5 h-5 animate-spin" /> Cargando faltas…
    </div>
  );

  if (!rows?.length) return <TablaVacia msg="No hay faltas ni suspensiones registradas en el período." />;

  const totalFaltas = rows.filter((r) => r.falta).length;
  const totalSusp = rows.filter((r) => r.suspension).length;

  return (
    <div>
      <div className="px-4 py-3 border-b border-white/6 flex items-center gap-4">
        <AlertTriangle className="w-4 h-4 text-red-400" />
        <span className="text-xs"><span className="text-red-400 font-bold">{totalFaltas}</span><span className="text-white/40"> faltas</span></span>
        <span className="text-xs"><span className="text-amber-400 font-bold">{totalSusp}</span><span className="text-white/40"> suspensiones</span></span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-[#060e1c] border-b border-white/6">
            <tr>
              {["Fecha", "Colaborador", "Sede", "Tipo", "Descuento día", "Cubierto por", "Ref. / Contexto"].map((h) => (
                <th key={h} className="text-left text-[10px] text-white/40 font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {rows.map((r) => (
              <tr key={r.id} className={`hover:bg-white/3 transition-colors ${r.falta ? "bg-red-500/3" : "bg-amber-500/3"}`}>
                <td className="px-3 py-2.5 whitespace-nowrap text-white/50">{fmtFecha(r.fecha)}</td>
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-white">{r.nombre_completo}</p>
                  <p className="text-white/30 text-[10px]">{r.dpi ? `****${r.dpi.slice(-4)}` : "—"}</p>
                </td>
                <td className="px-3 py-2.5 text-white/40">{r.sede ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col gap-0.5">
                    {r.falta && <span className="px-2 py-0.5 rounded bg-red-400/10 text-red-400 border border-red-400/20 font-semibold">Falta</span>}
                    {r.suspension && <span className="px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20 font-semibold">Suspensión</span>}
                    {r.tipo_novedad && (() => {
                      const m: Record<string,string> = {
                        falta_total:"Falta total",abandono_parcial:"Abandono parcial",
                        vacaciones:"Vacaciones",incapacidad:"Incap. IGSS",
                        suspension:"Suspensión",permiso_con_goce:"Permiso c/goce",
                        permiso_sin_goce:"Permiso s/goce",relevo_completo:"Relevo completo",
                        relevo_parcial:"Relevo parcial",relevo_vacaciones:"Cob. vacaciones",
                        horas_extra_puras:"HE",ssa_externo:"SSA",cambio_titular:"Cambio titular",
                      };
                      return (
                        <span className="text-[10px] text-white/40 italic">{m[r.tipo_novedad!] ?? r.tipo_novedad}</span>
                      );
                    })()}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-center">
                  {r.descuento_dia ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <MinusCircle className="w-3.5 h-3.5 text-red-400" />
                      {r.dias_descuento && (
                        <span className="text-[9px] font-bold text-red-400 bg-red-400/10 border border-red-400/20 rounded px-1">
                          {r.dias_descuento}x
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-white/20">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {r.cubierto_por_nombre ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-emerald-300 font-semibold">{r.cubierto_por_nombre}</span>
                      {r.cubierto_puesto_nombre && (
                        <span className="text-white/30 text-[10px]">{r.cubierto_puesto_nombre}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-white/20">No cubierto</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-white/30 max-w-[160px] truncate">{r.observaciones ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
