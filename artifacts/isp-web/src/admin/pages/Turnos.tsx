/**
 * Turnos.tsx — Catálogo de Tipos de Turno
 *
 * CRUD de turnos (12x12, 24x24, 24x48, 8 horas, etc.)
 *
 * MODELO DE CICLO:
 *   ciclo_horas = horas_trabajo + horas_descanso
 *
 *   ≤ 24 horas de ciclo (ej. 12x12, 8h):
 *     El colaborador trabaja TODOS los días.
 *     horas_esperadas por día = horas_trabajo
 *     El descanso semanal se gestiona con dia_descanso en el puesto/empleado.
 *
 *   > 24 horas de ciclo (ej. 24x24, 24x48):
 *     Alterna días de trabajo y días de descanso.
 *     Requiere fecha_inicio_ciclo en el puesto para calcular posición en ciclo.
 *     24x24 → trabaja / descansa / trabaja / descansa...
 *     24x48 → trabaja / descansa / descansa / trabaja...
 *
 * INTEGRACIÓN:
 *   - Los turnos se asignan en cada puesto operativo (Ficha del Cliente → Puestos)
 *   - El cierre diario enriquece novedades_nomina_diarias con trabajo_esperado y horas_esperadas
 *   - La Pre-Planilla muestra horas_esperadas vs. horas reales y % de cumplimiento
 */

import React, { useState, useEffect, useMemo } from "react";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, Plus, Edit2, ToggleLeft, ToggleRight, Info,
  CheckCircle2, Loader2, X, ChevronDown, ChevronUp, Trash2,
} from "lucide-react";
import { useDeleteMode } from "@/contexts/DeleteModeContext";
import { apiRequest } from "@/lib/httpClient";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Turno {
  id: number;
  nombre: string;
  descripcion: string | null;
  horas_trabajo: number;
  horas_descanso: number;
  activo: boolean;
  puestos_count: number;
  created_at: string;
}

// ─── Formulario vacío ─────────────────────────────────────────────────────────

const FORM_EMPTY = { nombre: "", descripcion: "", horas_trabajo: "", horas_descanso: "" };

// ─── Helper: describe el ciclo en lenguaje natural ──────────────────────────

function describeCiclo(ht: number, hd: number): string {
  const ciclo = ht + hd;
  if (ciclo <= 24) {
    if (hd === 0) return `Jornada de ${ht} h diarias. Trabaja todos los días. El descanso semanal se define en el puesto.`;
    return `Turno de ${ht} h de trabajo + ${hd} h de descanso (dentro del mismo día). Trabaja todos los días del calendario.`;
  }
  const diasTrabajo = ht / 24;
  const diasDescanso = hd / 24;
  const diasCiclo = ciclo / 24;
  return `Turno de ${diasCiclo}-día(s) de ciclo: trabaja ${diasTrabajo === 1 ? "1 día" : `${diasTrabajo} días`}, descansa ${diasDescanso === 1 ? "1 día" : `${diasDescanso} días`}. Requiere fecha de inicio de ciclo en el puesto.`;
}

// ─── Modal de formulario ──────────────────────────────────────────────────────

