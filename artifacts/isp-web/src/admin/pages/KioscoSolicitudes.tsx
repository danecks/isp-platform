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
import { generarContratoLaboral, cargarPatronoDesdeConfig, type DatosContratoLaboral } from "@/lib/pdfRrhh";

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

  // ── Campos extendidos del kiosko ────────────────────────────────────
  // Domicilio
  tipo_vivienda: string | null;
  tiempo_residencia: string | null;
  renta_mensual: string | null;
  // Banco
  banco: string | null;
  tipo_cuenta: string | null;
  num_cuenta: string | null;
  forma_pago: string | null;
  // Licencia
  tiene_licencia: string | null;
  tipo_licencia: string | null;
  vigencia_licencia: string | null;
  // Familia extendida
  tel_padre: string | null;
  tel_madre: string | null;
  nombre_conyuge: string | null;
  ocup_conyuge: string | null;
  tel_conyuge: string | null;
  hermano1_nombre: string | null;
  hermano1_tel: string | null;
  hermano2_nombre: string | null;
  hermano2_tel: string | null;
  facebook: string | null;
  instagram: string | null;
  // Salud
  estatura: string | null;
  peso: string | null;
  enfermedad_cronica: string | null;
  enfermedad_det: string | null;
  medicamento: string | null;
  medicamento_det: string | null;
  impedimento_fisico: string | null;
  impedimento_det: string | null;
  consume_alcohol: string | null;
  consume_drogas: string | null;
  tiene_tatuajes: string | null;
  tatuajes_det: string | null;
  parentesco_emergencia: string | null;
  // Antecedentes y finanzas
  proceso_judicial: string | null;
  proceso_det: string | null;
  detenido: string | null;
  detencion_det: string | null;
  tiene_deudas: string | null;
  estado_deuda: string | null;
  gastos_mensuales: string | null;
  tiene_prestamo: string | null;
  monto_prestamo: string | null;
  // Educación
  prim_escuela: string | null; prim_lugar: string | null; prim_titulo: string | null;
  bas_escuela: string | null;  bas_lugar: string | null;  bas_titulo: string | null;
  div_escuela: string | null;  div_lugar: string | null;  div_titulo: string | null;
  uni_escuela: string | null;  uni_lugar: string | null;  uni_titulo: string | null;
  // Experiencia laboral
  emp1_nombre: string | null; emp1_puesto: string | null; emp1_salario: string | null;
  emp1_inicio: string | null; emp1_fin: string | null;    emp1_motivo: string | null;
  emp2_nombre: string | null; emp2_puesto: string | null; emp2_salario: string | null;
  emp2_inicio: string | null; emp2_fin: string | null;    emp2_motivo: string | null;
  emp3_nombre: string | null; emp3_puesto: string | null; emp3_salario: string | null;
  emp3_inicio: string | null; emp3_fin: string | null;    emp3_motivo: string | null;
  // Seguridad / militar
  servicio_militar: string | null;
  rango_militar: string | null;
  unidad_militar: string | null;
  fue_policia: string | null;
  motivo_baja_policial: string | null;
  habilidades: string | null;
  tipos_seguridad: string | null;
  disp_rotativo: string | null;
  disp_nocturno: string | null;
  disp_fds: string | null;
  // Referencias
  ref1_nombre: string | null; ref1_relacion: string | null; ref1_tel: string | null; ref1_anios: string | null;
  ref2_nombre: string | null; ref2_relacion: string | null; ref2_tel: string | null; ref2_anios: string | null;
  ref3_nombre: string | null; ref3_relacion: string | null; ref3_tel: string | null; ref3_anios: string | null;
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
  const [asignacion, setAsignacion] = useState({
    puesto: "",
    tipo_personal: "guardia",
    sueldo_base: "",
    fecha_alta: new Date().toISOString().slice(0, 10),
  });
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
        fecha_ingreso:    asignacion.fecha_alta || undefined,
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
    setAsignacion({
      puesto: "",
      tipo_personal: "guardia",
      sueldo_base: "",
      fecha_alta: new Date().toISOString().slice(0, 10),
    });
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

                {/* Banco y Cuenta */}
                <Section titulo="Banco y Cuenta" icono={<Briefcase size={16} />}>
                  <Grid2>
                    <EField label="Banco" editando={editando}
                      display={detalle.banco}
                      value={editado.banco} onChange={v => setCampo("banco", v as string)} />
                    <EField label="Tipo de cuenta" editando={editando}
                      display={detalle.tipo_cuenta}
                      value={editado.tipo_cuenta} onChange={v => setCampo("tipo_cuenta", v as string)} />
                    <EField label="Número de cuenta" editando={editando}
                      display={detalle.num_cuenta}
                      value={editado.num_cuenta} onChange={v => setCampo("num_cuenta", v as string)} />
                    <EField label="Forma de pago" tipo="forma_pago" editando={editando}
                      display={detalle.forma_pago === "deposito" ? "Depósito a cuenta" : detalle.forma_pago === "cheque" ? "Cheque" : detalle.forma_pago}
                      value={editado.forma_pago} onChange={v => setCampo("forma_pago", v as string)} />
                  </Grid2>
                </Section>

                {/* Licencia de conducir */}
                <Section titulo="Licencia de Conducir" icono={<FileText size={16} />}>
                  <Grid2>
                    <EField label="¿Tiene licencia?" tipo="yn" editando={editando}
                      display={detalle.tiene_licencia}
                      value={editado.tiene_licencia} onChange={v => setCampo("tiene_licencia", v as string)} />
                    <EField label="Tipo de licencia" editando={editando}
                      display={detalle.tipo_licencia}
                      value={editado.tipo_licencia} onChange={v => setCampo("tipo_licencia", v as string)} />
                    <EField label="Vigencia" span2 editando={editando}
                      display={detalle.vigencia_licencia}
                      value={editado.vigencia_licencia} onChange={v => setCampo("vigencia_licencia", v as string)} />
                  </Grid2>
                </Section>

                {/* Vivienda */}
                <Section titulo="Vivienda" icono={<MapPin size={16} />}>
                  <Grid2>
                    <EField label="Tipo de vivienda" editando={editando}
                      display={detalle.tipo_vivienda}
                      value={editado.tipo_vivienda} onChange={v => setCampo("tipo_vivienda", v as string)} />
                    <EField label="Tiempo de residencia" editando={editando}
                      display={detalle.tiempo_residencia}
                      value={editado.tiempo_residencia} onChange={v => setCampo("tiempo_residencia", v as string)} />
                    <EField label="Renta mensual (Q)" span2 editando={editando}
                      display={detalle.renta_mensual}
                      value={editado.renta_mensual} onChange={v => setCampo("renta_mensual", v as string)} />
                  </Grid2>
                </Section>

                {/* Familia extendida */}
                <Section titulo="Familia y Redes Sociales" icono={<Users size={16} />}>
                  <Grid2>
                    <EField label="Tel. del padre" editando={editando}
                      display={detalle.tel_padre}
                      value={editado.tel_padre} onChange={v => setCampo("tel_padre", v as string)} />
                    <EField label="Tel. de la madre" editando={editando}
                      display={detalle.tel_madre}
                      value={editado.tel_madre} onChange={v => setCampo("tel_madre", v as string)} />
                    <EField label="Cónyuge — nombre" editando={editando}
                      display={detalle.nombre_conyuge}
                      value={editado.nombre_conyuge} onChange={v => setCampo("nombre_conyuge", v as string)} />
                    <EField label="Cónyuge — ocupación" editando={editando}
                      display={detalle.ocup_conyuge}
                      value={editado.ocup_conyuge} onChange={v => setCampo("ocup_conyuge", v as string)} />
                    <EField label="Cónyuge — teléfono" span2 editando={editando}
                      display={detalle.tel_conyuge}
                      value={editado.tel_conyuge} onChange={v => setCampo("tel_conyuge", v as string)} />
                    <EField label="Hermano/a 1 — nombre" editando={editando}
                      display={detalle.hermano1_nombre}
                      value={editado.hermano1_nombre} onChange={v => setCampo("hermano1_nombre", v as string)} />
                    <EField label="Hermano/a 1 — teléfono" editando={editando}
                      display={detalle.hermano1_tel}
                      value={editado.hermano1_tel} onChange={v => setCampo("hermano1_tel", v as string)} />
                    <EField label="Hermano/a 2 — nombre" editando={editando}
                      display={detalle.hermano2_nombre}
                      value={editado.hermano2_nombre} onChange={v => setCampo("hermano2_nombre", v as string)} />
                    <EField label="Hermano/a 2 — teléfono" editando={editando}
                      display={detalle.hermano2_tel}
                      value={editado.hermano2_tel} onChange={v => setCampo("hermano2_tel", v as string)} />
                    <EField label="Facebook" editando={editando}
                      display={detalle.facebook}
                      value={editado.facebook} onChange={v => setCampo("facebook", v as string)} />
                    <EField label="Instagram" editando={editando}
                      display={detalle.instagram}
                      value={editado.instagram} onChange={v => setCampo("instagram", v as string)} />
                    <EField label="Parentesco contacto emergencia" span2 editando={editando}
                      display={detalle.parentesco_emergencia}
                      value={editado.parentesco_emergencia} onChange={v => setCampo("parentesco_emergencia", v as string)} />
                  </Grid2>
                </Section>

                {/* Salud */}
                <Section titulo="Salud" icono={<AlertCircle size={16} />}>
                  <Grid2>
                    <EField label="Estatura" editando={editando}
                      display={detalle.estatura}
                      value={editado.estatura} onChange={v => setCampo("estatura", v as string)} />
                    <EField label="Peso" editando={editando}
                      display={detalle.peso}
                      value={editado.peso} onChange={v => setCampo("peso", v as string)} />
                    <EField label="Enfermedad crónica" tipo="yn" editando={editando}
                      display={detalle.enfermedad_cronica}
                      value={editado.enfermedad_cronica} onChange={v => setCampo("enfermedad_cronica", v as string)} />
                    <EField label="Detalle enfermedad" editando={editando}
                      display={detalle.enfermedad_det}
                      value={editado.enfermedad_det} onChange={v => setCampo("enfermedad_det", v as string)} />
                    <EField label="Toma medicamento" tipo="yn" editando={editando}
                      display={detalle.medicamento}
                      value={editado.medicamento} onChange={v => setCampo("medicamento", v as string)} />
                    <EField label="Detalle medicamento" editando={editando}
                      display={detalle.medicamento_det}
                      value={editado.medicamento_det} onChange={v => setCampo("medicamento_det", v as string)} />
                    <EField label="Impedimento físico" tipo="yn" editando={editando}
                      display={detalle.impedimento_fisico}
                      value={editado.impedimento_fisico} onChange={v => setCampo("impedimento_fisico", v as string)} />
                    <EField label="Detalle impedimento" editando={editando}
                      display={detalle.impedimento_det}
                      value={editado.impedimento_det} onChange={v => setCampo("impedimento_det", v as string)} />
                    <EField label="Consume alcohol" tipo="yn" editando={editando}
                      display={detalle.consume_alcohol}
                      value={editado.consume_alcohol} onChange={v => setCampo("consume_alcohol", v as string)} />
                    <EField label="Consume drogas" tipo="yn" editando={editando}
                      display={detalle.consume_drogas}
                      value={editado.consume_drogas} onChange={v => setCampo("consume_drogas", v as string)} />
                    <EField label="Tiene tatuajes" tipo="yn" editando={editando}
                      display={detalle.tiene_tatuajes}
                      value={editado.tiene_tatuajes} onChange={v => setCampo("tiene_tatuajes", v as string)} />
                    <EField label="Detalle tatuajes" editando={editando}
                      display={detalle.tatuajes_det}
                      value={editado.tatuajes_det} onChange={v => setCampo("tatuajes_det", v as string)} />
                  </Grid2>
                </Section>

                {/* Antecedentes y deudas */}
                <Section titulo="Antecedentes y Finanzas Personales" icono={<AlertCircle size={16} />}>
                  <Grid2>
                    <EField label="Proceso judicial" tipo="yn" editando={editando}
                      display={detalle.proceso_judicial}
                      value={editado.proceso_judicial} onChange={v => setCampo("proceso_judicial", v as string)} />
                    <EField label="Detalle proceso" editando={editando}
                      display={detalle.proceso_det}
                      value={editado.proceso_det} onChange={v => setCampo("proceso_det", v as string)} />
                    <EField label="¿Detenido alguna vez?" tipo="yn" editando={editando}
                      display={detalle.detenido}
                      value={editado.detenido} onChange={v => setCampo("detenido", v as string)} />
                    <EField label="Detalle detención" editando={editando}
                      display={detalle.detencion_det}
                      value={editado.detencion_det} onChange={v => setCampo("detencion_det", v as string)} />
                    <EField label="¿Tiene deudas?" tipo="yn" editando={editando}
                      display={detalle.tiene_deudas}
                      value={editado.tiene_deudas} onChange={v => setCampo("tiene_deudas", v as string)} />
                    <EField label="Estado de la deuda" editando={editando}
                      display={detalle.estado_deuda}
                      value={editado.estado_deuda} onChange={v => setCampo("estado_deuda", v as string)} />
                    <EField label="Gastos mensuales (Q)" editando={editando}
                      display={detalle.gastos_mensuales}
                      value={editado.gastos_mensuales} onChange={v => setCampo("gastos_mensuales", v as string)} />
                    <EField label="¿Tiene préstamo?" tipo="yn" editando={editando}
                      display={detalle.tiene_prestamo}
                      value={editado.tiene_prestamo} onChange={v => setCampo("tiene_prestamo", v as string)} />
                    <EField label="Monto del préstamo (Q)" span2 editando={editando}
                      display={detalle.monto_prestamo}
                      value={editado.monto_prestamo} onChange={v => setCampo("monto_prestamo", v as string)} />
                  </Grid2>
                </Section>

                {/* Educación detallada */}
                <Section titulo="Educación Detallada" icono={<GraduationCap size={16} />}>
                  {([
                    ["Primaria", "prim"],
                    ["Básicos",  "bas"],
                    ["Diversificado", "div"],
                    ["Universitaria", "uni"],
                  ] as const).map(([etiqueta, pre]) => (
                    <div key={pre} className="mb-3">
                      <div className="text-gray-500 text-xs font-semibold uppercase mb-1">{etiqueta}</div>
                      <Grid2>
                        <EField label="Escuela" editando={editando}
                          display={(detalle as any)[`${pre}_escuela`]}
                          value={(editado as any)[`${pre}_escuela`]}
                          onChange={v => setCampo(`${pre}_escuela` as keyof SolicitudDetalle, v as never)} />
                        <EField label="Lugar" editando={editando}
                          display={(detalle as any)[`${pre}_lugar`]}
                          value={(editado as any)[`${pre}_lugar`]}
                          onChange={v => setCampo(`${pre}_lugar` as keyof SolicitudDetalle, v as never)} />
                        <EField label="Título obtenido" span2 editando={editando}
                          display={(detalle as any)[`${pre}_titulo`]}
                          value={(editado as any)[`${pre}_titulo`]}
                          onChange={v => setCampo(`${pre}_titulo` as keyof SolicitudDetalle, v as never)} />
                      </Grid2>
                    </div>
                  ))}
                </Section>

                {/* Experiencia laboral previa */}
                <Section titulo="Experiencia Laboral (últimos 3 empleos)" icono={<Briefcase size={16} />}>
                  {(["emp1", "emp2", "emp3"] as const).map((pre, i) => (
                    <div key={pre} className="mb-3">
                      <div className="text-gray-500 text-xs font-semibold uppercase mb-1">Empleo {i + 1}</div>
                      <Grid2>
                        <EField label="Empresa" editando={editando}
                          display={(detalle as any)[`${pre}_nombre`]}
                          value={(editado as any)[`${pre}_nombre`]}
                          onChange={v => setCampo(`${pre}_nombre` as keyof SolicitudDetalle, v as never)} />
                        <EField label="Puesto" editando={editando}
                          display={(detalle as any)[`${pre}_puesto`]}
                          value={(editado as any)[`${pre}_puesto`]}
                          onChange={v => setCampo(`${pre}_puesto` as keyof SolicitudDetalle, v as never)} />
                        <EField label="Salario" editando={editando}
                          display={(detalle as any)[`${pre}_salario`]}
                          value={(editado as any)[`${pre}_salario`]}
                          onChange={v => setCampo(`${pre}_salario` as keyof SolicitudDetalle, v as never)} />
                        <EField label="Inicio" editando={editando}
                          display={(detalle as any)[`${pre}_inicio`]}
                          value={(editado as any)[`${pre}_inicio`]}
                          onChange={v => setCampo(`${pre}_inicio` as keyof SolicitudDetalle, v as never)} />
                        <EField label="Fin" editando={editando}
                          display={(detalle as any)[`${pre}_fin`]}
                          value={(editado as any)[`${pre}_fin`]}
                          onChange={v => setCampo(`${pre}_fin` as keyof SolicitudDetalle, v as never)} />
                        <EField label="Motivo de retiro" editando={editando}
                          display={(detalle as any)[`${pre}_motivo`]}
                          value={(editado as any)[`${pre}_motivo`]}
                          onChange={v => setCampo(`${pre}_motivo` as keyof SolicitudDetalle, v as never)} />
                      </Grid2>
                    </div>
                  ))}
                </Section>

                {/* Seguridad / militar / disponibilidad */}
                <Section titulo="Servicio Militar y Disponibilidad" icono={<UserCheck size={16} />}>
                  <Grid2>
                    <EField label="Servicio militar" tipo="yn" editando={editando}
                      display={detalle.servicio_militar}
                      value={editado.servicio_militar} onChange={v => setCampo("servicio_militar", v as string)} />
                    <EField label="Rango militar" editando={editando}
                      display={detalle.rango_militar}
                      value={editado.rango_militar} onChange={v => setCampo("rango_militar", v as string)} />
                    <EField label="Unidad militar" span2 editando={editando}
                      display={detalle.unidad_militar}
                      value={editado.unidad_militar} onChange={v => setCampo("unidad_militar", v as string)} />
                    <EField label="¿Fue policía?" tipo="yn" editando={editando}
                      display={detalle.fue_policia}
                      value={editado.fue_policia} onChange={v => setCampo("fue_policia", v as string)} />
                    <EField label="Motivo de baja policial" editando={editando}
                      display={detalle.motivo_baja_policial}
                      value={editado.motivo_baja_policial} onChange={v => setCampo("motivo_baja_policial", v as string)} />
                    <EField label="Habilidades" tipo="textarea" span2 editando={editando}
                      display={detalle.habilidades}
                      value={editado.habilidades} onChange={v => setCampo("habilidades", v as string)} />
                    <EField label="Tipos de seguridad con experiencia" tipo="textarea" span2 editando={editando}
                      display={detalle.tipos_seguridad}
                      value={editado.tipos_seguridad} onChange={v => setCampo("tipos_seguridad", v as string)} />
                    <EField label="Disp. turno rotativo" tipo="yn" editando={editando}
                      display={detalle.disp_rotativo}
                      value={editado.disp_rotativo} onChange={v => setCampo("disp_rotativo", v as string)} />
                    <EField label="Disp. turno nocturno" tipo="yn" editando={editando}
                      display={detalle.disp_nocturno}
                      value={editado.disp_nocturno} onChange={v => setCampo("disp_nocturno", v as string)} />
                    <EField label="Disp. fines de semana" tipo="yn" span2 editando={editando}
                      display={detalle.disp_fds}
                      value={editado.disp_fds} onChange={v => setCampo("disp_fds", v as string)} />
                  </Grid2>
                </Section>

                {/* Referencias personales */}
                <Section titulo="Referencias Personales" icono={<Phone size={16} />}>
                  {(["ref1", "ref2", "ref3"] as const).map((pre, i) => (
                    <div key={pre} className="mb-3">
                      <div className="text-gray-500 text-xs font-semibold uppercase mb-1">Referencia {i + 1}</div>
                      <Grid2>
                        <EField label="Nombre" editando={editando}
                          display={(detalle as any)[`${pre}_nombre`]}
                          value={(editado as any)[`${pre}_nombre`]}
                          onChange={v => setCampo(`${pre}_nombre` as keyof SolicitudDetalle, v as never)} />
                        <EField label="Relación" editando={editando}
                          display={(detalle as any)[`${pre}_relacion`]}
                          value={(editado as any)[`${pre}_relacion`]}
                          onChange={v => setCampo(`${pre}_relacion` as keyof SolicitudDetalle, v as never)} />
                        <EField label="Teléfono" editando={editando}
                          display={(detalle as any)[`${pre}_tel`]}
                          value={(editado as any)[`${pre}_tel`]}
                          onChange={v => setCampo(`${pre}_tel` as keyof SolicitudDetalle, v as never)} />
                        <EField label="Años de conocerlo" editando={editando}
                          display={(detalle as any)[`${pre}_anios`]}
                          value={(editado as any)[`${pre}_anios`]}
                          onChange={v => setCampo(`${pre}_anios` as keyof SolicitudDetalle, v as never)} />
                      </Grid2>
                    </div>
                  ))}
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
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                        <div className="flex-1">
                          <p className="text-emerald-300 text-sm font-medium">Ficha de empleado creada exitosamente</p>
                          <p className="text-gray-400 text-xs">EMP-{String(detalle.employee_id ?? empleadoCreadoId).padStart(5, "0")} — {detalle.nombre_completo}</p>
                        </div>
                        <a
                          href={`/admin/empleados?id=${detalle.employee_id ?? empleadoCreadoId}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          <ExternalLink size={13} /> Ver Ficha
                        </a>
                      </div>

                      {/* Bloque de descarga de contrato */}
                      <div className="border-t border-emerald-800/40 pt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText size={14} className="text-emerald-400" />
                          <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wide">Imprimir Contrato Individual de Trabajo</p>
                        </div>
                        <p className="text-gray-400 text-[11px] mb-3">
                          Genera el contrato laboral según Código de Trabajo de Guatemala (Decreto 1441) listo para firma.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={async () => {
                              const patrono = await cargarPatronoDesdeConfig();
                              const fechaAlta = asignacion.fecha_alta || new Date().toISOString().slice(0, 10);
                              const datos: DatosContratoLaboral = {
                                empleado_nombre: detalle.nombre_completo,
                                empleado_dpi: detalle.dpi,
                                empleado_estado_civil: detalle.estado_civil ?? undefined,
                                empleado_direccion: detalle.direccion ?? undefined,
                                empleado_telefono: detalle.telefono,
                                fecha_inicio: fechaAlta,
                                puesto: asignacion.puesto || detalle.puesto_solicitado,
                                tipo_personal: asignacion.tipo_personal || "guardia",
                                sueldo_base: parseFloat(asignacion.sueldo_base) || parseFloat(detalle.pretension_salarial || "0") || 0,
                                tipo_contrato: "inicial",
                                patrono,
                              };
                              generarContratoLaboral(datos);
                            }}
                            className="flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
                          >
                            <Printer size={14} /> Contrato Inicial<br/>(60 días prueba)
                          </button>
                          <button
                            onClick={async () => {
                              const patrono = await cargarPatronoDesdeConfig();
                              // El contrato post-prueba inicia 2 meses después
                              // de la fecha de alta (al vencer el período de prueba de 60 días).
                              const baseAlta = asignacion.fecha_alta || new Date().toISOString().slice(0, 10);
                              const [yA, mA, dA] = baseAlta.split("-").map(Number);
                              const fechaPostPrueba = new Date(yA, (mA || 1) - 1, dA || 1);
                              fechaPostPrueba.setMonth(fechaPostPrueba.getMonth() + 2);
                              const datos: DatosContratoLaboral = {
                                empleado_nombre: detalle.nombre_completo,
                                empleado_dpi: detalle.dpi,
                                empleado_estado_civil: detalle.estado_civil ?? undefined,
                                empleado_direccion: detalle.direccion ?? undefined,
                                empleado_telefono: detalle.telefono,
                                fecha_inicio: fechaPostPrueba.toISOString().slice(0, 10),
                                puesto: asignacion.puesto || detalle.puesto_solicitado,
                                tipo_personal: asignacion.tipo_personal || "guardia",
                                sueldo_base: parseFloat(asignacion.sueldo_base) || parseFloat(detalle.pretension_salarial || "0") || 0,
                                tipo_contrato: "post_prueba",
                                patrono,
                              };
                              generarContratoLaboral(datos);
                            }}
                            className="flex items-center justify-center gap-2 px-3 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition-colors"
                          >
                            <Printer size={14} /> Contrato Post-Prueba<br/>(Indefinido)
                          </button>
                        </div>
                        <p className="text-yellow-500/80 text-[10px] mt-2 italic">
                          ⚠ Algunos datos del patrono (NIT, representante, dirección) están en blanco. Edítalos en <code className="bg-gray-800 px-1 rounded">src/lib/pdfRrhh.ts → PATRONO_DATOS</code> o complétalos a mano antes de firmar.
                        </p>
                      </div>
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
                            fecha_alta: new Date().toISOString().slice(0, 10),
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
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">
                            Fecha de alta (ingreso)
                          </label>
                          <input
                            type="date"
                            value={asignacion.fecha_alta}
                            onChange={e => setAsignacion(a => ({ ...a, fecha_alta: e.target.value }))}
                            className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <p className="text-[10px] text-gray-500 mt-1">
                            Quedará como “Fecha de ingreso” en la ficha del colaborador y se usará para el contrato inicial
                            (post-prueba = esta fecha + 2 meses).
                          </p>
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

type EFieldTipo = "text" | "textarea" | "date" | "number" | "bool" | "yn" | "genero" | "estado_civil" | "forma_pago";

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
      {tipo === "yn" && (
        <select
          value={v === "si" ? "si" : v === "no" ? "no" : ""}
          onChange={e => onChange(e.target.value || null)}
          className={inputCls}
        >
          <option value="">— sin especificar —</option>
          <option value="si">Sí</option>
          <option value="no">No</option>
        </select>
      )}
      {tipo === "genero" && (
        <select value={v} onChange={e => onChange(e.target.value)} className={inputCls}>
          <option value="">— sin especificar —</option>
          <option value="Masculino">Masculino</option>
          <option value="Femenino">Femenino</option>
        </select>
      )}
      {tipo === "forma_pago" && (
        <select value={v} onChange={e => onChange(e.target.value)} className={inputCls}>
          <option value="">— sin especificar —</option>
          <option value="cheque">Cheque</option>
          <option value="deposito">Depósito a cuenta</option>
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
