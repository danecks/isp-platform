/**
 * Planilla.tsx — Planilla Final de Nómina
 *
 * Vista multi-hoja similar a Excel para revisar, aprobar y exportar
 * la planilla generada desde el snapshot de un período cerrado.
 *
 * FLUJO:
 *   Pre-Planilla cerrada → Generar planilla (BORRADOR) → Revisada → Aprobada → Pagada
 *
 * Container delgado: la mayor parte del UI vive en `./planilla/*`.
 */

import { useCallback, useEffect, useState } from "react";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { getSessionToken } from "@/lib/httpClient";
import { apiRequest } from "./planilla/helpers";
import { CambiarEstadoModal } from "./planilla/CambiarEstadoModal";
import { DetallePlanilla } from "./planilla/DetallePlanilla";
import { GenerarPlanillaModal } from "./planilla/GenerarPlanillaModal";
import { ListaPlanillas } from "./planilla/ListaPlanillas";
import { RevertirPlanillaModal } from "./planilla/RevertirPlanillaModal";
import type { PlanillaDetalle, PlanillaResumen } from "./planilla/types";

export default function AdminPlanilla() {
  const [planillas, setPlanillas] = useState<PlanillaResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PlanillaDetalle | null>(null);
  const [showGenerar, setShowGenerar] = useState(false);
  const [showEstado, setShowEstado] = useState(false);
  const [showRevertir, setShowRevertir] = useState(false);
  const [sesionUsuario, setSesionUsuario] = useState("admin");

  // Leer usuario de la sesión
  useEffect(() => {
    try {
      const raw = getSessionToken();
      if (raw) {
        const decoded = JSON.parse(atob(raw.split(".")[1] ?? "") || "{}");
        if (decoded.username) setSesionUsuario(decoded.username);
      }
    } catch {
      // no bloqueante
    }
  }, []);

  const cargarPlanillas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<PlanillaResumen[]>("/nomina/planillas");
      setPlanillas(data);
    } catch {
      setPlanillas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const cargarDetalle = useCallback(async (id: number) => {
    try {
      const data = await apiRequest<PlanillaDetalle>(`/nomina/planilla/${id}`);
      setSelected(data);
    } catch {
      setSelected(null);
    }
  }, []);

  useEffect(() => { cargarPlanillas(); }, [cargarPlanillas]);

  async function handleSelect(p: PlanillaResumen) {
    await cargarDetalle(p.id);
  }

  function handleBack() {
    setSelected(null);
    cargarPlanillas();
  }

  async function handleNuevaGenerada(id: number) {
    await cargarPlanillas();
    await cargarDetalle(id);
  }

  async function handleRefreshDetalle() {
    if (selected) await cargarDetalle(selected.id);
  }

  return (
    <AdminLayout title="Planilla Final de Nómina">
      <div className="max-w-7xl mx-auto">
        {selected ? (
          <DetallePlanilla
            planilla={selected}
            onBack={handleBack}
            onCambiarEstado={() => setShowEstado(true)}
            onRevertir={() => setShowRevertir(true)}
          />
        ) : (
          <ListaPlanillas
            planillas={planillas}
            loading={loading}
            onSelect={handleSelect}
            onNueva={() => setShowGenerar(true)}
          />
        )}
      </div>

      <GenerarPlanillaModal
        open={showGenerar}
        onClose={() => setShowGenerar(false)}
        onSuccess={handleNuevaGenerada}
        sesionUsuario={sesionUsuario}
      />

      <CambiarEstadoModal
        open={showEstado}
        planilla={selected}
        onClose={() => setShowEstado(false)}
        onSuccess={handleRefreshDetalle}
        sesionUsuario={sesionUsuario}
      />

      <RevertirPlanillaModal
        open={showRevertir}
        planilla={selected}
        onClose={() => setShowRevertir(false)}
        onSuccess={handleBack}
        sesionUsuario={sesionUsuario}
      />
    </AdminLayout>
  );
}
