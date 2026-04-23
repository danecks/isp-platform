/**
 * turno-calc.ts — Motor de cálculo de turnos de ISPSA
 *
 * TURNOS SOPORTADOS:
 *
 *   12h    → ciclo 24h  → trabaja todos los días, descanso semanal por dia_descanso
 *   8h     → ciclo 8h   → trabaja todos los días, descanso semanal por dia_descanso
 *   12x36  → ciclo 48h  → trabaja 12h, descansa 36h (cada 2 días)
 *
 *   24x24  → ciclo 48h  → 1 día trabaja, 1 día descansa (2 titulares por puesto)
 *
 *   24x48  → LÓGICA SEMANAL MIXTA (NO es ciclo fijo de 3 días):
 *            Entre semana alterna como 24x24 (Lun–Vie).
 *            En fin de semana (Vie→Dom) uno de los dos titulares cubre 48h corridas.
 *            La semana siguiente se invierten completamente.
 *            Requiere fecha_inicio_ciclo = un LUNES (ancla de semana).
 *            Los dos titulares deben tener fecha_inicio_ciclo con 7 días de diferencia.
 *
 *            Patrón semana "propia" (paridad 0):
 *              Lun=trabaja, Mar=descansa, Mié=trabaja, Jue=descansa,
 *              Vie=trabaja (inicio 48h), Sáb=trabaja (cont. 48h), Dom=descansa
 *
 *            Patrón semana "ajena" (paridad 1):
 *              Lun=descansa, Mar=trabaja, Mié=descansa, Jue=trabaja,
 *              Vie=descansa, Sáb=descansa, Dom=trabaja
 *
 *   24x72  → ciclo 96h  → 1 día trabaja, 3 días descansa (4 titulares por puesto)
 *
 *   8x8    → ciclo 16 días → 8 días ON, 8 días OFF (horas_trabajo=192, horas_descanso=192)
 *
 * REGLA CLAVE:
 *   descansoPorCiclo = true → descanso NORMAL del ciclo, no alerta operativa.
 *   disponibleHE = true     → el agente puede hacer horas extra.
 */

export interface Turno {
  id: number;
  nombre: string;
  tipo_ciclo?: string | null;     // '12h' | '24x24' | '24x48' | '24x72' | '8x8' | '8h' | ...
  horas_trabajo: number;
  horas_descanso: number;
  ciclo_horas?: number;           // = horas_trabajo + horas_descanso (calculado)
}

export interface EstadoCiclo {
  trabaja: boolean;
  horasEsperadas: number;
  descansoPorCiclo: boolean;      // true → descanso normal del ciclo (no es alerta)
  disponibleHE: boolean;          // puede hacer horas extra
  tipoCiclo: "diario" | "24x48_semanal" | "ciclo_alternado" | "ciclo_bloques" | "sin_turno";
  posicionEnCiclo?: number;       // para turnos de ciclo fijo: posición 0-based
  diasCiclo?: number;
  diasTrabajo?: number;
  // Para 24x48: info adicional de debug
  paridadSemana?: 0 | 1;         // 0=semana propia, 1=semana ajena
  diaSemana?: number;            // 0=Lun .. 6=Dom
}

/**
 * calcularEstadoCiclo — Función principal. Responde para cualquier fecha:
 * - ¿trabaja ese día?
 * - ¿está en descanso normal de ciclo?
 * - ¿puede hacer horas extra?
 *
 * @param turno             Registro del turno con tipo_ciclo y horas
 * @param fechaInicioCiclo  Fecha de inicio del ciclo del agente (ancla).
 *                          Para 24x48 DEBE ser un lunes.
 * @param fecha             Fecha a consultar (YYYY-MM-DD)
 * @param diaDescanso       Día de descanso semanal (para turnos diarios: 12h, 8h)
 */
/**
 * Resuelve el día de descanso efectivo para una fecha dada.
 * Si hay un override registrado para la semana (lunes-domingo) que contiene esa fecha,
 * se usa ese override. Si no, se usa el `diaDescansoDefault` del empleado.
 */
export function resolverDiaDescanso(
  fecha: string,
  diaDescansoDefault?: string | null,
  descansoOverrides?: Record<string, string> | null,
): string | null {
  if (descansoOverrides && Object.keys(descansoOverrides).length > 0) {
    const lunes = getLunesISO(fecha);
    const ov = descansoOverrides[lunes];
    if (ov) return ov;
  }
  return diaDescansoDefault ?? null;
}

