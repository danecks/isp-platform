/**
 * KioscoSolicitud.tsx  —  Formulario de solicitud de empleo para kiosco/tablet
 * Ruta pública: /kiosco
 *
 * Pasos:
 *   0  → PIN de acceso
 *   1  → Escaneo DPI (anverso + reverso, cámara con marcadores)
 *   2  → Datos personales + IGSS
 *   3  → Domicilio + banco + licencia
 *   4  → Familia
 *   5  → Salud + contacto de emergencia
 *   6  → Antecedentes + situación financiera
 *   7  → Educación + experiencia laboral
 *   8  → Seguridad + habilidades + disponibilidad
 *   9  → Referencias personales
 *  10  → Fotografía de rostro
 *  11  → Solicitud enviada
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Lock, ShieldCheck, ChevronLeft } from "lucide-react";

const API = `${import.meta.env.BASE_URL}api`;

// ── Helpers de foto ──────────────────────────────────────────────────────────
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

// ── Tipos ────────────────────────────────────────────────────────────────────
interface FormData {
  // Paso 2: Personal
  puesto_solicitado: string;
  nombre_completo: string;
  profesion: string;
  fecha_nacimiento: string;
  dpi: string;
  nit: string;
  igss: string;
  telefono: string;
  telefono_fijo: string;
  correo: string;
  estado_civil: string;
  genero: string;
  nacionalidad: string;
  lugar_nacimiento: string;
  // Paso 3: Domicilio + banco
  direccion: string;
  municipio: string;
  departamento: string;
  tiempo_residencia: string;
  tipo_vivienda: string;
  renta_mensual: string;
  banco: string;
  tipo_cuenta: string;
  num_cuenta: string;
  tiene_licencia: string;
  tipo_licencia: string;
  vigencia_licencia: string;
  // Paso 4: Familia
  nombre_padre: string;
  tel_padre: string;
  nombre_madre: string;
  tel_madre: string;
  nombre_conyuge: string;
  ocup_conyuge: string;
  tel_conyuge: string;
  num_dependientes: string;
  hermano1_nombre: string;
  hermano1_tel: string;
  hermano2_nombre: string;
  hermano2_tel: string;
  facebook: string;
  instagram: string;
  // Paso 5: Salud
  estatura: string;
  peso: string;
  enfermedad_cronica: string;
  enfermedad_det: string;
  medicamento: string;
  medicamento_det: string;
  impedimento_fisico: string;
  impedimento_det: string;
  consume_alcohol: string;
  consume_drogas: string;
  tiene_tatuajes: string;
  tatuajes_det: string;
  nombre_contacto_emergencia: string;
  telefono_emergencia: string;
  parentesco_emergencia: string;
  // Paso 6: Antecedentes
  proceso_judicial: string;
  proceso_det: string;
  detenido: string;
  detencion_det: string;
  tiene_deudas: string;
  estado_deuda: string;
  gastos_mensuales: string;
  tiene_prestamo: string;
  monto_prestamo: string;
  // Paso 7: Educacion + experiencia
  prim_escuela: string;
  prim_lugar: string;
  prim_titulo: string;
  bas_escuela: string;
  bas_lugar: string;
  bas_titulo: string;
  div_escuela: string;
  div_lugar: string;
  div_titulo: string;
  uni_escuela: string;
  uni_lugar: string;
  uni_titulo: string;
  emp1_nombre: string;
  emp1_puesto: string;
  emp1_salario: string;
  emp1_inicio: string;
  emp1_fin: string;
  emp1_motivo: string;
  emp2_nombre: string;
  emp2_puesto: string;
  emp2_salario: string;
  emp2_inicio: string;
  emp2_fin: string;
  emp2_motivo: string;
  emp3_nombre: string;
  emp3_puesto: string;
  emp3_salario: string;
  emp3_inicio: string;
  emp3_fin: string;
  emp3_motivo: string;
  // Paso 8: Seguridad + habilidades
  experiencia_seguridad: string;
  anios_experiencia: string;
  empresa_anterior: string;
  tipos_seguridad: string;
  servicio_militar: string;
  rango_militar: string;
  unidad_militar: string;
  fue_policia: string;
  motivo_baja_policial: string;
  habilidades: string;
  disp_rotativo: string;
  disp_nocturno: string;
  disp_fds: string;
  tiene_vehiculo: string;
  licencia_armas: string;
  // Paso 9: Referencias
  ref1_nombre: string;
  ref1_ocupacion: string;
  ref1_tel: string;
  ref2_nombre: string;
  ref2_ocupacion: string;
  ref2_tel: string;
  ref3_nombre: string;
  ref3_ocupacion: string;
  ref3_tel: string;
  // Misc
  disponibilidad_horario: string;
  disponible_exterior: string;
  pretension_salarial: string;
  familiar_en_empresa: string;
  nombre_familiar_empresa: string;
  grado_estudios: string;
}

const EMPTY: FormData = {
  puesto_solicitado: "", nombre_completo: "", profesion: "", fecha_nacimiento: "",
  dpi: "", nit: "", igss: "", telefono: "", telefono_fijo: "", correo: "",
  estado_civil: "", genero: "", nacionalidad: "Guatemalteca", lugar_nacimiento: "",
  direccion: "", municipio: "", departamento: "", tiempo_residencia: "",
  tipo_vivienda: "", renta_mensual: "",
  banco: "", tipo_cuenta: "", num_cuenta: "",
  tiene_licencia: "no", tipo_licencia: "", vigencia_licencia: "",
  nombre_padre: "", tel_padre: "", nombre_madre: "", tel_madre: "",
  nombre_conyuge: "", ocup_conyuge: "", tel_conyuge: "",
  num_dependientes: "0", hermano1_nombre: "", hermano1_tel: "", hermano2_nombre: "", hermano2_tel: "",
  facebook: "", instagram: "",
  estatura: "", peso: "",
  enfermedad_cronica: "no", enfermedad_det: "", medicamento: "no", medicamento_det: "",
  impedimento_fisico: "no", impedimento_det: "", consume_alcohol: "no", consume_drogas: "no",
  tiene_tatuajes: "no", tatuajes_det: "",
  nombre_contacto_emergencia: "", telefono_emergencia: "", parentesco_emergencia: "",
  proceso_judicial: "no", proceso_det: "", detenido: "no", detencion_det: "",
  tiene_deudas: "no", estado_deuda: "", gastos_mensuales: "", tiene_prestamo: "no", monto_prestamo: "",
  prim_escuela: "", prim_lugar: "", prim_titulo: "",
  bas_escuela: "", bas_lugar: "", bas_titulo: "",
  div_escuela: "", div_lugar: "", div_titulo: "",
  uni_escuela: "", uni_lugar: "", uni_titulo: "",
  emp1_nombre: "", emp1_puesto: "", emp1_salario: "", emp1_inicio: "", emp1_fin: "", emp1_motivo: "",
  emp2_nombre: "", emp2_puesto: "", emp2_salario: "", emp2_inicio: "", emp2_fin: "", emp2_motivo: "",
  emp3_nombre: "", emp3_puesto: "", emp3_salario: "", emp3_inicio: "", emp3_fin: "", emp3_motivo: "",
  experiencia_seguridad: "no", anios_experiencia: "0", empresa_anterior: "",
  tipos_seguridad: "", servicio_militar: "no", rango_militar: "", unidad_militar: "",
  fue_policia: "no", motivo_baja_policial: "", habilidades: "",
  disp_rotativo: "no", disp_nocturno: "no", disp_fds: "no", tiene_vehiculo: "no", licencia_armas: "no",
  ref1_nombre: "", ref1_ocupacion: "", ref1_tel: "",
  ref2_nombre: "", ref2_ocupacion: "", ref2_tel: "",
  ref3_nombre: "", ref3_ocupacion: "", ref3_tel: "",
  disponibilidad_horario: "", disponible_exterior: "no", pretension_salarial: "",
  familiar_en_empresa: "no", nombre_familiar_empresa: "", grado_estudios: "",
};

const DEPTOS = ["Guatemala","Alta Verapaz","Baja Verapaz","Chimaltenango","Chiquimula","El Progreso","Escuintla","Huehuetenango","Izabal","Jalapa","Jutiapa","Petén","Quetzaltenango","Quiché","Retalhuleu","Sacatepéquez","San Marcos","Santa Rosa","Sololá","Suchitepéquez","Totonicapán","Zacapa"];
const PUESTOS = ["Guardia de Seguridad","Supervisor de Seguridad","Agente de Portería","Escolta Ejecutivo","Motorista de Seguridad","Inspector","Otro"];
const BANCOS = ["Banrural","Banco Industrial","G&T Continental","BAC Credomatic","Bantrab","Ficohsa","BAM","Vivibanco","Otro"];
const MOTIVOS_SALIDA = ["Terminó el contrato","Renuncié voluntariamente","Mejor oferta de trabajo","La empresa cerró","Motivos personales o familiares","Otro motivo"];

const TOTAL_STEPS = 11; // pasos 1–11, paso 0 = PIN, paso 12 = listo
const STEP_NAMES = ["","Escaneo DPI","Datos Personales","Domicilio y Banco","Familia","Salud","Antecedentes","Educación y Experiencia","Seguridad","Referencias","Fotografía","Confirmación",""];

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function KioscoSolicitud({ skipPin = false }: { skipPin?: boolean }) {
  const [step, setStep]             = useState(skipPin ? 1 : 0);
  const [pin, setPin]               = useState("");
  const [pinError, setPinError]     = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [form, setForm]             = useState<FormData>(EMPTY);
  const [habilidadesArr, setHabilidadesArr] = useState<string[]>([]);
  const [tiposSegArr, setTiposSegArr]       = useState<string[]>([]);
  // DPI scan state
  const [dpiFrenteUrl, setDpiFrenteUrl] = useState<string | null>(null);
  const [dpiReversoUrl, setDpiReversoUrl] = useState<string | null>(null);
  // Face photo state
  const [fotoUrl, setFotoUrl]         = useState<string | null>(null);
  const [fotoBlob, setFotoBlob]       = useState<Blob | null>(null);
  const [camActiva, setCamActiva]     = useState(false);
  const [camError, setCamError]       = useState(false);
  const [enviando, setEnviando]       = useState(false);
  const [solicitudId, setSolicitudId] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const set  = (k: keyof FormData) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const setEv = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const next = () => { window.scrollTo(0, 0); setStep(s => s + 1); };
  const back = () => { window.scrollTo(0, 0); setStep(s => s - 1); };

  // ── PIN ──────────────────────────────────────────────────────────────────
  const verificarPin = async (p: string) => {
    setVerificando(true);
    setPinError(false);
    try {
      const r = await fetch(`${API}/solicitudes-empleo/verificar-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: p }),
      });
      if (r.ok) { setStep(1); } else { setPinError(true); setPin(""); }
    } catch { setPinError(true); setPin(""); }
    finally { setVerificando(false); }
  };

  const presionarDigito = (d: string) => {
    if (pin.length >= 4) return;
    const np = pin + d;
    setPin(np);
    if (np.length === 4) verificarPin(np);
  };

  // ── Cámara de rostro ────────────────────────────────────────────────────
  const iniciarCamara = useCallback(async () => {
    setCamError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCamActiva(true);
    } catch { setCamError(true); }
  }, []);

  const detenerCamara = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCamActiva(false);
  }, []);

  const capturarFoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const SIZE = 400;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext("2d")!;
    const vw = video.videoWidth || SIZE;
    const vh = video.videoHeight || SIZE;
    const scale = Math.max(SIZE / vw, SIZE / vh);
    const sw = SIZE / scale; const sh = SIZE / scale;
    const sx = (vw - sw) / 2; const sy = (vh - sh) / 2;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, SIZE, SIZE);
    canvas.toBlob(b => {
      if (!b) { setCamError(true); return; }
      setFotoBlob(b);
      setFotoUrl(URL.createObjectURL(b));
      detenerCamara();
    }, "image/jpeg", 0.9);
  }, [detenerCamara]);

  useEffect(() => {
    if (step === 10) iniciarCamara();
    else if (camActiva) detenerCamara();
  }, [step]);

  // ── Envío ────────────────────────────────────────────────────────────────
  const enviarSolicitud = async () => {
    setEnviando(true);
    try {
      let foto_url: string | null = null;
      if (fotoBlob) {
        const c = await comprimirFoto(fotoBlob);
        foto_url = await subirFoto(c);
      }
      const payload = {
        ...form,
        habilidades: habilidadesArr.join(", "),
        tipos_seguridad: tiposSegArr.join(", "),
        num_dependientes: parseInt(form.num_dependientes) || 0,
        familiar_en_empresa: form.familiar_en_empresa === "si",
        experiencia_seguridad: form.experiencia_seguridad === "si",
        anios_experiencia: parseInt(form.anios_experiencia) || 0,
        licencia_armas: form.licencia_armas === "si",
        tiene_vehiculo: form.tiene_vehiculo === "si",
        disponible_exterior: form.disponible_exterior === "si",
        pretension_salarial: form.pretension_salarial ? parseFloat(form.pretension_salarial) : null,
        dpi_frente_url: dpiFrenteUrl,
        dpi_reverso_url: dpiReversoUrl,
        foto_url,
        canal: "kiosco",
      };
      const r = await fetch(`${API}/solicitudes-empleo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Error al enviar");
      const data = await r.json();
      setSolicitudId(data.id);
      setStep(12);
    } catch {
      alert("Error al enviar su solicitud. Por favor intente de nuevo.");
    } finally { setEnviando(false); }
  };

  const reiniciar = () => {
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    setForm(EMPTY);
    setHabilidadesArr([]);
    setTiposSegArr([]);
    setFotoBlob(null);
    setFotoUrl(null);
    setDpiFrenteUrl(null);
    setDpiReversoUrl(null);
    setPin("");
    setPinError(false);
    setSolicitudId(null);
    setStep(skipPin ? 1 : 0);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a1628] flex flex-col" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div className="bg-[#0d2147] border-b border-[#1e3a6e] px-4 py-3 flex items-center gap-4 shrink-0">
        <img src={`${import.meta.env.BASE_URL}images/logo-isp.png`} alt="ISP" className="h-12 object-contain" />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-blue-200 text-sm font-semibold">Solicitud de Empleo</span>
          <ShieldCheck className="text-blue-400" size={20} />
        </div>
      </div>

      {/* Progress bar */}
      {step >= 1 && step <= 11 && (
        <div className="bg-[#091a3d] border-b border-[#1e3a6e] px-4 py-2 shrink-0">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-blue-300 font-semibold">{STEP_NAMES[step]}</span>
            <span className="text-[#64748b]">Paso {step} de {TOTAL_STEPS}</span>
          </div>
          <div className="bg-[#060f1e] rounded-full h-2 border border-[#1e3a6e]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${((step - 1) / TOTAL_STEPS) * 100}%`, background: "linear-gradient(90deg, #2563eb, #3b82f6)" }}
            />
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex items-start justify-center p-4 overflow-y-auto">
        {step === 0  && <PantallaPin pin={pin} error={pinError} verificando={verificando} onDigito={presionarDigito} onBorrar={() => setPin(p => p.slice(0, -1))} />}
        {step === 1  && <PasoDpi onFrenteDone={url => setDpiFrenteUrl(url)} onReversoDone={url => setDpiReversoUrl(url)} frenteUrl={dpiFrenteUrl} reversoUrl={dpiReversoUrl} onNext={next} onBack={back} onDatosExtraidos={(datos) => {
          setForm(f => ({
            ...f,
            nombre_completo: datos.nombre_completo || f.nombre_completo,
            dpi: datos.dpi || f.dpi,
            fecha_nacimiento: datos.fecha_nacimiento || f.fecha_nacimiento,
            genero: datos.genero || f.genero,
            municipio: datos.municipio || f.municipio,
            departamento: datos.departamento || f.departamento,
          }));
        }} onLimpiarDatos={() => {
          setForm(f => ({
            ...f,
            nombre_completo: "",
            dpi: "",
            fecha_nacimiento: "",
            genero: "",
            municipio: "",
            departamento: "",
          }));
        }} />}
        {step === 2  && <PasoPersonal form={form} setEv={setEv} set={set} onNext={next} onBack={back} />}
        {step === 3  && <PasoDomicilio form={form} setEv={setEv} set={set} onNext={next} onBack={back} />}
        {step === 4  && <PasoFamilia form={form} setEv={setEv} set={set} onNext={next} onBack={back} />}
        {step === 5  && <PasoSalud form={form} setEv={setEv} set={set} onNext={next} onBack={back} />}
        {step === 6  && <PasoAntecedentes form={form} setEv={setEv} set={set} onNext={next} onBack={back} />}
        {step === 7  && <PasoEducacion form={form} setEv={setEv} set={set} onNext={next} onBack={back} />}
        {step === 8  && <PasoSeguridad form={form} setEv={setEv} set={set} habilidades={habilidadesArr} setHabilidades={setHabilidadesArr} tiposSeg={tiposSegArr} setTiposSeg={setTiposSegArr} onNext={next} onBack={back} />}
        {step === 9  && <PasoReferencias form={form} setEv={setEv} onNext={next} onBack={back} />}
        {step === 10 && <PasoFoto videoRef={videoRef} camActiva={camActiva} camError={camError} fotoUrl={fotoUrl} onCapturar={capturarFoto} onRehacer={() => { if (fotoUrl) URL.revokeObjectURL(fotoUrl); setFotoBlob(null); setFotoUrl(null); setCamError(false); iniciarCamara(); }} onReintentar={iniciarCamara} onBack={back} onNext={next} enviando={false} />}
        {step === 11 && <PasoResumen form={form} fotoUrl={fotoUrl} onBack={back} onNext={enviarSolicitud} enviando={enviando} />}
        {step === 12 && <PantallaExito solicitudId={solicitudId} telefono={form.telefono} onReiniciar={reiniciar} />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PRIMITIVOS DE UI
// ══════════════════════════════════════════════════════════════════════════════

function ISPInput(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className="bg-[#060f1e] border border-[#1e3a6e] text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 w-full placeholder:text-[#1e3a6e]" />;
}

function ISPSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: string[] | { v: string; l: string }[]; placeholder?: string;
}) {
  const opts = (options as (string | { v: string; l: string })[]).map(o =>
    typeof o === "string" ? { v: o, l: o } : o
  );
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="bg-[#060f1e] border border-[#1e3a6e] text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 w-full appearance-none"
      style={{ color: value ? undefined : "#1e3a6e" }}>
      <option value="">{placeholder ?? "Seleccione una opción..."}</option>
      {opts.map(o => <option key={o.v} value={o.v} className="bg-[#0d2147]">{o.l}</option>)}
    </select>
  );
}

function ISPTextarea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className="bg-[#060f1e] border border-[#1e3a6e] text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 w-full placeholder:text-[#1e3a6e] resize-none" />;
}

