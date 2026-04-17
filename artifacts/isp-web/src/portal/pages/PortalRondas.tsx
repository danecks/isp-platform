import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PortalLayout } from "@/portal/layout/PortalLayout";
import { portalGet } from "@/lib/portalApi";
import { MapPin, Clock, CheckCircle2, AlertCircle, QrCode, Info } from "lucide-react";

type Periodo = "hoy" | "7d" | "15d";

interface RondaEvento {
  id: number;
  escaneado_en: string;
  resultado: string;
  distancia_metros: number | null;
  punto_id: number;
  punto_nombre: string;
  ronda_id: number;
  ronda_nombre: string;
  user_id: number | null;
  user_nombre: string | null;
  username: string | null;
}

interface Cumplimiento {
  rondas: {
    total_puntos: number;
    puntos_con_escaneo: number;
    pct_cumplimiento: number | null;
    detalle: Array<{
      punto_id: number;
      punto_nombre: string;
      escaneos: number;
      ultimo: string | null;
    }>;
  } | null;
}

const PERIODO_LABEL: Record<Periodo, string> = {
  hoy: "Hoy",
  "7d": "Últimos 7 días",
  "15d": "Últimos 15 días",
};

function formatDateTime(str: string) {
  return new Date(str).toLocaleString("es-GT", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function PortalRondas() {
  const [periodo, setPeriodo] = useState<Periodo>("7d");

  const { data: eventos = [], isLoading } = useQuery<RondaEvento[]>({
    queryKey: ["portal-qr-rondas", periodo],
    queryFn: () => portalGet<RondaEvento[]>(`/portal/qr/rondas?periodo=${periodo}`),
  });

  const { data: cumpl } = useQuery<Cumplimiento>({
    queryKey: ["portal-qr-cumplimiento-rondas", periodo],
    queryFn: () => portalGet<Cumplimiento>(`/portal/qr/cumplimiento?periodo=${periodo}`),
  });

  return (
    <PortalLayout title="Rondas QR">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Rondas de Vigilancia</h2>
          <p className="text-sm text-white/40 mt-1">
            Recorridos QR escaneados por los agentes en sus puestos
          </p>
        </div>
        <div className="flex gap-1 bg-[#0d1c30] border border-white/5 rounded-lg p-1">
          {(["hoy", "7d", "15d"] as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                periodo === p
                  ? "bg-primary text-white font-semibold"
                  : "text-white/50 hover:text-white"
              }`}
            >
              {PERIODO_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Cumplimiento por punto QR */}
      {cumpl?.rondas && cumpl.rondas.total_puntos > 0 && (
        <div className="bg-[#0d1c30] border border-white/5 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Cumplimiento de rondas</h3>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {cumpl.rondas.pct_cumplimiento ?? 0}%
              </div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">
                {cumpl.rondas.puntos_con_escaneo} de {cumpl.rondas.total_puntos} puntos QR
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {cumpl.rondas.detalle.map((p) => (
              <div
                key={p.punto_id}
                className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs text-white truncate">{p.punto_nombre}</p>
                  <p className="text-[10px] text-white/40">
                    {p.escaneos} escaneo{p.escaneos !== 1 ? "s" : ""}
                    {p.ultimo && ` · último ${formatDateTime(p.ultimo)}`}
                  </p>
                </div>
                {p.escaneos > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-400/60 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de eventos */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-white/40 text-sm animate-pulse">Cargando rondas...</div>
        </div>
      ) : eventos.length === 0 ? (
        <div className="bg-[#0d1c30] border border-white/5 rounded-xl p-12 text-center">
          <QrCode className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/40 text-sm">
            No hay rondas registradas en {PERIODO_LABEL[periodo].toLowerCase()}
          </p>
        </div>
      ) : (
        <div className="bg-[#0d1c30] border border-white/5 rounded-xl overflow-hidden">
          <div className="divide-y divide-white/5">
            {eventos.map((ev) => (
              <div key={ev.id} className="px-5 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      ev.resultado === "ok"
                        ? "bg-green-400/10 text-green-400"
                        : "bg-yellow-400/10 text-yellow-400"
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-white font-medium">{ev.punto_nombre}</span>
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary/70 border border-primary/20">
                        {ev.ronda_nombre}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/50 mt-1 flex-wrap">
                      {ev.user_nombre && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {ev.user_nombre}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatDateTime(ev.escaneado_en)}
                      </span>
                      {ev.distancia_metros != null && (
                        <span className="text-white/30">{ev.distancia_metros}m del punto</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 bg-primary/5 border border-primary/10 rounded-xl p-4 mt-6">
        <Info className="w-4 h-4 text-primary/70 mt-0.5 shrink-0" />
        <p className="text-xs text-white/50">
          Los códigos QR de ronda están físicamente colocados en puntos estratégicos de su instalación.
          Los agentes deben escanearlos durante su recorrido para confirmar que realizaron la verificación.
        </p>
      </div>
    </PortalLayout>
  );
}
