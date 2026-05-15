import { useState } from "react";
import { CheckCircle2, Shield, ShieldCheck, Zap, ChevronRight, Building2, UserCheck, CalendarDays, AlertCircle, Layers } from "lucide-react";
import { iniciales, avatarColor } from "../utils";
import { Puesto, Agente, Pool, AgentePoolFuturo, InicioProyecto, PoolFuturoData, poolFuturoToAgente, LABELS_AUSENCIA_FUTURO, LABELS_AUSENCIA_RRHH, TIPO_SSA_LABELS } from "../types";

export function PoolFuturoPanel({
  data,
  onAbrirPlan,
  onPlanSSA,
  onSelectAgente,
  agenteSeleccionadoId,
}: {
  data: PoolFuturoData;
  onAbrirPlan?: () => void;
  onPlanSSA?: (ip: InicioProyecto) => void;
  onSelectAgente?: (agente: Agente) => void;
  agenteSeleccionadoId?: number | null;
}) {
  const [tabActivo, setTabActivo] = useState<"descansando" | "disponible" | "ausenteProgramado" | "trabajando">("descansando");
  const [colapsado, setColapsado] = useState(false);

  const tabs = [
    {
      key: "descansando" as const,
      label: "De descanso",
      count: data.totales.descansando,
      color: "text-blue-400",
      activeBg: "border-blue-400 text-blue-300 bg-blue-500/5",
      desc: "Trabajarán otro día según su turno",
    },
    {
      key: "disponible" as const,
      label: "Disponibles",
      count: data.totales.disponible,
      color: "text-green-400",
      activeBg: "border-green-400 text-green-300 bg-green-500/5",
      desc: "Sin puesto asignado, elegibles para cobertura",
    },
    {
      key: "ausenteProgramado" as const,
      label: "Ausentes",
      count: data.totales.ausenteProgramado,
      color: "text-red-400",
      activeBg: "border-red-400 text-red-300 bg-red-500/5",
      desc: "Ausencias aprobadas o planificadas",
    },
    {
      key: "trabajando" as const,
      label: "En turno",
      count: data.totales.trabajando,
      color: "text-teal-400",
      activeBg: "border-teal-400 text-teal-300 bg-teal-500/5",
      desc: "Estarán cubriendo sus puestos ese día",
    },
  ];

  const agentesActivos = data[tabActivo] ?? [];

  return (
    <div className="shrink-0 bg-[#060f1a] border border-indigo-500/15 rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setColapsado(prev => !prev)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-white/8 text-left group hover:bg-indigo-500/4 transition-colors"
      >
        <CalendarDays className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <span className="text-xs font-bold text-indigo-300/80 uppercase tracking-widest group-hover:text-indigo-300 transition-colors">Pool de agentes</span>
        <span className="text-[10px] text-white/25 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full ml-1">
          {data.totales.descansando + data.totales.disponible} disponibles
        </span>
        {colapsado && (
          <div className="flex items-center gap-2 ml-1 text-[10px]">
            <span className="text-blue-400 font-bold">{data.totales.descansando} descanso</span>
            <span className="text-white/15">·</span>
            <span className="text-green-400 font-bold">{data.totales.disponible} libres</span>
            <span className="text-white/15">·</span>
            <span className="text-teal-400 font-bold">{data.totales.trabajando} en turno</span>
          </div>
        )}
        <div className="flex-1" />
        {data.totales.relevoProgramado > 0 && !colapsado && (
          <div className="flex items-center gap-1 text-[10px] text-indigo-300/60">
            <CheckCircle2 className="w-3 h-3 text-indigo-400" />
            {data.totales.relevoProgramado} relevos ya asignados
          </div>
        )}
        <ChevronRight className={`w-3.5 h-3.5 text-indigo-400/30 group-hover:text-indigo-400/60 ml-2 shrink-0 transition-transform ${colapsado ? "" : "rotate-90"}`} />
      </button>

      {!colapsado && (<>

      {/* ── Supervisores y Jefes de Servicio en esta fecha ────────────── */}
      {(() => {
        const svJfTrab = data.trabajando.filter(a => a.tipo_personal === "supervisor" || a.tipo_personal === "jefe_servicio");
        const svJfDesc = data.descansando.filter(a => a.tipo_personal === "supervisor" || a.tipo_personal === "jefe_servicio");
        if (svJfTrab.length + svJfDesc.length === 0) return null;
        return (
          <div className="border-b border-orange-500/15 bg-orange-500/3 px-3 py-2">
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck className="w-3 h-3 text-orange-400/70" />
              <span className="text-[10px] font-bold text-orange-300/70 uppercase tracking-widest">Supervisores / Jefes de Servicio</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {svJfTrab.map(ag => (
                <div key={ag.id} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium bg-orange-500/10 border border-orange-500/20 text-orange-200/80" title={`En turno · ${ag.turno_nombre ?? ""}`}>
                  <div className={`w-4 h-4 rounded text-[8px] font-bold flex items-center justify-center shrink-0 ${avatarColor(ag.nombre_completo)}`}>
                    {iniciales(ag.nombre_completo)}
                  </div>
                  <span className="truncate max-w-[80px]">{ag.nombre_completo.split(" ").slice(0, 2).join(" ")}</span>
                  <span className="text-[8px] px-1 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold shrink-0">TURNO</span>
                </div>
              ))}
              {svJfDesc.map(ag => (
                <div key={ag.id} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium bg-orange-500/5 border border-orange-500/10 text-orange-300/50" title={`Descanso · ${ag.turno_nombre ?? ""}`}>
                  <div className={`w-4 h-4 rounded text-[8px] font-bold flex items-center justify-center shrink-0 opacity-60 ${avatarColor(ag.nombre_completo)}`}>
                    {iniciales(ag.nombre_completo)}
                  </div>
                  <span className="truncate max-w-[80px]">{ag.nombre_completo.split(" ").slice(0, 2).join(" ")}</span>
                  <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-300/70 font-bold shrink-0">DESC</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Tabs */}
      <div className="flex border-b border-white/6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTabActivo(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold transition-colors border-b-2 whitespace-nowrap ${
              tabActivo === t.key
                ? t.activeBg
                : "border-transparent text-white/30 hover:text-white/60"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                tabActivo === t.key ? "bg-white/10" : "bg-white/6 text-white/30"
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Descripción del tab */}
      <div className="px-4 py-1.5 bg-white/2 border-b border-white/4">
        <p className="text-[10px] text-white/25 italic">
          {tabs.find(t => t.key === tabActivo)?.desc}
        </p>
      </div>

      {/* Lista de agentes */}
      <div className="flex gap-2 flex-wrap p-3 max-h-40 overflow-y-auto">
        {agentesActivos.length === 0 ? (
          <p className="text-[11px] text-white/20 py-2 px-2">Sin agentes en esta categoría</p>
        ) : agentesActivos.map((ag) => {
          const canDrag = (tabActivo === "disponible" || tabActivo === "descansando") && !!onSelectAgente;
          if (canDrag) {
            const agenteObj = poolFuturoToAgente(ag as AgentePoolFuturo);
            const isSelected = agenteSeleccionadoId === ag.id;
            return (
              <div
                key={ag.id}
                onClick={() => onSelectAgente!(agenteObj)}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium border transition-all cursor-pointer select-none ${
                  isSelected
                    ? "ring-2 ring-primary bg-primary/15 border-primary/40 text-white scale-105"
                    : tabActivo === "descansando"
                    ? "bg-blue-500/8 border-blue-500/20 text-blue-300/80 hover:bg-blue-500/15 hover:border-blue-400/40"
                    : "bg-green-500/8 border-green-500/20 text-green-300/80 hover:bg-green-500/15 hover:border-green-400/40"
                }`}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${avatarColor(ag.nombre_completo)}`}>
                  {iniciales(ag.nombre_completo)}
                </div>
                <span className="truncate max-w-[100px]">{ag.nombre_completo.split(" ").slice(0, 2).join(" ")}</span>
                {(ag.tipo_personal === "supervisor" || ag.tipo_personal === "jefe_servicio") && (
                  <span className="text-[8px] px-1 py-0.5 rounded font-bold bg-orange-500/20 text-orange-300 shrink-0">
                    {ag.tipo_personal === "supervisor" ? "Sup." : "Jefe"}
                  </span>
                )}
              </div>
            );
          }
          return (
            <div
              key={ag.id}
              title={
                tabActivo === "ausenteProgramado"
                  ? `${ag.fuente_ausencia === "rrhh" ? LABELS_AUSENCIA_RRHH[ag.tipo_ausencia_rrhh ?? ""] ?? ag.tipo_ausencia_rrhh : LABELS_AUSENCIA_FUTURO[ag.plan_tipo_ausencia ?? ""] ?? ag.plan_tipo_ausencia ?? "Ausencia"} · ${ag.fuente_ausencia === "rrhh" ? "Aprobado por RRHH" : "Planificado en Operaciones"}`
                  : tabActivo === "trabajando"
                  ? `Puesto: ${ag.puesto_nombre ?? "—"} · ${ag.cliente_nombre ?? ""}`
                  : ""
              }
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium border transition-all cursor-default ${
                tabActivo === "ausenteProgramado"
                  ? "bg-red-500/8 border-red-500/20 text-red-300/80"
                  : "bg-teal-500/8 border-teal-500/20 text-teal-300/80"
              }`}
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${avatarColor(ag.nombre_completo)}`}>
                {iniciales(ag.nombre_completo)}
              </div>
              <span className="truncate max-w-[100px]">{ag.nombre_completo.split(" ").slice(0, 2).join(" ")}</span>
              {(ag.tipo_personal === "supervisor" || ag.tipo_personal === "jefe_servicio") && (
                <span className="text-[8px] px-1 py-0.5 rounded font-bold bg-orange-500/20 text-orange-300 shrink-0">
                  {ag.tipo_personal === "supervisor" ? "Sup." : "Jefe"}
                </span>
              )}
              {tabActivo === "ausenteProgramado" && (
                <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${ag.fuente_ausencia === "rrhh" ? "bg-orange-500/20 text-orange-300" : "bg-indigo-500/20 text-indigo-300"}`}>
                  {ag.fuente_ausencia === "rrhh" ? "RRHH" : "OP"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Servicios Programados (inicios de proyecto + SSA) ── */}
      {(data.iniciosProyecto ?? []).length > 0 && (
        <div className="border-t border-amber-500/20 bg-amber-500/3">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-amber-500/15">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-amber-300/80 uppercase tracking-widest">Servicios programados</span>
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 border border-amber-500/25 text-amber-300">
              {data.iniciosProyecto.length} {data.iniciosProyecto.length === 1 ? "servicio" : "servicios"}
            </span>
          </div>
          <div className="p-3 flex flex-col gap-2">
            {data.iniciosProyecto.map((ip) => {
              const esSSA    = ip.tipo === "ssa";
              const itemKey  = esSSA ? `ssa_${ip.ssa_id}` : `cli_${ip.cliente_id}`;
              const cardBg   = esSSA
                ? "bg-blue-500/5 border-blue-500/20"
                : "bg-amber-500/5 border-amber-500/20";
              const iconBg   = esSSA
                ? "bg-blue-500/15 border-blue-500/25"
                : "bg-amber-500/15 border-amber-500/25";
              const nameCl   = esSSA ? "text-blue-200" : "text-amber-200";
              const sectorCl = esSSA ? "text-blue-300/50" : "text-amber-300/50";
              const badgeCl  = esSSA
                ? "bg-blue-400/15 border-blue-400/30 text-blue-300"
                : "bg-amber-400/15 border-amber-400/30 text-amber-300";
              const badgeLabel = esSSA
                ? (TIPO_SSA_LABELS[ip.tipo_solicitud ?? ""] ?? "SSA")
                : "Inicio";
              const planAgentes = ip.plan_agentes ?? [];
              const planYaAsignado = esSSA && planAgentes.length > 0;
              const totalGuardias = ip.total_puestos ?? 1;
              const planCompleto = planAgentes.length >= totalGuardias;
              return (
              <div
                key={itemKey}
                className={`border rounded-xl p-3 flex flex-col gap-2 ${cardBg}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${iconBg}`}>
                      {esSSA
                        ? <Shield className="w-3.5 h-3.5 text-blue-400" />
                        : <Building2 className="w-3.5 h-3.5 text-amber-400" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${nameCl}`}>
                        {ip.cliente_nombre_comercial || ip.cliente_nombre}
                      </p>
                      {esSSA && ip.hora_inicio ? (
                        <p className={`text-[10px] capitalize ${sectorCl}`}>{ip.hora_inicio}–{ip.hora_fin ?? ""}</p>
                      ) : ip.sector ? (
                        <p className={`text-[10px] capitalize ${sectorCl}`}>{ip.sector}</p>
                      ) : null}
                    </div>
                  </div>
                  <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wider ${badgeCl}`}>
                    {badgeLabel}
                  </span>
                </div>

                {/* Puestos (solo para inicio_cliente) */}
                {!esSSA && (
                  <div className="flex items-center gap-3 text-[10px]">
                    <div className="flex items-center gap-1 text-white/50">
                      <Layers className="w-3 h-3" />
                      <span>{ip.total_puestos} {ip.total_puestos === 1 ? "puesto" : "puestos"}</span>
                    </div>
                    {ip.puestos_con_titular > 0 && (
                      <div className="flex items-center gap-1 text-green-400/70">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{ip.puestos_con_titular} con titular</span>
                      </div>
                    )}
                    {ip.puestos_sin_titular > 0 && (
                      <div className="flex items-center gap-1 text-amber-400/70">
                        <AlertCircle className="w-3 h-3" />
                        <span>{ip.puestos_sin_titular} sin asignar</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Estado del plan SSA — multi-agente */}
                {esSSA && (
                  <div className="flex flex-col gap-1.5">
                    {/* Progreso / badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {planCompleto ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 border border-green-500/25 text-green-400 font-bold uppercase">
                            {planAgentes.length}/{totalGuardias} Planificado{planAgentes.length !== 1 ? "s" : ""}
                          </span>
                        ) : planYaAsignado ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/12 border border-amber-500/25 text-amber-400 font-bold uppercase">
                            {planAgentes.length}/{totalGuardias} Parcial
                          </span>
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] text-orange-300/60">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>Sin agentes planificados</span>
                          </div>
                        )}
                      </div>
                      {onPlanSSA && (
                        <button
                          onClick={() => onPlanSSA(ip)}
                          className={`shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border transition-all ${
                            planYaAsignado
                              ? "bg-blue-500/10 border-blue-500/25 text-blue-300 hover:bg-blue-500/20"
                              : "bg-amber-500/10 border-amber-500/25 text-amber-300 hover:bg-amber-500/20"
                          }`}
                        >
                          <UserCheck className="w-3 h-3" />
                          {planYaAsignado ? "Editar" : "Planificar"}
                        </button>
                      )}
                    </div>
                    {/* Lista de agentes planificados */}
                    {planAgentes.length > 0 && (
                      <div className="flex flex-col gap-0.5">
                        {planAgentes.map((pa) => (
                          <div key={pa.plan_id} className="flex items-center gap-1 text-[10px]">
                            <CheckCircle2 className="w-2.5 h-2.5 text-green-400 shrink-0" />
                            <span className="text-green-300/80 font-medium truncate">
                              {pa.relevo_nombre?.split(" ").slice(0, 2).join(" ") ?? "Agente planificado"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Lista de puestos si hay pocos (inicio_cliente) */}
                {!esSSA && ip.puestos && ip.puestos.length > 0 && ip.puestos.length <= 4 && (
                  <div className="flex flex-col gap-1">
                    {ip.puestos.map((p) => (
                      <div key={p.id} className="flex items-center gap-1.5 text-[10px] text-white/40">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.titular_nombre ? "bg-green-400/60" : "bg-amber-400/50"}`} />
                        <span className="truncate">{p.nombre}</span>
                        {p.turno_nombre && <span className="text-white/25 shrink-0">· {p.turno_nombre}</span>}
                        {!p.titular_nombre && <span className="text-amber-400/50 shrink-0">sin titular</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </div>
      )}

      </>)}
    </div>
  );
}

// ─── Columna de Cliente — Vista Futura ────────────────────────────────────────

