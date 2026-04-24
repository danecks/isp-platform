// Plantillas por defecto del contrato individual de trabajo. Estas se usan
// como semilla cuando no existe ninguna versión activa en BD para un tipo
// y también como base para el botón "Restaurar plantilla original" del
// editor de plantillas.
//
// Convenciones:
//   • {{variable}} → marcador que el renderer reemplaza con datos del
//     empleado/patrono al imprimir el PDF.
//   • Cada cláusula es { numero, titulo, contenido }. El contenido se
//     divide en párrafos por doble salto de línea (\n\n). Si un párrafo
//     empieza y termina con `**`, se renderiza en negrita.

export interface ClausulaPlantilla {
  numero: string;   // ej. "PRIMERA"
  titulo: string;   // ej. "OBJETO DEL CONTRATO"
  contenido: string;
}

export interface PlantillaContratoDefault {
  tipo: "inicial" | "post_prueba";
  titulo: string;
  subtitulo: string;
  encabezado: string;
  clausulas: ClausulaPlantilla[];
  cierre: string;
}

const ENCABEZADO_COMUN =
  `En la ciudad de Guatemala, el día {{fecha_emision}}, comparecen, por una parte: ` +
  `{{representante_nombre}}, {{representante_edad_texto}}, guatemalteco(a), de este domicilio, ` +
  `quien se identifica con Documento Personal de Identificación (DPI) número {{representante_dpi}}, ` +
  `actuando en su calidad de {{representante_cargo}} de la entidad mercantil ` +
  `{{patrono_razon_social}}, con NIT {{patrono_nit}}, ` +
  `con sede en {{patrono_direccion}}, a quien en adelante se denominará "EL PATRONO"; y por la otra parte: ` +
  `{{empleado_nombre}}, {{empleado_estado_civil}}, ` +
  `guatemalteco(a), quien se identifica con Documento Personal de Identificación (DPI) número {{empleado_dpi}}, ` +
  `{{empleado_nit_clausula}}{{empleado_igss_clausula}}` +
  `con domicilio en {{empleado_direccion}}, ` +
  `{{empleado_telefono_clausula}}` +
  `a quien en adelante se denominará "EL TRABAJADOR". Ambas partes manifiestan tener libre ejercicio de sus ` +
  `derechos civiles y la capacidad legal necesaria para celebrar el presente CONTRATO INDIVIDUAL DE TRABAJO, ` +
  `de conformidad con el Código de Trabajo de Guatemala (Decreto Número 1441 del Congreso de la República y ` +
  `sus reformas), conforme a las cláusulas siguientes:`;

const CLAUSULA_PRIMERA: ClausulaPlantilla = {
  numero: "PRIMERA",
  titulo: "OBJETO DEL CONTRATO",
  contenido:
    `EL TRABAJADOR se obliga a prestar sus servicios personales al PATRONO en el puesto de {{cargo}} ` +
    `{{puesto_paren}}` +
    `bajo la dirección, dependencia y subordinación continua de EL PATRONO, ejecutando las labores propias del cargo y todas ` +
    `aquellas conexas o complementarias que le sean encomendadas, observando en todo momento las instrucciones, reglamentos ` +
    `internos, manuales operativos y políticas de seguridad establecidas por EL PATRONO y/o sus clientes.`,
};

const CLAUSULA_SEGUNDA: ClausulaPlantilla = {
  numero: "SEGUNDA",
  titulo: "LUGAR DE TRABAJO E INICIO DEL CONTRATO",
  contenido:
    `La presente relación laboral da inicio el {{fecha_inicio}}. EL TRABAJADOR prestará sus servicios en {{lugar_trabajo}}. ` +
    `EL PATRONO se reserva el derecho de trasladarlo o reasignarlo a cualquier puesto operativo o instalación de cliente ` +
    `dentro de la República de Guatemala, según las necesidades del servicio, sin que dicho cambio implique modificación ` +
    `sustancial de sus condiciones de trabajo.`,
};

