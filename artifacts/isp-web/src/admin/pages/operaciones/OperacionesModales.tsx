import { ModalFichaVehiculo } from "@/admin/components/ModalFichaVehiculo";
import { EditarPlantillaPersonalModal } from "./EditarPlantillaPersonalModal";
import { ModalSegmentos } from "./modals/ModalSegmentos";
import { ModalConfigTurno } from "./modals/ModalConfigTurno";
import { ModalPlanSSA } from "./modals/ModalPlanSSA";
import { ModalPlanFuturo } from "./modals/ModalPlanFuturo";
import { ModalSustituyeTitular } from "./modals/ModalSustituyeTitular";
import { ModalEligeCobertura } from "./modals/ModalEligeCobertura";
import { ModalCustodiaTipo } from "./modals/ModalCustodiaTipo";
import { ModalSustitucion } from "./modals/ModalSustitucion";
import { ModalNuevoPuesto } from "./modals/ModalNuevoPuesto";
import { ModalLiberar } from "./modals/ModalLiberar";
import { ModalRegistrarFalta } from "./modals/ModalRegistrarFalta";
import { ModalCierre } from "./modals/ModalCierre";
import { ModalReabrir } from "./modals/ModalReabrir";
import { ModalQuitarTitularidad } from "./modals/ModalQuitarTitularidad";
import { ModalIncentivoCash } from "./modals/ModalIncentivoCash";
import { ModalAsignarSSA } from "./modals/ModalAsignarSSA";
import { fechaHoyStr, API_BASE } from "./utils";
import { formatFechaVista } from "./helpers";
import type {
  ClienteBoard, ClienteDisponible, CierreHoyData, DiaPendienteCierre,
  Movimiento, Pool, Puesto, TarjetaSSAPendiente,
} from "./types";
import { PanelHistorial } from "./components/PanelHistorial";
import type { useAssignmentFlow } from "./hooks/use-assignment-flow";
import type { useCierreFlow } from "./hooks/use-cierre-flow";
import type { usePlanFuturoFlow } from "./hooks/use-plan-futuro-flow";
import type { QueryClient } from "@tanstack/react-query";

type Assignment = ReturnType<typeof useAssignmentFlow>;
type Cierre = ReturnType<typeof useCierreFlow>;
type PlanFuturoFlow = ReturnType<typeof usePlanFuturoFlow>;

interface Props {
  qc: QueryClient;
  pool: Pool | undefined;
  cierreHoy: CierreHoyData | undefined;
  hoyISO: string;
  fechaVista: string;
  esOtraFecha: boolean;
  esPasado: boolean;
  diaHoyCerrado: boolean;
  fechaCierreParaReabrir: string;
  primerDiaPendiente: DiaPendienteCierre | null;
  clientesDisponibles: ClienteDisponible[];
  currentUserNombre: string;

  historialAbierto: boolean;
  onCloseHistorial: () => void;
  historial: Movimiento[];
  loadingHistorial: boolean;

  nuevoPuestoData: ClienteBoard | null | "nuevo";
  onCloseNuevoPuesto: () => void;
  onCrearPuesto: (data: {
    clienteId: number | null;
    clienteNombre: string;
    nombre: string;
    turno: string;
    notas: string;
    tipoTurnoId: number;
    fechaInicioCiclo: string;
    zonaOperativaId: number;
    tipoPuesto: "normal" | "custodia";
  }) => Promise<void>;

  modalSegmentos: Puesto | null;
  onCloseSegmentos: () => void;

  modalAsignarSSA: TarjetaSSAPendiente | null;
  onCloseAsignarSSA: () => void;

  fichaVehiculoId: number | null;
  onCloseVehiculo: () => void;

  editarPlantilla: { empleadoId: number; empleadoNombre: string; tipo: "supervisor" | "administrativo" | "jefe_servicio" } | null;
  onCloseEditarPlantilla: () => void;

  puestoParaTurno: Puesto | null;
  onCloseConfigTurno: () => void;

  assignment: Assignment;
  cierre: Cierre;
  planFuturoFlow: PlanFuturoFlow;
}

