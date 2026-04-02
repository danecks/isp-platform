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
export function calcularEstadoCiclo(
  turno: Turno,
  fechaInicioCiclo: string | Date | null,
  fecha: string,
  diaDescanso?: string | null,
): EstadoCiclo {
  const ht = parseFloat(String(turno.horas_trabajo ?? 0));
  const hd = parseFloat(String(turno.horas_descanso ?? 0));
  const tipoCiclo = turno.tipo_ciclo ?? "";

  // ── 24x48 — Lógica semanal mixta ────────────────────────────────────────────
  // No se usa ciclo fijo. Se determina por día de semana + paridad de semana.
  if (tipoCiclo === "24x48" || (ht === 24 && hd === 48)) {
    return calcular24x48(fechaInicioCiclo, fecha);
  }

  // ── Turnos diarios (ciclo ≤ 24h): 12h, 8h ─────────────────────────────────
  // El agente trabaja todos los días. El descanso semanal se controla por dia_descanso.
  const ciclo = ht + hd;
  if (ciclo <= 24) {
    if (diaDescanso) {
      const diaSemana = getDiaSemana(fecha);
      if (diaSemana === normalizarDia(diaDescanso)) {
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

  // ── Turnos de ciclo largo (24x24, 24x72, 8x8, 12x36) ───────────────────────
  // Usan módulo simple sobre días desde fecha_inicio_ciclo.
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
): { trabajaEseDia: boolean; horasEsperadas: number } {
  const estado = calcularEstadoCiclo(turno, fechaInicioCiclo, fecha, diaDescanso);
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
): { horasEsperadas: number; diasTrabajo: number; diasDescanso: number } {
  const diasPeriodo = getDiasPeriodo(desde, hasta);
  let horasEsperadas = 0;
  let diasTrabajo    = 0;
  let diasDescanso   = 0;

  for (const fecha of diasPeriodo) {
    const { trabaja, horasEsperadas: h } = calcularEstadoCiclo(
      turno, fechaInicioCiclo, fecha, diaDescanso
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
