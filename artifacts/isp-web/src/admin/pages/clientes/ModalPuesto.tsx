import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X, Loader2, AlertTriangle, Calendar, ChevronDown, ChevronRight, Trash2,
} from "lucide-react";
import { API, getSession, h, Sede, Puesto, PuestoSlot, SEMANA1, SEMANA2 } from "./_shared";

// ─── Sección inline: Titulares del puesto (slots) ─────────────────────────────
function PuestoSlotsInline({ puestoId }: { puestoId: number; puestoNombre: string }) {
  const [slots, setSlots] = useState<PuestoSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSlotId, setSavingSlotId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(true);

  async function loadSlots() {
    try {
      const r = await fetch(`${API}/puestos/${puestoId}/slots`, { headers: h() });
      if (r.ok) {
        const d = await r.json();
        setSlots(Array.isArray(d) ? d : (d.slots || []));
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => { loadSlots(); }, [puestoId]);

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

    if (newDias.length === 0) return;
    const prevDias = [...slot.dias_trabajo];
    const prevMedios = [...medios];
    setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, dias_trabajo: newDias, dias_medio_turno: newMedios } : s));
    setSavingSlotId(slot.id);
    try {
      const r = await fetch(`${API}/slots/${slot.id}`, {
        method: "PUT", headers: h(),
        body: JSON.stringify({ dias_trabajo: newDias, dias_medio_turno: newMedios }),
      });
      if (!r.ok) {
        setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, dias_trabajo: prevDias, dias_medio_turno: prevMedios } : s));
      }
    } catch {
      setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, dias_trabajo: prevDias, dias_medio_turno: prevMedios } : s));
    }
    setSavingSlotId(null);
  }

  async function deleteSlot(id: number) {
    if (!confirm("¿Eliminar este titular del puesto?")) return;
    await fetch(`${API}/slots/${id}`, { method: "DELETE", headers: h() });
    loadSlots();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-white/20" />
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="bg-primary/5 border border-primary/15 rounded-xl px-4 py-3 flex items-start gap-2">
        <Calendar className="w-3.5 h-3.5 text-primary/50 shrink-0 mt-0.5" />
        <p className="text-[11px] text-white/40 leading-relaxed">
          Sin titulares asignados — asigná titulares desde el <span className="text-primary/70 font-medium">Pizarrón Operativo</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Calendar className="w-3.5 h-3.5 text-primary/50" />
        <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold flex-1">
          Titulares del puesto ({slots.length})
        </p>
        {expanded ? <ChevronDown className="w-3 h-3 text-white/20" /> : <ChevronRight className="w-3 h-3 text-white/20" />}
      </button>

      {expanded && (
        <div className="space-y-2">
          {slots.map(slot => {
            const saving = savingSlotId === slot.id;
            return (
              <div key={slot.id} className="bg-[#060e1c] border border-white/8 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
                      T{slot.slot_numero}
                    </span>
                    {slot.empleado_nombre ? (
                      <span className="text-[11px] text-white/70 font-medium">{slot.empleado_nombre}</span>
                    ) : (
                      <span className="text-[10px] text-white/25 italic">Sin agente asignado</span>
                    )}
                    {slot.empleado_estado && (
                      <span className={`text-[9px] ${slot.empleado_estado === "activo" ? "text-green-400/60" : "text-white/20"}`}>
                        {slot.empleado_estado}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${slot.horas_turno === 24 ? "text-blue-300 bg-blue-500/10 border border-blue-500/20" : "text-purple-300 bg-purple-500/10 border border-purple-500/20"}`}>
                      {slot.horas_turno}h
                    </span>
                    <span className="text-[9px] text-white/25">{slot.hora_entrada}</span>
                    <button onClick={() => deleteSlot(slot.id)} className="text-white/15 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  {[{ label: "S1", dias: SEMANA1 }, { label: "S2", dias: SEMANA2 }].map(({ label: sl, dias }) => (
                    <div key={sl} className="flex items-center gap-0.5">
                      <span className="text-[8px] text-white/20 w-8 shrink-0">{sl}</span>
                      {dias.map(({ n, label }) => {
                        const trabaja = slot.dias_trabajo.includes(n);
                        const esMedio = (slot.dias_medio_turno || []).includes(n);
                        const estado = !trabaja ? "D" : esMedio ? "T/2" : "T";
                        return (
                          <button
                            key={n}
                            title={`${label}: ${estado === "T" ? "turno completo" : estado === "T/2" ? "medio turno (12h)" : "descansa"}`}
                            disabled={saving}
                            onClick={() => toggleDia(slot, n)}
                            className={`w-[34px] h-6 rounded text-[9px] font-semibold border transition-all ${
                              estado === "T"
                                ? "bg-primary/20 border-primary/40 text-primary"
                                : estado === "T/2"
                                ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                                : "bg-white/3 border-white/8 text-white/15 hover:border-white/20"
                            } ${saving ? "opacity-40 cursor-wait" : "cursor-pointer"}`}
                          >
                            {estado === "T" ? label : estado === "T/2" ? "½" : ""}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <p className="text-[9px] text-white/15">
                  {slot.dias_trabajo.length - (slot.dias_medio_turno || []).length} días completos · {(slot.dias_medio_turno || []).length} medios turnos · {14 - slot.dias_trabajo.length} descanso · {slot.horas_turno}h base
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Modal: Nuevo/Editar Puesto ───────────────────────────────────────────────
interface ZonaDisponible { id: number; nombre: string; }

export function ModalPuesto({
  clientId,
  sedes,
  puesto,
  onClose,
  onSaved,
}: {
  clientId: number;
  sedes: Sede[];
  puesto: Puesto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = puesto !== null;
  const [form, setForm] = useState({
    nombre: puesto?.nombre ?? "",
    hora_entrada: puesto?.hora_entrada ?? "",
    hora_salida: puesto?.hora_salida ?? "",
    descanso_inicio: puesto?.descanso_inicio ?? "",
    descanso_fin: puesto?.descanso_fin ?? "",
    tarifa_puesto: puesto?.tarifa_puesto ?? "",
    tipo_servicio: puesto?.tipo_servicio ?? "",
    sede_id: puesto?.sede_id ? String(puesto.sede_id) : "",
    zona_operativa_id: puesto?.zona_operativa_id ? String(puesto.zona_operativa_id) : "",
    notas: puesto?.notas ?? "",
    direccion: puesto?.direccion ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  // Zonas operativas disponibles
  const [zonas, setZonas] = useState<ZonaDisponible[]>([]);
  useEffect(() => {
    fetch(`${API}/operaciones/zonas/disponibles`, { headers: { "x-isp-session": getSession() } })
      .then((r) => r.json())
      .then((d) => setZonas(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Cargar datos frescos del servidor al abrir en modo edición
  useEffect(() => {
    if (!isEdit || !puesto?.id) return;
    setLoading(true);
    fetch(`${API}/puestos/${puesto.id}`, { headers: { "x-isp-session": getSession() } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setForm({
          nombre: d.nombre ?? "",
          hora_entrada: d.hora_entrada ?? "",
          hora_salida: d.hora_salida ?? "",
          descanso_inicio: d.descanso_inicio ?? "",
          descanso_fin: d.descanso_fin ?? "",
          tarifa_puesto: d.tarifa_puesto ?? "",
          tipo_servicio: d.tipo_servicio ?? "",
          sede_id: d.sede_id ? String(d.sede_id) : "",
          zona_operativa_id: d.zona_operativa_id ? String(d.zona_operativa_id) : "",
          notas: d.notas ?? "",
          direccion: d.direccion ?? "",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const up = (k: string, v: string | boolean | number) =>
    setForm((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!form.nombre.trim()) { setErr("El nombre del puesto es requerido"); return; }
    if (!isEdit && !form.zona_operativa_id) { setErr("Debes seleccionar una zona operativa"); return; }
    setSaving(true); setErr("");
    try {
      const body = {
        nombre: form.nombre,
        sede_id: form.sede_id ? Number(form.sede_id) : null,
        zona_operativa_id: form.zona_operativa_id ? Number(form.zona_operativa_id) : null,
        tarifa_puesto: form.tarifa_puesto ? Number(form.tarifa_puesto) : null,
        hora_entrada: form.hora_entrada || null,
        hora_salida: form.hora_salida || null,
        descanso_inicio: form.descanso_inicio || null,
        descanso_fin: form.descanso_fin || null,
        tipo_servicio: form.tipo_servicio || null,
        notas: form.notas || null,
        direccion: form.direccion || null,
      };
      const url = isEdit ? `${API}/puestos/${puesto!.id}` : `${API}/clientes/${clientId}/puestos`;
      const method = isEdit ? "PATCH" : "POST";
      const r = await fetch(url, { method, headers: h(), body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      onSaved();
    } catch {
      setErr("Error al guardar el puesto");
    }
    setSaving(false);
  }

  const fieldCls = "w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl my-4">
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            {isEdit ? "Editar puesto" : "Nuevo puesto"}
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-white/40" />}
          </h3>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Identificación */}
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Identificación</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] text-white/40 uppercase tracking-wide">Nombre del puesto *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => up("nombre", e.target.value)}
                  placeholder="Ej: Garita Principal, Recepción..."
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/40 uppercase tracking-wide">Tipo de servicio</label>
                <select
                  value={form.tipo_servicio}
                  onChange={(e) => up("tipo_servicio", e.target.value)}
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                >
                  <option value="">Seleccionar...</option>
                  <option value="puesto_fijo">Puesto fijo</option>
                  <option value="ronda_movil">Ronda móvil</option>
                  <option value="escolta">Escolta</option>
                  <option value="custodia_transporte">Custodia transporte</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/40 uppercase tracking-wide">Sede</label>
                <select
                  value={form.sede_id}
                  onChange={(e) => up("sede_id", e.target.value)}
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                >
                  <option value="">Sin sede asignada</option>
                  {sedes.filter(s => s.activo).map(s => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/40 uppercase tracking-wide">Zona operativa</label>
                <select
                  value={form.zona_operativa_id}
                  onChange={(e) => up("zona_operativa_id", e.target.value)}
                  className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                >
                  <option value="">Sin zona asignada</option>
                  {zonas.map(z => (
                    <option key={z.id} value={z.id}>{z.nombre}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {isEdit && puesto && (
            <PuestoSlotsInline puestoId={puesto.id} puestoNombre={puesto.nombre} />
          )}

          {/* Tarifa */}
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wide">Tarifa del puesto (Q)</label>
            <input value={form.tarifa_puesto} onChange={(e) => up("tarifa_puesto", e.target.value)} placeholder="0.00" className={fieldCls} />
          </div>

          {/* Dirección */}
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wide">Dirección del puesto</label>
            <input value={form.direccion} onChange={(e) => up("direccion", e.target.value)} placeholder="Ej. 5a Av. 10-25 Zona 1, Ciudad de Guatemala" className={fieldCls} />
          </div>

          {/* Notas */}
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wide">Notas internas</label>
            <textarea
              value={form.notas}
              onChange={(e) => up("notas", e.target.value)}
              rows={2}
              placeholder="Observaciones del puesto..."
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 resize-none"
            />
          </div>

          {err && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{err}</p>}
        </div>

        <div className="flex gap-2 p-5 border-t border-white/8">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-sm font-bold text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Crear puesto"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
