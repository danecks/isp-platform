import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { getSessionToken } from "@/lib/httpClient";
import { API_BASE, apiPost, getSession, fechaHoyStr } from "../utils";
import type { Agente, OldTitularAccion, Pool, Puesto, TarjetaSSAPendiente } from "../types";
import { TIPOS_NOVEDAD } from "../types";

interface CurrentUser {
  nombre?: string | null;
  username?: string | null;
}

interface ModalIncentivoState {
  agenteId: number; agenteName: string;
  puestoId: number | null; puestoName: string;
  clienteId: number | null; clienteNombre: string | null;
  sedeId: number | null; fecha: string;
  costoHE?: number | null; jornada?: string;
}

interface ModalSustitucionState {
  puesto: Puesto;
  agente: Agente;
  advertencia?: string;
  agentePoolStatus?: "disponible" | "descansando" | "vacaciones" | "trabajando";
}

interface Args {
  pool: Pool | undefined;
  fechaVista: string;
  esPasado: boolean;
  fechaActivaStr: string;
  currentUser: CurrentUser | null | undefined;
  invalidate: () => void;
  refetchTablero: () => Promise<unknown>;
  refetchPool: () => Promise<unknown>;
  setAgenteSeleccionado: (a: Agente | null) => void;
  setPuestoContexto: (p: Puesto | null) => void;
}

