import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

export const actasRouter = Router();

// ─── GET /api/config-empresa ─────────────────────────────────────────────────
actasRouter.get("/config-empresa", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ce.*,
             e.nombre_completo AS representante_nombre,
             e.dpi             AS representante_dpi
      FROM config_empresa ce
      LEFT JOIN employees e ON e.id = ce.representante_legal_id
      WHERE ce.id = 1
    `);
    if (!rows[0]) return res.status(404).json({ error: "Config no encontrada" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "GET /config-empresa error");
    res.status(500).json({ error: "Error obteniendo configuración" });
  }
});

// ─── PUT /api/config-empresa ─────────────────────────────────────────────────
actasRouter.put("/config-empresa", async (req, res) => {
  const {
    representante_legal_id,
    direccion_empresa,
    nombre_empresa,
    umbral_dias_consecutivos,
    umbral_medios_turnos_mes,
  } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE config_empresa SET
         representante_legal_id   = COALESCE($1, representante_legal_id),
         direccion_empresa        = COALESCE($2, direccion_empresa),
         nombre_empresa           = COALESCE($3, nombre_empresa),
         umbral_dias_consecutivos = COALESCE($4, umbral_dias_consecutivos),
         umbral_medios_turnos_mes = COALESCE($5, umbral_medios_turnos_mes),
         updated_at = NOW()
       WHERE id = 1
       RETURNING *`,
      [
        representante_legal_id ?? null,
        direccion_empresa ?? null,
        nombre_empresa ?? null,
        umbral_dias_consecutivos ?? null,
        umbral_medios_turnos_mes ?? null,
      ]
    );
    res.json({ ok: true, config: rows[0] });
  } catch (err) {
    logger.error({ err }, "PUT /config-empresa error");
    res.status(500).json({ error: "Error actualizando configuración" });
  }
});

