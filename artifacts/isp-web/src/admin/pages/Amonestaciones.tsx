import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import {
  AlertTriangle, DollarSign, FileText, Plus, Search,
  Inbox, RefreshCw, Send,
} from "lucide-react";
import { api, fmtFecha, fmtQ, getRol } from "./amonestaciones/helpers";
import type { Amonestacion } from "./amonestaciones/types";
import { EstadoBadge, StatBox, TipoBadge } from "./amonestaciones/badges";
import { NuevaAmonestacionModal } from "./amonestaciones/NuevaAmonestacionModal";
import { DetalleAmonestacionModal } from "./amonestaciones/DetalleAmonestacionModal";
import { BandejaSolicitudesCreacion } from "./amonestaciones/BandejaSolicitudesCreacion";
import { BandejaSolicitudes } from "./amonestaciones/BandejaSolicitudes";

export default function Amonestaciones() {
  const rol = getRol();
  const esRRHH = rol === "rrhh" || rol === "admin";
  const esSupervisor = rol === "supervisor" || rol === "operaciones";
  const [tab, setTab] = useState<"listado" | "bandeja" | "solicitudes_creacion">("listado");
  const [showNueva, setShowNueva] = useState(false);
  const [detalleId, setDetalleId] = useState<number | null>(null);

  // Filtros
  const [fEstado, setFEstado] = useState<string>("");
  const [fTipo, setFTipo] = useState<string>("");
  const [fAutorRol, setFAutorRol] = useState<string>("");
  const [fBuscar, setFBuscar] = useState<string>("");

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (fEstado) p.set("estado", fEstado);
    if (fTipo) p.set("tipo", fTipo);
    if (fAutorRol) p.set("rol_autor", fAutorRol);
    return p.toString();
  }, [fEstado, fTipo, fAutorRol]);

  const lista = useQuery({
    queryKey: ["amonestaciones", qs],
    queryFn: () => api<Amonestacion[]>(`/amonestaciones${qs ? "?" + qs : ""}`),
  });

  const filtradas = useMemo(() => {
    if (!lista.data) return [];
    const q = fBuscar.trim().toLowerCase();
    if (!q) return lista.data;
    return lista.data.filter(a =>
      a.empleado_nombre?.toLowerCase().includes(q) ||
      a.motivo?.toLowerCase().includes(q) ||
      a.creado_por_username?.toLowerCase().includes(q)
    );
  }, [lista.data, fBuscar]);

  const stats = useMemo(() => {
    const lst = lista.data || [];
    return {
      total: lst.length,
      activas: lst.filter(a => a.estado === "activa").length,
      economicas: lst.filter(a => a.tipo === "economica" && a.estado === "activa").length,
      pendientesPlanilla: lst.filter(a => a.tipo === "economica" && a.estado === "activa" && !a.descontado).length,
      montoPendiente: lst
        .filter(a => a.tipo === "economica" && a.estado === "activa" && !a.descontado)
        .reduce((s, a) => s + (a.monto || 0), 0),
    };
  }, [lista.data]);

  return (
    <AdminLayout title="Amonestaciones">
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setTab("listado")}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                tab === "listado"
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-200"
                  : "bg-white/5 border-white/10 text-white/60 hover:text-white"
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" /> Listado
            </button>
            {esRRHH && (
              <button
                onClick={() => setTab("bandeja")}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                  tab === "bandeja"
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-200"
                    : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                }`}
              >
                <Inbox className="w-4 h-4 inline mr-2" /> Solicitudes de modificación
              </button>
            )}
            <button
              onClick={() => setTab("solicitudes_creacion")}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                tab === "solicitudes_creacion"
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-200"
                  : "bg-white/5 border-white/10 text-white/60 hover:text-white"
              }`}
            >
              <Send className="w-4 h-4 inline mr-2" />
              {esRRHH ? "Solicitudes de creación" : "Mis solicitudes a RRHH"}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => lista.refetch()}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-white/70"
              title="Refrescar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowNueva(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-sm flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {esRRHH ? "Levantar amonestación" : "Enviar solicitud a RRHH"}
            </button>
          </div>
        </div>

        {tab === "listado" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatBox label="Total" value={stats.total} icon={<FileText className="w-4 h-4" />} color="text-white" />
              <StatBox label="Activas" value={stats.activas} icon={<AlertTriangle className="w-4 h-4" />} color="text-amber-300" />
              <StatBox label="Pendientes en planilla" value={stats.pendientesPlanilla} icon={<DollarSign className="w-4 h-4" />} color="text-orange-300" />
              <StatBox label="Monto pendiente descuento" value={fmtQ(stats.montoPendiente)} icon={<DollarSign className="w-4 h-4" />} color="text-emerald-300" />
            </div>

            {/* Filtros */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-wrap gap-2 items-center">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="Buscar por agente, motivo o quién la levantó…"
                  value={fBuscar}
                  onChange={e => setFBuscar(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/30"
                />
              </div>
              <select value={fEstado} onChange={e => setFEstado(e.target.value)}
                className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                <option value="">Todos los estados</option>
                <option value="activa">Activa</option>
                <option value="anulada">Anulada</option>
              </select>
              <select value={fTipo} onChange={e => setFTipo(e.target.value)}
                className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                <option value="">Todos los tipos</option>
                <option value="llamada_atencion">Llamada de atención</option>
                <option value="economica">Económica</option>
                <option value="acta_administrativa">Acta administrativa</option>
              </select>
              <select value={fAutorRol} onChange={e => setFAutorRol(e.target.value)}
                className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
                <option value="">Cualquier autor</option>
                <option value="rrhh">RRHH</option>
                <option value="operaciones">Operaciones</option>
                <option value="supervisor">Supervisor</option>
              </select>
            </div>

            {/* Tabla */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              {lista.isLoading ? (
                <div className="p-8 text-center text-white/40 text-sm">Cargando…</div>
              ) : filtradas.length === 0 ? (
                <div className="p-8 text-center text-white/40 text-sm">No hay amonestaciones</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-black/30 text-white/50 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-3 py-2">Fecha</th>
                      <th className="text-left px-3 py-2">Colaborador</th>
                      <th className="text-left px-3 py-2">Tipo</th>
                      <th className="text-left px-3 py-2">Motivo</th>
                      <th className="text-right px-3 py-2">Monto</th>
                      <th className="text-left px-3 py-2">Levantada por</th>
                      <th className="text-left px-3 py-2">Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map(a => (
                      <tr key={a.id} className="border-t border-white/5 hover:bg-white/5 cursor-pointer"
                          onClick={() => setDetalleId(a.id)}>
                        <td className="px-3 py-2 text-white/70 whitespace-nowrap">{fmtFecha(a.fecha)}</td>
                        <td className="px-3 py-2 text-white">{a.empleado_nombre}</td>
                        <td className="px-3 py-2">
                          <TipoBadge tipo={a.tipo} actaNumero={a.acta_numero} />
                        </td>
                        <td className="px-3 py-2 text-white/80">{a.motivo}</td>
                        <td className="px-3 py-2 text-right text-white tabular-nums">
                          {a.tipo === "economica" ? fmtQ(a.monto) : "—"}
                        </td>
                        <td className="px-3 py-2 text-white/60 text-xs">
                          <div>{a.creado_por_username || "—"}</div>
                          <div className="text-white/30">{a.creado_por_rol}</div>
                        </td>
                        <td className="px-3 py-2">
                          <EstadoBadge a={a} />
                        </td>
                        <td className="px-3 py-2 text-white/30">›</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {tab === "bandeja" && esRRHH && <BandejaSolicitudes onAbrirAmon={(id) => setDetalleId(id)} />}
        {tab === "solicitudes_creacion" && (
          <BandejaSolicitudesCreacion
            esRRHH={esRRHH}
            onAbrirAmon={(id) => setDetalleId(id)}
            onActualizada={() => lista.refetch()}
          />
        )}
      </div>

      {showNueva && (
        <NuevaAmonestacionModal
          esRRHH={esRRHH}
          esSupervisor={esSupervisor}
          onClose={() => setShowNueva(false)}
          onCreada={() => { setShowNueva(false); lista.refetch(); }}
        />
      )}
      {detalleId !== null && (
        <DetalleAmonestacionModal
          id={detalleId}
          esRRHH={esRRHH}
          onClose={() => setDetalleId(null)}
          onActualizada={() => lista.refetch()}
        />
      )}
    </AdminLayout>
  );
}
