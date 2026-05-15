import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PortalLayout } from "@/portal/layout/PortalLayout";
import { portalGet } from "@/lib/portalApi";
import { Clock, CheckCircle2, AlertCircle, Info } from "lucide-react";
import {
  PeriodoToggle, CumplimientoCard, QrEventListItem,
  PERIODO_LABEL,
  type Periodo, type FichajeCore, type CumplimientoFichajes,
} from "@/shared/operaciones";

interface CumplimientoResp { fichajes: CumplimientoFichajes | null }

function nombreAgente(f: FichajeCore): string {
  const n = `${f.nombres ?? ""} ${f.apellidos ?? ""}`.trim();
  return n || `#${f.empl_numero ?? f.employee_id ?? "?"}`;
}

export default function PortalFichajes() {
  const [periodo, setPeriodo] = useState<Periodo>("7d");

  const { data: fichajes = [], isLoading } = useQuery<FichajeCore[]>({
    queryKey: ["portal-qr-fichajes", periodo],
    queryFn: () => portalGet<FichajeCore[]>(`/portal/qr/fichajes?periodo=${periodo}`),
  });

  const { data: cumpl } = useQuery<CumplimientoResp>({
    queryKey: ["portal-qr-cumplimiento-fich", periodo],
    queryFn: () => portalGet<CumplimientoResp>(`/portal/qr/cumplimiento?periodo=${periodo}`),
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
        <PeriodoToggle value={periodo} onChange={setPeriodo} />
      </div>

      {cumpl?.fichajes && cumpl.fichajes.total_puestos > 0 && (
        <CumplimientoCard
          titulo="Cobertura de fichajes"
          pct={cumpl.fichajes.pct_cobertura}
          totalAgregado={cumpl.fichajes.puestos_con_fichaje}
          totalUniverso={cumpl.fichajes.total_puestos}
          agregadoLabel="puestos"
          items={cumpl.fichajes.detalle.map((p) => ({
            id: p.puesto_id,
            nombre: p.puesto_nombre,
            conteo: p.total_fichajes,
            ultimo: p.ultimo,
            unidad: "fichaje",
          }))}
        />
      )}

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
              <QrEventListItem
                key={f.id}
                resultado={f.resultado}
                icono={f.resultado === "ok"
                  ? <CheckCircle2 className="w-4 h-4" />
                  : <AlertCircle className="w-4 h-4" />}
                titulo={nombreAgente(f)}
                chip={f.tipo}
                subtituloIzq={f.puesto_nombre}
                cuando={f.registrado_en}
                distanciaMetros={f.distancia_metros}
              />
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
