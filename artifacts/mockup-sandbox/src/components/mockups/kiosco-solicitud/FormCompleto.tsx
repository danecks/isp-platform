import { useState } from "react";

const BG = "#0a1628";
const CARD = "#0d2147";
const BORDER = "#1e3a6e";
const BLUE = "#2563eb";
const BLUE_LIGHT = "#3b82f6";
const TEXT = "#e2e8f0";
const MUTED = "#94a3b8";
const INPUT_BG = "#071020";

/* ── tiny primitives ─────────────────────────────────────────── */
function ISPInput(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...p}
      style={{
        background: INPUT_BG, border: `1px solid ${BORDER}`, color: TEXT,
        borderRadius: 10, padding: "12px 14px", fontSize: 15, width: "100%",
        outline: "none", boxSizing: "border-box",
      }}
    />
  );
}

function ISPTextarea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...p}
      style={{
        background: INPUT_BG, border: `1px solid ${BORDER}`, color: TEXT,
        borderRadius: 10, padding: "12px 14px", fontSize: 15, width: "100%",
        outline: "none", boxSizing: "border-box", resize: "none",
      }}
    />
  );
}

function ISPSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: { v: string; l: string }[] | string[]; placeholder?: string;
}) {
  const opts = (options as (string | { v: string; l: string })[]).map((o) =>
    typeof o === "string" ? { v: o, l: o } : o
  );
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: INPUT_BG, border: `1px solid ${BORDER}`, color: value ? TEXT : MUTED,
        borderRadius: 10, padding: "12px 14px", fontSize: 15, width: "100%",
        outline: "none", boxSizing: "border-box", appearance: "none",
      }}
    >
      <option value="">{placeholder ?? "Seleccionar..."}</option>
      {opts.map((o) => <option key={o.v} value={o.v} style={{ color: TEXT, background: CARD }}>{o.l}</option>)}
    </select>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <label style={{ color: MUTED, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4, display: "block" }}>{children}</label>;
}

function F({ label, children, col2 }: { label: string; children: React.ReactNode; col2?: boolean }) {
  return (
    <div style={{ gridColumn: col2 ? "1 / -1" : undefined }}>
      <Lbl>{label}</Lbl>
      {children}
    </div>
  );
}

function Grid({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14 }}>{children}</div>;
}

function SiNo({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div>
      <Lbl>{label}</Lbl>
      <div style={{ display: "flex", gap: 10 }}>
        {["si", "no"].map((opt) => (
          <button key={opt} onClick={() => onChange(opt)}
            style={{
              flex: 1, padding: "13px 0", borderRadius: 10, fontSize: 15, fontWeight: 600,
              border: `2px solid ${value === opt ? BLUE_LIGHT : BORDER}`,
              background: value === opt ? (opt === "si" ? "#1e3a6e" : "#1a1a2e") : INPUT_BG,
              color: value === opt ? TEXT : MUTED, cursor: "pointer",
            }}>
            {opt === "si" ? "✓  Sí" : "✗  No"}
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      borderLeft: `3px solid ${BLUE_LIGHT}`, paddingLeft: 10, color: "#93c5fd",
      fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16,
    }}>{children}</div>
  );
}

function CheckPill({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{
      padding: "10px 14px", borderRadius: 20, fontSize: 13, border: `2px solid ${checked ? BLUE_LIGHT : BORDER}`,
      background: checked ? "#1e3a6e" : INPUT_BG, color: checked ? TEXT : MUTED,
      cursor: "pointer", whiteSpace: "nowrap",
    }}>
      {checked ? "☑ " : "☐ "}{label}
    </button>
  );
}

