import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader2, AlertTriangle, ArrowLeftRight, Building2, UserMinus, UserPlus, FileText, DollarSign } from "lucide-react";
import { API_BASE, getSession } from "../utils";
import { Puesto, Agente, MOTIVOS_SALIDA, GRUPO_COLORS } from "../types";

export function ModalSustitucion({
  puesto,
  agenteEntrante,
  onConfirm,
  onCancel,
  advertencia,
  agentePoolStatus,
}: {
  puesto: Puesto;
  agenteEntrante: Agente;
  onConfirm: (motivo: string, notas: string, forzar: boolean, tipoSustitucion: string, tipoNovedad: string, coberturaTipo: string, horasParcial?: { inicio: string; fin: string }, pagoEfectivo?: { monto: number; pagadoPor: string }) => Promise<void>;
  onCancel: () => void;
  advertencia?: string;
  agentePoolStatus?: "disponible" | "descansando" | "vacaciones" | "trabajando";
}) {
  const [motivoSalida, setMotivoSalida] = useState("falta_total");
  const [tipoCobertura, setTipoCobertura] = useState<"completo" | "parcial">("completo");
  const [modoPagoHE, setModoPagoHE] = useState<"planilla" | "efectivo">("planilla");
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [pagadoPor, setPagadoPor] = useState("");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [tipoSustitucion, setTipoSustitucion] = useState<"relevo" | "reasignacion">("relevo");
  const [horaAbandono, setHoraAbandono] = useState("");
  const [horaInicioParcial, setHoraInicioParcial] = useState(puesto.hora_entrada ?? "");
  const [horaFinParcial, setHoraFinParcial] = useState("");
  const [tarifaHE, setTarifaHE] = useState<{ tarifa: number; horas_turno: number } | null>(null);
  const esSustitucion = !!puesto.agente_id;
  const aplicaHE = agentePoolStatus === "descansando" || agentePoolStatus === "vacaciones";

  const tipoNovedad = motivoSalida;

  const jornadaReal = (() => {
    if (puesto.jornada === "24h") return "24h";
    if (puesto.jornada === "12h") return "12h";
    if (puesto.horas_trabajo && Number(puesto.horas_trabajo) >= 20) return "24h";
    if (puesto.horas_trabajo && Number(puesto.horas_trabajo) > 0 && Number(puesto.horas_trabajo) < 20) return "12h";
    if (puesto.ciclo_horas && Number(puesto.ciclo_horas) >= 20) return "24h";
    if (puesto.hora_entrada && puesto.hora_salida) {
      const pm = (hm: string) => { const [h, m] = hm.split(":").map(Number); return h * 60 + (m || 0); };
      let d = pm(puesto.hora_salida) - pm(puesto.hora_entrada);
      if (d <= 0) d += 1440;
      return d >= 20 * 60 ? "24h" : "12h";
    }
    if (puesto.turno_nombre && /24/.test(puesto.turno_nombre)) return "24h";
    if (puesto.es_par_24x24) return "24h";
    return "12h";
  })();

  useEffect(() => {
    if (!aplicaHE) return;
    fetch(`${API_BASE}/nomina/tarifas-he`, { headers: { "x-isp-session": getSession() } }).then(r => r.json()).then((rows: any[]) => {
      const found = rows.find((r: any) => r.jornada === jornadaReal) ?? rows[0];
      if (found) {
        const t = { tarifa: parseFloat(found.tarifa), horas_turno: parseInt(found.horas_turno) };
        setTarifaHE(t);
      }
    }).catch(() => {});
  }, [jornadaReal, aplicaHE]);

  const motivoSeleccionado = MOTIVOS_SALIDA.find((t) => t.value === motivoSalida);
  const generaRrhh = esSustitucion && !!motivoSeleccionado?.genera_rrhh;

  const parseMin = (hm: string) => { const [h, m] = hm.split(":").map(Number); return h * 60 + (m || 0); };
  const turnoMin = puesto.hora_entrada && puesto.hora_salida
    ? (() => { let d = parseMin(puesto.hora_salida!) - parseMin(puesto.hora_entrada!); if (d <= 0) d += 1440; return d; })()
    : (jornadaReal === "24h" ? 1440 : 720);
  const parcialMin = horaInicioParcial && horaFinParcial
    ? (() => { let d = parseMin(horaFinParcial) - parseMin(horaInicioParcial); if (d <= 0) d += 1440; return d; })()
    : 0;
  const parcialExcede = tipoCobertura === "parcial" && parcialMin > turnoMin;
  const parcialIncompleto = tipoCobertura === "parcial" && (!horaInicioParcial || !horaFinParcial);

  const costoPorHora = tarifaHE ? tarifaHE.tarifa / tarifaHE.horas_turno : null;
  const costoTurnoCompleto = tarifaHE?.tarifa ?? null;
  const costoParcial = costoPorHora && parcialMin > 0 ? costoPorHora * (parcialMin / 60) : null;
  const costoHE = tipoCobertura === "parcial" && costoParcial != null ? costoParcial : costoTurnoCompleto;

  useEffect(() => {
    if (costoHE != null) setMontoEfectivo(costoHE.toFixed(2));
  }, [costoHE]);

  async function handleConfirm() {
    if (parcialExcede || parcialIncompleto) return;
    if (aplicaHE && modoPagoHE === "efectivo" && tipoSustitucion === "relevo") {
      const m = Number(montoEfectivo);
      if (!montoEfectivo || isNaN(m) || m <= 0) return;
    }
    setLoading(true);
    try {
      const notasFinal = tipoCobertura === "parcial" && horaInicioParcial && horaFinParcial
        ? `${notas ? notas + " | " : ""}Cobertura parcial: ${horaInicioParcial} a ${horaFinParcial}`
        : notas;
      const horasParcialData = tipoCobertura === "parcial" && horaInicioParcial && horaFinParcial
        ? { inicio: horaInicioParcial, fin: horaFinParcial }
        : undefined;
      const pagoEfectivoData = aplicaHE && modoPagoHE === "efectivo" && tipoSustitucion === "relevo"
        ? { monto: Number(montoEfectivo), pagadoPor: pagadoPor || "" }
        : undefined;
      await onConfirm(motivoSalida, notasFinal, !!advertencia, tipoSustitucion, motivoSalida, tipoCobertura, horasParcialData, pagoEfectivoData);
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-2">
            {esSustitucion
              ? <ArrowLeftRight className="w-4 h-4 text-yellow-400" />
              : <UserPlus className="w-4 h-4 text-green-400" />
            }
            <h3 className="text-sm font-bold text-white">
              {esSustitucion ? "Confirmar sustitución" : "Confirmar asignación"}
            </h3>
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1" style={{ scrollbarWidth: "thin" }}>
          {/* Advertencia de conflicto */}
          {advertencia && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-300/80">{advertencia}</p>
            </div>
          )}

          {/* Aviso de generación de eventos RRHH */}
          {esSustitucion && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 flex items-start gap-2">
              <FileText className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-purple-300 mb-0.5">
                  {tipoSustitucion === "relevo" ? "Se generarán 2 eventos RRHH" : "Se generará 1 evento RRHH"}
                </p>
                <p className="text-[11px] text-purple-300/70">
                  {tipoSustitucion === "relevo"
                    ? `1) Titular: ${motivoSeleccionado?.label ?? "—"}. 2) Cubriente: ${aplicaHE ? "horas extra" : "cobertura"}.`
                    : `Titular: ${motivoSeleccionado?.label ?? "—"}.`}
                </p>
              </div>
            </div>
          )}

          {/* Resumen del movimiento */}
          <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="w-3 h-3 text-white/25" />
              <span className="text-xs text-white/50">{puesto.cliente_nombre} · {puesto.nombre}</span>
            </div>
            {esSustitucion && puesto.agente_nombre && (
              <div className="flex items-center gap-2">
                <UserMinus className="w-3 h-3 text-red-400/60" />
                <span className="text-xs text-white/50">Sale: <span className="text-white/70">{puesto.agente_nombre}</span></span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <UserPlus className="w-3 h-3 text-green-400/60" />
              <span className="text-xs text-white/50">Entra: <span className="text-white/70">{agenteEntrante.nombre_completo}</span></span>
            </div>
          </div>

          {/* Tipo de sustitución: Relevo temporal vs Reasignación permanente */}
          {esSustitucion && puesto.titular_employee_id && (
            <div className="space-y-1.5">
              <label className="text-xs text-white/40">Tipo de movimiento</label>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="relative group/tip">
                  <button
                    type="button"
                    onClick={() => setTipoSustitucion("relevo")}
                    className={`w-full py-2 px-2 rounded-lg border text-[11px] font-semibold transition-all ${
                      tipoSustitucion === "relevo"
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                        : "border-white/10 text-white/35 hover:text-white/60"
                    }`}
                  >
                    Relevo temporal
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-[#0d1117] border border-white/20 rounded-lg text-[10px] text-white/80 leading-snug whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity duration-150 z-50 shadow-xl">
                    Cubre solo por hoy, el titular sigue asignado al puesto
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white/20" />
                  </div>
                </div>
                <div className="relative group/tip">
                  <button
                    type="button"
                    onClick={() => setTipoSustitucion("reasignacion")}
                    className={`w-full py-2 px-2 rounded-lg border text-[11px] font-semibold transition-all ${
                      tipoSustitucion === "reasignacion"
                        ? "bg-blue-500/15 border-blue-500/40 text-blue-300"
                        : "border-white/10 text-white/35 hover:text-white/60"
                    }`}
                  >
                    Reasignación
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-[#0d1117] border border-white/20 rounded-lg text-[10px] text-white/80 leading-snug whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity duration-150 z-50 shadow-xl">
                    Cambio permanente de titular en este puesto
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white/20" />
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-white/25">
                {tipoSustitucion === "relevo"
                  ? `El titular (${puesto.titular_nombre}) sigue siendo titular. Solo cambia la cobertura de hoy.`
                  : `${agenteEntrante.nombre_completo} se convierte en el nuevo titular permanente del puesto.`
                }
              </p>
            </div>
          )}

          {/* ── SECCIÓN A: ¿Por qué sale el titular? ──────────────── */}
          {esSustitucion && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <UserMinus className="w-3.5 h-3.5 text-red-400/60" />
                <label className="text-xs font-semibold text-white/60">¿Por qué sale {puesto.agente_nombre?.split(" ")[0] ?? "el titular"}?</label>
                {motivoSeleccionado && (
                  <span className={`ml-auto text-[9px] px-1.5 py-0.5 rounded border font-semibold ${
                    motivoSeleccionado.grupo === "descuento"
                      ? "text-red-300 bg-red-500/10 border-red-500/30"
                      : "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
                  }`}>
                    {motivoSeleccionado.grupo === "descuento" ? "Con descuento" : "Sin descuento"}
                  </span>
                )}
              </div>

              {(["descuento","sin_descuento"] as const).map((grupo) => {
                const items = MOTIVOS_SALIDA.filter((t) => t.grupo === grupo);
                if (items.length === 0) return null;
                const grupoLabel = grupo === "descuento" ? "Con descuento salarial" : "Sin descuento";
                return (
                  <div key={grupo}>
                    <p className="text-[9px] text-white/25 uppercase tracking-wide mb-1">{grupoLabel}</p>
                    <div className="flex flex-wrap gap-1">
                      {items.map((t) => (
                        <div key={t.value} className="relative group/tip">
                          <button
                            type="button"
                            data-active={motivoSalida === t.value ? "" : undefined}
                            onClick={() => setMotivoSalida(t.value)}
                            className={`px-2 py-1 rounded-md border text-[10px] font-semibold transition-all ${GRUPO_COLORS[grupo]} ${
                              motivoSalida === t.value ? "opacity-100 scale-[1.03]" : "opacity-60 hover:opacity-90"
                            }`}
                          >
                            {t.label}
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-[#0d1117] border border-white/20 rounded-lg text-[10px] text-white/80 leading-snug whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity duration-150 z-50 shadow-xl max-w-[250px] whitespace-normal">
                            {t.desc}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white/20" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {motivoSeleccionado && (
                <div className="bg-white/5 border border-white/8 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-white/50 leading-relaxed">{motivoSeleccionado.desc}</p>
                  {motivoSeleccionado.requiere_aprobacion_rrhh && (
                    <p className="text-[10px] text-amber-400/80 mt-1 font-medium">Requiere aprobación de RRHH</p>
                  )}
                </div>
              )}

              {motivoSeleccionado?.requiere_hora_abandono && (
                <div>
                  <label className="text-[10px] text-white/40 mb-1 block">Hora de abandono</label>
                  <input
                    type="time"
                    value={horaAbandono}
                    onChange={(e) => setHoraAbandono(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* ── SECCIÓN B: ¿Cómo cubre el entrante? ──────────────── */}
          {esSustitucion && (
            <div className="space-y-2 border-t border-white/8 pt-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-3.5 h-3.5 text-green-400/60" />
                <label className="text-xs font-semibold text-white/60">¿Cómo cubre {agenteEntrante.nombre_completo.split(" ")[0]}?</label>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setTipoCobertura("completo")}
                  className={`py-2 px-3 rounded-lg border text-[11px] font-semibold transition-all ${
                    tipoCobertura === "completo"
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                      : "border-white/10 text-white/35 hover:text-white/60"
                  }`}
                >
                  Relevo completo
                </button>
                <button
                  type="button"
                  onClick={() => setTipoCobertura("parcial")}
                  className={`py-2 px-3 rounded-lg border text-[11px] font-semibold transition-all ${
                    tipoCobertura === "parcial"
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                      : "border-white/10 text-white/35 hover:text-white/60"
                  }`}
                >
                  Relevo parcial
                </button>
              </div>

              {tipoCobertura === "parcial" && (
                <div>
                  <label className="text-[10px] text-white/40 mb-1 block">
                    Horario de cobertura
                    {puesto.hora_entrada && puesto.hora_salida && (
                      <span className="text-white/20 ml-1">(turno: {puesto.hora_entrada}–{puesto.hora_salida})</span>
                    )}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] text-white/30 block mb-0.5">Inicio</span>
                      <input
                        type="time"
                        value={horaInicioParcial}
                        onChange={(e) => setHoraInicioParcial(e.target.value)}
                        className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 ${parcialExcede ? "border-red-500/50" : "border-white/15"}`}
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-white/30 block mb-0.5">Fin</span>
                      <input
                        type="time"
                        value={horaFinParcial}
                        onChange={(e) => setHoraFinParcial(e.target.value)}
                        className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500 ${parcialExcede ? "border-red-500/50" : "border-white/15"}`}
                      />
                    </div>
                  </div>
                  {parcialExcede && (
                    <p className="text-[10px] text-red-400 mt-1">
                      Las horas de cobertura ({Math.floor(parcialMin / 60)}h{parcialMin % 60 > 0 ? `${parcialMin % 60}m` : ""}) exceden la duración del turno ({Math.floor(turnoMin / 60)}h). Ajuste el horario.
                    </p>
                  )}
                  {!parcialExcede && parcialMin > 0 && (
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-[10px] text-white/30">
                        Cobertura: {Math.floor(parcialMin / 60)}h{parcialMin % 60 > 0 ? `${parcialMin % 60}m` : ""} de {Math.floor(turnoMin / 60)}h del turno
                      </p>
                      {costoParcial != null && (
                        <span className="text-[10px] font-semibold text-amber-400">
                          Pago: Q{costoParcial.toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── SECCIÓN C: ¿Cómo se pagan las HE? (solo descansando/vacaciones) ── */}
          {esSustitucion && tipoSustitucion === "relevo" && aplicaHE && (
            <div className="space-y-2 border-t border-white/8 pt-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-amber-400/60" />
                <label className="text-xs font-semibold text-white/60">¿Cómo se pagan las HE?</label>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setModoPagoHE("planilla")}
                  className={`py-2 px-3 rounded-lg border text-[11px] font-semibold transition-all ${
                    modoPagoHE === "planilla"
                      ? "bg-blue-500/15 border-blue-500/40 text-blue-300"
                      : "border-white/10 text-white/35 hover:text-white/60"
                  }`}
                >
                  En Planilla
                </button>
                <button
                  type="button"
                  onClick={() => setModoPagoHE("efectivo")}
                  className={`py-2 px-3 rounded-lg border text-[11px] font-semibold transition-all ${
                    modoPagoHE === "efectivo"
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                      : "border-white/10 text-white/35 hover:text-white/60"
                  }`}
                >
                  En Efectivo
                </button>
              </div>

              {modoPagoHE === "planilla" && (
                <p className="text-[10px] text-blue-300/50">Pasa por aprobación RRHH y se incluye en la próxima nómina.</p>
              )}

              {modoPagoHE === "efectivo" && (
                <div className="space-y-2">
                  <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-lg p-3 space-y-2">
                    <div>
                      <label className="block text-[10px] text-white/40 mb-1">Monto a pagar (Q)</label>
                      <input
                        type="number"
                        min="1"
                        step="0.50"
                        value={montoEfectivo}
                        onChange={(e) => setMontoEfectivo(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-white/40 mb-1">Pagado por</label>
                      <input
                        type="text"
                        placeholder="Nombre de quien entrega…"
                        value={pagadoPor}
                        onChange={(e) => setPagadoPor(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-300/60">Pago inmediato en campo. No aparecerá en planilla.</p>
                </div>
              )}
            </div>
          )}

          {costoHE != null && esSustitucion && aplicaHE && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-amber-300/60">Costo HE del cubriente</p>
                  <p className="text-[9px] text-white/25">
                    Tarifa: Q{costoPorHora?.toFixed(2)}/hora ({jornadaReal})
                    {tipoCobertura === "parcial" && parcialMin > 0 && ` · ${Math.floor(parcialMin / 60)}h${parcialMin % 60 > 0 ? `${parcialMin % 60}m` : ""}`}
                  </p>
                </div>
                <span className="text-lg font-bold text-amber-400">Q{costoHE.toFixed(2)}</span>
              </div>
              {modoPagoHE === "planilla" && (
                <div className="mt-1.5 flex items-center gap-1.5 border-t border-amber-500/15 pt-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                  <p className="text-[9px] text-yellow-300/70">
                    Requiere aprobación RRHH antes de pasar a planilla
                  </p>
                </div>
              )}
              {modoPagoHE === "efectivo" && (
                <div className="mt-1.5 flex items-center gap-1.5 border-t border-emerald-500/15 pt-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <p className="text-[9px] text-emerald-300/70">
                    Se registra como pago en efectivo — excluido de nómina
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Notas */}
          <div className="space-y-1">
            <label className="text-xs text-white/40">Notas (opcional)</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Observación adicional…"
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 resize-none"
            />
          </div>

        </div>

        <div className="px-5 py-4 border-t border-white/8 shrink-0 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || parcialExcede || !!parcialIncompleto}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors flex items-center justify-center gap-2
              ${esSustitucion
                ? "bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50"
                : "bg-green-600 hover:bg-green-500 disabled:opacity-50"}`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {advertencia ? "Forzar y confirmar" : esSustitucion ? "Confirmar sustitución" : "Asignar"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Nuevo Puesto ──────────────────────────────────────────────────────

