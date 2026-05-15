import { User, UserPlus, Calendar, AlertCircle, Repeat } from "lucide-react";
import { iniciales, avatarColor, TURNO_COLORS } from "../utils";
import { Puesto, PlanFuturo, LABELS_AUSENCIA_FUTURO } from "../types";

export function TarjetaPuestoFuturo({
  puesto,
  plan,
  estadoTitular,
  onClick,
}: {
  puesto: Puesto;
  plan: PlanFuturo | null;
  estadoTitular?: "trabajando" | "descansando" | "sin_turno" | null;
  onClick: () => void;
}) {
  const tieneRelevo = !!(plan?.relevo_id);

  // Badge de estado del titular según ciclo de turno
  const estadoBadge = estadoTitular === "trabajando"
    ? { label: "Trabaja", cls: "text-teal-300/80 bg-teal-500/10 border-teal-500/25" }
    : estadoTitular === "descansando"
    ? { label: "Descansa", cls: "text-blue-300/80 bg-blue-500/10 border-blue-500/25" }
    : null;

  return (
    <div
      onClick={onClick}
      className={`
        relative rounded-xl border p-3 transition-all cursor-pointer group
        ${plan
          ? tieneRelevo
            ? "bg-[#080f1c] border-indigo-500/30 hover:border-indigo-400/50"
            : "bg-[#120d08] border-amber-500/30 hover:border-amber-400/50"
          : "bg-[#07111f] border-white/6 hover:border-indigo-500/20"
        }
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/80 truncate">{puesto.nombre}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {/* Turno real del puesto */}
            {puesto.turno_nombre ? (
              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${
                puesto.tipo_ciclo === "alternado"
                  ? "text-indigo-300/80 bg-indigo-500/8 border-indigo-500/20"
                  : "text-emerald-300/70 bg-emerald-500/6 border-emerald-500/15"
              }`}>
                {puesto.tipo_ciclo === "alternado" && <Repeat className="w-2 h-2 inline mr-0.5 opacity-70" />}
                {puesto.turno_nombre}
              </span>
            ) : (
              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${TURNO_COLORS[puesto.turno] ?? "text-white/30 bg-white/5 border-white/10"}`}>
                {puesto.turno}
              </span>
            )}
            {/* Estado titular: trabaja / descansa ese día */}
            {estadoBadge && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${estadoBadge.cls}`}>
                {estadoBadge.label}
              </span>
            )}
            {plan && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${
                tieneRelevo
                  ? "text-indigo-300/90 bg-indigo-500/10 border-indigo-500/25"
                  : "text-amber-300/90 bg-amber-500/10 border-amber-500/25"
              }`}>
                {tieneRelevo ? "CUBIERTO" : "SIN RELEVO"}
              </span>
            )}
            {!plan && !estadoBadge && (
              <span className="text-[9px] px-1.5 py-0.5 rounded border font-semibold text-white/20 bg-white/3 border-white/8">
                Sin cambios
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 mt-0.5">
          <Calendar className={`w-3.5 h-3.5 ${plan ? (tieneRelevo ? "text-indigo-400" : "text-amber-400") : "text-white/10"}`} />
        </div>
      </div>

      {/* Titular esperado */}
      {puesto.titular_nombre && !plan && (
        <div className="flex items-center gap-1.5 mb-2">
          <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${avatarColor(puesto.titular_nombre)}`}>
            {iniciales(puesto.titular_nombre)}
          </div>
          <p className="text-[10px] text-white/50 truncate">{puesto.titular_nombre.split(" ").slice(0,3).join(" ")}</p>
          {estadoBadge && (
            <span className={`text-[8px] font-semibold ml-auto ${estadoTitular === "trabajando" ? "text-teal-400/70" : "text-blue-400/70"}`}>
              {estadoTitular === "trabajando" ? "↑ Turno" : "↓ Descanso"}
            </span>
          )}
        </div>
      )}

      {plan ? (
        <div className="space-y-1.5">
          {/* Tipo de ausencia */}
          <div className="flex items-center gap-1.5 px-1.5 py-1 bg-amber-500/6 rounded-lg border border-amber-500/15">
            <AlertCircle className="w-2.5 h-2.5 text-amber-400/60 shrink-0" />
            <p className="text-[9px] text-amber-300/60 truncate">
              <span className="text-amber-300/80 font-semibold">
                {LABELS_AUSENCIA_FUTURO[plan.tipo_ausencia ?? ""] ?? "Ausencia"}:
              </span>{" "}
              {plan.titular_ausente_nombre ?? puesto.titular_nombre ?? "Titular"}
            </p>
          </div>

          {/* Relevo */}
          {plan.relevo_nombre ? (
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${avatarColor(plan.relevo_nombre)}`}>
                {iniciales(plan.relevo_nombre)}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-indigo-200/80 font-medium truncate">{plan.relevo_nombre}</p>
                <p className="text-[9px] text-indigo-300/40">Relevo programado</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-400/50">
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <p className="text-[10px]">Toca para asignar relevo →</p>
            </div>
          )}

          {plan.motivo && (
            <p className="text-[9px] text-white/25 truncate pt-0.5">· {plan.motivo}</p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-white/15">
          <User className="w-4 h-4 shrink-0" />
          <p className="text-[11px]">Sin ausencias planificadas</p>
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-white/5">
        <p className="text-[9px] text-indigo-400/40 group-hover:text-indigo-400 transition-colors">
          {plan ? "Editar planificación →" : "+ Planificar ausencia o cobertura"}
        </p>
      </div>
    </div>
  );
}

// ─── Panel: Disponibilidad Futura (reemplaza el pool en vista futura) ─────────

