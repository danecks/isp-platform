import { useState } from "react";
import { Shield, ChevronRight, Edit2, AlertTriangle, Undo2 } from "lucide-react";
import type { SupervisorPool } from "../types";
import { avatarColor, iniciales, API_BASE, apiPost } from "../utils";
import { useOperacionesContext } from "../OperacionesContext";
import { ModalFaltaPersonal } from "../modals/ModalFaltaPersonal";

export function PanelSupervisoresHoy() {
  const {
    pool, esFuturo, agenteSeleccionado, setAgenteSeleccionado, fechaVistaCerrada,
    colSupers, toggleColSupers, setEditarPlantilla, setFichaVehiculoId,
    refetchPool, currentUserNombre, fechaVista, puedeQuitarTitular,
  } = useOperacionesContext();

  const [faltaModal, setFaltaModal] = useState<{ sv: SupervisorPool; modo: "registrar" | "anular" } | null>(null);

  if (esFuturo || !pool || (pool.supervisores?.length ?? 0) === 0) return null;

  const svTrabajando  = pool.supervisores.filter(sv => sv.estado_ciclo === "trabajando");
  const svDisponHE    = pool.supervisores.filter(sv => sv.estado_ciclo === "disponible_he");
  const svDescanso    = pool.supervisores.filter(sv => sv.estado_ciclo === "descansando_ciclo");
  const svOtros       = pool.supervisores.filter(sv => !["trabajando","disponible_he","descansando_ciclo"].includes(sv.estado_ciclo ?? ""));
  const puedeCubrirCount = pool.supervisores.filter(sv => sv.puede_cubrir).length;

  async function confirmarFalta(motivo: string, notas?: string) {
    if (!faltaModal) return;
    try {
      const url = faltaModal.modo === "anular"
        ? `${API_BASE}/operaciones/anular-falta-personal`
        : `${API_BASE}/operaciones/falta-personal`;
      await apiPost(url, {
        employeeId: faltaModal.sv.id,
        motivo,
        notas,
        usuario: currentUserNombre,
        fecha: fechaVista,
      });
      setFaltaModal(null);
      refetchPool();
    } catch (e: any) {
      alert(e?.error ?? "Error al procesar la falta");
    }
  }

  const SvCard = ({ sv }: { sv: SupervisorPool }) => {
    const estadoCiclo = sv.estado_ciclo;
    const estadoBadge = estadoCiclo === "trabajando"
      ? { cls: "text-emerald-300/90 bg-emerald-500/15 border-emerald-500/30", label: "EN TURNO" }
      : estadoCiclo === "disponible_he"
        ? { cls: "text-amber-300/80 bg-amber-500/12 border-amber-500/25", label: "DISP. HE" }
        : estadoCiclo === "descansando_ciclo"
          ? { cls: "text-white/25 bg-white/3 border-white/8", label: "DESCANSO" }
          : estadoCiclo === "licencia"
            ? { cls: "text-indigo-300/70 bg-indigo-500/10 border-indigo-500/20", label: "LICENCIA" }
            : estadoCiclo === "suspendido"
              ? { cls: "text-red-300/70 bg-red-500/10 border-red-500/20", label: "SUSP." }
              : { cls: "text-white/20 bg-white/3 border-white/6", label: "SIN TURNO" };
    const badgeFinal = sv.faltando
      ? { cls: "text-red-300/90 bg-red-500/20 border-red-500/40", label: "FALTANDO" }
      : estadoBadge;

    const esSeleccionado = agenteSeleccionado?.id === sv.id;
    const estaEnDescansoPool = pool.descansandoCiclo.some(a => a.id === sv.id);
    const seleccionable = estaEnDescansoPool && !fechaVistaCerrada;

    const handleClick = seleccionable ? () => {
      const agente = pool.descansandoCiclo.find(a => a.id === sv.id);
      if (agente) setAgenteSeleccionado(prev => prev?.id === agente.id ? null : agente);
    } : undefined;

    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all select-none ${esSeleccionado ? "border-violet-400/60 bg-violet-500/15 ring-1 ring-violet-400/30" : seleccionable ? "border-violet-500/20 bg-violet-500/5 cursor-pointer hover:border-violet-400/40 hover:bg-violet-500/10" : "border-white/5 bg-transparent"}`}
        onClick={handleClick}
      >
        <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${avatarColor(sv.nombre_completo)} ${esSeleccionado ? "ring-2 ring-violet-400/50" : sv.puede_cubrir ? "ring-1 ring-violet-400/20" : ""}`}>
          {iniciales(sv.nombre_completo)}
        </div>
        <p className={`text-[11px] font-medium truncate max-w-[88px] ${sv.puede_cubrir || estadoCiclo === "trabajando" ? "text-white/80" : "text-white/35"}`}>{sv.nombre_completo.split(" ").slice(0,2).join(" ")}</p>
        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${badgeFinal.cls}`}>{badgeFinal.label}</span>
        {esSeleccionado && <span className="text-[8px] text-violet-300 animate-pulse shrink-0">✓</span>}
        {(sv as any).vehiculos_zona?.length > 0 && ((sv as any).vehiculos_zona as Array<{ id: number; placa: string; estado: string }>).filter(v => v.estado === "activo").slice(0,1).map(veh => (
          <button key={veh.id} onClick={e => { e.stopPropagation(); setFichaVehiculoId(veh.id); }} className="text-[8px] text-sky-300/60 border border-sky-500/20 bg-sky-500/8 px-1 py-0.5 rounded shrink-0">🚗</button>
        ))}
        {!sv.faltando && estadoCiclo === "trabajando" && !fechaVistaCerrada && (
          <button
            onClick={e => { e.stopPropagation(); setFaltaModal({ sv, modo: "registrar" }); }}
            title="Registrar falta"
            className="text-amber-300/60 hover:text-amber-200 hover:bg-amber-500/15 border border-amber-500/20 rounded p-0.5 shrink-0">
            <AlertTriangle className="w-2.5 h-2.5" />
          </button>
        )}
        {sv.faltando && puedeQuitarTitular && !fechaVistaCerrada && (
          <button
            onClick={e => { e.stopPropagation(); setFaltaModal({ sv, modo: "anular" }); }}
            title="Anular falta"
            className="text-sky-300/60 hover:text-sky-200 hover:bg-sky-500/15 border border-sky-500/20 rounded p-0.5 shrink-0">
            <Undo2 className="w-2.5 h-2.5" />
          </button>
        )}
        <button
          onClick={e => { e.stopPropagation(); setEditarPlantilla({ empleadoId: sv.id, empleadoNombre: sv.nombre_completo, tipo: "supervisor" }); }}
          title="Editar plantilla de turno"
          className="text-violet-300/60 hover:text-violet-200 hover:bg-violet-500/15 border border-violet-500/20 rounded p-0.5 shrink-0">
          <Edit2 className="w-2.5 h-2.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="bg-[#060f1a] border border-violet-500/15 rounded-xl overflow-hidden">
      <button
        onClick={toggleColSupers}
        className="w-full flex items-center gap-2 px-3 py-2 text-left group hover:bg-violet-500/5 transition-colors"
      >
        <Shield className="w-3 h-3 text-violet-400/60 shrink-0" />
        <span className="text-[11px] font-bold text-violet-300/65 uppercase tracking-widest">Supervisores</span>
        <span className="text-[9px] text-violet-400/45 font-bold bg-violet-500/10 border border-violet-500/15 px-1 py-0.5 rounded-full">{pool.supervisores.length}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-[10px]">
          {svTrabajando.length > 0 && <span className="text-emerald-400/80 font-semibold">🟢 {svTrabajando.length} turno</span>}
          {(svDescanso.length + svDisponHE.length) > 0 && <span className="text-blue-400/60">🔵 {svDescanso.length + svDisponHE.length} descanso</span>}
          {puedeCubrirCount > 0 && <span className="text-violet-300/90 font-bold bg-violet-500/12 border border-violet-500/20 px-1.5 py-0.5 rounded-full">⚡ {puedeCubrirCount} apto</span>}
        </div>
        <ChevronRight className={`w-3 h-3 text-violet-400/25 group-hover:text-violet-400/50 ml-2 shrink-0 transition-transform ${colSupers ? "" : "rotate-90"}`} />
      </button>
      {!colSupers && (
        <div className="border-t border-violet-500/8 p-2 flex flex-wrap gap-2 max-h-28 overflow-y-auto">
          {[...svTrabajando, ...svDisponHE, ...svDescanso, ...svOtros].map(sv => (
            <SvCard key={sv.id} sv={sv} />
          ))}
        </div>
      )}
      {faltaModal && (
        <ModalFaltaPersonal
          modo={faltaModal.modo}
          nombre={faltaModal.sv.nombre_completo}
          cargo="Supervisor"
          onConfirm={confirmarFalta}
          onClose={() => setFaltaModal(null)}
        />
      )}
    </div>
  );
}
