/**
 * NovedadesNomina.tsx — Revisión y corrección de novedades de nómina diarias
 *
 * A-02: UI para revisar y editar novedades_nomina_diarias antes de enviar a planilla.
 *
 * Funciones:
 *  - Ver novedades por fecha o rango
 *  - Editar horas, flags de falta/suspensión/descanso y observaciones
 *  - Regenerar novedades desde cobertura
 *  - Exportar a CSV
 */
import React, { useState, useCallback } from "react";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, RefreshCw, Download, Edit3, Save, X,
  CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronUp,
  Users, Loader2, Info,
} from "lucide-react";

const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { "x-isp-session": getSession(), "Content-Type": "application/json", ...init?.headers },
  });
}

interface Novedad {
  id: number;
  fecha: string;
  employee_id: number | null;
  empleado_nombre: string;
  nombre_empleado_join?: string;
  puesto_empleado?: string;
  area_empleado?: string;
  trabajo_dia: boolean;
  horas_trabajadas: string;
  horas_extra: string;
  falta: boolean;
  suspension: boolean;
  descanso_trabajado: boolean;
  afecta_septimo: boolean;
  descuento_dia: boolean;
  puesto_titular_nombre?: string;
  puesto_cubierto_nombre?: string;
  num_puestos_cubiertos: number;
  observaciones?: string;
  fuente: string;
  updated_at: string;
}

interface Resumen {
  total: number;
  trabajaron: number;
  faltas: number;
  suspensiones: number;
  descansosTrabajos: number;
  totalHoras: string;
  totalHorasExtra: string;
}

function hoy() {
  return new Date().toISOString().split("T")[0];
}

function fmtFecha(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-GT", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  });
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <span className="inline-flex items-center gap-0.5 text-[10px] bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 px-1.5 py-0.5 rounded font-semibold">
      <CheckCircle2 className="w-2.5 h-2.5" /> {label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-[10px] bg-white/5 text-white/25 border border-white/10 px-1.5 py-0.5 rounded">
      {label}
    </span>
  );
}

interface EditState {
  trabajo_dia: boolean;
  horas_trabajadas: string;
  horas_extra: string;
  falta: boolean;
  suspension: boolean;
  descanso_trabajado: boolean;
  afecta_septimo: boolean;
  descuento_dia: boolean;
  observaciones: string;
}

