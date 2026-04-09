/**
 * KioscoSolicitud.tsx
 * Pantalla de kiosco para solicitudes de empleo en tablet.
 * Ruta pública: /kiosco
 *
 * Pasos:
 *   0  → Ingreso de PIN
 *   1  → Datos personales
 *   2  → Dirección y familia
 *   3  → Educación y experiencia
 *   4  → Puesto solicitado
 *   5  → Foto (cámara)
 *   6  → Confirmación / Enviado
 */
import { useState, useRef, useCallback, useEffect } from "react";
import {
  ChevronRight, ChevronLeft, ShieldCheck, User, Home, GraduationCap,
  Briefcase, Camera, CheckCircle2, Lock, RotateCcw, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const API = "/api";

// ── Helpers ──────────────────────────────────────────────────────────────────
async function comprimirFoto(blob: Blob): Promise<Blob> {
  return new Promise((res) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const SIZE = 400;
      const canvas = document.createElement("canvas");
      const scale = Math.min(SIZE / img.width, SIZE / img.height);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => res(b!), "image/jpeg", 0.82);
    };
    img.src = url;
  });
}

async function subirFoto(blob: Blob): Promise<string> {
  const res = await fetch(`${API}/solicitudes-empleo/foto`, {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: blob,
  });
  if (!res.ok) throw new Error("Error subiendo foto");
  const { objectPath } = await res.json();
  return objectPath as string;
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface FormData {
  // Paso 1
  nombre_completo: string;
  fecha_nacimiento: string;
  dpi: string;
  genero: string;
  estado_civil: string;
  telefono: string;
  telefono_emergencia: string;
  nombre_contacto_emergencia: string;
  correo: string;
  // Paso 2
  direccion: string;
  municipio: string;
  departamento: string;
  nombre_padre: string;
  nombre_madre: string;
  num_dependientes: string;
  familiar_en_empresa: string;
  nombre_familiar_empresa: string;
  // Paso 3
  grado_estudios: string;
  experiencia_seguridad: string;
  anios_experiencia: string;
  empresa_anterior: string;
  licencia_armas: string;
  tiene_vehiculo: string;
  // Paso 4
  puesto_solicitado: string;
  disponibilidad_horario: string;
  disponible_exterior: string;
  pretension_salarial: string;
}

const EMPTY_FORM: FormData = {
  nombre_completo: "", fecha_nacimiento: "", dpi: "", genero: "", estado_civil: "",
  telefono: "", telefono_emergencia: "", nombre_contacto_emergencia: "", correo: "",
  direccion: "", municipio: "", departamento: "", nombre_padre: "", nombre_madre: "",
  num_dependientes: "0", familiar_en_empresa: "no", nombre_familiar_empresa: "",
  grado_estudios: "", experiencia_seguridad: "no", anios_experiencia: "0",
  empresa_anterior: "", licencia_armas: "no", tiene_vehiculo: "no",
  puesto_solicitado: "", disponibilidad_horario: "", disponible_exterior: "no",
  pretension_salarial: "",
};

const PUESTOS = [
  "Guardia de Seguridad", "Supervisor de Seguridad", "Agente de Portería",
  "Escolta Ejecutivo", "Motorista de Seguridad", "Inspector", "Otro",
];

const HORARIOS = ["Diurno (06:00 - 18:00)", "Nocturno (18:00 - 06:00)", "Mixto", "Rotativo"];

const GRADOS = [
  "Primaria", "Básicos", "Diversificado (Bachillerato)", "Técnico / PEM",
  "Universidad (estudiante)", "Universitario graduado",
];

const DEPTOS = [
  "Guatemala", "Alta Verapaz", "Baja Verapaz", "Chimaltenango", "Chiquimula",
  "El Progreso", "Escuintla", "Huehuetenango", "Izabal", "Jalapa", "Jutiapa",
  "Petén", "Quetzaltenango", "Quiché", "Retalhuleu", "Sacatepéquez", "San Marcos",
  "Santa Rosa", "Sololá", "Suchitepéquez", "Totonicapán", "Zacapa",
];

// ── Componente principal ──────────────────────────────────────────────────────
export default function KioscoSolicitud({ skipPin = false }: { skipPin?: boolean }) {
  const [step, setStep] = useState(skipPin ? 1 : 0); // 0=PIN, 1-4=formulario, 5=foto, 6=listo
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [verificandoPin, setVerificandoPin] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [fotoBlobUrl, setFotoBlobUrl] = useState<string | null>(null);
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null);
  const [camActiva, setCamActiva] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [solicitudId, setSolicitudId] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const set = (k: keyof FormData) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));
  const setEv = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // ── PIN ─────────────────────────────────────────────────────────────────────
  const verificarPin = async () => {
    if (pin.length < 4) return;
    setVerificandoPin(true);
    setPinError(false);
    try {
      const r = await fetch(`${API}/solicitudes-empleo/verificar-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (r.ok) {
        setStep(1);
      } else {
        setPinError(true);
        setPin("");
      }
    } catch {
      setPinError(true);
    } finally {
      setVerificandoPin(false);
    }
  };

  const presionarDigito = (d: string) => {
    if (pin.length < 6) setPin((p) => p + d);
  };
  const borrarDigito = () => setPin((p) => p.slice(0, -1));

  useEffect(() => {
    if (pin.length === 4) verificarPin();
  }, [pin]);

  // ── Cámara ───────────────────────────────────────────────────────────────────
  const iniciarCamara = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCamActiva(true);
    } catch {
      alert("No se pudo acceder a la cámara. Verifique los permisos.");
    }
  }, []);

  const detenerCamara = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamActiva(false);
  }, []);

  const capturarFoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob((b) => {
      if (!b) return;
      setFotoBlob(b);
      setFotoBlobUrl(URL.createObjectURL(b));
      detenerCamara();
    }, "image/jpeg", 0.9);
  }, [detenerCamara]);

  const rehacerFoto = () => {
    if (fotoBlobUrl) URL.revokeObjectURL(fotoBlobUrl);
    setFotoBlob(null);
    setFotoBlobUrl(null);
    iniciarCamara();
  };

  useEffect(() => {
    if (step === 5) iniciarCamara();
    else if (camActiva) detenerCamara();
  }, [step]);

  // ── Envío final ──────────────────────────────────────────────────────────────
  const enviarSolicitud = async () => {
    setEnviando(true);
    try {
      let foto_url: string | null = null;
      if (fotoBlob) {
        const comprimida = await comprimirFoto(fotoBlob);
        foto_url = await subirFoto(comprimida);
      }
      const payload = {
        ...form,
        num_dependientes: parseInt(form.num_dependientes) || 0,
        familiar_en_empresa: form.familiar_en_empresa === "si",
        experiencia_seguridad: form.experiencia_seguridad === "si",
        anios_experiencia: parseInt(form.anios_experiencia) || 0,
        licencia_armas: form.licencia_armas === "si",
        tiene_vehiculo: form.tiene_vehiculo === "si",
        disponible_exterior: form.disponible_exterior === "si",
        pretension_salarial: form.pretension_salarial ? parseFloat(form.pretension_salarial) : null,
        foto_url,
      };
      const r = await fetch(`${API}/solicitudes-empleo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Error al enviar");
      const data = await r.json();
      setSolicitudId(data.id);
      setStep(6);
    } catch {
      alert("Error al enviar su solicitud. Intente de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  // ── Reiniciar kiosco ─────────────────────────────────────────────────────────
  const reiniciar = () => {
    if (fotoBlobUrl) URL.revokeObjectURL(fotoBlobUrl);
    setForm(EMPTY_FORM);
    setFotoBlob(null);
    setFotoBlobUrl(null);
    setPin("");
    setPinError(false);
    setSolicitudId(null);
    setStep(skipPin ? 1 : 0);
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a1628] flex flex-col" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div className="bg-[#0d2147] border-b border-[#1e3a6e] px-6 py-4 flex items-center gap-4">
        <img src={`${import.meta.env.BASE_URL}images/logo-isp.png`} alt="ISP" className="h-14 object-contain" />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-blue-200 text-sm font-medium">Solicitud de Empleo</span>
          <ShieldCheck className="text-blue-400" size={24} />
        </div>
      </div>

      {/* Cuerpo */}
      <div className="flex-1 flex items-center justify-center p-4">
        {step === 0 && <PantallaPin pin={pin} error={pinError} verificando={verificandoPin} onDigito={presionarDigito} onBorrar={borrarDigito} />}
        {step === 1 && <Paso1DatosPersonales form={form} setEv={setEv} set={set} onNext={() => setStep(2)} />}
        {step === 2 && <Paso2DireccionFamilia form={form} setEv={setEv} set={set} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
        {step === 3 && <Paso3EducacionExp form={form} setEv={setEv} set={set} onNext={() => setStep(4)} onBack={() => setStep(2)} />}
        {step === 4 && <Paso4Puesto form={form} setEv={setEv} set={set} onNext={() => setStep(5)} onBack={() => setStep(3)} />}
        {step === 5 && (
          <Paso5Foto
            videoRef={videoRef} camActiva={camActiva} fotoBlobUrl={fotoBlobUrl}
            onCapturar={capturarFoto} onRehacer={rehacerFoto}
            onBack={() => setStep(4)} onNext={enviarSolicitud} enviando={enviando}
          />
        )}
        {step === 6 && <PantallaConfirmacion solicitudId={solicitudId} onReiniciar={reiniciar} />}
      </div>

      {/* Indicador de paso */}
      {step >= 1 && step <= 5 && (
        <div className="flex justify-center gap-2 pb-6">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className={`h-2 rounded-full transition-all duration-300 ${s === step ? "w-8 bg-blue-400" : s < step ? "w-4 bg-blue-600" : "w-4 bg-[#1e3a6e]"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Pantalla PIN ───────────────────────────────────────────────────────────────
function PantallaPin({ pin, error, verificando, onDigito, onBorrar }: {
  pin: string; error: boolean; verificando: boolean;
  onDigito: (d: string) => void; onBorrar: () => void;
}) {
  return (
    <div className="bg-[#0d2147] rounded-2xl p-8 w-full max-w-sm text-center shadow-2xl border border-[#1e3a6e]">
      <Lock className="mx-auto mb-4 text-blue-400" size={40} />
      <h2 className="text-white text-2xl font-bold mb-2">Bienvenido</h2>
      <p className="text-blue-300 text-sm mb-6">Ingrese el PIN de acceso al kiosco</p>

      <div className="flex justify-center gap-3 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`w-5 h-5 rounded-full border-2 transition-all ${i < pin.length ? "bg-blue-400 border-blue-400" : "bg-transparent border-blue-600"}`} />
        ))}
      </div>

      {error && <p className="text-red-400 text-sm mb-4">PIN incorrecto. Intente de nuevo.</p>}

      <div className="grid grid-cols-3 gap-3">
        {["1","2","3","4","5","6","7","8","9"].map((d) => (
          <button key={d} onClick={() => onDigito(d)}
            className="bg-[#1a3660] hover:bg-[#1e4080] text-white text-2xl font-bold py-4 rounded-xl transition-all active:scale-95">
            {d}
          </button>
        ))}
        <div />
        <button onClick={() => onDigito("0")}
          className="bg-[#1a3660] hover:bg-[#1e4080] text-white text-2xl font-bold py-4 rounded-xl transition-all active:scale-95">
          0
        </button>
        <button onClick={onBorrar}
          className="bg-[#2d1a1a] hover:bg-[#3d2020] text-red-400 text-lg font-bold py-4 rounded-xl transition-all active:scale-95">
          ⌫
        </button>
      </div>
      {verificando && <p className="text-blue-300 text-sm mt-4 animate-pulse">Verificando...</p>}
    </div>
  );
}

// ── Contenedor de paso ────────────────────────────────────────────────────────
function PasoContainer({ titulo, icono, children }: { titulo: string; icono: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[#0d2147] rounded-2xl p-6 w-full max-w-2xl shadow-2xl border border-[#1e3a6e]">
      <div className="flex items-center gap-3 mb-6">
        <div className="text-blue-400">{icono}</div>
        <h2 className="text-white text-xl font-bold">{titulo}</h2>
      </div>
      {children}
    </div>
  );
}

function NavButtons({ onBack, onNext, nextLabel = "Siguiente", nextDisabled }: {
  onBack?: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean;
}) {
  return (
    <div className="flex gap-3 mt-6 justify-between">
      {onBack
        ? <Button variant="outline" onClick={onBack} className="border-blue-700 text-blue-300 hover:bg-[#1e3a6e]"><ChevronLeft size={18} className="mr-1" />Atrás</Button>
        : <div />
      }
      <Button onClick={onNext} disabled={nextDisabled}
        className="bg-blue-600 hover:bg-blue-700 text-white px-8">
        {nextLabel} <ChevronRight size={18} className="ml-1" />
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-blue-200 text-sm">{label}</Label>
      {children}
    </div>
  );
}

function ISPInput({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="bg-[#0a1628] border border-[#1e3a6e] text-white rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 w-full placeholder:text-blue-800" />;
}

function ISPSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="bg-[#0a1628] border-[#1e3a6e] text-white">
        <SelectValue placeholder={placeholder ?? "Seleccionar..."} />
      </SelectTrigger>
      <SelectContent className="bg-[#0d2147] border-[#1e3a6e] text-white">
        {options.map((o) => <SelectItem key={o} value={o} className="focus:bg-[#1e3a6e]">{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

// ── Paso 1: Datos personales ──────────────────────────────────────────────────
function Paso1DatosPersonales({ form, setEv, set, onNext }: {
  form: FormData; setEv: (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  set: (k: keyof FormData) => (v: string) => void; onNext: () => void;
}) {
  const ok = form.nombre_completo.trim().length >= 4 && form.dpi.length >= 13 && form.telefono.length >= 8;
  return (
    <PasoContainer titulo="Paso 1 — Datos Personales" icono={<User size={24} />}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field label="Nombre completo *">
            <ISPInput value={form.nombre_completo} onChange={setEv("nombre_completo")} placeholder="Nombre completo" />
          </Field>
        </div>
        <Field label="Fecha de nacimiento">
          <ISPInput type="date" value={form.fecha_nacimiento} onChange={setEv("fecha_nacimiento")} />
        </Field>
        <Field label="DPI (CUI) *">
          <ISPInput value={form.dpi} onChange={setEv("dpi")} placeholder="1234567890101" maxLength={15} />
        </Field>
        <Field label="Género">
          <ISPSelect value={form.genero} onChange={set("genero")} options={["Masculino", "Femenino", "Prefiero no decir"]} />
        </Field>
        <Field label="Estado civil">
          <ISPSelect value={form.estado_civil} onChange={set("estado_civil")} options={["Soltero/a", "Casado/a", "Unido/a", "Divorciado/a", "Viudo/a"]} />
        </Field>
        <Field label="Teléfono principal *">
          <ISPInput value={form.telefono} onChange={setEv("telefono")} placeholder="5555-1234" type="tel" />
        </Field>
        <Field label="Correo electrónico">
          <ISPInput value={form.correo} onChange={setEv("correo")} placeholder="correo@ejemplo.com" type="email" />
        </Field>
        <Field label="Contacto de emergencia">
          <ISPInput value={form.nombre_contacto_emergencia} onChange={setEv("nombre_contacto_emergencia")} placeholder="Nombre del contacto" />
        </Field>
        <Field label="Teléfono de emergencia">
          <ISPInput value={form.telefono_emergencia} onChange={setEv("telefono_emergencia")} placeholder="5555-6789" type="tel" />
        </Field>
      </div>
      <NavButtons onNext={onNext} nextDisabled={!ok} />
    </PasoContainer>
  );
}

// ── Paso 2: Dirección y familia ───────────────────────────────────────────────
function Paso2DireccionFamilia({ form, setEv, set, onNext, onBack }: {
  form: FormData; setEv: (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  set: (k: keyof FormData) => (v: string) => void; onNext: () => void; onBack: () => void;
}) {
  return (
    <PasoContainer titulo="Paso 2 — Dirección y Familia" icono={<Home size={24} />}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field label="Dirección (calle, zona, colonia)">
            <ISPInput value={form.direccion} onChange={setEv("direccion")} placeholder="Zona 1, Colonia..." />
          </Field>
        </div>
        <Field label="Municipio">
          <ISPInput value={form.municipio} onChange={setEv("municipio")} placeholder="Guatemala" />
        </Field>
        <Field label="Departamento">
          <ISPSelect value={form.departamento} onChange={set("departamento")} options={DEPTOS} />
        </Field>
        <Field label="Nombre del padre">
          <ISPInput value={form.nombre_padre} onChange={setEv("nombre_padre")} placeholder="Nombre completo del padre" />
        </Field>
        <Field label="Nombre de la madre">
          <ISPInput value={form.nombre_madre} onChange={setEv("nombre_madre")} placeholder="Nombre completo de la madre" />
        </Field>
        <Field label="Número de dependientes (hijos u otros)">
          <ISPSelect value={form.num_dependientes} onChange={set("num_dependientes")} options={["0","1","2","3","4","5","6 o más"]} />
        </Field>
        <Field label="¿Tiene familiares trabajando en ISP?">
          <ISPSelect value={form.familiar_en_empresa} onChange={set("familiar_en_empresa")} options={["no","si"]}  />
        </Field>
        {form.familiar_en_empresa === "si" && (
          <div className="sm:col-span-2">
            <Field label="Nombre del familiar en ISP">
              <ISPInput value={form.nombre_familiar_empresa} onChange={setEv("nombre_familiar_empresa")} placeholder="Nombre completo" />
            </Field>
          </div>
        )}
      </div>
      <NavButtons onBack={onBack} onNext={onNext} />
    </PasoContainer>
  );
}

// ── Paso 3: Educación y experiencia ──────────────────────────────────────────
function Paso3EducacionExp({ form, setEv, set, onNext, onBack }: {
  form: FormData; setEv: (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  set: (k: keyof FormData) => (v: string) => void; onNext: () => void; onBack: () => void;
}) {
  return (
    <PasoContainer titulo="Paso 3 — Educación y Experiencia" icono={<GraduationCap size={24} />}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field label="Grado de estudios más alto alcanzado">
            <ISPSelect value={form.grado_estudios} onChange={set("grado_estudios")} options={GRADOS} />
          </Field>
        </div>
        <Field label="¿Tiene experiencia en seguridad?">
          <ISPSelect value={form.experiencia_seguridad} onChange={set("experiencia_seguridad")} options={["no","si"]} />
        </Field>
        {form.experiencia_seguridad === "si" && (
          <>
            <Field label="Años de experiencia">
              <ISPSelect value={form.anios_experiencia} onChange={set("anios_experiencia")} options={["1","2","3","4","5","6","7","8","9","10 o más"]} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Última empresa donde trabajó en seguridad">
                <ISPInput value={form.empresa_anterior} onChange={setEv("empresa_anterior")} placeholder="Nombre de la empresa" />
              </Field>
            </div>
          </>
        )}
        <Field label="¿Tiene licencia de armas vigente?">
          <ISPSelect value={form.licencia_armas} onChange={set("licencia_armas")} options={["no","si"]} />
        </Field>
        <Field label="¿Tiene vehículo propio?">
          <ISPSelect value={form.tiene_vehiculo} onChange={set("tiene_vehiculo")} options={["no","si"]} />
        </Field>
      </div>
      <NavButtons onBack={onBack} onNext={onNext} />
    </PasoContainer>
  );
}

// ── Paso 4: Puesto solicitado ─────────────────────────────────────────────────
function Paso4Puesto({ form, setEv, set, onNext, onBack }: {
  form: FormData; setEv: (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  set: (k: keyof FormData) => (v: string) => void; onNext: () => void; onBack: () => void;
}) {
  const ok = form.puesto_solicitado.length > 0;
  return (
    <PasoContainer titulo="Paso 4 — Puesto Solicitado" icono={<Briefcase size={24} />}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Field label="Puesto al que aplica *">
            <ISPSelect value={form.puesto_solicitado} onChange={set("puesto_solicitado")} options={PUESTOS} />
          </Field>
        </div>
        <Field label="Disponibilidad de horario">
          <ISPSelect value={form.disponibilidad_horario} onChange={set("disponibilidad_horario")} options={HORARIOS} />
        </Field>
        <Field label="¿Disponible para trabajar fuera de la ciudad?">
          <ISPSelect value={form.disponible_exterior} onChange={set("disponible_exterior")} options={["no","si"]} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Pretensión salarial (GTQ/mes, opcional)">
            <ISPInput type="number" value={form.pretension_salarial} onChange={setEv("pretension_salarial")} placeholder="3500.00" min="0" />
          </Field>
        </div>
      </div>
      <NavButtons onBack={onBack} onNext={onNext} nextDisabled={!ok} nextLabel="Continuar a foto" />
    </PasoContainer>
  );
}

// ── Paso 5: Foto ──────────────────────────────────────────────────────────────
function Paso5Foto({ videoRef, camActiva, fotoBlobUrl, onCapturar, onRehacer, onBack, onNext, enviando }: {
  videoRef: React.RefObject<HTMLVideoElement>; camActiva: boolean; fotoBlobUrl: string | null;
  onCapturar: () => void; onRehacer: () => void; onBack: () => void;
  onNext: () => void; enviando: boolean;
}) {
  return (
    <PasoContainer titulo="Paso 5 — Foto del Solicitante" icono={<Camera size={24} />}>
      <p className="text-blue-300 text-sm mb-4">Tome una foto clara de su rostro mirando de frente a la cámara.</p>

      <div className="flex flex-col items-center gap-4">
        {!fotoBlobUrl ? (
          <>
            <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-blue-500 bg-[#0a1628]">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {!camActiva && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Camera size={40} className="text-blue-700" />
                </div>
              )}
            </div>
            {camActiva && (
              <Button onClick={onCapturar} className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-3 text-lg rounded-xl">
                <Camera size={20} className="mr-2" /> Tomar Foto
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-green-500">
              <img src={fotoBlobUrl} alt="Foto capturada" className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onRehacer} className="border-blue-700 text-blue-300 hover:bg-[#1e3a6e]">
                <RotateCcw size={16} className="mr-2" /> Repetir
              </Button>
            </div>
          </>
        )}
      </div>

      <p className="text-blue-500 text-xs text-center mt-4">
        La foto se eliminará automáticamente si no es contratado en 30 días.
      </p>

      <NavButtons
        onBack={onBack}
        onNext={onNext}
        nextLabel={enviando ? "Enviando..." : fotoBlobUrl ? "Enviar Solicitud" : "Enviar sin foto"}
        nextDisabled={enviando}
      />
    </PasoContainer>
  );
}

// ── Pantalla de confirmación ──────────────────────────────────────────────────
function PantallaConfirmacion({ solicitudId, onReiniciar }: { solicitudId: number | null; onReiniciar: () => void }) {
  return (
    <div className="bg-[#0d2147] rounded-2xl p-10 w-full max-w-md text-center shadow-2xl border border-[#1e3a6e]">
      <CheckCircle2 size={64} className="text-green-400 mx-auto mb-6" />
      <h2 className="text-white text-3xl font-bold mb-3">¡Solicitud Enviada!</h2>
      {solicitudId && (
        <p className="text-blue-300 text-sm mb-2">Número de referencia: <span className="text-white font-bold">SOL-{String(solicitudId).padStart(5, "0")}</span></p>
      )}
      <p className="text-blue-300 text-base mb-8">
        Su solicitud fue recibida con éxito. El equipo de Reclutamiento se comunicará con usted si su perfil es seleccionado.
      </p>
      <p className="text-blue-500 text-sm mb-8">
        Muchas gracias por su interés en unirse al equipo de ISP.
      </p>
      <Button onClick={onReiniciar} className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-3 text-lg w-full rounded-xl">
        Nueva Solicitud
      </Button>
    </div>
  );
}
