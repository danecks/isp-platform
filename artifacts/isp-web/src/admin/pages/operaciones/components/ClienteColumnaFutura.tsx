import { useState, useEffect, useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { Puesto, ClienteBoard, PlanFuturo, PoolFuturoData } from "../types";
import { TarjetaPuestoFuturo } from "../components/TarjetaPuestoFuturo";

export function ClienteColumnaFutura({
  cliente,
  planPorPuesto,
  onAbrirPlan,
  poolFuturo,
  colGlobal,
}: {
  cliente: ClienteBoard;
  fecha?: string;
  planPorPuesto: Record<number, PlanFuturo>;
  onAbrirPlan: (puesto: Puesto) => void;
  poolFuturo?: PoolFuturoData | null;
  colGlobal?: { v: number; val: boolean };
}) {
  const total     = cliente.puestos.length;
  const conPlan   = cliente.puestos.filter((p) => planPorPuesto[p.id]).length;
  const conRelevo = cliente.puestos.filter((p) => planPorPuesto[p.id]?.relevo_id).length;
  const sinCambios = total - conPlan;

  // Collapse — misma lógica que ClienteColumna pero con prefijo _fut_
  const ssKey = `piz_col_cli_fut_${cliente.clienteId ?? cliente.clienteNombre}`;
  const [colapsado, setColapsado] = useState(() => {
    try { return sessionStorage.getItem(ssKey) === "1"; } catch { return false; }
  });
  useEffect(() => {
    if (colGlobal && colGlobal.v > 0) {
      setColapsado(colGlobal.val);
      try { sessionStorage.setItem(ssKey, colGlobal.val ? "1" : "0"); } catch {}
    }
  }, [colGlobal?.v]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleCol = () => setColapsado(prev => {
    const next = !prev;
    try { sessionStorage.setItem(ssKey, next ? "1" : "0"); } catch {}
    return next;
  });

  // Lookup: empleado_id → estado en pool-futuro
  const estadoPorEmpleado = useMemo<Map<number, "trabajando" | "descansando" | "ausenteProgramado">>(() => {
    const m = new Map<number, "trabajando" | "descansando" | "ausenteProgramado">();
    if (!poolFuturo) return m;
    for (const a of poolFuturo.trabajando)        m.set(a.id, "trabajando");
    for (const a of poolFuturo.descansando)       m.set(a.id, "descansando");
    for (const a of poolFuturo.ausenteProgramado) m.set(a.id, "ausenteProgramado");
    return m;
  }, [poolFuturo]);

  const colorBarra = conRelevo === total ? "bg-indigo-500" : conPlan > 0 ? "bg-amber-500/60" : "bg-white/10";

  // ── Estado colapsado: tira vertical igual que ClienteColumna ────────────────
  if (colapsado) {
    return (
      <div
        className="flex-shrink-0 w-10 bg-[#060f1a] border border-indigo-500/15 rounded-2xl overflow-hidden flex flex-col max-h-full transition-all duration-200 cursor-pointer group"
        onClick={toggleCol}
        title={`${cliente.clienteNombre} — ${conRelevo}/${total} con relevo · clic para expandir`}
      >
        {conPlan > 0 && (
          <div className="w-full h-1 bg-indigo-500/60 shrink-0" />
        )}
        <div className="flex-1 flex items-center justify-center py-3 min-h-0 overflow-hidden">
          <span
            className="text-[10px] font-bold text-white/40 group-hover:text-white/70 transition-colors leading-none"
            style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)" }}
          >
            {cliente.clienteNombre.length > 20 ? cliente.clienteNombre.slice(0, 18) + "…" : cliente.clienteNombre}
          </span>
        </div>
        <div className="shrink-0 flex flex-col items-center gap-0.5 py-2 border-t border-white/6">
          <span className="text-[9px] font-bold text-indigo-400">{conRelevo}</span>
          <div className="w-px h-2 bg-white/10" />
          <span className="text-[9px] text-white/20">{total}</span>
        </div>
      </div>
    );
  }

  // ── Estado expandido ─────────────────────────────────────────────────────────
  return (
    <div className="flex-shrink-0 w-64 bg-[#060f1a] border border-indigo-500/12 rounded-2xl overflow-hidden flex flex-col max-h-full transition-all duration-200">
      {/* Header */}
      <div className="px-3 py-3 border-b border-white/8">
        <div className="flex items-start justify-between gap-2 mb-2">
          <button
            onClick={toggleCol}
            className="min-w-0 text-left flex-1 group/col"
            title="Colapsar columna"
          >
            <h3 className="text-xs font-bold text-white truncate group-hover/col:text-white/70 transition-colors">
              {cliente.clienteNombre}
            </h3>
            <p className="text-[10px] text-indigo-300/50 mt-0.5">
              {conPlan > 0
                ? `${conRelevo}/${total} con relevo · ${sinCambios} sin cambios`
                : `${total} puestos — sin cambios planificados`}
            </p>
          </button>
          <button
            onClick={toggleCol}
            className="text-white/15 hover:text-indigo-300/50 transition-colors mt-0.5 shrink-0"
            title="Colapsar columna"
          >
            <ChevronRight className="w-3 h-3 rotate-90" />
          </button>
        </div>
        <div className="h-1 bg-white/8 rounded-full overflow-hidden">
          <div
            className={`h-full ${colorBarra} rounded-full transition-all`}
            style={{ width: `${total > 0 ? Math.round((conRelevo / total) * 100) : 0}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {cliente.puestos.map((p) => {
          const estadoTitular = p.titular_employee_id
            ? (estadoPorEmpleado.get(p.titular_employee_id) ?? null)
            : null;
          return (
            <TarjetaPuestoFuturo
              key={p.id}
              puesto={p}
              plan={planPorPuesto[p.id] ?? null}
              estadoTitular={estadoTitular === "ausenteProgramado" ? null : estadoTitular}
              onClick={() => onAbrirPlan(p)}
            />
          );
        })}
        {cliente.puestos.length === 0 && (
          <div className="text-center py-4">
            <p className="text-[11px] text-white/20">Sin puestos</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tarjeta de Puesto (droppable) ────────────────────────────────────────────

