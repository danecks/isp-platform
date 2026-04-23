/**
 * pdfRrhh.ts — Generación de documentos RRHH membretados
 *
 * Genera:
 *   - Boleta de descuento por falta
 *   - Acta administrativa (formato Ministerio de Trabajo)
 *   - Aviso al Inspector de Trabajo
 *   - Constancia de horas extra
 *   - Documento de anulación
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
  movimiento_id?: number | null;
  evento_par_id?: number | null;
}

export interface DatosActa {
  numero_acta: number;
  representante_nombre: string;
  representante_dpi: string;
  direccion_empresa: string;
  nombre_empresa: string;
  empleado_nombre: string;
  empleado_dpi: string;
  empleado_fecha_ingreso: string;
  empleado_cargo: string;
  puesto_nombre: string;
  cliente_nombre: string;
  fecha_evento: string;
  hechos: string;
  notas_sistema: string[];
  causal: string;
  articulo_legal: string;
  eventos_historial?: Array<{ fecha: string; tipo: string; notas: string }>;
  causales_seleccionadas?: string[];
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

const fmtFechaDia = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString("es-GT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

const fmtHora = (): string => {
  return new Date().toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit", hour12: false });
};

const tipoLabel = (tipo: string): string => {
  const map: Record<string, string> = {
    falta: "FALTA INJUSTIFICADA",
    falta_injustificada: "FALTA INJUSTIFICADA",
    suspension: "SUSPENSIÓN LABORAL",
    suspension_disciplinaria: "SUSPENSIÓN DISCIPLINARIA",
    horas_extra: "HORAS EXTRA",
    incapacidad: "INCAPACIDAD",
    permiso_sin_goce: "PERMISO SIN GOCE DE SALARIO",
    permiso_con_goce: "PERMISO CON GOCE DE SALARIO",
    llamada_atencion_1: "LLAMADA DE ATENCIÓN VERBAL",
    llamada_atencion_2: "LLAMADA DE ATENCIÓN ESCRITA",
    acta_administrativa: "ACTA ADMINISTRATIVA",
    amonestacion: "AMONESTACIÓN",
    abandono_parcial: "ABANDONO PARCIAL",
  };
  return map[tipo] ?? tipo.toUpperCase();
};

const dpiEnLetras = (dpi: string): string => {
  if (!dpi) return "no disponible";
  const clean = dpi.replace(/\s+/g, " ").trim();
  const parts = clean.split(" ");
  if (parts.length === 3) {
    return `${parts[0]} ${parts[1]} ${parts[2]}`;
  }
  return clean;
};

export const CAUSALES_ACTA = [
  { id: "alcohol_drogas", label: "Alcohol / Drogas", desc: "Se presentó en estado de ebriedad o bajo efectos de sustancias, imposibilitando el desempeño de sus funciones", articulo: "Art. 77 inciso d)" },
  { id: "descuido_grave", label: "Descuido grave que afecte el trabajo", desc: "Actuó con descuido o negligencia que afectó seriamente las operaciones y/o la prestación del servicio", articulo: "Art. 77 inciso e)" },
  { id: "riesgo_bienes", label: "Poner en riesgo bienes, personas o procesos", desc: "Puso en riesgo la integridad de bienes, personas o procesos operativos bajo su responsabilidad", articulo: "Art. 77 inciso e)" },
  { id: "falta_injustificada", label: "Faltas injustificadas / Abandono", desc: "No se presentó a sus labores sin dar aviso ni justificación alguna, generando descubierto en la cobertura operativa", articulo: "Art. 77 inciso f)" },
  { id: "ausencia_sin_permiso", label: "Ausencias sin permiso", desc: "Se ausentó del puesto de trabajo sin autorización de su superior inmediato", articulo: "Art. 77 inciso f)" },
  { id: "bajo_rendimiento", label: "Bajo rendimiento intencional", desc: "Disminuyó deliberadamente su productividad y rendimiento laboral sin justificación válida", articulo: "Art. 77 inciso e)" },
  { id: "incumplimiento", label: "Incumplimiento sin justificación", desc: "No cumplió con las funciones y responsabilidades asignadas a su puesto sin justificación alguna", articulo: "Art. 77 inciso b)" },
  { id: "desobediencia", label: "Desobediencia / Indisciplina", desc: "Desobedeció instrucciones directas de sus superiores o incurrió en actos de indisciplina", articulo: "Art. 77 inciso b)" },
  { id: "violencia", label: "Violencia / Amenazas", desc: "Realizó actos de violencia, amenazas o injurias contra compañeros o superiores dentro o fuera del lugar de trabajo", articulo: "Art. 77 inciso c)" },
  { id: "robo_hurto", label: "Robo / Hurto / Daño intencional", desc: "Cometió o intentó cometer actos de sustracción o daño intencional contra bienes de la empresa o del cliente", articulo: "Art. 77 inciso a)" },
] as const;

export const MOTIVO_ANULACION_LABELS: Record<string, string> = {
  error_registro: "Error de registro",
  agente_asistio: "El agente sí asistió",
  duplicado: "Registro duplicado",
  otro: "Otro motivo",
};

// ─── Acta Administrativa (Formato Oficio – Ministerio de Trabajo) ────────────
export async function generarActaAdministrativa(datos: DatosActa): Promise<void> {
  const pdf = new IspPdf({
    titulo: "ACTA ADMINISTRATIVA",
    subtitulo: `Acta No. ${String(datos.numero_acta).padStart(4, "0")}`,
    preparedBy: "Departamento de Recursos Humanos",
  });

  await pdf.build();

  const horaActual = fmtHora();
  const fechaHoy = fmtFechaDia(new Date().toISOString());
  const fechaIngreso = datos.empleado_fecha_ingreso ? fmtFechaDia(datos.empleado_fecha_ingreso) : "fecha no registrada";

  pdf.addTextoCentrado(`ACTA ADMINISTRATIVA No. ${String(datos.numero_acta).padStart(4, "0")}`, 11, true);
  pdf.addEspacio(1);

  const articulosUsados = new Set<string>();
  let causalesTexto = "";
  if (datos.causales_seleccionadas && datos.causales_seleccionadas.length > 0) {
    const seleccionadas = datos.causales_seleccionadas
      .map(id => CAUSALES_ACTA.find(c => c.id === id))
      .filter(Boolean) as typeof CAUSALES_ACTA[number][];
    seleccionadas.forEach(c => articulosUsados.add(c.articulo));
    causalesTexto = seleccionadas.map(c => c.desc).join(". Asimismo, ") + ".";
  }

  pdf.addTextoJustificado(
    `En la ciudad de Guatemala, el día ${fechaHoy}, siendo las ${horaActual} horas, ` +
    `constituido(a) en ${datos.direccion_empresa || "las oficinas de la empresa"}, ` +
    `sede de la empresa ${datos.nombre_empresa || "INVESTIGACIONES Y SEGURIDAD PROFESIONAL, S.A."}, ` +
    `comparece:`
  );
  pdf.addEspacio(1);

  pdf.addTextoBold("POR PARTE DE LA EMPRESA:", 8);
  pdf.addTextoJustificado(
    `${datos.representante_nombre}, DPI ${dpiEnLetras(datos.representante_dpi)}, ` +
    `actuando en calidad de Representante Legal.`
  );
  pdf.addEspacio(1);

  pdf.addTextoBold("TRABAJADOR CITADO:", 8);
  pdf.addTextoJustificado(
    `${datos.empleado_nombre.toUpperCase()}, DPI número ${dpiEnLetras(datos.empleado_dpi)}, ` +
    `quien labora para la empresa desde el ${fechaIngreso}, ` +
    `desempeñando el puesto de ${datos.empleado_cargo || "Agente de Seguridad"} ` +
    `en las instalaciones del cliente ${datos.cliente_nombre || "asignado"}, ` +
    `puesto operativo "${datos.puesto_nombre || "asignado"}".`
  );
  pdf.addEspacio(2);
  pdf.addLinea();
  pdf.addEspacio(1);

  pdf.addTextoCentrado("HECHOS", 10, true);
  pdf.addEspacio(1);

  if (causalesTexto) {
    pdf.addTextoJustificado(
      `El trabajador ${datos.empleado_nombre.toUpperCase()} ha incurrido en la(s) siguiente(s) falta(s):`,
    );
    pdf.addEspacio(1);
    pdf.addTextoJustificado(causalesTexto, 8, 5);
    pdf.addEspacio(1);
  }

  if (datos.hechos) {
    pdf.addTextoJustificado(datos.hechos);
    pdf.addEspacio(1);
  }

  if (datos.notas_sistema && datos.notas_sistema.length > 0) {
    pdf.addTextoBold("Notas del sistema:", 7);
    for (const nota of datos.notas_sistema) {
      pdf.addTextoJustificado(`• ${nota}`, 7, 5);
    }
    pdf.addEspacio(1);
  }

  if (datos.eventos_historial && datos.eventos_historial.length > 0) {
    pdf.addLinea();
    pdf.addEspacio(1);
    pdf.addTextoCentrado("ANTECEDENTES DISCIPLINARIOS", 9, true);
    pdf.addEspacio(1);
    const filas = datos.eventos_historial.map(e => [
      fmtFechaCorta(e.fecha),
      tipoLabel(e.tipo),
      (e.notas || "—").substring(0, 60),
    ]);
    pdf.addTabla(["Fecha", "Tipo de Evento", "Observaciones"], filas);
    pdf.addEspacio(1);
  }

  pdf.addLinea();
  pdf.addEspacio(1);
  pdf.addTextoCentrado("FUNDAMENTO LEGAL", 10, true);
  pdf.addEspacio(1);

  const articulosStr = articulosUsados.size > 0
    ? Array.from(articulosUsados).join(", ")
    : datos.articulo_legal || "Art. 77 del Código de Trabajo";

  pdf.addTextoJustificado(
    `Con base en lo anteriormente expuesto, y de conformidad con lo establecido en el ` +
    `${articulosStr} del Código de Trabajo de Guatemala (Decreto 1441 del Congreso de la República ` +
    `y sus reformas), se deja constancia de los hechos para los efectos legales correspondientes. ` +
    `El trabajador queda formalmente notificado de que la reincidencia en estas faltas puede dar ` +
    `lugar a la terminación de la relación laboral sin responsabilidad para el patrono.`
  );
  pdf.addEspacio(1);

  pdf.addTextoJustificado(
    `No habiendo más que hacer constar, se da por terminada la presente acta en el mismo lugar y ` +
    `fecha de su inicio, la cual consta de una hoja útil, firmada y sellada por los comparecientes ` +
    `que en ella intervinieron, quienes ratifican su contenido.`
  );

  pdf.addEspacio(8);

  pdf.addFirmaDoble(
    { label: "Representante Legal", nombre: datos.representante_nombre },
    { label: "Trabajador Citado", nombre: datos.empleado_nombre.toUpperCase() },
  );
  pdf.addEspacio(8);
  pdf.addFirmaDoble(
    { label: "Testigo 1", nombre: "" },
    { label: "Testigo 2", nombre: "" },
  );

  const filename = `acta-administrativa-${String(datos.numero_acta).padStart(4, "0")}-${datos.empleado_nombre.split(" ")[0].toLowerCase()}.pdf`;
  pdf.save(filename);
}

// ─── Aviso al Inspector de Trabajo ───────────────────────────────────────────
export async function generarAvisoInspector(datos: DatosActa): Promise<void> {
  const pdf = new IspPdf({
    titulo: "AVISO AL INSPECTOR DE TRABAJO",
    subtitulo: `Ref: Acta No. ${String(datos.numero_acta).padStart(4, "0")}`,
    preparedBy: "Representante Legal",
  });

  await pdf.build();

  const fechaHoy = fmtFechaDia(new Date().toISOString());
  const fechaIngreso = datos.empleado_fecha_ingreso ? fmtFechaDia(datos.empleado_fecha_ingreso) : "fecha no registrada";

  const articulosUsados = new Set<string>();
  if (datos.causales_seleccionadas && datos.causales_seleccionadas.length > 0) {
    const seleccionadas = datos.causales_seleccionadas
      .map(id => CAUSALES_ACTA.find(c => c.id === id))
      .filter(Boolean) as typeof CAUSALES_ACTA[number][];
    seleccionadas.forEach(c => articulosUsados.add(c.articulo));
  }
  const articulosStr = articulosUsados.size > 0
    ? Array.from(articulosUsados).join(", ")
    : datos.articulo_legal || "Art. 77 del Código de Trabajo";

  pdf.addTextoCentrado("Guatemala, " + fechaHoy, 9, false);
  pdf.addEspacio(4);

  pdf.addTextoBold("SEÑOR:");
  pdf.addTextoBold("INSPECTOR DE TRABAJO");
  pdf.addTextoBold("MINISTERIO DE TRABAJO Y PREVISIÓN SOCIAL");
  pdf.addTextoJustificado("Su Despacho.");
  pdf.addEspacio(6);

  pdf.addTextoJustificado(
    `${datos.representante_nombre.toUpperCase()}, guatemalteco(a), de este domicilio, quien se identifica ` +
    `con el Documento Personal de Identificación -DPI- con Código Único de Identificación -CUI- ` +
    `número ${dpiEnLetras(datos.representante_dpi)}, extendido por el Registro Nacional de las Personas ` +
    `de la República de Guatemala -RENAP-, actuando en calidad de Gerente General y Representante ` +
    `Legal de la entidad ${datos.nombre_empresa.toUpperCase()}, ante usted respetuosamente comparezco ` +
    `y EXPONGO:`
  );
  pdf.addEspacio(4);

  pdf.addTextoCentrado("I. DE MI REPRESENTADA", 10, true);
  pdf.addEspacio(2);
  pdf.addTextoJustificado(
    `${datos.nombre_empresa.toUpperCase()}, es una entidad dedicada a la prestación de ` +
    `servicios de seguridad privada, con domicilio en ${datos.direccion_empresa || "Ciudad de Guatemala"}, ` +
    `departamento de Guatemala.`
  );
  pdf.addEspacio(4);

  pdf.addTextoCentrado("II. DEL TRABAJADOR", 10, true);
  pdf.addEspacio(2);
  pdf.addTextoJustificado(
    `El trabajador ${datos.empleado_nombre.toUpperCase()}, quien se identifica con DPI número ` +
    `${dpiEnLetras(datos.empleado_dpi)}, laboró para mi representada desde el ${fechaIngreso}, ` +
    `desempeñando el puesto de ${datos.empleado_cargo || "Agente de Seguridad"} ` +
    `en las instalaciones del cliente ${datos.cliente_nombre || "asignado"}.`
  );
  pdf.addEspacio(4);

  pdf.addTextoCentrado("III. DE LOS HECHOS", 10, true);
  pdf.addEspacio(2);

  if (datos.causales_seleccionadas && datos.causales_seleccionadas.length > 0) {
    const seleccionadas = datos.causales_seleccionadas
      .map(id => CAUSALES_ACTA.find(c => c.id === id))
      .filter(Boolean) as typeof CAUSALES_ACTA[number][];
    const causalesTexto = seleccionadas.map(c => c.desc).join(". Asimismo, ") + ".";
    pdf.addTextoJustificado(causalesTexto);
    pdf.addEspacio(2);
  }

  if (datos.hechos) {
    pdf.addTextoJustificado(datos.hechos);
  }

  if (datos.notas_sistema && datos.notas_sistema.length > 0) {
    pdf.addEspacio(3);
    for (const nota of datos.notas_sistema) {
      pdf.addTextoJustificado(`• ${nota}`, 8, 5);
    }
  }

  if (datos.eventos_historial && datos.eventos_historial.length > 0) {
    pdf.addEspacio(4);
    pdf.addTextoCentrado("HISTORIAL DE ACTAS Y ANTECEDENTES", 9, true);
    pdf.addEspacio(2);
    const filas = datos.eventos_historial.map(e => [
      fmtFechaCorta(e.fecha),
      tipoLabel(e.tipo),
      (e.notas || "—").substring(0, 80),
    ]);
    pdf.addTabla(["Fecha", "Tipo", "Observaciones"], filas);
  }

  pdf.addEspacio(4);

  pdf.addTextoCentrado("IV. FUNDAMENTO LEGAL", 10, true);
  pdf.addEspacio(2);
  pdf.addTextoJustificado(
    `De conformidad con lo establecido en el ${articulosStr} del Código de Trabajo de Guatemala ` +
    `(Decreto 1441 del Congreso de la República de Guatemala y sus reformas), y dado que el trabajador ` +
    `ha incurrido en las causales anteriormente descritas, se procede a dar por terminada la relación ` +
    `laboral con causa justa y sin responsabilidad de mi representada.`
  );
  pdf.addEspacio(4);

  pdf.addTextoJustificado(
    `Por lo anteriormente expuesto, a través del presente memorial doy el AVISO DE TERMINACIÓN DE ` +
    `RELACIÓN LABORAL DEL TRABAJADOR ${datos.empleado_nombre.toUpperCase()}, en consecuencia, se da por ` +
    `terminada la relación laboral entre mi representada y dicho trabajador, con causa justa y sin ` +
    `responsabilidad de nuestra parte, de conformidad con la normativa legal citada y por los hechos ` +
    `y causas arriba descritas.`
  );
  pdf.addEspacio(4);

  const fechaEvento = datos.fecha_evento ? fmtFechaDia(datos.fecha_evento) : fmtFechaDia(new Date().toISOString());

  pdf.addTextoCentrado("SOLICITO", 10, true);
  pdf.addEspacio(2);

  pdf.addTextoJustificado("Que se tenga por recibido el presente memorial.");
  pdf.addEspacio(2);
  pdf.addTextoJustificado(
    `Que se tenga por señalado de mi parte el lugar para recibir notificaciones: ` +
    `${datos.direccion_empresa || "Ciudad de Guatemala"}, departamento de Guatemala.`
  );
  pdf.addEspacio(2);
  pdf.addTextoJustificado(
    `Que se tenga por presentado el AVISO DE TERMINACIÓN LABORAL DEL TRABAJADOR ` +
    `${datos.empleado_nombre.toUpperCase()} y en consecuencia se tenga por terminado el contrato de ` +
    `trabajo entre ${datos.empleado_nombre.toUpperCase()} y mi representada, con justa causa y sin ` +
    `responsabilidad de nuestra parte, de conformidad con las normas legales citadas y las aplicables, ` +
    `a partir del ${fechaEvento}. SE ADJUNTA ACTA ADMINISTRATIVA NUMERO ${String(datos.numero_acta).padStart(4, "0")}.`
  );

  pdf.addEspacio(18);

  pdf.addFirmaSimple("Representante Legal", datos.representante_nombre);

  const filename = `aviso-inspector-${String(datos.numero_acta).padStart(4, "0")}-${datos.empleado_nombre.split(" ")[0].toLowerCase()}.pdf`;
  pdf.save(filename);
}

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
      ["DPI", evento.employee_dpi || "No registrado"],
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

// ─── Constancia de Horas Extra ────────────────────────────────────────────────
export async function generarConstanciaHorasExtra(evento: EventoRrhh): Promise<void> {
  const pdf = new IspPdf({
    titulo: "CONSTANCIA DE HORAS EXTRA",
    subtitulo: `Evento #${evento.id} — Cobertura Operativa`,
    preparedBy: evento.usuario_generador || "Sistema",
  });

  await pdf.build();

  pdf.addSeccionTitulo("Datos del Colaborador");

  pdf.addTextoResumen(
    `La presente constancia documenta las HORAS EXTRA trabajadas por el colaborador indicado a continuación, ` +
    `en virtud de una cobertura operativa asignada por el Centro de Operaciones de ISP, S.A.`,
  );

  pdf.addTabla(
    ["Campo", "Detalle"],
    [
      ["Nombre del colaborador", evento.employee_nombre],
      ["DPI", evento.employee_dpi || "No registrado"],
      ["Fecha de la cobertura", fmtFecha(evento.fecha)],
      ["Tipo de evento", "HORAS EXTRA — COBERTURA"],
      ["Cliente / Instalación", evento.cliente_nombre || "No especificado"],
      ["Puesto cubierto", evento.puesto_nombre || "No especificado"],
      ["Registrado por", evento.usuario_generador || "Sistema"],
      ["Fecha de emisión", fmtFechaCorta(new Date().toISOString())],
      ["No. de evento RRHH", `ERH-${String(evento.id).padStart(4, "0")}`],
    ],
  );

  pdf.addEspacio(4);
  pdf.addSeccionTitulo("Detalle de la Cobertura");

  pdf.addTextoResumen(
    evento.observaciones ||
    `El colaborador ${evento.employee_nombre} realizó cobertura en el puesto "${evento.puesto_nombre || "asignado"}" ` +
    `en las instalaciones del cliente ${evento.cliente_nombre || "no especificado"}, el día ` +
    `${fmtFechaCorta(evento.fecha)}. Esta cobertura fue asignada por el Centro de Operaciones ` +
    `para cubrir la ausencia del titular del puesto.`,
  );

  if (evento.notas) {
    pdf.addEspacio(2);
    pdf.addTextoResumen(`Notas adicionales: ${evento.notas}`);
  }

  pdf.addEspacio(4);
  pdf.addSeccionTitulo("Forma de Pago");

  pdf.addTextoResumen(
    "Las horas extra serán compensadas según la modalidad autorizada por la Gerencia de Operaciones: " +
    "pago en planilla regular o pago en efectivo, conforme lo establecido en el Artículo 121 del Código de Trabajo de Guatemala (Decreto 1441).",
  );

  pdf.addEspacio(6);
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

  pdf.addEspacio(5);
  pdf.addTextoResumen(
    "NOTA: Este documento certifica la realización de horas extra y servirá como respaldo para el cálculo de la compensación correspondiente. " +
    "La firma del colaborador confirma la recepción de esta constancia y la veracidad de las horas trabajadas.",
  );

  const filename = `constancia-he-ERH-${String(evento.id).padStart(4, "0")}-${evento.employee_nombre.split(" ")[0].toLowerCase()}.pdf`;
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
      ["DPI", evento.employee_dpi || "No disponible"],
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

// ─── Contrato Individual de Trabajo (Decreto 1441 — Guatemala) ───────────────
//
// Datos del patrono (editar una sola vez aquí cuando estén disponibles).
// Mientras no se actualicen, aparecerán líneas en blanco para llenar a mano.
export const PATRONO_DATOS = {
  razon_social: "INVESTIGACIONES Y SEGURIDAD PROFESIONAL, SOCIEDAD ANÓNIMA",
  nombre_comercial: "ISP, S.A.",
  nit: "____________",
  patente_comercio: "____________",
  direccion: "_________________________________________________ ciudad de Guatemala, departamento de Guatemala",
  representante_nombre: "____________________________________",
  representante_dpi: "____________",
  representante_cargo: "Representante Legal",
  representante_fecha_nacimiento: "" as string, // ISO YYYY-MM-DD; vacío => se imprime "mayor de edad"
  telefono: "+502 2379 0700",
};

/**
 * Calcula la edad actual en años cumplidos a partir de una fecha ISO.
 * Devuelve null si la fecha es inválida o vacía.
 */
