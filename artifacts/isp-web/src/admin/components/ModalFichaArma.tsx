import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Shield, X, Edit, FileText, MapPin, History, User, Clock,
  Loader2, AlertTriangle, Target,
} from "lucide-react";

const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";
async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "x-isp-session": getSession() } });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw e; }
  return res.json();
}

function fmtDatetime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("es-GT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const TIPO_LABELS: Record<string, string> = {
  pistola: "Pistola", revolver: "Revólver", escopeta: "Escopeta", rifle: "Rifle", otro: "Otro",
};
const ESTADO_CONFIG: Record<string, { label: string; cls: string }> = {
  activo:          { label: "Activo",          cls: "text-teal-400 bg-teal-400/10 border-teal-400/20" },
  en_mantenimiento:{ label: "En mantenimiento", cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  baja:            { label: "Baja",             cls: "text-red-400 bg-red-400/10 border-red-400/20" },
};
const ORIGEN_LABELS: Record<string, string> = {
  turno_normal:         "Turno normal",
  relevo:               "Relevo",
  relevo_ausencia:      "Relevo por ausencia",
  cobertura_parcial:    "Cobertura parcial",
  cobertura_supervisor: "Cobertura supervisor",
  cobertura_jefe:       "Cobertura jefe",
  manual:               "Manual",
  automatico_turno:     "Automático turno",
};

interface Arma {
  id: number; codigo: string; tipo: string; marca: string | null; modelo: string | null;
  calibre: string | null; serie: string | null; estado: string; activo: boolean;
  observaciones: string | null; puesto_id: number | null;
  puesto_nombre: string | null; cliente_nombre: string | null;
  titular_id: number | null; titular_nombre: string | null;
  custodia_id: number | null; custodio_id: number | null;
  custodio_nombre: string | null; custodio_tipo: string | null;
  custodia_desde: string | null; custodia_tipo_origen: string | null;
}
interface CustodiaEntry {
  id: number; arma_id: number; employee_id: number | null; puesto_id: number | null;
  fecha_inicio: string; fecha_fin: string | null; tipo_origen: string; notas: string | null;
  custodio_nombre: string | null; custodio_tipo: string | null;
  puesto_nombre: string | null; cliente_nombre: string | null;
}

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, cls: "text-gray-400 bg-gray-400/10 border-gray-400/20" };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>;
}

