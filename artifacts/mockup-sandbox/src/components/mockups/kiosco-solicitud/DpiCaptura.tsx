import { useState, useEffect, useRef } from "react";

const BG    = "#000";
const CARD  = "#0d2147";
const TEXT  = "#e2e8f0";
const MUTED = "#64748b";
const BLUE  = "#2563eb";
const BL    = "#3b82f6";
const BORDER = "#1e3a6e";

type Phase = "guide" | "scanning" | "aligning" | "stable" | "flash" | "captured";

/* ── Corner marker ──────────────────────────────────────────────── */
function Corner({ pos, color, size = 22, thick = 3 }: {
  pos: "tl" | "tr" | "bl" | "br"; color: string; size?: number; thick?: number;
}) {
  const s = size, t = thick;
  const corners: Record<string, React.CSSProperties> = {
    tl: { top: 0, left: 0, borderTop: `${t}px solid ${color}`, borderLeft: `${t}px solid ${color}` },
    tr: { top: 0, right: 0, borderTop: `${t}px solid ${color}`, borderRight: `${t}px solid ${color}` },
    bl: { bottom: 0, left: 0, borderBottom: `${t}px solid ${color}`, borderLeft: `${t}px solid ${color}` },
    br: { bottom: 0, right: 0, borderBottom: `${t}px solid ${color}`, borderRight: `${t}px solid ${color}` },
  };
  return (
    <div style={{
      position: "absolute", width: s, height: s,
      transition: "border-color 0.4s",
      ...corners[pos],
    }} />
  );
}

