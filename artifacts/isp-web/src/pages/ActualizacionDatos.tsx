/**
 * ActualizacionDatos.tsx — Portal de autoservicio para colaboradores
 * Ruta pública: /actualizacion-datos
 *
 * Pasos:
 *  0 → Bienvenida (tenga su DPI a mano)
 *  1 → Escaneo DPI (frente + reverso, IA extrae el número — NO es editable)
 *  2 → Confirmar identidad (muestra nombre encontrado)
 *  3 → Actualizar datos de contacto
 *  4 → Fotografía de rostro (opcional)
 *  5 → Éxito
 */
import { useState, useRef, useCallback, useEffect } from "react";
import type React from "react";
import { CreditCard, CheckCircle2, Camera, ChevronLeft, RefreshCw, Loader2, ShieldCheck, AlertTriangle, UserCheck } from "lucide-react";

const API = `${import.meta.env.BASE_URL}api`;

// ── helpers ───────────────────────────────────────────────────────────────────
async function comprimirFoto(blob: Blob): Promise<Blob> {
  return new Promise((res) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const SIZE = 480;
      const cv = document.createElement("canvas");
      const sc = Math.min(SIZE / img.width, SIZE / img.height);
      cv.width = img.width * sc; cv.height = img.height * sc;
      cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob((b) => res(b!), "image/jpeg", 0.82);
    };
    img.src = url;
  });
}

async function subirFoto(blob: Blob): Promise<string> {
  const r = await fetch(`${API}/solicitudes-empleo/foto`, {
    method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob,
  });
  if (!r.ok) throw new Error("Error subiendo foto");
  const { objectPath } = await r.json();
  return objectPath as string;
}

// ── tipos ─────────────────────────────────────────────────────────────────────
interface Empleado {
  id: number;
  nombre_completo: string;
  dpi: string;
  telefono: string | null;
  telefono_secundario: string | null;
  correo: string | null;
  direccion: string | null;
  municipio: string | null;
  departamento: string | null;
  foto_url: string | null;
  banco: string | null;
  cuenta_bancaria: string | null;
  forma_pago: string | null;
  tipo_cuenta: string | null;
  nombre_contacto_emergencia: string | null;
  telefono_emergencia: string | null;
  parentesco_emergencia: string | null;
  dpi_frente_url: string | null;
  dpi_reverso_url: string | null;
  puesto: string | null;
}

interface Contacto {
  telefono: string;
  telefono_secundario: string;
  correo: string;
  direccion: string;
  municipio: string;
  departamento: string;
  banco: string;
  forma_pago: string;
  tipo_cuenta: string;
  cuenta_bancaria: string;
  nombre_contacto_emergencia: string;
  telefono_emergencia: string;
  parentesco_emergencia: string;
}