function FichaCampo({ label, value, mono = false }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="bg-gray-800/50 rounded-lg px-3 py-2.5">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm ${mono ? "font-mono font-semibold text-white" : "text-gray-200"} truncate`}>
        {value || <span className="text-gray-600 italic">—</span>}
      </p>
    </div>
  );
}

/**
 * Modal de ficha completa de un arma.
 * Recibe solo el ID — fetcha los datos y el historial internamente.
 * onEdit es opcional; si no se provee, el botón editar no aparece.
 */
export function ModalFichaArma({ armaId, onClose, onEdit }: {
  armaId: number;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const { data: arma, isLoading: loadingArma } = useQuery<Arma>({
    queryKey: ["arma-detalle", armaId],
    queryFn: () => apiFetch<Arma>(`/api/armas/${armaId}`),
  });
  const { data: historial = [], isLoading: loadingHist } = useQuery<CustodiaEntry[]>({
    queryKey: ["arma-custodia", armaId],
    queryFn: () => apiFetch<CustodiaEntry[]>(`/api/armas/${armaId}/custodia`),
  });

  return createPortal(
    <div
      role="dialog" aria-modal="true"
      aria-label={arma ? `Ficha del arma ${arma.codigo}` : "Ficha del arma"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700/80 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/15 border border-blue-500/25 rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            {loadingArma ? (
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            ) : arma ? (
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-bold text-white font-mono tracking-wider">{arma.codigo}</span>
                  <span className="text-xs text-gray-400 bg-gray-700/60 px-2 py-0.5 rounded-md">
                    {TIPO_LABELS[arma.tipo] ?? arma.tipo}
                  </span>
                  <EstadoBadge estado={arma.estado} />
                  {!arma.activo && (
                    <span className="text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full">Inactiva</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {[arma.marca, arma.modelo].filter(Boolean).join(" ") || "Sin marca/modelo"}
                  {arma.calibre ? ` · ${arma.calibre}` : ""}
                </p>
              </div>
            ) : (
              <span className="text-sm text-gray-400">Cargando...</span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {onEdit && (
              <button onClick={onEdit} title="Editar arma" aria-label="Editar arma"
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                <Edit className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} aria-label="Cerrar ficha"
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loadingArma ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : !arma ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <AlertTriangle className="w-8 h-8 mb-2" />
            <p className="text-sm">No se pudo cargar el arma</p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">

            {/* ── Datos del arma ── */}
            <div className="px-5 pt-4 pb-3">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-3.5 h-3.5 text-gray-500" />
                <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Datos del arma</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <FichaCampo label="Código" value={arma.codigo} mono />
                <FichaCampo label="Tipo" value={TIPO_LABELS[arma.tipo] ?? arma.tipo} />
                <FichaCampo label="Calibre" value={arma.calibre} />
                <FichaCampo label="Marca" value={arma.marca} />
                <FichaCampo label="Modelo" value={arma.modelo} />
                <FichaCampo label="Serie" value={arma.serie} mono />
              </div>
            </div>

            {/* ── Puesto asignado ── */}
            <div className="px-5 pb-3">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-3.5 h-3.5 text-gray-500" />
                <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Puesto asignado</h3>
              </div>
              {arma.puesto_nombre ? (
                <div className="bg-gray-800/50 rounded-lg px-3 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{arma.puesto_nombre}</p>
                    {arma.cliente_nombre && <p className="text-xs text-gray-400 truncate">{arma.cliente_nombre}</p>}
                  </div>
                  {arma.custodio_nombre && (
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 text-xs text-teal-400">
                        <User className="w-3 h-3" />
                        <span className="truncate max-w-[140px]">{arma.custodio_nombre}</span>
                      </div>
                      {arma.custodia_desde && (
                        <p className="text-[10px] text-gray-500 mt-0.5">desde {fmtDatetime(arma.custodia_desde)}</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-lg px-3 py-2.5 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400/60 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-indigo-300/80">En Armería</p>
                    <p className="text-xs text-indigo-300/40">Sin puesto operativo asignado</p>
                  </div>
                </div>
              )}
              {arma.observaciones && (
                <div className="mt-2 bg-yellow-500/5 border border-yellow-500/15 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-yellow-400/70 uppercase tracking-wider mb-0.5">Observaciones</p>
                  <p className="text-xs text-gray-300">{arma.observaciones}</p>
                </div>
              )}
            </div>

            {/* ── Historial completo ── */}
            <div className="px-5 pb-5 border-t border-gray-700/40 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-gray-500" />
                  <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Historial de custodia</h3>
                </div>
                <span className="text-[10px] text-gray-600 bg-gray-800/50 px-2 py-0.5 rounded-full">
                  {loadingHist ? "…" : `${historial.length} registro(s)`}
                </span>
              </div>

              {loadingHist ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                </div>
              ) : historial.length === 0 ? (
                <div className="text-center py-8 text-gray-600">
                  <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin registros de custodia aún</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {historial.map((h, i) => {
                    const isActiva = h.fecha_fin === null;
                    return (
                      <div key={h.id} className="flex gap-3">
                        <div className="flex flex-col items-center pt-2.5 flex-shrink-0">
                          <div className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 ${
                            isActiva ? "bg-teal-400 border-teal-400" : "bg-gray-800 border-gray-600"
                          }`} />
                          {i < historial.length - 1 && (
                            <div className="w-px flex-1 bg-gray-700/50 my-1 min-h-[12px]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pb-3">
                          <div className={`rounded-lg px-3 py-2.5 border ${
                            isActiva
                              ? "bg-teal-500/5 border-teal-500/20"
                              : "bg-gray-800/30 border-gray-700/40"
                          }`}>
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="min-w-0">
                                <p className={`text-sm font-medium ${isActiva ? "text-teal-200" : "text-gray-300"}`}>
                                  {h.custodio_nombre ?? <span className="italic text-gray-600">Sin custodio</span>}
                                </p>
                                {h.custodio_tipo && (
                                  <p className="text-[10px] text-gray-500 capitalize">{h.custodio_tipo.replace(/_/g, " ")}</p>
                                )}
                                {(h.puesto_nombre || h.cliente_nombre) && (
                                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                                    {h.puesto_nombre ?? "—"}{h.cliente_nombre ? ` · ${h.cliente_nombre}` : ""}
                                  </p>
                                )}
                              </div>
                              <div className="flex-shrink-0 text-right">
                                {isActiva
                                  ? <span className="text-[10px] text-teal-400 bg-teal-400/10 border border-teal-400/20 px-2 py-0.5 rounded-full font-medium">En curso</span>
                                  : <span className="text-[10px] text-gray-600">Cerrada</span>
                                }
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {fmtDatetime(h.fecha_inicio)}
                                {!isActiva && h.fecha_fin && <> → {fmtDatetime(h.fecha_fin)}</>}
                                {isActiva && <span className="text-teal-400/60 ml-0.5">→ en curso</span>}
                              </span>
                              <span className="text-[10px] text-blue-300/70 bg-blue-400/8 border border-blue-400/15 px-1.5 py-0.5 rounded">
                                {ORIGEN_LABELS[h.tipo_origen] ?? h.tipo_origen}
                              </span>
                            </div>
                            {h.notas && (
                              <p className="text-[10px] text-gray-500 mt-1 italic">"{h.notas}"</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
