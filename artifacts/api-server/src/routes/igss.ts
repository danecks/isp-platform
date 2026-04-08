import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

export const igssRouter = Router();

// ─── GET /api/igss/config-patrono ─────────────────────────────────────────────
igssRouter.get("/igss/config-patrono", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, numero_patronal, nit_patrono, nombre_comercial, correo_igss,
              codigo_actividad_principal, created_at, updated_at
       FROM igss_config_patrono LIMIT 1`
    );
    res.json(rows[0] ?? null);
  } catch (err) {
    logger.error({ err }, "GET /igss/config-patrono error");
    res.status(500).json({ error: "Error al leer configuración del patrono" });
  }
});

// ─── PATCH /api/igss/config-patrono ───────────────────────────────────────────
igssRouter.patch("/igss/config-patrono", async (req, res) => {
  const {
    numero_patronal, nit_patrono, nombre_comercial,
    correo_igss, codigo_actividad_principal,
  } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO igss_config_patrono (numero_patronal, nit_patrono, nombre_comercial, correo_igss, codigo_actividad_principal)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         numero_patronal           = EXCLUDED.numero_patronal,
         nit_patrono               = EXCLUDED.nit_patrono,
         nombre_comercial          = EXCLUDED.nombre_comercial,
         correo_igss               = EXCLUDED.correo_igss,
         codigo_actividad_principal = EXCLUDED.codigo_actividad_principal,
         updated_at                = NOW()
       RETURNING *`,
      [numero_patronal ?? null, nit_patrono ?? null, nombre_comercial ?? null,
       correo_igss ?? null, codigo_actividad_principal ?? null]
    );
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /igss/config-patrono error");
    res.status(500).json({ error: "Error al guardar configuración del patrono" });
  }
});

// ─── GET /api/igss/centros ────────────────────────────────────────────────────
// Clientes que están marcados como centros de trabajo IGSS
igssRouter.get("/igss/centros", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, nombre_comercial, nit, sector, estado,
              igss_aplica, igss_codigo_centro, igss_direccion, igss_zona,
              igss_departamento, igss_municipio, igss_codigo_actividad,
              igss_contacto, igss_fax, igss_email, igss_telefono
       FROM clients
       WHERE igss_aplica = TRUE AND estado = 'activo'
       ORDER BY igss_codigo_centro::int NULLS LAST, nombre`
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /igss/centros error");
    res.status(500).json({ error: "Error al cargar centros de trabajo IGSS" });
  }
});

// ─── PATCH /api/igss/clientes/:id/centro ──────────────────────────────────────
// Actualiza los campos IGSS de un cliente (centro de trabajo)
igssRouter.patch("/igss/clientes/:id/centro", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido" });

  const {
    igss_aplica, igss_codigo_centro, igss_direccion, igss_zona,
    igss_departamento, igss_municipio, igss_codigo_actividad,
    igss_contacto, igss_fax, igss_email, igss_telefono,
  } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE clients SET
        igss_aplica            = $1,
        igss_codigo_centro     = $2,
        igss_direccion         = $3,
        igss_zona              = $4,
        igss_departamento      = $5,
        igss_municipio         = $6,
        igss_codigo_actividad  = $7,
        igss_contacto          = $8,
        igss_fax               = $9,
        igss_email             = $10,
        igss_telefono          = $11,
        updated_at             = NOW()
       WHERE id = $12
       RETURNING id, nombre, nombre_comercial,
                 igss_aplica, igss_codigo_centro, igss_direccion, igss_zona,
                 igss_departamento, igss_municipio, igss_codigo_actividad,
                 igss_contacto, igss_fax, igss_email, igss_telefono`,
      [
        igss_aplica ?? false,
        igss_codigo_centro ?? null,
        igss_direccion ?? null,
        igss_zona ?? null,
        igss_departamento ? Number(igss_departamento) : null,
        igss_municipio ? Number(igss_municipio) : null,
        igss_codigo_actividad ?? null,
        igss_contacto ?? null,
        igss_fax ?? null,
        igss_email ?? null,
        igss_telefono ?? null,
        id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /igss/clientes/:id/centro error");
    res.status(500).json({ error: "Error al actualizar datos IGSS del cliente" });
  }
});

