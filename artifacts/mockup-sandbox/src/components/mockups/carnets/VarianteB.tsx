/**
 * Variante B — "Ejecutivo"
 * Carnet completamente oscuro. Todo navy profundo con tipografía en blanco y oro.
 * Look premium de alto contraste — sin área blanca.
 */
export function VarianteB() {
  const W = 220, H = 348;
  const sample = {
    nombre: "CARLOS RODRÍGUEZ",
    cargo: "GUARDIA DE SEGURIDAD",
    dpi: "2481 56789 0123",
    num: "0042",
  };

  const Frente = () => (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "Arial, sans-serif", background: "#08122a", borderRadius: 6, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", flexShrink: 0, position: "relative" }}>
      {/* Top gold strip */}
      <div style={{ height: 3, background: "linear-gradient(90deg,#b8860b,#f5c842,#ffd700,#f5c842,#b8860b)", flexShrink: 0 }} />

      {/* Header band */}
      <div style={{ background: "linear-gradient(180deg,#0a1530 0%,#0f2044 100%)", padding: "12px 14px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 7, fontWeight: 900, color: "#f5c842", letterSpacing: 2, textTransform: "uppercase" }}>ISP, S.A.</div>
          <div style={{ fontSize: 5.5, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5 }}>SEGURIDAD PROFESIONAL</div>
        </div>
        <div style={{ fontSize: 7, fontWeight: 700, color: "rgba(245,200,66,0.5)", fontFamily: "monospace" }}>#{sample.num}</div>
      </div>

      {/* Avatar centered */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 14px 10px", gap: 10 }}>
        <div style={{ position: "relative" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(145deg,#0f2044,#1a3a70)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: "#f5c842" }}>CR</span>
          </div>
          {/* Gold ring */}
          <div style={{ position: "absolute", inset: -3, borderRadius: "50%", border: "1.5px solid rgba(245,200,66,0.5)" }} />
          {/* Outer subtle ring */}
          <div style={{ position: "absolute", inset: -7, borderRadius: "50%", border: "1px solid rgba(245,200,66,0.15)" }} />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 900, color: "#fff", textAlign: "center", letterSpacing: 0.5, textTransform: "uppercase", lineHeight: 1.2 }}>{sample.nombre}</div>
          <div style={{ fontSize: 6.5, fontWeight: 700, color: "#f5c842", textAlign: "center", letterSpacing: 1.2, textTransform: "uppercase", marginTop: 4 }}>{sample.cargo}</div>
        </div>
      </div>

      {/* Gold divider */}
      <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(245,200,66,0.6),transparent)", margin: "0 20px", flexShrink: 0 }} />

      {/* DPI */}
      <div style={{ padding: "8px 14px 6px", flexShrink: 0 }}>
        <div style={{ fontSize: 5, color: "rgba(245,200,66,0.5)", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, marginBottom: 3 }}>Documento de identidad</div>
        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.85)", fontFamily: "monospace", fontWeight: 800, letterSpacing: 0.8 }}>{sample.dpi}</div>
      </div>

      {/* Gold divider */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 14px", flexShrink: 0 }} />

      {/* QR */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px 14px", gap: 5 }}>
        <div style={{ background: "#fff", borderRadius: 6, padding: 6, display: "inline-block" }}>
          <div style={{ width: 56, height: 56, display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            {Array.from({ length: 25 }, (_, i) => (
              <div key={i} style={{ width: 9, height: 9, background: [0,1,2,5,6,7,10,14,17,18,19,21,24].includes(i) ? "#08122a" : "#fff", borderRadius: 1 }} />
            ))}
          </div>
        </div>
        <span style={{ fontSize: 5.5, color: "rgba(255,255,255,0.3)", letterSpacing: 0.5 }}>Verificación de identidad</span>
      </div>

      {/* Bottom gold bar */}
      <div style={{ height: 3, background: "linear-gradient(90deg,#b8860b,#f5c842,#ffd700,#f5c842,#b8860b)", flexShrink: 0 }} />
    </div>
  );

  const Reverso = () => (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "Arial, sans-serif", background: "#08122a", borderRadius: 6, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", flexShrink: 0 }}>
      {/* Top gold strip */}
      <div style={{ height: 3, background: "linear-gradient(90deg,#b8860b,#f5c842,#ffd700,#f5c842,#b8860b)", flexShrink: 0 }} />

      {/* Logo area */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 20px 16px", gap: 10 }}>
        {/* Logo circle */}
        <div style={{ width: 54, height: 54, borderRadius: "50%", border: "2px solid rgba(245,200,66,0.5)", background: "rgba(245,200,66,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: "#f5c842", fontFamily: "serif" }}>I</span>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: "#fff", letterSpacing: 1 }}>ISP, S.A.</div>
          <div style={{ fontSize: 6, color: "rgba(245,200,66,0.6)", letterSpacing: 2, marginTop: 2 }}>INVESTIGACIONES Y SEGURIDAD PROFESIONAL</div>
        </div>
      </div>

      {/* Gold line */}
      <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(245,200,66,0.5),transparent)", margin: "0 24px", flexShrink: 0 }} />

      {/* Auth text */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 22px" }}>
        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.55)", textAlign: "center", lineHeight: 1.75 }}>
          El presente acredita como colaborador de{" "}
          <strong style={{ fontWeight: 800, color: "rgba(255,255,255,0.85)" }}>ISP S.A.</strong>{" "}
          Se solicita a las Autoridades{" "}
          <strong style={{ fontWeight: 800, color: "rgba(255,255,255,0.85)" }}>Civiles y Militares</strong>{" "}
          su colaboración en el cumplimiento de sus funciones.
        </div>
      </div>

      {/* Gold line */}
      <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(245,200,66,0.5),transparent)", margin: "0 24px", flexShrink: 0 }} />

      {/* Website */}
      <div style={{ padding: "12px 20px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#f5c842", letterSpacing: 0.5 }}>www.ispsa.net</div>
        <div style={{ fontSize: 6, color: "rgba(255,255,255,0.25)", letterSpacing: 1 }}>contacto@isp-guatemala.com</div>
      </div>

      {/* Bottom gold bar */}
      <div style={{ height: 3, background: "linear-gradient(90deg,#b8860b,#f5c842,#ffd700,#f5c842,#b8860b)", flexShrink: 0 }} />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f5c842" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#f5c842", letterSpacing: 2, textTransform: "uppercase" }}>Variante B</span>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f5c842" }} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: 0.5, marginBottom: 4 }}>Ejecutivo</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 20, textAlign: "center" }}>Todo oscuro · Tipografía blanca y dorada · Alto contraste</div>
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