// ── Pantalla de bienvenida ────────────────────────────────────────────────────
function PantallaBienvenida({ onComenzar }: { onComenzar: () => void }) {
  return (
    <div className="bg-[#0d2147] rounded-2xl p-8 w-full max-w-sm text-center shadow-2xl border border-[#1e3a6e]">
      <div className="w-20 h-20 rounded-2xl bg-[#0f2a5e] border border-[#1e3a6e] mx-auto mb-5 flex items-center justify-center">
        <CreditCard className="text-blue-300" size={38} />
      </div>
      <h2 className="text-white text-2xl font-bold mb-2">Actualización de Datos</h2>
      <p className="text-blue-300 text-sm mb-6">Portal de autoservicio para colaboradores</p>

      <div className="bg-[#060f1e] border border-[#1e3a6e] rounded-xl p-5 mb-6 text-left flex flex-col gap-3">
        <p className="text-yellow-400 text-sm font-bold mb-1">Antes de comenzar:</p>
        {[
          "Tenga su DPI vigente a la mano",
          "Necesitará escanear el frente y el reverso",
          "La IA leerá los datos automáticamente — no se ingresa nada a mano",
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

// ── DPI Scan ──────────────────────────────────────────────────────────────────
type DpiPhase = "guide" | "scanning" | "aligning" | "stable" | "flash" | "captured";

interface PasoDpiProps {
  onFrenteDone: (url: string) => void;
  onReversoDone: (url: string) => void;
  frenteUrl: string | null;
  reversoUrl: string | null;
  dpiExtraido: string | null;
  extrayendo: boolean;
  errorExtraccion: string | null;
  onNext: () => void;
}

function PasoDpi({ onFrenteDone, onReversoDone, frenteUrl, reversoUrl, dpiExtraido, extrayendo, errorExtraccion, onNext }: PasoDpiProps) {
  const [side, setSide] = useState<"front" | "back">("front");
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
              ctx.drawImage(video, (vw-sw)/2, (vh-sh)/2, sw, sh, 0, 0, W, H);
              setCapturedUrl(cv.toDataURL("image/jpeg", 0.92));
            }
            setPhase("flash"); stopCamera();
            timerRef.current = setTimeout(() => setPhase("captured"), 400);
          }, 3000);
        }, 4200);
      }, 1500);
    } catch {
      setPhase("guide");
      alert("No se pudo acceder a la cámara. Verifique los permisos del navegador.");
    }
  };

  const confirmCapture = () => {
    if (!capturedUrl) return;
    if (side === "front") {
      onFrenteDone(capturedUrl);
      setSide("back"); setPhase("guide"); setStability(0); setCapturedUrl(null);
    } else {
      onReversoDone(capturedUrl);
      setPhase("guide");
    }
  };

  const retry = () => { clearTimers(); stopCamera(); setPhase("guide"); setStability(0); setCapturedUrl(null); };

  const bothDone = !!frenteUrl && !!reversoUrl;
  const canProceed = bothDone && !!dpiExtraido && !extrayendo;

  return (
    <div className="bg-[#0d2147] rounded-2xl border border-[#1e3a6e] w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden">
      <div className="bg-[#091a3d] px-5 py-4">
        <h2 className="text-white text-lg font-bold">Escaneo de DPI</h2>
        <p className="text-blue-300 text-xs mt-1">La IA leerá su número de DPI automáticamente — no es necesario ingresarlo manualmente</p>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* Indicadores frente/reverso */}
        <div className="flex gap-3">
          {(["front","back"] as const).map(s => {
            const done = s === "front" ? !!frenteUrl : !!reversoUrl;
            const active = side === s && !bothDone;
            return (
              <div key={s} className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                done ? "bg-emerald-900/20 border-emerald-500/30 text-emerald-400"
                : active ? "bg-blue-900/30 border-blue-400/40 text-blue-300"
                : "bg-[#060f1e] border-[#1e3a6e] text-[#475569]"
              }`}>
                {done ? <CheckCircle2 size={16} /> : <Camera size={16} />}
                <span className="text-sm font-semibold">{s === "front" ? "Anverso" : "Reverso"}</span>
                {done && <span className="text-xs ml-auto">✓ Capturado</span>}
              </div>
            );
          })}
        </div>

        {/* Área de cámara */}
        {!bothDone && (
          <div>
            <p className="text-blue-300 text-sm font-semibold mb-3">
              {side === "front" ? "Coloque el frente del DPI" : "Ahora coloque el reverso del DPI"}
            </p>

            {phase === "guide" && !capturedUrl && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-full max-w-sm aspect-[1.586/1] bg-[#060f1e] border-2 border-dashed border-[#1e3a6e] rounded-xl flex items-center justify-center">
                  <div className="text-center text-[#475569]">
                    <Camera size={40} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Toque el botón para escanear</p>
                  </div>
                </div>
                <button onClick={openCamera}
                  className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-8 py-3 rounded-xl font-bold text-base transition-all">
                  <Camera size={18} className="inline mr-2" />
                  Escanear {side === "front" ? "frente" : "reverso"}
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

        {/* Estado de extracción AI */}
        {bothDone && (
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
                </>
              )}
              {dpiExtraido && !extrayendo && (
                <>
                  <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-0.5">DPI detectado por IA</p>
                  <p className="text-white font-mono text-lg font-bold">{dpiExtraido}</p>
                  <p className="text-emerald-400/60 text-xs mt-0.5">Este número no puede ser modificado manualmente</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="px-5 py-4 border-t border-[#1e3a6e] flex justify-end">
        <button onClick={onNext} disabled={!canProceed}
          className="px-8 py-3 rounded-xl text-white font-bold text-base transition-all"
          style={{ background: canProceed ? "#2563eb" : "#0f2147", color: canProceed ? "#fff" : "#64748b", cursor: canProceed ? "pointer" : "not-allowed", opacity: canProceed ? 1 : 0.6 }}>
          Buscar mi perfil →
        </button>
      </div>
    </div>
  );
}

// ── Pantalla confirmación de identidad ────────────────────────────────────────
function PantallaConfirmacion({ empleado, onContinuar, onNuevoIntento }: {
  empleado: Empleado; onContinuar: () => void; onNuevoIntento: () => void;
}) {
  return (
    <div className="bg-[#0d2147] rounded-2xl border border-[#1e3a6e] w-full max-w-md shadow-2xl p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-900/30 border-2 border-emerald-500/40 mx-auto mb-5 flex items-center justify-center">
        <UserCheck size={30} className="text-emerald-400" />
      </div>
      <p className="text-blue-300 text-xs uppercase tracking-wider mb-1">Colaborador encontrado</p>
      <h2 className="text-white text-2xl font-bold mb-1">{empleado.nombre_completo}</h2>
      {empleado.puesto && <p className="text-blue-400 text-sm mb-5">{empleado.puesto}</p>}
      <div className="bg-[#060f1e] border border-[#1e3a6e] rounded-xl p-3 mb-6 text-left">
        <p className="text-[#64748b] text-xs mb-1">DPI registrado</p>
        <p className="text-white font-mono text-base font-semibold">{empleado.dpi}</p>
      </div>
      <p className="text-[#64748b] text-sm mb-6">¿Es usted esta persona? Confirme para continuar actualizando sus datos.</p>
      <div className="flex flex-col gap-3">
        <button onClick={onContinuar}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all">
          Sí, continuar
        </button>
        <button onClick={onNuevoIntento}
          className="w-full py-2.5 border border-[#1e3a6e] text-[#64748b] hover:text-white text-sm rounded-xl transition-all">
          No soy yo — reintentar escaneo
        </button>
      </div>
    </div>
  );
}

// ── Pantalla "DPI no encontrado" ──────────────────────────────────────────────
function PantallaNoencontrado({ dpi, onReintentar }: { dpi: string; onReintentar: () => void }) {
  return (
    <div className="bg-[#0d2147] rounded-2xl border border-red-500/25 w-full max-w-md shadow-2xl p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-red-900/20 border-2 border-red-500/30 mx-auto mb-5 flex items-center justify-center">
        <AlertTriangle size={30} className="text-red-400" />
      </div>
      <h2 className="text-white text-xl font-bold mb-2">DPI no registrado</h2>
      <p className="text-[#64748b] text-sm mb-4">
        El DPI <span className="text-white font-mono font-semibold">{dpi}</span> no se encontró en el sistema de colaboradores.
      </p>
      <p className="text-[#475569] text-xs mb-6">Si cree que esto es un error, comuníquese con Recursos Humanos.</p>
      <button onClick={onReintentar}
        className="w-full py-3 border border-[#1e3a6e] text-blue-300 hover:bg-[#0f2a5e] font-semibold rounded-xl transition-all">
        Intentar de nuevo
      </button>
    </div>
  );
}

// ── Paso 3: Datos de contacto ─────────────────────────────────────────────────
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[#94a3b8] text-xs font-semibold uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
function ISPInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className={`w-full bg-[#060f1e] border border-[#1e3a6e] rounded-xl px-4 py-3 text-white text-base placeholder-[#334155] focus:outline-none focus:border-blue-500/60 transition-colors ${props.className ?? ""}`} />
  );
}

function PasoContacto({ contacto, onChange, onNext, onBack }: {
  contacto: Contacto;
  onChange: (field: keyof Contacto, val: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const set = (field: keyof Contacto) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange(field, e.target.value);

  return (
    <div className="bg-[#0d2147] rounded-2xl border border-[#1e3a6e] w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden">
      <div className="bg-[#091a3d] px-5 py-4">
        <h2 className="text-white text-lg font-bold">Actualizar datos de contacto</h2>
        <p className="text-blue-300 text-xs mt-1">Modifique solo los campos que desea actualizar</p>
      </div>
      <div className="p-5 overflow-y-auto" style={{ maxHeight: "calc(100vh - 240px)" }}>
        <div className="grid grid-cols-2 gap-4">

          <div className="col-span-2">
            <p className="text-[#64748b] text-xs uppercase tracking-wider mb-3 font-semibold">Contacto personal</p>
          </div>
          <F label="Teléfono principal"><ISPInput value={contacto.telefono} onChange={set("telefono")} placeholder="5555-1234" maxLength={15} /></F>
          <F label="Teléfono secundario (opcional)"><ISPInput value={contacto.telefono_secundario} onChange={set("telefono_secundario")} placeholder="2345-6789" maxLength={15} /></F>
          <div className="col-span-2">
            <F label="Correo electrónico (opcional)"><ISPInput value={contacto.correo} onChange={set("correo")} placeholder="correo@ejemplo.com" type="email" /></F>
          </div>

          <div className="col-span-2 mt-2">
            <p className="text-[#64748b] text-xs uppercase tracking-wider mb-3 font-semibold">Domicilio</p>
          </div>
          <div className="col-span-2">
            <F label="Dirección"><ISPInput value={contacto.direccion} onChange={set("direccion")} placeholder="Zona, colonia, calle, número" /></F>
          </div>
          <F label="Municipio"><ISPInput value={contacto.municipio} onChange={set("municipio")} placeholder="Guatemala" /></F>
          <F label="Departamento">
            <select value={contacto.departamento} onChange={set("departamento")}
              className="w-full bg-[#060f1e] border border-[#1e3a6e] rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-blue-500/60">
              <option value="">Seleccione...</option>
              {["Alta Verapaz","Baja Verapaz","Chimaltenango","Chiquimula","El Progreso","Escuintla","Guatemala","Huehuetenango","Izabal","Jalapa","Jutiapa","Petén","Quetzaltenango","Quiché","Retalhuleu","Sacatepéquez","San Marcos","Santa Rosa","Sololá","Suchitepéquez","Totonicapán","Zacapa"].map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </F>

          <div className="col-span-2 mt-2">
            <p className="text-[#64748b] text-xs uppercase tracking-wider mb-3 font-semibold">Datos bancarios (opcional)</p>
          </div>
          <F label="Banco"><ISPInput value={contacto.banco} onChange={set("banco")} placeholder="Banrural, Banco Industrial..." /></F>
          <F label="Forma de pago">
            <select value={contacto.forma_pago} onChange={set("forma_pago")}
              className="w-full bg-[#060f1e] border border-[#1e3a6e] rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-blue-500/60">
              <option value="">Seleccione...</option>
              <option value="transferencia">Transferencia bancaria</option>
              <option value="cheque">Cheque</option>
              <option value="efectivo">Efectivo</option>
            </select>
          </F>
          <F label="Tipo de cuenta">
            <select value={contacto.tipo_cuenta} onChange={set("tipo_cuenta")}
              className="w-full bg-[#060f1e] border border-[#1e3a6e] rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:border-blue-500/60">
              <option value="">Seleccione...</option>
              <option value="Monetaria">Monetaria</option>
              <option value="Ahorro">Ahorro</option>
            </select>
          </F>
          <div className="col-span-2">
            <F label="Número de cuenta"><ISPInput value={contacto.cuenta_bancaria} onChange={set("cuenta_bancaria")} placeholder="000-000000-0" maxLength={25} /></F>
          </div>

          <div className="col-span-2 mt-2">
            <p className="text-[#64748b] text-xs uppercase tracking-wider mb-3 font-semibold">Contacto de emergencia</p>
          </div>
          <div className="col-span-2">
            <F label="Nombre del contacto"><ISPInput value={contacto.nombre_contacto_emergencia} onChange={set("nombre_contacto_emergencia")} placeholder="Nombre completo" /></F>
          </div>
          <F label="Teléfono de emergencia"><ISPInput value={contacto.telefono_emergencia} onChange={set("telefono_emergencia")} placeholder="5555-0000" maxLength={15} /></F>
          <F label="Parentesco"><ISPInput value={contacto.parentesco_emergencia} onChange={set("parentesco_emergencia")} placeholder="Madre, esposa, hermano..." /></F>
        </div>
      </div>
      <div className="px-5 py-4 border-t border-[#1e3a6e] flex justify-between items-center gap-3">
        <button onClick={onBack}
          className="flex items-center gap-1 px-5 py-3 rounded-xl border border-[#1e3a6e] text-[#64748b] text-sm font-semibold">
          <ChevronLeft size={16} /> Atrás
        </button>
        <button onClick={onNext}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-white font-bold text-base transition-all">
          Siguiente →
        </button>
      </div>
    </div>
  );
}

// ── Paso 4: Foto (mismo patrón que KioscoSolicitud — videoRef desde el padre) ──
function PasoFoto({ videoRef, camActiva, camError, fotoUrl, onCapturar, onRehacer, onReintentar, onBack, onNext, enviando }: {
  videoRef: React.RefObject<HTMLVideoElement>;
  camActiva: boolean; camError: boolean; fotoUrl: string | null;
  onCapturar: () => void; onRehacer: () => void; onReintentar: () => void;
  onBack: () => void; onNext: () => void; enviando: boolean;
}) {
  return (
    <div className="bg-[#0d2147] rounded-2xl border border-[#1e3a6e] w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
      <div className="bg-[#091a3d] px-5 py-4">
        <h2 className="text-white text-lg font-bold">Fotografía de rostro</h2>
        <p className="text-blue-300 text-xs mt-1">Opcional — actualice su foto de perfil</p>
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
        <button onClick={onBack} disabled={enviando}
          className="flex items-center gap-1 px-5 py-3 rounded-xl border border-[#1e3a6e] text-[#64748b] text-sm font-semibold">
          <ChevronLeft size={16} /> Atrás
        </button>
        <button onClick={onNext} disabled={enviando}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-white font-bold text-base transition-all flex items-center gap-2">
          {enviando ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

// ── Pantalla éxito ────────────────────────────────────────────────────────────
function PantallaExito({ nombre, onReiniciar }: { nombre: string; onReiniciar: () => void }) {
  return (
    <div className="bg-[#0d2147] rounded-2xl p-10 w-full max-w-md text-center shadow-2xl border border-[#1e3a6e]">
      <div className="w-20 h-20 rounded-full bg-[#052e16] border-4 border-green-500 mx-auto mb-6 flex items-center justify-center" style={{ boxShadow: "0 0 30px rgba(34,197,94,0.3)" }}>
        <ShieldCheck size={36} className="text-green-400" />
      </div>
      <h2 className="text-white text-3xl font-bold mb-2">¡Datos actualizados!</h2>
      <p className="text-blue-300 text-base mb-6">
        Los datos de <span className="text-white font-semibold">{nombre}</span> han sido guardados correctamente en el sistema.
      </p>
      <p className="text-[#64748b] text-sm mb-8">Gracias por mantener su información al día.</p>
      <button onClick={onReiniciar}
        className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-10 py-4 text-lg w-full rounded-xl font-bold transition-all">
        Finalizar
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function ActualizacionDatos() {
  const [paso, setPaso] = useState(0);

  // DPI scan
  const [frenteUrl, setFrenteUrl]       = useState<string | null>(null);
  const [reversoUrl, setReversoUrl]     = useState<string | null>(null);
  const [dpiExtraido, setDpiExtraido]   = useState<string | null>(null);
  const [extrayendo, setExtrayendo]     = useState(false);
  const [errorExtraccion, setErrorExtraccion] = useState<string | null>(null);

  // Búsqueda empleado
  const [empleado, setEmpleado]         = useState<Empleado | null>(null);
  const [buscando, setBuscando]         = useState(false);
  const [noEncontrado, setNoEncontrado] = useState(false);

  // Formulario de contacto
  const [contacto, setContacto]         = useState<Contacto>({
    telefono: "", telefono_secundario: "", correo: "",
    direccion: "", municipio: "", departamento: "",
    banco: "", forma_pago: "", tipo_cuenta: "", cuenta_bancaria: "",
    nombre_contacto_emergencia: "", telefono_emergencia: "", parentesco_emergencia: "",
  });

  // Foto — cámara manejada en el padre (mismo patrón que KioscoSolicitud)
  const [fotoUrl, setFotoUrl]           = useState<string | null>(null);
  const [fotoBlob, setFotoBlob]         = useState<Blob | null>(null);
  const [camActiva, setCamActiva]       = useState(false);
  const [camError, setCamError]         = useState(false);
  const fotoVideoRef                    = useRef<HTMLVideoElement>(null);
  const fotoStreamRef                   = useRef<MediaStream | null>(null);
  const [enviando, setEnviando]         = useState(false);

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
    if (paso === 4) iniciarCamara();
    else if (camActiva) detenerCamara();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso]);

  const reiniciar = () => {
    setPaso(0);
    setFrenteUrl(null); setReversoUrl(null);
    setDpiExtraido(null); setExtrayendo(false); setErrorExtraccion(null);
    setEmpleado(null); setBuscando(false); setNoEncontrado(false);
    setFotoUrl(null); setFotoBlob(null); detenerCamara(); setEnviando(false);
    setContacto({ telefono: "", telefono_secundario: "", correo: "",
      direccion: "", municipio: "", departamento: "",
      banco: "", forma_pago: "", tipo_cuenta: "", cuenta_bancaria: "",
      nombre_contacto_emergencia: "", telefono_emergencia: "", parentesco_emergencia: "" });
  };

  // Cuando se captura el frente → extraer DPI con IA
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
          setDpiExtraido(datos.dpi);
        } else {
          setErrorExtraccion("No se detectó el número de DPI. Intente escanear de nuevo con mejor iluminación.");
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

  // Buscar empleado por DPI
  const buscarEmpleado = useCallback(async () => {
    if (!dpiExtraido) return;
    setBuscando(true);
    setNoEncontrado(false);
    try {
      const r = await fetch(`${API}/employees/by-dpi/${encodeURIComponent(dpiExtraido)}`);
      if (r.ok) {
        const emp: Empleado = await r.json();
        setEmpleado(emp);
        setContacto({
          telefono:                   emp.telefono ?? "",
          telefono_secundario:        emp.telefono_secundario ?? "",
          correo:                     emp.correo ?? "",
          direccion:                  emp.direccion ?? "",
          municipio:                  emp.municipio ?? "",
          departamento:               emp.departamento ?? "",
          banco:                      emp.banco ?? "",
          forma_pago:                 emp.forma_pago ?? "",
          tipo_cuenta:                emp.tipo_cuenta ?? "",
          cuenta_bancaria:            emp.cuenta_bancaria ?? "",
          nombre_contacto_emergencia: emp.nombre_contacto_emergencia ?? "",
          telefono_emergencia:        emp.telefono_emergencia ?? "",
          parentesco_emergencia:      emp.parentesco_emergencia ?? "",
        });
        setPaso(2);
      } else {
        setNoEncontrado(true);
      }
    } catch {
      setNoEncontrado(true);
    } finally {
      setBuscando(false);
    }
  }, [dpiExtraido]);

  // Al pasar del DPI scan → buscar empleado
  const handleNextDpi = () => {
    buscarEmpleado();
  };

  // Enviar actualización
  const enviar = async () => {
    if (!empleado) return;
    setEnviando(true);
    try {
      // Subir imágenes DPI si son base64
      let dpiFrenteGuardado = empleado.dpi_frente_url;
      let dpiReversoGuardado = empleado.dpi_reverso_url;

      if (frenteUrl?.startsWith("data:")) {
        const res = await fetch(frenteUrl); const blob = await res.blob();
        dpiFrenteGuardado = await subirFoto(blob);
      }
      if (reversoUrl?.startsWith("data:")) {
        const res = await fetch(reversoUrl); const blob = await res.blob();
        dpiReversoGuardado = await subirFoto(blob);
      }

      let fotoGuardada: string | null = null;
      if (fotoBlob) {
        const comp = await comprimirFoto(fotoBlob);
        fotoGuardada = await subirFoto(comp);
      }

      await fetch(`${API}/employees/${empleado.id}/self-update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...contacto,
          dpi_frente_url: dpiFrenteGuardado,
          dpi_reverso_url: dpiReversoGuardado,
          ...(fotoGuardada ? { foto_url: fotoGuardada } : {}),
        }),
      });
      setPaso(5);
    } catch {
      alert("Error al guardar los datos. Intente de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060f1e] flex flex-col items-center justify-center px-4 py-8"
      style={{ background: "radial-gradient(ellipse at 50% 0%, #0a1a3e 0%, #060f1e 70%)" }}>
      {/* Logo / header */}
      <div className="mb-8 text-center">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#1a4090,#0d2a6e)" }}>
          <span className="text-white font-black text-xl">ISP</span>
        </div>
        <p className="text-blue-300 text-sm">Actualización de datos de colaboradores</p>
      </div>

      {/* Paso 0: Bienvenida */}
      {paso === 0 && <PantallaBienvenida onComenzar={() => setPaso(1)} />}

      {/* Paso 1: DPI Scan */}
      {paso === 1 && (
        <div className="w-full max-w-2xl">
          {buscando && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="bg-[#0d2147] border border-[#1e3a6e] rounded-2xl p-8 text-center">
                <Loader2 size={36} className="text-blue-400 animate-spin mx-auto mb-3" />
                <p className="text-white font-semibold">Buscando en el sistema...</p>
              </div>
            </div>
          )}
          {noEncontrado ? (
            <PantallaNoencontrado dpi={dpiExtraido ?? ""} onReintentar={() => {
              setNoEncontrado(false); setFrenteUrl(null); setReversoUrl(null);
              setDpiExtraido(null); setErrorExtraccion(null);
            }} />
          ) : (
            <PasoDpi
              onFrenteDone={handleFrenteDone}
              onReversoDone={setReversoUrl}
              frenteUrl={frenteUrl}
              reversoUrl={reversoUrl}
              dpiExtraido={dpiExtraido}
              extrayendo={extrayendo}
              errorExtraccion={errorExtraccion}
              onNext={handleNextDpi}
            />
          )}
        </div>
      )}

      {/* Paso 2: Confirmación de identidad */}
      {paso === 2 && empleado && (
        <PantallaConfirmacion
          empleado={empleado}
          onContinuar={() => setPaso(3)}
          onNuevoIntento={() => {
            setEmpleado(null); setFrenteUrl(null); setReversoUrl(null);
            setDpiExtraido(null); setErrorExtraccion(null); setNoEncontrado(false);
          }}
        />
      )}

      {/* Paso 3: Datos de contacto */}
      {paso === 3 && (
        <PasoContacto
          contacto={contacto}
          onChange={(field, val) => setContacto(prev => ({ ...prev, [field]: val }))}
          onNext={() => setPaso(4)}
          onBack={() => setPaso(2)}
        />
      )}

      {/* Paso 4: Foto */}
      {paso === 4 && (
        <PasoFoto
          videoRef={fotoVideoRef}
          camActiva={camActiva}
          camError={camError}
          fotoUrl={fotoUrl}
          onCapturar={capturarFoto}
          onRehacer={() => { setFotoUrl(null); setFotoBlob(null); iniciarCamara(); }}
          onReintentar={iniciarCamara}
          onNext={enviar}
          onBack={() => setPaso(3)}
          enviando={enviando}
        />
      )}

      {/* Paso 5: Éxito */}
      {paso === 5 && (
        <PantallaExito nombre={empleado?.nombre_completo ?? ""} onReiniciar={reiniciar} />
      )}
    </div>
  );
}
