/**
 * KioscoSolicitudes.tsx
 * Panel de administración para revisar solicitudes de empleo del kiosco.
 * Ruta: /admin/rrhh/kiosco-solicitudes
 */
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import {
  Users, Search, RefreshCw, ChevronDown, Eye, X, CheckCircle2,
  XCircle, Clock, UserCheck, Camera, FileText, Phone, MapPin,
  GraduationCap, Briefcase, AlertCircle, Tablet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";

const API = "/api";
const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";

function SecureFoto({ fotoUrl, className }: { fotoUrl: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (fotoUrl.startsWith("data:")) {
      setSrc(fotoUrl);
      return;
    }
    let objUrl: string;
    fetch(`${API}/storage${fotoUrl}`, { headers: { "x-isp-session": getSession() } })
      .then(r => r.ok ? r.blob() : null)
      .then(blob => { if (blob) { objUrl = URL.createObjectURL(blob); setSrc(objUrl); } })
      .catch(() => {});
    return () => { if (objUrl) URL.revokeObjectURL(objUrl); };
  }, [fotoUrl]);
  if (!src) return <div className={`${className} bg-[#1e3a6e] flex items-center justify-center`}><Camera size={14} className="text-blue-400" /></div>;
  return <img src={src} alt="Foto" className={className} />;
}

type Estado = "pendiente" | "en_revision" | "entrevista" | "aprobada" | "rechazada" | "contratada";

interface Solicitud {
  id: number;
  nombre_completo: string;
  dpi: string;
  telefono: string;
  puesto_solicitado: string;
  disponibilidad_horario: string;
  grado_estudios: string;
  experiencia_seguridad: boolean;
  foto_url: string | null;
  estado: Estado;
  created_at: string;
  revisado_por: string | null;
  revisado_at: string | null;
  employee_id: number | null;
  municipio: string | null;
  departamento: string | null;
}

interface SolicitudDetalle extends Solicitud {
  fecha_nacimiento: string | null;
  genero: string | null;
  estado_civil: string | null;
  telefono_emergencia: string | null;
  nombre_contacto_emergencia: string | null;
  correo: string | null;
  direccion: string | null;
  nombre_padre: string | null;
  nombre_madre: string | null;
  num_dependientes: number;
  familiar_en_empresa: boolean;
  nombre_familiar_empresa: string | null;
  anios_experiencia: number;
  empresa_anterior: string | null;
  licencia_armas: boolean;
  tiene_vehiculo: boolean;
  disponible_exterior: boolean;
  pretension_salarial: string | null;
  notas_reclutador: string | null;
}

const ESTADOS: (Estado | "todos")[] = ["todos", "pendiente", "en_revision", "entrevista", "aprobada", "rechazada", "contratada"];

const ESTADO_LABEL: Record<Estado | "todos", string> = {
  todos: "Todos", pendiente: "Pendiente", en_revision: "En revisión",
  entrevista: "Entrevista", aprobada: "Aprobada", rechazada: "Rechazada", contratada: "Contratada",
};

