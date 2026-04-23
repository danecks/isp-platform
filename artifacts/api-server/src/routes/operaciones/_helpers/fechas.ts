import { pool, todayGT } from "@workspace/db";

// ─── Helper: fecha hoy en formato DD-MM-YYYY (Guatemala) ─────────────────────
export function fechaHoyStr(): string {
  const iso = todayGT(); // YYYY-MM-DD en hora Guatemala
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}-${mm}-${yyyy}`;
}

// ─── Helper: formatear fecha ISO a DD-MM-YYYY ─────────────────────────────────
export function isoADDMMYYYY(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00Z');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
}

// ─── Helper: calcular la fecha operativa activa ────────────────────────────────
// La fecha activa es el primer día no cerrado comenzando desde hoy.
// Si hoy está cerrado → mañana; si mañana también → pasado, etc.
export interface FechaActivaResult {
  fechaActivaISO: string;
  fechaActivaStr: string;
  esFechaFutura: boolean;
  cierreDeHoy: any | null;
}

export async function calcFechaActiva(): Promise<FechaActivaResult> {
  // todayGT() da la fecha de hoy en Guatemala (UTC-6); el pool también está
  // configurado en America/Guatemala, por lo que CURRENT_DATE en SQL coincide.
  const todayISO = todayGT();

  const { rows: hoyRows } = await pool.query(
    `SELECT * FROM cierre_operativo_diario WHERE fecha = $1`,
    [todayISO]
  );
  const cierreDeHoy = hoyRows[0] ?? null;

  if (cierreDeHoy?.estado !== 'cerrado') {
    return {
      fechaActivaISO: todayISO,
      fechaActivaStr: isoADDMMYYYY(todayISO),
      esFechaFutura: false,
      cierreDeHoy: null,
    };
  }

  // Hoy está cerrado → encontrar el primer día no cerrado desde hoy
  const { rows: closedRows } = await pool.query(`
    SELECT fecha::text AS fecha FROM cierre_operativo_diario
    WHERE fecha >= $1 AND estado = 'cerrado'
    ORDER BY fecha
  `, [todayISO]);

  // Avanzar día a día desde hoy hasta encontrar uno sin cierre
  let fechaActivaISO = todayISO;
  for (const row of closedRows) {
    const rowISO = (row.fecha as string).substring(0, 10);
    if (rowISO === fechaActivaISO) {
      // Este día está cerrado → avanzar un día
      const d = new Date(fechaActivaISO + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() + 1);
      fechaActivaISO = d.toISOString().substring(0, 10);
    } else {
      break;
    }
  }

  return {
    fechaActivaISO,
    fechaActivaStr: isoADDMMYYYY(fechaActivaISO),
    esFechaFutura:  true,
    cierreDeHoy,
  };
}

// ─── Helper: verificar si la fecha activa está cerrada ────────────────────────
export async function verificarDiaCerrado(): Promise<boolean> {
  const { fechaActivaISO } = await calcFechaActiva();
  const { rows } = await pool.query(
    `SELECT estado FROM cierre_operativo_diario WHERE fecha = $1`,
    [fechaActivaISO]
  );
  return rows[0]?.estado === 'cerrado';
}
