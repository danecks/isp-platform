import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw, Users, ShieldCheck } from "lucide-react";
import { PortalLayout } from "@/portal/layout/PortalLayout";
import { portalGet } from "@/lib/portalApi";
import {
  TablaCustodias,
  type Custodia,
} from "./operativo/TablaCustodias";
import {
  TablaPuestos,
  type PuestoLive,
} from "./operativo/TablaPuestos";

interface CustodiasResp {
  fecha: string;
  custodias: Custodia[];
  resumen: { esperados: number; presentes: number; faltantes: number };
}

interface PuestosResp {
  fecha: string;
  puestos: PuestoLive[];
  resumen: { total: number; cubiertos: number; descubiertos: number };
}

const REFRESH_MS = 30_000;

function Stat({
  label, value, total, color,
}: { label: string; value: number; total?: number; color: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3 min-w-0 flex-1">
      <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
        {label}
      </p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>
        {value}
        {total !== undefined && (
          <span className="text-sm text-white/30 font-normal"> / {total}</span>
        )}
      </p>
    </div>
  );
}

export default function PortalOperativo() {
  const custodiasQ = useQuery<CustodiasResp>({
    queryKey: ["portal-operativo-custodias"],
    queryFn: () => portalGet<CustodiasResp>("/portal/operativo/custodias"),
    refetchInterval: REFRESH_MS,
  });
  const puestosQ = useQuery<PuestosResp>({
    queryKey: ["portal-operativo-puestos"],
    queryFn: () => portalGet<PuestosResp>("/portal/operativo/puestos"),
    refetchInterval: REFRESH_MS,
  });

  const cust = custodiasQ.data;
  const pst  = puestosQ.data;

  const totalAgentesEsperados =
    (cust?.resumen.esperados ?? 0) + (pst?.resumen.total ?? 0);
  const totalAgentesPresentes =
    (cust?.resumen.presentes ?? 0) + (pst?.resumen.cubiertos ?? 0);

  const cargando = custodiasQ.isLoading || puestosQ.isLoading;
  const error    = custodiasQ.isError    || puestosQ.isError;
  const fecha    = cust?.fecha ?? pst?.fecha ?? "";

  return (
    <PortalLayout title="Operativo en vivo">
      <div className="space-y-5">
        {/* Header con resumen global */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-white">Operativo en vivo</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary font-semibold uppercase tracking-wider">
                Tiempo real
              </span>
            </div>
            <p className="text-xs text-white/40 mt-1">
              {fecha && `Fecha: ${fecha} · `}Refresco automático cada 30s
              {(custodiasQ.isFetching || puestosQ.isFetching) && (
                <RefreshCw className="inline-block w-3 h-3 ml-1.5 animate-spin text-primary/70" />
              )}
            </p>
          </div>
          <div className="flex gap-2 w-full md:w-auto md:min-w-[420px]">
            <Stat
              label="Agentes presentes"
              value={totalAgentesPresentes}
              total={totalAgentesEsperados}
              color="text-green-300"
            />
            <Stat
              label="Puestos cubiertos"
              value={pst?.resumen.cubiertos ?? 0}
              total={pst?.resumen.total ?? 0}
              color="text-blue-300"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-200">
            No fue posible cargar el operativo. Reintentando…
          </div>
        )}

        {cargando && !cust && !pst && (
          <div className="text-center py-10 text-white/40 text-sm">
            Cargando operativo en vivo…
          </div>
        )}

        {/* Sección custodias */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-amber-300/70" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Custodias
            </h3>
            {cust && (
              <span className="text-[10px] text-white/40">
                ({cust.resumen.presentes} de {cust.resumen.esperados} presentes,{" "}
                {cust.resumen.faltantes} faltantes)
              </span>
            )}
          </div>
          {cust && <TablaCustodias custodias={cust.custodias} />}
        </section>

        {/* Sección puestos fijos */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-blue-300/70" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Puestos fijos
            </h3>
            {pst && (
              <span className="text-[10px] text-white/40">
                ({pst.resumen.cubiertos} cubiertos, {pst.resumen.descubiertos}{" "}
                descubiertos)
              </span>
            )}
          </div>
          {pst && <TablaPuestos puestos={pst.puestos} />}
        </section>
      </div>
    </PortalLayout>
  );
}
