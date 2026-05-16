import { useEffect, useState } from "react";
import { UserCheck } from "lucide-react";
import { API, getSession, Puesto, PuestoSlot, SEMANA1, SEMANA2 } from "./_shared";

// Fuente de verdad: puesto_slots (nuevo sistema multi-titular).
// Fallback al campo legacy titular_employee_id solo si no hay slots con empleado.
export function TabTitulares({ puestos, clienteId }: { puestos: Puesto[]; clienteId: number }) {
  const [slots, setSlots] = useState<PuestoSlot[]>([]);

  useEffect(() => {
    fetch(`${API}/clientes/${clienteId}/slots`, { headers: { "x-isp-session": getSession() } })
      .then(r => r.ok ? r.json() : { slots: [] })
      .then(d => setSlots(d.slots || []))
      .catch(() => {});
  }, [clienteId]);

  const slotsPorPuesto = (puestoId: number) => slots.filter(s => s.puesto_id === puestoId);

  // Incluir puestos con slots activos con empleado, o con titular_employee_id legacy
  const puestosConAsignacion = puestos.filter(p => {
    const slotsConEmp = slotsPorPuesto(p.id).filter(s => s.empleado_id);
    return slotsConEmp.length > 0 || p.titular_employee_id;
  });

  if (puestosConAsignacion.length === 0) {
    return (
      <div className="p-5 text-center py-12">
        <UserCheck className="w-7 h-7 text-white/10 mx-auto mb-3" />
        <p className="text-white/30 text-sm">Sin colaboradores titulares asignados</p>
        <p className="text-white/15 text-xs mt-1">Asigna titulares desde el pizarrón operativo.</p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-3">
      {puestosConAsignacion.map(p => {
        const pSlots = slotsPorPuesto(p.id);
        const slotsConEmp = pSlots.filter(s => s.empleado_id);
        const usarSlots = slotsConEmp.length > 0;
        // El legacy muestra al anterior titular si ya no coincide con ningún slot
        const legacyOrfano = p.titular_employee_id && usarSlots &&
          !slotsConEmp.some(s => s.empleado_id === p.titular_employee_id);

        return (
          <div key={p.id} className="bg-[#070f1c] border border-white/8 rounded-xl p-4">
            {/* Cabecera: titulares reales (slots) o legacy */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex-1 min-w-0">
                {usarSlots ? (
                  <div className="space-y-1.5">
                    {slotsConEmp.map(slot => (
                      <div key={slot.id} className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded font-mono shrink-0">T{slot.slot_numero}</span>
                        <span className="text-sm font-semibold text-white">{slot.empleado_nombre}</span>
                        {slot.empleado_estado && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${slot.empleado_estado === "activo" ? "text-green-400 bg-green-400/10" : "text-white/30 bg-white/5"}`}>
                            {slot.empleado_estado}
                          </span>
                        )}
                        {slot.empleado_telefono && (
                          <span className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full">{slot.empleado_telefono}</span>
                        )}
                      </div>
                    ))}
                    {legacyOrfano && (
                      <p className="text-[9px] text-amber-400/50 mt-0.5">
                        Campo anterior: {p.titular_nombre_completo || p.titular_nombre}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-white">{p.titular_nombre_completo || p.titular_nombre}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {p.titular_estado_laboral && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${p.titular_estado_laboral === "activo" ? "text-green-400 bg-green-400/10" : "text-white/30 bg-white/5"}`}>
                          {p.titular_estado_laboral}
                        </span>
                      )}
                      {p.titular_telefono && (
                        <span className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full">{p.titular_telefono}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-semibold text-white/70">{p.nombre}</p>
                {p.sede_nombre && <p className="text-[10px] text-white/30 mt-0.5">Sede: {p.sede_nombre}</p>}
                {p.tipo_turno_nombre && (
                  <p className="text-[9px] text-white/20 mt-0.5">Nómina: {p.tipo_turno_nombre}</p>
                )}
              </div>
            </div>

            {/* Plantilla de turnos del puesto */}
            <div className="border-t border-white/5 pt-3">
              <p className="text-[9px] text-white/25 uppercase tracking-widest mb-2">Plantilla de turnos del puesto</p>
              {pSlots.length === 0 ? (
                <p className="text-[11px] text-white/20 italic">Sin slots definidos — configura en la pestaña "Plantilla de Turnos"</p>
              ) : (
                <div className="space-y-2.5">
                  {pSlots.map(slot => (
                    <div key={slot.id} className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] text-white/30">#{slot.slot_numero}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${slot.horas_turno === 24 ? "bg-blue-500/15 text-blue-300 border border-blue-400/20" : "bg-purple-500/15 text-purple-300 border border-purple-400/20"}`}>
                          {slot.horas_turno}h
                        </span>
                        <span className="text-[10px] text-white/40">{slot.hora_entrada}</span>
                        {slot.fecha_inicio_ciclo && (
                          <span className="text-[9px] text-white/20">inicio: {slot.fecha_inicio_ciclo}</span>
                        )}
                        {slot.empleado_nombre && (
                          <span className="text-[9px] text-emerald-400/60 bg-emerald-400/8 px-2 py-0.5 rounded-full">{slot.empleado_nombre}</span>
                        )}
                      </div>
                      {/* Mini cuadrícula 14 días — 2 filas de 7 */}
                      <div className="space-y-0.5">
                        {[SEMANA1, SEMANA2].map((semana, si) => (
                          <div key={si} className="flex gap-0.5">
                            <span className="text-[8px] text-white/20 w-4 flex items-center">S{si + 1}</span>
                            {semana.map(({ n, label }) => {
                              const trabaja = slot.dias_trabajo.includes(n);
                              return (
                                <span
                                  key={n}
                                  title={trabaja ? `${label} trabaja` : `${label} descansa`}
                                  className={`w-5 h-5 flex items-center justify-center rounded text-[8px] font-bold ${trabaja ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/3 text-white/10 border border-white/6"}`}
                                >
                                  {trabaja ? label : "·"}
                                </span>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
