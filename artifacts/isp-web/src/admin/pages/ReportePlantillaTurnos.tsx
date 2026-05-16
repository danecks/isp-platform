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
import { getSessionToken } from "@/lib/httpClient";

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
  /** TURNOS-05: excepciones puntuales por día del ciclo. */
  hora_entrada_por_dia: Record<string, string> | null;
  fecha_inicio_ciclo: string | null;
  notas: string | null;
  slot_updated_ts: number | string | null;
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
const getSession = () => getSessionToken();
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

/** Marca textual por día para CSV / PDF de carga masiva: T=Trabaja, M=Medio, D=Descansa. */
const MARCA: Record<"trabajo" | "medio" | "descanso", "T" | "M" | "D"> = {
  trabajo: "T", medio: "M", descanso: "D",
};

/** Máximo de semanas soportadas en el ciclo (longitud_ciclo máx = 28 días = 4 sem). */
const MAX_SEMANAS = 4;

/**
 * Normaliza la longitud_ciclo de un slot al rango válido para los exports/grids.
 * La app solo soporta 7/14/21/28, pero si llegara un valor mayor lo trunca y
 * loggea (warning) para evitar inconsistencias silenciosas entre las columnas
 * exportadas (28 días máx) y los metadatos declarados (`Longitud Ciclo`, `Rotación`).
 * Se usa como fuente única de verdad en CSV y `celdasPlanasSlot()`.
 */
function normalizarLongitudCiclo(slot: SlotPlantilla): { lc: number; semsActivas: number } {
  const lcRaw = Number(slot.longitud_ciclo) || 14;
  if (lcRaw > MAX_SEMANAS * 7) {
    // eslint-disable-next-line no-console
    console.warn(`[ReportePlantillaTurnos] slot ${slot.slot_id ?? "?"} tiene longitud_ciclo=${lcRaw} (>28); se trunca a 28 para los exports.`);
  }
  const lc = Math.min(lcRaw, MAX_SEMANAS * 7);
  return { lc, semsActivas: Math.ceil(lc / 7) };
}

/**
 * Devuelve un objeto plano con celdas SX-Y y SX-Hora para el slot dado.
 * Las semanas/días fuera del ciclo quedan vacíos ("") para que el formato
 * de columnas sea siempre el mismo (apto para carga masiva por importación).
 */
