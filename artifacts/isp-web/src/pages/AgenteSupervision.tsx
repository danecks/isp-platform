import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  CheckCircle2, XCircle, Loader2, Clock, MapPin, ClipboardList,
  PlayCircle, AlertTriangle, RefreshCw, QrCode, ArrowLeft,
  ShieldCheck, FileText, LogOut, ChevronDown, ChevronUp, Activity,
} from "lucide-react";
import { useSupervisorJornada } from "../components/SupervisorJornada/useSupervisorJornada";
import { ModalInspeccion } from "../components/SupervisorJornada/ModalInspeccion";

const API = "/api";
const DEVICE_KEY = "isp_device";          // mismo key que AgenteInicio / SupervisorActivar
const QR_KEY = "isp_supervisor_qr";       // qr_token del supervisor (sessionStorage)

interface DeviceCreds { device_uuid: string; device_token: string }

interface Visita {
  id: number;
  fecha_planificada: string;
  ventana_inicio: string | null;
  ventana_fin: string | null;
  tipo: "rutina" | "extraordinaria" | "comision";
  prioridad: "baja" | "normal" | "alta" | "urgente";
  estado: "pendiente" | "en_curso" | "completada" | "cancelada" | "no_realizada";
  cliente_nombre: string | null;
  puesto_nombre: string | null;
  puesto_direccion: string | null;
  zona_nombre: string | null;
  instrucciones: string | null;
  observaciones: string | null;
}

const TIPO_LABEL: Record<Visita["tipo"], string> = {
  rutina: "Rutina", extraordinaria: "Extraordinaria", comision: "Comisión",
};
const ESTADO_COLOR: Record<Visita["estado"], string> = {
  pendiente:    "bg-amber-500/20 text-amber-200 border-amber-500/40",
  en_curso:     "bg-blue-500/20 text-blue-200 border-blue-500/40",
  completada:   "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  cancelada:    "bg-zinc-500/20 text-zinc-200 border-zinc-500/40",
  no_realizada: "bg-rose-500/20 text-rose-200 border-rose-500/40",
};
const ESTADO_LABEL: Record<Visita["estado"], string> = {
  pendiente: "Pendiente", en_curso: "En curso", completada: "Completada",
  cancelada: "Cancelada", no_realizada: "No realizada",
};

