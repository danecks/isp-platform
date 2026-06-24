/**
 * seed.ts — Datos de prueba E2E para Segunda Quincena de Abril 2026
 *
 * Período: 2026-04-16 al 2026-04-30 (15 días calendario)
 *
 * Crea: 1 cliente, 2 sedes, 24 puestos, 24 colaboradores con 8 escenarios distintos.
 * Limpia datos anteriores del mismo E2E antes de re-sembrar.
 *
 * Escenarios:
 *  CASO A  — EMP-1  Agente Norte-1: falta Apr-18 + PIERDE séptimo (IGSS)
 *  CASO B  — EMP-2  Agente Norte-2: falta Apr-19 + NO pierde séptimo (IGSS)
 *  CASO C  — EMP-3  Recepcionista N-1: permiso sin goce 2 días (Apr 20-21)
 *  CASO D  — EMP-5  Supervisor N-1: vacaciones Apr 22-24, cubierto sin HE (IGSS)
 *  CASO D' — EMP-6  Supervisor N-2: cubre a EMP-5 días 22-24 sin HE adicional (IGSS)
 *  CASO E  — EMP-7  Monitorista N-1: vacaciones Apr 22-24 (mensual)
 *  CASO E' — EMP-8  Monitorista N-2: cubre en su día de descanso → HE (mensual)
 *  CASO F  — EMP-9  Motorista N-1: acumula HE por cubrimientos dobles días 25-26
 *  CASO G  — EMP-12 Auxiliar N-2: sin incidencias, control puro (IGSS)
 *  CASO H  — EMP-13 Agente Sur-1: 3 ausencias simultáneas día 27, falta+séptimo (IGSS)
 */

import { pool } from "@workspace/db";

