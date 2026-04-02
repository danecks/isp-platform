/**
 * turno-calc.ts — Motor de cálculo de turnos de ISPSA
 *
 * TURNOS SOPORTADOS:
 *
 *   12h    → ciclo 24h  → trabaja todos los días, descanso semanal por dia_descanso
 *   8h     → ciclo 8h   → trabaja todos los días, descanso semanal por dia_descanso
 *   12x36  → ciclo 48h  → trabaja 12h, descansa 36h (cada 2 días)
 *
 *   24x24  → ciclo 48h  → 1 día trabaja, 1 día descansa (2 titulares alternados)
 *   24x48  → ciclo 72h  → 1 día trabaja, 2 días descansa (3 titulares para cobertura)
 *            NOTA: ISPSA usa un modelo semanal mixto (24x24 entre semana + bloque 48h
 *            de fin de semana alterno). Esta implementación usa el ciclo simple como
 *            aproximación. El modelo semanal completo requiere configuración adicional.
 *
 *   24x72  → ciclo 96h  → 1 día trabaja, 3 días descansa (4 titulares para cobertura)
 *
 *   8x8    → ciclo 16 días → 8 días ON, 8 días OFF (horas_trabajo=192, horas_descanso=192)
 *            Para cobertura continua se requieren 2 titulares desfasados 8 días.
 *
 * REGLA CLAVE:
 *   Todos los turnos con ciclo > 24h usan fecha_inicio_ciclo como ancla del patrón.
 *   La posición en el ciclo determina si el agente trabaja o descansa ESE día.
 *   descansoPorCiclo = true → es descanso NORMAL del ciclo, no alerta operativa.
 *   descansoPorCiclo = false Y !trabaja → ausencia o problema real.
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
  disponibleHE: boolean;          // puede hacer horas extra (descansa o disponible libre)
  tipoCiclo: "diario" | "ciclo_alternado" | "ciclo_bloques" | "sin_turno";
  posicionEnCiclo?: number;       // 0-based position in the cycle (for debug)
  diasCiclo?: number;             // total days in the cycle
  diasTrabajo?: number;           // days of work in the cycle
}

/**
 * calcularEstadoCiclo — Función principal. Responde para cualquier fecha:
 * - ¿trabaja ese día?
 * - ¿está en descanso normal de ciclo?
 * - ¿puede hacer horas extra?
 *
 * @param turno             Registro del turno con tipo_ciclo y horas
 * @param fechaInicioCiclo  Fecha de inicio del ciclo del agente (ancla). Puede ser null para turnos diarios.
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
  const ciclo = ht + hd;

  // ── Turnos diarios (ciclo ≤ 24h): 12h, 8h ─────────────────────────────────
  // El agente trabaja todos los días. El descanso semanal se controla por dia_descanso.
  if (ciclo <= 24) {
    if (diaDescanso) {
      const diaSemana = getDiaSemana(fecha);
      if (diaSemana === normalizarDia(diaDescanso)) {
        // Es su día de descanso semanal → descansoPorCiclo = true
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

  // ── Turnos de ciclo largo (24x24, 24x48, 24x72, 8x8, 12x36) ───────────────
  // Requieren fecha_inicio_ciclo para calcular la posición en el ciclo.
  if (!fechaInicioCiclo) {
    // Sin fecha base: asumir que trabaja (fallback conservador para no esconder gaps)
    return {
      trabaja: true,
      horasEsperadas: ht,
      descansoPorCiclo: false,
      disponibleHE: false,
      tipoCiclo: "ciclo_alternado",
    };
  }

  // Normalizar fecha_inicio_ciclo a string YYYY-MM-DD
  const inicioISO = fechaInicioCiclo instanceof Date
    ? fechaInicioCiclo.toISOString().slice(0, 10)
    : String(fechaInicioCiclo).slice(0, 10);

  const inicio   = parseFecha(inicioISO);
  const objetivo = parseFecha(fecha);

  const diffMs   = objetivo.getTime() - inicio.getTime();
  const diffDias = Math.round(diffMs / 86_400_000);

  // Para 8x8: horas_trabajo=192 → diasTrabajo=8, horas_descanso=192 → diasDescanso=8
  const diasTrabajo  = Math.round(ht / 24);    // días de trabajo en el ciclo
  const diasDescanso = Math.round(hd / 24);    // días de descanso en el ciclo
  const diasCiclo    = diasTrabajo + diasDescanso;

  // Posición en el ciclo (siempre positiva, maneja fechas pasadas al ancla)
  const posicion = ((diffDias % diasCiclo) + diasCiclo) % diasCiclo;

  const trabajaHoy = posicion < diasTrabajo;

  // Determinar tipo de ciclo para contexto
  const tipoCiclo: EstadoCiclo["tipoCiclo"] = diasCiclo > 10
    ? "ciclo_bloques"    // 8x8 u otros bloques largos
    : "ciclo_alternado"; // 24x24, 24x48, 24x72

  if (trabajaHoy) {
    return {
      trabaja: true,
      horasEsperadas: ht,
      descansoPorCiclo: false,
      disponibleHE: false,
      tipoCiclo,
      posicionEnCiclo: posicion,
      diasCiclo,
      diasTrabajo,
    };
  } else {
    // Está en fase de descanso del ciclo → descansoPorCiclo = true
    // Puede hacer horas extra (es descanso planeado, no ausencia)
    return {
      trabaja: false,
      horasEsperadas: 0,
      descansoPorCiclo: true,
      disponibleHE: true,
      tipoCiclo,
      posicionEnCiclo: posicion,
      diasCiclo,
      diasTrabajo,
    };
  }
}

/**
 * calcularJornadaEsperada — API backward-compatible.
 * Wrapper sobre calcularEstadoCiclo para no romper código existente.
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
 * Útil para pre-planilla.
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
