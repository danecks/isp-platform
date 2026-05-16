/**
 * ESCENARIOS DEL SIMULADOR — Panel admin (CRUD)
 *
 * Permite añadir / editar / activar / eliminar los botones de "escenarios
 * rápidos" que aparecen sobre el input del simulador de WhatsApp. Usa los
 * endpoints `/api/simulador/escenarios`.
 */

import { useEffect, useState } from "react";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { Plus, Save, Trash2, X, RefreshCw, ToggleLeft, ToggleRight, GripVertical } from "lucide-react";
import { API } from "./constants";
import type { QuickScenario } from "./types";

type Grupo = "interno" | "externo" | "dpi";

const GRUPO_LABELS: Record<Grupo, string> = {
  interno: "Internos (registrado)",
  externo: "Externos (número desconocido)",
  dpi:     "Flujo DPI (respuestas rápidas)",
};

const COLOR_PRESETS = [
  "bg-yellow-500/10 border-yellow-500/30 text-yellow-300",
  "bg-red-500/10 border-red-500/30 text-red-300",
  "bg-orange-500/10 border-orange-500/30 text-orange-300",
  "bg-teal-500/10 border-teal-500/30 text-teal-300",
  "bg-green-500/10 border-green-500/30 text-green-300",
  "bg-blue-500/10 border-blue-500/30 text-blue-300",
  "bg-indigo-500/10 border-indigo-500/30 text-indigo-300",
  "bg-purple-500/10 border-purple-500/30 text-purple-300",
  "bg-amber-500/10 border-amber-500/30 text-amber-300",
  "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
  "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  "bg-gray-500/10 border-gray-500/30 text-gray-300",
];

interface DraftScenario {
  id: number | null;
  grupo: Grupo;
  label: string;
  icono: string;
  mensaje: string;
  color: string;
  skipValidacion: boolean;
  activo: boolean;
  orden: number;
}

const EMPTY_DRAFT: DraftScenario = {
  id: null,
  grupo: "interno",
  label: "",
  icono: "",
  mensaje: "",
  color: COLOR_PRESETS[0],
  skipValidacion: false,
  activo: true,
  orden: 0,
};

