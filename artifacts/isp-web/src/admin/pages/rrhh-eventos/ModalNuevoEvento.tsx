import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { CheckCircle2, Loader2, Plus, XCircle } from "lucide-react";
import { getSessionToken } from "@/lib/httpClient";
import { API } from "./helpers";
import { TIPOS_EVENTO } from "./constants";

export function ModalNuevoEvento({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: {
    employeeId: number;
    tipoEvento: string;
    fechaInicio: string;
    fechaFin?: string;
    notas?: string;
  }) => Promise<void>;
}) {
  const [employeeId, setEmployeeId]     = useState<string>("");
  const [tipoEvento, setTipoEvento]     = useState<string>("falta");
  const [fechaInicio, setFechaInicio]   = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [fechaFin, setFechaFin]         = useState<string>("");
  const [notas, setNotas]               = useState<string>("");
  const [loading, setLoading]           = useState(false);
  const [busEmpleado, setBusEmpleado]   = useState("");

  const { data: empleados = [] } = useQuery<Array<{ id: number; nombreCompleto: string; dpi?: string }>>({
    queryKey: ["empleados-activos"],
    queryFn: async () => {
      const r = await fetch(`${API}/employees?estado=activo&limit=300`, {
        headers: { "x-isp-session": getSessionToken() },
      });
      if (!r.ok) throw new Error("Error cargando empleados");
      return r.json();
    },
    staleTime: 60_000,
  });

  const empFiltrados = empleados.filter((e) =>
    !busEmpleado ||
    (e.nombreCompleto ?? "").toLowerCase().includes(busEmpleado.toLowerCase()) ||
    String(e.dpi ?? "").includes(busEmpleado)
  );

  const empleadoSeleccionado = empleados.find((e) => String(e.id) === employeeId);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!employeeId) return;
    setLoading(true);
    try {
      await onCreate({
        employeeId: Number(employeeId),
        tipoEvento,
        fechaInicio,
        fechaFin: fechaFin || undefined,
        notas: notas.trim() || undefined,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-purple-500/40 transition-colors";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-purple-500/20 rounded-2xl w-full max-w-md shadow-2xl">

        <div className="px-5 py-4 border-b border-purple-500/10 bg-purple-500/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white">Nuevo evento RRHH</h3>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50">
              Empleado <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="Filtrar por nombre o DPI..."
              value={busEmpleado}
              onChange={(e) => { setBusEmpleado(e.target.value); setEmployeeId(""); }}
              className={inputCls}
            />
            <select
              value={employeeId}
              onChange={(e) => {
                const val = e.target.value;
                setEmployeeId(val);
                const emp = empleados.find((em) => String(em.id) === val);
                if (emp) setBusEmpleado(emp.nombreCompleto);
              }}
              className={inputCls + " appearance-none mt-1.5" + (employeeId ? " border-purple-500/40" : "")}
              required
            >
              <option value="">
                {empFiltrados.length === 0 && busEmpleado
                  ? "Sin resultados — cambia el filtro"
                  : "-- Seleccionar empleado --"}
              </option>
              {empFiltrados.slice(0, 30).map((emp) => (
                <option key={emp.id} value={String(emp.id)}>
                  {emp.nombreCompleto}{emp.dpi ? ` · ${emp.dpi}` : ""}
                </option>
              ))}
            </select>
            {empleadoSeleccionado ? (
              <p className="text-[11px] text-purple-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {empleadoSeleccionado.nombreCompleto}
              </p>
            ) : (
              <p className="text-[11px] text-white/25 mt-1">
                Filtra por nombre arriba y selecciona del menú
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50">
              Tipo de evento <span className="text-red-400">*</span>
            </label>
            <select
              value={tipoEvento}
              onChange={(e) => setTipoEvento(e.target.value)}
              className={inputCls + " appearance-none"}
              required
            >
              {TIPOS_EVENTO.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50">
                Fecha inicio <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className={inputCls + " [color-scheme:dark]"}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50">Fecha fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                min={fechaInicio}
                className={inputCls + " [color-scheme:dark]"}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50">Notas / observaciones</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Descripción del evento, testigos, contexto..."
              rows={3}
              className={inputCls + " resize-none"}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !employeeId || !tipoEvento || !fechaInicio}
              className="flex-1 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-sm font-bold text-white transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <Plus className="w-3.5 h-3.5" />
              Registrar evento
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