export function calcularEstadoCiclo(
  turno: Turno,
  fechaInicioCiclo: string | Date | null,
  fecha: string,
  diaDescanso?: string | null,
  descansoOverrides?: Record<string, string> | null,
): EstadoCiclo {
  const ht = parseFloat(String(turno.horas_trabajo ?? 0));
  const hd = parseFloat(String(turno.horas_descanso ?? 0));
  const tipoCiclo = turno.tipo_ciclo ?? "";

  // ── 24x48 — Lógica semanal mixta ────────────────────────────────────────────
  // No se usa ciclo fijo. Se determina por día de semana + paridad de semana.
  if (tipoCiclo === "24x48" || (ht === 24 && hd === 48)) {
    return calcular24x48(fechaInicioCiclo, fecha);
  }

  // ── 24x72 — Patrón explícito de 30 días (2 titulares complementarios) ───────
  // ISPSA: NO es ciclo simple de 4 días (1 trabaja + 3 descansa).
  // Requiere 2 titulares con fecha_inicio_ciclo desplazada 15 días entre sí.
  // Cada titular trabaja exactamente 15/30 días (50%). Cobertura perfecta: 1 por día.
  if (tipoCiclo === "24x72") {
    return calcular24x72Patron30(fechaInicioCiclo, fecha);
  }

  // ── 12h — Ciclo de 7 días: 6 trabaja + 1 descansa ──────────────────────────
  // El turno de 12h NO es un turno diario plano. El agente trabaja 12h por día
  // durante 6 días consecutivos y descansa el séptimo.
  // horasEsperadas = 12 (no 24) en los días de trabajo.
  if (tipoCiclo === "12h") {
    return calcular12Horas(fechaInicioCiclo, fecha);
  }

  // ── Turnos diarios (ciclo ≤ 24h): 8h y similares ──────────────────────────
  // El agente trabaja todos los días. El descanso semanal se controla por dia_descanso,
  // con posibles overrides por semana via descansoOverrides.
  const ciclo = ht + hd;
  if (ciclo <= 24) {
    const diaDescansoEfectivo = resolverDiaDescanso(fecha, diaDescanso, descansoOverrides);
    if (diaDescansoEfectivo) {
      const diaSemana = getDiaSemana(fecha);
      if (diaSemana === normalizarDia(diaDescansoEfectivo)) {
        return {
          trabaja: false,
          horasEsperadas: 0,
          descansoPorCiclo: true,
          disponibleHE: true,
          tipoCiclo: "diario",
        };
      }
    }
    return {
      trabaja: true,
      horasEsperadas: ht,
      descansoPorCiclo: false,
      disponibleHE: false,
      tipoCiclo: "diario",
    };
  }

  // ── Turnos de ciclo largo (24x24, 8x8, 12x36) ──────────────────────────────
  // Usan módulo simple sobre días desde fecha_inicio_ciclo.
  // NOTA: 24x72 ya fue interceptado arriba con su patrón especial de 30 días.
  if (!fechaInicioCiclo) {
    return {
      trabaja: true,
      horasEsperadas: ht,
      descansoPorCiclo: false,
      disponibleHE: false,
      tipoCiclo: "ciclo_alternado",
    };
  }

  const inicioISO = fechaInicioCiclo instanceof Date
    ? fechaInicioCiclo.toISOString().slice(0, 10)
    : String(fechaInicioCiclo).slice(0, 10);

  const inicio   = parseFecha(inicioISO);
  const objetivo = parseFecha(fecha);

  const diffMs   = objetivo.getTime() - inicio.getTime();
  const diffDias = Math.round(diffMs / 86_400_000);

  const diasTrabajo  = Math.round(ht / 24);
  const diasDescanso = Math.round(hd / 24);
  const diasCiclo    = diasTrabajo + diasDescanso;

  const posicion = ((diffDias % diasCiclo) + diasCiclo) % diasCiclo;

  const trabajaHoy = posicion < diasTrabajo;

  const tipo: EstadoCiclo["tipoCiclo"] = diasCiclo > 10
    ? "ciclo_bloques"
    : "ciclo_alternado";

  if (trabajaHoy) {
    return {
      trabaja: true,
      horasEsperadas: ht,
      descansoPorCiclo: false,
      disponibleHE: false,
      tipoCiclo: tipo,
      posicionEnCiclo: posicion,
      diasCiclo,
      diasTrabajo,
    };
  } else {
    return {
      trabaja: false,
      horasEsperadas: 0,
      descansoPorCiclo: true,
      disponibleHE: true,
      tipoCiclo: tipo,
      posicionEnCiclo: posicion,
      diasCiclo,
      diasTrabajo,
    };
  }
}