const CLAUSULA_TERCERA: ClausulaPlantilla = {
  numero: "TERCERA",
  titulo: "JORNADA Y HORARIO",
  contenido:
    `Por la naturaleza propia del servicio de seguridad privada, la jornada ordinaria de trabajo de EL TRABAJADOR será {{jornada_label}}, ` +
    `comprendiendo períodos de tiempo diurno y nocturno, conforme a los artículos 116 al 124 ` +
    `del Código de Trabajo. La distribución específica del horario, los días laborables y el día de descanso semanal dependerán del ` +
    `puesto operativo asignado y del rol de servicio que establezca EL PATRONO según los requerimientos del cliente. EL TRABAJADOR acepta ` +
    `expresamente que sus turnos podrán ser diurnos (jornada máxima de 44 horas semanales), nocturnos (jornada máxima de 36 horas semanales) ` +
    `o mixtos (jornada máxima de 42 horas semanales), pudiendo ser rotativos, fijos o variables según el contrato de servicios suscrito ` +
    `entre EL PATRONO y el cliente final. El día de descanso semanal será {{dia_descanso}}, conforme al artículo 126 del mismo cuerpo legal, ` +
    `y podrá ser cualquier día de la semana atendiendo al rol asignado. EL TRABAJADOR reconoce y acepta que las reasignaciones de puesto, ` +
    `turno u horario constituyen una característica esencial del servicio de seguridad privada y no implican modificación sustancial ` +
    `de las condiciones de trabajo pactadas en el presente contrato.`,
};

const CLAUSULA_CUARTA: ClausulaPlantilla = {
  numero: "CUARTA",
  titulo: "SALARIO Y FORMA DE PAGO",
  contenido:
    `EL PATRONO pagará a EL TRABAJADOR un salario ordinario mensual de Q {{sueldo_num}} ` +
    `({{sueldo_letras}}), pagadero en moneda de curso legal en quincenas vencidas, mediante depósito en cuenta bancaria ` +
    `o por el medio que EL PATRONO determine. Sobre dicho salario se efectuarán las deducciones legales correspondientes ` +
    `(IGSS, IRTRA, ISR cuando aplique) conforme a la legislación vigente. Las horas extraordinarias, bonificaciones y ` +
    `demás emolumentos se pagarán conforme al Código de Trabajo y al Decreto 76-78 de la Bonificación Incentivo.`,
};

const CLAUSULA_QUINTA_INICIAL: ClausulaPlantilla = {
  numero: "QUINTA",
  titulo: "PERÍODO DE PRUEBA",
  contenido:
    `Conforme al artículo 81 del Código de Trabajo, las partes pactan un PERÍODO DE PRUEBA de SESENTA (60) DÍAS ` +
    `contados a partir del {{fecha_inicio}}, durante el cual cualquiera de las partes podrá dar por terminada la relación ` +
    `laboral sin responsabilidad para ninguna de ellas, sin necesidad de expresión de causa ni preaviso. ` +
    `Superado el período de prueba sin manifestación en contrario, el contrato continuará por tiempo indefinido en los ` +
    `términos aquí pactados.`,
};

const CLAUSULA_QUINTA_POSTPRUEBA: ClausulaPlantilla = {
  numero: "QUINTA",
  titulo: "DURACIÓN",
  contenido:
    `El presente contrato es por TIEMPO INDEFINIDO, en sustitución del contrato inicial suscrito entre las partes con ` +
    `fecha {{fecha_inicio}}, una vez superado satisfactoriamente el período de prueba previsto en el artículo 81 del Código ` +
    `de Trabajo. Se reconoce a EL TRABAJADOR la antigüedad acumulada desde la fecha original de ingreso para todos los ` +
    `efectos legales.`,
};

const CLAUSULA_SEXTA: ClausulaPlantilla = {
  numero: "SEXTA",
  titulo: "PRESTACIONES DE LEY",
  contenido:
    `EL TRABAJADOR gozará de todas las prestaciones laborales establecidas en la Constitución Política de la República ` +
    `de Guatemala, el Código de Trabajo y leyes complementarias, incluyendo: (a) Aguinaldo conforme al Decreto 76-78; ` +
    `(b) Bono 14 conforme al Decreto 42-92; (c) Vacaciones anuales pagadas de quince (15) días hábiles después de cada año ` +
    `continuo de labores (Art. 130); (d) Indemnización por tiempo servido en caso de despido injustificado (Art. 82); ` +
    `(e) Bonificación Incentivo de Q 250.00 mensuales (Decreto 37-2001); (f) Las demás prestaciones que correspondan según la ley.`,
};

