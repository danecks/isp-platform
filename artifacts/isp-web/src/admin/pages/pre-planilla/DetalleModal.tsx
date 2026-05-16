import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Loader2, Check, AlertTriangle, Building2, MapPin,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, fmtFecha, fmtQ, calcularTotalEstimado, REVISION_CFG } from "./helpers";
import type { ColaboradorPre, DetalleNovedad, DetalleAnticipo, DetalleIncentivo } from "./types";

export function DetalleModal({
  col, desde, hasta, onClose, onRevisionChange,
}: {
  col: ColaboradorPre;
  desde: string;
  hasta: string;
  onClose: () => void;
  onRevisionChange: (id: number, estado: string, obs: string) => void;
}) {
  const { toast } = useToast();
  const [data, setData] = useState<{
    novedades: DetalleNovedad[];
    anticipos: DetalleAnticipo[];
    incentivos: DetalleIncentivo[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [revEstado, setRevEstado] = useState(col.revision_estado);
  const [revObs, setRevObs] = useState(col.revision_observaciones ?? "");
  const [savingRev, setSavingRev] = useState(false);
  const [activeInner, setActiveInner] = useState<"resumen" | "detalle" | "historial">("resumen");

  const periodoTotalDias = desde && hasta
    ? Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 86400000) + 1
    : null;

  const est = calcularTotalEstimado(col, periodoTotalDias);

  React.useEffect(() => {
    setLoading(true);
    apiRequest<{ novedades: DetalleNovedad[]; anticipos: DetalleAnticipo[]; incentivos: DetalleIncentivo[] }>(
      `/api/nomina/pre-planilla/detalle/${col.employee_id}?desde=${desde}&hasta=${hasta}`,
    )
      .then((d) => setData(d))
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [col.employee_id, desde, hasta]);

  async function guardarRevision() {
    setSavingRev(true);
    try {
      await apiRequest(`/api/nomina/pre-planilla/revision/${col.employee_id}`, {
        method: "PATCH",
        json: { desde, hasta, estado: revEstado, observaciones: revObs },
      });
      onRevisionChange(col.employee_id, revEstado, revObs);
      toast({ title: "Revisión guardada" });
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSavingRev(false);
    }
  }

  const htNum = parseFloat(col.horas_trabajadas || "0");
  const heNum = parseFloat(col.horas_extra || "0");
  const tieneAlertas = Number(col.faltas) > 0 || Number(col.suspensiones) > 0 || Number(col.dias_sin_horas) > 0;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-end bg-black/70 backdrop-blur-sm">
      <div className="h-full w-full max-w-2xl bg-[#07111f] border-l border-white/10 flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-[#060e1c] shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {tieneAlertas && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
              <h3 className="text-sm font-bold text-white truncate">{col.nombre_completo}</h3>
            </div>
            <p className="text-[11px] text-white/40 mt-0.5">
              EMP-{String(col.employee_id).padStart(4, "0")} · {col.puesto_empleado ?? "—"} · {col.sede ?? "—"}
            </p>
            <p className="text-[10px] text-white/25 mt-0.5">{fmtFecha(desde)} – {fmtFecha(hasta)}</p>
          </div>
          <button onClick={onClose} className="ml-3 text-white/30 hover:text-white transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inner tabs */}
        <div className="flex border-b border-white/6 bg-[#060e1c] shrink-0">
          {([
            ["resumen", "Resumen"],
            ["detalle", "Día a día"],
            ["historial", "Historial"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setActiveInner(k)}
              className={`px-4 py-2.5 text-[11px] font-semibold transition-colors border-b-2 ${
                activeInner === k
                  ? "border-primary text-primary"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Tab: Resumen ──────────────────────────────────────────── */}
          {activeInner === "resumen" && (
            <div className="p-5 space-y-4">

              {/* Total estimado destacado */}
              {est ? (
                <div className="space-y-3">
                  {/* Total Real (días cerrados) */}
                  <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/30 rounded-xl p-4">
                    <p className="text-[10px] text-white/40 uppercase tracking-widest mb-3">Total Real — {est.diasCerrados} días cerrados</p>
                    <div className="space-y-1.5 mb-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/50">Sueldo proporcional ({est.diasCerrados}d cerrados)</span>
                        <span className="text-white font-medium">{fmtQ(est.sueldoReal)}</span>
                      </div>
                      {est.bonIncentivoReal > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-emerald-300/70">+ Bonif. incentivo ({est.diasTrabReal}d trab.)</span>
                          <span className="text-emerald-300">+{fmtQ(est.bonIncentivoReal)}</span>
                        </div>
                      )}
                      {est.bon1Real > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-emerald-300/70">+ Bonificación 1 ({est.diasTrabReal}d trab.)</span>
                          <span className="text-emerald-300">+{fmtQ(est.bon1Real)}</span>
                        </div>
                      )}
                      {est.bon2Real > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-emerald-300/70">+ Bonificación 2 ({est.diasTrabReal}d trab.)</span>
                          <span className="text-emerald-300">+{fmtQ(est.bon2Real)}</span>
                        </div>
                      )}
                      {est.bon3Real > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-emerald-300/70">+ Bonificación 3 ({est.diasTrabReal}d trab.)</span>
                          <span className="text-emerald-300">+{fmtQ(est.bon3Real)}</span>
                        </div>
                      )}
                      {est.descFaltas > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-red-400/70">— Desc. faltas / susp. ({est.diasDesc}d descuento)</span>
                          <span className="text-red-400">–{fmtQ(est.descFaltas)}</span>
                        </div>
                      )}
                      {est.valorHE > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-orange-400/70">+ H. Extra ({heNum.toFixed(1)} h × 1.5x)</span>
                          <span className="text-orange-400">+{fmtQ(est.valorHE)}</span>
                        </div>
                      )}
                      {est.anticipo > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-amber-400/70">— Anticipo del período</span>
                          <span className="text-amber-400">–{fmtQ(est.anticipo)}</span>
                        </div>
                      )}
                      {est.cuotaUniforme > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-orange-300/70">— Cuota uniforme/botas</span>
                          <span className="text-orange-300">–{fmtQ(est.cuotaUniforme)}</span>
                        </div>
                      )}
                      {est.barracaMonto > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-violet-300/70">— Barraca{col.barraca_nombre ? ` (${col.barraca_nombre})` : ""}</span>
                          <span className="text-violet-300">–{fmtQ(est.barracaMonto)}</span>
                        </div>
                      )}
                      {est.seguroMonto > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-pink-300/70">— Seguro de vida</span>
                          <span className="text-pink-300">–{fmtQ(est.seguroMonto)}</span>
                        </div>
                      )}
                      {est.amonestaciones > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-rose-400/70">— Amonestaciones económicas{Number(col.amonestaciones_count ?? 0) > 0 ? ` (${col.amonestaciones_count})` : ""}</span>
                          <span className="text-rose-400">–{fmtQ(est.amonestaciones)}</span>
                        </div>
                      )}
                      {est.igssLaboralReal > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-cyan-400/70">— IGSS laboral (4.83%)</span>
                          <span className="text-cyan-400">–{fmtQ(est.igssLaboralReal)}</span>
                        </div>
                      )}
                      {est.isrQuincenal > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-amber-400/70">— ISR quincenal</span>
                          <span className="text-amber-400">–{fmtQ(est.isrQuincenal)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-emerald-500/20">
                      <span className="text-xs font-semibold text-white/60">Total real ({est.diasCerrados}d)</span>
                      <span className={`text-lg font-bold ${est.totalReal >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {fmtQ(est.totalReal)}
                      </span>
                    </div>
                  </div>

                  {/* Total Estimado (período completo) */}
                  {est.diasCerrados < (periodoTotalDias ?? 0) && (
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/30 rounded-xl p-4">
                      <p className="text-[10px] text-white/40 uppercase tracking-widest mb-3">Total Estimado — proyección a {periodoTotalDias}d</p>
                      <div className="space-y-1.5 mb-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-white/50">Sueldo período ({periodoTotalDias}d)</span>
                          <span className="text-white font-medium">{fmtQ(est.sueldoPeriodo)}</span>
                        </div>
                        {est.bonIncentivoProy > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-emerald-300/70">+ Bonif. incentivo ({est.diasTrabProy}d proy.)</span>
                            <span className="text-emerald-300">+{fmtQ(est.bonIncentivoProy)}</span>
                          </div>
                        )}
                        {est.bon1Proy > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-emerald-300/70">+ Bonificación 1 ({est.diasTrabProy}d proy.)</span>
                            <span className="text-emerald-300">+{fmtQ(est.bon1Proy)}</span>
                          </div>
                        )}
                        {est.bon2Proy > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-emerald-300/70">+ Bonificación 2 ({est.diasTrabProy}d proy.)</span>
                            <span className="text-emerald-300">+{fmtQ(est.bon2Proy)}</span>
                          </div>
                        )}
                        {est.bon3Proy > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-emerald-300/70">+ Bonificación 3 ({est.diasTrabProy}d proy.)</span>
                            <span className="text-emerald-300">+{fmtQ(est.bon3Proy)}</span>
                          </div>
                        )}
                        {est.descFaltas > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-red-400/70">— Desc. faltas / susp. ({est.diasDesc}d descuento)</span>
                            <span className="text-red-400">–{fmtQ(est.descFaltas)}</span>
                          </div>
                        )}
                        {est.valorHE > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-orange-400/70">+ H. Extra ({heNum.toFixed(1)} h × 1.5x)</span>
                            <span className="text-orange-400">+{fmtQ(est.valorHE)}</span>
                          </div>
                        )}
                        {est.anticipo > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-amber-400/70">— Anticipo del período</span>
                            <span className="text-amber-400">–{fmtQ(est.anticipo)}</span>
                          </div>
                        )}
                        {est.cuotaUniforme > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-orange-300/70">— Cuota uniforme/botas</span>
                            <span className="text-orange-300">–{fmtQ(est.cuotaUniforme)}</span>
                          </div>
                        )}
                        {est.barracaMonto > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-violet-300/70">— Barraca{col.barraca_nombre ? ` (${col.barraca_nombre})` : ""}</span>
                            <span className="text-violet-300">–{fmtQ(est.barracaMonto)}</span>
                          </div>
                        )}
                        {est.seguroMonto > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-pink-300/70">— Seguro de vida</span>
                            <span className="text-pink-300">–{fmtQ(est.seguroMonto)}</span>
                          </div>
                        )}
                        {est.amonestaciones > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-rose-400/70">— Amonestaciones económicas{Number(col.amonestaciones_count ?? 0) > 0 ? ` (${col.amonestaciones_count})` : ""}</span>
                            <span className="text-rose-400">–{fmtQ(est.amonestaciones)}</span>
                          </div>
                        )}
                        {est.igssLaboral > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-cyan-400/70">— IGSS laboral (4.83%)</span>
                            <span className="text-cyan-400">–{fmtQ(est.igssLaboral)}</span>
                          </div>
                        )}
                        {est.isrQuincenal > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-amber-400/70">— ISR quincenal</span>
                            <span className="text-amber-400">–{fmtQ(est.isrQuincenal)}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-primary/20">
                        <span className="text-xs font-semibold text-white/60">Total estimado ({periodoTotalDias}d)</span>
                        <span className={`text-lg font-bold ${est.total >= 0 ? "text-primary" : "text-red-400"}`}>
                          {fmtQ(est.total)}
                        </span>
                      </div>
                      <p className="text-[9px] text-white/25 mt-2 leading-relaxed">
                        Proyección asumiendo {(periodoTotalDias ?? 0) - est.diasCerrados} días restantes sin cambios. Bonificaciones proporcionales (base/30 × días). No incluye séptimo día ni deducciones finales.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white/3 border border-white/8 rounded-xl p-3 text-center">
                  <p className="text-[11px] text-white/30">Sin sueldo base registrado — no se puede calcular estimado</p>
                </div>
              )}

              {/* Grid métricas */}
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Métricas del período</p>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[
                    { label: "Días pagados", val: Math.max(Number(col.dias_cerrados) - Number(col.total_dias_descuento ?? 0), 0), cls: Number(col.total_dias_descuento ?? 0) > 0 ? "text-amber-400" : "text-green-400" },
                    { label: "Faltas", val: Number(col.faltas), cls: Number(col.faltas) > 0 ? "text-red-400" : "text-white/30",
                      extra: Number(col.faltas_pendientes_rrhh) > 0 ? `+${col.faltas_pendientes_rrhh} pend.` : undefined },
                    { label: "Suspensiones", val: Number(col.suspensiones), cls: Number(col.suspensiones) > 0 ? "text-amber-400" : "text-white/30" },
                    { label: "Dsco. trab.", val: Number(col.descansos_trabajados), cls: "text-blue-400" },
                    { label: "Relevos", val: Number(col.relevos), cls: Number(col.relevos) > 0 ? "text-purple-400" : "text-white/30" },
                    { label: "Días sin hrs", val: Number(col.dias_sin_horas), cls: Number(col.dias_sin_horas) > 0 ? "text-rose-400" : "text-white/20" },
                  ].map(({ label, val, cls, extra }) => (
                    <div key={label} className="bg-[#0c1929] border border-white/6 rounded-lg p-2.5">
                      <p className={`text-xl font-bold ${cls}`}>
                        {val}
                        {extra && <span className="text-[10px] font-normal text-amber-400/80 ml-1">{extra}</span>}
                      </p>
                      <p className="text-[10px] text-white/35 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#0c1929] border border-white/6 rounded-lg p-2.5">
                    <p className="text-lg font-bold text-cyan-400">{htNum.toFixed(1)} h</p>
                    <p className="text-[10px] text-white/35">Horas trabajadas</p>
                  </div>
                  <div className="bg-[#0c1929] border border-white/6 rounded-lg p-2.5">
                    <p className={`text-lg font-bold ${heNum > 0 ? "text-orange-400" : "text-white/30"}`}>{heNum.toFixed(1)} h</p>
                    <p className="text-[10px] text-white/35">Horas extra</p>
                  </div>
                </div>
              </div>

              {/* Datos de empleado */}
              <div className="bg-[#0c1929] border border-white/6 rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Datos laborales</p>
                {[
                  ["Sueldo base", fmtQ(col.sueldo_base)],
                  ["Turno", col.tipo_turno_nombre ?? "—"],
                  ["Jornada", col.tipo_jornada ?? "—"],
                  ["Hrs contrato", col.horas_contrato != null ? `${col.horas_contrato} h/sem` : "—"],
                  ["Descanso", col.dia_descanso ?? "—"],
                  ["Cliente", col.cliente_principal ?? "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-white/40">{k}</span>
                    <span className="text-white/80 font-medium">{v}</span>
                  </div>
                ))}
              </div>

              {/* IGSS */}
              <div className="bg-[#0c1929] border border-white/6 rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Clasificación IGSS</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Estado colaborador</span>
                  {col.aplica_igss ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Aplica IGSS
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-white/40 border border-white/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                      No aplica
                    </span>
                  )}
                </div>
                {col.motivo_exclusion_igss && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-white/40 shrink-0">Motivo</span>
                    <span className="text-xs text-amber-300/80 text-right">{col.motivo_exclusion_igss}</span>
                  </div>
                )}
                {[
                  ["Aplica general", col.aplica_igss_general ? "Sí" : "No"],
                  ["Estado IGSS", col.estado_igss],
                  ["Puesto cubre IGSS", col.puesto_aplica_igss ? "Sí" : "No"],
                  ["Régimen puesto", col.puesto_regimen_igss || "—"],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between text-xs">
                    <span className="text-white/40">{k}</span>
                    <span className="text-white/70">{v}</span>
                  </div>
                ))}
                {col.aplica_igss && est && (
                  <div className="border-t border-white/6 pt-2 mt-2 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Cuota laboral (4.83%)</span>
                      <span className="text-emerald-400 font-semibold">{fmtQ(est.igssLaboral)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Cuota patronal (12.67%)</span>
                      <span className="text-blue-300/70 font-medium">{fmtQ(Math.round((est.sueldoPeriodo - est.descFaltas) * 0.1267 * 100) / 100)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Frecuencia de pago */}
              <div className="bg-[#0c1929] border border-white/6 rounded-xl p-3 space-y-1.5">
                <p className="text-[10px] text-white/25 uppercase tracking-widest mb-1">Frecuencia de pago</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Configuración</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                    col.frecuencia_pago === "mensual"
                      ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
                      : "bg-white/5 text-white/50 border-white/10"
                  }`}>
                    {col.frecuencia_pago === "mensual" ? "Mensual" : "Quincenal"}
                  </span>
                </div>
                {col.quincena_tipo && (
                  <div className="flex justify-between text-xs">
                    <span className="text-white/40">Período actual</span>
                    <span className="text-white/70">{col.quincena_tipo === "primera" ? "1ª Quincena" : "2ª Quincena"}</span>
                  </div>
                )}
                {col.excluido_frecuencia_pago && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-white/40 shrink-0">Estado</span>
                    <span className="text-xs text-slate-300/80 text-right">Excluido de esta quincena</span>
                  </div>
                )}
                {col.motivo_exclusion_frecuencia_pago && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-white/40 shrink-0">Motivo</span>
                    <span className="text-xs text-amber-300/80 text-right">{col.motivo_exclusion_frecuencia_pago}</span>
                  </div>
                )}
              </div>

              {/* Revisión RRHH */}
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Revisión RRHH</p>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {(["pendiente", "revisada", "observada", "aprobado_rrhh"] as const).map((e) => {
                      const cfg = REVISION_CFG[e];
                      return (
                        <button key={e} onClick={() => setRevEstado(e)}
                          className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition-all ${
                            revEstado === e ? cfg.cls + " border-opacity-60" : "text-white/30 bg-white/4 border-white/10 hover:border-white/20"
                          }`}>
                          <cfg.icon className="w-3 h-3" />{cfg.label}
                        </button>
                      );
                    })}
                  </div>
                  <textarea value={revObs} onChange={(e) => setRevObs(e.target.value)} rows={2}
                    placeholder="Observaciones RRHH (opcional)…"
                    className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 resize-none" />
                  <button onClick={guardarRevision} disabled={savingRev}
                    className="w-full py-2.5 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                    {savingRev && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <Check className="w-3.5 h-3.5" />Guardar revisión
                  </button>
                  {col.revision_at && (
                    <p className="text-[10px] text-white/25 text-center">
                      Última revisión: {new Date(col.revision_at).toLocaleString("es-GT")}
                      {col.revision_por ? ` — por ${col.revision_por}` : ""}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Día a día ────────────────────────────────────────── */}
          {activeInner === "detalle" && (
            <div className="p-5">
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Novedades día a día</p>
              {loading ? (
                <div className="flex items-center gap-2 text-white/30 text-sm py-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
                </div>
              ) : data?.novedades.length === 0 ? (
                <p className="text-white/30 text-sm py-2">Sin novedades registradas en el período.</p>
              ) : (
                <div className="space-y-1">
                  {data?.novedades.map((n) => (
                    <div key={n.id} className={`flex items-center gap-3 py-2 px-2.5 rounded-lg text-xs transition-colors ${
                      n.falta ? "bg-red-500/5 border border-red-500/10" :
                      n.suspension ? "bg-amber-500/5 border border-amber-500/10" :
                      "hover:bg-white/3 border border-transparent"
                    }`}>
                      <span className="text-white/40 w-24 shrink-0">{fmtFecha(n.fecha)}</span>
                      <div className="flex items-center gap-1 flex-1 flex-wrap">
                        {n.trabajo_dia && <span className="px-1.5 py-0.5 rounded bg-green-400/10 text-green-400 border border-green-400/20">Trabajó</span>}
                        {n.falta && <span className="px-1.5 py-0.5 rounded bg-red-400/10 text-red-400 border border-red-400/20">Falta{n.dias_descuento ? ` (–${n.dias_descuento}d)` : ""}</span>}
                        {n.suspension && <span className="px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">Suspensión</span>}
                        {n.descanso_trabajado && <span className="px-1.5 py-0.5 rounded bg-blue-400/10 text-blue-400 border border-blue-400/20">Dsco. Trab.</span>}
                        {n.puesto_cubierto_nombre && n.puesto_cubierto_nombre !== n.puesto_titular_nombre && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-400/10 text-purple-400 border border-purple-400/20" title={`Cubrió: ${n.puesto_cubierto_nombre}`}>Relevo</span>
                        )}
                        {n.tipo_novedad && (() => {
                          const labelMap: Record<string,string> = {
                            falta_total: "Falta total", abandono_parcial: "Abandono parcial",
                            vacaciones: "Vacaciones", relevo_vacaciones: "Cob. vacaciones",
                            incapacidad: "Incapacidad IGSS", suspension: "Suspensión",
                            permiso_con_goce: "Permiso c/goce", permiso_sin_goce: "Permiso s/goce",
                            relevo_completo: "Relevo completo", relevo_parcial: "Relevo parcial",
                            horas_extra_puras: "Horas extra", ssa_externo: "Serv. especial",
                            cambio_titular: "Cambio titular", descanso_ciclo: "Descanso ciclo",
                          };
                          const isDescuento = ["falta_total","abandono_parcial","suspension","permiso_sin_goce"].includes(n.tipo_novedad);
                          const isNeutral   = ["vacaciones","incapacidad","relevo_vacaciones","permiso_con_goce","descanso_ciclo"].includes(n.tipo_novedad);
                          return (
                            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${
                              isDescuento ? "bg-red-500/5 text-red-300/70 border-red-500/15" :
                              isNeutral   ? "bg-emerald-500/5 text-emerald-300/70 border-emerald-500/15" :
                              "bg-white/5 text-white/30 border-white/10"
                            }`}>
                              {labelMap[n.tipo_novedad] ?? n.tipo_novedad}
                            </span>
                          );
                        })()}
                        {n.observaciones && <span className="text-white/30 text-[10px]">· {n.observaciones}</span>}
                      </div>
                      <span className="text-white/40 w-14 text-right shrink-0">
                        {n.horas_trabajadas ? `${parseFloat(n.horas_trabajadas).toFixed(1)} h` : "—"}
                      </span>
                      {parseFloat(n.horas_extra ?? "0") > 0 && (
                        <span className="text-orange-400 text-[10px] shrink-0">+{parseFloat(n.horas_extra!).toFixed(1)} HE</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Historial ────────────────────────────────────────── */}
          {activeInner === "historial" && (
            <div className="p-5 space-y-5">
              {loading ? (
                <div className="flex items-center gap-2 text-white/30 text-sm py-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
                </div>
              ) : (
                <>
                  {/* Puesto titular actual */}
                  {(data as any)?.titularPuestos?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Puesto titular</p>
                      <div className="space-y-1.5">
                        {(data as any).titularPuestos.map((p: any) => (
                          <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 bg-blue-500/8 border border-blue-500/20 rounded-lg">
                            <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-blue-300 truncate">{p.nombre}</p>
                              <p className="text-[10px] text-white/40">{p.cliente_nombre}{p.jornada ? ` · ${p.jornada}` : ""}{p.turno_nombre ? ` · ${p.turno_nombre}` : ""}</p>
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium text-blue-400 bg-blue-400/10 border-blue-400/20">Titular</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Historial de puestos cubiertos en el período */}
                  {(() => {
                    const segmentos = (data as any)?.puestosHistorial ?? [];
                    const grouped: Record<string, { puesto_nombre: string; cliente_nombre: string; fechas: { fecha: string; hora_inicio: string; hora_fin: string; horas_calculadas: number; tipo_cobertura: string; genera_horas_extra: boolean; tipo_novedad: string; cobertura_alcance: string }[] }> = {};
                    for (const s of segmentos) {
                      const key = `${s.puesto_id}`;
                      if (!grouped[key]) grouped[key] = { puesto_nombre: s.puesto_nombre || "Puesto desconocido", cliente_nombre: s.cliente_nombre || "—", fechas: [] };
                      grouped[key].fechas.push({ fecha: s.fecha, hora_inicio: s.hora_inicio, hora_fin: s.hora_fin, horas_calculadas: parseFloat(s.horas_calculadas) || 0, tipo_cobertura: s.tipo_cobertura, genera_horas_extra: s.genera_horas_extra, tipo_novedad: s.tipo_novedad, cobertura_alcance: s.cobertura_alcance });
                    }
                    const entries = Object.entries(grouped);
                    const totalHoras = segmentos.reduce((acc: number, s: any) => acc + (parseFloat(s.horas_calculadas) || 0), 0);
                    return (
                      <div>
                        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">
                          Puestos cubiertos en el período
                          {entries.length > 0 && <span className="text-white/50 ml-1">({segmentos.length} cobertura{segmentos.length !== 1 ? "s" : ""} · {totalHoras.toFixed(1)}h)</span>}
                        </p>
                        {entries.length === 0 ? (
                          <p className="text-white/25 text-sm">Sin coberturas registradas en este período.</p>
                        ) : (
                          <div className="space-y-2">
                            {entries.map(([pId, g]) => (
                              <div key={pId} className="bg-[#0c1929] border border-white/8 rounded-lg overflow-hidden">
                                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
                                  <MapPin className="w-3.5 h-3.5 text-cyan-400/60 shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-white/80 truncate">{g.puesto_nombre}</p>
                                    <p className="text-[10px] text-white/35">{g.cliente_nombre}</p>
                                  </div>
                                  <span className="text-[10px] text-cyan-400/70 font-medium">{g.fechas.length} día{g.fechas.length !== 1 ? "s" : ""}</span>
                                </div>
                                <div className="px-3 py-1.5 space-y-0.5 max-h-32 overflow-y-auto">
                                  {g.fechas.map((f, fi) => {
                                    const tipoLabel: Record<string, string> = { relevo: "Relevo", titular: "Titular", cobertura_supervisor: "Sup.", cobertura_jefe_servicio: "Jefe Serv." };
                                    return (
                                      <div key={fi} className="flex items-center justify-between text-[10px]">
                                        <span className="text-white/50">{fmtFecha(f.fecha)}</span>
                                        <div className="flex items-center gap-2">
                                          {f.hora_inicio && f.hora_fin && (
                                            <span className="text-white/30">{f.hora_inicio}–{f.hora_fin}</span>
                                          )}
                                          <span className="text-white/40">{f.horas_calculadas.toFixed(1)}h</span>
                                          <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${
                                            f.genera_horas_extra ? "text-amber-400 bg-amber-400/10" : "text-cyan-400/60 bg-cyan-400/5"
                                          }`}>{tipoLabel[f.tipo_cobertura] ?? f.tipo_cobertura}{f.genera_horas_extra ? " HE" : ""}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Incentivos cash */}
                  {(data?.incentivos?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Incentivos Cash del período</p>
                      <div className="space-y-1.5">
                        {data!.incentivos.map((inc) => {
                          const tipoLabel: Record<string, string> = {
                            relevo_cash: "Relevo Cash", bono_cobertura: "Bono Cobertura", motivacion_cobertura: "Motivación",
                          };
                          const estadoColor: Record<string, string> = {
                            pendiente: "text-amber-400 bg-amber-400/10 border-amber-400/20",
                            pagado:    "text-green-400 bg-green-400/10 border-green-400/20",
                            auditado:  "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
                            cancelado: "text-white/30 bg-white/5 border-white/10",
                          };
                          return (
                            <div key={inc.id} className="flex items-center justify-between px-3 py-2 bg-[#071a0d] border border-emerald-900/40 rounded-lg">
                              <div>
                                <p className="text-xs font-semibold text-emerald-300">{tipoLabel[inc.tipo] ?? inc.tipo} — {fmtQ(inc.monto)}</p>
                                <p className="text-[10px] text-white/35">{fmtFecha(inc.fecha)}{inc.motivo ? ` · ${inc.motivo}` : ""}</p>
                                {(inc.pagado_por || inc.metodo_pago) && (
                                  <p className="text-[10px] text-white/25">{inc.pagado_por}{inc.metodo_pago ? ` · ${inc.metodo_pago}` : ""}</p>
                                )}
                              </div>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${estadoColor[inc.estado] ?? "text-white/30 bg-white/5 border-white/10"}`}>{inc.estado}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Anticipos */}
                  {(data?.anticipos.length ?? 0) > 0 ? (
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Anticipos del período</p>
                      <div className="space-y-1.5">
                        {data!.anticipos.map((a) => (
                          <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-[#0c1929] border border-white/6 rounded-lg">
                            <div>
                              <p className="text-xs font-semibold text-amber-300">{fmtQ(a.cantidad)}</p>
                              <p className="text-[10px] text-white/35">{a.periodo ?? "—"} · {a.origen}</p>
                              {a.observaciones && <p className="text-[10px] text-white/25">{a.observaciones}</p>}
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                              a.estado === "pagada" ? "text-green-400 bg-green-400/10 border-green-400/20" :
                              a.estado === "aprobada" ? "text-blue-400 bg-blue-400/10 border-blue-400/20" :
                              "text-white/30 bg-white/5 border-white/10"
                            }`}>{a.estado}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Anticipos del período</p>
                      <p className="text-white/25 text-sm">Sin anticipos en este período.</p>
                    </div>
                  )}

                  {(data?.incentivos?.length ?? 0) === 0 && (
                    <div>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Incentivos Cash</p>
                      <p className="text-white/25 text-sm">Sin incentivos cash en este período.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
