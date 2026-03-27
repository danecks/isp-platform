/**
 * pdfRrhh.ts — Generación de documentos RRHH membretados
 *
 * Usa la clase IspPdf para generar:
 *   - Boleta de descuento por falta
 *   - Acta administrativa
 *
 * USO:
 *   await generarBoletaDescuento(evento);
 *   await generarActaAdministrativa(evento);
 */

import { IspPdf } from "./pdfExport";

export interface EventoRrhh {
  id: number;
  employee_id?: number;
  employee_nombre: string;
  employee_dpi?: string;
  tipo_evento: string;
  fecha: string;
  cliente_nombre?: string;
  puesto_nombre?: string;
  supervisor_nombre?: string;
  generado_desde?: string;
  estado: string;
  estado_anterior?: string;
  observaciones?: string;
  notas?: string;
  usuario_generador?: string;
  documentos_generados?: Array<{ tipo: string; usuario: string; fecha: string }>;
  created_at?: string;
  anulado_por?: string;
  anulado_at?: string;
  motivo_anulacion?: string;
}

const fmtFecha = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString("es-GT", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

const fmtFechaCorta = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString("es-GT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

const tipoLabel = (tipo: string): string => {
  const map: Record<string, string> = {
    falta: "FALTA INJUSTIFICADA",
    suspension: "SUSPENSIÓN LABORAL",
  };
  return map[tipo] ?? tipo.toUpperCase();
};

export const MOTIVO_ANULACION_LABELS: Record<string, string> = {
  error_registro: "Error de registro",
  agente_asistio: "El agente sí asistió",
  duplicado: "Registro duplicado",
  otro: "Otro motivo",
};

// ─── Boleta de Descuento ──────────────────────────────────────────────────────
export async function generarBoletaDescuento(evento: EventoRrhh): Promise<void> {
  const pdf = new IspPdf({
    titulo: "BOLETA DE DESCUENTO",
    subtitulo: `Evento #${evento.id} — ${tipoLabel(evento.tipo_evento)}`,
    preparedBy: evento.usuario_generador || "Sistema",
  });

  await pdf.build();

  pdf.addSeccionTitulo("Datos del Colaborador");

  pdf.addTextoResumen(
    `La presente boleta documenta el descuento correspondiente por ${tipoLabel(evento.tipo_evento).toLowerCase()} ` +
    `registrada para el colaborador indicado a continuación.`,
  );

  pdf.addTabla(
    ["Campo", "Detalle"],
    [
      ["Nombre del colaborador", evento.employee_nombre],
      ["DPI (últimos 4 dígitos)", evento.employee_dpi ? evento.employee_dpi.replace(/\*/g, "●") : "No registrado"],
      ["Fecha del evento", fmtFecha(evento.fecha)],
      ["Tipo de evento", tipoLabel(evento.tipo_evento)],
      ["Cliente / Instalación", evento.cliente_nombre || "No especificado"],
      ["Puesto asignado", evento.puesto_nombre || "No especificado"],
      ["Supervisor a cargo", evento.supervisor_nombre || "No especificado"],
      ["Generado por", evento.usuario_generador || "Sistema"],
      ["Fecha de emisión", fmtFechaCorta(new Date().toISOString())],
      ["No. de evento RRHH", `ERH-${String(evento.id).padStart(4, "0")}`],
    ],
  );

  pdf.addEspacio(4);
  pdf.addSeccionTitulo("Motivo y Observaciones");

  pdf.addTextoResumen(
    evento.observaciones ||
    `El colaborador no se presentó al puesto de trabajo asignado el día ${fmtFechaCorta(evento.fecha)}, ` +
    `generando una falta en la cobertura operativa. Esta boleta servirá como respaldo formal del ` +
    `descuento correspondiente según el reglamento interno de ISP, S.A.`,
  );

  if (evento.notas) {
    pdf.addEspacio(2);
    pdf.addTextoResumen(`Notas adicionales: ${evento.notas}`);
  }

  pdf.addEspacio(8);
  pdf.addSeccionTitulo("Firmas y Autorización");

  pdf.addTabla(
    ["Rol", "Nombre", "Firma", "Fecha"],
    [
      ["Elaborado por", evento.usuario_generador || "Jefe de Operaciones", "___________________", fmtFechaCorta(new Date().toISOString())],
      ["Supervisor de Área", evento.supervisor_nombre || "________________________", "___________________", "_____ / _____ / _____"],
      ["Colaborador", evento.employee_nombre, "___________________", "_____ / _____ / _____"],
      ["Gerencia RRHH", "________________________", "___________________", "_____ / _____ / _____"],
    ],
    "Cuadro de firmas",
  );

  pdf.addEspacio(6);
  pdf.addTextoResumen(
    "NOTA LEGAL: Este documento tiene validez legal como instrumento administrativo de descuento salarial según el Artículo 61 literal g) del Código de Trabajo de Guatemala (Decreto 1441). La firma del colaborador no implica aceptación de culpabilidad sino simple recibo del documento.",
  );

  const filename = `boleta-descuento-ERH-${String(evento.id).padStart(4, "0")}-${evento.employee_nombre.split(" ")[0].toLowerCase()}.pdf`;
  pdf.save(filename);
}

// ─── Acta Administrativa ──────────────────────────────────────────────────────
export async function generarActaAdministrativa(evento: EventoRrhh): Promise<void> {
  const pdf = new IspPdf({
    titulo: "ACTA ADMINISTRATIVA",
    subtitulo: `Evento #${evento.id} — ${tipoLabel(evento.tipo_evento)}`,
    preparedBy: evento.usuario_generador || "Sistema",
  });

  await pdf.build();

  const numActa = `ACT-${String(evento.id).padStart(5, "0")}`;
  const fechaEmision = fmtFecha(new Date().toISOString());

  pdf.addSeccionTitulo("Acta Administrativa de Recursos Humanos");

  pdf.addTextoResumen(
    `En la Ciudad de Guatemala, el día ${fechaEmision}, la empresa INVESTIGACIONES Y SEGURIDAD PROFESIONAL, S.A. ` +
    `(en adelante "LA EMPRESA"), con domicilio en la Ciudad de Guatemala, República de Guatemala, levanta la ` +
    `presente ACTA ADMINISTRATIVA con número de referencia ${numActa}, en relación al evento descrito a continuación.`,
  );

  pdf.addEspacio(4);
  pdf.addSeccionTitulo("I. Partes Involucradas");

  pdf.addTabla(
    ["Parte", "Información"],
    [
      ["LA EMPRESA", "Investigaciones y Seguridad Profesional, S.A. — ISP, S.A."],
      ["EL COLABORADOR", evento.employee_nombre],
      ["DPI (últimos 4)", evento.employee_dpi ? evento.employee_dpi.replace(/\*/g, "●") : "No disponible"],
      ["Supervisor Directo", evento.supervisor_nombre || "No especificado"],
      ["Cliente / Instalación", evento.cliente_nombre || "No especificado"],
      ["Puesto Operativo", evento.puesto_nombre || "No especificado"],
    ],
  );

  pdf.addEspacio(4);
  pdf.addSeccionTitulo("II. Descripción del Evento");

  const tipoTexto = evento.tipo_evento === "falta"
    ? "FALTA INJUSTIFICADA AL TURNO DE TRABAJO"
    : "SUSPENSIÓN LABORAL";

  pdf.addTabla(
    ["Campo", "Detalle"],
    [
      ["Tipo de evento", tipoTexto],
      ["Fecha del evento", fmtFecha(evento.fecha)],
      ["Registrado en sistema", fmtFecha(evento.created_at || evento.fecha)],
      ["Registrado por", evento.usuario_generador || "Sistema automatizado"],
      ["Módulo de origen", "Centro de Operaciones — Pizarrón Operativo"],
      ["Número de acta", numActa],
    ],
  );

  pdf.addEspacio(4);
  pdf.addSeccionTitulo("III. Descripción de los Hechos");

  const hechos = evento.observaciones
    ? evento.observaciones
    : evento.tipo_evento === "falta"
    ? `El colaborador ${evento.employee_nombre} no se presentó al puesto de trabajo "${evento.puesto_nombre || "asignado"}" ` +
      `en las instalaciones del cliente ${evento.cliente_nombre || "no especificado"}, el día ` +
      `${fmtFecha(evento.fecha)}. Dicha ausencia fue registrada por el supervisor de operaciones ` +
      `${evento.supervisor_nombre || "en turno"} a través del sistema de gestión operativa de ISP, S.A., ` +
      `generando descubierto en el puesto y afectando la cobertura del cliente.`
    : `El colaborador ${evento.employee_nombre} fue objeto de una medida de suspensión laboral el día ` +
      `${fmtFecha(evento.fecha)}, registrada por ${evento.supervisor_nombre || "el supervisor en turno"} ` +
      `en el sistema de gestión operativa de ISP, S.A.`;

  pdf.addTextoResumen(hechos);

  if (evento.notas) {
    pdf.addEspacio(3);
    pdf.addTextoResumen(`Observaciones adicionales del supervisor: ${evento.notas}`);
  }

  pdf.addEspacio(4);
  pdf.addSeccionTitulo("IV. Consecuencias y Resolución");

  const consecuencias: string[][] =
    evento.tipo_evento === "falta"
      ? [
          ["1", "Descuento en planilla del día no laborado según Artículo 82 del Código de Trabajo."],
          ["2", "Registro en expediente laboral del colaborador como antecedente disciplinario."],
          ["3", "Notificación al colaborador mediante boleta de descuento complementaria."],
          ["4", "Evaluación para posibles medidas adicionales según reglamento interno."],
        ]
      : [
          ["1", "Suspensión temporal con o sin goce de salario según resolución de RRHH."],
          ["2", "Registro en expediente laboral del colaborador."],
          ["3", "Investigación disciplinaria si aplica."],
          ["4", "Notificación formal al colaborador."],
        ];

  pdf.addTabla(["#", "Consecuencia / Acción"], consecuencias);

  pdf.addEspacio(4);
  pdf.addSeccionTitulo("V. Firmas y Certificación");

  pdf.addTextoResumen(
    "En fe de lo anterior, firman los comparecientes en señal de conformidad con lo consignado en el presente instrumento administrativo.",
  );

  pdf.addTabla(
    ["Rol", "Nombre Completo", "Firma / Sello", "Fecha"],
    [
      ["Elaboró", evento.usuario_generador || "Jefe de Operaciones", "___________________", fmtFechaCorta(new Date().toISOString())],
      ["Supervisor", evento.supervisor_nombre || "________________________", "___________________", "_____ / _____ / _____"],
      ["El Colaborador", evento.employee_nombre, "___________________", "_____ / _____ / _____"],
      ["Gerencia RRHH", "________________________", "___________________", "_____ / _____ / _____"],
      ["Dirección General", "________________________", "___________________", "_____ / _____ / _____"],
    ],
    "Cuadro de certificación",
  );

  pdf.addEspacio(5);
  pdf.addTextoResumen(
    `La presente acta queda archivada en el expediente del colaborador con referencia ${numActa} ` +
    `y forma parte del historial disciplinario-administrativo de ISP, S.A. Cualquier impugnación deberá ` +
    `realizarse dentro de los 5 días hábiles siguientes a la notificación, ante el departamento de Recursos Humanos.`,
  );

  const filename = `acta-administrativa-${numActa}-${evento.employee_nombre.split(" ")[0].toLowerCase()}.pdf`;
  pdf.save(filename);
}

// ─── Documento de Anulación (con marca ANULADO) ───────────────────────────────
export async function generarDocumentoAnulacion(evento: EventoRrhh): Promise<void> {
  const numEvento = `ERH-${String(evento.id).padStart(4, "0")}`;
  const motivoLabel = MOTIVO_ANULACION_LABELS[evento.motivo_anulacion ?? ""] ?? evento.motivo_anulacion ?? "No especificado";

  const pdf = new IspPdf({
    titulo: "ACTA DE ANULACIÓN",
    subtitulo: `Evento ${numEvento} — DOCUMENTO ANULADO`,
    preparedBy: evento.anulado_por || "Sistema",
  });

  await pdf.build();

  pdf.addSeccionTitulo("Aviso de Anulación");

  pdf.addTextoResumen(
    `El presente documento certifica la ANULACIÓN FORMAL del evento RRHH con referencia ${numEvento}, ` +
    `correspondiente al colaborador ${evento.employee_nombre}. La anulación fue procesada el ` +
    `${fmtFecha(evento.anulado_at || new Date().toISOString())} por ${evento.anulado_por || "un usuario autorizado"}, ` +
    `dejando sin efecto los documentos originalmente generados (boleta de descuento y/o acta administrativa).`,
  );

  pdf.addEspacio(4);
  pdf.addSeccionTitulo("I. Datos del Evento Anulado");

  pdf.addTabla(
    ["Campo", "Información"],
    [
      ["No. de evento", numEvento],
      ["Colaborador", evento.employee_nombre],
      ["DPI (últimos 4)", evento.employee_dpi ? evento.employee_dpi.replace(/\*/g, "●") : "No disponible"],
      ["Tipo de evento original", tipoLabel(evento.tipo_evento)],
      ["Fecha del evento original", fmtFecha(evento.fecha)],
      ["Cliente / Instalación", evento.cliente_nombre || "No especificado"],
      ["Puesto operativo", evento.puesto_nombre || "No especificado"],
      ["Estado anterior", evento.estado_anterior || "Desconocido"],
    ],
  );

  pdf.addEspacio(4);
  pdf.addSeccionTitulo("II. Datos de la Anulación");

  pdf.addTabla(
    ["Campo", "Información"],
    [
      ["Fecha de anulación", fmtFecha(evento.anulado_at || new Date().toISOString())],
      ["Anulado por", evento.anulado_por || "No especificado"],
      ["Motivo de anulación", motivoLabel],
      ["Documento de referencia", numEvento],
      ["Estado resultante", "ANULADO — Sin efecto legal"],
    ],
  );

  pdf.addEspacio(4);
  pdf.addSeccionTitulo("III. Efecto Legal de la Anulación");

  pdf.addTextoResumen(
    `En virtud de la presente anulación, los documentos originalmente generados (boleta de descuento ` +
    `y acta administrativa) quedan SIN EFECTO LEGAL y no podrán ser utilizados como instrumento ` +
    `administrativo, disciplinario ni de descuento salarial contra el colaborador ${evento.employee_nombre}. ` +
    `El registro histórico del evento se mantiene en el sistema con fines de trazabilidad y auditoría interna, ` +
    `pero su estado queda marcado como ANULADO de forma permanente.`,
  );

  if (evento.motivo_anulacion === "agente_asistio") {
    pdf.addEspacio(3);
    pdf.addTextoResumen(
      "NOTA ESPECÍFICA: La anulación se realizó debido a que el colaborador SÍ asistió a su turno. " +
      "El registro de falta fue creado por error operativo y no corresponde a una ausencia real. " +
      "El colaborador no tendrá ningún antecedente negativo derivado de este evento.",
    );
  }

  if (evento.motivo_anulacion === "duplicado") {
    pdf.addEspacio(3);
    pdf.addTextoResumen(
      "NOTA ESPECÍFICA: La anulación se realizó porque este evento constituye un DUPLICADO. " +
      "El evento original se mantiene en el sistema. Solo el presente evento queda sin efecto.",
    );
  }

  pdf.addEspacio(6);
  pdf.addSeccionTitulo("IV. Firmas de Certificación");

  pdf.addTabla(
    ["Rol", "Nombre Completo", "Firma / Sello", "Fecha"],
    [
      ["Autorizó anulación", evento.anulado_por || "________________________", "___________________", fmtFechaCorta(evento.anulado_at || new Date().toISOString())],
      ["Gerencia RRHH", "________________________", "___________________", "_____ / _____ / _____"],
      ["Dirección General", "________________________", "___________________", "_____ / _____ / _____"],
    ],
    "Autorización de anulación",
  );

  pdf.addEspacio(5);
  pdf.addTextoResumen(
    "Este documento de anulación tiene la misma validez legal que el acta original que deja sin efecto. " +
    "Debe archivarse junto al expediente del colaborador y a los documentos originales anulados. " +
    `Referencia de auditoría del sistema: ${numEvento} — Estado: ANULADO.`,
  );

  const filename = `anulacion-${numEvento}-${evento.employee_nombre.split(" ")[0].toLowerCase()}.pdf`;
  pdf.save(filename);
}
