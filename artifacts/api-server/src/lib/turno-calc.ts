/**
 * turno-calc.ts — Cálculo de jornada esperada por tipo de turno
 *
 * MODELO DE CICLOS:
 *
 * Cada turno tiene:
 *   - horas_trabajo:  horas que se trabaja por turno/ciclo (ej. 12, 24, 8)
 *   - horas_descanso: horas de descanso después de cada turno (ej. 12, 24, 48)
 *   - ciclo_horas = horas_trabajo + horas_descanso
 *
 * CASOS PRINCIPALES:
 *
 *   12x12 → ciclo=24 h → trabaja cada día (12 horas diarias)
 *           El descanso semanal se controla por dia_descanso del puesto/empleado.
 *
 *   24x24 → ciclo=48 h → alterna: Día 0 trabaja, Día 1 descansa, Día 2 trabaja…
 *           Requiere fecha_inicio_ciclo para saber en qué posición del ciclo está.
 *
 *   24x48 → ciclo=72 h → Día 0 trabaja, Día 1 descansa, Día 2 descansa, Día 3 trabaja…
 *
 *   8h    → ciclo=8 h (≤ 24) → trabaja cada día.
 *           El descanso semanal se controla por dia_descanso.
 *
 * NOTA: para turnos con ciclo > 24h, fecha_inicio_ciclo DEBE estar configurada
 * en el puesto para que el cálculo sea correcto. Si no hay fecha_inicio_ciclo
 * se asume que SIEMPRE toca trabajar (mejor tener datos que no detectar nada).
 */

export interface Turno {
  id: number;
  nombre: string;
  horas_trabajo: number;   // horas en activo por turno
  horas_descanso: number;  // horas de descanso post-turno
  ciclo_horas: number;     // = horas_trabajo + horas_descanso
}

/**
 * Calcula si en `fecha` (YYYY-MM-DD) el colaborador debía trabajar y cuántas horas.
 *
 * @param turno         Registro del turno
 * @param fechaInicioCiclo  Fecha de inicio de referencia del ciclo (YYYY-MM-DD).
 *                          Puede ser null para turnos sub-diarios (ciclo ≤ 24).
 * @param diaDescanso   Opcional: nombre del día de descanso semanal
 *                      ("domingo","lunes",…) para turnos sub-diarios.
 * @returns { trabajaEseDia, horasEsperadas }
 */
export function calcularJornadaEsperada(
  turno: Turno,
  fechaInicioCiclo: string | null,
  fecha: string,
  diaDescanso?: string | null,
): { trabajaEseDia: boolean; horasEsperadas: number } {

  const ciclo = turno.ciclo_horas ?? (turno.horas_trabajo + turno.horas_descanso);

  // ── Turnos sub-diarios (12x12, 8h): trabajan todos los días del ciclo ──────
  // El descanso está dentro del mismo día o se maneja semanalmente con dia_descanso.
  if (ciclo <= 24) {
    // Revisar descanso semanal si está configurado
    if (diaDescanso) {
      const diaSemana = getDiaSemana(fecha);
      if (diaSemana === normalizarDia(diaDescanso)) {
        return { trabajaEseDia: false, horasEsperadas: 0 };
      }
    }
    return { trabajaEseDia: true, horasEsperadas: turno.horas_trabajo };
  }

  // ── Turnos multi-día (24x24, 24x48, etc.) ─────────────────────────────────
  // Necesitamos fecha_inicio_ciclo para saber la posición en el ciclo.
  if (!fechaInicioCiclo) {
    // Sin fecha base: asumimos que siempre trabaja (fallback conservador).
    return { trabajaEseDia: true, horasEsperadas: turno.horas_trabajo };
  }

  const diasCiclo = Math.round(ciclo / 24);             // Total de días del ciclo
  const diasTrabajo = Math.round(turno.horas_trabajo / 24); // Días de trabajo por ciclo

  const inicio = parseFecha(fechaInicioCiclo);
  const dia = parseFecha(fecha);

  const diffMs = dia.getTime() - inicio.getTime();
  const diffDias = Math.round(diffMs / (24 * 60 * 60 * 1000)); // diff en días enteros

  // Posición en el ciclo (siempre positiva)
  const posicion = ((diffDias % diasCiclo) + diasCiclo) % diasCiclo;

  if (posicion < diasTrabajo) {
    return { trabajaEseDia: true, horasEsperadas: turno.horas_trabajo };
  } else {
    return { trabajaEseDia: false, horasEsperadas: 0 };
  }
}

/**
 * Calcula cuántas horas se esperaban en un rango de fechas.
 * Útil para pre-planilla: total_horas_esperadas del período.
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
  let diasTrabajo = 0;
  let diasDescanso = 0;

  for (const fecha of diasPeriodo) {
    const { trabajaEseDia, horasEsperadas: h } = calcularJornadaEsperada(
      turno, fechaInicioCiclo, fecha, diaDescanso
    );
    if (trabajaEseDia) {
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

function getDiasSemana(): Record<string, number> {
  return {
    domingo: 0, lunes: 1, martes: 2, miercoles: 3,
    "miércoles": 3, jueves: 4, viernes: 5, sabado: 6, "sábado": 6,
  };
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
  const end = parseFecha(hasta);
  const cur = new Date(start.getTime());
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cur.getUTCDate()).padStart(2, "0");
    dias.push(`${y}-${m}-${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dias;
}
