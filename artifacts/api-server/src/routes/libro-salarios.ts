import { Router } from "express";
import { pool } from "@workspace/db";

export const libroSalariosRouter = Router();

// ── Columnas del sistema nuevo (planilla_lineas) ───────────────────────────
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
  COALESCE(pl.dias_vacaciones, 0) AS dias_vacaciones,
  pl.faltas,
  pl.suspensiones,
  pl.horas_extra,
  pl.sueldo_periodo,
  pl.desc_faltas,
  pl.valor_he,
  COALESCE(pl.bonificacion_incentivo, 0) AS bonificacion_incentivo,
  COALESCE(pl.bonificacion_1, 0)         AS bonificacion_1,
  COALESCE(pl.bonificacion_2, 0)         AS bonificacion_2,
  COALESCE(pl.bonificacion_3, 0)         AS bonificacion_3,
  COALESCE(pl.desc_septimo, 0)           AS desc_septimo,
  pl.total_bruto,
  COALESCE(pl.igss_trabajador, 0)        AS igss_trabajador,
  pl.anticipos,
  COALESCE(pl.otros_descuentos, 0)       AS otros_descuentos,
  pl.total_neto
`;

// ── Columnas de detalle_lib_sal (ODBC con BONI desglosado) ─────────────────
// planilla_id sintético: año*10000 + mes*100 + quincena
const DETALLE_COLS = `
  (d.lbl_ano * 10000 + d.lbl_mes * 100 + d.lbl_pla)                              AS planilla_id,
  CASE d.lbl_pla
    WHEN 1 THEN MAKE_DATE(d.lbl_ano, d.lbl_mes, 1)::text
    ELSE        MAKE_DATE(d.lbl_ano, d.lbl_mes, 16)::text
  END                                                                              AS periodo_desde,
  CASE d.lbl_pla
    WHEN 1 THEN MAKE_DATE(d.lbl_ano, d.lbl_mes, 15)::text
    ELSE (MAKE_DATE(d.lbl_ano, d.lbl_mes, 1) + INTERVAL '1 month - 1 day')::text
  END                                                                              AS periodo_hasta,
  'odbc'                                                                           AS planilla_estado,
  'ODBC'                                                                           AS generado_por,
  d.id                                                                             AS linea_id,
  e.id                                                                             AS employee_id,
  COALESCE(e.nombre_completo, 'Empleado #' || d.empl_numero)                      AS nombre_completo,
  e.dpi,
  e.puesto,
  e.sede,
  NULL                                                                             AS cliente,
  'quincenal'                                                                      AS frecuencia_pago,
  e.sueldo_base,
  CASE d.lbl_pla WHEN 1 THEN 15 ELSE 16 END                                       AS periodo_dias,
  0                                                                                AS dias_trabajados,
  0                                                                                AS dias_vacaciones,
  0                                                                                AS faltas,
  0                                                                                AS suspensiones,
  COALESCE(d.horas_extra, 0)                                                       AS horas_extra,
  COALESCE(d.ordinario, 0)                                                         AS sueldo_periodo,
  0                                                                                AS desc_faltas,
  COALESCE(d.horas_extra, 0)                                                       AS valor_he,
  COALESCE(d.bonificacion, 0)                                                      AS bonificacion_incentivo,
  0                                                                                AS desc_septimo,
  COALESCE(d.ordinario,0) + COALESCE(d.horas_extra,0) + COALESCE(d.otros_devengados,0) + COALESCE(d.bonificacion,0)
                                                                                   AS total_bruto,
  COALESCE(d.igss_trabajador, 0)                                                   AS igss_trabajador,
  0                                                                                AS anticipos,
  COALESCE(d.otras_deducciones, 0)                                                 AS otros_descuentos,
  COALESCE(d.ordinario,0) + COALESCE(d.horas_extra,0) + COALESCE(d.otros_devengados,0) + COALESCE(d.bonificacion,0)
    - COALESCE(d.igss_trabajador,0) - COALESCE(d.otras_deducciones,0)             AS total_neto
`;

// ── Columnas de historial_lib_sal (ODBC legado, BONI dentro de tdev) ────────
const HISTORICO_COLS = `
  (h.lbl_ano * 10000 + h.lbl_mes * 100 + h.lbl_pla)        AS planilla_id,
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
  0                                                          AS dias_vacaciones,
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

