import { jsPDF } from "jspdf";

export interface DatosActaPdf {
  amonestacion: {
    id: number;
    employee_id: number;
    empleado_nombre: string;
    creado_por_username: string | null;
    creado_por_rol: string;
    tipo: string;
    motivo: string;
    descripcion: string | null;
    monto: number;
    cliente_nombre: string | null;
    puesto_nombre: string | null;
    fecha: string;
    causal_legal: string | null;
    articulo_legal: string | null;
    acta_numero: number | null;
    aplica_descuento: boolean;
    firma_colaborador: string | null;
    firma_levanta: string | null;
    firmada_at: string | null;
    monto_descuento_vinculado?: number | null;
    descuento_estado?: string | null;
  };
  config: {
    nombre_empresa?: string | null;
    direccion_empresa?: string | null;
    nit_empresa?: string | null;
    representante_nombre?: string | null;
    representante_dpi?: string | null;
    telefono_empresa?: string | null;
  } | null;
  empleado: {
    nombre_completo: string;
    dpi: string | null;
    fecha_ingreso: string | null;
    cargo: string | null;
  } | null;
  puesto: { puesto_nombre: string | null; cliente_nombre: string | null } | null;
}

function fmtFechaLarga(s?: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

export function generarActaPdf(datos: DatosActaPdf): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const M = 50; // margen
  let y = M;

  const { amonestacion: a, config, empleado, puesto } = datos;
  const empresaNombre = config?.nombre_empresa || "ISP — Investigaciones y Seguridad Profesional, S.A.";
  const direccion = config?.direccion_empresa || "—";
  const repNombre = config?.representante_nombre || "Representante Legal";
  const repDpi = config?.representante_dpi || "—";
  const ubicacion = puesto?.cliente_nombre ? puesto.cliente_nombre : "Ciudad de Guatemala";

  // Encabezado
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(empresaNombre.toUpperCase(), W / 2, y, { align: "center" });
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(direccion, W / 2, y, { align: "center" });
  if (config?.nit_empresa) { y += 11; doc.text(`NIT: ${config.nit_empresa}`, W / 2, y, { align: "center" }); }
  y += 14;

  // Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const titulo = a.tipo === "acta_administrativa"
    ? `ACTA ADMINISTRATIVA No. ${a.acta_numero ?? a.id}`
    : a.tipo === "economica"
      ? `AMONESTACIÓN ECONÓMICA No. ${a.id}`
      : `LLAMADA DE ATENCIÓN No. ${a.id}`;
  doc.text(titulo, W / 2, y, { align: "center" });
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  // Cuerpo introductorio
  const fechaTxt = fmtFechaLarga(a.fecha);
  const intro = `En ${ubicacion}, siendo el día ${fechaTxt}, comparecen por una parte el señor(a) ${repNombre}, quien se identifica con DPI ${repDpi}, en su calidad de representante legal de ${empresaNombre}; y por la otra parte el(la) colaborador(a) ${empleado?.nombre_completo || a.empleado_nombre}, quien se identifica con DPI ${empleado?.dpi || "—"}, con cargo de ${puesto?.puesto_nombre || empleado?.cargo || "—"}, asignado(a) al cliente ${puesto?.cliente_nombre || a.cliente_nombre || "—"}, con fecha de ingreso ${empleado?.fecha_ingreso ? fmtFechaLarga(empleado.fecha_ingreso) : "—"}; con el objeto de hacer constar lo siguiente:`;
  y = wrapText(doc, intro, M, y, W - 2 * M, 12);
  y += 8;

  // Hechos
  doc.setFont("helvetica", "bold");
  doc.text("PRIMERO — HECHOS:", M, y); y += 12;
  doc.setFont("helvetica", "normal");
  const hechos = `Se levanta el presente documento por el siguiente motivo: ${a.motivo}.${a.descripcion ? " " + a.descripcion : ""}`;
  y = wrapText(doc, hechos, M, y, W - 2 * M, 12);
  y += 8;

  // Fundamento legal (solo acta)
  if (a.tipo === "acta_administrativa") {
    doc.setFont("helvetica", "bold");
    doc.text("SEGUNDO — FUNDAMENTO LEGAL:", M, y); y += 12;
    doc.setFont("helvetica", "normal");
    const fund = `El presente acto se fundamenta en el ${a.articulo_legal || "Art. 77 del Código de Trabajo de Guatemala"}, inciso ${a.causal_legal || "—"}, que se transcribe en lo conducente como motivo de la presente acta administrativa.`;
    y = wrapText(doc, fund, M, y, W - 2 * M, 12);
    y += 8;
  }

  // Sanción
  doc.setFont("helvetica", "bold");
  doc.text(a.tipo === "acta_administrativa" ? "TERCERO — SANCIÓN:" : "SEGUNDO — SANCIÓN:", M, y); y += 12;
  doc.setFont("helvetica", "normal");
  let sancion = "";
  if (a.tipo === "llamada_atencion") {
    sancion = "Se aplica al colaborador una llamada de atención por escrito, la cual queda registrada en su expediente. El colaborador queda apercibido de que la reincidencia podrá motivar sanciones más severas conforme al Reglamento Interior de Trabajo y al Código de Trabajo.";
  } else if (a.tipo === "economica") {
    sancion = `Se aplica al colaborador una amonestación económica por la cantidad de Q ${a.monto.toFixed(2)} (${enLetras(a.monto)}), la cual será descontada en la próxima planilla del periodo correspondiente.`;
  } else {
    {
      const montoDesc = a.monto_descuento_vinculado ?? 0;
      const anulada = a.descuento_estado === "anulada";
      const partes = ["Se levanta la presente Acta Administrativa, dejando constancia del incumplimiento descrito."];
      if (a.aplica_descuento && montoDesc > 0 && !anulada) {
        partes.push(`Adicionalmente se aplica un descuento económico de Q ${montoDesc.toFixed(2)} (${enLetras(montoDesc)}) en planilla del periodo correspondiente.`);
      } else if (a.aplica_descuento && anulada) {
        partes.push("El descuento económico vinculado fue posteriormente anulado.");
      }
      partes.push("El colaborador queda formalmente notificado del contenido de esta acta y de las consecuencias previstas en el Código de Trabajo y en el Reglamento Interior de Trabajo de la empresa, incluyendo la posibilidad de despido justificado en caso de reincidencia o gravedad.");
      sancion = partes.join(" ");
    }
  }
  y = wrapText(doc, sancion, M, y, W - 2 * M, 12);
  y += 12;

  // Conformidad
  doc.setFont("helvetica", "bold");
  doc.text(a.tipo === "acta_administrativa" ? "CUARTO — CONFORMIDAD:" : "TERCERO — CONFORMIDAD:", M, y); y += 12;
  doc.setFont("helvetica", "normal");
  const conf = "Los comparecientes manifiestan estar enterados del contenido de la presente, de su validez legal y de los efectos que produce. Para constancia firman al pie quien la levanta y el(la) colaborador(a) sancionado(a). En caso de negativa de firma del colaborador, se hará constar dicha circunstancia.";
  y = wrapText(doc, conf, M, y, W - 2 * M, 12);
  y += 24;

  // Firmas — dos columnas
  const colW = (W - 2 * M - 40) / 2;
  const xCol1 = M;
  const xCol2 = M + colW + 40;
  // si no cabe, salto
  if (y > doc.internal.pageSize.getHeight() - 140) {
    doc.addPage();
    y = M + 20;
  }
  // línea para firma
  doc.line(xCol1, y, xCol1 + colW, y);
  doc.line(xCol2, y, xCol2 + colW, y);
  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("FIRMA DEL COLABORADOR", xCol1, y);
  doc.text(`FIRMA DE QUIEN LEVANTA (${a.creado_por_rol.toUpperCase()})`, xCol2, y);
  y += 11;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(a.firma_colaborador || (empleado?.nombre_completo || a.empleado_nombre), xCol1, y);
  doc.text(a.firma_levanta || (a.creado_por_username || repNombre), xCol2, y);
  y += 11;
  doc.text(`DPI: ${empleado?.dpi || "—"}`, xCol1, y);
  doc.text(a.firmada_at ? `Fecha de firma: ${fmtFechaLarga(a.firmada_at)}` : `Fecha: ${fechaTxt}`, xCol2, y);

  // Pie
  const yFoot = doc.internal.pageSize.getHeight() - 28;
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(`Documento generado el ${new Date().toLocaleString("es-GT")} — ${empresaNombre} — Acta #${a.acta_numero ?? a.id}`, W / 2, yFoot, { align: "center" });

  return doc;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function wrapText(doc: jsPDF, text: string, x: number, y: number, maxW: number, lineH: number): number {
  const lines = doc.splitTextToSize(text, maxW) as string[];
  for (const line of lines) {
    if (y > doc.internal.pageSize.getHeight() - 80) {
      doc.addPage();
      y = 56;
    }
    doc.text(line, x, y);
    y += lineH;
  }
  return y;
}

function enLetras(n: number): string {
  // versión simple: "Quetzales con XX/100"
  const entero = Math.floor(n);
  const cents = Math.round((n - entero) * 100);
  return `${entero} quetzales con ${cents.toString().padStart(2, "0")}/100`;
}
