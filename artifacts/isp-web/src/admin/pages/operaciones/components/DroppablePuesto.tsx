import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { AlertTriangle, CheckCircle2, User, UserPlus, Shield, Circle, UserMinus, XCircle, Calendar, AlertCircle, Layers, Moon, Settings2, Repeat, Undo2 } from "lucide-react";
import { ModalFichaArma } from "@/admin/components/ModalFichaArma";
import { iniciales, avatarColor, tooltipPersona } from "../utils";
import { Puesto, PlanFuturo, LABELS_AUSENCIA_FUTURO } from "../types";

export function DroppablePuesto({
  puesto,
  isAgenteSeleccionado,
  onClick,
  onLiberar,
  onRegistrarFalta,
  onAnularFalta,
  onReactivarFalta,
  onAbrirSegmentos,
  onConfigTurno,
  onQuitarTitular,
  onAgenteExterno,
  cambiosProximos,
  puestoContextoId,
  planFuturo,
}: {
  puesto: Puesto;
  isAgenteSeleccionado: boolean;
  onClick: () => void;
  onLiberar: () => void;
  onRegistrarFalta?: (puesto: Puesto, titularId: number, titularNombre: string) => void;
  onAnularFalta?: (puesto: Puesto, titularNombre: string) => void;
  onReactivarFalta?: (puesto: Puesto, titularNombre: string) => void;
  onAbrirSegmentos: () => void;
  onConfigTurno?: () => void;
  onQuitarTitular?: (puesto: Puesto, employeeId: number, employeeNombre: string) => void;
  onAgenteExterno?: (puesto: Puesto) => void;
  cambiosProximos?: PlanFuturo[];
  puestoContextoId?: number | null;
  planFuturo?: PlanFuturo | null;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `puesto-${puesto.id}` });
  const [fichaArmaId, setFichaArmaId] = useState<number | null>(null);
  const esExterno      = (puesto as any).es_externo === true;
  const cubierto       = puesto.estado === "cubierto" && (puesto.agente_id || esExterno);
  const esRelevo       = cubierto && puesto.titular_employee_id && puesto.agente_id !== puesto.titular_employee_id;
  const titularAusente = !puesto.agente_id && !!puesto.titular_employee_id;
  const descansoCiclo  = !cubierto && (puesto.descanso_por_ciclo === true);
  const vacacionesTitular = !cubierto && puesto.titular_vac_tipo === "vacaciones";
  const vacacionesTrabajadas = puesto.titular_vac_tipo === "vacaciones_trabajadas";
  const expanded = puestoContextoId === puesto.id;
  const dimmed   = puestoContextoId !== null && puestoContextoId !== undefined && !expanded;

  // ─── Renderizado especial para puestos con múltiples titulares (24x24) ───
  if (puesto.es_par_24x24 && puesto.par_trabajando && puesto.par_descansando) {
    const activo      = puesto.par_trabajando;   // TitularCiclo — trabaja hoy
    const descansando = puesto.par_descansando;  // TitularCiclo — descansa hoy

    // Si agente_id es uno de los dos titulares del ciclo (T1 o T2) → rotación normal, NO relevo externo.
    // Solo es relevo real cuando hay alguien del pool cubriendo (ajeno al par de titulares).
    const esTitularCiclo = !!puesto.agente_id &&
      (puesto.agente_id === activo.employee_id || puesto.agente_id === descansando.employee_id);

    // cubiertoManual  = alguien EXTERNO al ciclo fue asignado vía agente_id (relevo/pool)
    // cubiertoTitular = el titular configurado para hoy cubre el puesto según el ciclo
    // Excluye titular_en_vacaciones (PIZ-VAC-01) y titular_dado_de_baja (PIZ-BAJA-01):
    // si el titular que toca trabajar hoy está de vacaciones o fue dado de baja, el slot
    // queda DESCUBIERTO aunque el ciclo diga "trabaja_hoy". El backend ya marca
    // estado='descubierto' y nullea agente_id; aquí lo respetamos en la UI.
    const cubiertoManual  = puesto.estado === "cubierto" && (!!puesto.agente_id || esExterno) && !esTitularCiclo;
    const cubiertoTitular = !cubiertoManual
      && activo.trabaja_hoy
      && !!activo.employee_id
      && !puesto.titular_faltando
      && !puesto.titular_en_vacaciones
      && !puesto.titular_dado_de_baja;
    const activoCubierto  = cubiertoManual || cubiertoTitular;
    const activoRelevo    = cubiertoManual && !!activo.employee_id &&
                            puesto.agente_id !== activo.employee_id;
    const activoSinCob    = !activoCubierto;
    const arma     = puesto.arma_codigo;
    const armaId   = puesto.arma_id;
    const armaTipo = puesto.arma_tipo;

    const statusStrip = activoCubierto
      ? (activoRelevo ? "bg-amber-400" : "bg-violet-400")
      : "bg-red-500 animate-pulse";

    const borde24 = isOver
      ? "border-primary bg-primary/10 shadow-lg shadow-primary/20 scale-[1.02]"
      : activoRelevo
        ? "bg-[#0f1208] border-amber-500/30 hover:border-amber-400/40"
        : activoCubierto
          ? "bg-[#071520] border-violet-500/25 hover:border-violet-400/35"
          : "bg-[#0c0a16] border-red-500/25 hover:border-red-400/35";

    return (
      <div
        ref={setNodeRef}
        onClick={onClick}
        className={`relative rounded-xl border p-3 transition-all cursor-pointer group ${borde24} ${isAgenteSeleccionado && !activoCubierto ? "ring-1 ring-primary/50 border-primary/30" : ""} ${dimmed ? "opacity-25 hover:opacity-70" : ""}`}
      >
        {/* Badge cambios futuros */}
        {cambiosProximos && cambiosProximos.length > 0 && (
          <div className="absolute -top-1.5 -right-1.5 z-10 flex items-center gap-0.5 bg-indigo-700/90 border border-indigo-400/40 rounded-full px-1.5 py-0.5" title={`${cambiosProximos.length} cambio(s) futuro(s)`}>
            <Calendar className="w-2.5 h-2.5 text-indigo-200" />
            <span className="text-[8px] text-indigo-100 font-bold leading-none">{cambiosProximos.length}</span>
          </div>
        )}
        {/* Badge titular en vacaciones (24x24): muestra cuenta regresiva los últimos 5 días */}
        {puesto.titular_en_vacaciones && (() => {
          const dr = puesto.titular_vac_dias_regreso;
          const cuentaRegresiva = typeof dr === "number" && dr >= 1 && dr <= 5;
          const tooltip = `Titular en vacaciones${puesto.titular_vac_inicio ? ` desde ${puesto.titular_vac_inicio}` : ""}${puesto.titular_vac_fin ? ` hasta ${puesto.titular_vac_fin}` : ""}${cuentaRegresiva ? ` — vuelve ${dr === 1 ? "mañana" : `en ${dr} días`}` : ""}`;
          const claseBadge = cuentaRegresiva
            ? "bg-amber-900/95 border-amber-400/60 animate-pulse"
            : "bg-emerald-900/90 border-emerald-500/40";
          const claseTexto = cuentaRegresiva ? "text-amber-200" : "text-emerald-300";
          return (
            <div className={`absolute -top-1.5 -left-1.5 z-10 flex items-center gap-0.5 border rounded-full px-1.5 py-0.5 ${claseBadge}`} title={tooltip}>
              <span className={`text-[8px] font-bold leading-none ${claseTexto}`}>
                {cuentaRegresiva ? `VAC ${dr}d` : "VAC"}
              </span>
            </div>
          );
        })()}
        {/* Badge titular trabajando vacaciones (24x24): para consistencia con card no-24x24 */}
        {puesto.titular_vac_tipo === "vacaciones_trabajadas" && (
          <div className="absolute -top-1.5 -left-1.5 z-10 flex items-center gap-0.5 bg-orange-900/90 border border-orange-500/40 rounded-full px-1.5 py-0.5" title="Titular trabajando días de vacaciones">
            <span className="text-[8px] text-orange-300 font-bold leading-none">VAC✓</span>
          </div>
        )}

        {/* ── COMPACT: siempre visible ── */}
        <div className="flex gap-2">
          <div className={`w-1 self-stretch rounded-full shrink-0 ${statusStrip}`} />
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-white/80 truncate leading-tight">{puesto.nombre}</p>
                  {puesto.tipo_puesto === "custodia" && (
                    <span className="text-[8px] px-1 py-0.5 rounded border font-bold text-amber-300/90 bg-amber-500/10 border-amber-500/30 shrink-0">CUSTODIA</span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[9px] text-violet-300/50 flex items-center gap-0.5">
                    <Repeat className="w-2 h-2 opacity-50" />{puesto.turno_nombre ?? "24x24"}
                  </span>
                  {activoRelevo && <span className="text-[8px] px-1 py-0.5 bg-amber-500/15 border border-amber-500/20 rounded text-amber-300/70 font-bold">REL</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                {onConfigTurno && (
                  <button onClick={e => { e.stopPropagation(); onConfigTurno(); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10" title="Configurar turno">
                    <Settings2 className="w-2.5 h-2.5 text-white/30 hover:text-indigo-400" />
                  </button>
                )}
                {activoCubierto
                  ? <CheckCircle2 className={`w-3.5 h-3.5 ${activoRelevo ? "text-amber-400" : "text-violet-400"}`} />
                  : <Circle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                }
              </div>
            </div>

            {/* Agente activo — PROMINENTE */}
            <div className="mt-1.5">
              {cubiertoManual && puesto.agente_nombre ? (
                <div className="flex items-center gap-1.5">
                  <div className="relative shrink-0">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white ${avatarColor(puesto.agente_nombre)}`}>
                      {iniciales(puesto.agente_nombre)}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#0a1628] ${puesto.agente_en_turno ? "bg-green-400" : puesto.apto_horas_extra ? "bg-amber-400" : "bg-slate-500"}`} title={puesto.agente_en_turno ? "En turno ahora" : puesto.apto_horas_extra ? "Descansando · Apto para HE" : "Fuera de turno"} />
                  </div>
                  <p title={tooltipPersona(puesto.agente_nombre, puesto.agente_fecha_ingreso, puesto.agente_telefono)} className="text-[13px] font-semibold text-white/90 truncate">{puesto.agente_nombre}</p>
                </div>
              ) : cubiertoTitular && activo.nombre ? (
                <div className="flex items-center gap-1.5">
                  <div className="relative shrink-0">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white ${avatarColor(activo.nombre)}`}>
                      {iniciales(activo.nombre)}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#0a1628] ${puesto.agente_en_turno ? "bg-green-400" : puesto.apto_horas_extra ? "bg-amber-400" : "bg-slate-500"}`} title={puesto.agente_en_turno ? "En turno ahora" : puesto.apto_horas_extra ? "Descansando · Apto para HE" : "Fuera de turno"} />
                  </div>
                  <p title={tooltipPersona(activo.nombre, puesto.agente_fecha_ingreso, puesto.agente_telefono)} className="text-[13px] font-semibold text-white/90 truncate">{activo.nombre}</p>
                </div>
              ) : activoSinCob ? (
                <div className={`flex items-center gap-2 ${isOver || isAgenteSeleccionado ? "text-primary" : "text-white/20"}`}>
                  <User className="w-4 h-4 shrink-0" />
                  <p className="text-sm">{isOver ? "Soltar aquí" : isAgenteSeleccionado ? "Toca para asignar" : "Sin cobertura"}</p>
                </div>
              ) : null}
              {onAgenteExterno && activoSinCob && (
                <button
                  onClick={e => { e.stopPropagation(); onAgenteExterno(puesto); }}
                  className="mt-1.5 flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold text-teal-300/80 bg-teal-500/10 border border-teal-500/25 hover:bg-teal-500/20 hover:text-teal-300 rounded-md transition-colors"
                  title="Cubrir con agente externo — HE pagada en efectivo, fuera de planilla"
                >
                  <UserPlus className="w-3 h-3" /><span>Agente externo</span>
                </button>
              )}
            </div>

            {/* ── SIEMPRE VISIBLE: Arma + Tramo + Faltante ── */}
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                {arma && armaId && (
                  <button onClick={e => { e.stopPropagation(); setFichaArmaId(armaId); }} title={`Ver ficha: ${arma} — ${armaTipo ?? ""}`} className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/8 border border-blue-500/15 rounded-md hover:bg-blue-500/15 hover:border-blue-500/30 transition-colors">
                    <Shield className="w-2.5 h-2.5 text-blue-400/60 shrink-0" />
                    <span className="text-[9px] font-mono font-semibold text-blue-300/70">{arma}</span>
                    {armaTipo && <span className="text-[9px] text-blue-300/40 capitalize ml-0.5">{armaTipo}</span>}
                  </button>
                )}
                <button onClick={e => { e.stopPropagation(); onAbrirSegmentos(); }} className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-300/50 bg-indigo-500/5 border border-indigo-500/15 hover:bg-indigo-500/15 hover:text-indigo-300 rounded-md transition-colors" title="Tramos de cobertura">
                  <Layers className="w-2.5 h-2.5" /><span>Tramos</span>
                </button>
                {activo.trabaja_hoy && activo.employee_id && onRegistrarFalta && !cubiertoManual && !puesto.titular_faltando && !puesto.titular_en_vacaciones && !puesto.titular_dado_de_baja && (
                  <button
                    onClick={e => { e.stopPropagation(); onRegistrarFalta(puesto, activo.employee_id, activo.nombre); }}
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold text-red-300/80 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 rounded-md transition-colors"
                    title="Marcar titular como faltante"
                  >
                    <XCircle className="w-3 h-3" /><span>Faltante</span>
                  </button>
                )}
            </div>

            {/* ── EXPANDED: detalles completos ── */}
            {expanded && (
              <div className="mt-2.5 pt-2 border-t border-white/8 space-y-2">
                {/* Descansa hoy */}
                <div className="flex items-center gap-2">
                  <div className="w-1 h-full min-h-[18px] rounded-full bg-indigo-500/20 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] text-indigo-400/40 font-semibold uppercase tracking-wider mb-0.5">Descansa hoy</p>
                    {descansando.nombre ? (
                      <div className="flex items-center gap-1.5">
                        <Moon className="w-3 h-3 text-indigo-400/30 shrink-0" />
                        <p title={tooltipPersona(descansando.nombre, descansando.fecha_ingreso, descansando.telefono)} className="text-[11px] text-white/30 truncate">{descansando.nombre}</p>
                      </div>
                    ) : <p className="text-[11px] text-white/15">Sin titular</p>}
                  </div>
                </div>

                {/* Liberar — solo si hay agente asignado manualmente desde el pool (no via relevo ciclo) */}
                {cubiertoManual && !puesto.es_relevo_dia && (
                  <button onClick={e => { e.stopPropagation(); onLiberar(); }} className="flex items-center gap-1 text-[9px] font-semibold text-red-300/80 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 rounded-md px-2 py-1 transition-colors" title="Remover del puesto">
                    <XCircle className="w-3 h-3" /><span>Remover agente</span>
                  </button>
                )}
                {/* Quitar titularidad de cualquiera de los dos titulares del par 24x24.
                    Las etiquetas T1/T2 se evitan adrede: 'activo' y 'descansando' se calculan
                    según quién trabaja vs descansa HOY (temporal), no por slot_numero
                    (posicional), por lo que mostrar T1/T2 confunde. Además, si por
                    configuración solo hay 1 titular asignado al par, ambos lados pueden
                    apuntar al mismo employee_id — en ese caso renderizamos un solo botón. */}
                {onQuitarTitular && activo.employee_id && activo.nombre && (
                  <button
                    onClick={e => { e.stopPropagation(); onQuitarTitular(puesto, activo.employee_id!, activo.nombre!); }}
                    className="flex items-center gap-1 text-[9px] font-semibold text-rose-300/80 bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500/20 hover:text-rose-300 rounded-md px-2 py-1 transition-colors"
                    title={`Quitar titularidad de ${activo.nombre}`}
                  >
                    <UserMinus className="w-3 h-3" /><span>Quitar: {activo.nombre.split(" ")[0]}</span>
                  </button>
                )}
                {onQuitarTitular
                  && descansando.employee_id
                  && descansando.nombre
                  && descansando.employee_id !== activo.employee_id && (
                  <button
                    onClick={e => { e.stopPropagation(); onQuitarTitular(puesto, descansando.employee_id!, descansando.nombre!); }}
                    className="flex items-center gap-1 text-[9px] font-semibold text-rose-300/80 bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500/20 hover:text-rose-300 rounded-md px-2 py-1 transition-colors"
                    title={`Quitar titularidad de ${descansando.nombre}`}
                  >
                    <UserMinus className="w-3 h-3" /><span>Quitar: {descansando.nombre.split(" ")[0]}</span>
                  </button>
                )}
                {/* Anular falta — restaura el puesto sin afectar nómina (requiere aprobación RRHH) */}
                {onAnularFalta && puesto.titular_faltando && !puesto.es_custodia && (
                  <button
                    onClick={e => { e.stopPropagation(); onAnularFalta(puesto, activo.nombre ?? puesto.titular_nombre ?? "—"); }}
                    className="flex items-center gap-1 text-[9px] font-semibold text-cyan-300/80 bg-cyan-500/10 border border-cyan-500/25 hover:bg-cyan-500/20 hover:text-cyan-300 rounded-md px-2 py-1 transition-colors"
                    title="Anular esta falta (pendiente de aprobación RRHH)"
                  >
                    <Undo2 className="w-3 h-3" /><span>Anular falta</span>
                  </button>
                )}
                {/* Reactivar falta — deshace una anulación hecha por error (regresa a "faltando") */}
                {onReactivarFalta && puesto.falta_anulada_reactivable && !puesto.es_custodia && (
                  <button
                    onClick={e => { e.stopPropagation(); onReactivarFalta(puesto, activo.nombre ?? puesto.titular_nombre ?? "—"); }}
                    className="flex items-center gap-1 text-[9px] font-semibold text-emerald-300/80 bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 hover:text-emerald-300 rounded-md px-2 py-1 transition-colors"
                    title="Reactivar la falta que se anuló por error"
                  >
                    <Repeat className="w-3 h-3" /><span>Reactivar</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Plan futuro (modo planificación) */}
        {planFuturo && (
          <div className={`mt-2 pt-2 border-t border-white/6 flex items-center gap-1.5 ${planFuturo.relevo_id ? "text-indigo-300/70" : "text-amber-300/70"}`}>
            {planFuturo.relevo_id ? (
              <>
                <div className={`w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center shrink-0 ${avatarColor(planFuturo.relevo_nombre ?? "")}`}>
                  {iniciales(planFuturo.relevo_nombre ?? "")}
                </div>
                <p className="text-[10px] font-medium truncate flex-1">{planFuturo.relevo_nombre}</p>
                <span className="text-[8px] shrink-0 opacity-60 font-bold">RELEVO</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 shrink-0" />
                <p className="text-[10px] truncate">{LABELS_AUSENCIA_FUTURO[planFuturo.tipo_ausencia ?? ""] ?? "Ausencia"} · sin relevo</p>
              </>
            )}
          </div>
        )}

        {isOver && <div className="absolute inset-0 rounded-xl border-2 border-primary border-dashed pointer-events-none" />}
        {fichaArmaId && <ModalFichaArma armaId={fichaArmaId} onClose={() => setFichaArmaId(null)} />}
      </div>
    );
  }
  // ─── Fin renderizado 24x24 agrupado ──────────────────────────────────────

  const borderClass = isOver
    ? "border-primary bg-primary/10 shadow-lg shadow-primary/20 scale-[1.02]"
    : esRelevo
      ? "bg-[#0f1208] border-amber-500/30 hover:border-amber-400/40"
      : cubierto
        ? "bg-[#071a0f] border-green-500/20 hover:border-green-400/30"
        : descansoCiclo
          ? "bg-[#08101a] border-indigo-500/25 hover:border-indigo-400/35"
          : "bg-[#0c0a16] border-red-500/25 hover:border-red-400/35";

  const statusStrip = cubierto
    ? (esRelevo ? "bg-amber-400" : "bg-green-400")
    : descansoCiclo
      ? "bg-indigo-400"
      : "bg-red-500 animate-pulse";

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`relative rounded-xl border p-3 transition-all cursor-pointer group ${borderClass} ${isAgenteSeleccionado && !cubierto ? "ring-1 ring-primary/50 border-primary/30" : ""} ${dimmed ? "opacity-25 hover:opacity-70" : ""}`}
    >
      {/* Badge cambios futuros */}
      {cambiosProximos && cambiosProximos.length > 0 && (
        <div className="absolute -top-1.5 -right-1.5 z-10 flex items-center gap-0.5 bg-indigo-700/90 border border-indigo-400/40 rounded-full px-1.5 py-0.5" title={`${cambiosProximos.length} cambio(s) futuro(s) programado(s)`}>
          <Calendar className="w-2.5 h-2.5 text-indigo-200" />
          <span className="text-[8px] text-indigo-100 font-bold leading-none">{cambiosProximos.length}</span>
        </div>
      )}
      {vacacionesTitular && (() => {
        const dr = puesto.titular_vac_dias_regreso;
        const cuentaRegresiva = typeof dr === "number" && dr >= 1 && dr <= 5;
        const tooltip = `Titular en vacaciones${puesto.titular_vac_inicio ? ` desde ${puesto.titular_vac_inicio}` : ""}${puesto.titular_vac_fin ? ` hasta ${puesto.titular_vac_fin}` : ""}${cuentaRegresiva ? ` — vuelve ${dr === 1 ? "mañana" : `en ${dr} días`}` : ""}`;
        const claseBadge = cuentaRegresiva
          ? "bg-amber-900/95 border-amber-400/60 animate-pulse"
          : "bg-emerald-900/90 border-emerald-500/40";
        const claseTexto = cuentaRegresiva ? "text-amber-200" : "text-emerald-300";
        return (
          <div className={`absolute -top-1.5 -left-1.5 z-10 flex items-center gap-0.5 border rounded-full px-1.5 py-0.5 ${claseBadge}`} title={tooltip}>
            <span className={`text-[8px] font-bold leading-none ${claseTexto}`}>
              {cuentaRegresiva ? `VAC ${dr}d` : "VAC"}
            </span>
          </div>
        );
      })()}
      {vacacionesTrabajadas && (
        <div className="absolute -top-1.5 -left-1.5 z-10 flex items-center gap-0.5 bg-orange-900/90 border border-orange-500/40 rounded-full px-1.5 py-0.5" title="Titular trabajando días de vacaciones">
          <span className="text-[8px] text-orange-300 font-bold leading-none">VAC✓</span>
        </div>
      )}

      {/* ── COMPACT: siempre visible ── */}
      <div className="flex gap-2">
        <div className={`w-1 self-stretch rounded-full shrink-0 ${statusStrip}`} />
        <div className="flex-1 min-w-0">
          {/* Fila superior: nombre + turno + estado */}
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-white/80 truncate leading-tight">{puesto.nombre}</p>
                {puesto.tipo_puesto === "custodia" && (
                  <span className="text-[8px] px-1 py-0.5 rounded border font-bold text-amber-300/90 bg-amber-500/10 border-amber-500/30 shrink-0">CUSTODIA</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {puesto.tipo_turno_id ? (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold cursor-pointer ${puesto.tipo_ciclo === "alternado" ? "text-indigo-300/70 bg-indigo-500/8 border-indigo-500/20" : "text-emerald-300/60 bg-emerald-500/6 border-emerald-500/15"}`} onClick={e => { e.stopPropagation(); onConfigTurno?.(); }} title="Clic para cambiar turno">
                    {puesto.tipo_ciclo === "alternado" ? <Repeat className="w-2 h-2 inline mr-0.5 opacity-70" /> : null}{puesto.turno_nombre}
                  </span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.5 rounded border font-semibold text-amber-300/60 bg-amber-500/6 border-amber-500/15 cursor-pointer" onClick={e => { e.stopPropagation(); onConfigTurno?.(); }} title="Sin turno — clic para configurar">
                    {puesto.turno ?? "Sin turno"}
                  </span>
                )}
                {esRelevo && (() => {
                  const ep = puesto.estado_operativo_puesto;
                  const estadoLabel: Record<string, { label: string; cls: string }> = {
                    relevo_completo:  { label: "RELEVO",      cls: "text-amber-300/80 bg-amber-500/10 border-amber-500/25" },
                    relevo_parcial:   { label: "REL. PARCIAL",cls: "text-orange-300/80 bg-orange-500/10 border-orange-500/25" },
                    vacaciones:       { label: "VACACIONES",  cls: "text-emerald-300/80 bg-emerald-500/10 border-emerald-500/25" },
                    incapacidad:      { label: "INCAPACIDAD", cls: "text-teal-300/80 bg-teal-500/10 border-teal-500/25" },
                    suspension:       { label: "SUSPENSIÓN",  cls: "text-red-300/80 bg-red-500/10 border-red-500/25" },
                    abandono_parcial: { label: "ABANDONO",    cls: "text-rose-300/80 bg-rose-500/10 border-rose-500/25" },
                    horas_extra:      { label: "HRS EXTRA",   cls: "text-purple-300/80 bg-purple-500/10 border-purple-500/25" },
                    servicio_especial:{ label: "SSA",         cls: "text-violet-300/80 bg-violet-500/10 border-violet-500/25" },
                  };
                  const info = ep ? estadoLabel[ep] : null;
                  return <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${info ? info.cls : "text-amber-300/80 bg-amber-500/10 border-amber-500/25"}`}>{info ? info.label : "RELEVO"}</span>;
                })()}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 mt-0.5">
              {onConfigTurno && (
                <button onClick={e => { e.stopPropagation(); onConfigTurno(); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10" title="Configurar turno">
                  <Settings2 className="w-2.5 h-2.5 text-white/30 hover:text-indigo-400" />
                </button>
              )}
              {cubierto
                ? <CheckCircle2 className={`w-3.5 h-3.5 ${esRelevo ? "text-amber-400" : "text-green-400"}`} />
                : descansoCiclo
                  ? <Moon className="w-3.5 h-3.5 text-indigo-400/70" title="Descanso de ciclo" />
                  : <Circle className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              }
            </div>
          </div>

          {/* Agente activo — PROMINENTE */}
          <div className="mt-1.5">
            {cubierto && puesto.agente_nombre ? (
              <div className="flex items-center gap-1.5">
                <div className="relative shrink-0">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white ${avatarColor(puesto.agente_nombre)}`}>
                    {iniciales(puesto.agente_nombre)}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#0a1628] ${puesto.agente_en_turno ? "bg-green-400" : puesto.apto_horas_extra ? "bg-amber-400" : "bg-slate-500"}`} title={puesto.agente_en_turno ? "En turno ahora" : puesto.apto_horas_extra ? "Descansando · Apto para HE" : "Fuera de turno"} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p title={tooltipPersona(puesto.agente_nombre, puesto.agente_fecha_ingreso, puesto.agente_telefono)} className="text-[13px] font-semibold text-white/90 truncate">{puesto.agente_nombre}</p>
                    {!esRelevo && <span className="text-[8px] text-green-400/70 font-bold shrink-0">T</span>}
                  </div>
                </div>
              </div>
            ) : descansoCiclo ? (
              <div className="flex items-center gap-2 text-indigo-300/50">
                <Moon className="w-4 h-4 shrink-0" />
                <p className="text-sm">Descanso de turno</p>
              </div>
            ) : vacacionesTitular ? (
              <div className={`flex items-center gap-2 ${isOver || isAgenteSeleccionado ? "text-primary" : "text-emerald-400/60"}`}>
                <User className="w-4 h-4 shrink-0" />
                <p className="text-sm">{isOver ? "Soltar aquí" : isAgenteSeleccionado ? "Toca para asignar" : "En vacaciones"}</p>
              </div>
            ) : titularAusente ? (
              <div className={`flex items-center gap-2 ${isOver || isAgenteSeleccionado ? "text-primary" : "text-white/25"}`}>
                <User className="w-4 h-4 shrink-0" />
                <p className="text-sm">{isOver ? "Soltar aquí" : isAgenteSeleccionado ? "Toca para asignar" : "Sin cobertura hoy"}</p>
              </div>
            ) : (
              <div className={`flex items-center gap-2 ${isOver || isAgenteSeleccionado ? "text-primary" : "text-white/20"}`}>
                <User className="w-4 h-4 shrink-0" />
                <p className="text-sm">{isOver ? "Soltar aquí" : isAgenteSeleccionado ? "Toca para asignar" : "Puesto descubierto"}</p>
              </div>
            )}
            {onAgenteExterno && !cubierto && (
              <button
                onClick={e => { e.stopPropagation(); onAgenteExterno(puesto); }}
                className="mt-1.5 flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold text-teal-300/80 bg-teal-500/10 border border-teal-500/25 hover:bg-teal-500/20 hover:text-teal-300 rounded-md transition-colors"
                title="Cubrir con agente externo — HE pagada en efectivo, fuera de planilla"
              >
                <UserPlus className="w-3 h-3" /><span>Agente externo</span>
              </button>
            )}
          </div>

          {/* ── EXPANDED: detalles completos ── */}
          {expanded && (
            <div className="mt-2.5 pt-2 border-t border-white/8 space-y-2">
              {/* Relevo: titular ausente */}
              {esRelevo && puesto.titular_nombre && (
                <div className="flex items-center gap-1.5 px-1.5 py-1 bg-white/4 rounded-lg border border-white/5">
                  <User className="w-2.5 h-2.5 text-white/25 shrink-0" />
                  <p className="text-[9px] text-white/35 truncate">Titular ausente: <span className="text-white/50">{puesto.titular_nombre}</span></p>
                </div>
              )}
              {/* Descanso ciclo: titular */}
              {descansoCiclo && puesto.titular_nombre && (
                <div className="flex items-center gap-1.5 px-1.5 py-1 bg-indigo-500/5 border border-indigo-500/15 rounded-lg">
                  <User className="w-2.5 h-2.5 text-indigo-400/40 shrink-0" />
                  <p className="text-[9px] text-indigo-300/50 truncate">Descansando: <span className="text-indigo-300/70">{puesto.titular_nombre}</span> <span className="text-indigo-400/50 font-bold">HE ✓</span></p>
                </div>
              )}
              {/* Vacaciones: titular */}
              {vacacionesTitular && puesto.titular_nombre && (
                <div className="flex items-center gap-1.5 px-1.5 py-1 bg-emerald-500/5 border border-emerald-500/15 rounded-lg">
                  <User className="w-2.5 h-2.5 text-emerald-400/40 shrink-0" />
                  <p className="text-[9px] text-emerald-300/50 truncate">Vacaciones: <span className="text-emerald-300/70">{puesto.titular_nombre}</span></p>
                </div>
              )}
              {/* Titular sin cobertura (no descanso, no vac) */}
              {titularAusente && !descansoCiclo && !vacacionesTitular && puesto.titular_nombre && (
                <div className="flex items-center gap-1.5 px-1.5 py-1 bg-red-500/5 border border-red-500/10 rounded-lg">
                  <User className="w-2.5 h-2.5 text-red-400/40 shrink-0" />
                  <p className="text-[9px] text-red-300/50 truncate">Titular: <span className="text-red-300/70">{puesto.titular_nombre}</span></p>
                </div>
              )}
              {/* Teléfono */}
              {cubierto && puesto.agente_telefono && (
                <p className="text-[9px] text-white/25 truncate">{puesto.agente_telefono}</p>
              )}
              {/* Arma */}
              {puesto.arma_codigo && puesto.arma_id && (
                <button onClick={e => { e.stopPropagation(); setFichaArmaId(puesto.arma_id!); }} title={`Ver ficha: ${puesto.arma_codigo} — ${puesto.arma_tipo ?? ""}`} className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/8 border border-blue-500/15 rounded-md w-fit hover:bg-blue-500/15 hover:border-blue-500/30 transition-colors">
                  <Shield className="w-2.5 h-2.5 text-blue-400/60 shrink-0" />
                  <span className="text-[9px] font-mono font-semibold text-blue-300/70">{puesto.arma_codigo}</span>
                  {puesto.arma_tipo && <span className="text-[9px] text-blue-300/40 capitalize ml-0.5">{puesto.arma_tipo}</span>}
                </button>
              )}
              {/* Liberar — solo si hay cobertura manual del día (no titular puro).
                  Bug PIZ-LIB-01: cuando agente_id es virtual del titular, /liberar
                  fallaría con "El puesto no tiene agente asignado". En ese caso
                  el usuario debe usar "Quitar titularidad" o "Registrar falta". */}
              {cubierto && !puesto.agente_virtual_titular && (
                <button onClick={e => { e.stopPropagation(); onLiberar(); }} className="flex items-center gap-1 text-[9px] font-semibold text-red-300/80 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 rounded-md px-2 py-1 transition-colors" title="Remover del puesto">
                  <XCircle className="w-3 h-3" /><span>Remover agente</span>
                </button>
              )}
              {/* Registrar falta — si hay titular conocido y el puesto está en estado visible */}
              {onRegistrarFalta && puesto.titular_employee_id && puesto.titular_nombre && (
                <button
                  onClick={e => { e.stopPropagation(); onRegistrarFalta(puesto, puesto.titular_employee_id!, puesto.titular_nombre!); }}
                  className="flex items-center gap-1 text-[9px] font-semibold text-amber-300/80 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:text-amber-300 rounded-md px-2 py-1 transition-colors"
                  title="Registrar inasistencia del titular"
                >
                  <AlertTriangle className="w-3 h-3" /><span>Registrar falta</span>
                </button>
              )}
              {/* Anular falta — restaura el slot sin afectar nómina (requiere aprobación RRHH) */}
              {onAnularFalta && puesto.titular_faltando && !puesto.es_custodia && (
                <button
                  onClick={e => { e.stopPropagation(); onAnularFalta(puesto, puesto.titular_nombre ?? "—"); }}
                  className="flex items-center gap-1 text-[9px] font-semibold text-cyan-300/80 bg-cyan-500/10 border border-cyan-500/25 hover:bg-cyan-500/20 hover:text-cyan-300 rounded-md px-2 py-1 transition-colors"
                  title="Anular esta falta (pendiente de aprobación RRHH)"
                >
                  <Undo2 className="w-3 h-3" /><span>Anular falta</span>
                </button>
              )}
              {/* Reactivar falta — deshace una anulación hecha por error (regresa a "faltando") */}
              {onReactivarFalta && puesto.falta_anulada_reactivable && !puesto.es_custodia && (
                <button
                  onClick={e => { e.stopPropagation(); onReactivarFalta(puesto, puesto.titular_nombre ?? "—"); }}
                  className="flex items-center gap-1 text-[9px] font-semibold text-emerald-300/80 bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 hover:text-emerald-300 rounded-md px-2 py-1 transition-colors"
                  title="Reactivar la falta que se anuló por error"
                >
                  <Repeat className="w-3 h-3" /><span>Reactivar</span>
                </button>
              )}
              {/* Quitar titularidad — solo rol Operaciones/Admin */}
              {onQuitarTitular && puesto.titular_employee_id && puesto.titular_nombre && (
                <button
                  onClick={e => { e.stopPropagation(); onQuitarTitular(puesto, puesto.titular_employee_id!, puesto.titular_nombre!); }}
                  className="flex items-center gap-1 text-[9px] font-semibold text-rose-300/80 bg-rose-500/10 border border-rose-500/25 hover:bg-rose-500/20 hover:text-rose-300 rounded-md px-2 py-1 transition-colors"
                  title="Quitar titularidad — el colaborador vuelve a Disponibles"
                >
                  <UserMinus className="w-3 h-3" /><span>Quitar titularidad</span>
                </button>
              )}
              {/* Tramos */}
              <button onClick={e => { e.stopPropagation(); onAbrirSegmentos(); }} className="flex items-center gap-1 text-[9px] font-semibold text-indigo-300/70 bg-indigo-500/8 border border-indigo-500/20 hover:bg-indigo-500/15 hover:text-indigo-300 rounded-md px-2 py-1 transition-colors" title="Tramos de cobertura">
                <Layers className="w-3 h-3" /><span>Tramos</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Plan futuro (modo planificación) */}
      {planFuturo && (
        <div className={`mt-2 pt-2 border-t border-white/6 flex items-center gap-1.5 ${planFuturo.relevo_id ? "text-indigo-300/70" : "text-amber-300/70"}`}>
          {planFuturo.relevo_id ? (
            <>
              <div className={`w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center shrink-0 ${avatarColor(planFuturo.relevo_nombre ?? "")}`}>
                {iniciales(planFuturo.relevo_nombre ?? "")}
              </div>
              <p className="text-[10px] font-medium truncate flex-1">{planFuturo.relevo_nombre}</p>
              <span className="text-[8px] shrink-0 opacity-60 font-bold">RELEVO</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3 h-3 shrink-0" />
              <p className="text-[10px] truncate">{LABELS_AUSENCIA_FUTURO[planFuturo.tipo_ausencia ?? ""] ?? "Ausencia"} · sin relevo</p>
            </>
          )}
        </div>
      )}

      {isOver && <div className="absolute inset-0 rounded-xl border-2 border-primary border-dashed pointer-events-none" />}
      {fichaArmaId && <ModalFichaArma armaId={fichaArmaId} onClose={() => setFichaArmaId(null)} />}
    </div>
  );
}

// ─── Columna de Cliente ───────────────────────────────────────────────────────

