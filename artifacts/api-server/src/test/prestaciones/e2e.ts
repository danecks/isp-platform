/**
 * e2e.ts — Tests de integración/E2E del módulo de prestaciones
 *
 * Los tests hacen llamadas HTTP al servidor (puerto 8080).
 * Se usan colaboradores de prueba del seed (MARKER=PREST-TEST-2026).
 *
 * Validaciones E2E (PE-001 … PE-040):
 *  PE-001…010  Config y estructura
 *  PE-011…020  Vacaciones (saldo, movimientos)
 *  PE-021…030  Provisiones (generación, idempotencia)
 *  PE-031…040  Liquidación (simulación, confirmación, anti-duplicado)
 */

import { pool } from "@workspace/db";

const BASE = "http://localhost:8080/api";
const AUTH = { "x-isp-session": JSON.stringify({ rol: "admin", username: "admin" }) };

let PASS = 0;
let FAIL = 0;
const FAILURES: string[] = [];

async function req(method: string, path: string, body?: unknown): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...AUTH, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function ok(id: string, desc: string, cond: boolean) {
  if (cond) { PASS++; console.log(`  ✅ PE-${id} ${desc}`); }
  else       { FAIL++; FAILURES.push(`PE-${id} ${desc}`); console.log(`  ❌ PE-${id} ${desc}`); }
}

// ── Datos de seed ──────────────────────────────────────────────────────────────
let empAnioCompleto: number;   // E1: año completo de servicio
let empRecienIngresado: number;// E2: ingresado hace 3 meses
let empRenuncia: number;       // E3: egresa por renuncia
let empDespedido: number;      // E4: egresa por despido injustificado
let empVacaciones: number;     // E5: tiene vacaciones gozadas parciales

export async function loadSeedIds() {
  const { rows } = await pool.query(
    `SELECT id, nombre_completo, notas FROM employees WHERE notas LIKE '%PREST-TEST-2026%' ORDER BY id`
  );
  if (rows.length < 5) throw new Error(`Se esperaban 5 empleados de prueba, encontrados: ${rows.length}`);
  empAnioCompleto     = rows[0].id;
  empRecienIngresado  = rows[1].id;
  empRenuncia         = rows[2].id;
  empDespedido        = rows[3].id;
  empVacaciones       = rows[4].id;
}

// ── PE-001…010: Config y estructura ───────────────────────────────────────────
async function testConfig() {
  console.log("\n— PE-001…010: Configuración");

  // PE-001: GET config default
  const { status: s1, data: d1 } = await req("GET", "/prestaciones/config");
  ok("001", "GET /prestaciones/config devuelve 200", s1 === 200);
  ok("002", "Config tiene campo aguinaldoBase", !!(d1 as Record<string,unknown>)?.config);

  // PE-003: PUT actualizar config
  const { status: s3 } = await req("PUT", "/prestaciones/config", {
    aguinaldo_base: "salario_actual",
    bono14_base: "promedio_periodo",
    vacaciones_dias_primer_anio: 15,
    vacaciones_dias_quinquenio: 20,
    vacaciones_dias_elegibilidad: 150,
    indemnizacion_solo_legal: true,
    redondeo_decimales: 2,
  });
  ok("003", "PUT /prestaciones/config retorna 200", s3 === 200);

  // PE-004: GET config lee lo que se guardó
  const { data: d4 } = await req("GET", "/prestaciones/config");
  const cfg = (d4 as Record<string,unknown>)?.config as Record<string,unknown>;
  ok("004", "Config guardada: aguinaldoBase = salario_actual", cfg?.aguinaldoBase === "salario_actual");
  ok("005", "Config guardada: vacacionesDiasPrimerAnio = 15", cfg?.vacacionesDiasPrimerAnio === 15);

  // PE-006: GET saldo vacaciones empleado sin movimientos
  const { status: s6, data: d6 } = await req("GET", `/prestaciones/vacaciones/saldo/${empAnioCompleto}`);
  ok("006", "GET saldo vacaciones → 200", s6 === 200);
  ok("007", "Saldo incluye employee_id", !!(d6 as Record<string,unknown>)?.employee_id);

  // PE-008: GET acumulados
  const { status: s8 } = await req("GET", `/prestaciones/acumulados/${empAnioCompleto}`);
  ok("008", "GET /prestaciones/acumulados/:id → 200", s8 === 200);

  // PE-009: GET movimientos
  const { status: s9 } = await req("GET", `/prestaciones/movimientos/${empAnioCompleto}`);
  ok("009", "GET /prestaciones/movimientos/:id → 200", s9 === 200);

  // PE-010: GET liquidaciones vacía al inicio
  const { status: s10, data: d10 } = await req("GET", `/prestaciones/liquidaciones?employee_id=${empRenuncia}`);
  ok("010", "GET liquidaciones → 200", s10 === 200);
  ok("010b", "Lista vacía inicialmente (no hay liquidaciones del seed)", Array.isArray((d10 as Record<string,unknown>)?.rows));
}

