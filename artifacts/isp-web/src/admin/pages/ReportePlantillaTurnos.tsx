/**
 * ReportePlantillaTurnos.tsx
 * Reporte de PLANTILLA DE TURNOS VIGENTE — foto del momento.
 *
 * Muestra por Cliente → Sede → Puesto → Slot:
 *   • Titular del slot
 *   • Turno (12h / 24h) y rotación (1/2/3/4 sem)
 *   • Días que trabaja y días de descanso por cada semana del ciclo
 *   • Hora de entrada por semana (cuando hay rotación de horarios)
 *   • Fecha de inicio del ciclo (anclaje)
 *
 * Exportable a Excel (CSV con BOM, abre nativo) y PDF membretado.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { AdminLayout } from "../layout/AdminLayout";
import { IspPdf } from "@/lib/pdfExport";
import {
  CalendarClock, Building2, Loader2, RefreshCw,
  FileText, FileDown, ChevronDown, ChevronRight,
  Filter, Users, Clock, AlertTriangle, Map as MapIcon,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SlotPlantilla {
  cliente_id: number | null;
  cliente_nombre: string | null;
  sede_id: number | null;
  sede_nombre: string | null;
  zona_id: number | null;
  zona_nombre: string | null;
  supervisor_nombre: string | null;
  puesto_id: number;
  puesto_nombre: string;
  tipo_servicio: string | null;
  tipo_puesto: string | null;
  puesto_turno: string | null;
  jornada: string | null;
  puesto_horario: string | null;
  cantidad_contratada: number | null;
  slot_id: number | null;
  slot_numero: number | null;
  empleado_id: number | null;
  titular_nombre: string | null;
  horas_turno: number | null;
  hora_entrada: string | null;
  dias_trabajo: number[] | null;
  dias_medio_turno: number[] | null;
  longitud_ciclo: number;
  hora_entrada_por_semana: string[] | null;
  fecha_inicio_ciclo: string | null;
  notas: string | null;
}

interface GlobalStats {
  total_clientes: string;
  total_puestos: string;
  total_slots: string;
  slots_con_titular: string;
  slots_vacantes: string;
  turnos_24h: string;
  turnos_12h: string;
  rot_1_sem: string;
  rot_2_sem: string;
  rot_3_sem: string;
  rot_4_sem: string;
}

interface ReporteData {
  generadoEn: string;
  globalStats: GlobalStats;
  slots: SlotPlantilla[];
  clientesDisponibles: { id: number; nombre: string }[];
  zonasDisponibles: { id: number; nombre: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API = "/api";
const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";
const h = () => ({ "x-isp-session": getSession() });

function fmtNum(n: unknown) {
  const v = parseFloat(String(n ?? 0));
  return isNaN(v) ? "0" : v.toLocaleString("es-GT");
}

function fmtFecha(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  } catch { return iso; }
}

const NOMBRE_DIA = ["L", "M", "X", "J", "V", "S", "D"]; // Lun..Dom (1..7 en una semana)

/**
 * Construye una matriz semanas×días con marcas de Trabajo/Descanso/Medio turno.
 * - longitud_ciclo: 7, 14, 21 o 28
 * - dias_trabajo: array de días 1..longitud_ciclo
 * - dias_medio_turno: subset de dias_trabajo
 * Retorna: array de N semanas, cada una con 7 entradas { d, label, estado }.
 */
