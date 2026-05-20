/**
 * run.ts — Tests E2E para "Anular falta de puesto fijo"
 *
 * Cubre:
 *   AF-001  POST /operaciones/anular-falta sin rol → 403
 *   AF-002  POST con admin → 200, evento pendiente_aprobacion, slot en 'normal'
 *   AF-003  PATCH estado=rechazado → slot restaurado a 'faltando'
 *   AF-004  Re-anula y luego PATCH estado=aprobado → slot queda en 'normal'
 */

import { pool } from "@workspace/db";

const BASE = `http://localhost:${process.env.PORT ?? 8080}/api`;
const AUTH_ADMIN = { "x-isp-session": JSON.stringify({ rol: "admin" }) };
const NO_AUTH    = { "x-isp-session": JSON.stringify({ rol: "supervisor" }) };

let PASS = 0, FAIL = 0;
const FAILS: string[] = [];

async function req(method: string, path: string, body?: unknown, headers: Record<string, string> = AUTH_ADMIN) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...headers, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}
function ok(id: string, desc: string, cond: boolean) {
  if (cond) { PASS++; console.log(`  ✅ AF-${id} ${desc}`); }
  else      { FAIL++; FAILS.push(`AF-${id} ${desc}`); console.log(`  ❌ AF-${id} ${desc}`); }
}

const MARKER = "ANULFALTA-TEST-2026";
const DPI_TEST = `9999${String(Date.now()).slice(-9)}`;

async function seed(): Promise<{ puestoId: number; employeeId: number; clienteId: number }> {
  // Cliente de prueba
  const cli = await pool.query(
    `INSERT INTO clients (nombre, estado, notas)
     VALUES ('Cliente Test Anular Falta', 'activo', $1)
     RETURNING id`, [MARKER]);
  const clienteId = cli.rows[0].id;

  // Empleado de prueba
  const emp = await pool.query(
    `INSERT INTO employees (nombre_completo, dpi, estado_laboral, notas)
     VALUES ('Empleado Anular Falta', $2, 'activo', $1)
     RETURNING id`, [MARKER, DPI_TEST]);
  const employeeId = emp.rows[0].id;

  // Puesto fijo en estado faltando
  const po = await pool.query(`
    INSERT INTO puestos_operativos
      (nombre, cliente_id, cliente_nombre, tipo_puesto,
       estado_operativo_puesto, titular_employee_id, titular_nombre,
       falta_employee_id, falta_motivo, falta_notas, falta_usuario)
    VALUES ('Puesto Test AF', $1, 'Cliente Test Anular Falta', 'normal',
            'faltando', $2, 'Empleado Anular Falta',
            $2, 'no_aviso', 'notas previas', 'op-original')
    RETURNING id
  `, [clienteId, employeeId]);

  return { puestoId: po.rows[0].id, employeeId, clienteId };
}

async function setFaltando(puestoId: number, employeeId: number) {
  await pool.query(`
    UPDATE puestos_operativos
       SET estado_operativo_puesto='faltando',
           falta_employee_id=$2, falta_motivo='no_aviso',
           falta_notas='notas previas', falta_usuario='op-original'
     WHERE id=$1
  `, [puestoId, employeeId]);
}

async function cleanup() {
  await pool.query(`DELETE FROM eventos_rrhh WHERE observaciones LIKE '%${MARKER}%'`);
  await pool.query(`DELETE FROM puestos_operativos WHERE cliente_nombre='Cliente Test Anular Falta'`);
  await pool.query(`DELETE FROM employees WHERE notas=$1`, [MARKER]);
  await pool.query(`DELETE FROM clients WHERE notas=$1`, [MARKER]);
}

