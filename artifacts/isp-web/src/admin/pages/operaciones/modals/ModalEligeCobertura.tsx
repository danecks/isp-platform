import { useState } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle, Clock, Shield, ShieldCheck, Building2, Layers, Timer } from "lucide-react";
import { toISODate } from "../utils";
import { Puesto, Agente, Pool, OldTitularAccion, MOTIVOS_TITULAR } from "../types";

export function ModalEligeCobertura({
  puesto,
  agente,
  onElegir,
  onCancel,
}: {
  puesto: Puesto;
  agente: Agente;
  onElegir: (soloCobertura: boolean, oldTitularAccion?: OldTitularAccion, fechaEfectiva?: string, motivoCambio?: string, horaInstalacion?: string) => void;
  onCancel: () => void;
}) {
  // Supervisores y jefes de servicio → siempre cobertura temporal, nunca titular
  const esContingencia = agente.tipo_personal === "supervisor" || agente.tipo_personal === "jefe_servicio";

  const hayTitularPrevio = !!puesto.titular_employee_id;
  const hoy = toISODate(new Date());
  const manana = toISODate(new Date(Date.now() + 86400000));

  const ahoraHHMM = () => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
  };

  // Para contingencia: saltar directamente al paso de hora (soloCobertura forzado)
  const [paso, setPaso] = useState<"elige" | "detalles" | "titularPrevio" | "horaInstalacion">(
    () => esContingencia ? "horaInstalacion" : "elige"
  );
  const [oldTitularAccion, setOldTitularAccion] = useState<OldTitularAccion>("disponible");
  const [opcionFecha, setOpcionFecha] = useState<"hoy" | "manana" | "personalizada">("hoy");
  const [fechaPersonalizada, setFechaPersonalizada] = useState(hoy);
  const [motivo, setMotivo] = useState("cobertura_definitiva");
  const [soloCoberturaPendiente, setSoloCoberturaPendiente] = useState(() => esContingencia);
  const [horaInstalacion, setHoraInstalacion] = useState(ahoraHHMM());

  const fechaEfectiva = opcionFecha === "hoy" ? hoy
    : opcionFecha === "manana" ? manana
    : fechaPersonalizada;

  function avanzarDesdeDetalles() {
    if (hayTitularPrevio) {
      setPaso("titularPrevio");
    } else {
      setPaso("horaInstalacion");
    }
  }

  function confirmarConHora() {
    onElegir(soloCoberturaPendiente, soloCoberturaPendiente ? undefined : oldTitularAccion,
             soloCoberturaPendiente ? undefined : fechaEfectiva,
             soloCoberturaPendiente ? undefined : motivo,
             horaInstalacion || undefined);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl">

        {/* Header */}
        <div className={`px-5 py-4 border-b ${esContingencia ? "border-orange-500/15 bg-orange-500/3" : "border-white/8"}`}>
          <div className="flex items-center gap-2">
            {esContingencia
              ? <ShieldCheck className="w-4 h-4 text-orange-400" />
              : <Layers className="w-4 h-4 text-primary" />}
            <h3 className="text-sm font-bold text-white flex-1">
              {esContingencia ? "Cobertura de contingencia" : "¿Cómo registrar esta asignación?"}
            </h3>
            <button
              onClick={onCancel}
              className="text-white/30 hover:text-white/70 transition-colors p-1 rounded-lg hover:bg-white/5"
              aria-label="Cancelar y cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-white/35 mt-1.5">
            <span className="text-white/60 font-medium">{agente.nombre_completo}</span>
            {" · "}
            <span className={esContingencia ? "text-orange-300/60" : "capitalize text-white/35"}>
              {esContingencia
                ? (agente.tipo_personal === "supervisor" ? "Supervisor" : "Jefe de Servicio")
                : (agente.tipo_asignacion_eoa?.replace("_", " ") ?? "pool")}
            </span>
          </p>
        </div>

        {/* ── Paso 1: Elige tipo ────────────────────────────────────────── */}
        {paso === "elige" && (
          <div className="p-5 space-y-3">
            <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 flex items-center gap-2">
              <Building2 className="w-3 h-3 text-white/25 shrink-0" />
              <span className="text-xs text-white/50">{puesto.cliente_nombre} · {puesto.nombre}</span>
              {hayTitularPrevio && puesto.titular_nombre && (
                <span className="ml-auto text-[10px] text-amber-400/70 shrink-0">Titular: {puesto.titular_nombre}</span>
              )}
            </div>

            <button
              onClick={() => { setSoloCoberturaPendiente(true); setHoraInstalacion(ahoraHHMM()); setPaso("horaInstalacion"); }}
              className="w-full text-left bg-amber-500/5 border border-amber-500/20 hover:border-amber-500/50 rounded-xl p-4 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                  <Timer className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white group-hover:text-amber-200 transition-colors">Solo cobertura temporal</p>
                  <p className="text-[11px] text-white/35 mt-0.5 leading-snug">
                    Cubre el puesto hoy. Su asignación base y el titular del puesto no cambian.
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setPaso("detalles")}
              className="w-full text-left bg-blue-500/5 border border-blue-500/20 hover:border-blue-500/50 rounded-xl p-4 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white group-hover:text-blue-200 transition-colors">Convertir en titular del puesto</p>
                  <p className="text-[11px] text-white/35 mt-0.5 leading-snug">
                    Asignación permanente. Queda registrado con fecha efectiva y motivo.
                  </p>
                </div>
              </div>
            </button>

            <button onClick={onCancel} className="w-full py-2 text-xs text-white/35 hover:text-white/60 transition-colors">
              Cancelar
            </button>
          </div>
        )}

        {/* ── Paso 2: Fecha efectiva + motivo ──────────────────────────── */}
        {paso === "detalles" && (
          <div className="p-5 space-y-4">
            {/* Fecha efectiva */}
            <div>
              <p className="text-xs font-semibold text-white/70 mb-2">¿Desde cuándo aplica esta titularidad?</p>
              <div className="space-y-1.5">
                {([
                  { val: "hoy",          label: "Desde hoy",             sub: hoy },
                  { val: "manana",       label: "Desde mañana",          sub: manana },
                  { val: "personalizada", label: "Fecha personalizada",   sub: null },
                ] as { val: "hoy"|"manana"|"personalizada"; label: string; sub: string|null }[]).map(({ val, label, sub }) => (
                  <button
                    key={val}
                    onClick={() => setOpcionFecha(val)}
                    className={`w-full text-left rounded-xl px-3 py-2.5 border transition-all flex items-center justify-between ${
                      opcionFecha === val ? "bg-blue-500/15 border-blue-500/40" : "border-white/8 hover:border-white/20"
                    }`}
                  >
                    <p className="text-xs font-medium text-white">{label}</p>
                    {sub && <p className="text-[10px] text-white/35">{sub}</p>}
                  </button>
                ))}
                {opcionFecha === "personalizada" && (
                  <input
                    type="date"
                    value={fechaPersonalizada}
                    min={hoy}
                    onChange={e => setFechaPersonalizada(e.target.value)}
                    className="w-full mt-1 rounded-xl px-3 py-2 border border-white/15 bg-[#0c1929] text-xs text-white focus:outline-none focus:border-blue-500/50"
                  />
                )}
              </div>
            </div>

            {/* Motivo */}
            <div>
              <p className="text-xs font-semibold text-white/70 mb-2">Motivo del cambio</p>
              <select
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 border border-white/15 bg-[#0c1929] text-xs text-white focus:outline-none focus:border-blue-500/50"
              >
                {MOTIVOS_TITULAR.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setPaso("elige")} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">
                Atrás
              </button>
              <button
                onClick={avanzarDesdeDetalles}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* ── Paso 3: ¿Qué hacemos con el titular previo? ──────────────── */}
        {paso === "titularPrevio" && (
          <div className="p-5 space-y-3">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-300">El puesto ya tiene un titular</p>
                <p className="text-[11px] text-amber-300/70 mt-0.5">
                  <span className="font-medium">{puesto.titular_nombre}</span> dejará de ser titular.
                  ¿A qué estado lo movemos?
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {([
                { val: "disponible",     label: "Mover a Disponibles",    desc: "Queda en el pool sin puesto fijo",    color: "green" },
                { val: "pool_relevo",    label: "Mover a Pool de relevos", desc: "Queda disponible para cubrir otros",  color: "purple" },
                { val: "sin_asignacion", label: "Dejar sin asignación",   desc: "Sin categoría activa por el momento", color: "gray" },
              ] as { val: OldTitularAccion; label: string; desc: string; color: string }[]).map(({ val, label, desc, color }) => (
                <button
                  key={val}
                  onClick={() => setOldTitularAccion(val)}
                  className={`w-full text-left rounded-xl p-3 border transition-all ${
                    oldTitularAccion === val
                      ? color === "green"   ? "bg-green-500/15 border-green-500/40"
                        : color === "purple" ? "bg-purple-500/15 border-purple-500/40"
                        : "bg-white/10 border-white/30"
                      : "border-white/8 hover:border-white/20"
                  }`}
                >
                  <p className="text-xs font-semibold text-white">{label}</p>
                  <p className="text-[10px] text-white/35 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setPaso("detalles")} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">
                Atrás
              </button>
              <button
                onClick={() => { setSoloCoberturaPendiente(false); setPaso("horaInstalacion"); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* ── Paso final: Hora de instalación ──────────────────────────── */}
        {paso === "horaInstalacion" && (
          <div className="p-5 space-y-4">
            {/* Banner de contingencia operativa */}
            {esContingencia && (
              <div className="flex items-start gap-2 bg-orange-500/8 border border-orange-500/20 rounded-xl px-3 py-2">
                <ShieldCheck className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-orange-300">Contingencia operativa</p>
                  <p className="text-[10px] text-orange-300/60 leading-snug">
                    {agente.tipo_personal === "supervisor" ? "Supervisor" : "Jefe de Servicio"} cubriendo temporalmente. No cambia titular del puesto. Se registrará con tipo <span className="font-mono">cobertura_{agente.tipo_personal}</span>.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-primary/60 shrink-0" />
              <div>
                <p className="text-xs text-white/70 font-medium">{agente.nombre_completo}</p>
                <p className="text-[10px] text-white/35">{puesto.cliente_nombre} · {puesto.nombre}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-white/80">¿A qué hora se instaló el servicio?</p>
              <p className="text-[11px] text-white/35 leading-snug">
                Esta hora se usa para calcular las horas reales trabajadas y detectar horas extra.
              </p>
              <input
                type="time"
                value={horaInstalacion}
                onChange={e => setHoraInstalacion(e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-3 text-base text-white text-center font-mono outline-none focus:border-primary/50 tracking-widest"
              />
              <p className="text-[10px] text-white/25 text-center">
                Turno {puesto.turno ?? "día"} — fin estimado: {(puesto.turno ?? "día").toLowerCase() === "noche" ? "06:00" : "18:00"}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              {esContingencia ? (
                <button
                  onClick={onCancel}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white/80 transition-colors"
                >
                  Cancelar
                </button>
              ) : (
                <button
                  onClick={() => setPaso(soloCoberturaPendiente ? "elige" : (hayTitularPrevio ? "titularPrevio" : "detalles"))}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors"
                >
                  Atrás
                </button>
              )}
              <button
                onClick={confirmarConHora}
                className={`py-2.5 rounded-xl text-sm font-bold text-white transition-colors ${esContingencia ? "flex-1 bg-orange-600 hover:bg-orange-500" : "flex-1 bg-primary hover:bg-primary/90"}`}
              >
                Confirmar cobertura →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Confirmar Sustitución / Asignación ────────────────────────────────

// ─── Catálogo de tipos de novedad ─────────────────────────────────────────────
