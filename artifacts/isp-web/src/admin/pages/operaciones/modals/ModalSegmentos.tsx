import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, Layers, Loader2, Moon, Plus, Timer, Trash2, UserMinus, X, XCircle, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { EmpleadoBusqueda, GrupoEstado, Puesto, Segmento } from "../types";
import { GRUPO_COLORS, MOTIVOS_SALIDA } from "../types";
import {
  API_BASE,
  apiDelete,
  avatarColor,
  getSession,
  iniciales,
  minToHM,
  parseHM,
  turnoBounds,
} from "../utils";
import { SelectorAgenteAgrupado } from "../components/SelectorAgenteAgrupado";

export function ModalSegmentos({
  puesto,
  fecha,
  onClose,
}: {
  puesto: Puesto;
  fecha: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { data: segmentos = [], isLoading, refetch } = useQuery<Segmento[]>({
    queryKey: ["segmentos", fecha, puesto.id],
    queryFn: () =>
      fetch(`${API_BASE}/cobertura/segmentos?fecha=${fecha}&puestoId=${puesto.id}`, { headers: { "x-isp-session": getSession() } })
        .then((r) => r.json()),
  });

  const [empleadoSel, setEmpleadoSel]   = useState<EmpleadoBusqueda | null>(null);
  const [coverGrupo, setCoverGrupo]     = useState<GrupoEstado | null>(null);
  const [tipoCobertura, setTipo]        = useState("relevo");
  const [horaInicio, setHoraInicio]     = useState("");
  const [horaFin, setHoraFin]           = useState("");
  const [motivo, setMotivo]             = useState("");
  const [guardando, setGuardando]       = useState(false);
  // Relevo: motivo de salida del titular (descuento de días, igual que sustitución)
  const [tipoNovedadTitular, setTipoNovedadTitular] = useState("falta_total");
  // HE del cubriente cuando estaba en descanso: efectivo o planilla
  const [modoPagoHE, setModoPagoHE]     = useState<"planilla" | "efectivo">("planilla");
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [pagadoPor, setPagadoPor]       = useState("");
  const [tarifaHE, setTarifaHE]         = useState<{ tarifa: number; horas_turno: number } | null>(null);

  const esRelevo = tipoCobertura === "relevo";
  // Solo se pregunta efectivo/planilla cuando quien cubre estaba en descanso
  const aplicaHE = esRelevo && coverGrupo === "descansando";
  const motivoSeleccionado = MOTIVOS_SALIDA.find((t) => t.value === tipoNovedadTitular);

  const fechaDisplay = (() => {
    const [y, m, d] = fecha.split("-");
    return `${d}-${m}-${y}`;
  })();

  const { inicioMin, finMin, totalMin } = turnoBounds(
    puesto.turno, puesto.hora_entrada, puesto.hora_salida
  );
  const turnoInicioStr = minToHM(inicioMin);
  const turnoFinStr    = minToHM(finMin);

  const segsConHora = segmentos
    .filter((s) => s.hora_inicio && s.hora_fin)
    .map((s) => {
      let si = parseHM(s.hora_inicio!);
      let sf = parseHM(s.hora_fin!);
      if (sf < inicioMin && sf < si) sf += 1440;
      if (si < inicioMin) si += 1440;
      const left  = Math.max(0, ((si - inicioMin) / totalMin) * 100);
      const width = Math.max(0, Math.min(100 - left, ((sf - si) / totalMin) * 100));
      return { ...s, posLeft: left, posWidth: width, siMin: si, sfMin: sf };
    })
    .sort((a, b) => a.siMin - b.siMin);

  const gaps: { left: number; width: number; minutos: number }[] = [];
  let cursor = inicioMin;
  for (const seg of segsConHora) {
    if (seg.siMin > cursor) {
      const gapMin = seg.siMin - cursor;
      gaps.push({
        left:  ((cursor - inicioMin) / totalMin) * 100,
        width: (gapMin / totalMin) * 100,
        minutos: gapMin,
      });
    }
    cursor = Math.max(cursor, seg.sfMin);
  }
  if (cursor < finMin) {
    const gapMin = finMin - cursor;
    gaps.push({
      left:  ((cursor - inicioMin) / totalMin) * 100,
      width: (gapMin / totalMin) * 100,
      minutos: gapMin,
    });
  }
  const totalCubierto  = segsConHora.reduce((s, sg) => s + (sg.sfMin - sg.siMin), 0);
  const totalDescubMin = gaps.reduce((s, g) => s + g.minutos, 0);

  const ultimaFin = segsConHora.length > 0
    ? minToHM(segsConHora[segsConHora.length - 1].sfMin)
    : turnoInicioStr;
  const sugerenciaInicio = horaInicio || ultimaFin;
  const sugerenciaFin    = horaFin    || turnoFinStr;

  const resumenHoras: { nombre: string; horas: number }[] = [];
  for (const sg of segmentos) {
    const nombre = sg.empleado_nombre_join ?? sg.empleado_nombre ?? "—";
    const h = parseFloat(sg.horas_calculadas ?? "0");
    const idx = resumenHoras.findIndex((r) => r.nombre === nombre);
    if (idx >= 0) resumenHoras[idx].horas += h;
    else resumenHoras.push({ nombre, horas: h });
  }

  const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
  const horaInicioInvalida = horaInicio.length > 0 && !HHMM.test(horaInicio);
  const horaFinInvalida    = horaFin.length > 0    && !HHMM.test(horaFin);

  // Jornada del turno (para tarifa HE): ≥20h ⇒ 24h, si no 12h
  const jornadaReal = totalMin >= 20 * 60 ? "24h" : "12h";

  // Cargar tarifa HE solo si aplica (cubriente en descanso)
  useEffect(() => {
    if (!aplicaHE) return;
    fetch(`${API_BASE}/nomina/tarifas-he`, { headers: { "x-isp-session": getSession() } })
      .then((r) => r.json())
      .then((rows: any[]) => {
        const found = rows.find((r: any) => r.jornada === jornadaReal) ?? rows[0];
        if (found) setTarifaHE({ tarifa: parseFloat(found.tarifa), horas_turno: parseInt(found.horas_turno) });
      })
      .catch(() => {});
  }, [jornadaReal, aplicaHE]);

  // Minutos del tramo (para prorratear el costo de HE)
  const segMin = (HHMM.test(horaInicio) && HHMM.test(horaFin))
    ? (() => { let d = parseHM(horaFin) - parseHM(horaInicio); if (d <= 0) d += 1440; return d; })()
    : 0;
  const costoPorHora = tarifaHE ? tarifaHE.tarifa / tarifaHE.horas_turno : null;
  const costoHE = costoPorHora != null && segMin > 0
    ? costoPorHora * (segMin / 60)
    : (tarifaHE?.tarifa ?? null);

  useEffect(() => {
    if (aplicaHE && costoHE != null) setMontoEfectivo(costoHE.toFixed(2));
  }, [costoHE, aplicaHE]);

  async function agregarSegmento() {
    if (!empleadoSel) { toast({ title: "Selecciona un empleado", variant: "destructive" }); return; }
    if (!horaInicio || !horaFin) {
      toast({ title: "Hora de inicio y fin son obligatorias", variant: "destructive" });
      return;
    }
    if (horaInicioInvalida || horaFinInvalida) {
      toast({ title: "Formato de hora inválido — usa HH:MM (ej: 06:00)", variant: "destructive" });
      return;
    }
    const montoNum = Number(montoEfectivo);
    if (aplicaHE && modoPagoHE === "efectivo" && (!montoEfectivo || isNaN(montoNum) || montoNum <= 0)) {
      toast({ title: "Ingresa el monto a pagar en efectivo", variant: "destructive" });
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`${API_BASE}/cobertura/segmentos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({
          fecha,
          puestoId:       puesto.id,
          clientId:       puesto.cliente_id,
          sedeId:         puesto.sede_id,
          employeeId:     empleadoSel.id,
          empleadoNombre: empleadoSel.nombreCompleto,
          tipoCobertura,
          horaInicio: horaInicio || null,
          horaFin:    horaFin    || null,
          motivo:     motivo     || null,
          // Relevo: motivo de salida del titular (descuento de días)
          tipoNovedadTitular: esRelevo ? tipoNovedadTitular : null,
          // HE del cubriente en descanso: cómo se paga (efectivo/planilla)
          modoPagoHE: aplicaHE ? modoPagoHE : null,
        }),
      });
      if (!res.ok) throw await res.json();

      // Si la HE se paga en efectivo, registrar el pago inmediato (no entra a planilla)
      if (aplicaHE && modoPagoHE === "efectivo" && montoNum > 0) {
        try {
          const r = await fetch(`${API_BASE}/incentivos`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
            body: JSON.stringify({
              employeeId:     empleadoSel.id,
              employeeNombre: empleadoSel.nombreCompleto,
              fecha,
              clienteId:      puesto.cliente_id,
              clienteNombre:  puesto.cliente_nombre ?? null,
              sedeId:         puesto.sede_id,
              puestoId:       puesto.id,
              puestoNombre:   puesto.nombre,
              tipo:           "he_efectivo",
              monto:          montoNum,
              motivo:         `Pago HE en efectivo — ${puesto.nombre}`,
              autorizadoPor:  pagadoPor || "sistema",
              pagadoPor:      pagadoPor || "sistema",
              metodoPago:     "efectivo",
              estado:         "pagado",
            }),
          });
          if (r.status === 409) {
            toast({ title: "Ya registrado", description: "Este pago en efectivo ya fue registrado previamente.", variant: "destructive" });
          } else if (r.ok) {
            toast({ title: "HE pagadas en efectivo", description: `Q${montoNum.toFixed(2)} → ${empleadoSel.nombreCompleto}. No entra a planilla.` });
          } else {
            const e = await r.json().catch(() => ({}));
            toast({
              title: "El pago en efectivo NO quedó registrado",
              description: `${e?.error ?? "Error al registrar"}. La HE seguirá en planilla — vuelve a intentar el pago en efectivo.`,
              variant: "destructive",
            });
          }
        } catch {
          toast({
            title: "El pago en efectivo NO quedó registrado",
            description: "No se pudo contactar el servidor. La HE seguirá en planilla — vuelve a intentar el pago en efectivo.",
            variant: "destructive",
          });
        }
      }

      toast({ title: "Tramo registrado correctamente" });
      refetch();
      setEmpleadoSel(null); setCoverGrupo(null);
      setHoraInicio(""); setHoraFin(""); setMotivo("");
      setTipoNovedadTitular("falta_total"); setModoPagoHE("planilla");
      setMontoEfectivo(""); setPagadoPor("");
    } catch (err: any) {
      toast({ title: err?.error ?? "Error al registrar tramo", variant: "destructive" });
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarSegmento(id: number) {
    try {
      await apiDelete(`${API_BASE}/cobertura/segmentos/${id}`);
      toast({ title: "Tramo eliminado" });
      refetch();
    } catch {
      toast({ title: "Error al eliminar tramo", variant: "destructive" });
    }
  }

  const totalHoras = segmentos.reduce(
    (s, sg) => s + parseFloat(sg.horas_calculadas ?? "0"), 0
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-indigo-500/5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">Tramos de cobertura</h3>
              <p className="text-[11px] text-white/40 truncate">{puesto.nombre} · {fechaDisplay}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {totalHoras > 0 && (
              <span className="text-[10px] font-bold text-indigo-300/80 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                {totalHoras.toFixed(1)}h total
              </span>
            )}
            <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-4 pt-3 pb-2 shrink-0 border-b border-white/6">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] text-white/25 uppercase tracking-widest font-semibold">
              Turno {turnoInicioStr}–{turnoFinStr} ({(totalMin / 60).toFixed(0)}h)
            </span>
            <div className="flex items-center gap-2 text-[9px]">
              <span className="text-emerald-400/70">{(totalCubierto / 60).toFixed(1)}h cubiertas</span>
              {totalDescubMin > 0 && (
                <span className="text-red-400/70 font-semibold">{(totalDescubMin / 60).toFixed(1)}h sin cubrir</span>
              )}
            </div>
          </div>
          <div className="relative h-6 bg-[#060e1c] rounded-lg overflow-hidden border border-white/8">
            {gaps.map((g, i) => (
              <div
                key={`gap-${i}`}
                className="absolute top-0 h-full bg-red-500/15 border-x border-red-500/20"
                style={{ left: `${g.left}%`, width: `${g.width}%` }}
                title={`Sin cubrir: ${(g.minutos / 60).toFixed(1)}h`}
              />
            ))}
            {segsConHora.map((seg) => {
              const nombre = seg.empleado_nombre_join ?? seg.empleado_nombre ?? "—";
              return (
                <div
                  key={seg.id}
                  className={`absolute top-0 h-full flex items-center justify-center overflow-hidden ${avatarColor(nombre)} opacity-80`}
                  style={{ left: `${seg.posLeft}%`, width: `${Math.max(seg.posWidth, 1)}%` }}
                  title={`${nombre}: ${seg.hora_inicio}–${seg.hora_fin}`}
                >
                  {seg.posWidth > 8 && (
                    <span className="text-[8px] text-white font-bold truncate px-1 drop-shadow">{iniciales(nombre)}</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[8px] text-white/20">{turnoInicioStr}</span>
            <span className="text-[8px] text-white/20">{minToHM(inicioMin + totalMin / 2)}</span>
            <span className="text-[8px] text-white/20">{turnoFinStr}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            </div>
          )}
          {!isLoading && segmentos.length === 0 && (
            <div className="text-center py-8 text-white/25">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">Sin tramos registrados para este puesto/día</p>
              <p className="text-[11px] mt-1 text-white/15">Agrega uno abajo</p>
            </div>
          )}
          {segmentos.map((sg) => {
            const nombre = sg.empleado_nombre_join ?? sg.empleado_nombre ?? "—";
            return (
              <div key={sg.id} className="flex items-center gap-3 bg-[#0c1929] border border-white/8 rounded-xl p-3 group">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${avatarColor(nombre)}`}>
                  {iniciales(nombre)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-semibold text-white/85 truncate">{nombre}</p>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${
                      sg.tipo_cobertura === "titular"
                        ? "text-green-300/80 bg-green-500/10 border-green-500/20"
                        : "text-amber-300/80 bg-amber-500/10 border-amber-500/20"
                    }`}>
                      {sg.tipo_cobertura.toUpperCase()}
                    </span>
                    {sg.fue_en_dia_descanso && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded border text-blue-300/70 bg-blue-500/10 border-blue-500/20 font-bold flex items-center gap-0.5">
                        <Moon className="w-2.5 h-2.5" /> DESCANSO
                      </span>
                    )}
                    {sg.genera_horas_extra && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded border text-yellow-300/80 bg-yellow-500/10 border-yellow-500/20 font-bold flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5" /> HE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {sg.hora_inicio && sg.hora_fin && (
                      <span className="text-[10px] text-white/40 flex items-center gap-1">
                        <Timer className="w-2.5 h-2.5" />
                        {sg.hora_inicio}–{sg.hora_fin}
                        {sg.horas_calculadas && (
                          <span className="text-indigo-400/70 font-semibold">({parseFloat(sg.horas_calculadas).toFixed(1)}h)</span>
                        )}
                      </span>
                    )}
                    {sg.motivo && (
                      <span className="text-[10px] text-white/30 truncate">{sg.motivo}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => eliminarSegmento(sg.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400/50 hover:text-red-400 transition-all p-1 shrink-0"
                  title="Eliminar tramo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}

          {resumenHoras.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/6">
              <p className="text-[9px] text-white/25 uppercase tracking-widest font-semibold mb-2">Horas registradas por colaborador</p>
              <div className="space-y-1">
                {resumenHoras.map(({ nombre, horas }) => (
                  <div key={nombre} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded flex items-center justify-center text-[7px] font-bold text-white shrink-0 ${avatarColor(nombre)}`}>
                      {iniciales(nombre).slice(0, 1)}
                    </div>
                    <p className="text-xs text-white/60 flex-1 truncate">{nombre}</p>
                    <span className="text-xs font-bold text-indigo-300/80">{horas.toFixed(1)}h</span>
                    <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500/50 rounded-full"
                        style={{ width: `${Math.min(100, (horas / (totalMin / 60)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1 border-t border-white/5 mt-1">
                  <span className="text-[10px] text-white/25">Total turno ({(totalMin / 60).toFixed(0)}h)</span>
                  <span className={`text-[10px] font-bold ${totalDescubMin > 0 ? "text-red-400/70" : "text-emerald-400/70"}`}>
                    {(totalCubierto / 60).toFixed(1)}h / {(totalMin / 60).toFixed(0)}h
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-white/8 p-4 space-y-3 bg-[#060e1c]">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest">Agregar tramo</p>
            {totalDescubMin > 0 && (
              <span className="text-[9px] text-amber-400/70 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                {(totalDescubMin / 60).toFixed(1)}h sin cubrir
              </span>
            )}
          </div>

          {empleadoSel ? (
            <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/25 rounded-xl px-3 py-2.5">
              <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${avatarColor(empleadoSel.nombreCompleto)}`}>
                {iniciales(empleadoSel.nombreCompleto)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-indigo-200 truncate">{empleadoSel.nombreCompleto}</p>
                <p className="text-[10px] text-indigo-300/50">{empleadoSel.puesto ?? "Agente"}</p>
              </div>
              <button onClick={() => { setEmpleadoSel(null); setCoverGrupo(null); }} className="text-white/25 hover:text-red-400 transition-colors">
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <SelectorAgenteAgrupado
              fecha={fecha}
              seleccionado={null}
              puestoId={puesto.id}
              zonaId={puesto.zona_operativa_id}
              onSelect={(a) => {
                setEmpleadoSel({ id: a.id, nombreCompleto: a.nombre, puesto: a.detalle ?? null, area: null });
                setCoverGrupo(a.grupo);
              }}
            />
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-white/35">Tipo</label>
              <select
                value={tipoCobertura}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none appearance-none"
              >
                <option value="relevo">Relevo</option>
                <option value="titular">Titular</option>
                <option value="apoyo">Apoyo</option>
              </select>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-white/35">Inicio</label>
                {sugerenciaInicio && !horaInicio && (
                  <button
                    type="button"
                    onClick={() => setHoraInicio(sugerenciaInicio)}
                    className="text-[8px] text-indigo-400/60 hover:text-indigo-400 transition-colors"
                  >
                    ↙ {sugerenciaInicio}
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder={sugerenciaInicio}
                maxLength={5}
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className={`w-full bg-[#060e1c] border rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-indigo-300/25 outline-none transition-colors ${horaInicioInvalida ? "border-red-500/60 focus:border-red-400" : "border-white/10 focus:border-indigo-400/40"}`}
              />
              {horaInicioInvalida && <p className="text-[9px] text-red-400">Formato HH:MM</p>}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-white/35">Fin</label>
                {sugerenciaFin && !horaFin && (
                  <button
                    type="button"
                    onClick={() => setHoraFin(sugerenciaFin)}
                    className="text-[8px] text-indigo-400/60 hover:text-indigo-400 transition-colors"
                  >
                    ↙ {sugerenciaFin}
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder={sugerenciaFin}
                maxLength={5}
                value={horaFin}
                onChange={(e) => setHoraFin(e.target.value)}
                className={`w-full bg-[#060e1c] border rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-indigo-300/25 outline-none transition-colors ${horaFinInvalida ? "border-red-500/60 focus:border-red-400" : "border-white/10 focus:border-indigo-400/40"}`}
              />
              {horaFinInvalida && <p className="text-[9px] text-red-400">Formato HH:MM</p>}
            </div>
          </div>

          {/* ── RELEVO: ¿Por qué falta el titular? (descuento de días) ── */}
          {esRelevo && (
            <div className="space-y-1.5 border-t border-white/8 pt-2.5">
              <div className="flex items-center gap-1.5">
                <UserMinus className="w-3 h-3 text-red-400/60" />
                <label className="text-[10px] font-semibold text-white/55">¿Por qué falta el titular?</label>
                {motivoSeleccionado && (
                  <span className={`ml-auto text-[8px] px-1.5 py-0.5 rounded border font-semibold ${
                    motivoSeleccionado.grupo === "descuento"
                      ? "text-red-300 bg-red-500/10 border-red-500/30"
                      : "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
                  }`}>
                    {motivoSeleccionado.grupo === "descuento" ? "Con descuento" : "Sin descuento"}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {MOTIVOS_SALIDA.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    data-active={tipoNovedadTitular === t.value ? "" : undefined}
                    onClick={() => setTipoNovedadTitular(t.value)}
                    title={t.desc}
                    className={`px-2 py-1 rounded-md border text-[10px] font-semibold transition-all ${GRUPO_COLORS[t.grupo]} ${
                      tipoNovedadTitular === t.value ? "opacity-100 scale-[1.03]" : "opacity-60 hover:opacity-90"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {motivoSeleccionado && (
                <p className="text-[9px] text-white/40 leading-snug">{motivoSeleccionado.desc}</p>
              )}
            </div>
          )}

          {/* ── RELEVO + DESCANSO: ¿Cómo se pagan las HE? ── */}
          {aplicaHE && (
            <div className="space-y-1.5 border-t border-white/8 pt-2.5">
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-3 h-3 text-amber-400/60" />
                <label className="text-[10px] font-semibold text-white/55">¿Cómo se pagan las HE del cubriente?</label>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setModoPagoHE("planilla")}
                  className={`py-1.5 px-2 rounded-lg border text-[10px] font-semibold transition-all ${
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
                  className={`py-1.5 px-2 rounded-lg border text-[10px] font-semibold transition-all ${
                    modoPagoHE === "efectivo"
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                      : "border-white/10 text-white/35 hover:text-white/60"
                  }`}
                >
                  En Efectivo
                </button>
              </div>
              {modoPagoHE === "planilla" && (
                <p className="text-[9px] text-blue-300/50">Pasa por aprobación RRHH y se incluye en la próxima nómina.</p>
              )}
              {modoPagoHE === "efectivo" && (
                <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-lg p-2.5 space-y-2">
                  <div>
                    <label className="block text-[9px] text-white/40 mb-1">Monto a pagar (Q)</label>
                    <input
                      type="number"
                      min="1"
                      step="0.50"
                      value={montoEfectivo}
                      onChange={(e) => setMontoEfectivo(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-emerald-500/50"
                    />
                    {costoPorHora != null && (
                      <p className="text-[8px] text-white/25 mt-0.5">
                        Tarifa Q{costoPorHora.toFixed(2)}/h ({jornadaReal}){segMin > 0 ? ` · ${(segMin / 60).toFixed(1)}h` : ""}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[9px] text-white/40 mb-1">Pagado por</label>
                    <input
                      type="text"
                      placeholder="Nombre de quien entrega…"
                      value={pagadoPor}
                      onChange={(e) => setPagadoPor(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <p className="text-[9px] text-amber-300/60">Pago inmediato en campo. No aparecerá en planilla.</p>
                </div>
              )}
            </div>
          )}

          <input
            type="text"
            placeholder="Motivo (opcional)…"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/15 outline-none focus:border-indigo-400/30"
          />

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-white/10 text-xs text-white/40 hover:text-white transition-colors"
            >
              Cerrar
            </button>
            <button
              onClick={agregarSegmento}
              disabled={guardando || !empleadoSel}
              className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
            >
              {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Registrar tramo
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
