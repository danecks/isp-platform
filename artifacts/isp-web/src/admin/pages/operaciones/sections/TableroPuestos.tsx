import { useState } from "react";
import { Loader2, Lock, Unlock, Shield, Plus, MapPin } from "lucide-react";
import type { Puesto } from "../types";
import { ClienteColumna } from "../components/ClienteColumna";
import { ModalRutaCustodia } from "../components/ModalRutaCustodia";
import { formatFechaVista } from "../helpers";
import { useOperacionesContext } from "../OperacionesContext";

interface RutaModalState {
  clienteId: number;
  clienteNombre: string;
  employeeId: number | null;
  employeeNombre: string;
  slotNumero?: number | null;
  esExterno?: boolean;
}

export function TableroPuestos() {
  const [rutaModal, setRutaModal] = useState<RutaModalState | null>(null);
  const {
    loadingTablero, tablero, tableroFiltrado, fechaVistaCerrada, fechaVista,
    esAdmin, esFuturo, isDeleteMode, agenteSeleccionado,
    cambiosFuturosProximos, planFuturoPorPuesto, clienteResaltado, colGlobal, puestoContexto,
    puedeQuitarTitular, handlePuestoClick, setNuevoPuestoData, eliminarPuesto,
    setModalSegmentos, setPuestoParaTurno, planFuturoFlow, assignment, cierre,
    handleLimpiarFiltros,
  } = useOperacionesContext();

  const onLiberar = (p: Puesto) => esFuturo
    ? planFuturoFlow.setModalPlanFuturo({ puesto: p, plan: planFuturoPorPuesto[p.id] ?? null })
    : assignment.setModalLiberar(p);
  const onRegistrarFalta = (p: Puesto, titularId: number, titularNombre: string) =>
    assignment.setModalFalta({ puesto: p, titularId, titularNombre });
  const onAnularFalta = (p: Puesto, titularNombre: string) =>
    assignment.setModalAnularFalta({ puesto: p, titularNombre });
  const onReactivarFalta = (p: Puesto, titularNombre: string) =>
    assignment.setModalReactivarFalta({ puesto: p, titularNombre });
  const onConfigTurno = (p: Puesto) => esFuturo
    ? planFuturoFlow.setModalPlanFuturo({ puesto: p, plan: planFuturoPorPuesto[p.id] ?? null })
    : setPuestoParaTurno(p);
  const onQuitarTitular = (p: Puesto, employeeId: number, employeeNombre: string) =>
    assignment.setModalQuitarTitular({ puesto: p, employeeId, employeeNombre });
  const onRegistrarRuta = (p: Puesto, employeeId: number | null, employeeNombre: string) => {
    if (!p.cliente_id) return;
    setRutaModal({
      clienteId: p.cliente_id,
      clienteNombre: (p as any).cliente_nombre ?? `Cliente ${p.cliente_id}`,
      employeeId,
      employeeNombre,
      slotNumero: p.slot_numero ?? null,
      esExterno: (p as any).es_externo === true,
    });
  };
  const onAgenteExterno = (p: Puesto) => assignment.setModalAgenteExterno(p);

  return (
    <div className="flex-1 overflow-auto relative" style={{ minHeight: 0 }}>
      {fechaVistaCerrada && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          <div className="absolute inset-0 bg-[#04090f]/60 backdrop-blur-[1px] rounded-xl" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-3 bg-[#07111f] border border-amber-500/30 rounded-2xl px-6 py-4 shadow-2xl shadow-amber-500/10">
              <Lock className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-sm font-bold text-amber-300">Día operativo cerrado</p>
                <p className="text-xs text-amber-400/60 mt-0.5">Modo solo lectura · {formatFechaVista(fechaVista)}</p>
              </div>
              {esAdmin && (
                <button
                  onClick={() => cierre.setModalReabrir(true)}
                  className="pointer-events-auto flex items-center gap-1.5 text-xs font-semibold text-white bg-red-600/80 hover:bg-red-600 rounded-xl px-3 py-1.5 ml-2 transition-colors"
                >
                  <Unlock className="w-3 h-3" /> Reabrir
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {loadingTablero ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
          <span className="text-sm text-white/40">Cargando pizarrón…</span>
        </div>
      ) : tablero.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <Shield className="w-12 h-12 text-white/10" />
          <p className="text-white/30 text-sm">No hay puestos operativos configurados</p>
          <button
            onClick={() => setNuevoPuestoData("nuevo")}
            className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors border border-primary/20 rounded-xl px-4 py-2"
          >
            <Plus className="w-3.5 h-3.5" /> Crear primer puesto
          </button>
        </div>
      ) : tableroFiltrado.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <MapPin className="w-12 h-12 text-white/10" />
          <p className="text-white/30 text-sm">Ningún puesto coincide con los filtros aplicados</p>
          <button
            onClick={handleLimpiarFiltros}
            className="text-xs text-amber-400/60 hover:text-amber-400 transition-colors"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="flex gap-3 h-full pb-2">
          {tableroFiltrado.map((cliente) => (
            <ClienteColumna
              key={cliente.clienteNombre}
              cliente={cliente}
              agenteSeleccionadoId={agenteSeleccionado?.id ?? null}
              onPuestoClick={handlePuestoClick}
              onLiberar={onLiberar}
              onRegistrarFalta={!esFuturo ? onRegistrarFalta : undefined}
              onAnularFalta={!esFuturo && puedeQuitarTitular && !fechaVistaCerrada ? onAnularFalta : undefined}
              onReactivarFalta={!esFuturo && puedeQuitarTitular && !fechaVistaCerrada ? onReactivarFalta : undefined}
              onNuevoPuesto={(c) => setNuevoPuestoData(c)}
              onEliminarPuesto={eliminarPuesto}
              isDeleteMode={isDeleteMode}
              onAbrirSegmentos={(p) => { if (!esFuturo) setModalSegmentos(p); }}
              onConfigTurno={onConfigTurno}
              onQuitarTitular={puedeQuitarTitular ? onQuitarTitular : undefined}
              onRegistrarRuta={!esFuturo ? onRegistrarRuta : undefined}
              onAgenteExterno={!esFuturo && !fechaVistaCerrada ? onAgenteExterno : undefined}
              cambiosFuturosProximos={!esFuturo ? cambiosFuturosProximos : undefined}
              planFuturoPorPuesto={esFuturo ? planFuturoPorPuesto : undefined}
              resaltado={clienteResaltado !== null && cliente.clienteId === clienteResaltado}
              colGlobal={colGlobal}
              puestoContextoId={puestoContexto?.id ?? null}
            />
          ))}
        </div>
      )}
      {rutaModal && (
        <ModalRutaCustodia
          clienteId={rutaModal.clienteId}
          clienteNombre={rutaModal.clienteNombre}
          fecha={fechaVista}
          employeeId={rutaModal.employeeId}
          employeeNombre={rutaModal.employeeNombre}
          slotNumero={rutaModal.slotNumero ?? null}
          esExterno={rutaModal.esExterno}
          onClose={() => setRutaModal(null)}
        />
      )}
    </div>
  );
}