function construirSemanas(slot: SlotPlantilla) {
  const lc = Number(slot.longitud_ciclo) || 14;
  const semanas = Math.ceil(lc / 7);
  const trabajo = new Set((slot.dias_trabajo ?? []).map(Number));
  const medio = new Set((slot.dias_medio_turno ?? []).map(Number));
  const out: { semana: number; hora: string; dias: { dia: number; label: string; estado: "trabajo" | "medio" | "descanso" }[] }[] = [];
  for (let s = 0; s < semanas; s++) {
    const dias: { dia: number; label: string; estado: "trabajo" | "medio" | "descanso" }[] = [];
    for (let i = 0; i < 7; i++) {
      const dia = s * 7 + i + 1;
      if (dia > lc) {
        dias.push({ dia, label: NOMBRE_DIA[i], estado: "descanso" });
        continue;
      }
      const estado = medio.has(dia) ? "medio" : trabajo.has(dia) ? "trabajo" : "descanso";
      dias.push({ dia, label: NOMBRE_DIA[i], estado });
    }
    const hora = (slot.hora_entrada_por_semana?.[s])
      || slot.hora_entrada
      || "—";
    out.push({ semana: s + 1, hora: String(hora).slice(0, 5), dias });
  }
  return out;
}

/** Resumen textual de días trabajo / descanso por semana, plano para CSV/PDF. */
function resumenSemanasTexto(slot: SlotPlantilla) {
  const sems = construirSemanas(slot);
  return sems.map((s) => {
    const t = s.dias.filter(d => d.estado !== "descanso").map(d => d.label).join("");
    const dscount = s.dias.filter(d => d.estado === "descanso" && d.dia <= (Number(slot.longitud_ciclo) || 14)).length;
    return `S${s.semana}@${s.hora}[${t || "—"}, desc:${dscount}]`;
  }).join("  ");
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function ReportePlantillaTurnos() {
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroZona, setFiltroZona]       = useState("");
  const [soloVacantes, setSoloVacantes]   = useState(false);
  const [data, setData]                   = useState<ReporteData | null>(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [pdfLoading, setPdfLoading]       = useState(false);
  const [expandidos, setExpandidos]       = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filtroCliente) params.set("cliente_id", filtroCliente);
      if (filtroZona)    params.set("zona_id", filtroZona);
      if (soloVacantes)  params.set("solo_vacantes", "1");
      const r = await fetch(`${API}/reportes/plantilla-turnos?${params}`, { headers: h() });
      if (!r.ok) throw new Error(await r.text());
      const json = await r.json();
      setData(json);
      // Expandir todos los clientes por defecto
      const ids = new Set<string>(
        (json.slots as SlotPlantilla[]).map(s => String(s.cliente_id ?? `s/c-${s.cliente_nombre ?? ""}`)),
      );
      setExpandidos(ids);
    } catch {
      setError("Error al cargar el reporte. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [filtroCliente, filtroZona, soloVacantes]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Agrupar slots por Cliente → Sede → Puesto ──────────────────────────────
  type Agrupado = Record<string, {
    clienteNombre: string;
    sedes: Record<string, {
      sedeNombre: string;
      puestos: Record<string, {
        puestoNombre: string;
        cab: SlotPlantilla;        // primer slot del puesto (para metadata cabecera)
        slots: SlotPlantilla[];
      }>;
    }>;
  }>;

  const agrupado: Agrupado = useMemo(() => {
    const out: Agrupado = {};
    if (!data) return out;
    for (const s of data.slots) {
      const ck = String(s.cliente_id ?? `s/c-${s.cliente_nombre ?? ""}`);
      const sk = String(s.sede_id ?? "sin-sede");
      const pk = String(s.puesto_id);
      if (!out[ck]) out[ck] = { clienteNombre: s.cliente_nombre ?? "Sin cliente", sedes: {} };
      if (!out[ck].sedes[sk]) out[ck].sedes[sk] = { sedeNombre: s.sede_nombre ?? "Sin sede", puestos: {} };
      if (!out[ck].sedes[sk].puestos[pk]) {
        out[ck].sedes[sk].puestos[pk] = { puestoNombre: s.puesto_nombre, cab: s, slots: [] };
      }
      if (s.slot_id) out[ck].sedes[sk].puestos[pk].slots.push(s);
    }
    return out;
  }, [data]);

  function toggle(id: string) {
    setExpandidos(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id); else nuevo.add(id);
      return nuevo;
    });
  }

  // ── CSV (Excel-friendly) Export ────────────────────────────────────────────
  function exportCsv() {
    if (!data) return;
    const headers = [
      "Cliente", "Sede", "Zona", "Supervisor", "Puesto", "Tipo Servicio",
      "Turno Puesto", "Jornada", "Slot #", "Titular",
      "Horas Turno", "Hora Entrada", "Rotación (sem)", "Fecha Inicio Ciclo",
      "Patrón Semanal", "Días Trabajo (raw)", "Días Medio (raw)", "Notas",
    ];
    const rows = data.slots.map((s) => [
      s.cliente_nombre ?? "Sin cliente",
      s.sede_nombre ?? "",
      s.zona_nombre ?? "",
      s.supervisor_nombre ?? "",
      s.puesto_nombre,
      s.tipo_servicio ?? "",
      s.puesto_turno ?? "",
      s.jornada ?? "",
      s.slot_numero != null ? String(s.slot_numero) : "",
      s.titular_nombre ?? "(Vacante)",
      s.horas_turno != null ? String(s.horas_turno) : "",
      s.hora_entrada ?? "",
      String(Math.ceil((Number(s.longitud_ciclo) || 14) / 7)),
      s.fecha_inicio_ciclo ?? "",
      s.slot_id ? resumenSemanasTexto(s) : "",
      s.dias_trabajo ? `[${s.dias_trabajo.join(",")}]` : "",
      s.dias_medio_turno && s.dias_medio_turno.length > 0 ? `[${s.dias_medio_turno.join(",")}]` : "",
      (s.notas ?? "").replace(/[\r\n,]/g, " "),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fechaHoy = new Date().toISOString().slice(0, 10);
    a.download = `plantilla-turnos-${fechaHoy}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── PDF Export ─────────────────────────────────────────────────────────────
  async function exportPdf() {
    if (!data) return;
    setPdfLoading(true);
    try {
      const gs = data.globalStats;
      const totalSlots = parseInt(gs.total_slots) || 0;
      const conTit = parseInt(gs.slots_con_titular) || 0;
      const pctTit = totalSlots > 0 ? Math.round((conTit / totalSlots) * 100) : 0;

      const fechaHoy = new Date().toISOString().slice(0, 10);
      const pdf = await new IspPdf({
        titulo: "Reporte de Plantilla de Turnos Vigente",
        subtitulo: `Foto generada el ${fmtFecha(fechaHoy)}`,
        desde: fechaHoy,
        hasta: fechaHoy,
      }).build();

      pdf.addSeccionTitulo("RESUMEN EJECUTIVO");
      pdf.addResumenCards([
        { label: "Clientes",        valor: fmtNum(gs.total_clientes), color: "blue" },
        { label: "Puestos activos", valor: fmtNum(gs.total_puestos),  color: "gray" },
        { label: "Slots totales",   valor: fmtNum(gs.total_slots),    color: "blue" },
        { label: "Cobertura titular", valor: `${pctTit}%`,             color: pctTit >= 90 ? "green" : pctTit >= 70 ? "yellow" : "red" },
      ]);
      pdf.addResumenCards([
        { label: "Con titular",     valor: fmtNum(gs.slots_con_titular), color: "green" },
        { label: "Vacantes",        valor: fmtNum(gs.slots_vacantes),    color: "red" },
        { label: "Turnos 24h",      valor: fmtNum(gs.turnos_24h),        color: "blue" },
        { label: "Turnos 12h",      valor: fmtNum(gs.turnos_12h),        color: "yellow" },
      ]);
      pdf.addTextoResumen(
        `La plantilla vigente abarca ${fmtNum(gs.total_clientes)} cliente(s), ${fmtNum(gs.total_puestos)} puesto(s) y ` +
        `${fmtNum(gs.total_slots)} slot(s) configurados. ${fmtNum(gs.slots_con_titular)} están asignados a un titular ` +
        `(${pctTit}%) y ${fmtNum(gs.slots_vacantes)} están vacantes. Distribución de rotaciones: ${fmtNum(gs.rot_1_sem)} de 1 sem, ` +
        `${fmtNum(gs.rot_2_sem)} de 2 sem, ${fmtNum(gs.rot_3_sem)} de 3 sem, ${fmtNum(gs.rot_4_sem)} de 4 sem.`
      );

      pdf.addSeccionTitulo("PLANTILLA DETALLADA");
      const filas = data.slots.filter(s => s.slot_id).map((s) => [
        (s.cliente_nombre ?? "—").substring(0, 18),
        (s.sede_nombre ?? "—").substring(0, 12),
        s.puesto_nombre.substring(0, 14),
        s.slot_numero != null ? `#${s.slot_numero}` : "—",
        (s.titular_nombre ?? "(Vacante)").substring(0, 18),
        s.horas_turno != null ? `${s.horas_turno}h` : "—",
        `${Math.ceil((Number(s.longitud_ciclo) || 14) / 7)} sem`,
        s.hora_entrada ?? "—",
        resumenSemanasTexto(s).substring(0, 50),
      ]);
      if (filas.length <= 600) {
        pdf.addTabla(
          ["Cliente", "Sede", "Puesto", "Slot", "Titular", "T", "Rot.", "H.Entr.", "Patrón"],
          filas
        );
      } else {
        pdf.addTextoResumen(`Detalle omitido (${filas.length} filas excede el máximo de 600 para PDF). Usá la exportación a Excel para el detalle completo.`);
      }

      pdf.save(`plantilla-turnos-${fechaHoy}.pdf`);
    } catch (e) {
      console.error("Error generando PDF:", e);
      alert("No se pudo generar el PDF. Probá nuevamente.");
    } finally {
      setPdfLoading(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="max-w-[1600px] mx-auto p-4 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <CalendarClock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Plantilla de Turnos Vigente</h1>
              <p className="text-[10px] text-white/40">
                Foto del momento por cliente y puesto · Titular · Rotación 1-4 sem · Horario por semana
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors px-2 py-1.5"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </button>
            <button
              onClick={exportCsv}
              disabled={!data || loading}
              className="flex items-center gap-1.5 text-xs text-emerald-400/80 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 transition disabled:opacity-40"
              title="Exportar a Excel (CSV UTF-8)"
            >
              <FileDown className="w-3 h-3" />
              Excel
            </button>
            <button
              onClick={exportPdf}
              disabled={!data || loading || pdfLoading}
              className="flex items-center gap-1.5 text-xs text-rose-400/80 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 rounded-lg px-2.5 py-1.5 transition disabled:opacity-40"
            >
              {pdfLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
              PDF
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3 flex-wrap bg-white/[0.015] border border-white/5 rounded-xl px-3 py-2.5">
          <Filter className="w-3.5 h-3.5 text-white/30" />
          <select
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            className="bg-[#0d1e38] border border-white/10 text-white/70 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-primary/40 min-w-[180px]"
          >
            <option value="">Todos los clientes</option>
            {data?.clientesDisponibles.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          <select
            value={filtroZona}
            onChange={(e) => setFiltroZona(e.target.value)}
            className="bg-[#0d1e38] border border-white/10 text-white/70 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-primary/40 min-w-[160px]"
          >
            <option value="">Todas las zonas</option>
            {data?.zonasDisponibles.map(z => (
              <option key={z.id} value={z.id}>{z.nombre}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-white/60 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={soloVacantes}
              onChange={(e) => setSoloVacantes(e.target.checked)}
              className="accent-primary"
            />
            Solo vacantes
          </label>
          {(filtroCliente || filtroZona || soloVacantes) && (
            <button
              onClick={() => { setFiltroCliente(""); setFiltroZona(""); setSoloVacantes(false); }}
              className="text-[10px] text-white/30 hover:text-white/60 underline"
            >
              limpiar
            </button>
          )}
        </div>

        {/* Stats */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            <StatCard icon={<Building2 className="w-3.5 h-3.5" />} label="Clientes" value={fmtNum(data.globalStats.total_clientes)} color="blue" />
            <StatCard icon={<MapIcon className="w-3.5 h-3.5" />} label="Puestos activos" value={fmtNum(data.globalStats.total_puestos)} color="gray" />
            <StatCard icon={<Users className="w-3.5 h-3.5" />} label="Slots totales" value={fmtNum(data.globalStats.total_slots)} color="blue" />
            <StatCard icon={<Users className="w-3.5 h-3.5" />} label="Con titular" value={fmtNum(data.globalStats.slots_con_titular)} color="green" />
            <StatCard icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Vacantes" value={fmtNum(data.globalStats.slots_vacantes)} color="red" />
            <StatCard icon={<Clock className="w-3.5 h-3.5" />} label="24h / 12h" value={`${fmtNum(data.globalStats.turnos_24h)} / ${fmtNum(data.globalStats.turnos_12h)}`} color="gray" />
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-16 text-white/40 text-xs">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando plantilla…
          </div>
        )}

        {/* Listado agrupado */}
        {data && Object.keys(agrupado).length === 0 && !loading && (
          <div className="text-center py-16 text-white/30 text-xs">
            No hay puestos que coincidan con los filtros.
          </div>
        )}

        <div className="space-y-3">
          {Object.entries(agrupado).map(([ck, cli]) => {
            const expCli = expandidos.has(ck);
            const totalPuestos = Object.values(cli.sedes).reduce((acc, s) => acc + Object.keys(s.puestos).length, 0);
            const totalSlots = Object.values(cli.sedes).reduce((acc, s) =>
              acc + Object.values(s.puestos).reduce((a, p) => a + p.slots.length, 0), 0);
            return (
              <div key={ck} className="bg-white/[0.015] border border-white/5 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggle(ck)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
                >
                  {expCli ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronRight className="w-4 h-4 text-white/40" />}
                  <Building2 className="w-4 h-4 text-primary/70" />
                  <span className="text-sm font-semibold text-white/90 flex-1">{cli.clienteNombre}</span>
                  <span className="text-[10px] text-white/40">{totalPuestos} puesto(s) · {totalSlots} slot(s)</span>
                </button>

                {expCli && (
                  <div className="px-4 pb-4 space-y-4">
                    {Object.entries(cli.sedes).map(([sk, sede]) => (
                      <div key={sk} className="space-y-2">
                        <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider border-b border-white/5 pb-1">
                          {sede.sedeNombre}
                        </div>
                        {Object.entries(sede.puestos).map(([pk, puesto]) => (
                          <PuestoCard key={pk} puestoNombre={puesto.puestoNombre} cab={puesto.cab} slots={puesto.slots} />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {data && (
          <p className="text-[10px] text-white/25 text-center pt-2">
            Generado: {new Date(data.generadoEn).toLocaleString("es-GT")}
          </p>
        )}
      </div>
    </AdminLayout>
  );
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string;
  color: "blue" | "green" | "red" | "yellow" | "gray";
}) {
  const colors = {
    blue: "bg-sky-500/8 border-sky-500/15 text-sky-300",
    green: "bg-emerald-500/8 border-emerald-500/15 text-emerald-300",
    red: "bg-rose-500/8 border-rose-500/15 text-rose-300",
    yellow: "bg-amber-500/8 border-amber-500/15 text-amber-300",
    gray: "bg-white/4 border-white/10 text-white/70",
  }[color];
  return (
    <div className={`border ${colors} rounded-lg px-2.5 py-2`}>
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider opacity-70">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-base font-bold mt-1">{value}</div>
    </div>
  );
}

function PuestoCard({ puestoNombre, cab, slots }: { puestoNombre: string; cab: SlotPlantilla; slots: SlotPlantilla[] }) {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-lg p-3 space-y-2">
      {/* Cabecera del puesto */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-white/85">{puestoNombre}</span>
        {cab.zona_nombre && (
          <span className="text-[9px] text-indigo-300/70 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-1.5 py-0.5">
            {cab.zona_nombre}
          </span>
        )}
        {cab.tipo_servicio && (
          <span className="text-[9px] text-white/45 bg-white/3 border border-white/8 rounded-full px-1.5 py-0.5">
            {cab.tipo_servicio}
          </span>
        )}
        {cab.puesto_turno && (
          <span className="text-[9px] text-white/45 bg-white/3 border border-white/8 rounded-full px-1.5 py-0.5">
            {cab.puesto_turno}
          </span>
        )}
        {cab.supervisor_nombre && (
          <span className="text-[9px] text-white/35 ml-auto">Supervisor: {cab.supervisor_nombre}</span>
        )}
      </div>

      {/* Slots */}
      {slots.length === 0 ? (
        <div className="text-[10px] text-amber-400/60 italic">
          Puesto sin slots configurados.
        </div>
      ) : (
        <div className="space-y-2">
          {slots.map((s) => <SlotRow key={s.slot_id} slot={s} />)}
        </div>
      )}
    </div>
  );
}

function SlotRow({ slot }: { slot: SlotPlantilla }) {
  const semanas = construirSemanas(slot);
  const sems = Math.ceil((Number(slot.longitud_ciclo) || 14) / 7);
  const tieneRotHorarios = Array.isArray(slot.hora_entrada_por_semana) && slot.hora_entrada_por_semana.length > 0;
  return (
    <div className="bg-[#0a172d]/40 border border-white/5 rounded p-2">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-[10px] font-mono text-white/45">#{slot.slot_numero}</span>
        <span className={`text-xs font-medium ${slot.titular_nombre ? "text-white/80" : "text-rose-400/70 italic"}`}>
          {slot.titular_nombre ?? "(Vacante)"}
        </span>
        <span className="text-[9px] text-white/40 bg-white/4 border border-white/10 rounded px-1.5 py-0.5">
          {slot.horas_turno ?? "—"}h
        </span>
        <span className="text-[9px] text-white/40 bg-white/4 border border-white/10 rounded px-1.5 py-0.5">
          Rotación {sems} sem{sems > 1 ? "" : ""}
        </span>
        {tieneRotHorarios && (
          <span className="text-[9px] text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
            Horarios rotan
          </span>
        )}
        {slot.fecha_inicio_ciclo && (
          <span className="text-[9px] text-white/30 ml-auto">Inicio ciclo: {fmtFecha(slot.fecha_inicio_ciclo)}</span>
        )}
      </div>

      {/* Grid semanas */}
      <div className="space-y-1">
        {semanas.map((sem) => (
          <div key={sem.semana} className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold text-white/40 w-10 shrink-0">S{sem.semana}</span>
            <span className="text-[9px] text-white/50 w-12 shrink-0 font-mono">{sem.hora}</span>
            <div className="flex gap-0.5 flex-wrap">
              {sem.dias.map((d, i) => {
                const cls =
                  d.estado === "trabajo" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                  : d.estado === "medio"  ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                  : "bg-white/3 border-white/8 text-white/25";
                const title =
                  d.estado === "trabajo" ? `Día ${d.dia}: trabaja`
                  : d.estado === "medio"  ? `Día ${d.dia}: medio turno`
                  : `Día ${d.dia}: descanso`;
                return (
                  <span
                    key={i}
                    title={title}
                    className={`w-6 text-center text-[10px] font-mono rounded border ${cls}`}
                  >
                    {d.label}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Leyenda mini al primer slot expandido (visualmente compacta) */}
      {slot.notas && (
        <p className="text-[9px] text-white/35 italic mt-1.5 truncate">📝 {slot.notas}</p>
      )}
    </div>
  );
}
