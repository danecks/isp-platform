/**
 * pdfExport.ts — Generación de PDF membretado ISP, S.A.
 *
 * Usa jsPDF + jspdf-autotable para crear PDFs profesionales con:
 *   - Encabezado con logo, nombre de empresa, título, fecha, rango
 *   - Cuerpo con resumen ejecutivo y tablas de datos
 *   - Pie con datos de contacto, nota de confidencialidad y numeración
 *
 * USO:
 *   const pdf = new IspPdf({ titulo: "Reporte de Operaciones", desde: "...", hasta: "..." });
 *   pdf.addResumenCards([{ label: "Total", valor: "22", color: "blue" }]);
 *   pdf.addTabla(["ID", "Cliente", "Estado"], [["INC-001", "Banco", "Abierta"]]);
 *   pdf.save("reporte-operaciones.pdf");
 *
 * EXTENSIBILIDAD:
 *   - Agregar métodos para nuevos tipos de secciones (gráficas, imágenes, etc.)
 *   - El logo se carga dinámicamente desde /images/logo-isp.jpg
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PdfOptions {
  titulo: string;
  subtitulo?: string;
  desde?: string;
  hasta?: string;
  cliente?: string;
  preparedBy?: string;
  /** Fecha que aparece junto a "Emitido:" en el encabezado. Si no se
   *  pasa, se usa la fecha de hoy. Acepta YYYY-MM-DD o ISO. */
  fechaEmision?: string;
  /** Orientación de la página. Por defecto "portrait". Usar "landscape"
   *  para reportes con muchas columnas (p. ej. Libro de Salarios). */
  orientation?: "portrait" | "landscape";
  /** Encabezado compacto (membrete más bajo y logo más pequeño). Se usa en
   *  documentos de una sola hoja como el acta administrativa para ganar
   *  espacio vertical sin perder el membrete. Por defecto false. */
  compact?: boolean;
}

interface ResumenCard {
  label: string;
  valor: string | number;
  color?: "blue" | "green" | "red" | "yellow" | "gray";
}

// Colores corporativos ISP
const COLORS = {
  navy: [7, 17, 31] as [number, number, number],
  gold: [178, 140, 55] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  lightGray: [245, 247, 250] as [number, number, number],
  darkGray: [80, 90, 105] as [number, number, number],
  border: [220, 225, 230] as [number, number, number],
  blue: [59, 130, 246] as [number, number, number],
  green: [34, 197, 94] as [number, number, number],
  red: [239, 68, 68] as [number, number, number],
  yellow: [234, 179, 8] as [number, number, number],
};

const CARD_COLORS: Record<string, [number, number, number]> = {
  blue: COLORS.blue,
  green: COLORS.green,
  red: COLORS.red,
  yellow: COLORS.yellow,
  gray: COLORS.darkGray,
};

export class IspPdf {
  private doc: jsPDF;
  private opts: PdfOptions;
  private currentY: number = 0;
  private pageWidth: number;
  private pageHeight: number;
  private marginL = 15;
  private marginR = 15;
  private contentWidth: number;
  private logoDataUrl: string | null = null;
  private headerHeight = 42;

  constructor(opts: PdfOptions) {
    this.opts = opts;
    this.doc = new jsPDF({ orientation: opts.orientation ?? "portrait", unit: "mm", format: "letter" });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.contentWidth = this.pageWidth - this.marginL - this.marginR;
    if (opts.compact) this.headerHeight = 28;
  }