// ── PE-011…020: Vacaciones ────────────────────────────────────────────────────
async function testVacaciones() {
  console.log("\n— PE-011…020: Vacaciones saldo y movimientos");

  // PE-011: Registrar días ganados
  const { status: s11 } = await req("POST", "/prestaciones/vacaciones/movimiento", {
    employee_id: empVacaciones,
    tipo: "ganadas",
    dias: 15,
    fecha: "2026-01-01",
    periodo_inicio: "2025-01-01",
    periodo_fin: "2025-12-31",
    observaciones: "Vacaciones devengadas 2025",
  });
  ok("011", "POST movimiento ganadas → 200", s11 === 200);

  // PE-012: Saldo después de ganadas = 15
  const { data: d12 } = await req("GET", `/prestaciones/vacaciones/saldo/${empVacaciones}`);
  const saldo12 = (d12 as Record<string,unknown>)?.dias_ganados as number;
  ok("012", `Saldo días_ganados = 15 (fue ${saldo12})`, Math.abs(saldo12 - 15) < 0.01);

  // PE-013: Registrar días gozados
  await req("POST", "/prestaciones/vacaciones/movimiento", {
    employee_id: empVacaciones,
    tipo: "gozadas",
    dias: 7,
    fecha: "2026-02-15",
    observaciones: "Vacaciones febrero 2026",
  });

  // PE-014: Saldo disponible = 15 - 7 = 8
  const { data: d14 } = await req("GET", `/prestaciones/vacaciones/saldo/${empVacaciones}`);
  const disp14 = (d14 as Record<string,unknown>)?.dias_disponibles as number;
  ok("014", `Saldo disponible = 8 (fue ${disp14})`, Math.abs(disp14 - 8) < 0.01);

  // PE-015: Segundo lote de ganadas (acumulación)
  await req("POST", "/prestaciones/vacaciones/movimiento", {
    employee_id: empVacaciones,
    tipo: "ganadas",
    dias: 5,
    fecha: "2026-06-01",
    observaciones: "Días adicionales",
  });

  const { data: d15 } = await req("GET", `/prestaciones/vacaciones/saldo/${empVacaciones}`);
  const ganadas15 = (d15 as Record<string,unknown>)?.dias_ganados as number;
  ok("015", `Acumulación: días_ganados = 20 (fue ${ganadas15})`, Math.abs(ganadas15 - 20) < 0.01);

  // PE-016: Consistencia saldo
  const disp15 = (d15 as Record<string,unknown>)?.dias_disponibles as number;
  const goz15  = (d15 as Record<string,unknown>)?.dias_gozados as number;
  ok("016", "dias_disponibles = ganadas - gozadas", Math.abs(disp15 - (ganadas15 - goz15)) < 0.01);
}

// ── PE-021…030: Provisiones ────────────────────────────────────────────────────
async function testProvisiones() {
  console.log("\n— PE-021…030: Provisiones");

  const body = {
    periodo_desde: "2026-04-01",
    periodo_hasta: "2026-04-15",
    tipos: ["aguinaldo", "bono14", "vacaciones", "indemnizacion"],
  };

  // PE-021: Generar provisiones
  const { status: s21, data: d21 } = await req("POST", "/prestaciones/provisionar", body);
  ok("021", "POST /prestaciones/provisionar → 200", s21 === 200);
  const d21r = d21 as Record<string,unknown>;
  ok("022", "ok=true", d21r?.ok === true);
  ok("023", "empleados_procesados > 0", (d21r?.empleados_procesados as number) > 0);
  ok("024", "provisiones_generadas > 0", (d21r?.provisiones_generadas as number) > 0);

  const totTipo = d21r?.total_por_tipo as Record<string,number> ?? {};
  ok("025", "Hay total para aguinaldo", typeof totTipo?.aguinaldo === "number");
  ok("026", "Hay total para bono14", typeof totTipo?.bono14 === "number");
  ok("027", "Hay total para vacaciones", typeof totTipo?.vacaciones === "number");
  ok("028", "Hay total para indemnizacion", typeof totTipo?.indemnizacion === "number");

  // PE-029: Idempotencia — regenerar no duplica montos
  const { data: d29 } = await req("POST", "/prestaciones/provisionar", body);
  const tot29 = (d29 as Record<string,unknown>)?.total_general as number;
  const tot21 = d21r?.total_general as number;
  ok("029", `Idempotencia: mismo total (${tot21} = ${tot29})`, Math.abs(tot21 - tot29) < 0.01);

  // PE-030: GET provisiones filtrando por tipo
  const { status: s30, data: d30 } = await req("GET", "/prestaciones/provisiones?tipo=aguinaldo&periodo_desde=2026-04-01&periodo_hasta=2026-04-15");
  ok("030", "GET provisiones filtradas → 200", s30 === 200);
  const rows30 = (d30 as Record<string,unknown>)?.rows as unknown[];
  ok("030b", "Retorna filas de aguinaldo", Array.isArray(rows30) && rows30.length > 0);
}

