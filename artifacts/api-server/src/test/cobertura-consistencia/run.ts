/**
 * run.ts — Tests de consistencia de cobertura entre módulos
 *
 * Verifica que la fuente única de "¿está cubierto este puesto?"
 * (lib/cobertura-puesto.ts) reporte EXACTAMENTE lo mismo en:
 *   - cierre.contarCoberturaPuestos  (mismo predicado puestoCubiertoSql)
 *   - GET /operaciones/zonas          (puestos_cubiertos / puestos_descubiertos)
 *   - GET /operaciones/todos-puestos  (estado por puesto)
 *   - GET /portal/cobertura           (estado por puesto)
 *
 * Siembra tres puestos:
 *   A) cubierto por slot de turno, con agente_id (legacy) NULL  ← CASO CLAVE
 *   B) cubierto por agente_id legacy, sin slot
 *   C) sin cobertura
 *
 * El caso clave (A) es el que regresaría si alguien volviera a leer la
 * columna legacy `estado`: cubierto por slot debe contar como cubierto en
 * TODOS los módulos.
 */

import { pool } from "@workspace/db";
import { puestoCubiertoSql } from "../../lib/cobertura-puesto";

const BASE = `http://localhost:${process.env.PORT ?? 8080}/api`;
const AUTH_ADMIN = { "x-isp-session": JSON.stringify({ rol: "admin" }) };

let PASS = 0, FAIL = 0;
const FAILS: string[] = [];

async function req(
  method: string,
  path: string,
  headers: Record<string, string> = AUTH_ADMIN,
) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...headers, "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}
function ok(id: string, desc: string, cond: boolean) {
  if (cond) { PASS++; console.log(`  ✅ CC-${id} ${desc}`); }
  else      { FAIL++; FAILS.push(`CC-${id} ${desc}`); console.log(`  ❌ CC-${id} ${desc}`); }
}

const MARKER = "COBCONSIST-TEST-2026";
const PORTAL_CID = `COBCONSIST-${Date.now()}`;
const PORTAL_USER = `cobconsist_${Date.now()}`;
const AUTH_PORTAL = {
  "x-isp-role": "cliente",
  "x-isp-clienteid": PORTAL_CID,
};

interface Seed {
  clienteId: number;
  zonaId: number;
  empA: number;
  empB: number;
  puestoA: number; // cubierto por slot (agente_id NULL) ← caso clave
  puestoB: number; // cubierto por agente_id legacy
  puestoC: number; // descubierto
}