/* ── Step container ──────────────────────────────────────────── */
function StepCard({ title, icon, children, onBack, onNext, nextLabel = "Siguiente →", disableNext }: {
  title: string; icon: string; children: React.ReactNode;
  onBack?: () => void; onNext: () => void; nextLabel?: string; disableNext?: boolean;
}) {
  return (
    <div style={{ background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, maxWidth: 700, width: "100%", overflow: "hidden" }}>
      <div style={{ background: "#0a1e42", padding: "16px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <span style={{ color: TEXT, fontSize: 17, fontWeight: 700 }}>{title}</span>
      </div>
      <div style={{ padding: 20, overflowY: "auto", maxHeight: "calc(100vh - 240px)", display: "flex", flexDirection: "column", gap: 16 }}>
        {children}
      </div>
      <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", gap: 12 }}>
        {onBack
          ? <button onClick={onBack} style={{ padding: "12px 22px", borderRadius: 10, fontSize: 15, border: `1px solid ${BORDER}`, background: "transparent", color: MUTED, cursor: "pointer" }}>← Atrás</button>
          : <div />}
        <button onClick={onNext} disabled={disableNext} style={{
          padding: "12px 28px", borderRadius: 10, fontSize: 15, fontWeight: 700,
          background: disableNext ? "#1e3a6e" : BLUE, color: disableNext ? MUTED : "#fff",
          border: "none", cursor: disableNext ? "not-allowed" : "pointer", flex: onBack ? 0 : 1,
        }}>{nextLabel}</button>
      </div>
    </div>
  );
}

/* ── Step dots ───────────────────────────────────────────────── */
const STEPS = ["PIN", "Personal", "Domicilio", "Familia", "Salud", "Antecedentes", "Educación", "Experiencia", "Habilidades", "Referencias", "Foto", "✓"];
function StepDots({ step }: { step: number }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", padding: "0 10px" }}>
      {STEPS.map((s, i) => (
        <div key={i} style={{
          height: 6, borderRadius: 3, transition: "all 0.3s",
          width: i === step ? 24 : 10,
          background: i < step ? "#2563eb" : i === step ? "#93c5fd" : BORDER,
          opacity: i > step + 2 ? 0.4 : 1,
        }} title={s} />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
export function FormCompleto() {
  const [step, setStep] = useState(0);
  const [pin, setPin] = useState("");
  const [pinErr, setPinErr] = useState(false);

  // --- form state ---
  const [form, setForm] = useState({
    // Personal
    nombre: "", profesion: "", cui: "", fecha_nac: "", tel_movil: "", tel_fijo: "",
    correo: "", igss: "", nit: "", lugar_nac: "", nacionalidad: "Guatemalteca",
    estado_civil: "", plaza: "", fecha_solicitud: new Date().toISOString().slice(0, 10),
    // Domicilio
    direccion: "", municipio: "", departamento: "", tiempo_residencia: "",
    tipo_casa: "", renta_mensual: "",
    // Cuenta bancaria
    num_cuenta: "", banco: "", tipo_cuenta: "",
    // Licencia
    tiene_licencia: "no", tipo_licencia: "", vigencia_licencia: "",
    // Redes
    facebook: "", tiktok: "", instagram: "", twitter: "",
    // Padres
    padre_nombre: "", padre_edad: "", padre_ocupacion: "", padre_empresa: "", padre_tel: "",
    madre_nombre: "", madre_edad: "", madre_ocupacion: "", madre_empresa: "", madre_tel: "",
    // Cónyuge
    conyuge_nombre: "", conyuge_edad: "", conyuge_ocupacion: "", conyuge_empresa: "", conyuge_tel: "",
    num_hijos: "0",
    // Hermanos (hasta 3)
    herm1_nombre: "", herm1_trabajo: "", herm1_tel: "",
    herm2_nombre: "", herm2_trabajo: "", herm2_tel: "",
    // Salud
    estatura: "", peso: "", enfermedad_cronica: "no", enfermedad_detalle: "",
    medicamento: "no", medicamento_detalle: "",
    impedimento: "no", impedimento_detalle: "",
    alcohol: "no", drogas: "no", drogas_detalle: "",
    tatuajes: "no", tatuajes_detalle: "",
    emergencia_nombre: "", emergencia_tel: "", emergencia_parentesco: "",
    // Antecedentes
    proceso_judicial: "no", proceso_detalle: "",
    detenido: "no", detencion_detalle: "",
    // Finanzas
    deudas: "no", estado_deuda: "", gastos_mensuales: "",
    inversiones: "no", prestamo: "no", prestamo_monto: "",
    // Educación
    prim_establecimiento: "", prim_lugar: "", prim_titulo: "",
    bas_establecimiento: "", bas_lugar: "", bas_titulo: "",
    div_establecimiento: "", div_lugar: "", div_titulo: "",
    uni_establecimiento: "", uni_lugar: "", uni_titulo: "",
    // Experiencia laboral
    emp1_nombre: "", emp1_puesto: "", emp1_salario: "", emp1_inicio: "", emp1_fin: "", emp1_motivo: "",
    emp2_nombre: "", emp2_puesto: "", emp2_salario: "", emp2_inicio: "", emp2_fin: "", emp2_motivo: "",
    emp3_nombre: "", emp3_puesto: "", emp3_salario: "", emp3_inicio: "", emp3_fin: "", emp3_motivo: "",
    // Seguridad
    exp_seguridad: "no", tipos_seguridad: [] as string[], tiempo_seguridad: "",
    servicio_militar: "no", rango: "", unidad: "", tiempo_militar: "",
    fue_policia: "no", motivo_baja: "",
    // Habilidades
    habilidades: [] as string[],
    disp_rotativo: "no", disp_nocturno: "no", disp_fds: "no", tiene_vehiculo: "no",
    // Referencias
    ref1_nombre: "", ref1_ocupacion: "", ref1_tel: "",
    ref2_nombre: "", ref2_ocupacion: "", ref2_tel: "",
    ref3_nombre: "", ref3_ocupacion: "", ref3_tel: "",
  });

  const u = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const uEv = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const toggleArr = (k: "habilidades" | "tipos_seguridad", v: string) =>
    setForm(f => ({ ...f, [k]: (f[k] as string[]).includes(v) ? (f[k] as string[]).filter(x => x !== v) : [...(f[k] as string[]), v] }));

  const next = () => { window.scrollTo(0, 0); setStep(s => s + 1); };
  const back = () => { window.scrollTo(0, 0); setStep(s => s - 1); };

  const DEPTOS = ["Guatemala","Alta Verapaz","Baja Verapaz","Chimaltenango","Chiquimula","El Progreso","Escuintla","Huehuetenango","Izabal","Jalapa","Jutiapa","Petén","Quetzaltenango","Quiché","Retalhuleu","Sacatepéquez","San Marcos","Santa Rosa","Sololá","Suchitepéquez","Totonicapán","Zacapa"];
  const BANCOS = ["Banrural","Banco Industrial","G&T Continental","BAC Credomatic","Bantrab","Banamex","Vivibanco","Ficohsa","BAM","Otro"];
  const PUESTOS = ["Guardia de Seguridad","Supervisor de Seguridad","Agente de Portería","Escolta Ejecutivo","Motorista de Seguridad","Inspector","Otro"];

  /* ── STEP 0: PIN ─────────────────────────────────────────── */
  if (step === 0) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif" }}>
      <Header />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 32, width: 320, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <p style={{ color: TEXT, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Bienvenido</p>
          <p style={{ color: MUTED, fontSize: 14, marginBottom: 24 }}>Ingrese el PIN de acceso al kiosco</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 24 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${i < pin.length ? BLUE_LIGHT : BORDER}`, background: i < pin.length ? BLUE_LIGHT : "transparent" }} />
            ))}
          </div>
          {pinErr && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>PIN incorrecto. Intente de nuevo.</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            {["1","2","3","4","5","6","7","8","9"].map(d => (
              <button key={d} onClick={() => { if (pin.length < 4) { const np = pin + d; setPin(np); if (np.length === 4) { if (np === "1234") { setPinErr(false); next(); } else { setPinErr(true); setPin(""); } } }}}
                style={{ padding: "18px 0", borderRadius: 10, fontSize: 22, fontWeight: 700, border: `1px solid ${BORDER}`, background: "#0f2a5e", color: TEXT, cursor: "pointer" }}>
                {d}
              </button>
            ))}
            <div />
            <button onClick={() => { if (pin.length < 4) { const np = pin + "0"; setPin(np); if (np.length === 4) { if (np === "1234") { setPinErr(false); next(); } else { setPinErr(true); setPin(""); } } }}}
              style={{ padding: "18px 0", borderRadius: 10, fontSize: 22, fontWeight: 700, border: `1px solid ${BORDER}`, background: "#0f2a5e", color: TEXT, cursor: "pointer" }}>0</button>
            <button onClick={() => setPin(p => p.slice(0, -1))}
              style={{ padding: "18px 0", borderRadius: 10, fontSize: 18, border: `1px solid ${BORDER}`, background: "#1a0a0a", color: "#f87171", cursor: "pointer" }}>⌫</button>
          </div>
        </div>
      </div>
    </div>
  );

  /* ── STEP 11: Confirmación ───────────────────────────────── */
  if (step === 11) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif" }}>
      <Header />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 40, maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <p style={{ color: TEXT, fontSize: 24, fontWeight: 800, marginBottom: 8 }}>¡Solicitud enviada!</p>
          <p style={{ color: MUTED, fontSize: 15, marginBottom: 8 }}>Su solicitud fue registrada correctamente.</p>
          <p style={{ color: "#93c5fd", fontSize: 14, marginBottom: 32 }}>Número de seguimiento: <strong style={{ color: TEXT }}>#2024-0041</strong></p>
          <div style={{ background: "#071020", borderRadius: 10, padding: 16, textAlign: "left", marginBottom: 28 }}>
            <p style={{ color: MUTED, fontSize: 12, marginBottom: 4 }}>Próximos pasos:</p>
            <p style={{ color: TEXT, fontSize: 13, lineHeight: 1.6 }}>RRHH revisará su solicitud en los próximos días hábiles.<br/>Si aplica, será contactado al número: <strong>{form.tel_movil || "—"}</strong></p>
          </div>
          <button onClick={() => { setStep(0); setPin(""); setForm(f => ({ ...f, nombre: "" })); }}
            style={{ padding: "14px 40px", borderRadius: 10, fontSize: 16, fontWeight: 700, background: BLUE, color: "#fff", border: "none", cursor: "pointer" }}>
            Nueva Solicitud
          </button>
        </div>
      </div>
    </div>
  );

  /* ── Main layout for steps 1–10 ─────────────────────────── */
  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif" }}>
      <Header />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "16px 16px 0" }}>
        <div style={{ width: "100%", maxWidth: 700, marginBottom: 14 }}>
          <StepDots step={step} />
          <p style={{ color: MUTED, fontSize: 12, textAlign: "center", marginTop: 6 }}>
            Paso {step} de 10 — {STEPS[step]}
          </p>
        </div>

        {/* PASO 1 — Datos personales */}
        {step === 1 && (
          <StepCard title="Datos Personales" icon="👤" onNext={next} disableNext={!form.nombre || !form.cui || !form.tel_movil}>
            <Grid cols={1}>
              <F label="Plaza a la que aplica *">
                <ISPSelect value={form.plaza} onChange={u("plaza")} options={PUESTOS} placeholder="Seleccione el puesto..." />
              </F>
            </Grid>
            <Grid>
              <F label="Nombre completo *" col2>
                <ISPInput value={form.nombre} onChange={uEv("nombre")} placeholder="Apellidos y nombres completos" />
              </F>
              <F label="Profesión u oficio">
                <ISPInput value={form.profesion} onChange={uEv("profesion")} placeholder="Ej. Bachiller, Perito Contador..." />
              </F>
              <F label="Fecha de nacimiento">
                <ISPInput type="date" value={form.fecha_nac} onChange={uEv("fecha_nac")} />
              </F>
              <F label="CUI / DPI *">
                <ISPInput value={form.cui} onChange={uEv("cui")} placeholder="3456789012345" maxLength={15} />
              </F>
              <F label="Afiliación IGSS">
                <ISPInput value={form.igss} onChange={uEv("igss")} placeholder="Número de afiliación" />
              </F>
              <F label="NIT">
                <ISPInput value={form.nit} onChange={uEv("nit")} placeholder="1234567-8 ó CF" />
              </F>
              <F label="Teléfono móvil *">
                <ISPInput value={form.tel_movil} onChange={uEv("tel_movil")} type="tel" placeholder="4567-8901" />
              </F>
              <F label="Teléfono fijo">
                <ISPInput value={form.tel_fijo} onChange={uEv("tel_fijo")} type="tel" placeholder="2345-6789" />
              </F>
              <F label="Correo electrónico" col2>
                <ISPInput value={form.correo} onChange={uEv("correo")} type="email" placeholder="correo@ejemplo.com" />
              </F>
              <F label="Estado civil">
                <ISPSelect value={form.estado_civil} onChange={u("estado_civil")} options={["Soltero/a","Casado/a","Unido/a","Divorciado/a","Viudo/a"]} />
              </F>
              <F label="Nacionalidad">
                <ISPSelect value={form.nacionalidad} onChange={u("nacionalidad")} options={["Guatemalteca","Hondureña","Salvadoreña","Nicaragüense","Costarricense","Otra"]} />
              </F>
            </Grid>
          </StepCard>
        )}

        {/* PASO 2 — Domicilio y bancario */}
        {step === 2 && (
          <StepCard title="Domicilio y Datos Bancarios" icon="🏠" onBack={back} onNext={next}>
            <SectionTitle>Lugar de residencia</SectionTitle>
            <Grid cols={1}>
              <F label="Lugar de nacimiento">
                <ISPInput value={form.lugar_nac} onChange={uEv("lugar_nac")} placeholder="Ciudad, municipio, depto." />
              </F>
              <F label="Dirección actual completa">
                <ISPInput value={form.direccion} onChange={uEv("direccion")} placeholder="Calle, número, zona, colonia..." />
              </F>
            </Grid>
            <Grid>
              <F label="Municipio">
                <ISPInput value={form.municipio} onChange={uEv("municipio")} placeholder="Ej. Guatemala" />
              </F>
              <F label="Departamento">
                <ISPSelect value={form.departamento} onChange={u("departamento")} options={DEPTOS} />
              </F>
              <F label="Tiempo en domicilio actual">
                <ISPSelect value={form.tiempo_residencia} onChange={u("tiempo_residencia")} options={["Menos de 1 año","1 a 3 años","3 a 5 años","Más de 5 años"]} />
              </F>
              <F label="Casa">
                <ISPSelect value={form.tipo_casa} onChange={u("tipo_casa")} options={["Propia","Alquilada","Familiar / prestada"]} />
              </F>
              {form.tipo_casa === "Alquilada" && (
                <F label="Renta mensual (Q)">
                  <ISPInput value={form.renta_mensual} onChange={uEv("renta_mensual")} type="number" placeholder="0.00" />
                </F>
              )}
            </Grid>

            <SectionTitle>Cuenta bancaria</SectionTitle>
            <Grid>
              <F label="Banco">
                <ISPSelect value={form.banco} onChange={u("banco")} options={BANCOS} />
              </F>
              <F label="Tipo de cuenta">
                <ISPSelect value={form.tipo_cuenta} onChange={u("tipo_cuenta")} options={["Monetaria","Ahorro","Préstamo"]} />
              </F>
              <F label="Número de cuenta" col2>
                <ISPInput value={form.num_cuenta} onChange={uEv("num_cuenta")} placeholder="0000 0000 0000 0000" />
              </F>
            </Grid>

            <SectionTitle>Licencia de conducir</SectionTitle>
            <SiNo value={form.tiene_licencia} onChange={u("tiene_licencia")} label="¿Posee licencia de conducir?" />
            {form.tiene_licencia === "si" && (
              <Grid>
                <F label="Tipo / Categoría">
                  <ISPSelect value={form.tipo_licencia} onChange={u("tipo_licencia")} options={["A","B","C","M","E"]} placeholder="Tipo..." />
                </F>
                <F label="Vigente hasta">
                  <ISPInput type="date" value={form.vigencia_licencia} onChange={uEv("vigencia_licencia")} />
                </F>
              </Grid>
            )}
          </StepCard>
        )}

        {/* PASO 3 — Redes y familia */}
        {step === 3 && (
          <StepCard title="Redes Sociales y Situación Familiar" icon="👨‍👩‍👧‍👦" onBack={back} onNext={next}>
            <SectionTitle>Redes sociales (opcional)</SectionTitle>
            <Grid>
              <F label="Facebook"><ISPInput value={form.facebook} onChange={uEv("facebook")} placeholder="facebook.com/usuario" /></F>
              <F label="Instagram"><ISPInput value={form.instagram} onChange={uEv("instagram")} placeholder="@usuario" /></F>
              <F label="TikTok"><ISPInput value={form.tiktok} onChange={uEv("tiktok")} placeholder="@usuario" /></F>
              <F label="Twitter / X"><ISPInput value={form.twitter} onChange={uEv("twitter")} placeholder="@usuario" /></F>
            </Grid>

            <SectionTitle>Padres</SectionTitle>
            <Grid>
              <F label="Nombre del padre"><ISPInput value={form.padre_nombre} onChange={uEv("padre_nombre")} placeholder="Nombre completo" /></F>
              <F label="Edad"><ISPInput value={form.padre_edad} onChange={uEv("padre_edad")} type="number" placeholder="—" /></F>
              <F label="Ocupación"><ISPInput value={form.padre_ocupacion} onChange={uEv("padre_ocupacion")} placeholder="Ocupación" /></F>
              <F label="Teléfono"><ISPInput value={form.padre_tel} onChange={uEv("padre_tel")} type="tel" placeholder="—" /></F>
              <F label="Nombre de la madre"><ISPInput value={form.madre_nombre} onChange={uEv("madre_nombre")} placeholder="Nombre completo" /></F>
              <F label="Edad"><ISPInput value={form.madre_edad} onChange={uEv("madre_edad")} type="number" placeholder="—" /></F>
              <F label="Ocupación"><ISPInput value={form.madre_ocupacion} onChange={uEv("madre_ocupacion")} placeholder="Ocupación" /></F>
              <F label="Teléfono"><ISPInput value={form.madre_tel} onChange={uEv("madre_tel")} type="tel" placeholder="—" /></F>
            </Grid>

            <SectionTitle>Cónyuge</SectionTitle>
            <Grid>
              <F label="Nombre" col2><ISPInput value={form.conyuge_nombre} onChange={uEv("conyuge_nombre")} placeholder="Nombre completo (si aplica)" /></F>
              <F label="Edad"><ISPInput value={form.conyuge_edad} onChange={uEv("conyuge_edad")} type="number" placeholder="—" /></F>
              <F label="Ocupación"><ISPInput value={form.conyuge_ocupacion} onChange={uEv("conyuge_ocupacion")} placeholder="—" /></F>
              <F label="Empresa actual"><ISPInput value={form.conyuge_empresa} onChange={uEv("conyuge_empresa")} placeholder="—" /></F>
              <F label="Teléfono"><ISPInput value={form.conyuge_tel} onChange={uEv("conyuge_tel")} type="tel" placeholder="—" /></F>
            </Grid>

            <SectionTitle>Hijos y hermanos</SectionTitle>
            <Grid>
              <F label="Número de hijos">
                <ISPSelect value={form.num_hijos} onChange={u("num_hijos")} options={["0","1","2","3","4","5","6 o más"]} />
              </F>
            </Grid>
            <div style={{ marginTop: 4 }}>
              <Lbl>Hermano 1</Lbl>
              <Grid><F label="Nombre"><ISPInput value={form.herm1_nombre} onChange={uEv("herm1_nombre")} placeholder="—" /></F><F label="Teléfono"><ISPInput value={form.herm1_tel} onChange={uEv("herm1_tel")} type="tel" placeholder="—" /></F></Grid>
            </div>
            <div>
              <Lbl>Hermano 2</Lbl>
              <Grid><F label="Nombre"><ISPInput value={form.herm2_nombre} onChange={uEv("herm2_nombre")} placeholder="—" /></F><F label="Teléfono"><ISPInput value={form.herm2_tel} onChange={uEv("herm2_tel")} type="tel" placeholder="—" /></F></Grid>
            </div>
          </StepCard>
        )}

        {/* PASO 4 — Salud */}
        {step === 4 && (
          <StepCard title="Información Física y Salud" icon="🩺" onBack={back} onNext={next}>
            <Grid>
              <F label="Estatura (m)"><ISPInput value={form.estatura} onChange={uEv("estatura")} placeholder="1.75" /></F>
              <F label="Peso (kg)"><ISPInput value={form.peso} onChange={uEv("peso")} type="number" placeholder="75" /></F>
            </Grid>

            <SiNo value={form.enfermedad_cronica} onChange={u("enfermedad_cronica")} label="¿Posee alguna enfermedad crónica?" />
            {form.enfermedad_cronica === "si" && <F label="Especifique"><ISPInput value={form.enfermedad_detalle} onChange={uEv("enfermedad_detalle")} placeholder="Describa la condición..." /></F>}

            <SiNo value={form.medicamento} onChange={u("medicamento")} label="¿Consume algún medicamento?" />
            {form.medicamento === "si" && <F label="Detalle"><ISPInput value={form.medicamento_detalle} onChange={uEv("medicamento_detalle")} placeholder="Nombre del medicamento..." /></F>}

            <SiNo value={form.impedimento} onChange={u("impedimento")} label="¿Padece algún impedimento físico?" />
            {form.impedimento === "si" && <F label="Especifique"><ISPInput value={form.impedimento_detalle} onChange={uEv("impedimento_detalle")} placeholder="Describa..." /></F>}

            <Grid>
              <SiNo value={form.alcohol} onChange={u("alcohol")} label="¿Ingiere bebidas alcohólicas?" />
              <SiNo value={form.drogas} onChange={u("drogas")} label="¿Ha consumido drogas alguna vez?" />
            </Grid>
            {form.drogas === "si" && <F label="Especifique"><ISPInput value={form.drogas_detalle} onChange={uEv("drogas_detalle")} placeholder="..." /></F>}

            <SiNo value={form.tatuajes} onChange={u("tatuajes")} label="¿Tiene tatuajes?" />
            {form.tatuajes === "si" && <F label="¿Cuál es el significado?"><ISPTextarea value={form.tatuajes_detalle} onChange={uEv("tatuajes_detalle")} rows={2} placeholder="Describa el significado de sus tatuajes..." /></F>}

            <SectionTitle>Contacto de emergencia</SectionTitle>
            <Grid>
              <F label="Nombre"><ISPInput value={form.emergencia_nombre} onChange={uEv("emergencia_nombre")} placeholder="Nombre completo" /></F>
              <F label="Teléfono"><ISPInput value={form.emergencia_tel} onChange={uEv("emergencia_tel")} type="tel" placeholder="5555-1234" /></F>
              <F label="Parentesco" col2>
                <ISPSelect value={form.emergencia_parentesco} onChange={u("emergencia_parentesco")} options={["Madre","Padre","Cónyuge/Pareja","Hermano/a","Hijo/a","Otro"]} />
              </F>
            </Grid>
          </StepCard>
        )}

        {/* PASO 5 — Antecedentes */}
        {step === 5 && (
          <StepCard title="Antecedentes Legales y Situación Financiera" icon="⚖️" onBack={back} onNext={next}>
            <SectionTitle>Antecedentes legales y judiciales</SectionTitle>
            <SiNo value={form.proceso_judicial} onChange={u("proceso_judicial")} label="¿Tiene procesos judiciales en curso?" />
            {form.proceso_judicial === "si" && <F label="Indique el motivo"><ISPTextarea value={form.proceso_detalle} onChange={uEv("proceso_detalle")} rows={2} placeholder="Describa el proceso..." /></F>}

            <SiNo value={form.detenido} onChange={u("detenido")} label="¿Ha sido detenido anteriormente?" />
            {form.detenido === "si" && <F label="Indique el motivo"><ISPTextarea value={form.detencion_detalle} onChange={uEv("detencion_detalle")} rows={2} placeholder="Describa el motivo..." /></F>}

            <SectionTitle>Situación financiera</SectionTitle>
            <SiNo value={form.deudas} onChange={u("deudas")} label="¿Tiene deudas pendientes?" />
            {form.deudas === "si" && (
              <F label="Estado de la deuda">
                <ISPSelect value={form.estado_deuda} onChange={u("estado_deuda")} options={["Al día","Con atraso"]} />
              </F>
            )}

            <Grid>
              <F label="Gastos mensuales aprox. (Q)">
                <ISPInput value={form.gastos_mensuales} onChange={uEv("gastos_mensuales")} type="number" placeholder="0.00" />
              </F>
            </Grid>

            <SiNo value={form.inversiones} onChange={u("inversiones")} label="¿Tiene algún tipo de inversiones?" />
            <SiNo value={form.prestamo} onChange={u("prestamo")} label="¿Tiene préstamo con personas o entidades bancarias?" />
            {form.prestamo === "si" && (
              <F label="Monto del préstamo (Q)">
                <ISPInput value={form.prestamo_monto} onChange={uEv("prestamo_monto")} type="number" placeholder="0.00" />
              </F>
            )}
          </StepCard>
        )}

        {/* PASO 6 — Formación académica */}
        {step === 6 && (
          <StepCard title="Formación Académica" icon="🎓" onBack={back} onNext={next}>
            {[
              { nivel: "Primaria", k: "prim" },
              { nivel: "Básico", k: "bas" },
              { nivel: "Diversificado", k: "div" },
              { nivel: "Universidad (si aplica)", k: "uni" },
            ].map(({ nivel, k }) => (
              <div key={k}>
                <SectionTitle>{nivel}</SectionTitle>
                <Grid>
                  <F label="Establecimiento">
                    <ISPInput value={(form as Record<string, string>)[`${k}_establecimiento`]} onChange={uEv(`${k}_establecimiento` as keyof typeof form)} placeholder="Nombre del establecimiento" />
                  </F>
                  <F label="Lugar">
                    <ISPInput value={(form as Record<string, string>)[`${k}_lugar`]} onChange={uEv(`${k}_lugar` as keyof typeof form)} placeholder="Ciudad / municipio" />
                  </F>
                  <F label="Título obtenido" col2>
                    <ISPInput value={(form as Record<string, string>)[`${k}_titulo`]} onChange={uEv(`${k}_titulo` as keyof typeof form)} placeholder="Ej. Bachiller en Ciencias y Letras" />
                  </F>
                </Grid>
              </div>
            ))}
          </StepCard>
        )}

        {/* PASO 7 — Experiencia laboral */}
        {step === 7 && (
          <StepCard title="Experiencia Laboral" icon="💼" onBack={back} onNext={next}>
            {[1,2,3].map(n => (
              <div key={n}>
                <SectionTitle>Empresa {n} {n > 1 ? "(si aplica)" : "*"}</SectionTitle>
                <Grid>
                  <F label="Nombre de la empresa" col2>
                    <ISPInput value={(form as Record<string,string>)[`emp${n}_nombre`]} onChange={uEv(`emp${n}_nombre` as keyof typeof form)} placeholder={n === 1 ? "Empresa más reciente" : "—"} />
                  </F>
                  <F label="Puesto">
                    <ISPInput value={(form as Record<string,string>)[`emp${n}_puesto`]} onChange={uEv(`emp${n}_puesto` as keyof typeof form)} placeholder="Cargo desempeñado" />
                  </F>
                  <F label="Salario devengado (Q)">
                    <ISPInput value={(form as Record<string,string>)[`emp${n}_salario`]} onChange={uEv(`emp${n}_salario` as keyof typeof form)} type="number" placeholder="0.00" />
                  </F>
                  <F label="Fecha inicio">
                    <ISPInput type="month" value={(form as Record<string,string>)[`emp${n}_inicio`]} onChange={uEv(`emp${n}_inicio` as keyof typeof form)} />
                  </F>
                  <F label="Fecha fin">
                    <ISPInput type="month" value={(form as Record<string,string>)[`emp${n}_fin`]} onChange={uEv(`emp${n}_fin` as keyof typeof form)} />
                  </F>
                  <F label="Motivo de retiro" col2>
                    <ISPSelect value={(form as Record<string,string>)[`emp${n}_motivo`]} onChange={u(`emp${n}_motivo` as keyof typeof form)} options={["Finalización de contrato","Renuncia voluntaria","Mejor oferta laboral","Cierre de empresa","Motivos personales","Otro"]} />
                  </F>
                </Grid>
              </div>
            ))}
          </StepCard>
        )}

        {/* PASO 8 — Experiencia seguridad + habilidades + disponibilidad */}
        {step === 8 && (
          <StepCard title="Experiencia en Seguridad y Habilidades" icon="🛡️" onBack={back} onNext={next}>
            <SiNo value={form.exp_seguridad} onChange={u("exp_seguridad")} label="¿Ha trabajado como agente de seguridad?" />
            {form.exp_seguridad === "si" && (
              <>
                <div>
                  <Lbl>Tipo de experiencia en seguridad (puede marcar varios)</Lbl>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                    {["Seguridad privada","Seguridad bancaria","Custodia armada","Transporte de valores"].map(t => (
                      <CheckPill key={t} label={t} checked={form.tipos_seguridad.includes(t)} onChange={() => toggleArr("tipos_seguridad", t)} />
                    ))}
                  </div>
                </div>
                <F label="Tiempo total de experiencia">
                  <ISPSelect value={form.tiempo_seguridad} onChange={u("tiempo_seguridad")} options={["Menos de 1 año","1 a 2 años","2 a 5 años","5 a 10 años","Más de 10 años"]} />
                </F>
              </>
            )}

            <SectionTitle>Información Militar / Policial</SectionTitle>
            <SiNo value={form.servicio_militar} onChange={u("servicio_militar")} label="¿Prestó servicio militar?" />
            {form.servicio_militar === "si" && (
              <Grid>
                <F label="Rango alcanzado"><ISPInput value={form.rango} onChange={uEv("rango")} placeholder="Ej. Cabo, Sargento..." /></F>
                <F label="Unidad"><ISPInput value={form.unidad} onChange={uEv("unidad")} placeholder="Unidad militar" /></F>
                <F label="Tiempo de servicio" col2><ISPSelect value={form.tiempo_militar} onChange={u("tiempo_militar")} options={["Menos de 1 año","1 año","2 años","Más de 2 años"]} /></F>
              </Grid>
            )}
            <SiNo value={form.fue_policia} onChange={u("fue_policia")} label="¿Perteneció a fuerzas policiales o armadas?" />
            {form.fue_policia === "si" && <F label="Motivo de baja"><ISPInput value={form.motivo_baja} onChange={uEv("motivo_baja")} placeholder="Motivo de baja..." /></F>}

            <SectionTitle>Competencias y habilidades</SectionTitle>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["Manejo de armas","Defensa personal","Control de accesos","Manejo de radio","Trabajo bajo presión","Resolución de conflictos"].map(h => (
                <CheckPill key={h} label={h} checked={form.habilidades.includes(h)} onChange={() => toggleArr("habilidades", h)} />
              ))}
            </div>

            <SectionTitle>Disponibilidad</SectionTitle>
            <Grid>
              <SiNo value={form.disp_rotativo} onChange={u("disp_rotativo")} label="Turnos rotativos" />
              <SiNo value={form.disp_nocturno} onChange={u("disp_nocturno")} label="Turno nocturno" />
              <SiNo value={form.disp_fds} onChange={u("disp_fds")} label="Fines de semana" />
              <SiNo value={form.tiene_vehiculo} onChange={u("tiene_vehiculo")} label="¿Tiene vehículo propio?" />
            </Grid>
          </StepCard>
        )}

        {/* PASO 9 — Referencias */}
        {step === 9 && (
          <StepCard title="Referencias Personales" icon="📋" onBack={back} onNext={next}>
            <p style={{ color: MUTED, fontSize: 13, marginBottom: 8 }}>Proporcione 3 referencias personales que no sean familiares directos.</p>
            {[1,2,3].map(n => (
              <div key={n}>
                <SectionTitle>Referencia {n}</SectionTitle>
                <Grid>
                  <F label="Nombre completo" col2>
                    <ISPInput value={(form as Record<string,string>)[`ref${n}_nombre`]} onChange={uEv(`ref${n}_nombre` as keyof typeof form)} placeholder="Nombre completo" />
                  </F>
                  <F label="Ocupación">
                    <ISPInput value={(form as Record<string,string>)[`ref${n}_ocupacion`]} onChange={uEv(`ref${n}_ocupacion` as keyof typeof form)} placeholder="Ej. Comerciante, Docente..." />
                  </F>
                  <F label="Teléfono">
                    <ISPInput value={(form as Record<string,string>)[`ref${n}_tel`]} onChange={uEv(`ref${n}_tel` as keyof typeof form)} type="tel" placeholder="5555-1234" />
                  </F>
                </Grid>
              </div>
            ))}
            <div style={{ background: "#071020", borderRadius: 10, padding: 14, border: `1px solid ${BORDER}`, marginTop: 4 }}>
              <p style={{ color: MUTED, fontSize: 12, lineHeight: 1.6 }}>
                <strong style={{ color: TEXT }}>Declaración:</strong> Declaro que la información proporcionada es verdadera y autorizo a ISP, S.A. a verificar los datos suministrados. Me comprometo a seguir las normas establecidas por el reglamento interno de trabajo.
              </p>
            </div>
          </StepCard>
        )}

        {/* PASO 10 — Foto */}
        {step === 10 && (
          <StepCard title="Fotografía" icon="📷" onBack={back} onNext={next} nextLabel="Enviar Solicitud ✓">
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ width: 180, height: 180, borderRadius: "50%", background: "#071020", border: `3px dashed ${BORDER}`, margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 48 }}>📷</span>
                <span style={{ color: MUTED, fontSize: 12 }}>Sin foto</span>
              </div>
              <button style={{ padding: "14px 32px", borderRadius: 10, fontSize: 15, fontWeight: 700, background: BLUE, color: "#fff", border: "none", cursor: "pointer", display: "block", margin: "0 auto 10px" }}>
                Tomar Fotografía
              </button>
              <p style={{ color: MUTED, fontSize: 12 }}>Use la cámara del dispositivo para tomar su fotografía.<br/>La foto es opcional pero recomendada.</p>
            </div>
          </StepCard>
        )}
      </div>
      <div style={{ height: 20 }} />
    </div>
  );
}

function Header() {
  return (
    <div style={{ background: "#0a1e42", borderBottom: `1px solid ${BORDER}`, padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: "#1e3a6e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛡️</div>
      <div>
        <p style={{ color: TEXT, fontSize: 14, fontWeight: 700, margin: 0 }}>ISP, S.A. — Kiosco de Solicitud</p>
        <p style={{ color: MUTED, fontSize: 11, margin: 0 }}>Investigaciones y Seguridad Profesional</p>
      </div>
      <div style={{ marginLeft: "auto", color: MUTED, fontSize: 11 }}>
        {new Date().toLocaleDateString("es-GT")}
      </div>
    </div>
  );
}
