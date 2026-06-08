/**
 * SolicitarAnticipo.tsx — Kiosco de solicitud de anticipo salarial
 * Ruta pública: /solicitar-anticipo
 *
 * Pasos:
 *  0 → Bienvenida (tenga su DPI a mano)
 *  1 → Escaneo DPI — IA extrae número (bloqueado, no editable) → busca empleado + calcula límite
 *  2 → Ingresar monto deseado
 *  3 → Confirmación y envío
 *  4 → Éxito
 *
 * Integración con AdminAnticipos (artifacts/isp-web/src/admin/pages/Anticipos.tsx):
 *  - Este kiosco hace POST a `${API}/anticipos` (mismo endpoint que `anticiposApi.create`).
 *  - El registro queda en la cola de admin con estado=`pendiente` y aparece en la
 *    pestaña "Pendientes" de AdminAnticipos para aprobación / rechazo.
 *  - El cálculo de límite se basa en `${API}/anticipos/config` y
 *    `${API}/anticipos/limite/:empleadoId?periodo=...`, que admin también consume,
 *    por lo que cualquier cambio de regla en AdminAnticipos se refleja acá sin
 *    duplicación de lógica.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import type React from "react";
import {
  CreditCard, CheckCircle2, Camera, RefreshCw, Loader2,
  AlertTriangle, Wallet, ChevronLeft, ShieldCheck,
} from "lucide-react";

import { calcularCobroAnticipo } from "@/lib/anticipo-cobro";

const API = `${import.meta.env.BASE_URL}api`;

// ── tipos ─────────────────────────────────────────────────────────────────────
interface EmpleadoAnticipo {
  id: number;
  nombre_completo: string;
  dpi: string;
  puesto: string | null;
  telefono: string | null;
  salario_base: number | null;
}

interface LimiteInfo {
  tieneLimite: boolean;
  limite: number | null;
  solicitado: number;
  restante: number | null;
  periodo: string | null;
}

// ── Pantalla de bienvenida ────────────────────────────────────────────────────
function PantallaBienvenida({ onComenzar }: { onComenzar: () => void }) {
  return (
    <div className="bg-[#0d2147] rounded-2xl p-8 w-full max-w-sm text-center shadow-2xl border border-[#1e3a6e]">
      <div className="w-20 h-20 rounded-2xl bg-[#0a1f3e] border border-[#1e3a6e] mx-auto mb-5 flex items-center justify-center">
        <Wallet className="text-blue-300" size={38} />
      </div>
      <h2 className="text-white text-2xl font-bold mb-2">Solicitud de Anticipo</h2>
      <p className="text-blue-300 text-sm mb-6">Verificación de identidad por DPI</p>

      <div className="bg-[#060f1e] border border-[#1e3a6e] rounded-xl p-5 mb-6 text-left flex flex-col gap-3">
        <p className="text-yellow-400 text-sm font-bold mb-1">Antes de comenzar:</p>
        {[
          "Tenga su DPI vigente a la mano",
          "Escanearemos el frente de su DPI para verificar su identidad",
          "La IA leerá los datos — no se ingresa nada manualmente",
        ].map((t, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-blue-300 text-xs font-bold">{i + 1}</span>
            </div>
            <span className="text-[#cbd5e1] text-sm leading-snug">{t}</span>
          </div>
        ))}
      </div>

      <button onClick={onComenzar}
        className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-lg font-bold rounded-xl transition-all">
        Comenzar
      </button>
    </div>
  );
}

// ── DPI Scan (solo frente — con el número ya basta para identificar) ──────────
type DpiPhase = "guide" | "scanning" | "aligning" | "stable" | "flash" | "captured";

function PasoDpiAnticipo({ onFrenteDone, frenteUrl, dpiExtraido, extrayendo, errorExtraccion, buscando, noEncontrado, onNext, onReintentar }: {
  onFrenteDone: (url: string) => void;
  frenteUrl: string | null;
  dpiExtraido: string | null;
  extrayendo: boolean;
  errorExtraccion: string | null;
  buscando: boolean;
  noEncontrado: boolean;
  onNext: () => void;
  onReintentar: () => void;
}) {
  const [phase, setPhase] = useState<DpiPhase>("guide");
  const [stability, setStability] = useState(0);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stabRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (stabRef.current)  clearInterval(stabRef.current);
  };
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };
  useEffect(() => () => { clearTimers(); stopCamera(); }, []);

  const openCamera = async () => {
    clearTimers(); setPhase("scanning"); setStability(0); setCapturedUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      timerRef.current = setTimeout(() => {
        setPhase("aligning");
        stabRef.current = setInterval(() => {
          setStability(prev => { if (prev >= 100) { clearInterval(stabRef.current!); return 100; } return prev + 2; });
        }, 80);
        timerRef.current = setTimeout(() => {
          setPhase("stable");
          timerRef.current = setTimeout(() => {
            const video = videoRef.current;
            if (video) {
              const W = 1280, H = 800;
              const cv = document.createElement("canvas");
              cv.width = W; cv.height = H;
              const ctx = cv.getContext("2d")!;
              const vw = video.videoWidth || W, vh = video.videoHeight || H;
              const scale = Math.max(W / vw, H / vh);
              const sw = W / scale, sh = H / scale;
              ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, W, H);
              setCapturedUrl(cv.toDataURL("image/jpeg", 0.92));
            }
            setPhase("flash"); stopCamera();
            timerRef.current = setTimeout(() => setPhase("captured"), 400);
          }, 3000);
        }, 4200);
      }, 1500);
    } catch {
      setPhase("guide");
      alert("No se pudo acceder a la cámara. Verifique los permisos.");
    }
  };

  const confirmCapture = () => {
    if (!capturedUrl) return;
    onFrenteDone(capturedUrl);
  };

  const retry = () => { clearTimers(); stopCamera(); setPhase("guide"); setStability(0); setCapturedUrl(null); };

  const canProceed = !!frenteUrl && !!dpiExtraido && !extrayendo && !buscando;

  if (noEncontrado) {
    return (
      <div className="bg-[#0d2147] rounded-2xl border border-red-500/25 w-full max-w-md shadow-2xl p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-900/20 border-2 border-red-500/30 mx-auto mb-5 flex items-center justify-center">
          <AlertTriangle size={30} className="text-red-400" />
        </div>
        <h2 className="text-white text-xl font-bold mb-2">DPI no registrado</h2>
        <p className="text-[#64748b] text-sm mb-4">
          El DPI <span className="text-white font-mono font-semibold">{dpiExtraido}</span> no se encontró en el sistema de colaboradores.
        </p>
        <p className="text-[#475569] text-xs mb-6">Comuníquese con Recursos Humanos si cree que esto es un error.</p>
        <button onClick={onReintentar}
          className="w-full py-3 border border-[#1e3a6e] text-blue-300 hover:bg-[#0f2a5e] font-semibold rounded-xl transition-all">
          Intentar de nuevo
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#0d2147] rounded-2xl border border-[#1e3a6e] w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden">
      {buscando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0d2147] border border-[#1e3a6e] rounded-2xl p-8 text-center">
            <Loader2 size={36} className="text-blue-400 animate-spin mx-auto mb-3" />
            <p className="text-white font-semibold">Buscando en el sistema...</p>
          </div>
        </div>
      )}

      <div className="bg-[#091a3d] px-5 py-4">
        <h2 className="text-white text-lg font-bold">Verificación de identidad</h2>
        <p className="text-blue-300 text-xs mt-1">Coloque el <span className="font-semibold text-white">frente</span> de su DPI frente a la cámara — la IA leerá el número automáticamente</p>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* Captura */}
        {!frenteUrl && (
          <div>
            {phase === "guide" && !capturedUrl && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-full max-w-sm aspect-[1.586/1] bg-[#060f1e] border-2 border-dashed border-[#1e3a6e] rounded-xl flex items-center justify-center">
                  <div className="text-center text-[#475569]">
                    <CreditCard size={40} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Toque para escanear el frente del DPI</p>
                  </div>
                </div>
                <button onClick={openCamera}
                  className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-8 py-3 rounded-xl font-bold text-base transition-all">
                  <Camera size={18} className="inline mr-2" />
                  Escanear DPI
                </button>
              </div>
            )}

            {(phase === "scanning" || phase === "aligning" || phase === "stable") && (
              <div className="relative flex flex-col items-center gap-3">
                <div className="relative w-full max-w-sm aspect-[1.586/1] rounded-xl overflow-hidden border-2 border-blue-500/60">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-[88%] h-[80%] border-2 border-yellow-400 rounded-lg opacity-80" />
                  </div>
                  <div className="absolute bottom-2 left-0 right-0 px-4">
                    <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-100 ${phase === "stable" ? "bg-green-400" : "bg-blue-400"}`}
                        style={{ width: `${stability}%` }} />
                    </div>
                  </div>
                </div>
                <p className="text-blue-300 text-sm animate-pulse">
                  {phase === "scanning" ? "Iniciando cámara..." : phase === "aligning" ? "Mantenga el DPI fijo dentro del recuadro..." : "¡Perfecto! Capturando..."}
                </p>
              </div>
            )}

            {phase === "flash" && (
              <div className="w-full max-w-sm aspect-[1.586/1] mx-auto bg-white rounded-xl animate-pulse" />
            )}

            {phase === "captured" && capturedUrl && (
              <div className="flex flex-col items-center gap-4">
                <img src={capturedUrl} alt="DPI capturado" className="w-full max-w-sm aspect-[1.586/1] object-cover rounded-xl border-2 border-emerald-500/40" />
                <div className="flex gap-3">
                  <button onClick={retry}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#1e3a6e] text-[#64748b] text-sm font-semibold hover:border-gray-500 transition-all">
                    <RefreshCw size={14} /> Reintentar
                  </button>
                  <button onClick={confirmCapture}
                    className="flex items-center gap-2 px-7 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all">
                    <CheckCircle2 size={14} /> Usar esta imagen
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Estado de extracción */}
        {frenteUrl && (
          <div className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${
            errorExtraccion ? "bg-red-900/20 border-red-500/30" :
            extrayendo ? "bg-blue-900/20 border-blue-500/30" :
            dpiExtraido ? "bg-emerald-900/20 border-emerald-500/30" : "bg-[#060f1e] border-[#1e3a6e]"
          }`}>
            {extrayendo && <Loader2 size={18} className="text-blue-400 animate-spin shrink-0 mt-0.5" />}
            {errorExtraccion && <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />}
            {dpiExtraido && !extrayendo && <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />}
            <div>
              {extrayendo && <p className="text-blue-300 text-sm font-semibold">Analizando DPI con inteligencia artificial...</p>}
              {errorExtraccion && (
                <>
                  <p className="text-red-300 text-sm font-semibold">No se pudo leer el DPI</p>
                  <p className="text-red-400/70 text-xs mt-0.5">{errorExtraccion}</p>
                  <button onClick={() => { retry(); onReintentar(); }}
                    className="mt-2 text-xs text-blue-400 underline">Intentar de nuevo</button>
                </>
              )}
              {dpiExtraido && !extrayendo && (
                <>
                  <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-0.5">DPI detectado por IA</p>
                  <p className="text-white font-mono text-lg font-bold">{dpiExtraido}</p>
                  <p className="text-[#64748b] text-xs mt-0.5">Este número no puede ser modificado manualmente</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="px-5 py-4 border-t border-[#1e3a6e] flex justify-end">
        <button onClick={onNext} disabled={!canProceed}
          className="px-8 py-3 rounded-xl text-white font-bold text-base transition-all"
          style={{
            background: canProceed ? "#2563eb" : "#0f2147",
            color: canProceed ? "#fff" : "#64748b",
            cursor: canProceed ? "pointer" : "not-allowed",
            opacity: canProceed ? 1 : 0.6,
          }}>
          Continuar →
        </button>
      </div>
    </div>
  );
}

// ── Paso 2: Ingresar monto ────────────────────────────────────────────────────
function PasoMonto({ empleado, limite, monto, setMonto, onNext, onBack, errorMonto }: {
  empleado: EmpleadoAnticipo;
  limite: LimiteInfo;
  monto: string;
  setMonto: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
  errorMonto: string | null;
}) {
  const restante = limite.restante;
  const disponible = restante !== null ? restante : null;

  const montoNum = parseFloat(monto.replace(/[^0-9.]/g, "")) || 0;
  const excede = disponible !== null && montoNum > disponible;
  const vacio = !monto || montoNum <= 0;

  return (
    <div className="bg-[#0d2147] rounded-2xl border border-[#1e3a6e] w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
      <div className="bg-[#091a3d] px-5 py-4">
        <h2 className="text-white text-lg font-bold">Solicitar anticipo</h2>
        <p className="text-blue-300 text-xs mt-1">{empleado.nombre_completo}</p>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Info del colaborador */}
        <div className="bg-[#060f1e] border border-[#1e3a6e] rounded-xl p-4 flex flex-col gap-1">
          <p className="text-[#64748b] text-xs">Colaborador verificado</p>
          <p className="text-white font-semibold text-base">{empleado.nombre_completo}</p>
          {empleado.puesto && <p className="text-blue-400 text-xs">{empleado.puesto}</p>}
          <p className="text-[#475569] text-xs font-mono mt-1">DPI: {empleado.dpi}</p>
        </div>

        {/* Límite disponible */}
        {limite.tieneLimite && disponible !== null ? (
          <div className={`rounded-xl px-4 py-3 border ${disponible <= 0 ? "bg-red-900/15 border-red-500/25" : "bg-emerald-900/15 border-emerald-500/25"}`}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: disponible <= 0 ? "#f87171" : "#34d399" }}>
              Saldo disponible este período
            </p>
            <p className="text-white text-2xl font-black">Q{disponible.toLocaleString("es-GT")}</p>
            {limite.solicitado > 0 && (
              <p className="text-[#64748b] text-xs mt-1">Ya solicitó: Q{limite.solicitado.toLocaleString("es-GT")} de Q{limite.limite?.toLocaleString("es-GT")}</p>
            )}
          </div>
        ) : (
          <div className="bg-blue-900/15 border border-blue-500/25 rounded-xl px-4 py-3">
            <p className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-0.5">Sin límite configurado</p>
            <p className="text-[#94a3b8] text-xs">Recursos Humanos revisará el monto solicitado.</p>
          </div>
        )}

        {/* Input monto */}
        {(disponible === null || disponible > 0) && (
          <div className="flex flex-col gap-2">
            <label className="text-[#94a3b8] text-xs font-semibold uppercase tracking-wide">Monto a solicitar (Q)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748b] font-bold text-lg">Q</span>
              <input
                type="number" inputMode="numeric" min="1"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                placeholder="0"
                className={`w-full bg-[#060f1e] border rounded-xl pl-10 pr-4 py-4 text-white text-2xl font-bold placeholder-[#334155] focus:outline-none transition-colors ${
                  excede ? "border-red-500/60" : "border-[#1e3a6e] focus:border-blue-500/60"
                }`}
              />
            </div>
            {excede && (
              <p className="text-red-400 text-xs">El monto excede el saldo disponible de Q{disponible?.toLocaleString("es-GT")}.</p>
            )}
            {errorMonto && <p className="text-red-400 text-xs">{errorMonto}</p>}
            {montoNum > 0 && !excede && (
              <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl px-4 py-3">
                <p className="text-amber-300 text-xs font-semibold uppercase tracking-wider mb-1">Descuento de planilla (1 pago)</p>
                <p className="text-amber-200 text-xl font-black">Q{calcularCobroAnticipo(montoNum, 1).montoCobro.toLocaleString("es-GT", { minimumFractionDigits: 2 })}</p>
                <p className="text-amber-400/70 text-xs mt-0.5">Incluye 10% de comisión si se paga en 1 cuota. Aumenta 5% por cada cuota adicional que apruebe RRHH.</p>
              </div>
            )}
          </div>
        )}

        {disponible !== null && disponible <= 0 && (
          <div className="bg-red-900/15 border border-red-500/20 rounded-xl p-4 text-center">
            <p className="text-red-400 text-sm font-semibold">Sin saldo disponible</p>
            <p className="text-[#64748b] text-xs mt-1">Ya alcanzó el límite de anticipo para este período.</p>
          </div>
        )}
      </div>

      <div className="px-5 py-4 border-t border-[#1e3a6e] flex justify-between gap-3">
        <button onClick={onBack}
          className="flex items-center gap-1 px-5 py-3 rounded-xl border border-[#1e3a6e] text-[#64748b] text-sm font-semibold">
          <ChevronLeft size={16} /> Atrás
        </button>
        <button
          onClick={onNext}
          disabled={vacio || excede || (disponible !== null && disponible <= 0)}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white font-bold text-base transition-all">
          Confirmar →
        </button>
      </div>
    </div>
  );
}

