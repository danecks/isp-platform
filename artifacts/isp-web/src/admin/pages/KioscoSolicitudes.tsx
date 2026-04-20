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
  GraduationCap, Briefcase, AlertCircle, Tablet, UserPlus, ExternalLink,
  PhoneCall, MonitorSmartphone, Trash2, Printer, Pencil, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useDeleteMode } from "@/contexts/DeleteModeContext";

const API = "/api";
const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";

function SecureFoto({ fotoUrl, className }: { fotoUrl: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(fotoUrl.startsWith("data:") ? fotoUrl : null);
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

type Canal = "kiosco" | "externo" | "whatsapp" | "referido";

const CANAL_LABEL: Record<Canal, string> = {
  kiosco: "Kiosco", externo: "Externo", whatsapp: "WhatsApp", referido: "Referido",
};
const CANAL_COLOR: Record<Canal, string> = {
  kiosco:   "bg-blue-500/20 text-blue-300 border-blue-700",
  externo:  "bg-amber-500/20 text-amber-300 border-amber-700",
  whatsapp: "bg-green-500/20 text-green-300 border-green-700",
  referido: "bg-purple-500/20 text-purple-300 border-purple-700",
};

const TIPOS_PERSONAL = [
  { value: "guardia",        label: "Guardia de Seguridad" },
  { value: "supervisor",     label: "Supervisor" },
  { value: "administrativo", label: "Administrativo" },
  { value: "motorista",      label: "Motorista / Conductor" },
  { value: "recepcionista",  label: "Recepcionista" },
  { value: "tecnico",        label: "Técnico" },
];

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
  canal: Canal;
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
  const { active: deleteModeActive, requestDelete } = useDeleteMode();
  const qc = useQueryClient();
  const [filtroEstado, setFiltroEstado] = useState<Estado | "todos">("todos");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionada, setSeleccionada] = useState<number | null>(null);
  const [notas, setNotas] = useState("");
  const [actualizando, setActualizando] = useState(false);
  const [contratando, setContratando] = useState(false);
  const [empleadoCreadoId, setEmpleadoCreadoId] = useState<number | null>(null);
  const [mostrarFormContratar, setMostrarFormContratar] = useState(false);
  const [asignacion, setAsignacion] = useState({ puesto: "", tipo_personal: "guardia", sueldo_base: "" });
  const [editando, setEditando] = useState(false);
  const [editado, setEditado] = useState<Partial<SolicitudDetalle>>({});
  const [guardando, setGuardando] = useState(false);

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

  const crearFichaEmpleado = async (id: number) => {
    setContratando(true);
    try {
      const body = {
        puesto_asignado:  asignacion.puesto.trim() || undefined,
        tipo_personal:    asignacion.tipo_personal || "guardia",
        sueldo_base:      asignacion.sueldo_base ? parseFloat(asignacion.sueldo_base) : undefined,
      };
      const r = await fetch(`${API}/solicitudes-empleo/${id}/contratar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error al contratar");
      setEmpleadoCreadoId(data.employee_id);
      setMostrarFormContratar(false);
      qc.invalidateQueries({ queryKey: ["kiosco-solicitudes"] });
      qc.invalidateQueries({ queryKey: ["kiosco-solicitud-detalle", id] });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al crear ficha");
    } finally {
      setContratando(false);
    }
  };

  useEffect(() => {
    setEmpleadoCreadoId(null);
    setMostrarFormContratar(false);
    setAsignacion({ puesto: "", tipo_personal: "guardia", sueldo_base: "" });
    setEditando(false);
    setEditado({});
  }, [seleccionada]);

  const iniciarEdicion = () => {
    if (!detalle) return;
    setEditado({ ...detalle });
    setEditando(true);
  };

  const cancelarEdicion = () => {
    setEditando(false);
    setEditado({});
  };

  const guardarEdicion = async () => {
    if (!detalle) return;
    if (!editado.direccion || !String(editado.direccion).trim()) {
      alert("La dirección es obligatoria.");
      return;
    }
    if (!editado.nombre_completo || !String(editado.nombre_completo).trim()) {
      alert("El nombre completo es obligatorio.");
      return;
    }
    setGuardando(true);
    try {
      const r = await fetch(`${API}/solicitudes-empleo/${detalle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editado, revisado_por: currentUser?.name || "Admin" }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || "Error al guardar");
      }
      qc.invalidateQueries({ queryKey: ["kiosco-solicitudes"] });
      qc.invalidateQueries({ queryKey: ["kiosco-solicitud-detalle", detalle.id] });
      setEditando(false);
      setEditado({});
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al guardar cambios");
    } finally {
      setGuardando(false);
    }
  };

  const setCampo = <K extends keyof SolicitudDetalle>(campo: K, valor: SolicitudDetalle[K]) => {
    setEditado(prev => ({ ...prev, [campo]: valor }));
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
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border w-fit ${ESTADO_COLOR[s.estado]}`}>
                          {ESTADO_LABEL[s.estado]}
                        </span>
                        {s.canal && s.canal !== "kiosco" && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border w-fit ${CANAL_COLOR[s.canal] || CANAL_COLOR.externo}`}>
                            {CANAL_LABEL[s.canal] ?? s.canal}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(s.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline"
                          onClick={() => { setSeleccionada(s.id); setNotas(""); }}
                          className="border-gray-600 text-gray-300 hover:bg-gray-700 text-xs">
                          <Eye size={14} className="mr-1" /> Ver
                        </Button>
                        {deleteModeActive && (
                          <button
                            title="Solicitar eliminación"
                            onClick={() => requestDelete({
                              entidad: "solicitud_empleo",
                              entidad_id: s.id,
                              entidad_descripcion: `SOL-${String(s.id).padStart(5, "0")} — ${s.nombre_completo}`,
                            })}
                            className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${ESTADO_COLOR[detalle.estado]}`}>
                        {ESTADO_LABEL[detalle.estado]}
                      </span>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${CANAL_COLOR[detalle.canal] ?? CANAL_COLOR.externo}`}>
                        {detalle.canal === "kiosco" ? <MonitorSmartphone size={11} /> : <PhoneCall size={11} />}
                        {CANAL_LABEL[detalle.canal] ?? detalle.canal}
                      </span>
                      <span className="text-gray-500 text-xs">SOL-{String(detalle.id).padStart(5, "0")} — {fmtDateTime(detalle.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!editando ? (
                    <>
                      <button
                        onClick={iniciarEdicion}
                        title="Corregir o completar los datos enviados desde el kiosko"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Pencil size={14} /> Editar datos
                      </button>
                      <a
                        href={`/admin/rrhh/kiosco-solicitudes/${detalle.id}/imprimir`}
                        title="Abrir vista de impresión (use Imprimir → Guardar como PDF)"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Printer size={14} /> Descargar formulario
                      </a>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={cancelarEdicion}
                        disabled={guardando}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-600 text-gray-300 hover:bg-gray-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={guardarEdicion}
                        disabled={guardando}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        <Save size={14} /> {guardando ? "Guardando..." : "Guardar cambios"}
                      </button>
                    </>
                  )}
                  <button onClick={() => setSeleccionada(null)} className="text-gray-400 hover:text-white transition-colors">
                    <X size={22} />
                  </button>
                </div>
              </div>

              {/* Contenido */}
              <div className="p-5 space-y-6">

                {/* Alerta canal externo */}
                {detalle.canal && detalle.canal !== "kiosco" && (
                  <div className="flex items-start gap-3 bg-amber-950/30 border border-amber-700/60 rounded-xl px-4 py-3">
                    <PhoneCall size={18} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-amber-300 text-sm font-semibold">Solicitud externa — requiere contacto</p>
                      <p className="text-amber-400/70 text-xs mt-0.5">
                        Esta solicitud llegó por canal <strong>{CANAL_LABEL[detalle.canal] ?? detalle.canal}</strong>. El candidato no se ha presentado físicamente — coordina una llamada para citarlo a entrevista.
                      </p>
                      {detalle.telefono && (
                        <a href={`tel:${detalle.telefono}`} className="inline-flex items-center gap-1 mt-1.5 text-amber-300 text-xs font-medium hover:underline">
                          <Phone size={12} /> {detalle.telefono}
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Banner de modo edición */}
                {editando && (
                  <div className="flex items-start gap-3 bg-amber-950/40 border border-amber-700 rounded-xl px-4 py-3">
                    <Pencil size={18} className="text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-amber-300 text-sm font-semibold">Modo edición — segunda verificación</p>
                      <p className="text-amber-400/70 text-xs mt-0.5">
                        Corrija o complete los datos enviados por el candidato. Los campos en amarillo se pueden modificar. <strong className="text-amber-300">La dirección y el nombre completo son obligatorios.</strong>
                      </p>
                    </div>
                  </div>
                )}

                {/* Datos personales */}
                <Section titulo="Datos Personales" icono={<Users size={16} />}>
                  <Grid2>
                    <EField label="Nombre completo" span2 required editando={editando}
                      display={detalle.nombre_completo}
                      value={editado.nombre_completo} onChange={v => setCampo("nombre_completo", v as string)} />
                    <EField label="DPI" editando={editando}
                      display={detalle.dpi}
                      value={editado.dpi} onChange={v => setCampo("dpi", v as string)} placeholder="13 dígitos" />
                    <EField label="Fecha de nacimiento" tipo="date" editando={editando}
                      display={detalle.fecha_nacimiento ? fmtDate(detalle.fecha_nacimiento) : null}
                      value={editado.fecha_nacimiento} onChange={v => setCampo("fecha_nacimiento", v as string | null)} />
                    <EField label="Género" tipo="genero" editando={editando}
                      display={detalle.genero}
                      value={editado.genero} onChange={v => setCampo("genero", v as string)} />
                    <EField label="Estado civil" tipo="estado_civil" editando={editando}
                      display={detalle.estado_civil}
                      value={editado.estado_civil} onChange={v => setCampo("estado_civil", v as string)} />
                    <EField label="Teléfono" editando={editando}
                      display={detalle.telefono}
                      value={editado.telefono} onChange={v => setCampo("telefono", v as string)} />
                    <EField label="Correo" editando={editando}
                      display={detalle.correo}
                      value={editado.correo} onChange={v => setCampo("correo", v as string)} />
                    <EField label="Contacto emergencia" editando={editando}
                      display={detalle.nombre_contacto_emergencia}
                      value={editado.nombre_contacto_emergencia} onChange={v => setCampo("nombre_contacto_emergencia", v as string)} />
                    <EField label="Tel. emergencia" editando={editando}
                      display={detalle.telefono_emergencia}
                      value={editado.telefono_emergencia} onChange={v => setCampo("telefono_emergencia", v as string)} />
                  </Grid2>
                </Section>

                {/* Dirección y familia */}
                <Section titulo="Dirección y Familia" icono={<MapPin size={16} />}>
                  <Grid2>
                    <EField label="Dirección" tipo="textarea" span2 required editando={editando}
                      display={detalle.direccion}
                      value={editado.direccion} onChange={v => setCampo("direccion", v as string)}
                      placeholder="Calle, número, zona, colonia o aldea — obligatorio" />
                    <EField label="Municipio" editando={editando}
                      display={detalle.municipio}
                      value={editado.municipio} onChange={v => setCampo("municipio", v as string | null)} />
                    <EField label="Departamento" editando={editando}
                      display={detalle.departamento}
                      value={editado.departamento} onChange={v => setCampo("departamento", v as string | null)} />
                    <EField label="Nombre del padre" editando={editando}
                      display={detalle.nombre_padre}
                      value={editado.nombre_padre} onChange={v => setCampo("nombre_padre", v as string)} />
                    <EField label="Nombre de la madre" editando={editando}
                      display={detalle.nombre_madre}
                      value={editado.nombre_madre} onChange={v => setCampo("nombre_madre", v as string)} />
                    <EField label="Dependientes" tipo="number" editando={editando}
                      display={String(detalle.num_dependientes)}
                      value={editado.num_dependientes} onChange={v => setCampo("num_dependientes", (v as number) || 0)} />
                    <EField label="Familiar en ISP" tipo="bool" editando={editando}
                      display={detalle.familiar_en_empresa ? `Sí — ${detalle.nombre_familiar_empresa || ""}` : "No"}
                      value={editado.familiar_en_empresa} onChange={v => setCampo("familiar_en_empresa", v as boolean)} />
                    {(editando || editado.familiar_en_empresa || detalle.familiar_en_empresa) && (
                      <EField label="Nombre del familiar en ISP" editando={editando}
                        display={detalle.nombre_familiar_empresa}
                        value={editado.nombre_familiar_empresa} onChange={v => setCampo("nombre_familiar_empresa", v as string)} />
                    )}
                  </Grid2>
                </Section>

                {/* Educación y experiencia */}
                <Section titulo="Educación y Experiencia" icono={<GraduationCap size={16} />}>
                  <Grid2>
                    <EField label="Grado de estudios" editando={editando}
                      display={detalle.grado_estudios}
                      value={editado.grado_estudios} onChange={v => setCampo("grado_estudios", v as string)} />
                    <EField label="Experiencia en seguridad" tipo="bool" editando={editando}
                      display={detalle.experiencia_seguridad ? `Sí — ${detalle.anios_experiencia} año(s)` : "No"}
                      value={editado.experiencia_seguridad} onChange={v => setCampo("experiencia_seguridad", v as boolean)} />
                    {(editando || editado.experiencia_seguridad || detalle.experiencia_seguridad) && (
                      <>
                        <EField label="Años de experiencia" tipo="number" editando={editando}
                          display={String(detalle.anios_experiencia || 0)}
                          value={editado.anios_experiencia} onChange={v => setCampo("anios_experiencia", (v as number) || 0)} />
                        <EField label="Empresa anterior" span2 editando={editando}
                          display={detalle.empresa_anterior}
                          value={editado.empresa_anterior} onChange={v => setCampo("empresa_anterior", v as string)} />
                      </>
                    )}
                    <EField label="Licencia de armas" tipo="bool" editando={editando}
                      display={detalle.licencia_armas ? "Sí" : "No"}
                      value={editado.licencia_armas} onChange={v => setCampo("licencia_armas", v as boolean)} />
                    <EField label="Vehículo propio" tipo="bool" editando={editando}
                      display={detalle.tiene_vehiculo ? "Sí" : "No"}
                      value={editado.tiene_vehiculo} onChange={v => setCampo("tiene_vehiculo", v as boolean)} />
                  </Grid2>
                </Section>

                {/* Puesto */}
                <Section titulo="Puesto Solicitado" icono={<Briefcase size={16} />}>
                  <Grid2>
                    <EField label="Puesto" editando={editando}
                      display={detalle.puesto_solicitado}
                      value={editado.puesto_solicitado} onChange={v => setCampo("puesto_solicitado", v as string)} />
                    <EField label="Disponibilidad" editando={editando}
                      display={detalle.disponibilidad_horario}
                      value={editado.disponibilidad_horario} onChange={v => setCampo("disponibilidad_horario", v as string)} />
                    <EField label="Disponible fuera de ciudad" tipo="bool" editando={editando}
                      display={detalle.disponible_exterior ? "Sí" : "No"}
                      value={editado.disponible_exterior} onChange={v => setCampo("disponible_exterior", v as boolean)} />
                    <EField label="Pretensión salarial (Q)" tipo="number" editando={editando}
                      display={detalle.pretension_salarial ? `Q ${parseFloat(detalle.pretension_salarial).toLocaleString("es-GT")}` : null}
                      value={editado.pretension_salarial} onChange={v => setCampo("pretension_salarial", v as string | null)} />
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

                {/* Acciones de estado */}
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

                {/* Sección Contratar */}
                <div className="border border-emerald-800/60 rounded-xl p-4 bg-emerald-950/20">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase mb-3">
                    <UserPlus size={14} /> Contratar Candidato
                  </div>

                  {(detalle.employee_id || empleadoCreadoId) ? (
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                      <div>
                        <p className="text-emerald-300 text-sm font-medium">Ficha de empleado creada exitosamente</p>
                        <p className="text-gray-400 text-xs">EMP-{String(detalle.employee_id ?? empleadoCreadoId).padStart(5, "0")} — {detalle.nombre_completo}</p>
                      </div>
                      <a
                        href={`/admin/empleados?id=${detalle.employee_id ?? empleadoCreadoId}`}
                        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        <ExternalLink size={13} /> Ver Ficha
                      </a>
                    </div>
                  ) : !mostrarFormContratar ? (
                    <div className="flex items-center gap-3">
                      <p className="text-gray-400 text-sm flex-1">
                        Al contratar se creará una ficha de colaborador. Podrá asignar el puesto, tipo de personal y salario antes de confirmar.
                      </p>
                      <button
                        disabled={detalle.estado === "rechazada"}
                        onClick={() => {
                          setAsignacion({
                            puesto: detalle.puesto_solicitado || "",
                            tipo_personal: "guardia",
                            sueldo_base: detalle.pretension_salarial || "",
                          });
                          setMostrarFormContratar(true);
                        }}
                        className="shrink-0 flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
                      >
                        <UserPlus size={16} /> Contratar
                      </button>
                    </div>
                  ) : (
                    /* Formulario de asignación */
                    <div className="space-y-3">
                      <p className="text-gray-300 text-xs font-medium uppercase tracking-wide">Confirmar datos de contratación</p>
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">Puesto a asignar</label>
                          <input
                            value={asignacion.puesto}
                            onChange={e => setAsignacion(a => ({ ...a, puesto: e.target.value }))}
                            placeholder={detalle.puesto_solicitado || "Ej: Guardia de Seguridad"}
                            className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-gray-400 text-xs mb-1 block">Tipo de personal</label>
                            <select
                              value={asignacion.tipo_personal}
                              onChange={e => setAsignacion(a => ({ ...a, tipo_personal: e.target.value }))}
                              className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                              {TIPOS_PERSONAL.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-gray-400 text-xs mb-1 block">Salario a asignar (Q)</label>
                            <input
                              type="number"
                              value={asignacion.sueldo_base}
                              onChange={e => setAsignacion(a => ({ ...a, sueldo_base: e.target.value }))}
                              placeholder={detalle.pretension_salarial || "0.00"}
                              className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setMostrarFormContratar(false)}
                          className="flex-1 px-3 py-2 border border-gray-600 text-gray-300 hover:bg-gray-700 rounded-lg text-sm transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          disabled={contratando}
                          onClick={() => crearFichaEmpleado(detalle.id)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
                        >
                          <UserPlus size={15} />
                          {contratando ? "Creando ficha..." : "Confirmar y Crear Ficha"}
                        </button>
                      </div>
                    </div>
                  )}
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

type EFieldTipo = "text" | "textarea" | "date" | "number" | "bool" | "genero" | "estado_civil";

interface EFieldProps {
  label: string;
  display: string | null | undefined;          // valor formateado para mostrar (read-only)
  editando: boolean;
  value: unknown;                                // valor crudo del campo (para edición)
  onChange: (v: unknown) => void;
  tipo?: EFieldTipo;
  span2?: boolean;
  required?: boolean;
  placeholder?: string;
}

function EField({ label, display, editando, value, onChange, tipo = "text", span2, required, placeholder }: EFieldProps) {
  const wrap = span2 ? "col-span-2" : "";
  if (!editando) {
    return (
      <div className={wrap}>
        <div className="text-gray-500 text-xs mb-0.5">
          {label}{required && <span className="text-red-400 ml-1">*</span>}
        </div>
        <div className="text-gray-200 text-sm">{display || <span className="text-gray-600 italic">—</span>}</div>
      </div>
    );
  }
  const inputCls = "w-full bg-gray-800 border border-amber-600/40 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500";
  const v = value == null ? "" : String(value);
  return (
    <div className={wrap}>
      <div className="text-amber-400 text-xs mb-0.5 font-medium">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </div>
      {tipo === "textarea" && (
        <textarea
          value={v}
          rows={2}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          className={inputCls + " resize-none"}
        />
      )}
      {tipo === "text" && (
        <input
          type="text"
          value={v}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          className={inputCls}
        />
      )}
      {tipo === "number" && (
        <input
          type="number"
          value={v}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className={inputCls}
        />
      )}
      {tipo === "date" && (
        <input
          type="date"
          value={v ? v.slice(0, 10) : ""}
          onChange={e => onChange(e.target.value || null)}
          className={inputCls}
        />
      )}
      {tipo === "bool" && (
        <select
          value={value === true || value === "true" ? "si" : "no"}
          onChange={e => onChange(e.target.value === "si")}
          className={inputCls}
        >
          <option value="no">No</option>
          <option value="si">Sí</option>
        </select>
      )}
      {tipo === "genero" && (
        <select value={v} onChange={e => onChange(e.target.value)} className={inputCls}>
          <option value="">— sin especificar —</option>
          <option value="Masculino">Masculino</option>
          <option value="Femenino">Femenino</option>
        </select>
      )}
      {tipo === "estado_civil" && (
        <select value={v} onChange={e => onChange(e.target.value)} className={inputCls}>
          <option value="">— sin especificar —</option>
          <option value="Soltero/a">Soltero/a</option>
          <option value="Casado/a">Casado/a</option>
          <option value="Unido/a">Unido/a</option>
          <option value="Divorciado/a">Divorciado/a</option>
          <option value="Viudo/a">Viudo/a</option>
        </select>
      )}
    </div>
  );
}
