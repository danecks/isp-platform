import { useEffect, useMemo, useState } from "react";
import { Trash2, Pencil, Grid3x3 } from "lucide-react";
import { api } from "./api";

interface SedeRow {
  id: number; nombre: string; client_id: number; cliente_nombre: string;
  puestos_activos: number;
}
interface SupervisorRow { id: number; nombre_completo: string }
interface PlanRow {
  id: number; sede_id: number; semana_mes: number;
  supervisor_employee_id: number; supervisor_nombre: string;
  notas: string | null;
}

interface Props {
  refreshKey: number;
  onChanged: () => void;
  // Permite que el padre dispare el modal con sede/semana pre-seleccionada.
  asignacionInicial: { sedeId: number; sedeNombre: string; semana?: number } | null;
  onAsignacionConsumida: () => void;
}

const SEMANAS = [1, 2, 3, 4, 5];

export function PlanMensualMatriz({ refreshKey, onChanged, asignacionInicial, onAsignacionConsumida }: Props) {
  const [sedes, setSedes] = useState<SedeRow[]>([]);
  const [supervisores, setSupervisores] = useState<SupervisorRow[]>([]);
  const [plan, setPlan] = useState<PlanRow[]>([]);
  const [filtroCliente, setFiltroCliente] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ sedeId: number; sedeNombre: string; semana: number } | null>(null);

  async function cargarTodo() {
    try {
      setLoading(true); setError(null);
      const [cat, p] = await Promise.all([
        api<{ sedes: SedeRow[]; supervisores: SupervisorRow[] }>("/supervision-plan-mensual/catalogos"),
        api<{ plan: PlanRow[] }>("/supervision-plan-mensual"),
      ]);
      setSedes(cat.sedes);
      setSupervisores(cat.supervisores);
      setPlan(p.plan);
    } catch (e: any) {
      setError(e.message || "Error al cargar");
    } finally { setLoading(false); }
  }
  useEffect(() => { cargarTodo(); }, [refreshKey]);

  // Si el padre pidió abrir el modal para una sede concreta, lo abrimos cuando ya tengamos data.
  useEffect(() => {
    if (asignacionInicial && sedes.length > 0) {
      setModal({
        sedeId: asignacionInicial.sedeId,
        sedeNombre: asignacionInicial.sedeNombre,
        semana: asignacionInicial.semana ?? 1,
      });
      onAsignacionConsumida();
    }
  }, [asignacionInicial, sedes.length, onAsignacionConsumida]);

  const planPorSedeYSemana = useMemo(() => {
    const m = new Map<string, PlanRow>();
    for (const p of plan) m.set(`${p.sede_id}|${p.semana_mes}`, p);
    return m;
  }, [plan]);

  const sedesFiltradas = useMemo(
    () => filtroCliente
      ? sedes.filter(s => s.cliente_nombre.toLowerCase().includes(filtroCliente.toLowerCase())
                       || s.nombre.toLowerCase().includes(filtroCliente.toLowerCase()))
      : sedes,
    [sedes, filtroCliente]
  );

  async function quitar(planId: number) {
    if (!confirm("¿Quitar esta asignación del plan?")) return;
    try {
      await api(`/supervision-plan-mensual/${planId}`, { method: "DELETE" });
      await cargarTodo();
      onChanged();
    } catch (e: any) {
      alert(e.message || "Error al quitar");
    }
  }

  return (
    <div className="bg-[#0b1424] border border-white/10 rounded-lg p-3 space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <h3 className="text-xs font-bold text-white inline-flex items-center gap-1.5">
          <Grid3x3 className="w-3.5 h-3.5 text-primary" /> Plan mensual por sede × semana
        </h3>
        <div className="ml-auto">
          <input value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}
            placeholder="Filtrar cliente o sede…"
            className="bg-[#060e1c] border border-white/10 rounded px-2 py-1 text-xs text-white" />
        </div>
      </div>

      {error && <div className="text-rose-300 text-xs p-2 border border-rose-500/30 rounded bg-rose-500/10">{error}</div>}
      {loading && <div className="text-white/40 text-xs p-2">Cargando…</div>}

      {!loading && (
        <div className="overflow-x-auto border border-white/10 rounded">
          <table className="w-full text-xs">
            <thead className="bg-white/5 text-white/50 text-[10px] uppercase">
              <tr>
                <th className="text-left px-2 py-1.5 sticky left-0 bg-white/5">Cliente · Sede</th>
                {SEMANAS.map(s => (
                  <th key={s} className="text-center px-2 py-1.5 min-w-[140px]">Semana {s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sedesFiltradas.length === 0 && (
                <tr><td colSpan={6} className="text-center text-white/40 py-4">Sin sedes activas.</td></tr>
              )}
              {sedesFiltradas.map(s => (
                <tr key={s.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-2 py-1.5 sticky left-0 bg-[#0b1424]">
                    <div className="text-white">{s.nombre}</div>
                    <div className="text-[10px] text-white/40">{s.cliente_nombre} · {s.puestos_activos} puestos</div>
                  </td>
                  {SEMANAS.map(sem => {
                    const p = planPorSedeYSemana.get(`${s.id}|${sem}`);
                    return (
                      <td key={sem} className="px-2 py-1.5 text-center align-top">
                        {p ? (
                          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-1 inline-flex items-center gap-1">
                            <span className="text-[11px] text-emerald-200">{p.supervisor_nombre}</span>
                            <button title="Cambiar" aria-label="Cambiar"
                              onClick={() => setModal({ sedeId: s.id, sedeNombre: s.nombre, semana: sem })}
                              className="text-emerald-300/70 hover:text-emerald-200">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button title="Quitar" aria-label="Quitar"
                              onClick={() => quitar(p.id)}
                              className="text-rose-300/70 hover:text-rose-200">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setModal({ sedeId: s.id, sedeNombre: s.nombre, semana: sem })}
                            className="text-[10px] text-white/30 hover:text-primary border border-dashed border-white/10 hover:border-primary/40 rounded px-2 py-1">
                            + asignar
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ModalAsignar
          sedeId={modal.sedeId}
          sedeNombre={modal.sedeNombre}
          semana={modal.semana}
          supervisores={supervisores}
          actual={planPorSedeYSemana.get(`${modal.sedeId}|${modal.semana}`) ?? null}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await cargarTodo();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function ModalAsignar({ sedeId, sedeNombre, semana, supervisores, actual, onClose, onSaved }: {
  sedeId: number; sedeNombre: string; semana: number;
  supervisores: SupervisorRow[];
  actual: PlanRow | null;
  onClose: () => void; onSaved: () => void;
}) {
  const [supId, setSupId] = useState<string>(actual ? String(actual.supervisor_employee_id) : "");
  const [semanaSel, setSemanaSel] = useState<number>(semana);
  const [notas, setNotas] = useState(actual?.notas ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function guardar() {
    if (!supId) { setErr("Seleccione un supervisor"); return; }
    setSaving(true); setErr(null);
    try {
      await api("/supervision-plan-mensual", {
        method: "POST",
        body: JSON.stringify({
          sede_id: sedeId,
          semana_mes: semanaSel,
          supervisor_employee_id: Number(supId),
          notas: notas.trim() || null,
        }),
      });
      onSaved();
    } catch (e: any) {
      setErr(e.message || "Error al guardar");
    } finally { setSaving(false); }
  }

  return (
    <div role="dialog" aria-modal="true"
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0b1424] border border-white/10 rounded-lg w-full max-w-md p-4">
        <h3 className="text-sm font-bold text-white mb-2">Asignar supervisión</h3>
        <p className="text-[11px] text-white/60 mb-3">{sedeNombre}</p>

        <div className="space-y-2">
          <div>
            <label className="block text-[10px] text-white/50 mb-1">Semana del mes</label>
            <select value={semanaSel} onChange={e => setSemanaSel(Number(e.target.value))}
              className="w-full bg-[#060e1c] border border-white/10 rounded px-2 py-1 text-xs text-white">
              {SEMANAS.map(s => <option key={s} value={s}>Semana {s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-white/50 mb-1">Supervisor *</label>
            <select value={supId} onChange={e => setSupId(e.target.value)}
              className="w-full bg-[#060e1c] border border-white/10 rounded px-2 py-1 text-xs text-white">
              <option value="">— seleccionar —</option>
              {supervisores.map(s => <option key={s.id} value={s.id}>{s.nombre_completo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-white/50 mb-1">Notas (opcional)</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              className="w-full bg-[#060e1c] border border-white/10 rounded px-2 py-1 text-xs text-white resize-none" />
          </div>
          {err && <div className="text-rose-300 text-xs">{err}</div>}
        </div>

        <div className="flex justify-end gap-2 pt-3 mt-3 border-t border-white/5">
          <button onClick={onClose} disabled={saving}
            className="px-3 py-1.5 text-xs text-white/70 hover:text-white">Cancelar</button>
          <button onClick={guardar} disabled={saving}
            className="px-3 py-1.5 bg-primary text-black text-xs font-bold rounded disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
