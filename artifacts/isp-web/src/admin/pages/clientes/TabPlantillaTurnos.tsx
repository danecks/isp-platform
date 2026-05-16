import { useState, useEffect } from "react";
import { Loader2, Plus, Shield, Trash2, Zap } from "lucide-react";
import { API, h, Puesto, PuestoSlot, DIAS_CICLO } from "./_shared";
import { ModalCrearSlot } from "./ModalCrearSlot";

export function TabPlantillaTurnos({ clienteId, puestos }: { clienteId: number; puestos: Puesto[] }) {
  const [slots, setSlots] = useState<PuestoSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [defaultPuestoId, setDefaultPuestoId] = useState<number | undefined>();
  const [savingSlotId, setSavingSlotId] = useState<number | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const r = await fetch(`${API}/clientes/${clienteId}/slots`, { headers: h() });
      if (r.ok) { const d = await r.json(); setSlots(d.slots || []); }
    } catch {}
    if (!silent) setLoading(false);
  }

  useEffect(() => { load(); }, [clienteId]);

  async function toggleDia(slot: PuestoSlot, dia: number) {
    const medios = slot.dias_medio_turno || [];
    const trabaja = slot.dias_trabajo.includes(dia);
    const esMedio = medios.includes(dia);

    let newDias = [...slot.dias_trabajo];
    let newMedios = [...medios];

    if (!trabaja) {
      newDias = [...newDias, dia].sort((a, b) => a - b);
      newMedios = newMedios.filter(d => d !== dia);
    } else if (trabaja && !esMedio) {
      newMedios = [...newMedios, dia].sort((a, b) => a - b);
    } else {
      newDias = newDias.filter(d => d !== dia);
      newMedios = newMedios.filter(d => d !== dia);
    }

    setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, dias_trabajo: newDias, dias_medio_turno: newMedios } : s));
    setSavingSlotId(slot.id);
    try {
      await fetch(`${API}/slots/${slot.id}`, {
        method: "PUT", headers: h(),
        body: JSON.stringify({ dias_trabajo: newDias, dias_medio_turno: newMedios }),
      });
    } catch {}
    setSavingSlotId(null);
  }

  async function deleteSlot(id: number) {
    if (!confirm("¿Eliminar este slot de turno?")) return;
    await fetch(`${API}/slots/${id}`, { method: "DELETE", headers: h() });
    load();
  }

  function openModalForPuesto(pid: number) {
    setDefaultPuestoId(pid);
    setShowModal(true);
  }

  // Agrupar slots por puesto; incluir puestos sin slots
  const grouped = new Map<number, { nombre: string; sedeNombre: string | null; slots: PuestoSlot[] }>();
  for (const p of puestos) {
    grouped.set(p.id, { nombre: p.nombre, sedeNombre: p.sede_nombre, slots: [] });
  }
  for (const s of slots) {
    if (!grouped.has(s.puesto_id)) {
      grouped.set(s.puesto_id, { nombre: s.puesto_nombre, sedeNombre: s.sede_nombre, slots: [] });
    }
    grouped.get(s.puesto_id)!.slots.push(s);
  }
  const puestosOrdenados = Array.from(grouped.entries()).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre));

  const slotsConAgente = slots.filter(s => s.empleado_id).length;

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs text-white/30">Cuadrícula de ciclo 14 días: ✓ = turno completo, ½ = medio turno, vacío = descansa. Clic para rotar.</p>
          <p className="text-[10px] text-white/20 mt-0.5">
            {slots.length} slots · {slotsConAgente} con agente · {slots.length - slotsConAgente} sin asignar
          </p>
        </div>
        <button
          onClick={() => { setDefaultPuestoId(puestos[0]?.id); setShowModal(true); }}
          className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary transition-colors"
        >
          <Plus className="w-3 h-3" /> Nuevo slot
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 text-white/20 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {puestosOrdenados.map(([pId, grupo]) => (
            <div key={pId} className="bg-[#070f1c] border border-white/8 rounded-xl overflow-hidden">
              {/* Cabecera del puesto */}
              <div className="px-4 py-2.5 bg-white/3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-primary/50" />
                  <p className="text-xs font-semibold text-white">{grupo.nombre}</p>
                  {grupo.sedeNombre && (
                    <span className="text-[9px] text-white/30 bg-white/4 px-1.5 py-0.5 rounded-full">{grupo.sedeNombre}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] text-white/25">{grupo.slots.length} slot{grupo.slots.length !== 1 ? "s" : ""}</span>
                  <button
                    onClick={() => openModalForPuesto(pId)}
                    className="text-[9px] text-primary/60 hover:text-primary transition-colors flex items-center gap-0.5"
                  >
                    <Plus className="w-2.5 h-2.5" /> slot
                  </button>
                </div>
              </div>

              {grupo.slots.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-white/25 italic">Sin slots definidos</p>
                  <button
                    onClick={() => openModalForPuesto(pId)}
                    className="mt-1.5 text-[10px] text-primary hover:text-primary/80 underline"
                  >
                    Agregar primer slot
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[900px]">
                    <thead>
                      {/* Fila 1 — agrupadores de semana */}
                      <tr className="border-b border-white/3">
                        <th colSpan={2} className="w-36" />
                        <th colSpan={7} className="py-1 text-[9px] text-white/30 font-semibold text-center border-l border-white/5">
                          — Semana 1 —
                        </th>
                        <th colSpan={7} className="py-1 text-[9px] text-white/30 font-semibold text-center border-l border-white/5">
                          — Semana 2 —
                        </th>
                        <th colSpan={2} className="w-44" />
                      </tr>
                      {/* Fila 2 — columnas individuales */}
                      <tr className="border-b border-white/5">
                        <th className="text-left px-4 py-2 text-[9px] text-white/25 font-semibold uppercase tracking-wide w-14">Slot</th>
                        <th className="text-left px-2 py-2 text-[9px] text-white/25 font-semibold uppercase tracking-wide w-20">Turno</th>
                        {DIAS_CICLO.map(({ n, label }) => (
                          <th key={n} className={`py-2 text-[9px] text-white/25 font-semibold w-8 text-center ${n === 8 ? "border-l border-white/5" : ""}`}>
                            {label}
                          </th>
                        ))}
                        <th className="text-left px-3 py-2 text-[9px] text-white/25 font-semibold uppercase tracking-wide">Agente</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/4">
                      {grupo.slots.map(slot => {
                        const saving = savingSlotId === slot.id;
                        return (
                          <tr key={slot.id} className="hover:bg-white/1.5 transition-colors">
                            {/* # slot */}
                            <td className="px-4 py-2.5 text-white/35 text-[10px] font-mono">
                              #{slot.slot_numero}
                            </td>

                            {/* Tipo turno + hora */}
                            <td className="px-2 py-2.5">
                              <div className="flex flex-col gap-0.5">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full w-fit ${slot.horas_turno === 24 ? "text-blue-300 bg-blue-500/10 border border-blue-500/20" : "text-purple-300 bg-purple-500/10 border border-purple-500/20"}`}>
                                  {slot.horas_turno}h
                                </span>
                                <span className="text-[9px] text-white/25">{slot.hora_entrada}</span>
                                {slot.fecha_inicio_ciclo && (
                                  <span className="text-[8px] text-white/15 leading-tight">D1={slot.fecha_inicio_ciclo}</span>
                                )}
                              </div>
                            </td>

                            {/* 14 días — toggle interactivo (D → T → T/2 → D) */}
                            {DIAS_CICLO.map(({ n, label }) => {
                              const trabaja = slot.dias_trabajo.includes(n);
                              const esMedio = (slot.dias_medio_turno || []).includes(n);
                              const estado = !trabaja ? "D" : esMedio ? "T/2" : "T";
                              return (
                                <td key={n} className={`py-2.5 text-center ${n === 8 ? "border-l border-white/5" : ""}`}>
                                  <button
                                    title={`${label}: ${estado === "T" ? "turno completo" : estado === "T/2" ? "medio turno (12h)" : "descansa"}`}
                                    disabled={saving}
                                    onClick={() => toggleDia(slot, n)}
                                    className={`w-6 h-6 rounded flex items-center justify-center mx-auto text-[10px] font-bold border transition-all ${
                                      estado === "T"
                                        ? "bg-primary/20 border-primary/50 text-primary hover:bg-primary/10"
                                        : estado === "T/2"
                                        ? "bg-amber-500/20 border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                                        : "bg-white/3 border-white/8 text-white/10 hover:border-white/20 hover:text-white/25"
                                    } ${saving ? "opacity-40 cursor-wait" : "cursor-pointer"}`}
                                  >
                                    {estado === "T" ? "✓" : estado === "T/2" ? "½" : ""}
                                  </button>
                                </td>
                              );
                            })}

                            {/* Agente */}
                            <td className="px-3 py-2.5 min-w-[140px]">
                              {slot.empleado_nombre ? (
                                <div>
                                  <p className="text-[11px] text-white/70 font-medium leading-tight truncate max-w-[150px]">{slot.empleado_nombre}</p>
                                  <span className={`text-[9px] ${slot.empleado_estado === "activo" ? "text-green-400" : "text-white/30"}`}>
                                    {slot.empleado_estado}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-white/20 italic">Sin asignar</span>
                              )}
                            </td>

                            {/* Eliminar */}
                            <td className="pr-3">
                              <button onClick={() => deleteSlot(slot.id)} className="p-1 text-red-400/20 hover:text-red-400 transition-colors" title="Eliminar slot">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Leyenda */}
      <div className="bg-blue-950/20 border border-blue-500/15 rounded-xl px-4 py-3 flex items-start gap-2.5">
        <Zap className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-[10px] text-blue-300/70 leading-relaxed">
          <p><strong>Ciclo de 14 días</strong>: cada slot tiene una fecha de inicio que ancla el Día 1 del ciclo. El patrón se repite cada 14 días automáticamente.</p>
          <p><strong>✓ Trabaja</strong> ese día → agente en servicio activo. <strong>Vacío = Descansa</strong> → disponible para cobertura de horas extra.</p>
          <p className="mt-1 text-blue-300/40">Los cambios en los días se guardan automáticamente al hacer clic. La columna "D1=fecha" muestra cuándo empieza el ciclo.</p>
        </div>
      </div>

      {showModal && (
        <ModalCrearSlot
          puestos={puestos}
          defaultPuestoId={defaultPuestoId}
          onClose={() => { setShowModal(false); setDefaultPuestoId(undefined); }}
          onSaved={() => { setShowModal(false); setDefaultPuestoId(undefined); load(true); }}
        />
      )}
    </div>
  );
}