const CLAUSULA_SEPTIMA: ClausulaPlantilla = {
  numero: "SÉPTIMA",
  titulo: "CONFIDENCIALIDAD, MANEJO DE ARMAS Y EQUIPO",
  contenido:
    `EL TRABAJADOR se obliga a guardar absoluta reserva sobre todas las informaciones, claves de acceso, planos, ` +
    `procedimientos operativos, identidades de clientes y cualquier dato confidencial al que tenga acceso por razón de su cargo, ` +
    `incluso después de terminada la relación laboral. El equipo, uniforme, armamento, municiones, radios y demás bienes ` +
    `entregados son propiedad de EL PATRONO o del cliente y deberán devolverse al cesar sus funciones, en las mismas ` +
    `condiciones en que fueron recibidos, salvo el desgaste natural por uso. EL TRABAJADOR declara conocer y aceptar ` +
    `las normas de la Dirección General de Servicios de Seguridad Privada (DIGESSP) del Ministerio de Gobernación y la ` +
    `Ley de Armas y Municiones (Decreto 15-2009).`,
};

const CLAUSULA_OCTAVA: ClausulaPlantilla = {
  numero: "OCTAVA",
  titulo: "CAUSALES DE TERMINACIÓN DE LA RELACIÓN LABORAL",
  contenido:
    `El presente contrato podrá darse por terminado en los casos siguientes:\n\n` +
    `**A) POR MUTUO CONSENTIMIENTO DE LAS PARTES (Art. 76 inciso a):**\n\n` +
    `Cuando ambas partes acuerden por escrito dar por concluida la relación laboral.\n\n` +
    `**B) POR RENUNCIA DEL TRABAJADOR (Art. 78):**\n\n` +
    `EL TRABAJADOR podrá dar por terminado el contrato dando aviso por escrito a EL PATRONO con la anticipación que indica ` +
    `el artículo 83 del Código de Trabajo, según el tiempo servido.\n\n` +
    `**C) POR DESPIDO JUSTIFICADO — CAUSAS IMPUTABLES AL TRABAJADOR (Art. 77):**\n\n` +
    `EL PATRONO podrá dar por terminado el contrato sin responsabilidad de su parte cuando EL TRABAJADOR incurra en ` +
    `cualquiera de las siguientes faltas, las cuales se consideran graves para los efectos de este contrato:\n\n` +
    `a) Conducta inmoral, agresión, injurias, calumnias o vías de hecho contra el patrono, sus representantes, otros trabajadores, clientes, visitantes o personas custodiadas, dentro o fuera del lugar de trabajo (Art. 77 incisos a y c).\n\n` +
    `b) Cometer o intentar cometer actos de robo, hurto, sustracción, daño intencional, sabotaje o cualquier acto delictivo contra bienes de EL PATRONO, del cliente o de terceros bajo custodia (Art. 77 inciso a).\n\n` +
    `c) Revelar secretos comerciales, claves de acceso, planos, identidades de clientes, ubicación de cámaras o cualquier información confidencial obtenida por razón del cargo (Art. 77 inciso a).\n\n` +
    `d) Presentarse al trabajo en estado de ebriedad, bajo efectos de drogas o sustancias estupefacientes, o consumir las mismas durante la jornada (Art. 77 inciso d). Esta causal es de aplicación inmediata por la naturaleza de la actividad de seguridad privada y porte de armas.\n\n` +
    `e) Faltar al trabajo sin permiso de EL PATRONO o sin causa justificada por dos días laborales completos y consecutivos, o por más de dos días en un mismo mes calendario (Art. 77 inciso f). Cada inasistencia generará descubierto en cobertura operativa que afecta directamente a clientes.\n\n` +
    `f) Abandonar el puesto de trabajo durante la jornada sin autorización del supervisor inmediato. En servicios de seguridad privada, el abandono de puesto se considera falta gravísima por el riesgo que genera a personas y bienes custodiados.\n\n` +
    `g) Negarse de manera manifiesta y reiterada a adoptar las medidas de seguridad e higiene, los procedimientos operativos, los protocolos de emergencia o las instrucciones impartidas por EL PATRONO o el cliente (Art. 77 inciso h).\n\n` +
    `h) Causar intencionalmente o por descuido grave perjuicios materiales, daño a equipos, vehículos, armamento, instalaciones o sistemas (Art. 77 inciso e).\n\n` +
    `i) Disminuir de manera injustificada y reiterada el rendimiento normal de las labores, o realizar actos de bajo rendimiento intencional (Art. 77 inciso e).\n\n` +
    `j) Desobedecer órdenes legítimas y reiteradas de EL PATRONO o sus representantes, relacionadas con el desempeño de las labores (Art. 77 inciso b).\n\n` +
    `k) Falsear datos en su solicitud de empleo, antecedentes, documentos personales (DPI, antecedentes penales y policíacos), o presentar documentos alterados o apócrifos.\n\n` +
    `l) Pérdida, extravío, mal uso o entrega no autorizada del armamento, municiones, uniforme, radios, vehículos o equipo asignado para el servicio.\n\n` +
    `m) Dormirse durante el turno, abandonar el puesto de vigilancia o realizar actividades ajenas al servicio (uso indebido del celular, conversaciones prolongadas, lectura no relacionada al servicio, ingestión de alimentos fuera del horario establecido) que comprometan la atención y seguridad del puesto.\n\n` +
    `n) Recibir gratificaciones, sobornos o coimas de cualquier persona ajena a EL PATRONO, así como facilitar el ingreso o salida de personas, vehículos o bienes sin autorización.\n\n` +
    `o) Suspender o entorpecer maliciosamente las labores, o incitar al personal a realizar paros ilegales (Art. 77 inciso g).\n\n` +
    `p) Encontrarse condenado por sentencia firme a sufrir pena de prisión (Art. 77 inciso i).\n\n` +
    `q) Sufrir incapacidad permanente para el trabajo contratado (Art. 77 inciso j).\n\n` +
    `r) Acumular tres llamadas de atención escritas en un período de doce (12) meses calendario, debidamente notificadas al trabajador y registradas en su expediente laboral.\n\n` +
    `s) Cualquier otra causa análoga a las anteriores prevista en el Código de Trabajo o en el Reglamento Interior de Trabajo de la empresa, debidamente aprobado por la Inspección General de Trabajo.`,
};

