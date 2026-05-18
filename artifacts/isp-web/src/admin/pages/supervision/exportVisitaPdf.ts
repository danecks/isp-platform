import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import type { SupervisionProgramacion } from "./types";
import { TIPO_LABEL, ESTADO_LABEL } from "./types";

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable: { finalY: number };
  internal: jsPDF["internal"] & { getNumberOfPages: () => number };
};

function lastTableY(doc: jsPDF): number {
  return (doc as JsPdfWithAutoTable).lastAutoTable.finalY;
}
function pageCount(doc: jsPDF): number {
  return (doc as JsPdfWithAutoTable).internal.getNumberOfPages();
}

interface GpsPoint {
  latitud: number;
  longitud: number;
  capturado_en: string;
}
interface GeofenceEvento {
  id: number;
  tipo: "entry" | "exit";
  ocurrido_at: string;
  puesto_nombre: string | null;
  distancia_m: number | null;
  radio_m: number | null;
  accuracy_m: number | null;
}

export interface VisitaPdfData {
  visita: SupervisionProgramacion;
  iniciada_at: string | null;
  completada_at: string | null;
  permanencia_segundos: number;
  auto_iniciada: boolean;
  eventos: GeofenceEvento[];
  puntosGps: GpsPoint[];
  mapElement: HTMLElement | null;
}

function fmtDuracion(seg: number): string {
  if (!seg || seg <= 0) return "0 min";
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} min`;
}
function fmtHora(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}
function fmtFechaHora(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString("es-GT")} ${d.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}`;
  } catch { return iso; }
}

export async function exportVisitaPdf(data: VisitaPdfData): Promise<void> {
  const { visita, iniciada_at, completada_at, permanencia_segundos, auto_iniciada, eventos, puntosGps, mapElement } = data;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Reporte de visita de supervisión", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Generado: ${new Date().toLocaleString("es-GT")}`, margin, y);
  y += 6;
  doc.setTextColor(0);

  doc.setDrawColor(220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Información general", margin, y);
  y += 5;

  const ubicacion = [visita.cliente_nombre, visita.puesto_nombre, visita.zona_nombre].filter(Boolean).join(" · ") || "—";
  const ventana = visita.ventana_inicio
    ? `${visita.ventana_inicio}${visita.ventana_fin ? `–${visita.ventana_fin}` : ""}`
    : "—";

  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.5 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 42, textColor: [80, 80, 80] },
      1: { cellWidth: "auto" },
    },
    body: [
      ["Supervisor", visita.supervisor_nombre || "—"],
      ["Tipo", TIPO_LABEL[visita.tipo] || visita.tipo],
      ["Estado", ESTADO_LABEL[visita.estado] || visita.estado],
      ["Ubicación", ubicacion],
      ["Fecha planificada", visita.fecha_planificada || "—"],
      ["Ventana planificada", ventana],
      ["Inicio real", fmtFechaHora(iniciada_at) + (auto_iniciada ? " (auto-iniciada por entry)" : "")],
      ["Fin real", fmtFechaHora(completada_at)],
    ],
    margin: { left: margin, right: margin },
  });
  y = lastTableY(doc) + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Indicadores", margin, y);
  y += 5;

  const numEntries = eventos.filter(e => e.tipo === "entry").length;
  const numExits = eventos.filter(e => e.tipo === "exit").length;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2, halign: "center" },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
    head: [["Inicio real", "Fin real", "Permanencia", "Llegadas / Salidas", "Puntos GPS"]],
    body: [[
      fmtHora(iniciada_at),
      fmtHora(completada_at),
      fmtDuracion(permanencia_segundos),
      `${numEntries} / ${numExits}`,
      String(puntosGps.length),
    ]],
    margin: { left: margin, right: margin },
  });
  y = lastTableY(doc) + 6;

  const hayDatosMapa = puntosGps.length > 0 || eventos.length > 0;
  if (mapElement && hayDatosMapa) {
    const canvas = await html2canvas(mapElement, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      scale: 2,
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`No se pudo capturar el mapa para el PDF: ${msg}`);
    });
    const imgData = canvas.toDataURL("image/png");
    const maxWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * maxWidth) / canvas.width;
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + imgHeight + 10 > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Mapa del recorrido", margin, y);
    y += 4;
    doc.addImage(imgData, "PNG", margin, y, maxWidth, imgHeight);
    y += imgHeight + 6;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Mapa del recorrido", margin, y);
    y += 5;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text("Sin recorrido ni eventos de geofence registrados para esta visita.", margin, y);
    doc.setTextColor(0);
    y += 8;
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + 30 > pageHeight - margin) {
    doc.addPage();
    y = margin;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Llegadas y salidas", margin, y);
  y += 4;

  if (eventos.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text("No se registraron eventos de geofence para esta visita.", margin, y + 4);
    doc.setTextColor(0);
    y += 10;
  } else {
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
      head: [["Evento", "Hora", "Puesto", "Distancia", "Precisión GPS"]],
      body: eventos.map(ev => [
        ev.tipo === "entry" ? "Llegó" : "Salió",
        fmtFechaHora(ev.ocurrido_at),
        ev.puesto_nombre || "—",
        ev.distancia_m != null
          ? `${Math.round(ev.distancia_m)}m${ev.radio_m != null ? ` (radio ${Math.round(ev.radio_m)}m)` : ""}`
          : "—",
        ev.accuracy_m != null ? `±${Math.round(ev.accuracy_m)}m` : "—",
      ]),
      margin: { left: margin, right: margin },
    });
  }

  const totalPages = pageCount(doc);
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Página ${i} de ${totalPages} · ISP - Investigaciones y Seguridad Profesional S.A.`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: "center" }
    );
  }

  const fecha = (visita.fecha_planificada || new Date().toISOString().slice(0, 10)).replace(/[^0-9-]/g, "");
  const supervisor = (visita.supervisor_nombre || "supervisor").replace(/[^a-zA-Z0-9]+/g, "_");
  doc.save(`visita_${visita.id}_${supervisor}_${fecha}.pdf`);
}
