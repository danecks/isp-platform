import { Router } from "express";
import { pool } from "@workspace/db";

export const libroSalariosRouter = Router();

const COLS = `
  p.id               AS planilla_id,
  p.periodo_desde::text,
  p.periodo_hasta::text,
  p.estado           AS planilla_estado,
  p.generado_por,
  pl.id              AS linea_id,
  pl.employee_id,
  pl.nombre_completo,
  pl.dpi,
  pl.puesto,
  pl.sede,
  pl.cliente,
  pl.frecuencia_pago,
  pl.sueldo_base,
  pl.periodo_dias,
  pl.dias_trabajados,
  pl.faltas,
  pl.suspensiones,
  pl.horas_extra,
  pl.sueldo_periodo,
  pl.desc_faltas,
  pl.valor_he,
  COALESCE(pl.bonificacion_incentivo, 0) AS bonificacion_incentivo,
  COALESCE(pl.desc_septimo, 0)           AS desc_septimo,
  pl.total_bruto,
  COALESCE(pl.igss_trabajador, 0)        AS igss_trabajador,
  pl.anticipos,
  COALESCE(pl.otros_descuentos, 0)       AS otros_descuentos,
  pl.total_neto
`;

// ── Columnas del historial ODBC mapeadas al formato LineaLibro ──────────────
// lbl_pla: 1=primera quincena, 2=segunda quincena
// Se genera un planilla_id sintético: año*10000 + mes*100 + lbl_pla
const HISTORICO_COLS = `
  (h.lbl_ano * 10000 + h.lbl_mes * 100 + h.lbl_pla)        AS planilla_id,
  -- Período calculado
  CASE h.lbl_pla
    WHEN 1 THEN MAKE_DATE(h.lbl_ano, h.lbl_mes, 1)::text
    ELSE        MAKE_DATE(h.lbl_ano, h.lbl_mes, 16)::text
  END                                                        AS periodo_desde,
  CASE h.lbl_pla
    WHEN 1 THEN MAKE_DATE(h.lbl_ano, h.lbl_mes, 15)::text
    ELSE (MAKE_DATE(h.lbl_ano, h.lbl_mes, 1) + INTERVAL '1 month - 1 day')::text
  END                                                        AS periodo_hasta,
  'odbc'                                                     AS planilla_estado,
  'ODBC'                                                     AS generado_por,
  h.id                                                       AS linea_id,
  e.id                                                       AS employee_id,
  COALESCE(e.nombre_completo, 'Empleado #' || h.empl_numero) AS nombre_completo,
  e.dpi,
  e.puesto,
  e.sede,
  NULL                                                       AS cliente,
  'quincenal'                                                AS frecuencia_pago,
  e.sueldo_base,
  CASE h.lbl_pla WHEN 1 THEN 15 ELSE 16 END                 AS periodo_dias,
  COALESCE(h.lbl_dt, 0)                                     AS dias_trabajados,
  COALESCE(h.lbl_faltas, 0)                                 AS faltas,
  0                                                          AS suspensiones,
  0                                                          AS horas_extra,
  COALESCE(h.lbl_ordinario, 0)                              AS sueldo_periodo,
  0                                                          AS desc_faltas,
  0                                                          AS valor_he,
  0                                                          AS bonificacion_incentivo,
  COALESCE(h.lbl_dsep, 0)                                   AS desc_septimo,
  COALESCE(h.lbl_tdev, 0)                                   AS total_bruto,
  COALESCE(h.lbl_dsigss, 0)                                 AS igss_trabajador,
  0                                                          AS anticipos,
  GREATEST(0, COALESCE(h.lbl_tdes, 0)
              - COALESCE(h.lbl_dsigss, 0)
              - COALESCE(h.lbl_dsep, 0)
              - COALESCE(h.lbl_dsemp, 0))                   AS otros_descuentos,
  COALESCE(h.lbl_liquido, 0)                                AS total_neto
`;