// ── Helper: detectar fuente ODBC preferida para un período ─────────────────
async function odbcSourceForPeriodo(anio: number, mes: number): Promise<"detalle" | "historial"> {
  const { rows } = await pool.query(
    `SELECT 1 FROM detalle_lib_sal WHERE lbl_ano=$1 AND lbl_mes=$2 LIMIT 1`,
    [anio, mes]
  );
  return rows.length > 0 ? "detalle" : "historial";
}

// ── Helper: detectar fuente ODBC preferida para un empleado ────────────────
async function odbcSourceForEmpleado(emplNum: number): Promise<"detalle" | "historial"> {
  const { rows } = await pool.query(
    `SELECT 1 FROM detalle_lib_sal WHERE empl_numero=$1 LIMIT 1`,
    [emplNum]
  );
  return rows.length > 0 ? "detalle" : "historial";
}

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
// Lista de empleados ODBC — prefiere detalle_lib_sal, cae en historial si vacío
libroSalariosRouter.get("/libro-salarios/historico/empleados", async (_req, res, next) => {
  try {
    // Intentar con detalle_lib_sal primero
    const chk = await pool.query(`SELECT 1 FROM detalle_lib_sal LIMIT 1`);
    const tabla = chk.rows.length > 0 ? "detalle_lib_sal" : "historial_lib_sal";
    const { rows } = await pool.query(`
      SELECT DISTINCT
        h.empl_numero                                              AS id,
        COALESCE(e.nombre_completo, 'Empleado #' || h.empl_numero) AS nombre_completo
      FROM ${tabla} h
      LEFT JOIN employees e ON e.external_id = h.empl_numero::varchar
      ORDER BY nombre_completo
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/libro-salarios/historico/periodos ────────────────────────────────
libroSalariosRouter.get("/libro-salarios/historico/periodos", async (_req, res, next) => {
  try {
    // Intentar con detalle_lib_sal primero
    const chk = await pool.query(`SELECT 1 FROM detalle_lib_sal LIMIT 1`);
    if (chk.rows.length > 0) {
      const { rows } = await pool.query(`
        SELECT
          lbl_ano, lbl_mes, lbl_pla,
          COUNT(*)               AS empleados,
          SUM(ordinario)         AS total_ordinario,
          SUM(ordinario + horas_extra + otros_devengados + bonificacion) AS total_devengado,
          SUM(ordinario + horas_extra + otros_devengados + bonificacion
              - igss_trabajador - otras_deducciones)                     AS total_liquido
        FROM detalle_lib_sal
        GROUP BY lbl_ano, lbl_mes, lbl_pla
        ORDER BY lbl_ano DESC, lbl_mes DESC, lbl_pla DESC
      `);
      return res.json(rows);
    }
    const { rows } = await pool.query(`
      SELECT
        lbl_ano, lbl_mes, lbl_pla,
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
// Prefiere detalle_lib_sal (BONI desglosado); cae en historial_lib_sal si no hay datos
libroSalariosRouter.get("/libro-salarios/historico/general", async (req, res, next) => {
  try {
    const anio = parseInt(req.query.anio as string) || new Date().getFullYear();
    const mes  = parseInt(req.query.mes  as string) || new Date().getMonth() + 1;

    const fuente = await odbcSourceForPeriodo(anio, mes);

    if (fuente === "detalle") {
      const { rows } = await pool.query(`
        SELECT ${DETALLE_COLS}
        FROM detalle_lib_sal d
        LEFT JOIN employees e ON e.external_id = d.empl_numero::varchar
        WHERE d.lbl_ano = $1 AND d.lbl_mes = $2
        ORDER BY d.lbl_pla ASC, nombre_completo ASC
      `, [anio, mes]);
      return res.json({ rows, anio, mes, fuente: "detalle" });
    }

    // Fallback: historial_lib_sal
    const { rows } = await pool.query(`
      SELECT ${HISTORICO_COLS}
      FROM historial_lib_sal h
      LEFT JOIN employees e ON e.external_id = h.empl_numero::varchar
      WHERE h.lbl_ano = $1 AND h.lbl_mes = $2
      ORDER BY h.lbl_pla ASC, nombre_completo ASC
    `, [anio, mes]);

    res.json({ rows, anio, mes, fuente: "historial" });
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
// Prefiere detalle_lib_sal; cae en historial si el empleado no está en detalle
libroSalariosRouter.get("/libro-salarios/historico/colaborador/:empl_numero", async (req, res, next) => {
  try {
    const emplNum  = parseInt(req.params.empl_numero);
    const desdeAno = parseInt(req.query.desde_ano as string) || 2020;
    const hastaAno = parseInt(req.query.hasta_ano as string) || new Date().getFullYear();

    const fuente = await odbcSourceForEmpleado(emplNum);

    if (fuente === "detalle") {
      const [lineasResult, empResult] = await Promise.all([
        pool.query(`
          SELECT ${DETALLE_COLS}
          FROM detalle_lib_sal d
          LEFT JOIN employees e ON e.external_id = d.empl_numero::varchar
          WHERE d.empl_numero = $1
            AND d.lbl_ano BETWEEN $2 AND $3
          ORDER BY d.lbl_ano DESC, d.lbl_mes DESC, d.lbl_pla DESC
        `, [emplNum, desdeAno, hastaAno]),
        pool.query(`
          SELECT id, nombre_completo, dpi, puesto
          FROM employees WHERE external_id = $1::varchar LIMIT 1
        `, [String(emplNum)]),
      ]);
      return res.json({
        rows:       lineasResult.rows,
        empleado:   empResult.rows[0] ?? null,
        empl_numero: emplNum,
        fuente: "detalle",
      });
    }

    // Fallback: historial_lib_sal
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
        FROM employees WHERE external_id = $1::varchar LIMIT 1
      `, [String(emplNum)]),
    ]);
    res.json({
      rows:       lineasResult.rows,
      empleado:   empResult.rows[0] ?? null,
      empl_numero: emplNum,
      fuente: "historial",
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/libro-salarios/importar-detalle ─────────────────────────────────
// Importa filas del archivo dbo_DETALLELIBROSALARIOS en detalle_lib_sal
// Payload: { rows: [{emp_nit, pla_numero, empl_numero, lbl_tpla, lbl_ano, lbl_mes, lbl_pla, ORD, EXT, OTROS, BONI, IGSS, OTROS_DESC}], preview? }
libroSalariosRouter.post("/libro-salarios/importar-detalle", async (req, res, next) => {
  try {
    const { rows: filas, preview = false } = req.body as {
      rows: {
        emp_nit?: string; pla_numero?: number; empl_numero: number;
        lbl_tpla?: string; lbl_ano: number; lbl_mes: number; lbl_pla: number;
        ORD?: number; EXT?: number; OTROS?: number; BONI?: number;
        IGSS?: number; OTROS_DESC?: number;
      }[];
      preview?: boolean;
    };

    if (!filas?.length) {
      return res.status(400).json({ error: "Sin filas para importar" });
    }

    if (preview) {
      const empSet = new Set(filas.map(f => f.empl_numero));
      const periodos = new Map<string, number>();
      filas.forEach(f => {
        const k = `${f.lbl_ano}-${String(f.lbl_mes).padStart(2,"0")}-Q${f.lbl_pla}`;
        periodos.set(k, (periodos.get(k) ?? 0) + 1);
      });
      const muestra = filas.slice(0, 5).map(f => ({
        empl_numero: f.empl_numero,
        periodo: `${f.lbl_ano}-${String(f.lbl_mes).padStart(2,"0")} Q${f.lbl_pla}`,
        ordinario: f.ORD ?? 0,
        bonificacion: f.BONI ?? 0,
        igss: f.IGSS ?? 0,
        neto: (f.ORD??0) + (f.EXT??0) + (f.OTROS??0) + (f.BONI??0) - (f.IGSS??0) - (f.OTROS_DESC??0),
      }));
      return res.json({
        preview: true,
        total: filas.length,
        empleados: empSet.size,
        periodos: [...periodos.entries()].map(([k, v]) => ({ periodo: k, filas: v })).sort((a,b) => a.periodo.localeCompare(b.periodo)),
        muestra,
      });
    }

    let insertadas  = 0;
    let actualizadas = 0;
    let errores     = 0;

    for (const f of filas) {
      try {
        const { rowCount, rows: updated } = await pool.query(`
          INSERT INTO detalle_lib_sal
            (emp_nit, pla_numero, empl_numero, lbl_tpla, lbl_ano, lbl_mes, lbl_pla,
             ordinario, horas_extra, otros_devengados, bonificacion,
             igss_trabajador, otras_deducciones)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          ON CONFLICT (empl_numero, lbl_ano, lbl_mes, lbl_pla) DO UPDATE SET
            emp_nit          = EXCLUDED.emp_nit,
            ordinario        = EXCLUDED.ordinario,
            horas_extra      = EXCLUDED.horas_extra,
            otros_devengados = EXCLUDED.otros_devengados,
            bonificacion     = EXCLUDED.bonificacion,
            igss_trabajador  = EXCLUDED.igss_trabajador,
            otras_deducciones = EXCLUDED.otras_deducciones,
            importado_at     = NOW()
          RETURNING (xmax = 0) AS inserted
        `, [
          f.emp_nit ?? null,
          f.pla_numero ?? f.lbl_pla,
          f.empl_numero,
          f.lbl_tpla ?? "SAL",
          f.lbl_ano, f.lbl_mes, f.lbl_pla,
          f.ORD ?? 0,
          f.EXT ?? 0,
          f.OTROS ?? 0,
          f.BONI ?? 0,
          f.IGSS ?? 0,
          f.OTROS_DESC ?? 0,
        ]);
        if (updated[0]?.inserted) insertadas++;
        else actualizadas++;
      } catch {
        errores++;
      }
    }

    res.json({ ok: true, insertadas, actualizadas, errores, total: filas.length });
  } catch (err) {
    next(err);
  }
});

// ── Helper: último día del mes ──────────────────────────────────────────────
function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0);
  return `${year}-${String(month).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ── POST /api/libro-salarios/materializar-planillas ──────────────────────────
// Convierte historial_lib_sal / detalle_lib_sal en planillas + planilla_lineas
// cerradas sintéticas, para que "Sistema Nuevo" tenga historial desde hoy.
// fuente: "auto" (default) | "historial" | "detalle"
libroSalariosRouter.post("/libro-salarios/materializar-planillas", async (req, res, next) => {
  try {
    const fuentePref = (req.body?.fuente as string) || "auto";

    const { rows: dp } = await pool.query(
      `SELECT DISTINCT lbl_ano, lbl_mes, lbl_pla FROM detalle_lib_sal ORDER BY lbl_ano, lbl_mes, lbl_pla`
    );
    const { rows: hp } = await pool.query(
      `SELECT DISTINCT lbl_ano, lbl_mes, lbl_pla FROM historial_lib_sal ORDER BY lbl_ano, lbl_mes, lbl_pla`
    );

    const detalleSet = new Set(dp.map((p: any) => `${p.lbl_ano}-${p.lbl_mes}-${p.lbl_pla}`));

    const periodos: { lbl_ano: number; lbl_mes: number; lbl_pla: number; fuente: "detalle" | "historial" }[] = [];
    if (fuentePref !== "historial") {
      dp.forEach((p: any) => periodos.push({ lbl_ano: +p.lbl_ano, lbl_mes: +p.lbl_mes, lbl_pla: +p.lbl_pla, fuente: "detalle" }));
    }
    if (fuentePref !== "detalle") {
      hp.forEach((p: any) => {
        const k = `${p.lbl_ano}-${p.lbl_mes}-${p.lbl_pla}`;
        if (fuentePref === "auto" && detalleSet.has(k)) return;
        periodos.push({ lbl_ano: +p.lbl_ano, lbl_mes: +p.lbl_mes, lbl_pla: +p.lbl_pla, fuente: "historial" });
      });
    }

    let planillas_creadas     = 0;
    let planillas_actualizadas = 0;
    let lineas_creadas        = 0;
    let periodos_omitidos     = 0;
    const errores: string[]   = [];

    for (const per of periodos) {
      try {
        const periodoDesde = per.lbl_pla === 1
          ? `${per.lbl_ano}-${String(per.lbl_mes).padStart(2,"0")}-01`
          : `${per.lbl_ano}-${String(per.lbl_mes).padStart(2,"0")}-16`;
        const periodoHasta = per.lbl_pla === 1
          ? `${per.lbl_ano}-${String(per.lbl_mes).padStart(2,"0")}-15`
          : lastDayOfMonth(per.lbl_ano, per.lbl_mes);

        // ¿Ya existe planilla para este período?
        const { rows: exP } = await pool.query(
          `SELECT id, generado_por FROM planillas
           WHERE periodo_desde = $1::date AND periodo_hasta = $2::date AND NOT anulada`,
          [periodoDesde, periodoHasta]
        );

        let planillaId: number;

        if (exP.length > 0) {
          if (exP[0].generado_por !== "importacion-historica") {
            periodos_omitidos++;
            continue;
          }
          await pool.query(`DELETE FROM planilla_lineas WHERE planilla_id = $1`, [exP[0].id]);
          planillaId = exP[0].id;
          planillas_actualizadas++;
        } else {
          // Crear o reusar cierre sintético
          let cierreId: number;
          const { rows: exC } = await pool.query(
            `SELECT id FROM pre_planilla_cierres
             WHERE periodo_desde = $1::date AND periodo_hasta = $2::date AND NOT anulado`,
            [periodoDesde, periodoHasta]
          );
          if (exC.length > 0) {
            cierreId = exC[0].id;
          } else {
            const { rows: nc } = await pool.query(
              `INSERT INTO pre_planilla_cierres
                 (periodo_desde, periodo_hasta, cerrado_por, snapshot, total_colaboradores, total_estimado)
               VALUES ($1::date, $2::date, 'importacion-historica', '[]', 0, 0)
               RETURNING id`,
              [periodoDesde, periodoHasta]
            );
            cierreId = nc[0].id;
          }

          // Crear planilla cerrada sintética
          const { rows: np } = await pool.query(
            `INSERT INTO planillas
               (periodo_desde, periodo_hasta, cierre_id, generado_por, estado,
                total_colaboradores, total_sueldo_periodo, total_desc_faltas, total_valor_he,
                total_bruto, total_anticipos, total_neto, total_igss_trabajador,
                total_igss_patronal, total_bonificacion_incentivo)
             VALUES ($1::date, $2::date, $3, 'importacion-historica', 'cerrada',
                     0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
             RETURNING id`,
            [periodoDesde, periodoHasta, cierreId]
          );
          planillaId = np[0].id;
          planillas_creadas++;
        }

        // Obtener filas fuente con join a employees
        const joinQ = per.fuente === "detalle"
          ? `SELECT d.*, e.id AS emp_id,
               COALESCE(e.nombre_completo, 'Empleado #' || d.empl_numero) AS nombre,
               e.dpi, e.puesto, e.sede, e.sueldo_base AS emp_sueldo
             FROM detalle_lib_sal d
             LEFT JOIN employees e ON e.empl_numero = d.empl_numero
             WHERE d.lbl_ano=$1 AND d.lbl_mes=$2 AND d.lbl_pla=$3`
          : `SELECT h.*, e.id AS emp_id,
               COALESCE(e.nombre_completo, 'Empleado #' || h.empl_numero) AS nombre,
               e.dpi, e.puesto, e.sede, e.sueldo_base AS emp_sueldo
             FROM historial_lib_sal h
             LEFT JOIN employees e ON e.empl_numero = h.empl_numero
             WHERE h.lbl_ano=$1 AND h.lbl_mes=$2 AND h.lbl_pla=$3`;

        const { rows: srcRows } = await pool.query(joinQ, [per.lbl_ano, per.lbl_mes, per.lbl_pla]);
        const isDetalle = per.fuente === "detalle";

        for (const row of srcRows) {
          const sueldo_periodo        = isDetalle ? +(row.ordinario ?? 0) : +(row.lbl_ordinario ?? 0);
          const bonificacion_incentivo = isDetalle ? +(row.bonificacion ?? 0) : 0;
          const desc_septimo          = isDetalle ? 0 : +(row.lbl_dsep ?? 0);
          const desc_faltas           = isDetalle ? 0 : +(row.lbl_faltas ?? 0);
          const igss_trabajador       = isDetalle ? +(row.igss_trabajador ?? 0) : +(row.lbl_dsigss ?? 0);
          const otros_descuentos      = isDetalle
            ? +(row.otras_deducciones ?? 0)
            : Math.max(0, +(row.lbl_tdes ?? 0) - +(row.lbl_dsigss ?? 0) - +(row.lbl_dsep ?? 0));
          const total_bruto = isDetalle
            ? sueldo_periodo + +(row.horas_extra ?? 0) + +(row.otros_devengados ?? 0) + bonificacion_incentivo
            : +(row.lbl_tdev ?? 0);
          const total_neto = isDetalle
            ? total_bruto - igss_trabajador - +(row.otras_deducciones ?? 0)
            : +(row.lbl_liquido ?? 0);

          await pool.query(
            `INSERT INTO planilla_lineas
               (planilla_id, employee_id, nombre_completo, dpi, puesto, sede,
                sueldo_base, sueldo_periodo, horas_extra, valor_he, desc_faltas,
                bonificacion_incentivo, desc_septimo, total_bruto,
                igss_trabajador, igss_patronal, anticipos, otros_descuentos, total_neto,
                aplica_igss, frecuencia_pago, periodo_dias, dias_trabajados, faltas, suspensiones)
             VALUES
               ($1,$2,$3,$4,$5,$6, $7,$8,0,0,$9, $10,$11,$12, $13,0,0,$14,$15, $16,'quincenal',$17,0,0,0)`,
            [
              planillaId,
              row.emp_id ?? null,
              row.nombre,
              row.dpi ?? null,
              row.puesto ?? null,
              row.sede ?? null,
              +(row.emp_sueldo ?? sueldo_periodo),
              sueldo_periodo,
              desc_faltas,
              bonificacion_incentivo, desc_septimo, total_bruto,
              igss_trabajador,
              otros_descuentos, total_neto,
              igss_trabajador > 0,
              per.lbl_pla === 1 ? 15 : 16,
            ]
          );
          lineas_creadas++;
        }

        // Actualizar totales de la planilla
        await pool.query(
          `UPDATE planillas SET
             total_colaboradores       = (SELECT COUNT(*)           FROM planilla_lineas WHERE planilla_id=$1),
             total_sueldo_periodo      = (SELECT COALESCE(SUM(sueldo_periodo),0) FROM planilla_lineas WHERE planilla_id=$1),
             total_desc_faltas         = (SELECT COALESCE(SUM(desc_faltas),0)   FROM planilla_lineas WHERE planilla_id=$1),
             total_valor_he            = (SELECT COALESCE(SUM(valor_he),0)      FROM planilla_lineas WHERE planilla_id=$1),
             total_bruto               = (SELECT COALESCE(SUM(total_bruto),0)   FROM planilla_lineas WHERE planilla_id=$1),
             total_neto                = (SELECT COALESCE(SUM(total_neto),0)    FROM planilla_lineas WHERE planilla_id=$1),
             total_igss_trabajador     = (SELECT COALESCE(SUM(igss_trabajador),0) FROM planilla_lineas WHERE planilla_id=$1),
             total_bonificacion_incentivo=(SELECT COALESCE(SUM(bonificacion_incentivo),0) FROM planilla_lineas WHERE planilla_id=$1)
           WHERE id=$1`,
          [planillaId]
        );

      } catch (perr: any) {
        errores.push(`${per.lbl_ano}/${String(per.lbl_mes).padStart(2,"0")}/Q${per.lbl_pla}: ${perr.message}`);
      }
    }

    res.json({
      ok: true,
      planillas_creadas,
      planillas_actualizadas,
      lineas_creadas,
      periodos_omitidos,
      total_periodos: periodos.length,
      errores,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/libro-salarios/detalle/resumen ───────────────────────────────────
libroSalariosRouter.get("/libro-salarios/detalle/resumen", async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        lbl_ano, lbl_mes, lbl_pla,
        COUNT(*)              AS empleados,
        SUM(ordinario)        AS total_ordinario,
        SUM(bonificacion)     AS total_bonificacion,
        SUM(ordinario + horas_extra + otros_devengados + bonificacion)            AS total_devengado,
        SUM(ordinario + horas_extra + otros_devengados + bonificacion
            - igss_trabajador - otras_deducciones)                                AS total_liquido
      FROM detalle_lib_sal
      GROUP BY lbl_ano, lbl_mes, lbl_pla
      ORDER BY lbl_ano DESC, lbl_mes DESC, lbl_pla DESC
    `);
    res.json({ periodos: rows });
  } catch (err) {
    next(err);
  }
});