// ─── POST /igss/importar-lib-sal ─────────────────────────────────────────────
// Importa filas del libro de salarios ODBC. Soporta preview y upsert completo.
igssRouter.post("/igss/importar-lib-sal", async (req, res) => {
  try {
    const raw = req.headers["x-isp-session"] as string;
    const session = raw ? JSON.parse(raw) : null;
    if (!session || !["admin", "rrhh"].includes(session.rol)) {
      return res.status(403).json({ error: "Sin permisos" });
    }
    const { rows = [], preview = false } = req.body as { rows: any[]; preview: boolean };
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "Sin filas para importar" });
    }

    let insertadas = 0, actualizadas = 0, errores = 0;
    const errDetail: string[] = [];

    for (const rawR of rows) {
      // Normalizar claves a minúsculas (el Excel puede exportar en MAYÚSCULAS)
      const r: Record<string, unknown> = {};
      for (const k of Object.keys(rawR)) r[k.trim().toLowerCase()] = (rawR as any)[k];

      try {
        const empl = Number(r.empl_numero);
        const ano  = Number(r.lbl_ano);
        const mes  = Number(r.lbl_mes);
        const pla  = Number(r.lbl_pla);
        if (!empl || !ano || !mes || !pla) { errores++; continue; }

        if (!preview) {
          const result = await pool.query(
            `INSERT INTO historial_lib_sal
               (emp_nit, pla_numero, empl_numero, lbl_tpla, lbl_ano, lbl_mes, lbl_pla,
                lbl_dt, lbl_dsigss, lbl_dsemp, lbl_faltas, lbl_dvac,
                lbl_hrses, lbl_hrsed, lbl_hrst,
                lbl_tdev, lbl_tdes, lbl_liquido,
                lbl_bono14, lbl_aguinaldo, lbl_vacaciones, lbl_indem, lbl_ordinario,
                depto_codigo, lbl_dsep, lbl_dasu, lbl_dsigssa)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
             ON CONFLICT (empl_numero, lbl_ano, lbl_mes, lbl_pla)
             DO UPDATE SET
               emp_nit=$1, pla_numero=$2, lbl_tpla=$4,
               lbl_dt=$8, lbl_dsigss=$9, lbl_dsemp=$10, lbl_faltas=$11, lbl_dvac=$12,
               lbl_hrses=$13, lbl_hrsed=$14, lbl_hrst=$15,
               lbl_tdev=$16, lbl_tdes=$17, lbl_liquido=$18,
               lbl_bono14=$19, lbl_aguinaldo=$20, lbl_vacaciones=$21, lbl_indem=$22, lbl_ordinario=$23,
               depto_codigo=$24, lbl_dsep=$25, lbl_dasu=$26, lbl_dsigssa=$27,
               importado_at=NOW()
             RETURNING (xmax = 0) AS fue_insert`,
            [
              r.emp_nit ?? null, r.pla_numero ?? null, empl, r.lbl_tpla ?? "SAL",
              ano, mes, pla,
              Number(r.lbl_dt) || 0, Number(r.lbl_dsigss) || 0, Number(r.lbl_dsemp) || 0,
              Number(r.lbl_faltas) || 0, Number(r.lbl_dvac) || 0,
              Number(r.lbl_hrses) || 0, Number(r.lbl_hrsed) || 0, Number(r.lbl_hrst) || 0,
              Number(r.lbl_tdev) || 0, Number(r.lbl_tdes) || 0, Number(r.lbl_liquido) || 0,
              Number(r.lbl_bono14) || 0, Number(r.lbl_aguinaldo) || 0,
              Number(r.lbl_vacaciones) || 0, Number(r.lbl_indem) || 0, Number(r.lbl_ordinario) || 0,
              r.depto_codigo ?? null,
              Number(r.lbl_dsep) || 0, Number(r.lbl_dasu) || 0, Number(r.lbl_dsigssa) || 0,
            ]
          );
          if (result.rows[0]?.fue_insert) insertadas++; else actualizadas++;
        } else {
          insertadas++; // en preview contamos como válidas
        }
      } catch (rowErr: any) {
        errores++;
        errDetail.push(String(rowErr.message).slice(0, 80));
      }
    }

    res.json({
      preview,
      total: rows.length,
      insertadas,
      actualizadas,
      errores,
      errDetail: errDetail.slice(0, 10),
    });
  } catch (err) {
    logger.error({ err }, "POST /igss/importar-lib-sal error");
    res.status(500).json({ error: "Error al importar libro de salarios" });
  }
});

