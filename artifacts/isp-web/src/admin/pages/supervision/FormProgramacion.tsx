import { useId, useMemo, useState } from "react";
import { Calendar as CalIcon, MapPin } from "lucide-react";
import type {
  SupervisorDisponible, ProgTipo, ProgPrioridad,
} from "./types";
import { api, hoyISO, inputCls } from "./api";

export interface ClienteSlim { id: number; nombre: string }
export interface PuestoSlim { id: number; nombre: string; cliente_id?: number | null }
export interface ZonaSlim { zona_id: number; zona_nombre: string }

interface Props {
  supervisores: SupervisorDisponible[];
  clientes: ClienteSlim[];
  puestos: PuestoSlim[];
  zonas: ZonaSlim[];
  onClose: () => void;
  onSaved: () => void;
}

export function FormProgramacion({ supervisores, clientes, puestos, zonas, onClose, onSaved }: Props) {
  const [supId, setSupId] = useState<string>("");
  const [fecha, setFecha] = useState(hoyISO());
  const [vIni, setVIni] = useState("");
  const [vFin, setVFin] = useState("");
  const [tipo, setTipo] = useState<ProgTipo>("rutina");
  const [prio, setPrio] = useState<ProgPrioridad>("normal");
  const [clienteId, setClienteId] = useState<string>("");
  const [puestoId, setPuestoId] = useState<string>("");
  const [zonaId, setZonaId] = useState<string>("");
  const [instr, setInstr] = useState("");
  const [bono, setBono] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const titleId = useId();

  const puestosFiltrados = useMemo(
    () => clienteId ? puestos.filter(p => String(p.cliente_id) === clienteId) : puestos,
    [clienteId, puestos]
  );

  async function guardar() {
    setErr(null);
    if (!supId) { setErr("Seleccione un supervisor"); return; }
    if (!clienteId && !puestoId && !zonaId) {
      setErr("Indique al menos cliente, puesto o zona"); return;
    }
    if (vIni && vFin && vFin < vIni) {
      setErr("La hora fin debe ser posterior a la hora inicio"); return;
    }
    if (bono) {
      const m = Number(bono);
      if (!Number.isFinite(m) || m < 0) { setErr("Monto de bono inválido"); return; }
    }
    try {
      setSaving(true);
      await api("/supervision-programaciones", {
        method: "POST",
        body: JSON.stringify({
          supervisor_employee_id: Number(supId),
          fecha_planificada: fecha,
          ventana_inicio: vIni || null,
          ventana_fin: vFin || null,
          tipo, prioridad: prio,
          cliente_id: clienteId ? Number(clienteId) : null,
          puesto_id: puestoId ? Number(puestoId) : null,
          zona_id: zonaId ? Number(zonaId) : null,
          instrucciones: instr || null,
          bono_monto: bono ? Number(bono) : null,
        }),
      });
      onSaved();
    } catch (e: any) {
      setErr(e.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId}
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0b1424] border border-white/10 rounded-lg w-full max-w-lg p-4 max-h-[90vh] overflow-y-auto">
        <h3 id={titleId} className="text-sm font-bold text-white mb-3 inline-flex items-center gap-2">
          <CalIcon className="w-4 h-4 text-primary" /> Nueva visita programada
        </h3>

        <div className="space-y-2">
          <Field label="Supervisor *" htmlForId="sup">
            <select id="sup" value={supId} onChange={e => setSupId(e.target.value)} className={inputCls}>
              <option value="">— seleccionar —</option>
              {supervisores.map(s => <option key={s.id} value={s.id}>{s.nombre_completo}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Fecha *" htmlForId="fecha">
              <input id="fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Hora inicio" htmlForId="vini">
              <input id="vini" type="time" value={vIni} onChange={e => setVIni(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Hora fin" htmlForId="vfin">
              <input id="vfin" type="time" value={vFin} onChange={e => setVFin(e.target.value)} className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Tipo" htmlForId="tipo">
              <select id="tipo" value={tipo} onChange={e => setTipo(e.target.value as ProgTipo)} className={inputCls}>
                <option value="rutina">Rutina</option>
                <option value="extraordinaria">Extraordinaria</option>
                <option value="comision">Comisión</option>
              </select>
            </Field>
            <Field label="Prioridad" htmlForId="prio">
              <select id="prio" value={prio} onChange={e => setPrio(e.target.value as ProgPrioridad)} className={inputCls}>
                <option value="baja">Baja</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </Field>
          </div>

          <div className="border-t border-white/5 pt-2">
            <p className="text-[10px] text-white/40 mb-1 inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Destino (al menos uno)
            </p>
            <Field label="Cliente" htmlForId="cli">
              <select id="cli" value={clienteId}
                onChange={e => { setClienteId(e.target.value); setPuestoId(""); }}
                className={inputCls}>
                <option value="">—</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Field>
            <Field label="Puesto operativo" htmlForId="po">
              <select id="po" value={puestoId} onChange={e => setPuestoId(e.target.value)} className={inputCls}>
                <option value="">—</option>
                {puestosFiltrados.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </Field>
            <Field label="Zona" htmlForId="zona">
              <select id="zona" value={zonaId} onChange={e => setZonaId(e.target.value)} className={inputCls}>
                <option value="">—</option>
                {zonas.map(z => <option key={z.zona_id} value={z.zona_id}>{z.zona_nombre}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Instrucciones" htmlForId="instr">
            <textarea id="instr" value={instr} onChange={e => setInstr(e.target.value)} rows={3}
              className={inputCls + " resize-none"} placeholder="Observaciones, objetivos, contactos…" />
          </Field>

          {(tipo === "extraordinaria" || tipo === "comision") && (
            <Field label="Bono al supervisor (Q) — opcional" htmlForId="bono">
              <input id="bono" type="number" min="0" step="0.01"
                value={bono} onChange={e => setBono(e.target.value)}
                className={inputCls} placeholder="0.00" />
              <p className="text-[10px] text-white/40 mt-0.5">
                Se registra como pendiente de incluir en planilla; no genera línea automática.
              </p>
            </Field>
          )}

          {err && <p role="alert" className="text-rose-300 text-xs">{err}</p>}
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

function Field({ label, htmlForId, children }: { label: string; htmlForId?: string; children: React.ReactNode }) {
  return (
    <div className="mb-1.5">
      <label htmlFor={htmlForId} className="block text-[10px] text-white/50 mb-0.5">{label}</label>
      {children}
    </div>
  );
}
