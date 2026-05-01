import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PortalLayout } from "@/portal/layout/PortalLayout";
import { portalGet, portalPost } from "@/lib/portalApi";
import { AlertTriangle, Filter, Search, Plus, X, Loader2 } from "lucide-react";

const TIPOS_INCIDENCIA = [
  "Robo / Hurto",
  "Intrusión / Acceso no autorizado",
  "Vandalismo",
  "Daño a propiedad",
  "Persona sospechosa",
  "Vehículo sospechoso",
  "Falla de equipo / sistema",
  "Falla de servicio del agente",
  "Emergencia médica",
  "Incendio / amago de incendio",
  "Otro",
];

interface Incident {
  id: string;
  fecha: string;
  tipo: string;
  prioridad: string;
  estado: string;
  ubicacion: string | null;
  responsable: string | null;
  descripcion: string | null;
  origen: string;
}

const PRIORIDAD_COLOR: Record<string, string> = {
  alta: "text-red-400 bg-red-400/10 border-red-400/20",
  media: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  baja: "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

const ESTADO_COLOR: Record<string, string> = {
  abierta: "text-red-400 bg-red-400/10 border-red-400/20",
  en_proceso: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  cerrada: "text-green-400 bg-green-400/10 border-green-400/20",
};

const ESTADO_LABEL: Record<string, string> = {
  abierta: "Abierta",
  en_proceso: "En Proceso",
  cerrada: "Cerrada",
};

function formatFecha(str: string) {
  return new Date(str).toLocaleDateString("es-GT", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function PortalIncidencias() {
  const [filtroEstado, setFiltroEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [expandida, setExpandida] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  const queryClient = useQueryClient();

  const { data = [], isLoading, isError } = useQuery<Incident[]>({
    queryKey: ["portal-incidencias"],
    queryFn: () => portalGet<Incident[]>("/portal/incidencias"),
    refetchInterval: 30000,
  });

  const filtradas = data.filter((inc) => {
    if (filtroEstado && inc.estado !== filtroEstado) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return (
        inc.tipo.toLowerCase().includes(q) ||
        inc.id.toLowerCase().includes(q) ||
        (inc.ubicacion ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activas = data.filter((i) => ["abierta", "en_proceso"].includes(i.estado)).length;
  const cerradas = data.filter((i) => i.estado === "cerrada").length;

  return (
    <PortalLayout title="Incidencias">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Mis Incidencias</h2>
          <p className="text-sm text-white/40 mt-1">
            Historial de incidencias registradas en su cuenta
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm items-center">
          <div className="bg-[#0d1c30] border border-white/5 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold text-red-400">{activas}</p>
            <p className="text-[10px] text-white/40 uppercase">Activas</p>
          </div>
          <div className="bg-[#0d1c30] border border-white/5 rounded-lg px-3 py-2 text-center">
            <p className="text-lg font-bold text-green-400">{cerradas}</p>
            <p className="text-[10px] text-white/40 uppercase">Cerradas</p>
          </div>
          <button
            type="button"
            onClick={() => setModalAbierto(true)}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-[#0a1422] font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nueva incidencia
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Buscar por tipo, ID o ubicación..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-[#0d1c30] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/40"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="bg-[#0d1c30] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary/40 appearance-none min-w-[160px]"
          >
            <option value="">Todos los estados</option>
            <option value="abierta">Abierta</option>
            <option value="en_proceso">En Proceso</option>
            <option value="cerrada">Cerrada</option>
          </select>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-white/40 text-sm animate-pulse">Cargando incidencias...</div>
        </div>
      ) : isError ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center text-sm text-red-400">
          Error al cargar incidencias.
        </div>
      ) : filtradas.length === 0 ? (
        <div className="bg-[#0d1c30] border border-white/5 rounded-xl p-12 text-center">
          <AlertTriangle className="w-8 h-8 text-white/20 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No se encontraron incidencias</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map((inc) => (
            <div
              key={inc.id}
              className="bg-[#0d1c30] border border-white/5 rounded-xl overflow-hidden cursor-pointer hover:border-white/10 transition-colors"
              onClick={() => setExpandida(expandida === inc.id ? null : inc.id)}
            >
              <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                {/* ID + tipo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono text-white/30">{inc.id}</span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${PRIORIDAD_COLOR[inc.prioridad] ?? ""}`}>
                      {inc.prioridad?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white truncate">{inc.tipo}</p>
                  {inc.ubicacion && (
                    <p className="text-xs text-white/40 mt-0.5 truncate">{inc.ubicacion}</p>
                  )}
                </div>

                {/* Estado + fecha */}
                <div className="flex sm:flex-col items-center sm:items-end gap-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-semibold border ${ESTADO_COLOR[inc.estado] ?? ""}`}>
                    {ESTADO_LABEL[inc.estado] ?? inc.estado}
                  </span>
                  <span className="text-[10px] text-white/30 whitespace-nowrap">
                    {formatFecha(inc.fecha)}
                  </span>
                </div>
              </div>

              {/* Detalle expandible */}
              {expandida === inc.id && (
                <div className="px-5 pb-4 border-t border-white/5 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {inc.descripcion && (
                    <div className="sm:col-span-2">
                      <p className="text-white/40 mb-1">Descripción</p>
                      <p className="text-white/70">{inc.descripcion}</p>
                    </div>
                  )}
                  {inc.responsable && (
                    <div>
                      <p className="text-white/40 mb-0.5">Responsable</p>
                      <p className="text-white">{inc.responsable}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-white/40 mb-0.5">Origen del reporte</p>
                    <p className="text-white capitalize">{inc.origen}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {filtradas.length > 0 && (
        <p className="text-xs text-white/30 text-center mt-4">
          Mostrando {filtradas.length} de {data.length} incidencias
        </p>
      )}

      {modalAbierto && (
        <ModalCrearIncidencia
          onClose={() => setModalAbierto(false)}
          onCreated={() => {
            setModalAbierto(false);
            queryClient.invalidateQueries({ queryKey: ["portal-incidencias"] });
          }}
        />
      )}
    </PortalLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal: Crear nueva incidencia desde el portal cliente
// ─────────────────────────────────────────────────────────────────────────────
function ModalCrearIncidencia({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [tipo, setTipo] = useState<string>(TIPOS_INCIDENCIA[0]);
  const [tipoOtro, setTipoOtro] = useState("");
  const [prioridad, setPrioridad] = useState<"alta" | "media" | "baja">("media");
  const [ubicacion, setUbicacion] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [esEmergencia, setEsEmergencia] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const tipoFinal = tipo === "Otro" ? tipoOtro.trim() : tipo;
  const puedeEnviar = tipoFinal.length > 0 && descripcion.trim().length >= 5;

  const mutation = useMutation({
    mutationFn: async () => {
      return portalPost<{ ok: boolean; id: string }>("/portal/incidencias", {
        tipo: tipoFinal,
        prioridad,
        ubicacion: ubicacion.trim() || undefined,
        descripcion: descripcion.trim(),
        esEmergencia,
      });
    },
    onSuccess: (res) => onCreated(res.id),
    onError: (err: unknown) =>
      setErrorMsg(err instanceof Error ? err.message : "No se pudo registrar la incidencia."),
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0d1c30] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 sticky top-0 bg-[#0d1c30]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-primary" />
            </div>
            <h3 className="text-base font-bold text-white">Reportar incidencia</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setErrorMsg(null);
            if (!puedeEnviar || mutation.isPending) return;
            mutation.mutate();
          }}
          className="p-5 space-y-4"
        >
          {/* Tipo */}
          <div>
            <label className="block text-xs text-white/60 mb-1.5 font-medium">Tipo de incidencia</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full bg-[#0a1422] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50"
            >
              {TIPOS_INCIDENCIA.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {tipo === "Otro" && (
              <input
                type="text"
                placeholder="Describa el tipo en pocas palabras"
                value={tipoOtro}
                onChange={(e) => setTipoOtro(e.target.value)}
                maxLength={100}
                className="mt-2 w-full bg-[#0a1422] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50"
              />
            )}
          </div>

          {/* Prioridad */}
          <div>
            <label className="block text-xs text-white/60 mb-1.5 font-medium">Prioridad</label>
            <div className="grid grid-cols-3 gap-2">
              {(["alta", "media", "baja"] as const).map((p) => {
                const colorActivo =
                  p === "alta" ? "border-red-400/40 bg-red-400/10 text-red-300"
                  : p === "media" ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-300"
                  : "border-blue-400/40 bg-blue-400/10 text-blue-300";
                const activo = prioridad === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPrioridad(p)}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold uppercase transition
                      ${activo ? colorActivo : "border-white/10 bg-[#0a1422] text-white/50 hover:text-white/80"}`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ubicación */}
          <div>
            <label className="block text-xs text-white/60 mb-1.5 font-medium">
              Ubicación <span className="text-white/30 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              placeholder="Ej. Sede Zona 10, parqueo subterráneo"
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              maxLength={255}
              className="w-full bg-[#0a1422] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs text-white/60 mb-1.5 font-medium">Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={4}
              placeholder="Describa lo ocurrido con el mayor detalle posible: hora aproximada, personas involucradas, qué se observó..."
              className="w-full bg-[#0a1422] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 resize-none"
            />
            <p className="text-[10px] text-white/30 mt-1">{descripcion.trim().length} caracteres (mínimo 5)</p>
          </div>

          {/* Emergencia */}
          <label className="flex items-start gap-3 p-3 bg-[#0a1422] border border-white/5 rounded-lg cursor-pointer hover:border-red-400/30 transition">
            <input
              type="checkbox"
              checked={esEmergencia}
              onChange={(e) => setEsEmergencia(e.target.checked)}
              className="mt-0.5 accent-red-500"
            />
            <div>
              <p className="text-sm text-white font-medium">Marcar como emergencia</p>
              <p className="text-[11px] text-white/40 mt-0.5">
                Solo para situaciones críticas que requieran respuesta inmediata.
              </p>
            </div>
          </label>

          {/* Error */}
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-300">
              {errorMsg}
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-sm text-white/70 hover:bg-white/5 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!puedeEnviar || mutation.isPending}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-[#0a1422] text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Reportar"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
