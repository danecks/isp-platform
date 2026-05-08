import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { api } from "./api";

interface CargaSupervisor {
  supervisor_employee_id: number;
  supervisor_nombre: string;
  sem_1: number; sem_2: number; sem_3: number; sem_4: number; sem_5: number;
  total: number;
  sedes_distintas: number;
}

export function PlanMensualCarga({ refreshKey }: { refreshKey: number }) {
  const [carga, setCarga] = useState<CargaSupervisor[]>([]);
  const [loading, setLoading] = useState(true);

  async function cargar() {
    try {
      setLoading(true);
      const r = await api<{ carga: CargaSupervisor[] }>("/supervision-plan-mensual/carga-supervisores");
      setCarga(r.carga);
    } catch { /* tolerar */ }
    finally { setLoading(false); }
  }

  useEffect(() => { cargar(); }, [refreshKey]);

  const maxTotal = Math.max(1, ...carga.map(c => c.total));

  return (
    <div className="bg-[#0b1424] border border-white/10 rounded-lg p-3">
      <h3 className="text-xs font-bold text-white inline-flex items-center gap-1.5 mb-2">
        <Users className="w-3.5 h-3.5 text-primary" /> Carga por supervisor (sedes en plan)
      </h3>
      {loading && <div className="text-white/40 text-xs p-2">Cargando…</div>}
      {!loading && carga.length === 0 && (
        <div className="text-white/40 text-xs p-2">Sin supervisores activos.</div>
      )}
      {!loading && carga.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-white/50 text-[10px] uppercase">
              <tr>
                <th className="text-left px-2 py-1">Supervisor</th>
                <th className="text-center px-1 py-1">Sem 1</th>
                <th className="text-center px-1 py-1">Sem 2</th>
                <th className="text-center px-1 py-1">Sem 3</th>
                <th className="text-center px-1 py-1">Sem 4</th>
                <th className="text-center px-1 py-1">Sem 5</th>
                <th className="text-center px-2 py-1">Total</th>
                <th className="px-2 py-1 w-32">Carga</th>
              </tr>
            </thead>
            <tbody>
              {carga.map(c => (
                <tr key={c.supervisor_employee_id} className="border-t border-white/5">
                  <td className="px-2 py-1 text-white whitespace-nowrap">{c.supervisor_nombre}</td>
                  <td className="text-center px-1 py-1 text-white/70">{c.sem_1 || "—"}</td>
                  <td className="text-center px-1 py-1 text-white/70">{c.sem_2 || "—"}</td>
                  <td className="text-center px-1 py-1 text-white/70">{c.sem_3 || "—"}</td>
                  <td className="text-center px-1 py-1 text-white/70">{c.sem_4 || "—"}</td>
                  <td className="text-center px-1 py-1 text-white/70">{c.sem_5 || "—"}</td>
                  <td className="text-center px-2 py-1 text-white font-bold">{c.total}</td>
                  <td className="px-2 py-1">
                    <div className="h-2 bg-white/5 rounded overflow-hidden">
                      <div
                        className={`h-full ${c.total > maxTotal * 0.66 ? "bg-rose-400" : c.total > maxTotal * 0.33 ? "bg-amber-400" : "bg-emerald-400"}`}
                        style={{ width: `${(c.total / maxTotal) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
