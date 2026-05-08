import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  X, QrCode, Loader2, ShieldCheck, AlertTriangle, CheckCircle2, FileWarning,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "/api";

interface CatalogoItem {
  id: number; categoria: "equipo" | "presentacion" | "arma" | "otro";
  clave: string; etiqueta: string; tipo: "boolean" | "numero" | "texto"; orden: number;
}
interface AgenteInfo {
  id: number; nombre: string; tipo_personal: string;
  puesto_id: number | null; puesto_nombre: string | null;
  cliente_id: number | null; cliente_nombre: string | null;
}
interface ArmaInfo {
  id: number; codigo: string; tipo: string;
  marca: string | null; modelo: string | null; calibre: string | null; serie: string | null;
  numero_portacion: string | null; numero_tenencia: string | null;
  vence_portacion: string | null; vence_tenencia: string | null;
}
interface InfoResp {
  ok: true; agente: AgenteInfo; arma: ArmaInfo | null; catalogo: CatalogoItem[];
}

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  auth: { device_uuid: string; device_token: string; qr_token: string } | null;
  onRegistrado: () => void;
  gpsActual: { lat: number; lng: number } | null;
}

const TIPOS_ALERTA_ARMA = [
  { tipo: "arma_mal_estado",       label: "Arma en mal estado" },
  { tipo: "portacion_extraviada",  label: "Portación extraviada" },
  { tipo: "portacion_no_legible",  label: "Portación no legible" },
  { tipo: "tenencia_extraviada",   label: "Tenencia extraviada" },
  { tipo: "tenencia_no_legible",   label: "Tenencia no legible (copia ilegible)" },
] as const;

