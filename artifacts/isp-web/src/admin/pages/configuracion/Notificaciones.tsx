/**
 * NOTIFICACIONES PUSH — Panel admin
 *
 * Permite al administrador:
 *  • Ver si Firebase está configurado (modo real vs stub).
 *  • Listar dispositivos registrados por usuario.
 *  • Disparar una push de prueba.
 *  • Re-enviar la push de una emergencia existente si la original falló.
 *
 * Consume:
 *   GET  /api/push/status
 *   GET  /api/push/tokens/usuario/:id
 *   POST /api/push/test
 *   POST /api/push/emergencia/:id
 *   GET  /api/users      (selector de usuarios)
 *   GET  /api/incidents  (lista de emergencias para re-enviar)
 */

import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { usersApi, incidentsApi, type UserSafe, type Incident } from "@/lib/api";
import {
  Bell,
  Smartphone,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Search,
  History,
  ChevronLeft,
  ChevronRight,
  XCircle,
} from "lucide-react";

const API = "/api";

interface PushStatus {
  configured: boolean;
  mode: "real" | "stub";
}

interface TokenRow {
  id: number;
  tokenPreview: string;
  platform: string;
  appVersion: string | null;
  deviceModel: string | null;
  lastSeenAt: string;
  createdAt: string;
}

interface SendResult {
  sent?: number;
  failed?: number;
  skipped?: number;
  reason?: string;
  [key: string]: unknown;
}

interface EnvioRow {
  id: number;
  userId: number | null;
  userName: string | null;
  tokenPreview: string | null;
  title: string;
  body: string;
  evento: string;
  estado: "ok" | "error" | "simulated" | string;
  errorCode: string | null;
  errorMessage: string | null;
  messageId: string | null;
  data: string | null;
  createdAt: string;
}

interface EnviosResponse {
  rows: EnvioRow[];
  total: number;
  limit: number;
  offset: number;
}

type TabKey = "envio" | "historial";

