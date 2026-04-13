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