export function ModalInspeccion({ abierto, onCerrar, auth, onRegistrado, gpsActual }: Props) {
  const [scanning, setScanning] = useState(false);
  const [info, setInfo] = useState<InfoResp | null>(null);
  const [datos, setDatos] = useState<Record<string, any>>({});
  const [observaciones, setObservaciones] = useState("");
  const [armaAbierta, setArmaAbierta] = useState(false);
  const [alertasArma, setAlertasArma] = useState<Set<string>>(new Set());
  const [armaDescripcion, setArmaDescripcion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const reset = useCallback(() => {
    setInfo(null); setDatos({}); setObservaciones("");
    setArmaAbierta(false); setAlertasArma(new Set()); setArmaDescripcion("");
    setError(null); setScanning(false);
  }, []);

  const stopScan = useCallback(async () => {
    try { await scannerRef.current?.stop(); scannerRef.current?.clear(); } catch {}
    scannerRef.current = null;
    setScanning(false);
  }, []);

  // Al cerrar el modal: detener cámara antes de resetear estado.
  useEffect(() => {
    if (!abierto) {
      void (async () => { await stopScan(); reset(); })();
    }
  }, [abierto, reset, stopScan]);

  useEffect(() => () => { void stopScan(); }, [stopScan]);

  const cargarAgente = useCallback(async (token: string) => {
    if (!auth) return;
    setError(null);
    try {
      const r = await fetch(`${API}/agente/supervision/inspeccion/agente-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...auth, agente_qr_token: token }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "No se pudo cargar el agente");
      setInfo(j);
    } catch (e: any) { setError(e.message || "Error"); }
  }, [auth]);

  const startScan = useCallback(async () => {
    setError(null); setScanning(true);
    try {
      const sc = new Html5Qrcode("isp-insp-scanner");
      scannerRef.current = sc;
      await sc.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          let token = decoded.trim();
          const m = token.match(/\/agente\/scan\/([^/?#]+)/);
          if (m) token = m[1];
          await stopScan();
          await cargarAgente(token);
        },
        () => {}
      );
    } catch (e: any) {
      setScanning(false);
      setError("No se pudo abrir la cámara: " + (e.message || e));
    }
  }, [cargarAgente, stopScan]);

  const toggleAlerta = (tipo: string) => {
    setAlertasArma(prev => {
      const n = new Set(prev);
      n.has(tipo) ? n.delete(tipo) : n.add(tipo);
      return n;
    });
  };

  const guardar = async () => {
    if (!auth || !info) return;
    setEnviando(true); setError(null);
    try {
      const armaEstado = info.arma ? {
        revisada: armaAbierta,
        alertas: Array.from(alertasArma).map(tipo => ({
          tipo,
          descripcion: armaDescripcion.trim() || undefined,
        })),
      } : null;
      const r = await fetch(`${API}/agente/supervision/inspeccion/registrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...auth,
          agente_employee_id: info.agente.id,
          datos, observaciones: observaciones.trim() || undefined,
          arma_id: info.arma?.id ?? null,
          arma_estado: armaEstado,
          lat: gpsActual?.lat, lng: gpsActual?.lng,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Error al guardar");
      onRegistrado();
      onCerrar();
    } catch (e: any) {
      setError(e.message || "Error");
    } finally { setEnviando(false); }
  };

  if (!abierto) return null;

  const itemsEquipo = info?.catalogo.filter(c => c.categoria === "equipo") || [];
  const itemsPres   = info?.catalogo.filter(c => c.categoria === "presentacion") || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-lg max-h-[95vh] overflow-y-auto bg-[#0b1424] sm:rounded-xl border-t sm:border border-white/10">
        <header className="sticky top-0 bg-[#0b1424] border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-violet-300" />
            Inspección de agente
          </h2>
          <button onClick={onCerrar} className="text-white/60 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-4 space-y-4">
          {!info && (
            <>
              <p className="text-xs text-white/60">
                Escanee el carnet QR del agente que va a supervisar.
              </p>
              <div id="isp-insp-scanner" className="w-full max-w-xs mx-auto rounded overflow-hidden border border-white/10" />
              <div className="flex justify-center">
                {!scanning ? (
                  <button onClick={startScan}
                    className="px-4 py-2 bg-primary text-black text-sm font-bold rounded inline-flex items-center gap-2">
                    <QrCode className="w-4 h-4" /> Escanear carnet del agente
                  </button>
                ) : (
                  <button onClick={stopScan} className="px-4 py-2 bg-white/10 text-white text-sm rounded">
                    Cancelar
                  </button>
                )}
              </div>
            </>
          )}

          {info && (
            <>
              <div className="bg-violet-500/10 border border-violet-500/30 rounded p-3">
                <p className="text-[11px] text-violet-200/70 uppercase tracking-wide">Agente</p>
                <p className="text-sm font-bold">{info.agente.nombre}</p>
                {info.agente.puesto_nombre && (
                  <p className="text-[11px] text-white/60 mt-0.5">
                    {info.agente.cliente_nombre} · {info.agente.puesto_nombre}
                  </p>
                )}
              </div>

              <Seccion titulo="Equipo">
                {itemsEquipo.map(it => (
                  <ItemForm key={it.id} item={it} valor={datos[it.clave]}
                    onChange={(v) => setDatos(d => ({ ...d, [it.clave]: v }))} />
                ))}
              </Seccion>

              <Seccion titulo="Presentación personal">
                {itemsPres.map(it => (
                  <ItemForm key={it.id} item={it} valor={datos[it.clave]}
                    onChange={(v) => setDatos(d => ({ ...d, [it.clave]: v }))} />
                ))}
              </Seccion>

              {info.arma && (
                <div className="border border-amber-500/30 rounded">
                  <button onClick={() => setArmaAbierta(v => !v)}
                    className="w-full text-left p-3 flex items-center justify-between hover:bg-amber-500/5">
                    <div>
                      <p className="text-[11px] text-amber-200/80 uppercase">Arma asignada</p>
                      <p className="text-sm font-bold">{info.arma.codigo} · {info.arma.tipo}</p>
                      <p className="text-[11px] text-white/60">
                        {[info.arma.marca, info.arma.modelo, info.arma.calibre].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span className="text-xs text-white/50">{armaAbierta ? "▲" : "▼"}</span>
                  </button>
                  {armaAbierta && (
                    <div className="p-3 border-t border-amber-500/20 space-y-2 text-xs">
                      <DocLine label="Portación" numero={info.arma.numero_portacion} vence={info.arma.vence_portacion} />
                      <DocLine label="Tenencia"  numero={info.arma.numero_tenencia}  vence={info.arma.vence_tenencia} />
                      <p className="text-[11px] text-white/50 mt-2 flex items-center gap-1">
                        <FileWarning className="w-3 h-3" /> Marque problemas observados:
                      </p>
                      <div className="space-y-1.5">
                        {TIPOS_ALERTA_ARMA.map(({ tipo, label }) => (
                          <label key={tipo} className="flex items-center gap-2 text-[12px]">
                            <input type="checkbox" checked={alertasArma.has(tipo)}
                              onChange={() => toggleAlerta(tipo)}
                              className="accent-rose-500" />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                      {alertasArma.size > 0 && (
                        <textarea value={armaDescripcion}
                          onChange={e => setArmaDescripcion(e.target.value)}
                          placeholder="Descripción / detalles de la observación"
                          className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs"
                          rows={2} />
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-[11px] text-white/60 uppercase">Observaciones generales</label>
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}
                  rows={3}
                  className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs mt-1" />
              </div>

              {error && <p className="text-xs text-rose-300">{error}</p>}

              <button onClick={guardar} disabled={enviando}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3 rounded inline-flex items-center justify-center gap-2">
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Guardar inspección
              </button>
            </>
          )}

          {error && !info && <p className="text-xs text-rose-300 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> {error}
          </p>}
        </div>
      </div>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-white/50 uppercase mb-1">{titulo}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ItemForm({ item, valor, onChange }: {
  item: CatalogoItem; valor: any; onChange: (v: any) => void;
}) {
  if (item.tipo === "boolean") {
    return (
      <label className="flex items-center justify-between gap-2 text-xs bg-white/5 px-3 py-2 rounded">
        <span>{item.etiqueta}</span>
        <input type="checkbox" checked={!!valor} onChange={e => onChange(e.target.checked)}
          className="accent-emerald-500 w-4 h-4" />
      </label>
    );
  }
  if (item.tipo === "numero") {
    return (
      <label className="flex items-center justify-between gap-2 text-xs bg-white/5 px-3 py-2 rounded">
        <span>{item.etiqueta}</span>
        <input type="number" inputMode="numeric" value={valor ?? ""}
          onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="w-20 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-right" />
      </label>
    );
  }
  return (
    <label className="block text-xs bg-white/5 px-3 py-2 rounded">
      <span className="block mb-1">{item.etiqueta}</span>
      <input type="text" value={valor ?? ""} onChange={e => onChange(e.target.value)}
        className="w-full bg-black/40 border border-white/10 rounded px-2 py-1" />
    </label>
  );
}

function DocLine({ label, numero, vence }: { label: string; numero: string | null; vence: string | null }) {
  return (
    <div className="flex justify-between text-[12px]">
      <span className="text-white/50">{label}:</span>
      <span className="text-white/90">
        {numero || <span className="text-rose-300">— sin registrar</span>}
        {vence && <span className="text-white/40 ml-1">(vence {vence})</span>}
      </span>
    </div>
  );
}