// ─── Constantes del período ───────────────────────────────────────────────────
export const DESDE = "2026-04-16";
export const HASTA = "2026-04-30";
export const DIAS_PERIODO = 15;
export const MARKER = "E2E-ABR-2026";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function daysInRange(from: string, to: string): string[] {
  const days: string[] = [];
  const d = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  while (d <= end) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

const ALL_DAYS = daysInRange(DESDE, HASTA);

// ─── Definición de empleados ──────────────────────────────────────────────────

interface Employee {
  key: string;
  nombre: string;
  dpi: string;
  puesto_tipo: "agente" | "recepcionista" | "supervisor" | "monitorista" | "motorista" | "auxiliar";
  sede: "norte" | "sur";
  sueldo_base: number;
  horas_contrato: number;
  frecuencia_pago: "quincenal" | "mensual";
  aplica_igss: boolean;
  caso: string;
}

const EMPLOYEES: Employee[] = [
  // ── SEDE NORTE ──────────────────────────────────────────────────────────────
  { key:"EMP-01", nombre:"Ana Cristina Pérez López",       dpi:"E2E00000101", puesto_tipo:"agente",        sede:"norte", sueldo_base:3200,  horas_contrato:48, frecuencia_pago:"quincenal", aplica_igss:true,  caso:"A - Falta+Séptimo" },
  { key:"EMP-02", nombre:"Bruno Alejandro Torres Ruiz",    dpi:"E2E00000102", puesto_tipo:"agente",        sede:"norte", sueldo_base:3200,  horas_contrato:48, frecuencia_pago:"quincenal", aplica_igss:true,  caso:"B - Falta+NoSéptimo" },
  { key:"EMP-03", nombre:"Carmen Isabel Martínez Solis",   dpi:"E2E00000103", puesto_tipo:"recepcionista",  sede:"norte", sueldo_base:2800,  horas_contrato:48, frecuencia_pago:"quincenal", aplica_igss:false, caso:"C - PermisoSinGoce" },
  { key:"EMP-04", nombre:"David Ernesto Fuentes Aquino",   dpi:"E2E00000104", puesto_tipo:"recepcionista",  sede:"norte", sueldo_base:2800,  horas_contrato:48, frecuencia_pago:"quincenal", aplica_igss:false, caso:"PermisoSinGoce-1d" },
  { key:"EMP-05", nombre:"Elena Rosa Hernández Vidal",     dpi:"E2E00000105", puesto_tipo:"supervisor",     sede:"norte", sueldo_base:5000,  horas_contrato:48, frecuencia_pago:"quincenal", aplica_igss:true,  caso:"D - Vacaciones" },
  { key:"EMP-06", nombre:"Fernando José Castillo Mora",    dpi:"E2E00000106", puesto_tipo:"supervisor",     sede:"norte", sueldo_base:5000,  horas_contrato:48, frecuencia_pago:"quincenal", aplica_igss:true,  caso:"D' - CubreVac-SinHE" },
  { key:"EMP-07", nombre:"Gloria Beatriz Alonzo Chan",     dpi:"E2E00000107", puesto_tipo:"monitorista",    sede:"norte", sueldo_base:3500,  horas_contrato:48, frecuencia_pago:"mensual",   aplica_igss:false, caso:"E - Vacaciones-Mensual" },
  { key:"EMP-08", nombre:"Hugo René Méndez Cifuentes",     dpi:"E2E00000108", puesto_tipo:"monitorista",    sede:"norte", sueldo_base:3500,  horas_contrato:48, frecuencia_pago:"mensual",   aplica_igss:false, caso:"E' - CubreDescanso+HE" },
  { key:"EMP-09", nombre:"Irma Consuelo Barrios Sáenz",    dpi:"E2E00000109", puesto_tipo:"motorista",      sede:"norte", sueldo_base:3800,  horas_contrato:48, frecuencia_pago:"quincenal", aplica_igss:false, caso:"F - AcumulaHE" },
  { key:"EMP-10", nombre:"Jorge Antonio Ramírez Lima",     dpi:"E2E00000110", puesto_tipo:"motorista",      sede:"norte", sueldo_base:3800,  horas_contrato:48, frecuencia_pago:"quincenal", aplica_igss:false, caso:"PermisoSinGoce-3d" },
  { key:"EMP-11", nombre:"Karla Viviana Orozco Paz",       dpi:"E2E00000111", puesto_tipo:"auxiliar",       sede:"norte", sueldo_base:2500,  horas_contrato:48, frecuencia_pago:"quincenal", aplica_igss:false, caso:"Vacaciones-2d" },
  { key:"EMP-12", nombre:"Luis Enrique Godínez Reyes",     dpi:"E2E00000112", puesto_tipo:"auxiliar",       sede:"norte", sueldo_base:2500,  horas_contrato:48, frecuencia_pago:"quincenal", aplica_igss:true,  caso:"G - Control-Puro" },
  // ── SEDE SUR ────────────────────────────────────────────────────────────────
  { key:"EMP-13", nombre:"María Luisa Samayoa García",     dpi:"E2E00000113", puesto_tipo:"agente",        sede:"sur",   sueldo_base:3200,  horas_contrato:48, frecuencia_pago:"quincenal", aplica_igss:true,  caso:"H-a Falta+Séptimo" },
  { key:"EMP-14", nombre:"Nelson Arturo López Ortiz",      dpi:"E2E00000114", puesto_tipo:"agente",        sede:"sur",   sueldo_base:3200,  horas_contrato:48, frecuencia_pago:"quincenal", aplica_igss:false, caso:"H-b Falta+PermisoSG" },
  { key:"EMP-15", nombre:"Olga Patricia Guzmán Alvarado",  dpi:"E2E00000115", puesto_tipo:"recepcionista",  sede:"sur",   sueldo_base:2800,  horas_contrato:48, frecuencia_pago:"quincenal", aplica_igss:false, caso:"H-c CubreDescanso+HE" },
  { key:"EMP-16", nombre:"Pedro Alfredo Juárez Chaj",      dpi:"E2E00000116", puesto_tipo:"recepcionista",  sede:"sur",   sueldo_base:2800,  horas_contrato:48, frecuencia_pago:"quincenal", aplica_igss:false, caso:"PermisoSinGoce-Apr27" },
  { key:"EMP-17", nombre:"Queyla Romelia Xicol Tum",       dpi:"E2E00000117", puesto_tipo:"supervisor",     sede:"sur",   sueldo_base:5000,  horas_contrato:48, frecuencia_pago:"quincenal", aplica_igss:true,  caso:"Falta+Séptimo-Apr22" },
  { key:"EMP-18", nombre:"Roberto Humberto Caal Chub",     dpi:"E2E00000118", puesto_tipo:"supervisor",     sede:"sur",   sueldo_base:5000,  horas_contrato:48, frecuencia_pago:"quincenal", aplica_igss:true,  caso:"G - Control-Puro" },
  { key:"EMP-19", nombre:"Sandra Noemí Estrada Boc",       dpi:"E2E00000119", puesto_tipo:"monitorista",    sede:"sur",   sueldo_base:3500,  horas_contrato:48, frecuencia_pago:"mensual",   aplica_igss:false, caso:"Vacaciones-3d-Mensual" },
  { key:"EMP-20", nombre:"Tomás Sebastián Cholotío Solis", dpi:"E2E00000120", puesto_tipo:"monitorista",    sede:"sur",   sueldo_base:3500,  horas_contrato:48, frecuencia_pago:"mensual",   aplica_igss:false, caso:"Incapacidad+PermisoConGoce" },
  { key:"EMP-21", nombre:"Ursula Marisol Xoc Cucul",       dpi:"E2E00000121", puesto_tipo:"motorista",      sede:"sur",   sueldo_base:3800,  horas_contrato:48, frecuencia_pago:"quincenal", aplica_igss:false, caso:"Vacaciones-2d" },
  { key:"EMP-22", nombre:"Víctor Manuel Toj Cuc",          dpi:"E2E00000122", puesto_tipo:"motorista",      sede:"sur",   sueldo_base:3800,  horas_contrato:48, frecuencia_pago:"quincenal", aplica_igss:false, caso:"B-Sur Falta+NoSéptimo" },
  { key:"EMP-23", nombre:"Wendy Alejandra Caal Ical",      dpi:"E2E00000123", puesto_tipo:"auxiliar",       sede:"sur",   sueldo_base:2500,  horas_contrato:48, frecuencia_pago:"quincenal", aplica_igss:false, caso:"Vacaciones-2d" },
  { key:"EMP-24", nombre:"Ximena Patricia Poou Maas",      dpi:"E2E00000124", puesto_tipo:"auxiliar",       sede:"sur",   sueldo_base:2500,  horas_contrato:48, frecuencia_pago:"quincenal", aplica_igss:false, caso:"PermisoSinGoce-Multiple" },
];

// ─── Interfaz de novedad diaria ───────────────────────────────────────────────
interface Novedad {
  fecha: string;
  trabajo_dia: boolean;
  horas_trabajadas: number;
  horas_extra: number;
  falta: boolean;
  suspension: boolean;
  descanso_trabajado: boolean;
  afecta_septimo: boolean;
  descuento_dia: boolean;
  tipo_novedad: string | null;
  impacto_nomina: string;
  puesto_cubierto_key: string | null;
  observaciones: string | null;
}

function trabajaNormal(fecha: string): Novedad {
  return {
    fecha, trabajo_dia:true, horas_trabajadas:8, horas_extra:0,
    falta:false, suspension:false, descanso_trabajado:false,
    afecta_septimo:false, descuento_dia:false, tipo_novedad:null,
    impacto_nomina:"aprobado_rrhh", puesto_cubierto_key:null, observaciones:null,
  };
}

function faltaDia(fecha: string, septimo: boolean): Novedad {
  return {
    fecha, trabajo_dia:false, horas_trabajadas:0, horas_extra:0,
    falta:true, suspension:false, descanso_trabajado:false,
    afecta_septimo:septimo, descuento_dia:true, tipo_novedad:"falta_injustificada",
    impacto_nomina:"aprobado_rrhh", puesto_cubierto_key:null, observaciones:null,
  };
}

function permisoSinGoce(fecha: string): Novedad {
  return {
    fecha, trabajo_dia:false, horas_trabajadas:0, horas_extra:0,
    falta:false, suspension:false, descanso_trabajado:false,
    afecta_septimo:false, descuento_dia:true, tipo_novedad:"permiso_sin_goce",
    impacto_nomina:"aprobado_rrhh", puesto_cubierto_key:null, observaciones:null,
  };
}

function permisoConGoce(fecha: string): Novedad {
  return {
    fecha, trabajo_dia:false, horas_trabajadas:0, horas_extra:0,
    falta:false, suspension:false, descanso_trabajado:false,
    afecta_septimo:false, descuento_dia:false, tipo_novedad:"permiso_con_goce",
    impacto_nomina:"aprobado_rrhh", puesto_cubierto_key:null, observaciones:null,
  };
}

function vacacionesDia(fecha: string): Novedad {
  return {
    fecha, trabajo_dia:false, horas_trabajadas:0, horas_extra:0,
    falta:false, suspension:false, descanso_trabajado:false,
    afecta_septimo:false, descuento_dia:false, tipo_novedad:"vacaciones",
    impacto_nomina:"aprobado_rrhh", puesto_cubierto_key:null, observaciones:null,
  };
}

function incapacidadDia(fecha: string): Novedad {
  return {
    fecha, trabajo_dia:false, horas_trabajadas:0, horas_extra:0,
    falta:false, suspension:false, descanso_trabajado:false,
    afecta_septimo:false, descuento_dia:false, tipo_novedad:"incapacidad",
    impacto_nomina:"aprobado_rrhh", puesto_cubierto_key:null, observaciones:null,
  };
}

function descansoTrabajado(fecha: string, heHoras: number, cubrePuestoKey: string): Novedad {
  return {
    fecha, trabajo_dia:true, horas_trabajadas:heHoras, horas_extra:heHoras,
    falta:false, suspension:false, descanso_trabajado:true,
    afecta_septimo:false, descuento_dia:false, tipo_novedad:null,
    impacto_nomina:"aprobado_rrhh", puesto_cubierto_key:cubrePuestoKey,
    observaciones:`Cobertura de descanso — ${heHoras}h extra generadas`,
  };
}

function cubreExtraordinario(fecha: string, heHoras: number, cubrePuestoKey: string): Novedad {
  return {
    fecha, trabajo_dia:true, horas_trabajadas:8 + heHoras, horas_extra:heHoras,
    falta:false, suspension:false, descanso_trabajado:false,
    afecta_septimo:false, descuento_dia:false, tipo_novedad:null,
    impacto_nomina:"aprobado_rrhh", puesto_cubierto_key:cubrePuestoKey,
    observaciones:`Cobertura extraordinaria — ${heHoras}h extra`,
  };
}

// ─── Plan de novedades por empleado ──────────────────────────────────────────
type NovedadPlan = Map<string, Novedad[]>;

function buildNovedadPlan(): NovedadPlan {
  const plan = new Map<string, Novedad[]>();

  function set(key: string, novedades: Novedad[]) {
    plan.set(key, novedades);
  }

  function allWork(key: string) {
    set(key, ALL_DAYS.map(trabajaNormal));
  }

  function applyOverrides(key: string, overrides: Record<string, Novedad>) {
    const base = ALL_DAYS.map(d => overrides[d] ?? trabajaNormal(d));
    set(key, base);
  }

  // ── EMP-01: CASO A — Falta Apr-18 + PIERDE séptimo ─────────────────────────
  applyOverrides("EMP-01", {
    "2026-04-18": faltaDia("2026-04-18", true),
  });

  // ── EMP-02: CASO B — Falta Apr-19 + NO pierde séptimo ──────────────────────
  applyOverrides("EMP-02", {
    "2026-04-19": faltaDia("2026-04-19", false),
  });

  // ── EMP-03: CASO C — Permiso sin goce Apr 20-21 ─────────────────────────────
  applyOverrides("EMP-03", {
    "2026-04-20": permisoSinGoce("2026-04-20"),
    "2026-04-21": permisoSinGoce("2026-04-21"),
  });

  // ── EMP-04: Permiso sin goce 1 día (Apr-29) ─────────────────────────────────
  applyOverrides("EMP-04", {
    "2026-04-29": permisoSinGoce("2026-04-29"),
  });

  // ── EMP-05: CASO D — Vacaciones Apr 22-24 ───────────────────────────────────
  applyOverrides("EMP-05", {
    "2026-04-22": vacacionesDia("2026-04-22"),
    "2026-04-23": vacacionesDia("2026-04-23"),
    "2026-04-24": vacacionesDia("2026-04-24"),
  });

  // ── EMP-06: CASO D' — Cubre puesto EMP-05 días 22-24 sin HE ─────────────────
  applyOverrides("EMP-06", {
    "2026-04-22": { ...trabajaNormal("2026-04-22"), puesto_cubierto_key:"EMP-05", observaciones:"Cubre vacaciones EMP-05" },
    "2026-04-23": { ...trabajaNormal("2026-04-23"), puesto_cubierto_key:"EMP-05", observaciones:"Cubre vacaciones EMP-05" },
    "2026-04-24": { ...trabajaNormal("2026-04-24"), puesto_cubierto_key:"EMP-05", observaciones:"Cubre vacaciones EMP-05" },
  });

  // ── EMP-07: CASO E — Vacaciones Apr 22-24 (mensual) ─────────────────────────
  applyOverrides("EMP-07", {
    "2026-04-22": vacacionesDia("2026-04-22"),
    "2026-04-23": vacacionesDia("2026-04-23"),
    "2026-04-24": vacacionesDia("2026-04-24"),
  });

  // ── EMP-08: CASO E' — Cubre EMP-07 en su descanso → HE ─────────────────────
  applyOverrides("EMP-08", {
    "2026-04-22": descansoTrabajado("2026-04-22", 8, "EMP-07"),
    "2026-04-23": descansoTrabajado("2026-04-23", 8, "EMP-07"),
    "2026-04-24": descansoTrabajado("2026-04-24", 8, "EMP-07"),
  });

  // ── EMP-09: CASO F — Acumula HE cubriendo doble turno días 25-26 ────────────
  applyOverrides("EMP-09", {
    "2026-04-25": cubreExtraordinario("2026-04-25", 8, "EMP-10"),
    "2026-04-26": cubreExtraordinario("2026-04-26", 8, "EMP-10"),
  });

  // ── EMP-10: Permiso sin goce Apr 23-25 ──────────────────────────────────────
  applyOverrides("EMP-10", {
    "2026-04-23": permisoSinGoce("2026-04-23"),
    "2026-04-24": permisoSinGoce("2026-04-24"),
    "2026-04-25": permisoSinGoce("2026-04-25"),
  });

  // ── EMP-11: Vacaciones Apr 24-25 ────────────────────────────────────────────
  applyOverrides("EMP-11", {
    "2026-04-24": vacacionesDia("2026-04-24"),
    "2026-04-25": vacacionesDia("2026-04-25"),
  });

  // ── EMP-12: CASO G — Sin incidencias (control puro, IGSS) ───────────────────
  allWork("EMP-12");

  // ── EMP-13: CASO H-a — Falta Apr-27 + PIERDE séptimo ───────────────────────
  applyOverrides("EMP-13", {
    "2026-04-27": faltaDia("2026-04-27", true),
  });

  // ── EMP-14: CASO H-b — Falta Apr-26 + Permiso sin goce Apr-27 ───────────────
  applyOverrides("EMP-14", {
    "2026-04-26": faltaDia("2026-04-26", false),
    "2026-04-27": permisoSinGoce("2026-04-27"),
  });

  // ── EMP-15: CASO H-c — Cubre múltiple ausencia Apr-27 en descanso → HE ──────
  applyOverrides("EMP-15", {
    "2026-04-27": descansoTrabajado("2026-04-27", 8, "EMP-13"),
  });

  // ── EMP-16: Permiso sin goce Apr-27 ─────────────────────────────────────────
  applyOverrides("EMP-16", {
    "2026-04-27": permisoSinGoce("2026-04-27"),
  });

  // ── EMP-17: Falta Apr-22 + PIERDE séptimo ───────────────────────────────────
  applyOverrides("EMP-17", {
    "2026-04-22": faltaDia("2026-04-22", true),
  });

  // ── EMP-18: CASO G — Sin incidencias (control puro, IGSS) ───────────────────
  allWork("EMP-18");

  // ── EMP-19: Vacaciones Apr 25-27 (mensual) ───────────────────────────────────
  applyOverrides("EMP-19", {
    "2026-04-25": vacacionesDia("2026-04-25"),
    "2026-04-26": vacacionesDia("2026-04-26"),
    "2026-04-27": vacacionesDia("2026-04-27"),
  });

  // ── EMP-20: Incapacidad Apr 23-25 + Permiso con goce Apr-26 ─────────────────
  applyOverrides("EMP-20", {
    "2026-04-23": incapacidadDia("2026-04-23"),
    "2026-04-24": incapacidadDia("2026-04-24"),
    "2026-04-25": incapacidadDia("2026-04-25"),
    "2026-04-26": permisoConGoce("2026-04-26"),
  });

  // ── EMP-21: Vacaciones Apr 24-25 ────────────────────────────────────────────
  applyOverrides("EMP-21", {
    "2026-04-24": vacacionesDia("2026-04-24"),
    "2026-04-25": vacacionesDia("2026-04-25"),
  });

  // ── EMP-22: Falta Apr-17 + NO pierde séptimo (excepción RRHH) ───────────────
  applyOverrides("EMP-22", {
    "2026-04-17": faltaDia("2026-04-17", false),
  });

  // ── EMP-23: Vacaciones Apr 26-27 ────────────────────────────────────────────
  applyOverrides("EMP-23", {
    "2026-04-26": vacacionesDia("2026-04-26"),
    "2026-04-27": vacacionesDia("2026-04-27"),
  });

  // ── EMP-24: Permiso sin goce múltiple (Apr 24, 25, 28) ──────────────────────
  applyOverrides("EMP-24", {
    "2026-04-24": permisoSinGoce("2026-04-24"),
    "2026-04-25": permisoSinGoce("2026-04-25"),
    "2026-04-28": permisoSinGoce("2026-04-28"),
  });

  return plan;
}

// ─── Eventos RRHH (decisiones sobre séptimo y aprobaciones) ──────────────────
interface EventoRRHH {
  empKey: string;
  tipo_evento: string;
  fecha: string;
  afecta_septimo_res: boolean;
  tipo_resolucion: string;
  observaciones: string;
}

const EVENTOS_RRHH: EventoRRHH[] = [
  { empKey:"EMP-01", tipo_evento:"falta", fecha:"2026-04-18", afecta_septimo_res:true,  tipo_resolucion:"falta_injustificada", observaciones:"CASO A: Falta Apr-18, RRHH confirma pérdida de séptimo semana 17" },
  { empKey:"EMP-02", tipo_evento:"falta", fecha:"2026-04-19", afecta_septimo_res:false, tipo_resolucion:"falta_injustificada", observaciones:"CASO B: Falta Apr-19, RRHH decide NO aplicar pérdida de séptimo — excepción" },
  { empKey:"EMP-13", tipo_evento:"falta", fecha:"2026-04-27", afecta_septimo_res:true,  tipo_resolucion:"falta_injustificada", observaciones:"CASO H-a: Falta Apr-27, RRHH confirma pérdida de séptimo semana 18" },
  { empKey:"EMP-14", tipo_evento:"falta", fecha:"2026-04-26", afecta_septimo_res:false, tipo_resolucion:"falta_injustificada", observaciones:"CASO H-b: Falta Apr-26, RRHH NO aplica pérdida de séptimo" },
  { empKey:"EMP-17", tipo_evento:"falta", fecha:"2026-04-22", afecta_septimo_res:true,  tipo_resolucion:"falta_injustificada", observaciones:"Falta Apr-22, RRHH confirma pérdida de séptimo semana 17" },
  { empKey:"EMP-22", tipo_evento:"falta", fecha:"2026-04-17", afecta_septimo_res:false, tipo_resolucion:"falta_injustificada", observaciones:"Falta Apr-17, RRHH excepción — NO pierde séptimo (primer falta del año)" },
];

// ─── Función principal de seed ────────────────────────────────────────────────
export async function runSeed(verbose = true) {
  const log = (...args: unknown[]) => verbose && console.log(...args);

  log("\n══════════════════════════════════════════════════════════════════");
  log("  SEED E2E — Segunda Quincena de Abril 2026");
  log("  Período:", DESDE, "→", HASTA, `(${DIAS_PERIODO} días)`);
  log("══════════════════════════════════════════════════════════════════\n");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── 1. Limpiar datos anteriores del E2E (por marker en notas) ──────────────
    log("1. Limpiando datos anteriores del E2E...");

    const { rows: prevEmps } = await client.query<{ id: number }>(
      `SELECT id FROM employees WHERE notas LIKE $1 ORDER BY id`, [`%${MARKER}%`]
    );
    const prevEmpIds = prevEmps.map(r => r.id);

    if (prevEmpIds.length > 0) {
      log(`   → Eliminando ${prevEmpIds.length} empleados anteriores y sus datos...`);
      await client.query(`DELETE FROM novedades_nomina_diarias WHERE employee_id = ANY($1)`, [prevEmpIds]);
      await client.query(`DELETE FROM eventos_rrhh WHERE employee_id = ANY($1)`, [prevEmpIds]);
      await client.query(`UPDATE puestos_operativos SET titular_employee_id = NULL, titular_nombre = NULL WHERE titular_employee_id = ANY($1)`, [prevEmpIds]);
      const { rows: puestos } = await client.query<{ id: number }>(
        `SELECT id FROM puestos_operativos WHERE notas LIKE $1`, [`%${MARKER}%`]
      );
      if (puestos.length > 0) {
        await client.query(`DELETE FROM puestos_operativos WHERE id = ANY($1)`, [puestos.map(p => p.id)]);
      }
      await client.query(`DELETE FROM employees WHERE id = ANY($1)`, [prevEmpIds]);
    }

    const { rows: prevClientes } = await client.query<{ id: number }>(
      `SELECT id FROM clients WHERE notas LIKE $1`, [`%${MARKER}%`]
    );
    if (prevClientes.length > 0) {
      log(`   → Eliminando ${prevClientes.length} cliente(s) anteriores...`);
      await client.query(`DELETE FROM clients WHERE id = ANY($1)`, [prevClientes.map(c => c.id)]);
    }

    log("   → Limpieza completa.\n");

    // ── 2. Crear cliente de prueba ─────────────────────────────────────────────
    log("2. Creando cliente de prueba...");
    const { rows: [clt] } = await client.query<{ id: number }>(
      `INSERT INTO clients (nombre, nombre_comercial, sector, estado, portal_cliente_id, notas)
       VALUES ('CLIENTE PRUEBA E2E ABRIL', 'CLT-E2E-ABRIL', 'Seguridad Privada', 'activo', 'clt-e2e-abril-2026', $1)
       RETURNING id`, [`${MARKER} — cliente de prueba integral`]
    );
    const clienteId = clt.id;
    log(`   → Cliente creado ID=${clienteId}\n`);

    // ── 3. Crear 2 sedes ──────────────────────────────────────────────────────
    log("3. Creando sedes...");
    const { rows: [sedeNorte] } = await client.query<{ id: number }>(
      `INSERT INTO client_sedes (client_id, nombre, direccion, ciudad, contacto, activo)
       VALUES ($1, 'Sede Norte', 'Zona Industrial Norte, Guatemala', 'Guatemala', 'Coordinador Norte', true)
       RETURNING id`, [clienteId]
    );
    const { rows: [sedeSur] } = await client.query<{ id: number }>(
      `INSERT INTO client_sedes (client_id, nombre, direccion, ciudad, contacto, activo)
       VALUES ($1, 'Sede Sur', 'Zona Franca Sur, Villa Nueva', 'Villa Nueva', 'Coordinador Sur', true)
       RETURNING id`, [clienteId]
    );
    const sedeIdNorte = sedeNorte.id;
    const sedeIdSur = sedeSur.id;
    log(`   → Sede Norte ID=${sedeIdNorte}, Sede Sur ID=${sedeIdSur}\n`);

    // ── 4. Crear empleados ─────────────────────────────────────────────────────
    log("4. Creando 24 colaboradores...");
    const empIdByKey = new Map<string, number>();

    for (const emp of EMPLOYEES) {
      const sedeNombre = emp.sede === "norte" ? "Sede Norte" : "Sede Sur";
      const sedeId = emp.sede === "norte" ? sedeIdNorte : sedeIdSur;

      const puestoLabel: Record<Employee["puesto_tipo"], string> = {
        agente: "Agente de Seguridad",
        recepcionista: "Recepcionista",
        supervisor: "Supervisor",
        monitorista: "Monitorista",
        motorista: "Motorista",
        auxiliar: "Auxiliar Operativo",
      };

      const { rows: [empRow] } = await client.query<{ id: number }>(
        `INSERT INTO employees (
           external_id, nombre_completo, dpi, puesto, area, estado_laboral, sede,
           fecha_ingreso, sueldo_base, tipo_jornada, horas_contrato, frecuencia_pago,
           aplica_igss_general, estado_igss, tipo_personal, cliente_id, notas
         ) VALUES (
           $1, $2, $3, $4, $5, 'activo', $6,
           '2024-01-15', $7, 'tiempo_completo', $8, $9,
           $10, $11, 'guardia', $12, $13
         ) RETURNING id`,
        [
          emp.key,
          emp.nombre,
          emp.dpi,
          puestoLabel[emp.puesto_tipo],
          "Operaciones",
          sedeNombre,
          emp.sueldo_base,
          emp.horas_contrato,
          emp.frecuencia_pago,
          emp.aplica_igss,
          emp.aplica_igss ? "activo" : "no_activo",
          clienteId,
          `${MARKER} | ${emp.key} | CASO: ${emp.caso} | Sede: ${sedeNombre}`,
        ]
      );
      empIdByKey.set(emp.key, empRow.id);
      log(`   → ${emp.key} "${emp.nombre}" → ID=${empRow.id}`);
    }
    log("");

    // ── 5. Crear puestos operativos (1 por empleado) ───────────────────────────
    log("5. Creando 24 puestos operativos...");
    const puestoIdByEmpKey = new Map<string, number>();

    for (const emp of EMPLOYEES) {
      const empId = empIdByKey.get(emp.key)!;
      const sedeId = emp.sede === "norte" ? sedeIdNorte : sedeIdSur;
      const puestoLabel: Record<Employee["puesto_tipo"], string> = {
        agente: "Agente de Seguridad",
        recepcionista: "Recepcionista",
        supervisor: "Supervisor",
        monitorista: "Monitorista",
        motorista: "Motorista",
        auxiliar: "Auxiliar Operativo",
      };

      const { rows: [pRow] } = await client.query<{ id: number }>(
        `INSERT INTO puestos_operativos (
           cliente_id, cliente_nombre, nombre, sede_id, titular_employee_id, titular_nombre,
           activo, aplica_igss, regimen_igss, elegible_horas_extra,
           hora_entrada, hora_salida, jornada, salario_puesto, notas
         ) VALUES (
           $1, 'CLIENTE PRUEBA E2E ABRIL', $2, $3, $4, $5,
           true, $6, $7, true,
           '07:00', '15:00', 'tiempo_completo', $8, $9
         ) RETURNING id`,
        [
          clienteId,
          `${puestoLabel[emp.puesto_tipo]} — ${emp.key}`,
          sedeId,
          empId,
          emp.nombre,
          emp.aplica_igss,
          emp.aplica_igss ? "general" : "no_aplica",
          emp.sueldo_base,
          `${MARKER} | Puesto de ${emp.key}`,
        ]
      );
      puestoIdByEmpKey.set(emp.key, pRow.id);
    }
    log(`   → 24 puestos creados\n`);

    // ── 6. Insertar novedades_nomina_diarias ───────────────────────────────────
    log("6. Insertando novedades del período...");
    const plan = buildNovedadPlan();
    let totalNovedades = 0;

    for (const emp of EMPLOYEES) {
      const empId = empIdByKey.get(emp.key)!;
      const puestoTitularId = puestoIdByEmpKey.get(emp.key)!;
      const novedades = plan.get(emp.key) ?? [];

      for (const nov of novedades) {
        const puestoCubiertId = nov.puesto_cubierto_key
          ? puestoIdByEmpKey.get(nov.puesto_cubierto_key) ?? null
          : null;

        await client.query(
          `INSERT INTO novedades_nomina_diarias (
             fecha, employee_id, empleado_nombre,
             trabajo_dia, horas_trabajadas, horas_extra,
             falta, suspension, descanso_trabajado,
             afecta_septimo, descuento_dia,
             puesto_titular_id, puesto_titular_nombre,
             puesto_cubierto_id, puesto_cubierto_nombre,
             num_puestos_cubiertos,
             tipo_novedad, impacto_nomina, requiere_revision_rrhh,
             observaciones, fuente
           ) VALUES (
             $1, $2, $3,
             $4, $5, $6,
             $7, $8, $9,
             $10, $11,
             $12, $13,
             $14, $15,
             $16,
             $17, $18, false,
             $19, 'e2e_seed'
           )
           ON CONFLICT (fecha, employee_id) DO UPDATE SET
             trabajo_dia=EXCLUDED.trabajo_dia, horas_trabajadas=EXCLUDED.horas_trabajadas,
             horas_extra=EXCLUDED.horas_extra, falta=EXCLUDED.falta,
             suspension=EXCLUDED.suspension, descanso_trabajado=EXCLUDED.descanso_trabajado,
             afecta_septimo=EXCLUDED.afecta_septimo, descuento_dia=EXCLUDED.descuento_dia,
             puesto_titular_id=EXCLUDED.puesto_titular_id,
             puesto_titular_nombre=EXCLUDED.puesto_titular_nombre,
             puesto_cubierto_id=EXCLUDED.puesto_cubierto_id,
             puesto_cubierto_nombre=EXCLUDED.puesto_cubierto_nombre,
             num_puestos_cubiertos=EXCLUDED.num_puestos_cubiertos,
             tipo_novedad=EXCLUDED.tipo_novedad, impacto_nomina=EXCLUDED.impacto_nomina,
             observaciones=EXCLUDED.observaciones, fuente=EXCLUDED.fuente`,
          [
            nov.fecha, empId, emp.nombre,
            nov.trabajo_dia, nov.horas_trabajadas, nov.horas_extra,
            nov.falta, nov.suspension, nov.descanso_trabajado,
            nov.afecta_septimo, nov.descuento_dia,
            puestoTitularId, `Puesto de ${emp.key}`,
            puestoCubiertId,
            nov.puesto_cubierto_key ? `Puesto de ${nov.puesto_cubierto_key}` : null,
            puestoCubiertId ? 1 : 0,
            nov.tipo_novedad, nov.impacto_nomina,
            nov.observaciones,
          ]
        );
        totalNovedades++;
      }
    }
    log(`   → ${totalNovedades} novedades insertadas (${EMPLOYEES.length} empleados × ${ALL_DAYS.length} días)\n`);

    // ── 7. Insertar eventos RRHH ───────────────────────────────────────────────
    log("7. Insertando eventos RRHH (decisiones séptimo día)...");
    const eventoIdByEmpKey = new Map<string, number>();

    for (const ev of EVENTOS_RRHH) {
      const empId = empIdByKey.get(ev.empKey)!;
      const emp = EMPLOYEES.find(e => e.key === ev.empKey)!;

      const { rows: [evRow] } = await client.query<{ id: number }>(
        `INSERT INTO eventos_rrhh (
           employee_id, employee_nombre, tipo_evento, fecha,
           estado, generado_desde, observaciones,
           afecta_nomina, afecta_septimo_res, tipo_resolucion,
           rrhh_resuelto_por, rrhh_resuelto_at, impacto_septimo
         ) VALUES (
           $1, $2, $3, $4::timestamptz,
           'cerrado', 'e2e_seed', $5,
           true, $6, $7,
           'admin', NOW(), $8
         ) RETURNING id`,
        [
          empId, emp.nombre, ev.tipo_evento, ev.fecha,
          ev.observaciones,
          ev.afecta_septimo_res,
          ev.tipo_resolucion,
          ev.afecta_septimo_res ? "pierde" : "mantiene",
        ]
      );
      eventoIdByEmpKey.set(ev.empKey, evRow.id);

      // Vincular el evento a la novedad del mismo día
      await client.query(
        `UPDATE novedades_nomina_diarias
           SET evento_rrhh_id = $1
         WHERE employee_id = $2 AND fecha = $3::date`,
        [evRow.id, empId, ev.fecha]
      );

      log(`   → Evento RRHH para ${ev.empKey} el ${ev.fecha}: séptimo=${ev.afecta_septimo_res ? "PIERDE" : "MANTIENE"}`);
    }
    log("");

    await client.query("COMMIT");

    log("══════════════════════════════════════════════════════════════════");
    log("  SEED COMPLETADO EXITOSAMENTE");
    log("══════════════════════════════════════════════════════════════════");

    return { clienteId, sedeIdNorte, sedeIdSur, empIdByKey, puestoIdByEmpKey };

  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
