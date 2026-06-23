import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, Target } from "lucide-react";
import { apiRequest, apiPost, ApiError } from "@/lib/httpClient";
import { useToast } from "@/hooks/use-toast";

const API = "/api";

interface MunicionPuesto {
  id: number;
  puesto_id: number;
  descripcion: string;
  cantidad_asignada: number;
  activo: boolean;
  updated_at: string | null;
  puesto_nombre: string;
  cliente_nombre: string | null;
}

interface PuestoOpcion {
  id: number;
  nombre: string;
  cliente_nombre: string;
}

export function TabMunicion() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: municiones = [], isLoading } = useQuery<MunicionPuesto[]>({
    queryKey: ["municion-puestos"],
    queryFn: () => apiRequest<MunicionPuesto[]>(`${API}/municion-puestos`),
  });

  const { data: puestos = [] } = useQuery<PuestoOpcion[]>({
    queryKey: ["armas-puestos"],
    queryFn: () => apiRequest<PuestoOpcion[]>(`${API}/armas/puestos/disponibles`),
  });

  const [form, setForm] = useState<{ puesto_id: string; descripcion: string; cantidad: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState<number | null>(null);

  function refrescar() {
    qc.invalidateQueries({ queryKey: ["municion-puestos"] });
  }

  async function guardar() {
    if (!form) return;
    setGuardando(true);
    try {
      await apiPost(`${API}/municion-puestos`, {
        puesto_id: Number(form.puesto_id),
        descripcion: form.descripcion,
        cantidad_asignada: Number(form.cantidad),
      });
      setForm(null);
      refrescar();
      toast({ title: "Munición guardada" });
    } catch (e: unknown) {
      const msg = e instanceof ApiError ? (e.body as { error?: string })?.error : undefined;
      toast({ title: msg || "No se pudo guardar la munición", variant: "destructive" });
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: number) {
    if (!confirm("¿Quitar la munición asignada a este puesto?")) return;
    setEliminando(id);
    try {
      await apiRequest(`${API}/municion-puestos/${id}`, { method: "DELETE" });
      refrescar();
      toast({ title: "Munición eliminada" });
    } catch (e: unknown) {
      const msg = e instanceof ApiError ? (e.body as { error?: string })?.error : undefined;
      toast({ title: msg || "No se pudo eliminar la munición", variant: "destructive" });
    } finally {
      setEliminando(null);
    }
  }

  // Agrupado por cliente
  const porCliente = new Map<string, MunicionPuesto[]>();
  for (const m of municiones) {
    const cli = m.cliente_nombre || "Sin cliente";
    if (!porCliente.has(cli)) porCliente.set(cli, []);
    porCliente.get(cli)!.push(m);
  }

  return (
    <div className="px-4 md:px-6 pb-8">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {municiones.length} puesto{municiones.length !== 1 ? "s" : ""} con munición asignada
        </p>
        <button
          onClick={() => setForm({ puesto_id: "", descripcion: "9mm Luger", cantidad: "" })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/15 hover:bg-amber-600/25 border border-amber-500/25 rounded-lg text-xs text-amber-300 font-semibold transition-colors">
          <Plus className="w-3.5 h-3.5" /> Asignar munición a puesto
        </button>
      </div>

      {form && (
        <div className="bg-gray-800/40 border border-amber-500/20 rounded-2xl p-4 mb-4 space-y-3 max-w-xl">
          <p className="text-amber-300/70 text-xs font-semibold uppercase tracking-wide">Asignación de munición</p>
          <select
            value={form.puesto_id}
            onChange={e => setForm(prev => prev ? { ...prev, puesto_id: e.target.value } : prev)}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-amber-500 [&_option]:bg-slate-800">
            <option value="">Seleccionar puesto…</option>
            {puestos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre} · {p.cliente_nombre}</option>
            ))}
          </select>
          <input
            value={form.descripcion}
            onChange={e => setForm(prev => prev ? { ...prev, descripcion: e.target.value } : prev)}
            placeholder="Tipo de munición (ej: 9mm Luger)"
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-amber-500" />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={form.cantidad}
              onChange={e => setForm(prev => prev ? { ...prev, cantidad: e.target.value } : prev)}
              placeholder="Cantidad asignada"
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-amber-500" />
            <span className="text-gray-500 text-xs shrink-0">cartuchos</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setForm(null)}
              className="flex-1 py-2 bg-gray-700/40 border border-gray-700 rounded-xl text-sm text-gray-400 transition-colors hover:bg-gray-700/60">
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={guardando || !form.puesto_id || !form.cantidad}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-600/15 hover:bg-amber-600/25 border border-amber-500/25 rounded-xl text-sm text-amber-300 font-semibold transition-colors disabled:opacity-50">
              {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Guardar
            </button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-gray-500 text-sm text-center py-8">Cargando…</p>}
      {!isLoading && municiones.length === 0 && (
        <p className="text-gray-600 text-sm text-center py-12">
          Sin puestos con munición asignada. Usa el botón de arriba para asignar.
        </p>
      )}

      <div className="space-y-5">
        {Array.from(porCliente.entries()).map(([cliente, items]) => (
          <div key={cliente}>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px flex-1 bg-gray-800" />
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                <span className="text-amber-300/80 text-xs font-bold tracking-wide uppercase">{cliente}</span>
                <span className="text-gray-500 text-xs">{items.length} puesto{items.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="h-px flex-1 bg-gray-800" />
            </div>
            <div className="space-y-2 pl-3 border-l border-amber-500/10">
              {items.map(m => (
                <div key={m.id} className="bg-gray-800/30 border border-amber-500/10 rounded-xl p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-amber-200/80 text-sm font-semibold">{m.puesto_nombre}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <Target className="w-3.5 h-3.5 text-amber-400/60" />
                      <span className="text-white/80 text-sm font-mono font-semibold">{m.cantidad_asignada}</span>
                      <span className="text-gray-500 text-xs">cartuchos</span>
                      <span className="text-gray-400 text-xs">{m.descripcion}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setForm({ puesto_id: String(m.puesto_id), descripcion: m.descripcion, cantidad: String(m.cantidad_asignada) })}
                      title="Editar"
                      className="p-1.5 bg-gray-700/40 hover:bg-gray-700/60 border border-gray-700 rounded-lg transition-colors text-gray-400 hover:text-gray-200">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => eliminar(m.id)}
                      disabled={eliminando === m.id}
                      title="Quitar"
                      className="p-1.5 bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 rounded-lg transition-colors text-red-400/60 hover:text-red-400 disabled:opacity-50">
                      {eliminando === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
