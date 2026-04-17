/**
 * SEGUROS API — Seguro de vida de empleados
 *
 * GET    /seguros/config                    — prima vigente
 * POST   /seguros/config                    — actualizar prima (inserta nueva fila histórica)
 * GET    /seguros/config/historial          — todas las primas (historial de cambios)
 * GET    /seguros/reporte?mes=YYYY-MM       — empleados activos al cierre del mes (JSON)
 * GET    /seguros/reporte/csv?mes=YYYY-MM   — descarga CSV (formato aseguradora)
 */

import { Router } from "express";
import { pool } from "@workspace/db";

const seguros = Router();

// ── helpers ────────────────────────────────────────────────────────────────

function ultimoDiaDelMes(mesISO: string): string {
  // mesISO = "2026-03" → "2026-03-31"
  const [y, m] = mesISO.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error("Formato de mes inválido (YYYY-MM)");
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

function primerDiaDelMes(mesISO: string): string {
  const [y, m] = mesISO.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function nombreMes(mesISO: string): string {
  const [y, m] = mesISO.split("-").map(Number);
  return `${MESES_ES[m - 1]} ${y}`;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function configVigente(fechaISO?: string) {
  // La prima vigente para una fecha es la más reciente con vigente_desde <= fecha
  const params: unknown[] = [];
  let where = "";
  if (fechaISO) { params.push(fechaISO); where = `WHERE vigente_desde <= $1::date`; }
  const { rows } = await pool.query(
    `SELECT id, prima_mensual, vigente_desde, notas, created_at, created_by
       FROM seguros_config
       ${where}
       ORDER BY vigente_desde DESC, id DESC
       LIMIT 1`,
    params,
  );
  return rows[0] ?? null;
}

// ── GET /seguros/config — prima vigente actualmente ─────────────────────────
seguros.get("/seguros/config", async (_req, res) => {
  try {
    const cfg = await configVigente();
    res.json(cfg ?? { prima_mensual: "0.00", vigente_desde: null, notas: null });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /seguros/config/historial ───────────────────────────────────────────
seguros.get("/seguros/config/historial", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, prima_mensual, vigente_desde, notas, created_at, created_by
        FROM seguros_config
        ORDER BY vigente_desde DESC, id DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── POST /seguros/config — actualizar prima ─────────────────────────────────
seguros.post("/seguros/config", async (req, res) => {
  const { prima_mensual, vigente_desde, notas } = req.body ?? {};
  const usuario = (req.headers["x-isp-user"] as string) || "admin";

  const prima = Number(prima_mensual);
  if (!Number.isFinite(prima) || prima < 0) {
    return res.status(400).json({ error: "prima_mensual debe ser un número >= 0" });
  }
  if (!vigente_desde || !/^\d{4}-\d{2}-\d{2}$/.test(vigente_desde)) {
    return res.status(400).json({ error: "vigente_desde debe ser una fecha YYYY-MM-DD" });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO seguros_config (prima_mensual, vigente_desde, notas, created_by)
       VALUES ($1, $2::date, $3, $4)
       RETURNING id, prima_mensual, vigente_desde, notas, created_at, created_by`,
      [prima.toFixed(2), vigente_desde, notas || null, usuario],
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── core: empleados asegurables del mes (activos al último día) ─────────────
async function empleadosDelMes(mesISO: string) {
  const fechaCorte = ultimoDiaDelMes(mesISO);
  const { rows } = await pool.query(
    `SELECT
       e.id,
       e.nombre_completo,
       e.dpi,
       e.sexo,
       e.fecha_nacimiento,
       e.fecha_ingreso,
       e.fecha_baja,
       e.puesto,
       e.sueldo_base,
       e.estado_laboral
     FROM employees e
     WHERE e.estado_laboral = 'activo'
       AND (e.fecha_ingreso IS NULL OR e.fecha_ingreso <= $1::date)
       AND (e.fecha_baja    IS NULL OR e.fecha_baja    > $1::date)
     ORDER BY e.nombre_completo ASC`,
    [fechaCorte],
  );
  return { fechaCorte, empleados: rows };
}

// ── GET /seguros/reporte?mes=YYYY-MM ────────────────────────────────────────
seguros.get("/seguros/reporte", async (req, res) => {
  const mes = String(req.query.mes ?? "");
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: "Parámetro mes requerido (YYYY-MM)" });
  }
  try {
    const fechaCorte = ultimoDiaDelMes(mes);
    const cfg = await configVigente(fechaCorte);
    const { empleados } = await empleadosDelMes(mes);
    const sinDatos = empleados.filter((e) => !e.dpi || !e.fecha_nacimiento || !e.sexo);
    const prima = Number(cfg?.prima_mensual ?? 0);
    res.json({
      mes,
      mesNombre: nombreMes(mes),
      fechaCorte,
      primaMensual: prima,
      primaVigenteDesde: cfg?.vigente_desde ?? null,
      totalEmpleados: empleados.length,
      totalPrima: +(empleados.length * prima).toFixed(2),
      empleados: empleados.map((e) => ({
        id: e.id,
        nombre: e.nombre_completo,
        dpi: e.dpi,
        sexo: e.sexo,
        fechaNacimiento: e.fecha_nacimiento,
        fechaIngreso: e.fecha_ingreso,
        puesto: e.puesto,
        sueldoBase: e.sueldo_base,
      })),
      empleadosSinDatos: sinDatos.map((e) => ({
        id: e.id,
        nombre: e.nombre_completo,
        faltan: [
          !e.dpi ? "DPI" : null,
          !e.fecha_nacimiento ? "fecha de nacimiento" : null,
          !e.sexo ? "sexo" : null,
        ].filter(Boolean),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── GET /seguros/reporte/csv?mes=YYYY-MM ────────────────────────────────────
seguros.get("/seguros/reporte/csv", async (req, res) => {
  const mes = String(req.query.mes ?? "");
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).send("Parámetro mes requerido (YYYY-MM)");
  }
  try {
    const fechaCorte = ultimoDiaDelMes(mes);
    const { empleados } = await empleadosDelMes(mes);

    const headers = [
      "No.",
      "Nombre completo",
      "DPI",
      "Sexo",
      "Fecha de nacimiento",
      "Fecha de ingreso",
      "Puesto",
      "Salario base",
    ];

    const lineas: string[] = [];
    lineas.push(headers.map(csvEscape).join(","));
    empleados.forEach((e, idx) => {
      lineas.push([
        idx + 1,
        e.nombre_completo,
        e.dpi,
        e.sexo,
        e.fecha_nacimiento,
        e.fecha_ingreso,
        e.puesto,
        e.sueldo_base,
      ].map(csvEscape).join(","));
    });

    const BOM = "\uFEFF";
    const csv = BOM + lineas.join("\r\n") + "\r\n";

    const filename = `seguro_vida_${mes}_corte_${fechaCorte}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    res.status(500).send((err as Error).message);
  }
});

export default seguros;
