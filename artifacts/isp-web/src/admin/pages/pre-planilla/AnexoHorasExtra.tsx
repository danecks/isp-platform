import { useEffect, useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, fmtFecha } from "./helpers";
import { TablaVacia, TipoCobBadge } from "./badges";
import type { AnexoHE } from "./types";

export function AnexoHorasExtra({ desde, hasta }: { desde: string; hasta: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<AnexoHE[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/nomina/pre-planilla/anexo/horas-extra?desde=${desde}&hasta=${hasta}`)
      .then(setRows)
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [desde, hasta]);

  if (loading) return (
    <div className="flex items-center justify-center gap-2 p-10 text-white/30 text-sm">
      <Loader2 className="w-5 h-5 animate-spin" /> Cargando horas extra…
    </div>
  );

  if (!rows?.length) return <TablaVacia msg="No hay horas extra registradas en el período." />;

  const totalHE = rows.reduce((s, r) => s + Number(r.horas_extra), 0);

  return (
    <div>
      <div className="px-4 py-3 border-b border-white/6 flex items-center gap-3">
        <TrendingUp className="w-4 h-4 text-orange-400" />
        <span className="text-xs text-white/60">{rows.length} registros</span>
        <span className="text-xs font-bold text-orange-400">{totalHE.toFixed(1)} h extra total</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-[#060e1c] border-b border-white/6">
            <tr>
              {["Fecha", "Colaborador", "Cliente / Sede", "Puesto cubierto", "H. Extra", "H. Trab.", "Estado RRHH", "Tipo"].map((h) => (
                <th key={h} className="text-left text-[10px] text-white/40 font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {rows.map((r) => {
              const estadoHE = r.horas_extra_estado ?? "pendiente";
              const estadoClass = estadoHE === "aprobado"
                ? "bg-green-400/10 text-green-400 border-green-400/20"
                : estadoHE === "rechazado"
                ? "bg-red-400/10 text-red-400 border-red-400/20"
                : estadoHE === "pagado_efectivo"
                ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                : "bg-amber-400/10 text-amber-400 border-amber-400/20";
              const estadoLabel = estadoHE === "aprobado" ? "Aprobado"
                : estadoHE === "rechazado" ? "Rechazado"
                : estadoHE === "pagado_efectivo" ? "Cash"
                : "Pendiente";
              const handleCash = async () => {
                try {
                  await apiFetch(`/api/rrhh/horas-extra/${r.id}/cash`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ aprobado_por: "RRHH" }),
                  });
                  toast({ title: "HE marcada como pagada en efectivo" });
                  setRows(prev => prev?.map(x => x.id === r.id ? { ...x, horas_extra_estado: "pagado_efectivo" } : x) ?? null);
                } catch (e: any) {
                  toast({ title: "Error", description: e.message, variant: "destructive" });
                }
              };
              return (
              <tr key={r.id} className={`hover:bg-white/3 transition-colors ${estadoHE === "rechazado" ? "opacity-40" : ""}`}>
                <td className="px-3 py-2.5 text-white/50 whitespace-nowrap">{fmtFecha(r.fecha)}</td>
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-white">{r.nombre_completo}</p>
                  <p className="text-white/30">{r.sede ?? "—"}</p>
                </td>
                <td className="px-3 py-2.5 text-white/50">{r.cliente_nombre ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <p className="text-white/60">{r.puesto_cubierto_nombre ?? r.puesto_titular_nombre ?? "—"}</p>
                  {r.puesto_cubierto_nombre && r.puesto_cubierto_nombre !== r.puesto_titular_nombre && (
                    <p className="text-[10px] text-white/30">Titular: {r.puesto_titular_nombre}</p>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className={`font-bold ${estadoHE === "rechazado" ? "line-through text-white/30" : estadoHE === "pagado_efectivo" ? "text-emerald-400" : "text-orange-400"}`}>{Number(r.horas_extra).toFixed(1)} h</span>
                </td>
                <td className="px-3 py-2.5 text-right text-white/50">{Number(r.horas_trabajadas).toFixed(1)} h</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${estadoClass}`}>{estadoLabel}</span>
                    {estadoHE === "pendiente" && (
                      <button onClick={handleCash} className="text-[9px] px-1.5 py-0.5 rounded border border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10 transition-colors" title="Marcar como pagada en efectivo (no va a planilla)">Cash</button>
                    )}
                  </div>
                  {r.horas_extra_aprobadas_por && (
                    <p className="text-[9px] text-white/25 mt-0.5">{r.horas_extra_aprobadas_por}</p>
                  )}
                </td>
                <td className="px-3 py-2.5"><TipoCobBadge tipo={r.tipo} /></td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
