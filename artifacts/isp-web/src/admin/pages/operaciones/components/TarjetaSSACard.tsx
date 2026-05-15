import { useState } from "react";
import { X, CheckCircle2, Clock, User, UserCheck } from "lucide-react";
import { TarjetaSSAPendiente, TIPO_SSA_LABELS, MOTIVOS_REMOCION } from "../types";

export function TarjetaSSACard({
  t,
  onAsignar,
  onRemover,
}: {
  t: TarjetaSSAPendiente;
  onAsignar: () => void;
  onRemover?: (motivo: string, notas?: string) => void;
}) {
  const [paso, setPaso] = useState<"idle" | "motivo" | "confirmar">("idle");
  const [motivoSel, setMotivoSel] = useState<string>("");
  const [notas, setNotas] = useState("");

  function resetear() { setPaso("idle"); setMotivoSel(""); setNotas(""); }

  const estaHoy = t.fecha
    ? new Date(t.fecha + "T12:00:00").toDateString() === new Date().toDateString()
    : false;

  const agentesActivos = (t.agentes ?? []).filter((a) => a.estado === "asignado");
  const cantidadRequerida = t.cantidad_guardias ?? 1;
  const cubierto = agentesActivos.length >= cantidadRequerida;
  const parcial  = agentesActivos.length > 0 && !cubierto;
  const sinAgente = agentesActivos.length === 0;
  const tieneRechazados = (t.agentes_rechazados?.length ?? 0) > 0;

  const prioColor = sinAgente
    ? t.prioridad === "urgente" ? "border-red-500/40 bg-red-500/6"
    : t.prioridad === "alta"    ? "border-orange-500/30 bg-orange-500/5"
    :                             "border-amber-500/20 bg-amber-500/4"
    : cubierto
      ? "border-green-500/20 bg-green-500/4"
      : "border-amber-500/25 bg-amber-500/5";

  const prioTag = t.prioridad === "urgente" ? "text-red-400 bg-red-500/15"
    : t.prioridad === "alta"                 ? "text-orange-400 bg-orange-500/15"
    :                                          "text-amber-400 bg-amber-500/15";

  return (
    <div className={`relative shrink-0 flex flex-col gap-1.5 border rounded-xl px-3 py-2.5 min-w-[220px] max-w-[250px] text-left transition-all ${prioColor}`}>

      {/* ── Paso 1: selector de motivo ─────────────────────────────────────── */}
      {paso === "motivo" && onRemover && (
        <div className="absolute inset-0 z-10 rounded-xl bg-[#080f1e]/97 border border-white/10 flex flex-col p-3 gap-2 overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-wide">Motivo de remoción</p>
            <button onClick={(e) => { e.stopPropagation(); resetear(); }} className="text-white/25 hover:text-white/60 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {MOTIVOS_REMOCION.map((m) => (
              <button
                key={m.value}
                onClick={(e) => { e.stopPropagation(); setMotivoSel(m.value); setPaso("confirmar"); }}
                className={`text-left text-[10px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors hover:brightness-125 ${m.color}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Paso 2: confirmar remoción ─────────────────────────────────────── */}
      {paso === "confirmar" && onRemover && (
        <div className="absolute inset-0 z-10 rounded-xl bg-[#080f1e]/97 border border-red-500/20 flex flex-col items-center justify-center gap-3 p-3">
          <div className="text-center">
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-wide mb-1">Confirmar remoción</p>
            <p className="text-[10px] text-white/50">
              Motivo: <span className="text-white/80 font-medium">
                {MOTIVOS_REMOCION.find(m => m.value === motivoSel)?.label ?? motivoSel}
              </span>
            </p>
            {motivoSel === "agente_declino" && (
              <p className="text-[9px] text-red-400/70 mt-1">El agente quedará registrado como "declinó"</p>
            )}
          </div>
          {motivoSel === "otro" && (
            <input
              placeholder="Notas (opcional)"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-full text-[10px] bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white/70 placeholder:text-white/25 outline-none"
            />
          )}
          <div className="flex gap-2 w-full">
            <button
              onClick={(e) => { e.stopPropagation(); setPaso("motivo"); }}
              className="flex-1 text-[10px] px-2 py-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 transition-colors"
            >
              ← Atrás
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRemover(motivoSel, notas || undefined); resetear(); }}
              className="flex-1 text-[10px] font-bold px-2 py-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/35 transition-colors"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}

      {/* Fila: prioridad + HOY + botón remover */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${prioTag}`}>
          {t.prioridad}
        </span>
        {estaHoy && <span className="text-[9px] text-amber-300/70 font-semibold">HOY</span>}
        {tieneRechazados && (
          <span title={`${t.agentes_rechazados.length} declinaron`} className="text-[9px] text-red-400/70 font-semibold">
            ↩{t.agentes_rechazados.length}
          </span>
        )}
        <span className="text-[9px] text-white/25 font-mono">{t.id.slice(0, 8)}</span>
        <div className="ml-auto flex items-center gap-1">
          {!sinAgente && onRemover && (
            <button
              onClick={(e) => { e.stopPropagation(); setPaso("motivo"); }}
              title="Remover agente (seleccionar motivo)"
              className="w-4 h-4 rounded-full flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/15 transition-colors"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* Área clickeable principal → asignar */}
      <button
        onClick={onAsignar}
        className="text-left hover:brightness-110 transition-all"
      >
        {/* Cliente */}
        <p className="text-[11px] font-semibold text-white/90 truncate leading-tight">
          {t.cliente_nombre ?? "—"}
        </p>

        {/* Tipo + cantidad guardias */}
        <p className="text-[10px] text-white/45 truncate mt-0.5">
          {TIPO_SSA_LABELS[t.tipo_solicitud] ?? t.tipo_solicitud}
          {t.cantidad_guardias > 1 ? ` · ${t.cantidad_guardias} guardias` : ""}
        </p>

        {/* Sede + horario */}
        {(t.hora_inicio || t.sede_nombre) && (
          <p className="text-[9px] text-white/30 truncate mt-0.5">
            {t.sede_nombre ?? ""}
            {t.hora_inicio ? ` · ${t.hora_inicio}${t.hora_fin ? `–${t.hora_fin}` : ""}` : ""}
          </p>
        )}

        {/* Estado según etapa — multi-agente */}
        <div className="mt-1 space-y-0.5">
          {/* Badge cobertura */}
          {(cubierto || parcial) && (
            <div className="flex items-center gap-1 mb-0.5">
              <span className={`text-[8px] font-bold px-1 py-0.5 rounded uppercase ${
                cubierto ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400"
              }`}>
                {agentesActivos.length}/{cantidadRequerida} {cubierto ? "cubierto" : "parcial"}
              </span>
              {t.estado_preplanilla === "incluido" && (
                <span className="text-[8px] text-primary/60 flex items-center gap-0.5">
                  <CheckCircle2 className="w-2 h-2" />Pre-Planilla
                </span>
              )}
            </div>
          )}

          {/* Lista de agentes activos */}
          {agentesActivos.map((ag) => (
            <div key={ag.id} className="flex items-center gap-1">
              <User className="w-2.5 h-2.5 text-green-400 shrink-0" />
              <span className="text-[9px] text-green-300/80 truncate font-medium">
                {ag.nombre.split(" ").slice(0, 2).join(" ")}
              </span>
            </div>
          ))}

          {/* Sin agente */}
          {sinAgente && (
            <div>
              {tieneRechazados && (
                <p className="text-[9px] text-red-400/60">
                  {t.agentes_rechazados.map(a => a.nombre.split(" ")[0]).join(", ")} declinaron
                </p>
              )}
              {t.plan_agente_nombre ? (
                <div className="flex items-center gap-1">
                  <UserCheck className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                  <span className="text-[9px] text-indigo-300/80 font-medium truncate">
                    Plan: {t.plan_agente_nombre.split(" ").slice(0, 2).join(" ")}
                  </span>
                </div>
              ) : (
                <p className="text-[9px] text-amber-400/70 font-medium">Toca para asignar →</p>
              )}
            </div>
          )}

          {/* Cobertura parcial — mostrar cuántos faltan */}
          {parcial && (
            <p className="text-[9px] text-amber-400/60">
              Faltan {cantidadRequerida - agentesActivos.length} guardia{cantidadRequerida - agentesActivos.length !== 1 ? "s" : ""}
            </p>
          )}

          {/* Pendiente facturación (si hay agentes) */}
          {!sinAgente && (
            <div className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5 text-orange-400/60 shrink-0" />
              <span className="text-[9px] text-orange-300/50">Pend. facturación</span>
            </div>
          )}
        </div>
      </button>
    </div>
  );
}