function getDevice(): DeviceCreds | null {
  // Tolera ambos shapes históricos en localStorage:
  //   { uuid, token }              ← SupervisorActivar / AgenteInicio / AgenteVisitas
  //   { device_uuid, device_token } ← formato legado
  try {
    const raw = localStorage.getItem(DEVICE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    const uuid = j?.device_uuid ?? j?.uuid;
    const token = j?.device_token ?? j?.token;
    if (uuid && token) return { device_uuid: String(uuid), device_token: String(token) };
  } catch {}
  return null;
}
function getStoredQr(): string {
  return sessionStorage.getItem(QR_KEY) || "";
}
function setStoredQr(v: string) {
  if (v) sessionStorage.setItem(QR_KEY, v);
  else sessionStorage.removeItem(QR_KEY);
}

export default function AgenteSupervision() {
  const [device, setDevice] = useState<DeviceCreds | null>(getDevice());
  const [pegado, setPegado] = useState("");
  const [activando, setActivando] = useState(false);
  const [activarError, setActivarError] = useState<string | null>(null);

  // Activar este navegador/PWA pegando el enlace de activación recibido del admin.
  // Útil cuando el teléfono se activó originalmente en Safari pero se usa la PWA
  // instalada (cada contexto tiene su propio localStorage en iOS).
  const activarConEnlace = useCallback(async () => {
    setActivarError(null);
    let uuid = "", token = "";
    try {
      const txt = pegado.trim();
      if (!txt) { setActivarError("Pegá el enlace o los códigos."); return; }
      // Aceptamos: URL completa con ?uuid=...&token=...   |   "uuid|token"   |   JSON
      if (txt.startsWith("http")) {
        const u = new URL(txt);
        uuid = u.searchParams.get("uuid") || "";
        token = u.searchParams.get("token") || "";
      } else if (txt.includes("|")) {
        [uuid, token] = txt.split("|").map(s => s.trim());
      } else {
        const j = JSON.parse(txt);
        uuid = j.uuid || j.device_uuid || "";
        token = j.token || j.device_token || "";
      }
      if (!uuid || !token) { setActivarError("No encontré uuid/token en lo que pegaste."); return; }
    } catch {
      setActivarError("Formato no reconocido. Pegá el enlace completo del admin.");
      return;
    }
    setActivando(true);
    try {
      const r = await fetch(`${API}/supervisor-devices/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_uuid: uuid, device_token: token }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setActivarError(j.error || "El enlace no es válido o ya venció. Pedí uno nuevo al admin.");
        return;
      }
      localStorage.setItem(DEVICE_KEY, JSON.stringify({ uuid, token }));
      setDevice({ device_uuid: uuid, device_token: token });
    } catch {
      setActivarError("No hay conexión. Probá de nuevo.");
    } finally {
      setActivando(false);
    }
  }, [pegado]);

  const [qrToken, setQrToken] = useState(getStoredQr());
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const [supervisor, setSupervisor] = useState<{ id: number; nombre: string } | null>(null);
  const [agenda, setAgenda] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<number | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [agendaAbierta, setAgendaAbierta] = useState(false);
  const [generandoNovedad, setGenerandoNovedad] = useState(false);
  const jornada = useSupervisorJornada(device, qrToken);

  const cargar = useCallback(async () => {
    if (!device || !qrToken) return;
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API}/agente/supervision/mi-agenda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_uuid: device.device_uuid,
          device_token: device.device_token,
          qr_token: qrToken,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Error al cargar");
      setSupervisor(j.supervisor);
      setAgenda(j.agenda || []);
    } catch (e: any) {
      setError(e.message || "Error");
      if (
        e.message === "carnet_invalido" ||
        e.message === "no_es_supervisor" ||
        e.message === "carnet_no_corresponde_a_este_dispositivo"
      ) {
        setStoredQr(""); setQrToken(""); setSupervisor(null);
      }
    } finally { setLoading(false); }
  }, [device, qrToken]);

  useEffect(() => { if (qrToken) cargar(); }, [qrToken, cargar]);

  const startScan = useCallback(async () => {
    setError(null); setScanning(true);
    try {
      const scanner = new Html5Qrcode("isp-superv-scanner");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          let token = decoded.trim();
          // Soporta URLs tipo https://.../agente/scan/<token>
          const m = token.match(/\/agente\/scan\/([^/?#]+)/);
          if (m) token = m[1];
          scanner.stop().catch(() => {});
          scanner.clear();
          scannerRef.current = null;
          setScanning(false);
          setStoredQr(token);
          setQrToken(token);
        },
        () => {}
      );
    } catch (e: any) {
      setScanning(false);
      setError("No se pudo abrir la cámara: " + (e.message || e));
    }
  }, []);

  const stopScan = useCallback(async () => {
    try { await scannerRef.current?.stop(); scannerRef.current?.clear(); } catch {}
    scannerRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => () => { void stopScan(); }, [stopScan]);

  async function accion(prog: Visita, accion: "iniciar" | "completar" | "no-realizada") {
    if (!device || !qrToken) return;
    let observaciones: string | undefined;
    let motivo: string | undefined;
    if (accion === "completar") {
      observaciones = prompt("Observaciones (opcional):") || undefined;
    } else if (accion === "no-realizada") {
      motivo = prompt("Motivo (obligatorio, mín. 3 caracteres):") || "";
      if (motivo.trim().length < 3) return;
    }
    setWorking(prog.id); setError(null);
    try {
      const r = await fetch(`${API}/agente/supervision/${accion}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_uuid: device.device_uuid,
          device_token: device.device_token,
          qr_token: qrToken,
          programacion_id: prog.id,
          observaciones, motivo,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Error");
      await cargar();
    } catch (e: any) {
      setError(e.message || "Error");
    } finally { setWorking(null); }
  }

  if (!device) {
    // Diagnóstico: mostramos qué hay realmente en este navegador para que
    // el admin/usuario pueda ver si el problema es localStorage vacío vs
    // formato inesperado vs context-split (Safari ↔ PWA instalada en iOS).
    let rawLs = "";
    try { rawLs = localStorage.getItem(DEVICE_KEY) || ""; } catch { rawLs = "(localStorage bloqueado)"; }
    const tieneQr = (() => { try { return !!sessionStorage.getItem(QR_KEY); } catch { return false; } })();
    const ua = (typeof navigator !== "undefined" ? navigator.userAgent : "") || "";
    const esStandalone = (typeof window !== "undefined" &&
      (window.matchMedia?.("(display-mode: standalone)").matches ||
       (navigator as any).standalone === true));

    return (
      <div className="min-h-screen bg-[#060e1c] text-white p-4 flex flex-col items-center justify-center">
        <div className="w-full max-w-md space-y-4">
          <div className="text-center space-y-2">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
            <h2 className="text-lg font-bold">Este navegador no tiene credenciales de supervisor</h2>
            <p className="text-sm text-white/60">
              El teléfono puede estar registrado en el admin, pero <b>este navegador en particular</b>
              {" "}no tiene guardadas las credenciales de activación.
            </p>
          </div>

          <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-4 space-y-3">
            <p className="font-semibold text-emerald-300 text-sm">Activá esta app pegando el enlace</p>
            <p className="text-xs text-emerald-100/70">
              Pedile al admin el enlace de activación (botón QR en la fila del dispositivo) y pegalo abajo.
              Esto activa este navegador/PWA sin tener que abrirlo en Safari.
            </p>
            <textarea
              value={pegado}
              onChange={e => setPegado(e.target.value)}
              placeholder="https://ispsa.net/supervisor/activar?uuid=…&token=…"
              rows={3}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs font-mono text-white/90 placeholder-white/20 focus:border-emerald-500/40 focus:outline-none"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {activarError && (
              <p className="text-xs text-rose-300">{activarError}</p>
            )}
            <button
              onClick={() => void activarConEnlace()}
              disabled={activando || !pegado.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg text-sm transition"
            >
              {activando ? "Activando…" : "Activar este navegador"}
            </button>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-100/80 space-y-1.5">
            <p className="font-semibold text-amber-300">¿Por qué pasa esto?</p>
            <p>En iOS, Safari y la app instalada (icono en home) tienen memoria separada. Si activaste en uno, el otro no lo "ve". Con el campo de arriba activás directamente este contexto.</p>
          </div>

          <details className="bg-black/40 border border-white/10 rounded-xl p-3">
            <summary className="text-xs text-white/50 cursor-pointer select-none">Ver diagnóstico técnico</summary>
            <div className="mt-3 space-y-1.5 text-[11px] font-mono text-white/60 break-all">
              <p><span className="text-white/30">localStorage[isp_device]:</span> {rawLs ? rawLs : <span className="text-rose-400">(vacío)</span>}</p>
              <p><span className="text-white/30">sessionStorage[isp_supervisor_qr]:</span> {tieneQr ? <span className="text-emerald-400">presente</span> : <span className="text-rose-400">ausente</span>}</p>
              <p><span className="text-white/30">Modo:</span> {esStandalone ? <span className="text-violet-300">PWA instalada (standalone)</span> : "navegador (Safari/Chrome)"}</p>
              <p><span className="text-white/30">UA:</span> {ua.slice(0, 90)}</p>
            </div>
          </details>

          <a href="/agente/inicio" className="block text-center text-primary text-sm underline py-2">
            Volver al kiosco
          </a>
        </div>
      </div>
    );
  }

  if (!qrToken || !supervisor) {
    return (
      <div className="min-h-screen bg-[#060e1c] text-white p-4">
        <a href="/agente/inicio" className="inline-flex items-center gap-1 text-xs text-white/60 mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Volver
        </a>
        <h1 className="text-lg font-bold flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" /> Mi agenda de supervisión
        </h1>
        <p className="text-xs text-white/60 mt-1">
          Escanee su carnet QR para identificarse y ver sus visitas asignadas.
        </p>

        <div id="isp-superv-scanner" className="mt-4 max-w-sm mx-auto rounded overflow-hidden border border-white/10" />

        <div className="mt-4 flex flex-col items-center gap-3">
          {!scanning ? (
            <button onClick={startScan}
              className="px-4 py-2 bg-primary text-black text-sm font-bold rounded inline-flex items-center gap-2">
              <QrCode className="w-4 h-4" /> Escanear carnet
            </button>
          ) : (
            <button onClick={stopScan}
              className="px-4 py-2 bg-white/10 text-white text-sm rounded">
              Cancelar
            </button>
          )}
          {error && <p role="alert" className="text-rose-300 text-xs text-center max-w-sm">{error}</p>}
        </div>
      </div>
    );
  }

  // Próxima visita pendiente: la primera no completada/cancelada/no_realizada.
  const proxima = jornada.proxima || agenda.find(v => v.estado === "pendiente" || v.estado === "en_curso") || null;

  const handleGenerarNovedad = async () => {
    if (generandoNovedad) return;
    // prompt devuelve null si el usuario cancela: en ese caso no enviamos nada.
    const obsRaw = prompt("Observaciones para la novedad (opcional):");
    if (obsRaw === null) return;
    const obs = obsRaw.trim() || undefined;
    if (!confirm("¿Confirmar y generar la novedad consolidada de esta jornada?")) return;
    setGenerandoNovedad(true);
    try {
      const ids = await jornada.generarNovedad(obs);
      if (ids && ids.length > 0) {
        alert(`Novedad generada (${ids.length} ${ids.length === 1 ? "puesto" : "puestos"}).`);
      }
    } catch (e: any) {
      if (String(e?.message).includes("sin_inspecciones")) {
        alert("Aún no ha registrado inspecciones para consolidar.");
      } else {
        alert("Error al generar novedad: " + (e?.message || ""));
      }
    } finally {
      setGenerandoNovedad(false);
    }
  };

  const handleTerminarJornada = async () => {
    if (!confirm("¿Terminar la jornada de supervisión?")) return;
    await jornada.terminarJornada();
    setStoredQr(""); setQrToken(""); setSupervisor(null);
  };

  const sesion = jornada.sesion;
  const horaInicio = sesion ? new Date(sesion.hora_inicio_real).toLocaleTimeString("es-GT", {
    hour: "2-digit", minute: "2-digit",
  }) : null;

  return (
    <div className="min-h-screen bg-[#060e1c] text-white">
      <header className="sticky top-0 bg-[#0b1424] border-b border-white/10 px-4 py-3 z-10">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-violet-600/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-violet-300" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-white/50 uppercase tracking-wide">Supervisor</p>
              <h1 className="text-sm font-bold truncate">{supervisor.nombre}</h1>
            </div>
          </div>
          <button onClick={cargar} aria-label="Recargar" className="p-2 text-white/70 hover:text-white">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {sesion && (
          <div className="mt-2 flex items-center justify-between text-[11px] bg-emerald-500/10 border border-emerald-500/30 rounded px-2.5 py-1.5">
            <span className="text-emerald-200 inline-flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Jornada activa desde {horaInicio}
            </span>
            {sesion.hora_fin_planificada && (
              <span className="text-emerald-200/70">cierre prog. {sesion.hora_fin_planificada.slice(0,5)}</span>
            )}
          </div>
        )}
      </header>

      <main className="p-3 space-y-3 max-w-2xl mx-auto pb-24">
        {error && <div role="alert" className="text-rose-300 text-xs p-2 bg-rose-500/10 border border-rose-500/30 rounded">{error}</div>}
        {jornada.error && <div role="alert" className="text-rose-300 text-xs p-2 bg-rose-500/10 border border-rose-500/30 rounded">{jornada.error}</div>}

        {/* Próxima visita destacada */}
        {proxima ? (
          <article className="p-3 bg-violet-500/10 border border-violet-500/40 rounded-lg">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-[10px] text-violet-200 uppercase tracking-wide">Siguiente punto de la agenda</p>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${ESTADO_COLOR[proxima.estado as Visita["estado"]]}`}>
                {ESTADO_LABEL[proxima.estado as Visita["estado"]]}
              </span>
            </div>
            <p className="text-xs text-white/70 inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {proxima.fecha_planificada}
              {proxima.ventana_inicio ? ` · ${proxima.ventana_inicio}${proxima.ventana_fin ? `–${proxima.ventana_fin}` : ""}` : ""}
            </p>
            <h3 className="text-base font-bold mt-1">
              {[proxima.cliente_nombre, proxima.puesto_nombre].filter(Boolean).join(" · ") || "Sin destino"}
            </h3>
            {proxima.puesto_direccion && (
              <p className="text-[11px] text-white/60 inline-flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" /> {proxima.puesto_direccion}
              </p>
            )}
            {proxima.instrucciones && (
              <p className="text-[11px] text-white/70 mt-2 whitespace-pre-wrap">{proxima.instrucciones}</p>
            )}
            <div className="flex gap-2 mt-3">
              {proxima.estado === "pendiente" && (
                <Btn onClick={() => accion(proxima as Visita, "iniciar")} disabled={working === proxima.id}
                  icon={PlayCircle} label="Iniciar" tone="blue" />
              )}
              <Btn onClick={() => accion(proxima as Visita, "completar")} disabled={working === proxima.id}
                icon={CheckCircle2} label="Completar" tone="emerald" />
              <Btn onClick={() => accion(proxima as Visita, "no-realizada")} disabled={working === proxima.id}
                icon={XCircle} label="No realizada" tone="rose" />
            </div>
          </article>
        ) : (
          <p className="text-white/40 text-xs text-center py-4 bg-white/5 rounded">
            No tiene puntos pendientes en la agenda.
          </p>
        )}

        {/* Acciones principales */}
        <div className="grid grid-cols-1 gap-2">
          <button onClick={() => setModalAbierto(true)}
            className="bg-primary text-black font-bold py-4 rounded-lg inline-flex items-center justify-center gap-2 text-sm">
            <QrCode className="w-5 h-5" /> Escanear agente
          </button>
          <button onClick={handleGenerarNovedad} disabled={generandoNovedad}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg inline-flex items-center justify-center gap-2 text-sm">
            {generandoNovedad ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Generar novedad
          </button>
          <button onClick={handleTerminarJornada}
            className="bg-rose-600/20 border border-rose-500/40 hover:bg-rose-600/30 text-rose-100 font-semibold py-3 rounded-lg inline-flex items-center justify-center gap-2 text-sm">
            <LogOut className="w-4 h-4" /> Terminar jornada
          </button>
        </div>

        {/* Agenda completa colapsable */}
        <button onClick={() => setAgendaAbierta(v => !v)}
          className="w-full text-left flex items-center justify-between bg-white/5 px-3 py-2 rounded text-xs text-white/70">
          <span className="inline-flex items-center gap-1">
            <ClipboardList className="w-3.5 h-3.5" /> Toda mi agenda ({agenda.length})
          </span>
          {agendaAbierta ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {agendaAbierta && (
          <div className="space-y-2">
            {agenda.length === 0 && (
              <p className="text-white/40 text-xs text-center py-4">Sin visitas próximas.</p>
            )}
            {agenda.map(v => (
              <article key={v.id} className="p-3 bg-[#0b1424] border border-white/10 rounded-lg">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-white/60 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {v.fecha_planificada}
                      {v.ventana_inicio ? ` · ${v.ventana_inicio}${v.ventana_fin ? `–${v.ventana_fin}` : ""}` : ""}
                    </p>
                    <h3 className="text-sm font-bold mt-0.5">
                      {[v.cliente_nombre, v.puesto_nombre, v.zona_nombre].filter(Boolean).join(" · ") || "Sin destino"}
                    </h3>
                    {v.puesto_direccion && (
                      <p className="text-[11px] text-white/50 inline-flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {v.puesto_direccion}
                      </p>
                    )}
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${ESTADO_COLOR[v.estado]}`}>
                    {ESTADO_LABEL[v.estado]}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mt-2 text-[10px]">
                  <span className="px-1.5 py-0.5 bg-white/5 rounded text-white/60">{TIPO_LABEL[v.tipo]}</span>
                </div>
                {v.instrucciones && (
                  <p className="text-[11px] text-white/70 mt-2 whitespace-pre-wrap">{v.instrucciones}</p>
                )}
                {v.observaciones && (
                  <p className="text-[11px] text-amber-200/80 mt-1 italic whitespace-pre-wrap">Obs: {v.observaciones}</p>
                )}
                {(v.estado === "pendiente" || v.estado === "en_curso") && (
                  <div className="flex gap-2 mt-3">
                    {v.estado === "pendiente" && (
                      <Btn onClick={() => accion(v, "iniciar")} disabled={working === v.id}
                        icon={PlayCircle} label="Iniciar" tone="blue" />
                    )}
                    <Btn onClick={() => accion(v, "completar")} disabled={working === v.id}
                      icon={CheckCircle2} label="Completar" tone="emerald" />
                    <Btn onClick={() => accion(v, "no-realizada")} disabled={working === v.id}
                      icon={XCircle} label="No realizada" tone="rose" />
                    {working === v.id && <Loader2 className="w-4 h-4 animate-spin text-white/50 self-center" />}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        <button onClick={() => { setStoredQr(""); setQrToken(""); setSupervisor(null); }}
          className="w-full text-[11px] text-white/40 hover:text-white/70 py-2">
          Cerrar carnet (cambiar de supervisor)
        </button>
      </main>

      <ModalInspeccion
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        auth={jornada.auth}
        onRegistrado={() => { /* podrías recargar contadores si los hubiera */ }}
        gpsActual={jornada.gpsActual}
      />
    </div>
  );
}

const TONE: Record<string, string> = {
  blue:    "bg-blue-500/20 text-blue-100 border-blue-500/40 hover:bg-blue-500/30",
  emerald: "bg-emerald-500/20 text-emerald-100 border-emerald-500/40 hover:bg-emerald-500/30",
  rose:    "bg-rose-500/15 text-rose-200 border-rose-500/30 hover:bg-rose-500/25",
};

function Btn({ onClick, disabled, icon: Icon, label, tone }: {
  onClick: () => void; disabled?: boolean; icon: any; label: string; tone: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex-1 px-2 py-1.5 text-xs font-medium rounded border inline-flex items-center justify-center gap-1 disabled:opacity-50 ${TONE[tone]}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#060e1c] flex items-center justify-center p-6">
      <div className="text-center space-y-3 max-w-sm">{children}</div>
    </div>
  );
}