// ── GET /api/libro-salarios/empleados ─────────────────────────────────────────
libroSalariosRouter.get("/libro-salarios/empleados", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT pl.employee_id AS id, MIN(pl.nombre_completo) AS nombre_completo
      FROM planilla_lineas pl
      WHERE pl.employee_id IS NOT NULL
      GROUP BY pl.employee_id
      ORDER BY MIN(pl.nombre_completo)
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/libro-salarios/historico/empleados ───────────────────────────────
// Lista de empleados que tienen datos en historial_lib_sal (para dropdown ODBC)
// Devuelve empl_numero como "id" para uso directo en la URL del colaborador
libroSalariosRouter.get("/libro-salarios/historico/empleados", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT
        h.empl_numero                                              AS id,
        COALESCE(e.nombre_completo, 'Empleado #' || h.empl_numero) AS nombre_completo
      FROM historial_lib_sal h
      LEFT JOIN employees e ON e.external_id = h.empl_numero::varchar
      ORDER BY nombre_completo
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/libro-salarios/historico/periodos ────────────────────────────────
// Lista de períodos disponibles en historial_lib_sal
libroSalariosRouter.get("/libro-salarios/historico/periodos", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        lbl_ano,
        lbl_mes,
        lbl_pla,
        COUNT(*)           AS empleados,
        SUM(lbl_ordinario) AS total_ordinario,
        SUM(lbl_tdev)      AS total_devengado,
        SUM(lbl_liquido)   AS total_liquido
      FROM historial_lib_sal
      GROUP BY lbl_ano, lbl_mes, lbl_pla
      ORDER BY lbl_ano DESC, lbl_mes DESC, lbl_pla DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/libro-salarios/general ───────────────────────────────────────────
libroSalariosRouter.get("/libro-salarios/general", async (req, res, next) => {
  try {
    const anio = parseInt(req.query.anio as string) || new Date().getFullYear();
    const mes  = parseInt(req.query.mes  as string) || new Date().getMonth() + 1;

    const { rows } = await pool.query(`
      SELECT ${COLS}
      FROM planillas p
      JOIN planilla_lineas pl ON pl.planilla_id = p.id
      WHERE
        EXTRACT(YEAR  FROM p.periodo_desde) = $1
        AND EXTRACT(MONTH FROM p.periodo_desde) = $2
        AND (p.anulada IS NULL OR p.anulada = FALSE)
      ORDER BY p.periodo_desde, p.periodo_hasta, pl.nombre_completo
    `, [anio, mes]);

    res.json({ rows, anio, mes });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/libro-salarios/historico/general ─────────────────────────────────
// Datos del ODBC (historial_lib_sal) mapeados al formato LineaLibro
libroSalariosRouter.get("/libro-salarios/historico/general", async (req, res, next) => {
  try {
    const anio = parseInt(req.query.anio as string) || new Date().getFullYear();
    const mes  = parseInt(req.query.mes  as string) || new Date().getMonth() + 1;

    const { rows } = await pool.query(`
      SELECT ${HISTORICO_COLS}
      FROM historial_lib_sal h
      LEFT JOIN employees e ON e.external_id = h.empl_numero::varchar
      WHERE h.lbl_ano = $1 AND h.lbl_mes = $2
      ORDER BY h.lbl_pla ASC, nombre_completo ASC
    `, [anio, mes]);

    res.json({ rows, anio, mes, fuente: "odbc" });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/libro-salarios/colaborador/:id ───────────────────────────────────
libroSalariosRouter.get("/libro-salarios/colaborador/:id", async (req, res, next) => {
  try {
    const empId = parseInt(req.params.id);
    const desde = (req.query.desde as string) || `${new Date().getFullYear()}-01-01`;
    const hasta = (req.query.hasta as string) || `${new Date().getFullYear()}-12-31`;

    const [lineasResult, empResult] = await Promise.all([
      pool.query(`
        SELECT ${COLS}
        FROM planillas p
        JOIN planilla_lineas pl ON pl.planilla_id = p.id
        WHERE
          pl.employee_id = $1
          AND p.periodo_desde >= $2::date
          AND p.periodo_hasta <= $3::date
          AND (p.anulada IS NULL OR p.anulada = FALSE)
        ORDER BY p.periodo_desde DESC
      `, [empId, desde, hasta]),
      pool.query(`
        SELECT id, nombre_completo, dpi, puesto
        FROM employees WHERE id = $1
      `, [empId]),
    ]);

    res.json({
      rows:     lineasResult.rows,
      empleado: empResult.rows[0] ?? null,
      desde,
      hasta,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/libro-salarios/historico/colaborador/:empl_numero ───────────────
// Historial ODBC de un empleado específico por empl_numero
libroSalariosRouter.get("/libro-salarios/historico/colaborador/:empl_numero", async (req, res, next) => {
  try {
    const emplNum = parseInt(req.params.empl_numero);
    const desdeAno = parseInt(req.query.desde_ano as string) || 2020;
    const hastaAno = parseInt(req.query.hasta_ano as string) || new Date().getFullYear();

    const [lineasResult, empResult] = await Promise.all([
      pool.query(`
        SELECT ${HISTORICO_COLS}
        FROM historial_lib_sal h
        LEFT JOIN employees e ON e.external_id = h.empl_numero::varchar
        WHERE h.empl_numero = $1
          AND h.lbl_ano BETWEEN $2 AND $3
        ORDER BY h.lbl_ano DESC, h.lbl_mes DESC, h.lbl_pla DESC
      `, [emplNum, desdeAno, hastaAno]),
      pool.query(`
        SELECT id, nombre_completo, dpi, puesto
        FROM employees
        WHERE external_id = $1::varchar
        LIMIT 1
      `, [String(emplNum)]),
    ]);

    res.json({
      rows:      lineasResult.rows,
      empleado:  empResult.rows[0] ?? null,
      empl_numero: emplNum,
      fuente: "odbc",
    });
  } catch (err) {
    next(err);
  }
});