export function useAssignmentFlow({
  pool,
  fechaVista,
  esPasado,
  fechaActivaStr,
  currentUser,
  invalidate,
  refetchTablero,
  refetchPool,
  setAgenteSeleccionado,
  setPuestoContexto,
}: Args) {
  const { toast } = useToast();

  const [modalSustitucion, setModalSustitucion] = useState<ModalSustitucionState | null>(null);
  const [modalEligeCobertura, setModalEligeCobertura] = useState<{ puesto: Puesto; agente: Agente } | null>(null);
  const [modalCustodiaTipo, setModalCustodiaTipo] = useState<{ puesto: Puesto; agente: Agente; clienteId: number; slotNumero: number } | null>(null);
  const [modalSustituyeTitular, setModalSustituyeTitular] = useState<{ puesto: Puesto; agente: Agente } | null>(null);
  const [modalIncentivo, setModalIncentivo] = useState<ModalIncentivoState | null>(null);
  const [modalLiberar, setModalLiberar] = useState<Puesto | null>(null);
  const [modalFalta, setModalFalta] = useState<{ puesto: Puesto; titularId: number; titularNombre: string } | null>(null);
  const [modalQuitarTitular, setModalQuitarTitular] = useState<{ puesto: Puesto; employeeId: number; employeeNombre: string } | null>(null);
  const [modalAnularFalta, setModalAnularFalta] = useState<{ puesto: Puesto; titularNombre: string } | null>(null);
  const [modalReactivarFalta, setModalReactivarFalta] = useState<{ puesto: Puesto; titularNombre: string } | null>(null);
  const [modalAgenteExterno, setModalAgenteExterno] = useState<Puesto | null>(null);

  function esAgentePool(agente: Agente) {
    const eoa = agente.tipo_asignacion_eoa ?? "sin_asignacion";
    return eoa !== "titular";
  }

  function detectarPoolStatus(agente: Agente): "disponible" | "descansando" | "vacaciones" | "trabajando" {
    if (!pool) return "disponible";
    if ((pool.disponibles ?? []).some(a => a.id === agente.id)) return "disponible";
    if ((pool.disponiblesCubriendo ?? []).some(a => a.id === agente.id)) return "disponible";
    if ((pool.descansandoCiclo ?? []).some(a => a.id === agente.id)) return "descansando";
    if ((pool.haciendoHE ?? []).some(a => a.id === agente.id)) return "descansando";
    if ((pool.enVacaciones ?? []).some(a => a.id === agente.id)) return "vacaciones";
    if ((pool.vacacionistasCubriendo ?? []).some(a => a.id === agente.id)) return "vacaciones";
    if ((pool.trabajando ?? []).some(a => a.id === agente.id)) return "trabajando";
    if ((pool.enPuesto ?? []).some(a => a.id === agente.id)) return "trabajando";
    return "disponible";
  }

  async function asignarCustodia(puesto: Puesto, agente: Agente) {
    const tieneTitular = !!puesto.titular_employee_id;

    if (tieneTitular) {
      setModalSustitucion({ puesto, agente, agentePoolStatus: detectarPoolStatus(agente) });
      return;
    }

    const idParts = String(puesto.id).split("-");
    const clienteId = parseInt(idParts[1]);
    const slotNumero = parseInt(idParts[2]);
    setModalCustodiaTipo({ puesto, agente, clienteId, slotNumero });
  }

  async function ejecutarAsignarCustodia(
    clienteId: number,
    slotNumero: number,
    agente: Agente,
    soloCobertura: boolean,
    puesto?: Puesto,
  ) {
    try {
      const resp = await fetch(`${API_BASE}/operaciones/asignar-custodia`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({
          clienteId,
          slotNumero,
          employeeId: agente.id,
          fecha: fechaVista || undefined,
          soloCobertura,
        }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        toast({ title: "Error", description: data.error || "Error al asignar custodia", variant: "destructive" });
        return;
      }
      toast({
        title: soloCobertura ? "Cobertura asignada" : "Titular asignado",
        description: `${agente.nombre_completo} → Custodio ${slotNumero}`,
      });
      invalidate();

      const poolStatus = detectarPoolStatus(agente);
      if (poolStatus === "descansando") {
        const clienteNombre = puesto?.cliente_nombre ?? null;
        setModalIncentivo({
          agenteId: agente.id,
          agenteName: agente.nombre_completo,
          puestoId: null,
          puestoName: `Custodio ${slotNumero}${clienteNombre ? ` — ${clienteNombre}` : ""}`,
          clienteId,
          clienteNombre,
          sedeId: null,
          fecha: fechaVista,
          jornada: "12h",
        });
      }
    } catch {
      toast({ title: "Error de conexión", variant: "destructive" });
    }
  }

  async function iniciarAsignacion(puesto: Puesto, agente: Agente) {
    if (puesto.agente_id === agente.id) return;

    if (!puesto.agente_id && puesto.es_par_24x24 && (puesto.par_trabajando || puesto.par_descansando)) {
      setModalSustituyeTitular({ puesto, agente });
      return;
    }

    const tieneTitularesReales = !!puesto.titular_employee_id || (puesto.titulares && puesto.titulares.length > 0);
    if (!puesto.agente_id && !tieneTitularesReales && esAgentePool(agente) && puesto.tiene_slot_vacio) {
      try {
        const resp = await apiPost(`${API_BASE}/operaciones/asignar`, {
          puestoId: puesto.id,
          agenteId: agente.id,
          soloCobertura: false,
          usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
          motivoCambio: "asignacion_directa",
          ...(esPasado && fechaVista ? { fechaOperacion: fechaVista } : {}),
        });
        if (resp?.impactoSalarial?.detectado) {
          setTimeout(() => toast({
            title: "⚠️ Cambio con impacto salarial",
            description: "Este puesto tiene condiciones salariales distintas. El cambio requiere autorización de RRHH.",
            variant: "destructive",
          }), 400);
        }
        toast({ title: "Titular asignado", description: `${agente.nombre_completo} → ${puesto.nombre} (auto-asignado a plantilla)` });
        await refetchTablero();
        await refetchPool();
      } catch (e: any) {
        toast({ title: "Error", description: e?.message ?? "No se pudo asignar", variant: "destructive" });
      }
      return;
    }

    if (!puesto.agente_id && esAgentePool(agente)) {
      setModalEligeCobertura({ puesto, agente });
      return;
    }

    try {
      const poolStatus = detectarPoolStatus(agente);
      const disp = await fetch(`${API_BASE}/operaciones/agentes/${agente.id}/disponibilidad`, { headers: { "x-isp-session": getSession() } }).then((r) => r.json());
      if (disp.puestosActivos.length > 0) {
        const yaTiene = disp.puestosActivos[0];
        setModalSustitucion({
          puesto,
          agente,
          advertencia: `${agente.nombre_completo} ya está en ${yaTiene.cliente_nombre} — ${yaTiene.nombre}. ¿Forzar?`,
          agentePoolStatus: poolStatus,
        });
      } else {
        setModalSustitucion({ puesto, agente, agentePoolStatus: poolStatus });
      }
    } catch {
      setModalSustitucion({ puesto, agente, agentePoolStatus: detectarPoolStatus(agente) });
    }
  }

  async function confirmarEligeCobertura(soloCobertura: boolean, oldTitularAccion?: OldTitularAccion, fechaEfectiva?: string, motivoCambio?: string, horaInstalacion?: string) {
    if (!modalEligeCobertura) return;
    const { puesto, agente } = modalEligeCobertura;
    setModalEligeCobertura(null);
    try {
      const respAsignar = await apiPost(`${API_BASE}/operaciones/asignar`, {
        puestoId: puesto.id,
        agenteId: agente.id,
        soloCobertura,
        oldTitularAccion: oldTitularAccion ?? null,
        fechaEfectiva: fechaEfectiva ?? null,
        motivoCambio: motivoCambio ?? null,
        horaInstalacion: horaInstalacion ?? null,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
        ...(esPasado && fechaVista ? { fechaOperacion: fechaVista } : {}),
      });
      if (respAsignar?.impactoSalarial?.detectado) {
        setTimeout(() => toast({
          title: "⚠️ Cambio con impacto salarial",
          description: "Este puesto tiene condiciones salariales distintas. El cambio requiere autorización de RRHH.",
          variant: "destructive",
        }), 400);
      }
      if (soloCobertura) {
        const horaLabel = horaInstalacion ? ` desde las ${horaInstalacion}` : "";
        toast({ title: "Cobertura temporal registrada", description: `${agente.nombre_completo} cubre ${puesto.nombre}${horaLabel}` });
        setModalIncentivo({
          agenteId: agente.id,
          agenteName: agente.nombre_completo,
          puestoId: puesto.id,
          puestoName: puesto.nombre,
          clienteId: puesto.cliente_id,
          clienteNombre: puesto.cliente_nombre ?? null,
          sedeId: puesto.sede_id,
          fecha: fechaActivaStr,
          jornada: puesto.jornada ?? "12h",
        });
      } else {
        const motLabel = motivoCambio ? ` · ${motivoCambio.replace(/_/g, " ")}` : "";
        const fechaLabel = fechaEfectiva ? ` desde ${fechaEfectiva}` : "";
        toast({ title: "Nuevo titular asignado", description: `${agente.nombre_completo} → ${puesto.nombre}${fechaLabel}${motLabel}` });
        fetch(`${API_BASE}/solicitudes-cambio`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
          body: JSON.stringify({
            employee_id: agente.id,
            puesto_id: puesto.id,
            origen_modulo: "operaciones",
            tipo_cambio: "cambio_titular",
            estado: "pendiente_rrhh",
            motivo: motivoCambio
              ? `${motivoCambio.replace(/_/g, " ")}${fechaEfectiva ? " (efectivo " + fechaEfectiva + ")" : ""}`
              : `Nuevo titular desde pizarrón${fechaEfectiva ? " efectivo " + fechaEfectiva : ""}`,
            datos_antes: puesto.agente_id ? { agente_id: puesto.agente_id, agente: puesto.nombre ?? "" } : null,
            datos_despues: { agente_id: agente.id, agente: agente.nombre_completo, fecha_efectiva: fechaEfectiva ?? "inmediata" },
            creado_por: currentUser?.nombre ?? currentUser?.username ?? "sistema",
          }),
        }).catch(() => {});
      }
      setAgenteSeleccionado(null);
      setPuestoContexto(null);
      invalidate();
    } catch (e: any) {
      if (e.ssaId) {
        toast({ title: "Conflicto — Servicio Especial activo", description: e.error ?? "El agente cubre un SSA activo. Libéralo primero.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: e.error ?? "Error al procesar", variant: "destructive" });
      }
    }
  }

  async function confirmarSustituyeTitular(titularSustituidoId: number, motivo: string, horaInstalacion: string) {
    if (!modalSustituyeTitular) return;
    const { puesto, agente } = modalSustituyeTitular;
    setModalSustituyeTitular(null);
    try {
      await apiPost(`${API_BASE}/operaciones/asignar`, {
        puestoId: puesto.id,
        agenteId: agente.id,
        soloCobertura: true,
        titularSustituidoId,
        motivoCambio: motivo,
        horaInstalacion: horaInstalacion || null,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
      });
      toast({ title: "Relevo registrado", description: `${agente.nombre_completo} cubre ${puesto.nombre} desde las ${horaInstalacion}` });
      setModalIncentivo({
        agenteId: agente.id,
        agenteName: agente.nombre_completo,
        puestoId: puesto.id,
        puestoName: puesto.nombre,
        clienteId: puesto.cliente_id,
        clienteNombre: puesto.cliente_nombre ?? null,
        sedeId: puesto.sede_id,
        fecha: fechaActivaStr,
        jornada: puesto.jornada ?? "12h",
      });
      setAgenteSeleccionado(null);
      setPuestoContexto(null);
      invalidate();
    } catch (e: any) {
      if (e.ssaId) {
        toast({ title: "Conflicto — Servicio Especial activo", description: e.error ?? "El agente cubre un SSA activo. Libéralo primero.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: e.error ?? "Error al procesar", variant: "destructive" });
      }
    }
  }

  async function confirmarSustitucion(motivo: string, notas: string, forzar: boolean, tipoSustitucion: string = "relevo", tipoNovedad?: string, coberturaTipo?: string, horasParcial?: { inicio: string; fin: string }, pagoEfectivo?: { monto: number; pagadoPor: string }) {
    if (!modalSustitucion) return;
    const { puesto, agente } = modalSustitucion;

    try {
      if (puesto.es_custodia) {
        const idParts = String(puesto.id).split("-");
        const clienteId = parseInt(idParts[1]);
        const slotNumero = parseInt(idParts[2]);

        if (tipoSustitucion === "reasignacion") {
          await apiPost(`${API_BASE}/operaciones/cambiar-titular-custodia`, {
            clienteId,
            slotNumero,
            nuevoTitularId: agente.id,
            anteriorTitularId: puesto.titular_employee_id,
            motivo: tipoNovedad ?? motivo,
            notas: notas || undefined,
            usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
          });
          toast({ title: "Titular cambiado", description: `${agente.nombre_completo} es el nuevo titular de Custodio ${slotNumero}` });
        } else {
          if (puesto.titular_employee_id && !(puesto as any).titular_faltando) {
            await apiPost(`${API_BASE}/operaciones/registrar-falta-custodia`, {
              clienteId,
              slotNumero,
              empleadoId: puesto.titular_employee_id,
              motivo: tipoNovedad ?? motivo,
              notas: notas || undefined,
              usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
              fecha: fechaVista,
            });
          }

          const resp = await fetch(`${API_BASE}/operaciones/asignar-custodia`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
            body: JSON.stringify({
              clienteId,
              slotNumero,
              employeeId: agente.id,
              fecha: fechaVista || undefined,
              soloCobertura: true,
            }),
          });
          if (!resp.ok) {
            const data = await resp.json().catch(() => ({}));
            toast({ title: "Error", description: data.error || "Error al asignar custodia", variant: "destructive" });
            setModalSustitucion(null);
            return;
          }
          const labelNov = TIPOS_NOVEDAD.find((t) => t.value === (tipoNovedad ?? ""))?.label ?? tipoNovedad ?? motivo;
          toast({ title: `Sustitución registrada · ${labelNov}`, description: `${puesto.titular_nombre ?? "Titular"} → ${agente.nombre_completo} en Custodio ${slotNumero}` });

          const poolStatus = modalSustitucion?.agentePoolStatus;
          if (poolStatus === "descansando" || poolStatus === "vacaciones") {
            const clienteNombre = puesto.cliente_nombre ?? null;
            setModalIncentivo({
              agenteId: agente.id,
              agenteName: agente.nombre_completo,
              puestoId: null,
              puestoName: `Custodio ${slotNumero}${clienteNombre ? ` — ${clienteNombre}` : ""}`,
              clienteId,
              clienteNombre,
              sedeId: null,
              fecha: fechaVista,
              jornada: "12h",
            });
          }
        }
        setModalSustitucion(null);
        setAgenteSeleccionado(null);
        setPuestoContexto(null);
        invalidate();
        return;
      }

      if (puesto.agente_id) {
        const poolStatus = modalSustitucion?.agentePoolStatus;
        const generaHE = poolStatus === "descansando" || poolStatus === "vacaciones";
        const resp = await apiPost(`${API_BASE}/operaciones/sustituir`, {
          puestoId: puesto.id,
          agenteEntranteId: agente.id,
          agenteSalienteId: puesto.agente_id ?? null,
          agenteSalienteNombre: puesto.agente_nombre ?? null,
          motivo,
          notas,
          forzar,
          tipoSustitucion,
          tipoNovedad: tipoNovedad ?? null,
          coberturaTipo: coberturaTipo ?? "completo",
          generaHE,
          ...(horasParcial ? { horaInicioParcial: horasParcial.inicio, horaFinParcial: horasParcial.fin } : {}),
          usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
          ...(esPasado && fechaVista ? { fechaOperacion: fechaVista } : {}),
        });
        if (resp?.impactoSalarial?.detectado) {
          setTimeout(() => toast({
            title: "⚠️ Cambio con impacto salarial",
            description: "Este puesto tiene condiciones salariales distintas. El cambio se aplicó operativamente, pero requiere autorización de RRHH.",
            variant: "destructive",
          }), 400);
        }
        const labelNov = TIPOS_NOVEDAD.find((t) => t.value === (tipoNovedad ?? ""))?.label ?? tipoNovedad ?? "";
        if (resp?.eventoRrhhGenerado) {
          toast({
            title: `Sustitución registrada · ${labelNov}`,
            description: `Evento RRHH generado. Boleta disponible en Eventos RRHH.`,
          });
        } else {
          toast({ title: `Sustitución registrada · ${labelNov}`, description: `${puesto.agente_nombre} → ${agente.nombre_completo}` });
        }
        if (tipoSustitucion === "relevo") {
          if (pagoEfectivo && pagoEfectivo.monto > 0) {
            try {
              const r = await fetch(`${API_BASE}/incentivos`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
                body: JSON.stringify({
                  employeeId: agente.id,
                  employeeNombre: agente.nombre_completo,
                  fecha: fechaActivaStr,
                  clienteId: puesto.cliente_id,
                  clienteNombre: puesto.cliente_nombre ?? null,
                  sedeId: puesto.sede_id,
                  puestoId: puesto.id,
                  puestoNombre: puesto.nombre,
                  tipo: "he_efectivo",
                  monto: pagoEfectivo.monto,
                  motivo: `Pago HE en efectivo — ${puesto.nombre}`,
                  autorizadoPor: currentUser?.nombre ?? currentUser?.username ?? "sistema",
                  pagadoPor: pagoEfectivo.pagadoPor || (currentUser?.nombre ?? "sistema"),
                  metodoPago: "efectivo",
                  estado: "pagado",
                }),
              });
              if (r.status === 409) {
                toast({ title: "Ya registrado", description: "Este pago en efectivo ya fue registrado previamente.", variant: "destructive" });
              } else if (r.ok) {
                toast({ title: "HE pagadas en efectivo", description: `Q${pagoEfectivo.monto.toFixed(2)} → ${agente.nombre_completo}. No se incluirá en planilla.` });
              }
            } catch { }
          }
        }
      } else {
        await apiPost(`${API_BASE}/operaciones/asignar`, {
          puestoId: puesto.id,
          agenteId: agente.id,
          notas,
          forzar,
          usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
        });
        toast({ title: "Agente asignado", description: `${agente.nombre_completo} → ${puesto.nombre}` });
      }
      setModalSustitucion(null);
      setAgenteSeleccionado(null);
      setPuestoContexto(null);
      invalidate();
    } catch (e: any) {
      if (e.ssaId) {
        toast({ title: "Conflicto — Servicio Especial activo", description: e.error ?? "El agente cubre un SSA activo. Libéralo primero.", variant: "destructive" });
        setModalSustitucion(null);
        return;
      }
      if (e.advertencia) {
        setModalSustitucion((prev) => prev ? { ...prev, advertencia: e.error } : null);
        return;
      }
      toast({ title: "Error", description: e.error ?? "Error al procesar", variant: "destructive" });
    }
  }

  async function confirmarLiberar(motivo: string, horaFin?: string, generarEventoFalta?: boolean) {
    if (!modalLiberar) return;
    try {
      if (modalLiberar.es_custodia) {
        const parts = String(modalLiberar.id).split("-");
        const clienteId = Number(parts[1]);
        const slotNumero = Number(parts[2]);
        await apiPost(`${API_BASE}/operaciones/asignar-custodia`, {
          clienteId,
          slotNumero,
          employeeId: null,
          fecha: fechaVista || undefined,
        });
      } else {
        await apiPost(`${API_BASE}/operaciones/liberar`, {
          puestoId: modalLiberar.id,
          motivo,
          horaFin: horaFin ?? null,
          generarEventoFalta: generarEventoFalta ?? false,
          usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
        });
      }
      const extra = !modalLiberar.es_custodia && generarEventoFalta ? " · Falta registrada en RRHH" : "";
      toast({ title: "Puesto liberado", description: `${modalLiberar.agente_nombre} removido de ${modalLiberar.nombre}${extra}` });
      setModalLiberar(null);
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e.error ?? "Error al liberar", variant: "destructive" });
    }
  }

  async function confirmarQuitarTitular(motivo: string) {
    if (!modalQuitarTitular) return;
    try {
      if (modalQuitarTitular.puesto.es_custodia) {
        const parts = String(modalQuitarTitular.puesto.id).split("-");
        const clienteId = Number(parts[1]);
        const slotNumero = Number(parts[2]);
        await apiPost(`${API_BASE}/operaciones/quitar-titularidad-custodia`, {
          clienteId,
          slotNumero,
          employeeId: modalQuitarTitular.employeeId,
          fecha: fechaVista || undefined,
          motivo,
          usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
        });
      } else {
        await apiPost(`${API_BASE}/operaciones/quitar-titularidad`, {
          puestoId: modalQuitarTitular.puesto.id,
          employeeId: modalQuitarTitular.employeeId,
          motivo,
          usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
        });
      }
      toast({
        title: "Titularidad removida",
        description: `${modalQuitarTitular.employeeNombre} fue removido de ${modalQuitarTitular.puesto.nombre}.`,
      });
      setModalQuitarTitular(null);
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e?.error ?? "Error al quitar titularidad", variant: "destructive" });
    }
  }

  async function confirmarFalta(motivo: string, notas?: string) {
    if (!modalFalta) return;
    try {
      if (modalFalta.puesto.es_custodia) {
        const pId = String(modalFalta.puesto.id);
        const parts = pId.split("-");
        const clienteId = Number(parts[1]);
        const slotNumero = Number(parts[2]);
        await apiPost(`${API_BASE}/operaciones/registrar-falta-custodia`, {
          clienteId,
          slotNumero,
          empleadoId: modalFalta.titularId,
          motivo,
          notas: notas || undefined,
          usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
          fecha: fechaVista,
        });
      } else {
        await apiPost(`${API_BASE}/operaciones/registrar-falta`, {
          puestoId: modalFalta.puesto.id,
          empleadoId: modalFalta.titularId,
          motivo,
          notas: notas || undefined,
          es_24x24: !!modalFalta.puesto.es_par_24x24,
          usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
          fecha: fechaVista,
        });
      }
      toast({ title: "Falta registrada", description: `${modalFalta.titularNombre} — ${modalFalta.puesto.nombre}` });
      setModalFalta(null);
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e.error ?? "Error al registrar falta", variant: "destructive" });
    }
  }

  async function confirmarAnularFalta(motivo: string) {
    if (!modalAnularFalta) return;
    try {
      await apiPost(`${API_BASE}/operaciones/anular-falta`, {
        puestoId: modalAnularFalta.puesto.id,
        motivo,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
        fecha: fechaVista,
      });
      toast({
        title: "Anulación solicitada",
        description: `Pendiente de aprobación de RRHH — ${modalAnularFalta.puesto.nombre}`,
      });
      setModalAnularFalta(null);
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e?.error ?? "Error al anular la falta", variant: "destructive" });
    }
  }

  async function confirmarReactivarFalta(motivo: string) {
    if (!modalReactivarFalta) return;
    try {
      await apiPost(`${API_BASE}/operaciones/reactivar-falta`, {
        puestoId: modalReactivarFalta.puesto.id,
        motivo,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
        fecha: fechaVista,
      });
      toast({
        title: "Falta reactivada",
        description: `El agente vuelve a "faltando" — ${modalReactivarFalta.puesto.nombre}`,
      });
      setModalReactivarFalta(null);
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e?.error ?? "Error al reactivar la falta", variant: "destructive" });
    }
  }

  async function removerAgenteSSA(t: TarjetaSSAPendiente, motivo?: string, notas?: string) {
    try {
      const r = await fetch(`${API_BASE}/solicitudes-servicio/${t.id}/remover-agente`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-isp-session": getSessionToken(),
        },
        body: JSON.stringify({ motivo: motivo ?? null, notas: notas ?? null }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        toast({ title: "Error al remover agente", description: err.error ?? "Error desconocido", variant: "destructive" });
        return;
      }
      const descripcionToast = motivo === "agente_declino"
        ? "El agente declinó. Queda registrado y el SSA volvió a Pendiente Operaciones."
        : "El agente fue desvinculado del servicio y volvió al pool.";
      toast({ title: "Agente removido", description: descripcionToast });
      invalidate();
    } catch {
      toast({ title: "Error de red", description: "No se pudo conectar con el servidor.", variant: "destructive" });
    }
  }

  // Cobertura por AGENTE EXTERNO: cubre un puesto descubierto (guardia o custodia)
  // sin ser empleado. Se paga su HE en EFECTIVO por turno, FUERA de planilla.
  async function confirmarAgenteExterno(externoNombre: string, externoDpi: string, jornada?: string) {
    if (!modalAgenteExterno) return;
    const p = modalAgenteExterno;
    try {
      const body: any = {
        externoNombre,
        externoDpi,
        usuario: currentUser?.nombre ?? currentUser?.username ?? "sistema",
        fecha: fechaVista || undefined,
      };
      if (p.es_custodia) {
        body.esCustodia = true;
        body.clienteId = p.cliente_id;
        body.slotNumero = p.slot_numero;
      } else {
        body.puestoId = p.id;
        if (jornada) body.jornada = jornada;
      }
      const resp = await apiPost(`${API_BASE}/operaciones/cubrir-externo`, body);
      toast({
        title: "Cobertura registrada",
        description: resp?.mensaje ?? `${externoNombre} (externo) cubre ${p.nombre} — HE en efectivo, fuera de planilla`,
      });
      setModalAgenteExterno(null);
      invalidate();
    } catch (e: any) {
      toast({
        title: "No se pudo cubrir",
        description: e?.error ?? "No se pudo registrar la cobertura por agente externo.",
        variant: "destructive",
      });
    }
  }

  return {
    modalAgenteExterno, setModalAgenteExterno,
    confirmarAgenteExterno,
    modalSustitucion, setModalSustitucion,
    modalEligeCobertura, setModalEligeCobertura,
    modalCustodiaTipo, setModalCustodiaTipo,
    modalSustituyeTitular, setModalSustituyeTitular,
    modalIncentivo, setModalIncentivo,
    modalLiberar, setModalLiberar,
    modalFalta, setModalFalta,
    modalQuitarTitular, setModalQuitarTitular,
    modalAnularFalta, setModalAnularFalta,
    confirmarAnularFalta,
    modalReactivarFalta, setModalReactivarFalta,
    confirmarReactivarFalta,
    asignarCustodia,
    ejecutarAsignarCustodia,
    iniciarAsignacion,
    confirmarEligeCobertura,
    confirmarSustituyeTitular,
    confirmarSustitucion,
    confirmarLiberar,
    confirmarQuitarTitular,
    confirmarFalta,
    removerAgenteSSA,
  };
}
