import { useCallback, useEffect, useState } from "react";
import {
  X, Loader2, MapPin, ShieldCheck, CheckCircle2, XCircle, UserCheck,
  AlertTriangle, ClipboardList, QrCode, FileText,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "/api";

interface AgenteRow {
  id: number;
  nombre: string;
  tipo_personal: string;
  orden: number;
  tiene_carnet: boolean;
  inspecciones_hoy: number;
}
interface VisitaInfo {
  id: number;
  cliente_id: number | null;
  puesto_id: number | null;
  estado: string;
  cliente_nombre: string | null;
  puesto_nombre: string | null;
  puesto_direccion: string | null;
}

export interface VisitaProgramada {
  id: number;
  cliente_nombre: string | null;
  puesto_nombre: string | null;
  puesto_direccion: string | null;
  estado: string;
}

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  visita: VisitaProgramada | null;
  auth: { device_uuid: string; device_token: string; qr_token: string } | null;
  /** Se llama cuando el supervisor pide inspeccionar un agente concreto */
  onInspeccionar: (agenteId: number) => void;
  /** Se llama también cuando la visita se completó/marcó como no realizada */
  onFinalizada: () => void;
}

export function ModalVisitaPuesto({
  abierto, onCerrar, visita, auth, onInspeccionar, onFinalizada,
}: Props) {
  const [agentes, setAgentes] = useState<AgenteRow[]>([]);
  const [info, setInfo] = useState<VisitaInfo | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState("");
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(async () => {
    if (!auth || !visita) return;
    setCargando(true); setError(null);
    try {
      const r = await fetch(`${API}/agente/supervision/visita/agentes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...auth, programacion_id: visita.id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "No se pudo cargar el puesto");
      setInfo(j.visita || null);
      setAgentes(j.agentes || []);
    } catch (e: any) { setError(e.message || "Error"); }
    finally { setCargando(false); }
  }, [auth, visita]);

  useEffect(() => {
    if (!abierto) {
      setAgentes([]); setInfo(null); setError(null);
      setObservaciones(""); setTrabajando(false);
      return;
    }
    void cargar();
  }, [abierto, cargar]);

  const completar = async () => {
    if (!auth || !visita || trabajando) return;
    // Confirmación previa: si no se registró ninguna inspección, advertir ANTES
    // de hacer la mutación, para no dejar la visita completada y la novedad
    // vacía si el supervisor cancela. inspecciones_hoy refleja conteo real
    // recargado al abrir el modal.
    const totalLocal = agentes.reduce((acc, a) => acc + (a.inspecciones_hoy || 0), 0);
    if (totalLocal === 0) {
      const seguir = window.confirm(
        "No registró ninguna inspección de agentes en este puesto. " +
        "¿Marcar la visita como completada de todos modos (sin novedad)?"
      );
      if (!seguir) return;
    }
    setTrabajando(true); setError(null);
    try {
      const r = await fetch(`${API}/agente/supervision/visita/completar-con-novedad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...auth,
          programacion_id: visita.id,
          observaciones: observaciones.trim() || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Error al completar");
      onFinalizada();
      onCerrar();
    } catch (e: any) { setError(e.message || "Error"); }
    finally { setTrabajando(false); }
  };

  const noRealizada = async () => {
    if (!auth || !visita || trabajando) return;
    const motivo = window.prompt("Motivo (obligatorio, mín. 3 caracteres):") || "";
    if (motivo.trim().length < 3) return;
    setTrabajando(true); setError(null);
    try {
      const r = await fetch(`${API}/agente/supervision/no-realizada`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...auth, programacion_id: visita.id, motivo: motivo.trim(),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Error");
      onFinalizada();
      onCerrar();
    } catch (e: any) { setError(e.message || "Error"); }
    finally { setTrabajando(false); }
  };

  if (!abierto || !visita) return null;
  const totalInsp = agentes.reduce((acc, a) => acc + (a.inspecciones_hoy || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-lg max-h-[95vh] overflow-y-auto bg-[#0b1424] sm:rounded-xl border-t sm:border border-white/10">
        <header className="sticky top-0 bg-[#0b1424] border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-bold inline-flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-violet-300" />
            Supervisión del puesto
          </h2>
          <button onClick={onCerrar} className="text-white/60 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-4 space-y-4">
          <section className="bg-violet-500/10 border border-violet-500/30 rounded p-3">
            <p className="text-[11px] text-violet-200/80 uppercase tracking-wide">Destino</p>
            <h3 className="text-sm font-bold mt-0.5">
              {[visita.cliente_nombre, visita.puesto_nombre].filter(Boolean).join(" · ") || "Sin destino"}
            </h3>
            {visita.puesto_direccion && (
              <p className="text-[11px] text-white/60 inline-flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" /> {visita.puesto_direccion}
              </p>
            )}
          </section>

          {error && (
            <p className="text-xs text-rose-300 inline-flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> {error}
            </p>
          )}

          <section>
            <p className="text-[11px] text-white/50 uppercase mb-1.5">
              Agentes asignados al puesto
              {!cargando && agentes.length > 0 && ` (${agentes.length})`}
            </p>

            {cargando && (
              <p className="text-xs text-white/60 inline-flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando agentes…
              </p>
            )}

            {!cargando && agentes.length === 0 && (
              <p className="text-xs text-white/50 bg-white/5 rounded p-3">
                No hay titulares activos para este puesto.
              </p>
            )}

            <div className="space-y-1.5">
              {agentes.map(a => (
                <div key={a.id}
                  className="flex items-center justify-between gap-2 bg-white/5 border border-white/10 rounded p-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{a.nombre}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-white/50">
                        Orden {a.orden} · {a.tipo_personal}
                      </span>
                      {a.tiene_carnet ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-300">
                          <QrCode className="w-3 h-3" /> carnet
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-300">
                          <AlertTriangle className="w-3 h-3" /> sin carnet
                        </span>
                      )}
                      {a.inspecciones_hoy > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-violet-300">
                          <CheckCircle2 className="w-3 h-3" /> {a.inspecciones_hoy} hoy
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onInspeccionar(a.id)}
                    className="px-2.5 py-1.5 text-xs font-medium rounded border border-violet-500/40 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25 inline-flex items-center gap-1 whitespace-nowrap">
                    <ShieldCheck className="w-3.5 h-3.5" /> Inspeccionar
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <label className="text-[11px] text-white/60 uppercase inline-flex items-center gap-1">
              <FileText className="w-3 h-3" /> Observaciones de la novedad (opcional)
            </label>
            <textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Qué encontró en general en este puesto…"
              className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs mt-1" />
            <p className="text-[10px] text-white/40 mt-1">
              {totalInsp > 0
                ? `Se generará la novedad consolidando ${totalInsp} inspección(es) registrada(s) en este puesto.`
                : "Si registra inspecciones, se consolidan en la novedad al completar la visita."}
            </p>
          </section>

          <div className="grid grid-cols-1 gap-2 pt-2 border-t border-white/10">
            <button onClick={completar} disabled={trabajando}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3 rounded inline-flex items-center justify-center gap-2 text-sm">
              {trabajando ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              Completar visita y generar novedad
            </button>
            <button onClick={noRealizada} disabled={trabajando}
              className="bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/40 text-rose-100 font-semibold py-2.5 rounded inline-flex items-center justify-center gap-2 text-sm">
              <XCircle className="w-4 h-4" /> Marcar como no realizada
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