async function main() {
  console.log("\n════════════════════════════════════════════════════════════");
  console.log("  TESTS — ANULAR FALTA DE PUESTO FIJO");
  console.log("════════════════════════════════════════════════════════════\n");

  await cleanup();
  const { puestoId, employeeId } = await seed();
  console.log(`  seed: puestoId=${puestoId} employeeId=${employeeId}`);

  // AF-001 — sin rol válido
  let r = await req("POST", "/operaciones/anular-falta", { puestoId, motivo: "x" }, NO_AUTH);
  ok("001", "rol no autorizado → 403", r.status === 403);

  // AF-002 — admin → 200, evento creado, slot en normal
  r = await req("POST", "/operaciones/anular-falta", {
    puestoId, motivo: `Falta marcada por error ${MARKER}`, usuario: "test-admin",
  });
  ok("002a", "POST anular-falta admin → 200", r.status === 200 && (r.data as any)?.ok === true);
  const eventoId = (r.data as any)?.eventoId as number;
  ok("002b", "eventoId presente", typeof eventoId === "number");

  const ev = await pool.query(
    `SELECT tipo_evento, estado, observaciones, metadata_json FROM eventos_rrhh WHERE id=$1`, [eventoId]);
  ok("002c", "evento tipo=anulacion_falta", ev.rows[0]?.tipo_evento === "anulacion_falta");
  ok("002d", "evento estado=pendiente_aprobacion", ev.rows[0]?.estado === "pendiente_aprobacion");
  const meta = typeof ev.rows[0]?.metadata_json === "string"
    ? JSON.parse(ev.rows[0].metadata_json)
    : ev.rows[0]?.metadata_json;
  ok("002e", "metadata.snapshot.puesto_id correcto", meta?.puesto_id === puestoId);
  ok("002f", "metadata.snapshot.falta_motivo guardado", meta?.falta_motivo === "no_aviso");

  let po = await pool.query(
    `SELECT estado_operativo_puesto, falta_employee_id, falta_motivo FROM puestos_operativos WHERE id=$1`, [puestoId]);
  ok("002g", "slot en estado 'normal'", po.rows[0].estado_operativo_puesto === "normal");
  ok("002h", "falta_employee_id limpio", po.rows[0].falta_employee_id === null);

  // AF-003 — rechazar → slot vuelve a faltando
  r = await req("PATCH", `/rrhh/eventos/${eventoId}/estado`, {
    estado: "rechazado", notas: "RRHH rechaza", usuario: "rrhh-test",
  });
  ok("003a", "PATCH rechazado → 200", r.status === 200);
  po = await pool.query(
    `SELECT estado_operativo_puesto, falta_employee_id, falta_motivo, falta_notas, falta_usuario FROM puestos_operativos WHERE id=$1`, [puestoId]);
  ok("003b", "slot restaurado a 'faltando'", po.rows[0].estado_operativo_puesto === "faltando");
  ok("003c", "falta_employee_id restaurado", po.rows[0].falta_employee_id === employeeId);
  ok("003d", "falta_motivo restaurado", po.rows[0].falta_motivo === "no_aviso");
  ok("003e", "falta_notas restaurado", po.rows[0].falta_notas === "notas previas");
  ok("003f", "falta_usuario restaurado", po.rows[0].falta_usuario === "op-original");

  // AF-004 — re-anular y aprobar → slot sigue normal
  await setFaltando(puestoId, employeeId);
  r = await req("POST", "/operaciones/anular-falta", {
    puestoId, motivo: `Segunda anulación ${MARKER}`, usuario: "test-admin",
  });
  const eventoId2 = (r.data as any)?.eventoId as number;
  ok("004a", "re-anulación 200", r.status === 200 && typeof eventoId2 === "number");

  r = await req("PATCH", `/rrhh/eventos/${eventoId2}/estado`, { estado: "aprobado", usuario: "rrhh-test" });
  ok("004b", "PATCH aprobado → 200", r.status === 200);
  po = await pool.query(
    `SELECT estado_operativo_puesto, falta_employee_id FROM puestos_operativos WHERE id=$1`, [puestoId]);
  ok("004c", "slot sigue en 'normal' tras aprobación", po.rows[0].estado_operativo_puesto === "normal");
  ok("004d", "falta_employee_id sigue limpio", po.rows[0].falta_employee_id === null);

  await cleanup();

  console.log(`\n  Resultado: ${PASS} ok, ${FAIL} fail`);
  if (FAIL > 0) { console.log("  Fallidos:\n   - " + FAILS.join("\n   - ")); process.exit(1); }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
