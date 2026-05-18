import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, RefreshCw, Smartphone, Package, Clock, CheckCircle2, AlertTriangle, Loader2, Info } from "lucide-react";
import {
  checkForUpdate,
  getAppVersionInfo,
  getLastCheck,
  type AppVersionInfo,
  type OtaCheckResult,
  type OtaLastCheck,
} from "@/lib/native/liveUpdate";
import { isNative, getPlatform } from "@/lib/native/platform";
import { useToast } from "@/hooks/use-toast";

function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return "Nunca";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Nunca";
    return d.toLocaleString("es-GT", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function describeResult(r: OtaCheckResult | null): { label: string; tone: "ok" | "info" | "warn" | "error" } {
  if (!r) return { label: "Sin chequeos aún", tone: "info" };
  switch (r.status) {
    case "no-update": return { label: "Al día (no hay actualización)", tone: "ok" };
    case "downloaded": return { label: `Descargada v${r.version} — se aplicará al próximo arranque`, tone: "ok" };
    case "available": return { label: `Disponible v${r.version}`, tone: "info" };
    case "error": return { label: `Error: ${r.message}`, tone: "error" };
    case "unsupported": return { label: "OTA no disponible en navegador (sólo APK)", tone: "warn" };
  }
}

export default function AjustesVersion() {
  const { toast } = useToast();
  const [info, setInfo] = useState<AppVersionInfo | null>(null);
  const [last, setLast] = useState<OtaLastCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const plataforma = getPlatform();
  const nativo = isNative();

  const recargar = useCallback(async () => {
    const [v, l] = await Promise.all([getAppVersionInfo(), Promise.resolve(getLastCheck())]);
    setInfo(v);
    setLast(l);
  }, []);

  useEffect(() => { void recargar(); }, [recargar]);

  const buscar = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    try {
      const r = await checkForUpdate();
      const d = describeResult(r);
      const titulo =
        r.status === "downloaded" ? "Actualización descargada"
        : r.status === "no-update" ? "Ya estás al día"
        : r.status === "unsupported" ? "Sin soporte"
        : r.status === "error" ? "Error al chequear"
        : "Resultado";
      toast({
        title: titulo,
        description: d.label,
        variant: d.tone === "error" ? "destructive" : "default",
      });
      await recargar();
    } finally {
      setChecking(false);
    }
  }, [checking, toast, recargar]);

  const estado = describeResult(last?.result ?? null);
  const toneColor =
    estado.tone === "ok" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
    : estado.tone === "error" ? "text-rose-300 bg-rose-500/10 border-rose-500/30"
    : estado.tone === "warn" ? "text-amber-300 bg-amber-500/10 border-amber-500/30"
    : "text-sky-300 bg-sky-500/10 border-sky-500/30";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="px-4 py-3 border-b border-slate-900 flex items-center gap-3">
        <button
          type="button"
          onClick={() => { window.history.length > 1 ? window.history.back() : (window.location.href = "/agente/inicio"); }}
          className="p-2 rounded-lg hover:bg-slate-900 text-slate-300"
          aria-label="Volver"
          data-testid="button-volver"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold">Acerca de la app</h1>
      </header>

      <main className="max-w-md mx-auto px-4 py-5 space-y-4">
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-slate-400">Versión instalada (APK)</p>
              <p className="text-lg font-bold" data-testid="text-app-version">
                {info?.native ?? (nativo ? "—" : "Web (navegador)")}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Plataforma: {plataforma}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 border-t border-slate-800 pt-3">
            <Package className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-slate-400">Bundle OTA activo</p>
              <p className="text-lg font-bold" data-testid="text-ota-version">
                {info?.bundle ?? "—"}
                {info?.builtin && <span className="ml-2 text-[10px] font-medium text-slate-400 uppercase">(original)</span>}
              </p>
              {info?.bundleId && (
                <p className="text-[11px] text-slate-500 mt-0.5">ID: {info.bundleId}</p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 border-t border-slate-800 pt-3">
            <Clock className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-slate-400">Último chequeo</p>
              <p className="text-sm font-semibold" data-testid="text-last-check">
                {fmtFecha(last?.at)}
              </p>
            </div>
          </div>
        </section>

        <section
          className={`rounded-xl border p-3 text-sm flex items-start gap-2 ${toneColor}`}
          data-testid="estado-ota"
        >
          {estado.tone === "ok" ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            : estado.tone === "error" ? <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            : <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          <span className="break-words">{estado.label}</span>
        </section>

        <button
          type="button"
          onClick={buscar}
          disabled={checking}
          className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition"
          data-testid="button-buscar-actualizacion"
        >
          {checking
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Buscando…</>
            : <><RefreshCw className="w-4 h-4" /> Buscar actualización ahora</>}
        </button>

        {!nativo && (
          <p className="text-[11px] text-slate-500 text-center">
            El sitio web siempre carga la última versión. La actualización OTA
            sólo aplica a la app instalada (APK).
          </p>
        )}
      </main>
    </div>
  );
}
