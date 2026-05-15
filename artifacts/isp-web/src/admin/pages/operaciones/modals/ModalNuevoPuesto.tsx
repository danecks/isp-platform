import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { API_BASE, getSession } from "../utils";
import { Puesto, ClienteBoard, ClienteDisponible, TurnoApiItem } from "../types";

export function ModalNuevoPuesto({
  clientePreseleccionado,
  clientes,
  onSave,
  onClose,
}: {
  clientePreseleccionado?: ClienteBoard;
  clientes: ClienteDisponible[];
  onSave: (data: {
    clienteId: number | null;
    clienteNombre: string;
    nombre: string;
    turno: string;
    notas: string;
    tipoTurnoId: number;
    fechaInicioCiclo: string;
    zonaOperativaId: number;
    tipoPuesto: "normal" | "custodia";
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [clienteId, setClienteId]     = useState<string>(clientePreseleccionado?.clienteId?.toString() ?? "");
  const [clienteNombreCustom, setClienteNombreCustom] = useState(clientePreseleccionado?.clienteNombre ?? "");
  const [nombre, setNombre]           = useState("");
  const [notas, setNotas]             = useState("");
  const [tipoTurnoId, setTipoTurnoId] = useState<string>("");
  const [zonaId, setZonaId]           = useState<string>("");
  const [tipoPuesto, setTipoPuesto]   = useState<"normal" | "custodia">("normal");
  const hoy = new Date().toISOString().split("T")[0];
  const [fechaInicioCiclo, setFechaInicioCiclo] = useState<string>(hoy);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  // Cargar catálogo de turnos
  const { data: turnosCatalogo = [], isLoading: cargandoTurnos } = useQuery<TurnoApiItem[]>({
    queryKey: ["turnos-catalogo"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/turnos`, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error("Error al cargar turnos");
      return r.json();
    },
  });

  // Cargar catálogo de zonas
  const { data: zonasCatalogo = [], isLoading: cargandoZonas } = useQuery<{ id: number; nombre: string }[]>({
    queryKey: ["zonas-catalogo"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/operaciones/zonas`, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error("Error al cargar zonas");
      const data = await r.json();
      return Array.isArray(data) ? data : (data.zonas ?? []);
    },
  });

  // Resolver nombre del cliente seleccionado
  const clienteSeleccionado = clientes.find((c) => c.id.toString() === clienteId);
  const clienteNombreFinal  = clienteSeleccionado
    ? (clienteSeleccionado.nombre_comercial || clienteSeleccionado.nombre)
    : clienteNombreCustom;

  const turnoSeleccionado = turnosCatalogo.find(t => String(t.id) === tipoTurnoId) ?? null;

  async function handleSave() {
    if (!nombre.trim()) { setError("El nombre del puesto es requerido."); return; }
    if (!clienteNombreFinal.trim()) { setError("Selecciona o escribe un cliente."); return; }
    if (!tipoTurnoId) { setError("Debes seleccionar un tipo de turno."); return; }
    if (!zonaId) { setError("Debes asignar una zona operativa al puesto."); return; }
    if (!fechaInicioCiclo) { setError("La fecha de inicio del ciclo es requerida."); return; }
    setLoading(true);
    setError("");
    try {
      await onSave({
        clienteId: clienteId ? parseInt(clienteId) : null,
        clienteNombre: clienteNombreFinal,
        nombre: nombre.trim(),
        turno: turnoSeleccionado?.nombre ?? "día",
        notas,
        tipoTurnoId: parseInt(tipoTurnoId),
        fechaInicioCiclo,
        zonaOperativaId: parseInt(zonaId),
        tipoPuesto,
      });
      onClose();
    } catch (e: any) {
      setError(e.error ?? e.message ?? "Error al crear puesto");
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-white">Nuevo Puesto</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 text-xs text-red-400">{error}</div>
          )}
          <div className="space-y-1">
            <label className="text-xs text-white/40">Cliente</label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
            >
              <option value="">— Escribir manualmente —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre_comercial || c.nombre}</option>
              ))}
            </select>
          </div>
          {!clienteId && (
            <div className="space-y-1">
              <label className="text-xs text-white/40">Nombre del cliente (manual)</label>
              <input
                type="text"
                value={clienteNombreCustom}
                onChange={(e) => setClienteNombreCustom(e.target.value)}
                placeholder="Nombre del cliente…"
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs text-white/40">Nombre del puesto <span className="text-rose-400">*</span></label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Garita Principal, Recepción…"
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
            />
          </div>

          {/* Tipo de turno — requerido */}
          <div className="space-y-1">
            <label className="text-xs text-white/40">
              Tipo de turno <span className="text-rose-400">*</span>
            </label>
            {cargandoTurnos ? (
              <div className="flex items-center gap-2 text-xs text-white/30 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando turnos…
              </div>
            ) : (
              <select
                value={tipoTurnoId}
                onChange={(e) => setTipoTurnoId(e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
              >
                <option value="">— Selecciona un turno —</option>
                {turnosCatalogo.filter(t => t.id).map(t => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} · {t.ciclo_horas}h ({t.tipo_ciclo})
                  </option>
                ))}
              </select>
            )}
            {turnoSeleccionado && (
              <p className="text-[10px] text-indigo-300/50 mt-1">
                {turnoSeleccionado.horas_trabajo}h trabajo / {turnoSeleccionado.horas_descanso}h descanso
                {turnoSeleccionado.tipo_ciclo === "alternado" ? " · ciclo alternado" : " · ciclo diario"}
              </p>
            )}
          </div>

          {/* Zona operativa — obligatoria */}
          <div className="space-y-1">
            <label className="text-xs text-white/40">
              Zona operativa <span className="text-rose-400">*</span>
            </label>
            {cargandoZonas ? (
              <div className="flex items-center gap-2 text-xs text-white/30 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando zonas…
              </div>
            ) : zonasCatalogo.length === 0 ? (
              <p className="text-xs text-amber-400/70 py-1">
                No hay zonas creadas. Crea una zona operativa primero.
              </p>
            ) : (
              <select
                value={zonaId}
                onChange={(e) => setZonaId(e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 appearance-none"
              >
                <option value="">— Selecciona una zona —</option>
                {zonasCatalogo.map((z) => (
                  <option key={z.id} value={z.id}>{z.nombre}</option>
                ))}
              </select>
            )}
          </div>

          {/* Fecha de inicio del ciclo */}
          <div className="space-y-1">
            <label className="text-xs text-white/40">
              Fecha inicio del ciclo <span className="text-rose-400">*</span>
            </label>
            <input
              type="date"
              value={fechaInicioCiclo}
              onChange={(e) => setFechaInicioCiclo(e.target.value)}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
            />
            <p className="text-[10px] text-white/25">
              Fecha desde la que el ciclo de turno empieza a contar.
            </p>
          </div>

          {/* Tipo de puesto */}
          <div className="space-y-1">
            <label className="text-xs text-white/40">Tipo de puesto</label>
            <div className="grid grid-cols-2 gap-2">
              {(["normal", "custodia"] as const).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setTipoPuesto(tipo)}
                  className={`py-2 rounded-lg border text-xs font-medium transition-all ${
                    tipoPuesto === tipo
                      ? tipo === "custodia"
                        ? "bg-amber-500/15 border-amber-400/40 text-amber-300"
                        : "bg-indigo-500/15 border-indigo-400/40 text-indigo-300"
                      : "bg-white/3 border-white/8 text-white/40 hover:text-white/70"
                  }`}
                >
                  {tipo === "normal" ? "Operativo normal" : "Custodia"}
                </button>
              ))}
            </div>
            {tipoPuesto === "custodia" && (
              <p className="text-[10px] text-amber-400/60 mt-1">
                Este puesto aparecerá en el módulo de Custodios con su estado operativo.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/40">Notas (opcional)</label>
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Instrucciones especiales…"
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !tipoTurnoId || !zonaId}
              className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-sm font-bold text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Crear puesto
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Liberar agente ────────────────────────────────────────────────────

