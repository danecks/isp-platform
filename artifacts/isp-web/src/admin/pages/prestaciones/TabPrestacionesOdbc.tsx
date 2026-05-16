import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, CheckCircle2, Clock, Coins, Loader2, Search,
} from "lucide-react";
import { apiRequest } from "./helpers";
import type { OdbcEmpleadoRow, ResumenOdbcResponse } from "./types";

export function TabPrestacionesOdbc({ tipo }: { tipo: "bono14" | "aguinaldo" | "vacaciones" }) {
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery<ResumenOdbcResponse>({
    queryKey: ["prestaciones-resumen-odbc"],
    queryFn: () => apiRequest<ResumenOdbcResponse>("/prestaciones/resumen-odbc"),
    staleTime: 60_000,
  });

  const empleados = (data?.empleados ?? []).filter(e =>
    !search ||
    (e.nombre_completo ?? "").toLowerCase().includes(search.toLowerCase()) ||
    e.empl_numero.includes(search)
  );

  const totalArchivo =
    tipo === "bono14"    ? parseFloat(data?.resumen?.bono14 ?? "0") :
    tipo === "aguinaldo" ? parseFloat(data?.resumen?.aguinaldo ?? "0") :
                          parseFloat(data?.resumen?.vacaciones ?? "0");

  const cicloInfo = {
    bono14:    { pagado: "Bono14 2025 (Jul 2024–Jun 2025)", acumulando: "Bono14 2026 (Jul 2025–Jun 2026)",    color: "blue" },
    aguinaldo: { pagado: "Aguinaldo 2025 (Dic 2024–Nov 2025)", acumulando: "Aguinaldo 2026 (Dic 2025–Nov 2026)", color: "purple" },
    vacaciones:{ pagado: "Vacaciones según último pago", acumulando: "Vacaciones acumuladas (May 2025→)",        color: "emerald" },
  }[tipo];

  const getVal = (e: OdbcEmpleadoRow) =>
    tipo === "bono14"    ? parseFloat(e.total_bono14 ?? "0") :
    tipo === "aguinaldo" ? parseFloat(e.total_aguinaldo ?? "0") :
                          parseFloat(e.total_vacaciones ?? "0");

  const colColor = tipo === "bono14" ? "text-blue-300" : tipo === "aguinaldo" ? "text-purple-300" : "text-emerald-300";
  const borderColor = tipo === "bono14" ? "border-blue-500/20 bg-blue-500/5" : tipo === "aguinaldo" ? "border-purple-500/20 bg-purple-500/5" : "border-emerald-500/20 bg-emerald-500/5";

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-white/40 text-sm">
      <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando datos históricos ODBC…
    </div>
  );

  if (isError || !data?.ok || Number(data?.resumen?.filas ?? 0) === 0) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-amber-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">Sin datos históricos importados</p>
        <p className="text-xs text-white/40 mt-1">
          Importa el archivo <code className="text-amber-300/80">dbo_DetallePrestaciones*.xlsx</code> desde la sección de Importación → Prestaciones ODBC.
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 px-6 py-5">
      {/* Ciclos */}
      <div className="flex gap-3">
        <div className="flex-1 flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <p className="text-[10px] text-white/40">Ciclo cerrado (ya pagado)</p>
            <p className="text-xs font-semibold text-emerald-300">{cicloInfo.pagado}</p>
          </div>
        </div>
        <div className="flex-1 flex items-center gap-3 bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3">
          <Clock className="w-4 h-4 text-blue-400 shrink-0" />
          <div>
            <p className="text-[10px] text-white/40">Ciclo activo (acumulando)</p>
            <p className="text-xs font-semibold text-blue-300">{cicloInfo.acumulando}</p>
          </div>
        </div>
        <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${borderColor}`}>
          <Coins className="w-4 h-4 shrink-0 text-white/50" />
          <div>
            <p className="text-[10px] text-white/40">Total acumulado</p>
            <p className={`text-sm font-bold ${colColor}`}>
              Q{totalArchivo.toLocaleString("es-GT", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
        <input
          className="w-full pl-8 pr-3 py-2 text-xs bg-white/3 border border-white/10 rounded-xl text-white placeholder:text-white/25 outline-none focus:border-teal-500/40 transition-colors"
          placeholder="Buscar por nombre o código…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-white/8">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white/4 border-b border-white/8 text-white/40">
              <th className="px-3 py-2.5 text-left font-medium">Colaborador</th>
              <th className="px-3 py-2.5 text-left font-medium">Ingreso</th>
              <th className="px-3 py-2.5 text-right font-medium">Salario Base</th>
              <th className="px-3 py-2.5 text-right font-medium">Días Lab.</th>
              <th className="px-3 py-2.5 text-right font-medium">
                {tipo === "bono14" ? "Bono14 acum." : tipo === "aguinaldo" ? "Aguinaldo acum." : "Vacaciones acum."}
              </th>
              <th className="px-3 py-2.5 text-center font-medium">Períodos</th>
              <th className="px-3 py-2.5 text-center font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {empleados.map((e) => {
              const val = getVal(e);
              const activo = !e.fecha_baja;
              return (
                <tr key={e.empl_numero} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-3 py-2">
                    <p className="font-medium text-white/80 text-[11px]">{e.nombre_completo ?? `#${e.empl_numero}`}</p>
                    <p className="text-[9px] text-white/30 font-mono mt-0.5">#{e.empl_numero}</p>
                  </td>
                  <td className="px-3 py-2 text-white/40 text-[10px]">
                    {e.fecha_ingreso ? new Date(e.fecha_ingreso).toLocaleDateString("es-GT") : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-white/60 font-mono">
                    {e.sueldo_base ? `Q${parseFloat(e.sueldo_base).toLocaleString("es-GT", { minimumFractionDigits: 2 })}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-white/40">{parseFloat(e.dias_laborados ?? "0").toLocaleString("es-GT")}</td>
                  <td className={`px-3 py-2 text-right font-bold font-mono ${colColor}`}>
                    Q{val.toLocaleString("es-GT", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-center text-white/30">{e.periodos_con_data}</td>
                  <td className="px-3 py-2 text-center">
                    {activo
                      ? <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Activo</span>
                      : <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">Inactivo</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {empleados.length === 0 && (
          <p className="text-center text-xs text-white/30 py-8">Sin resultados para "{search}"</p>
        )}
      </div>

      <p className="text-[10px] text-white/25">
        Mostrando {empleados.length.toLocaleString()} de {(data?.empleados?.length ?? 0).toLocaleString()} colaboradores · Datos: May 2025 – Abr 2026
      </p>
    </div>
  );
}