const CLAUSULA_NOVENA: ClausulaPlantilla = {
  numero: "NOVENA",
  titulo: "RÉGIMEN DISCIPLINARIO",
  contenido:
    `Las faltas leves a las obligaciones laborales serán sancionadas progresivamente conforme al Reglamento Interior de ` +
    `Trabajo, aplicando: (1) llamada de atención verbal; (2) llamada de atención escrita; (3) suspensión sin goce de ` +
    `salario hasta por ocho (8) días; (4) despido por reincidencia o gravedad. Las faltas graves enumeradas en la ` +
    `cláusula octava facultan a EL PATRONO a aplicar el despido directo sin necesidad de pasar por las medidas progresivas ` +
    `anteriores. Toda sanción será documentada en el expediente del trabajador con copia al interesado.`,
};

const CLAUSULA_DECIMA: ClausulaPlantilla = {
  numero: "DÉCIMA",
  titulo: "DISPOSICIONES FINALES",
  contenido:
    `El presente contrato deja sin efecto cualquier convenio anterior verbal o escrito entre las partes sobre la misma ` +
    `materia. Para todo lo no previsto en este contrato se aplicarán supletoriamente las disposiciones del Código de ` +
    `Trabajo, sus reformas, el Reglamento Interior de Trabajo y demás leyes laborales vigentes en la República de Guatemala. ` +
    `Las partes señalan como lugares para recibir notificaciones los indicados al inicio de este contrato.`,
};

const CIERRE_COMUN =
  `LEÍDO QUE FUE el presente contrato por ambas partes, lo aceptan, ratifican y firman al pie en señal de conformidad, ` +
  `quedando un ejemplar en poder de cada parte y un tercer ejemplar para ser remitido a la Dirección General de Trabajo, ` +
  `de conformidad con el artículo 28 del Código de Trabajo.`;

export const PLANTILLA_INICIAL_DEFAULT: PlantillaContratoDefault = {
  tipo: "inicial",
  titulo: "CONTRATO INDIVIDUAL DE TRABAJO",
  subtitulo: "Por tiempo indefinido — con período de prueba",
  encabezado: ENCABEZADO_COMUN,
  clausulas: [
    CLAUSULA_PRIMERA,
    CLAUSULA_SEGUNDA,
    CLAUSULA_TERCERA,
    CLAUSULA_CUARTA,
    CLAUSULA_QUINTA_INICIAL,
    CLAUSULA_SEXTA,
    CLAUSULA_SEPTIMA,
    CLAUSULA_OCTAVA,
    CLAUSULA_NOVENA,
    CLAUSULA_DECIMA,
  ],
  cierre: CIERRE_COMUN,
};