// ─── Lógica específica 24x72 ────────────────────────────────────────────────

/**
 * calcular24x72Patron30 — Turno 24x72 real de ISPSA.
 *
 * NO es un ciclo simple de 4 días (1 trabaja + 3 descansa).
 *
 * Modelo correcto:
 *   - 2 titulares complementarios por posición operativa.
 *   - Patrón explícito de 30 días: cada titular trabaja exactamente 15/30 días.
 *   - Cobertura perfecta: exactamente 1 titular trabaja cada día.
 *   - T2 usa la MISMA función con fecha_inicio_ciclo = T1.fecha_inicio_ciclo + 15 días.
 *
 * Patrón de 30 días (índice 0-29):
 *   Días  0-14 (T1 lidera): T D D D T D T D T T T D T D T  → 8 trabaja
 *   Días 15-29 (T2 lidera): D T T T D T D T D D D T D T D  → 7 trabaja para T1
 *   Total T1: 15/30. Total T2: 15/30. Balanceado.
 *
 * Propiedad garantizada: PATRON_30[i] + PATRON_30[(i+15)%30] = 1 para todo i.
 */
function calcular24x72Patron30(
  fechaInicioCiclo: string | Date | null,
  fecha: string,
): EstadoCiclo {
  if (!fechaInicioCiclo) {
    console.warn(`[turno-calc] ALERTA: turno 24x72 sin fecha_inicio_ciclo para ${fecha}. Fallback "trabaja".`);
    return {
      trabaja: true,
      horasEsperadas: 24,
      descansoPorCiclo: false,
      disponibleHE: false,
      tipoCiclo: "ciclo_bloques",
    };
  }

  /**
   * Patrón base (días 1-15 de T1) provisto por ISPSA:
   *   T D D D T D T D T T T D T T T
   * Segunda mitad = complemento exacto de la primera mitad.
   * La propiedad PATRON_30[i] + PATRON_30[(i+15)%30] = 1 garantiza
   * que T1 y T2 nunca trabajan el mismo día ni hay brecha de cobertura.
   */
  const PATRON_30: readonly number[] = [
    // Días 0-14: T1 lidera (8 días trabaja)
    1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1,
    // Días 15-29: T2 lidera / T1 sigue patrón de T2 (7 días trabaja)
    0, 1, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0,
  ];

  const inicioISO = fechaInicioCiclo instanceof Date
    ? fechaInicioCiclo.toISOString().slice(0, 10)
    : String(fechaInicioCiclo).slice(0, 10);

  const inicio   = parseFecha(inicioISO);
  const objetivo = parseFecha(fecha);
  const diffDias = Math.round((objetivo.getTime() - inicio.getTime()) / 86_400_000);

  const posicion = ((diffDias % 30) + 30) % 30;
  const trabaja  = PATRON_30[posicion] === 1;

  return {
    trabaja,
    horasEsperadas: trabaja ? 24 : 0,
    descansoPorCiclo: !trabaja,
    disponibleHE: !trabaja,
    tipoCiclo: "ciclo_bloques",
    posicionEnCiclo: posicion,
    diasCiclo: 30,
    diasTrabajo: 15,
  };
}

// ─── Lógica específica 12h ──────────────────────────────────────────────────

/**
 * calcular12Horas — Ciclo real de 7 días para el turno de 12 horas de ISPSA.
 *
 * Reglas:
 *   - Días 0 a 5 desde fecha_inicio_ciclo → trabaja (12h ese día)
 *   - Día 6 → descansa (descanso de ciclo, disponible para HE)
 *   - Repite indefinidamente.
 *
 * Si no hay fecha_inicio_ciclo: fallback conservador → trabaja (igual que antes).
 * Se registra una advertencia interna de configuración incompleta.
 */