/* ── Simulated DPI card preview (shown after capture) ───────────── */
function FakeCard() {
  return (
    <div style={{
      width: "100%", height: "100%", borderRadius: 8,
      background: "linear-gradient(135deg, #e8f0fe 0%, #d2e3fc 100%)",
      display: "flex", flexDirection: "column",
      padding: "10px 14px", boxSizing: "border-box",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #fff" }} />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 7, fontWeight: 800, color: "#1d4ed8", letterSpacing: "0.05em" }}>REPUBLICA DE GUATEMALA</p>
          <p style={{ margin: 0, fontSize: 6, color: "#374151", letterSpacing: "0.03em" }}>DOCUMENTO PERSONAL DE IDENTIFICACION</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flex: 1 }}>
        <div style={{
          width: 54, height: 66, borderRadius: 4, flexShrink: 0,
          background: "#c7d2fe", border: "1px solid #6366f1",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ width: 28, height: 36, background: "#6366f1", borderRadius: 2, opacity: 0.4 }} />
        </div>

        <div style={{ flex: 1 }}>
          {[
            { l: "APELLIDOS", v: "PEREZ GARCIA" },
            { l: "NOMBRES", v: "JUAN CARLOS" },
            { l: "CUI", v: "3456 78901 0101" },
            { l: "NACIMIENTO", v: "15/03/1990" },
          ].map(f => (
            <div key={f.l} style={{ marginBottom: 5 }}>
              <p style={{ margin: 0, fontSize: 5.5, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase" }}>{f.l}</p>
              <p style={{ margin: 0, fontSize: 8, fontWeight: 700, color: "#111827" }}>{f.v}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 8, display: "flex", gap: 1, alignItems: "flex-end", height: 14 }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} style={{
            width: i % 3 === 0 ? 2 : 1,
            height: i % 5 === 0 ? 14 : i % 3 === 0 ? 10 : 12,
            background: "#111827",
          }} />
        ))}
        <p style={{ margin: "0 0 0 6px", fontSize: 5, color: "#374151", alignSelf: "flex-end" }}>3456789010101</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export function DpiCaptura() {
  const [phase, setPhase]     = useState<Phase>("guide");
  const [stability, setStab]  = useState(0);
  const [side, setSide]       = useState<"front" | "back">("front");
  const [frontOk, setFrontOk] = useState(false);
  const [done, setDone]       = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stabRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (stabRef.current)  clearInterval(stabRef.current);
  };

  const startScanning = () => {
    clear();
    setPhase("scanning");
    setStab(0);

    timerRef.current = setTimeout(() => {
      setPhase("aligning");

      stabRef.current = setInterval(() => {
        setStab(prev => {
          if (prev >= 100) { clearInterval(stabRef.current!); return 100; }
          return prev + 4;
        });
      }, 60);

      timerRef.current = setTimeout(() => {
        setPhase("stable");
        timerRef.current = setTimeout(() => {
          setPhase("flash");
          timerRef.current = setTimeout(() => setPhase("captured"), 300);
        }, 600);
      }, 1800);
    }, 1200);
  };

  const confirm = () => {
    if (side === "front") {
      setFrontOk(true); setSide("back"); setPhase("guide"); setStab(0);
    } else {
      setDone(true);
    }
  };

  const retry = () => { setPhase("guide"); setStab(0); clear(); };

  useEffect(() => () => clear(), []);

  const cornerColor =
    phase === "stable"   ? "#22c55e" :
    phase === "aligning" ? "#facc15" :
    phase === "scanning" ? "#ef4444" : "#ffffff50";

  const overlayColor =
    phase === "stable"   ? "rgba(34,197,94,0.15)"  :
    phase === "aligning" ? "rgba(250,204,21,0.10)" :
    phase === "scanning" ? "rgba(239,68,68,0.10)"  : "transparent";

  const statusLabel =
    phase === "guide"    ? null :
    phase === "scanning" ? { txt: "Buscando DPI...",           color: "#94a3b8" } :
    phase === "aligning" ? { txt: "Ajustando posicion...",     color: "#facc15" } :
    phase === "stable"   ? { txt: "Perfecto — no se mueva...", color: "#4ade80" } :
    phase === "captured" ? { txt: "Capturado",                 color: "#4ade80" } : null;

  /* ── DONE ── */
  if (done) return (
    <Shell>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#052e16", border: "3px solid #22c55e", margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#4ade80", fontSize: 32, fontWeight: 900 }}>✓</span>
          </div>
          <p style={{ color: TEXT, fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>DPI registrado</p>
          <p style={{ color: MUTED, fontSize: 14, margin: "0 0 28px" }}>Ambos lados capturados correctamente</p>
          <div style={{ background: "#052e16", border: "2px solid #16a34a", borderRadius: 14, padding: "16px 20px", marginBottom: 24 }}>
            <p style={{ color: "#4ade80", fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>✓ Anverso (frente)</p>
            <p style={{ color: "#4ade80", fontSize: 15, fontWeight: 700, margin: 0 }}>✓ Reverso (atras)</p>
          </div>
          <button onClick={() => { setDone(false); setSide("front"); setFrontOk(false); setPhase("guide"); setStab(0); }}
            style={{ padding: "14px 32px", borderRadius: 12, fontSize: 15, fontWeight: 800, background: BLUE, color: "#fff", border: "none", cursor: "pointer" }}>
            Escanear otro DPI
          </button>
        </div>
      </div>
    </Shell>
  );

  /* ── GUIDE ── */
  if (phase === "guide") return (
    <Shell>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 20 }}>
        <div style={{ display: "flex", gap: 10 }}>
          {[{ l: "Frente", ok: frontOk }, { l: "Atras", ok: false }].map((s, i) => (
            <div key={i} style={{
              padding: "6px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700,
              background: s.ok ? "#052e16" : (side === (i === 0 ? "front" : "back") ? "#0f2a5e" : "#0a1628"),
              border: `2px solid ${s.ok ? "#16a34a" : (side === (i === 0 ? "front" : "back") ? BL : BORDER)}`,
              color: s.ok ? "#4ade80" : (side === (i === 0 ? "front" : "back") ? TEXT : MUTED),
            }}>
              {s.ok ? "✓ " : ""}{s.l}
            </div>
          ))}
        </div>

        <div style={{ position: "relative", width: 240, height: 152 }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 12, background: "rgba(59,130,246,0.12)", filter: "blur(16px)" }} />
          <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 12, border: "2.5px dashed #3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Corner pos="tl" color="#60a5fa" size={28} thick={4} />
            <Corner pos="tr" color="#60a5fa" size={28} thick={4} />
            <Corner pos="bl" color="#60a5fa" size={28} thick={4} />
            <Corner pos="br" color="#60a5fa" size={28} thick={4} />
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 40, height: 26, border: "2.5px solid #93c5fd", borderRadius: 4, margin: "0 auto 8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 20, height: 3, background: "#93c5fd", borderRadius: 1 }} />
              </div>
              <p style={{ color: "#93c5fd", fontSize: 11, fontWeight: 700, margin: 0 }}>
                {side === "front" ? "ANVERSO (FRENTE)" : "REVERSO (ATRAS)"}
              </p>
            </div>
          </div>
        </div>

        <div style={{ background: "#0d2147", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "16px 20px", width: "100%", maxWidth: 320 }}>
          <p style={{ color: TEXT, fontSize: 15, fontWeight: 700, margin: "0 0 10px", textAlign: "center" }}>
            {side === "front" ? "Escanee el frente del DPI" : "Ahora escanee el reverso"}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { dot: "#facc15", txt: "Busque buena luz, evite sombras" },
              { dot: BL,       txt: "Centre el DPI dentro del marco" },
              { dot: BL,       txt: "Sostenga la tablet quieta" },
              { dot: "#22c55e",txt: "La foto se toma sola automaticamente" },
            ].map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: t.dot, flexShrink: 0 }} />
                <span style={{ color: MUTED, fontSize: 13 }}>{t.txt}</span>
              </div>
            ))}
          </div>
        </div>

        <button onClick={startScanning} style={{
          padding: "16px 48px", borderRadius: 14, fontSize: 17, fontWeight: 800,
          background: `linear-gradient(135deg, #1d4ed8, #2563eb)`,
          color: "#fff", border: "none", cursor: "pointer",
          boxShadow: "0 4px 20px rgba(37,99,235,0.5)",
        }}>
          Abrir camara
        </button>
      </div>
    </Shell>
  );

  /* ── CAPTURED ── */
  if (phase === "captured") return (
    <Shell>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: 20, gap: 16 }}>
        <p style={{ color: "#4ade80", fontSize: 16, fontWeight: 800, margin: 0 }}>
          {side === "front" ? "Frente" : "Reverso"} capturado
        </p>

        <div style={{ position: "relative", width: 300, height: 190, borderRadius: 14, overflow: "hidden", border: "3px solid #22c55e", boxShadow: "0 0 30px rgba(34,197,94,0.4)" }}>
          <FakeCard />
          <div style={{ position: "absolute", inset: 0, background: "rgba(34,197,94,0.12)", borderRadius: 12 }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, width: "100%", maxWidth: 320 }}>
          {[
            { label: "Iluminacion", ok: true },
            { label: "Nitidez",     ok: true },
            { label: "Encuadre",    ok: true },
          ].map(q => (
            <div key={q.label} style={{
              background: q.ok ? "#052e16" : "#2d0000",
              border: `1.5px solid ${q.ok ? "#16a34a" : "#dc2626"}`,
              borderRadius: 10, padding: "10px 6px", textAlign: "center",
            }}>
              <p style={{ color: q.ok ? "#4ade80" : "#f87171", fontSize: 11, fontWeight: 700, margin: 0 }}>
                {q.ok ? "✓" : "✗"} {q.label}
              </p>
            </div>
          ))}
        </div>

        <p style={{ color: MUTED, fontSize: 13, textAlign: "center", margin: 0 }}>
          Se ven bien los datos del DPI?
        </p>

        <div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 320 }}>
          <button onClick={retry} style={{
            flex: 1, padding: "14px 0", borderRadius: 12, fontSize: 15, fontWeight: 700,
            background: "#1a0a0a", border: "2px solid #ef4444", color: "#f87171", cursor: "pointer",
          }}>
            Repetir
          </button>
          <button onClick={confirm} style={{
            flex: 2, padding: "14px 0", borderRadius: 12, fontSize: 15, fontWeight: 800,
            background: "#052e16", border: "2.5px solid #22c55e", color: "#4ade80", cursor: "pointer",
          }}>
            {side === "front" ? "Continuar con el reverso" : "Listo"}
          </button>
        </div>
      </div>
    </Shell>
  );

  /* ── CAMERA VIEW ── */
  const W = 320;
  const H = 202;

  return (
    <Shell>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16, gap: 14 }}>

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: "#0f2a5e", border: `2px solid ${BL}`, color: TEXT }}>
            {side === "front" ? "Frente del DPI" : "Reverso del DPI"}
          </div>
        </div>

        <div style={{ position: "relative", width: W + 40, height: H + 100 }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: 16,
            background: "linear-gradient(160deg, #1a2a1a 0%, #111820 40%, #1a1a2a 100%)",
            overflow: "hidden",
          }}>
            {phase !== "flash" && Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ position: "absolute", left: 0, right: 0, top: `${(i / 8) * 100}%`, height: 1, background: "rgba(255,255,255,0.03)" }} />
            ))}
            {phase === "flash" && (
              <div style={{ position: "absolute", inset: 0, background: "white", opacity: 0.95, borderRadius: 16 }} />
            )}
          </div>

          <div style={{
            position: "absolute", left: "50%", top: "50%",
            transform: "translate(-50%, -50%)", width: W, height: H,
          }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 8, background: overlayColor, transition: "background 0.4s" }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: 8, border: `2px dashed ${cornerColor}`, opacity: 0.5, transition: "border-color 0.4s" }} />
            {(["tl","tr","bl","br"] as const).map(pos => (
              <Corner key={pos} pos={pos} color={cornerColor} size={28} thick={4} />
            ))}

            {(phase === "scanning" || phase === "aligning") && (
              <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 20, height: 20 }}>
                <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: cornerColor, opacity: 0.6 }} />
                <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: cornerColor, opacity: 0.6 }} />
              </div>
            )}

            {phase === "scanning" && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ background: "rgba(0,0,0,0.6)", borderRadius: 8, padding: "6px 14px" }}>
                  <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 700, margin: 0, textAlign: "center" }}>
                    Centre el DPI aqui
                  </p>
                </div>
              </div>
            )}

            {(phase === "aligning" || phase === "scanning") && (
              <div style={{
                position: "absolute", left: 4, right: 4, height: 2,
                background: `linear-gradient(90deg, transparent, ${cornerColor}, transparent)`,
                animation: "scanline 1.5s ease-in-out infinite",
                top: "40%",
              }} />
            )}
          </div>

          {statusLabel && phase !== "flash" && (
            <div style={{
              position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
              borderRadius: 20, padding: "6px 16px",
              border: `1.5px solid ${statusLabel.color}`,
              whiteSpace: "nowrap",
            }}>
              <p style={{ color: statusLabel.color, fontSize: 13, fontWeight: 700, margin: 0 }}>
                {statusLabel.txt}
              </p>
            </div>
          )}
        </div>

        {(phase === "aligning" || phase === "stable") && (
          <div style={{ width: "100%", maxWidth: 320 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: MUTED, fontSize: 12 }}>Estabilidad</span>
              <span style={{ color: stability >= 100 ? "#4ade80" : "#facc15", fontSize: 12, fontWeight: 700 }}>
                {stability >= 100 ? "Listo" : `${stability}%`}
              </span>
            </div>
            <div style={{ background: "#0a1628", borderRadius: 6, height: 10, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 6, transition: "width 0.1s, background 0.4s",
                width: `${stability}%`,
                background: stability >= 100 ? "linear-gradient(90deg, #16a34a, #22c55e)" : "linear-gradient(90deg, #d97706, #facc15)",
              }} />
            </div>
          </div>
        )}

        <div style={{ background: "#0d2147", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 16px", width: "100%", maxWidth: 320, textAlign: "center" }}>
          {phase === "scanning" && (
            <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>
              Coloque el DPI <strong style={{ color: TEXT }}>dentro del marco</strong><br />
              La tablet lo detectara automaticamente
            </p>
          )}
          {phase === "aligning" && (
            <p style={{ color: "#fbbf24", fontSize: 13, fontWeight: 700, margin: 0 }}>
              Casi perfecto — ajuste un poco mas y <strong>no mueva la tablet</strong>
            </p>
          )}
          {phase === "stable" && (
            <p style={{ color: "#4ade80", fontSize: 14, fontWeight: 800, margin: 0 }}>
              Excelente — tomando foto...
            </p>
          )}
        </div>

        {phase !== "flash" && phase !== "stable" && (
          <button onClick={retry} style={{
            background: "transparent", border: `1px solid ${BORDER}`,
            borderRadius: 10, color: MUTED, fontSize: 13, padding: "10px 24px", cursor: "pointer",
          }}>
            Cancelar
          </button>
        )}
      </div>

      <style>{`
        @keyframes scanline {
          0%   { top: 8%;  opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 88%; opacity: 0; }
        }
      `}</style>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ background: "#091a3d", borderBottom: `1px solid ${BORDER}`, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: "#1e3a6e", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 2 }}>
          <div style={{ width: 14, height: 2, background: "#93c5fd", borderRadius: 1 }} />
          <div style={{ width: 14, height: 2, background: "#93c5fd", borderRadius: 1 }} />
          <div style={{ width: 14, height: 2, background: "#93c5fd", borderRadius: 1 }} />
        </div>
        <div>
          <p style={{ color: TEXT, fontSize: 14, fontWeight: 800, margin: 0 }}>Escanear DPI</p>
          <p style={{ color: MUTED, fontSize: 10, margin: 0 }}>Documento Personal de Identificacion</p>
        </div>
      </div>
      {children}
    </div>
  );
}
