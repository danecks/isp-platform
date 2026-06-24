/**
 * Test de aislamiento por cliente — Resto del Portal
 *
 * Verifica que los endpoints "no operativos" del portal de clientes filtren
 * estrictamente por el cliente vinculado al usuario autenticado, y que NUNCA
 * expongan datos de otro cliente aunque el atacante manipule x-isp-clienteid.
 *
 * Endpoints cubiertos (extiende lo ya cubierto por portal-aislamiento/run.ts
 * que cubría /portal/operativo/{custodias,puestos}):
 *   GET /api/portal/dashboard
 *   GET /api/portal/incidencias
 *   GET /api/portal/kpi
 *   GET /api/portal/agentes
 *
 * Escenario:
 *   - Cliente A (PORTAL-ISO-R-A): 2 incidencias + 1 puesto fijo con titular A.
 *   - Cliente B (PORTAL-ISO-R-B): 3 incidencias + 1 puesto fijo con titular B.
 *   - Usuario A vinculado únicamente al cliente A.
 *   - Usuario B vinculado únicamente al cliente B.
 *
 * Aserciones por endpoint:
 *   (a) cada usuario ve solo sus propios datos
 *   (b) si manipula x-isp-clienteid al de otro cliente recibe 403
 */

import express from "express";
import http from "http";
import { pool } from "@workspace/db";
import portalRouter from "../../routes/portal";

const MARKER = "PORTAL-ISO-R-TEST";
const PORTAL_A = "PORTAL-ISO-R-A";
const PORTAL_B = "PORTAL-ISO-R-B";

let PASS = 0;
let FAIL = 0;
const FAILURES: string[] = [];

function ok(id: string, desc: string, cond: boolean) {
  if (cond) { PASS++; console.log(`  ✅ ${id} ${desc}`); }
  else      { FAIL++; FAILURES.push(`${id} ${desc}`); console.log(`  ❌ ${id} ${desc}`); }
}

interface Seed {
  clienteAId: number; clienteBId: number;
  userAId: number;    userBId: number;
  empAId: number;     empBId: number;
  puestoAId: number;  puestoBId: number;
  incAIds: string[];  incBIds: string[];
}

async function cleanup() {
  await pool.query(`DELETE FROM incidents WHERE cliente_ref_id IN ($1,$2)`,
    [PORTAL_A, PORTAL_B]);
  await pool.query(`DELETE FROM puesto_slots WHERE puesto_id IN
    (SELECT id FROM puestos_operativos WHERE cliente_id IN
      (SELECT id FROM clients WHERE portal_cliente_id IN ($1,$2)))`,
    [PORTAL_A, PORTAL_B]);
  await pool.query(`DELETE FROM puestos_operativos WHERE cliente_id IN
    (SELECT id FROM clients WHERE portal_cliente_id IN ($1,$2))`,
    [PORTAL_A, PORTAL_B]);
  await pool.query(`DELETE FROM usuarios_clientes WHERE portal_cliente_id IN ($1,$2)`,
    [PORTAL_A, PORTAL_B]);
  await pool.query(`DELETE FROM users WHERE username LIKE $1`, [`${MARKER}-%`]);
  await pool.query(`DELETE FROM employees WHERE notas LIKE $1`, [`%${MARKER}%`]);
  await pool.query(`DELETE FROM clients WHERE portal_cliente_id IN ($1,$2)`,
    [PORTAL_A, PORTAL_B]);
}

