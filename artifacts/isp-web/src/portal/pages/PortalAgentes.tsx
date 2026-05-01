import { useQuery } from "@tanstack/react-query";
import { PortalLayout } from "@/portal/layout/PortalLayout";
import { portalGet } from "@/lib/portalApi";
import { Users, MapPin, User, Calendar, ShieldCheck, Info, Activity } from "lucide-react";

interface Agente {
  asignacionId: number;
  codigoAsignacion: string | null;
  puesto: string | null;
  servicio: string | null;
  ubicacion: string | null;
  supervisorNombre: string | null;
  fechaInicio: string;
  fechaFin: string | null;
  estadoAsignacion: string;
  empleadoNombreCompleto: string;
  empleadoArea: string | null;
  empleadoEstadoLaboral: string;
  empleadoSede: string | null;
  empleadoFuente: string;
  enServicioAhora?: boolean;
}

const ESTADO_LAB_COLOR: Record<string, string> = {
  activo: "text-green-400 bg-green-400/10 border-green-400/20",
  inactivo: "text-white/40 bg-white/5 border-white/10",
  licencia: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  suspendido: "text-red-400 bg-red-400/10 border-red-400/20",
};

const ESTADO_LAB_LABEL: Record<string, string> = {
  activo: "Activo",
  inactivo: "Inactivo",
  licencia: "En Licencia",
  suspendido: "Suspendido",
};

function formatFecha(str: string) {
  return new Date(str).toLocaleDateString("es-GT", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function calcularTiempo(fechaInicio: string): string {
  const meses = Math.floor(
    (Date.now() - new Date(fechaInicio).getTime()) / (1000 * 60 * 60 * 24 * 30)
  );
  if (meses < 1) return "Menos de un mes";
  if (meses < 12) return `${meses} mes${meses !== 1 ? "es" : ""}`;
  const años = Math.floor(meses / 12);
  const mesesRest = meses % 12;
  return `${años} año${años !== 1 ? "s" : ""}${mesesRest > 0 ? ` ${mesesRest} mes${mesesRest !== 1 ? "es" : ""}` : ""}`;
}

function initials(nombre: string | null | undefined): string {
  if (!nombre || typeof nombre !== "string") return "—";
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  return parts
    .slice(0, 2)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase();
}

export default function PortalAgentes() {
  const { data = [], isLoading, isError } = useQuery<Agente[]>({
    queryKey: ["portal-agentes"],
    queryFn: () => portalGet<Agente[]>("/portal/agentes"),
  });

  return (
    <PortalLayout title="Mis Agentes">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Agentes Asignados</h2>
        <p className="text-sm text-white/40 mt-1">
          Personal de seguridad de ISP, S.A. asignado a su cuenta
        </p>
      </div>

      {/* Nota de privacidad */}
      <div className="flex items-start gap-3 bg-primary/5 border border-primary/10 rounded-xl p-4 mb-6">
        <Info className="w-4 h-4 text-primary/70 mt-0.5 shrink-0" />
        <p className="text-xs text-white/50">
          Por seguridad y privacidad, esta ficha muestra únicamente información
          operativa del agente. Datos personales (DPI, teléfono, correo) son
          de acceso exclusivo interno de ISP, S.A.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-white/40 text-sm animate-pulse">Cargando agentes...</div>
        </div>
      ) : isError ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center text-sm text-red-400">
          Error al cargar agentes asignados.
        </div>
      ) : data.length === 0 ? (
        <div className="bg-[#0d1c30] border border-white/5 rounded-xl p-12 text-center">
          <Users className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/40 text-sm">No hay agentes asignados a su cuenta</p>
          <p className="text-white/25 text-xs mt-1">
            Contacte a su ejecutivo de cuenta para más información
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {data.map((agente) => (
            <div
              key={agente.asignacionId}
              className="bg-[#0d1c30] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-colors"
            >
              {/* Card header */}
              <div className="bg-gradient-to-r from-primary/10 to-transparent px-5 pt-5 pb-4 flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold text-sm">
                    {initials(agente.empleadoNombreCompleto)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white text-sm leading-tight truncate">
                    {agente.empleadoNombreCompleto}
                  </h3>
                  {agente.codigoAsignacion && (
                    <p className="text-[10px] font-mono text-primary/60 mt-0.5">
                      {agente.codigoAsignacion}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        ESTADO_LAB_COLOR[agente.empleadoEstadoLaboral] ?? "text-white/40 bg-white/5 border-white/10"
                      }`}
                    >
                      <ShieldCheck className="w-2.5 h-2.5 mr-1" />
                      {ESTADO_LAB_LABEL[agente.empleadoEstadoLaboral] ?? agente.empleadoEstadoLaboral}
                    </span>
                    {agente.enServicioAhora && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border text-emerald-300 bg-emerald-400/10 border-emerald-400/30">
                        <Activity className="w-2.5 h-2.5 mr-1 animate-pulse" />
                        En servicio ahora
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="px-5 pb-5 space-y-3">
                {agente.puesto && (
                  <div className="flex items-start gap-2">
                    <User className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-wider">Puesto / Servicio</p>
                      <p className="text-xs text-white mt-0.5">{agente.puesto}</p>
                      {agente.servicio && (
                        <p className="text-[10px] text-primary/60">{agente.servicio}</p>
                      )}
                    </div>
                  </div>
                )}

                {agente.ubicacion && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-wider">Ubicación</p>
                      <p className="text-xs text-white mt-0.5">{agente.ubicacion}</p>
                    </div>
                  </div>
                )}

                {agente.supervisorNombre && (
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-wider">Supervisor</p>
                      <p className="text-xs text-white mt-0.5">{agente.supervisorNombre}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <Calendar className="w-3.5 h-3.5 text-white/30 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">Asignado desde</p>
                    <p className="text-xs text-white mt-0.5">{formatFecha(agente.fechaInicio)}</p>
                    <p className="text-[10px] text-white/40">
                      {calcularTiempo(agente.fechaInicio)} de servicio
                    </p>
                  </div>
                </div>

                {/* Fuente de integración (info para admin/debug, texto discreto) */}
                {agente.empleadoFuente === "hr_sql_external" && (
                  <div className="mt-2 pt-2 border-t border-white/5">
                    <span className="inline-flex items-center gap-1 text-[9px] text-primary/40 uppercase tracking-wider">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      Verificado con RH
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {data.length > 0 && (
        <div className="mt-6 text-center text-xs text-white/25">
          {data.length} agente{data.length !== 1 ? "s" : ""} asignado{data.length !== 1 ? "s" : ""} a su cuenta
        </div>
      )}
    </PortalLayout>
  );
}
