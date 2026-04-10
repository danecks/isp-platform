import { useState } from "react";

/* ── Design tokens ──────────────────────────────────────────────── */
const BG       = "#0a1628";
const CARD     = "#0d2147";
const BORDER   = "#1e3a6e";
const BLUE     = "#2563eb";
const BL       = "#3b82f6";
const TEXT     = "#e2e8f0";
const MUTED    = "#64748b";
const IBKG     = "#060f1e";
const WARN_BG  = "#1c0a00";
const WARN_BR  = "#92400e";
const INFO_BG  = "#071630";
const INFO_BR  = "#1d3a6e";

/* ── Primitive inputs ────────────────────────────────────────────── */
function ISPInput(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...p} style={{
      background: IBKG, border: `1.5px solid ${BORDER}`, color: TEXT,
      borderRadius: 12, padding: "13px 16px", fontSize: 16, width: "100%",
      outline: "none", boxSizing: "border-box", fontFamily: "inherit",
    }} />
  );
}

function ISPSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: string[] | { v: string; l: string }[];
  placeholder?: string;
}) {
  const opts = (options as (string | { v: string; l: string })[]).map(o =>
    typeof o === "string" ? { v: o, l: o } : o
  );
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      background: IBKG, border: `1.5px solid ${BORDER}`,
      color: value ? TEXT : MUTED,
      borderRadius: 12, padding: "13px 16px", fontSize: 16, width: "100%",
      outline: "none", boxSizing: "border-box", appearance: "none", fontFamily: "inherit",
    }}>
      <option value="">{placeholder ?? "Toque para elegir ▾"}</option>
      {opts.map(o => <option key={o.v} value={o.v} style={{ color: TEXT, background: CARD }}>{o.l}</option>)}
    </select>
  );
}

function ISPTextarea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...p} style={{
      background: IBKG, border: `1.5px solid ${BORDER}`, color: TEXT,
      borderRadius: 12, padding: "13px 16px", fontSize: 16, width: "100%",
      outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "inherit",
    }} />
  );
}

/* ── Field with label + hint ─────────────────────────────────────── */
function Field({
  label, hint, required, children, wide, warning,
}: {
  label: string; hint?: string; required?: boolean;
  children: React.ReactNode; wide?: boolean; warning?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ gridColumn: wide ? "1 / -1" : undefined }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{
          color: "#93c5fd", fontSize: 13, fontWeight: 600,
          textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          {label}
          {required && <span style={{ color: "#f87171", marginLeft: 3 }}>*</span>}
        </span>
        {hint && (
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              marginLeft: "auto", background: open ? INFO_BG : "transparent",
              border: `1px solid ${open ? BL : BORDER}`, borderRadius: 20,
              color: open ? BL : MUTED, fontSize: 11, padding: "2px 10px",
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {open ? "cerrar" : "? que es esto"}
          </button>
        )}
      </div>

      {hint && open && (
        <div style={{
          background: INFO_BG, border: `1px solid ${INFO_BR}`,
          borderRadius: 10, padding: "10px 14px", marginBottom: 8,
          color: "#93c5fd", fontSize: 13, lineHeight: 1.55,
        }}>
          {hint}
        </div>
      )}

      {warning && (
        <div style={{
          background: WARN_BG, border: `1px solid ${WARN_BR}`,
          borderRadius: 10, padding: "10px 14px", marginBottom: 8,
          color: "#fbbf24", fontSize: 13, lineHeight: 1.55,
        }}>
          Aviso: {warning}
        </div>
      )}

      {children}
    </div>
  );
}

/* ── Grid wrapper ────────────────────────────────────────────────── */
function Grid({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>
      {children}
    </div>
  );
}