  // ─── Carga de logo ──────────────────────────────────────────────────────────
  async loadLogo(): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}images/logo-isp.jpg`);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          this.logoDataUrl = reader.result as string;
          resolve();
        };
        reader.onerror = () => resolve();
        reader.readAsDataURL(blob);
      });
    } catch {
      // Logo no disponible — se omite del encabezado
    }
  }

  // ─── Encabezado membretado ──────────────────────────────────────────────────
  private drawHeader(): void {
    const doc = this.doc;
    const c = this.opts.compact === true;

    // Posiciones verticales (compactas o normales)
    const logoY = c ? 4 : 7;
    const logoSize = c ? 20 : 28;
    const lineY1 = c ? 11 : 15;     // nombre empresa / título
    const lineY2 = c ? 16 : 21.5;   // 2ª línea empresa / subtítulo
    const lineY3 = c ? 21 : 28;     // tagline / emitido

    // Franja superior navy
    doc.setFillColor(...COLORS.navy);
    doc.rect(0, 0, this.pageWidth, this.headerHeight, "F");

    // Franja dorada en la parte inferior del encabezado
    doc.setFillColor(...COLORS.gold);
    doc.rect(0, this.headerHeight, this.pageWidth, 1.5, "F");

    // Logo
    if (this.logoDataUrl) {
      try {
        doc.addImage(this.logoDataUrl, "JPEG", this.marginL, logoY, logoSize, logoSize);
      } catch {
        this.drawLogoPlaceholder(this.marginL, logoY, logoSize);
      }
    } else {
      this.drawLogoPlaceholder(this.marginL, logoY, logoSize);
    }

    // Nombre de la empresa
    const textX = this.marginL + logoSize + 5;
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(c ? 11 : 13);
    doc.setFont("helvetica", "bold");
    doc.text("INVESTIGACIONES Y SEGURIDAD", textX, lineY1);
    doc.text("PROFESIONAL, S.A.", textX, lineY2);

    doc.setFontSize(c ? 7.5 : 8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.gold);
    doc.text("Seguridad • Confianza • Resultados", textX, lineY3);

    // Título del reporte (derecha)
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(c ? 10 : 11);
    doc.setFont("helvetica", "bold");
    doc.text(this.opts.titulo, this.pageWidth - this.marginR, lineY1, { align: "right" });

    if (this.opts.subtitulo) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.gold);
      doc.text(this.opts.subtitulo, this.pageWidth - this.marginR, lineY2, { align: "right" });
    }

    // Fecha de emisión (puede ser sobrescrita por opciones)
    const fechaBase = this.opts.fechaEmision
      ? (() => {
          const s = this.opts.fechaEmision!;
          // Soporta YYYY-MM-DD parseado en local (no UTC).
          if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
            const [y, m, d] = s.split("-").map(Number);
            return new Date(y, m - 1, d);
          }
          return new Date(s);
        })()
      : new Date();
    const fechaEmision = fechaBase.toLocaleDateString("es-GT", {
      day: "2-digit", month: "long", year: "numeric",
    });
    doc.setFontSize(7.5);
    doc.setTextColor(200, 210, 225);
    doc.text(`Emitido: ${fechaEmision}`, this.pageWidth - this.marginR, lineY3, { align: "right" });

    // Meta-info debajo del encabezado
    this.currentY = this.headerHeight + 6;
    doc.setTextColor(...COLORS.darkGray);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");

    const metaItems: string[] = [];
    if (this.opts.desde || this.opts.hasta) {
      const desde = this.opts.desde ? this.fmtDate(this.opts.desde) : "inicio";
      const hasta = this.opts.hasta ? this.fmtDate(this.opts.hasta) : "hoy";
      metaItems.push(`Período: ${desde} — ${hasta}`);
    } else {
      metaItems.push("Período: Todo el historial");
    }
    if (this.opts.cliente) metaItems.push(`Cliente: ${this.opts.cliente}`);
    if (this.opts.preparedBy) metaItems.push(`Preparado por: ${this.opts.preparedBy}`);

    doc.text(metaItems.join("   •   "), this.marginL, this.currentY);
    this.currentY += 4;

    // Línea separadora
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(this.marginL, this.currentY, this.pageWidth - this.marginR, this.currentY);
    this.currentY += c ? 3 : 5;
  }

  private drawLogoPlaceholder(x: number, y: number, size: number): void {
    const doc = this.doc;
    doc.setFillColor(...COLORS.gold);
    doc.roundedRect(x, y, size, size, 3, 3, "F");
    doc.setTextColor(...COLORS.navy);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("ISP", x + size / 2, y + size / 2 + 2, { align: "center" });
  }

  // ─── Pie de página ──────────────────────────────────────────────────────────
  private drawFooter(pageNum: number, totalPages: number): void {
    const doc = this.doc;
    const footerY = this.pageHeight - 12;

    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(this.marginL, footerY - 2, this.pageWidth - this.marginR, footerY - 2);

    doc.setFontSize(7);
    doc.setTextColor(...COLORS.darkGray);
    doc.setFont("helvetica", "normal");
    doc.text("ISP, S.A. — PBX (502) 2220-0000 — info@isp.com.gt — Ciudad de Guatemala, Guatemala", this.marginL, footerY + 2);

    doc.setFont("helvetica", "italic");
    doc.setTextColor(150, 160, 175);
    doc.text("DOCUMENTO CONFIDENCIAL — Uso exclusivo interno. Prohibida su reproducción o divulgación sin autorización.", this.marginL, footerY + 6);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.darkGray);
    doc.text(`Página ${pageNum} de ${totalPages}`, this.pageWidth - this.marginR, footerY + 2, { align: "right" });
  }

  // ─── Sección: Título ────────────────────────────────────────────────────────
  addSeccionTitulo(titulo: string, icon?: string): void {
    this.checkPageBreak(12);
    const doc = this.doc;

    doc.setFillColor(...COLORS.lightGray);
    doc.rect(this.marginL, this.currentY, this.contentWidth, 7, "F");

    doc.setTextColor(...COLORS.navy);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    const label = icon ? `${icon}  ${titulo}` : titulo;
    doc.text(label, this.marginL + 3, this.currentY + 5);

    doc.setDrawColor(...COLORS.gold);
    doc.setLineWidth(0.8);
    doc.line(this.marginL, this.currentY + 7, this.marginL + 30, this.currentY + 7);

    this.currentY += 12;
  }

  // ─── Sección: Tarjetas de resumen ───────────────────────────────────────────
  addResumenCards(cards: ResumenCard[]): void {
    this.checkPageBreak(28);
    const doc = this.doc;
    const count = Math.min(cards.length, 4);
    const gap = 4;
    const cardW = (this.contentWidth - gap * (count - 1)) / count;

    for (let i = 0; i < count; i++) {
      const card = cards[i];
      const x = this.marginL + i * (cardW + gap);
      const y = this.currentY;
      const h = 22;

      // Fondo tarjeta
      doc.setFillColor(...COLORS.lightGray);
      doc.roundedRect(x, y, cardW, h, 2, 2, "F");

      // Borde superior de color
      const accentColor = CARD_COLORS[card.color ?? "blue"] ?? COLORS.blue;
      doc.setFillColor(...accentColor);
      doc.rect(x, y, cardW, 1.5, "F");

      // Valor
      doc.setTextColor(...accentColor);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(String(card.valor), x + cardW / 2, y + 12, { align: "center" });

      // Label
      doc.setTextColor(...COLORS.darkGray);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text(card.label, x + cardW / 2, y + 18, { align: "center" });
    }

    this.currentY += 26;

    // Segunda fila si hay más de 4 tarjetas
    if (cards.length > 4) {
      this.addResumenCards(cards.slice(4));
    }
  }

  // ─── Sección: Texto de resumen ──────────────────────────────────────────────
  addTextoResumen(texto: string): void {
    this.checkPageBreak(15);
    const doc = this.doc;
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.darkGray);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(texto, this.contentWidth);
    doc.text(lines, this.marginL, this.currentY);
    this.currentY += lines.length * 4.5 + 4;
  }

  // ─── Sección: Tabla ─────────────────────────────────────────────────────────
  addTabla(
    columnas: string[],
    filas: (string | number)[][],
    titulo?: string,
    tableOpts?: {
      styles?: Record<string, unknown>;
      headStyles?: Record<string, unknown>;
      columnStyles?: Record<number, Record<string, unknown>>;
    },
  ): void {
    if (titulo) {
      this.checkPageBreak(8);
      const doc = this.doc;
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.navy);
      doc.text(titulo, this.marginL, this.currentY);
      this.currentY += 5;
    }

    autoTable(this.doc, {
      startY: this.currentY,
      head: [columnas],
      body: filas.map((row) => row.map(String)),
      margin: { left: this.marginL, right: this.marginR },
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        lineColor: COLORS.border,
        lineWidth: 0.2,
        textColor: [50, 60, 75],
        overflow: "linebreak",
        ...(tableOpts?.styles ?? {}),
      },
      headStyles: {
        fillColor: COLORS.navy,
        textColor: COLORS.white,
        fontStyle: "bold",
        fontSize: 7.5,
        cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
        ...(tableOpts?.headStyles ?? {}),
      },
      ...(tableOpts?.columnStyles ? { columnStyles: tableOpts.columnStyles } : {}),
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      tableLineColor: COLORS.border,
      tableLineWidth: 0.3,
      didDrawPage: () => {
        this.drawHeader();
      },
    });

    const finalY = (this.doc as any).lastAutoTable?.finalY;
    this.currentY = (finalY != null ? finalY + 8 : this.currentY + 20);
  }

  addTextoBold(texto: string, fontSize = 9): void {
    this.checkPageBreak(15);
    const doc = this.doc;
    doc.setFontSize(fontSize);
    doc.setTextColor(...COLORS.navy);
    doc.setFont("helvetica", "bold");
    const lines = doc.splitTextToSize(texto, this.contentWidth);
    doc.text(lines, this.marginL, this.currentY);
    this.currentY += lines.length * (fontSize * 0.45) + 3;
  }

  addTextoCentrado(texto: string, fontSize = 10, bold = false): void {
    this.checkPageBreak(15);
    const doc = this.doc;
    doc.setFontSize(fontSize);
    doc.setTextColor(...COLORS.navy);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(texto, this.contentWidth);
    for (const line of lines) {
      doc.text(line, this.pageWidth / 2, this.currentY, { align: "center" });
      this.currentY += fontSize * 0.45;
    }
    this.currentY += 3;
  }

  addTextoJustificado(texto: string, fontSize = 9, indent = 0): void {
    this.checkPageBreak(15);
    const doc = this.doc;
    doc.setFontSize(fontSize);
    doc.setTextColor(...COLORS.darkGray);
    doc.setFont("helvetica", "normal");
    const width = this.contentWidth - indent;
    const lines = doc.splitTextToSize(texto, width);
    doc.text(lines, this.marginL + indent, this.currentY);
    this.currentY += lines.length * (fontSize * 0.48) + 2;
  }

  addLinea(): void {
    const doc = this.doc;
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(this.marginL, this.currentY, this.pageWidth - this.marginR, this.currentY);
    this.currentY += 3;
  }

  addFirmaDoble(izq: { label: string; nombre: string }, der: { label: string; nombre: string }): void {
    this.checkPageBreak(14);
    const doc = this.doc;
    const halfW = this.contentWidth / 2 - 5;
    const xIzq = this.marginL + halfW / 2;
    const xDer = this.marginL + this.contentWidth / 2 + 5 + halfW / 2;

    doc.setDrawColor(...COLORS.darkGray);
    doc.setLineWidth(0.3);
    doc.line(this.marginL + 5, this.currentY, this.marginL + halfW - 5, this.currentY);
    doc.line(this.marginL + this.contentWidth / 2 + 10, this.currentY, this.pageWidth - this.marginR - 5, this.currentY);

    this.currentY += 4;
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.darkGray);
    doc.setFont("helvetica", "bold");
    doc.text(izq.label, xIzq, this.currentY, { align: "center" });
    doc.text(der.label, xDer, this.currentY, { align: "center" });
    this.currentY += 3.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(izq.nombre, xIzq, this.currentY, { align: "center" });
    doc.text(der.nombre, xDer, this.currentY, { align: "center" });
    this.currentY += 6;
  }

  addFirmaContrato(
    patrono: { label: string; nombre: string },
    trabajador: { label: string; nombre: string },
    notaPie?: string,
  ): void {
    this.checkPageBreak(70);
    const doc = this.doc;
    const halfW = this.contentWidth / 2 - 5;
    const xIzq = this.marginL + halfW / 2;
    const xDer = this.marginL + this.contentWidth / 2 + 5 + halfW / 2;

    // Líneas de firma
    doc.setDrawColor(...COLORS.darkGray);
    doc.setLineWidth(0.3);
    doc.line(this.marginL + 5, this.currentY, this.marginL + halfW - 5, this.currentY);
    doc.line(this.marginL + this.contentWidth / 2 + 10, this.currentY, this.pageWidth - this.marginR - 5, this.currentY);

    this.currentY += 4;
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.darkGray);
    doc.setFont("helvetica", "bold");
    doc.text(patrono.label, xIzq, this.currentY, { align: "center" });
    doc.text(trabajador.label, xDer, this.currentY, { align: "center" });
    this.currentY += 3.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const izqLines = patrono.nombre.split("\n");
    const derLines = trabajador.nombre.split("\n");
    const startY = this.currentY;
    izqLines.forEach((ln, i) => {
      doc.text(ln, xIzq, startY + i * 3.5, { align: "center" });
    });
    derLines.forEach((ln, i) => {
      doc.text(ln, xDer, startY + i * 3.5, { align: "center" });
    });
    const maxLines = Math.max(izqLines.length, derLines.length);
    this.currentY = startY + maxLines * 3.5 + 2;

    // Cuadro de huella dactilar (solo lado del trabajador)
    const huellaW = 32;
    const huellaH = 32;
    const huellaX = xDer - huellaW / 2;
    const huellaY = this.currentY + 2;
    doc.setDrawColor(...COLORS.darkGray);
    doc.setLineWidth(0.3);
    doc.rect(huellaX, huellaY, huellaW, huellaH);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...COLORS.darkGray);
    doc.text("Huella dactilar", xDer, huellaY + huellaH + 3, { align: "center" });
    doc.text("índice derecho", xDer, huellaY + huellaH + 6, { align: "center" });

    this.currentY = huellaY + huellaH + 10;

    // Nota legal al pie (debajo de ambas firmas, ancho completo)
    if (notaPie) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(...COLORS.darkGray);
      const lines = doc.splitTextToSize(notaPie, this.contentWidth);
      doc.text(lines, this.marginL, this.currentY);
      this.currentY += lines.length * 3 + 2;
    }
  }

  addFirmaSimple(label: string, nombre: string): void {
    this.checkPageBreak(20);
    const doc = this.doc;
    const cx = this.pageWidth / 2;

    doc.setDrawColor(...COLORS.darkGray);
    doc.setLineWidth(0.3);
    doc.line(cx - 40, this.currentY, cx + 40, this.currentY);

    this.currentY += 4;
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.darkGray);
    doc.setFont("helvetica", "bold");
    doc.text(label, cx, this.currentY, { align: "center" });
    this.currentY += 3.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(nombre, cx, this.currentY, { align: "center" });
    this.currentY += 6;
  }

  // ─── Espacio ─────────────────────────────────────────────────────────────────
  addEspacio(mm = 6): void {
    this.currentY += mm;
  }

  // ─── Bloque personalizado ────────────────────────────────────────────────────
  /**
   * Permite dibujar contenido arbitrario en el PDF (mini-grids, gráficos, etc.).
   * El callback recibe el contexto de dibujo y debe devolver la altura usada en mm.
   * Maneja paginación automática según `estimatedHeight`.
   */
  addCustomBlock(
    estimatedHeight: number,
    render: (ctx: {
      doc: jsPDF;
      x: number;
      y: number;
      width: number;
      colors: typeof COLORS;
    }) => number,
  ): void {
    this.checkPageBreak(estimatedHeight);
    const usedHeight = render({
      doc: this.doc,
      x: this.marginL,
      y: this.currentY,
      width: this.contentWidth,
      colors: COLORS,
    });
    this.currentY += usedHeight;
  }

  // ─── Control de páginas ──────────────────────────────────────────────────────
  private checkPageBreak(needed: number): void {
    if (this.currentY + needed > this.pageHeight - 20) {
      this.doc.addPage();
      this.drawHeader();
    }
  }

  // ─── Generar y descargar ─────────────────────────────────────────────────────
  async build(): Promise<IspPdf> {
    await this.loadLogo();
    this.drawHeader();
    return this;
  }

  save(filename: string): void {
    const totalPages = this.doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      this.drawFooter(i, totalPages);
    }
    this.doc.save(filename);
  }

  /**
   * Devuelve el PDF (con pies de página) como base64 SIN descargarlo, para
   * subirlo a un servicio externo (p. ej. Google Drive). No llamar junto con
   * `save()` sobre la misma instancia: ambos dibujan el pie de página.
   */
  toBase64(): string {
    const totalPages = this.doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      this.drawFooter(i, totalPages);
    }
    const datauri = this.doc.output("datauristring");
    const comma = datauri.indexOf(",");
    return comma >= 0 ? datauri.slice(comma + 1) : datauri;
  }

  // ─── Exportar CSV ────────────────────────────────────────────────────────────
  static exportCsv(columnas: string[], filas: (string | number)[][], filename: string): void {
    const escape = (v: string | number) => {
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const rows = [columnas, ...filas].map((r) => r.map(escape).join(",")).join("\n");
    const bom = "\uFEFF"; // BOM para Excel
    const blob = new Blob([bom + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Helper de fechas ────────────────────────────────────────────────────────
  private fmtDate(iso: string): string {
    try {
      // YYYY-MM-DD se interpreta en hora local (no UTC) para evitar
      // corrimientos de un día en zonas con offset negativo (p. ej. GT).
      const d = /^\d{4}-\d{2}-\d{2}$/.test(iso)
        ? (() => { const [y, m, dd] = iso.split("-").map(Number); return new Date(y, m - 1, dd); })()
        : new Date(iso);
      return d.toLocaleDateString("es-GT", {
        day: "2-digit", month: "short", year: "numeric",
      });
    } catch {
      return iso;
    }
  }
}
