import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE, apiPost } from "../utils";
import { formatFechaVista } from "../helpers";
import type { CierreHoyData, DiaPendienteCierre } from "../types";

interface CurrentUser {
  id?: number | null;
  nombre?: string | null;
  username?: string | null;
  rol?: string | null;
}

interface Args {
  fechaVista: string;
  esPasado: boolean;
  primerDiaPendiente: DiaPendienteCierre | null;
  cierreHoy: CierreHoyData | undefined;
  diaHoyCerrado: boolean;
  fechaVistaCerrada: boolean;
  fechaCierreParaReabrir: string;
  currentUser: CurrentUser | null | undefined;
  refetchCierre: () => void;
  volverHoy: () => void;
}

export function useCierreFlow({
  fechaVista,
  esPasado,
  primerDiaPendiente,
  cierreHoy,
  diaHoyCerrado,
  fechaVistaCerrada,
  fechaCierreParaReabrir,
  currentUser,
  refetchCierre,
  volverHoy,
}: Args) {
  const { toast } = useToast();
  const [modalCierre, setModalCierre] = useState(false);
  const [modalReabrir, setModalReabrir] = useState(false);
  const [modalCierrePendiente, setModalCierrePendiente] = useState(false);
  const [diaPendienteSeleccionado, setDiaPendienteSeleccionado] = useState<DiaPendienteCierre | null>(null);

  async function cerrarDia(comentario: string, sincronizarCustodias: boolean) {
    const fechaStr = formatFechaVista(fechaVista);
    try {
      const resp: any = await apiPost(`${API_BASE}/operaciones/cierre`, {
        confirmacion: `CERRAR ${fechaStr}`,
        comentario,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
        usuarioId: currentUser?.id,
        rol: currentUser?.rol,
        sincronizarCustodias,
        fecha: fechaVista,
      });
      const syncMsg = resp?.syncCustodias?.totalCambios
        ? ` • ${resp.syncCustodias.totalCambios} custodia(s) actualizada(s).`
        : "";
      toast({ title: "Día cerrado", description: `Cierre de ${fechaStr} registrado.${syncMsg}` });
      setModalCierre(false);
      refetchCierre();
      if (esPasado) volverHoy();
    } catch (e: any) {
      toast({ title: "Error al cerrar", description: e.error ?? "Error desconocido", variant: "destructive" });
      throw e;
    }
  }

  async function cerrarDiaPorFecha(dia: DiaPendienteCierre, comentario: string, sincronizarCustodias: boolean) {
    try {
      const resp: any = await apiPost(`${API_BASE}/operaciones/cierre`, {
        confirmacion: `CERRAR ${dia.fechaStr}`,
        comentario,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
        usuarioId: currentUser?.id,
        rol: currentUser?.rol,
        sincronizarCustodias,
        fecha: dia.fecha,
      });
      const syncMsg = resp?.syncCustodias?.totalCambios
        ? ` • ${resp.syncCustodias.totalCambios} custodia(s) actualizada(s).`
        : "";
      toast({ title: "Día cerrado", description: `Cierre de ${dia.fechaStr} registrado.${syncMsg}` });
      setDiaPendienteSeleccionado(null);
      refetchCierre();
      if (fechaVista === dia.fecha) volverHoy();
    } catch (e: any) {
      toast({ title: "Error al cerrar", description: e.error ?? "Error desconocido", variant: "destructive" });
      throw e;
    }
  }

  async function cerrarDiaPendiente(comentario: string, sincronizarCustodias: boolean) {
    if (!primerDiaPendiente) return;
    await cerrarDiaPorFecha(primerDiaPendiente, comentario, sincronizarCustodias);
    setModalCierrePendiente(false);
  }

  async function reabrirDia(motivo: string) {
    const fechaISO = esPasado && fechaVistaCerrada
      ? fechaVista
      : diaHoyCerrado
        ? cierreHoy!.cierreDeHoy!.fecha.substring(0, 10)
        : (cierreHoy?.cierre?.fecha?.substring(0, 10) ?? undefined);
    try {
      await apiPost(`${API_BASE}/operaciones/reabrir`, {
        confirmacion: `REABRIR ${fechaCierreParaReabrir}`,
        motivo,
        fecha: fechaISO,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
        usuarioId: currentUser?.id,
        rol: currentUser?.rol,
      });
      toast({ title: "Día reabierto", description: `El día ${fechaCierreParaReabrir} está activo nuevamente` });
      setModalReabrir(false);
      refetchCierre();
    } catch (e: any) {
      toast({ title: "Error al reabrir", description: e.error ?? e.message ?? "Error desconocido", variant: "destructive" });
    }
  }

  return {
    modalCierre,
    setModalCierre,
    modalReabrir,
    setModalReabrir,
    modalCierrePendiente,
    setModalCierrePendiente,
    diaPendienteSeleccionado,
    setDiaPendienteSeleccionado,
    cerrarDia,
    cerrarDiaPorFecha,
    cerrarDiaPendiente,
    reabrirDia,
  };
}