export function calcularEdadAnios(fechaIso?: string | null): number | null {
  if (!fechaIso) return null;
  // Parsear como fecha LOCAL (no UTC) para evitar desfase en zonas como
  // Guatemala (UTC-6), donde new Date("1975-06-15") se interpreta a las
  // 00:00 UTC y al leer getDate()/getMonth() en local cae al día anterior.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaIso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!year || !month || !day) return null;
  const nac = new Date(year, month - 1, day);
  if (Number.isNaN(nac.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const dm = hoy.getMonth() - nac.getMonth();
  if (dm < 0 || (dm === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad >= 0 && edad < 130 ? edad : null;
}

/**
 * Carga los datos del patrono desde /api/config-empresa y los devuelve en el
 * formato esperado por DatosContratoLaboral.patrono (override). Si la API no
 * responde o algún campo está vacío, mantiene el placeholder de PATRONO_DATOS.
 */
export async function cargarPatronoDesdeConfig(): Promise<Partial<typeof PATRONO_DATOS>> {
  try {
    const res = await fetch("/api/config-empresa");
    if (!res.ok) return {};
    const cfg = await res.json() as {
      nombre_empresa?: string;
      direccion_empresa?: string;
      nit_empresa?: string;
      patente_comercio?: string;
      telefono_empresa?: string;
      representante_nombre?: string;
      representante_dpi?: string;
      representante_fecha_nacimiento?: string | null;
    };
    const overrides: Partial<typeof PATRONO_DATOS> = {};
    if (cfg.nombre_empresa)         overrides.razon_social         = cfg.nombre_empresa.toUpperCase();
    if (cfg.direccion_empresa)      overrides.direccion            = cfg.direccion_empresa;
    if (cfg.nit_empresa)            overrides.nit                  = cfg.nit_empresa;
    if (cfg.patente_comercio)       overrides.patente_comercio     = cfg.patente_comercio;
    if (cfg.telefono_empresa)       overrides.telefono             = cfg.telefono_empresa;
    if (cfg.representante_nombre)   overrides.representante_nombre = cfg.representante_nombre;
    if (cfg.representante_dpi)      overrides.representante_dpi    = cfg.representante_dpi;
    if (cfg.representante_fecha_nacimiento) overrides.representante_fecha_nacimiento = cfg.representante_fecha_nacimiento;
    return overrides;
  } catch {
    return {};
  }
}

export interface DatosContratoLaboral {
  // Empleado
  empleado_nombre: string;
  empleado_dpi: string;
  empleado_fecha_nacimiento?: string;
  empleado_estado_civil?: string;
  empleado_direccion?: string;
  empleado_telefono?: string;
  empleado_nit?: string;
  empleado_igss?: string;
  // Relación laboral
  fecha_inicio: string;
  puesto: string;
  tipo_personal?: string; // guardia, supervisor, administrativo...
  sueldo_base: number;
  jornada?: "diurna" | "nocturna" | "mixta";
  horas_semanales?: number;
  dia_descanso?: string;
  lugar_trabajo?: string;
  // Tipo de contrato
  tipo_contrato: "inicial" | "post_prueba"; // inicial = con periodo de prueba 60d / post_prueba = indefinido
  // Patrono (override opcional — si no se pasa, usa PATRONO_DATOS)
  patrono?: Partial<typeof PATRONO_DATOS>;
}

const numeroALetras = (n: number): string => {
  // Conversor simplificado para sueldos (montos típicos < 100,000 GTQ)
  const unidades = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
  const especiales: Record<number, string> = {
    10: "diez", 11: "once", 12: "doce", 13: "trece", 14: "catorce", 15: "quince",
    16: "dieciséis", 17: "diecisiete", 18: "dieciocho", 19: "diecinueve", 20: "veinte",
    30: "treinta", 40: "cuarenta", 50: "cincuenta", 60: "sesenta", 70: "setenta",
    80: "ochenta", 90: "noventa", 100: "cien",
  };
  const centenas = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
    "seiscientos", "setecientos", "ochocientos", "novecientos"];

  const decenasCompletas = (num: number): string => {
    if (num === 0) return "";
    if (num < 10) return unidades[num];
    if (especiales[num]) return especiales[num];
    if (num < 30) return "veinti" + unidades[num - 20];
    const d = Math.floor(num / 10) * 10;
    const u = num % 10;
    return especiales[d] + (u > 0 ? " y " + unidades[u] : "");
  };

  const centenasCompletas = (num: number): string => {
    if (num < 100) return decenasCompletas(num);
    if (num === 100) return "cien";
    const c = Math.floor(num / 100);
    const r = num % 100;
    return centenas[c] + (r > 0 ? " " + decenasCompletas(r) : "");
  };

  if (n === 0) return "cero";
  const entero = Math.floor(n);
  const decimal = Math.round((n - entero) * 100);
  let texto = "";

  if (entero >= 1000) {
    const miles = Math.floor(entero / 1000);
    const resto = entero % 1000;
    texto = (miles === 1 ? "mil" : centenasCompletas(miles) + " mil");
    if (resto > 0) texto += " " + centenasCompletas(resto);
  } else {
    texto = centenasCompletas(entero);
  }

  texto = texto.toUpperCase() + " QUETZALES";
  if (decimal > 0) {
    texto += " CON " + decenasCompletas(decimal).toUpperCase() + "/100";
  } else {
    texto += " EXACTOS";
  }
  return texto;
};

const fmtFechaLetras = (iso: string): string => {
  try {
    const d = new Date(iso);
    const dia = d.getDate();
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    return `${dia} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
  } catch {
    return iso;
  }
};

const tipoPersonalLabel = (tipo?: string): string => {
  const map: Record<string, string> = {
    guardia: "Agente de Seguridad Privada",
    supervisor: "Supervisor de Seguridad",
    administrativo: "Personal Administrativo",
    motorista: "Motorista / Conductor",
    recepcionista: "Recepcionista",
    tecnico: "Técnico",
  };
  return tipo ? (map[tipo] ?? tipo) : "Agente de Seguridad Privada";
};

export async function generarContratoLaboral(datos: DatosContratoLaboral): Promise<void> {
  const patrono = { ...PATRONO_DATOS, ...(datos.patrono ?? {}) };
  const esInicial = datos.tipo_contrato === "inicial";
  // Edad del representante legal: si hay fecha de nacimiento configurada
  // se imprime "de X años de edad"; de lo contrario se mantiene el genérico.
  const edadRep = calcularEdadAnios(patrono.representante_fecha_nacimiento);
  const edadRepTexto = edadRep != null ? `de ${edadRep} años de edad` : "mayor de edad";

  const pdf = new IspPdf({
    titulo: "CONTRATO INDIVIDUAL DE TRABAJO",
    subtitulo: esInicial
      ? "Por tiempo indefinido — con período de prueba"
      : "Por tiempo indefinido — post período de prueba",
    preparedBy: "Departamento de Recursos Humanos",
  });

  await pdf.build();

  // La fecha de los comparecientes coincide con la fecha de inicio del
  // contrato (no se usa "hoy"): para el inicial es alta + 2 meses, para
  // el post-prueba es la fecha de alta original.
  const fechaInicio = fmtFechaLetras(datos.fecha_inicio);
  const fechaHoy = fechaInicio;
  const sueldoLetras = numeroALetras(datos.sueldo_base);
  const sueldoNum = datos.sueldo_base.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cargo = tipoPersonalLabel(datos.tipo_personal);
  const jornada = datos.jornada ?? "mixta";
  const horas = datos.horas_semanales ?? (jornada === "nocturna" ? 36 : jornada === "mixta" ? 42 : 44);
  const diaDescanso = datos.dia_descanso ?? "según rol asignado por la empresa";
  const lugar = datos.lugar_trabajo ?? "las instalaciones del cliente que el patrono le asigne dentro del territorio de la República de Guatemala";

  // ─── Encabezado ──
  pdf.addTextoCentrado("CONTRATO INDIVIDUAL DE TRABAJO", 12, true);
  pdf.addTextoCentrado(esInicial ? "Por tiempo indefinido con período de prueba" : "Por tiempo indefinido", 9, false);
  pdf.addEspacio(2);

  // ─── Comparecientes ──
  pdf.addTextoJustificado(
    `En la ciudad de Guatemala, el día ${fechaHoy}, comparecen, por una parte: ` +
    `${patrono.representante_nombre}, ${edadRepTexto}, guatemalteco(a), de este domicilio, ` +
    `quien se identifica con Documento Personal de Identificación (DPI) número ${patrono.representante_dpi}, ` +
    `actuando en su calidad de ${patrono.representante_cargo} de la entidad mercantil ` +
    `${patrono.razon_social}, con NIT ${patrono.nit}, ` +
    `con sede en ${patrono.direccion}, a quien en adelante se denominará "EL PATRONO"; y por la otra parte: ` +
    `${datos.empleado_nombre.toUpperCase()}, ${datos.empleado_estado_civil ?? "de estado civil ____________"}, ` +
    `guatemalteco(a), quien se identifica con Documento Personal de Identificación (DPI) número ${datos.empleado_dpi}, ` +
    `${datos.empleado_nit ? `con NIT ${datos.empleado_nit}, ` : ""}` +
    `${datos.empleado_igss ? `afiliación al IGSS número ${datos.empleado_igss}, ` : ""}` +
    `con domicilio en ${datos.empleado_direccion ?? "____________________________________"}, ` +
    `${datos.empleado_telefono ? `teléfono ${datos.empleado_telefono}, ` : ""}` +
    `a quien en adelante se denominará "EL TRABAJADOR". Ambas partes manifiestan tener libre ejercicio de sus ` +
    `derechos civiles y la capacidad legal necesaria para celebrar el presente CONTRATO INDIVIDUAL DE TRABAJO, ` +
    `de conformidad con el Código de Trabajo de Guatemala (Decreto Número 1441 del Congreso de la República y ` +
    `sus reformas), conforme a las cláusulas siguientes:`
  );
  pdf.addEspacio(2);

  // ─── PRIMERA: Objeto ──
  pdf.addTextoBold("PRIMERA — OBJETO DEL CONTRATO:", 9);
  pdf.addTextoJustificado(
    `EL TRABAJADOR se obliga a prestar sus servicios personales al PATRONO en el puesto de ${cargo} ` +
    `${datos.puesto ? `("${datos.puesto}") ` : ""}` +
    `bajo la dirección, dependencia y subordinación continua de EL PATRONO, ejecutando las labores propias del cargo y todas ` +
    `aquellas conexas o complementarias que le sean encomendadas, observando en todo momento las instrucciones, reglamentos ` +
    `internos, manuales operativos y políticas de seguridad establecidas por EL PATRONO y/o sus clientes.`
  );
  pdf.addEspacio(1);

  // ─── SEGUNDA: Lugar e inicio del contrato ──
  pdf.addTextoBold("SEGUNDA — LUGAR DE TRABAJO E INICIO DEL CONTRATO:", 9);
  pdf.addTextoJustificado(
    `La presente relación laboral da inicio el ${fechaInicio}. EL TRABAJADOR prestará sus servicios en ${lugar}. ` +
    `EL PATRONO se reserva el derecho de trasladarlo o reasignarlo a cualquier puesto operativo o instalación de cliente ` +
    `dentro de la República de Guatemala, según las necesidades del servicio, sin que dicho cambio implique modificación ` +
    `sustancial de sus condiciones de trabajo.`
  );
  pdf.addEspacio(1);

  // ─── TERCERA: Jornada ──
  pdf.addTextoBold("TERCERA — JORNADA Y HORARIO:", 9);
  const jornadaLabel = jornada === "diurna" ? "ordinaria diurna" : jornada === "nocturna" ? "ordinaria nocturna" : "ordinaria mixta";
  pdf.addTextoJustificado(
    `Por la naturaleza propia del servicio de seguridad privada, la jornada ordinaria de trabajo de EL TRABAJADOR será ${jornadaLabel}, ` +
    `comprendiendo períodos de tiempo diurno y nocturno, conforme a los artículos 116 al 124 ` +
    `del Código de Trabajo. La distribución específica del horario, los días laborables y el día de descanso semanal dependerán del ` +
    `puesto operativo asignado y del rol de servicio que establezca EL PATRONO según los requerimientos del cliente. EL TRABAJADOR acepta ` +
    `expresamente que sus turnos podrán ser diurnos (jornada máxima de 44 horas semanales), nocturnos (jornada máxima de 36 horas semanales) ` +
    `o mixtos (jornada máxima de 42 horas semanales), pudiendo ser rotativos, fijos o variables según el contrato de servicios suscrito ` +
    `entre EL PATRONO y el cliente final. El día de descanso semanal será ${diaDescanso}, conforme al artículo 126 del mismo cuerpo legal, ` +
    `y podrá ser cualquier día de la semana atendiendo al rol asignado. EL TRABAJADOR reconoce y acepta que las reasignaciones de puesto, ` +
    `turno u horario constituyen una característica esencial del servicio de seguridad privada y no implican modificación sustancial ` +
    `de las condiciones de trabajo pactadas en el presente contrato.`
  );
  pdf.addEspacio(1);

  // ─── CUARTA: Salario ──
  pdf.addTextoBold("CUARTA — SALARIO Y FORMA DE PAGO:", 9);
  pdf.addTextoJustificado(
    `EL PATRONO pagará a EL TRABAJADOR un salario ordinario mensual de Q ${sueldoNum} ` +
    `(${sueldoLetras}), pagadero en moneda de curso legal en quincenas vencidas, mediante depósito en cuenta bancaria ` +
    `o por el medio que EL PATRONO determine. Sobre dicho salario se efectuarán las deducciones legales correspondientes ` +
    `(IGSS, IRTRA, ISR cuando aplique) conforme a la legislación vigente. Las horas extraordinarias, bonificaciones y ` +
    `demás emolumentos se pagarán conforme al Código de Trabajo y al Decreto 76-78 de la Bonificación Incentivo.`
  );
  pdf.addEspacio(1);

  // ─── QUINTA: Período de prueba (solo inicial) o duración (post-prueba) ──
  if (esInicial) {
    pdf.addTextoBold("QUINTA — PERÍODO DE PRUEBA:", 9);
    pdf.addTextoJustificado(
      `Conforme al artículo 81 del Código de Trabajo, las partes pactan un PERÍODO DE PRUEBA de SESENTA (60) DÍAS ` +
      `contados a partir del ${fechaInicio}, durante el cual cualquiera de las partes podrá dar por terminada la relación ` +
      `laboral sin responsabilidad para ninguna de ellas, sin necesidad de expresión de causa ni preaviso. ` +
      `Superado el período de prueba sin manifestación en contrario, el contrato continuará por tiempo indefinido en los ` +
      `términos aquí pactados.`
    );
  } else {
    pdf.addTextoBold("QUINTA — DURACIÓN:", 9);
    pdf.addTextoJustificado(
      `El presente contrato es por TIEMPO INDEFINIDO, en sustitución del contrato inicial suscrito entre las partes con ` +
      `fecha ${fechaInicio}, una vez superado satisfactoriamente el período de prueba previsto en el artículo 81 del Código ` +
      `de Trabajo. Se reconoce a EL TRABAJADOR la antigüedad acumulada desde la fecha original de ingreso para todos los ` +
      `efectos legales.`
    );
  }
  pdf.addEspacio(1);

  // ─── SEXTA: Prestaciones de ley ──
  pdf.addTextoBold("SEXTA — PRESTACIONES DE LEY:", 9);
  pdf.addTextoJustificado(
    `EL TRABAJADOR gozará de todas las prestaciones laborales establecidas en la Constitución Política de la República ` +
    `de Guatemala, el Código de Trabajo y leyes complementarias, incluyendo: (a) Aguinaldo conforme al Decreto 76-78; ` +
    `(b) Bono 14 conforme al Decreto 42-92; (c) Vacaciones anuales pagadas de quince (15) días hábiles después de cada año ` +
    `continuo de labores (Art. 130); (d) Indemnización por tiempo servido en caso de despido injustificado (Art. 82); ` +
    `(e) Cobertura del Instituto Guatemalteco de Seguridad Social (IGSS); (f) Bonificación Incentivo de Q 250.00 mensuales ` +
    `(Decreto 37-2001); (g) Las demás prestaciones que correspondan según la ley.`
  );
  pdf.addEspacio(1);

  // ─── SÉPTIMA: Confidencialidad y armas ──
  pdf.addTextoBold("SÉPTIMA — CONFIDENCIALIDAD, MANEJO DE ARMAS Y EQUIPO:", 9);
  pdf.addTextoJustificado(
    `EL TRABAJADOR se obliga a guardar absoluta reserva sobre todas las informaciones, claves de acceso, planos, ` +
    `procedimientos operativos, identidades de clientes y cualquier dato confidencial al que tenga acceso por razón de su cargo, ` +
    `incluso después de terminada la relación laboral. El equipo, uniforme, armamento, municiones, radios y demás bienes ` +
    `entregados son propiedad de EL PATRONO o del cliente y deberán devolverse al cesar sus funciones, en las mismas ` +
    `condiciones en que fueron recibidos, salvo el desgaste natural por uso. EL TRABAJADOR declara conocer y aceptar ` +
    `las normas de la Dirección General de Servicios de Seguridad Privada (DIGESSP) del Ministerio de Gobernación y la ` +
    `Ley de Armas y Municiones (Decreto 15-2009).`
  );
  pdf.addEspacio(1);

  // ─── OCTAVA: Causales de terminación (DETALLADAS) ──
  pdf.addTextoBold("OCTAVA — CAUSALES DE TERMINACIÓN DE LA RELACIÓN LABORAL:", 9);
  pdf.addTextoJustificado(
    `El presente contrato podrá darse por terminado en los casos siguientes:`
  );
  pdf.addEspacio(1);

  pdf.addTextoBold("A) POR MUTUO CONSENTIMIENTO DE LAS PARTES (Art. 76 inciso a):", 8);
  pdf.addTextoJustificado(
    `Cuando ambas partes acuerden por escrito dar por concluida la relación laboral.`,
    8, 5
  );
  pdf.addEspacio(1);

  pdf.addTextoBold("B) POR RENUNCIA DEL TRABAJADOR (Art. 78):", 8);
  pdf.addTextoJustificado(
    `EL TRABAJADOR podrá dar por terminado el contrato dando aviso por escrito a EL PATRONO con la anticipación que indica ` +
    `el artículo 83 del Código de Trabajo, según el tiempo servido.`,
    8, 5
  );
  pdf.addEspacio(1);

  pdf.addTextoBold("C) POR DESPIDO JUSTIFICADO — CAUSAS IMPUTABLES AL TRABAJADOR (Art. 77):", 8);
  pdf.addTextoJustificado(
    `EL PATRONO podrá dar por terminado el contrato sin responsabilidad de su parte cuando EL TRABAJADOR incurra en ` +
    `cualquiera de las siguientes faltas, las cuales se consideran graves para los efectos de este contrato:`,
    8, 5
  );
  pdf.addEspacio(1);

  const causales = [
    ["a)", "Conducta inmoral, agresión, injurias, calumnias o vías de hecho contra el patrono, sus representantes, otros trabajadores, clientes, visitantes o personas custodiadas, dentro o fuera del lugar de trabajo (Art. 77 incisos a y c)."],
    ["b)", "Cometer o intentar cometer actos de robo, hurto, sustracción, daño intencional, sabotaje o cualquier acto delictivo contra bienes de EL PATRONO, del cliente o de terceros bajo custodia (Art. 77 inciso a)."],
    ["c)", "Revelar secretos comerciales, claves de acceso, planos, identidades de clientes, ubicación de cámaras o cualquier información confidencial obtenida por razón del cargo (Art. 77 inciso a)."],
    ["d)", "Presentarse al trabajo en estado de ebriedad, bajo efectos de drogas o sustancias estupefacientes, o consumir las mismas durante la jornada (Art. 77 inciso d). Esta causal es de aplicación inmediata por la naturaleza de la actividad de seguridad privada y porte de armas."],
    ["e)", "Faltar al trabajo sin permiso de EL PATRONO o sin causa justificada por dos días laborales completos y consecutivos, o por más de dos días en un mismo mes calendario (Art. 77 inciso f). Cada inasistencia generará descubierto en cobertura operativa que afecta directamente a clientes."],
    ["f)", "Abandonar el puesto de trabajo durante la jornada sin autorización del supervisor inmediato. En servicios de seguridad privada, el abandono de puesto se considera falta gravísima por el riesgo que genera a personas y bienes custodiados."],
    ["g)", "Negarse de manera manifiesta y reiterada a adoptar las medidas de seguridad e higiene, los procedimientos operativos, los protocolos de emergencia o las instrucciones impartidas por EL PATRONO o el cliente (Art. 77 inciso h)."],
    ["h)", "Causar intencionalmente o por descuido grave perjuicios materiales, daño a equipos, vehículos, armamento, instalaciones o sistemas (Art. 77 inciso e)."],
    ["i)", "Disminuir de manera injustificada y reiterada el rendimiento normal de las labores, o realizar actos de bajo rendimiento intencional (Art. 77 inciso e)."],
    ["j)", "Desobedecer órdenes legítimas y reiteradas de EL PATRONO o sus representantes, relacionadas con el desempeño de las labores (Art. 77 inciso b)."],
    ["k)", "Falsear datos en su solicitud de empleo, antecedentes, documentos personales (DPI, antecedentes penales y policíacos), o presentar documentos alterados o apócrifos."],
    ["l)", "Pérdida, extravío, mal uso o entrega no autorizada del armamento, municiones, uniforme, radios, vehículos o equipo asignado para el servicio."],
    ["m)", "Dormirse durante el turno, abandonar el puesto de vigilancia o realizar actividades ajenas al servicio (uso indebido del celular, conversaciones prolongadas, lectura no relacionada al servicio, ingestión de alimentos fuera del horario establecido) que comprometan la atención y seguridad del puesto."],
    ["n)", "Recibir gratificaciones, sobornos o coimas de cualquier persona ajena a EL PATRONO, así como facilitar el ingreso o salida de personas, vehículos o bienes sin autorización."],
    ["o)", "Suspender o entorpecer maliciosamente las labores, o incitar al personal a realizar paros ilegales (Art. 77 inciso g)."],
    ["p)", "Encontrarse condenado por sentencia firme a sufrir pena de prisión (Art. 77 inciso i)."],
    ["q)", "Sufrir incapacidad permanente para el trabajo contratado (Art. 77 inciso j)."],
    ["r)", "Acumular tres llamadas de atención escritas en un período de doce (12) meses calendario, debidamente notificadas al trabajador y registradas en su expediente laboral."],
    ["s)", "Cualquier otra causa análoga a las anteriores prevista en el Código de Trabajo o en el Reglamento Interior de Trabajo de la empresa, debidamente aprobado por la Inspección General de Trabajo."],
  ];

  for (const [letra, texto] of causales) {
    pdf.addTextoJustificado(`${letra} ${texto}`, 8, 8);
    pdf.addEspacio(0.5);
  }

  pdf.addEspacio(2);

  // ─── NOVENA: Régimen disciplinario ──
  pdf.addTextoBold("NOVENA — RÉGIMEN DISCIPLINARIO:", 9);
  pdf.addTextoJustificado(
    `Las faltas leves a las obligaciones laborales serán sancionadas progresivamente conforme al Reglamento Interior de ` +
    `Trabajo, aplicando: (1) llamada de atención verbal; (2) llamada de atención escrita; (3) suspensión sin goce de ` +
    `salario hasta por ocho (8) días; (4) despido por reincidencia o gravedad. Las faltas graves enumeradas en la ` +
    `cláusula octava facultan a EL PATRONO a aplicar el despido directo sin necesidad de pasar por las medidas progresivas ` +
    `anteriores. Toda sanción será documentada en el expediente del trabajador con copia al interesado.`
  );
  pdf.addEspacio(1);

  // ─── DÉCIMA: Disposiciones finales ──
  pdf.addTextoBold("DÉCIMA — DISPOSICIONES FINALES:", 9);
  pdf.addTextoJustificado(
    `El presente contrato deja sin efecto cualquier convenio anterior verbal o escrito entre las partes sobre la misma ` +
    `materia. Para todo lo no previsto en este contrato se aplicarán supletoriamente las disposiciones del Código de ` +
    `Trabajo, sus reformas, el Reglamento Interior de Trabajo y demás leyes laborales vigentes en la República de Guatemala. ` +
    `Las partes señalan como lugares para recibir notificaciones los indicados al inicio de este contrato.`
  );
  pdf.addEspacio(2);

  // ─── Cierre ──
  pdf.addTextoJustificado(
    `LEÍDO QUE FUE el presente contrato por ambas partes, lo aceptan, ratifican y firman al pie en señal de conformidad, ` +
    `quedando un ejemplar en poder de cada parte y un tercer ejemplar para ser remitido a la Dirección General de Trabajo, ` +
    `de conformidad con el artículo 28 del Código de Trabajo.`
  );
  pdf.addEspacio(2);
  pdf.addTextoCentrado(`Guatemala, ${fechaHoy}`, 9, true);
  pdf.addEspacio(8);

  // ─── Firmas ──
  pdf.addFirmaContrato(
    { label: "EL PATRONO", nombre: `${patrono.representante_nombre}\n${patrono.representante_cargo}\n${patrono.razon_social}\nDPI: ${patrono.representante_dpi}` },
    { label: "EL TRABAJADOR", nombre: `${datos.empleado_nombre.toUpperCase()}\nDPI: ${datos.empleado_dpi}` },
    `Conforme al artículo 28 del Código de Trabajo, este contrato debe ser presentado por EL PATRONO a la Dirección General de Trabajo dentro de los quince (15) días siguientes a su celebración.`,
  );

  const slug = datos.empleado_nombre.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "");
  const filename = `contrato-${esInicial ? "inicial" : "post-prueba"}-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(filename);
}