// ── Paso 3: Foto (mismo patrón KioscoSolicitud — videoRef desde el padre) ─────
function PasoFotoAnticipo({ videoRef, camActiva, camError, fotoUrl, onCapturar, onRehacer, onReintentar, onBack, onNext }: {
  videoRef: React.RefObject<HTMLVideoElement>;
  camActiva: boolean; camError: boolean; fotoUrl: string | null;
  onCapturar: () => void; onRehacer: () => void; onReintentar: () => void;
  onBack: () => void; onNext: () => void;
}) {
  return (
    <div className="bg-[#0d2147] rounded-2xl border border-[#1e3a6e] w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
      <div className="bg-[#091a3d] px-5 py-4">
        <h2 className="text-white text-lg font-bold">Fotografía de rostro</h2>
        <p className="text-blue-300 text-xs mt-1">Tome una foto para registrar la solicitud</p>
      </div>
      <div className="p-5 flex flex-col items-center gap-4">
        {!fotoUrl ? (
          camError ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-48 h-48 rounded-full border-4 border-red-500 bg-[#0a1628] flex flex-col items-center justify-center gap-2 p-4">
                <p className="text-red-400 text-sm font-bold">Sin acceso a cámara</p>
                <p className="text-[#64748b] text-xs">Verifique que el navegador tiene permiso para usar la cámara.</p>
              </div>
              <button onClick={onReintentar} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl text-sm font-bold">
                Reintentar cámara
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-56 h-56 rounded-full overflow-hidden border-4 border-blue-500 bg-[#0a1628]">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                {!camActiva && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-blue-700 text-center">
                      <Camera size={32} className="mx-auto mb-1 opacity-50" />
                      <p className="text-xs">Cargando cámara...</p>
                    </div>
                  </div>
                )}
              </div>
              {camActiva && (
                <button onClick={onCapturar}
                  className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-10 py-3 text-base rounded-xl font-bold transition-all">
                  Tomar Foto
                </button>
              )}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-56 h-56 rounded-full overflow-hidden border-4 border-green-500" style={{ boxShadow: "0 0 20px rgba(34,197,94,0.3)" }}>
              <img src={fotoUrl} alt="Foto capturada" className="w-full h-full object-cover" />
            </div>
            <button onClick={onRehacer} className="border border-[#1e3a6e] text-[#64748b] px-6 py-2 rounded-xl text-sm font-semibold">
              Repetir foto
            </button>
          </div>
        )}
        {!fotoUrl && (
          <div className="w-full bg-[#071630] border border-[#1d3a6e] rounded-xl px-4 py-3">
            <p className="text-blue-300 text-xs font-bold mb-1">Consejos:</p>
            <ul className="text-[#64748b] text-xs space-y-1 pl-3">
              <li>Mire directo a la cámara</li>
              <li>Buena iluminación, no contra la luz</li>
              <li>Sin gorra ni lentes oscuros</li>
            </ul>
          </div>
        )}
      </div>
      <div className="px-5 py-4 border-t border-[#1e3a6e] flex justify-between items-center gap-3">
        <button onClick={onBack}
          className="flex items-center gap-1 px-5 py-3 rounded-xl border border-[#1e3a6e] text-[#64748b] text-sm font-semibold">
          <ChevronLeft size={16} /> Atrás
        </button>
        <button onClick={onNext} disabled={!fotoUrl}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-white font-bold text-base transition-all">
          Continuar →
        </button>
      </div>
    </div>
  );
}