function calcular12Horas(
  fechaInicioCiclo: string | Date | null,
  fecha: string,
): EstadoCiclo {
  if (!fechaInicioCiclo) {
    // Configuración incompleta: sin fecha_inicio_ciclo no podemos calcular el ciclo.
    // Fallback conservador: asumir que trabaja (mismo comportamiento anterior).
    // En producción esto debería alertar al administrador del puesto.
    console.warn(`[turno-calc] ALERTA: turno 12h sin fecha_inicio_ciclo para fecha ${fecha}. Usando fallback "trabaja".`);
    return {
      trabaja: true,
      horasEsperadas: 12,
      descansoPorCiclo: false,
      disponibleHE: false,
      tipoCiclo: "diario",   // se clasifica como diario para no romper nómina
    };
  }

  const inicioISO = fechaInicioCiclo instanceof Date
    ? fechaInicioCiclo.toISOString().slice(0, 10)
    : String(fechaInicioCiclo).slice(0, 10);

  const inicio   = parseFecha(inicioISO);
  const objetivo = parseFecha(fecha);
  const diffDias = Math.round((objetivo.getTime() - inicio.getTime()) / 86_400_000);

  // Posición en el ciclo de 7 días (siempre positiva)
  const posicion = ((diffDias % 7) + 7) % 7;

  if (posicion < 6) {
    // Días 0-5: trabaja
    return {
      trabaja: true,
      horasEsperadas: 12,        // 12h por día, no 24
      descansoPorCiclo: false,
      disponibleHE: false,
      tipoCiclo: "ciclo_alternado",
      posicionEnCiclo: posicion,
      diasCiclo: 7,
      diasTrabajo: 6,
    };
  } else {
    // Día 6: descanso de ciclo
    return {
      trabaja: false,
      horasEsperadas: 0,
      descansoPorCiclo: true,    // descanso NORMAL, no falta ni problema
      disponibleHE: true,        // puede hacer horas extra
      tipoCiclo: "ciclo_alternado",
      posicionEnCiclo: posicion,
      diasCiclo: 7,
      diasTrabajo: 6,
    };
  }
}

// ─── Lógica específica 24x48 ────────────────────────────────────────────────

/**
 * calcular24x48 — Implementa la lógica semanal mixta del turno 24x48 de ISPSA.
 *
 * Reglas:
 *   1. La semana de referencia se ancla en fecha_inicio_ciclo (debe ser un lunes).
 *   2. Se calcula cuántas semanas completas han pasado (weeks_diff).
 *   3. La paridad (0 o 1) determina si esta es la "semana propia" o "semana ajena".
 *   4. El día de la semana del date consultado determina trabaja/descansa.
 *
 *   Paridad 0 (semana propia — titular "abre"):
 *     Lun=trabaja, Mar=descansa, Mié=trabaja, Jue=descansa,
 *     Vie=trabaja (inicio bloque 48h), Sáb=trabaja (cont. 48h), Dom=descansa
 *
 *   Paridad 1 (semana ajena — titular "cierra"):
 *     Lun=descansa, Mar=trabaja, Mié=descansa, Jue=trabaja,
 *     Vie=descansa, Sáb=descansa, Dom=trabaja
 *
 *   Para tener cobertura continua, los 2 titulares deben tener fecha_inicio_ciclo
 *   con exactamente 7 días de diferencia (un lunes y el lunes siguiente).
 */
