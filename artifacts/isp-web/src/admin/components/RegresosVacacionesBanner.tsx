import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin } from "lucide-react";
import { getSessionToken } from "@/lib/httpClient";

interface PuestoRegreso {
  id: number;
  nombre: string;
  cliente_nombre: string | null;
}

interface Regreso {
  employee_id: number;
  nombre_completo: string;
  vac_inicio: string;
  vac_fin: string;
  dias_para_regreso: number;
  puestos: PuestoRegreso[];
}

interface RegresosResponse {
  fecha: string;
  dias: number;
  regresos: Regreso[];
}

const API_BASE = "/api";
const getSession = () => getSessionToken();

export function useProximosRegresos(fecha?: string, dias = 5) {
  return useQuery<RegresosResponse>({
    queryKey: ["proximos-regresos-vacaciones", fecha, dias],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fecha) params.set("fecha", fecha);
      params.set("dias", String(dias));
      const r = await fetch(
        `${API_BASE}/operaciones/proximos-regresos-vacaciones?${params}`,
        { headers: { "x-isp-session": getSession() } },
      );
      if (!r.ok) throw new Error(`Error ${r.status} al consultar próximos regresos`);
      return r.json();
    },
    refetchInterval: 60_000,
  });
}

function badgeClassFor(dias: number): { wrap: string; num: string; label: string } {
  if (dias === 1) return { wrap: "bg-red-900/40 border-red-500/50",       num: "text-red-300",    label: "vuelve mañana" };
  if (dias === 2) return { wrap: "bg-orange-900/40 border-orange-500/50", num: "text-orange-300", label: "vuelve en 2 días" };
  if (dias <= 3)  return { wrap: "bg-amber-900/40 border-amber-500/50",   num: "text-amber-300",  label: `vuelve en ${dias} días` };
  return            { wrap: "bg-emerald-900/30 border-emerald-500/40",  num: "text-emerald-300",label: `vuelve en ${dias} días` };
}

interface Props {
  fecha?: string;
  dias?: number;
  /** Si el padre prefiere ocultar cuando no hay regresos */
  ocultarSiVacio?: boolean;
}

export default function RegresosVacacionesBanner({ fecha, dias = 5, ocultarSiVacio = true }: Props) {
  const { data } = useProximosRegresos(fecha, dias);
  const regresos = data?.regresos ?? [];

  if (ocultarSiVacio && regresos.length === 0) return null;

  return (
    <div className="shrink-0 rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-3">
      <div className="flex items-center gap-3 mb-3">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <Calendar className="w-4 h-4 text-emerald-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-emerald-200 leading-tight">
            {regresos.length === 1
              ? "1 colaborador regresa de vacaciones pronto"
              : `${regresos.length} colaboradores regresan de vacaciones pronto`}
          </p>
          <p className="text-xs text-emerald-400/70 mt-0.5">
            Cuenta regresiva (≤ {dias} días) — al regresar vuelven automáticamente a su puesto titular.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {regresos.map((r) => {
          const cls = badgeClassFor(r.dias_para_regreso);
          return (
            <div
              key={r.employee_id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${cls.wrap}`}
              title={`Vacaciones del ${r.vac_inicio} al ${r.vac_fin} — ${cls.label}`}
            >
              <span className={`text-base font-bold leading-none ${cls.num}`}>{r.dias_para_regreso}</span>
              <span className="text-[9px] uppercase tracking-wide text-white/50 leading-none">
                d{r.dias_para_regreso === 1 ? "ía" : "ías"}
              </span>
              <div className="border-l border-white/10 pl-2 ml-1">
                <p className="text-xs font-semibold text-white/90 leading-tight">{r.nombre_completo}</p>
                {r.puestos.length > 0 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="w-2.5 h-2.5 text-white/30" />
                    <p className="text-[10px] text-white/50 leading-tight truncate max-w-[260px]">
                      {r.puestos
                        .map((p) => `${p.cliente_nombre ?? "—"} · ${p.nombre}`)
                        .join(" / ")}
                    </p>
                  </div>
                )}
                {r.puestos.length === 0 && (
                  <p className="text-[10px] text-white/40 italic leading-tight">Sin puesto titular asignado</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