/* ── Big Si / No toggle ─────────────────────────────────────────── */
function SiNo({
  value, onChange, label, hint,
}: { value: string; onChange: (v: string) => void; label: string; hint?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ color: "#93c5fd", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </span>
        {hint && (
          <button onClick={() => setOpen(o => !o)} style={{
            marginLeft: "auto", background: "transparent", border: `1px solid ${BORDER}`,
            borderRadius: 20, color: MUTED, fontSize: 11, padding: "2px 10px", cursor: "pointer",
          }}>
            {open ? "cerrar" : "? que es esto"}
          </button>
        )}
      </div>
      {hint && open && (
        <div style={{ background: INFO_BG, border: `1px solid ${INFO_BR}`, borderRadius: 10, padding: "10px 14px", marginBottom: 8, color: "#93c5fd", fontSize: 13, lineHeight: 1.55 }}>
          {hint}
        </div>
      )}
      <div style={{ display: "flex", gap: 12 }}>
        {[
          { v: "si", txt: "SI" },
          { v: "no", txt: "NO" },
        ].map(o => (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            flex: 1, padding: "16px 0", borderRadius: 14, fontSize: 20, fontWeight: 800,
            border: `2.5px solid ${value === o.v ? (o.v === "si" ? "#22c55e" : "#ef4444") : BORDER}`,
            background: value === o.v ? (o.v === "si" ? "#052e16" : "#2d0a0a") : IBKG,
            color: value === o.v ? (o.v === "si" ? "#4ade80" : "#f87171") : MUTED,
            cursor: "pointer",
          }}>
            {o.txt}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Checkbox pill ───────────────────────────────────────────────── */
function Pill({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{
      padding: "11px 18px", borderRadius: 24, fontSize: 14, fontWeight: 600,
      border: `2px solid ${checked ? BL : BORDER}`,
      background: checked ? "#0f2a5e" : IBKG,
      color: checked ? TEXT : MUTED, cursor: "pointer",
    }}>
      {checked ? "✓ " : ""}{label}
    </button>
  );
}

/* ── Section title ───────────────────────────────────────────────── */
function Sec({ title }: { title: string }) {
  return (
    <div style={{
      borderBottom: `1px solid ${BORDER}`, paddingBottom: 8, marginBottom: 2,
    }}>
      <span style={{ color: "#93c5fd", fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {title}
      </span>
    </div>
  );
}

/* ── IGSS special field ──────────────────────────────────────────── */
function IgssField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [noTiene, setNoTiene] = useState(false);
  return (
    <Field
      label="Afiliacion IGSS"
      required
      hint="Es el numero que le dan en el Instituto Guatemalteco de Seguridad Social (IGSS) cuando se afilia. Lo necesita para trabajar legalmente en Guatemala. Ejemplo: 1234567890"
    >
      {noTiene ? (
        <div style={{
          background: WARN_BG, border: `2px solid ${WARN_BR}`,
          borderRadius: 12, padding: "14px 16px",
        }}>
          <p style={{ color: "#fbbf24", fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>
            Aviso: Su numero de IGSS es obligatorio para ser contratado
          </p>
          <p style={{ color: "#f59e0b", fontSize: 13, lineHeight: 1.6, margin: "0 0 12px" }}>
            Sin IGSS <strong>no puede ser contratado legalmente</strong>. Si aun no esta afiliado,
            dirigase al IGSS mas cercano lo antes posible (es gratuito y rapido).
            Puede continuar su solicitud, pero debera presentar su numero antes de iniciar labores.
          </p>
          <div style={{ background: "#0f0500", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
            <p style={{ color: "#fbbf24", fontSize: 12, fontWeight: 700, margin: "0 0 4px" }}>IGSS mas cercano:</p>
            <p style={{ color: "#f59e0b", fontSize: 12, margin: 0 }}>
              Central: 19 Av. 14-35 Zona 1, Guatemala City<br />
              Tel: 2412-1100 | Lun-Vie 7:30-15:30
            </p>
          </div>
          <button onClick={() => setNoTiene(false)} style={{
            background: "#1e3a6e", border: `1px solid ${BL}`, color: TEXT,
            borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer",
          }}>
            Ya tengo mi numero de IGSS
          </button>
        </div>
      ) : (
        <>
          <ISPInput
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Ej. 1234567890"
            maxLength={12}
          />
          <button
            onClick={() => setNoTiene(true)}
            style={{
              marginTop: 6, background: "transparent", border: "none",
              color: "#f59e0b", fontSize: 12, cursor: "pointer",
              textDecoration: "underline", padding: "2px 0",
            }}
          >
            No tengo numero de IGSS todavia
          </button>
        </>
      )}
    </Field>
  );
}

/* ── Step wrapper ────────────────────────────────────────────────── */
function StepCard({
  title, children, onBack, onNext,
  nextLabel = "Siguiente →", disableNext,
}: {
  title: string; children: React.ReactNode;
  onBack?: () => void; onNext: () => void;
  nextLabel?: string; disableNext?: boolean;
}) {
  return (
    <div style={{
      background: CARD, borderRadius: 18, border: `1px solid ${BORDER}`,
      maxWidth: 720, width: "100%", overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        background: "#091a3d", padding: "14px 20px",
        display: "flex", alignItems: "center", flexShrink: 0,
      }}>
        <span style={{ color: TEXT, fontSize: 17, fontWeight: 800 }}>{title}</span>
      </div>

      <div style={{
        padding: 20, overflowY: "auto",
        maxHeight: "calc(100vh - 220px)",
        display: "flex", flexDirection: "column", gap: 18,
      }}>
        {children}
      </div>

      <div style={{
        padding: "14px 20px", borderTop: `1px solid ${BORDER}`,
        display: "flex", justifyContent: "space-between", gap: 12, flexShrink: 0,
      }}>
        {onBack
          ? <button onClick={onBack} style={{
              padding: "13px 24px", borderRadius: 12, fontSize: 15,
              border: `1.5px solid ${BORDER}`, background: "transparent",
              color: MUTED, cursor: "pointer",
            }}>Atras</button>
          : <div />}
        <button onClick={onNext} disabled={disableNext} style={{
          padding: "13px 32px", borderRadius: 12, fontSize: 16, fontWeight: 800,
          background: disableNext ? "#0f2147" : BLUE, color: disableNext ? MUTED : "#fff",
          border: "none", cursor: disableNext ? "not-allowed" : "pointer",
          opacity: disableNext ? 0.6 : 1,
        }}>{nextLabel}</button>
      </div>
    </div>
  );
}

/* ── Progress bar ────────────────────────────────────────────────── */
const STEP_LABELS = ["PIN","Personal","Domicilio","Familia","Salud","Antecedentes","Educacion","Experiencia","Habilidades","Referencias","Foto","Listo"];

function Progress({ step }: { step: number }) {
  const total = 10;
  const pct = Math.round(((step - 1) / total) * 100);
  return (
    <div style={{ width: "100%", maxWidth: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ color: "#93c5fd", fontSize: 13, fontWeight: 600 }}>
          {STEP_LABELS[step]}
        </span>
        <span style={{ color: MUTED, fontSize: 12 }}>Paso {step} de {total}</span>
      </div>
      <div style={{ background: IBKG, borderRadius: 6, height: 8, border: `1px solid ${BORDER}` }}>
        <div style={{
          height: "100%", borderRadius: 6,
          background: `linear-gradient(90deg, ${BLUE}, ${BL})`,
          width: `${pct}%`, transition: "width 0.4s",
        }} />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════ */
export function FormCompleto() {
  const [step, setStep] = useState(0);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState(false);

  const [form, setForm] = useState({
    nombre: "", profesion: "", cui: "", fecha_nac: "", tel_movil: "", tel_fijo: "",
    correo: "", igss: "", nit: "", lugar_nac: "", nacionalidad: "Guatemalteca",
    estado_civil: "", plaza: "",
    direccion: "", municipio: "", departamento: "", tiempo_residencia: "",
    tipo_casa: "", renta_mensual: "",
    num_cuenta: "", banco: "", tipo_cuenta: "",
    tiene_licencia: "no", tipo_licencia: "", vigencia_licencia: "",
    facebook: "", instagram: "", tiktok: "", twitter: "",
    padre_nombre: "", padre_edad: "", padre_ocupacion: "", padre_tel: "",
    madre_nombre: "", madre_edad: "", madre_ocupacion: "", madre_tel: "",
    conyuge_nombre: "", conyuge_edad: "", conyuge_ocupacion: "", conyuge_tel: "",
    num_hijos: "0",
    herm1_nombre: "", herm1_tel: "",
    herm2_nombre: "", herm2_tel: "",
    estatura: "", peso: "",
    enfermedad: "no", enfermedad_det: "",
    medicamento: "no", medicamento_det: "",
    impedimento: "no", impedimento_det: "",
    alcohol: "no", drogas: "no", drogas_det: "",
    tatuajes: "no", tatuajes_det: "",
    emergencia_nombre: "", emergencia_tel: "", emergencia_parentesco: "",
    proceso_judicial: "no", proceso_det: "",
    detenido: "no", detencion_det: "",
    deudas: "no", estado_deuda: "", gastos: "",
    inversiones: "no", prestamo: "no", prestamo_monto: "",
    prim_est: "", prim_lugar: "", prim_titulo: "",
    bas_est: "", bas_lugar: "", bas_titulo: "",
    div_est: "", div_lugar: "", div_titulo: "",
    uni_est: "", uni_lugar: "", uni_titulo: "",
    emp1_nombre: "", emp1_puesto: "", emp1_salario: "", emp1_inicio: "", emp1_fin: "", emp1_motivo: "",
    emp2_nombre: "", emp2_puesto: "", emp2_salario: "", emp2_inicio: "", emp2_fin: "", emp2_motivo: "",
    emp3_nombre: "", emp3_puesto: "", emp3_salario: "", emp3_inicio: "", emp3_fin: "", emp3_motivo: "",
    exp_seg: "no", tipos_seg: [] as string[], tiempo_seg: "",
    militar: "no", rango: "", unidad: "", tiempo_mil: "",
    fue_policia: "no", motivo_baja: "",
    habilidades: [] as string[],
    disp_rotativo: "no", disp_nocturno: "no", disp_fds: "no", vehiculo: "no",
    ref1_nombre: "", ref1_ocup: "", ref1_tel: "",
    ref2_nombre: "", ref2_ocup: "", ref2_tel: "",
    ref3_nombre: "", ref3_ocup: "", ref3_tel: "",
  });

  const u  = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const ue = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const tog = (k: "habilidades" | "tipos_seg", v: string) =>
    setForm(f => ({ ...f, [k]: (f[k] as string[]).includes(v) ? (f[k] as string[]).filter(x => x !== v) : [...(f[k] as string[]), v] }));

  const next = () => { window.scrollTo(0, 0); setStep(s => s + 1); };
  const back = () => { window.scrollTo(0, 0); setStep(s => s - 1); };

  const DEPTOS = ["Guatemala","Alta Verapaz","Baja Verapaz","Chimaltenango","Chiquimula","El Progreso","Escuintla","Huehuetenango","Izabal","Jalapa","Jutiapa","Peten","Quetzaltenango","Quiche","Retalhuleu","Sacatepequez","San Marcos","Santa Rosa","Solola","Suchitepequez","Totonicapan","Zacapa"];
  const BANCOS = ["Banrural","Banco Industrial","G&T Continental","BAC Credomatic","Bantrab","Ficohsa","BAM","Vivibanco","Otro"];
  const PUESTOS = ["Guardia de Seguridad","Supervisor de Seguridad","Agente de Porteria","Escolta Ejecutivo","Motorista de Seguridad","Inspector","Otro"];

  /* ── PIN ── */
  if (step === 0) return (
    <Wrap>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{
          background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18,
          padding: 32, width: 320, textAlign: "center",
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16, background: "#0f2a5e",
            border: `2px solid ${BORDER}`, margin: "0 auto 16px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: 22, height: 28, background: "#93c5fd", borderRadius: 4, position: "relative" }}>
              <div style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", width: 6, height: 6, borderRadius: "50%", background: "#0f2a5e" }} />
            </div>
          </div>
          <p style={{ color: TEXT, fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>Bienvenido</p>
          <p style={{ color: MUTED, fontSize: 14, margin: "0 0 24px" }}>Ingrese el PIN de acceso</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 24 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ width: 20, height: 20, borderRadius: "50%", border: `2.5px solid ${i < pin.length ? BL : BORDER}`, background: i < pin.length ? BL : "transparent" }} />
            ))}
          </div>
          {pinErr && <p style={{ color: "#f87171", fontSize: 14, marginBottom: 12 }}>PIN incorrecto</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {["1","2","3","4","5","6","7","8","9"].map(d => (
              <button key={d} onClick={() => {
                if (pin.length < 4) {
                  const np = pin + d; setPin(np);
                  if (np.length === 4) { if (np === "1234") { setPinErr(false); next(); } else { setPinErr(true); setPin(""); } }
                }
              }} style={{ padding: "20px 0", borderRadius: 12, fontSize: 24, fontWeight: 800, border: `1px solid ${BORDER}`, background: "#0f2a5e", color: TEXT, cursor: "pointer" }}>
                {d}
              </button>
            ))}
            <div />
            <button onClick={() => { if (pin.length < 4) { const np = pin + "0"; setPin(np); if (np.length === 4) { if (np === "1234") { setPinErr(false); next(); } else { setPinErr(true); setPin(""); } } } }} style={{ padding: "20px 0", borderRadius: 12, fontSize: 24, fontWeight: 800, border: `1px solid ${BORDER}`, background: "#0f2a5e", color: TEXT, cursor: "pointer" }}>0</button>
            <button onClick={() => setPin(p => p.slice(0, -1))} style={{ padding: "20px 0", borderRadius: 12, fontSize: 18, border: `1px solid ${BORDER}`, background: "#1a0a0a", color: "#f87171", cursor: "pointer" }}>Borrar</button>
          </div>
        </div>
      </div>
    </Wrap>
  );

  /* ── SUCCESS ── */
  if (step === 11) return (
    <Wrap>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 40, maxWidth: 460, textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#052e16", border: "3px solid #22c55e", margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#4ade80", fontSize: 32, fontWeight: 900 }}>✓</span>
          </div>
          <p style={{ color: TEXT, fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>Solicitud enviada</p>
          <p style={{ color: MUTED, fontSize: 15, margin: "0 0 6px" }}>Fue registrada correctamente.</p>
          <p style={{ color: "#93c5fd", fontSize: 14, margin: "0 0 28px" }}>Numero de seguimiento: <strong style={{ color: TEXT }}>#2024-0041</strong></p>
          <div style={{ background: IBKG, borderRadius: 12, padding: 16, textAlign: "left", marginBottom: 28, border: `1px solid ${BORDER}` }}>
            <p style={{ color: MUTED, fontSize: 12, margin: "0 0 6px" }}>RRHH le contactara en los proximos dias al numero:</p>
            <p style={{ color: TEXT, fontSize: 16, fontWeight: 700, margin: 0 }}>{form.tel_movil || "—"}</p>
          </div>
          <button onClick={() => { setStep(0); setPin(""); }} style={{ padding: "14px 40px", borderRadius: 12, fontSize: 16, fontWeight: 800, background: BLUE, color: "#fff", border: "none", cursor: "pointer" }}>
            Nueva Solicitud
          </button>
        </div>
      </div>
    </Wrap>
  );

  /* ── Steps 1–10 ── */
  return (
    <Wrap>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 16px 0", gap: 14 }}>
        <Progress step={step} />

        {/* PASO 1: Datos personales */}
        {step === 1 && (
          <StepCard title="Sus Datos Personales" onNext={next} disableNext={!form.nombre || !form.cui || !form.tel_movil}>
            <Field label="Plaza que solicita" required hint="Seleccione el cargo al que desea aplicar en ISP. Si no esta seguro, elija el mas parecido a lo que busca.">
              <ISPSelect value={form.plaza} onChange={u("plaza")} options={PUESTOS} placeholder="A que cargo aplica? ▾" />
            </Field>

            <Field label="Nombre completo" required hint="Escriba exactamente como aparece en su DPI. Primero apellidos, luego nombres.">
              <ISPInput value={form.nombre} onChange={ue("nombre")} placeholder="Ej: PEREZ GARCIA Juan Carlos" />
            </Field>

            <Grid>
              <Field label="Profesion u oficio" hint="Cual es su titulo o que sabe hacer? Ej: Bachiller, Perito Contador, Electricista, Agricultor.">
                <ISPInput value={form.profesion} onChange={ue("profesion")} placeholder="Ej: Bachiller en CCLL" />
              </Field>

              <Field label="Fecha de nacimiento" hint="Seleccione el dia, mes y ano en que nacio.">
                <ISPInput type="date" value={form.fecha_nac} onChange={ue("fecha_nac")} />
              </Field>

              <Field label="DPI / CUI" required hint="Son los 13 numeros que aparecen en su Documento Personal de Identificacion (DPI), la tarjeta azul de la Registral.">
                <ISPInput value={form.cui} onChange={ue("cui")} placeholder="Ej: 1234 56789 0101" maxLength={15} />
              </Field>

              <Field label="NIT" hint="Numero de Identificacion Tributaria de la SAT. Si no lo tiene, puede escribir CF (Consumidor Final).">
                <ISPInput value={form.nit} onChange={ue("nit")} placeholder="Ej: 1234567-8  o  CF" />
              </Field>
            </Grid>

            <IgssField value={form.igss} onChange={u("igss")} />

            <Grid>
              <Field label="Telefono movil" required hint="Numero de celular donde podemos llamarle para avisarle sobre su solicitud.">
                <ISPInput value={form.tel_movil} onChange={ue("tel_movil")} type="tel" placeholder="Ej: 5432-1098" />
              </Field>

              <Field label="Telefono fijo" hint="Si no tiene telefono fijo en casa, puede dejarlo en blanco.">
                <ISPInput value={form.tel_fijo} onChange={ue("tel_fijo")} type="tel" placeholder="Ej: 2345-6789 (opcional)" />
              </Field>

              <Field label="Correo electronico" hint="Si tiene correo electronico (Gmail, Hotmail, etc.), escribalo aqui. Si no tiene, dejelo en blanco." wide>
                <ISPInput value={form.correo} onChange={ue("correo")} type="email" placeholder="Ej: juan.perez@gmail.com  (opcional)" />
              </Field>

              <Field label="Estado civil" hint="Seleccione su situacion actual.">
                <ISPSelect value={form.estado_civil} onChange={u("estado_civil")} options={["Soltero/a","Casado/a","Unido/a","Divorciado/a","Viudo/a"]} />
              </Field>

              <Field label="Nacionalidad">
                <ISPSelect value={form.nacionalidad} onChange={u("nacionalidad")} options={["Guatemalteca","Hondurena","Salvadorena","Nicaraguense","Costarricense","Otra"]} />
              </Field>
            </Grid>
          </StepCard>
        )}

        {/* PASO 2: Domicilio y banco */}
        {step === 2 && (
          <StepCard title="Su Domicilio y Datos Bancarios" onBack={back} onNext={next}>
            <Sec title="Donde vive?" />
            <Field label="Lugar donde nacio" hint="El municipio y departamento donde nacio. Ej: Chiquimula, Chiquimula.">
              <ISPInput value={form.lugar_nac} onChange={ue("lugar_nac")} placeholder="Ej: Chiquimula, Chiquimula" />
            </Field>

            <Field label="Direccion donde vive ahora" wide hint="Escriba la direccion completa con calle, numero de casa, zona o aldea.">
              <ISPInput value={form.direccion} onChange={ue("direccion")} placeholder="Ej: 3ra Calle 5-20 Zona 3, Colonia El Esfuerzo" />
            </Field>

            <Grid>
              <Field label="Municipio">
                <ISPInput value={form.municipio} onChange={ue("municipio")} placeholder="Ej: Mixco" />
              </Field>
              <Field label="Departamento">
                <ISPSelect value={form.departamento} onChange={u("departamento")} options={DEPTOS} />
              </Field>
              <Field label="Cuanto tiempo lleva viviendo ahi?" hint="Seleccione aproximadamente cuanto tiempo lleva en esa direccion.">
                <ISPSelect value={form.tiempo_residencia} onChange={u("tiempo_residencia")} options={["Menos de 1 ano","1 a 3 anos","3 a 5 anos","Mas de 5 anos"]} />
              </Field>
              <Field label="Su casa es...">
                <ISPSelect value={form.tipo_casa} onChange={u("tipo_casa")} options={["Propia","Alquilada","Familiar / prestada"]} />
              </Field>
              {form.tipo_casa === "Alquilada" && (
                <Field label="Cuanto paga de alquiler al mes? (Q)">
                  <ISPInput value={form.renta_mensual} onChange={ue("renta_mensual")} type="number" placeholder="Ej: 800" />
                </Field>
              )}
            </Grid>

            <Sec title="Cuenta bancaria (para recibir su sueldo)" />
            <p style={{ color: MUTED, fontSize: 13, margin: "-8px 0 4px" }}>
              Si aun no tiene cuenta bancaria, dejelo en blanco por ahora.
            </p>
            <Grid>
              <Field label="Banco" hint="Seleccione el banco donde tiene su cuenta de ahorros o monetaria.">
                <ISPSelect value={form.banco} onChange={u("banco")} options={BANCOS} />
              </Field>
              <Field label="Tipo de cuenta">
                <ISPSelect value={form.tipo_cuenta} onChange={u("tipo_cuenta")} options={["Monetaria (Cheques)","Ahorro"]} />
              </Field>
              <Field label="Numero de cuenta" wide hint="Copie exactamente el numero de cuenta de su libreta o tarjeta.">
                <ISPInput value={form.num_cuenta} onChange={ue("num_cuenta")} placeholder="Ej: 3-000-12345-6" />
              </Field>
            </Grid>

            <Sec title="Licencia de conducir" />
            <SiNo value={form.tiene_licencia} onChange={u("tiene_licencia")} label="Tiene licencia de conducir?" />
            {form.tiene_licencia === "si" && (
              <Grid>
                <Field label="Tipo / Categoria" hint="A=motocicleta, B=automovil, C=camion, M=maquinaria, E=vehiculo de emergencia.">
                  <ISPSelect value={form.tipo_licencia} onChange={u("tipo_licencia")} options={["A — Motocicleta","B — Automovil","C — Camion / Bus","M — Maquinaria","E — Emergencia"]} />
                </Field>
                <Field label="Valida hasta (vencimiento)">
                  <ISPInput type="date" value={form.vigencia_licencia} onChange={ue("vigencia_licencia")} />
                </Field>
              </Grid>
            )}
          </StepCard>
        )}

        {/* PASO 3: Familia */}
        {step === 3 && (
          <StepCard title="Su Familia" onBack={back} onNext={next}>
            <div style={{ background: INFO_BG, border: `1px solid ${INFO_BR}`, borderRadius: 12, padding: "12px 16px" }}>
              <p style={{ color: "#93c5fd", fontSize: 13, margin: 0 }}>
                Esta informacion es <strong>confidencial</strong> y solo se usa para el expediente interno de ISP. Los campos con "si aplica" puede dejarlos en blanco.
              </p>
            </div>

            <Sec title="Sus papas" />
            <Grid>
              <Field label="Nombre de su papa">
                <ISPInput value={form.padre_nombre} onChange={ue("padre_nombre")} placeholder="Nombre completo" />
              </Field>
              <Field label="Telefono de su papa">
                <ISPInput value={form.padre_tel} onChange={ue("padre_tel")} type="tel" placeholder="5432-1098" />
              </Field>
              <Field label="Nombre de su mama">
                <ISPInput value={form.madre_nombre} onChange={ue("madre_nombre")} placeholder="Nombre completo" />
              </Field>
              <Field label="Telefono de su mama">
                <ISPInput value={form.madre_tel} onChange={ue("madre_tel")} type="tel" placeholder="5432-1098" />
              </Field>
            </Grid>

            <Sec title="Esposo/a o pareja (si aplica)" />
            <Grid>
              <Field label="Nombre de su pareja" wide>
                <ISPInput value={form.conyuge_nombre} onChange={ue("conyuge_nombre")} placeholder="Nombre completo (si aplica)" />
              </Field>
              <Field label="Donde trabaja?">
                <ISPInput value={form.conyuge_ocupacion} onChange={ue("conyuge_ocupacion")} placeholder="Empresa u ocupacion" />
              </Field>
              <Field label="Telefono">
                <ISPInput value={form.conyuge_tel} onChange={ue("conyuge_tel")} type="tel" placeholder="5432-1098" />
              </Field>
            </Grid>

            <Sec title="Hijos y hermanos" />
            <Grid>
              <Field label="Cuantos hijos tiene?">
                <ISPSelect value={form.num_hijos} onChange={u("num_hijos")} options={["0","1","2","3","4","5","6 o mas"]} />
              </Field>
            </Grid>

            <Field label="Hermano 1 (si aplica)">
              <Grid>
                <ISPInput value={form.herm1_nombre} onChange={ue("herm1_nombre")} placeholder="Nombre completo" />
                <ISPInput value={form.herm1_tel} onChange={ue("herm1_tel")} type="tel" placeholder="Telefono" />
              </Grid>
            </Field>
            <Field label="Hermano 2 (si aplica)">
              <Grid>
                <ISPInput value={form.herm2_nombre} onChange={ue("herm2_nombre")} placeholder="Nombre completo" />
                <ISPInput value={form.herm2_tel} onChange={ue("herm2_tel")} type="tel" placeholder="Telefono" />
              </Grid>
            </Field>

            <Sec title="Redes sociales (opcional)" />
            <p style={{ color: MUTED, fontSize: 13, margin: "-8px 0 4px" }}>Si no usa redes sociales, deje estos campos en blanco.</p>
            <Grid>
              <Field label="Facebook"><ISPInput value={form.facebook} onChange={ue("facebook")} placeholder="facebook.com/usuario" /></Field>
              <Field label="Instagram"><ISPInput value={form.instagram} onChange={ue("instagram")} placeholder="@usuario" /></Field>
            </Grid>
          </StepCard>
        )}

        {/* PASO 4: Salud */}
        {step === 4 && (
          <StepCard title="Su Salud" onBack={back} onNext={next}>
            <div style={{ background: INFO_BG, border: `1px solid ${INFO_BR}`, borderRadius: 12, padding: "12px 16px" }}>
              <p style={{ color: "#93c5fd", fontSize: 13, margin: 0 }}>
                Responda con honestidad. Esta informacion es confidencial y ayuda a asignarle el puesto mas adecuado para usted.
              </p>
            </div>

            <Grid>
              <Field label="Su estatura" hint="Midase sin zapatos y escriba en metros. Ejemplo: si mide 1 metro con 75 centimetros, escriba 1.75">
                <ISPInput value={form.estatura} onChange={ue("estatura")} placeholder="Ej: 1.75 (en metros)" />
              </Field>
              <Field label="Su peso" hint="Peso en kilogramos. Ejemplo: si pesa 80 kg, escriba 80.">
                <ISPInput value={form.peso} onChange={ue("peso")} type="number" placeholder="Ej: 80 (en kg)" />
              </Field>
            </Grid>

            <SiNo value={form.enfermedad} onChange={u("enfermedad")} label="Tiene alguna enfermedad cronica?" hint="Ejemplo: diabetes, hipertension, epilepsia, asma u otras enfermedades que requieren control medico regular." />
            {form.enfermedad === "si" && <Field label="Cual enfermedad?"><ISPTextarea value={form.enfermedad_det} onChange={ue("enfermedad_det")} rows={2} placeholder="Escriba el nombre de la enfermedad..." /></Field>}

            <SiNo value={form.medicamento} onChange={u("medicamento")} label="Toma algun medicamento actualmente?" hint="Medicamentos recetados por el medico que toma de forma regular." />
            {form.medicamento === "si" && <Field label="Cual medicamento?"><ISPInput value={form.medicamento_det} onChange={ue("medicamento_det")} placeholder="Nombre del medicamento" /></Field>}

            <SiNo value={form.impedimento} onChange={u("impedimento")} label="Tiene algun impedimento fisico?" hint="Ejemplo: problemas en manos, pies, espalda, vista, audicion que le dificulten algunas actividades." />
            {form.impedimento === "si" && <Field label="Cual impedimento?"><ISPInput value={form.impedimento_det} onChange={ue("impedimento_det")} placeholder="Describalo brevemente..." /></Field>}

            <Grid>
              <SiNo value={form.alcohol} onChange={u("alcohol")} label="Consume bebidas alcoholicas?" />
              <SiNo value={form.drogas} onChange={u("drogas")} label="Ha consumido drogas alguna vez?" />
            </Grid>

            <SiNo value={form.tatuajes} onChange={u("tatuajes")} label="Tiene tatuajes?" hint="Si tiene tatuajes, debera indicar que significan. Los tatuajes no son impedimento para trabajar, pero ISP necesita saberlo." />
            {form.tatuajes === "si" && (
              <Field label="Que significado tienen sus tatuajes?">
                <ISPTextarea value={form.tatuajes_det} onChange={ue("tatuajes_det")} rows={2} placeholder="Explique brevemente que representan..." />
              </Field>
            )}

            <Sec title="Contacto de emergencia" />
            <p style={{ color: MUTED, fontSize: 13, margin: "-8px 0 4px" }}>
              A quien debemos llamar si le pasa algo en el trabajo?
            </p>
            <Grid>
              <Field label="Nombre de la persona" wide>
                <ISPInput value={form.emergencia_nombre} onChange={ue("emergencia_nombre")} placeholder="Nombre completo de la persona" />
              </Field>
              <Field label="Telefono de esa persona">
                <ISPInput value={form.emergencia_tel} onChange={ue("emergencia_tel")} type="tel" placeholder="5432-1098" />
              </Field>
              <Field label="Que parentesco tiene con usted?">
                <ISPSelect value={form.emergencia_parentesco} onChange={u("emergencia_parentesco")} options={["Es mi mama","Es mi papa","Es mi esposo/a o pareja","Es mi hermano/a","Es mi hijo/a","Es otro familiar","Es un amigo/a"]} />
              </Field>
            </Grid>
          </StepCard>
        )}

        {/* PASO 5: Antecedentes */}
        {step === 5 && (
          <StepCard title="Antecedentes y Situacion Financiera" onBack={back} onNext={next}>
            <div style={{ background: INFO_BG, border: `1px solid ${INFO_BR}`, borderRadius: 12, padding: "12px 16px" }}>
              <p style={{ color: "#93c5fd", fontSize: 13, margin: 0 }}>
                Responda con honestidad. ISP realiza verificaciones de antecedentes. Ocultar informacion puede resultar en descalificacion inmediata.
              </p>
            </div>

            <Sec title="Antecedentes legales" />
            <SiNo value={form.proceso_judicial} onChange={u("proceso_judicial")} label="Tiene algun proceso judicial en curso?" hint="Esta siendo investigado o tiene un juicio pendiente en los tribunales?" />
            {form.proceso_judicial === "si" && <Field label="Por que motivo?"><ISPTextarea value={form.proceso_det} onChange={ue("proceso_det")} rows={2} placeholder="Explique brevemente..." /></Field>}

            <SiNo value={form.detenido} onChange={u("detenido")} label="Ha sido detenido alguna vez?" hint="La policia o autoridades lo han detenido o arrestado anteriormente?" />
            {form.detenido === "si" && <Field label="Por que motivo?"><ISPTextarea value={form.detencion_det} onChange={ue("detencion_det")} rows={2} placeholder="Explique brevemente..." /></Field>}

            <Sec title="Su situacion economica" />
            <p style={{ color: MUTED, fontSize: 13, margin: "-8px 0 4px" }}>Esta informacion es privada y solo ayuda a entender su situacion.</p>

            <SiNo value={form.deudas} onChange={u("deudas")} label="Tiene deudas pendientes?" />
            {form.deudas === "si" && (
              <Field label="Como esta su deuda?">
                <ISPSelect value={form.estado_deuda} onChange={u("estado_deuda")} options={["Al dia (pagando puntual)","Con atraso (me he atrasado en pagos)"]} />
              </Field>
            )}

            <Field label="Cuanto gasta al mes aproximadamente? (Q)" hint="Sume sus gastos de alimentacion, renta, transporte y otros. Es un estimado.">
              <ISPInput value={form.gastos} onChange={ue("gastos")} type="number" placeholder="Ej: 2500" />
            </Field>

            <SiNo value={form.prestamo} onChange={u("prestamo")} label="Tiene algun prestamo bancario o personal?" />
            {form.prestamo === "si" && (
              <Field label="De cuanto es el prestamo? (Q)">
                <ISPInput value={form.prestamo_monto} onChange={ue("prestamo_monto")} type="number" placeholder="Ej: 15000" />
              </Field>
            )}
          </StepCard>
        )}

        {/* PASO 6: Educacion */}
        {step === 6 && (
          <StepCard title="Su Formacion Academica" onBack={back} onNext={next}>
            <div style={{ background: INFO_BG, border: `1px solid ${INFO_BR}`, borderRadius: 12, padding: "12px 16px" }}>
              <p style={{ color: "#93c5fd", fontSize: 13, margin: 0 }}>
                Llene solo los niveles que completo. Si no termino un nivel, puede dejarlo en blanco o escribir "incompleto" en el titulo.
              </p>
            </div>
            {([
              { nivel: "Primaria (1ro a 6to grado)", k: "prim" },
              { nivel: "Basico (1ro a 3ro basico)", k: "bas" },
              { nivel: "Diversificado (bachillerato / carrera)", k: "div" },
              { nivel: "Universidad (si aplica)", k: "uni" },
            ] as { nivel: string; k: string }[]).map(({ nivel, k }) => (
              <div key={k}>
                <Sec title={nivel} />
                <Grid>
                  <Field label="Nombre del establecimiento">
                    <ISPInput value={(form as Record<string, string>)[`${k}_est`]} onChange={ue(`${k}_est` as keyof typeof form)} placeholder="Ej: Escuela Nacional Mixta..." />
                  </Field>
                  <Field label="Ciudad o municipio">
                    <ISPInput value={(form as Record<string, string>)[`${k}_lugar`]} onChange={ue(`${k}_lugar` as keyof typeof form)} placeholder="Ej: Guatemala, Guatemala" />
                  </Field>
                  <Field label="Titulo obtenido" wide>
                    <ISPInput value={(form as Record<string, string>)[`${k}_titulo`]} onChange={ue(`${k}_titulo` as keyof typeof form)} placeholder='Ej: Bachiller en CCLL — o — "Incompleto"' />
                  </Field>
                </Grid>
              </div>
            ))}
          </StepCard>
        )}

        {/* PASO 7: Experiencia laboral */}
        {step === 7 && (
          <StepCard title="Su Experiencia de Trabajo" onBack={back} onNext={next}>
            <div style={{ background: INFO_BG, border: `1px solid ${INFO_BR}`, borderRadius: 12, padding: "12px 16px" }}>
              <p style={{ color: "#93c5fd", fontSize: 13, margin: 0 }}>
                Empiece por el trabajo mas reciente. Si solo ha tenido 1 trabajo, llene solo la primera empresa.
              </p>
            </div>
            {([1, 2, 3] as (1 | 2 | 3)[]).map(n => (
              <div key={n}>
                <Sec title={`${n === 1 ? "Trabajo mas reciente *" : `Trabajo anterior ${n - 1} (si aplica)`}`} />
                <Grid>
                  <Field label="Nombre de la empresa" wide>
                    <ISPInput value={(form as Record<string, string>)[`emp${n}_nombre`]} onChange={ue(`emp${n}_nombre` as keyof typeof form)} placeholder={n === 1 ? "Empresa donde trabajo mas recientemente" : "Dejelo en blanco si no aplica"} />
                  </Field>
                  <Field label="Que cargo tenia?">
                    <ISPInput value={(form as Record<string, string>)[`emp${n}_puesto`]} onChange={ue(`emp${n}_puesto` as keyof typeof form)} placeholder="Ej: Guardia de Seguridad" />
                  </Field>
                  <Field label="Sueldo que ganaba (Q)">
                    <ISPInput value={(form as Record<string, string>)[`emp${n}_salario`]} onChange={ue(`emp${n}_salario` as keyof typeof form)} type="number" placeholder="Ej: 3200" />
                  </Field>
                  <Field label="Mes/ano que entro">
                    <ISPInput type="month" value={(form as Record<string, string>)[`emp${n}_inicio`]} onChange={ue(`emp${n}_inicio` as keyof typeof form)} />
                  </Field>
                  <Field label="Mes/ano que salio">
                    <ISPInput type="month" value={(form as Record<string, string>)[`emp${n}_fin`]} onChange={ue(`emp${n}_fin` as keyof typeof form)} />
                  </Field>
                  <Field label="Por que salio?" wide>
                    <ISPSelect value={(form as Record<string, string>)[`emp${n}_motivo`]} onChange={u(`emp${n}_motivo` as keyof typeof form)}
                      options={["Termino el contrato","Renuncie voluntariamente","Mejor oferta de trabajo","La empresa cerro","Motivos personales o familiares","Otro motivo"]} />
                  </Field>
                </Grid>
              </div>
            ))}
          </StepCard>
        )}

        {/* PASO 8: Seguridad + habilidades */}
        {step === 8 && (
          <StepCard title="Experiencia en Seguridad y Habilidades" onBack={back} onNext={next}>
            <Sec title="Experiencia en seguridad" />
            <SiNo value={form.exp_seg} onChange={u("exp_seg")} label="Ha trabajado como agente de seguridad antes?" />
            {form.exp_seg === "si" && (
              <>
                <Field label="En que tipo de seguridad ha trabajado?" hint="Puede seleccionar mas de una opcion.">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
                    {["Seguridad privada","Seguridad bancaria","Custodia armada","Transporte de valores"].map(t => (
                      <Pill key={t} label={t} checked={form.tipos_seg.includes(t)} onChange={() => tog("tipos_seg", t)} />
                    ))}
                  </div>
                </Field>
                <Field label="Cuanto tiempo en total ha trabajado en seguridad?">
                  <ISPSelect value={form.tiempo_seg} onChange={u("tiempo_seg")} options={["Menos de 1 ano","1 a 2 anos","2 a 5 anos","5 a 10 anos","Mas de 10 anos"]} />
                </Field>
              </>
            )}

            <Sec title="Servicio militar o policial" />
            <SiNo value={form.militar} onChange={u("militar")} label="Presto servicio militar?" />
            {form.militar === "si" && (
              <Grid>
                <Field label="Rango que alcanzo"><ISPInput value={form.rango} onChange={ue("rango")} placeholder="Ej: Cabo, Sargento..." /></Field>
                <Field label="Unidad donde sirvio"><ISPInput value={form.unidad} onChange={ue("unidad")} placeholder="Nombre de la unidad" /></Field>
              </Grid>
            )}
            <SiNo value={form.fue_policia} onChange={u("fue_policia")} label="Pertenecio a la Policia Nacional Civil u otra fuerza?" />
            {form.fue_policia === "si" && <Field label="Por que se retiro?"><ISPInput value={form.motivo_baja} onChange={ue("motivo_baja")} placeholder="Motivo de retiro..." /></Field>}

            <Sec title="Sus habilidades (marque las que tiene)" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {["Manejo de armas","Defensa personal","Control de accesos","Radio comunicacion","Trabajo bajo presion","Resolucion de conflictos"].map(h => (
                <Pill key={h} label={h} checked={form.habilidades.includes(h)} onChange={() => tog("habilidades", h)} />
              ))}
            </div>

            <Sec title="Cuando puede trabajar?" />
            <Grid>
              <SiNo value={form.disp_rotativo} onChange={u("disp_rotativo")} label="Puede trabajar en turnos rotativos?" hint="Turnos rotativos significa que un dia puede ser de dia y otro de noche, dependiendo del puesto." />
              <SiNo value={form.disp_nocturno} onChange={u("disp_nocturno")} label="Puede trabajar de noche?" />
              <SiNo value={form.disp_fds} onChange={u("disp_fds")} label="Puede trabajar sabados y domingos?" />
              <SiNo value={form.vehiculo} onChange={u("vehiculo")} label="Tiene vehiculo propio?" />
            </Grid>
          </StepCard>
        )}

        {/* PASO 9: Referencias */}
        {step === 9 && (
          <StepCard title="Referencias Personales" onBack={back} onNext={next}>
            <div style={{ background: INFO_BG, border: `1px solid ${INFO_BR}`, borderRadius: 12, padding: "12px 16px" }}>
              <p style={{ color: "#93c5fd", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                <strong>Que es una referencia?</strong> Son personas que nos pueden decir como es usted. <strong>No pueden ser familiares</strong> (papa, mama, hermanos, etc.). Pueden ser vecinos, amigos de confianza, ex companeros de trabajo, etc.
              </p>
            </div>
            {([1, 2, 3] as (1 | 2 | 3)[]).map(n => (
              <div key={n}>
                <Sec title={`Referencia ${n}${n > 1 ? " (si aplica)" : " *"}`} />
                <Grid>
                  <Field label="Nombre completo" wide>
                    <ISPInput value={(form as Record<string, string>)[`ref${n}_nombre`]} onChange={ue(`ref${n}_nombre` as keyof typeof form)} placeholder="Nombre de la persona que le conoce" />
                  </Field>
                  <Field label="A que se dedica esa persona?">
                    <ISPInput value={(form as Record<string, string>)[`ref${n}_ocup`]} onChange={ue(`ref${n}_ocup` as keyof typeof form)} placeholder="Ej: Comerciante, Docente, Mecanico..." />
                  </Field>
                  <Field label="Telefono de esa persona">
                    <ISPInput value={(form as Record<string, string>)[`ref${n}_tel`]} onChange={ue(`ref${n}_tel` as keyof typeof form)} type="tel" placeholder="5432-1098" />
                  </Field>
                </Grid>
              </div>
            ))}

            <div style={{ background: "#071020", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "14px 16px" }}>
              <p style={{ color: MUTED, fontSize: 12, lineHeight: 1.7, margin: 0 }}>
                <span style={{ color: "#93c5fd", fontWeight: 700 }}>Declaracion: </span>
                Declaro que toda la informacion que proporcione es verdadera. Autorizo a ISP, S.A. a verificar mis datos. Me comprometo a seguir el reglamento interno de trabajo y las condiciones estipuladas en el Codigo de Trabajo (Decreto No. 1441).
              </p>
            </div>
          </StepCard>
        )}

        {/* PASO 10: Foto */}
        {step === 10 && (
          <StepCard title="Su Fotografia" onBack={back} onNext={next} nextLabel="Enviar Solicitud">
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{
                width: 200, height: 200, borderRadius: "50%",
                background: IBKG, border: `3px dashed ${BORDER}`,
                margin: "0 auto 24px", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10,
              }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#1e3a6e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 20, height: 16, border: `2px solid #93c5fd`, borderRadius: 4, position: "relative" }}>
                    <div style={{ position: "absolute", top: -5, left: "50%", transform: "translateX(-50%)", width: 8, height: 5, background: "#93c5fd", borderRadius: "2px 2px 0 0" }} />
                  </div>
                </div>
                <span style={{ color: MUTED, fontSize: 13 }}>Sin foto aun</span>
              </div>
              <button style={{
                padding: "16px 36px", borderRadius: 12, fontSize: 16, fontWeight: 800,
                background: BLUE, color: "#fff", border: "none", cursor: "pointer",
                display: "block", margin: "0 auto 12px",
              }}>
                Tomar Fotografia
              </button>
              <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6 }}>
                Toque el boton de arriba para encender la camara y tomar su foto.<br />
                <span style={{ color: "#93c5fd" }}>La foto es opcional</span> pero ayuda a agilizar su proceso.
              </p>
              <div style={{ background: INFO_BG, border: `1px solid ${INFO_BR}`, borderRadius: 12, padding: "12px 16px", marginTop: 20, textAlign: "left" }}>
                <p style={{ color: "#93c5fd", fontSize: 13, margin: "0 0 6px", fontWeight: 700 }}>Consejos para la foto:</p>
                <ul style={{ color: MUTED, fontSize: 13, margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                  <li>Mire directo a la camara</li>
                  <li>Buena iluminacion, no contra la luz</li>
                  <li>Sin gorra, sin lentes oscuros</li>
                  <li>Fondo blanco o de color liso si es posible</li>
                </ul>
              </div>
            </div>
          </StepCard>
        )}
      </div>
      <div style={{ height: 20 }} />
    </Wrap>
  );
}

/* ── App shell ───────────────────────────────────────────────────── */
function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{
        background: "#091a3d", borderBottom: `1px solid ${BORDER}`,
        padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, background: "#1e3a6e",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 2,
        }}>
          <div style={{ width: 16, height: 2, background: "#93c5fd", borderRadius: 1 }} />
          <div style={{ width: 16, height: 2, background: "#93c5fd", borderRadius: 1 }} />
          <div style={{ width: 16, height: 2, background: "#93c5fd", borderRadius: 1 }} />
        </div>
        <div>
          <p style={{ color: TEXT, fontSize: 15, fontWeight: 800, margin: 0 }}>ISP, S.A. — Solicitud de Empleo</p>
          <p style={{ color: MUTED, fontSize: 11, margin: 0 }}>Investigaciones y Seguridad Profesional</p>
        </div>
        <div style={{ marginLeft: "auto", color: MUTED, fontSize: 11 }}>
          {new Date().toLocaleDateString("es-GT")}
        </div>
      </div>
      {children}
    </div>
  );
}
