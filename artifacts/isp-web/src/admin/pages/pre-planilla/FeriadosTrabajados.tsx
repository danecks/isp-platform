import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Loader2, CalendarHeart, Plus, Trash2, Lock, Save, Users, X, ArrowLeft, ChevronRight,
  ChevronDown, Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, fmtFecha, fmtQ } from "./helpers";
import { TablaVacia } from "./badges";
import type { FeriadosResponse, FeriadoPeriodo, FeriadoColaborador } from "./types";

/**
 * FeriadosTrabajados — pestaña de la pre-planilla para asignar el pago por
 * feriados/asuetos nacionales (y locales) trabajados, por colaborador,
 * agrupado por cliente. Default Q0, editable mientras la quincena esté abierta.
 * El monto suma al bruto como concepto aparte y se congela en el cierre.
 */

const usuarioActual = () => "admin";

/**
 * Columna de la matriz: una por FECHA única (no por feriado). Si dos feriados
 * caen el mismo día, comparten celda/monto (el pago se modela por fecha), así
 * que se colapsan en una sola columna para no duplicar el total mostrado.
 */
type Columna = { fecha: string; nombres: string[]; clientes: (string | null)[] };
// La columna aplica a un cliente si algún feriado de esa fecha es nacional
// (cliente null) o coincide con el cliente.
const columnaAplica = (col: Columna, cliente: string) =>
  col.clientes.some((cn) => cn == null || cn === cliente);