function celdasPlanasSlot(slot: SlotPlantilla): Record<string, string> {
  const out: Record<string, string> = {};
  const { lc, semsActivas } = normalizarLongitudCiclo(slot);
  const trabajo = new Set((slot.dias_trabajo ?? []).map(Number));
  const medio = new Set((slot.dias_medio_turno ?? []).map(Number));

  for (let s = 1; s <= MAX_SEMANAS; s++) {
    const dentroCiclo = s <= semsActivas;
    out[`S${s}-Hora`] = dentroCiclo
      ? String((slot.hora_entrada_por_semana?.[s - 1]) || slot.hora_entrada || "").slice(0, 5)
      : "";
    NOMBRE_DIA.forEach((label, i) => {
      const dia = (s - 1) * 7 + i + 1;
      let valor = "";
      if (dentroCiclo && dia <= lc) {
        valor = medio.has(dia) ? "M" : trabajo.has(dia) ? "T" : "D";
      }
      out[`S${s}-${label}`] = valor;
    });
  }
  return out;
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

  // ── CSV (Excel-friendly + carga masiva) Export ─────────────────────────────
  // Formato AMPLIO con columnas determinísticas:
  //   Identificadores (IDs) + datos del puesto/slot + 4 columnas de Hora (S1..S4)
  //   + 28 columnas de día (S1-L .. S4-D) con valores T/M/D ("" fuera de ciclo).
  // Diseñado para que en una futura iteración se pueda EDITAR el archivo en
  // Excel y SUBIRLO para actualizar la plantilla masivamente (los IDs hacen
  // match exacto, longitud_ciclo dice cuántas semanas son válidas).
  function exportCsv() {
    if (!data) return;

    const diaCols: string[] = [];
    const horaCols: string[] = [];
    for (let s = 1; s <= MAX_SEMANAS; s++) {
      horaCols.push(`S${s}-Hora`);
      for (const d of NOMBRE_DIA) diaCols.push(`S${s}-${d}`);
    }

    const headers = [
      // Identificadores (claves para carga masiva)
      "ID Slot", "ID Puesto", "ID Cliente", "ID Empleado",
      // Información de contexto (informativa; no se usa al re-importar)
      "Cliente", "Sede", "Zona", "Supervisor",
      "Puesto", "Tipo Servicio", "Turno Puesto", "Jornada",
      // Identidad del slot (clave secundaria)
      "Slot #", "Titular",
      // Configuración del slot (editable al re-importar)
      "Horas Turno", "Longitud Ciclo (días)", "Rotación (sem)", "Fecha Inicio Ciclo",
      // Horario por semana (editable)
      ...horaCols,
      // Plantilla por día (editable: T=Trabaja, M=Medio turno, D=Descansa, vacío=fuera de ciclo)
      ...diaCols,
      // Sello de concurrencia (NO editar): epoch seg de cuando se modificó el slot por última vez
      "_actualizado_ts",
      // Notas
      "Notas",
    ];

    // Solo se exportan slots configurados (con slot_id). Las super-vacantes
    // (puestos sin ningún slot) NO van en el CSV porque no tienen clave primaria
    // y por lo tanto no se pueden re-importar al hacer carga masiva. Para verlas
    // está el resumen ejecutivo y la vista en pantalla.
    const slotsExportables = data.slots.filter((s) => s.slot_id != null);
    const rows = slotsExportables.map((s) => {
      const { lc, semsActivas } = normalizarLongitudCiclo(s);
      const cels = celdasPlanasSlot(s);
      return [
        s.slot_id ?? "",
        s.puesto_id,
        s.cliente_id ?? "",
        s.empleado_id ?? "",
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
        String(lc),
        String(semsActivas),
        s.fecha_inicio_ciclo ?? "",
        ...horaCols.map((c) => cels[c] ?? ""),
        ...diaCols.map((c) => cels[c] ?? ""),
        s.slot_updated_ts != null ? String(s.slot_updated_ts) : "",
        (s.notas ?? "").replace(/[\r\n]/g, " "),
      ];
    });

    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
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

      pdf.addSeccionTitulo("PLANTILLA DETALLADA POR SLOT");

      // Leyenda visual
      pdf.addCustomBlock(8, ({ doc, x, y, colors }) => {
        const labels: { letra: "T" | "M" | "D"; texto: string; color: [number, number, number] }[] = [
          { letra: "T", texto: "Trabaja",      color: colors.green },
          { letra: "M", texto: "Medio turno",  color: colors.yellow },
          { letra: "D", texto: "Descansa",     color: [180, 188, 200] },
        ];
        let cx = x;
        const cy = y;
        const cellSize = 5;
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...colors.darkGray);
        doc.text("Leyenda:", cx, cy + 3.5);
        cx += 16;
        for (const l of labels) {
          doc.setFillColor(...l.color);
          doc.roundedRect(cx, cy, cellSize, cellSize, 0.5, 0.5, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(6.5);
          doc.setFont("helvetica", "bold");
          doc.text(l.letra, cx + cellSize / 2, cy + cellSize / 2 + 1.2, { align: "center" });
          doc.setTextColor(...colors.darkGray);
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.text(l.texto, cx + cellSize + 1.5, cy + 3.5);
          cx += cellSize + 1.5 + doc.getTextWidth(l.texto) + 6;
        }
        return 7;
      });

      // Tarjeta visual por cada slot
      const slotsConId = data.slots.filter(s => s.slot_id);
      const MAX_SLOTS_PDF = 250;
      const slotsAImprimir = slotsConId.slice(0, MAX_SLOTS_PDF);

      for (const s of slotsAImprimir) {
        const sems = construirSemanas(s);
        const totalSem = sems.length;
        // Altura estimada: cabecera (12) + cada fila de semana (5.5) + padding (4)
        const altura = 12 + totalSem * 5.5 + 4;

        pdf.addCustomBlock(altura + 2, ({ doc, x, y, width, colors }) => {
          // Marco de la tarjeta
          doc.setDrawColor(...colors.border);
          doc.setLineWidth(0.3);
          doc.setFillColor(252, 253, 255);
          doc.roundedRect(x, y, width, altura, 1.5, 1.5, "FD");

          // ── Cabecera del slot ──
          doc.setTextColor(...colors.navy);
          doc.setFontSize(8.5);
          doc.setFont("helvetica", "bold");
          const titularTxt = s.titular_nombre ?? "(Vacante)";
          const cabIzq = `${s.cliente_nombre ?? "Sin cliente"} · ${s.sede_nombre ?? "—"} · ${s.puesto_nombre} · #${s.slot_numero ?? "—"}`;
          doc.text(doc.splitTextToSize(cabIzq, width * 0.65)[0], x + 3, y + 5);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(s.titular_nombre ? 50 : 220, s.titular_nombre ? 60 : 60, s.titular_nombre ? 75 : 60);
          doc.text(`Titular: ${titularTxt}`, x + 3, y + 9.2);

          // Cabecera derecha: turno · rotación · ciclo
          const rot = Math.ceil((Number(s.longitud_ciclo) || 14) / 7);
          const cabDer = `${s.horas_turno ?? "—"}h · Rotación ${rot} sem · Ciclo ${s.longitud_ciclo}d`;
          doc.setTextColor(...colors.darkGray);
          doc.setFontSize(7);
          doc.text(cabDer, x + width - 3, y + 5, { align: "right" });
          if (s.fecha_inicio_ciclo) {
            const [yy, mm, dd] = s.fecha_inicio_ciclo.split("-");
            doc.text(`Inicio ciclo: ${dd}/${mm}/${yy}`, x + width - 3, y + 9.2, { align: "right" });
          }

          // ── Mini-grid ──
          const gridTop = y + 12.5;
          const labelSemW = 8;
          const labelHoraW = 12;
          const cellGap = 0.6;
          const availForCells = width - 6 - labelSemW - labelHoraW;
          const cellW = (availForCells - cellGap * 6) / 7;
          const cellH = 4.6;
          const rowGap = 0.9;

          // Encabezado de días (L M X J V S D)
          doc.setFontSize(6.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...colors.darkGray);
          NOMBRE_DIA.forEach((label, i) => {
            const cx = x + 3 + labelSemW + labelHoraW + i * (cellW + cellGap) + cellW / 2;
            doc.text(label, cx, gridTop - 0.5, { align: "center" });
          });

          // Filas por semana
          sems.forEach((sem, idx) => {
            const ry = gridTop + idx * (cellH + rowGap);
            // Etiqueta semana
            doc.setFontSize(7);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(...colors.navy);
            doc.text(`S${sem.semana}`, x + 3, ry + cellH / 2 + 1);
            // Hora de entrada
            doc.setFont("helvetica", "normal");
            doc.setFontSize(6.5);
            doc.setTextColor(...colors.darkGray);
            doc.text(sem.hora || "—", x + 3 + labelSemW, ry + cellH / 2 + 1);
            // Celdas
            sem.dias.forEach((d, i) => {
              const cx = x + 3 + labelSemW + labelHoraW + i * (cellW + cellGap);
              let fill: [number, number, number];
              if (d.dia > (Number(s.longitud_ciclo) || 14)) {
                fill = [240, 242, 246];
              } else if (d.estado === "trabajo") {
                fill = colors.green;
              } else if (d.estado === "medio") {
                fill = colors.yellow;
              } else {
                fill = [180, 188, 200];
              }
              doc.setFillColor(...fill);
              doc.roundedRect(cx, ry, cellW, cellH, 0.3, 0.3, "F");
              if (d.dia <= (Number(s.longitud_ciclo) || 14)) {
                doc.setTextColor(255, 255, 255);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(6);
                doc.text(MARCA[d.estado], cx + cellW / 2, ry + cellH / 2 + 1.1, { align: "center" });
              }
            });
          });

          return altura + 2;
        });
      }

      if (slotsConId.length > MAX_SLOTS_PDF) {
        pdf.addTextoResumen(
          `Se muestran los primeros ${MAX_SLOTS_PDF} de ${slotsConId.length} slots con configuración. ` +
          `Para el detalle completo (incluyendo todos los slots), exportá a Excel.`
        );
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
    <AdminLayout title="Reporte de Plantilla de Turnos">
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
                const horaExc = slot.hora_entrada_por_dia?.[String(d.dia)];
                const tieneExc = !!horaExc && (d.estado === "trabajo" || d.estado === "medio");
                const baseTitle =
                  d.estado === "trabajo" ? `Día ${d.dia}: trabaja`
                  : d.estado === "medio"  ? `Día ${d.dia}: medio turno`
                  : `Día ${d.dia}: descanso`;
                const title = tieneExc ? `${baseTitle} · entra ${horaExc} (excepción)` : baseTitle;
                return (
                  <span
                    key={i}
                    title={title}
                    className={`relative w-6 text-center text-[10px] font-mono rounded border ${cls} ${tieneExc ? "ring-1 ring-amber-400/40" : ""}`}
                  >
                    {d.label}
                    {tieneExc && (
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400/90" />
                    )}
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