// ─── POST /igss/importar-devengados ──────────────────────────────────────────
// Recibe filas de dbo_DevPlaEmp: { empl_numero, dev_codigo, dev_monto, pla_numero }
// Mapeo: ORD→sueldo_base, BON→bonificacion_incentivo, BON1→bonificacion_1, OTROSING→bonificacion_2
igssRouter.post("/igss/importar-devengados", async (req, res) => {
  try {
    const { rows: filas, preview = false } = req.body as {
      rows: { empl_numero: number; dev_codigo: string; dev_monto: number; pla_numero: number }[];
      preview?: boolean;
    };
    if (!filas?.length) return res.status(400).json({ error: "Sin filas para importar" });

    // Agrupar por empleado y código
    const empMap: Record<number, Record<string, number>> = {};
    for (const f of filas) {
      if (!empMap[f.empl_numero]) empMap[f.empl_numero] = {};
      const prev = empMap[f.empl_numero][f.dev_codigo] ?? 0;
      empMap[f.empl_numero][f.dev_codigo] = Math.max(prev, f.dev_monto ?? 0);
    }

    const empNumeros = Object.keys(empMap).map(Number);

    if (preview) {
      const muestra = empNumeros.slice(0, 8).map((en) => {
        const m = empMap[en];
        return {
          empl_numero: en,
          sueldo_base:            m["ORD"]      ?? null,
          bonificacion_incentivo: m["BON"]      ?? null,
          bonificacion_1:         m["BON1"]     ?? null,
          bonificacion_2:         m["OTROSING"] ?? null,
        };
      });
      return res.json({ preview: true, total: empNumeros.length, muestra });
    }

    // Upsert por empl_numero
    let actualizados = 0;
    let sinVinculo   = 0;
    for (const en of empNumeros) {
      const m = empMap[en];
      const sueldo   = m["ORD"]      ?? null;
      const bonInc   = m["BON"]      ?? null;
      const bon1     = m["BON1"]     ?? null;
      const bon2     = m["OTROSING"] ?? null;

      const { rowCount } = await pool.query(`
        UPDATE employees SET
          sueldo_base            = COALESCE($2, sueldo_base),
          bonificacion_incentivo = COALESCE($3, bonificacion_incentivo),
          bonificacion_1         = COALESCE($4, bonificacion_1),
          bonificacion_2         = COALESCE($5, bonificacion_2),
          updated_at             = NOW()
        WHERE empl_numero = $1
      `, [en, sueldo, bonInc, bon1, bon2]);

      if ((rowCount ?? 0) > 0) actualizados++;
      else sinVinculo++;
    }

    res.json({ ok: true, actualizados, sinVinculo, total: empNumeros.length });
  } catch (err) {
    logger.error({ err }, "POST /igss/importar-devengados error");
    res.status(500).json({ error: "Error al importar devengados" });
  }
});

// ─── GET /igss/devengados/resumen ────────────────────────────────────────────
igssRouter.get("/igss/devengados/resumen", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)                                                      AS total_empleados,
        COUNT(*) FILTER (WHERE sueldo_base > 0)                       AS con_sueldo,
        COUNT(*) FILTER (WHERE bonificacion_incentivo IS NOT NULL)     AS con_bon_incentivo,
        COUNT(*) FILTER (WHERE bonificacion_1 IS NOT NULL)             AS con_bon1,
        COUNT(*) FILTER (WHERE bonificacion_2 IS NOT NULL)             AS con_bon2,
        ROUND(AVG(sueldo_base) FILTER (WHERE sueldo_base > 0), 2)     AS avg_sueldo
      FROM employees
    `);
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "GET /igss/devengados/resumen error");
    res.status(500).json({ error: "Error" });
  }
});

// ─── GET /igss/lib-sal/resumen ────────────────────────────────────────────────
igssRouter.get("/igss/lib-sal/resumen", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT lbl_ano, lbl_mes, lbl_pla,
             COUNT(*)          AS empleados,
             SUM(lbl_ordinario) AS total_ordinario,
             SUM(lbl_tdev)      AS total_devengado,
             SUM(lbl_liquido)   AS total_liquido
      FROM historial_lib_sal
      GROUP BY lbl_ano, lbl_mes, lbl_pla
      ORDER BY lbl_ano DESC, lbl_mes DESC, lbl_pla DESC
      LIMIT 50
    `);
    res.json({ periodos: rows });
  } catch (err) {
    logger.error({ err }, "GET /igss/lib-sal/resumen error");
    res.status(500).json({ error: "Error al consultar resumen" });
  }
});
