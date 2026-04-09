/**
 * Variante C — "Bicolor"
 * Cabecera navy de impacto con foto/iniciales prominentes + cuerpo blanco.
 * Línea diagonal dorada como elemento de diseño. Muy corporativo.
 */
export function VarianteC() {
  const W = 220, H = 348;
  const sample = {
    nombre: "CARLOS RODRÍGUEZ",
    cargo: "GUARDIA DE SEGURIDAD",
    dpi: "2481 56789 0123",
    num: "0042",
  };

  const Frente = () => (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "Arial, sans-serif", background: "#fff", borderRadius: 6, boxShadow: "0 8px 32px rgba(0,0,0,0.35)", flexShrink: 0, position: "relative" }}>

      {/* HEADER NAVY — 45% de la tarjeta */}
      <div style={{ height: Math.round(H * 0.44), background: "linear-gradient(150deg,#08122a 0%,#0f2044 50%,#0d1a3d 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", padding: "0 14px 14px", flexShrink: 0, position: "relative", overflow: "hidden" }}>
        {/* Subtle geometric lines */}
        <div style={{ position: "absolute", top: 0, right: 0, width: "60%", height: "100%", background: "linear-gradient(150deg,transparent 40%,rgba(245,200,66,0.04) 100%)" }} />
        <div style={{ position: "absolute", top: 10, left: 10, right: 10, height: 1.5, background: "linear-gradient(90deg,rgba(245,200,66,0.4),rgba(245,200,66,0))" }} />

        {/* Company tag */}
        <div style={{ position: "absolute", top: 10, right: 12, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <span style={{ fontSize: 6.5, fontWeight: 900, color: "rgba(245,200,66,0.8)", letterSpacing: 1.5 }}>ISP, S.A.</span>
          <span style={{ fontSize: 4.5, color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>#{sample.num}</span>
        </div>

        {/* Avatar - overlapping border */}
        <div style={{ position: "relative", marginBottom: 8 }}>
          <div style={{ width: 70, height: 70, borderRadius: "50%", background: "linear-gradient(145deg,#1a3a70,#0f2044)", display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid #f5c842", boxShadow: "0 0 0 4px rgba(245,200,66,0.15), 0 6px 20px rgba(0,0,0,0.4)" }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: "#f5c842" }}>CR</span>
          </div>
        </div>

        {/* Name block */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: "#fff", textTransform: "uppercase", letterSpacing: 0.3, lineHeight: 1.2 }}>{sample.nombre}</div>
          <div style={{ fontSize: 6, fontWeight: 700, color: "rgba(245,200,66,0.8)", textTransform: "uppercase", letterSpacing: 1.2, marginTop: 4 }}>{sample.cargo}</div>
        </div>
      </div>

      {/* DIAGONAL GOLD DIVIDER */}
      <div style={{ height: 4, background: "linear-gradient(90deg,#b8860b,#f5c842,#ffd700,#f5c842,#b8860b)", flexShrink: 0 }} />

      {/* WHITE BODY */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "10px 14px 0", background: "#fff" }}>
        {/* DPI row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 8, borderBottom: "1px solid #f1f5f9" }}>
          <div>
            <div style={{ fontSize: 5, color: "#94a3b8", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>DPI</div>
            <div style={{ fontSize: 9.5, color: "#0f2044", fontWeight: 800, fontFamily: "monospace", letterSpacing: 0.5, marginTop: 1 }}>{sample.dpi}</div>
          </div>
        </div>

        {/* QR section */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
          {/* QR */}
          <div style={{ background: "#0f2044", borderRadius: 6, padding: 7, display: "inline-block", boxShadow: "0 2px 10px rgba(15,32,68,0.2)" }}>
            <div style={{ width: 52, height: 52, display: "flex", flexWrap: "wrap", gap: 1.5 }}>
              {Array.from({ length: 25 }, (_, i) => (
                <div key={i} style={{ width: 8, height: 8, background: [0,1,2,5,6,7,10,14,17,18,19,21,24].includes(i) ? "#fff" : "#0f2044", borderRadius: 1 }} />
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 5.5, color: "#94a3b8", fontWeight: 700, letterSpacing: 0.5 }}>VERIFICAR</div>
            <div style={{ fontSize: 5, color: "#cbd5e1", lineHeight: 1.5 }}>Escanea el QR<br />para verificar<br />la identidad</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: "#0f2044", padding: "5px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <span style={{ fontSize: 5, color: "rgba(255,255,255,0.3)" }}>2025</span>
        <span style={{ fontSize: 5, fontWeight: 800, color: "#f5c842", letterSpacing: 0.8, textTransform: "uppercase" }}>Carnet de Identificación</span>
      </div>
    </div>
  );

  const Reverso = () => (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "Arial, sans-serif", background: "#fff", borderRadius: 6, boxShadow: "0 8px 32px rgba(0,0,0,0.35)", flexShrink: 0 }}>
      {/* HEADER NAVY */}
      <div style={{ height: Math.round(H * 0.44), background: "linear-gradient(150deg,#08122a,#0f2044)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 20px 14px", flexShrink: 0, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: "60%", height: "100%", background: "linear-gradient(150deg,transparent 40%,rgba(245,200,66,0.04) 100%)" }} />
        <div style={{ position: "absolute", top: 10, left: 10, right: 10, height: 1, background: "linear-gradient(90deg,rgba(245,200,66,0.4),rgba(245,200,66,0))" }} />

        {/* Logo symbol */}
        <div style={{ width: 48, height: 48, borderRadius: "50%", border: "2px solid rgba(245,200,66,0.6)", background: "rgba(245,200,66,0.07)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: "#f5c842", fontFamily: "serif" }}>I</span>
        </div>
        <div style={{ fontSize: 10, fontWeight: 900, color: "#fff", letterSpacing: 0.8, textAlign: "center" }}>ISP, S.A.</div>
        <div style={{ fontSize: 5.5, color: "rgba(245,200,66,0.55)", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 3, textAlign: "center" }}>Investigaciones y Seguridad Profesional</div>
      </div>

      {/* GOLD DIVIDER */}
      <div style={{ height: 4, background: "linear-gradient(90deg,#b8860b,#f5c842,#ffd700,#f5c842,#b8860b)", flexShrink: 0 }} />

      {/* WHITE BODY */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "14px 20px 12px", background: "#fff" }}>
        <div style={{ fontSize: 8, color: "#475569", textAlign: "center", lineHeight: 1.75 }}>
          El presente acredita como colaborador de{" "}
          <strong style={{ fontWeight: 800, color: "#0f2044" }}>ISP S.A.</strong>{" "}
          Se solicita a las Autoridades{" "}
          <strong style={{ fontWeight: 800, color: "#0f2044" }}>Civiles y Militares</strong>{" "}
          su colaboración en el cumplimiento de sus funciones asignadas.
        </div>

        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#0f2044", letterSpacing: 0.5 }}>www.ispsa.net</div>
          <div style={{ fontSize: 6, color: "#94a3b8" }}>contacto@isp-guatemala.com</div>
        </div>
      </div>

      {/* Footer bar */}
      <div style={{ background: "#0f2044", height: 8, flexShrink: 0 }} />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f5c842" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#f5c842", letterSpacing: 2, textTransform: "uppercase" }}>Variante C</span>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f5c842" }} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: 0.5, marginBottom: 4 }}>Bicolor</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 20, textAlign: "center" }}>Cabecera navy con avatar prominente · Cuerpo blanco limpio · Divisor dorado de impacto</div>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: 2, textTransform: "uppercase" }}>Frente</span>
          <Frente />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: 2, textTransform: "uppercase" }}>Reverso</span>
          <Reverso />
        </div>
      </div>
    </div>
  );
}
