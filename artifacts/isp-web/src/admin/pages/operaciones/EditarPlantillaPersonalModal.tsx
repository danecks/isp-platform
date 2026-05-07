import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Save, Trash2, X, Plus, CalendarClock } from "lucide-react";

const API_BASE = "/api";
const DIAS_SEM = ["L", "M", "M", "J", "V", "S", "D"];

function getSession(): string {
  return (typeof sessionStorage !== "undefined"
    ? sessionStorage.getItem("isp_admin_session_v2")
    : null) || "";
}
function sessionHeader() { return { "x-isp-session": getSession() }; }

function lastMondayISO(fechaISO?: string): string {
  const d = fechaISO ? new Date(fechaISO + "T00:00:00") : new Date();
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function semanasGrid(longitudCiclo: number) {
  const lc = [7, 14, 21, 28].includes(longitudCiclo) ? longitudCiclo : 14;
  const dias = Array.from({ length: lc }, (_, i) => ({ n: i + 1, label: DIAS_SEM[i % 7] }));
  const numSem = Math.ceil(lc / 7);
  return Array.from({ length: numSem }, (_, si) => dias.slice(si * 7, (si + 1) * 7));
}

type TipoPlantilla = "supervisor" | "administrativo" | "jefe_servicio";

interface PersonalSlot {
  id: number;
  employee_id: number;
  tipo: TipoPlantilla;
  slot_numero: number;
  horas_turno: number;
  hora_entrada: string;
  dias_trabajo: number[];
  longitud_ciclo: number;
  fecha_inicio_ciclo: string;
  notas: string | null;
  activo: boolean;
}

interface Theme {
  border: string; bg: string; text: string; tag: string;
  btn: string; addBtn: string;
}
const THEMES: Record<TipoPlantilla, Theme> = {
  supervisor: {
    border: "border-violet-500/25",
    bg:     "bg-violet-500/5",
    text:   "text-violet-300/80",
    tag:    "border-violet-500/15",
    btn:    "bg-violet-600/40 hover:bg-violet-600/60 border-violet-500/40",
    addBtn: "text-violet-200 bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/30",
  },
  administrativo: {
    border: "border-cyan-500/25",
    bg:     "bg-cyan-500/5",
    text:   "text-cyan-300/80",
    tag:    "border-cyan-500/15",
    btn:    "bg-cyan-600/40 hover:bg-cyan-600/60 border-cyan-500/40",
    addBtn: "text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-500/30",
  },
  jefe_servicio: {
    border: "border-orange-500/25",
    bg:     "bg-orange-500/5",
    text:   "text-orange-300/80",
    tag:    "border-orange-500/15",
    btn:    "bg-orange-600/40 hover:bg-orange-600/60 border-orange-500/40",
    addBtn: "text-orange-200 bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30",
  },
};

interface Props {
  empleadoId: number;
  empleadoNombre: string;
  tipo: TipoPlantilla;
  onClose: () => void;
  onChanged?: () => void;
}

export function EditarPlantillaPersonalModal({ empleadoId, empleadoNombre, tipo, onClose, onChanged }: Props) {
  const t = THEMES[tipo];
  const [slots, setSlots] = useState<PersonalSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | "new" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // form nueva
  const [nLong, setNLong] = useState(14);
  const [nHoras, setNHoras] = useState(8);
  const [nHora, setNHora] = useState("08:00");
  const [nFecha, setNFecha] = useState(lastMondayISO());
  const [nDias, setNDias] = useState<number[]>([]);
  const [nNotas, setNNotas] = useState("");

  const [editBuf, setEditBuf] = useState<Record<number, { hora_entrada: string; dias_trabajo: number[]; horas_turno: number; longitud_ciclo: number }>>({});

  async function load() {
    setLoading(true); setErr(null);
    try {
      const r = await fetch(`${API_BASE}/personal/empleados/${empleadoId}/slots`, { headers: sessionHeader() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const arr: PersonalSlot[] = Array.isArray(d.slots) ? d.slots : [];
      setSlots(arr);
      const buf: typeof editBuf = {};
      for (const s of arr) buf[s.id] = {
        hora_entrada: String(s.hora_entrada || "").slice(0, 5),
        dias_trabajo: Array.isArray(s.dias_trabajo) ? [...s.dias_trabajo] : [],
        horas_turno: Number(s.horas_turno) || 8,
        longitud_ciclo: Number(s.longitud_ciclo) || 14,
      };
      setEditBuf(buf);
      if (arr.length === 0) setShowForm(true);
    } catch (e: any) {
      setErr(e.message || "Error al cargar");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [empleadoId]);

  function toggleDia(arr: number[], n: number) {
    return arr.includes(n) ? arr.filter(x => x !== n) : [...arr, n].sort((a, b) => a - b);
  }

  async function crear() {
    if (nDias.length === 0) { setErr("Selecciona al menos un día de trabajo"); return; }
    setSavingId("new"); setErr(null);
    try {
      const r = await fetch(`${API_BASE}/personal/empleados/${empleadoId}/slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...sessionHeader() },
        body: JSON.stringify({
          tipo, horas_turno: nHoras, hora_entrada: nHora,
          dias_trabajo: nDias, longitud_ciclo: nLong,
          fecha_inicio_ciclo: nFecha, notas: nNotas || null,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      setShowForm(false); setNDias([]); setNNotas("");
      await load();
      onChanged?.();
    } catch (e: any) { setErr(e.message); }
    finally { setSavingId(null); }
  }

  async function guardar(slot: PersonalSlot) {
    const buf = editBuf[slot.id];
    if (!buf) return;
    if (buf.dias_trabajo.length === 0) { setErr("Selecciona al menos un día"); return; }
    setSavingId(slot.id); setErr(null);
    try {
      const r = await fetch(`${API_BASE}/personal-slots/${slot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...sessionHeader() },
        body: JSON.stringify({
          tipo,
          hora_entrada: buf.hora_entrada,
          dias_trabajo: buf.dias_trabajo,
          horas_turno: buf.horas_turno,
          longitud_ciclo: buf.longitud_ciclo,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      await load();
      onChanged?.();
    } catch (e: any) { setErr(e.message); }
    finally { setSavingId(null); }
  }

  async function eliminar(slot: PersonalSlot) {
    if (!confirm(`¿Eliminar la plantilla de turno #${slot.slot_numero}?`)) return;
    setSavingId(slot.id); setErr(null);
    try {
      const r = await fetch(`${API_BASE}/personal-slots/${slot.id}`, { method: "DELETE", headers: sessionHeader() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await load();
      onChanged?.();
    } catch (e: any) { setErr(e.message); }
    finally { setSavingId(null); }
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`bg-[#0a1322] border ${t.border} rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col`}>

        <div className={`flex items-center justify-between px-5 py-3 border-b ${t.tag} ${t.bg}`}>
          <div className="flex items-center gap-2 min-w-0">
            <CalendarClock className={`w-4 h-4 ${t.text} shrink-0`} />
            <div className="min-w-0">
              <p className="text-xs text-white/50 uppercase tracking-wider">
                Plantilla de turno · {tipo === "supervisor" ? "Supervisor" : tipo === "jefe_servicio" ? "Jefe de Servicio" : "Administrativo"}
              </p>
              <p className="text-sm text-white font-semibold truncate">{empleadoNombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-white/50 hover:text-white hover:bg-white/10 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3 flex-1">
          {err && (
            <div role="alert" className="text-rose-300 text-xs p-2.5 border border-rose-500/30 rounded bg-rose-500/10">
              {err}
            </div>
          )}

          {loading && (
            <div className="text-white/50 text-sm inline-flex items-center gap-2 p-3">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
            </div>
          )}

          {!loading && slots.length === 0 && !showForm && (
            <p className="text-white/40 text-xs p-4 text-center">
              Este colaborador no tiene plantilla de turno configurada.
            </p>
          )}

          {!loading && slots.map(s => {
            const buf = editBuf[s.id]; if (!buf) return null;
            const dirty =
              buf.hora_entrada !== String(s.hora_entrada).slice(0, 5) ||
              buf.horas_turno !== s.horas_turno ||
              buf.longitud_ciclo !== s.longitud_ciclo ||
              JSON.stringify(buf.dias_trabajo) !== JSON.stringify(s.dias_trabajo);
            const saving = savingId === s.id;
            return (
              <div key={s.id} className={`bg-[#060f1a] border ${t.tag} rounded-xl p-3 space-y-3`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold ${t.text} uppercase tracking-wider`}>
                    Plantilla #{s.slot_numero}
                  </span>
                  <button onClick={() => eliminar(s)} disabled={saving}
                    className="text-[11px] text-rose-300/70 hover:text-rose-300 inline-flex items-center gap-1 disabled:opacity-40">
                    <Trash2 className="w-3 h-3" /> Eliminar
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <label className="text-[10px] text-white/50">
                    Hora entrada
                    <input type="time" value={buf.hora_entrada}
                      onChange={e => setEditBuf(b => ({ ...b, [s.id]: { ...buf, hora_entrada: e.target.value } }))}
                      className="w-full mt-0.5 bg-[#07111f] border border-white/10 rounded px-1.5 py-1 text-xs text-white" />
                  </label>
                  <label className="text-[10px] text-white/50">
                    Horas
                    <select value={buf.horas_turno}
                      onChange={e => setEditBuf(b => ({ ...b, [s.id]: { ...buf, horas_turno: Number(e.target.value) } }))}
                      className="w-full mt-0.5 bg-[#07111f] border border-white/10 rounded px-1.5 py-1 text-xs text-white">
                      {[8, 12, 24].map(n => <option key={n} value={n}>{n} h</option>)}
                    </select>
                  </label>
                  <label className="text-[10px] text-white/50">
                    Ciclo
                    <select value={buf.longitud_ciclo}
                      onChange={e => {
                        const lc = Number(e.target.value);
                        setEditBuf(b => ({ ...b, [s.id]: {
                          ...buf, longitud_ciclo: lc,
                          dias_trabajo: buf.dias_trabajo.filter(d => d <= lc),
                        }}));
                      }}
                      className="w-full mt-0.5 bg-[#07111f] border border-white/10 rounded px-1.5 py-1 text-xs text-white">
                      {[7, 14, 21, 28].map(n => <option key={n} value={n}>{n} días</option>)}
                    </select>
                  </label>
                </div>

                <div>
                  <p className="text-[10px] text-white/50 mb-1">Días de trabajo</p>
                  <div className="space-y-1">
                    {semanasGrid(buf.longitud_ciclo).map((sem, si) => (
                      <div key={si} className="flex gap-1">
                        <span className="text-[9px] text-white/30 w-5 pt-1">S{si + 1}</span>
                        {sem.map(d => {
                          const on = buf.dias_trabajo.includes(d.n);
                          return (
                            <button key={d.n} type="button"
                              onClick={() => setEditBuf(b => ({ ...b, [s.id]: { ...buf, dias_trabajo: toggleDia(buf.dias_trabajo, d.n) } }))}
                              className={`flex-1 text-[10px] py-1 rounded border transition-colors ${
                                on ? "bg-emerald-500/25 border-emerald-400/50 text-emerald-200"
                                   : "bg-white/3 border-white/10 text-white/40 hover:bg-white/8"
                              }`}>
                              <div className="font-bold">{d.n}</div>
                              <div className="text-[8px] opacity-70">{d.label}</div>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-white/30">
                    Inicio del ciclo: <span className="text-white/50 font-mono">{s.fecha_inicio_ciclo}</span>
                  </span>
                  <button onClick={() => guardar(s)} disabled={!dirty || saving}
                    className={`px-3 py-1 text-xs rounded-lg inline-flex items-center gap-1.5 border text-white ${
                      dirty && !saving ? t.btn : "bg-white/5 border-white/10 text-white/40 cursor-not-allowed"
                    }`}>
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Guardar
                  </button>
                </div>
              </div>
            );
          })}

          {!loading && showForm && (
            <div className={`${t.bg} border ${t.border} rounded-xl p-3 space-y-3`}>
              <p className={`text-[10px] font-bold ${t.text} uppercase tracking-wider`}>Nueva plantilla</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] text-white/50">
                  Ciclo
                  <select value={nLong} onChange={e => { setNLong(Number(e.target.value)); setNDias([]); }}
                    className="w-full mt-0.5 bg-[#07111f] border border-white/10 rounded px-1.5 py-1 text-xs text-white">
                    {[7, 14, 21, 28].map(n => <option key={n} value={n}>{n} días</option>)}
                  </select>
                </label>
                <label className="text-[10px] text-white/50">
                  Horas turno
                  <select value={nHoras} onChange={e => setNHoras(Number(e.target.value))}
                    className="w-full mt-0.5 bg-[#07111f] border border-white/10 rounded px-1.5 py-1 text-xs text-white">
                    {[8, 12, 24].map(n => <option key={n} value={n}>{n} h</option>)}
                  </select>
                </label>
                <label className="text-[10px] text-white/50">
                  Hora entrada
                  <input type="time" value={nHora} onChange={e => setNHora(e.target.value)}
                    className="w-full mt-0.5 bg-[#07111f] border border-white/10 rounded px-1.5 py-1 text-xs text-white" />
                </label>
                <label className="text-[10px] text-white/50">
                  Inicio (lunes)
                  <input type="date" value={nFecha} onChange={e => setNFecha(lastMondayISO(e.target.value))}
                    className="w-full mt-0.5 bg-[#07111f] border border-white/10 rounded px-1.5 py-1 text-xs text-white" />
                </label>
              </div>

              <div>
                <p className="text-[10px] text-white/50 mb-1">Días de trabajo</p>
                <div className="space-y-1">
                  {semanasGrid(nLong).map((sem, si) => (
                    <div key={si} className="flex gap-1">
                      <span className="text-[9px] text-white/30 w-5 pt-1">S{si + 1}</span>
                      {sem.map(d => {
                        const on = nDias.includes(d.n);
                        return (
                          <button key={d.n} type="button" onClick={() => setNDias(toggleDia(nDias, d.n))}
                            className={`flex-1 text-[10px] py-1 rounded border ${
                              on ? "bg-emerald-500/25 border-emerald-400/50 text-emerald-200"
                                 : "bg-white/3 border-white/10 text-white/40 hover:bg-white/8"
                            }`}>
                            <div className="font-bold">{d.n}</div>
                            <div className="text-[8px] opacity-70">{d.label}</div>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <input type="text" value={nNotas} onChange={e => setNNotas(e.target.value)} maxLength={200}
                placeholder="Notas (opcional)"
                className="w-full bg-[#07111f] border border-white/10 rounded px-2 py-1 text-xs text-white" />

              <div className="flex gap-2">
                {slots.length > 0 && (
                  <button onClick={() => setShowForm(false)} disabled={savingId === "new"}
                    className="flex-1 py-1.5 text-xs text-white/60 bg-white/5 hover:bg-white/10 border border-white/10 rounded">
                    Cancelar
                  </button>
                )}
                <button onClick={crear} disabled={savingId === "new" || nDias.length === 0}
                  className={`flex-1 py-1.5 text-xs text-white border rounded inline-flex items-center justify-center gap-1.5 disabled:opacity-50 ${t.btn}`}>
                  {savingId === "new" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Crear plantilla
                </button>
              </div>
            </div>
          )}

          {!loading && !showForm && slots.length > 0 && (
            <button onClick={() => setShowForm(true)}
              className={`w-full py-2 text-xs border border-dashed rounded inline-flex items-center justify-center gap-1.5 ${t.addBtn}`}>
              <Plus className="w-3 h-3" /> Añadir otra plantilla
            </button>
          )}
        </div>

        <div className="px-4 py-2 border-t border-white/10 text-[10px] text-white/30 text-center">
          Los cambios afectan al pizarrón en el próximo refresco (≤ 30 s).
        </div>
      </div>
    </div>,
    document.body
  );
}