// ── Paso 4: Confirmación ──────────────────────────────────────────────────────
function PasoConfirmacion({ empleado, monto, fotoUrl, onConfirmar, onBack, enviando }: {
  empleado: EmpleadoAnticipo;
  monto: number;
  fotoUrl: string | null;
  onConfirmar: () => void;
  onBack: () => void;
  enviando: boolean;
}) {
  return (
    <div className="bg-[#0d2147] rounded-2xl border border-[#1e3a6e] w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
      <div className="bg-[#091a3d] px-5 py-4">
        <h2 className="text-white text-lg font-bold">Confirmar solicitud</h2>
      </div>
      <div className="p-6 flex flex-col gap-4">
        {fotoUrl && (
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-green-500">
              <img src={fotoUrl} alt="Foto colaborador" className="w-full h-full object-cover" />
            </div>
          </div>
        )}
        <div className="bg-[#060f1e] border border-[#1e3a6e] rounded-xl p-4 flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span className="text-[#64748b]">Colaborador</span>
            <span className="text-white font-semibold">{empleado.nombre_completo}</span>
          </div>
          {empleado.puesto && (
            <div className="flex justify-between text-sm">
              <span className="text-[#64748b]">Puesto</span>
              <span className="text-[#94a3b8]">{empleado.puesto}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-[#64748b]">DPI verificado</span>
            <span className="text-white font-mono">{empleado.dpi}</span>
          </div>
          <div className="border-t border-[#1e3a6e] pt-3 mt-1 flex justify-between items-center">
            <span className="text-[#64748b] text-sm">Monto solicitado</span>
            <span className="text-white text-xl font-black">Q{monto.toLocaleString("es-GT")}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-amber-400/80 text-sm">Descuento de planilla (1 pago, +10%)</span>
            <span className="text-amber-300 text-xl font-black">
              Q{calcularCobroAnticipo(monto, 1).montoCobro.toLocaleString("es-GT", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[#64748b] text-xs">
            Si RRHH lo aprueba en varias cuotas, la comisión sube 5% por cada cuota adicional.
          </p>
        </div>
        <p className="text-[#64748b] text-xs text-center">
          Al confirmar, su solicitud quedará en estado <span className="text-yellow-400 font-semibold">Pendiente</span> hasta ser aprobada por Recursos Humanos.
        </p>
      </div>
      <div className="px-5 py-4 border-t border-[#1e3a6e] flex justify-between gap-3">
        <button onClick={onBack} disabled={enviando}
          className="flex items-center gap-1 px-5 py-3 rounded-xl border border-[#1e3a6e] text-[#64748b] text-sm font-semibold">
          <ChevronLeft size={16} /> Atrás
        </button>
        <button onClick={onConfirmar} disabled={enviando}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-white font-bold text-base transition-all flex items-center gap-2">
          {enviando ? <><Loader2 size={16} className="animate-spin" /> Enviando...</> : "Enviar solicitud"}
        </button>
      </div>
    </div>
  );
}

// ── Paso 4: Éxito ─────────────────────────────────────────────────────────────
function PantallaExito({ nombre, monto, onReiniciar }: { nombre: string; monto: number; onReiniciar: () => void }) {
  return (
    <div className="bg-[#0d2147] rounded-2xl p-10 w-full max-w-md text-center shadow-2xl border border-[#1e3a6e]">
      <div className="w-20 h-20 rounded-full bg-[#052e16] border-4 border-green-500 mx-auto mb-6 flex items-center justify-center"
        style={{ boxShadow: "0 0 30px rgba(34,197,94,0.3)" }}>
        <ShieldCheck size={36} className="text-green-400" />
      </div>
      <h2 className="text-white text-3xl font-bold mb-2">¡Solicitud enviada!</h2>
      <p className="text-blue-300 text-base mb-3">
        Se registró la solicitud de <span className="text-white font-semibold">{nombre}</span>
      </p>
      <div className="bg-[#060f1e] border border-[#1e3a6e] rounded-xl p-4 mb-6">
        <p className="text-[#64748b] text-xs mb-1">Monto solicitado</p>
        <p className="text-white text-3xl font-black">Q{monto.toLocaleString("es-GT")}</p>
        <p className="text-yellow-400 text-xs mt-2 font-semibold">Estado: Pendiente de aprobación</p>
      </div>
      <p className="text-[#475569] text-sm mb-8">Recursos Humanos revisará su solicitud y le notificará la resolución.</p>
      <button onClick={onReiniciar}
        className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-lg font-bold rounded-xl transition-all">
        Finalizar
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function SolicitarAnticipo() {
  const [paso, setPaso] = useState(0);

  // DPI
  const [frenteUrl, setFrenteUrl]       = useState<string | null>(null);
  const [dpiExtraido, setDpiExtraido]   = useState<string | null>(null);
  const [extrayendo, setExtrayendo]     = useState(false);
  const [errorExtraccion, setErrorExtraccion] = useState<string | null>(null);

  // Empleado + límite
  const [empleado, setEmpleado]         = useState<EmpleadoAnticipo | null>(null);
  const [limite, setLimite]             = useState<LimiteInfo>({ tieneLimite: false, limite: null, solicitado: 0, restante: null, periodo: null });
  const [buscando, setBuscando]         = useState(false);
  const [noEncontrado, setNoEncontrado] = useState(false);

  // Monto
  const [monto, setMonto]               = useState("");
  const [errorMonto, setErrorMonto]     = useState<string | null>(null);

  // Foto (cámara manejada en el padre)
  const [fotoUrl, setFotoUrl]           = useState<string | null>(null);
  const [fotoBlob, setFotoBlob]         = useState<Blob | null>(null);
  const [camActiva, setCamActiva]       = useState(false);
  const [camError, setCamError]         = useState(false);
  const fotoVideoRef                    = useRef<HTMLVideoElement>(null);
  const fotoStreamRef                   = useRef<MediaStream | null>(null);

  // Envío
  const [enviando, setEnviando]         = useState(false);
  const [montoFinal, setMontoFinal]     = useState(0);

  const iniciarCamara = useCallback(async () => {
    setCamError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
      });
      fotoStreamRef.current = stream;
      if (fotoVideoRef.current) fotoVideoRef.current.srcObject = stream;
      setCamActiva(true);
    } catch { setCamError(true); }
  }, []);

  const detenerCamara = useCallback(() => {
    fotoStreamRef.current?.getTracks().forEach(t => t.stop());
    fotoStreamRef.current = null;
    setCamActiva(false);
  }, []);

  const capturarFoto = useCallback(() => {
    const video = fotoVideoRef.current;
    if (!video) return;
    const SIZE = 400;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext("2d")!;
    const vw = video.videoWidth || SIZE, vh = video.videoHeight || SIZE;
    const scale = Math.max(SIZE / vw, SIZE / vh);
    const sw = SIZE / scale, sh = SIZE / scale;
    ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, SIZE, SIZE);
    canvas.toBlob(b => {
      if (!b) { setCamError(true); return; }
      setFotoBlob(b);
      setFotoUrl(URL.createObjectURL(b));
      detenerCamara();
    }, "image/jpeg", 0.9);
  }, [detenerCamara]);

  useEffect(() => {
    if (paso === 3) iniciarCamara();
    else if (camActiva) detenerCamara();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso]);

  const reiniciar = () => {
    setPaso(0);
    setFrenteUrl(null); setDpiExtraido(null);
    setExtrayendo(false); setErrorExtraccion(null);
    setEmpleado(null); setLimite({ tieneLimite: false, limite: null, solicitado: 0, restante: null, periodo: null });
    setBuscando(false); setNoEncontrado(false);
    setMonto(""); setErrorMonto(null);
    setFotoUrl(null); setFotoBlob(null); detenerCamara();
    setEnviando(false); setMontoFinal(0);
  };

  // Captura frente → extraer DPI con IA
  const handleFrenteDone = useCallback(async (url: string) => {
    setFrenteUrl(url);
    setExtrayendo(true);
    setErrorExtraccion(null);
    setDpiExtraido(null);
    try {
      const r = await fetch(`${API}/solicitudes-empleo/extraer-dpi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagen: url }),
      });
      if (r.ok) {
        const { datos } = await r.json();
        if (datos?.dpi) {
          const dpi = datos.dpi as string;
          setDpiExtraido(dpi);
          // Buscar empleado inmediatamente
          setBuscando(true);
          setNoEncontrado(false);
          try {
            const emp = await fetch(`${API}/employees/by-dpi/${encodeURIComponent(dpi)}`);
            if (emp.ok) {
              const data = await emp.json();
              setEmpleado(data);
              // Calcular límite
              const cfg = await fetch(`${API}/anticipos/config`);
              const cfgData = await cfg.json();
              const periodo = cfgData.periodoActual as string | null;
              if (periodo && data.id) {
                const limResp = await fetch(`${API}/anticipos/limite/${data.id}?periodo=${encodeURIComponent(periodo)}`);
                if (limResp.ok) setLimite(await limResp.json());
              }
            } else {
              setNoEncontrado(true);
            }
          } catch { setNoEncontrado(true); }
          finally { setBuscando(false); }
        } else {
          setErrorExtraccion("No se detectó el número de DPI. Intente de nuevo con mejor iluminación.");
        }
      } else {
        setErrorExtraccion("Error al analizar la imagen. Reintente.");
      }
    } catch {
      setErrorExtraccion("Error de conexión al analizar el DPI.");
    } finally {
      setExtrayendo(false);
    }
  }, []);

  const handleNextDpi = () => {
    if (empleado) setPaso(2);
  };

  const handleEnviar = async () => {
    const montoNum = parseFloat(monto.replace(/[^0-9.]/g, "")) || 0;
    if (!empleado || montoNum <= 0) return;
    setEnviando(true);
    setErrorMonto(null);
    try {
      let fotoGuardada: string | null = null;
      if (fotoBlob) {
        const fd = new FormData();
        fd.append("foto", fotoBlob, "foto.jpg");
        const up = await fetch(`${API}/empleados/upload-foto`, { method: "POST", body: fd });
        if (up.ok) { const d = await up.json(); fotoGuardada = d.url ?? null; }
      }
      const r = await fetch(`${API}/anticipos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre:     empleado.nombre_completo,
          empleadoId: empleado.id,
          dpi:        empleado.dpi,
          puesto:     empleado.puesto,
          telefono:   empleado.telefono,
          cantidad:   montoNum,
          origen:     "kiosco",
          ...(fotoGuardada ? { foto_url: fotoGuardada } : {}),
        }),
      });
      if (r.ok) {
        setMontoFinal(montoNum);
        setPaso(5);
      } else {
        const err = await r.json();
        if (err.error === "excede_limite") {
          setErrorMonto(err.mensaje ?? "El monto excede el límite disponible.");
          setPaso(2);
        } else {
          alert(err.mensaje ?? "Error al enviar la solicitud. Intente de nuevo.");
        }
      }
    } catch {
      alert("Error de conexión. Intente de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
      style={{ background: "radial-gradient(ellipse at 50% 0%, #0a1a3e 0%, #060f1e 70%)" }}>
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#1a4090,#0d2a6e)" }}>
          <span className="text-white font-black text-xl">ISP</span>
        </div>
        <p className="text-blue-300 text-sm">Solicitud de anticipo salarial</p>
      </div>

      {/* Paso 0: Bienvenida */}
      {paso === 0 && <PantallaBienvenida onComenzar={() => setPaso(1)} />}

      {/* Paso 1: DPI Scan */}
      {paso === 1 && (
        <div className="w-full max-w-2xl">
          <PasoDpiAnticipo
            onFrenteDone={handleFrenteDone}
            frenteUrl={frenteUrl}
            dpiExtraido={dpiExtraido}
            extrayendo={extrayendo}
            errorExtraccion={errorExtraccion}
            buscando={buscando}
            noEncontrado={noEncontrado}
            onNext={handleNextDpi}
            onReintentar={() => {
              setFrenteUrl(null); setDpiExtraido(null);
              setErrorExtraccion(null); setNoEncontrado(false);
            }}
          />
        </div>
      )}

      {/* Paso 2: Monto */}
      {paso === 2 && empleado && (
        <PasoMonto
          empleado={empleado}
          limite={limite}
          monto={monto}
          setMonto={setMonto}
          errorMonto={errorMonto}
          onNext={() => setPaso(3)}
          onBack={() => setPaso(1)}
        />
      )}

      {/* Paso 3: Foto de rostro */}
      {paso === 3 && (
        <PasoFotoAnticipo
          videoRef={fotoVideoRef}
          camActiva={camActiva}
          camError={camError}
          fotoUrl={fotoUrl}
          onCapturar={capturarFoto}
          onRehacer={() => { setFotoUrl(null); setFotoBlob(null); iniciarCamara(); }}
          onReintentar={iniciarCamara}
          onBack={() => setPaso(2)}
          onNext={() => setPaso(4)}
        />
      )}

      {/* Paso 4: Confirmación */}
      {paso === 4 && empleado && (
        <PasoConfirmacion
          empleado={empleado}
          monto={parseFloat(monto.replace(/[^0-9.]/g, "")) || 0}
          fotoUrl={fotoUrl}
          onConfirmar={handleEnviar}
          onBack={() => setPaso(3)}
          enviando={enviando}
        />
      )}

      {/* Paso 5: Éxito */}
      {paso === 5 && (
        <PantallaExito
          nombre={empleado?.nombre_completo ?? ""}
          monto={montoFinal}
          onReiniciar={reiniciar}
        />
      )}
    </div>
  );
}