export function FeriadosTrabajados({ desde, hasta }: { desde: string; hasta: string }) {
  const { toast } = useToast();
  const [data, setData] = useState<FeriadosResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [montos, setMontos] = useState<Record<string, string>>({});
  const [clienteSel, setClienteSel] = useState<string | null>(null);
  const [showAgregar, setShowAgregar] = useState(false);
  const [nuevoFecha, setNuevoFecha] = useState(desde);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [clientesDisp, setClientesDisp] = useState<{ id: number; nombre: string }[]>([]);
  const [clientesSel, setClientesSel] = useState<string[]>([]);
  const [clienteQuery, setClienteQuery] = useState("");
  const [showClientes, setShowClientes] = useState(false);

  const cargar = useCallback(() => {
    setLoading(true);
    apiRequest(`/api/nomina/pre-planilla/feriados?desde=${desde}&hasta=${hasta}`)
      .then((d: FeriadosResponse) => {
        setData(d);
        const m: Record<string, string> = {};
        for (const c of d.colaboradores) {
          m[`${c.employee_id}|${c.feriado_fecha}`] = String(Number(c.monto ?? 0));
        }
        setMontos(m);
      })
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [desde, hasta, toast]);

  useEffect(() => { cargar(); }, [cargar]);
  // Volver a la lista de clientes solo al cambiar de quincena, no en cada
  // refresco (p. ej. tras "aplicar a todos" se mantiene el cliente abierto).
  useEffect(() => { setClienteSel(null); }, [desde, hasta]);

  // Catálogo de clientes activos para el selector del feriado local.
  useEffect(() => {
    apiRequest("/api/operaciones/clientes-disponibles")
      .then((d: { id: number; nombre: string }[]) => setClientesDisp(Array.isArray(d) ? d : []))
      .catch(() => { /* el selector queda vacío; el feriado puede ser nacional */ });
  }, []);

  const clientesFiltrados = useMemo(
    () => clientesDisp.filter((c) => c.nombre.toLowerCase().includes(clienteQuery.trim().toLowerCase())),
    [clientesDisp, clienteQuery],
  );
  const toggleCliente = (nombre: string) =>
    setClientesSel((prev) => prev.includes(nombre) ? prev.filter((x) => x !== nombre) : [...prev, nombre]);
  // Limpia todo el estado del formulario de "Agregar feriado local" para que no
  // quede selección previa al reabrirlo (cancelar o tras guardar).
  const cerrarAgregar = () => {
    setShowAgregar(false);
    setNuevoNombre("");
    setClientesSel([]);
    setClienteQuery("");
    setShowClientes(false);
  };

  const cerrado = data?.periodo_cerrado ?? false;

  // Agrupar colaboradores por cliente
  const porCliente = useMemo(() => {
    const map = new Map<string, FeriadoColaborador[]>();
    for (const c of data?.colaboradores ?? []) {
      const k = c.cliente ?? "— Sin cliente asignado —";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  // Columnas de la matriz: una por FECHA única (colapsa feriados del mismo día).
  const columnas = useMemo<Columna[]>(() => {
    const m = new Map<string, Columna>();
    for (const f of data?.feriados ?? []) {
      if (!m.has(f.fecha)) m.set(f.fecha, { fecha: f.fecha, nombres: [], clientes: [] });
      const c = m.get(f.fecha)!;
      if (!c.nombres.includes(f.nombre)) c.nombres.push(f.nombre);
      c.clientes.push(f.cliente_nombre ?? null);
    }
    return Array.from(m.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [data]);

  const key = (empId: number, fecha: string) => `${empId}|${fecha}`;

  const guardarPago = async (empId: number, fecha: string) => {
    const k = key(empId, fecha);
    const monto = Number(montos[k] ?? 0);
    if (!Number.isFinite(monto) || monto < 0) {
      toast({ title: "Monto inválido", variant: "destructive" });
      return;
    }
    setSaving(k);
    try {
      await apiRequest("/api/nomina/pre-planilla/feriados/pago", {
        method: "PUT",
        json: { desde, hasta, employee_id: empId, feriado_fecha: fecha, monto, editadoPor: usuarioActual() },
      });
      toast({ title: "Monto guardado" });
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
      cargar();
    } finally {
      setSaving(null);
    }
  };

  const aplicarCliente = async (cliente: string, fecha: string) => {
    const monto = prompt(`Monto a pagar a TODO el cliente "${cliente}" por el feriado del ${fmtFecha(fecha)}:`, "0");
    if (monto === null) return;
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum < 0) {
      toast({ title: "Monto inválido", variant: "destructive" });
      return;
    }
    setSaving(`bulk|${cliente}|${fecha}`);
    try {
      const r = await apiRequest("/api/nomina/pre-planilla/feriados/pago-bulk", {
        method: "PUT",
        json: {
          desde, hasta, feriado_fecha: fecha, monto: montoNum, editadoPor: usuarioActual(),
          cliente: cliente.startsWith("—") ? null : cliente,
        },
      }) as { aplicados: number };
      toast({ title: `Aplicado a ${r.aplicados} colaborador(es)` });
      cargar();
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const agregarFeriado = async () => {
    if (!nuevoNombre.trim() || !nuevoFecha) {
      toast({ title: "Fecha y nombre son requeridos", variant: "destructive" });
      return;
    }
    if (nuevoFecha < desde || nuevoFecha > hasta) {
      toast({ title: "La fecha debe estar dentro del período", variant: "destructive" });
      return;
    }
    setSaving("nuevo");
    try {
      await apiRequest("/api/nomina/pre-planilla/feriados", {
        method: "POST",
        json: {
          fecha: nuevoFecha, nombre: nuevoNombre.trim(),
          clientes: clientesSel, createdPor: usuarioActual(),
          desde, hasta,
        },
      });
      toast({
        title: clientesSel.length > 0
          ? `Feriado agregado para ${clientesSel.length} cliente(s)`
          : "Feriado agregado (nacional)",
      });
      cerrarAgregar();
      cargar();
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const eliminarFeriado = async (f: FeriadoPeriodo) => {
    if (!confirm(`¿Quitar el feriado "${f.nombre}" (${fmtFecha(f.fecha)}) de este período? No se borran los montos ya asignados.`)) return;
    try {
      await apiRequest(`/api/nomina/pre-planilla/feriados/${f.id}?desde=${desde}&hasta=${hasta}`, { method: "DELETE" });
      toast({ title: "Feriado quitado" });
      cargar();
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const totalPeriodo = useMemo(() => {
    return (data?.colaboradores ?? []).reduce((s, c) => {
      const v = Number(montos[key(c.employee_id, c.feriado_fecha)] ?? c.monto ?? 0);
      return s + (Number.isFinite(v) ? v : 0);
    }, 0);
  }, [data, montos]);

  if (loading) return (
    <div className="flex items-center justify-center gap-2 p-10 text-white/30 text-sm">
      <Loader2 className="w-5 h-5 animate-spin" /> Cargando feriados…
    </div>
  );

  const feriados = data?.feriados ?? [];

  return (
    <div>
      {/* Encabezado / acciones */}
      <div className="px-4 py-3 border-b border-white/6 flex flex-wrap items-center gap-3">
        <CalendarHeart className="w-4 h-4 text-primary" />
        <span className="text-xs text-white/60">{feriados.length} feriado(s) en el período</span>
        <span className="text-xs font-bold text-primary">{fmtQ(totalPeriodo)} total a pagar</span>
        <div className="flex-1" />
        {cerrado ? (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30 text-primary text-[11px] font-semibold">
            <Lock className="w-3 h-3" /> Período cerrado — solo lectura
          </span>
        ) : (
          <button onClick={() => { setNuevoFecha(desde); setShowAgregar(true); }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/15 border border-primary/40 text-primary text-[11px] font-semibold hover:bg-primary/25 transition-colors">
            <Plus className="w-3 h-3" /> Agregar feriado local
          </button>
        )}
      </div>

      {/* Form agregar feriado local */}
      {showAgregar && !cerrado && (
        <div className="px-4 py-3 border-b border-white/6 bg-[#060e1c] flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Fecha</label>
            <input type="date" value={nuevoFecha} min={desde} max={hasta}
              onChange={(e) => setNuevoFecha(e.target.value)}
              className="bg-[#0c1929] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white" />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Nombre</label>
            <input type="text" value={nuevoNombre} placeholder="Ej. Feria patronal"
              onChange={(e) => setNuevoNombre(e.target.value)}
              className="bg-[#0c1929] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white" />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[200px] relative">
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Clientes (vacío = todos)</label>
            <button type="button" onClick={() => setShowClientes((s) => !s)}
              className="bg-[#0c1929] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-left text-white flex items-center justify-between gap-2">
              <span className="truncate">
                {clientesSel.length === 0
                  ? <span className="text-white/30">Todos los clientes (nacional)</span>
                  : `${clientesSel.length} cliente(s) seleccionado(s)`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-white/40 shrink-0" />
            </button>
            {clientesSel.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {clientesSel.map((c) => (
                  <span key={c} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/15 border border-primary/30 text-primary text-[10px]">
                    <span className="truncate max-w-[120px]">{c}</span>
                    <button type="button" onClick={() => toggleCliente(c)} className="hover:text-white">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {showClientes && (
              <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-[#0c1929] border border-white/15 rounded-lg shadow-xl max-h-64 flex flex-col overflow-hidden">
                <input autoFocus type="text" value={clienteQuery} placeholder="Buscar cliente…"
                  onChange={(e) => setClienteQuery(e.target.value)}
                  className="bg-[#060e1c] border-b border-white/10 px-2 py-1.5 text-xs text-white outline-none" />
                <div className="overflow-y-auto">
                  {clientesFiltrados.length === 0 ? (
                    <div className="px-2 py-2 text-[11px] text-white/30">Sin resultados</div>
                  ) : clientesFiltrados.map((c) => {
                    const on = clientesSel.includes(c.nombre);
                    return (
                      <button type="button" key={c.id} onClick={() => toggleCliente(c.nombre)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-white/5">
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${on ? "bg-primary border-primary" : "border-white/25"}`}>
                          {on && <Check className="w-2.5 h-2.5 text-black" />}
                        </span>
                        <span className="truncate text-white/80">{c.nombre}</span>
                      </button>
                    );
                  })}
                </div>
                <button type="button" onClick={() => setShowClientes(false)}
                  className="border-t border-white/10 px-2 py-1.5 text-[11px] text-primary/80 hover:text-primary">
                  Listo
                </button>
              </div>
            )}
          </div>
          <button onClick={agregarFeriado} disabled={saving === "nuevo"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 border border-primary/40 text-primary text-xs font-semibold hover:bg-primary/30 transition-colors disabled:opacity-50">
            {saving === "nuevo" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Agregar
          </button>
          <button onClick={cerrarAgregar}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-xs hover:bg-white/10 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Lista de feriados del período */}
      {feriados.length > 0 && (
        <div className="px-4 py-3 border-b border-white/6 flex flex-wrap gap-2">
          {feriados.map((f) => (
            <span key={f.id}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] ${
                f.tipo === "local"
                  ? "bg-amber-400/10 border-amber-400/25 text-amber-300"
                  : "bg-white/5 border-white/12 text-white/70"
              }`}>
              <span className="font-semibold">{fmtFecha(f.fecha)}</span>
              <span className="text-white/40">·</span>
              <span>{f.nombre}</span>
              {f.tipo === "local" && <span className="text-[9px] uppercase tracking-wider text-amber-400/70">local</span>}
              {f.cliente_nombre && <span className="text-white/40">({f.cliente_nombre})</span>}
              {!cerrado && (
                <button onClick={() => eliminarFeriado(f)} className="ml-1 text-white/30 hover:text-rose-400 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {feriados.length === 0 ? (
        <TablaVacia msg="No hay feriados nacionales ni locales dentro de este período." />
      ) : porCliente.length === 0 ? (
        <TablaVacia msg="Ningún colaborador trabajó un feriado en este período." />
      ) : (() => {
        const sel = clienteSel ? porCliente.find(([c]) => c === clienteSel) : undefined;

        // Vista 1 — lista de clientes. Se muestra una tarjeta por cliente con
        // el número de colaboradores que trabajaron un feriado y el total a
        // pagar de ese cliente. Al pulsarla se abre el detalle.
        if (!sel) {
          return (
            <div className="p-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {porCliente.map(([cliente, cols]) => {
                const nEmp = new Set(cols.map((c) => c.employee_id)).size;
                const totalCli = cols.reduce(
                  (s, c) => s + (Number(montos[key(c.employee_id, c.feriado_fecha)] ?? c.monto ?? 0) || 0),
                  0,
                );
                return (
                  <button key={cliente} onClick={() => setClienteSel(cliente)}
                    className="flex items-center justify-between gap-3 text-left px-4 py-3 rounded-xl bg-white/[0.03] border border-white/8 hover:border-primary/40 hover:bg-primary/5 transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-white font-semibold text-sm truncate">
                        <Users className="w-3.5 h-3.5 text-primary/70 shrink-0" /> {cliente}
                      </div>
                      <div className="text-[11px] text-white/40 mt-0.5">
                        {nEmp} colaborador(es) · <span className="text-primary/80 font-semibold">{fmtQ(totalCli)}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
                  </button>
                );
              })}
            </div>
          );
        }

        // Vista 2 — detalle del cliente seleccionado: solo las personas de ese
        // cliente que trabajaron el feriado, con su monto editable.
        const [cliente, cols] = sel;
        const empleados = Array.from(
          new Map(cols.map((c) => [c.employee_id, c])).values()
        ).sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
        return (
          <div>
            <div className="px-4 py-2.5 border-b border-white/6 flex flex-wrap items-center gap-2">
              <button onClick={() => setClienteSel(null)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60 text-[11px] hover:bg-white/10 transition-colors">
                <ArrowLeft className="w-3 h-3" /> Clientes
              </button>
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary/70" /> {cliente}
              </span>
              <span className="text-[11px] text-white/40">· {empleados.length} colaborador(es) que trabajaron</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-[#060e1c] border-b border-white/6">
                  <tr>
                    <th className="text-left text-[10px] text-white/40 font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap">Colaborador</th>
                    {columnas.map((col) => (
                      <th key={col.fecha} className="text-right text-[10px] text-white/40 font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap"
                        title={col.nombres.join(" / ")}>
                        {fmtFecha(col.fecha)}
                      </th>
                    ))}
                    <th className="text-right text-[10px] text-white/40 font-semibold uppercase tracking-wider px-3 py-2 whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <FilasCliente
                    cliente={cliente}
                    empleados={empleados}
                    cols={cols}
                    columnas={columnas}
                    montos={montos}
                    setMontos={setMontos}
                    saving={saving}
                    cerrado={cerrado}
                    onGuardar={guardarPago}
                    onAplicarCliente={aplicarCliente}
                  />
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function FilasCliente({
  cliente, empleados, cols, columnas, montos, setMontos, saving, cerrado, onGuardar, onAplicarCliente,
}: {
  cliente: string;
  empleados: FeriadoColaborador[];
  cols: FeriadoColaborador[];
  columnas: Columna[];
  montos: Record<string, string>;
  setMontos: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saving: string | null;
  cerrado: boolean;
  onGuardar: (empId: number, fecha: string) => void;
  onAplicarCliente: (cliente: string, fecha: string) => void;
}) {
  const key = (empId: number, fecha: string) => `${empId}|${fecha}`;
  // Conjunto de (emp,fecha) en que el colaborador trabajó ese feriado
  const trabajo = useMemo(() => {
    const s = new Set<string>();
    for (const c of cols) s.add(key(c.employee_id, c.feriado_fecha));
    return s;
  }, [cols]);
  // Una columna (fecha) aplica a este cliente si algún feriado de esa fecha es
  // nacional o coincide con el cliente. Las fechas que solo tienen feriados
  // locales de otro cliente no se pueden pagar aquí (celda inhabilitada).
  const aplica = (col: Columna) => columnaAplica(col, cliente);

  return (
    <>
      <tr className="bg-white/[0.03] border-y border-white/6">
        <td className="px-3 py-1.5 font-semibold text-white/70 text-[11px] uppercase tracking-wide">
          <span className="flex items-center gap-1.5"><Users className="w-3 h-3 text-primary/70" /> {cliente}</span>
        </td>
        {columnas.map((col) => (
          <td key={col.fecha} className="px-3 py-1.5 text-right">
            {!cerrado && aplica(col) && (
              <button onClick={() => onAplicarCliente(cliente, col.fecha)}
                disabled={saving === `bulk|${cliente}|${col.fecha}`}
                className="text-[10px] text-primary/80 hover:text-primary underline decoration-dotted disabled:opacity-50">
                Aplicar a todos
              </button>
            )}
          </td>
        ))}
        <td className="px-3 py-1.5" />
      </tr>
      {empleados.map((emp) => {
        const totalEmp = columnas.reduce((s, col) => {
          if (!aplica(col)) return s;
          const k = key(emp.employee_id, col.fecha);
          return s + (Number(montos[k] ?? 0) || 0);
        }, 0);
        return (
          <tr key={emp.employee_id} className="hover:bg-white/3 transition-colors border-b border-white/4">
            <td className="px-3 py-2 text-white font-medium">{emp.nombre_completo}</td>
            {columnas.map((col) => {
              const k = key(emp.employee_id, col.fecha);
              const trabajoEste = trabajo.has(k);
              if (!aplica(col)) {
                return (
                  <td key={col.fecha} className="px-3 py-2 text-center text-white/20"
                    title="Feriado local de otro cliente — no aplica">—</td>
                );
              }
              return (
                <td key={col.fecha} className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={montos[k] ?? "0"}
                      disabled={cerrado}
                      onChange={(e) => setMontos((prev) => ({ ...prev, [k]: e.target.value }))}
                      className={`w-20 bg-[#0c1929] border rounded-lg px-2 py-1 text-xs text-right text-white disabled:opacity-60 ${
                        trabajoEste ? "border-white/15" : "border-white/5 text-white/40"
                      }`}
                      title={trabajoEste ? "Trabajó este feriado" : "No registró trabajo este feriado"}
                    />
                    {!cerrado && (
                      <button onClick={() => onGuardar(emp.employee_id, col.fecha)}
                        disabled={saving === k}
                        className="text-primary/70 hover:text-primary disabled:opacity-50">
                        {saving === k ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </td>
              );
            })}
            <td className="px-3 py-2 text-right font-bold text-primary">{fmtQ(totalEmp)}</td>
          </tr>
        );
      })}
    </>
  );
}
