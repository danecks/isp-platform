import { useState } from "react";
import { Briefcase, ChevronRight, Edit2, AlertTriangle, Undo2 } from "lucide-react";
import type { AdministrativoPool } from "../types";
import { SUBAREA_LABELS } from "../types";
import { avatarColor, iniciales, API_BASE, apiPost } from "../utils";
import { useOperacionesContext } from "../OperacionesContext";
import { ModalFaltaPersonal } from "../modals/ModalFaltaPersonal";

export function PanelPersonalAdmin() {
  const {
    pool, esFuturo, colAdmin, toggleColAdmin, setEditarPlantilla,
    fechaVistaCerrada, refetchPool, currentUserNombre, fechaVista, puedeQuitarTitular,
  } = useOperacionesContext();
  const [faltaModal, setFaltaModal] = useState<{ ad: AdministrativoPool; modo: "registrar" | "anular" } | null>(null);
  if (esFuturo || !pool || (pool.administrativos?.length ?? 0) === 0) return null;
  const adTrabajando = pool.administrativos!.filter(ad => ad.estado_ciclo === "trabajando");
  const adDescanso   = pool.administrativos!.filter(ad => ad.estado_ciclo === "descansando_ciclo");
  const adOtros      = pool.administrativos!.filter(ad => !["trabajando","descansando_ciclo"].includes(ad.estado_ciclo ?? ""));

  async function confirmarFalta(motivo: string, notas?: string) {
    if (!faltaModal) return;
    try {
      const url = faltaModal.modo === "anular"
        ? `${API_BASE}/operaciones/anular-falta-personal`
        : `${API_BASE}/operaciones/falta-personal`;
      await apiPost(url, {
        employeeId: faltaModal.ad.id,
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

  const AdCard = ({ ad }: { ad: AdministrativoPool }) => {
    const ec = ad.estado_ciclo;
    const badge = ad.faltando
      ? { cls: "text-red-300/90 bg-red-500/20 border-red-500/40", label: "FALTANDO" }
      : ec === "trabajando"
      ? { cls: "text-emerald-300/90 bg-emerald-500/15 border-emerald-500/30", label: "EN TURNO" }
      : ec === "descansando_ciclo"
        ? { cls: "text-white/25 bg-white/3 border-white/8", label: "DESCANSO" }
        : ec === "licencia"
          ? { cls: "text-indigo-300/70 bg-indigo-500/10 border-indigo-500/20", label: "LICENCIA" }
          : ec === "suspendido"
            ? { cls: "text-red-300/70 bg-red-500/10 border-red-500/20", label: "SUSP." }
            : { cls: "text-white/20 bg-white/3 border-white/6", label: "SIN PLANTILLA" };
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-white/5 bg-transparent">
        <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${avatarColor(ad.nombre_completo)} ${ec === "trabajando" ? "" : "opacity-60"}`}>
          {iniciales(ad.nombre_completo)}
        </div>
        <p className={`text-[11px] font-medium truncate max-w-[100px] ${ec === "trabajando" ? "text-white/85" : "text-white/40"}`}>{ad.nombre_completo.split(" ").slice(0,2).join(" ")}</p>
        {(() => {
          const sa = SUBAREA_LABELS[ad.tipo_personal ?? "administrativo"] ?? SUBAREA_LABELS.administrativo;
          return <span className={`text-[8px] font-bold px-1 py-0.5 rounded border shrink-0 ${sa.cls}`}>{sa.label}</span>;
        })()}
        {ad.area && <span className="text-[9px] text-cyan-300/50 truncate max-w-[60px]">· {ad.area}</span>}
        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${badge.cls}`}>{badge.label}</span>
        {ec === "trabajando" && ad.ps_hora_entrada && (
          <span className="text-[8px] text-white/30 shrink-0">{String(ad.ps_hora_entrada).slice(0,5)}</span>
        )}
        {!ad.faltando && ec === "trabajando" && !fechaVistaCerrada && (
          <button
            onClick={e => { e.stopPropagation(); setFaltaModal({ ad, modo: "registrar" }); }}
            title="Registrar falta"
            className="text-amber-300/60 hover:text-amber-200 hover:bg-amber-500/15 border border-amber-500/20 rounded p-0.5 shrink-0">
            <AlertTriangle className="w-2.5 h-2.5" />
          </button>
        )}
        {ad.faltando && puedeQuitarTitular && !fechaVistaCerrada && (
          <button
            onClick={e => { e.stopPropagation(); setFaltaModal({ ad, modo: "anular" }); }}
            title="Anular falta"
            className="text-sky-300/60 hover:text-sky-200 hover:bg-sky-500/15 border border-sky-500/20 rounded p-0.5 shrink-0">
            <Undo2 className="w-2.5 h-2.5" />
          </button>
        )}
        <button
          onClick={e => { e.stopPropagation(); setEditarPlantilla({ empleadoId: ad.id, empleadoNombre: ad.nombre_completo, tipo: "administrativo" }); }}
          title="Editar plantilla de turno"
          className="text-cyan-300/60 hover:text-cyan-200 hover:bg-cyan-500/15 border border-cyan-500/20 rounded p-0.5 shrink-0">
          <Edit2 className="w-2.5 h-2.5" />
        </button>
      </div>
    );
  };

  return (
    <div className="bg-[#060f1a] border border-cyan-500/15 rounded-xl overflow-hidden">
      <button
        onClick={toggleColAdmin}
        className="w-full flex items-center gap-2 px-3 py-2 text-left group hover:bg-cyan-500/5 transition-colors"
      >
        <Briefcase className="w-3 h-3 text-cyan-400/60 shrink-0" />
        <span className="text-[11px] font-bold text-cyan-300/65 uppercase tracking-widest">Personal Administrativo</span>
        <span className="text-[9px] text-cyan-400/45 font-bold bg-cyan-500/10 border border-cyan-500/15 px-1 py-0.5 rounded-full">{pool.administrativos!.length}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-[10px]">
          {adTrabajando.length > 0 && <span className="text-emerald-400/80 font-semibold">🟢 {adTrabajando.length} hoy</span>}
          {adDescanso.length > 0 && <span className="text-blue-400/60">🔵 {adDescanso.length} descanso</span>}
          {adOtros.length > 0 && <span className="text-white/30">⚪ {adOtros.length} sin plantilla</span>}
        </div>
        <ChevronRight className={`w-3 h-3 text-cyan-400/25 group-hover:text-cyan-400/50 ml-2 shrink-0 transition-transform ${colAdmin ? "" : "rotate-90"}`} />
      </button>
      {!colAdmin && (
        <div className="border-t border-cyan-500/8 p-2 flex flex-wrap gap-2 max-h-32 overflow-y-auto">
          {[...adTrabajando, ...adDescanso, ...adOtros].map(ad => (
            <AdCard key={ad.id} ad={ad} />
          ))}
        </div>
      )}
      {faltaModal && (
        <ModalFaltaPersonal
          modo={faltaModal.modo}
          nombre={faltaModal.ad.nombre_completo}
          cargo="Personal administrativo"
          onConfirm={confirmarFalta}
          onClose={() => setFaltaModal(null)}
        />
      )}
    </div>
  );
}
