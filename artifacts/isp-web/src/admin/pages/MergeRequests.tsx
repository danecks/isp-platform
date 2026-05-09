/**
 * MergeRequests.tsx
 * Panel de RRHH para revisar solicitudes de reingreso.
 * Cuando alguien llena el kiosco con un DPI que ya existe en la base de datos,
 * el sistema crea un "merge request" para que RRHH verifique si es la misma persona.
 * Ruta: /admin/rrhh/reingresos
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import {
  GitMerge, CheckCircle2, XCircle, AlertTriangle, Clock,
  User, Calendar, Phone, MapPin, Briefcase, RefreshCw, Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getSessionToken } from "@/lib/httpClient";

const API = "/api";
const getSession = () => getSessionToken();

type MergeEstado = "pendiente" | "aprobado" | "rechazado" | "dpi_erroneo";

interface MergeRequest {
  id: number;
  estado: MergeEstado;
  created_at: string;
  revisado_por: string | null;
  revisado_at: string | null;
  notas: string | null;
  solicitud_id: number;
  sol_nombre: string;
  sol_dpi: string;
  sol_foto: string | null;
  sol_telefono: string | null;
  sol_municipio: string | null;
  sol_departamento: string | null;
  sol_created_at: string;
  employee_id: number;
  emp_nombre: string;
  emp_dpi: string;
  emp_foto: string | null;
  emp_puesto: string | null;
  emp_estado: string | null;
  emp_fecha_ingreso: string | null;
}

const ESTADO_CONFIG: Record<MergeEstado, { label: string; color: string; icon: React.ReactNode }> = {
  pendiente:   { label: "Pendiente",    color: "bg-amber-500/20 text-amber-300 border-amber-700",  icon: <Clock size={13} /> },
  aprobado:    { label: "Aprobado",     color: "bg-green-500/20 text-green-300 border-green-700",  icon: <CheckCircle2 size={13} /> },
  rechazado:   { label: "Rechazado",    color: "bg-red-500/20 text-red-300 border-red-700",        icon: <XCircle size={13} /> },
  dpi_erroneo: { label: "DPI Incorrecto", color: "bg-orange-500/20 text-orange-300 border-orange-700", icon: <AlertTriangle size={13} /> },
};

function FotoMini({ url, nombre }: { url: string | null; nombre: string }) {
  if (!url) return (
    <div className="w-14 h-14 rounded-xl bg-[#1e3a6e] flex items-center justify-center shrink-0">
      <Camera size={18} className="text-blue-400" />
    </div>
  );
  if (url.startsWith("data:")) return (
    <img src={url} alt={nombre} className="w-14 h-14 rounded-xl object-cover shrink-0" />
  );
  return (
    <div className="w-14 h-14 rounded-xl bg-[#1e3a6e] flex items-center justify-center shrink-0">
      <Camera size={18} className="text-blue-400" />
    </div>
  );
}

function EstadoBadge({ estado }: { estado: MergeEstado }) {
  const cfg = ESTADO_CONFIG[estado] ?? ESTADO_CONFIG.pendiente;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}

export default function MergeRequests() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<"pendiente" | "todos" | "aprobado" | "rechazado" | "dpi_erroneo">("pendiente");
  const [seleccionado, setSeleccionado] = useState<MergeRequest | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [notas, setNotas] = useState("");

  const { data = [], isLoading, refetch } = useQuery<MergeRequest[]>({
    queryKey: ["merge-requests", filtro],
    queryFn: async () => {
      const r = await fetch(`${API}/solicitudes-empleo/merge-requests?estado=${filtro}`, {
        headers: { "x-isp-session": getSession() },
      });
      if (!r.ok) throw new Error("Error cargando merge requests");
      return r.json();
    },
  });

  const accion = async (tipo: "aprobar" | "rechazar", motivo?: string) => {
    if (!seleccionado) return;
    setProcesando(true);
    try {
      await fetch(`${API}/solicitudes-empleo/merge-requests/${seleccionado.id}/${tipo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({ revisado_por: user?.username || "RRHH", notas, motivo }),
      });
      qc.invalidateQueries({ queryKey: ["merge-requests"] });
      setSeleccionado(null);
      setNotas("");
      refetch();
    } finally {
      setProcesando(false);
    }
  };

  const pendientes = (data as MergeRequest[]).filter(m => m.estado === "pendiente").length;

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Encabezado */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-700 flex items-center justify-center">
              <GitMerge size={20} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-white text-xl font-bold">Reingresos — Verificación de Identidad</h1>
              <p className="text-[#64748b] text-sm">
                Agentes que ya trabajaron con ISP y volvieron a aplicar
                {pendientes > 0 && <span className="ml-2 text-amber-400 font-bold">· {pendientes} pendiente{pendientes !== 1 ? "s" : ""}</span>}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}
            className="border-[#1e3a6e] text-[#64748b] hover:text-white">
            <RefreshCw size={14} className="mr-1" /> Actualizar
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-5">
          {(["pendiente", "todos", "aprobado", "dpi_erroneo"] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                filtro === f
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-[#0a1628] border-[#1e3a6e] text-[#64748b] hover:text-white"
              }`}>
              {f === "todos" ? "Todos" : ESTADO_CONFIG[f as MergeEstado]?.label ?? f}
            </button>
          ))}
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="text-center py-16 text-[#64748b]">Cargando...</div>
        ) : data.length === 0 ? (
          <div className="text-center py-16 text-[#64748b]">
            <GitMerge size={40} className="mx-auto mb-3 opacity-30" />
            <p>{filtro === "pendiente" ? "No hay reingresos pendientes de verificación" : "Sin resultados"}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {data.map((mr: MergeRequest) => (
              <button key={mr.id} onClick={() => { setSeleccionado(mr); setNotas(""); }}
                className={`w-full text-left rounded-2xl border p-4 transition-all hover:border-blue-500 ${
                  seleccionado?.id === mr.id
                    ? "border-blue-500 bg-[#0f2a5e]"
                    : "border-[#1e3a6e] bg-[#0a1628]"
                }`}>
                <div className="flex items-center gap-4">
                  {/* Fotos */}
                  <div className="flex items-center gap-1 shrink-0">
                    <FotoMini url={mr.sol_foto} nombre={mr.sol_nombre} />
                    <div className="text-[#3b82f6] font-bold text-xs px-1">↔</div>
                    <FotoMini url={mr.emp_foto} nombre={mr.emp_nombre} />
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-bold text-sm">{mr.sol_nombre}</span>
                      <span className="text-[#64748b] text-xs">DPI: {mr.sol_dpi}</span>
                      <EstadoBadge estado={mr.estado as MergeEstado} />
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-[#64748b] flex-wrap">
                      <span>Solicitud #{mr.solicitud_id} · {fmt(mr.sol_created_at)}</span>
                      <span className="text-amber-400">Ficha existente: {mr.emp_nombre} · {mr.emp_puesto || "Sin puesto"}</span>
                    </div>
                  </div>
                  {mr.estado === "pendiente" && (
                    <div className="shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block animate-pulse" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Panel de detalle + acción */}
        {seleccionado && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSeleccionado(null)}>
            <div className="bg-[#0d2147] border border-[#1e3a6e] rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="bg-[#091a3d] px-6 py-4 flex items-center justify-between rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <GitMerge size={18} className="text-amber-400" />
                  <span className="text-white font-bold">Verificar reingreso — Merge #{seleccionado.id}</span>
                </div>
                <button onClick={() => setSeleccionado(null)} className="text-[#64748b] hover:text-white">✕</button>
              </div>

              <div className="p-6 flex flex-col gap-5">
                {/* Comparación lado a lado */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Solicitud nueva */}
                  <div className="bg-[#071630] border border-blue-900 rounded-xl p-4">
                    <div className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3">Nueva Solicitud</div>
                    <div className="flex items-center gap-3 mb-3">
                      <FotoMini url={seleccionado.sol_foto} nombre={seleccionado.sol_nombre} />
                      <div>
                        <div className="text-white font-bold text-sm">{seleccionado.sol_nombre}</div>
                        <div className="text-[#64748b] text-xs">#{seleccionado.solicitud_id}</div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 text-xs">
                      <div className="flex items-center gap-2 text-[#94a3b8]">
                        <User size={11} /> DPI: <span className="text-white font-mono">{seleccionado.sol_dpi}</span>
                      </div>
                      {seleccionado.sol_telefono && (
                        <div className="flex items-center gap-2 text-[#94a3b8]">
                          <Phone size={11} /> {seleccionado.sol_telefono}
                        </div>
                      )}
                      {seleccionado.sol_municipio && (
                        <div className="flex items-center gap-2 text-[#94a3b8]">
                          <MapPin size={11} /> {seleccionado.sol_municipio}, {seleccionado.sol_departamento}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-[#94a3b8]">
                        <Calendar size={11} /> Aplicó: {fmt(seleccionado.sol_created_at)}
                      </div>
                    </div>
                  </div>

                  {/* Ficha existente */}
                  <div className="bg-[#071630] border border-amber-900 rounded-xl p-4">
                    <div className="text-amber-400 text-xs font-bold uppercase tracking-widest mb-3">Ficha Existente</div>
                    <div className="flex items-center gap-3 mb-3">
                      <FotoMini url={seleccionado.emp_foto} nombre={seleccionado.emp_nombre} />
                      <div>
                        <div className="text-white font-bold text-sm">{seleccionado.emp_nombre}</div>
                        <div className="text-[#64748b] text-xs">Empleado #{seleccionado.employee_id}</div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 text-xs">
                      <div className="flex items-center gap-2 text-[#94a3b8]">
                        <User size={11} /> DPI: <span className="text-white font-mono">{seleccionado.emp_dpi}</span>
                      </div>
                      {seleccionado.emp_puesto && (
                        <div className="flex items-center gap-2 text-[#94a3b8]">
                          <Briefcase size={11} /> {seleccionado.emp_puesto}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-[#94a3b8]">
                        <Calendar size={11} /> Ingresó: {fmt(seleccionado.emp_fecha_ingreso)}
                      </div>
                      <div className="flex items-center gap-2 text-[#94a3b8]">
                        Estado: <span className="text-white capitalize">{seleccionado.emp_estado || "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* DPI match visual */}
                <div className={`rounded-xl border p-3 text-center text-sm font-bold ${
                  seleccionado.sol_dpi === seleccionado.emp_dpi
                    ? "bg-green-500/10 border-green-700 text-green-400"
                    : "bg-red-500/10 border-red-700 text-red-400"
                }`}>
                  {seleccionado.sol_dpi === seleccionado.emp_dpi
                    ? "El número de DPI coincide exactamente"
                    : `Los DPI no coinciden: "${seleccionado.sol_dpi}" vs "${seleccionado.emp_dpi}"`
                  }
                </div>

                {seleccionado.estado === "pendiente" ? (
                  <>
                    {/* Notas */}
                    <div>
                      <label className="text-[#64748b] text-xs font-semibold uppercase tracking-wider mb-1.5 block">
                        Notas (opcional)
                      </label>
                      <textarea
                        value={notas}
                        onChange={e => setNotas(e.target.value)}
                        placeholder="Observaciones del revisor..."
                        className="w-full bg-[#071630] border border-[#1e3a6e] rounded-xl px-4 py-3 text-sm text-white placeholder-[#334155] resize-none focus:outline-none focus:border-blue-500"
                        rows={2}
                      />
                    </div>

                    {/* Acciones */}
                    <div className="flex flex-col gap-3">
                      <button onClick={() => accion("aprobar")} disabled={procesando}
                        className="w-full py-4 rounded-xl font-bold text-base bg-green-600 hover:bg-green-500 text-white transition-all disabled:opacity-50">
                        <CheckCircle2 size={16} className="inline mr-2" />
                        Es la misma persona — Vincular fichas
                      </button>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => accion("rechazar", "dpi_erroneo")} disabled={procesando}
                          className="py-3 rounded-xl font-bold text-sm bg-orange-600/30 hover:bg-orange-600/50 text-orange-300 border border-orange-700 transition-all disabled:opacity-50">
                          <AlertTriangle size={14} className="inline mr-1.5" />
                          DPI digitado mal
                        </button>
                        <button onClick={() => accion("rechazar")} disabled={procesando}
                          className="py-3 rounded-xl font-bold text-sm bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-800 transition-all disabled:opacity-50">
                          <XCircle size={14} className="inline mr-1.5" />
                          No es la misma persona
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-[#071630] border border-[#1e3a6e] rounded-xl p-4 text-center">
                    <EstadoBadge estado={seleccionado.estado as MergeEstado} />
                    {seleccionado.revisado_por && (
                      <p className="text-[#64748b] text-xs mt-2">
                        Revisado por {seleccionado.revisado_por} · {fmt(seleccionado.revisado_at)}
                      </p>
                    )}
                    {seleccionado.notas && (
                      <p className="text-[#94a3b8] text-sm mt-2 italic">"{seleccionado.notas}"</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
