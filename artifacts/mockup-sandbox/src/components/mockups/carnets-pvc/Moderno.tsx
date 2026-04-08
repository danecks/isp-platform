// Opción B: "Moderno" — Carnet blanco bicolor con franja de color e identidad visual fuerte
export function Moderno() {
  const agente = {
    nombre: "ROBERTO ALEJANDRO MONTERROSO FUENTES",
    cargo: "GUARDIA DE SEGURIDAD",
    dpi: "2841 76321 1401",
    numero: "0142",
    initials: "RM",
  };

  const W = 216;
  const H = 342;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5]">
      <div className="flex flex-col items-center gap-6">
        <p className="text-slate-500 text-xs uppercase tracking-widest font-semibold">Opción B · Moderno</p>

        {/* Card */}
        <div
          style={{
            width: W, height: H,
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "row",
            fontFamily: "'Inter', -apple-system, sans-serif",
            background: "#ffffff",
          }}
        >
          {/* ── FRANJA IZQUIERDA NAVY ── */}
          <div
            style={{
              width: 36,
              background: "linear-gradient(180deg, #0f2044 0%, #132a5a 100%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 0",
              flexShrink: 0,
              position: "relative",
            }}
          >
            {/* Línea dorada superior */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#f5c842" }} />
            {/* Línea dorada inferior */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "#f5c842" }} />

            {/* Escudo ISP arriba */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <svg viewBox="0 0 28 34" width="22" height="22" fill="none">
                <path d="M14 1L1 6v9c0 9 6.3 16.5 13 18.5C20.7 31.5 27 24 27 15V6L14 1z" fill="#f5c842"/>
                <path d="M14 3.5L3 8v7c0 7.5 4.9 13.7 11 15.6C20.1 28.7 25 22.5 25 15V8L14 3.5z" fill="#0f2044"/>
                <text x="14" y="20" textAnchor="middle" fontSize="7.5" fontWeight="900" fill="#f5c842" fontFamily="sans-serif">ISP</text>
              </svg>

              {/* Texto vertical */}
              <div style={{
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                fontSize: 5.5,
                fontWeight: 700,
                color: "rgba(245,200,66,0.75)",
                letterSpacing: "0.15em",
                marginTop: 8,
                textTransform: "uppercase",
                lineHeight: 1,
              }}>
                SEGURIDAD · GUATEMALA
              </div>
            </div>

            {/* Número de empleado vertical abajo */}
            <div style={{
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              fontSize: 6,
              color: "rgba(255,255,255,0.45)",
              letterSpacing: "0.12em",
              fontFamily: "'Courier New', monospace",
              fontWeight: 700,
            }}>
              #{agente.numero}
            </div>
          </div>

          {/* ── CONTENIDO DERECHO ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Header blanco con avatar */}
            <div style={{
              background: "#ffffff",
              padding: "12px 10px 8px",
              borderBottom: "1.5px solid #f1f5f9",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}>
              {/* Avatar con borde dorado */}
              <div style={{
                width: 44, height: 44,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #0f2044, #1e4a9a)",
                border: "2.5px solid #f5c842",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 7,
                boxShadow: "0 4px 14px rgba(15,32,68,0.25)",
              }}>
                <span style={{ color: "#f5c842", fontSize: 15, fontWeight: 900 }}>
                  {agente.initials}
                </span>
              </div>

              {/* Nombre */}
              <div style={{
                fontSize: 7.5,
                fontWeight: 900,
                color: "#0f2044",
                textAlign: "center",
                lineHeight: 1.2,
                letterSpacing: "0.01em",
                marginBottom: 3,
                textTransform: "uppercase",
              }}>
                {agente.nombre}
              </div>

              {/* Cargo */}
              <div style={{
                fontSize: 5.5,
                fontWeight: 700,
                color: "#b8860b",
                textAlign: "center",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}>
                {agente.cargo}
              </div>
            </div>

            {/* Gold accent line */}
            <div style={{ height: 2, background: "linear-gradient(90deg, #d4a017, #f5c842, #e8b820)" }} />

            {/* Datos de identidad */}
            <div style={{ padding: "8px 10px", flex: 1 }}>
              {/* DPI */}
              <div style={{ marginBottom: 5 }}>
                <div style={{ fontSize: 4.5, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 1.5 }}>
                  DPI
                </div>
                <div style={{ fontSize: 8, color: "#0f2044", fontWeight: 800, fontFamily: "'Courier New', monospace", letterSpacing: "0.05em" }}>
                  {agente.dpi}
                </div>
              </div>

              {/* Tipo carnet badge */}
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 3,
                padding: "3px 7px",
                marginBottom: 8,
              }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", marginRight: 4 }} />
                <span style={{ fontSize: 5, color: "#0f2044", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  ACTIVO
                </span>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: "#f1f5f9", marginBottom: 8 }} />

              {/* QR code */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 4.5, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>
                    Verificación
                  </div>
                  <div style={{ fontSize: 5, color: "#64748b", lineHeight: 1.4, letterSpacing: "0.02em" }}>
                    Escanea el código QR para verificar identidad en tiempo real
                  </div>
                </div>

                {/* QR box */}
                <div style={{
                  background: "#ffffff",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 4,
                  padding: 3,
                  flexShrink: 0,
                }}>
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <rect width="48" height="48" fill="white"/>
                    <rect x="2" y="2" width="16" height="16" rx="1" fill="none" stroke="#0f2044" strokeWidth="1.8"/>
                    <rect x="5" y="5" width="9" height="9" rx="0.5" fill="#0f2044"/>
                    <rect x="30" y="2" width="16" height="16" rx="1" fill="none" stroke="#0f2044" strokeWidth="1.8"/>
                    <rect x="33" y="5" width="9" height="9" rx="0.5" fill="#0f2044"/>
                    <rect x="2" y="30" width="16" height="16" rx="1" fill="none" stroke="#0f2044" strokeWidth="1.8"/>
                    <rect x="5" y="33" width="9" height="9" rx="0.5" fill="#0f2044"/>
                    {/* data dots */}
                    <rect x="20" y="2" width="3" height="3" fill="#0f2044"/>
                    <rect x="24" y="2" width="3" height="3" fill="#0f2044"/>
                    <rect x="20" y="7" width="3" height="3" fill="#0f2044"/>
                    <rect x="2" y="20" width="3" height="3" fill="#0f2044"/>
                    <rect x="7" y="20" width="3" height="3" fill="#0f2044"/>
                    <rect x="7" y="25" width="3" height="3" fill="#0f2044"/>
                    <rect x="20" y="20" width="3" height="3" fill="#0f2044"/>
                    <rect x="25" y="20" width="3" height="3" fill="#0f2044"/>
                    <rect x="20" y="25" width="3" height="3" fill="#0f2044"/>
                    <rect x="25" y="25" width="3" height="3" fill="#0f2044"/>
                    <rect x="30" y="20" width="3" height="3" fill="#0f2044"/>
                    <rect x="35" y="20" width="3" height="3" fill="#0f2044"/>
                    <rect x="40" y="20" width="3" height="3" fill="#0f2044"/>
                    <rect x="30" y="25" width="3" height="3" fill="#0f2044"/>
                    <rect x="40" y="25" width="3" height="3" fill="#0f2044"/>
                    <rect x="30" y="30" width="3" height="3" fill="#0f2044"/>
                    <rect x="35" y="35" width="3" height="3" fill="#0f2044"/>
                    <rect x="40" y="35" width="3" height="3" fill="#0f2044"/>
                    <rect x="30" y="40" width="3" height="3" fill="#0f2044"/>
                    <rect x="40" y="40" width="3" height="3" fill="#0f2044"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* ── FOOTER ── */}
            <div style={{
              background: "#0f2044",
              padding: "5px 10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}>
              <div style={{ fontSize: 4.5, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em" }}>
                ABRIL 2026
              </div>
              <div style={{
                fontSize: 5,
                fontWeight: 800,
                color: "#f5c842",
                letterSpacing: "0.12em",
              }}>
                CARNET DE IDENTIFICACIÓN
              </div>
            </div>
          </div>
        </div>

        <p className="text-slate-400/50 text-[10px] text-center">CR-80 · 53.98 × 85.6 mm · Vertical portrait</p>
      </div>
    </div>
  );
}
