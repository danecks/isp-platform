import { useState, useEffect } from "react";
import { Calendar, Loader2, Save, Plus, Trash2, Check, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePlanificacionCliente, useClientesPlanificables, type Excepcion } from "./use-planificacion";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// CUST-FASE1: pantalla "Planificación" — el admin define la fuerza semanal por
// día de cada cliente y carga excepciones puntuales por fecha (mayores o
// menores que la base). No toca el pizarrón operativo.
export default function PlanificacionPanel() {
  const { data: clientes = [], isLoading: loadingClientes } = useClientesPlanificables();
  const [clienteId, setClienteId] = useState<number | null>(null);

  useEffect(() => {
    if (!clienteId && clientes.length > 0) setClienteId(clientes[0].id);
  }, [clientes, clienteId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-[10px] text-white/30 uppercase tracking-widest">Cliente</label>
        <select
          value={clienteId ?? ""}
          onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : null)}
          disabled={loadingClientes}
          className="bg-[#060e1c] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-primary/40 min-w-[260px]"
        >
          {clientes.length === 0 && <option value="">— Sin clientes de custodia —</option>}
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      {clienteId && <ClientePlanificacion clienteId={clienteId} />}

      {!loadingClientes && clientes.length === 0 && (
        <div className="bg-[#0c1829] border border-white/5 rounded-xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-white/10 mx-auto mb-2" />
          <p className="text-xs text-white/40">
            No hay clientes de custodia configurados. Marca un cliente como tipo "Custodia" para planificar su demanda.
          </p>
        </div>
      )}
    </div>
  );
}

