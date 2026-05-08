import { useState } from "react";
import { PlanMensualCarga } from "./PlanMensualCarga";
import { PlanMensualCobertura } from "./PlanMensualCobertura";
import { PlanMensualMatriz } from "./PlanMensualMatriz";

// Plan mensual de supervisión (sede × semana ISO × supervisor).
// Convive con TabProgramacion (visitas de fecha exacta para extraordinarias).

export function TabPlanMensual() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [asignar, setAsignar] = useState<{ sedeId: number; sedeNombre: string; semana?: number } | null>(null);

  const refrescarTodo = () => setRefreshKey(k => k + 1);

  return (
    <div className="space-y-3">
      <PlanMensualCarga refreshKey={refreshKey} />
      <PlanMensualCobertura
        refreshKey={refreshKey}
        onAsignar={(sedeId, sedeNombre, semana) => setAsignar({ sedeId, sedeNombre, semana })}
      />
      <PlanMensualMatriz
        refreshKey={refreshKey}
        onChanged={refrescarTodo}
        asignacionInicial={asignar}
        onAsignacionConsumida={() => setAsignar(null)}
      />
    </div>
  );
}
