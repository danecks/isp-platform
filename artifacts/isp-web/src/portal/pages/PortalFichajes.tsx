import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PortalLayout } from "@/portal/layout/PortalLayout";
import { portalGet } from "@/lib/portalApi";
import { Clock, MapPin, User, CheckCircle2, AlertCircle, Info } from "lucide-react";

type Periodo = "hoy" | "7d" | "15d";

interface Fichaje {
  id: number;
  tipo: string;
  resultado: string;
  registrado_en: string;
  distancia_metros: number | null;
  calificacion: number | null;
  employee_id: number | null;
  nombres: string | null;
  apellidos: string | null;
  empl_numero: string | null;
  puesto_id: number;
  puesto_nombre: string;
}

interface Cumplimiento {
  fichajes: {
    total_puestos: number;
    puestos_con_fichaje: number;
    pct_cobertura: number | null;
    detalle: Array<{
      puesto_id: number;
      puesto_nombre: string;
      total_fichajes: number;
      fichajes_ok: number;
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

function formatNombre(f: Fichaje): string {
  const n = `${f.nombres ?? ""} ${f.apellidos ?? ""}`.trim();
  return n || `#${f.empl_numero ?? f.employee_id ?? "?"}`;
}

export default function PortalFichajes() {
  const [periodo, setPeriodo] = useState<Periodo>("7d");

  const { data: fichajes = [], isLoading } = useQuery<Fichaje[]>({
    queryKey: ["portal-qr-fichajes", periodo],
    queryFn: () => portalGet<Fichaje[]>(`/portal/qr/fichajes?periodo=${periodo}`),
  });

  const { data: cumpl } = useQuery<Cumplimiento>({
    queryKey: ["portal-qr-cumplimiento-fich", periodo],
    queryFn: () => portalGet<Cumplimiento>(`/portal/qr/cumplimiento?periodo=${periodo}`),
  });

  return (
    <PortalLayout title="Fichajes QR">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Fichajes de Agentes</h2>
          <p className="text-sm text-white/40 mt-1">
            Registro de entradas y salidas del personal en sus puestos
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

      {/* Cumplimiento por puesto */}
      {cumpl?.fichajes && cumpl.fichajes.total_puestos > 0 && (
        <div className="bg-[#0d1c30] border border-white/5 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Cobertura de fichajes</h3>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {cumpl.fichajes.pct_cobertura ?? 0}%
              </div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">
                {cumpl.fichajes.puestos_con_fichaje} de {cumpl.fichajes.total_puestos} puestos
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {cumpl.fichajes.detalle.map((p) => (
              <div
                key={p.puesto_id}
                className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs text-white truncate">{p.puesto_nombre}</p>
                  <p className="text-[10px] text-white/40">
                    {p.total_fichajes} fichaje{p.total_fichajes !== 1 ? "s" : ""}
                    {p.ultimo && ` · último ${formatDateTime(p.ultimo)}`}
                  </p>
                </div>
                {p.total_fichajes > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-400/60 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de fichajes */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-white/40 text-sm animate-pulse">Cargando fichajes...</div>
        </div>
      ) : fichajes.length === 0 ? (
        <div className="bg-[#0d1c30] border border-white/5 rounded-xl p-12 text-center">
          <Clock className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/40 text-sm">
            No hay fichajes registrados en {PERIODO_LABEL[periodo].toLowerCase()}
          </p>
        </div>
      ) : (
        <div className="bg-[#0d1c30] border border-white/5 rounded-xl overflow-hidden">
          <div className="divide-y divide-white/5">
            {fichajes.map((f) => (
              <div key={f.id} className="px-5 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      f.resultado === "ok"
                        ? "bg-green-400/10 text-green-400"
                        : "bg-yellow-400/10 text-yellow-400"
                    }`}
                  >
                    {f.resultado === "ok" ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <AlertCircle className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-white font-medium">{formatNombre(f)}</span>
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary/70 border border-primary/20">
                        {f.tipo}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/50 mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {f.puesto_nombre}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatDateTime(f.registrado_en)}
                      </span>
                      {f.distancia_metros != null && (
                        <span className="text-white/30">{f.distancia_metros}m del punto</span>
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
          Los fichajes son registrados por los agentes mediante código QR al iniciar y terminar
          su turno en el puesto asignado. Solo se muestran fichajes de puestos contratados por su empresa.
        </p>
      </div>
    </PortalLayout>
  );
}