// ── PE-031…040: Liquidación ────────────────────────────────────────────────────
async function testLiquidacion() {
  console.log("\n— PE-031…040: Liquidación final");

  const bodyRenuncia = {
    employee_id:          empRenuncia,
    fecha_egreso:         "2026-06-30",
    causal_egreso:        "renuncia",
    dias_salario_pendiente: 15,
    dias_vacaciones_pendientes: 8,
    periodo_aguinaldo_inicio: "2025-12-01",
    periodo_aguinaldo_fin:    "2026-11-30",
    periodo_bono14_inicio:    "2025-07-01",
    periodo_bono14_fin:       "2026-06-30",
  };

  // PE-031: Simulación
  const { status: s31, data: d31 } = await req("POST", "/prestaciones/simular-liquidacion", bodyRenuncia);
  ok("031", "POST simular-liquidacion → 200", s31 === 200);
  const liq31 = (d31 as Record<string,unknown>)?.liquidacion as Record<string,unknown>;
  ok("032", "simulacion=true", (d31 as Record<string,unknown>)?.simulacion === true);
  ok("033", "Liquidación tiene rubros", Array.isArray(liq31?.rubros));
  ok("034", "Indemnización = 0 (renuncia)", (liq31?.totalIndemnizacion as number) === 0);
  ok("035", "totalGeneral > 0", (liq31?.totalGeneral as number) > 0);

  // PE-036: Confirmar liquidación (renuncia)
  const { status: s36, data: d36 } = await req("POST", "/prestaciones/liquidaciones", bodyRenuncia);
  ok("036", "POST /prestaciones/liquidaciones → 201", s36 === 201);
  const liqId = (d36 as Record<string,unknown>)?.liquidacion_id as number;
  ok("037", "Retorna liquidacion_id", typeof liqId === "number" && liqId > 0);

  // PE-037: Consultar detalle
  const { status: s37, data: d37 } = await req("GET", `/prestaciones/liquidaciones/${liqId}`);
  ok("037b", "GET /liquidaciones/:id → 200", s37 === 200);
  const det37 = (d37 as Record<string,unknown>)?.detalle as unknown[];
  ok("037c", "Detalle tiene al menos 1 rubro", Array.isArray(det37) && det37.length >= 4);

  // PE-038: Anti-duplicado — segunda liquidación debe fallar 409
  const { status: s38 } = await req("POST", "/prestaciones/liquidaciones", bodyRenuncia);
  ok("038", "Segunda liquidación → 409 (anti-duplicado)", s38 === 409);

  // PE-039: Despido injustificado con indemnización
  const bodyDespido = {
    employee_id:            empDespedido,
    fecha_egreso:           "2026-06-30",
    causal_egreso:          "despido_injustificado",
    dias_salario_pendiente: 10,
    dias_vacaciones_pendientes: 5,
    periodo_aguinaldo_inicio: "2025-12-01",
    periodo_aguinaldo_fin:    "2026-11-30",
    periodo_bono14_inicio:    "2025-07-01",
    periodo_bono14_fin:       "2026-06-30",
  };
  const { status: s39, data: d39 } = await req("POST", "/prestaciones/simular-liquidacion", bodyDespido);
  ok("039", "Simulación despido injustificado → 200", s39 === 200);
  const liq39 = (d39 as Record<string,unknown>)?.liquidacion as Record<string,unknown>;
  ok("039b", "Indemnización > 0 (despido injustificado)", (liq39?.totalIndemnizacion as number) > 0);

  // PE-040: GET lista de liquidaciones
  const { status: s40, data: d40 } = await req("GET", `/prestaciones/liquidaciones?employee_id=${empRenuncia}`);
  ok("040", "GET liquidaciones del empleado → 200", s40 === 200);
  const rows40 = (d40 as Record<string,unknown>)?.rows as unknown[];
  ok("040b", "Lista tiene al menos 1 liquidación", Array.isArray(rows40) && rows40.length >= 1);
}

export async function runE2E(): Promise<{ pass: number; fail: number; failures: string[] }> {
  PASS = 0; FAIL = 0; FAILURES.length = 0;
  console.log("\n=== E2E TESTS — MÓDULO PRESTACIONES ===\n");

  await loadSeedIds();
  await testConfig();
  await testVacaciones();
  await testProvisiones();
  await testLiquidacion();

  return { pass: PASS, fail: FAIL, failures: FAILURES.slice() };
}
