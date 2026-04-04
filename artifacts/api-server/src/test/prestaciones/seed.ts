/**
 * seed.ts — Datos de prueba del módulo Prestaciones
 *
 * Crea 5 empleados de prueba identificados con MARKER=PREST-TEST-2026.
 * Se usa ON CONFLICT para ser idempotente y safe en re-ejecuciones.
 * Limpieza: DELETE WHERE notas LIKE '%PREST-TEST-2026%'
 */

import { pool } from "@workspace/db";

export const MARKER = "PREST-TEST-2026";

const log = (msg: string) => console.log(`  [SEED] ${msg}`);

const EMPLEADOS = [
  {
    key:           "PREST-E1-ANO-COMPLETO",
    nombre:        "Carlos Eduardo Monterroso Paz",
    dpi:           "1001001010101",
    puesto:        "Agente de Seguridad",
    sede:          "Zona 10",
    fechaIngreso:  "2023-01-02",   // ~3.5 años al mid-2026
    sueldoBase:    3_000,
    frecuencia:    "quincenal",
    caso:          "E1: Año completo aguinaldo/bono14",
  },
  {
    key:           "PREST-E2-RECIENTE",
    nombre:        "María Fernanda Salazar López",
    dpi:           "2002002020202",
    puesto:        "Agente de Seguridad",
    sede:          "Mixco",
    fechaIngreso:  "2026-03-15",   // ingresó hace ~3 meses al mid-2026
    sueldoBase:    3_200,
    frecuencia:    "quincenal",
    caso:          "E2: Ingreso reciente — prestaciones proporcionales",
  },
  {
    key:           "PREST-E3-RENUNCIA",
    nombre:        "José Alfredo Morales Barrios",
    dpi:           "3003003030303",
    puesto:        "Supervisor de Seguridad",
    sede:          "Ciudad de Guatemala",
    fechaIngreso:  "2022-06-01",   // ~4 años al mid-2026
    sueldoBase:    4_500,
    frecuencia:    "quincenal",
    caso:          "E3: Egreso por renuncia — sin indemnización",
  },
  {
    key:           "PREST-E4-DESPIDO",
    nombre:        "Ana Gabriela Cifuentes Ruiz",
    dpi:           "4004004040404",
    puesto:        "Jefe de Operaciones",
    sede:          "Zona 10",
    fechaIngreso:  "2020-03-01",   // ~6 años al mid-2026
    sueldoBase:    6_000,
    frecuencia:    "mensual",
    caso:          "E4: Egreso por despido injustificado — con indemnización",
  },
  {
    key:           "PREST-E5-VACACIONES",
    nombre:        "Pedro Ramón Ajú Hernández",
    dpi:           "5005005050505",
    puesto:        "Agente de Seguridad",
    sede:          "Mixco",
    fechaIngreso:  "2021-09-01",   // ~5 años al mid-2026
    sueldoBase:    3_500,
    frecuencia:    "quincenal",
    caso:          "E5: Vacaciones gozadas parciales — saldo restante",
  },
];

export interface SeedIds {
  empAnioCompleto:     number;
  empRecienIngresado:  number;
  empRenuncia:         number;
  empDespedido:        number;
  empVacaciones:       number;
}

export async function seedPrestaciones(): Promise<SeedIds> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");

    // Limpiar datos anteriores del marker (re-ejecución segura)
    const { rowCount: deleted } = await db.query(
      `DELETE FROM employees WHERE notas LIKE $1`, [`%${MARKER}%`]
    );
    if (deleted && deleted > 0) log(`Limpiadas ${deleted} filas previas con marker ${MARKER}`);

    // Limpiar provisiones anteriores si las hay
    await db.query(
      `DELETE FROM prestaciones_provisiones WHERE observaciones LIKE $1 OR TRUE = FALSE`, [`%${MARKER}%`]
    ).catch(() => null); // no falla si la tabla no existe aún

    const ids: number[] = [];

    for (const emp of EMPLEADOS) {
      const { rows } = await db.query<{ id: number }>(
        `INSERT INTO employees (
           external_id, nombre_completo, dpi, puesto, area, estado_laboral, sede,
           fecha_ingreso, sueldo_base, tipo_jornada, horas_contrato, frecuencia_pago,
           aplica_igss_general, estado_igss, tipo_personal, cliente_id, notas
         ) VALUES ($1,$2,$3,$4,'Operaciones','activo',$5,$6,$7,'tiempo_completo',48,$8,TRUE,'activo','guardia',NULL,$9)
         RETURNING id`,
        [
          emp.key, emp.nombre, emp.dpi, emp.puesto, emp.sede,
          emp.fechaIngreso, emp.sueldoBase, emp.frecuencia,
          `${MARKER} | ${emp.key} | ${emp.caso}`,
        ]
      );
      ids.push(rows[0].id);
      log(`Creado: ${emp.nombre} (ID=${rows[0].id}) — ${emp.caso}`);
    }

    await db.query("COMMIT");

    return {
      empAnioCompleto:     ids[0],
      empRecienIngresado:  ids[1],
      empRenuncia:         ids[2],
      empDespedido:        ids[3],
      empVacaciones:       ids[4],
    };
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  } finally {
    db.release();
  }
}

export async function cleanupPrestaciones(): Promise<void> {
  // Obtener IDs de empleados del marker
  const { rows } = await pool.query(
    `SELECT id FROM employees WHERE notas LIKE $1`, [`%${MARKER}%`]
  );
  const ids = rows.map((r: { id: number }) => r.id);

  if (ids.length === 0) {
    log("No hay datos de test para limpiar");
    return;
  }

  // Limpiar en orden por FK
  for (const id of ids) {
    await pool.query(`DELETE FROM prestaciones_liquidacion_detalle WHERE liquidacion_id IN (SELECT id FROM prestaciones_liquidaciones WHERE employee_id = $1)`, [id]).catch(() => null);
    await pool.query(`DELETE FROM prestaciones_liquidaciones WHERE employee_id = $1`, [id]).catch(() => null);
    await pool.query(`DELETE FROM prestaciones_provisiones WHERE employee_id = $1`, [id]).catch(() => null);
    await pool.query(`DELETE FROM prestaciones_movimientos WHERE employee_id = $1`, [id]).catch(() => null);
    await pool.query(`DELETE FROM prestaciones_acumulados WHERE employee_id = $1`, [id]).catch(() => null);
    await pool.query(`DELETE FROM vacaciones_movimientos WHERE employee_id = $1`, [id]).catch(() => null);
    await pool.query(`DELETE FROM vacaciones_saldos WHERE employee_id = $1`, [id]).catch(() => null);
  }

  await pool.query(`DELETE FROM employees WHERE notas LIKE $1`, [`%${MARKER}%`]);
  log(`Limpiados ${ids.length} empleados y sus datos de prestaciones`);
}