function calcular24x48(
  fechaInicioCiclo: string | Date | null,
  fecha: string,
): EstadoCiclo {
  if (!fechaInicioCiclo) {
    // Sin fecha ancla: asumir que trabaja (conservador)
    return {
      trabaja: true,
      horasEsperadas: 24,
      descansoPorCiclo: false,
      disponibleHE: false,
      tipoCiclo: "24x48_semanal",
    };
  }

  const inicioISO = fechaInicioCiclo instanceof Date
    ? fechaInicioCiclo.toISOString().slice(0, 10)
    : String(fechaInicioCiclo).slice(0, 10);

  const inicio   = parseFecha(inicioISO);
  const objetivo = parseFecha(fecha);

  const diffDias = Math.round((objetivo.getTime() - inicio.getTime()) / 86_400_000);

  // Cuántas semanas completas han pasado desde la semana de referencia
  const weeksDiff = Math.floor(diffDias / 7);

  // Paridad: 0 = semana propia, 1 = semana ajena
  // Usamos (weeksDiff % 2 + 2) % 2 para manejar semanas anteriores al ancla (negativas)
  const parity = ((weeksDiff % 2) + 2) % 2 as 0 | 1;

  // Día de la semana: JavaScript 0=Dom, 1=Lun...6=Sáb
  // Convertimos a Lun=0, Mar=1, Mié=2, Jue=3, Vie=4, Sáb=5, Dom=6
  const jsDay = objetivo.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const dowLun = (jsDay + 6) % 7;    // Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6

  // Tabla de trabajo por paridad y día de semana
  // Índices: [Lun=0, Mar=1, Mié=2, Jue=3, Vie=4, Sáb=5, Dom=6]
  const PATRON_PROPIA  = [true,  false, true,  false, true,  true,  false]; // paridad 0
  const PATRON_AJENA   = [false, true,  false, true,  false, false, true ]; // paridad 1

  const trabaja = parity === 0 ? PATRON_PROPIA[dowLun] : PATRON_AJENA[dowLun];

  if (trabaja) {
    return {
      trabaja: true,
      horasEsperadas: 24,
      descansoPorCiclo: false,
      disponibleHE: false,
      tipoCiclo: "24x48_semanal",
      paridadSemana: parity,
      diaSemana: dowLun,
    };
  } else {
    return {
      trabaja: false,
      horasEsperadas: 0,
      descansoPorCiclo: true,
      disponibleHE: true,
      tipoCiclo: "24x48_semanal",
      paridadSemana: parity,
      diaSemana: dowLun,
    };
  }
}

// ─── Exports backward-compatibles ──────────────────────────────────────────

/**
 * calcularJornadaEsperada — API backward-compatible.
 */
export function calcularJornadaEsperada(
  turno: Turno,
  fechaInicioCiclo: string | null,
  fecha: string,
  diaDescanso?: string | null,
  descansoOverrides?: Record<string, string> | null,
): { trabajaEseDia: boolean; horasEsperadas: number } {
  const estado = calcularEstadoCiclo(turno, fechaInicioCiclo, fecha, diaDescanso, descansoOverrides);
  return { trabajaEseDia: estado.trabaja, horasEsperadas: estado.horasEsperadas };
}

/**
 * calcularHorasEsperadasPeriodo — Calcula horas totales esperadas en un rango.
 */
export function calcularHorasEsperadasPeriodo(
  turno: Turno,
  fechaInicioCiclo: string | null,
  desde: string,
  hasta: string,
  diaDescanso?: string | null,
  descansoOverrides?: Record<string, string> | null,
): { horasEsperadas: number; diasTrabajo: number; diasDescanso: number } {
  const diasPeriodo = getDiasPeriodo(desde, hasta);
  let horasEsperadas = 0;
  let diasTrabajo    = 0;
  let diasDescanso   = 0;

  for (const fecha of diasPeriodo) {
    const { trabaja, horasEsperadas: h } = calcularEstadoCiclo(
      turno, fechaInicioCiclo, fecha, diaDescanso, descansoOverrides
    );
    if (trabaja) {
      horasEsperadas += h;
      diasTrabajo++;
    } else {
      diasDescanso++;
    }
  }

  return { horasEsperadas, diasTrabajo, diasDescanso };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseFecha(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function normalizarDia(dia: string): string {
  return dia.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getDiaSemana(isoDate: string): string {
  const d = parseFecha(isoDate);
  const nombres = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  return nombres[d.getUTCDay()];
}

/**
 * getLunesISO — Devuelve el lunes (YYYY-MM-DD) de la semana ISO
 * que contiene la fecha dada. La semana se considera Lunes-Domingo.
 */
export function getLunesISO(isoDate: string): string {
  const d = parseFecha(isoDate);
  const jsDay = d.getUTCDay(); // 0=Dom, 1=Lun, ..., 6=Sab
  const offsetAlLunes = (jsDay + 6) % 7; // Lun=0, Mar=1, ..., Dom=6
  d.setUTCDate(d.getUTCDate() - offsetAlLunes);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDiasPeriodo(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  const start = parseFecha(desde);
  const end   = parseFecha(hasta);
  const cur   = new Date(start.getTime());
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cur.getUTCDate()).padStart(2, "0");
    dias.push(`${y}-${m}-${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dias;
}
