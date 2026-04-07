import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  Trash2, Clock, CheckCircle2, XCircle, Filter,
  User, Calendar, FileText, Loader2, AlertTriangle,
} from "lucide-react";

const API = "/api";

function apiFetch(url: string, opts?: RequestInit) {
  const session = sessionStorage.getItem("isp_admin_session_v2") || "";
  return fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-isp-session": session, ...(opts?.headers ?? {}) },
  }).then(async (r) => {
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || r.statusText);
    return d;
  });
}

interface Solicitud {
  id: number;
  entidad: string;
  entidad_id: number;
  entidad_descripcion: string;
  motivo: string;
  solicitante_username: string;
  estado: "pendiente" | "aprobada" | "rechazada";
  revisado_por: string | null;
  revisado_at: string | null;
  created_at: string;
}

const ENTIDAD_LABELS: Record<string, string> = {
  arma: "Arma",
  vehiculo: "Vehículo",
  empleado: "Colaborador",
  cliente: "Cliente",
  puesto: "Puesto operativo",
};

const ESTADO_CONFIG = {
  pendiente: {
    label: "Pendiente",
    icon: Clock,
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-400",
    dot: "bg-amber-400",
  },
  aprobada: {
    label: "Aprobada",
    icon: CheckCircle2,
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  rechazada: {
    label: "Rechazada",
    icon: XCircle,
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    text: "text-red-400",
    dot: "bg-red-400",
  },
} as const;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("es-GT", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function EstadoBadge({ estado }: { estado: Solicitud["estado"] }) {
  const cfg = ESTADO_CONFIG[estado];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function FilaSolicitud({
  s,
  onRevisar,
  currentUsername,
}: {
  s: Solicitud;
  onRevisar: (id: number, estado: "aprobada" | "rechazada") => void;
  currentUsername: string;
}) {
  const [confirmando, setConfirmando] = useState<"aprobada" | "rechazada" | null>(null);

  return (
    <div className={`rounded-xl border p-4 transition-all ${
      s.estado === "pendiente"
        ? "bg-gray-800/50 border-amber-500/20"
        : "bg-gray-800/20 border-gray-700/30"
    }`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* Izquierda: info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="inline-flex items-center gap-1 bg-gray-700/60 border border-gray-600/40 text-gray-300 text-xs px-2 py-0.5 rounded-md font-mono">
              #{s.id}
            </span>
            <span className="text-xs text-gray-400 bg-gray-700/40 border border-gray-600/30 px-2 py-0.5 rounded-md">
              {ENTIDAD_LABELS[s.entidad] ?? s.entidad}
            </span>
            <EstadoBadge estado={s.estado} />
          </div>

          <p className="text-white font-semibold text-sm mb-1 truncate">{s.entidad_descripcion}</p>

          <div className="bg-gray-900/60 border border-gray-700/40 rounded-lg px-3 py-2 mb-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Motivo de eliminación</p>
            <p className="text-sm text-gray-300">{s.motivo}</p>
          </div>

          <div className="flex items-center gap-4 flex-wrap text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <User className="w-3 h-3" />
              Solicitante: <span className="text-gray-400 font-medium">{s.solicitante_username}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              {fmtDate(s.created_at)}
            </span>
            {s.revisado_por && (
              <span className="flex items-center gap-1.5">
                <FileText className="w-3 h-3" />
                Revisado por: <span className="text-gray-400 font-medium">{s.revisado_por}</span>
                {s.revisado_at && ` · ${fmtDate(s.revisado_at)}`}
              </span>
            )}
          </div>
        </div>

        {/* Derecha: acciones */}
        {s.estado === "pendiente" && (
          <div className="flex-shrink-0">
            {confirmando === null ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmando("rechazada")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Rechazar
                </button>
                <button
                  onClick={() => setConfirmando("aprobada")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Aprobar
                </button>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <span className="text-xs text-gray-400">
                  ¿{confirmando === "aprobada" ? "Aprobar" : "Rechazar"} solicitud?
                </span>
                <button
                  onClick={() => setConfirmando(null)}
                  className="px-2.5 py-1 text-xs border border-gray-600 text-gray-400 hover:text-white rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { onRevisar(s.id, confirmando); setConfirmando(null); }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    confirmando === "aprobada"
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "bg-red-600 hover:bg-red-500 text-white"
                  }`}
                >
                  Confirmar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SolicitudesEliminacion() {
  const qc = useQueryClient();
  const { currentUser } = useAuth();
  const [filtro, setFiltro] = useState<"todas" | "pendiente" | "aprobada" | "rechazada">("pendiente");

  const { data: solicitudes = [], isLoading } = useQuery<Solicitud[]>({
    queryKey: ["solicitudes-eliminacion"],
    queryFn: () => apiFetch(`${API}/solicitudes-eliminacion`),
    refetchInterval: 30_000,
  });

  const revisar = useMutation({
    mutationFn: ({ id, estado }: { id: number; estado: "aprobada" | "rechazada" }) =>
      apiFetch(`${API}/solicitudes-eliminacion/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ estado, revisado_por: currentUser?.username ?? "admin" }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["solicitudes-eliminacion"] }),
  });

  const filtradas = filtro === "todas" ? solicitudes : solicitudes.filter((s) => s.estado === filtro);
  const pendientes = solicitudes.filter((s) => s.estado === "pendiente").length;

  return (
    <AdminLayout title="Solicitudes de Eliminación">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 bg-red-500/15 border border-red-500/25 rounded-xl flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-red-400" />
              </div>
              <h1 className="text-xl font-bold text-white">Solicitudes de Eliminación</h1>
              {pendientes > 0 && (
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold">
                  {pendientes}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 ml-12">
              Revisión y aprobación de solicitudes de eliminación de registros
            </p>
          </div>
        </div>

        {/* Aviso informativo */}
        <div className="flex items-start gap-3 bg-red-500/8 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300/80">
            Estas solicitudes son generadas por usuarios con modo eliminación activo.
            <strong> Aprobar una solicitud elimina el registro de forma permanente e irreversible.</strong> Rechazarla lo mantiene intacto.
          </p>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-500" />
          {(["todas", "pendiente", "aprobada", "rechazada"] as const).map((f) => {
            const count = f === "todas" ? solicitudes.length : solicitudes.filter((s) => s.estado === f).length;
            return (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  filtro === f
                    ? f === "todas"
                      ? "bg-blue-500/20 border-blue-500/30 text-blue-300"
                      : f === "pendiente"
                      ? "bg-amber-500/20 border-amber-500/30 text-amber-300"
                      : f === "aprobada"
                      ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                      : "bg-red-500/20 border-red-500/30 text-red-300"
                    : "bg-gray-800/40 border-gray-700/40 text-gray-400 hover:text-white hover:border-gray-600"
                }`}
              >
                {f === "todas" ? "Todas" : ESTADO_CONFIG[f].label}
                <span className="ml-1.5 opacity-60">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Contenido */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Trash2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">
              {filtro === "pendiente"
                ? "No hay solicitudes pendientes de revisión"
                : "No hay solicitudes con este estado"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {revisar.isPending && (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando...
              </div>
            )}
            {filtradas.map((s) => (
              <FilaSolicitud
                key={s.id}
                s={s}
                currentUsername={currentUser?.username ?? "admin"}
                onRevisar={(id, estado) => revisar.mutate({ id, estado })}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
