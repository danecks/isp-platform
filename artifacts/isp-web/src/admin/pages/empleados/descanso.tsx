import { useState, useEffect, useRef, type ElementType } from "react";
  import { QRCodeSVG } from "qrcode.react";
  import { createPortal } from "react-dom";
  import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
  import {
    Users, Search, X, Loader2, RefreshCw,
    Building2, MapPin, Phone, Mail, Calendar, Hash,
    Shield, Briefcase, BarChart2, CheckSquare, Wallet,
    AlertTriangle, Zap, Activity, Clock, TrendingUp,
    UserCheck, BadgeCheck, Plus, Pencil, LayoutList,
    LayoutGrid, ChevronDown, UserX, UserCheck2, MessageSquare,
    Link2, Unlink, Lock, Save, Banknote, MessageCircle, XCircle,
    TrendingDown, Minus, ShieldAlert, ShieldCheck, ShieldOff,
    ArrowUpRight, ArrowDownRight, Repeat2, ArrowLeftRight, MapPinned, Map, History,
    UserCog, Sun, Umbrella, CheckCircle2, Info, ChevronRight, QrCode, Download,
    ClipboardList, FileText, Scale, FileSignature, Printer, Camera,
    CalendarClock, Trash2,
  } from "lucide-react";
  import { useToast } from "@/hooks/use-toast";
  import { generarContratoLaboral, cargarPatronoDesdeConfig, type DatosContratoLaboral } from "@/lib/pdfRrhh";
  import { useDeleteMode } from "@/contexts/DeleteModeContext";
  import DescansoSemanalEditor from "../../components/DescansoSemanalEditor";
  import { getSessionToken } from "@/lib/httpClient";
  import {
    type Empleado, type KpiData, type Asignacion, type UserVinculado, type PuestoTitular, type HistorialRelevo,
    type OperacionData, type EventoKPIFront, type KPIDisciplinario, type MovimientoRotacion, type KPIRotacion,
    type FormState, type AsignacionOperativa, type TipoPersonalConfig,
    API_BASE, sessionHeader, iniciales, fmtFecha, fmtRelativa, fmtQ, maskDpi,
    ESTADO_LAB, AVATAR_COLORS, avatarColor, FORM_EMPTY, TIPO_PERSONAL_CFG,
    VALID_TIPOS_PERSONAL, useTiposPersonal, TipoPersonalBadge, EstadoBadge,
    KpiCard, ProgressBar,
  } from "./shared";
  