function ClientePlanificacion({ clienteId }: { clienteId: number }) {
  const { toast } = useToast();
  const { fuerza, excepciones, saveFuerza, upsertExcepcion, deleteExcepcion } =
    usePlanificacionCliente(clienteId);

  const [fuerzaLocal, setFuerzaLocal] = useState<Record<number, number>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (fuerza.data) {
      setFuerzaLocal(fuerza.data);
      setDirty(false);
    }
  }, [fuerza.data]);

  const onChangeDia = (dia: number, v: number) => {
    setFuerzaLocal((p) => ({ ...p, [dia]: Math.max(0, v || 0) }));
    setDirty(true);
  };

  const handleGuardar = () => {
    saveFuerza.mutate(fuerzaLocal, {
      onSuccess: () => toast({ title: "Demanda semanal guardada" }),
      onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
    });
  };

  if (fuerza.isLoading) {
    return <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#0c1829] border border-white/6 rounded-xl p-5 space-y-3">
        <p className="text-xs font-semibold text-white/60 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" /> Demanda semanal base — agentes por día
        </p>
        <div className="grid grid-cols-7 gap-2">
          {DIAS.map((dia, i) => (
            <div key={i} className="text-center">
              <p className="text-[10px] text-white/30 mb-1">{dia.slice(0, 3)}</p>
              <input
                type="number" min={0} value={fuerzaLocal[i] ?? 0}
                onChange={(e) => onChangeDia(i, parseInt(e.target.value) || 0)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-center text-sm text-white font-bold outline-none focus:border-primary/40"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-white/30">
            Total semanal: <strong className="text-white/60">
              {Object.values(fuerzaLocal).reduce((s, n) => s + (n || 0), 0)}
            </strong> agentes-día
          </p>
          <button
            onClick={handleGuardar}
            disabled={!dirty || saveFuerza.isPending}
            className="flex items-center gap-1.5 text-xs px-4 py-2 bg-primary/15 border border-primary/30 text-primary rounded-lg font-semibold hover:bg-primary/25 transition-colors disabled:opacity-40"
          >
            {saveFuerza.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Guardar base
          </button>
        </div>
        {saveFuerza.isSuccess && !dirty && (
          <p className="text-[10px] text-green-400 flex items-center gap-1"><Check className="w-3 h-3" /> Guardado</p>
        )}
      </div>

      <ExcepcionesEditor
        excepciones={excepciones.data ?? []}
        loading={excepciones.isLoading}
        onUpsert={(p) =>
          upsertExcepcion.mutate(p, {
            onSuccess: () => toast({ title: p.id ? "Excepción actualizada" : "Excepción agregada" }),
            onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
          })
        }
        onDelete={(id) =>
          deleteExcepcion.mutate(id, {
            onSuccess: () => toast({ title: "Excepción eliminada" }),
            onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
          })
        }
        savingId={upsertExcepcion.isPending}
      />
    </div>
  );
}

function ExcepcionesEditor({
  excepciones, loading, onUpsert, onDelete, savingId,
}: {
  excepciones: Excepcion[];
  loading: boolean;
  onUpsert: (p: { id?: number; fecha: string; cantidad: number; motivo?: string }) => void;
  onDelete: (id: number) => void;
  savingId: boolean;
}) {
  const [nFecha, setNFecha] = useState("");
  const [nCant, setNCant] = useState<number>(0);
  const [nMot, setNMot] = useState("");

  const handleAdd = () => {
    if (!nFecha) return;
    onUpsert({ fecha: nFecha, cantidad: nCant, motivo: nMot });
    setNFecha(""); setNCant(0); setNMot("");
  };

  return (
    <div className="bg-[#0c1829] border border-white/6 rounded-xl p-5 space-y-3">
      <p className="text-xs font-semibold text-white/60 flex items-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5" /> Excepciones por fecha (suben o bajan la base)
      </p>

      <div className="grid grid-cols-[160px_120px_1fr_auto] gap-2 items-end">
        <div>
          <p className="text-[10px] text-white/30 mb-1">Fecha</p>
          <input type="date" value={nFecha} onChange={(e) => setNFecha(e.target.value)}
            className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-primary/40" />
        </div>
        <div>
          <p className="text-[10px] text-white/30 mb-1">Cantidad</p>
          <input type="number" min={0} value={nCant}
            onChange={(e) => setNCant(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-center text-xs text-white font-bold outline-none focus:border-primary/40" />
        </div>
        <div>
          <p className="text-[10px] text-white/30 mb-1">Motivo (opcional)</p>
          <input type="text" value={nMot} onChange={(e) => setNMot(e.target.value)} placeholder="ej. evento corporativo, feriado…"
            className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-primary/40 placeholder:text-white/20" />
        </div>
        <button onClick={handleAdd} disabled={!nFecha || savingId}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary/15 border border-primary/30 text-primary rounded-lg font-semibold hover:bg-primary/25 transition-colors disabled:opacity-40">
          <Plus className="w-3 h-3" /> Agregar
        </button>
      </div>

      {loading ? (
        <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-white/30" /></div>
      ) : excepciones.length === 0 ? (
        <p className="text-[11px] text-white/30 text-center py-3">Aún no hay excepciones cargadas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-white/30 border-b border-white/8 uppercase text-[10px]">
                <th className="text-left px-2 py-1.5">Fecha</th>
                <th className="text-left px-2 py-1.5">Día</th>
                <th className="text-center px-2 py-1.5">Cantidad</th>
                <th className="text-left px-2 py-1.5">Motivo</th>
                <th className="text-right px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {excepciones.map((e) => {
                const dow = new Date(e.fecha + "T12:00:00Z").getUTCDay();
                return (
                  <tr key={e.id} className="border-b border-white/4">
                    <td className="px-2 py-1.5 text-white/70">{e.fecha}</td>
                    <td className="px-2 py-1.5 text-white/40">{DIAS[dow]}</td>
                    <td className="px-2 py-1.5 text-center text-white font-bold">{e.cantidad}</td>
                    <td className="px-2 py-1.5 text-white/50">{e.motivo || <span className="text-white/15">—</span>}</td>
                    <td className="px-2 py-1.5 text-right">
                      <button onClick={() => onDelete(e.id)}
                        className="text-red-400/60 hover:text-red-400 transition-colors" title="Borrar excepción">
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
  );
}
