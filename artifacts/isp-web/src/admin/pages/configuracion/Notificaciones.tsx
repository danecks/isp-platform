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

import { useEffect, useMemo, useState } from "react";
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
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [testTitle, setTestTitle] = useState("");
  const [testBody, setTestBody] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

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
    </AdminLayout>
  );
}
