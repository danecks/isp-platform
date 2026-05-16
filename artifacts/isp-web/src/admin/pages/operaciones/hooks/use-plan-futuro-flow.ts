import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE, getSession } from "../utils";
import { formatFechaVista } from "../helpers";
import type { InicioProyecto, PlanFuturo, Puesto } from "../types";

interface CurrentUser {
  username?: string | null;
}

interface Args {
  fechaVista: string;
  currentUser: CurrentUser | null | undefined;
  invalidateFuture: () => void;
}

export function usePlanFuturoFlow({ fechaVista, currentUser, invalidateFuture }: Args) {
  const { toast } = useToast();
  const [modalPlanFuturo, setModalPlanFuturo] = useState<{ puesto: Puesto; plan: PlanFuturo | null } | null>(null);
  const [modalPlanSSA, setModalPlanSSA] = useState<InicioProyecto | null>(null);

  async function guardarPlanFuturo(data: {
    tipoAusencia: string;
    titularAusenteId: number | null;
    relevId: number | null;
    motivo: string;
    notas: string;
  }) {
    if (!modalPlanFuturo) return;
    const { puesto, plan } = modalPlanFuturo;
    if (plan) {
      await fetch(`${API_BASE}/operaciones/planificacion-futura/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({ ...data }),
      });
      toast({ title: "Plan actualizado", description: `${puesto.nombre} · ${formatFechaVista(fechaVista)}` });
    } else {
      await fetch(`${API_BASE}/operaciones/planificacion-futura`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({
          fecha: fechaVista,
          puestoId: puesto.id,
          tipoEvento: "ausencia",
          ...data,
          creadoPor: currentUser?.username ?? "sistema",
        }),
      });
      toast({ title: "Planificación guardada", description: `${puesto.nombre} · ${formatFechaVista(fechaVista)}` });
    }
    setModalPlanFuturo(null);
    invalidateFuture();
  }

  async function eliminarPlanFuturo(planId: number) {
    await fetch(`${API_BASE}/operaciones/planificacion-futura/${planId}`, { method: "DELETE", headers: { "x-isp-session": getSession() } });
    toast({ title: "Plan cancelado" });
    setModalPlanFuturo(null);
    invalidateFuture();
  }

  async function guardarPlanSSA(agentesSeleccionados: Array<{ id: number | null }>) {
    if (!modalPlanSSA) return;
    const ip = modalPlanSSA;
    const res = await fetch(`${API_BASE}/operaciones/planificacion-futura/ssa-batch`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
      body: JSON.stringify({
        fecha: fechaVista,
        ssaId: ip.ssa_id,
        agentes: agentesSeleccionados.filter((a) => a.id),
        creadoPor: currentUser?.username ?? "sistema",
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast({ title: "Error al guardar", description: body.error ?? "Error desconocido", variant: "destructive" });
      return;
    }
    const n = agentesSeleccionados.filter((a) => a.id).length;
    toast({
      title: n > 0 ? "Planificación SSA guardada" : "Planes SSA cancelados",
      description: n > 0 ? `${ip.cliente_nombre} · ${n} agente(s) planificado(s)` : `${ip.cliente_nombre} · sin agentes planificados`,
    });
    setModalPlanSSA(null);
    invalidateFuture();
  }

  async function eliminarPlanSSA() {
    if (!modalPlanSSA) return;
    await guardarPlanSSA([]);
  }

  return {
    modalPlanFuturo,
    setModalPlanFuturo,
    modalPlanSSA,
    setModalPlanSSA,
    guardarPlanFuturo,
    eliminarPlanFuturo,
    guardarPlanSSA,
    eliminarPlanSSA,
  };
}
