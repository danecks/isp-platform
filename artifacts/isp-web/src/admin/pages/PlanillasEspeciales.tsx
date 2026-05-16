/**
 * PlanillasEspeciales.tsx — Bono 14 / Aguinaldo
 *
 * Container delgado: la mayor parte del UI vive en `./planillas-especiales/*`.
 */

import { useCallback, useEffect, useState } from "react";
import { AdminLayout } from "../layout/AdminLayout";
import { apiRequest } from "./planillas-especiales/helpers";
import { ListaPlanillasEspeciales } from "./planillas-especiales/ListaPlanillasEspeciales";
import { DetallePlanillaEspecial } from "./planillas-especiales/DetallePlanillaEspecial";
import { GenerarPlanillaEspecialModal } from "./planillas-especiales/GenerarPlanillaEspecialModal";
import { RegistrarPagoModal } from "./planillas-especiales/RegistrarPagoModal";
import type {
  PlanillaEspecial, PlanillaEspecialDetalle, PlanillaPago,
} from "./planillas-especiales/types";

export default function PlanillasEspeciales() {
  const [planillas, setPlanillas] = useState<PlanillaEspecial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<PlanillaEspecialDetalle | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);

  const [showGenerar, setShowGenerar] = useState(false);
  const [pagoModal, setPagoModal] = useState<PlanillaPago | null>(null);
  const [aprobandoId, setAprobandoId] = useState<number | null>(null);

  const loadPlanillas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<{ planillas?: PlanillaEspecial[] }>("/nomina/planillas-especiales");
      setPlanillas(data.planillas ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPlanillas(); }, [loadPlanillas]);

  const loadDetalle = useCallback(async (id: number) => {
    setDetalleLoading(true);
    try {
      const data = await apiRequest<PlanillaEspecialDetalle>(`/nomina/planillas-especiales/${id}`);
      setDetalle(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setDetalleLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId != null) loadDetalle(selectedId);
    else setDetalle(null);
  }, [selectedId, loadDetalle]);

  async function handleAprobar(id: number) {
    setAprobandoId(id);
    try {
      await apiRequest(`/nomina/planillas-especiales/${id}/estado`, {
        method: "PATCH",
        json: { estado: "aprobada" },
      });
      await loadPlanillas();
      if (selectedId === id) loadDetalle(id);
    } catch (e) {
      setError(String(e));
    } finally {
      setAprobandoId(null);
    }
  }

  async function handleAnular(id: number) {
    if (!confirm("¿Anular esta planilla especial? Esta acción no se puede deshacer.")) return;
    try {
      await apiRequest(`/nomina/planillas-especiales/${id}`, { method: "DELETE" });
      setSelectedId(null);
      loadPlanillas();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handlePagoSuccess() {
    setPagoModal(null);
    await loadPlanillas();
    if (selectedId) loadDetalle(selectedId);
  }

  async function handleGenerarSuccess(id: number) {
    setShowGenerar(false);
    await loadPlanillas();
    setSelectedId(id);
  }

  return (
    <AdminLayout title="Planillas Especiales">
      {selectedId == null ? (
        <ListaPlanillasEspeciales
          planillas={planillas}
          loading={loading}
          error={error}
          onSelect={setSelectedId}
          onNueva={() => setShowGenerar(true)}
        />
      ) : (
        <DetallePlanillaEspecial
          detalle={detalle}
          loading={detalleLoading}
          aprobandoId={aprobandoId}
          onBack={() => setSelectedId(null)}
          onAprobar={handleAprobar}
          onAnular={handleAnular}
          onRegistrarPago={setPagoModal}
        />
      )}

      <GenerarPlanillaEspecialModal
        open={showGenerar}
        onClose={() => setShowGenerar(false)}
        onSuccess={handleGenerarSuccess}
      />

      <RegistrarPagoModal
        pago={pagoModal}
        onClose={() => setPagoModal(null)}
        onSuccess={handlePagoSuccess}
        onError={setError}
      />
    </AdminLayout>
  );
}