function Field({ label, hint, required, children, wide }: {
  label: string; hint?: string; required?: boolean;
  children: React.ReactNode; wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={wide ? "col-span-2" : ""}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-blue-300 text-xs font-semibold uppercase tracking-wider">
          {label}{required && <span className="text-red-400 ml-1">*</span>}
        </span>
        {hint && (
          <button onClick={() => setOpen(o => !o)}
            className={`ml-auto text-xs px-2 py-0.5 rounded-full border transition-colors ${open ? "border-blue-500 bg-[#071630] text-blue-400" : "border-[#1e3a6e] text-[#64748b]"}`}>
            {open ? "cerrar" : "? que es esto"}
          </button>
        )}
      </div>
      {hint && open && (
        <div className="mb-2 px-3 py-2 bg-[#071630] border border-[#1d3a6e] rounded-lg text-blue-300 text-xs leading-relaxed">
          {hint}
        </div>
      )}
      {children}
    </div>
  );
}

function SiNo({ value, onChange, label, hint }: {
  value: string; onChange: (v: string) => void; label: string; hint?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-blue-300 text-xs font-semibold uppercase tracking-wider flex-1">{label}</span>
        {hint && (
          <button onClick={() => setOpen(o => !o)}
            className="text-xs px-2 py-0.5 rounded-full border border-[#1e3a6e] text-[#64748b]">
            {open ? "cerrar" : "? que es esto"}
          </button>
        )}
      </div>
      {hint && open && (
        <div className="mb-2 px-3 py-2 bg-[#071630] border border-[#1d3a6e] rounded-lg text-blue-300 text-xs leading-relaxed">
          {hint}
        </div>
      )}
      <div className="flex gap-3">
        {[{ v: "si", txt: "SI" }, { v: "no", txt: "NO" }].map(o => (
          <button key={o.v} onClick={() => onChange(o.v)}
            className="flex-1 py-4 rounded-xl text-xl font-black border-2 transition-all"
            style={{
              borderColor: value === o.v ? (o.v === "si" ? "#22c55e" : "#ef4444") : "#1e3a6e",
              background: value === o.v ? (o.v === "si" ? "#052e16" : "#2d0a0a") : "#060f1e",
              color: value === o.v ? (o.v === "si" ? "#4ade80" : "#f87171") : "#64748b",
            }}>
            {o.txt}
          </button>
        ))}
      </div>
    </div>
  );
}

function Pill({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange}
      className="px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all"
      style={{
        borderColor: checked ? "#3b82f6" : "#1e3a6e",
        background: checked ? "#0f2a5e" : "#060f1e",
        color: checked ? "#e2e8f0" : "#64748b",
      }}>
      {checked ? "✓ " : ""}{label}
    </button>
  );
}

function Sec({ title }: { title: string }) {
  return (
    <div className="col-span-2 border-b border-[#1e3a6e] pb-1">
      <span className="text-blue-300 text-xs font-bold uppercase tracking-widest">{title}</span>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-2 bg-[#071630] border border-[#1d3a6e] rounded-xl px-4 py-3 text-blue-300 text-sm leading-relaxed">
      {children}
    </div>
  );
}

function WarnBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-2 bg-[#1c0a00] border border-[#92400e] rounded-xl px-4 py-3 text-amber-400 text-sm leading-relaxed">
      {children}
    </div>
  );
}

function IgssField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [noTiene, setNoTiene] = useState(false);
  return (
    <Field label="Afiliacion IGSS"
      hint="Si ya tiene numero de IGSS, ingreseolo aqui. Si aun no tiene, puede continuar y presentarlo mas adelante. Ejemplo: 1234567890">
      {noTiene ? (
        <div className="bg-[#1c0a00] border-2 border-[#92400e] rounded-xl p-4">
          <p className="text-amber-400 font-bold mb-2">Recuerde tramitar su IGSS pronto</p>
          <p className="text-amber-300 text-sm leading-relaxed mb-3">
            Puede continuar sin el numero de IGSS por ahora, pero debera presentarlo antes de iniciar labores.
            El tramite es gratuito y rapido.
          </p>
          <div className="bg-[#0f0500] rounded-lg p-3 mb-3 text-sm">
            <p className="text-amber-400 font-semibold mb-1">IGSS Central:</p>
            <p className="text-amber-300">19 Av. 14-35 Zona 1, Guatemala City<br />Tel: 2412-1100 | Lun–Vie 7:30–15:30</p>
          </div>
          <button onClick={() => setNoTiene(false)}
            className="bg-[#1e3a6e] border border-[#3b82f6] text-white rounded-lg px-4 py-2 text-sm">
            Ya tengo mi numero de IGSS
          </button>
        </div>
      ) : (
        <>
          <ISPInput value={value} onChange={e => onChange(e.target.value)} placeholder="Ej: 1234567890" maxLength={12} />
          <button onClick={() => setNoTiene(true)}
            className="mt-1 text-amber-400 text-xs underline bg-transparent border-none cursor-pointer text-left">
            No tengo numero de IGSS todavia
          </button>
        </>
      )}
    </Field>
  );
}

