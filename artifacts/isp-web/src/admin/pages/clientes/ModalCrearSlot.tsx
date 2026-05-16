import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Calendar, Check } from "lucide-react";
import { API, h, Puesto } from "./_shared";

// El número de titulares y los días de trabajo se configuran automáticamente
// según el turno del puesto. El usuario solo define hora de entrada, fecha de
// inicio del ciclo y el agente a asignar.
export function ModalCrearSlot({
  puestos,
  defaultPuestoId,
  onClose,
  onSaved,
}: {
  puestos: Puesto[];
  defaultPuestoId?: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [puestoId, setPuestoId] = useState<number>(defaultPuestoId || puestos[0]?.id || 0);
  const [horaEntrada, setHoraEntrada] = useState("07:00");
  const [fechaInicioCiclo, setFechaInicioCiclo] = useState<string>("");
  const [empleadoBusqueda, setEmpleadoBusqueda] = useState("");
  const [empleadoId, setEmpleadoId] = useState<number | null>(null);
  const [empleadoResultados, setEmpleadoResultados] = useState<any[]>([]);
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (empleadoBusqueda.length < 2) { setEmpleadoResultados([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/employees?q=${encodeURIComponent(empleadoBusqueda)}&limit=8`, { headers: h() });
        const data = await r.json();
        setEmpleadoResultados(Array.isArray(data) ? data : (data.employees || []));
      } catch { setEmpleadoResultados([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [empleadoBusqueda]);

  async function save() {
    if (!puestoId) { setErr("Selecciona un puesto"); return; }
    if (!fechaInicioCiclo) { setErr("Ingresa la fecha de inicio del ciclo"); return; }
    setSaving(true); setErr("");
    try {
      const r = await fetch(`${API}/puestos/${puestoId}/slots`, {
        method: "POST",
        headers: h(),
        body: JSON.stringify({
          hora_entrada: horaEntrada,
          fecha_inicio_ciclo: fechaInicioCiclo,
          empleado_id: empleadoId || null,
          notas: notas || null,
        }),
      });
      if (!r.ok) { const e = await r.json(); setErr(e.error || "Error al guardar"); setSaving(false); return; }
      onSaved();
    } catch { setErr("Error de red"); setSaving(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-4 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> Agregar titular
          </p>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {/* Info automática */}
        <div className="bg-primary/8 border border-primary/20 rounded-xl px-3 py-2.5">
          <p className="text-[11px] text-primary/80 leading-relaxed">
            El número de titulares y los días de trabajo se determinan automáticamente según el turno asignado al puesto. El sistema bloqueará la operación si el puesto ya tiene todos sus titulares configurados.
          </p>
        </div>

        <div className="space-y-3">
          {/* Puesto */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1">Puesto</label>
            <select
              value={puestoId}
              onChange={e => setPuestoId(Number(e.target.value))}
              className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-xs rounded-lg px-3 outline-none focus:border-primary/50"
            >
              {puestos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}{p.sede_nombre ? ` — ${p.sede_nombre}` : ""}</option>
              ))}
            </select>
          </div>

          {/* Hora de entrada */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1">Hora de entrada</label>
            <input
              type="time"
              value={horaEntrada}
              onChange={e => setHoraEntrada(e.target.value)}
              className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-lg px-3 outline-none focus:border-primary/50"
            />
          </div>

          {/* Fecha de inicio del ciclo */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1">
              Fecha de inicio del ciclo <span className="text-red-400/60">*</span>
              <span className="text-white/20 ml-1">(el Día 1 del ciclo corresponde a esta fecha)</span>
            </label>
            <input
              type="date"
              value={fechaInicioCiclo}
              onChange={e => setFechaInicioCiclo(e.target.value)}
              className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-lg px-3 outline-none focus:border-primary/50"
            />
          </div>

          {/* Agente */}
          <div className="relative">
            <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1">Agente asignado (opcional)</label>
            <input
              type="text"
              value={empleadoBusqueda}
              onChange={e => {
                setEmpleadoBusqueda(e.target.value);
                if (!e.target.value) setEmpleadoId(null);
              }}
              placeholder="Buscar por nombre…"
              className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-xs rounded-lg px-3 outline-none focus:border-primary/50"
            />
            {empleadoResultados.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#07111f] border border-white/10 rounded-lg divide-y divide-white/5 max-h-36 overflow-y-auto z-10">
                {empleadoResultados.map((emp: any) => (
                  <button
                    key={emp.id}
                    onClick={() => { setEmpleadoId(emp.id); setEmpleadoBusqueda(emp.nombre_completo); setEmpleadoResultados([]); }}
                    className="w-full text-left px-3 py-2 text-xs text-white/70 hover:bg-white/5 transition-colors flex items-center justify-between"
                  >
                    <span>{emp.nombre_completo}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${emp.estado_laboral === "activo" ? "text-green-400 bg-green-400/10" : "text-white/30 bg-white/5"}`}>{emp.estado_laboral}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wide block mb-1">Notas (opcional)</label>
            <input
              type="text"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Observaciones…"
              className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-xs rounded-lg px-3 outline-none focus:border-primary/50"
            />
          </div>
        </div>

        {err && <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{err}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 h-9 border border-white/10 text-white/60 rounded-lg text-xs hover:text-white transition-colors">Cancelar</button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 h-9 bg-primary text-black font-bold rounded-lg text-xs hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-1"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> Guardar titular</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