const ESTADO_COLOR: Record<Estado, string> = {
  pendiente: "bg-yellow-500/20 text-yellow-300 border-yellow-700",
  en_revision: "bg-blue-500/20 text-blue-300 border-blue-700",
  entrevista: "bg-purple-500/20 text-purple-300 border-purple-700",
  aprobada: "bg-green-500/20 text-green-300 border-green-700",
  rechazada: "bg-red-500/20 text-red-300 border-red-700",
  contratada: "bg-emerald-500/20 text-emerald-300 border-emerald-700",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-GT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function KioscoSolicitudes() {
  const { currentUser } = useAuth();
  const qc = useQueryClient();
  const [filtroEstado, setFiltroEstado] = useState<Estado | "todos">("todos");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionada, setSeleccionada] = useState<number | null>(null);
  const [notas, setNotas] = useState("");
  const [actualizando, setActualizando] = useState(false);

  const { data: solicitudes = [], isLoading, refetch } = useQuery<Solicitud[]>({
    queryKey: ["kiosco-solicitudes", filtroEstado, busqueda],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filtroEstado !== "todos") params.set("estado", filtroEstado);
      if (busqueda.trim()) params.set("q", busqueda.trim());
      const r = await fetch(`${API}/solicitudes-empleo?${params}`);
      if (!r.ok) throw new Error("Error");
      return r.json();
    },
    refetchInterval: 30000,
  });

  const { data: detalle } = useQuery<SolicitudDetalle>({
    queryKey: ["kiosco-solicitud-detalle", seleccionada],
    queryFn: async () => {
      const r = await fetch(`${API}/solicitudes-empleo/${seleccionada}`);
      if (!r.ok) throw new Error("Error");
      return r.json();
    },
    enabled: seleccionada !== null,
  });

  const cambiarEstado = async (id: number, estado: Estado) => {
    setActualizando(true);
    try {
      await fetch(`${API}/solicitudes-empleo/${id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado, notas_reclutador: notas || undefined, revisado_por: currentUser?.name || "Admin" }),
      });
      qc.invalidateQueries({ queryKey: ["kiosco-solicitudes"] });
      qc.invalidateQueries({ queryKey: ["kiosco-solicitud-detalle", id] });
    } finally {
      setActualizando(false);
    }
  };

  const conteoEstados = ESTADOS.reduce((acc, e) => {
    if (e === "todos") acc[e] = solicitudes.length;
    else acc[e] = solicitudes.filter((s) => s.estado === e).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Tablet size={28} className="text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Solicitudes de Empleo — Kiosco</h1>
              <p className="text-gray-400 text-sm">Solicitudes recibidas desde las tablets de recepción</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => refetch()} className="border-gray-600 text-gray-300 hover:bg-gray-800">
            <RefreshCw size={16} className="mr-2" /> Actualizar
          </Button>
        </div>

        {/* Filtros de estado */}
        <div className="flex gap-2 flex-wrap mb-4">
          {ESTADOS.map((e) => (
            <button key={e} onClick={() => setFiltroEstado(e)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                filtroEstado === e
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500"
              }`}>
              {ESTADO_LABEL[e]}
              {conteoEstados[e] > 0 && (
                <span className="ml-1.5 bg-white/20 rounded-full px-1.5 text-xs">{conteoEstados[e]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Búsqueda */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, DPI o puesto..."
            className="pl-9 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
        </div>

        {/* Tabla */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-gray-500">Cargando solicitudes...</div>
          ) : solicitudes.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <Tablet size={40} className="mx-auto mb-3 opacity-30" />
              <p>No hay solicitudes con el filtro seleccionado</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-800 text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Solicitante</th>
                  <th className="px-4 py-3 text-left">DPI</th>
                  <th className="px-4 py-3 text-left">Puesto</th>
                  <th className="px-4 py-3 text-left">Foto</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {solicitudes.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">SOL-{String(s.id).padStart(5, "0")}</td>
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{s.nombre_completo}</div>
                      <div className="text-gray-500 text-xs">{s.municipio}{s.departamento ? `, ${s.departamento}` : ""}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-300 font-mono text-xs">{s.dpi || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="text-gray-200">{s.puesto_solicitado || "—"}</div>
                      {s.disponibilidad_horario && <div className="text-gray-500 text-xs">{s.disponibilidad_horario}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {s.foto_url
                        ? <SecureFoto fotoUrl={s.foto_url} className="w-9 h-9 rounded-full object-cover border-2 border-blue-600" />
                        : <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center"><Camera size={14} className="text-gray-500" /></div>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${ESTADO_COLOR[s.estado]}`}>
                        {ESTADO_LABEL[s.estado]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(s.created_at)}</td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="outline"
                        onClick={() => { setSeleccionada(s.id); setNotas(""); }}
                        className="border-gray-600 text-gray-300 hover:bg-gray-700 text-xs">
                        <Eye size={14} className="mr-1" /> Ver
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Modal de detalle ── */}
        {seleccionada !== null && detalle && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              {/* Header modal */}
              <div className="flex items-center justify-between p-5 border-b border-gray-700 sticky top-0 bg-gray-900 z-10">
                <div className="flex items-center gap-4">
                  {detalle.foto_url
                    ? <SecureFoto fotoUrl={detalle.foto_url} className="w-14 h-14 rounded-full object-cover border-2 border-blue-500" />
                    : <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center"><Camera size={20} className="text-gray-500" /></div>
                  }
                  <div>
                    <h2 className="text-white font-bold text-lg">{detalle.nombre_completo}</h2>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${ESTADO_COLOR[detalle.estado]}`}>
                        {ESTADO_LABEL[detalle.estado]}
                      </span>
                      <span className="text-gray-500 text-xs">SOL-{String(detalle.id).padStart(5, "0")} — {fmtDateTime(detalle.created_at)}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setSeleccionada(null)} className="text-gray-400 hover:text-white transition-colors">
                  <X size={22} />
                </button>
              </div>

              {/* Contenido */}
              <div className="p-5 space-y-6">
                {/* Datos personales */}
                <Section titulo="Datos Personales" icono={<Users size={16} />}>
                  <Grid2>
                    <DatoItem label="DPI" value={detalle.dpi} />
                    <DatoItem label="Fecha de nacimiento" value={detalle.fecha_nacimiento ? fmtDate(detalle.fecha_nacimiento) : null} />
                    <DatoItem label="Género" value={detalle.genero} />
                    <DatoItem label="Estado civil" value={detalle.estado_civil} />
                    <DatoItem label="Teléfono" value={detalle.telefono} />
                    <DatoItem label="Correo" value={detalle.correo} />
                    <DatoItem label="Contacto emergencia" value={detalle.nombre_contacto_emergencia} />
                    <DatoItem label="Tel. emergencia" value={detalle.telefono_emergencia} />
                  </Grid2>
                </Section>

                {/* Dirección y familia */}
                <Section titulo="Dirección y Familia" icono={<MapPin size={16} />}>
                  <Grid2>
                    <DatoItem label="Dirección" value={detalle.direccion} span2 />
                    <DatoItem label="Municipio" value={detalle.municipio} />
                    <DatoItem label="Departamento" value={detalle.departamento} />
                    <DatoItem label="Nombre del padre" value={detalle.nombre_padre} />
                    <DatoItem label="Nombre de la madre" value={detalle.nombre_madre} />
                    <DatoItem label="Dependientes" value={String(detalle.num_dependientes)} />
                    <DatoItem label="Familiar en ISP" value={detalle.familiar_en_empresa ? `Sí — ${detalle.nombre_familiar_empresa || ""}` : "No"} />
                  </Grid2>
                </Section>

                {/* Educación y experiencia */}
                <Section titulo="Educación y Experiencia" icono={<GraduationCap size={16} />}>
                  <Grid2>
                    <DatoItem label="Grado de estudios" value={detalle.grado_estudios} />
                    <DatoItem label="Experiencia en seguridad" value={detalle.experiencia_seguridad ? `Sí — ${detalle.anios_experiencia} año(s)` : "No"} />
                    {detalle.empresa_anterior && <DatoItem label="Empresa anterior" value={detalle.empresa_anterior} span2 />}
                    <DatoItem label="Licencia de armas" value={detalle.licencia_armas ? "Sí" : "No"} />
                    <DatoItem label="Vehículo propio" value={detalle.tiene_vehiculo ? "Sí" : "No"} />
                  </Grid2>
                </Section>

                {/* Puesto */}
                <Section titulo="Puesto Solicitado" icono={<Briefcase size={16} />}>
                  <Grid2>
                    <DatoItem label="Puesto" value={detalle.puesto_solicitado} />
                    <DatoItem label="Disponibilidad" value={detalle.disponibilidad_horario} />
                    <DatoItem label="Disponible fuera de ciudad" value={detalle.disponible_exterior ? "Sí" : "No"} />
                    <DatoItem label="Pretensión salarial" value={detalle.pretension_salarial ? `Q ${parseFloat(detalle.pretension_salarial).toLocaleString("es-GT")}` : null} />
                  </Grid2>
                </Section>

                {/* Notas del reclutador */}
                <Section titulo="Notas del Reclutador" icono={<FileText size={16} />}>
                  {detalle.revisado_por && (
                    <p className="text-gray-500 text-xs mb-2">Última revisión por <span className="text-gray-300">{detalle.revisado_por}</span> — {detalle.revisado_at ? fmtDateTime(detalle.revisado_at) : ""}</p>
                  )}
                  {detalle.notas_reclutador && (
                    <p className="text-gray-300 text-sm bg-gray-800 rounded-lg p-3 mb-3">{detalle.notas_reclutador}</p>
                  )}
                  <textarea
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Agregar notas sobre este candidato..."
                    rows={3}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600"
                  />
                </Section>

                {/* Acciones */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {(["en_revision", "entrevista", "aprobada", "rechazada"] as Estado[]).map((e) => (
                    <button key={e} disabled={actualizando || detalle.estado === e}
                      onClick={() => cambiarEstado(detalle.id, e)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all disabled:opacity-50 ${
                        detalle.estado === e
                          ? `${ESTADO_COLOR[e]} cursor-default`
                          : "border-gray-600 text-gray-300 hover:bg-gray-700"
                      }`}>
                      {ESTADO_LABEL[e]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function Section({ titulo, icono, children }: { titulo: string; icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-gray-400 text-xs uppercase font-semibold mb-3">
        {icono} {titulo}
      </div>
      {children}
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function DatoItem({ label, value, span2 }: { label: string; value: string | null | undefined; span2?: boolean }) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <div className="text-gray-500 text-xs mb-0.5">{label}</div>
      <div className="text-gray-200 text-sm">{value || <span className="text-gray-600 italic">—</span>}</div>
    </div>
  );
}
