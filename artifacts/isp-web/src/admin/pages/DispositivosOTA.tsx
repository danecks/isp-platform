/**
 * Admin / Sistema → Dispositivos y versión OTA (TASK #97).
 *
 * Lista los dispositivos que reportaron al backend qué versión nativa de APK
 * y qué bundle OTA tienen activo, con la fecha del último ping y del último
 * chequeo OTA. Permite filtrar por "desactualizados" (bundle distinto al
 * publicado en el manifest) para detectar rápido qué celulares se quedaron
 * en una versión vieja y a qué usuario contactar.
 */
import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { RefreshCw, Smartphone, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

type DeviceRow = {
  id: number;
  deviceId: string;
  userId: number | null;
  userName: string | null;
  userUsername: string | null;
  platform: string;
  nativeVersion: string | null;
  bundleVersion: string | null;
  bundleId: string | null;
  deviceModel: string | null;
  lastOtaCheckAt: string | null;
  lastOtaStatus: string | null;
  lastSeenAt: string;
  createdAt: string;
};

type ApiResponse = {
  rows: DeviceRow[];
  manifestVersion: string | null;
};

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("es-GT", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function platformLabel(p: string): string {
  switch (p) {
    case "android": return "Android (APK)";
    case "ios": return "iOS";
    case "web": return "Web";
    default: return p || "—";
  }
}

export default function DispositivosOTA() {
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [manifestVersion, setManifestVersion] = useState<string | null>(null);
  const [soloDesactualizados, setSoloDesactualizados] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargar(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const qs = soloDesactualizados ? "?desactualizados=1" : "";
      const r = await fetch(`/api/device-reports${qs}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as ApiResponse;
      setRows(data.rows ?? []);
      setManifestVersion(data.manifestVersion ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [soloDesactualizados]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.userName ?? "").toLowerCase().includes(q) ||
      (r.userUsername ?? "").toLowerCase().includes(q) ||
      (r.nativeVersion ?? "").toLowerCase().includes(q) ||
      (r.bundleVersion ?? "").toLowerCase().includes(q) ||
      (r.deviceModel ?? "").toLowerCase().includes(q),
    );
  }, [rows, busqueda]);

  function esDesactualizado(r: DeviceRow): boolean {
    if (!manifestVersion) return false;
    if (!r.bundleVersion) return false;
    return r.bundleVersion !== manifestVersion;
  }

  return (
    <AdminLayout title="Dispositivos y versión OTA">
      <div className="space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" /> Dispositivos y versión OTA
            </h1>
            <p className="text-sm text-white/60 mt-1 max-w-2xl">
              Cada celular reporta al loguearse y después de chequear OTA qué versión
              nativa (APK) y qué bundle OTA tiene activo. Útil para detectar
              celulares que se quedaron en una versión vieja antes de soporte.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void cargar()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm disabled:opacity-50"
              data-testid="button-recargar"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Recargar
            </button>
          </div>
        </header>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-wrap items-center gap-4">
          <div className="text-sm">
            <p className="text-xs uppercase tracking-wider text-white/40">Versión OTA publicada</p>
            <p className="font-semibold text-white" data-testid="text-manifest-version">
              {manifestVersion ?? "— (sin manifest)"}
            </p>
          </div>
          <div className="text-sm">
            <p className="text-xs uppercase tracking-wider text-white/40">Dispositivos reportados</p>
            <p className="font-semibold text-white" data-testid="text-total">{rows.length}</p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="search"
              placeholder="Buscar por usuario, versión o modelo…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-sm w-72"
              data-testid="input-buscar"
            />
            <label className="flex items-center gap-2 text-sm text-white/80 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={soloDesactualizados}
                onChange={(e) => setSoloDesactualizados(e.target.checked)}
                className="accent-primary"
                data-testid="checkbox-desactualizados"
              />
              Sólo desactualizados
            </label>
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200 px-3 py-2 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Error cargando: {error}
          </div>
        )}

        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/50">
                <tr>
                  <th className="text-left px-3 py-2">Usuario</th>
                  <th className="text-left px-3 py-2">Plataforma</th>
                  <th className="text-left px-3 py-2">Versión APK</th>
                  <th className="text-left px-3 py-2">Bundle OTA</th>
                  <th className="text-left px-3 py-2">Último chequeo OTA</th>
                  <th className="text-left px-3 py-2">Último ping</th>
                  <th className="text-left px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading && filtradas.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-white/50">Cargando…</td></tr>
                )}
                {!loading && filtradas.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-white/50">Sin dispositivos para mostrar.</td></tr>
                )}
                {filtradas.map((r) => {
                  const desactualizado = esDesactualizado(r);
                  return (
                    <tr key={r.id} data-testid={`row-device-${r.id}`} className="hover:bg-white/5">
                      <td className="px-3 py-2">
                        <p className="font-medium text-white">{r.userName ?? "—"}</p>
                        <p className="text-xs text-white/40">{r.userUsername ?? `device #${r.id}`}</p>
                        {r.deviceModel && (
                          <p className="text-[11px] text-white/30 truncate max-w-xs" title={r.deviceModel}>
                            {r.deviceModel}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2">{platformLabel(r.platform)}</td>
                      <td className="px-3 py-2">{r.nativeVersion ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span className={desactualizado ? "text-amber-300 font-semibold" : "text-white"}>
                          {r.bundleVersion ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <p>{fmtFecha(r.lastOtaCheckAt)}</p>
                        {r.lastOtaStatus && (
                          <p className="text-[11px] text-white/40">{r.lastOtaStatus}</p>
                        )}
                      </td>
                      <td className="px-3 py-2">{fmtFecha(r.lastSeenAt)}</td>
                      <td className="px-3 py-2">
                        {!manifestVersion ? (
                          <span className="text-white/40">—</span>
                        ) : !r.bundleVersion ? (
                          <span className="text-white/40 text-xs">sin OTA</span>
                        ) : desactualizado ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-amber-500/15 text-amber-200 border border-amber-500/30">
                            <AlertTriangle className="w-3 h-3" /> Desactualizado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-emerald-500/15 text-emerald-200 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> Al día
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
