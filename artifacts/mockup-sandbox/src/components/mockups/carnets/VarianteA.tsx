/**
 * Variante A — "Insignia"
 * Stripe lateral navy con acento dorado, cuerpo blanco premium.
 * Refinamiento del diseño actual — más limpio, más jerarquía tipográfica.
 */
export function VarianteA() {
  const W = 220, H = 348, SW = 42;
  const sample = {
    nombre: "CARLOS RODRÍGUEZ",
    cargo: "GUARDIA DE SEGURIDAD",
    dpi: "2481 56789 0123",
    num: "#0042",
  };

  const Frente = () => (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "row", overflow: "hidden", fontFamily: "Arial, sans-serif", background: "#fff", borderRadius: 6, boxShadow: "0 8px 32px rgba(0,0,0,0.35)", flexShrink: 0 }}>
      {/* Stripe */}
      <div style={{ width: SW, height: H, background: "linear-gradient(180deg,#0a1a3d 0%,#0f2044 60%,#0a1a3d 100%)", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, position: "relative", boxSizing: "border-box" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#d4a017,#f5c842,#d4a017)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#d4a017,#f5c842,#d4a017)" }} />
        {/* Logo ISP en medallón blanco */}
        <div style={{
          width: 30, height: 30, borderRadius: "50%", marginTop: 12, flexShrink: 0,
          boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
          backgroundImage: "url(https://987b05e8-e17a-40f4-b366-3baeddd84475-00-2jyjpes488ag2.riker.replit.dev/images/logo-isp.png)",
          backgroundSize: "158%",
          backgroundPosition: "center 29%",
          backgroundRepeat: "no-repeat",
          backgroundColor: "#fff",
          mixBlendMode: "normal" as const,
        }} />
        <span style={{ writingMode: "vertical-rl" as const, fontSize: 8.5, color: "#f5c842", fontWeight: 800, marginTop: 10, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: 1.2, textTransform: "uppercase" as const }}>INVESTIGACIONES Y SEGURIDAD PROFESIONAL</span>
        <span style={{ writingMode: "vertical-rl" as const, fontSize: 8, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", fontWeight: 700, marginBottom: 14, letterSpacing: 1 }}>{sample.num}</span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff" }}>
        {/* Top: name section */}
        <div style={{ padding: "14px 10px 10px", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, background: "linear-gradient(180deg,#f8faff 0%,#fff 100%)" }}>
          {/* Foto del agente */}
          <div style={{ width: 64, height: 64, borderRadius: "50%", border: "2.5px solid #f5c842", marginBottom: 8, boxShadow: "0 4px 14px rgba(15,32,68,0.35)", overflow: "hidden", flexShrink: 0 }}>
            <img src="https://randomuser.me/api/portraits/men/32.jpg" alt="Foto agente" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#0f2044", textAlign: "center", lineHeight: 1.2, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 3 }}>{sample.nombre}</div>
          <div style={{ fontSize: 6.5, fontWeight: 700, color: "#b8860b", textAlign: "center", letterSpacing: 1, textTransform: "uppercase" }}>{sample.cargo}</div>
        </div>

        {/* Divider gold */}
        <div style={{ height: 1.5, background: "linear-gradient(90deg,#d4a017,#f5c842,#d4a017)", flexShrink: 0 }} />

        {/* DPI */}
        <div style={{ padding: "8px 10px 4px", flexShrink: 0, textAlign: "center" }}>
          <div style={{ fontSize: 5.5, color: "#94a3b8", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>DPI</div>
          <div style={{ fontSize: 9, color: "#0f2044", fontWeight: 800, fontFamily: "monospace", letterSpacing: 0.5 }}>{sample.dpi}</div>
        </div>
        <div style={{ height: 1, background: "#f1f5f9", margin: "0 10px", flexShrink: 0 }} />

        {/* QR */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "6px 10px 4px", gap: 5 }}>
          {/* QR placeholder — grid */}
          <div style={{ width: 120, height: 120, background: "#0f2044", borderRadius: 7, padding: 8, display: "flex", flexWrap: "wrap", gap: 2, boxShadow: "0 3px 12px rgba(15,32,68,0.25)" }}>
            {Array.from({ length: 25 }, (_, i) => (
              <div key={i} style={{ width: 15, height: 15, background: [0,1,2,5,6,7,10,14,17,18,19,21,24].includes(i) ? "#fff" : "#0f2044", borderRadius: 2 }} />
            ))}
          </div>
          <span style={{ fontSize: 5.5, color: "#94a3b8", textAlign: "center", letterSpacing: 0.3 }}>Escanea para verificar identidad</span>
        </div>

        {/* Footer navy */}
        <div style={{ background: "#0f2044", padding: "5px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 5, color: "rgba(255,255,255,0.3)" }}>2025</span>
          <span style={{ fontSize: 5.5, fontWeight: 800, color: "#f5c842", letterSpacing: 0.8, textTransform: "uppercase" }}>Carnet de Identificación</span>
        </div>
      </div>
    </div>
  );

  const Reverso = () => (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "Arial, sans-serif", background: "#fff", borderRadius: 6, boxShadow: "0 8px 32px rgba(0,0,0,0.35)", flexShrink: 0 }}>
      {/* Top navy band — solo texto */}
      <div style={{ background: "linear-gradient(180deg,#0a1a3d,#0f2044)", padding: "8px 16px 6px", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{ fontSize: 9.5, fontWeight: 900, color: "#fff", letterSpacing: 0.8 }}>ISP, S.A.</div>
        <div style={{ fontSize: 5.5, color: "rgba(255,255,255,0.45)", letterSpacing: 1.5, marginTop: 2, textAlign: "center" }}>INVESTIGACIONES Y SEGURIDAD PROFESIONAL, S.A.</div>
      </div>
      <div style={{ height: 2, background: "linear-gradient(90deg,#d4a017,#f5c842,#d4a017)", flexShrink: 0 }} />

      {/* Logo debajo de la línea dorada */}
      <img
        src="https://987b05e8-e17a-40f4-b366-3baeddd84475-00-2jyjpes488ag2.riker.replit.dev/images/logo-isp.png"
        alt="ISP"
        style={{ display: "block", width: "auto", height: "auto", maxWidth: "88%", maxHeight: 140, margin: "8px auto 4px", mixBlendMode: "multiply" as const, transform: "scale(1.9)", transformOrigin: "center" }}
      />

      {/* Text */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 18px 12px" }}>
        <div style={{ fontSize: 8, color: "#334155", textAlign: "center", lineHeight: 1.7 }}>
          El presente acredita como colaborador de{" "}
          <strong style={{ fontWeight: 800, color: "#0f2044" }}>ISP S.A.</strong>{" "}
          Se solicita a las Autoridades{" "}
          <strong style={{ fontWeight: 800, color: "#0f2044" }}>Civiles y Militares</strong>{" "}
          su colaboración. Válido en el cumplimiento de sus funciones en el puesto asignado.
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "linear-gradient(90deg,transparent,#f5c842,transparent)", margin: "0 20px", flexShrink: 0 }} />

      {/* Footer */}
      <div style={{ padding: "10px 16px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#0f2044", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0f2044" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
            </svg>
            www.ispsa.net
          </div>
        <div style={{ fontSize: 6, color: "#25D366", fontWeight: 700, letterSpacing: 0.3, display: "flex", alignItems: "center", gap: 3 }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="#25D366" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.553 4.103 1.518 5.829L0 24l6.335-1.518A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 2c5.514 0 10 4.486 10 10s-4.486 10-10 10a9.945 9.945 0 01-4.906-1.287l-.352-.206-3.652.875.891-3.561-.22-.366A9.945 9.945 0 012 12C2 6.486 6.486 2 12 2zm-1.172 4.5c-.207 0-.435.007-.65.017-.214.01-.476.063-.724.313-.249.249-.948.926-.948 2.259s.97 2.619 1.106 2.8c.136.18 1.884 3.012 4.637 4.104.648.26 1.154.415 1.548.532.65.194 1.242.167 1.71.101.522-.073 1.608-.658 1.835-1.293.228-.635.228-1.18.16-1.293-.069-.114-.249-.181-.522-.318s-1.608-.793-1.858-.884c-.249-.09-.43-.136-.612.137-.181.272-.703.883-.862 1.065-.158.181-.318.204-.59.068-.272-.136-1.148-.423-2.187-1.35-.808-.721-1.354-1.61-1.513-1.882-.158-.272-.017-.419.119-.555.122-.122.272-.318.408-.477.136-.158.181-.272.272-.453.09-.182.045-.34-.023-.477-.068-.137-.612-1.474-.838-2.018-.22-.53-.445-.458-.612-.466z"/>
            </svg>
            +502 0000-0000
          </div>
      </div>
      <div style={{ background: "#0f2044", height: 8, flexShrink: 0 }} />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f5c842" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: "#f5c842", letterSpacing: 2, textTransform: "uppercase" }}>Variante A</span>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f5c842" }} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: 0.5, marginBottom: 4 }}>Insignia</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 20, textAlign: "center" }}>Stripe lateral con acento dorado · Cuerpo blanco premium</div>
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
