import { useEffect, useState } from "react";
import { AlertTriangle, Clock, CheckCircle2, CalendarDays } from "lucide-react";
import { api, hoyISO } from "./api";

interface SedeBase {
  sede_id: number;
  sede_nombre: string;
  cliente_id: number;
  cliente_nombre: string;
  puestos_activos: number;
}
interface SedePend extends SedeBase {
  semana_mes: number;
  supervisor_employee_id: number;
  supervisor_nombre: string;
  ultima_completada: string | null;
  total_completadas: number;
}
interface SedeOtras extends SedeBase {
  semanas_asignadas: number[];
  supervisores: Array<{ semana_mes: number; supervisor_nombre: string }>;
}

interface Cobertura {
  fecha_referencia: string;
  semana_mes: number;
  mes: number; anio: number;
  rango: { lunes: string; domingo: string };
  sin_plan: SedeBase[];
  pendientes: SedePend[];
  cumplidas: SedePend[];
  otras_semanas: SedeOtras[];
  totales: {
    sedes_activas: number; sin_plan: number;
    pendientes: number; cumplidas: number; otras_semanas: number;
  };
}

interface Props {
  refreshKey: number;
  onAsignar: (sedeId: number, sedeNombre: string, semanaSugerida?: number) => void;
}

const MES_NOMBRE = ["", "ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

export function PlanMensualCobertura({ refreshKey, onAsignar }: Props) {
  const [fecha, setFecha] = useState(hoyISO());
  const [cob, setCob] = useState<Cobertura | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    try {
      setLoading(true); setError(null);
      const r = await api<Cobertura>(`/supervision-plan-mensual/cobertura?fecha=${fecha}`);
      setCob(r);
    } catch (e: any) {
      setError(e.message || "Error al cargar cobertura");
    } finally { setLoading(false); }
  }
  useEffect(() => { cargar(); }, [fecha, refreshKey]);

  return (
    <div className="bg-[#0b1424] border border-white/10 rounded-lg p-3 space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <h3 className="text-xs font-bold text-white inline-flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5 text-primary" /> Cobertura de la semana
        </h3>
        <div className="ml-auto flex items-end gap-2">
          <div>
            <label className="block text-[10px] text-white/40 mb-1">Semana de</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="bg-[#060e1c] border border-white/10 rounded px-2 py-1 text-xs text-white" />
          </div>
        </div>
      </div>

      {error && <div className="text-rose-300 text-xs p-2 border border-rose-500/30 rounded bg-rose-500/10">{error}</div>}
      {loading && <div className="text-white/40 text-xs p-2">Cargando…</div>}

      {!loading && cob && (
        <>
          <div className="text-[11px] text-white/60">
            Semana <strong className="text-white">{cob.semana_mes}</strong> de {MES_NOMBRE[cob.mes]} {cob.anio} ·
            {" "}{cob.rango.lunes} → {cob.rango.domingo} ·
            {" "}{cob.totales.sedes_activas} sedes activas en total
          </div>

          <Bucket
            tone="rose"
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            title={`Sin programar nunca (${cob.totales.sin_plan})`}
            hint="Estas sedes no tienen ninguna semana asignada en el plan mensual. Decida en qué semana del mes deben supervisarse."
          >
            {cob.sin_plan.length === 0 ? (
              <Empty>Todas las sedes activas tienen al menos una semana asignada.</Empty>
            ) : (
              cob.sin_plan.map(s => (
                <FilaSede key={s.sede_id} cliente={s.cliente_nombre} sede={s.sede_nombre} puestos={s.puestos_activos}>
                  <button onClick={() => onAsignar(s.sede_id, s.sede_nombre, cob.semana_mes)}
                    className="px-2 py-1 text-[10px] bg-primary text-black font-bold rounded hover:bg-primary/90">
                    Asignar a plan
                  </button>
                </FilaSede>
              ))
            )}
          </Bucket>

          <Bucket
            tone="amber"
            icon={<Clock className="w-3.5 h-3.5" />}
            title={`Pendientes esta semana (${cob.totales.pendientes})`}
            hint="Sedes asignadas a esta semana del mes que aún no recibieron una visita completada."
          >
            {cob.pendientes.length === 0 ? (
              <Empty>Sin pendientes para esta semana.</Empty>
            ) : (
              cob.pendientes.map(s => (
                <FilaSede key={s.sede_id} cliente={s.cliente_nombre} sede={s.sede_nombre} puestos={s.puestos_activos}>
                  <span className="text-[10px] text-white/60">Asignado a <strong className="text-white/80">{s.supervisor_nombre}</strong></span>
                </FilaSede>
              ))
            )}
          </Bucket>

          <Bucket
            tone="emerald"
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            title={`Cumplidas (${cob.totales.cumplidas})`}
            hint="Sedes con al menos una visita completada esta semana."
          >
            {cob.cumplidas.length === 0 ? (
              <Empty>Sin sedes cumplidas todavía esta semana.</Empty>
            ) : (
              cob.cumplidas.map(s => (
                <FilaSede key={s.sede_id} cliente={s.cliente_nombre} sede={s.sede_nombre} puestos={s.puestos_activos}>
                  <span className="text-[10px] text-emerald-300/80">
                    {s.total_completadas} visita{s.total_completadas === 1 ? "" : "s"} · {s.supervisor_nombre}
                  </span>
                </FilaSede>
              ))
            )}
          </Bucket>

          {cob.otras_semanas.length > 0 && (
            <details className="bg-white/5 border border-white/10 rounded p-2">
              <summary className="text-[11px] text-white/60 cursor-pointer">
                Asignadas a otras semanas del mes ({cob.otras_semanas.length})
              </summary>
              <div className="mt-2 space-y-1">
                {cob.otras_semanas.map(s => (
                  <div key={s.sede_id} className="flex items-center justify-between text-[11px] py-1 border-t border-white/5">
                    <span className="text-white/80">{s.cliente_nombre} · {s.sede_nombre}</span>
                    <span className="text-white/40">Sem {s.semanas_asignadas.join(", ")}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function Bucket({ tone, icon, title, hint, children }: {
  tone: "rose" | "amber" | "emerald";
  icon: React.ReactNode; title: string; hint: string;
  children: React.ReactNode;
}) {
  const ring = tone === "rose" ? "border-rose-500/30 bg-rose-500/5"
    : tone === "amber" ? "border-amber-500/30 bg-amber-500/5"
    : "border-emerald-500/30 bg-emerald-500/5";
  const text = tone === "rose" ? "text-rose-300"
    : tone === "amber" ? "text-amber-300"
    : "text-emerald-300";
  return (
    <div className={`border rounded-lg p-2 ${ring}`}>
      <div className={`text-xs font-bold inline-flex items-center gap-1.5 ${text}`}>{icon} {title}</div>
      <p className="text-[10px] text-white/40 mt-0.5 mb-2">{hint}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function FilaSede({ cliente, sede, puestos, children }: {
  cliente: string; sede: string; puestos: number; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between bg-[#060e1c] border border-white/10 rounded px-2 py-1.5">
      <div className="min-w-0">
        <div className="text-xs text-white truncate">{cliente} · {sede}</div>
        <div className="text-[10px] text-white/40">{puestos} puesto{puestos === 1 ? "" : "s"} activo{puestos === 1 ? "" : "s"}</div>
      </div>
      <div className="ml-2 shrink-0">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] text-white/40 italic px-2 py-1">{children}</div>;
}