export const DIAS_SEM_PLANTILLA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function lastMondayISO(fechaISO?: string): string {
  const d = fechaISO ? new Date(fechaISO + "T00:00:00") : new Date();
  const dow = d.getDay(); // 0=Dom .. 6=Sab
  const diff = dow === 0 ? -6 : 1 - dow; // retrocede al lunes
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export type PersonalSlot = {
  id: number;
  employee_id: number;
  tipo: "supervisor" | "administrativo";
  slot_numero: number;
  horas_turno: number;
  hora_entrada: string;
  hora_entrada_por_semana: string[] | null;
  dias_trabajo: number[];
  dias_medio_turno: number[] | null;
  longitud_ciclo: number;
  fecha_inicio_ciclo: string;
  notas: string | null;
  activo: boolean;
};

export function semanasGrid(longitudCiclo: number): Array<Array<{ n: number; label: string }>> {
  const lc = [7, 14, 21, 28].includes(longitudCiclo) ? longitudCiclo : 14;
  const dias = Array.from({ length: lc }, (_, i) => ({ n: i + 1, label: DIAS_SEM_PLANTILLA[i % 7] }));
  const numSem = Math.ceil(lc / 7);
  return Array.from({ length: numSem }, (_, si) => dias.slice(si * 7, (si + 1) * 7));
}

export function TabPlantillaPersonal({ emp }: { emp: Empleado }) {
  const { toast } = useToast();
  const tipoSlot: "supervisor" | "administrativo" =
    emp.tipoPersonal === "supervisor" ? "supervisor" : "administrativo";

  const [slots, setSlots] = useState<PersonalSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [savingId, setSavingId] = useState<number | "new" | null>(null);
  const [editId, setEditId] = useState<number | null>(null);

  // Form nuevo slot
  const [nLongitud, setNLongitud] = useState<number>(14);
  const [nHoras, setNHoras] = useState<number>(8);
  const [nHora, setNHora] = useState<string>("08:00");
  const [nFecha, setNFecha] = useState<string>(lastMondayISO());
  const [nDias, setNDias] = useState<number[]>([]);
  const [nNotas, setNNotas] = useState<string>("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/personal/empleados/${emp.id}/slots`, { headers: sessionHeader() });
      if (r.ok) {
        const d = await r.json();
        setSlots(Array.isArray(d.slots) ? d.slots : []);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, [emp.id]);

  function resetForm() {
    setNLongitud(14); setNHoras(8); setNHora("08:00");
    setNFecha(lastMondayISO()); setNDias([]); setNNotas("");
  }

  function toggleDia(arr: number[], n: number): number[] {
    return arr.includes(n) ? arr.filter(x => x !== n) : [...arr, n].sort((a, b) => a - b);
  }

  async function crear() {
    if (nDias.length === 0) {
      toast({ title: "Días requeridos", description: "Selecciona al menos un día de trabajo", variant: "destructive" });
      return;
    }
    setSavingId("new");
    try {
      const r = await fetch(`${API_BASE}/personal/empleados/${emp.id}/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...sessionHeader() },
        body: JSON.stringify({
          tipo: tipoSlot,
          horas_turno: nHoras,
          hora_entrada: nHora,
          dias_trabajo: nDias,
          longitud_ciclo: nLongitud,
          fecha_inicio_ciclo: nFecha,
          notas: nNotas || null,
        }),
      });
      if (r.ok) {
        toast({ title: "Plantilla creada" });
        setShowForm(false);
        resetForm();
        await load();
      } else {
        const err = await r.json().catch(() => ({}));
        toast({ title: "Error al crear", description: err.error || "Verifica los datos", variant: "destructive" });
      }
    } finally { setSavingId(null); }
  }

  async function actualizarDias(slot: PersonalSlot, nuevosDias: number[]) {
    setSavingId(slot.id);
    try {
      const r = await fetch(`${API_BASE}/personal-slots/${slot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...sessionHeader() },
        body: JSON.stringify({ dias_trabajo: nuevosDias }),
      });
      if (r.ok) await load();
      else toast({ title: "Error al guardar", variant: "destructive" });
    } finally { setSavingId(null); }
  }

  async function eliminar(slot: PersonalSlot) {
    if (!confirm("¿Eliminar esta plantilla de turno?")) return;
    setSavingId(slot.id);
    try {
      const r = await fetch(`${API_BASE}/personal-slots/${slot.id}`, {
        method: "DELETE", headers: sessionHeader(),
      });
      if (r.ok) { toast({ title: "Plantilla eliminada" }); await load(); }
      else toast({ title: "Error al eliminar", variant: "destructive" });
    } finally { setSavingId(null); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-violet-400" />
          <p className="text-white/60 text-sm font-semibold uppercase tracking-wide">
            Plantilla de turno {tipoSlot === "supervisor" ? "(supervisor)" : "(administrativo)"}
          </p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-xs bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-200 rounded-lg px-2.5 py-1.5">
            <Plus className="w-3.5 h-3.5" /> Nueva plantilla
          </button>
        )}
      </div>

      <p className="text-[11px] text-white/40 leading-relaxed">
        Define el patrón de trabajo del colaborador en un ciclo de 7, 14, 21 o 28 días.
        El día 1 del ciclo siempre es lunes. Los días marcados son los de trabajo; el resto son descanso.
        El pizarrón operativo usa esta plantilla para calcular si trabaja hoy o no.
      </p>

      {/* Form nueva plantilla */}
      {showForm && (
        <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-white/60">
              Longitud del ciclo
              <select value={nLongitud} onChange={e => { setNLongitud(Number(e.target.value)); setNDias([]); }}
                className="w-full mt-1 bg-[#07111f] border border-white/10 rounded-md px-2 py-1.5 text-sm text-white">
                {[7, 14, 21, 28].map(n => <option key={n} value={n}>{n} días</option>)}
              </select>
            </label>
            <label className="text-xs text-white/60">
              Horas de turno
              <select value={nHoras} onChange={e => setNHoras(Number(e.target.value))}
                className="w-full mt-1 bg-[#07111f] border border-white/10 rounded-md px-2 py-1.5 text-sm text-white">
                {[8, 12, 24].map(n => <option key={n} value={n}>{n} h</option>)}
              </select>
            </label>
            <label className="text-xs text-white/60">
              Hora de entrada
              <input type="time" value={nHora} onChange={e => setNHora(e.target.value)}
                className="w-full mt-1 bg-[#07111f] border border-white/10 rounded-md px-2 py-1.5 text-sm text-white" />
            </label>
            <label className="text-xs text-white/60">
              Inicio del ciclo (lunes)
              <input type="date" value={nFecha} onChange={e => setNFecha(lastMondayISO(e.target.value))}
                className="w-full mt-1 bg-[#07111f] border border-white/10 rounded-md px-2 py-1.5 text-sm text-white" />
            </label>
          </div>

          <div>
            <p className="text-xs text-white/60 mb-2">Días de trabajo en el ciclo</p>
            <div className="space-y-1.5">
              {semanasGrid(nLongitud).map((semana, si) => (
                <div key={si} className="flex gap-1.5">
                  <span className="text-[10px] text-white/30 w-6 pt-1.5">S{si + 1}</span>
                  {semana.map(d => {
                    const on = nDias.includes(d.n);
                    return (
                      <button key={d.n} type="button" onClick={() => setNDias(toggleDia(nDias, d.n))}
                        className={`flex-1 text-[10px] py-1.5 rounded-md border transition-colors ${
                          on ? "bg-emerald-500/25 border-emerald-400/50 text-emerald-200"
                             : "bg-white/3 border-white/10 text-white/40 hover:bg-white/8"
                        }`}>
                        <div className="font-bold">{d.n}</div>
                        <div className="text-[9px] opacity-70">{d.label}</div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <label className="text-xs text-white/60 block">
            Notas (opcional)
            <input type="text" value={nNotas} onChange={e => setNNotas(e.target.value)} maxLength={200}
              className="w-full mt-1 bg-[#07111f] border border-white/10 rounded-md px-2 py-1.5 text-sm text-white" />
          </label>

          <div className="flex gap-2 pt-1">
            <button onClick={() => { setShowForm(false); resetForm(); }} disabled={savingId === "new"}
              className="flex-1 py-2 text-xs text-white/60 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg">
              Cancelar
            </button>
            <button onClick={crear} disabled={savingId === "new" || nDias.length === 0}
              className="flex-1 py-2 text-xs text-white bg-violet-600/40 hover:bg-violet-600/60 border border-violet-500/40 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
              {savingId === "new" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Crear plantilla
            </button>
          </div>
        </div>
      )}

      {/* Slots existentes */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
        </div>
      ) : slots.length === 0 ? (
        !showForm && (
          <div className="text-center py-8 text-white/40 text-xs border border-dashed border-white/10 rounded-xl">
            Sin plantilla de turno configurada
          </div>
        )
      ) : (
        slots.map((slot) => {
          const editing = editId === slot.id;
          const dias = editing ? slot.dias_trabajo : slot.dias_trabajo;
          return (
            <div key={slot.id} className="bg-white/3 border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs text-white/70 space-y-0.5">
                  <div><span className="text-white/40">Slot:</span> #{slot.slot_numero} · {slot.horas_turno}h · entra {slot.hora_entrada?.slice(0, 5)}</div>
                  <div><span className="text-white/40">Ciclo:</span> {slot.longitud_ciclo} días desde {String(slot.fecha_inicio_ciclo).slice(0, 10)}</div>
                  {slot.notas && <div className="text-white/40 italic">{slot.notas}</div>}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setEditId(editing ? null : slot.id)}
                    className="text-[10px] text-violet-300 hover:text-violet-100 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 rounded-md px-2 py-1">
                    {editing ? "Listo" : "Editar"}
                  </button>
                  <button onClick={() => eliminar(slot)} disabled={savingId === slot.id}
                    className="text-red-400/70 hover:text-red-300 bg-red-500/5 hover:bg-red-500/15 border border-red-500/20 rounded-md p-1 disabled:opacity-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                {semanasGrid(slot.longitud_ciclo).map((semana, si) => (
                  <div key={si} className="flex gap-1.5">
                    <span className="text-[10px] text-white/30 w-6 pt-1.5">S{si + 1}</span>
                    {semana.map(d => {
                      const on = dias.includes(d.n);
                      const interactivo = editing;
                      const handler = interactivo
                        ? () => actualizarDias(slot, toggleDia(slot.dias_trabajo, d.n))
                        : undefined;
                      return (
                        <button key={d.n} type="button" disabled={!interactivo || savingId === slot.id} onClick={handler}
                          className={`flex-1 text-[10px] py-1.5 rounded-md border transition-colors ${
                            on ? "bg-emerald-500/25 border-emerald-400/50 text-emerald-200"
                               : "bg-white/3 border-white/10 text-white/40"
                          } ${interactivo ? "hover:bg-emerald-500/35 cursor-pointer" : "cursor-default"}`}>
                          <div className="font-bold">{d.n}</div>
                          <div className="text-[9px] opacity-70">{d.label}</div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

