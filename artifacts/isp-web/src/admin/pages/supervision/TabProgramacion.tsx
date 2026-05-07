import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type {
  SupervisionProgramacion, SupervisorDisponible, ProgEstado,
} from "./types";
import { TIPO_LABEL, ESTADO_LABEL, PRIORIDAD_LABEL, ESTADO_COLOR, PRIORIDAD_COLOR } from "./types";
import { api, hoyISO, en7DiasISO } from "./api";
import { FormProgramacion, type ClienteSlim, type PuestoSlim, type ZonaSlim } from "./FormProgramacion";

export function TabProgramacion() {
  const [items, setItems] = useState<SupervisionProgramacion[]>([]);
  const [supervisores, setSupervisores] = useState<SupervisorDisponible[]>([]);
  const [clientes, setClientes] = useState<ClienteSlim[]>([]);
  const [puestos, setPuestos] = useState<PuestoSlim[]>([]);
  const [zonas, setZonas] = useState<ZonaSlim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [fSupervisor, setFSupervisor] = useState<string>("");
  const [fDesde, setFDesde] = useState(hoyISO());
  const [fHasta, setFHasta] = useState(en7DiasISO());
  const [fEstado, setFEstado] = useState<string>("");

  async function cargar() {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (fSupervisor) params.set("supervisor", fSupervisor);
      if (fDesde) params.set("desde", fDesde);
      if (fHasta) params.set("hasta", fHasta);
      if (fEstado) params.set("estado", fEstado);
      const [progs, sups] = await Promise.all([
        api<{ programaciones: SupervisionProgramacion[] }>(`/supervision-programaciones?${params}`),
        api<{ supervisores: SupervisorDisponible[] }>("/supervision-zonas/supervisores-disponibles"),
      ]);
      setItems(progs.programaciones);
      setSupervisores(sups.supervisores);
    } catch (err: any) {
      setError(err.message || "Error al cargar");
    } finally {
      setLoading(false);
    }
  }

  async function cargarCatalogos() {
    try {
      const [cs, ps, zs] = await Promise.all([
        api<any>("/clients").catch(() => ({ clients: [] })),
        api<any>("/puestos-operativos").catch(() => ({ puestos: [] })),
        api<{ zonas: ZonaSlim[] }>("/supervision-zonas").catch(() => ({ zonas: [] })),
      ]);
      const cArr = Array.isArray(cs) ? cs : (cs.clients || cs.clientes || []);
      const pArr = Array.isArray(ps) ? ps : (ps.puestos || []);
      setClientes(cArr.map((c: any) => ({
        id: c.id,
        nombre: c.nombre || c.nombre_comercial || c.razon_social || `Cliente ${c.id}`,
      })));
      setPuestos(pArr.map((p: any) => ({ id: p.id, nombre: p.nombre, cliente_id: p.cliente_id })));
      setZonas(zs.zonas || []);
    } catch { /* opcional */ }
  }

  useEffect(() => { cargarCatalogos(); }, []);
  useEffect(() => { cargar(); }, [fSupervisor, fDesde, fHasta, fEstado]);

  async function eliminar(id: number) {
    if (!confirm("¿Eliminar esta programación?")) return;
    try {
      await api(`/supervision-programaciones/${id}`, { method: "DELETE" });
      await cargar();
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
  }

  async function cambiarEstado(id: number, estado: ProgEstado) {
    try {
      await api(`/supervision-programaciones/${id}`, {
        method: "PUT",
        body: JSON.stringify({ estado }),
      });
      await cargar();
    } catch (err: any) {
      alert(err.message || "Error al actualizar");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end p-3 bg-[#0b1424] border border-white/10 rounded">
        <FiltroSelect label="Supervisor" value={fSupervisor} onChange={setFSupervisor}
          options={[{ v: "", t: "Todos" }, ...supervisores.map(s => ({ v: s.id, t: s.nombre_completo }))]} minW={180} />
        <FiltroFecha label="Desde" value={fDesde} onChange={setFDesde} />
        <FiltroFecha label="Hasta" value={fHasta} onChange={setFHasta} />
        <FiltroSelect label="Estado" value={fEstado} onChange={setFEstado}
          options={[{ v: "", t: "Todos" }, ...(Object.keys(ESTADO_LABEL) as ProgEstado[]).map(e => ({ v: e, t: ESTADO_LABEL[e] }))]} />
        <div className="ml-auto">
          <button onClick={() => setShowForm(true)}
            className="px-3 py-1.5 bg-primary text-black text-xs font-bold rounded inline-flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Nueva visita programada
          </button>
        </div>
      </div>

      {error && <div role="alert" className="text-rose-300 text-sm p-3 border border-rose-500/30 rounded bg-rose-500/10">{error}</div>}
      {loading && <div className="text-white/50 text-sm p-4">Cargando…</div>}

      {!loading && items.length === 0 && (
        <div className="text-white/40 text-sm p-6 border border-white/10 rounded text-center">
          No hay visitas programadas en el rango seleccionado.
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-white/5 text-white/60">
              <tr>
                <th className="px-2 py-1.5 text-left">Fecha</th>
                <th className="px-2 py-1.5 text-left">Hora</th>
                <th className="px-2 py-1.5 text-left">Supervisor</th>
                <th className="px-2 py-1.5 text-left">Destino</th>
                <th className="px-2 py-1.5 text-left">Tipo</th>
                <th className="px-2 py-1.5 text-left">Prio.</th>
                <th className="px-2 py-1.5 text-left">Estado</th>
                <th className="px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(p => (
                <tr key={p.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-2 py-1.5 text-white whitespace-nowrap">{p.fecha_planificada}</td>
                  <td className="px-2 py-1.5 text-white/70 whitespace-nowrap">
                    {p.ventana_inicio || "—"}{p.ventana_fin ? `–${p.ventana_fin}` : ""}
                  </td>
                  <td className="px-2 py-1.5 text-white">{p.supervisor_nombre}</td>
                  <td className="px-2 py-1.5 text-white/70">
                    {[p.cliente_nombre, p.puesto_nombre, p.zona_nombre].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-2 py-1.5 text-white/70">{TIPO_LABEL[p.tipo]}</td>
                  <td className="px-2 py-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] border ${PRIORIDAD_COLOR[p.prioridad]}`}>
                      {PRIORIDAD_LABEL[p.prioridad]}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <select aria-label="Estado" value={p.estado}
                      onChange={e => cambiarEstado(p.id, e.target.value as ProgEstado)}
                      className={`bg-transparent text-[10px] border rounded px-1 py-0.5 ${ESTADO_COLOR[p.estado]}`}>
                      {(Object.keys(ESTADO_LABEL) as ProgEstado[]).map(e => (
                        <option key={e} value={e} className="bg-[#0b1424] text-white">{ESTADO_LABEL[e]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button aria-label="Eliminar" onClick={() => eliminar(p.id)}
                      className="text-rose-400 hover:text-rose-300 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <FormProgramacion
          supervisores={supervisores}
          clientes={clientes}
          puestos={puestos}
          zonas={zonas}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); cargar(); }}
        />
      )}
    </div>
  );
}

function FiltroFecha({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] text-white/40 mb-1">{label}</label>
      <input type="date" value={value} onChange={e => onChange(e.target.value)}
        className="bg-[#060e1c] border border-white/10 rounded px-2 py-1 text-xs text-white" />
    </div>
  );
}

function FiltroSelect({ label, value, onChange, options, minW }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { v: string | number; t: string }[]; minW?: number;
}) {
  return (
    <div>
      <label className="block text-[10px] text-white/40 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={minW ? { minWidth: minW } : undefined}
        className="bg-[#060e1c] border border-white/10 rounded px-2 py-1 text-xs text-white">
        {options.map(o => <option key={String(o.v)} value={o.v}>{o.t}</option>)}
      </select>
    </div>
  );
}
