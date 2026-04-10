import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import html2canvas from "html2canvas";

const PLAZAS = [
  "Agente de Seguridad",
  "Supervisor de Seguridad",
  "Agente de Custodia y Transporte",
  "Agente de Seguridad Industrial",
];

export default function AnuncioPlazas() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [descargando, setDescargando] = useState(false);

  const urlSolicitud =
    window.location.origin +
    (import.meta.env.BASE_URL || "/") +
    "solicitud-empleo";

  const descargar = async () => {
    if (!cardRef.current) return;
    setDescargando(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = "isp-plazas-disponibles.jpg";
      link.href = canvas.toDataURL("image/jpeg", 0.96);
      link.click();
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6"
      style={{ background: "#060f1e" }}>

      {/* Tarjeta del anuncio — formato cuadrado Instagram/Facebook */}
      <div ref={cardRef}
        style={{
          width: 540,
          height: 540,
          background: "linear-gradient(160deg, #0a1f4e 0%, #071230 60%, #0d1a3a 100%)",
          borderRadius: 24,
          overflow: "hidden",
          position: "relative",
          flexShrink: 0,
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}>

        {/* Franja dorada superior */}
        <div style={{ height: 6, background: "linear-gradient(90deg, #b8952a, #f0c040, #b8952a)" }} />

        {/* Fondo decorativo — círculos sutiles */}
        <div style={{
          position: "absolute", width: 380, height: 380,
          borderRadius: "50%", top: -120, right: -120,
          background: "radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", width: 260, height: 260,
          borderRadius: "50%", bottom: -80, left: -60,
          background: "radial-gradient(circle, rgba(184,149,42,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ padding: "20px 28px 20px 28px", display: "flex", flexDirection: "column", height: "calc(100% - 6px)", boxSizing: "border-box" }}>

          {/* Logo + nombre */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <img
              src={`${import.meta.env.BASE_URL}images/logo-isp.png`}
              alt="ISP"
              style={{ height: 44, width: "auto", objectFit: "contain" }}
            />
            <div>
              <div style={{ color: "#f0c040", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
                Investigaciones y Seguridad Profesional
              </div>
              <div style={{ color: "#93a3b8", fontSize: 9, letterSpacing: 1 }}>S.A. — Guatemala</div>
            </div>
          </div>

          {/* Titular */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#f0c040", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>
              Convocatoria abierta
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, color: "#ffffff", lineHeight: 1.1 }}>
              Plazas<br />
              <span style={{ color: "#f0c040" }}>Disponibles</span>
            </div>
          </div>

          {/* Contenido principal — dos columnas */}
          <div style={{ display: "flex", gap: 20, flex: 1, alignItems: "flex-start" }}>

            {/* Lista de plazas */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
                Puestos disponibles
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {PLAZAS.map((plaza, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span style={{ color: "#e2e8f0", fontSize: 11.5, fontWeight: 500, lineHeight: 1.3 }}>{plaza}</span>
                  </div>
                ))}
              </div>

              {/* Requisitos mínimos */}
              <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(37,99,235,0.12)", border: "1px solid rgba(37,99,235,0.25)" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#60a5fa", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
                  Requisito minimo
                </div>
                <div style={{ color: "#cbd5e1", fontSize: 10, lineHeight: 1.6 }}>
                  Mayor de 18 años<br />
                  DPI vigente<br />
                  Sin antecedentes penales
                </div>
              </div>
            </div>

            {/* QR + instruccion */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{
                padding: 10, borderRadius: 14,
                background: "#ffffff",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
              }}>
                <QRCodeSVG
                  value={urlSolicitud}
                  size={120}
                  bgColor="#ffffff"
                  fgColor="#071230"
                  level="M"
                />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#f0c040", fontSize: 10, fontWeight: 700, lineHeight: 1.4 }}>
                  Escanea y aplica
                </div>
                <div style={{ color: "#64748b", fontSize: 9, lineHeight: 1.4 }}>
                  desde tu celular
                </div>
              </div>

              {/* Badge "Aplicar Ahora" */}
              <div style={{
                background: "linear-gradient(135deg, #b8952a, #f0c040)",
                borderRadius: 8, padding: "6px 14px", textAlign: "center",
              }}>
                <span style={{ color: "#071230", fontSize: 10, fontWeight: 900, letterSpacing: 0.5 }}>
                  APLICAR AHORA
                </span>
              </div>
            </div>
          </div>

          {/* Franja inferior */}
          <div style={{
            marginTop: 14, paddingTop: 10,
            borderTop: "1px solid rgba(255,255,255,0.07)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ color: "#475569", fontSize: 9 }}>
              Prestaciones de ley · Sueldo competitivo
            </div>
            <div style={{ color: "#475569", fontSize: 9 }}>
              www.isp-gt.com
            </div>
          </div>
        </div>

        {/* Franja dorada inferior */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: 4, background: "linear-gradient(90deg, #b8952a, #f0c040, #b8952a)",
        }} />
      </div>

      {/* Controles — fuera de la tarjeta, no aparecen en la imagen */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <p style={{ color: "#475569", fontSize: 13, textAlign: "center", maxWidth: 400 }}>
          El codigo QR lleva directamente al formulario de solicitud de empleo en linea.
          Descarga la imagen y publicala en Instagram o Facebook.
        </p>
        <button
          onClick={descargar}
          disabled={descargando}
          style={{
            background: descargando ? "#1e3a6e" : "linear-gradient(135deg, #b8952a, #f0c040)",
            color: descargando ? "#64748b" : "#071230",
            border: "none", borderRadius: 12, padding: "14px 40px",
            fontWeight: 900, fontSize: 16, cursor: descargando ? "not-allowed" : "pointer",
            transition: "all 0.2s", letterSpacing: 0.5,
          }}>
          {descargando ? "Generando..." : "Descargar imagen"}
        </button>
        <p style={{ color: "#334155", fontSize: 11 }}>
          URL del formulario: <span style={{ color: "#60a5fa" }}>{urlSolicitud}</span>
        </p>
      </div>
    </div>
  );
}