function EditRow({
  novedad,
  onSave,
  onCancel,
}: {
  novedad: Novedad;
  onSave: (id: number, data: Partial<Novedad>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<EditState>({
    trabajo_dia: novedad.trabajo_dia,
    horas_trabajadas: novedad.horas_trabajadas ?? "0",
    horas_extra: novedad.horas_extra ?? "0",
    falta: novedad.falta,
    suspension: novedad.suspension,
    descanso_trabajado: novedad.descanso_trabajado,
    afecta_septimo: novedad.afecta_septimo,
    descuento_dia: novedad.descuento_dia,
    observaciones: novedad.observaciones ?? "",
  });
  const [saving, setSaving] = useState(false);

  const toggle = (k: keyof EditState) =>
    setForm((f) => ({ ...f, [k]: !(f[k] as boolean) }));

  async function submit() {
    setSaving(true);
    await onSave(novedad.id, {
      ...form,
      horas_trabajadas: form.horas_trabajadas,
      horas_extra: form.horas_extra,
    });
    setSaving(false);
  }

  const chk = "w-3.5 h-3.5 rounded border border-white/20 bg-white/5 checked:bg-primary checked:border-primary cursor-pointer";

  return (
    <tr className="bg-primary/5 border-t border-b border-primary/20">
      <td colSpan={10} className="px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {/* Checkboxes */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className={chk} checked={form.trabajo_dia} onChange={() => toggle("trabajo_dia")} />
            <span className="text-white/70">Trabajó el día</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className={chk} checked={form.falta} onChange={() => toggle("falta")} />
            <span className="text-white/70">Falta</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className={chk} checked={form.suspension} onChange={() => toggle("suspension")} />
            <span className="text-white/70">Suspensión</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className={chk} checked={form.descanso_trabajado} onChange={() => toggle("descanso_trabajado")} />
            <span className="text-white/70">Descanso trabajado</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className={chk} checked={form.afecta_septimo} onChange={() => toggle("afecta_septimo")} />
            <span className="text-white/70">Afecta séptimo</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className={chk} checked={form.descuento_dia} onChange={() => toggle("descuento_dia")} />
            <span className="text-white/70">Descuento día</span>
          </label>

          {/* Horas */}
          <div>
            <p className="text-white/40 mb-1">Horas trabajadas</p>
            <input
              type="number" min="0" max="24" step="0.5"
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs"
              value={form.horas_trabajadas}
              onChange={(e) => setForm((f) => ({ ...f, horas_trabajadas: e.target.value }))}
            />
          </div>
          <div>
            <p className="text-white/40 mb-1">Horas extra</p>
            <input
              type="number" min="0" max="12" step="0.5"
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs"
              value={form.horas_extra}
              onChange={(e) => setForm((f) => ({ ...f, horas_extra: e.target.value }))}
            />
          </div>

          {/* Observaciones */}
          <div className="col-span-2 md:col-span-4">
            <p className="text-white/40 mb-1">Observaciones / Notas de corrección</p>
            <textarea
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs placeholder-white/20 resize-none"
              placeholder="Motivo de la corrección manual…"
              value={form.observaciones}
              onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-3 justify-end">
          <button onClick={onCancel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white border border-white/10 hover:border-white/20 transition-colors">
            <X className="w-3 h-3" /> Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs bg-primary text-[#07111f] font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Guardar corrección
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function NovedadesNomina() {
  const { toast } = useToast();
  const [desde, setDesde] = useState(hoy());
  const [hasta, setHasta] = useState(hoy());
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<string>("empleado_nombre");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const cargar = useCallback(async () => {
    setLoading(true);
    setEditingId(null);
    try {
      const qs = desde === hasta
        ? `fecha=${desde}`
        : `desde=${desde}&hasta=${hasta}`;
      const res = await apiFetch(`/api/nomina/novedades?${qs}`);
      if (!res.ok) throw new Error("Error al cargar");
      const data = await res.json();
      setNovedades(data.novedades ?? []);
      setResumen(data.resumen ?? null);
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar las novedades", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [desde, hasta, toast]);

  const generar = async () => {
    setGenerando(true);
    try {
      const res = await apiFetch("/api/nomina/novedades/generar", {
        method: "POST",
        body: JSON.stringify({ fecha: desde, usuarioRol: "admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error");
      toast({ title: "Novedades generadas", description: `${data.generadas} registros para ${desde}` });
      await cargar();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGenerando(false);
    }
  };

  const guardarEdicion = async (id: number, data: Partial<Novedad>) => {
    const res = await apiFetch(`/api/nomina/novedades/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Error", description: err.error, variant: "destructive" });
      return;
    }
    const updated = await res.json();
    setNovedades((prev) =>
      prev.map((n) => n.id === id ? { ...n, ...updated.novedad } : n)
    );
    setEditingId(null);
    toast({ title: "Corrección guardada", description: "La novedad fue actualizada." });
  };

  function exportarCSV() {
    if (!novedades.length) return;
    const cols = [
      "Fecha", "Empleado", "Puesto", "Área", "Trabajó",
      "Horas", "HorasExtra", "Falta", "Suspensión", "DescansóTrabajado",
      "AfectaSéptimo", "DescuentoDía", "PuestoTitular", "PuestoCubierto",
      "NumPuestos", "Fuente", "Observaciones",
    ];
    const rows = novedades.map((n) => [
      n.fecha,
      n.nombre_empleado_join ?? n.empleado_nombre,
      n.puesto_empleado ?? "",
      n.area_empleado ?? "",
      n.trabajo_dia ? "Sí" : "No",
      n.horas_trabajadas,
      n.horas_extra,
      n.falta ? "Sí" : "No",
      n.suspension ? "Sí" : "No",
      n.descanso_trabajado ? "Sí" : "No",
      n.afecta_septimo ? "Sí" : "No",
      n.descuento_dia ? "Sí" : "No",
      n.puesto_titular_nombre ?? "",
      n.puesto_cubierto_nombre ?? "",
      n.num_puestos_cubiertos,
      n.fuente,
      n.observaciones ?? "",
    ]);
    const csv = [cols, ...rows].map((r) => r.map(String).map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `novedades_nomina_${desde}_${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleSort(field: string) {
    if (sortField === field) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const sorted = [...novedades].sort((a, b) => {
    const av = String((a as any)[sortField] ?? "").toLowerCase();
    const bv = String((b as any)[sortField] ?? "").toLowerCase();
    return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const SortIcon = ({ field }: { field: string }) =>
    sortField === field
      ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />)
      : null;

  const inputCls = "bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/25 focus:outline-none focus:border-primary/50 transition-colors";

  return (
    <AdminLayout title="Novedades de Nómina">
      <div className="space-y-5">

        {/* Header + filtros */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Desde</p>
            <input type="date" className={inputCls} value={desde} onChange={(e) => setDesde(e.target.value)} max={hasta} />
          </div>
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Hasta</p>
            <input type="date" className={inputCls} value={hasta} onChange={(e) => setHasta(e.target.value)} min={desde} />
          </div>
          <button
            onClick={cargar}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-[#07111f] text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calendar className="w-3 h-3" />}
            Consultar
          </button>
          <button
            onClick={generar}
            disabled={generando || desde !== hasta}
            title={desde !== hasta ? "La generación es solo para una fecha específica" : ""}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/60 hover:text-white hover:border-white/20 transition-colors disabled:opacity-40"
          >
            {generando ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Re-generar
          </button>
          {novedades.length > 0 && (
            <button
              onClick={exportarCSV}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/60 hover:text-white hover:border-white/20 transition-colors"
            >
              <Download className="w-3 h-3" /> Exportar CSV
            </button>
          )}
        </div>

        {/* Resumen */}
        {resumen && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {[
              { label: "Total", value: resumen.total, icon: Users, color: "text-white/70" },
              { label: "Trabajaron", value: resumen.trabajaron, icon: CheckCircle2, color: "text-emerald-400" },
              { label: "Faltas", value: resumen.faltas, icon: AlertCircle, color: "text-red-400" },
              { label: "Suspensiones", value: resumen.suspensiones, icon: AlertCircle, color: "text-orange-400" },
              { label: "Desc. Trabajado", value: resumen.descansosTrabajos, icon: Info, color: "text-blue-400" },
              { label: "Total Horas", value: resumen.totalHoras, icon: Clock, color: "text-primary" },
              { label: "Horas Extra", value: resumen.totalHorasExtra, icon: Clock, color: "text-yellow-400" },
            ].map((s) => (
              <div key={s.label} className="bg-white/3 border border-white/8 rounded-xl p-3">
                <p className="text-[9px] uppercase tracking-wide text-white/30 mb-1">{s.label}</p>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Aviso inicial */}
        {novedades.length === 0 && !loading && (
          <div className="bg-white/3 border border-white/8 rounded-2xl p-10 text-center">
            <Calendar className="w-8 h-8 text-white/15 mx-auto mb-3" />
            <p className="text-white/40 text-sm">Selecciona un rango de fechas y haz clic en <strong>Consultar</strong>.</p>
            <p className="text-white/20 text-xs mt-1">
              Si no hay datos, usa <strong>Re-generar</strong> para crear las novedades desde la cobertura del día.
            </p>
          </div>
        )}

        {/* Tabla */}
        {novedades.length > 0 && (
          <div className="bg-white/3 border border-white/8 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/8 bg-white/3">
                    {[
                      { key: "fecha", label: "Fecha" },
                      { key: "empleado_nombre", label: "Empleado" },
                      { key: null, label: "Flags" },
                      { key: "horas_trabajadas", label: "Horas" },
                      { key: "puesto_titular_nombre", label: "Puesto Titular" },
                      { key: "fuente", label: "Fuente" },
                      { key: null, label: "Observaciones" },
                      { key: null, label: "" },
                    ].map((col) => (
                      <th
                        key={col.label}
                        className={`px-4 py-3 text-left text-[10px] uppercase tracking-wide text-white/30 font-semibold ${col.key ? "cursor-pointer hover:text-white/60" : ""}`}
                        onClick={() => col.key && toggleSort(col.key)}
                      >
                        {col.label}{col.key && <SortIcon field={col.key} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((n) => (
                    <React.Fragment key={n.id}>
                      <tr className="border-b border-white/5 hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3 text-white/60 whitespace-nowrap">{fmtFecha(n.fecha)}</td>
                        <td className="px-4 py-3">
                          <p className="text-white font-medium">{n.nombre_empleado_join ?? n.empleado_nombre}</p>
                          {(n.puesto_empleado || n.area_empleado) && (
                            <p className="text-[10px] text-white/30">{n.puesto_empleado ?? ""}{n.area_empleado ? ` · ${n.area_empleado}` : ""}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <Badge ok={n.trabajo_dia} label="Trabajó" />
                            {n.falta && <span className="text-[10px] bg-red-400/10 text-red-400 border border-red-400/20 px-1.5 py-0.5 rounded font-semibold">Falta</span>}
                            {n.suspension && <span className="text-[10px] bg-orange-400/10 text-orange-400 border border-orange-400/20 px-1.5 py-0.5 rounded font-semibold">Susp.</span>}
                            {n.descanso_trabajado && <span className="text-[10px] bg-blue-400/10 text-blue-400 border border-blue-400/20 px-1.5 py-0.5 rounded">Desc.Trab.</span>}
                            {n.descuento_dia && <span className="text-[10px] bg-red-400/8 text-red-300/70 border border-red-400/10 px-1.5 py-0.5 rounded">Descuento</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-white/70">
                          <span className="font-mono">{Number(n.horas_trabajadas ?? 0).toFixed(1)}h</span>
                          {Number(n.horas_extra) > 0 && (
                            <span className="ml-1 text-yellow-400 font-mono">+{Number(n.horas_extra).toFixed(1)}h</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-white/50 text-[11px]">
                          {n.puesto_titular_nombre ?? "—"}
                          {n.puesto_cubierto_nombre && n.puesto_cubierto_nombre !== n.puesto_titular_nombre && (
                            <p className="text-[10px] text-white/25">Cubrió: {n.puesto_cubierto_nombre}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            n.fuente === "correccion_manual"
                              ? "bg-yellow-400/10 text-yellow-400 border-yellow-400/20"
                              : "bg-white/5 text-white/30 border-white/10"
                          }`}>
                            {n.fuente === "cierre_operativo" ? "Cierre op." : n.fuente === "correccion_manual" ? "Corrección manual" : n.fuente}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/35 text-[11px] max-w-[200px] truncate">
                          {n.observaciones || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setEditingId(editingId === n.id ? null : n.id)}
                            className="p-1.5 rounded-lg hover:bg-white/8 text-white/30 hover:text-primary transition-colors"
                            title="Editar novedad"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                      {editingId === n.id && (
                        <EditRow
                          novedad={n}
                          onSave={guardarEdicion}
                          onCancel={() => setEditingId(null)}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-2 border-t border-white/8 text-[10px] text-white/25">
              {novedades.length} registros · {desde === hasta ? fmtFecha(desde) : `${desde} al ${hasta}`}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