export function OperacionesModales(p: Props) {
  const { assignment, cierre, planFuturoFlow } = p;

  return (
    <>
      {p.historialAbierto && (
        <PanelHistorial movimientos={p.historial} isLoading={p.loadingHistorial} onClose={p.onCloseHistorial} />
      )}

      {assignment.modalSustituyeTitular && (
        <ModalSustituyeTitular
          puesto={assignment.modalSustituyeTitular.puesto}
          agente={assignment.modalSustituyeTitular.agente}
          onConfirm={assignment.confirmarSustituyeTitular}
          onCancel={() => assignment.setModalSustituyeTitular(null)}
        />
      )}

      {assignment.modalEligeCobertura && (
        <ModalEligeCobertura
          puesto={assignment.modalEligeCobertura.puesto}
          agente={assignment.modalEligeCobertura.agente}
          onElegir={assignment.confirmarEligeCobertura}
          onCancel={() => assignment.setModalEligeCobertura(null)}
        />
      )}

      {assignment.modalSustitucion && (
        <ModalSustitucion
          puesto={assignment.modalSustitucion.puesto}
          agenteEntrante={assignment.modalSustitucion.agente}
          advertencia={assignment.modalSustitucion.advertencia}
          agentePoolStatus={assignment.modalSustitucion.agentePoolStatus}
          onConfirm={assignment.confirmarSustitucion}
          onCancel={() => assignment.setModalSustitucion(null)}
        />
      )}

      {assignment.modalCustodiaTipo && (
        <ModalCustodiaTipo
          agenteNombre={assignment.modalCustodiaTipo.agente.nombre_completo}
          slotNumero={assignment.modalCustodiaTipo.slotNumero}
          onElegir={async (soloCobertura) => {
            const data = assignment.modalCustodiaTipo!;
            assignment.setModalCustodiaTipo(null);
            await assignment.ejecutarAsignarCustodia(data.clienteId, data.slotNumero, data.agente, soloCobertura, data.puesto);
          }}
          onCancel={() => assignment.setModalCustodiaTipo(null)}
        />
      )}

      {assignment.modalLiberar && (
        <ModalLiberar puesto={assignment.modalLiberar} onConfirm={assignment.confirmarLiberar} onClose={() => assignment.setModalLiberar(null)} />
      )}

      {assignment.modalFalta && (
        <ModalRegistrarFalta
          puesto={assignment.modalFalta.puesto}
          titularId={assignment.modalFalta.titularId}
          titularNombre={assignment.modalFalta.titularNombre}
          onConfirm={assignment.confirmarFalta}
          onClose={() => assignment.setModalFalta(null)}
        />
      )}

      {assignment.modalQuitarTitular && (
        <ModalQuitarTitularidad
          puesto={assignment.modalQuitarTitular.puesto}
          employeeNombre={assignment.modalQuitarTitular.employeeNombre}
          onConfirm={assignment.confirmarQuitarTitular}
          onClose={() => assignment.setModalQuitarTitular(null)}
        />
      )}

      {p.nuevoPuestoData && (
        <ModalNuevoPuesto
          clientePreseleccionado={typeof p.nuevoPuestoData === "object" ? p.nuevoPuestoData : undefined}
          clientes={p.clientesDisponibles}
          onSave={p.onCrearPuesto}
          onClose={p.onCloseNuevoPuesto}
        />
      )}

      {cierre.modalCierre && p.cierreHoy && (
        <ModalCierre
          resumen={p.esPasado
            ? { totalPuestos: 0, cubiertos: 0, descubiertos: 0, cubiertosPorTitular: 0, cubiertosPorRelevo: 0, ausencias: 0, horasExtra: 0 }
            : p.cierreHoy.resumen}
          advertencias={p.esPasado
            ? [`Cierre retroactivo del día ${formatFechaVista(p.fechaVista)}`]
            : p.cierreHoy.advertencias}
          fechaActivaStr={formatFechaVista(p.fechaVista)}
          fechaIso={p.fechaVista}
          onConfirm={cierre.cerrarDia}
          onClose={() => cierre.setModalCierre(false)}
        />
      )}

      {cierre.modalCierrePendiente && p.primerDiaPendiente && (
        <ModalCierre
          resumen={{ totalPuestos: 0, cubiertos: 0, descubiertos: 0, cubiertosPorTitular: 0, cubiertosPorRelevo: 0, ausencias: 0, horasExtra: 0 }}
          advertencias={[`Cierre retroactivo del día ${p.primerDiaPendiente.fechaStr}`]}
          fechaActivaStr={p.primerDiaPendiente.fechaStr}
          fechaIso={p.primerDiaPendiente.fecha}
          onConfirm={cierre.cerrarDiaPendiente}
          onClose={() => cierre.setModalCierrePendiente(false)}
        />
      )}

      {cierre.diaPendienteSeleccionado && (
        <ModalCierre
          resumen={{ totalPuestos: 0, cubiertos: 0, descubiertos: 0, cubiertosPorTitular: 0, cubiertosPorRelevo: 0, ausencias: 0, horasExtra: 0 }}
          advertencias={[`Cierre retroactivo del día ${cierre.diaPendienteSeleccionado.fechaStr}`]}
          fechaActivaStr={cierre.diaPendienteSeleccionado.fechaStr}
          fechaIso={cierre.diaPendienteSeleccionado.fecha}
          onConfirm={(comentario, syncCustodias) => cierre.cerrarDiaPorFecha(cierre.diaPendienteSeleccionado!, comentario, syncCustodias)}
          onClose={() => cierre.setDiaPendienteSeleccionado(null)}
        />
      )}

      {cierre.modalReabrir && (
        <ModalReabrir
          cierre={p.diaHoyCerrado ? (p.cierreHoy?.cierreDeHoy ?? null) : (p.cierreHoy?.cierre ?? null)}
          fechaParaReabrir={p.fechaCierreParaReabrir}
          onConfirm={cierre.reabrirDia}
          onClose={() => cierre.setModalReabrir(false)}
        />
      )}

      {p.fichaVehiculoId && (
        <ModalFichaVehiculo vehiculoId={p.fichaVehiculoId} onClose={p.onCloseVehiculo} />
      )}

      {p.editarPlantilla && (
        <EditarPlantillaPersonalModal
          empleadoId={p.editarPlantilla.empleadoId}
          empleadoNombre={p.editarPlantilla.empleadoNombre}
          tipo={p.editarPlantilla.tipo}
          onClose={p.onCloseEditarPlantilla}
          onChanged={() => { p.qc.invalidateQueries({ queryKey: ["operaciones-pool"] }); }}
        />
      )}

      {p.modalSegmentos && (
        <ModalSegmentos
          puesto={p.modalSegmentos}
          fecha={p.esOtraFecha ? p.fechaVista : (p.cierreHoy?.fechaActiva ?? p.hoyISO)}
          onClose={p.onCloseSegmentos}
        />
      )}

      {p.modalAsignarSSA && (
        <ModalAsignarSSA
          tarjeta={p.modalAsignarSSA}
          disponibles={p.pool?.disponibles ?? []}
          onClose={p.onCloseAsignarSSA}
          onSuccess={() => {
            p.onCloseAsignarSSA();
            p.qc.invalidateQueries({ queryKey: ["ssa-tablero-pizarron"] });
          }}
        />
      )}

      {planFuturoFlow.modalPlanFuturo && (
        <ModalPlanFuturo
          puesto={planFuturoFlow.modalPlanFuturo.puesto}
          fecha={p.fechaVista}
          planExistente={planFuturoFlow.modalPlanFuturo.plan}
          onGuardar={planFuturoFlow.guardarPlanFuturo}
          onEliminar={planFuturoFlow.modalPlanFuturo.plan ? () => planFuturoFlow.eliminarPlanFuturo(planFuturoFlow.modalPlanFuturo!.plan!.id) : undefined}
          onClose={() => planFuturoFlow.setModalPlanFuturo(null)}
        />
      )}

      {planFuturoFlow.modalPlanSSA && (
        <ModalPlanSSA
          ssa={planFuturoFlow.modalPlanSSA}
          fecha={p.fechaVista}
          planAgentes={planFuturoFlow.modalPlanSSA.plan_agentes ?? []}
          onGuardar={planFuturoFlow.guardarPlanSSA}
          onEliminar={planFuturoFlow.eliminarPlanSSA}
          onClose={() => planFuturoFlow.setModalPlanSSA(null)}
        />
      )}

      {p.puestoParaTurno && (
        <ModalConfigTurno
          puesto={p.puestoParaTurno}
          onClose={p.onCloseConfigTurno}
          onSaved={() => {
            p.qc.invalidateQueries({ queryKey: ["operaciones-tablero"] });
            p.qc.invalidateQueries({ queryKey: ["operaciones-pool"] });
          }}
        />
      )}

      {assignment.modalIncentivo && (
        <ModalIncentivoCash
          data={assignment.modalIncentivo}
          autorizadoPor={p.currentUserNombre}
          apiBase={API_BASE}
          onClose={() => assignment.setModalIncentivo(null)}
        />
      )}
    </>
  );
}
