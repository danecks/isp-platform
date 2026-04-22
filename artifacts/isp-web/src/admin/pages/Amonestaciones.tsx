import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import {
  AlertTriangle, DollarSign, FileText, Plus, Search, X,
  Inbox, Check, Ban, MessageSquareWarning, RefreshCw, Calendar,
} from "lucide-react";

const API = "/api";

function getSession() {
  return sessionStorage.getItem("isp_admin_session_v2") || "";
}

function getRol(): string {
  try {
    const raw = getSession();
    if (!raw) return "";
    return JSON.parse(raw).rol || "";
  } catch { return ""; }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "x-isp-session": getSession(),
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

interface Motivo { id: number; nombre: string; monto_sugerido: number }
interface Empleado { id: number; nombreCompleto: string; dpi: string | null; estadoLaboral: string }
interface Amonestacion {
  id: number;
  employee_id: number;
  empleado_nombre: string;
  creado_por_username: string | null;
  creado_por_rol: string;
  tipo: "llamada_atencion" | "economica";
  motivo: string;
  descripcion: string | null;
  monto: number;
  evidencia_url: string | null;
  cliente_nombre: string | null;
  puesto_nombre: string | null;
  fecha: string;
  estado: "activa" | "anulada";
  descontado: boolean;
  planilla_id: number | null;
  anulada_por: string | null;
  anulada_at: string | null;
  created_at: string;
  notas_rrhh?: string | null;
}
interface SolicitudMod {
  id: number;
  amonestacion_id: number;
  solicitada_por_username: string;
  solicitada_por_rol: string;
  cambio_solicitado: string;
  motivo_solicitud: string;
  estado: "pendiente" | "aprobada" | "rechazada";
  respuesta_rrhh: string | null;
  resuelta_por: string | null;
  resuelta_at: string | null;
  created_at: string;
  empleado_nombre: string;
  tipo: string;
  motivo: string;
  monto: number;
  fecha: string;
  amon_estado: string;
  creado_por_username: string;
  creado_por_rol: string;
}

function fmtFecha(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtQ(n?: number | null) {
  return `Q ${(Number(n) || 0).toFixed(2)}`;
}

export default function Amonestaciones() {
  const rol = getRol();
  const esRRHH = rol === "rrhh" || rol === "admin";
  const [tab, setTab] = useState<"listado" | "bandeja">("listado");
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
              <Plus className="w-4 h-4" /> Levantar amonestación
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
                          <TipoBadge tipo={a.tipo} />
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
      </div>

      {showNueva && (
        <NuevaAmonestacionModal
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

// ──────────────────────────────────────────────────────────────────────────────
function StatBox({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3">
      <div className={`flex items-center gap-2 text-xs ${color}`}>{icon}<span className="opacity-70">{label}</span></div>
      <div className={`text-xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function TipoBadge({ tipo }: { tipo: string }) {
  if (tipo === "economica") {
    return <span className="px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30 text-xs font-medium">Económica</span>;
  }
  return <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 text-xs font-medium">Llamada de atención</span>;
}

function EstadoBadge({ a }: { a: Amonestacion }) {
  if (a.estado === "anulada") {
    return <span className="px-2 py-0.5 rounded-full bg-gray-500/15 text-gray-300 border border-gray-500/30 text-xs font-medium">Anulada</span>;
  }
  if (a.descontado) {
    return <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-medium">Descontada</span>;
  }
  if (a.tipo === "economica") {
    return <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-medium">Pend. planilla</span>;
  }
  return <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/20 text-xs font-medium">Activa</span>;
}

// ──────────────────────────────────────────────────────────────────────────────
function NuevaAmonestacionModal({ onClose, onCreada }: { onClose: () => void; onCreada: () => void }) {
  const [empBusq, setEmpBusq] = useState("");
  const [empSel, setEmpSel] = useState<Empleado | null>(null);
  const [tipo, setTipo] = useState<"llamada_atencion" | "economica">("llamada_atencion");
  const [motivoSel, setMotivoSel] = useState<string>("");
  const [motivoLibre, setMotivoLibre] = useState<string>("");
  const [monto, setMonto] = useState<string>("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  const empleados = useQuery({
    queryKey: ["empleados-slim-amon"],
    queryFn: () => api<Empleado[]>("/employees"),
  });
  const motivos = useQuery({
    queryKey: ["amon-motivos"],
    queryFn: () => api<Motivo[]>("/amonestaciones/motivos"),
  });

  const filtrados = useMemo(() => {
    if (!empleados.data) return [];
    const q = empBusq.trim().toLowerCase();
    return empleados.data
      .filter(e => e.estadoLaboral === "activo")
      .filter(e =>
        !q || e.nombreCompleto.toLowerCase().includes(q) || (e.dpi || "").includes(q)
      )
      .slice(0, 8);
  }, [empleados.data, empBusq]);

  const motivoSugMonto = motivos.data?.find(m => m.nombre === motivoSel)?.monto_sugerido || 0;
  useEffect(() => {
    if (tipo === "economica" && motivoSel && motivoSugMonto > 0 && !monto) {
      setMonto(String(motivoSugMonto));
    }
  }, [motivoSel, tipo, motivoSugMonto, monto]);

  const crear = useMutation({
    mutationFn: async () => {
      if (!empSel) throw new Error("Selecciona un colaborador");
      const motivoFinal = motivoSel || motivoLibre.trim();
      if (!motivoFinal) throw new Error("Indica un motivo");
      if (tipo === "economica" && (Number(monto) || 0) <= 0) {
        throw new Error("El monto debe ser mayor a 0 para amonestación económica");
      }
      return api("/amonestaciones", {
        method: "POST",
        body: JSON.stringify({
          employee_id: empSel.id,
          tipo,
          motivo: motivoFinal,
          descripcion: descripcion || null,
          monto: tipo === "economica" ? Number(monto) : 0,
          fecha,
        }),
      });
    },
    onSuccess: onCreada,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" /> Levantar amonestación
          </h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          {/* Colaborador */}
          <div>
            <label className="text-xs text-white/50 font-medium">Colaborador *</label>
            {empSel ? (
              <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2 mt-1">
                <div>
                  <div className="text-white text-sm">{empSel.nombreCompleto}</div>
                  <div className="text-white/40 text-xs">DPI: {empSel.dpi || "—"}</div>
                </div>
                <button onClick={() => setEmpSel(null)} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={empBusq}
                  onChange={e => setEmpBusq(e.target.value)}
                  placeholder="Buscar por nombre o DPI…"
                  className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                />
                {empBusq && (
                  <div className="mt-1 bg-black/40 border border-white/10 rounded-lg max-h-48 overflow-y-auto">
                    {filtrados.length === 0 ? (
                      <div className="p-2 text-white/30 text-xs">Sin resultados</div>
                    ) : filtrados.map(e => (
                      <button key={e.id} onClick={() => { setEmpSel(e); setEmpBusq(""); }}
                        className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/5 border-b border-white/5">
                        <div>{e.nombreCompleto}</div>
                        <div className="text-white/40 text-xs">{e.dpi}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Tipo */}
          <div>
            <label className="text-xs text-white/50 font-medium">Tipo *</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button onClick={() => setTipo("llamada_atencion")}
                className={`p-3 rounded-lg border text-sm text-left transition ${
                  tipo === "llamada_atencion" ? "bg-blue-500/15 border-blue-500/40 text-blue-200" : "bg-white/5 border-white/10 text-white/60"
                }`}>
                <div className="font-semibold">Llamada de atención</div>
                <div className="text-xs opacity-70">Solo registro, sin descuento</div>
              </button>
              <button onClick={() => setTipo("economica")}
                className={`p-3 rounded-lg border text-sm text-left transition ${
                  tipo === "economica" ? "bg-orange-500/15 border-orange-500/40 text-orange-200" : "bg-white/5 border-white/10 text-white/60"
                }`}>
                <div className="font-semibold">Económica</div>
                <div className="text-xs opacity-70">Se descuenta en planilla</div>
              </button>
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="text-xs text-white/50 font-medium">Motivo *</label>
            <select value={motivoSel} onChange={e => setMotivoSel(e.target.value)}
              className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
              <option value="">— Selecciona o escribe abajo —</option>
              {motivos.data?.map(m => (
                <option key={m.id} value={m.nombre}>
                  {m.nombre}{m.monto_sugerido > 0 ? ` (sugerido Q${m.monto_sugerido})` : ""}
                </option>
              ))}
            </select>
            {!motivoSel && (
              <input type="text" value={motivoLibre} onChange={e => setMotivoLibre(e.target.value)}
                placeholder="…o escribe el motivo libre"
                className="w-full mt-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
            )}
          </div>

          {/* Monto (solo económica) */}
          {tipo === "economica" && (
            <div>
              <label className="text-xs text-white/50 font-medium">Monto a descontar (Q) *</label>
              <input type="number" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)}
                className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              <div className="text-xs text-white/30 mt-1">
                Se descontará en la próxima planilla del período donde caiga la fecha.
              </div>
            </div>
          )}

          {/* Descripción */}
          <div>
            <label className="text-xs text-white/50 font-medium">Descripción / contexto</label>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Detalle de lo ocurrido (opcional)"
              className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none" />
          </div>

          {/* Fecha */}
          <div>
            <label className="text-xs text-white/50 font-medium">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-2">
              {error}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-white/10 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-sm">
            Cancelar
          </button>
          <button
            onClick={() => { setError(null); crear.mutate(); }}
            disabled={crear.isPending || !empSel}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-lg text-sm"
          >
            {crear.isPending ? "Guardando…" : "Guardar amonestación"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
function DetalleAmonestacionModal({
  id, esRRHH, onClose, onActualizada,
}: { id: number; esRRHH: boolean; onClose: () => void; onActualizada: () => void }) {
  const detalle = useQuery({
    queryKey: ["amon-detalle", id],
    queryFn: () => api<Amonestacion & { solicitudes_modificacion: SolicitudMod[] }>(`/amonestaciones/${id}`),
  });
  const qc = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [editMonto, setEditMonto] = useState<string>("");
  const [editMotivo, setEditMotivo] = useState<string>("");
  const [editNotas, setEditNotas] = useState<string>("");
  const [showSolicitar, setShowSolicitar] = useState(false);
  const [showAnular, setShowAnular] = useState(false);

  useEffect(() => {
    if (detalle.data) {
      setEditMonto(String(detalle.data.monto || ""));
      setEditMotivo(detalle.data.motivo || "");
      setEditNotas(detalle.data.notas_rrhh || "");
    }
  }, [detalle.data]);

  const guardar = useMutation({
    mutationFn: () => api(`/amonestaciones/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        monto: Number(editMonto) || 0,
        motivo: editMotivo,
        notas_rrhh: editNotas,
      }),
    }),
    onSuccess: () => {
      setEditando(false);
      qc.invalidateQueries({ queryKey: ["amon-detalle", id] });
      onActualizada();
    },
  });

  const anular = useMutation({
    mutationFn: (motivo: string) => api(`/amonestaciones/${id}/anular`, {
      method: "POST",
      body: JSON.stringify({ motivo }),
    }),
    onSuccess: () => {
      setShowAnular(false);
      qc.invalidateQueries({ queryKey: ["amon-detalle", id] });
      onActualizada();
    },
  });

  if (detalle.isLoading || !detalle.data) {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
        <div className="text-white/60">Cargando…</div>
      </div>
    );
  }
  const a = detalle.data;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Amonestación #{a.id}
          </h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <TipoBadge tipo={a.tipo} />
            <EstadoBadge a={a} />
            {a.descontado && a.planilla_id && (
              <span className="text-xs text-emerald-300/70">Descontada en planilla #{a.planilla_id}</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Colaborador" value={a.empleado_nombre} />
            <Info label="Fecha" value={fmtFecha(a.fecha)} />
            <Info label="Levantada por" value={`${a.creado_por_username || "—"} (${a.creado_por_rol})`} />
            <Info label="Cliente / Puesto" value={[a.cliente_nombre, a.puesto_nombre].filter(Boolean).join(" — ") || "—"} />
          </div>

          {editando && esRRHH ? (
            <div className="space-y-3 bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              <div>
                <label className="text-xs text-amber-300 font-medium">Motivo</label>
                <input type="text" value={editMotivo} onChange={e => setEditMotivo(e.target.value)}
                  className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              {a.tipo === "economica" && (
                <div>
                  <label className="text-xs text-amber-300 font-medium">Monto (Q)</label>
                  <input type="number" min="0" step="0.01" value={editMonto} onChange={e => setEditMonto(e.target.value)}
                    className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
              )}
              <div>
                <label className="text-xs text-amber-300 font-medium">Notas internas RRHH</label>
                <textarea value={editNotas} onChange={e => setEditNotas(e.target.value)} rows={2}
                  className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditando(false)} className="px-3 py-1.5 bg-white/5 text-white/70 rounded-lg text-sm">Cancelar</button>
                <button onClick={() => guardar.mutate()} disabled={guardar.isPending}
                  className="px-3 py-1.5 bg-amber-500 text-black font-semibold rounded-lg text-sm">
                  {guardar.isPending ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 bg-white/5 border border-white/10 rounded-lg p-3">
              <div>
                <div className="text-xs text-white/40 uppercase">Motivo</div>
                <div className="text-white">{a.motivo}</div>
              </div>
              {a.tipo === "economica" && (
                <div>
                  <div className="text-xs text-white/40 uppercase">Monto</div>
                  <div className="text-orange-300 font-semibold text-lg">{fmtQ(a.monto)}</div>
                </div>
              )}
              {a.descripcion && (
                <div>
                  <div className="text-xs text-white/40 uppercase">Descripción</div>
                  <div className="text-white/80 text-sm whitespace-pre-wrap">{a.descripcion}</div>
                </div>
              )}
              {a.notas_rrhh && (
                <div>
                  <div className="text-xs text-amber-300/80 uppercase">Notas RRHH</div>
                  <div className="text-white/80 text-sm whitespace-pre-wrap">{a.notas_rrhh}</div>
                </div>
              )}
            </div>
          )}

          {a.estado === "anulada" && (
            <div className="bg-gray-500/10 border border-gray-500/30 rounded-lg p-3 text-sm">
              <div className="text-gray-300 font-medium">Anulada por {a.anulada_por} el {fmtFecha(a.anulada_at)}</div>
            </div>
          )}

          {/* Solicitudes de modificación */}
          {a.solicitudes_modificacion?.length > 0 && (
            <div>
              <div className="text-xs text-white/50 font-medium mb-2 uppercase">Solicitudes de modificación</div>
              <div className="space-y-2">
                {a.solicitudes_modificacion.map(s => (
                  <div key={s.id} className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white/80 font-medium">{s.solicitada_por_username} ({s.solicitada_por_rol})</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        s.estado === "pendiente" ? "bg-amber-500/15 text-amber-300" :
                        s.estado === "aprobada" ? "bg-emerald-500/15 text-emerald-300" :
                        "bg-red-500/15 text-red-300"
                      }`}>{s.estado}</span>
                    </div>
                    <div className="text-white/70 text-xs mt-1"><b>Cambio:</b> {s.cambio_solicitado}</div>
                    <div className="text-white/60 text-xs"><b>Razón:</b> {s.motivo_solicitud}</div>
                    {s.respuesta_rrhh && (
                      <div className="text-emerald-300/80 text-xs mt-1"><b>RRHH:</b> {s.respuesta_rrhh}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 flex justify-end gap-2 flex-wrap">
          {esRRHH && a.estado === "activa" && !editando && (
            <>
              <button onClick={() => setEditando(true)} className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/80 rounded-lg text-sm">
                Editar
              </button>
              <button onClick={() => setShowAnular(true)} className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg text-sm flex items-center gap-1">
                <Ban className="w-4 h-4" /> Anular
              </button>
            </>
          )}
          {!esRRHH && a.estado === "activa" && (
            <button onClick={() => setShowSolicitar(true)} className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-lg text-sm flex items-center gap-1">
              <MessageSquareWarning className="w-4 h-4" /> Solicitar modificación
            </button>
          )}
          <button onClick={onClose} className="px-3 py-2 bg-white/5 text-white/70 rounded-lg text-sm">Cerrar</button>
        </div>
      </div>

      {showAnular && (
        <ConfirmModal
          titulo="Anular amonestación"
          mensaje={a.descontado
            ? "Esta amonestación ya fue descontada en una planilla cerrada. Si la anulas, deberás generar un ajuste manual al colaborador."
            : "Se quitará de la próxima pre-planilla. ¿Confirmas?"}
          requireMotivo
          onCancel={() => setShowAnular(false)}
          onConfirm={(motivo) => anular.mutate(motivo || "")}
          loading={anular.isPending}
        />
      )}
      {showSolicitar && (
        <SolicitarModificacionModal
          amonId={id}
          onClose={() => setShowSolicitar(false)}
          onEnviada={() => { setShowSolicitar(false); detalle.refetch(); }}
        />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-white/40 uppercase">{label}</div>
      <div className="text-white/90">{value}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
function ConfirmModal({
  titulo, mensaje, onCancel, onConfirm, loading, requireMotivo,
}: { titulo: string; mensaje: string; onCancel: () => void; onConfirm: (m: string) => void; loading?: boolean; requireMotivo?: boolean }) {
  const [motivo, setMotivo] = useState("");
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-md p-4">
        <h4 className="text-white font-semibold">{titulo}</h4>
        <p className="text-white/60 text-sm mt-2">{mensaje}</p>
        {requireMotivo && (
          <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
            placeholder="Motivo de la anulación (opcional pero recomendado)"
            className="w-full mt-3 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none" />
        )}
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onCancel} className="px-3 py-2 bg-white/5 text-white/70 rounded-lg text-sm">Cancelar</button>
          <button onClick={() => onConfirm(motivo)} disabled={loading}
            className="px-3 py-2 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-lg text-sm">
            {loading ? "Procesando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SolicitarModificacionModal({
  amonId, onClose, onEnviada,
}: { amonId: number; onClose: () => void; onEnviada: () => void }) {
  const [cambio, setCambio] = useState("");
  const [razon, setRazon] = useState("");
  const [error, setError] = useState<string | null>(null);

  const enviar = useMutation({
    mutationFn: () => {
      if (!cambio.trim() || !razon.trim()) {
        return Promise.reject(new Error("Indica qué cambio quieres y la razón"));
      }
      return api(`/amonestaciones/${amonId}/solicitar-modificacion`, {
        method: "POST",
        body: JSON.stringify({ cambio_solicitado: cambio, motivo_solicitud: razon }),
      });
    },
    onSuccess: onEnviada,
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-md p-4">
        <h4 className="text-white font-semibold flex items-center gap-2">
          <MessageSquareWarning className="w-5 h-5 text-blue-300" /> Solicitar modificación a RRHH
        </h4>
        <p className="text-white/50 text-xs mt-1">Tu solicitud llegará a la bandeja de RRHH para que decidan.</p>
        <div className="space-y-3 mt-3">
          <div>
            <label className="text-xs text-white/50 font-medium">¿Qué cambio quieres? *</label>
            <input type="text" value={cambio} onChange={e => setCambio(e.target.value)}
              placeholder="Ej: Anular, Cambiar monto a Q30, Cambiar motivo"
              className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-white/50 font-medium">Razón *</label>
            <textarea value={razon} onChange={e => setRazon(e.target.value)} rows={3}
              placeholder="Por qué crees que debería modificarse"
              className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none" />
          </div>
          {error && <div className="text-red-400 text-sm">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onClose} className="px-3 py-2 bg-white/5 text-white/70 rounded-lg text-sm">Cancelar</button>
          <button onClick={() => { setError(null); enviar.mutate(); }} disabled={enviar.isPending}
            className="px-3 py-2 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-lg text-sm">
            {enviar.isPending ? "Enviando…" : "Enviar solicitud"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
function BandejaSolicitudes({ onAbrirAmon }: { onAbrirAmon: (id: number) => void }) {
  const [estado, setEstado] = useState<"pendiente" | "todas">("pendiente");
  const sols = useQuery({
    queryKey: ["amon-sols", estado],
    queryFn: () => api<SolicitudMod[]>(`/amonestaciones/solicitudes-modificacion?estado=${estado}`),
  });
  const qc = useQueryClient();
  const [respuesta, setRespuesta] = useState<Record<number, string>>({});

  const resolver = useMutation({
    mutationFn: ({ id, accion, resp }: { id: number; accion: "aprobada" | "rechazada"; resp: string }) =>
      api(`/amonestaciones/solicitudes-modificacion/${id}/resolver`, {
        method: "POST",
        body: JSON.stringify({ accion, respuesta: resp }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amon-sols"] });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button onClick={() => setEstado("pendiente")}
          className={`px-3 py-1.5 rounded-lg text-sm border ${estado === "pendiente" ? "bg-amber-500/20 border-amber-500/40 text-amber-200" : "bg-white/5 border-white/10 text-white/60"}`}>
          Pendientes
        </button>
        <button onClick={() => setEstado("todas")}
          className={`px-3 py-1.5 rounded-lg text-sm border ${estado === "todas" ? "bg-amber-500/20 border-amber-500/40 text-amber-200" : "bg-white/5 border-white/10 text-white/60"}`}>
          Todas
        </button>
      </div>

      {sols.isLoading ? (
        <div className="text-white/40 text-sm">Cargando…</div>
      ) : !sols.data?.length ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-white/40 text-sm">
          No hay solicitudes {estado === "pendiente" ? "pendientes" : ""}
        </div>
      ) : (
        <div className="space-y-3">
          {sols.data.map(s => (
            <div key={s.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-white font-medium">{s.empleado_nombre}</div>
                  <div className="text-xs text-white/40 flex items-center gap-2 mt-0.5">
                    <Calendar className="w-3 h-3" /> {fmtFecha(s.fecha)}
                    <span>•</span>
                    <span className="capitalize">{s.tipo === "economica" ? `Económica ${fmtQ(s.monto)}` : "Llamada de atención"}</span>
                    <span>•</span>
                    <span>"{s.motivo}"</span>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  s.estado === "pendiente" ? "bg-amber-500/15 text-amber-300" :
                  s.estado === "aprobada" ? "bg-emerald-500/15 text-emerald-300" :
                  "bg-red-500/15 text-red-300"
                }`}>{s.estado}</span>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="bg-black/30 rounded-lg p-2">
                  <div className="text-white/40 text-xs">Cambio solicitado</div>
                  <div className="text-white">{s.cambio_solicitado}</div>
                </div>
                <div className="bg-black/30 rounded-lg p-2">
                  <div className="text-white/40 text-xs">Razón</div>
                  <div className="text-white/80">{s.motivo_solicitud}</div>
                </div>
              </div>
              <div className="text-xs text-white/40 mt-2">
                Solicitada por <b>{s.solicitada_por_username}</b> ({s.solicitada_por_rol}) — {fmtFecha(s.created_at)}
              </div>

              {s.estado === "pendiente" && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={respuesta[s.id] || ""}
                    onChange={e => setRespuesta(r => ({ ...r, [s.id]: e.target.value }))}
                    rows={2}
                    placeholder="Respuesta a quien la solicitó (opcional)"
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => onAbrirAmon(s.amonestacion_id)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 rounded-lg text-sm">
                      Abrir amonestación
                    </button>
                    <button onClick={() => resolver.mutate({ id: s.id, accion: "rechazada", resp: respuesta[s.id] || "" })}
                      className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg text-sm flex items-center gap-1">
                      <X className="w-4 h-4" /> Rechazar
                    </button>
                    <button onClick={() => resolver.mutate({ id: s.id, accion: "aprobada", resp: respuesta[s.id] || "" })}
                      className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-sm flex items-center gap-1">
                      <Check className="w-4 h-4" /> Aprobar
                    </button>
                  </div>
                </div>
              )}

              {s.respuesta_rrhh && (
                <div className="mt-2 text-xs text-emerald-300/80">
                  <b>RRHH ({s.resuelta_por}):</b> {s.respuesta_rrhh}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