function StepCard({ title, children, onBack, onNext, nextLabel = "Siguiente", nextDisabled }: {
  title: string; children: React.ReactNode;
  onBack?: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean;
}) {
  return (
    <div className="bg-[#0d2147] rounded-2xl border border-[#1e3a6e] w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden">
      <div className="bg-[#091a3d] px-5 py-4 shrink-0">
        <h2 className="text-white text-lg font-bold">{title}</h2>
      </div>
      <div className="p-5 flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
        <div className="grid grid-cols-2 gap-4">{children}</div>
      </div>
      <div className="px-5 py-4 border-t border-[#1e3a6e] flex justify-between items-center gap-3 shrink-0">
        {onBack
          ? <button onClick={onBack} className="flex items-center gap-1 px-5 py-3 rounded-xl border border-[#1e3a6e] text-[#64748b] text-sm font-semibold">
              <ChevronLeft size={16} /> Atras
            </button>
          : <div />}
        <button onClick={onNext} disabled={nextDisabled}
          className="px-8 py-3 rounded-xl text-white font-bold text-base transition-all"
          style={{ background: nextDisabled ? "#0f2147" : "#2563eb", color: nextDisabled ? "#64748b" : "#fff", cursor: nextDisabled ? "not-allowed" : "pointer", opacity: nextDisabled ? 0.6 : 1 }}>
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PASO 0: PIN
// ══════════════════════════════════════════════════════════════════════════════
function PantallaPin({ pin, error, verificando, onDigito, onBorrar }: {
  pin: string; error: boolean; verificando: boolean;
  onDigito: (d: string) => void; onBorrar: () => void;
}) {
  return (
    <div className="bg-[#0d2147] rounded-2xl p-8 w-full max-w-sm text-center shadow-2xl border border-[#1e3a6e]">
      <div className="w-14 h-14 rounded-2xl bg-[#0f2a5e] border border-[#1e3a6e] mx-auto mb-4 flex items-center justify-center">
        <Lock className="text-blue-300" size={28} />
      </div>
      <h2 className="text-white text-2xl font-bold mb-1">Bienvenido</h2>
      <p className="text-blue-300 text-sm mb-6">Ingrese el PIN de acceso al kiosco</p>
      <div className="flex justify-center gap-4 mb-6">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-5 h-5 rounded-full border-2 transition-all ${i < pin.length ? "bg-blue-400 border-blue-400" : "border-[#1e3a6e]"}`} />
        ))}
      </div>
      {error && <p className="text-red-400 text-sm mb-3">PIN incorrecto. Intente de nuevo.</p>}
      {verificando && <p className="text-blue-300 text-sm mb-3 animate-pulse">Verificando...</p>}
      <div className="grid grid-cols-3 gap-3">
        {["1","2","3","4","5","6","7","8","9"].map(d => (
          <button key={d} onClick={() => onDigito(d)}
            className="bg-[#1a3660] hover:bg-[#1e4080] active:scale-95 text-white text-2xl font-bold py-4 rounded-xl transition-all">
            {d}
          </button>
        ))}
        <div />
        <button onClick={() => onDigito("0")}
          className="bg-[#1a3660] hover:bg-[#1e4080] active:scale-95 text-white text-2xl font-bold py-4 rounded-xl transition-all">
          0
        </button>
        <button onClick={onBorrar}
          className="bg-[#2d1a1a] hover:bg-[#3d2020] active:scale-95 text-red-400 font-bold py-4 rounded-xl transition-all text-sm">
          Borrar
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PASO 1: DPI SCAN
// ══════════════════════════════════════════════════════════════════════════════
type DpiPhase = "guide" | "scanning" | "aligning" | "stable" | "flash" | "captured";

interface DatosExtraidos { nombre_completo: string; dpi: string; fecha_nacimiento: string; genero: string; municipio: string; departamento: string; }

function PasoDpi({ onFrenteDone, onReversoDone, frenteUrl, reversoUrl, onNext, onBack, onDatosExtraidos, onLimpiarDatos }: {
  onFrenteDone: (url: string) => void;
  onReversoDone: (url: string) => void;
  frenteUrl: string | null;
  reversoUrl: string | null;
  onNext: () => void;
  onBack: () => void;
  onDatosExtraidos: (datos: DatosExtraidos) => void;
  onLimpiarDatos: () => void;
}) {
  const [side, setSide]           = useState<"front" | "back">("front");
  const [phase, setPhase]         = useState<DpiPhase>("guide");
  const [stability, setStability] = useState(0);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [extrayendo, setExtrayendo]   = useState(false);
  const [datosExtraidos, setDatosExtraidos] = useState<DatosExtraidos | null>(null);
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
    clearTimers();
    setPhase("scanning");
    setStability(0);
    setCapturedUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      // 1.5s detectando → barra de estabilidad (~4s) → 3s quieto → captura
      timerRef.current = setTimeout(() => {
        setPhase("aligning");
        stabRef.current = setInterval(() => {
          setStability(prev => {
            if (prev >= 100) { clearInterval(stabRef.current!); return 100; }
            return prev + 2;
          });
        }, 80); // 80ms × 50 pasos = ~4 segundos llenando la barra
        timerRef.current = setTimeout(() => {
          setPhase("stable");
          timerRef.current = setTimeout(() => {
            // Captura el frame
            const video = videoRef.current;
            if (video) {
              const W = 1280, H = 800;
              const canvas = document.createElement("canvas");
              canvas.width = W; canvas.height = H;
              const ctx = canvas.getContext("2d")!;
              const vw = video.videoWidth || W;
              const vh = video.videoHeight || H;
              const scale = Math.max(W / vw, H / vh);
              const sw = W / scale; const sh = H / scale;
              const sx = (vw - sw) / 2; const sy = (vh - sh) / 2;
              ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);
              const url = canvas.toDataURL("image/jpeg", 0.92);
              setCapturedUrl(url);
            }
            setPhase("flash");
            stopCamera();
            timerRef.current = setTimeout(() => setPhase("captured"), 400);
          }, 3000); // 3 segundos en "stable" antes de capturar
        }, 4200); // espera que termine la barra
      }, 1500);
    } catch {
      setPhase("guide");
      alert("No se pudo acceder a la cámara. Verifique los permisos del navegador.");
    }
  };

  const confirmCapture = async () => {
    if (!capturedUrl) return;
    if (side === "front") {
      onFrenteDone(capturedUrl);
      // Extraer datos del DPI con IA
      setExtrayendo(true);
      try {
        const r = await fetch(`${API}/solicitudes-empleo/extraer-dpi`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagen: capturedUrl }),
        });
        if (r.ok) {
          const { datos } = await r.json();
          if (datos && typeof datos === "object") {
            setDatosExtraidos(datos as DatosExtraidos);
            onDatosExtraidos(datos as DatosExtraidos);
          }
        }
      } catch {
        // Si falla la extracción, no bloqueamos el flujo
      } finally {
        setExtrayendo(false);
      }
      setSide("back");
      setPhase("guide");
      setStability(0);
      setCapturedUrl(null);
    } else {
      onReversoDone(capturedUrl);
      setPhase("guide");
    }
  };

  const retry = () => {
    clearTimers(); stopCamera();
    setPhase("guide"); setStability(0); setCapturedUrl(null);
  };

  const bothDone = !!frenteUrl && !!reversoUrl;

  // ── Confirmación de datos extraídos ──
  // Cuando ambos lados están escaneados, pedir al usuario que confirme los datos
  // antes de avanzar. Si no son correctos, los limpia y pasa al formulario manual
  // (las fotos del DPI quedan guardadas igual).
  if (bothDone && phase === "guide") {
    const confirmar = () => onNext();
    const ingresarManual = () => { onLimpiarDatos(); onNext(); };
    const repetir = () => {
      onFrenteDone("");
      onReversoDone("");
      onLimpiarDatos();
      setSide("front");
      setDatosExtraidos(null);
      setCapturedUrl(null);
      setPhase("guide");
    };
    const tieneDatos = !!datosExtraidos && (
      !!datosExtraidos.nombre_completo ||
      !!datosExtraidos.dpi ||
      !!datosExtraidos.fecha_nacimiento
    );
    return (
      <div className="bg-[#0d2147] rounded-2xl border border-[#1e3a6e] w-full max-w-lg shadow-2xl flex flex-col">
        <div className="bg-[#091a3d] px-5 py-4">
          <h2 className="text-white text-lg font-bold">Confirme sus datos</h2>
          <p className="text-[#64748b] text-xs mt-1">Verifique que la información leida del DPI sea correcta.</p>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Miniaturas DPI */}
          <div className="grid grid-cols-2 gap-3">
            {frenteUrl && (
              <div className="rounded-lg overflow-hidden border-2 border-green-600/40">
                <img src={frenteUrl} alt="DPI Frente" className="w-full h-auto block" />
                <div className="bg-[#052e16] px-2 py-1 text-center">
                  <p className="text-green-400 text-[10px] font-bold">✓ FRENTE</p>
                </div>
              </div>
            )}
            {reversoUrl && (
              <div className="rounded-lg overflow-hidden border-2 border-green-600/40">
                <img src={reversoUrl} alt="DPI Reverso" className="w-full h-auto block" />
                <div className="bg-[#052e16] px-2 py-1 text-center">
                  <p className="text-green-400 text-[10px] font-bold">✓ REVERSO</p>
                </div>
              </div>
            )}
          </div>

          {/* Datos extraídos */}
          {tieneDatos ? (
            <div className="bg-[#071630] border border-[#1d4ed8] rounded-xl p-4">
              <p className="text-blue-300 text-xs font-bold uppercase tracking-wider mb-3">Datos leidos del DPI</p>
              <div className="flex flex-col gap-2">
                {[
                  { l: "Nombre completo", v: datosExtraidos!.nombre_completo },
                  { l: "DPI / CUI",       v: datosExtraidos!.dpi },
                  { l: "Fecha nacimiento", v: datosExtraidos!.fecha_nacimiento },
                  { l: "Genero",          v: datosExtraidos!.genero },
                  { l: "Municipio",       v: datosExtraidos!.municipio },
                  { l: "Departamento",    v: datosExtraidos!.departamento },
                ].filter(r => r.v).map(r => (
                  <div key={r.l} className="flex gap-3 items-baseline border-b border-[#1e3a6e]/40 pb-1.5 last:border-b-0 last:pb-0">
                    <span className="text-[#64748b] text-xs w-32 shrink-0">{r.l}:</span>
                    <span className="text-white text-sm font-medium">{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-[#2d1810] border border-yellow-700/40 rounded-xl p-4 text-center">
              <p className="text-yellow-400 text-sm font-semibold">No se pudieron leer los datos del DPI</p>
              <p className="text-[#94a3b8] text-xs mt-1">Tendra que ingresarlos manualmente en el siguiente paso. Las fotos del DPI ya quedaron guardadas.</p>
            </div>
          )}

          {/* Pregunta principal */}
          <div className="bg-[#091a3d] border border-[#1e3a6e] rounded-xl p-4 text-center">
            <p className="text-white font-bold text-base">
              {tieneDatos ? "¿Sus datos son correctos?" : "¿Como desea continuar?"}
            </p>
          </div>

          {/* Botones */}
          <div className="flex flex-col gap-2.5">
            {tieneDatos && (
              <button onClick={confirmar}
                className="w-full py-4 rounded-xl font-bold text-base text-white shadow-lg"
                style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 4px 16px rgba(22,163,74,0.35)" }}>
                ✓ Si, son correctos — continuar
              </button>
            )}
            <button onClick={ingresarManual}
              className="w-full py-3.5 rounded-xl font-bold text-base border-2 border-blue-500 bg-[#0f2a5e] text-white">
              {tieneDatos ? "No — quiero ingresarlos manualmente" : "Ingresar datos manualmente"}
            </button>
            <button onClick={repetir}
              className="w-full py-3 rounded-xl font-semibold text-sm border border-red-500/40 bg-[#2d0a0a]/40 text-red-300 hover:bg-[#2d0a0a]">
              ↻ Volver a escanear el DPI
            </button>
          </div>

          <p className="text-[#64748b] text-[11px] text-center leading-relaxed">
            Las fotos de su DPI quedan guardadas en el sistema sin importar la opcion que elija.
          </p>
        </div>

        <div className="px-5 py-4 border-t border-[#1e3a6e] flex justify-start">
          <button onClick={onBack} className="flex items-center gap-1 px-5 py-3 rounded-xl border border-[#1e3a6e] text-[#64748b] text-sm font-semibold">
            <ChevronLeft size={16} /> Atras
          </button>
        </div>
      </div>
    );
  }

  // ── Guide screen ──
  if (phase === "guide") return (
    <div className="bg-[#0d2147] rounded-2xl border border-[#1e3a6e] w-full max-w-lg shadow-2xl flex flex-col">
      <div className="bg-[#091a3d] px-5 py-4">
        <h2 className="text-white text-lg font-bold">Paso 1 — Escaneo de DPI</h2>
      </div>
      <div className="p-6 flex flex-col items-center gap-5">
        {/* Side pills */}
        <div className="flex gap-3">
          {[{ k: "front" as const, l: "Frente", done: !!frenteUrl }, { k: "back" as const, l: "Atras", done: !!reversoUrl }].map(s => (
            <div key={s.k} className="px-5 py-1.5 rounded-full text-sm font-bold border-2 transition-all"
              style={{
                borderColor: s.done ? "#16a34a" : (side === s.k ? "#3b82f6" : "#1e3a6e"),
                background: s.done ? "#052e16" : (side === s.k ? "#0f2a5e" : "#060f1e"),
                color: s.done ? "#4ade80" : (side === s.k ? "#e2e8f0" : "#64748b"),
              }}>
              {s.done ? "✓ " : ""}{s.l}
            </div>
          ))}
        </div>

        {/* Card illustration */}
        <div className="relative w-60 h-36">
          <div className="absolute inset-0 rounded-xl bg-blue-500/10 blur-xl" />
          <div className="relative w-full h-full rounded-xl border-2 border-dashed border-blue-500 flex items-center justify-center">
            {/* Corner markers */}
            {["tl","tr","bl","br"].map(pos => (
              <div key={pos} className="absolute w-6 h-6" style={{
                top: pos.startsWith("t") ? 0 : undefined,
                bottom: pos.startsWith("b") ? 0 : undefined,
                left: pos.endsWith("l") ? 0 : undefined,
                right: pos.endsWith("r") ? 0 : undefined,
                borderTop: pos.startsWith("t") ? "3px solid #60a5fa" : undefined,
                borderBottom: pos.startsWith("b") ? "3px solid #60a5fa" : undefined,
                borderLeft: pos.endsWith("l") ? "3px solid #60a5fa" : undefined,
                borderRight: pos.endsWith("r") ? "3px solid #60a5fa" : undefined,
              }} />
            ))}
            <div className="text-center">
              <div className="w-10 h-6 border-2 border-blue-300 rounded mx-auto mb-2" />
              <p className="text-blue-300 text-xs font-bold">{side === "front" ? "ANVERSO (FRENTE)" : "REVERSO (ATRAS)"}</p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-[#071630] border border-[#1d3a6e] rounded-xl p-4 w-full max-w-sm">
          <p className="text-white text-sm font-semibold text-center mb-3">
            {side === "front" ? "Escanee el frente del DPI" : "Ahora escanee el reverso"}
          </p>
          <div className="flex flex-col gap-2">
            {[
              { dot: "#facc15", txt: "Busque buena luz, evite sombras y reflejos" },
              { dot: "#3b82f6", txt: "Acerquese hasta que el DPI llene el marco" },
              { dot: "#3b82f6", txt: "Mantenga el dispositivo quieto" },
              { dot: "#22c55e", txt: "Presione el boton grande para tomar la foto" },
            ].map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: t.dot }} />
                <span className="text-[#64748b] text-sm">{t.txt}</span>
              </div>
            ))}
          </div>
        </div>

        {datosExtraidos && !bothDone && (
          <div className="w-full max-w-sm bg-[#071630] border border-[#1d4ed8] rounded-xl p-4">
            <p className="text-blue-300 text-xs font-bold uppercase tracking-wider mb-2">Datos leidos del DPI:</p>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { l: "Nombre", v: datosExtraidos.nombre_completo },
                { l: "DPI/CUI", v: datosExtraidos.dpi },
                { l: "Nacimiento", v: datosExtraidos.fecha_nacimiento },
                { l: "Municipio", v: datosExtraidos.municipio },
                { l: "Depto.", v: datosExtraidos.departamento },
              ].filter(r => r.v).map(r => (
                <div key={r.l} className="flex gap-2 items-baseline">
                  <span className="text-[#64748b] text-xs w-20 shrink-0">{r.l}:</span>
                  <span className="text-white text-xs font-medium">{r.v}</span>
                </div>
              ))}
            </div>
            <p className="text-[#64748b] text-xs mt-2">Puede corregir estos datos en el siguiente paso.</p>
          </div>
        )}
        {bothDone ? (
          <div className="w-full flex flex-col gap-3">
            <div className="bg-[#052e16] border-2 border-[#16a34a] rounded-xl p-4 text-center">
              <p className="text-green-400 font-bold">✓ Ambos lados capturados</p>
            </div>
            <button onClick={onNext} className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg">
              Continuar con el formulario
            </button>
          </div>
        ) : (
          <button onClick={openCamera}
            className="w-full max-w-sm py-4 rounded-xl font-bold text-lg text-white shadow-lg"
            style={{ background: "linear-gradient(135deg, #1d4ed8, #2563eb)", boxShadow: "0 4px 20px rgba(37,99,235,0.4)" }}>
            Abrir camara
          </button>
        )}

        {!bothDone && (
          <button onClick={onNext} className="text-[#64748b] text-sm underline">
            Omitir escaneo de DPI (continuar sin foto)
          </button>
        )}
      </div>
      <div className="px-5 py-4 border-t border-[#1e3a6e] flex justify-start">
        <button onClick={onBack} className="flex items-center gap-1 px-5 py-3 rounded-xl border border-[#1e3a6e] text-[#64748b] text-sm font-semibold">
          <ChevronLeft size={16} /> Atras
        </button>
      </div>
    </div>
  );

  // ── Captured confirmation ──
  if (phase === "captured") return (
    <div className="bg-[#0d2147] rounded-2xl border border-[#1e3a6e] w-full max-w-lg shadow-2xl p-6 flex flex-col items-center gap-5">
      <p className="text-green-400 font-bold text-lg">{side === "front" ? "Frente" : "Reverso"} capturado</p>
      {capturedUrl && (
        <div className="rounded-xl overflow-hidden w-full max-w-xs" style={{ border: "3px solid #22c55e", boxShadow: "0 0 24px rgba(34,197,94,0.3)" }}>
          <img src={capturedUrl} alt="DPI capturado" className="w-full h-auto" />
        </div>
      )}
      <p className="text-[#64748b] text-sm">Se ve bien el DPI?</p>
      <div className="flex gap-3 w-full max-w-xs">
        <button onClick={retry} className="flex-1 py-3 rounded-xl border-2 border-red-500 bg-[#2d0a0a] text-red-400 font-bold">
          Repetir
        </button>
        <button onClick={confirmCapture} disabled={extrayendo}
          className="flex-1 py-3 px-4 rounded-xl border-2 font-bold transition-all"
          style={{ borderColor: extrayendo ? "#1e3a6e" : "#22c55e", background: extrayendo ? "#060f1e" : "#052e16", color: extrayendo ? "#64748b" : "#4ade80" }}>
          {extrayendo ? "Analizando..." : (side === "front" ? "Si, continuar" : "Listo")}
        </button>
      </div>
      {extrayendo && (
        <div className="flex items-center gap-3 bg-[#071630] border border-[#1e3a6e] rounded-xl px-4 py-3 w-full max-w-xs">
          <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
          <p className="text-blue-300 text-sm">Leyendo datos del DPI con IA...</p>
        </div>
      )}
    </div>
  );

  // ── Camera viewfinder ──
  const cornerColor =
    phase === "stable"   ? "#22c55e" :
    phase === "aligning" ? "#facc15" : "#60a5fa";

  return (
    <div className="bg-[#0d2147] rounded-2xl border border-[#1e3a6e] w-full max-w-lg shadow-2xl flex flex-col items-center p-4 gap-4">
      <div className="flex gap-3">
        <div className="px-4 py-1.5 rounded-full text-sm font-bold bg-[#0f2a5e] border-2 border-blue-500 text-white">
          {side === "front" ? "Frente del DPI" : "Reverso del DPI"}
        </div>
      </div>

      {/* Camera viewfinder */}
      <div className="relative rounded-xl overflow-hidden w-full" style={{ aspectRatio: "4/3", background: "#060f1e" }}>
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        {phase === "flash" && <div className="absolute inset-0 bg-white opacity-95" />}

        {/* Overlay oscuro fuera del marco guía */}
        <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.4)" }} />

        {/* Marco del DPI — grande para que el usuario se acerque */}
        <div className="absolute" style={{ left: "5%", right: "5%", top: "18%", bottom: "18%" }}>
          <div className="absolute inset-0 rounded-xl" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)", background: "transparent" }} />
          <div className="absolute inset-0 rounded-xl" style={{ border: `2px dashed ${cornerColor}80`, transition: "border-color 0.4s" }} />
          {/* Esquinas */}
          {["tl","tr","bl","br"].map(pos => (
            <div key={pos} className="absolute w-8 h-8" style={{
              top: pos.startsWith("t") ? -1 : undefined,
              bottom: pos.startsWith("b") ? -1 : undefined,
              left: pos.endsWith("l") ? -1 : undefined,
              right: pos.endsWith("r") ? -1 : undefined,
              borderTop: pos.startsWith("t") ? `4px solid ${cornerColor}` : undefined,
              borderBottom: pos.startsWith("b") ? `4px solid ${cornerColor}` : undefined,
              borderLeft: pos.endsWith("l") ? `4px solid ${cornerColor}` : undefined,
              borderRight: pos.endsWith("r") ? `4px solid ${cornerColor}` : undefined,
              borderRadius: pos === "tl" ? "8px 0 0 0" : pos === "tr" ? "0 8px 0 0" : pos === "bl" ? "0 0 0 8px" : "0 0 8px 0",
              transition: "border-color 0.4s",
            }} />
          ))}
        </div>

        {/* Estado en la parte superior */}
        {phase !== "flash" && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/70 rounded-full px-4 py-1.5 border"
            style={{ borderColor: cornerColor, transition: "border-color 0.4s" }}>
            <p className="text-xs font-bold" style={{ color: cornerColor }}>
              {phase === "scanning" ? "Acerque el DPI al marco..." :
               phase === "aligning" ? "Ajuste la posición..." :
               phase === "stable"   ? "Perfecto — no se mueva..." : ""}
            </p>
          </div>
        )}
      </div>

      {/* Barra de estabilidad */}
      {(phase === "aligning" || phase === "stable") && (
        <div className="w-full">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[#64748b]">Estabilidad</span>
            <span className="font-bold" style={{ color: stability >= 100 ? "#4ade80" : "#facc15" }}>
              {stability >= 100 ? "Listo" : `${stability}%`}
            </span>
          </div>
          <div className="bg-[#0a1628] rounded-full h-2 border border-[#1e3a6e] overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{
              width: `${stability}%`,
              background: stability >= 100 ? "linear-gradient(90deg,#16a34a,#22c55e)" : "linear-gradient(90deg,#d97706,#facc15)",
            }} />
          </div>
        </div>
      )}

      {/* Instrucción */}
      <div className="bg-[#071630] border border-[#1e3a6e] rounded-xl px-4 py-3 w-full text-center text-sm">
        {phase === "scanning" && <p className="text-[#64748b]">Coloque el DPI <strong className="text-white">dentro del marco</strong> y acérquese — se detectará automáticamente</p>}
        {phase === "aligning" && <p className="text-amber-400 font-bold">Casi perfecto — ajuste un poco y no mueva el dispositivo</p>}
        {phase === "stable"   && <p className="text-green-400 font-bold">Excelente — tomando foto en unos segundos...</p>}
      </div>

      <button onClick={retry} className="text-[#64748b] text-sm border border-[#1e3a6e] rounded-lg px-5 py-2">
        Cancelar
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PASO 2: DATOS PERSONALES
// ══════════════════════════════════════════════════════════════════════════════
function PasoPersonal({ form, setEv, set, onNext, onBack }: {
  form: FormData; setEv: (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  set: (k: keyof FormData) => (v: string) => void; onNext: () => void; onBack: () => void;
}) {
  const ok = form.nombre_completo.trim().length >= 4 && form.dpi.length >= 13 && form.telefono.length >= 8;
  return (
    <StepCard title="Paso 2 — Sus Datos Personales" onBack={onBack} onNext={onNext} nextDisabled={!ok}>
      <Field label="Plaza que solicita" required hint="Cargo al que desea aplicar en ISP." wide>
        <ISPSelect value={form.puesto_solicitado} onChange={set("puesto_solicitado")} options={PUESTOS} />
      </Field>
      <Field label="Nombre completo" required hint="Exactamente como aparece en su DPI. Primero apellidos, luego nombres." wide>
        <ISPInput value={form.nombre_completo} onChange={setEv("nombre_completo")} placeholder="PEREZ GARCIA Juan Carlos" />
      </Field>
      <Field label="Profesion u oficio" hint="Su titulo o que sabe hacer. Ej: Bachiller, Electricista, Agricultor.">
        <ISPInput value={form.profesion} onChange={setEv("profesion")} placeholder="Ej: Bachiller en CCLL" />
      </Field>
      <Field label="Fecha de nacimiento">
        <ISPInput type="date" value={form.fecha_nacimiento} onChange={setEv("fecha_nacimiento")} />
      </Field>
      <Field label="DPI / CUI" required hint="Los 13 numeros de su tarjeta azul de la Registral.">
        <ISPInput value={form.dpi} onChange={setEv("dpi")} placeholder="1234 56789 0101" maxLength={15} />
      </Field>
      <Field label="NIT" hint="De la SAT. Si no tiene, escriba CF.">
        <ISPInput value={form.nit} onChange={setEv("nit")} placeholder="1234567-8  o  CF" />
      </Field>
      <div className="col-span-2">
        <IgssField value={form.igss} onChange={set("igss")} />
      </div>
      <Field label="Telefono movil" required hint="Celular donde podemos contactarle.">
        <ISPInput value={form.telefono} onChange={setEv("telefono")} type="tel" placeholder="5432-1098" />
      </Field>
      <Field label="Telefono fijo" hint="Opcional. Dejelo en blanco si no tiene.">
        <ISPInput value={form.telefono_fijo} onChange={setEv("telefono_fijo")} type="tel" placeholder="2345-6789 (opcional)" />
      </Field>
      <Field label="Correo electronico" hint="Gmail, Hotmail, etc. Opcional." wide>
        <ISPInput value={form.correo} onChange={setEv("correo")} type="email" placeholder="juan.perez@gmail.com (opcional)" />
      </Field>
      <Field label="Estado civil">
        <ISPSelect value={form.estado_civil} onChange={set("estado_civil")} options={["Soltero/a","Casado/a","Unido/a","Divorciado/a","Viudo/a"]} />
      </Field>
      <Field label="Genero">
        <ISPSelect value={form.genero} onChange={set("genero")} options={["Masculino","Femenino","Prefiero no decir"]} />
      </Field>
      <Field label="Nacionalidad">
        <ISPSelect value={form.nacionalidad} onChange={set("nacionalidad")} options={["Guatemalteca","Hondurena","Salvadorena","Nicaraguense","Costarricense","Otra"]} />
      </Field>
      <Field label="Lugar de nacimiento" hint="Municipio y departamento donde nacio.">
        <ISPInput value={form.lugar_nacimiento} onChange={setEv("lugar_nacimiento")} placeholder="Ej: Chiquimula, Chiquimula" />
      </Field>
    </StepCard>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PASO 3: DOMICILIO + BANCO + LICENCIA
// ══════════════════════════════════════════════════════════════════════════════
function PasoDomicilio({ form, setEv, set, onNext, onBack }: {
  form: FormData; setEv: (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  set: (k: keyof FormData) => (v: string) => void; onNext: () => void; onBack: () => void;
}) {
  return (
    <StepCard title="Paso 3 — Domicilio, Banco y Licencia" onBack={onBack} onNext={onNext}>
      <Sec title="Donde vive?" />
      <Field label="Direccion actual" hint="Calle, numero de casa, zona o aldea." wide>
        <ISPInput value={form.direccion} onChange={setEv("direccion")} placeholder="Ej: 3ra Calle 5-20 Zona 3, Colonia El Esfuerzo" />
      </Field>
      <Field label="Municipio">
        <ISPInput value={form.municipio} onChange={setEv("municipio")} placeholder="Ej: Mixco" />
      </Field>
      <Field label="Departamento">
        <ISPSelect value={form.departamento} onChange={set("departamento")} options={DEPTOS} />
      </Field>
      <Field label="Tiempo viviendo ahi?">
        <ISPSelect value={form.tiempo_residencia} onChange={set("tiempo_residencia")} options={["Menos de 1 año","1 a 3 años","3 a 5 años","Más de 5 años"]} />
      </Field>
      <Field label="Su casa es...">
        <ISPSelect value={form.tipo_vivienda} onChange={set("tipo_vivienda")} options={["Propia","Alquilada","Familiar / prestada"]} />
      </Field>
      {form.tipo_vivienda === "Alquilada" && (
        <Field label="Renta mensual (Q)">
          <ISPInput value={form.renta_mensual} onChange={setEv("renta_mensual")} type="number" placeholder="Ej: 800" />
        </Field>
      )}

      <Sec title="Cuenta bancaria (para recibir sueldo)" />
      <InfoBox>Si aun no tiene cuenta bancaria, puede dejar esta seccion en blanco.</InfoBox>
      <Field label="Banco" hint="Donde tiene su cuenta de ahorros o monetaria.">
        <ISPSelect value={form.banco} onChange={set("banco")} options={BANCOS} />
      </Field>
      <Field label="Tipo de cuenta">
        <ISPSelect value={form.tipo_cuenta} onChange={set("tipo_cuenta")} options={["Monetaria (Cheques)","Ahorro"]} />
      </Field>
      <Field label="Numero de cuenta" hint="Copie exactamente de su libreta o tarjeta." wide>
        <ISPInput value={form.num_cuenta} onChange={setEv("num_cuenta")} placeholder="Ej: 3-000-12345-6 (opcional)" />
      </Field>

      <Sec title="Licencia de conducir" />
      <div className="col-span-2">
        <SiNo value={form.tiene_licencia} onChange={set("tiene_licencia")} label="Tiene licencia de conducir?" />
      </div>
      {form.tiene_licencia === "si" && (
        <>
          <Field label="Tipo / Categoria" hint="A=motocicleta, B=automovil, C=camion, M=maquinaria.">
            <ISPSelect value={form.tipo_licencia} onChange={set("tipo_licencia")} options={["A — Motocicleta","B — Automovil","C — Camion / Bus","M — Maquinaria","E — Emergencia"]} />
          </Field>
          <Field label="Valida hasta (vencimiento)">
            <ISPInput type="date" value={form.vigencia_licencia} onChange={setEv("vigencia_licencia")} />
          </Field>
        </>
      )}
    </StepCard>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PASO 4: FAMILIA
// ══════════════════════════════════════════════════════════════════════════════
function PasoFamilia({ form, setEv, set, onNext, onBack }: {
  form: FormData; setEv: (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  set: (k: keyof FormData) => (v: string) => void; onNext: () => void; onBack: () => void;
}) {
  return (
    <StepCard title="Paso 4 — Su Familia" onBack={onBack} onNext={onNext}>
      <InfoBox>Esta informacion es confidencial y solo se usa para el expediente interno de ISP.</InfoBox>
      <Sec title="Sus papas" />
      <Field label="Nombre de su papa"><ISPInput value={form.nombre_padre} onChange={setEv("nombre_padre")} placeholder="Nombre completo" /></Field>
      <Field label="Telefono de su papa"><ISPInput value={form.tel_padre} onChange={setEv("tel_padre")} type="tel" placeholder="5432-1098" /></Field>
      <Field label="Nombre de su mama"><ISPInput value={form.nombre_madre} onChange={setEv("nombre_madre")} placeholder="Nombre completo" /></Field>
      <Field label="Telefono de su mama"><ISPInput value={form.tel_madre} onChange={setEv("tel_madre")} type="tel" placeholder="5432-1098" /></Field>

      <Sec title="Esposo/a o pareja (si aplica)" />
      <Field label="Nombre de su pareja" wide><ISPInput value={form.nombre_conyuge} onChange={setEv("nombre_conyuge")} placeholder="Nombre completo (si aplica)" /></Field>
      <Field label="Donde trabaja?"><ISPInput value={form.ocup_conyuge} onChange={setEv("ocup_conyuge")} placeholder="Empresa u ocupacion" /></Field>
      <Field label="Telefono"><ISPInput value={form.tel_conyuge} onChange={setEv("tel_conyuge")} type="tel" placeholder="5432-1098" /></Field>

      <Sec title="Hijos y hermanos" />
      <Field label="Cuantos hijos tiene?">
        <ISPSelect value={form.num_dependientes} onChange={set("num_dependientes")} options={["0","1","2","3","4","5","6 o más"]} />
      </Field>
      <div />
      <Field label="Hermano 1 — nombre"><ISPInput value={form.hermano1_nombre} onChange={setEv("hermano1_nombre")} placeholder="Nombre (si aplica)" /></Field>
      <Field label="Hermano 1 — telefono"><ISPInput value={form.hermano1_tel} onChange={setEv("hermano1_tel")} type="tel" placeholder="5432-1098" /></Field>
      <Field label="Hermano 2 — nombre"><ISPInput value={form.hermano2_nombre} onChange={setEv("hermano2_nombre")} placeholder="Nombre (si aplica)" /></Field>
      <Field label="Hermano 2 — telefono"><ISPInput value={form.hermano2_tel} onChange={setEv("hermano2_tel")} type="tel" placeholder="5432-1098" /></Field>

      <Sec title="Redes sociales (opcional)" />
      <Field label="Facebook"><ISPInput value={form.facebook} onChange={setEv("facebook")} placeholder="facebook.com/usuario" /></Field>
      <Field label="Instagram"><ISPInput value={form.instagram} onChange={setEv("instagram")} placeholder="@usuario" /></Field>

      <Sec title="Familiares en ISP" />
      <div className="col-span-2">
        <SiNo value={form.familiar_en_empresa} onChange={set("familiar_en_empresa")} label="Tiene familiares trabajando en ISP actualmente?" />
      </div>
      {form.familiar_en_empresa === "si" && (
        <Field label="Nombre del familiar en ISP" wide>
          <ISPInput value={form.nombre_familiar_empresa} onChange={setEv("nombre_familiar_empresa")} placeholder="Nombre completo" />
        </Field>
      )}
    </StepCard>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PASO 5: SALUD
// ══════════════════════════════════════════════════════════════════════════════
function PasoSalud({ form, setEv, set, onNext, onBack }: {
  form: FormData; setEv: (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  set: (k: keyof FormData) => (v: string) => void; onNext: () => void; onBack: () => void;
}) {
  return (
    <StepCard title="Paso 5 — Su Salud" onBack={onBack} onNext={onNext}>
      <InfoBox>Responda con honestidad. Esta informacion es confidencial y ayuda a asignarle el puesto mas adecuado.</InfoBox>
      <Field label="Estatura" hint="Sin zapatos, en metros. Ej: si mide 1 metro 75 cm, escriba 1.75">
        <ISPInput value={form.estatura} onChange={setEv("estatura")} placeholder="Ej: 1.75 (en metros)" />
      </Field>
      <Field label="Peso" hint="En kilogramos. Ej: 80 kg, escriba 80.">
        <ISPInput value={form.peso} onChange={setEv("peso")} type="number" placeholder="Ej: 80 (en kg)" />
      </Field>

      <div className="col-span-2"><SiNo value={form.enfermedad_cronica} onChange={set("enfermedad_cronica")} label="Tiene alguna enfermedad cronica?" hint="Diabetes, hipertension, epilepsia, asma u otras que requieren control medico regular." /></div>
      {form.enfermedad_cronica === "si" && <Field label="Cual enfermedad?" wide><ISPTextarea value={form.enfermedad_det} onChange={setEv("enfermedad_det")} rows={2} placeholder="Nombre de la enfermedad..." /></Field>}

      <div className="col-span-2"><SiNo value={form.medicamento} onChange={set("medicamento")} label="Toma algun medicamento actualmente?" /></div>
      {form.medicamento === "si" && <Field label="Cual medicamento?" wide><ISPInput value={form.medicamento_det} onChange={setEv("medicamento_det")} placeholder="Nombre del medicamento" /></Field>}

      <div className="col-span-2"><SiNo value={form.impedimento_fisico} onChange={set("impedimento_fisico")} label="Tiene algun impedimento fisico?" hint="Problemas en manos, pies, espalda, vista o audicion que dificulten actividades." /></div>
      {form.impedimento_fisico === "si" && <Field label="Cual impedimento?" wide><ISPInput value={form.impedimento_det} onChange={setEv("impedimento_det")} placeholder="Describalo brevemente..." /></Field>}

      <div className="col-span-2"><SiNo value={form.consume_alcohol} onChange={set("consume_alcohol")} label="Consume bebidas alcoholicas?" /></div>
      <div className="col-span-2"><SiNo value={form.consume_drogas} onChange={set("consume_drogas")} label="Ha consumido drogas alguna vez?" /></div>

      <div className="col-span-2"><SiNo value={form.tiene_tatuajes} onChange={set("tiene_tatuajes")} label="Tiene tatuajes?" hint="Los tatuajes no son impedimento. ISP necesita saberlo para el expediente." /></div>
      {form.tiene_tatuajes === "si" && <Field label="Que representan sus tatuajes?" wide><ISPTextarea value={form.tatuajes_det} onChange={setEv("tatuajes_det")} rows={2} placeholder="Explique brevemente..." /></Field>}

      <Sec title="Contacto de emergencia" />
      <p className="col-span-2 text-[#64748b] text-sm -mt-2">A quien debemos llamar si le pasa algo en el trabajo?</p>
      <Field label="Nombre de la persona" wide>
        <ISPInput value={form.nombre_contacto_emergencia} onChange={setEv("nombre_contacto_emergencia")} placeholder="Nombre completo" />
      </Field>
      <Field label="Telefono de esa persona">
        <ISPInput value={form.telefono_emergencia} onChange={setEv("telefono_emergencia")} type="tel" placeholder="5432-1098" />
      </Field>
      <Field label="Parentesco con usted">
        <ISPSelect value={form.parentesco_emergencia} onChange={set("parentesco_emergencia")} options={["Es mi mama","Es mi papa","Es mi esposo/a o pareja","Es mi hermano/a","Es mi hijo/a","Es otro familiar","Es un amigo/a"]} />
      </Field>
    </StepCard>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PASO 6: ANTECEDENTES
// ══════════════════════════════════════════════════════════════════════════════
function PasoAntecedentes({ form, setEv, set, onNext, onBack }: {
  form: FormData; setEv: (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  set: (k: keyof FormData) => (v: string) => void; onNext: () => void; onBack: () => void;
}) {
  return (
    <StepCard title="Paso 6 — Antecedentes y Situacion Financiera" onBack={onBack} onNext={onNext}>
      <WarnBox>ISP realiza verificaciones de antecedentes. Responda con honestidad — ocultar informacion puede resultar en descalificacion inmediata.</WarnBox>

      <Sec title="Antecedentes legales" />
      <div className="col-span-2"><SiNo value={form.proceso_judicial} onChange={set("proceso_judicial")} label="Tiene algun proceso judicial en curso?" hint="Juicio o investigacion pendiente en los tribunales." /></div>
      {form.proceso_judicial === "si" && <Field label="Por que motivo?" wide><ISPTextarea value={form.proceso_det} onChange={setEv("proceso_det")} rows={2} placeholder="Explique brevemente..." /></Field>}

      <div className="col-span-2"><SiNo value={form.detenido} onChange={set("detenido")} label="Ha sido detenido o arrestado alguna vez?" /></div>
      {form.detenido === "si" && <Field label="Por que motivo?" wide><ISPTextarea value={form.detencion_det} onChange={setEv("detencion_det")} rows={2} placeholder="Explique brevemente..." /></Field>}

      <Sec title="Situacion economica" />
      <InfoBox>Esta informacion es privada y solo ayuda a entender su situacion actual.</InfoBox>
      <div className="col-span-2"><SiNo value={form.tiene_deudas} onChange={set("tiene_deudas")} label="Tiene deudas pendientes?" /></div>
      {form.tiene_deudas === "si" && (
        <Field label="Como esta su deuda?" wide>
          <ISPSelect value={form.estado_deuda} onChange={set("estado_deuda")} options={["Al dia (pagando puntual)","Con atraso (me he atrasado en pagos)"]} />
        </Field>
      )}
      <Field label="Gastos mensuales aproximados (Q)" hint="Sume alimentacion, renta, transporte y otros. Es un estimado." wide>
        <ISPInput value={form.gastos_mensuales} onChange={setEv("gastos_mensuales")} type="number" placeholder="Ej: 2500" />
      </Field>
      <div className="col-span-2"><SiNo value={form.tiene_prestamo} onChange={set("tiene_prestamo")} label="Tiene algun prestamo bancario o personal?" /></div>
      {form.tiene_prestamo === "si" && (
        <Field label="Monto del prestamo (Q)" wide>
          <ISPInput value={form.monto_prestamo} onChange={setEv("monto_prestamo")} type="number" placeholder="Ej: 15000" />
        </Field>
      )}
    </StepCard>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PASO 7: EDUCACION + EXPERIENCIA
// ══════════════════════════════════════════════════════════════════════════════
function PasoEducacion({ form, setEv, set, onNext, onBack }: {
  form: FormData; setEv: (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  set: (k: keyof FormData) => (v: string) => void; onNext: () => void; onBack: () => void;
}) {
  return (
    <StepCard title="Paso 7 — Educacion y Experiencia Laboral" onBack={onBack} onNext={onNext}>
      <InfoBox>Llene solo los niveles educativos que completo. Si no termino un nivel, escriba "Incompleto" en el titulo.</InfoBox>

      {([
        { label: "Primaria (1ro a 6to grado)", k: "prim" },
        { label: "Basico (1ro a 3ro basico)", k: "bas" },
        { label: "Diversificado (bachillerato / carrera)", k: "div" },
        { label: "Universidad (si aplica)", k: "uni" },
      ] as { label: string; k: string }[]).map(({ label, k }) => (
        <>
          <Sec key={`sec-${k}`} title={label} />
          <Field key={`${k}_escuela`} label="Nombre del establecimiento">
            <ISPInput value={(form as Record<string, string>)[`${k}_escuela`]} onChange={setEv(`${k}_escuela` as keyof FormData)} placeholder="Nombre de la escuela o colegio..." />
          </Field>
          <Field key={`${k}_lugar`} label="Ciudad o municipio">
            <ISPInput value={(form as Record<string, string>)[`${k}_lugar`]} onChange={setEv(`${k}_lugar` as keyof FormData)} placeholder="Ej: Guatemala, Guatemala" />
          </Field>
          <Field key={`${k}_titulo`} label="Titulo obtenido" wide>
            <ISPInput value={(form as Record<string, string>)[`${k}_titulo`]} onChange={setEv(`${k}_titulo` as keyof FormData)} placeholder='Ej: Bachiller en CCLL  —  o  —  "Incompleto"' />
          </Field>
        </>
      ))}

      <Sec title="Nivel educativo general" />
      <Field label="Grado de estudios mas alto alcanzado" wide>
        <ISPSelect value={form.grado_estudios} onChange={set("grado_estudios")} options={["Primaria","Básicos","Diversificado (Bachillerato)","Técnico / PEM","Universidad (estudiante)","Universitario graduado"]} />
      </Field>

      <Sec title="Experiencia laboral (empiece por el trabajo mas reciente)" />
      <InfoBox>Si solo ha tenido 1 trabajo, llene solo la primera empresa.</InfoBox>
      {([1, 2, 3] as (1|2|3)[]).map(n => (
        <>
          <Sec key={`emp-sec-${n}`} title={n === 1 ? "Trabajo mas reciente *" : `Trabajo anterior ${n - 1} (si aplica)`} />
          <Field key={`emp${n}_nombre`} label="Nombre de la empresa" wide>
            <ISPInput value={(form as Record<string,string>)[`emp${n}_nombre`]} onChange={setEv(`emp${n}_nombre` as keyof FormData)} placeholder={n === 1 ? "Empresa donde trabajo mas recientemente" : "Dejelo en blanco si no aplica"} />
          </Field>
          <Field key={`emp${n}_puesto`} label="Que cargo tenia?">
            <ISPInput value={(form as Record<string,string>)[`emp${n}_puesto`]} onChange={setEv(`emp${n}_puesto` as keyof FormData)} placeholder="Ej: Guardia de Seguridad" />
          </Field>
          <Field key={`emp${n}_salario`} label="Sueldo que ganaba (Q)">
            <ISPInput value={(form as Record<string,string>)[`emp${n}_salario`]} onChange={setEv(`emp${n}_salario` as keyof FormData)} type="number" placeholder="Ej: 3200" />
          </Field>
          <Field key={`emp${n}_inicio`} label="Mes y año que entro">
            <ISPInput type="month" value={(form as Record<string,string>)[`emp${n}_inicio`]} onChange={setEv(`emp${n}_inicio` as keyof FormData)} />
          </Field>
          <Field key={`emp${n}_fin`} label="Mes y año que salio">
            <ISPInput type="month" value={(form as Record<string,string>)[`emp${n}_fin`]} onChange={setEv(`emp${n}_fin` as keyof FormData)} />
          </Field>
          <Field key={`emp${n}_motivo`} label="Por que salio?" wide>
            <ISPSelect value={(form as Record<string,string>)[`emp${n}_motivo`]} onChange={set(`emp${n}_motivo` as keyof FormData)} options={MOTIVOS_SALIDA} />
          </Field>
        </>
      ))}
    </StepCard>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PASO 8: SEGURIDAD + HABILIDADES
// ══════════════════════════════════════════════════════════════════════════════
function PasoSeguridad({ form, setEv, set, habilidades, setHabilidades, tiposSeg, setTiposSeg, onNext, onBack }: {
  form: FormData; setEv: (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  set: (k: keyof FormData) => (v: string) => void;
  habilidades: string[]; setHabilidades: (v: string[]) => void;
  tiposSeg: string[]; setTiposSeg: (v: string[]) => void;
  onNext: () => void; onBack: () => void;
}) {
  const togHab = (v: string) => setHabilidades(habilidades.includes(v) ? habilidades.filter(x => x !== v) : [...habilidades, v]);
  const togSeg = (v: string) => setTiposSeg(tiposSeg.includes(v) ? tiposSeg.filter(x => x !== v) : [...tiposSeg, v]);
  return (
    <StepCard title="Paso 8 — Seguridad y Habilidades" onBack={onBack} onNext={onNext}>
      <Sec title="Experiencia en seguridad" />
      <div className="col-span-2"><SiNo value={form.experiencia_seguridad} onChange={set("experiencia_seguridad")} label="Ha trabajado como agente de seguridad antes?" /></div>
      {form.experiencia_seguridad === "si" && (
        <>
          <Field label="Años de experiencia">
            <ISPSelect value={form.anios_experiencia} onChange={set("anios_experiencia")} options={["1","2","3","4","5","6","7","8","9","10 o más"]} />
          </Field>
          <Field label="Ultima empresa en seguridad">
            <ISPInput value={form.empresa_anterior} onChange={setEv("empresa_anterior")} placeholder="Nombre de la empresa" />
          </Field>
          <Field label="Tipo de seguridad (puede marcar mas de uno)" wide>
            <div className="flex flex-wrap gap-2 mt-1">
              {["Seguridad privada","Seguridad bancaria","Custodia armada","Transporte de valores"].map(t => (
                <Pill key={t} label={t} checked={tiposSeg.includes(t)} onChange={() => togSeg(t)} />
              ))}
            </div>
          </Field>
        </>
      )}

      <Sec title="Servicio militar o policial" />
      <div className="col-span-2"><SiNo value={form.servicio_militar} onChange={set("servicio_militar")} label="Presto servicio militar?" /></div>
      {form.servicio_militar === "si" && (
        <>
          <Field label="Rango que alcanzo"><ISPInput value={form.rango_militar} onChange={setEv("rango_militar")} placeholder="Ej: Cabo, Sargento..." /></Field>
          <Field label="Unidad donde sirvio"><ISPInput value={form.unidad_militar} onChange={setEv("unidad_militar")} placeholder="Nombre de la unidad" /></Field>
        </>
      )}
      <div className="col-span-2"><SiNo value={form.fue_policia} onChange={set("fue_policia")} label="Pertenecio a la Policia Nacional Civil u otra fuerza?" /></div>
      {form.fue_policia === "si" && (
        <Field label="Por que se retiro?" wide><ISPInput value={form.motivo_baja_policial} onChange={setEv("motivo_baja_policial")} placeholder="Motivo de retiro..." /></Field>
      )}

      <Sec title="Sus habilidades (marque las que tiene)" />
      <div className="col-span-2 flex flex-wrap gap-2">
        {["Manejo de armas","Defensa personal","Control de accesos","Radio comunicacion","Trabajo bajo presion","Resolucion de conflictos"].map(h => (
          <Pill key={h} label={h} checked={habilidades.includes(h)} onChange={() => togHab(h)} />
        ))}
      </div>

      <Sec title="Disponibilidad" />
      <div className="col-span-2"><SiNo value={form.disp_rotativo} onChange={set("disp_rotativo")} label="Puede trabajar en turnos rotativos?" hint="Un dia de dia, otro de noche segun el puesto asignado." /></div>
      <div className="col-span-2"><SiNo value={form.disp_nocturno} onChange={set("disp_nocturno")} label="Puede trabajar de noche?" /></div>
      <div className="col-span-2"><SiNo value={form.disp_fds} onChange={set("disp_fds")} label="Puede trabajar sabados y domingos?" /></div>
      <div className="col-span-2"><SiNo value={form.disponible_exterior} onChange={set("disponible_exterior")} label="Puede trabajar fuera de la ciudad?" /></div>
      <div className="col-span-2"><SiNo value={form.tiene_vehiculo} onChange={set("tiene_vehiculo")} label="Tiene vehiculo propio?" /></div>
      <div className="col-span-2"><SiNo value={form.licencia_armas} onChange={set("licencia_armas")} label="Tiene licencia de portacion de armas vigente?" /></div>

      <Sec title="Pretension salarial" />
      <Field label="Cuanto espera ganar mensualmente? (Q) — opcional" wide>
        <ISPInput value={form.pretension_salarial} onChange={setEv("pretension_salarial")} type="number" placeholder="Ej: 3500" />
      </Field>
      <Field label="Disponibilidad de horario preferida" wide>
        <ISPSelect value={form.disponibilidad_horario} onChange={set("disponibilidad_horario")} options={["Diurno (06:00 - 18:00)","Nocturno (18:00 - 06:00)","Mixto","Rotativo"]} />
      </Field>
    </StepCard>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PASO 9: REFERENCIAS
// ══════════════════════════════════════════════════════════════════════════════
function PasoReferencias({ form, setEv, onNext, onBack }: {
  form: FormData; setEv: (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNext: () => void; onBack: () => void;
}) {
  return (
    <StepCard title="Paso 9 — Referencias Personales" onBack={onBack} onNext={onNext}>
      <InfoBox>
        <strong>Que es una referencia?</strong> Son personas que nos pueden decir como es usted.
        No pueden ser familiares directos (papa, mama, hermanos). Pueden ser vecinos, amigos de confianza o ex companeros de trabajo.
      </InfoBox>
      {([1, 2, 3] as (1|2|3)[]).map(n => (
        <>
          <Sec key={`ref-sec-${n}`} title={`Referencia ${n}${n > 1 ? " (si aplica)" : " *"}`} />
          <Field key={`ref${n}_nombre`} label="Nombre completo" wide>
            <ISPInput value={(form as Record<string,string>)[`ref${n}_nombre`]} onChange={setEv(`ref${n}_nombre` as keyof FormData)} placeholder="Nombre de la persona que le conoce" />
          </Field>
          <Field key={`ref${n}_ocup`} label="A que se dedica?">
            <ISPInput value={(form as Record<string,string>)[`ref${n}_ocupacion`]} onChange={setEv(`ref${n}_ocupacion` as keyof FormData)} placeholder="Ej: Comerciante, Docente..." />
          </Field>
          <Field key={`ref${n}_tel`} label="Telefono">
            <ISPInput value={(form as Record<string,string>)[`ref${n}_tel`]} onChange={setEv(`ref${n}_tel` as keyof FormData)} type="tel" placeholder="5432-1098" />
          </Field>
        </>
      ))}
      <div className="col-span-2 bg-[#071020] border border-[#1e3a6e] rounded-xl p-4">
        <p className="text-[#64748b] text-xs leading-relaxed">
          <span className="text-blue-300 font-bold">Declaracion: </span>
          Declaro que toda la informacion proporcionada es verdadera y autorizo a ISP, S.A. a verificar mis datos.
          Me comprometo a cumplir el reglamento interno y las condiciones del Codigo de Trabajo (Decreto No. 1441).
        </p>
      </div>
    </StepCard>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PASO 10: FOTO DE ROSTRO
// ══════════════════════════════════════════════════════════════════════════════
function PasoFoto({ videoRef, camActiva, camError, fotoUrl, onCapturar, onRehacer, onReintentar, onBack, onNext, enviando }: {
  videoRef: React.RefObject<HTMLVideoElement>; camActiva: boolean; camError: boolean; fotoUrl: string | null;
  onCapturar: () => void; onRehacer: () => void; onReintentar: () => void;
  onBack: () => void; onNext: () => void; enviando: boolean;
}) {
  return (
    <StepCard title="Paso 10 — Fotografia de Rostro" onBack={onBack} onNext={onNext}
      nextLabel={enviando ? "Enviando..." : "Enviar Solicitud"}
      nextDisabled={enviando || !fotoUrl}>
      <p className="col-span-2 text-blue-300 text-sm">
        Tome una foto clara de su rostro mirando de frente a la camara.
        <span className="text-[#64748b]"> (La foto es opcional pero agiliza el proceso.)</span>
      </p>

      <div className="col-span-2 flex flex-col items-center gap-4">
        {!fotoUrl ? (
          camError ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-48 h-48 rounded-full border-4 border-red-500 bg-[#0a1628] flex flex-col items-center justify-center gap-2 p-4">
                <p className="text-red-400 text-sm font-bold">Sin acceso a camara</p>
                <p className="text-[#64748b] text-xs">Verifique que el navegador tiene permiso para usar la camara.</p>
              </div>
              <button onClick={onReintentar} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl text-sm font-bold">
                Reintentar camara
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-56 h-56 rounded-full overflow-hidden border-4 border-blue-500 bg-[#0a1628]">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                {!camActiva && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-blue-700 text-center">
                      <div className="w-10 h-8 border-2 border-blue-700 rounded mx-auto mb-1" />
                      <p className="text-xs">Cargando camara...</p>
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
      </div>

      {!fotoUrl && (
        <div className="col-span-2 bg-[#071630] border border-[#1d3a6e] rounded-xl px-4 py-3">
          <p className="text-blue-300 text-xs font-bold mb-1">Consejos para la foto:</p>
          <ul className="text-[#64748b] text-xs space-y-1 pl-3">
            <li>Mire directo a la camara</li>
            <li>Buena iluminacion, no contra la luz</li>
            <li>Sin gorra, sin lentes oscuros</li>
          </ul>
        </div>
      )}
    </StepCard>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PASO 11: RESUMEN / CONFIRMACIÓN
// ══════════════════════════════════════════════════════════════════════════════
function ResumenFila({ label, value }: { label: string; value: string }) {
  if (!value || value === "no" || value === "0") return null;
  return (
    <div className="flex gap-2 py-1 border-b border-[#0d1f45] last:border-0">
      <span className="text-[#64748b] text-xs w-36 shrink-0">{label}</span>
      <span className="text-white text-xs font-medium break-words flex-1">{value}</span>
    </div>
  );
}

function ResumenSeccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  const hasContent = React.Children.toArray(children).some(c => c !== null && c !== false && c !== undefined);
  if (!hasContent) return null;
  return (
    <div className="col-span-2 bg-[#060f1e] border border-[#1e3a6e] rounded-xl p-4 mb-1">
      <h3 className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-3">{titulo}</h3>
      {children}
    </div>
  );
}

function PasoResumen({ form, fotoUrl, onBack, onNext, enviando }: {
  form: FormData; fotoUrl: string | null; onBack: () => void; onNext: () => void; enviando: boolean;
}) {
  return (
    <StepCard title="Paso 11 — Revise su Solicitud" onBack={onBack} onNext={onNext}
      nextLabel={enviando ? "Enviando..." : "Confirmar y Enviar"} nextDisabled={enviando}>
      <p className="col-span-2 text-blue-300 text-sm mb-2">
        Por favor revise que toda su informacion sea correcta antes de enviar.
      </p>

      {/* Foto */}
      {fotoUrl && (
        <div className="col-span-2 flex items-center gap-4 bg-[#060f1e] border border-[#1e3a6e] rounded-xl p-4 mb-1">
          <img src={fotoUrl} alt="Foto" className="w-16 h-16 rounded-full object-cover border-2 border-blue-500" />
          <div>
            <p className="text-[#64748b] text-xs">Fotografia de rostro</p>
            <p className="text-green-400 text-xs font-semibold mt-1">✓ Capturada</p>
          </div>
        </div>
      )}

      <ResumenSeccion titulo="Datos Personales">
        <ResumenFila label="Plaza solicitada" value={form.puesto_solicitado} />
        <ResumenFila label="Nombre completo" value={form.nombre_completo} />
        <ResumenFila label="DPI" value={form.dpi} />
        <ResumenFila label="Fecha de nacimiento" value={form.fecha_nacimiento} />
        <ResumenFila label="Genero" value={form.genero} />
        <ResumenFila label="Estado civil" value={form.estado_civil} />
        <ResumenFila label="Nacionalidad" value={form.nacionalidad} />
        <ResumenFila label="Lugar de nacimiento" value={form.lugar_nacimiento} />
        <ResumenFila label="Profesion" value={form.profesion} />
        <ResumenFila label="Telefono" value={form.telefono} />
        <ResumenFila label="Telefono fijo" value={form.telefono_fijo} />
        <ResumenFila label="Correo" value={form.correo} />
        <ResumenFila label="NIT" value={form.nit} />
        <ResumenFila label="IGSS" value={form.igss} />
      </ResumenSeccion>

      <ResumenSeccion titulo="Domicilio y Banco">
        <ResumenFila label="Direccion" value={form.direccion} />
        <ResumenFila label="Municipio" value={form.municipio} />
        <ResumenFila label="Departamento" value={form.departamento} />
        <ResumenFila label="Tiempo residencia" value={form.tiempo_residencia} />
        <ResumenFila label="Tipo vivienda" value={form.tipo_vivienda} />
        <ResumenFila label="Renta mensual" value={form.renta_mensual} />
        <ResumenFila label="Banco" value={form.banco} />
        <ResumenFila label="Tipo cuenta" value={form.tipo_cuenta} />
        <ResumenFila label="Num. cuenta" value={form.num_cuenta} />
        <ResumenFila label="Licencia conducir" value={form.tiene_licencia === "si" ? `Si — ${form.tipo_licencia} (vence: ${form.vigencia_licencia})` : ""} />
      </ResumenSeccion>

      <ResumenSeccion titulo="Familia">
        <ResumenFila label="Padre" value={form.nombre_padre} />
        <ResumenFila label="Tel. padre" value={form.tel_padre} />
        <ResumenFila label="Madre" value={form.nombre_madre} />
        <ResumenFila label="Tel. madre" value={form.tel_madre} />
        <ResumenFila label="Conyuge" value={form.nombre_conyuge} />
        <ResumenFila label="Ocupacion conyuge" value={form.ocup_conyuge} />
        <ResumenFila label="Tel. conyuge" value={form.tel_conyuge} />
        <ResumenFila label="Dependientes" value={form.num_dependientes !== "0" ? form.num_dependientes : ""} />
        <ResumenFila label="Hermano 1" value={form.hermano1_nombre} />
        <ResumenFila label="Hermano 2" value={form.hermano2_nombre} />
        <ResumenFila label="Facebook" value={form.facebook} />
        <ResumenFila label="Instagram" value={form.instagram} />
      </ResumenSeccion>

      <ResumenSeccion titulo="Salud">
        <ResumenFila label="Estatura" value={form.estatura ? `${form.estatura} m` : ""} />
        <ResumenFila label="Peso" value={form.peso ? `${form.peso} kg` : ""} />
        <ResumenFila label="Enfermedad cronica" value={form.enfermedad_cronica === "si" ? `Si — ${form.enfermedad_det}` : ""} />
        <ResumenFila label="Medicamentos" value={form.medicamento === "si" ? `Si — ${form.medicamento_det}` : ""} />
        <ResumenFila label="Impedimento fisico" value={form.impedimento_fisico === "si" ? `Si — ${form.impedimento_det}` : ""} />
        <ResumenFila label="Consume alcohol" value={form.consume_alcohol === "si" ? "Si" : ""} />
        <ResumenFila label="Consume drogas" value={form.consume_drogas === "si" ? "Si" : ""} />
        <ResumenFila label="Tatuajes" value={form.tiene_tatuajes === "si" ? `Si — ${form.tatuajes_det}` : ""} />
        <ResumenFila label="Contacto emergencia" value={form.nombre_contacto_emergencia} />
        <ResumenFila label="Tel. emergencia" value={form.telefono_emergencia} />
        <ResumenFila label="Parentesco" value={form.parentesco_emergencia} />
      </ResumenSeccion>

      <ResumenSeccion titulo="Antecedentes y Finanzas">
        <ResumenFila label="Proceso judicial" value={form.proceso_judicial === "si" ? `Si — ${form.proceso_det}` : ""} />
        <ResumenFila label="Detenido antes" value={form.detenido === "si" ? `Si — ${form.detencion_det}` : ""} />
        <ResumenFila label="Tiene deudas" value={form.tiene_deudas === "si" ? `Si — ${form.estado_deuda}` : ""} />
        <ResumenFila label="Gastos mensuales" value={form.gastos_mensuales ? `Q${form.gastos_mensuales}` : ""} />
        <ResumenFila label="Prestamo" value={form.tiene_prestamo === "si" ? `Si — Q${form.monto_prestamo}` : ""} />
      </ResumenSeccion>

      <ResumenSeccion titulo="Educacion">
        <ResumenFila label="Primaria" value={form.prim_escuela ? `${form.prim_escuela} (${form.prim_lugar}) — ${form.prim_titulo}` : ""} />
        <ResumenFila label="Basicos" value={form.bas_escuela ? `${form.bas_escuela} (${form.bas_lugar}) — ${form.bas_titulo}` : ""} />
        <ResumenFila label="Diversificado" value={form.div_escuela ? `${form.div_escuela} (${form.div_lugar}) — ${form.div_titulo}` : ""} />
        <ResumenFila label="Universidad" value={form.uni_escuela ? `${form.uni_escuela} (${form.uni_lugar}) — ${form.uni_titulo}` : ""} />
      </ResumenSeccion>

      <ResumenSeccion titulo="Experiencia Laboral">
        <ResumenFila label="Empresa 1" value={form.emp1_nombre ? `${form.emp1_nombre} — ${form.emp1_puesto} (${form.emp1_inicio} a ${form.emp1_fin})` : ""} />
        <ResumenFila label="Empresa 2" value={form.emp2_nombre ? `${form.emp2_nombre} — ${form.emp2_puesto} (${form.emp2_inicio} a ${form.emp2_fin})` : ""} />
        <ResumenFila label="Empresa 3" value={form.emp3_nombre ? `${form.emp3_nombre} — ${form.emp3_puesto} (${form.emp3_inicio} a ${form.emp3_fin})` : ""} />
      </ResumenSeccion>

      <ResumenSeccion titulo="Seguridad y Habilidades">
        <ResumenFila label="Exp. seguridad" value={form.experiencia_seguridad === "si" ? `Si — ${form.anios_experiencia} anos` : ""} />
        <ResumenFila label="Empresa anterior" value={form.empresa_anterior} />
        <ResumenFila label="Tipos de seguridad" value={form.tipos_seguridad} />
        <ResumenFila label="Servicio militar" value={form.servicio_militar === "si" ? `Si — ${form.rango_militar}, ${form.unidad_militar}` : ""} />
        <ResumenFila label="Fue policia" value={form.fue_policia === "si" ? `Si — ${form.motivo_baja_policial}` : ""} />
        <ResumenFila label="Habilidades" value={form.habilidades} />
        <ResumenFila label="Disponible rotativo" value={form.disp_rotativo === "si" ? "Si" : ""} />
        <ResumenFila label="Disponible nocturno" value={form.disp_nocturno === "si" ? "Si" : ""} />
        <ResumenFila label="Disponible fines semana" value={form.disp_fds === "si" ? "Si" : ""} />
        <ResumenFila label="Tiene vehiculo" value={form.tiene_vehiculo === "si" ? "Si" : ""} />
        <ResumenFila label="Licencia armas" value={form.licencia_armas === "si" ? "Si" : ""} />
        <ResumenFila label="Pretension salarial" value={form.pretension_salarial ? `Q${form.pretension_salarial}` : ""} />
        <ResumenFila label="Familiar en empresa" value={form.familiar_en_empresa === "si" ? `Si — ${form.nombre_familiar_empresa}` : ""} />
      </ResumenSeccion>

      <ResumenSeccion titulo="Referencias Personales">
        <ResumenFila label="Referencia 1" value={form.ref1_nombre ? `${form.ref1_nombre} — ${form.ref1_ocupacion} — ${form.ref1_tel}` : ""} />
        <ResumenFila label="Referencia 2" value={form.ref2_nombre ? `${form.ref2_nombre} — ${form.ref2_ocupacion} — ${form.ref2_tel}` : ""} />
        <ResumenFila label="Referencia 3" value={form.ref3_nombre ? `${form.ref3_nombre} — ${form.ref3_ocupacion} — ${form.ref3_tel}` : ""} />
      </ResumenSeccion>
    </StepCard>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PASO 12: EXITO
// ══════════════════════════════════════════════════════════════════════════════
function PantallaExito({ solicitudId, telefono, onReiniciar }: {
  solicitudId: number | null; telefono: string; onReiniciar: () => void;
}) {
  return (
    <div className="bg-[#0d2147] rounded-2xl p-10 w-full max-w-md text-center shadow-2xl border border-[#1e3a6e]">
      <div className="w-20 h-20 rounded-full bg-[#052e16] border-4 border-green-500 mx-auto mb-6 flex items-center justify-center" style={{ boxShadow: "0 0 30px rgba(34,197,94,0.3)" }}>
        <span className="text-green-400 text-4xl font-black">✓</span>
      </div>
      <h2 className="text-white text-3xl font-bold mb-3">Solicitud Enviada</h2>
      {solicitudId && (
        <p className="text-blue-300 text-sm mb-2">
          Numero de referencia: <span className="text-white font-bold">SOL-{String(solicitudId).padStart(5, "0")}</span>
        </p>
      )}
      <p className="text-blue-300 text-base mb-4">
        Su solicitud fue recibida correctamente. El equipo de Recursos Humanos se comunicara con usted si su perfil es seleccionado.
      </p>
      {telefono && (
        <div className="bg-[#060f1e] border border-[#1e3a6e] rounded-xl p-4 mb-6 text-left">
          <p className="text-[#64748b] text-xs mb-1">Le contactaremos al numero:</p>
          <p className="text-white text-lg font-bold">{telefono}</p>
        </div>
      )}
      <p className="text-[#64748b] text-sm mb-8">Muchas gracias por su interes en unirse al equipo de ISP.</p>
      <button onClick={onReiniciar}
        className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-10 py-4 text-lg w-full rounded-xl font-bold transition-all">
        Nueva Solicitud
      </button>
    </div>
  );
}
