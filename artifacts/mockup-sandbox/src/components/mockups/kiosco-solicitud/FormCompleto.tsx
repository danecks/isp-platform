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

/* ── Field with icon + label + hint ─────────────────────────────── */
function Field({
  icon, label, hint, required, children, wide, warning,
}: {
  icon: string; label: string; hint?: string; required?: boolean;
  children: React.ReactNode; wide?: boolean; warning?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ gridColumn: wide ? "1 / -1" : undefined }}>
      {/* label row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
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
              color: open ? BL : MUTED, fontSize: 11, padding: "2px 8px",
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {open ? "✕ cerrar" : "ℹ️ ¿qué es esto?"}
          </button>
        )}
      </div>

      {/* expandable hint */}
      {hint && open && (
        <div style={{
          background: INFO_BG, border: `1px solid ${INFO_BR}`,
          borderRadius: 10, padding: "10px 14px", marginBottom: 8,
          color: "#93c5fd", fontSize: 13, lineHeight: 1.55,
        }}>
          {hint}
        </div>
      )}

      {/* warning banner */}
      {warning && (
        <div style={{
          background: WARN_BG, border: `1px solid ${WARN_BR}`,
          borderRadius: 10, padding: "10px 14px", marginBottom: 8,
          color: "#fbbf24", fontSize: 13, lineHeight: 1.55,
        }}>
          ⚠️ {warning}
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

/* ── Big Sí / No toggle ─────────────────────────────────────────── */
function SiNo({
  value, onChange, label, icon, hint,
}: { value: string; onChange: (v: string) => void; label: string; icon?: string; hint?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
        <span style={{ color: "#93c5fd", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </span>
        {hint && (
          <button onClick={() => setOpen(o => !o)} style={{
            marginLeft: "auto", background: "transparent", border: `1px solid ${BORDER}`,
            borderRadius: 20, color: MUTED, fontSize: 11, padding: "2px 8px", cursor: "pointer",
          }}>
            {open ? "✕" : "ℹ️"}
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
          { v: "si", emoji: "✅", txt: "SÍ" },
          { v: "no", emoji: "❌", txt: "NO" },
        ].map(o => (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            flex: 1, padding: "16px 0", borderRadius: 14, fontSize: 18, fontWeight: 800,
            border: `2.5px solid ${value === o.v ? (o.v === "si" ? "#22c55e" : "#ef4444") : BORDER}`,
            background: value === o.v ? (o.v === "si" ? "#052e16" : "#2d0a0a") : IBKG,
            color: value === o.v ? (o.v === "si" ? "#4ade80" : "#f87171") : MUTED,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {o.emoji} {o.txt}
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
function Sec({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      borderBottom: `1px solid ${BORDER}`, paddingBottom: 8, marginBottom: 2,
    }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
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
      icon="🏥"
      label="Afiliación IGSS"
      required
      hint="Es el número que le dan en el Instituto Guatemalteco de Seguridad Social (IGSS) cuando se afilia. Lo necesita para trabajar legalmente en Guatemala. Ejemplo: 1234567890"
    >
      {noTiene ? (
        <div style={{
          background: WARN_BG, border: `2px solid ${WARN_BR}`,
          borderRadius: 12, padding: "14px 16px",
        }}>
          <p style={{ color: "#fbbf24", fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>
            ⚠️ Su número de IGSS es obligatorio para ser contratado
          </p>
          <p style={{ color: "#f59e0b", fontSize: 13, lineHeight: 1.6, margin: "0 0 12px" }}>
            Sin IGSS <strong>no puede ser contratado legalmente</strong>. Si aún no está afiliado, 
            diríjase al IGSS más cercano lo antes posible (es gratuito y rápido). 
            Puede continuar su solicitud, pero deberá presentar su número antes de iniciar labores.
          </p>
          <div style={{ background: "#0f0500", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
            <p style={{ color: "#fbbf24", fontSize: 12, fontWeight: 700, margin: "0 0 4px" }}>📍 IGSS más cercano:</p>
            <p style={{ color: "#f59e0b", fontSize: 12, margin: 0 }}>
              Central: 19 Av. 14-35 Zona 1, Guatemala City<br />
              Tel: 2412-1100 | Lun–Vie 7:30–15:30
            </p>
          </div>
          <button onClick={() => setNoTiene(false)} style={{
            background: "#1e3a6e", border: `1px solid ${BL}`, color: TEXT,
            borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer",
          }}>
            ← Ya tengo mi número de IGSS
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
            No tengo número de IGSS todavía
          </button>
        </>
      )}
    </Field>
  );
}

/* ── Step wrapper ────────────────────────────────────────────────── */
function StepCard({
  title, icon, children, onBack, onNext,
  nextLabel = "Siguiente →", disableNext,
}: {
  title: string; icon: string; children: React.ReactNode;
  onBack?: () => void; onNext: () => void;
  nextLabel?: string; disableNext?: boolean;
}) {
  return (
    <div style={{
      background: CARD, borderRadius: 18, border: `1px solid ${BORDER}`,
      maxWidth: 720, width: "100%", overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      {/* step header */}
      <div style={{
        background: "#091a3d", padding: "14px 20px",
        display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
      }}>
        <span style={{ fontSize: 26 }}>{icon}</span>
        <span style={{ color: TEXT, fontSize: 17, fontWeight: 800 }}>{title}</span>
      </div>

      {/* scrollable body */}
      <div style={{
        padding: 20, overflowY: "auto",
        maxHeight: "calc(100vh - 220px)",
        display: "flex", flexDirection: "column", gap: 18,
      }}>
        {children}
      </div>

      {/* nav */}
      <div style={{
        padding: "14px 20px", borderTop: `1px solid ${BORDER}`,
        display: "flex", justifyContent: "space-between", gap: 12, flexShrink: 0,
      }}>
        {onBack
          ? <button onClick={onBack} style={{
              padding: "13px 24px", borderRadius: 12, fontSize: 15,
              border: `1.5px solid ${BORDER}`, background: "transparent",
              color: MUTED, cursor: "pointer",
            }}>← Atrás</button>
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
const STEP_LABELS = ["🔒 PIN","👤 Personal","🏠 Domicilio","👨‍👩‍👧 Familia","🩺 Salud","⚖️ Antecedentes","🎓 Educación","💼 Experiencia","🛡️ Habilidades","📋 Referencias","📷 Foto","✅ Listo"];

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
/*  MAIN COMPONENT                                                     */
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

  const u  = (k: keyof typeof form) => (v: string)  => setForm(f => ({ ...f, [k]: v }));
  const ue = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const tog = (k: "habilidades" | "tipos_seg", v: string) =>
    setForm(f => ({ ...f, [k]: (f[k] as string[]).includes(v) ? (f[k] as string[]).filter(x => x !== v) : [...(f[k] as string[]), v] }));

  const next = () => { window.scrollTo(0,0); setStep(s=>s+1); };
  const back = () => { window.scrollTo(0,0); setStep(s=>s-1); };

  const DEPTOS = ["Guatemala","Alta Verapaz","Baja Verapaz","Chimaltenango","Chiquimula","El Progreso","Escuintla","Huehuetenango","Izabal","Jalapa","Jutiapa","Petén","Quetzaltenango","Quiché","Retalhuleu","Sacatepéquez","San Marcos","Santa Rosa","Sololá","Suchitepéquez","Totonicapán","Zacapa"];
  const BANCOS = ["Banrural","Banco Industrial","G&T Continental","BAC Credomatic","Bantrab","Ficohsa","BAM","Vivibanco","Otro"];
  const PUESTOS = ["Guardia de Seguridad","Supervisor de Seguridad","Agente de Portería","Escolta Ejecutivo","Motorista de Seguridad","Inspector","Otro"];

  /* ── PIN ─────────────────────────────────────────────────────────── */
  if (step === 0) return (
    <Wrap>
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
        <div style={{
          background: CARD, border:`1px solid ${BORDER}`, borderRadius:18,
          padding:32, width:320, textAlign:"center",
        }}>
          <div style={{ fontSize:52, marginBottom:12 }}>🔒</div>
          <p style={{ color:TEXT, fontSize:22, fontWeight:800, margin:"0 0 6px" }}>Bienvenido</p>
          <p style={{ color:MUTED, fontSize:14, margin:"0 0 24px" }}>Ingrese el PIN de acceso</p>
          <div style={{ display:"flex", justifyContent:"center", gap:16, marginBottom:24 }}>
            {[0,1,2,3].map(i=>(
              <div key={i} style={{ width:20, height:20, borderRadius:"50%", border:`2.5px solid ${i<pin.length ? BL : BORDER}`, background: i<pin.length ? BL : "transparent" }} />
            ))}
          </div>
          {pinErr && <p style={{ color:"#f87171", fontSize:14, marginBottom:12 }}>❌ PIN incorrecto</p>}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            {["1","2","3","4","5","6","7","8","9"].map(d=>(
              <button key={d} onClick={()=>{
                if (pin.length<4){
                  const np=pin+d; setPin(np);
                  if(np.length===4){ if(np==="1234"){setPinErr(false);next();}else{setPinErr(true);setPin("");} }
                }
              }} style={{ padding:"20px 0", borderRadius:12, fontSize:24, fontWeight:800, border:`1px solid ${BORDER}`, background:"#0f2a5e", color:TEXT, cursor:"pointer" }}>
                {d}
              </button>
            ))}
            <div/>
            <button onClick={()=>{ if(pin.length<4){const np=pin+"0";setPin(np);if(np.length===4){if(np==="1234"){setPinErr(false);next();}else{setPinErr(true);setPin("");}}}}} style={{ padding:"20px 0", borderRadius:12, fontSize:24, fontWeight:800, border:`1px solid ${BORDER}`, background:"#0f2a5e", color:TEXT, cursor:"pointer" }}>0</button>
            <button onClick={()=>setPin(p=>p.slice(0,-1))} style={{ padding:"20px 0", borderRadius:12, fontSize:20, border:`1px solid ${BORDER}`, background:"#1a0a0a", color:"#f87171", cursor:"pointer" }}>⌫</button>
          </div>
        </div>
      </div>
    </Wrap>
  );

  /* ── SUCCESS ─────────────────────────────────────────────────────── */
  if (step === 11) return (
    <Wrap>
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
        <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:18, padding:40, maxWidth:460, textAlign:"center" }}>
          <div style={{ fontSize:72, marginBottom:16 }}>🎉</div>
          <p style={{ color:TEXT, fontSize:24, fontWeight:800, margin:"0 0 8px" }}>¡Solicitud enviada!</p>
          <p style={{ color:MUTED, fontSize:15, margin:"0 0 6px" }}>Fue registrada correctamente.</p>
          <p style={{ color:"#93c5fd", fontSize:14, margin:"0 0 28px" }}>Seguimiento: <strong style={{color:TEXT}}>#2024-0041</strong></p>
          <div style={{ background:IBKG, borderRadius:12, padding:16, textAlign:"left", marginBottom:28, border:`1px solid ${BORDER}` }}>
            <p style={{ color:MUTED, fontSize:12, margin:"0 0 6px" }}>📞 RRHH le contactará en los próximos días al número:</p>
            <p style={{ color:TEXT, fontSize:16, fontWeight:700, margin:0 }}>{form.tel_movil || "—"}</p>
          </div>
          <button onClick={()=>{setStep(0);setPin("");}} style={{ padding:"14px 40px", borderRadius:12, fontSize:16, fontWeight:800, background:BLUE, color:"#fff", border:"none", cursor:"pointer" }}>
            Nueva Solicitud
          </button>
        </div>
      </div>
    </Wrap>
  );

  /* ── Steps 1–10 ──────────────────────────────────────────────────── */
  return (
    <Wrap>
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"16px 16px 0", gap:14 }}>
        <Progress step={step} />

        {/* ── PASO 1: Datos personales ── */}
        {step === 1 && (
          <StepCard title="Sus Datos Personales" icon="👤" onNext={next} disableNext={!form.nombre||!form.cui||!form.tel_movil}>
            <Field icon="🎯" label="Plaza que solicita" required
              hint="Seleccione el cargo al que desea aplicar en ISP. Si no está seguro, elija el más parecido a lo que busca.">
              <ISPSelect value={form.plaza} onChange={u("plaza")} options={PUESTOS} placeholder="¿A qué cargo aplica? ▾" />
            </Field>

            <Field icon="🪪" label="Nombre completo" required
              hint="Escriba exactamente como aparece en su DPI. Primero apellidos, luego nombres.">
              <ISPInput value={form.nombre} onChange={ue("nombre")} placeholder="Ej: PÉREZ GARCÍA Juan Carlos" />
            </Field>

            <Grid>
              <Field icon="💼" label="Profesión u oficio"
                hint="¿Cuál es su título o qué sabe hacer? Ej: Bachiller, Perito Contador, Electricista, Agricultor.">
                <ISPInput value={form.profesion} onChange={ue("profesion")} placeholder="Ej: Bachiller en CCLL" />
              </Field>

              <Field icon="🎂" label="Fecha de nacimiento"
                hint="Seleccione el día, mes y año en que nació.">
                <ISPInput type="date" value={form.fecha_nac} onChange={ue("fecha_nac")} />
              </Field>

              <Field icon="🪪" label="DPI / CUI" required
                hint="Son los 13 números que aparecen en su Documento Personal de Identificación (DPI) — la tarjeta azul de la Registral.">
                <ISPInput value={form.cui} onChange={ue("cui")} placeholder="Ej: 1234 56789 0101" maxLength={15} />
              </Field>

              <Field icon="💰" label="NIT"
                hint="Número de Identificación Tributaria de la SAT. Si no lo tiene, puede escribir CF (Consumidor Final).">
                <ISPInput value={form.nit} onChange={ue("nit")} placeholder="Ej: 1234567-8  o  CF" />
              </Field>
            </Grid>

            <IgssField value={form.igss} onChange={u("igss")} />

            <Grid>
              <Field icon="📱" label="Teléfono móvil" required
                hint="Número de celular donde podemos llamarle para avisarle sobre su solicitud.">
                <ISPInput value={form.tel_movil} onChange={ue("tel_movil")} type="tel" placeholder="Ej: 5432-1098" />
              </Field>

              <Field icon="☎️" label="Teléfono fijo"
                hint="Si no tiene teléfono fijo en casa, puede dejarlo en blanco.">
                <ISPInput value={form.tel_fijo} onChange={ue("tel_fijo")} type="tel" placeholder="Ej: 2345-6789 (opcional)" />
              </Field>

              <Field icon="💌" label="Correo electrónico"
                hint="Si tiene correo electrónico (Gmail, Hotmail, etc.), escríbalo aquí. Si no tiene, déjelo en blanco." wide>
                <ISPInput value={form.correo} onChange={ue("correo")} type="email" placeholder="Ej: juan.perez@gmail.com  (opcional)" />
              </Field>

              <Field icon="💍" label="Estado civil"
                hint="Seleccione su situación actual.">
                <ISPSelect value={form.estado_civil} onChange={u("estado_civil")} options={["Soltero/a","Casado/a","Unido/a","Divorciado/a","Viudo/a"]} />
              </Field>

              <Field icon="🌎" label="Nacionalidad">
                <ISPSelect value={form.nacionalidad} onChange={u("nacionalidad")} options={["Guatemalteca","Hondureña","Salvadoreña","Nicaragüense","Costarricense","Otra"]} />
              </Field>
            </Grid>
          </StepCard>
        )}

        {/* ── PASO 2: Domicilio y banco ── */}
        {step === 2 && (
          <StepCard title="Su Domicilio y Datos Bancarios" icon="🏠" onBack={back} onNext={next}>
            <Sec icon="📍" title="¿Dónde vive?" />
            <Field icon="🗺️" label="Lugar donde nació"
              hint="El municipio y departamento donde nació. Ej: Chiquimula, Chiquimula.">
              <ISPInput value={form.lugar_nac} onChange={ue("lugar_nac")} placeholder="Ej: Chiquimula, Chiquimula" />
            </Field>

            <Field icon="🏘️" label="Dirección donde vive ahora" wide
              hint="Escriba la dirección completa con calle, número de casa, zona o aldea. Ej: 3ra Calle 5-20 Zona 3, Colonia El Esfuerzo.">
              <ISPInput value={form.direccion} onChange={ue("direccion")} placeholder="Ej: 3ra Calle 5-20 Zona 3, Colonia El Esfuerzo" />
            </Field>

            <Grid>
              <Field icon="🏙️" label="Municipio">
                <ISPInput value={form.municipio} onChange={ue("municipio")} placeholder="Ej: Mixco" />
              </Field>
              <Field icon="📌" label="Departamento">
                <ISPSelect value={form.departamento} onChange={u("departamento")} options={DEPTOS} />
              </Field>
              <Field icon="📅" label="¿Cuánto tiempo lleva viviendo ahí?"
                hint="Seleccione aproximadamente cuánto tiempo lleva en esa dirección.">
                <ISPSelect value={form.tiempo_residencia} onChange={u("tiempo_residencia")} options={["Menos de 1 año","1 a 3 años","3 a 5 años","Más de 5 años"]} />
              </Field>
              <Field icon="🏡" label="Su casa es...">
                <ISPSelect value={form.tipo_casa} onChange={u("tipo_casa")} options={["Propia","Alquilada","Familiar / prestada"]} />
              </Field>
              {form.tipo_casa === "Alquilada" && (
                <Field icon="💵" label="¿Cuánto paga de alquiler al mes? (Q)">
                  <ISPInput value={form.renta_mensual} onChange={ue("renta_mensual")} type="number" placeholder="Ej: 800" />
                </Field>
              )}
            </Grid>

            <Sec icon="🏦" title="Cuenta bancaria (para recibir su sueldo)" />
            <p style={{ color:MUTED, fontSize:13, margin:"-8px 0 4px" }}>
              Si aún no tiene cuenta bancaria, déjelo en blanco por ahora.
            </p>
            <Grid>
              <Field icon="🏦" label="Banco"
                hint="Seleccione el banco donde tiene su cuenta de ahorros o monetaria.">
                <ISPSelect value={form.banco} onChange={u("banco")} options={BANCOS} />
              </Field>
              <Field icon="💳" label="Tipo de cuenta">
                <ISPSelect value={form.tipo_cuenta} onChange={u("tipo_cuenta")} options={["Monetaria (Cheques)","Ahorro"]} />
              </Field>
              <Field icon="🔢" label="Número de cuenta" wide
                hint="Copie exactamente el número de cuenta de su libreta o tarjeta.">
                <ISPInput value={form.num_cuenta} onChange={ue("num_cuenta")} placeholder="Ej: 3-000-12345-6" />
              </Field>
            </Grid>

            <Sec icon="🚗" title="Licencia de conducir" />
            <SiNo value={form.tiene_licencia} onChange={u("tiene_licencia")} icon="🚗" label="¿Tiene licencia de conducir?" />
            {form.tiene_licencia === "si" && (
              <Grid>
                <Field icon="📋" label="Tipo / Categoría"
                  hint="A=motocicleta, B=automóvil, C=camión, M=maquinaria, E=vehículo de emergencia.">
                  <ISPSelect value={form.tipo_licencia} onChange={u("tipo_licencia")} options={["A — Motocicleta","B — Automóvil","C — Camión / Bus","M — Maquinaria","E — Emergencia"]} />
                </Field>
                <Field icon="📅" label="Válida hasta (vencimiento)">
                  <ISPInput type="date" value={form.vigencia_licencia} onChange={ue("vigencia_licencia")} />
                </Field>
              </Grid>
            )}
          </StepCard>
        )}

        {/* ── PASO 3: Familia ── */}
        {step === 3 && (
          <StepCard title="Su Familia" icon="👨‍👩‍👧‍👦" onBack={back} onNext={next}>
            <div style={{ background:INFO_BG, border:`1px solid ${INFO_BR}`, borderRadius:12, padding:"12px 16px" }}>
              <p style={{ color:"#93c5fd", fontSize:13, margin:0 }}>
                ℹ️ Esta información es <strong>confidencial</strong> y solo se usa para el expediente interno de ISP. Los campos con "si aplica" puede dejarlos en blanco.
              </p>
            </div>

            <Sec icon="👴👵" title="Sus papás" />
            <Grid>
              <Field icon="👨" label="Nombre de su papá">
                <ISPInput value={form.padre_nombre} onChange={ue("padre_nombre")} placeholder="Nombre completo" />
              </Field>
              <Field icon="📱" label="Teléfono de su papá">
                <ISPInput value={form.padre_tel} onChange={ue("padre_tel")} type="tel" placeholder="5432-1098" />
              </Field>
              <Field icon="👩" label="Nombre de su mamá">
                <ISPInput value={form.madre_nombre} onChange={ue("madre_nombre")} placeholder="Nombre completo" />
              </Field>
              <Field icon="📱" label="Teléfono de su mamá">
                <ISPInput value={form.madre_tel} onChange={ue("madre_tel")} type="tel" placeholder="5432-1098" />
              </Field>
            </Grid>

            <Sec icon="💑" title="Esposo/a o pareja (si aplica)" />
            <Grid>
              <Field icon="💑" label="Nombre de su pareja" wide>
                <ISPInput value={form.conyuge_nombre} onChange={ue("conyuge_nombre")} placeholder="Nombre completo (si aplica)" />
              </Field>
              <Field icon="🏢" label="¿Dónde trabaja?">
                <ISPInput value={form.conyuge_ocupacion} onChange={ue("conyuge_ocupacion")} placeholder="Empresa u ocupación" />
              </Field>
              <Field icon="📱" label="Teléfono">
                <ISPInput value={form.conyuge_tel} onChange={ue("conyuge_tel")} type="tel" placeholder="5432-1098" />
              </Field>
            </Grid>

            <Sec icon="👶" title="Hijos y hermanos" />
            <Grid>
              <Field icon="👶" label="¿Cuántos hijos tiene?">
                <ISPSelect value={form.num_hijos} onChange={u("num_hijos")} options={["0","1","2","3","4","5","6 o más"]} />
              </Field>
            </Grid>

            <Field icon="🤝" label="Hermano 1 (si aplica)">
              <Grid>
                <ISPInput value={form.herm1_nombre} onChange={ue("herm1_nombre")} placeholder="Nombre completo" />
                <ISPInput value={form.herm1_tel} onChange={ue("herm1_tel")} type="tel" placeholder="Teléfono" />
              </Grid>
            </Field>
            <Field icon="🤝" label="Hermano 2 (si aplica)">
              <Grid>
                <ISPInput value={form.herm2_nombre} onChange={ue("herm2_nombre")} placeholder="Nombre completo" />
                <ISPInput value={form.herm2_tel} onChange={ue("herm2_tel")} type="tel" placeholder="Teléfono" />
              </Grid>
            </Field>

            <Sec icon="📱" title="Redes sociales (opcional)" />
            <p style={{ color:MUTED, fontSize:13, margin:"-8px 0 4px" }}>Si no usa redes sociales, deje estos campos en blanco.</p>
            <Grid>
              <Field icon="👍" label="Facebook"><ISPInput value={form.facebook} onChange={ue("facebook")} placeholder="facebook.com/usuario" /></Field>
              <Field icon="📸" label="Instagram"><ISPInput value={form.instagram} onChange={ue("instagram")} placeholder="@usuario" /></Field>
            </Grid>
          </StepCard>
        )}

        {/* ── PASO 4: Salud ── */}
        {step === 4 && (
          <StepCard title="Su Salud" icon="🩺" onBack={back} onNext={next}>
            <div style={{ background:INFO_BG, border:`1px solid ${INFO_BR}`, borderRadius:12, padding:"12px 16px" }}>
              <p style={{ color:"#93c5fd", fontSize:13, margin:0 }}>
                ℹ️ Responda con honestidad. Esta información es confidencial y ayuda a asignarle el puesto más adecuado para usted.
              </p>
            </div>

            <Grid>
              <Field icon="📏" label="Su estatura"
                hint="Mídase sin zapatos y escriba en metros. Ejemplo: si mide 1 metro con 75 centímetros, escriba 1.75">
                <ISPInput value={form.estatura} onChange={ue("estatura")} placeholder="Ej: 1.75 (en metros)" />
              </Field>
              <Field icon="⚖️" label="Su peso"
                hint="Peso en kilogramos. Ejemplo: si pesa 80 kg, escriba 80.">
                <ISPInput value={form.peso} onChange={ue("peso")} type="number" placeholder="Ej: 80 (en kg)" />
              </Field>
            </Grid>

            <SiNo value={form.enfermedad} onChange={u("enfermedad")} icon="💊" label="¿Tiene alguna enfermedad crónica?" hint="Ejemplo: diabetes, hipertensión, epilepsia, asma u otras enfermedades que requieren control médico regular." />
            {form.enfermedad === "si" && <Field icon="📝" label="¿Cuál enfermedad?"><ISPTextarea value={form.enfermedad_det} onChange={ue("enfermedad_det")} rows={2} placeholder="Escriba el nombre de la enfermedad..." /></Field>}

            <SiNo value={form.medicamento} onChange={u("medicamento")} icon="💉" label="¿Toma algún medicamento actualmente?" hint="Medicamentos recetados por el médico que toma de forma regular." />
            {form.medicamento === "si" && <Field icon="📝" label="¿Cuál medicamento?"><ISPInput value={form.medicamento_det} onChange={ue("medicamento_det")} placeholder="Nombre del medicamento" /></Field>}

            <SiNo value={form.impedimento} onChange={u("impedimento")} icon="♿" label="¿Tiene algún impedimento físico?" hint="Ejemplo: problemas en manos, pies, espalda, vista, audición que le dificulten algunas actividades." />
            {form.impedimento === "si" && <Field icon="📝" label="¿Cuál impedimento?"><ISPInput value={form.impedimento_det} onChange={ue("impedimento_det")} placeholder="Descríbalo brevemente..." /></Field>}

            <Grid>
              <SiNo value={form.alcohol} onChange={u("alcohol")} icon="🍺" label="¿Consume bebidas alcohólicas?" />
              <SiNo value={form.drogas} onChange={u("drogas")} icon="🚫" label="¿Ha consumido drogas alguna vez?" />
            </Grid>

            <SiNo value={form.tatuajes} onChange={u("tatuajes")} icon="🖊️" label="¿Tiene tatuajes?"
              hint="Si tiene tatuajes, deberá indicar qué significan. Los tatuajes no son impedimento para trabajar, pero ISP necesita saberlo." />
            {form.tatuajes === "si" && (
              <Field icon="📝" label="¿Qué significado tienen sus tatuajes?">
                <ISPTextarea value={form.tatuajes_det} onChange={ue("tatuajes_det")} rows={2} placeholder="Explique brevemente qué representan..." />
              </Field>
            )}

            <Sec icon="🆘" title="Contacto de emergencia" />
            <p style={{ color:MUTED, fontSize:13, margin:"-8px 0 4px" }}>
              ¿A quién debemos llamar si le pasa algo en el trabajo?
            </p>
            <Grid>
              <Field icon="👤" label="Nombre de la persona" wide>
                <ISPInput value={form.emergencia_nombre} onChange={ue("emergencia_nombre")} placeholder="Nombre completo de la persona" />
              </Field>
              <Field icon="📱" label="Teléfono de esa persona">
                <ISPInput value={form.emergencia_tel} onChange={ue("emergencia_tel")} type="tel" placeholder="5432-1098" />
              </Field>
              <Field icon="👨‍👩‍👧" label="¿Qué parentesco tiene con usted?">
                <ISPSelect value={form.emergencia_parentesco} onChange={u("emergencia_parentesco")} options={["Es mi mamá","Es mi papá","Es mi esposo/a o pareja","Es mi hermano/a","Es mi hijo/a","Es otro familiar","Es un amigo/a"]} />
              </Field>
            </Grid>
          </StepCard>
        )}

        {/* ── PASO 5: Antecedentes ── */}
        {step === 5 && (
          <StepCard title="Antecedentes y Situación Financiera" icon="⚖️" onBack={back} onNext={next}>
            <div style={{ background:INFO_BG, border:`1px solid ${INFO_BR}`, borderRadius:12, padding:"12px 16px" }}>
              <p style={{ color:"#93c5fd", fontSize:13, margin:0 }}>
                ℹ️ Responda con honestidad. ISP realiza verificaciones de antecedentes. Ocultar información puede resultar en descalificación inmediata.
              </p>
            </div>

            <Sec icon="⚖️" title="Antecedentes legales" />
            <SiNo value={form.proceso_judicial} onChange={u("proceso_judicial")} icon="🏛️" label="¿Tiene algún proceso judicial en curso?" hint="¿Está siendo investigado o tiene un juicio pendiente en los tribunales?" />
            {form.proceso_judicial === "si" && <Field icon="📝" label="¿Por qué motivo?"><ISPTextarea value={form.proceso_det} onChange={ue("proceso_det")} rows={2} placeholder="Explique brevemente..." /></Field>}

            <SiNo value={form.detenido} onChange={u("detenido")} icon="👮" label="¿Ha sido detenido alguna vez?" hint="¿La policía o autoridades lo han detenido o arrestado anteriormente?" />
            {form.detenido === "si" && <Field icon="📝" label="¿Por qué motivo?"><ISPTextarea value={form.detencion_det} onChange={ue("detencion_det")} rows={2} placeholder="Explique brevemente..." /></Field>}

            <Sec icon="💵" title="Su situación económica" />
            <p style={{ color:MUTED, fontSize:13, margin:"-8px 0 4px" }}>Esta información es privada y solo ayuda a entender su situación.</p>

            <SiNo value={form.deudas} onChange={u("deudas")} icon="💳" label="¿Tiene deudas pendientes?" />
            {form.deudas === "si" && (
              <Field icon="📊" label="¿Cómo está su deuda?">
                <ISPSelect value={form.estado_deuda} onChange={u("estado_deuda")} options={["Al día (pagando puntual)","Con atraso (me he atrasado en pagos)"]} />
              </Field>
            )}

            <Field icon="🧾" label="¿Cuánto gasta al mes aproximadamente? (Q)"
              hint="Sume sus gastos de alimentación, renta, transporte y otros. Es un estimado.">
              <ISPInput value={form.gastos} onChange={ue("gastos")} type="number" placeholder="Ej: 2500" />
            </Field>

            <SiNo value={form.prestamo} onChange={u("prestamo")} icon="🏦" label="¿Tiene algún préstamo bancario o personal?" />
            {form.prestamo === "si" && (
              <Field icon="💰" label="¿De cuánto es el préstamo? (Q)">
                <ISPInput value={form.prestamo_monto} onChange={ue("prestamo_monto")} type="number" placeholder="Ej: 15000" />
              </Field>
            )}
          </StepCard>
        )}

        {/* ── PASO 6: Educación ── */}
        {step === 6 && (
          <StepCard title="Su Formación Académica" icon="🎓" onBack={back} onNext={next}>
            <div style={{ background:INFO_BG, border:`1px solid ${INFO_BR}`, borderRadius:12, padding:"12px 16px" }}>
              <p style={{ color:"#93c5fd", fontSize:13, margin:0 }}>
                ℹ️ Llene solo los niveles que completó. Si no terminó un nivel, puede dejarlo en blanco o escribir "incompleto" en el título.
              </p>
            </div>
            {([
              { nivel:"Primaria (1ro a 6to grado)", icon:"📗", k:"prim" },
              { nivel:"Básico (1ro a 3ro básico)", icon:"📘", k:"bas" },
              { nivel:"Diversificado (bachillerato / carrera)", icon:"📙", k:"div" },
              { nivel:"Universidad (si aplica)", icon:"🎓", k:"uni" },
            ] as {nivel:string;icon:string;k:string}[]).map(({ nivel, icon: ic, k }) => (
              <div key={k}>
                <Sec icon={ic} title={nivel} />
                <Grid>
                  <Field icon="🏫" label="Nombre del establecimiento">
                    <ISPInput value={(form as Record<string,string>)[`${k}_est`]} onChange={ue(`${k}_est` as keyof typeof form)} placeholder="Ej: Escuela Nacional Mixta..." />
                  </Field>
                  <Field icon="📍" label="Ciudad o municipio">
                    <ISPInput value={(form as Record<string,string>)[`${k}_lugar`]} onChange={ue(`${k}_lugar` as keyof typeof form)} placeholder="Ej: Guatemala, Guatemala" />
                  </Field>
                  <Field icon="📜" label="Título obtenido" wide>
                    <ISPInput value={(form as Record<string,string>)[`${k}_titulo`]} onChange={ue(`${k}_titulo` as keyof typeof form)} placeholder='Ej: Bachiller en CCLL — o — "Incompleto"' />
                  </Field>
                </Grid>
              </div>
            ))}
          </StepCard>
        )}

        {/* ── PASO 7: Experiencia laboral ── */}
        {step === 7 && (
          <StepCard title="Su Experiencia de Trabajo" icon="💼" onBack={back} onNext={next}>
            <div style={{ background:INFO_BG, border:`1px solid ${INFO_BR}`, borderRadius:12, padding:"12px 16px" }}>
              <p style={{ color:"#93c5fd", fontSize:13, margin:0 }}>
                ℹ️ Empiece por el trabajo más reciente. Si solo ha tenido 1 trabajo, llene solo la primera empresa.
              </p>
            </div>
            {([1,2,3] as (1|2|3)[]).map(n => (
              <div key={n}>
                <Sec icon={n===1 ? "🏢" : "🏗️"} title={`${n===1 ? "Trabajo más reciente" : `Trabajo anterior ${n-1}`}${n > 1 ? " (si aplica)" : " *"}`} />
                <Grid>
                  <Field icon="🏢" label="Nombre de la empresa" wide>
                    <ISPInput value={(form as Record<string,string>)[`emp${n}_nombre`]} onChange={ue(`emp${n}_nombre` as keyof typeof form)} placeholder={n===1 ? "Empresa donde trabajó más recientemente" : "Déjelo en blanco si no aplica"} />
                  </Field>
                  <Field icon="👷" label="¿Qué cargo tenía?">
                    <ISPInput value={(form as Record<string,string>)[`emp${n}_puesto`]} onChange={ue(`emp${n}_puesto` as keyof typeof form)} placeholder="Ej: Guardia de Seguridad" />
                  </Field>
                  <Field icon="💵" label="Sueldo que ganaba (Q)">
                    <ISPInput value={(form as Record<string,string>)[`emp${n}_salario`]} onChange={ue(`emp${n}_salario` as keyof typeof form)} type="number" placeholder="Ej: 3200" />
                  </Field>
                  <Field icon="📅" label="Mes/año que entró">
                    <ISPInput type="month" value={(form as Record<string,string>)[`emp${n}_inicio`]} onChange={ue(`emp${n}_inicio` as keyof typeof form)} />
                  </Field>
                  <Field icon="📅" label="Mes/año que salió">
                    <ISPInput type="month" value={(form as Record<string,string>)[`emp${n}_fin`]} onChange={ue(`emp${n}_fin` as keyof typeof form)} />
                  </Field>
                  <Field icon="🚪" label="¿Por qué salió?" wide>
                    <ISPSelect value={(form as Record<string,string>)[`emp${n}_motivo`]} onChange={u(`emp${n}_motivo` as keyof typeof form)}
                      options={["Terminó el contrato","Renuncié voluntariamente","Mejor oferta de trabajo","La empresa cerró","Motivos personales o familiares","Otro motivo"]} />
                  </Field>
                </Grid>
              </div>
            ))}
          </StepCard>
        )}

        {/* ── PASO 8: Seguridad + habilidades ── */}
        {step === 8 && (
          <StepCard title="Experiencia en Seguridad y Habilidades" icon="🛡️" onBack={back} onNext={next}>
            <Sec icon="🛡️" title="Experiencia en seguridad" />
            <SiNo value={form.exp_seg} onChange={u("exp_seg")} icon="👮" label="¿Ha trabajado como agente de seguridad antes?" />
            {form.exp_seg === "si" && (
              <>
                <Field icon="📋" label="¿En qué tipo de seguridad ha trabajado?" hint="Puede seleccionar más de una opción.">
                  <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginTop:4 }}>
                    {["Seguridad privada","Seguridad bancaria","Custodia armada","Transporte de valores"].map(t=>(
                      <Pill key={t} label={t} checked={form.tipos_seg.includes(t)} onChange={()=>tog("tipos_seg",t)} />
                    ))}
                  </div>
                </Field>
                <Field icon="⏱️" label="¿Cuánto tiempo en total ha trabajado en seguridad?">
                  <ISPSelect value={form.tiempo_seg} onChange={u("tiempo_seg")} options={["Menos de 1 año","1 a 2 años","2 a 5 años","5 a 10 años","Más de 10 años"]} />
                </Field>
              </>
            )}

            <Sec icon="🎖️" title="Servicio militar o policial" />
            <SiNo value={form.militar} onChange={u("militar")} icon="🎖️" label="¿Prestó servicio militar?" />
            {form.militar === "si" && (
              <Grid>
                <Field icon="⭐" label="Rango que alcanzó"><ISPInput value={form.rango} onChange={ue("rango")} placeholder="Ej: Cabo, Sargento..." /></Field>
                <Field icon="🏛️" label="Unidad donde sirvió"><ISPInput value={form.unidad} onChange={ue("unidad")} placeholder="Nombre de la unidad" /></Field>
              </Grid>
            )}
            <SiNo value={form.fue_policia} onChange={u("fue_policia")} icon="👮‍♂️" label="¿Perteneció a la Policía Nacional Civil u otra fuerza?" />
            {form.fue_policia === "si" && <Field icon="📝" label="¿Por qué se retiró?"><ISPInput value={form.motivo_baja} onChange={ue("motivo_baja")} placeholder="Motivo de retiro..." /></Field>}

            <Sec icon="💪" title="Sus habilidades (marque las que tiene)" />
            <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
              {[
                {v:"Manejo de armas", e:"🔫"},
                {v:"Defensa personal", e:"🥋"},
                {v:"Control de accesos", e:"🚧"},
                {v:"Radio comunicación", e:"📻"},
                {v:"Trabajo bajo presión", e:"⚡"},
                {v:"Resolución de conflictos", e:"🤝"},
              ].map(h=>(
                <Pill key={h.v} label={`${h.e} ${h.v}`} checked={form.habilidades.includes(h.v)} onChange={()=>tog("habilidades",h.v)} />
              ))}
            </div>

            <Sec icon="🕐" title="¿Cuándo puede trabajar?" />
            <Grid>
              <SiNo value={form.disp_rotativo} onChange={u("disp_rotativo")} icon="🔄" label="¿Puede trabajar en turnos rotativos?" hint="Turnos rotativos significa que un día puede ser de día y otro de noche, dependiendo del puesto." />
              <SiNo value={form.disp_nocturno} onChange={u("disp_nocturno")} icon="🌙" label="¿Puede trabajar de noche?" />
              <SiNo value={form.disp_fds} onChange={u("disp_fds")} icon="📅" label="¿Puede trabajar sábados y domingos?" />
              <SiNo value={form.vehiculo} onChange={u("vehiculo")} icon="🚗" label="¿Tiene vehículo propio?" />
            </Grid>
          </StepCard>
        )}

        {/* ── PASO 9: Referencias ── */}
        {step === 9 && (
          <StepCard title="Referencias Personales" icon="📋" onBack={back} onNext={next}>
            <div style={{ background:INFO_BG, border:`1px solid ${INFO_BR}`, borderRadius:12, padding:"12px 16px" }}>
              <p style={{ color:"#93c5fd", fontSize:13, margin:0, lineHeight:1.6 }}>
                ℹ️ <strong>¿Qué es una referencia?</strong> Son personas que nos pueden decir cómo es usted. <strong>No pueden ser familiares</strong> (papá, mamá, hermanos, etc.). Pueden ser vecinos, amigos de confianza, ex compañeros de trabajo, etc.
              </p>
            </div>
            {([1,2,3] as (1|2|3)[]).map(n => (
              <div key={n}>
                <Sec icon={["👤","👤","👤"][n-1]} title={`Referencia ${n}${n > 1 ? " (si aplica)" : " *"}`} />
                <Grid>
                  <Field icon="🪪" label="Nombre completo" wide>
                    <ISPInput value={(form as Record<string,string>)[`ref${n}_nombre`]} onChange={ue(`ref${n}_nombre` as keyof typeof form)} placeholder="Nombre de la persona que le conoce" />
                  </Field>
                  <Field icon="💼" label="¿A qué se dedica esa persona?">
                    <ISPInput value={(form as Record<string,string>)[`ref${n}_ocup`]} onChange={ue(`ref${n}_ocup` as keyof typeof form)} placeholder="Ej: Comerciante, Docente, Mecánico..." />
                  </Field>
                  <Field icon="📱" label="Teléfono de esa persona">
                    <ISPInput value={(form as Record<string,string>)[`ref${n}_tel`]} onChange={ue(`ref${n}_tel` as keyof typeof form)} type="tel" placeholder="5432-1098" />
                  </Field>
                </Grid>
              </div>
            ))}

            <div style={{ background:"#071020", border:`1px solid ${BORDER}`, borderRadius:12, padding:"14px 16px" }}>
              <p style={{ color:MUTED, fontSize:12, lineHeight:1.7, margin:0 }}>
                <span style={{ color:"#93c5fd", fontWeight:700 }}>Declaración: </span>
                Declaro que toda la información que proporcioné es verdadera. Autorizo a ISP, S.A. a verificar mis datos. Me comprometo a seguir el reglamento interno de trabajo y las condiciones estipuladas en el Código de Trabajo (Decreto No. 1441).
              </p>
            </div>
          </StepCard>
        )}

        {/* ── PASO 10: Foto ── */}
        {step === 10 && (
          <StepCard title="Su Fotografía" icon="📷" onBack={back} onNext={next} nextLabel="Enviar Solicitud ✓">
            <div style={{ textAlign:"center", padding:"24px 0" }}>
              <div style={{
                width:200, height:200, borderRadius:"50%",
                background:IBKG, border:`3px dashed ${BORDER}`,
                margin:"0 auto 24px", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:10,
              }}>
                <span style={{ fontSize:56 }}>📷</span>
                <span style={{ color:MUTED, fontSize:13 }}>Sin foto aún</span>
              </div>
              <button style={{
                padding:"16px 36px", borderRadius:12, fontSize:16, fontWeight:800,
                background:BLUE, color:"#fff", border:"none", cursor:"pointer",
                display:"block", margin:"0 auto 12px",
              }}>
                📷 Tomar Fotografía
              </button>
              <p style={{ color:MUTED, fontSize:13, lineHeight:1.6 }}>
                Toque el botón de arriba para encender la cámara y tomar su foto.<br />
                <span style={{ color:"#93c5fd" }}>La foto es opcional</span> pero ayuda a agilizar su proceso.
              </p>
              <div style={{ background:INFO_BG, border:`1px solid ${INFO_BR}`, borderRadius:12, padding:"12px 16px", marginTop:20, textAlign:"left" }}>
                <p style={{ color:"#93c5fd", fontSize:13, margin:"0 0 6px", fontWeight:700 }}>📌 Consejos para la foto:</p>
                <ul style={{ color:MUTED, fontSize:13, margin:0, paddingLeft:18, lineHeight:1.8 }}>
                  <li>Mire directo a la cámara</li>
                  <li>Buena iluminación (no contra la luz)</li>
                  <li>Sin gorra, sin lentes oscuros</li>
                  <li>Fondo blanco o de color liso si es posible</li>
                </ul>
              </div>
            </div>
          </StepCard>
        )}
      </div>
      <div style={{ height:20 }} />
    </Wrap>
  );
}

/* ── App shell ───────────────────────────────────────────────────── */
function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight:"100vh", background:BG, display:"flex", flexDirection:"column", fontFamily:"system-ui, -apple-system, sans-serif" }}>
      <div style={{
        background:"#091a3d", borderBottom:`1px solid ${BORDER}`,
        padding:"10px 20px", display:"flex", alignItems:"center", gap:12, flexShrink:0,
      }}>
        <div style={{ width:38, height:38, borderRadius:10, background:"#1e3a6e", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🛡️</div>
        <div>
          <p style={{ color:TEXT, fontSize:15, fontWeight:800, margin:0 }}>ISP, S.A. — Solicitud de Empleo</p>
          <p style={{ color:MUTED, fontSize:11, margin:0 }}>Investigaciones y Seguridad Profesional</p>
        </div>
        <div style={{ marginLeft:"auto", color:MUTED, fontSize:11 }}>
          {new Date().toLocaleDateString("es-GT")}
        </div>
      </div>
      {children}
    </div>
  );
}