export const PLANTILLA_POSTPRUEBA_DEFAULT: PlantillaContratoDefault = {
  tipo: "post_prueba",
  titulo: "CONTRATO INDIVIDUAL DE TRABAJO",
  subtitulo: "Por tiempo indefinido — post período de prueba",
  encabezado: ENCABEZADO_COMUN,
  clausulas: [
    CLAUSULA_PRIMERA,
    CLAUSULA_SEGUNDA,
    CLAUSULA_TERCERA,
    CLAUSULA_CUARTA,
    CLAUSULA_QUINTA_POSTPRUEBA,
    CLAUSULA_SEXTA,
    CLAUSULA_SEPTIMA,
    CLAUSULA_OCTAVA,
    CLAUSULA_NOVENA,
    CLAUSULA_DECIMA,
  ],
  cierre: CIERRE_COMUN,
};

export function plantillaDefault(tipo: "inicial" | "post_prueba"): PlantillaContratoDefault {
  return tipo === "inicial" ? PLANTILLA_INICIAL_DEFAULT : PLANTILLA_POSTPRUEBA_DEFAULT;
}

// Catálogo de variables disponibles que el editor expone al usuario.
export const VARIABLES_DISPONIBLES: Array<{ clave: string; descripcion: string; ejemplo: string }> = [
  { clave: "fecha_emision", descripcion: "Fecha del encabezado (igual a fecha de inicio)", ejemplo: "22 de junio de 2026" },
  { clave: "fecha_inicio", descripcion: "Fecha de inicio de la relación laboral", ejemplo: "22 de junio de 2026" },
  { clave: "empleado_nombre", descripcion: "Nombre del trabajador (mayúsculas)", ejemplo: "JUAN PÉREZ LÓPEZ" },
  { clave: "empleado_dpi", descripcion: "DPI del trabajador", ejemplo: "1234567890101" },
  { clave: "empleado_estado_civil", descripcion: "Estado civil (con default)", ejemplo: "casado" },
  { clave: "empleado_direccion", descripcion: "Dirección del trabajador", ejemplo: "Zona 1, Guatemala" },
  { clave: "empleado_telefono_clausula", descripcion: "\"teléfono XXX, \" o vacío", ejemplo: "teléfono 5555-1234, " },
  { clave: "empleado_nit_clausula", descripcion: "\"con NIT XXX, \" o vacío", ejemplo: "con NIT 12345678, " },
  { clave: "empleado_igss_clausula", descripcion: "\"afiliación al IGSS XXX, \" o vacío", ejemplo: "afiliación al IGSS número 123456, " },
  { clave: "cargo", descripcion: "Tipo de personal en texto largo", ejemplo: "Agente de Seguridad Privada" },
  { clave: "puesto", descripcion: "Puesto operativo (texto crudo)", ejemplo: "Banco Industrial Z10" },
  { clave: "puesto_paren", descripcion: "Puesto entre paréntesis con espacio o vacío", ejemplo: "(\"Banco Industrial Z10\") " },
  { clave: "sueldo_num", descripcion: "Salario en número con miles", ejemplo: "3,500.00" },
  { clave: "sueldo_letras", descripcion: "Salario escrito en letras", ejemplo: "TRES MIL QUINIENTOS QUETZALES EXACTOS" },
  { clave: "jornada_label", descripcion: "Jornada en texto", ejemplo: "ordinaria mixta" },
  { clave: "dia_descanso", descripcion: "Día de descanso semanal", ejemplo: "domingo" },
  { clave: "lugar_trabajo", descripcion: "Lugar donde prestará servicios", ejemplo: "las instalaciones del cliente..." },
  { clave: "patrono_razon_social", descripcion: "Razón social del patrono", ejemplo: "ISP S.A." },
  { clave: "patrono_nit", descripcion: "NIT del patrono", ejemplo: "1234567-8" },
  { clave: "patrono_direccion", descripcion: "Dirección del patrono", ejemplo: "Zona 10, Guatemala" },
  { clave: "representante_nombre", descripcion: "Nombre del representante legal", ejemplo: "PEDRO MARTÍNEZ" },
  { clave: "representante_dpi", descripcion: "DPI del representante", ejemplo: "9876543210101" },
  { clave: "representante_cargo", descripcion: "Cargo del representante", ejemplo: "Gerente General" },
  { clave: "representante_edad_texto", descripcion: "\"de XX años de edad\" o \"mayor de edad\"", ejemplo: "de 45 años de edad" },
];