async function seed(): Promise<Seed> {
  await cleanup();

  const { rows: ca } = await pool.query<{ id: number }>(
    `INSERT INTO clients (nombre, nombre_comercial, estado, portal_cliente_id, notas)
     VALUES ('Cliente A ' || $1, 'Cliente A', 'activo', $2, $1) RETURNING id`,
    [MARKER, PORTAL_A]);
  const { rows: cb } = await pool.query<{ id: number }>(
    `INSERT INTO clients (nombre, nombre_comercial, estado, portal_cliente_id, notas)
     VALUES ('Cliente B ' || $1, 'Cliente B', 'activo', $2, $1) RETURNING id`,
    [MARKER, PORTAL_B]);

  const { rows: empA } = await pool.query<{ id: number }>(
    `INSERT INTO employees (source_system, sync_status, nombre_completo, estado_laboral, notas)
     VALUES ('test', 'ok', 'Agente A — ' || $1, 'activo', $1) RETURNING id`,
    [MARKER]);
  const { rows: empB } = await pool.query<{ id: number }>(
    `INSERT INTO employees (source_system, sync_status, nombre_completo, estado_laboral, notas)
     VALUES ('test', 'ok', 'Agente B — ' || $1, 'activo', $1) RETURNING id`,
    [MARKER]);

  // Puestos fijos (para que /portal/agentes y /portal/dashboard tengan datos)
  const { rows: poA } = await pool.query<{ id: number }>(
    `INSERT INTO puestos_operativos
       (cliente_id, cliente_nombre, nombre, turno, activo, tipo_puesto,
        titular_employee_id, titular_nombre, agente_id, agente_nombre)
     VALUES ($1, 'Cliente A', 'Puesto Fijo A', 'día', TRUE, 'normal',
             $2, 'Agente A', $2, 'Agente A') RETURNING id`,
    [ca[0].id, empA[0].id]);
  const { rows: poB } = await pool.query<{ id: number }>(
    `INSERT INTO puestos_operativos
       (cliente_id, cliente_nombre, nombre, turno, activo, tipo_puesto,
        titular_employee_id, titular_nombre, agente_id, agente_nombre)
     VALUES ($1, 'Cliente B', 'Puesto Fijo B', 'día', TRUE, 'normal',
             $2, 'Agente B', $2, 'Agente B') RETURNING id`,
    [cb[0].id, empB[0].id]);

  // Incidencias: 2 para A (1 abierta, 1 cerrada), 3 para B (2 abierta, 1 cerrada)
  const incAIds = ["INC-ISOR-A-001", "INC-ISOR-A-002"];
  const incBIds = ["INC-ISOR-B-001", "INC-ISOR-B-002", "INC-ISOR-B-003"];

  await pool.query(
    `INSERT INTO incidents (id, origen, cliente, cliente_ref_id, client_id,
                            tipo, prioridad, estado, descripcion, fecha)
     VALUES ($1, 'test', 'Cliente A', $2, $3, 'robo', 'alta', 'abierta',
             'desc A1', NOW())`,
    [incAIds[0], PORTAL_A, ca[0].id]);
  await pool.query(
    `INSERT INTO incidents (id, origen, cliente, cliente_ref_id, client_id,
                            tipo, prioridad, estado, descripcion, fecha)
     VALUES ($1, 'test', 'Cliente A', $2, $3, 'sospechoso', 'media', 'cerrada',
             'desc A2', NOW())`,
    [incAIds[1], PORTAL_A, ca[0].id]);

  await pool.query(
    `INSERT INTO incidents (id, origen, cliente, cliente_ref_id, client_id,
                            tipo, prioridad, estado, descripcion, fecha)
     VALUES ($1, 'test', 'Cliente B', $2, $3, 'robo', 'alta', 'abierta',
             'desc B1', NOW())`,
    [incBIds[0], PORTAL_B, cb[0].id]);
  await pool.query(
    `INSERT INTO incidents (id, origen, cliente, cliente_ref_id, client_id,
                            tipo, prioridad, estado, descripcion, fecha)
     VALUES ($1, 'test', 'Cliente B', $2, $3, 'sospechoso', 'media', 'abierta',
             'desc B2', NOW())`,
    [incBIds[1], PORTAL_B, cb[0].id]);
  await pool.query(
    `INSERT INTO incidents (id, origen, cliente, cliente_ref_id, client_id,
                            tipo, prioridad, estado, descripcion, fecha)
     VALUES ($1, 'test', 'Cliente B', $2, $3, 'vandalismo', 'baja', 'cerrada',
             'desc B3', NOW())`,
    [incBIds[2], PORTAL_B, cb[0].id]);

  // Users portal
  const { rows: uA } = await pool.query<{ id: number }>(
    `INSERT INTO users (nombre, username, password_hash, rol, estado, cliente_id)
     VALUES ('User A', $1, 'x', 'cliente', 'activo', $2) RETURNING id`,
    [`${MARKER}-userA`, PORTAL_A]);
  const { rows: uB } = await pool.query<{ id: number }>(
    `INSERT INTO users (nombre, username, password_hash, rol, estado, cliente_id)
     VALUES ('User B', $1, 'x', 'cliente', 'activo', $2) RETURNING id`,
    [`${MARKER}-userB`, PORTAL_B]);

  await pool.query(
    `INSERT INTO usuarios_clientes (user_id, portal_cliente_id, es_default)
     VALUES ($1, $2, TRUE)`, [uA[0].id, PORTAL_A]);
  await pool.query(
    `INSERT INTO usuarios_clientes (user_id, portal_cliente_id, es_default)
     VALUES ($1, $2, TRUE)`, [uB[0].id, PORTAL_B]);

  return {
    clienteAId: ca[0].id, clienteBId: cb[0].id,
    userAId:    uA[0].id, userBId:    uB[0].id,
    empAId:     empA[0].id, empBId:   empB[0].id,
    puestoAId:  poA[0].id, puestoBId: poB[0].id,
    incAIds, incBIds,
  };
}

function startServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const app = express();
  app.use(express.json());
  app.use("/api", portalRouter);
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        baseUrl: `http://127.0.0.1:${port}/api`,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

interface Resp { status: number; data: any }

async function get(baseUrl: string, path: string, headers: Record<string, string>): Promise<Resp> {
  const res = await fetch(`${baseUrl}${path}`, { headers });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function main() {
  console.log("\n═══ Portal — aislamiento por cliente (resto de pantallas) ═══");

  const s = await seed();
  console.log(`  [SEED] Cliente A=${s.clienteAId} B=${s.clienteBId} | UserA=${s.userAId} UserB=${s.userBId}`);

  const { baseUrl, close } = await startServer();
  console.log(`  [HTTP] Server arriba en ${baseUrl}`);

  try {
    const headersA = { "x-isp-role": "cliente", "x-isp-userid": String(s.userAId), "x-isp-clienteid": PORTAL_A };
    const headersB = { "x-isp-role": "cliente", "x-isp-userid": String(s.userBId), "x-isp-clienteid": PORTAL_B };
    const crossAB  = { "x-isp-role": "cliente", "x-isp-userid": String(s.userAId), "x-isp-clienteid": PORTAL_B };
    const crossBA  = { "x-isp-role": "cliente", "x-isp-userid": String(s.userBId), "x-isp-clienteid": PORTAL_A };

    // ═════ /portal/dashboard ═════
    const dA = await get(baseUrl, "/portal/dashboard", headersA);
    ok("D-01a", "GET /dashboard cliente A → 200", dA.status === 200);
    ok("D-01b", "dashboard A: 2 incidencias totales", dA.data?.incidencias?.total === 2);
    ok("D-01c", "dashboard A: 1 activa", dA.data?.incidencias?.activas === 1);
    ok("D-01d", "dashboard A: 1 puesto activo", dA.data?.agentes?.puestos === 1);
    const recA = (dA.data?.incidencias?.recientes ?? []) as Array<{ id: string }>;
    ok("D-01e", "dashboard A: solo sus incidencias recientes",
       recA.every(r => s.incAIds.includes(r.id)) &&
       recA.every(r => !s.incBIds.includes(r.id)));

    const dB = await get(baseUrl, "/portal/dashboard", headersB);
    ok("D-02a", "GET /dashboard cliente B → 200", dB.status === 200);
    ok("D-02b", "dashboard B: 3 incidencias totales", dB.data?.incidencias?.total === 3);
    ok("D-02c", "dashboard B: 2 activas", dB.data?.incidencias?.activas === 2);
    const recB = (dB.data?.incidencias?.recientes ?? []) as Array<{ id: string }>;
    ok("D-02d", "dashboard B: solo sus incidencias recientes",
       recB.every(r => s.incBIds.includes(r.id)) &&
       recB.every(r => !s.incAIds.includes(r.id)));

    const dCross1 = await get(baseUrl, "/portal/dashboard", crossAB);
    ok("D-03a", "dashboard A→clienteid=B → 403", dCross1.status === 403);
    const dCross2 = await get(baseUrl, "/portal/dashboard", crossBA);
    ok("D-03b", "dashboard B→clienteid=A → 403", dCross2.status === 403);

    // ═════ /portal/incidencias ═════
    const iA = await get(baseUrl, "/portal/incidencias", headersA);
    ok("I-01a", "GET /incidencias cliente A → 200", iA.status === 200);
    const arrIA = (iA.data ?? []) as Array<{ id: string; clienteRefId?: string }>;
    ok("I-01b", "incidencias A: 2 filas", arrIA.length === 2);
    ok("I-01c", "incidencias A: todas pertenecen a A",
       arrIA.every(i => s.incAIds.includes(i.id)) &&
       arrIA.every(i => !s.incBIds.includes(i.id)));

    const iB = await get(baseUrl, "/portal/incidencias", headersB);
    ok("I-02a", "GET /incidencias cliente B → 200", iB.status === 200);
    const arrIB = (iB.data ?? []) as Array<{ id: string }>;
    ok("I-02b", "incidencias B: 3 filas", arrIB.length === 3);
    ok("I-02c", "incidencias B: todas pertenecen a B",
       arrIB.every(i => s.incBIds.includes(i.id)) &&
       arrIB.every(i => !s.incAIds.includes(i.id)));

    const iCross1 = await get(baseUrl, "/portal/incidencias", crossAB);
    ok("I-03a", "incidencias A→clienteid=B → 403", iCross1.status === 403);
    const iCross2 = await get(baseUrl, "/portal/incidencias", crossBA);
    ok("I-03b", "incidencias B→clienteid=A → 403", iCross2.status === 403);

    // ═════ /portal/kpi ═════
    const kA = await get(baseUrl, "/portal/kpi", headersA);
    ok("K-01a", "GET /kpi cliente A → 200", kA.status === 200);
    ok("K-01b", "kpi A: resumen.total = 2", kA.data?.resumen?.total === 2);
    ok("K-01c", "kpi A: resumen.activas = 1", kA.data?.resumen?.activas === 1);
    ok("K-01d", "kpi A: resumen.resueltas = 1", kA.data?.resumen?.resueltas === 1);

    const kB = await get(baseUrl, "/portal/kpi", headersB);
    ok("K-02a", "GET /kpi cliente B → 200", kB.status === 200);
    ok("K-02b", "kpi B: resumen.total = 3", kB.data?.resumen?.total === 3);
    ok("K-02c", "kpi B: resumen.activas = 2", kB.data?.resumen?.activas === 2);
    ok("K-02d", "kpi B: resumen.resueltas = 1", kB.data?.resumen?.resueltas === 1);

    const kCross1 = await get(baseUrl, "/portal/kpi", crossAB);
    ok("K-03a", "kpi A→clienteid=B → 403", kCross1.status === 403);
    const kCross2 = await get(baseUrl, "/portal/kpi", crossBA);
    ok("K-03b", "kpi B→clienteid=A → 403", kCross2.status === 403);

    // ═════ /portal/agentes ═════
    const aA = await get(baseUrl, "/portal/agentes", headersA);
    ok("A-01a", "GET /agentes cliente A → 200", aA.status === 200);
    const arrAA = (aA.data ?? []) as Array<{ puesto: string; empleadoNombreCompleto: string }>;
    ok("A-01b", "agentes A: 1 fila", arrAA.length === 1);
    ok("A-01c", "agentes A: titular es Agente A",
       arrAA[0]?.empleadoNombreCompleto?.startsWith("Agente A"));
    ok("A-01d", "agentes A: ningún titular es Agente B",
       arrAA.every(r => !(r.empleadoNombreCompleto ?? "").startsWith("Agente B")));

    const aB = await get(baseUrl, "/portal/agentes", headersB);
    ok("A-02a", "GET /agentes cliente B → 200", aB.status === 200);
    const arrAB = (aB.data ?? []) as Array<{ puesto: string; empleadoNombreCompleto: string }>;
    ok("A-02b", "agentes B: 1 fila", arrAB.length === 1);
    ok("A-02c", "agentes B: titular es Agente B",
       arrAB[0]?.empleadoNombreCompleto?.startsWith("Agente B"));
    ok("A-02d", "agentes B: ningún titular es Agente A",
       arrAB.every(r => !(r.empleadoNombreCompleto ?? "").startsWith("Agente A")));

    const aCross1 = await get(baseUrl, "/portal/agentes", crossAB);
    ok("A-03a", "agentes A→clienteid=B → 403", aCross1.status === 403);
    const aCross2 = await get(baseUrl, "/portal/agentes", crossBA);
    ok("A-03b", "agentes B→clienteid=A → 403", aCross2.status === 403);

  } finally {
    await close();
    await cleanup();
  }

  console.log("\n═══ Resultado ═══");
  console.log(`  PASS=${PASS}  FAIL=${FAIL}`);
  if (FAIL > 0) {
    console.log("\nFallos:");
    for (const f of FAILURES) console.log(`  ❌ ${f}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(2);
});
