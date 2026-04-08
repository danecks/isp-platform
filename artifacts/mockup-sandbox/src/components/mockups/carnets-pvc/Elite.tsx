// Opción A: "Elite" — Carnet oscuro premium con detalles dorados
export function Elite() {
  const agente = {
    nombre: "ROBERTO ALEJANDRO MONTERROSO FUENTES",
    cargo: "GUARDIA DE SEGURIDAD",
    dpi: "2841 76321 1401",
    numero: "0142",
    initials: "RM",
  };

  const W = 216;
  const H = 342;

  const qrUrl = "https://isp.gt/agente?token=demo";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1f2e]">
      <div className="flex flex-col items-center gap-6">
        <p className="text-white/40 text-xs uppercase tracking-widest font-semibold">Opción A · Elite</p>

        {/* Card */}
        <div
          style={{
            width: W, height: H,
            borderRadius: 8,
            overflow: "hidden",
            boxShadow: "0 24px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(245,200,66,0.25)",
            display: "flex",
            flexDirection: "column",
            fontFamily: "'Inter', -apple-system, sans-serif",
          }}
        >
          {/* ── HEADER: navy profundo con patrón sutil ── */}
          <div
            style={{
              background: "linear-gradient(160deg, #0a1628 0%, #0e2148 50%, #091630 100%)",
              padding: "14px 12px 10px",
              position: "relative",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {/* Patrón de fondo: círculos concéntricos */}
            <svg
              style={{ position: "absolute", inset: 0, opacity: 0.06 }}
              width={W} height={100} viewBox={`0 0 ${W} 100`}
            >
              {[20, 40, 60, 80, 100, 120].map(r => (
                <circle key={r} cx={W / 2} cy={10} r={r} fill="none" stroke="#f5c842" strokeWidth="0.8" />
              ))}
            </svg>

            {/* Top gold accent line */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, transparent, #f5c842 20%, #f5c842 80%, transparent)" }} />

            {/* ISP escudo + org */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 1 }}>
              {/* Escudo SVG */}
              <div style={{ width: 34, height: 34, marginBottom: 5 }}>
                <svg viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 1L2 8.5v13C2 33.8 9.8 43.7 20 47 30.2 43.7 38 33.8 38 21.5v-13L20 1z" fill="#f5c842" />
                  <path d="M20 5L5 11.5v10C5 31.2 11.5 40.1 20 43 28.5 40.1 35 31.2 35 21.5v-10L20 5z" fill="#0e2148" />
                  <text x="20" y="29" textAnchor="middle" fontSize="11" fontWeight="900" fill="#f5c842" fontFamily="sans-serif" letterSpacing="0.5">ISP</text>
                </svg>
              </div>
              <div style={{ fontSize: 6, color: "rgba(245,200,66,0.8)", letterSpacing: "0.12em", fontWeight: 700 }}>
                INVESTIGACIONES Y SEGURIDAD
              </div>
              <div style={{ fontSize: 5.5, color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", marginTop: 1 }}>
                PROFESIONAL S.A. · GUATEMALA
              </div>

              {/* Badge de tipo */}
              <div style={{
                marginTop: 8,
                background: "linear-gradient(135deg, #d4a017, #f5c842, #d4a017)",
                borderRadius: 2,
                padding: "2px 10px",
                fontSize: 5,
                fontWeight: 900,
                color: "#0a1628",
                letterSpacing: "0.15em",
              }}>
                CARNET DE IDENTIFICACIÓN
              </div>
            </div>
          </div>

          {/* Gold divider */}
          <div style={{ height: 2, background: "linear-gradient(90deg, #d4a017, #f5c842, #d4a017)", flexShrink: 0 }} />

          {/* ── CUERPO ── */}
          <div style={{ background: "#ffffff", flex: 1, display: "flex", flexDirection: "column", padding: "10px 12px 8px" }}>
            {/* Avatar */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 7 }}>
              <div style={{
                width: 46, height: 46,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #0e2148, #1a3a6e)",
                border: "2px solid #f5c842",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 12px rgba(245,200,66,0.3)",
              }}>
                <span style={{ color: "#f5c842", fontSize: 16, fontWeight: 900, letterSpacing: "0.05em" }}>
                  {agente.initials}
                </span>
              </div>
            </div>

            {/* Nombre */}
            <div style={{
              fontSize: 8,
              fontWeight: 900,
              color: "#0a1628",
              textAlign: "center",
              lineHeight: 1.2,
              marginBottom: 3,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}>
              {agente.nombre}
            </div>

            {/* Cargo en dorado */}
            <div style={{
              fontSize: 6,
              fontWeight: 700,
              color: "#b8860b",
              textAlign: "center",
              letterSpacing: "0.1em",
              marginBottom: 8,
            }}>
              {agente.cargo}
            </div>

            {/* Gold rule */}
            <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #f5c84260, #f5c842, #f5c84260, transparent)", marginBottom: 7 }} />

            {/* Datos en dos filas */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 8px", marginBottom: 8 }}>
              {[
                { label: "DPI", value: agente.dpi },
                { label: "No. EMPLEADO", value: `#${agente.numero}` },
              ].map(d => (
                <div key={d.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 5, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 1 }}>
                    {d.label}
                  </div>
                  <div style={{ fontSize: 7, color: "#0a1628", fontWeight: 800, fontFamily: "'Courier New', monospace" }}>
                    {d.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Gold rule */}
            <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #f5c84260, #f5c842, #f5c84260, transparent)", marginBottom: 7 }} />

            {/* QR Code */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 4,
                padding: 3,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}>
                {/* QR placeholder (SVG sintético) */}
                <svg width="54" height="54" viewBox="0 0 54 54" fill="none">
                  <rect width="54" height="54" fill="white"/>
                  {/* QR pattern simplified */}
                  <rect x="2" y="2" width="18" height="18" rx="1" fill="none" stroke="#0a1628" strokeWidth="2"/>
                  <rect x="6" y="6" width="10" height="10" rx="0.5" fill="#0a1628"/>
                  <rect x="34" y="2" width="18" height="18" rx="1" fill="none" stroke="#0a1628" strokeWidth="2"/>
                  <rect x="38" y="6" width="10" height="10" rx="0.5" fill="#0a1628"/>
                  <rect x="2" y="34" width="18" height="18" rx="1" fill="none" stroke="#0a1628" strokeWidth="2"/>
                  <rect x="6" y="38" width="10" height="10" rx="0.5" fill="#0a1628"/>
                  {/* dots pattern */}
                  {[22,26,30,34].map(x => [22,26,30,34].map(y =>
                    Math.random() > 0.4 ? <rect key={`${x}${y}`} x={x} y={y} width="3" height="3" fill="#0a1628"/> : null
                  ))}
                  <rect x="34" y="34" width="5" height="5" fill="#0a1628"/>
                  <rect x="41" y="34" width="5" height="5" fill="#0a1628"/>
                  <rect x="34" y="41" width="5" height="5" fill="#0a1628"/>
                  <rect x="46" y="41" width="5" height="5" fill="#0a1628"/>
                  <rect x="41" y="46" width="5" height="5" fill="#0a1628"/>
                </svg>
              </div>
              <div style={{ fontSize: 5, color: "#94a3b8", marginTop: 3, letterSpacing: "0.06em" }}>
                ESCANEA PARA VERIFICAR
              </div>
            </div>
          </div>

          {/* ── FOOTER ── */}
          <div style={{
            background: "linear-gradient(135deg, #0a1628, #0e2148)",
            padding: "5px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 5, color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em" }}>
              EMITIDO: ABRIL 2026
            </div>
            <div style={{ height: 1, flex: 1, margin: "0 8px", background: "rgba(245,200,66,0.2)" }} />
            <div style={{ fontSize: 5, color: "rgba(245,200,66,0.6)", letterSpacing: "0.06em", fontWeight: 700 }}>
              ISP GT
            </div>
          </div>
        </div>

        {/* Note bajo el carnet */}
        <p className="text-white/25 text-[10px] text-center">CR-80 · 53.98 × 85.6 mm · Vertical portrait</p>
      </div>
    </div>
  );
}