function TurnoModal({
  turno, onClose, onSave,
}: {
  turno: Turno | null;
  onClose: () => void;
  onSave: (t: Turno) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState(turno
    ? {
        nombre: turno.nombre,
        descripcion: turno.descripcion ?? "",
        horas_trabajo: String(turno.horas_trabajo),
        horas_descanso: String(turno.horas_descanso),
      }
    : FORM_EMPTY);
  const [saving, setSaving] = useState(false);

  const ht = parseFloat(form.horas_trabajo || "0");
  const hd = parseFloat(form.horas_descanso || "0");
  const ciclo = ht + hd;
  const cicloDescripcion = ht > 0 ? describeCiclo(ht, hd) : null;

  function up(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.horas_trabajo) {
      toast({ title: "Completa nombre y horas de trabajo", variant: "destructive" });
      return;
    }
    if (ht <= 0 || ht > 168) {
      toast({ title: "Horas de trabajo deben estar entre 1 y 168", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const body = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        horas_trabajo: ht,
        horas_descanso: hd,
      };
      const saved = turno
        ? await apiRequest<Turno>(`/api/turnos/${turno.id}`, { method: "PATCH", json: body })
        : await apiRequest<Turno>("/api/turnos", { method: "POST", json: body });
      onSave(saved);
      toast({ title: turno ? "Turno actualizado" : "Turno creado" });
      onClose();
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#07111f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-[#060e1c]">
          <h3 className="text-sm font-bold text-white">
            {turno ? "Editar turno" : "Nuevo tipo de turno"}
          </h3>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Nombre *</label>
            <input
              value={form.nombre}
              onChange={(e) => up("nombre", e.target.value)}
              placeholder="Ej: 12x12, 24x24, 8 horas"
              className="mt-1 w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
            />
          </div>

          {/* Horas trabajo + descanso */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Horas de trabajo *</label>
              <input
                type="number" min="1" max="168" step="0.5"
                value={form.horas_trabajo}
                onChange={(e) => up("horas_trabajo", e.target.value)}
                placeholder="Ej: 12"
                className="mt-1 w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider">Horas de descanso</label>
              <input
                type="number" min="0" max="336" step="0.5"
                value={form.horas_descanso}
                onChange={(e) => up("horas_descanso", e.target.value)}
                placeholder="Ej: 12"
                className="mt-1 w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
              />
            </div>
          </div>

          {/* Preview del ciclo */}
          {cicloDescripcion && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-semibold text-primary mb-0.5">
                    Ciclo: {ciclo} h total — {ciclo <= 24 ? "Sub-diario" : `${ciclo / 24} días`}
                  </p>
                  <p className="text-[10px] text-white/50 leading-relaxed">{cicloDescripcion}</p>
                </div>
              </div>
            </div>
          )}

          {/* Descripción */}
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Descripción (opcional)</label>
            <textarea
              value={form.descripcion}
              onChange={(e) => up("descripcion", e.target.value)}
              rows={2}
              placeholder="Descripción o notas adicionales"
              className="mt-1 w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/50 hover:text-white hover:border-white/20 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {turno ? "Guardar cambios" : "Crear turno"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Turnos() {
  const { toast } = useToast();
  const { active: deleteModeActive, requestDelete } = useDeleteMode();
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"nuevo" | Turno | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);

  async function cargar() {
    setLoading(true);
    try {
      const data = await apiRequest<Turno[]>("/api/turnos");
      setTurnos(data);
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  function onSave(saved: Turno) {
    setTurnos((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...saved };
        return next;
      }
      return [...prev, saved];
    });
  }

  async function toggleActivo(t: Turno) {
    if (!t.activo && t.puestos_count > 0) {
      toast({ title: "No se puede desactivar", description: `Está asignado a ${t.puestos_count} puesto(s).`, variant: "destructive" });
      return;
    }
    setToggling(t.id);
    try {
      if (t.activo) {
        const saved = await apiRequest(`/api/turnos/${t.id}`, {
          method: "DELETE",
        });
        setTurnos((prev) => prev.map((x) => x.id === t.id ? { ...x, activo: false } : x));
        toast({ title: `Turno "${t.nombre}" desactivado` });
      } else {
        const saved = await apiRequest(`/api/turnos/${t.id}`, {
          method: "PATCH",
          json: { activo: true },
        });
        setTurnos((prev) => prev.map((x) => x.id === t.id ? { ...x, activo: true } : x));
        toast({ title: `Turno "${t.nombre}" activado` });
      }
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setToggling(null);
    }
  }

  const activos = turnos.filter((t) => t.activo);
  const inactivos = turnos.filter((t) => !t.activo);

  return (
    <AdminLayout title="Tipos de Turno">
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/40 text-xs mt-0.5">
              Defina turnos (12x12, 24x24, 8h…) para calcular jornadas esperadas y cumplimiento en planilla
            </p>
          </div>
          <button
            onClick={() => setModal("nuevo")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Nuevo turno
          </button>
        </div>

        {/* Cómo funciona */}
        <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-blue-300">¿Cómo funcionan los turnos?</p>
              <div className="text-[11px] text-blue-300/60 leading-relaxed space-y-1">
                <p><strong className="text-blue-300/80">Ciclo ≤ 24 h (ej. 12x12, 8h):</strong> El colaborador trabaja todos los días del calendario. El descanso semanal se define con el "día de descanso" en el puesto u empleado.</p>
                <p><strong className="text-blue-300/80">Ciclo &gt; 24 h (ej. 24x24, 24x48):</strong> Alterna días de trabajo y descanso. Se necesita una "Fecha inicio de ciclo" en el puesto para calcular en qué posición del ciclo está cada día.</p>
                <p><strong className="text-blue-300/80">Integración:</strong> Asigna el turno en cada puesto operativo (Ficha Cliente → Puestos). Al cerrar el día, el sistema calculará <em>trabajo_esperado</em> y <em>horas_esperadas</em> en las novedades de nómina, habilitando el % de cumplimiento en la Pre-Planilla.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Cargando */}
        {loading && (
          <div className="bg-[#0c1929] border border-white/8 rounded-xl p-8 text-center">
            <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-2" />
            <p className="text-white/30 text-sm">Cargando catálogo…</p>
          </div>
        )}

        {/* Turnos activos */}
        {!loading && (
          <div className="bg-[#0c1929] border border-white/8 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                Turnos activos ({activos.length})
              </h3>
            </div>

            {activos.length === 0 ? (
              <div className="p-8 text-center text-white/30 text-sm">
                No hay turnos activos. Crea el primero con el botón de arriba.
              </div>
            ) : (
              <div className="divide-y divide-white/4">
                {activos.map((t) => {
                  const ciclo = t.horas_trabajo + t.horas_descanso;
                  const esCiclico = ciclo > 24;
                  return (
                    <div key={t.id} className="flex items-start gap-4 px-5 py-4">
                      {/* Icono */}
                      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-primary" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-bold text-white text-sm">{t.nombre}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
                            esCiclico
                              ? "text-purple-400 bg-purple-400/10 border-purple-400/20"
                              : "text-cyan-400 bg-cyan-400/10 border-cyan-400/20"
                          }`}>
                            {esCiclico ? `Ciclo ${ciclo / 24}d` : "Diario"}
                          </span>
                          {t.puestos_count > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-400/10 border border-green-400/20 text-green-400 font-medium">
                              {t.puestos_count} puesto{t.puestos_count !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/40 mb-1">
                          {t.horas_trabajo} h trabajo · {t.horas_descanso} h descanso · ciclo = {ciclo} h
                          {esCiclico && ` (${ciclo / 24} día${ciclo / 24 !== 1 ? "s" : ""})`}
                        </p>
                        {t.descripcion && (
                          <p className="text-[11px] text-white/30 italic">{t.descripcion}</p>
                        )}
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setModal(t)}
                          className="p-1.5 rounded-lg text-white/30 hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleActivo(t)}
                          disabled={toggling === t.id}
                          className="p-1.5 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
                          title="Desactivar"
                        >
                          {toggling === t.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <ToggleRight className="w-3.5 h-3.5" />
                          }
                        </button>
                        {deleteModeActive && (
                          <button
                            onClick={() => requestDelete({ entidad: "turno", entidad_id: t.id, entidad_descripcion: `Turno: ${t.nombre}` })}
                            className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                            title="Solicitar eliminación"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Turnos inactivos */}
        {!loading && inactivos.length > 0 && (
          <div className="bg-[#0c1929] border border-white/6 rounded-xl overflow-hidden opacity-60">
            <div className="px-5 py-3 border-b border-white/5">
              <h3 className="text-xs font-semibold text-white/30 uppercase tracking-wider">
                Inactivos ({inactivos.length})
              </h3>
            </div>
            <div className="divide-y divide-white/3">
              {inactivos.map((t) => (
                <div key={t.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1">
                    <p className="text-sm text-white/30 line-through">{t.nombre}</p>
                    <p className="text-[10px] text-white/20">{t.horas_trabajo}h + {t.horas_descanso}h</p>
                  </div>
                  <button
                    onClick={() => toggleActivo(t)}
                    disabled={toggling === t.id}
                    className="p-1.5 rounded-lg text-white/20 hover:text-green-400 hover:bg-green-400/10 transition-colors"
                    title="Reactivar"
                  >
                    <ToggleLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <TurnoModal
          turno={modal === "nuevo" ? null : modal}
          onClose={() => setModal(null)}
          onSave={onSave}
        />
      )}
    </AdminLayout>
  );
}
