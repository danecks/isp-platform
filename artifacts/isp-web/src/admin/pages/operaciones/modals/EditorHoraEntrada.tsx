import { useState, useMemo, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { horaDelDiaSlot, horaSemanaSlot, semanasCiclo } from "../utils";

type Modo = "igual" | "semana" | "dia";

interface Props {
  longitudCiclo: number;
  horasTurno: number;
  diasTrabajo: number[];
  horaEntrada: string;
  horasPorSemana: string[] | null;
  horasPorDia: Record<string, string> | null;
  disabled?: boolean;
  // Patch parcial; el padre decide si lo aplica solo en memoria o lo persiste.
  onChange: (patch: {
    hora_entrada?: string;
    hora_entrada_por_semana?: string[] | null;
    hora_entrada_por_dia?: Record<string, string> | null;
  }) => void;
  // Si se provee, se invoca al "soltar" un input (onBlur) para persistir al backend.
  onCommit?: (patch: {
    hora_entrada?: string;
    hora_entrada_por_semana?: string[] | null;
    hora_entrada_por_dia?: Record<string, string> | null;
  }) => void;
}

const NOMBRE_DIA = ["L", "M", "X", "J", "V", "S", "D"];

function calcSalida(horaEntrada: string, horasTurno: number): string {
  const [hh, mm] = (horaEntrada || "00:00").split(":").map(Number);
  if (isNaN(hh) || isNaN(mm)) return "—";
  const totalMin = hh * 60 + mm + horasTurno * 60;
  const sh = Math.floor(totalMin / 60) % 24;
  const sm = totalMin % 60;
  const overflow = totalMin >= 24 * 60;
  return `${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}${overflow ? " +1d" : ""}`;
}

function modoDerivado(props: Props): Modo {
  const hpd = props.horasPorDia;
  if (hpd && Object.keys(hpd).length > 0) return "dia";
  if (Array.isArray(props.horasPorSemana) && props.horasPorSemana.length > 0) return "semana";
  return "igual";
}

export function EditorHoraEntrada(props: Props) {
  const { longitudCiclo, horasTurno, diasTrabajo, horaEntrada, horasPorSemana, horasPorDia, disabled, onChange, onCommit } = props;
  const derivado = modoDerivado(props);
  // Permitimos que el usuario fuerce el modo "día" aunque el mapa esté vacío
  // (de lo contrario el botón "Por día" parecería no funcionar al primer clic).
  const [modoLocal, setModoLocal] = useState<Modo>(derivado);
  // Si los props cambian a un modo definitivo (con datos), sincronizamos.
  useEffect(() => { setModoLocal(derivado); }, [derivado]);
  const modo = modoLocal;
  const [agregando, setAgregando] = useState(false);

  const semanas = Math.ceil(longitudCiclo / 7);

  // Días con excepción ya configurada (ordenados ascendente)
  const diasConExcepcion = useMemo(() => {
    if (!horasPorDia) return [];
    return Object.keys(horasPorDia).map(Number).filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  }, [horasPorDia]);

  // Días candidatos para agregar excepción: sólo días de trabajo que aún no tienen una.
  const diasDisponiblesParaExcepcion = useMemo(() => {
    const conExc = new Set(diasConExcepcion);
    return [...diasTrabajo].filter(d => !conExc.has(d)).sort((a, b) => a - b);
  }, [diasTrabajo, diasConExcepcion]);

  function cambiarModo(nuevo: Modo) {
    if (nuevo === modo) return;
    setModoLocal(nuevo);
    setAgregando(false);
    if (nuevo === "igual") {
      onChange({ hora_entrada_por_semana: null, hora_entrada_por_dia: null });
      // Solo persistir si había algo activo; si ya estaba todo limpio, no hace falta hit al backend.
      if ((horasPorSemana && horasPorSemana.length) || (horasPorDia && Object.keys(horasPorDia).length)) {
        onCommit?.({ hora_entrada_por_semana: null, hora_entrada_por_dia: null });
      }
    } else if (nuevo === "semana") {
      const nuevasHps = Array.from({ length: semanas }, (_, i) =>
        horasPorSemana?.[i] || horaEntrada || "07:00"
      );
      onChange({ hora_entrada_por_semana: nuevasHps, hora_entrada_por_dia: null });
      onCommit?.({ hora_entrada_por_semana: nuevasHps, hora_entrada_por_dia: null });
    } else {
      // → "dia": NO persistir aún (el mapa está vacío y el backend lo rechazaría
      // como "ningún cambio útil"). Solo limpiamos por_semana si estaba activo.
      // El primer commit ocurre cuando el usuario agrega su primera excepción.
      if (horasPorSemana && horasPorSemana.length > 0) {
        onChange({ hora_entrada_por_semana: null });
        onCommit?.({ hora_entrada_por_semana: null });
      }
    }
  }

  function commitHoraBase(val: string) {
    onChange({ hora_entrada: val });
    if (val !== horaEntrada) onCommit?.({ hora_entrada: val });
  }

  function commitHoraSemana(idx: number, val: string) {
    const nuevasHps = Array.from({ length: semanas }, (_, i) =>
      i === idx ? val : (horasPorSemana?.[i] || horaEntrada || "07:00")
    );
    onChange({ hora_entrada_por_semana: nuevasHps });
    onCommit?.({ hora_entrada_por_semana: nuevasHps });
  }

  function commitHoraDia(dia: number, val: string) {
    const nuevo: Record<string, string> = { ...(horasPorDia || {}) };
    if (val) nuevo[String(dia)] = val;
    else delete nuevo[String(dia)];
    onChange({ hora_entrada_por_dia: Object.keys(nuevo).length ? nuevo : {} });
    onCommit?.({ hora_entrada_por_dia: Object.keys(nuevo).length ? nuevo : {} });
  }

  function agregarExcepcion(dia: number) {
    // Default = hora efectiva actual (semana o base) para que el usuario sólo modifique.
    const horaActual = horaSemanaSlot({ hora_entrada_por_semana: horasPorSemana, hora_entrada: horaEntrada }, Math.floor((dia - 1) / 7));
    commitHoraDia(dia, horaActual || horaEntrada || "07:00");
    setAgregando(false);
  }

  return (
    <div className="space-y-2">
      {/* Selector de modo */}
      <div className="flex items-center gap-1 pl-7">
        <span className="text-[9px] text-white/30 mr-1">Hora entrada:</span>
        {(["igual", "semana", "dia"] as Modo[]).map(m => (
          <button
            key={m}
            type="button"
            disabled={disabled}
            onClick={() => cambiarModo(m)}
            className={`text-[9px] px-2 py-1 rounded border transition-colors ${
              modo === m
                ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-200"
                : "bg-white/3 border-white/10 text-white/40 hover:text-white/70"
            }`}
            title={
              m === "igual" ? "Misma hora todos los días" :
              m === "semana" ? "Una hora distinta por semana del ciclo" :
              "Excepciones puntuales por día"
            }
          >
            {m === "igual" ? "Igual" : m === "semana" ? "Por semana" : "Por día"}
          </button>
        ))}
      </div>

      {/* Modo igual: una sola hora */}
      {modo === "igual" && (
        <div className="flex items-center gap-1.5 pl-7">
          <input
            type="time"
            value={horaEntrada}
            disabled={disabled}
            onChange={e => onChange({ hora_entrada: e.target.value })}
            onBlur={e => commitHoraBase(e.target.value)}
            className="bg-[#0d1e38] border border-white/10 text-white/60 text-[10px] rounded px-1.5 py-0.5 focus:outline-none focus:border-indigo-500/40 w-[68px]"
          />
          <span className="text-[8px] text-white/20">→</span>
          <span className="text-[9px] text-white/35 font-mono">{calcSalida(horaEntrada, horasTurno)}</span>
        </div>
      )}

      {/* Modo semana: una fila horizontal con un input por semana del ciclo */}
      {modo === "semana" && (
        <div className="flex items-center gap-2 flex-wrap pl-7">
          {semanasCiclo(longitudCiclo).map((_sem, si) => {
            const horaSem = horasPorSemana?.[si] || horaEntrada || "07:00";
            return (
              <div key={si} className="flex items-center gap-1 bg-white/3 border border-white/8 rounded px-1.5 py-0.5">
                <span className="text-[8px] text-white/35 font-medium">S{si + 1}</span>
                <input
                  type="time"
                  value={horaSem}
                  disabled={disabled}
                  onChange={e => {
                    const nuevasHps = Array.from({ length: semanas }, (_, i) =>
                      i === si ? e.target.value : (horasPorSemana?.[i] || horaEntrada || "07:00")
                    );
                    onChange({ hora_entrada_por_semana: nuevasHps });
                  }}
                  onBlur={e => commitHoraSemana(si, e.target.value)}
                  className="bg-transparent border-0 text-white/70 text-[10px] focus:outline-none w-[60px] p-0"
                  title={`Semana ${si + 1}: entra ${horaSem} → sale ${calcSalida(horaSem, horasTurno)}`}
                />
                <span className="text-[8px] text-white/30 font-mono">→ {calcSalida(horaSem, horasTurno)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Modo día: lista de excepciones puntuales sobre la hora base */}
      {modo === "dia" && (
        <div className="space-y-1.5 pl-7">
          {/* Banner explicativo + hora base de referencia (read-only aquí; se edita en "Igual") */}
          <div className="rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 space-y-1">
            <p className="text-[9px] text-amber-200/80 leading-snug">
              Marcá días que entran a una hora distinta de la habitual. Los demás días usan la hora base.
            </p>
            <p className="text-[9px] text-white/45">
              Hora base: <span className="font-mono text-white/70">{horaEntrada || "—"}</span>
              <span className="text-white/25"> (cambiala en la pestaña «Igual»)</span>
            </p>
          </div>

          {/* Excepciones */}
          {diasConExcepcion.length === 0 && (
            <p className="text-[9px] text-white/30 italic">Aún no hay excepciones cargadas.</p>
          )}
          {diasConExcepcion.map(dia => {
            const semIdx = Math.floor((dia - 1) / 7);
            const diaEnSem = ((dia - 1) % 7);
            const horaDia = horasPorDia?.[String(dia)] || horaEntrada || "07:00";
            return (
              <div key={dia} className="flex items-center gap-1.5">
                <span className="text-[9px] text-amber-300/70 w-14 shrink-0 font-mono">
                  D{dia} · S{semIdx + 1}-{NOMBRE_DIA[diaEnSem]}
                </span>
                <input
                  type="time"
                  value={horaDia}
                  disabled={disabled}
                  onChange={e => {
                    const nuevo: Record<string, string> = { ...(horasPorDia || {}) };
                    nuevo[String(dia)] = e.target.value;
                    onChange({ hora_entrada_por_dia: nuevo });
                  }}
                  onBlur={e => commitHoraDia(dia, e.target.value)}
                  className="bg-[#0d1e38] border border-amber-500/30 text-amber-100/90 text-[10px] rounded px-1.5 py-0.5 focus:outline-none focus:border-amber-400/60 w-[68px]"
                />
                <span className="text-[8px] text-white/20">→</span>
                <span className="text-[9px] text-white/35 font-mono">{calcSalida(horaDia, horasTurno)}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => commitHoraDia(dia, "")}
                  className="p-0.5 text-white/20 hover:text-red-400 transition-colors"
                  title="Quitar excepción"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* Agregar excepción */}
          {diasDisponiblesParaExcepcion.length > 0 && (
            agregando ? (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[9px] text-white/40">Día:</span>
                {diasDisponiblesParaExcepcion.map(d => {
                  const semIdx = Math.floor((d - 1) / 7);
                  const dEnSem = (d - 1) % 7;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => agregarExcepcion(d)}
                      className="text-[9px] px-1.5 py-0.5 rounded border border-white/10 bg-white/3 text-white/60 hover:bg-indigo-500/15 hover:border-indigo-500/40 hover:text-indigo-200"
                      title={`Día ${d} (S${semIdx + 1}-${NOMBRE_DIA[dEnSem]})`}
                    >
                      D{d}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setAgregando(false)}
                  className="text-[9px] px-1.5 py-0.5 text-white/30 hover:text-white/60"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onClick={() => setAgregando(true)}
                className="flex items-center gap-1 text-[9px] px-2 py-1 rounded border border-dashed border-amber-500/30 text-amber-300/70 hover:bg-amber-500/5 hover:border-amber-500/50"
              >
                <Plus className="w-3 h-3" />
                Agregar excepción
              </button>
            )
          )}
        </div>
      )}

      {/* Etiqueta por día (sólo en modo "día") debajo de cada día del grid: la pinta el padre con horaDelDiaSlot. */}
    </div>
  );
}

// Re-export del helper para conveniencia (el padre puede importar desde aquí o desde utils).
export { horaDelDiaSlot } from "../utils";
