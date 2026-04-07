import { useQuery } from "@tanstack/react-query";
import { PortalLayout } from "@/portal/layout/PortalLayout";
import { portalGet } from "@/lib/portalApi";
import {
  Shield, ShieldCheck, ShieldAlert, MapPin, Clock, User, Sun, Moon,
  CheckCircle2, AlertCircle, Building2,
} from "lucide-react";

interface Puesto {
  puesto_id: number;
  puesto_nombre: string;
  turno: string | null;
  jornada: string | null;
  horario: string | null;
  estado: string | null;
  sede_nombre: string | null;
  sede_direccion: string | null;
  zona_nombre: string | null;
  titular_nombre: string | null;
  titular_area: string | null;
}

interface CoberturaData {
  puestos: Puesto[];
  resumen: {
    total: number;
    cubiertos: number;
    vacantes: number;
    tasa: number;
  };
}

const TURNO_ICON: Record<string, React.ElementType> = {
  día: Sun,
  noche: Moon,
  diurno: Sun,
  nocturno: Moon,
};

function TurnoChip({ turno }: { turno: string | null }) {
  const label = turno ?? "—";
  const Icon = TURNO_ICON[label.toLowerCase()] ?? Clock;
  const isNight = ["noche", "nocturno"].includes(label.toLowerCase());
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium
      ${isNight
        ? "text-indigo-300 bg-indigo-400/10 border-indigo-400/20"
        : "text-amber-300 bg-amber-400/10 border-amber-400/20"}`}>
      <Icon className="w-3 h-3" />
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </span>
  );
}

function EstadoChip({ cubierto }: { cubierto: boolean }) {
  return cubierto ? (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border text-green-300 bg-green-400/10 border-green-400/20 font-medium">
      <CheckCircle2 className="w-3 h-3" />
      Cubierto
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border text-red-300 bg-red-400/10 border-red-400/20 font-medium">
      <AlertCircle className="w-3 h-3" />
      Vacante
    </span>
  );
}

function TasaBar({ tasa }: { tasa: number }) {
  const color = tasa >= 90 ? "bg-green-400" : tasa >= 70 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${tasa}%` }}
      />
    </div>
  );
}

export default function PortalCobertura() {
  const { data, isLoading, isError } = useQuery<CoberturaData>({
    queryKey: ["portal-cobertura"],
    queryFn: () => portalGet<CoberturaData>("/portal/cobertura"),
    refetchInterval: 60000,
  });

  const { puestos = [], resumen } = data ?? { puestos: [], resumen: { total: 0, cubiertos: 0, vacantes: 0, tasa: 0 } };

  // Agrupar por sede
  const sedes = puestos.reduce<Record<string, Puesto[]>>((acc, p) => {
    const key = p.sede_nombre ?? "Sin sede asignada";
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  return (
    <PortalLayout title="Cobertura de Puestos">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Cobertura de Puestos
          </h1>
          <p className="text-sm text-white/40 mt-1">
            Estado actual de todos sus puestos de seguridad contratados
          </p>
        </div>

        {/* Resumen */}
        {!isLoading && resumen && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Total puestos</p>
              <p className="text-2xl font-bold text-white">{resumen.total}</p>
            </div>
            <div className="bg-[#0c1829] border border-green-400/10 rounded-xl p-4">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Cubiertos</p>
              <p className="text-2xl font-bold text-green-400">{resumen.cubiertos}</p>
            </div>
            <div className="bg-[#0c1829] border border-red-400/10 rounded-xl p-4">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Vacantes</p>
              <p className="text-2xl font-bold text-red-400">{resumen.vacantes}</p>
            </div>
            <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Tasa de cobertura</p>
              <div className="flex items-center gap-2">
                <p className={`text-2xl font-bold ${resumen.tasa >= 90 ? "text-green-400" : resumen.tasa >= 70 ? "text-yellow-400" : "text-red-400"}`}>
                  {resumen.tasa}%
                </p>
              </div>
              <TasaBar tasa={resumen.tasa} />
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
              <p className="text-sm text-white/40">Cargando puestos...</p>
            </div>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="bg-red-400/10 border border-red-400/20 rounded-xl p-4 text-center">
            <ShieldAlert className="w-6 h-6 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-300">No se pudo cargar la información de cobertura.</p>
          </div>
        )}

        {/* Sin puestos */}
        {!isLoading && !isError && puestos.length === 0 && (
          <div className="bg-[#0c1829] border border-white/5 rounded-xl p-10 text-center">
            <ShieldCheck className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/50 text-sm">No hay puestos activos registrados para su cuenta.</p>
            <p className="text-white/30 text-xs mt-1">Contacte a su ejecutivo de cuenta para más información.</p>
          </div>
        )}

        {/* Puestos agrupados por sede */}
        {!isLoading && Object.entries(sedes).map(([sede, items]) => {
          const cubiertosEnSede = items.filter(p => p.titular_nombre).length;
          return (
            <div key={sede} className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
              {/* Sede header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary/70" />
                  <span className="text-sm font-semibold text-white">{sede}</span>
                </div>
                <span className="text-xs text-white/40">
                  {cubiertosEnSede}/{items.length} cubiertos
                </span>
              </div>

              {/* Tabla de puestos */}
              <div className="divide-y divide-white/4">
                {items.map((puesto) => {
                  const cubierto = !!puesto.titular_nombre;
                  return (
                    <div
                      key={puesto.puesto_id}
                      className={`flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3.5 transition-colors
                        ${!cubierto ? "bg-red-400/3" : "hover:bg-white/2"}`}
                    >
                      {/* Indicador de estado */}
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 hidden sm:block
                        ${cubierto ? "bg-green-400" : "bg-red-400"}`} />

                      {/* Nombre del puesto */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{puesto.puesto_nombre}</p>
                        {puesto.zona_nombre && (
                          <p className="text-[11px] text-white/40 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {puesto.zona_nombre}
                          </p>
                        )}
                        {puesto.horario && (
                          <p className="text-[11px] text-white/30 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {puesto.horario}
                          </p>
                        )}
                      </div>

                      {/* Turno */}
                      <div className="flex items-center gap-2 shrink-0">
                        <TurnoChip turno={puesto.turno} />
                      </div>

                      {/* Titular */}
                      <div className="flex-1 min-w-0 sm:text-right">
                        {cubierto ? (
                          <div>
                            <p className="text-[11px] text-white/40 mb-0.5 flex items-center gap-1 sm:justify-end">
                              <User className="w-3 h-3" /> Titular asignado
                            </p>
                            <p className="text-sm text-white/80 font-medium truncate">{puesto.titular_nombre}</p>
                            {puesto.titular_area && (
                              <p className="text-[10px] text-white/30">{puesto.titular_area}</p>
                            )}
                          </div>
                        ) : (
                          <div className="sm:text-right">
                            <p className="text-[11px] text-white/30">Sin titular asignado</p>
                          </div>
                        )}
                      </div>

                      {/* Estado */}
                      <div className="shrink-0">
                        <EstadoChip cubierto={cubierto} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Nota de privacidad */}
        {!isLoading && puestos.length > 0 && (
          <p className="text-[10px] text-white/20 text-center pb-4">
            Por privacidad, solo se muestra información operativa del personal asignado. Los datos personales son confidenciales.
          </p>
        )}
      </div>
    </PortalLayout>
  );
}