export default function EscenariosAdmin() {
  const [rows, setRows] = useState<QuickScenario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftScenario | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  async function cargar() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/simulador/escenarios?all=1`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setError("No se pudieron cargar los escenarios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function guardar(d: DraftScenario) {
    if (!d.label.trim() || !d.mensaje.trim()) {
      setError("Etiqueta y mensaje son obligatorios");
      return;
    }
    setError(null);
    const payload = {
      grupo: d.grupo,
      label: d.label.trim(),
      icono: d.icono,
      mensaje: d.mensaje.trim(),
      color: d.color,
      skipValidacion: d.skipValidacion,
      activo: d.activo,
      orden: d.orden,
    };
    const url = d.id == null
      ? `${API}/simulador/escenarios`
      : `${API}/simulador/escenarios/${d.id}`;
    const method = d.id == null ? "POST" : "PUT";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Error al guardar");
      return;
    }
    setDraft(null);
    cargar();
  }

  async function eliminar(id: number) {
    if (!confirm("¿Eliminar este escenario? Esta acción no se puede deshacer.")) return;
    const res = await fetch(`${API}/simulador/escenarios/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Error al eliminar");
      return;
    }
    cargar();
  }

  async function toggleActivo(row: QuickScenario) {
    const res = await fetch(`${API}/simulador/escenarios/${row.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !row.activo }),
    });
    if (res.ok) cargar();
  }

  async function reordenar(grupo: Grupo, draggedId: number, targetId: number) {
    if (draggedId === targetId) return;
    const items = rows
      .filter(r => r.grupo === grupo)
      .sort((a, b) => a.orden - b.orden || a.id - b.id);
    const fromIdx = items.findIndex(r => r.id === draggedId);
    const toIdx = items.findIndex(r => r.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = items.slice();
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);

    // Asignar órdenes secuenciales 10, 20, 30, ... y detectar cambios
    const updates: { id: number; orden: number }[] = [];
    const nextById = new Map<number, number>();
    next.forEach((r, i) => {
      const newOrden = (i + 1) * 10;
      nextById.set(r.id, newOrden);
      if (r.orden !== newOrden) updates.push({ id: r.id, orden: newOrden });
    });
    if (updates.length === 0) return;

    // Optimista
    setRows(prev => prev.map(r =>
      r.grupo === grupo && nextById.has(r.id)
        ? { ...r, orden: nextById.get(r.id)! }
        : r,
    ));

    try {
      const results = await Promise.all(updates.map(u =>
        fetch(`${API}/simulador/escenarios/${u.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orden: u.orden }),
        }),
      ));
      if (results.some(r => !r.ok)) {
        setError("Error al guardar el nuevo orden");
        cargar();
      }
    } catch {
      setError("Error al guardar el nuevo orden");
      cargar();
    }
  }

  function startEdit(row: QuickScenario) {
    setDraft({
      id: row.id,
      grupo: row.grupo,
      label: row.label,
      icono: row.icono,
      mensaje: row.mensaje,
      color: row.color || COLOR_PRESETS[0],
      skipValidacion: row.skipValidacion,
      activo: row.activo,
      orden: row.orden,
    });
  }

  const grupos: Grupo[] = ["interno", "externo", "dpi"];

  return (
    <AdminLayout title="Escenarios del Simulador WhatsApp">
      <div className="p-6 space-y-6 bg-[#0b141a] min-h-[calc(100vh-64px)] text-gray-200">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Escenarios rápidos</h2>
            <p className="text-xs text-gray-500 mt-1">
              Botones disponibles en la barra superior del input del simulador.
              Los cambios se reflejan al recargar el simulador.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={cargar}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-gray-700/40 hover:bg-gray-700/60 border border-gray-600/40"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Recargar
            </button>
            <button
              onClick={() => setDraft({ ...EMPTY_DRAFT })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200"
            >
              <Plus size={14} />
              Nuevo escenario
            </button>
          </div>
        </header>

        {error && (
          <div className="px-4 py-2 rounded-lg bg-red-900/40 border border-red-500/40 text-red-200 text-sm">
            {error}
          </div>
        )}

        {grupos.map(g => {
          const items = rows
            .filter(r => r.grupo === g)
            .sort((a, b) => a.orden - b.orden || a.id - b.id);
          return (
            <section key={g} className="space-y-2">
              <h3 className="text-xs uppercase tracking-widest text-gray-500 font-semibold">
                {GRUPO_LABELS[g]} <span className="text-gray-700">({items.length})</span>
              </h3>
              <div className="border border-gray-700/40 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800/40 text-gray-400 text-xs">
                    <tr>
                      <th className="px-2 py-2 w-8"></th>
                      <th className="text-left px-3 py-2 w-16">Orden</th>
                      <th className="text-left px-3 py-2">Botón</th>
                      <th className="text-left px-3 py-2">Mensaje</th>
                      <th className="text-left px-3 py-2 w-24">Skip val.</th>
                      <th className="text-left px-3 py-2 w-20">Activo</th>
                      <th className="text-right px-3 py-2 w-32">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-4 text-center text-gray-600 text-xs">
                        Sin escenarios en este grupo.
                      </td></tr>
                    )}
                    {items.map(r => (
                      <tr
                        key={r.id}
                        draggable
                        onDragStart={e => {
                          setDragId(r.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", String(r.id));
                        }}
                        onDragOver={e => {
                          if (dragId == null) return;
                          const dragged = rows.find(x => x.id === dragId);
                          if (!dragged || dragged.grupo !== r.grupo) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dragOverId !== r.id) setDragOverId(r.id);
                        }}
                        onDragLeave={() => {
                          if (dragOverId === r.id) setDragOverId(null);
                        }}
                        onDrop={e => {
                          e.preventDefault();
                          const draggedId = dragId ?? Number(e.dataTransfer.getData("text/plain"));
                          setDragOverId(null);
                          setDragId(null);
                          if (Number.isFinite(draggedId)) reordenar(g, draggedId, r.id);
                        }}
                        onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                        className={
                          "border-t border-gray-700/30 hover:bg-gray-800/20 " +
                          (dragId === r.id ? "opacity-40 " : "") +
                          (dragOverId === r.id && dragId !== r.id ? "outline outline-1 outline-emerald-400/60 " : "")
                        }
                      >
                        <td className="px-2 py-2 text-gray-600 cursor-grab active:cursor-grabbing select-none" title="Arrastrar para reordenar">
                          <GripVertical size={14} />
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-xs">{r.orden}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block text-xs px-2.5 py-1 rounded-lg border ${r.color}`}>
                            {r.icono} {r.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-300 text-xs max-w-md truncate" title={r.mensaje}>
                          {r.mensaje}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {r.skipValidacion
                            ? <span className="text-amber-400">Sí</span>
                            : <span className="text-gray-600">No</span>}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => toggleActivo(r)}
                            className="text-gray-400 hover:text-white"
                            title={r.activo ? "Desactivar" : "Activar"}
                          >
                            {r.activo
                              ? <ToggleRight size={20} className="text-emerald-400" />
                              : <ToggleLeft size={20} className="text-gray-600" />}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => startEdit(r)}
                            className="text-xs text-blue-300 hover:text-blue-200 mr-3"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => eliminar(r.id)}
                            className="text-xs text-red-300 hover:text-red-200 inline-flex items-center gap-1"
                          >
                            <Trash2 size={12} /> Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        {draft && (
          <ScenarioEditor
            draft={draft}
            onChange={setDraft}
            onCancel={() => { setDraft(null); setError(null); }}
            onSave={() => guardar(draft)}
          />
        )}
      </div>
    </AdminLayout>
  );
}

function ScenarioEditor({
  draft,
  onChange,
  onCancel,
  onSave,
}: {
  draft: DraftScenario;
  onChange: (d: DraftScenario) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[#111b21] border border-gray-700/60 rounded-xl w-full max-w-xl shadow-2xl">
        <header className="flex items-center justify-between px-5 py-3 border-b border-gray-700/50">
          <h3 className="text-sm font-semibold text-gray-200">
            {draft.id == null ? "Nuevo escenario" : `Editar escenario #${draft.id}`}
          </h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-white">
            <X size={16} />
          </button>
        </header>

        <div className="p-5 space-y-3 text-sm">
          <Field label="Grupo">
            <select
              value={draft.grupo}
              onChange={e => onChange({ ...draft, grupo: e.target.value as Grupo })}
              className="bg-gray-900/60 border border-gray-700 rounded px-2 py-1.5 w-full"
            >
              <option value="interno">Internos (registrado)</option>
              <option value="externo">Externos (número desconocido)</option>
              <option value="dpi">Flujo DPI</option>
            </select>
          </Field>

          <div className="grid grid-cols-[80px_1fr] gap-3">
            <Field label="Icono">
              <input
                value={draft.icono}
                maxLength={4}
                onChange={e => onChange({ ...draft, icono: e.target.value })}
                placeholder="💬"
                className="bg-gray-900/60 border border-gray-700 rounded px-2 py-1.5 w-full text-center text-lg"
              />
            </Field>
            <Field label="Etiqueta">
              <input
                value={draft.label}
                onChange={e => onChange({ ...draft, label: e.target.value })}
                placeholder="Anticipo"
                className="bg-gray-900/60 border border-gray-700 rounded px-2 py-1.5 w-full"
              />
            </Field>
          </div>

          <Field label="Mensaje a enviar">
            <textarea
              value={draft.mensaje}
              onChange={e => onChange({ ...draft, mensaje: e.target.value })}
              rows={3}
              placeholder="quiero solicitar anticipo"
              className="bg-gray-900/60 border border-gray-700 rounded px-2 py-1.5 w-full font-mono text-xs"
            />
          </Field>

          <Field label="Color">
            <div className="grid grid-cols-4 gap-1.5">
              {COLOR_PRESETS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onChange({ ...draft, color: c })}
                  className={`text-xs px-2 py-1.5 rounded border ${c} ${draft.color === c ? "ring-2 ring-white/40" : ""}`}
                >
                  {draft.icono || "Aa"} muestra
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Orden">
              <input
                type="number"
                value={draft.orden}
                onChange={e => onChange({ ...draft, orden: Number(e.target.value) || 0 })}
                className="bg-gray-900/60 border border-gray-700 rounded px-2 py-1.5 w-full"
              />
            </Field>
            <div className="flex flex-col justify-end gap-2 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.activo}
                  onChange={e => onChange({ ...draft, activo: e.target.checked })}
                />
                Activo (visible en el simulador)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.skipValidacion}
                  onChange={e => onChange({ ...draft, skipValidacion: e.target.checked })}
                />
                Omitir validación de número
              </label>
            </div>
          </div>
        </div>

        <footer className="flex justify-end gap-2 px-5 py-3 border-t border-gray-700/50">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded-lg bg-gray-700/40 hover:bg-gray-700/60 border border-gray-600/40"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-emerald-600/40 hover:bg-emerald-600/60 border border-emerald-500/50 text-emerald-100"
          >
            <Save size={14} /> Guardar
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">{label}</p>
      {children}
    </div>
  );
}
