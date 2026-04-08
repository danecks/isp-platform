// Opción B: "Moderno" — Bicolor blanco/navy, doble cara
const W = 158;
const H = 250;

const agente = {
  nombre: "ROBERTO ALEJANDRO MONTERROSO FUENTES",
  cargo: "GUARDIA DE SEGURIDAD",
  dpi: "2841 76321 1401",
  numero: "0142",
  initials: "RM",
};

function FrenteModerno() {
  return (
    <div style={{ width: W, height: H, borderRadius: 7, overflow: "hidden", display: "flex", flexDirection: "row", fontFamily: "'Inter', -apple-system, sans-serif", background: "#ffffff", boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.08)" }}>
      {/* FRANJA IZQUIERDA NAVY */}
      <div style={{ width: 28, background: "linear-gradient(180deg,#0f2044 0%,#132a5a 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "8px 0", flexShrink: 0, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2.5, background: "#f5c842" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2.5, background: "#f5c842" }} />

        {/* Logo en franja */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <img src="/logo-isp.png" alt="ISP" style={{ width: 24, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
        </div>

        {/* Número empleado */}
        <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 5, color: "rgba(255,255,255,0.4)", fontFamily: "'Courier New', monospace", fontWeight: 700, letterSpacing: "0.1em" }}>
          #{agente.numero}
        </div>
      </div>

      {/* CONTENIDO DERECHO */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ background: "#fff", padding: "9px 8px 6px", borderBottom: "1px solid #f1f5f9", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* Avatar */}
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#0f2044,#1e4a9a)", border: "2px solid #f5c842", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 5, boxShadow: "0 3px 10px rgba(15,32,68,0.22)" }}>
            <span style={{ color: "#f5c842", fontSize: 11, fontWeight: 900 }}>{agente.initials}</span>
          </div>
          <div style={{ fontSize: 6, fontWeight: 900, color: "#0f2044", textAlign: "center", lineHeight: 1.2, letterSpacing: "0.01em", textTransform: "uppercase", marginBottom: 2 }}>{agente.nombre}</div>
          <div style={{ fontSize: 4.5, fontWeight: 700, color: "#b8860b", textAlign: "center", letterSpacing: "0.1em", textTransform: "uppercase" }}>{agente.cargo}</div>
        </div>

        {/* gold accent */}
        <div style={{ height: 1.5, background: "linear-gradient(90deg,#d4a017,#f5c842,#e8b820)" }} />

        {/* datos */}
        <div style={{ padding: "6px 8px", flex: 1 }}>
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 4, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 1 }}>DPI</div>
            <div style={{ fontSize: 6.5, color: "#0f2044", fontWeight: 800, fontFamily: "'Courier New', monospace", letterSpacing: "0.03em" }}>{agente.dpi}</div>
          </div>

          <div style={{ height: 0.8, background: "#f1f5f9", marginBottom: 6 }} />

          {/* QR + texto */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 5 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 4, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>Verificación</div>
              <div style={{ fontSize: 4.5, color: "#64748b", lineHeight: 1.4 }}>Escanea el QR para verificar identidad en tiempo real</div>
            </div>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 3, padding: 2, flexShrink: 0 }}>
              <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" fill="white"/>
                <rect x="2" y="2" width="16" height="16" rx="1" fill="none" stroke="#0f2044" strokeWidth="1.8"/>
                <rect x="5" y="5" width="9" height="9" fill="#0f2044"/>
                <rect x="30" y="2" width="16" height="16" rx="1" fill="none" stroke="#0f2044" strokeWidth="1.8"/>
                <rect x="33" y="5" width="9" height="9" fill="#0f2044"/>
                <rect x="2" y="30" width="16" height="16" rx="1" fill="none" stroke="#0f2044" strokeWidth="1.8"/>
                <rect x="5" y="33" width="9" height="9" fill="#0f2044"/>
                <rect x="20" y="2" width="3" height="3" fill="#0f2044"/><rect x="24" y="5" width="3" height="3" fill="#0f2044"/>
                <rect x="20" y="20" width="3" height="3" fill="#0f2044"/><rect x="25" y="20" width="3" height="3" fill="#0f2044"/>
                <rect x="30" y="20" width="3" height="3" fill="#0f2044"/><rect x="35" y="22" width="3" height="3" fill="#0f2044"/>
                <rect x="30" y="30" width="3" height="3" fill="#0f2044"/><rect x="41" y="30" width="3" height="3" fill="#0f2044"/>
                <rect x="36" y="35" width="3" height="3" fill="#0f2044"/><rect x="41" y="41" width="3" height="3" fill="#0f2044"/>
              </svg>
            </div>
          </div>
        </div>

        {/* FOOTER navy */}
        <div style={{ background: "#0f2044", padding: "3.5px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontSize: 4, color: "rgba(255,255,255,0.35)", letterSpacing: "0.05em" }}>ABRIL 2026</div>
          <div style={{ fontSize: 4, fontWeight: 800, color: "#f5c842", letterSpacing: "0.08em" }}>CARNET DE IDENTIFICACIÓN</div>
        </div>
      </div>
    </div>
  );
}

function ReversoModerno() {
  return (
    <div style={{ width: W, height: H, borderRadius: 7, overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "'Inter', -apple-system, sans-serif", background: "#ffffff", boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.08)" }}>
      {/* TOP blanco con logo en colores reales */}
      <div style={{ background: "#ffffff", padding: "12px 14px 8px", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, borderBottom: "none" }}>
        <img src="/logo-isp.png" alt="ISP" style={{ height: 60, objectFit: "contain", marginBottom: 4 }} />
        <div style={{ fontSize: 4.5, color: "#0f2044", letterSpacing: "0.1em", fontWeight: 700, textAlign: "center" }}>INVESTIGACIONES Y SEGURIDAD PROFESIONAL S.A.</div>
      </div>

      {/* gold line */}
      <div style={{ height: 2.5, background: "linear-gradient(90deg,#d4a017,#f5c842,#d4a017)", flexShrink: 0 }} />

      {/* CUERPO legal */}
      <div style={{ flex: 1, background: "#ffffff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "12px 14px" }}>
        <div style={{ fontSize: 6.5, color: "#1e3a5f", textAlign: "center", lineHeight: 1.6, letterSpacing: "0.01em" }}>
          El presente acredita como colaborador de{" "}
          <span style={{ fontWeight: 800, color: "#0f2044" }}>ISP S.A.</span>{" "}
          Se solicita a las Autoridades{" "}
          <span style={{ fontWeight: 700 }}>Civiles y Militares</span>{" "}
          la colaboración en caso de ser requerida. Válido en el cumplimiento de sus funciones en el puesto.
        </div>
      </div>

      {/* gold divider */}
      <div style={{ height: 1, background: "linear-gradient(90deg,transparent,#f5c84270,#f5c842,#f5c84270,transparent)", margin: "0 14px", flexShrink: 0 }} />

      {/* FOOTER con web */}
      <div style={{ background: "#ffffff", padding: "8px 14px 10px", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ fontSize: 8, fontWeight: 900, color: "#0f2044", letterSpacing: "0.06em" }}>www.ispsa.net</div>
        <div style={{ fontSize: 5, color: "#94a3b8", letterSpacing: "0.04em", marginTop: 1.5 }}>contacto@isp-guatemala.com</div>
      </div>

      {/* bottom navy banda */}
      <div style={{ background: "#0f2044", height: 5, flexShrink: 0 }} />
    </div>
  );
}

export function Moderno() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#eef0f3]">
      <div className="flex flex-col items-center gap-5">
        <p className="text-slate-500 text-xs uppercase tracking-widest font-semibold">Opción B · Moderno</p>

        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase" }}>Frente</span>
            <FrenteModerno />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase" }}>Reverso</span>
            <ReversoModerno />
          </div>
        </div>

        <p className="text-slate-400/50 text-[9px]">CR-80 · 53.98 × 85.6 mm · Portrait</p>
      </div>
    </div>
  );
}