function Toast({
  msg,
  type,
  onClose,
}: {
  msg: string;
  type: "ok" | "err";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  const cls =
    type === "ok"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : "bg-red-500/15 text-red-300 border-red-500/30";
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium border ${cls}`}
    >
      {type === "ok" ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <AlertCircle className="w-4 h-4" />
      )}
      <span>{msg}</span>
    </div>
  );
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-GT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function Notificaciones() {
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<TabKey>("envio");
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [testTitle, setTestTitle] = useState("");
  const [testBody, setTestBody] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // Filtros del historial
  const [filterUserId, setFilterUserId] = useState<number | "">("");
  const [filterEvento, setFilterEvento] = useState<string>("");
  const [filterEstado, setFilterEstado] = useState<string>("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // ── Estado de Firebase ──────────────────────────────────────────────────
  const {
    data: status,
    isLoading: statusLoading,
    isError: statusError,
    refetch: refetchStatus,
  } = useQuery<PushStatus>({
    queryKey: ["push-status"],
    queryFn: async () => {
      const r = await fetch(`${API}/push/status`);
      if (!r.ok) throw new Error("status");
      return r.json();
    },
    refetchInterval: 30000,
  });

  // ── Usuarios ────────────────────────────────────────────────────────────
  const { data: users = [], isLoading: usersLoading } = useQuery<UserSafe[]>({
    queryKey: ["users"],
    queryFn: usersApi.getAll,
  });

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const base = users.filter((u) => u.estado === "activo");
    if (!q) return base.slice(0, 50);
    return base
      .filter(
        (u) =>
          u.nombre.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          (u.correo ?? "").toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [users, userSearch]);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  // ── Tokens del usuario seleccionado ─────────────────────────────────────
  const {
    data: tokens = [],
    isLoading: tokensLoading,
    refetch: refetchTokens,
  } = useQuery<TokenRow[]>({
    queryKey: ["push-tokens", selectedUserId],
    queryFn: async () => {
      const r = await fetch(`${API}/push/tokens/usuario/${selectedUserId}`);
      if (!r.ok) throw new Error("tokens");
      return r.json();
    },
    enabled: selectedUserId !== null,
  });

  // ── Emergencias ─────────────────────────────────────────────────────────
  const { data: incidencias = [], isLoading: incidenciasLoading, refetch: refetchIncidencias } = useQuery<Incident[]>({
    queryKey: ["incidents"],
    queryFn: incidentsApi.getAll,
  });

  const emergencias = useMemo(
    () =>
      incidencias
        .filter((i) => i.esEmergencia && i.estado !== "cerrada")
        .slice(0, 30),
    [incidencias],
  );

  // ── Historial de envíos ─────────────────────────────────────────────────
  const enviosQueryKey = [
    "push-envios",
    filterUserId,
    filterEvento,
    filterEstado,
    page,
  ] as const;
  const {
    data: enviosData,
    isLoading: enviosLoading,
    isFetching: enviosFetching,
    refetch: refetchEnvios,
  } = useQuery<EnviosResponse>({
    queryKey: enviosQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));
      if (filterUserId !== "") params.set("userId", String(filterUserId));
      if (filterEvento) params.set("evento", filterEvento);
      if (filterEstado) params.set("estado", filterEstado);
      const r = await fetch(`${API}/push/envios?${params.toString()}`);
      if (!r.ok) throw new Error("envios");
      return r.json();
    },
    enabled: activeTab === "historial",
  });

  const filteredUsersForFilter = useMemo(
    () => users.filter((u) => u.estado === "activo"),
    [users],
  );

  // ── Acciones ────────────────────────────────────────────────────────────
  async function enviarPrueba() {
    if (!selectedUserId) {
      setToast({ msg: "Seleccioná un usuario primero", type: "err" });
      return;
    }
    setSendingTest(true);
    try {
      const r = await fetch(`${API}/push/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          title: testTitle.trim() || undefined,
          body: testBody.trim() || undefined,
        }),
      });
      const result: SendResult = await r.json();
      if (!r.ok) {
        setToast({
          msg: (result as { error?: string }).error ?? "Error enviando push",
          type: "err",
        });
      } else if ((result.sent ?? 0) > 0) {
        setToast({
          msg: `Push enviada (${result.sent} dispositivo${(result.sent ?? 0) === 1 ? "" : "s"})`,
          type: "ok",
        });
      } else {
        setToast({
          msg:
            result.reason ??
            `No se envió a ningún dispositivo (omitidos: ${result.skipped ?? 0})`,
          type: "err",
        });
      }
    } catch (err) {
      setToast({ msg: "Error de red enviando la push", type: "err" });
    } finally {
      setSendingTest(false);
    }
  }

  async function reenviarEmergencia(id: string) {
    setResendingId(id);
    try {
      const r = await fetch(`${API}/push/emergencia/${id}`, { method: "POST" });
      const result: SendResult = await r.json();
      if (!r.ok) {
        setToast({
          msg: (result as { error?: string }).error ?? "Error re-enviando",
          type: "err",
        });
      } else if ((result.sent ?? 0) > 0) {
        setToast({
          msg: `Push re-enviada a ${result.sent} dispositivo${(result.sent ?? 0) === 1 ? "" : "s"}`,
          type: "ok",
        });
      } else {
        setToast({
          msg:
            result.reason ??
            `Sin destinatarios disponibles (omitidos: ${result.skipped ?? 0})`,
          type: "err",
        });
      }
    } catch {
      setToast({ msg: "Error de red re-enviando la push", type: "err" });
    } finally {
      setResendingId(null);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <AdminLayout
      title="Notificaciones Push"
      subtitle="Diagnóstico de Firebase, dispositivos registrados y envíos manuales"
    >
      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Banner estado Firebase */}
      <div className="mb-6">
        {statusLoading ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/50">
            Consultando estado de Firebase…
          </div>
        ) : statusError || !status ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-300">
                No se pudo leer el estado de Firebase
              </p>
              <p className="text-xs text-red-300/70">
                Reintentá o revisá los logs del servidor.
              </p>
            </div>
            <button
              onClick={() => refetchStatus()}
              className="px-3 py-1.5 rounded-md text-xs bg-white/5 hover:bg-white/10 text-white border border-white/10 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              Reintentar
            </button>
          </div>
        ) : status.configured ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-300">
                Firebase configurado (modo real)
              </p>
              <p className="text-xs text-emerald-300/70">
                Las notificaciones push se envían a los dispositivos reales.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {status.mode}
            </span>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-300">
                Firebase no configurado (modo stub)
              </p>
              <p className="text-xs text-amber-300/70">
                Los envíos se simulan en logs; ningún dispositivo recibirá la
                notificación hasta cargar las credenciales de Firebase.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {status.mode}
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-5 flex items-center gap-1 border-b border-white/10">
        <button
          onClick={() => setActiveTab("envio")}
          className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "envio"
              ? "border-primary text-primary"
              : "border-transparent text-white/50 hover:text-white/80"
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          Envío manual
        </button>
        <button
          onClick={() => setActiveTab("historial")}
          className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "historial"
              ? "border-primary text-primary"
              : "border-transparent text-white/50 hover:text-white/80"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Historial
        </button>
      </div>

      {activeTab === "envio" && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Columna 1: Push de prueba + tokens ──────────────────────── */}
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Send className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Enviar push de prueba
            </h2>
          </div>

          <label className="block text-xs text-white/50 mb-1">Usuario</label>
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Buscar por nombre, usuario o correo…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50"
            />
          </div>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-white/5 divide-y divide-white/5 mb-4 bg-black/20">
            {usersLoading ? (
              <p className="px-3 py-3 text-xs text-white/40">Cargando usuarios…</p>
            ) : filteredUsers.length === 0 ? (
              <p className="px-3 py-3 text-xs text-white/40">
                {userSearch
                  ? "Sin resultados para esa búsqueda."
                  : "No hay usuarios activos."}
              </p>
            ) : (
              filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                    selectedUserId === u.id
                      ? "bg-primary/15 text-primary"
                      : "text-white/70 hover:bg-white/5"
                  }`}
                >
                  <div className="font-medium">{u.nombre}</div>
                  <div className="text-[11px] text-white/40">
                    @{u.username} · {u.rol}
                  </div>
                </button>
              ))
            )}
          </div>

          <label className="block text-xs text-white/50 mb-1">
            Título (opcional)
          </label>
          <input
            type="text"
            value={testTitle}
            onChange={(e) => setTestTitle(e.target.value)}
            placeholder="Notificación de prueba"
            maxLength={80}
            className="w-full mb-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50"
          />

          <label className="block text-xs text-white/50 mb-1">
            Mensaje (opcional)
          </label>
          <textarea
            value={testBody}
            onChange={(e) => setTestBody(e.target.value)}
            placeholder="Si recibís esta notificación, las push están funcionando."
            maxLength={200}
            rows={2}
            className="w-full mb-4 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 resize-none"
          />

          <button
            onClick={enviarPrueba}
            disabled={!selectedUserId || sendingTest}
            className="w-full px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-[#060e1c] flex items-center justify-center gap-2 transition-colors"
          >
            {sendingTest ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {sendingTest ? "Enviando…" : "Enviar prueba"}
          </button>

          {/* Tokens del usuario seleccionado */}
          {selectedUser && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-white/50" />
                  <h3 className="text-xs font-bold text-white/70 uppercase tracking-wider">
                    Dispositivos de {selectedUser.nombre}
                  </h3>
                </div>
                <button
                  onClick={() => refetchTokens()}
                  className="text-white/40 hover:text-white"
                  title="Recargar"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              {tokensLoading ? (
                <p className="text-xs text-white/40 px-3 py-2">
                  Cargando dispositivos…
                </p>
              ) : tokens.length === 0 ? (
                <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-4 text-center">
                  <p className="text-xs text-white/40">
                    Este usuario no tiene dispositivos registrados.
                  </p>
                  <p className="text-[10px] text-white/30 mt-1">
                    Tiene que iniciar sesión en el APK al menos una vez.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-white/5 bg-black/20 divide-y divide-white/5">
                  {tokens.map((t) => (
                    <div key={t.id} className="px-3 py-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-white/70 truncate">
                          {t.tokenPreview}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-white/5 text-white/60 border border-white/10 shrink-0">
                          {t.platform}
                        </span>
                      </div>
                      <div className="text-[11px] text-white/40 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        {t.deviceModel && <span>{t.deviceModel}</span>}
                        {t.appVersion && <span>v{t.appVersion}</span>}
                        <span>Última conexión: {formatDate(t.lastSeenAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Columna 2: Re-envío de emergencias ──────────────────────── */}
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Re-enviar push de emergencia
              </h2>
            </div>
            <button
              onClick={() => refetchIncidencias()}
              className="text-white/40 hover:text-white"
              title="Recargar"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-white/50 mb-4">
            Lista de emergencias abiertas o en proceso. Útil si la push original
            falló o si querés repetir el aviso.
          </p>

          {incidenciasLoading ? (
            <p className="text-xs text-white/40 px-3 py-2">Cargando emergencias…</p>
          ) : emergencias.length === 0 ? (
            <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-6 text-center">
              <Bell className="w-6 h-6 text-white/20 mx-auto mb-2" />
              <p className="text-xs text-white/50">
                No hay emergencias abiertas en este momento.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-white/5 bg-black/20 divide-y divide-white/5 max-h-[480px] overflow-y-auto">
              {emergencias.map((e) => (
                <div key={e.id} className="px-3 py-3 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[11px] text-white/50">
                          {e.id}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${
                            e.estado === "abierta"
                              ? "bg-red-500/15 text-red-300 border-red-500/30"
                              : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                          }`}
                        >
                          {e.estado}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-white/5 text-white/60 border border-white/10">
                          {e.prioridad}
                        </span>
                      </div>
                      <p className="text-white/80 font-medium truncate">
                        {e.tipo} — {e.cliente}
                      </p>
                      {e.ubicacion && (
                        <p className="text-white/40 text-[11px] truncate">
                          {e.ubicacion}
                        </p>
                      )}
                      <p className="text-white/30 text-[10px] mt-0.5">
                        {formatDate(e.fecha)}
                      </p>
                    </div>
                    <button
                      onClick={() => reenviarEmergencia(e.id)}
                      disabled={resendingId === e.id}
                      className="shrink-0 px-3 py-1.5 rounded-md bg-red-500/15 hover:bg-red-500/25 disabled:opacity-50 disabled:cursor-not-allowed text-red-300 text-[11px] font-semibold border border-red-500/30 flex items-center gap-1.5"
                    >
                      {resendingId === e.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      Re-enviar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      )}

      {activeTab === "historial" && (
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Historial de envíos
              </h2>
              {enviosData && (
                <span className="text-[11px] text-white/40">
                  ({enviosData.total} total)
                </span>
              )}
            </div>
            <button
              onClick={() => refetchEnvios()}
              className="text-white/40 hover:text-white"
              title="Recargar"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${enviosFetching ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">
                Usuario
              </label>
              <select
                value={filterUserId}
                onChange={(e) => {
                  setPage(0);
                  setFilterUserId(e.target.value === "" ? "" : Number(e.target.value));
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-primary/50"
              >
                <option value="">Todos</option>
                {filteredUsersForFilter.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} (@{u.username})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">
                Evento
              </label>
              <select
                value={filterEvento}
                onChange={(e) => {
                  setPage(0);
                  setFilterEvento(e.target.value);
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-primary/50"
              >
                <option value="">Todos</option>
                <option value="test">Prueba</option>
                <option value="emergencia">Emergencia</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">
                Estado
              </label>
              <select
                value={filterEstado}
                onChange={(e) => {
                  setPage(0);
                  setFilterEstado(e.target.value);
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-primary/50"
              >
                <option value="">Todos</option>
                <option value="ok">Entregada</option>
                <option value="error">Error</option>
                <option value="simulated">Simulada (stub)</option>
              </select>
            </div>
          </div>

          {/* Tabla */}
          {enviosLoading ? (
            <p className="text-xs text-white/40 px-3 py-6 text-center">
              Cargando historial…
            </p>
          ) : !enviosData || enviosData.rows.length === 0 ? (
            <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-8 text-center">
              <Bell className="w-6 h-6 text-white/20 mx-auto mb-2" />
              <p className="text-xs text-white/50">
                No hay envíos registrados con esos filtros.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-white/5 bg-black/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-white/5 text-white/50 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2 text-left">Fecha</th>
                      <th className="px-3 py-2 text-left">Usuario</th>
                      <th className="px-3 py-2 text-left">Evento</th>
                      <th className="px-3 py-2 text-left">Título</th>
                      <th className="px-3 py-2 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {enviosData.rows.map((row) => {
                      const isExpanded = expandedRow === row.id;
                      const stateCls =
                        row.estado === "ok"
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : row.estado === "simulated"
                            ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                            : "bg-red-500/15 text-red-300 border-red-500/30";
                      const StateIcon =
                        row.estado === "ok"
                          ? CheckCircle2
                          : row.estado === "simulated"
                            ? AlertTriangle
                            : XCircle;
                      return (
                        <Fragment key={row.id}>
                          <tr
                            onClick={() =>
                              setExpandedRow(isExpanded ? null : row.id)
                            }
                            className="text-white/80 hover:bg-white/[0.03] cursor-pointer"
                          >
                            <td className="px-3 py-2 whitespace-nowrap text-white/60">
                              {formatDate(row.createdAt)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {row.userName ?? (
                                <span className="text-white/40 italic">
                                  (sin usuario)
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-white/5 text-white/60 border border-white/10">
                                {row.evento}
                              </span>
                            </td>
                            <td className="px-3 py-2 max-w-[280px] truncate">
                              {row.title}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${stateCls}`}
                              >
                                <StateIcon className="w-3 h-3" />
                                {row.estado}
                              </span>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-black/30">
                              <td colSpan={5} className="px-4 py-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                                  <div>
                                    <p className="text-white/40 uppercase tracking-wider text-[10px] mb-1">
                                      Cuerpo
                                    </p>
                                    <p className="text-white/80 whitespace-pre-wrap">
                                      {row.body}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-white/40 uppercase tracking-wider text-[10px] mb-1">
                                      Token destino
                                    </p>
                                    <p className="font-mono text-white/70">
                                      {row.tokenPreview ?? "—"}
                                    </p>
                                  </div>
                                  {row.messageId && (
                                    <div>
                                      <p className="text-white/40 uppercase tracking-wider text-[10px] mb-1">
                                        Message ID (FCM)
                                      </p>
                                      <p className="font-mono text-white/70 break-all">
                                        {row.messageId}
                                      </p>
                                    </div>
                                  )}
                                  {(row.errorCode || row.errorMessage) && (
                                    <div className="md:col-span-2">
                                      <p className="text-red-400/70 uppercase tracking-wider text-[10px] mb-1">
                                        Error
                                      </p>
                                      {row.errorCode && (
                                        <p className="font-mono text-red-300">
                                          {row.errorCode}
                                        </p>
                                      )}
                                      {row.errorMessage && (
                                        <p className="text-red-300/80 mt-0.5">
                                          {row.errorMessage}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                  {row.data && (
                                    <div className="md:col-span-2">
                                      <p className="text-white/40 uppercase tracking-wider text-[10px] mb-1">
                                        Data
                                      </p>
                                      <pre className="font-mono text-[10px] text-white/60 bg-black/40 p-2 rounded overflow-x-auto">
                                        {row.data}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              <div className="flex items-center justify-between px-3 py-2.5 border-t border-white/5 bg-white/[0.02]">
                <span className="text-[11px] text-white/40">
                  Página {page + 1} de{" "}
                  {Math.max(1, Math.ceil(enviosData.total / PAGE_SIZE))}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white/70"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={(page + 1) * PAGE_SIZE >= enviosData.total}
                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white/70"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </AdminLayout>
  );
}
