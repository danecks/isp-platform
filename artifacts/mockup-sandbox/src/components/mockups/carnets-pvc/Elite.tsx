// Opción A: "Elite" — Carnet oscuro premium, doble cara
const W = 158;
const H = 250;

const agente = {
  nombre: "ROBERTO ALEJANDRO MONTERROSO FUENTES",
  cargo: "GUARDIA DE SEGURIDAD",
  dpi: "2841 76321 1401",
  numero: "0142",
  initials: "RM",
};

function FrenteElite() {
  return (
    <div style={{ width: W, height: H, borderRadius: 7, overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "'Inter', -apple-system, sans-serif", boxShadow: "0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(245,200,66,0.2)" }}>
      {/* HEADER navy */}
      <div style={{ background: "linear-gradient(160deg,#0a1628 0%,#0e2148 60%,#091630 100%)", padding: "10px 10px 7px", position: "relative", overflow: "hidden", flexShrink: 0 }}>
        {/* arc pattern */}
        <svg style={{ position: "absolute", inset: 0, opacity: 0.06 }} width={W} height={82} viewBox={`0 0 ${W} 82`}>
          {[16,32,48,64,80,96].map(r => <circle key={r} cx={W / 2} cy={8} r={r} fill="none" stroke="#f5c842" strokeWidth="0.6" />)}
        </svg>
        {/* top gold line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2.5, background: "linear-gradient(90deg,transparent,#f5c842 20%,#f5c842 80%,transparent)" }} />

        {/* Logo real ISP */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 1 }}>
          <img src="/logo-isp.png" alt="ISP" style={{ height: 30, objectFit: "contain", filter: "brightness(0) invert(1) sepia(1) saturate(3) hue-rotate(10deg) brightness(1.1)", marginBottom: 4 }} />
          <div style={{ fontSize: 5, color: "rgba(245,200,66,0.75)", letterSpacing: "0.1em", fontWeight: 700, textAlign: "center" }}>INVESTIGACIONES Y SEGURIDAD PROFESIONAL S.A.</div>
          {/* Badge */}
          <div style={{ marginTop: 6, background: "linear-gradient(135deg,#d4a017,#f5c842,#d4a017)", borderRadius: 2, padding: "1.5px 8px", fontSize: 4.5, fontWeight: 900, color: "#0a1628", letterSpacing: "0.12em" }}>CARNET DE IDENTIFICACIÓN</div>
        </div>
      </div>

      {/* gold divider */}
      <div style={{ height: 1.5, background: "linear-gradient(90deg,#d4a017,#f5c842,#d4a017)", flexShrink: 0 }} />

      {/* CUERPO blanco */}
      <div style={{ background: "#fff", flex: 1, display: "flex", flexDirection: "column", padding: "7px 9px 6px" }}>
        {/* Avatar */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 5 }}>
          <div style={{ width: 33, height: 33, borderRadius: "50%", background: "linear-gradient(135deg,#0e2148,#1a3a6e)", border: "1.8px solid #f5c842", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 8px rgba(245,200,66,0.25)" }}>
            <span style={{ color: "#f5c842", fontSize: 12, fontWeight: 900 }}>{agente.initials}</span>
          </div>
        </div>

        {/* Nombre */}
        <div style={{ fontSize: 6.5, fontWeight: 900, color: "#0a1628", textAlign: "center", lineHeight: 1.2, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.01em" }}>{agente.nombre}</div>
        {/* Cargo */}
        <div style={{ fontSize: 5, fontWeight: 700, color: "#b8860b", textAlign: "center", letterSpacing: "0.1em", marginBottom: 6 }}>{agente.cargo}</div>

        {/* gold rule */}
        <div style={{ height: 0.8, background: "linear-gradient(90deg,transparent,#f5c84250,#f5c842,#f5c84250,transparent)", marginBottom: 5 }} />

        {/* Datos */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 6px", marginBottom: 6 }}>
          {[{ label: "DPI", value: agente.dpi }, { label: "No. EMPLEADO", value: `#${agente.numero}` }].map(d => (
            <div key={d.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 4, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 1 }}>{d.label}</div>
              <div style={{ fontSize: 6, color: "#0a1628", fontWeight: 800, fontFamily: "'Courier New', monospace" }}>{d.value}</div>
            </div>
          ))}
        </div>

        {/* gold rule */}
        <div style={{ height: 0.8, background: "linear-gradient(90deg,transparent,#f5c84250,#f5c842,#f5c84250,transparent)", marginBottom: 5 }} />

        {/* QR */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 3, padding: 2 }}>
            <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" fill="white"/>
              <rect x="2" y="2" width="16" height="16" rx="1" fill="none" stroke="#0a1628" strokeWidth="1.8"/>
              <rect x="5" y="5" width="9" height="9" fill="#0a1628"/>
              <rect x="30" y="2" width="16" height="16" rx="1" fill="none" stroke="#0a1628" strokeWidth="1.8"/>
              <rect x="33" y="5" width="9" height="9" fill="#0a1628"/>
              <rect x="2" y="30" width="16" height="16" rx="1" fill="none" stroke="#0a1628" strokeWidth="1.8"/>
              <rect x="5" y="33" width="9" height="9" fill="#0a1628"/>
              <rect x="20" y="2" width="3" height="3" fill="#0a1628"/><rect x="24" y="5" width="3" height="3" fill="#0a1628"/>
              <rect x="20" y="20" width="3" height="3" fill="#0a1628"/><rect x="25" y="20" width="3" height="3" fill="#0a1628"/>
              <rect x="20" y="25" width="3" height="3" fill="#0a1628"/><rect x="30" y="20" width="3" height="3" fill="#0a1628"/>
              <rect x="35" y="22" width="3" height="3" fill="#0a1628"/><rect x="40" y="20" width="3" height="3" fill="#0a1628"/>
              <rect x="30" y="30" width="3" height="3" fill="#0a1628"/><rect x="36" y="35" width="3" height="3" fill="#0a1628"/>
              <rect x="41" y="30" width="3" height="3" fill="#0a1628"/><rect x="30" y="41" width="3" height="3" fill="#0a1628"/>
              <rect x="41" y="41" width="3" height="3" fill="#0a1628"/>
            </svg>
          </div>
          <div style={{ fontSize: 4, color: "#94a3b8", marginTop: 2, letterSpacing: "0.06em" }}>ESCANEA PARA VERIFICAR</div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ background: "linear-gradient(135deg,#0a1628,#0e2148)", padding: "3.5px 9px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: 4, color: "rgba(255,255,255,0.35)", letterSpacing: "0.05em" }}>EMITIDO: ABRIL 2026</div>
        <div style={{ fontSize: 4, color: "rgba(245,200,66,0.6)", letterSpacing: "0.06em", fontWeight: 700 }}>ispsa.net</div>
      </div>
    </div>
  );
}

function ReversoElite() {
  return (
    <div style={{ width: W, height: H, borderRadius: 7, overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "'Inter', -apple-system, sans-serif", background: "linear-gradient(160deg,#0a1628 0%,#0d1e40 60%,#091630 100%)", boxShadow: "0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(245,200,66,0.2)" }}>
      {/* top gold line */}
      <div style={{ height: 2.5, background: "linear-gradient(90deg,transparent,#f5c842 20%,#f5c842 80%,transparent)", flexShrink: 0 }} />

      {/* SVG arc pattern background */}
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
        <svg style={{ position: "absolute", inset: 0, opacity: 0.05, width: "100%", height: "100%" }} viewBox={`0 0 ${W} ${H}`}>
          {[24,48,72,96,120].map(r => <circle key={r} cx={W / 2} cy={H} r={r} fill="none" stroke="#f5c842" strokeWidth="0.7" />)}
        </svg>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "14px 14px 10px", position: "relative", zIndex: 1 }}>
          {/* Logo */}
          <img src="/logo-isp.png" alt="ISP" style={{ height: 34, objectFit: "contain", filter: "brightness(0) invert(1) sepia(1) saturate(3) hue-rotate(10deg) brightness(1.1)", marginBottom: 10 }} />

          {/* Gold rule */}
          <div style={{ height: 0.8, width: "70%", background: "linear-gradient(90deg,transparent,#f5c842,transparent)", marginBottom: 12 }} />

          {/* Legal text */}
          <div style={{ fontSize: 6.2, color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 1.55, letterSpacing: "0.015em", marginBottom: 12 }}>
            El presente acredita como colaborador de{" "}
            <span style={{ color: "#f5c842", fontWeight: 700 }}>ISP S.A.</span>{" "}
            Se solicita a las Autoridades Civiles y Militares la colaboración en caso de ser requerida. Válido en el cumplimiento de sus funciones en el puesto.
          </div>

          {/* Gold rule */}
          <div style={{ height: 0.8, width: "70%", background: "linear-gradient(90deg,transparent,#f5c842,transparent)", marginBottom: 10 }} />

          {/* Website */}
          <div style={{ fontSize: 7, fontWeight: 800, color: "#f5c842", letterSpacing: "0.08em" }}>www.ispsa.net</div>
          <div style={{ fontSize: 5, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em", marginTop: 2 }}>contacto@isp-guatemala.com</div>
        </div>
      </div>

      {/* bottom gold line */}
      <div style={{ height: 2.5, background: "linear-gradient(90deg,transparent,#f5c842 20%,#f5c842 80%,transparent)", flexShrink: 0 }} />
    </div>
  );
}

export function Elite() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1f2e]">
      <div className="flex flex-col items-center gap-5">
        <p className="text-white/40 text-xs uppercase tracking-widest font-semibold">Opción A · Elite</p>

        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(245,200,66,0.5)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Frente</span>
            <FrenteElite />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(245,200,66,0.5)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Reverso</span>
            <ReversoElite />
          </div>
        </div>

        <p className="text-white/20 text-[9px]">CR-80 · 53.98 × 85.6 mm · Portrait</p>
      </div>
    </div>
  );
}