// ─── POST /api/actas/siguiente-numero ────────────────────────────────────────
actasRouter.post("/actas/siguiente-numero", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE config_empresa SET acta_correlativo = acta_correlativo + 1, updated_at = NOW()
       WHERE id = 1
       RETURNING acta_correlativo`
    );
    res.json({ numero: rows[0].acta_correlativo });
  } catch (err) {
    logger.error({ err }, "POST /actas/siguiente-numero error");
    res.status(500).json({ error: "Error generando número de acta" });
  }
});

// ─── GET /api/empleados/:id/historial-disciplinario ──────────────────────────
actasRouter.get("/empleados/:id/historial-disciplinario", async (req, res) => {
  const empId = Number(req.params.id);
  try {
    const { rows: faltas } = await pool.query(
      `SELECT fecha, tipo_evento, observaciones, notas, estado
       FROM eventos_rrhh
       WHERE employee_id = $1
         AND tipo_evento IN ('falta','falta_injustificada','suspension','suspension_disciplinaria',
                             'llamada_atencion_1','llamada_atencion_2','acta_administrativa',
                             'amonestacion','abandono_parcial')
         AND estado NOT IN ('anulado')
       ORDER BY fecha DESC
       LIMIT 100`,
      [empId]
    );

    const { rows: novedades } = await pool.query(
      `SELECT fecha, falta, suspension, observaciones, tipo_novedad
       FROM novedades_nomina_diarias
       WHERE employee_id = $1 AND (falta = TRUE OR suspension = TRUE)
       ORDER BY fecha DESC
       LIMIT 100`,
      [empId]
    );

    res.json({ faltas, novedades, total_faltas: faltas.length, total_novedades: novedades.length });
  } catch (err) {
    logger.error({ err }, "GET /empleados/:id/historial-disciplinario error");
    res.status(500).json({ error: "Error obteniendo historial" });
  }
});

// ─── GET /api/empleados/:id/evaluar-causa-justa ──────────────────────────────
actasRouter.get("/empleados/:id/evaluar-causa-justa", async (req, res) => {
  const empId = Number(req.params.id);
  try {
    const { rows: configRows } = await pool.query(
      `SELECT umbral_dias_consecutivos, umbral_medios_turnos_mes FROM config_empresa WHERE id = 1`
    );
    const config = configRows[0] || { umbral_dias_consecutivos: 2, umbral_medios_turnos_mes: 6 };

    const { rows: faltasRecientes } = await pool.query(
      `SELECT fecha::date AS fecha, observaciones, notas, tipo_novedad
       FROM novedades_nomina_diarias
       WHERE employee_id = $1 AND falta = TRUE
       ORDER BY fecha DESC
       LIMIT 60`,
      [empId]
    );

    const { rows: eventosRecientes } = await pool.query(
      `SELECT fecha::date AS fecha, tipo_evento, observaciones, notas
       FROM eventos_rrhh
       WHERE employee_id = $1
         AND estado NOT IN ('anulado','rechazado')
       ORDER BY fecha DESC
       LIMIT 100`,
      [empId]
    );

    const causas: Array<{ causal: string; articulo: string; descripcion: string; evidencia: string[] }> = [];

    // 1. Evaluar días consecutivos de inasistencia
    if (faltasRecientes.length >= config.umbral_dias_consecutivos) {
      const fechas = faltasRecientes.map((f: any) => new Date(f.fecha).getTime()).sort((a: number, b: number) => b - a);
      let maxConsecutivos = 1;
      let currentStreak = 1;
      const streakDates: string[] = [new Date(fechas[0]).toISOString().split("T")[0]];

      for (let i = 1; i < fechas.length; i++) {
        const diffDays = (fechas[i - 1] - fechas[i]) / (1000 * 60 * 60 * 24);
        if (diffDays === 1) {
          currentStreak++;
          streakDates.push(new Date(fechas[i]).toISOString().split("T")[0]);
          if (currentStreak > maxConsecutivos) maxConsecutivos = currentStreak;
        } else {
          currentStreak = 1;
        }
      }

      if (maxConsecutivos >= config.umbral_dias_consecutivos) {
        causas.push({
          causal: "abandono_labores",
          articulo: "Art. 77 inciso f) del Código de Trabajo",
          descripcion: `${maxConsecutivos} días consecutivos de inasistencia sin justificación`,
          evidencia: streakDates.slice(0, maxConsecutivos),
        });
      }
    }

    // 2. Evaluar medios turnos / faltas en el mes actual
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split("T")[0];
    const faltasMes = faltasRecientes.filter((f: any) => {
      const fechaStr = new Date(f.fecha).toISOString().split("T")[0];
      return fechaStr >= inicioMes;
    });

    if (faltasMes.length >= config.umbral_medios_turnos_mes) {
      causas.push({
        causal: "faltas_reiteradas",
        articulo: "Art. 77 inciso f) del Código de Trabajo",
        descripcion: `${faltasMes.length} faltas/medios turnos en el mes actual (umbral: ${config.umbral_medios_turnos_mes})`,
        evidencia: faltasMes.map((f: any) => new Date(f.fecha).toISOString().split("T")[0]),
      });
    }

    // 3. Buscar notas con alcohol/drogas
    const allNotes = [
      ...faltasRecientes.map((f: any) => ({ fecha: f.fecha, texto: f.observaciones || f.notas || "" })),
      ...eventosRecientes.map((e: any) => ({ fecha: e.fecha, texto: e.observaciones || e.notas || "" })),
    ];
    const alcoholRegex = /alcohol|ebri|borracho|drogas|estupefaciente|intoxicad|bajo.*(efecto|influencia)/i;
    const notasAlcohol = allNotes.filter(n => alcoholRegex.test(n.texto));
    if (notasAlcohol.length > 0) {
      causas.push({
        causal: "ebriedad_drogas",
        articulo: "Art. 77 inciso d) del Código de Trabajo",
        descripcion: "Presentarse bajo efectos de alcohol o sustancias",
        evidencia: notasAlcohol.map(n => `${new Date(n.fecha).toISOString().split("T")[0]}: ${n.texto.substring(0, 120)}`),
      });
    }

    // 4. Buscar violencia / malos tratos
    const violenciaRegex = /violen|agres|golpe|insulto|amenaz|pelea|altercado|malos tratos/i;
    const notasViolencia = allNotes.filter(n => violenciaRegex.test(n.texto));
    if (notasViolencia.length > 0) {
      causas.push({
        causal: "violencia",
        articulo: "Art. 77 inciso c) del Código de Trabajo",
        descripcion: "Violencia o malos tratos en el trabajo",
        evidencia: notasViolencia.map(n => `${new Date(n.fecha).toISOString().split("T")[0]}: ${n.texto.substring(0, 120)}`),
      });
    }

    // 5. Buscar robo / deshonestidad
    const roboRegex = /robo|hurto|sustra|fraude|deshonest|probidad/i;
    const notasRobo = allNotes.filter(n => roboRegex.test(n.texto));
    if (notasRobo.length > 0) {
      causas.push({
        causal: "probidad",
        articulo: "Art. 77 inciso a) del Código de Trabajo",
        descripcion: "Falta de probidad o conducta indebida",
        evidencia: notasRobo.map(n => `${new Date(n.fecha).toISOString().split("T")[0]}: ${n.texto.substring(0, 120)}`),
      });
    }

    // 6. Buscar negligencia / abandono de puesto
    const negligenciaRegex = /negligen|abandon.*puesto|descuid|dorm/i;
    const notasNegligencia = allNotes.filter(n => negligenciaRegex.test(n.texto));
    if (notasNegligencia.length > 0) {
      causas.push({
        causal: "negligencia",
        articulo: "Art. 77 inciso e) del Código de Trabajo",
        descripcion: "Negligencia grave en el desempeño de funciones",
        evidencia: notasNegligencia.map(n => `${new Date(n.fecha).toISOString().split("T")[0]}: ${n.texto.substring(0, 120)}`),
      });
    }

    // 7. Buscar desobediencia
    const desobedienciaRegex = /desobedien|indisciplin|negarse|incumpl.*orden/i;
    const notasDesob = allNotes.filter(n => desobedienciaRegex.test(n.texto));
    if (notasDesob.length > 0) {
      causas.push({
        causal: "indisciplina",
        articulo: "Art. 77 inciso b) del Código de Trabajo",
        descripcion: "Indisciplina o desobediencia",
        evidencia: notasDesob.map(n => `${new Date(n.fecha).toISOString().split("T")[0]}: ${n.texto.substring(0, 120)}`),
      });
    }

    const sugerencia = causas.length > 0 ? "despido_justificado" : "despido_injustificado";

    // Total de llamadas de atención
    const llamadas1 = eventosRecientes.filter((e: any) => e.tipo_evento === "llamada_atencion_1").length;
    const llamadas2 = eventosRecientes.filter((e: any) => e.tipo_evento === "llamada_atencion_2").length;
    const actasPrevias = eventosRecientes.filter((e: any) => e.tipo_evento === "acta_administrativa").length;

    res.json({
      sugerencia,
      causas,
      resumen: {
        total_faltas: faltasRecientes.length,
        faltas_mes_actual: faltasMes.length,
        llamadas_atencion_1: llamadas1,
        llamadas_atencion_2: llamadas2,
        actas_previas: actasPrevias,
        total_eventos: eventosRecientes.length,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /empleados/:id/evaluar-causa-justa error");
    res.status(500).json({ error: "Error evaluando causa justa" });
  }
});

// ─── GET /api/actas/datos-para-pdf/:employeeId ──────────────────────────────
actasRouter.get("/actas/datos-para-pdf/:employeeId", async (req, res) => {
  const empId = Number(req.params.employeeId);
  try {
    const { rows: configRows } = await pool.query(`
      SELECT ce.*,
             e.nombre_completo AS representante_nombre,
             e.dpi             AS representante_dpi
      FROM config_empresa ce
      LEFT JOIN employees e ON e.id = ce.representante_legal_id
      WHERE ce.id = 1
    `);
    const config = configRows[0];

    const { rows: empRows } = await pool.query(
      `SELECT id, nombre_completo, dpi, fecha_ingreso, cargo, tipo_personal
       FROM employees WHERE id = $1`,
      [empId]
    );
    if (!empRows[0]) return res.status(404).json({ error: "Empleado no encontrado" });

    const { rows: puestoRows } = await pool.query(
      `SELECT po.nombre AS puesto_nombre, c.nombre AS cliente_nombre
       FROM puestos_operativos po
       LEFT JOIN clients c ON c.id = po.client_id
       WHERE po.titular_employee_id = $1 AND po.activo = TRUE
       LIMIT 1`,
      [empId]
    );

    const { rows: eventos } = await pool.query(
      `SELECT fecha::date AS fecha, tipo_evento, observaciones, notas
       FROM eventos_rrhh
       WHERE employee_id = $1 AND estado NOT IN ('anulado')
       ORDER BY fecha DESC
       LIMIT 50`,
      [empId]
    );

    res.json({
      config,
      empleado: empRows[0],
      puesto: puestoRows[0] || null,
      eventos_recientes: eventos,
    });
  } catch (err) {
    logger.error({ err }, "GET /actas/datos-para-pdf error");
    res.status(500).json({ error: "Error obteniendo datos para acta" });
  }
});
