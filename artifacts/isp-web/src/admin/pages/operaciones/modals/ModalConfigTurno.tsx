import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, X, CheckCircle2, UserPlus, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE, getSession, lastMondayDate, semanasCiclo, horaDelDiaSlot } from "../utils";
import { Puesto, Agente, TurnoApiItem, SlotItem } from "../types";
import { EditorHoraEntrada } from "./EditorHoraEntrada";

export function ModalConfigTurno({
  puesto,
  onClose,
  onSaved,
}: {
  puesto: Puesto;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();

  // ── Ciclo de nómina ──────────────────────────────────────────────────────────
  const [turnoId, setTurnoId]         = useState<string>(String(puesto.tipo_turno_id ?? ""));
  // Ancla del ciclo: si ya tiene fecha asignada, re-anclar al lunes más cercano hacia atrás
  // para que D1=Lun, D2=Mar, ... D7=Dom queden alineados con el calendario.
  const [fechaInicio, setFechaInicio] = useState<string>(
    puesto.fecha_inicio_ciclo
      ? lastMondayDate(puesto.fecha_inicio_ciclo)
      : lastMondayDate()
  );
  const [guardando, setGuardando]     = useState(false);

  // ── Solicitud de cambio de turno ─────────────────────────────────────────────
  const [solicitudPendiente, setSolicitudPendiente] = useState<any | null>(null);
  const [procesandoSol, setProcesandoSol]           = useState(false);

  // ── Slots ────────────────────────────────────────────────────────────────────
  const [slots, setSlots]               = useState<SlotItem[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [savingSlotId, setSavingSlotId] = useState<number | null>(null);

  // ── Edición inline de agente en slot existente ────────────────────────────────
  const [editAgentSlotId, setEditAgentSlotId] = useState<number | null>(null);
  const [agentBusqueda, setAgentBusqueda]     = useState("");
  const [agentResultados, setAgentResultados] = useState<any[]>([]);

  // ── Nuevo titular (form inline) ───────────────────────────────────────────────
  const [showAddSlot, setShowAddSlot]     = useState(false);
  const [newHoraEntrada, setNewHoraEntrada] = useState("07:00");
  const [newLongitudCiclo, setNewLongitudCiclo] = useState<number>(14);
  // Hora de entrada por semana (rotación de horarios). null = todas iguales (legacy).
  const [newHorasPorSemana, setNewHorasPorSemana] = useState<string[] | null>(null);
  // TURNOS-05: excepciones puntuales por día. null/{} = sin excepciones. Excluyente con _por_semana.
  const [newHorasPorDia, setNewHorasPorDia] = useState<Record<string, string> | null>(null);
  const [newDiasTrabajo, setNewDiasTrabajo] = useState<number[]>([]);
  const [newFechaInicio, setNewFechaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [newBusqueda, setNewBusqueda]       = useState("");
  const [newEmpleadoId, setNewEmpleadoId]   = useState<number | null>(null);
  const [newEmpleadoNombre, setNewEmpleadoNombre] = useState("");
  const [newEmpleadoResultados, setNewEmpleadoResultados] = useState<any[]>([]);
  const [creatingSlot, setCreatingSlot]   = useState(false);

  const hd = () => ({ "Content-Type": "application/json", "x-isp-session": getSession() });

  // Catálogo de turnos
  const { data: turnos = [], isLoading: cargandoTurnos } = useQuery<TurnoApiItem[]>({
    queryKey: ["turnos-catalogo"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/turnos`, { headers: hd() });
      if (!r.ok) throw new Error("Error al cargar turnos");
      return r.json();
    },
    staleTime: 5 * 60_000,
  });

  const turnoSel  = turnos.find(t => String(t.id) === turnoId) ?? null;
  const maxSlots  = turnoSel?.num_titulares ?? 2;
  const horasTurnoDefault = turnoSel ? Math.round(turnoSel.horas_trabajo) : 24;

  // Hora de salida calculada
  function calcSalida(horaEntrada: string, horasTurno: number): string {
    const [hh, mm] = (horaEntrada || "00:00").split(":").map(Number);
    if (isNaN(hh) || isNaN(mm)) return "—";
    const totalMin = hh * 60 + mm + horasTurno * 60;
    const sh = Math.floor(totalMin / 60) % 24;
    const sm = totalMin % 60;
    const overflow = totalMin >= 24 * 60;
    return `${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}${overflow ? " +1d" : ""}`;
  }

  async function loadSlots(silent = false) {
    if (!silent) setLoadingSlots(true);
    try {
      const r = await fetch(`${API_BASE}/puestos/${puesto.id}/slots`, { headers: hd() });
      if (r.ok) { const d = await r.json(); setSlots(d.slots || []); }
    } catch {}
    if (!silent) setLoadingSlots(false);
  }

  async function loadSolicitud() {
    try {
      const r = await fetch(`${API_BASE}/puestos/${puesto.id}/solicitud-turno`, { headers: hd() });
      if (r.ok) { setSolicitudPendiente(await r.json()); }
    } catch {}
  }

  useEffect(() => { loadSlots(); loadSolicitud(); }, [puesto.id]);

  // Búsqueda de agentes para slot existente (inline)
  useEffect(() => {
    if (!editAgentSlotId || agentBusqueda.length < 2) { setAgentResultados([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API_BASE}/employees?q=${encodeURIComponent(agentBusqueda)}&limit=8`, { headers: hd() });
        const data = await r.json();
        setAgentResultados(Array.isArray(data) ? data : (data.employees || []));
      } catch { setAgentResultados([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [editAgentSlotId, agentBusqueda]);

  // Búsqueda de agentes para nuevo slot
  useEffect(() => {
    if (newBusqueda.length < 2) { setNewEmpleadoResultados([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API_BASE}/employees?q=${encodeURIComponent(newBusqueda)}&limit=8`, { headers: hd() });
        const data = await r.json();
        setNewEmpleadoResultados(Array.isArray(data) ? data : (data.employees || []));
      } catch { setNewEmpleadoResultados([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [newBusqueda]);

  // Guardar campo individual de slot existente
  async function updateSlotField(slotId: number, field: string, value: any) {
    setSavingSlotId(slotId);
    try {
      await fetch(`${API_BASE}/slots/${slotId}`, {
        method: "PUT", headers: hd(),
        body: JSON.stringify({ [field]: value }),
      });
    } catch {}
    setSavingSlotId(null);
  }

  // Asignar agente a slot existente
  async function assignAgent(slotId: number, empleadoId: number | null, nombre: string) {
    setSlots(prev => prev.map(s => s.id === slotId ? { ...s, empleado_id: empleadoId, empleado_nombre: nombre || null } : s));
    setEditAgentSlotId(null);
    setAgentBusqueda("");
    setAgentResultados([]);
    await updateSlotField(slotId, "empleado_id", empleadoId);
    onSaved();
  }

  async function toggleDia(slot: SlotItem, day: number) {
    const medios = slot.dias_medio_turno || [];
    const trabaja = slot.dias_trabajo.includes(day);
    const esMedio = medios.includes(day);

    let newDias = [...slot.dias_trabajo];
    let newMedios = [...medios];

    if (!trabaja) {
      newDias = [...newDias, day].sort((a, b) => a - b);
      newMedios = newMedios.filter(d => d !== day);
    } else if (trabaja && !esMedio) {
      newMedios = [...newMedios, day].sort((a, b) => a - b);
    } else {
      newDias = newDias.filter(d => d !== day);
      newMedios = newMedios.filter(d => d !== day);
    }

    setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, dias_trabajo: newDias, dias_medio_turno: newMedios } : s));
    setSavingSlotId(slot.id);
    try {
      await fetch(`${API_BASE}/slots/${slot.id}`, {
        method: "PUT", headers: hd(),
        body: JSON.stringify({ dias_trabajo: newDias, dias_medio_turno: newMedios }),
      });
    } catch {}
    setSavingSlotId(null);
  }

  async function deleteSlot(id: number) {
    if (!confirm("¿Eliminar este titular del puesto?")) return;
    await fetch(`${API_BASE}/slots/${id}`, { method: "DELETE", headers: hd() });
    loadSlots(true);
    onSaved();
  }

  async function createSlot() {
    if (newDiasTrabajo.length === 0) {
      toast({ title: "Marcá al menos un día de trabajo", variant: "destructive" });
      return;
    }
    // Validar dias dentro del rango del ciclo
    const diasFueraRango = newDiasTrabajo.some(d => d < 1 || d > newLongitudCiclo);
    if (diasFueraRango) {
      toast({ title: `Días fuera del rango 1..${newLongitudCiclo}`, variant: "destructive" });
      return;
    }
    setCreatingSlot(true);
    try {
      const body: any = {
        horas_turno: horasTurnoDefault,
        hora_entrada: newHoraEntrada,
        dias_trabajo: newDiasTrabajo,
        fecha_inicio_ciclo: newFechaInicio || null,
        empleado_id: newEmpleadoId || null,
        longitud_ciclo: newLongitudCiclo,
      };
      // Excluyente: por_dia gana sobre por_semana si ambos están activos.
      if (newHorasPorDia && Object.keys(newHorasPorDia).length > 0) {
        body.hora_entrada_por_dia = newHorasPorDia;
      } else if (newHorasPorSemana && newHorasPorSemana.length === Math.ceil(newLongitudCiclo / 7)) {
        body.hora_entrada_por_semana = newHorasPorSemana;
      }
      const r = await fetch(`${API_BASE}/puestos/${puesto.id}/slots`, {
        method: "POST", headers: hd(),
        body: JSON.stringify(body),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Error al crear titular"); }
      toast({ title: "Titular agregado" });
      setShowAddSlot(false);
      setNewDiasTrabajo([]);
      setNewBusqueda("");
      setNewEmpleadoId(null);
      setNewEmpleadoNombre("");
      setNewLongitudCiclo(14);
      setNewHorasPorSemana(null);
      setNewHorasPorDia(null);
      loadSlots(true);
      onSaved();
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    }
    setCreatingSlot(false);
  }

  const isFirstSetup = !puesto.tipo_turno_id;
  const isSameTurno  = !!puesto.tipo_turno_id && String(puesto.tipo_turno_id) === turnoId;
  const isChangeTurno = !!puesto.tipo_turno_id && !!turnoId && !isSameTurno;

  async function guardarTurno() {
    if (!turnoId) { toast({ title: "Seleccioná un tipo de turno", variant: "destructive" }); return; }

    if (isChangeTurno) {
      // Si ya hay solicitud pendiente para este puesto no se puede crear otra
      if (solicitudPendiente) {
        toast({ title: "Ya hay una solicitud pendiente — autorizala o rechazala primero", variant: "destructive" });
        return;
      }
      setGuardando(true);
      try {
        const r = await fetch(`${API_BASE}/puestos/${puesto.id}/solicitar-turno`, {
          method: "POST", headers: hd(),
          body: JSON.stringify({ turno_nuevo_id: parseInt(turnoId) }),
        });
        if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Error al crear solicitud"); }
        toast({ title: "📋 Solicitud de cambio creada — pendiente de autorización" });
        await loadSolicitud();
        onSaved();
      } catch (err: unknown) {
        toast({ title: (err as Error).message, variant: "destructive" });
      }
      setGuardando(false);
      return;
    }

    // Primera configuración o misma fecha: guardar y auto-crear slots si es primera vez
    setGuardando(true);
    try {
      const r = await fetch(`${API_BASE}/operaciones/puestos/${puesto.id}/turno`, {
        method: "PATCH", headers: hd(),
        body: JSON.stringify({ tipo_turno_id: parseInt(turnoId), fecha_inicio_ciclo: fechaInicio }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Error al guardar"); }

      if (isFirstSetup && turnoSel) {
        // Auto-crear titulares con días por defecto
        const horasT  = Math.round(turnoSel.horas_trabajo);
        const needed  = turnoSel.num_titulares;
        for (let i = 0; i < needed; i++) {
          const diasDefault: number[] = turnoSel.tipo_ciclo === "diario"
            ? [1,2,3,4,5,6,7,8,9,10,11,12,13,14]
            : i === 0 ? [1,3,5,7,9,11,13] : [2,4,6,8,10,12,14];
          await fetch(`${API_BASE}/puestos/${puesto.id}/slots`, {
            method: "POST", headers: hd(),
            body: JSON.stringify({ horas_turno: horasT, hora_entrada: "07:00", dias_trabajo: diasDefault, fecha_inicio_ciclo: fechaInicio || null }),
          });
        }
        toast({ title: `✅ Turno configurado · ${needed} titular${needed !== 1 ? "es" : ""} creado${needed !== 1 ? "s" : ""} automáticamente` });
        loadSlots(true);
      } else {
        toast({ title: "✅ Fecha de inicio actualizada" });
      }
      onSaved();
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    }
    setGuardando(false);
  }

  async function autorizarSolicitud() {
    if (!solicitudPendiente) return;
    setProcesandoSol(true);
    try {
      const r = await fetch(`${API_BASE}/solicitudes-turno/${solicitudPendiente.id}/autorizar`, {
        method: "POST", headers: hd(), body: JSON.stringify({}),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Error al autorizar"); }
      const result = await r.json();
      const partes: string[] = ["✅ Cambio de turno autorizado"];
      if (result.slots_eliminados > 0) partes.push(`${result.slots_eliminados} titular${result.slots_eliminados !== 1 ? "es" : ""} liberado${result.slots_eliminados !== 1 ? "s" : ""} al pool`);
      if (result.slots_creados > 0) partes.push(`${result.slots_creados} titular${result.slots_creados !== 1 ? "es" : ""} creado${result.slots_creados !== 1 ? "s" : ""} automáticamente`);
      toast({ title: partes.join(" · ") });
      setSolicitudPendiente(null);
      loadSlots(true);
      onSaved();
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    }
    setProcesandoSol(false);
  }

  async function rechazarSolicitud() {
    if (!solicitudPendiente) return;
    setProcesandoSol(true);
    try {
      const r = await fetch(`${API_BASE}/solicitudes-turno/${solicitudPendiente.id}/rechazar`, {
        method: "POST", headers: hd(), body: JSON.stringify({}),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Error al rechazar"); }
      toast({ title: "🚫 Solicitud rechazada — turno sin cambios" });
      setSolicitudPendiente(null);
      setTurnoId(String(puesto.tipo_turno_id ?? ""));
      onSaved();
    } catch (err: unknown) {
      toast({ title: (err as Error).message, variant: "destructive" });
    }
    setProcesandoSol(false);
  }

  function toggleNewDia(d: number) {
    setNewDiasTrabajo(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  }

  const canAddMore = turnoId && slots.length < maxSlots;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-3xl bg-[#0a1628] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-[#0d1e38] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
              <CalendarDays className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-white/90">Plantilla de Turnos</p>
              <p className="text-[10px] text-white/40 truncate max-w-[400px]">{puesto.nombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 transition-colors">
            <X className="w-4 h-4 text-white/40" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="p-5 space-y-5">

            {/* ── Tipo de turno ── */}
            <div className="p-3.5 bg-white/2 border border-white/8 rounded-xl space-y-2">
              <p className="text-[9px] font-semibold text-white/30 uppercase tracking-widest">Tipo de turno</p>
              <div className="flex items-center gap-2">
                {cargandoTurnos ? (
                  <div className="flex items-center gap-2 text-white/30 text-xs flex-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Cargando…
                  </div>
                ) : (
                  <select
                    value={turnoId}
                    onChange={e => setTurnoId(e.target.value)}
                    className="flex-1 bg-[#0d1e38] border border-white/12 text-white/70 text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500/50"
                  >
                    <option value="">— Seleccionar turno —</option>
                    {turnos.filter(t => t.id).map(t => (
                      <option key={t.id} value={String(t.id)}>
                        {t.nombre} · {t.horas_trabajo}h · {t.num_titulares} titular{t.num_titulares !== 1 ? "es" : ""}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={e => setFechaInicio(e.target.value)}
                  className="bg-[#0d1e38] border border-white/12 text-white/60 text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-indigo-500/50 w-36 shrink-0"
                />
                <button
                  onClick={guardarTurno}
                  disabled={guardando || !turnoId || (isChangeTurno && !!solicitudPendiente)}
                  className={`px-3 py-2 disabled:opacity-40 text-white text-[10px] font-semibold rounded-lg transition-colors shrink-0 flex items-center gap-1 ${
                    isChangeTurno
                      ? "bg-amber-600/80 hover:bg-amber-600"
                      : "bg-indigo-600/70 hover:bg-indigo-600"
                  }`}
                >
                  {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  {isChangeTurno ? "Solicitar cambio" : isFirstSetup ? "Configurar" : "Guardar fecha"}
                </button>
              </div>
              {turnoSel && (
                <p className="text-[9px] text-white/25">
                  {isFirstSetup
                    ? `Al configurar se crearán automáticamente ${turnoSel.num_titulares} titular${turnoSel.num_titulares !== 1 ? "es" : ""} con días por defecto.`
                    : isChangeTurno
                      ? "Cambiar el tipo de turno requiere autorización. Se creará una solicitud pendiente."
                      : turnoSel.tipo_ciclo === "diario"
                        ? `Turno diario de ${turnoSel.horas_trabajo}h. 1 titular cubre el puesto todos los días.`
                        : `Turno alternado ${turnoSel.nombre}. ${turnoSel.num_titulares} titulares se relevan en ciclo de 14 días.`
                  }
                </p>
              )}
            </div>

            {/* ── Solicitud pendiente de cambio de turno ── */}
            {solicitudPendiente && (
              <div className="p-3.5 bg-amber-500/6 border border-amber-500/30 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 text-[11px]">⏳</span>
                  <p className="text-[9px] font-bold text-amber-300/90 uppercase tracking-widest">Cambio de turno pendiente de autorización</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[9px]">
                  <div className="space-y-0.5">
                    <p className="text-white/30">Turno actual</p>
                    <p className="text-white/60 font-medium">{solicitudPendiente.turno_actual_nombre ?? "Sin turno"}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-white/30">Turno solicitado</p>
                    <p className="text-amber-300/80 font-semibold">{solicitudPendiente.turno_nuevo_nombre} · {solicitudPendiente.turno_nuevo_titulares} titular{solicitudPendiente.turno_nuevo_titulares !== 1 ? "es" : ""}</p>
                  </div>
                </div>
                {solicitudPendiente.turno_nuevo_titulares < slots.length && (
                  <p className="text-[9px] text-amber-200/60 leading-relaxed">
                    Al autorizar: {slots.length - solicitudPendiente.turno_nuevo_titulares} agente{slots.length - solicitudPendiente.turno_nuevo_titulares !== 1 ? "s" : ""} sobrante{slots.length - solicitudPendiente.turno_nuevo_titulares !== 1 ? "s" : ""} pasará{slots.length - solicitudPendiente.turno_nuevo_titulares !== 1 ? "n" : ""} automáticamente al pool de disponibles.
                  </p>
                )}
                <div className="flex gap-2 pt-0.5">
                  <button
                    onClick={autorizarSolicitud}
                    disabled={procesandoSol}
                    className="flex-1 py-1.5 bg-green-600/70 hover:bg-green-600 disabled:opacity-40 text-white text-[9px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    {procesandoSol ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    ✓ Autorizar
                  </button>
                  <button
                    onClick={rechazarSolicitud}
                    disabled={procesandoSol}
                    className="flex-1 py-1.5 bg-red-600/50 hover:bg-red-600/70 disabled:opacity-40 text-white text-[9px] font-bold rounded-lg transition-colors"
                  >
                    ✕ Rechazar
                  </button>
                </div>
                <p className="text-[8px] text-white/20">Solicitado por {solicitudPendiente.creado_por} · {new Date(solicitudPendiente.created_at).toLocaleDateString("es-GT")}</p>
              </div>
            )}

            {/* ── Titulares (slots de turnos) ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-semibold text-white/30 uppercase tracking-widest">
                  Titulares del puesto — vista 4 semanas (ciclo 14 días)
                </p>
                <span className="text-[9px] text-white/20">
                  {slots.length}/{turnoId ? maxSlots : "?"} titular{maxSlots !== 1 ? "es" : ""}
                </span>
              </div>

              {!turnoId && (
                <div className="py-6 text-center border border-dashed border-white/8 rounded-xl">
                  <p className="text-[10px] text-white/25 italic">Seleccioná primero el tipo de turno</p>
                </div>
              )}

              {turnoId && loadingSlots && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 text-white/20 animate-spin" />
                </div>
              )}

              {turnoId && !loadingSlots && (
                <div className="space-y-2">
                  {/* Aviso: slots sobrantes — se ajustan al autorizar el cambio */}
                  {turnoSel && slots.length > maxSlots && !solicitudPendiente && (
                    <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-500/8 border border-amber-500/25 rounded-xl">
                      <span className="text-amber-400/80 text-[11px] shrink-0 mt-0.5">⚠</span>
                      <p className="text-[9px] text-amber-300/80 leading-relaxed">
                        El turno <strong>{turnoSel.nombre}</strong> requiere {maxSlots} titular{maxSlots !== 1 ? "es" : ""}.
                        {" "}Hay {slots.length - maxSlots} sobrante{(slots.length - maxSlots) !== 1 ? "s" : ""} — solicitá un cambio de turno para ajustar automáticamente.
                      </p>
                    </div>
                  )}

                  {slots.map((slot, idx) => {
                    const saving = savingSlotId === slot.id;
                    const isEditingAgent = editAgentSlotId === slot.id;
                    const esExcedente = turnoSel ? idx >= maxSlots : false;
                    const lcSlot = [7,14,21,28].includes(slot.longitud_ciclo) ? slot.longitud_ciclo : 14;
                    const semanasSlot = semanasCiclo(lcSlot);
                    const tieneRotHorarios = Array.isArray(slot.hora_entrada_por_semana) && slot.hora_entrada_por_semana!.length === semanasSlot.length;
                    return (
                      <div key={slot.id} className={`bg-[#080f1e] border rounded-xl p-3 space-y-2 ${esExcedente ? "border-amber-500/40 bg-amber-500/4" : "border-white/8"}`}>
                        {/* Fila superior: T1/T2 | Agente | Rotación | Delete */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Badge titular */}
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${esExcedente ? "text-amber-300/80 bg-amber-500/15 border-amber-500/30" : "text-indigo-300/70 bg-indigo-500/10 border-indigo-500/20"}`}>
                            {esExcedente ? "Sobrante" : `T${slot.slot_numero}`}
                          </span>

                          {/* Agente inline */}
                          {isEditingAgent ? (
                            <div className="relative flex-1 min-w-0">
                              <input
                                autoFocus
                                type="text"
                                value={agentBusqueda}
                                onChange={e => setAgentBusqueda(e.target.value)}
                                placeholder="Buscar agente por nombre…"
                                className="w-full bg-[#0d1e38] border border-indigo-500/40 text-white/80 text-[10px] rounded-lg px-2.5 py-1.5 focus:outline-none placeholder-white/20"
                              />
                              {agentResultados.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a1628] border border-white/10 rounded-lg divide-y divide-white/5 max-h-28 overflow-y-auto z-30">
                                  {agentResultados.map((emp: any) => {
                                    const nombre = emp.nombre_completo || emp.nombreCompleto || "";
                                    return (
                                      <button
                                        key={emp.id}
                                        onClick={() => assignAgent(slot.id, emp.id, nombre)}
                                        className="w-full text-left px-2.5 py-1.5 text-[10px] text-white/70 hover:bg-white/5 transition-colors"
                                      >
                                        {nombre}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditAgentSlotId(slot.id); setAgentBusqueda(""); setAgentResultados([]); }}
                              className="flex items-center gap-1.5 text-[10px] rounded-lg px-2 py-1 hover:bg-white/5 transition-colors group"
                            >
                              {slot.empleado_nombre ? (
                                <span className="text-emerald-400/80 group-hover:text-emerald-300">{slot.empleado_nombre}</span>
                              ) : (
                                <span className="text-white/25 italic group-hover:text-white/50">Sin agente · asignar</span>
                              )}
                              <UserPlus className="w-2.5 h-2.5 text-white/20 group-hover:text-white/50" />
                            </button>
                          )}

                          {isEditingAgent && (
                            <button
                              onClick={() => { setEditAgentSlotId(null); setAgentBusqueda(""); setAgentResultados([]); }}
                              className="text-[9px] text-white/30 hover:text-white/60 underline shrink-0"
                            >
                              cancelar
                            </button>
                          )}

                          <div className="flex-1" />

                          {/* Selector rotación: 1 / 2 / 3 / 4 semanas */}
                          <div className="flex items-center gap-1 shrink-0" title="Cantidad de semanas distintas en la rotación">
                            <label className="text-[8px] text-white/30">Rotación</label>
                            <select
                              value={lcSlot}
                              disabled={saving}
                              onChange={async e => {
                                const nuevoLC = Number(e.target.value);
                                if (nuevoLC === lcSlot) return;
                                if (!confirm(`¿Cambiar rotación a ${nuevoLC/7} semana${nuevoLC>7?"s":""}? Los días que excedan se descartarán.`)) return;
                                const diasFiltrados = slot.dias_trabajo.filter(d => d <= nuevoLC);
                                const mediosFiltrados = (slot.dias_medio_turno || []).filter(d => d <= nuevoLC);
                                if (diasFiltrados.length === 0) {
                                  alert(`No se puede cambiar a ${nuevoLC/7} semana${nuevoLC>7?"s":""}: el patrón actual no tiene ningún día de trabajo dentro del nuevo ciclo. Marcá al menos un día válido primero.`);
                                  return;
                                }
                                // Snapshot inmutable para rollback ANTES de cualquier mutación
                                const prevSnapshot = {
                                  longitud_ciclo: slot.longitud_ciclo,
                                  dias_trabajo: [...slot.dias_trabajo],
                                  dias_medio_turno: slot.dias_medio_turno ? [...slot.dias_medio_turno] : null,
                                  hora_entrada_por_semana: slot.hora_entrada_por_semana ? [...slot.hora_entrada_por_semana] : null,
                                  hora_entrada_por_dia: slot.hora_entrada_por_dia ? { ...slot.hora_entrada_por_dia } : null,
                                };
                                // Ajustar hora_entrada_por_semana clonando defensivamente (no mutar slot original)
                                let nuevasHps: string[] | null = Array.isArray(slot.hora_entrada_por_semana) ? [...slot.hora_entrada_por_semana] : null;
                                const semNew = Math.ceil(nuevoLC/7);
                                if (Array.isArray(nuevasHps)) {
                                  if (nuevasHps.length > semNew) nuevasHps = nuevasHps.slice(0, semNew);
                                  else while (nuevasHps.length < semNew) nuevasHps.push(slot.hora_entrada || "07:00");
                                }
                                // TURNOS-05: filtrar excepciones por_dia fuera del nuevo rango.
                                let nuevasHpd: Record<string, string> | null = null;
                                let cambioHpd = false;
                                if (slot.hora_entrada_por_dia && Object.keys(slot.hora_entrada_por_dia).length > 0) {
                                  const filtrado: Record<string, string> = {};
                                  for (const [k, v] of Object.entries(slot.hora_entrada_por_dia)) {
                                    if (Number(k) <= nuevoLC) filtrado[k] = v;
                                  }
                                  nuevasHpd = Object.keys(filtrado).length > 0 ? filtrado : null;
                                  cambioHpd = JSON.stringify(nuevasHpd) !== JSON.stringify(slot.hora_entrada_por_dia);
                                }
                                setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, longitud_ciclo: nuevoLC, dias_trabajo: diasFiltrados, dias_medio_turno: mediosFiltrados, hora_entrada_por_semana: nuevasHps, hora_entrada_por_dia: nuevasHpd } : s));
                                setSavingSlotId(slot.id);
                                try {
                                  const body: any = { longitud_ciclo: nuevoLC, dias_trabajo: diasFiltrados, dias_medio_turno: mediosFiltrados };
                                  if (Array.isArray(nuevasHps)) body.hora_entrada_por_semana = nuevasHps;
                                  if (cambioHpd) body.hora_entrada_por_dia = nuevasHpd;
                                  const r = await fetch(`${API_BASE}/slots/${slot.id}`, { method: "PUT", headers: hd(), body: JSON.stringify(body) });
                                  if (!r.ok) {
                                    let msg = "No se pudo cambiar la rotación.";
                                    try { const j = await r.json(); if (j?.error) msg = j.error; } catch {}
                                    setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, ...prevSnapshot } : s));
                                    alert(msg);
                                  }
                                } catch (err) {
                                  setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, ...prevSnapshot } : s));
                                  alert("Error de red al cambiar la rotación. Intentá de nuevo.");
                                } finally {
                                  setSavingSlotId(null);
                                }
                              }}
                              className="bg-[#0d1e38] border border-white/10 text-white/60 text-[10px] rounded px-1.5 py-1 focus:outline-none focus:border-indigo-500/40"
                            >
                              <option value={7}>1 sem</option>
                              <option value={14}>2 sem</option>
                              <option value={21}>3 sem</option>
                              <option value={28}>4 sem</option>
                            </select>
                          </div>

                          {/* Delete */}
                          <button
                            onClick={() => deleteSlot(slot.id)}
                            className="p-1 text-red-400/20 hover:text-red-400 transition-colors shrink-0"
                            title="Quitar titular"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Editor de hora de entrada (igual / por semana / por día) */}
                        <EditorHoraEntrada
                          longitudCiclo={lcSlot}
                          horasTurno={slot.horas_turno}
                          diasTrabajo={slot.dias_trabajo}
                          horaEntrada={slot.hora_entrada}
                          horasPorSemana={slot.hora_entrada_por_semana}
                          horasPorDia={slot.hora_entrada_por_dia ?? null}
                          disabled={saving}
                          onChange={patch =>
                            setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, ...patch } : s))
                          }
                          onCommit={async patch => {
                            setSavingSlotId(slot.id);
                            try {
                              await fetch(`${API_BASE}/slots/${slot.id}`, {
                                method: "PUT", headers: hd(),
                                body: JSON.stringify(patch),
                              });
                            } catch {}
                            setSavingSlotId(null);
                          }}
                        />

                        {/* Cuadrícula de N semanas — sólo botones de día (T/D/½) */}
                        <div className="space-y-1">
                          {semanasSlot.map((semana, si) => (
                            <div key={si} className="flex items-center gap-0.5">
                              <span className="text-[8px] w-6 shrink-0 font-medium text-white/30">S{si + 1}</span>
                              {semana.map(({ n, label }) => {
                                const trabaja = slot.dias_trabajo.includes(n);
                                const esMedio = (slot.dias_medio_turno || []).includes(n);
                                const estado = !trabaja ? "D" : esMedio ? "T/2" : "T";
                                const tieneExc = trabaja && !!slot.hora_entrada_por_dia?.[String(n)];
                                const horaDia = horaDelDiaSlot(slot, n);
                                return (
                                  <button
                                    key={n}
                                    disabled={saving}
                                    onClick={() => toggleDia(slot, n)}
                                    title={`${label} (D${n}, S${si+1}): ${estado === "T" ? "turno completo" : estado === "T/2" ? "medio turno" : "descansa"}${trabaja ? ` · entra ${horaDia}` : ""}`}
                                    className={`relative flex-1 h-8 rounded text-[9px] font-semibold border transition-all ${
                                      estado === "T"
                                        ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-200 hover:bg-indigo-500/10"
                                        : estado === "T/2"
                                        ? "bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/10"
                                        : "bg-white/3 border-white/8 text-white/20 hover:border-white/20 hover:text-white/40"
                                    } ${saving ? "opacity-40 cursor-wait" : "cursor-pointer"}`}
                                  >
                                    {estado === "T" ? label : estado === "T/2" ? "½" : label}
                                    {tieneExc && (
                                      <span className="absolute top-0 right-0.5 text-[7px] text-amber-300/90 leading-none" title={`Excepción: ${horaDia}`}>•</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                        <p className="text-[8px] text-white/15">
                          {slot.dias_trabajo.length - (slot.dias_medio_turno || []).length} completos · {(slot.dias_medio_turno || []).length} medios · {lcSlot - slot.dias_trabajo.length} descanso · {slot.horas_turno}h base · ciclo {lcSlot}d
                        </p>
                      </div>
                    );
                  })}

                  {/* Formulario: nuevo titular */}
                  {showAddSlot ? (
                    <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4 space-y-3">
                      <p className="text-[9px] font-semibold text-indigo-300/60 uppercase tracking-wide">
                        Titular {slots.length + 1} — turno de {horasTurnoDefault}h
                      </p>

                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <label className="text-[9px] text-white/30">Rotación</label>
                          <select
                            value={newLongitudCiclo}
                            onChange={e => {
                              const nuevo = Number(e.target.value);
                              setNewLongitudCiclo(nuevo);
                              // Filtrar días fuera del nuevo rango (incluye excepciones por_dia)
                              setNewDiasTrabajo(prev => prev.filter(d => d <= nuevo));
                              setNewHorasPorDia(prev => {
                                if (!prev) return prev;
                                const filtrado: Record<string, string> = {};
                                for (const [k, v] of Object.entries(prev)) {
                                  if (Number(k) <= nuevo) filtrado[k] = v;
                                }
                                return Object.keys(filtrado).length ? filtrado : null;
                              });
                              // Ajustar horarios por semana si están activos
                              const semNew = Math.ceil(nuevo / 7);
                              setNewHorasPorSemana(prev => {
                                if (!prev) return null;
                                if (prev.length > semNew) return prev.slice(0, semNew);
                                if (prev.length < semNew) {
                                  const ext = [...prev];
                                  while (ext.length < semNew) ext.push(newHoraEntrada || "07:00");
                                  return ext;
                                }
                                return prev;
                              });
                            }}
                            className="bg-[#0d1e38] border border-white/12 text-white/70 text-[10px] rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500/50"
                          >
                            <option value={7}>1 semana</option>
                            <option value={14}>2 semanas</option>
                            <option value={21}>3 semanas</option>
                            <option value={28}>4 semanas</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <label className="text-[9px] text-white/30">Lun S1 =</label>
                          <input
                            type="date"
                            value={newFechaInicio}
                            onChange={e => setNewFechaInicio(e.target.value)}
                            className="bg-[#0d1e38] border border-white/12 text-white/60 text-[10px] rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500/50 w-32"
                          />
                        </div>
                      </div>

                      {/* Editor de hora de entrada (igual / por semana / por día) */}
                      <EditorHoraEntrada
                        longitudCiclo={newLongitudCiclo}
                        horasTurno={horasTurnoDefault}
                        diasTrabajo={newDiasTrabajo}
                        horaEntrada={newHoraEntrada}
                        horasPorSemana={newHorasPorSemana}
                        horasPorDia={newHorasPorDia}
                        onChange={patch => {
                          if (patch.hora_entrada !== undefined) setNewHoraEntrada(patch.hora_entrada);
                          if (patch.hora_entrada_por_semana !== undefined) setNewHorasPorSemana(patch.hora_entrada_por_semana);
                          if (patch.hora_entrada_por_dia !== undefined) {
                            const v = patch.hora_entrada_por_dia;
                            setNewHorasPorDia(v && Object.keys(v).length > 0 ? v : null);
                          }
                        }}
                      />

                      {/* Grid días: N semanas distintas según rotación (sólo botones T/D) */}
                      <div className="space-y-1">
                        {semanasCiclo(newLongitudCiclo).map((semana, si) => (
                          <div key={si} className="flex items-center gap-0.5">
                            <span className="text-[8px] w-6 shrink-0 text-white/30">S{si + 1}</span>
                            {semana.map(({ n, label }) => {
                              const tieneExc = newDiasTrabajo.includes(n) && !!newHorasPorDia?.[String(n)];
                              return (
                                <button
                                  key={n}
                                  onClick={() => toggleNewDia(n)}
                                  className={`relative flex-1 h-8 rounded text-[9px] font-semibold border transition-all ${
                                    newDiasTrabajo.includes(n)
                                      ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-200"
                                      : "bg-white/3 border-white/8 text-white/20 hover:border-white/20 hover:text-white/40"
                                  }`}
                                >
                                  {label}
                                  {tieneExc && (
                                    <span className="absolute top-0 right-0.5 text-[7px] text-amber-300/90 leading-none">•</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      <p className="text-[9px] text-white/25">{newDiasTrabajo.length} días trabaja · {newLongitudCiclo - newDiasTrabajo.length} días descansa · ciclo {newLongitudCiclo}d</p>

                      {/* Búsqueda de agente */}
                      <div className="relative">
                        <label className="text-[9px] text-white/30 block mb-1">Agente (opcional)</label>
                        <input
                          type="text"
                          value={newBusqueda}
                          onChange={e => { setNewBusqueda(e.target.value); if (!e.target.value) { setNewEmpleadoId(null); setNewEmpleadoNombre(""); } }}
                          placeholder="Buscar por nombre…"
                          className="w-full bg-[#0d1e38] border border-white/12 text-white/70 text-[10px] rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500/50 placeholder-white/20"
                        />
                        {newEmpleadoResultados.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a1628] border border-white/10 rounded-lg divide-y divide-white/5 max-h-32 overflow-y-auto z-20">
                            {newEmpleadoResultados.map((emp: any) => {
                              const nombre = emp.nombre_completo || emp.nombreCompleto || "";
                              return (
                                <button
                                  key={emp.id}
                                  onClick={() => { setNewEmpleadoId(emp.id); setNewBusqueda(nombre); setNewEmpleadoNombre(nombre); setNewEmpleadoResultados([]); }}
                                  className="w-full text-left px-3 py-1.5 text-[10px] text-white/70 hover:bg-white/5 transition-colors"
                                >
                                  {nombre}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => { setShowAddSlot(false); setNewDiasTrabajo([]); setNewBusqueda(""); setNewEmpleadoId(null); setNewEmpleadoNombre(""); }}
                          className="flex-1 py-2 border border-white/10 text-white/40 rounded-lg text-[10px] hover:text-white/70 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={createSlot}
                          disabled={creatingSlot || newDiasTrabajo.length === 0}
                          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[10px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-1"
                        >
                          {creatingSlot ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          Agregar titular
                        </button>
                      </div>
                    </div>
                  ) : canAddMore ? (
                    <button
                      onClick={() => setShowAddSlot(true)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-3 border border-dashed border-indigo-500/20 hover:border-indigo-500/40 hover:bg-indigo-500/5 text-indigo-400/40 hover:text-indigo-400/70 text-[10px] rounded-xl transition-colors"
                    >
                      <span className="text-sm leading-none">+</span>
                      Agregar Titular {slots.length + 1} de {maxSlots}
                    </button>
                  ) : slots.length >= maxSlots && slots.length > 0 ? (
                    <div className="text-center py-2">
                      <span className="text-[9px] text-emerald-400/50 bg-emerald-400/8 border border-emerald-400/15 px-2.5 py-1 rounded-full">
                        ✓ {maxSlots} titular{maxSlots !== 1 ? "es" : ""} asignado{maxSlots !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Nota */}
            <div className="bg-blue-950/20 border border-blue-500/15 rounded-xl px-3 py-2.5 text-[9px] text-blue-300/50 leading-relaxed">
              <p>Clic en un día para alternar trabaja/descansa. La hora de entrada es editable por titular. Esta misma plantilla es visible en la <strong>Ficha del Cliente</strong>.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-white/8 bg-[#080f1e] shrink-0">
          <button
            onClick={() => { onSaved(); onClose(); }}
            className="px-4 py-2 text-xs text-white/60 hover:text-white/90 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Tarjeta de Puesto Futuro ──────────────────────────────────────────────────