async function seed(): Promise<Seed> {
  // Cliente (tipo_servicio por defecto 'vigilancia' → portal cuenta puestos fijos)
  const cli = await pool.query(
    `INSERT INTO clients (nombre, estado, portal_cliente_id, notas)
     VALUES ('Cliente Cobertura Consist', 'activo', $2, $1)
     RETURNING id`,
    [MARKER, PORTAL_CID],
  );
  const clienteId = cli.rows[0].id as number;

  // Usuario portal vinculado al cliente (ruta legacy de requirePortalAuth)
  await pool.query(
    `INSERT INTO users (username, password_hash, rol, cliente_id, estado, nombre)
     VALUES ($1, 'x', 'cliente', $2, 'activo', 'Portal Cobertura Test')`,
    [PORTAL_USER, PORTAL_CID],
  );

  // Zona dedicada (solo tendrá nuestros 3 puestos → conteo aislado y verificable)
  const zona = await pool.query(
    `INSERT INTO operational_zones (nombre, descripcion, estado)
     VALUES ($1, $2, 'activo') RETURNING id`,
    [`Zona ${MARKER}`, MARKER],
  );
  const zonaId = zona.rows[0].id as number;

  // Empleados
  const ea = await pool.query(
    `INSERT INTO employees (nombre_completo, dpi, estado_laboral, notas)
     VALUES ('Empleado Slot A', $2, 'activo', $1) RETURNING id`,
    [MARKER, `8001${String(Date.now()).slice(-9)}`],
  );
  const empA = ea.rows[0].id as number;
  const eb = await pool.query(
    `INSERT INTO employees (nombre_completo, dpi, estado_laboral, notas)
     VALUES ('Empleado Legacy B', $2, 'activo', $1) RETURNING id`,
    [MARKER, `8002${String(Date.now()).slice(-9)}`],
  );
  const empB = eb.rows[0].id as number;

  // Puesto A — cubierto SOLO por slot de turno. agente_id NULL (legacy vacío).
  const pa = await pool.query(
    `INSERT INTO puestos_operativos
       (nombre, cliente_id, cliente_nombre, zona_operativa_id, agente_id, activo)
     VALUES ('Puesto A (slot)', $1, 'Cliente Cobertura Consist', $2, NULL, TRUE)
     RETURNING id`,
    [clienteId, zonaId],
  );
  const puestoA = pa.rows[0].id as number;
  await pool.query(
    `INSERT INTO puesto_slots (puesto_id, slot_numero, empleado_id, activo)
     VALUES ($1, 1, $2, TRUE)`,
    [puestoA, empA],
  );

  // CASO CLAVE explícito: forzar la columna legacy estado='descubierto' en el
  // puesto cubierto por slot. Si alguien volviera a leer esa columna en vez del
  // helper, este puesto se reportaría como descubierto y el test fallaría.
  // La columna fue RETIRADA (DROP COLUMN) al migrar al modelo de turnos, así que
  // solo la seteamos si todavía existe — así el caso clave queda garantizado por
  // el seed tanto si la columna vuelve como si no.
  const { rows: estadoColRows } = await pool.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_name = 'puestos_operativos' AND column_name = 'estado' LIMIT 1`,
  );
  if (estadoColRows.length > 0) {
    await pool.query(`UPDATE puestos_operativos SET estado = 'descubierto' WHERE id = $1`, [puestoA]);
  }

  // Puesto B — cubierto por agente_id legacy, sin slot
  const pb = await pool.query(
    `INSERT INTO puestos_operativos
       (nombre, cliente_id, cliente_nombre, zona_operativa_id, agente_id, agente_nombre, activo)
     VALUES ('Puesto B (legacy)', $1, 'Cliente Cobertura Consist', $2, $3, 'Empleado Legacy B', TRUE)
     RETURNING id`,
    [clienteId, zonaId, empB],
  );
  const puestoB = pb.rows[0].id as number;

  // Puesto C — sin cobertura
  const pc = await pool.query(
    `INSERT INTO puestos_operativos
       (nombre, cliente_id, cliente_nombre, zona_operativa_id, agente_id, activo)
     VALUES ('Puesto C (vacante)', $1, 'Cliente Cobertura Consist', $2, NULL, TRUE)
     RETURNING id`,
    [clienteId, zonaId],
  );
  const puestoC = pc.rows[0].id as number;

  return { clienteId, zonaId, empA, empB, puestoA, puestoB, puestoC };
}

async function cleanup() {
  await pool.query(
    `DELETE FROM puesto_slots WHERE puesto_id IN (
       SELECT id FROM puestos_operativos WHERE cliente_nombre = 'Cliente Cobertura Consist')`,
  );
  await pool.query(`DELETE FROM puestos_operativos WHERE cliente_nombre = 'Cliente Cobertura Consist'`);
  await pool.query(`DELETE FROM operational_zones WHERE descripcion = $1`, [MARKER]);
  await pool.query(`DELETE FROM users WHERE username = $1`, [PORTAL_USER]);
  await pool.query(`DELETE FROM employees WHERE notas = $1`, [MARKER]);
  await pool.query(`DELETE FROM clients WHERE notas = $1`, [MARKER]);
}

async function fetchCierreResumen(): Promise<{ totalPuestos: number; cubiertos: number; descubiertos: number }> {
  const r = await req("GET", "/operaciones/cierre-hoy");
  const res = (r.data as any)?.resumen ?? {};
  return {
    totalPuestos: Number(res.totalPuestos ?? 0),
    cubiertos: Number(res.cubiertos ?? 0),
    descubiertos: Number(res.descubiertos ?? 0),
  };
}

async function main() {
  console.log("\n▶ Tests de consistencia de cobertura entre módulos\n");
  await cleanup(); // por si quedó basura de una corrida previa

  // Snapshot global del cierre ANTES de sembrar: el conteo de cierre-hoy es
  // global, así que verificamos el delta exacto que aportan nuestros 3 puestos.
  const cierreAntes = await fetchCierreResumen();

  const s = await seed();
  const ids = [s.puestoA, s.puestoB, s.puestoC];
  // Expectativa de cobertura por puesto
  const esperado: Record<number, boolean> = {
    [s.puestoA]: true,  // cubierto por slot (caso clave)
    [s.puestoB]: true,  // cubierto por agente_id legacy
    [s.puestoC]: false, // vacante
  };

  // ── 1) CIERRE: mismo predicado que contarCoberturaPuestos ──────────────────
  // Replicamos EXACTAMENTE la query de cobertura del cierre, acotada a nuestros
  // puestos. Es el predicado puestoCubiertoSql, fuente única de verdad.
  const { rows: cierreRows } = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE ${puestoCubiertoSql("po")})::int AS cubiertos
     FROM puestos_operativos po
     WHERE po.activo = TRUE AND po.id = ANY($1)`,
    [ids],
  );
  ok("001a", "cierre: total = 3", cierreRows[0].total === 3);
  ok("001b", "cierre: cubiertos = 2", cierreRows[0].cubiertos === 2);

  const { rows: cierrePorPuesto } = await pool.query<{ id: number; cubierto: boolean }>(
    `SELECT po.id, ${puestoCubiertoSql("po")} AS cubierto
       FROM puestos_operativos po
      WHERE po.id = ANY($1)`,
    [ids],
  );
  const cierreMap = new Map<number, boolean>(cierrePorPuesto.map((r) => [Number(r.id), r.cubierto]));
  ok("002a", "cierre: Puesto A (slot, agente_id NULL) = cubierto [CASO CLAVE]", cierreMap.get(s.puestoA) === true);
  ok("002b", "cierre: Puesto B (legacy agente_id) = cubierto", cierreMap.get(s.puestoB) === true);
  ok("002c", "cierre: Puesto C (vacante) = descubierto", cierreMap.get(s.puestoC) === false);

  // ── 1b) CIERRE vía ruta real: GET /operaciones/cierre-hoy ──────────────────
  // Ejerce contarCoberturaPuestos a través del borde del módulo (no SQL inline).
  // Es global, así que validamos el delta exacto que aportan los 3 puestos:
  // total +3, cubiertos +2 (A por slot + B por legacy), descubiertos +1 (C).
  const cierreDespues = await fetchCierreResumen();
  ok("001c", "cierre-hoy: delta totalPuestos = +3",
    cierreDespues.totalPuestos - cierreAntes.totalPuestos === 3);
  ok("001d", "cierre-hoy: delta cubiertos = +2 (slot + legacy)",
    cierreDespues.cubiertos - cierreAntes.cubiertos === 2);
  ok("001e", "cierre-hoy: delta descubiertos = +1 (vacante)",
    cierreDespues.descubiertos - cierreAntes.descubiertos === 1);

  // ── 2) /operaciones/zonas: conteos agregados de la zona dedicada ───────────
  const zonasResp = await req("GET", "/operaciones/zonas");
  ok("003a", "/operaciones/zonas → 200", zonasResp.status === 200);
  const zonaRow = (zonasResp.data as any[])?.find((z) => Number(z.id) === s.zonaId);
  ok("003b", "/operaciones/zonas: zona encontrada", !!zonaRow);
  ok("003c", "/operaciones/zonas: puestos_cubiertos = 2", zonaRow?.puestos_cubiertos === 2);
  ok("003d", "/operaciones/zonas: puestos_descubiertos = 1", zonaRow?.puestos_descubiertos === 1);

  // ── 3) /operaciones/todos-puestos: estado por puesto ───────────────────────
  const todosResp = await req("GET", "/operaciones/todos-puestos");
  ok("004a", "/operaciones/todos-puestos → 200", todosResp.status === 200);
  const todosMap = new Map<number, string>(
    (todosResp.data as any[])
      .filter((p) => ids.includes(Number(p.id)))
      .map((p) => [Number(p.id), String(p.estado)]),
  );
  ok("004b", "todos-puestos: Puesto A = 'cubierto' [CASO CLAVE]", todosMap.get(s.puestoA) === "cubierto");
  ok("004c", "todos-puestos: Puesto B = 'cubierto'", todosMap.get(s.puestoB) === "cubierto");
  ok("004d", "todos-puestos: Puesto C = 'descubierto'", todosMap.get(s.puestoC) === "descubierto");

  // ── 4) /portal/cobertura: estado por puesto (portal del cliente) ───────────
  const portalResp = await req("GET", "/portal/cobertura", AUTH_PORTAL);
  ok("005a", "/portal/cobertura → 200", portalResp.status === 200);
  const portalMap = new Map<number, string>(
    ((portalResp.data as any)?.puestos ?? [])
      .filter((p: any) => ids.includes(Number(p.puesto_id)))
      .map((p: any) => [Number(p.puesto_id), String(p.estado)]),
  );
  ok("005b", "portal/cobertura: Puesto A = 'cubierto' [CASO CLAVE]", portalMap.get(s.puestoA) === "cubierto");
  ok("005c", "portal/cobertura: Puesto B = 'cubierto'", portalMap.get(s.puestoB) === "cubierto");
  ok("005d", "portal/cobertura: Puesto C = 'descubierto'", portalMap.get(s.puestoC) === "descubierto");

  // ── 5) Consistencia cruzada: los 4 módulos coinciden por puesto ────────────
  for (const id of ids) {
    const exp = esperado[id];
    const expStr = exp ? "cubierto" : "descubierto";
    const cierreOk = cierreMap.get(id) === exp;
    const todosOk = todosMap.get(id) === expStr;
    const portalOk = portalMap.get(id) === expStr;
    const label =
      id === s.puestoA ? "A(slot)" : id === s.puestoB ? "B(legacy)" : "C(vacante)";
    ok(
      `006-${label}`,
      `consistencia ${label}: cierre/zonas/todos-puestos/portal coinciden en '${expStr}'`,
      cierreOk && todosOk && portalOk,
    );
  }

  await cleanup();

  console.log(`\n  Resultado: ${PASS} ok, ${FAIL} fail`);
  if (FAIL > 0) {
    console.log("  Fallidos:\n   - " + FAILS.join("\n   - "));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); cleanup().finally(() => process.exit(1)); });
