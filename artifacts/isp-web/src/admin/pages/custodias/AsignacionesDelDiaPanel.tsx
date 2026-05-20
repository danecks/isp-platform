import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, Save, Check, RefreshCw, Truck } from "lucide-react";
import { getSessionToken } from "@/lib/httpClient";
import { useToast } from "@/hooks/use-toast";
import { useAsignacionesRutaDia, useGuardarRuta, type AsignacionRuta } from "./use-rutas-custodia";

// CUST-FASE3 — vista "Asignaciones del día": tabla editable inline por
// (cliente, fecha) para llenar muchas rutas a la vez. Cada fila es un agente
// asignado ese día con sus campos editables y un botón "Guardar" por fila.

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const headers = () => ({ "Content-Type": "application/json", "x-isp-session": getSessionToken() });

interface ClienteCustodia { id: number; nombre: string }

function todayLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset() - 360);
  return d.toISOString().split("T")[0];
}

export default function AsignacionesDelDiaPanel() {
  const [fecha, setFecha] = useState(todayLocal());
  const [clienteId, setClienteId] = useState<number | null>(null);

  const clientes = useQuery<ClienteCustodia[]>({
    queryKey: ["custodias-clientes-disponibles"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/custodias/dashboard?fecha=${todayLocal()}`, {
        credentials: "include", headers: headers(),
      });
      if (!r.ok) throw new Error("Error al cargar clientes");
      const data: any[] = await r.json();
      return data.map(c => ({ id: c.clienteId, nombre: c.clienteNombre }));
    },
  });

  useEffect(() => {
    if (clienteId === null && (clientes.data?.length ?? 0) > 0) {
      setClienteId(clientes.data![0].id);
    }
  }, [clientes.data, clienteId]);

  const asignaciones = useAsignacionesRutaDia(clienteId, fecha);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 border-b border-white/8 pb-3">
        <div>
          <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">Cliente</label>
          <select value={clienteId ?? ""} onChange={e => setClienteId(e.target.value ? Number(e.target.value) : null)}
            className="bg-[#060e1c] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-primary/40 min-w-[220px]">
            <option value="">— Selecciona cliente —</option>
            {clientes.data?.map(c => (<option key={c.id} value={c.id}>{c.nombre}</option>))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-white/30 uppercase tracking-widest block mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="bg-[#060e1c] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-primary/40" />
        </div>
        <button onClick={() => asignaciones.refetch()} disabled={asignaciones.isFetching || !clienteId}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 border border-white/8 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40">
          <RefreshCw className={`w-3 h-3 ${asignaciones.isFetching ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>

      {!clienteId && (
        <div className="text-center py-12 text-white/30 text-sm">Seleccioná un cliente para ver sus agentes del día.</div>
      )}

      {clienteId && asignaciones.isLoading && (
        <div className="flex items-center justify-center py-12 gap-2 text-white/30">
          <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-sm">Cargando asignaciones…</span>
        </div>
      )}

      {clienteId && !asignaciones.isLoading && (asignaciones.data?.length ?? 0) === 0 && (
        <div className="text-center py-12 text-white/30">
          <Truck className="w-8 h-8 text-white/10 mx-auto mb-2" />
          <p className="text-sm">No hay agentes asignados a este cliente en la fecha seleccionada.</p>
          <p className="text-xs text-white/20 mt-1">Asigná agentes primero desde el pizarrón o desde "Operativo".</p>
        </div>
      )}

      {clienteId && (asignaciones.data?.length ?? 0) > 0 && (
        <div className="bg-[#0c1829] border border-white/6 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[200px_minmax(220px,1fr)_90px_90px_minmax(180px,1fr)_90px] gap-2 px-3 py-2 text-[10px] text-white/30 uppercase tracking-widest border-b border-white/5">
            <div>Agente</div><div>Ruta</div><div>Salida</div><div>Regreso</div><div>Observaciones</div><div></div>
          </div>
          {asignaciones.data!.map(a => (
            <FilaAsignacion key={a.id} clienteId={clienteId} fecha={fecha} asignacion={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilaAsignacion({ clienteId, fecha, asignacion }: {
  clienteId: number; fecha: string; asignacion: AsignacionRuta;
}) {
  const { toast } = useToast();
  const [ruta, setRuta] = useState(asignacion.ruta_texto ?? "");
  const [hs, setHs] = useState(asignacion.hora_salida ?? "");
  const [hr, setHr] = useState(asignacion.hora_regreso ?? "");
  const [obs, setObs] = useState(asignacion.observaciones ?? "");
  const [saved, setSaved] = useState(false);

  // Resetear si cambia el snapshot del servidor (refetch).
  useEffect(() => {
    setRuta(asignacion.ruta_texto ?? "");
    setHs(asignacion.hora_salida ?? "");
    setHr(asignacion.hora_regreso ?? "");
    setObs(asignacion.observaciones ?? "");
  }, [asignacion.id, asignacion.ruta_texto, asignacion.hora_salida, asignacion.hora_regreso, asignacion.observaciones]);

  const dirty = useMemo(() => (
    ruta !== (asignacion.ruta_texto ?? "") ||
    hs !== (asignacion.hora_salida ?? "") ||
    hr !== (asignacion.hora_regreso ?? "") ||
    obs !== (asignacion.observaciones ?? "")
  ), [ruta, hs, hr, obs, asignacion]);

  const guardar = useGuardarRuta(clienteId);

  const onSave = async () => {
    try {
      await guardar.mutateAsync({
        fecha,
        employeeId: asignacion.employee_id,
        rutaTexto: ruta.trim() || null,
        horaSalida: hs || null,
        horaRegreso: hr || null,
        observaciones: obs.trim() || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err?.message ?? "Error", variant: "destructive" });
    }
  };

  return (
    <div className="grid grid-cols-[200px_minmax(220px,1fr)_90px_90px_minmax(180px,1fr)_90px] gap-2 px-3 py-2 border-b border-white/3 hover:bg-white/2 items-center">
      <div className="min-w-0">
        <p className="text-xs text-white/80 font-medium truncate">{asignacion.nombre_completo}</p>
        <p className="text-[10px] text-white/30 truncate">
          {asignacion.empl_numero || "—"} · Custodio {asignacion.slot_numero}
        </p>
      </div>
      <input type="text" value={ruta} onChange={e => setRuta(e.target.value)} maxLength={500}
        placeholder="Ruta del día…"
        className="bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none focus:border-primary/40 min-w-0" />
      <input type="time" value={hs} onChange={e => setHs(e.target.value)}
        className="bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none focus:border-primary/40" />
      <input type="time" value={hr} onChange={e => setHr(e.target.value)}
        className="bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none focus:border-primary/40" />
      <input type="text" value={obs} onChange={e => setObs(e.target.value)} maxLength={1000}
        placeholder="Observaciones…"
        className="bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none focus:border-primary/40 min-w-0" />
      <button onClick={onSave} disabled={!dirty || guardar.isPending}
        className={`text-[11px] px-2 py-1.5 rounded-lg border flex items-center justify-center gap-1 transition-colors ${
          saved ? "bg-green-500/15 border-green-500/30 text-green-300"
            : dirty ? "bg-primary/15 border-primary/30 text-primary hover:bg-primary/25"
              : "border-white/10 text-white/30"
        } disabled:opacity-50`}>
        {guardar.isPending ? <Loader2 className="w-3 h-3 animate-spin" />
          : saved ? <><Check className="w-3 h-3" /> Listo</>
          : <><Save className="w-3 h-3" /> Guardar</>}
      </button>
      {asignacion.registrado_por && !dirty && !saved && (
        <p className="col-span-6 text-[9px] text-white/25 -mt-1 pl-[208px] flex items-center gap-1">
          <MapPin className="w-2.5 h-2.5" /> Último: {asignacion.registrado_por}
          {asignacion.registrado_at ? ` · ${new Date(asignacion.registrado_at).toLocaleString("es-GT")}` : ""}
        </p>
      )}
    </div>
  );
}
