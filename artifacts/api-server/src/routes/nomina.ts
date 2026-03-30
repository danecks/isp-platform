/**
 * nomina.ts — Endpoints de novedades de nómina diarias
 *
 * ENDPOINTS:
 *   GET  /api/nomina/novedades          → Novedades de una fecha (con filtros)
 *   POST /api/nomina/novedades/generar  → Genera/regenera novedades desde cobertura_segmentos
 *   GET  /api/nomina/novedades/resumen  → Resumen por período (para pre-planilla)
 *
 * FLUJO:
 *   1. El pizarrón registra segmentos en cobertura_segmentos
 *   2. Al cerrar el día, se llama internamente a generarNovedades(fecha, cierreId)
 *   3. Las novedades quedan en novedades_nomina_diarias para uso de planilla
 */

import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { calcularJornadaEsperada } from "../lib/turno-calc";

export const nominaRouter = Router();

// ─── Helper: generar novedades para una fecha ────────────────────────────────
/**
 * Consolida cobertura_segmentos por empleado y genera registros en
 * novedades_nomina_diarias. Se puede llamar desde el cierre o manualmente.
 *
 * Lógica:
 *  - Por cada empleado en cobertura_segmentos(fecha): trabajo_dia=TRUE, suma horas
 *  - Por cada titular en puestos_operativos que tenga ausencia_sin_cubrir
 *    en cobertura_diaria(fecha): falta=TRUE, descuento=TRUE
 *  - Por cada ausencia por "suspension" en movimientos_operativos: suspension=TRUE
 */
export async function generarNovedades(fecha: string, cierreId: number | null): Promise<number> {
  let count = 0;

  try {
    // ── Paso 0: Limpiar faltas de agentes activamente asignados ─────────────
    // Si un agente está actualmente en un puesto activo O en un SSA con tarjeta_activa,
    // no puede tener falta=true aunque no tenga segmento para esta fecha.
    // Esto corrige registros stale de cierres anteriores.
    try {
      await pool.query(`
        UPDATE novedades_nomina_diarias n
        SET falta         = FALSE,
            descuento_dia = FALSE,
            updated_at    = NOW()
        WHERE n.fecha = $1
          AND n.falta = TRUE
          AND n.fuente != 'correccion_manual'
          AND (
            EXISTS (
              SELECT 1 FROM puestos_operativos po
              WHERE po.agente_id = n.employee_id
                AND po.activo = TRUE
            )
            OR
            EXISTS (
              SELECT 1 FROM solicitudes_servicio_adicional ssa
              WHERE ssa.agente_id = n.employee_id
                AND ssa.estado_general NOT IN ('cancelada', 'cerrada')
                AND ssa.tarjeta_activa = TRUE
            )
          )
      `, [fecha]);
    } catch (paso0Err) {
      logger.warn({ paso0Err, fecha }, "Paso 0 limpiar faltas activos: falló (no bloqueante)");
    }

    // 1. Empleados que cubrieron en segmentos
    const { rows: segmentos } = await pool.query(`
      SELECT
        cs.employee_id,
        cs.empleado_nombre,
        SUM(cs.horas_calculadas)                        AS horas_trabajadas,
        -- Usar horas_extra_calculadas cuando disponible (monto de exceso real);
        -- fallback a horas_calculadas completas para segmentos anteriores sin ese campo.
        SUM(CASE WHEN cs.genera_horas_extra
                 THEN COALESCE(cs.horas_extra_calculadas, cs.horas_calculadas)
                 ELSE 0 END)                            AS horas_extra,
        BOOL_OR(cs.fue_en_dia_descanso)                 AS descanso_trabajado,
        COUNT(DISTINCT cs.puesto_id)                    AS num_puestos_cubiertos,
        e.nombre_completo                               AS nombre_emp,
        -- puesto titular del empleado (su asignación base en puestos_operativos)
        (SELECT po2.id   FROM puestos_operativos po2 WHERE po2.titular_employee_id = cs.employee_id AND po2.activo = TRUE LIMIT 1) AS puesto_titular_id,
        (SELECT po2.nombre FROM puestos_operativos po2 WHERE po2.titular_employee_id = cs.employee_id AND po2.activo = TRUE LIMIT 1) AS puesto_titular_nombre,
        -- si es relevo, el puesto que cubrió (el primero del día)
        (SELECT cs2.puesto_id FROM cobertura_segmentos cs2 WHERE cs2.fecha = $1 AND cs2.employee_id = cs.employee_id AND cs2.tipo_cobertura = 'relevo' LIMIT 1) AS puesto_cubierto_id
      FROM cobertura_segmentos cs
      LEFT JOIN employees e ON e.id = cs.employee_id
      WHERE cs.fecha = $1
        AND cs.employee_id IS NOT NULL
      GROUP BY cs.employee_id, cs.empleado_nombre, e.nombre_completo
    `, [fecha]);

    for (const s of segmentos) {
      const nombreFinal = s.nombre_emp ?? s.empleado_nombre ?? "Desconocido";
      // Obtener nombre del puesto cubierto si aplica
      let puestoCubierto: string | null = null;
      if (s.puesto_cubierto_id) {
        const { rows: pc } = await pool.query(
          `SELECT nombre FROM puestos_operativos WHERE id = $1`, [s.puesto_cubierto_id]
        );
        puestoCubierto = pc[0]?.nombre ?? null;
      }

      await pool.query(`
        INSERT INTO novedades_nomina_diarias
          (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
           falta, suspension, descanso_trabajado, afecta_septimo, descuento_dia,
           puesto_titular_id, puesto_titular_nombre, puesto_cubierto_id, puesto_cubierto_nombre,
           num_puestos_cubiertos, fuente, cierre_id, updated_at)
        VALUES ($1,$2,$3,TRUE,$4,$5, FALSE,FALSE,$6,FALSE,FALSE, $7,$8,$9,$10,$11,'cierre_operativo',$12,NOW())
        ON CONFLICT (fecha, employee_id)
        DO UPDATE SET
          trabajo_dia           = TRUE,
          horas_trabajadas      = EXCLUDED.horas_trabajadas,
          horas_extra           = EXCLUDED.horas_extra,
          falta                 = FALSE,
          descanso_trabajado    = EXCLUDED.descanso_trabajado,
          puesto_titular_id     = EXCLUDED.puesto_titular_id,
          puesto_titular_nombre = EXCLUDED.puesto_titular_nombre,
          puesto_cubierto_id    = EXCLUDED.puesto_cubierto_id,
          puesto_cubierto_nombre= EXCLUDED.puesto_cubierto_nombre,
          num_puestos_cubiertos = EXCLUDED.num_puestos_cubiertos,
          cierre_id             = EXCLUDED.cierre_id,
          updated_at            = NOW()
      `, [
        fecha, s.employee_id, nombreFinal,
        parseFloat(s.horas_trabajadas ?? 0).toFixed(2),
        parseFloat(s.horas_extra ?? 0).toFixed(2),
        s.descanso_trabajado ?? false,
        s.puesto_titular_id ?? null, s.puesto_titular_nombre ?? null,
        s.puesto_cubierto_id ?? null, puestoCubierto,
        parseInt(s.num_puestos_cubiertos ?? 0),
        cierreId,
      ]);
      count++;
    }

    // 2. Titulares con ausencia_sin_cubrir en cobertura_diaria (faltaron sin relevo)
    const { rows: ausencias } = await pool.query(`
      SELECT cd.titular_employee_id AS employee_id,
             cd.titular_nombre      AS empleado_nombre,
             cd.puesto_id           AS puesto_titular_id,
             cd.puesto_nombre       AS puesto_titular_nombre
      FROM cobertura_diaria cd
      WHERE cd.fecha = $1
        AND cd.tipo_cobertura = 'ausencia_sin_cubrir'
        AND cd.titular_employee_id IS NOT NULL
    `, [fecha]);

    for (const a of ausencias) {
      await pool.query(`
        INSERT INTO novedades_nomina_diarias
          (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
           falta, suspension, descanso_trabajado, afecta_septimo, descuento_dia,
           puesto_titular_id, puesto_titular_nombre, fuente, cierre_id, updated_at)
        VALUES ($1,$2,$3,FALSE,0,0, TRUE,FALSE,FALSE,TRUE,TRUE, $4,$5,'cierre_operativo',$6,NOW())
        ON CONFLICT (fecha, employee_id)
        DO UPDATE SET
          trabajo_dia           = FALSE,
          falta                 = TRUE,
          afecta_septimo        = TRUE,
          descuento_dia         = TRUE,
          puesto_titular_id     = EXCLUDED.puesto_titular_id,
          puesto_titular_nombre = EXCLUDED.puesto_titular_nombre,
          cierre_id             = EXCLUDED.cierre_id,
          updated_at            = NOW()
        WHERE novedades_nomina_diarias.trabajo_dia = FALSE
      `, [fecha, a.employee_id, a.empleado_nombre ?? "Desconocido",
          a.puesto_titular_id ?? null, a.puesto_titular_nombre ?? null, cierreId]);
      count++;
    }

    // Fix P-NOM-04: Titulares con puesto activo pero SIN ningún segmento ese día
    // (complementa la detección de ausencia_sin_cubrir en cobertura_diaria)
    // GUARD: no marcar falta si el titular tiene asignación activa en puesto o SSA
    // (evita faltas prematuras cuando la auto-auditoría corre antes de que se registren segmentos)
    const { rows: titularesSinPresencia } = await pool.query(`
      SELECT po.titular_employee_id AS employee_id,
             e.nombre_completo      AS empleado_nombre,
             po.id                  AS puesto_titular_id,
             po.nombre              AS puesto_titular_nombre
      FROM puestos_operativos po
      JOIN employees e ON e.id = po.titular_employee_id
      WHERE po.activo = TRUE
        AND po.titular_employee_id IS NOT NULL
        -- Sin segmento registrado para ese día
        AND NOT EXISTS (
          SELECT 1 FROM cobertura_segmentos cs
          WHERE cs.fecha = $1
            AND cs.employee_id = po.titular_employee_id
        )
        -- GUARD: no marcar si el agente está activamente cubriendo algún puesto ahora
        AND NOT EXISTS (
          SELECT 1 FROM puestos_operativos po2
          WHERE po2.agente_id = po.titular_employee_id
            AND po2.activo = TRUE
        )
        -- GUARD: no marcar si el agente está en un SSA activo con tarjeta activa
        AND NOT EXISTS (
          SELECT 1 FROM solicitudes_servicio_adicional ssa
          WHERE ssa.agente_id = po.titular_employee_id
            AND ssa.estado_general NOT IN ('cancelada', 'cerrada')
            AND ssa.tarjeta_activa = TRUE
        )
    `, [fecha]);

    for (const t of titularesSinPresencia) {
      await pool.query(`
        INSERT INTO novedades_nomina_diarias
          (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
           falta, suspension, descanso_trabajado, afecta_septimo, descuento_dia,
           puesto_titular_id, puesto_titular_nombre, fuente, cierre_id, updated_at)
        VALUES ($1,$2,$3,FALSE,0,0, TRUE,FALSE,FALSE,TRUE,TRUE, $4,$5,'auto_auditoria',$6,NOW())
        ON CONFLICT (fecha, employee_id)
        DO UPDATE SET
          falta                 = TRUE,
          afecta_septimo        = TRUE,
          descuento_dia         = TRUE,
          puesto_titular_id     = EXCLUDED.puesto_titular_id,
          puesto_titular_nombre = EXCLUDED.puesto_titular_nombre,
          cierre_id             = COALESCE(novedades_nomina_diarias.cierre_id, EXCLUDED.cierre_id),
          updated_at            = NOW()
        WHERE novedades_nomina_diarias.trabajo_dia = FALSE
      `, [fecha, t.employee_id, t.empleado_nombre ?? "Desconocido",
          t.puesto_titular_id ?? null, t.puesto_titular_nombre ?? null, cierreId]);
      count++;
    }

    // 3. Suspensiones desde movimientos_operativos (texto) + eventos_rrhh (Fix P-NOM-05)
    const { rows: suspensiones } = await pool.query(`
      SELECT mo.agente_saliente_id    AS employee_id,
             mo.agente_saliente_nombre AS empleado_nombre
      FROM movimientos_operativos mo
      WHERE DATE(mo.fecha_hora AT TIME ZONE 'America/Guatemala') = $1::date
        AND mo.tipo = 'liberacion'
        AND mo.motivo ILIKE '%suspens%'
        AND mo.agente_saliente_id IS NOT NULL
    `, [fecha]);

    for (const s of suspensiones) {
      await pool.query(`
        INSERT INTO novedades_nomina_diarias
          (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
           falta, suspension, descanso_trabajado, afecta_septimo, descuento_dia,
           fuente, cierre_id, updated_at)
        VALUES ($1,$2,$3,FALSE,0,0, FALSE,TRUE,FALSE,TRUE,TRUE, 'cierre_operativo',$4,NOW())
        ON CONFLICT (fecha, employee_id)
        DO UPDATE SET
          suspension   = TRUE,
          afecta_septimo = TRUE,
          descuento_dia  = TRUE,
          cierre_id      = EXCLUDED.cierre_id,
          updated_at     = NOW()
        WHERE novedades_nomina_diarias.trabajo_dia = FALSE
      `, [fecha, s.employee_id, s.empleado_nombre ?? "Desconocido", cierreId]);
    }

    // Fix P-NOM-05: Suspensiones desde eventos_rrhh (fuente oficial de RRHH)
    const { rows: eventosSupension } = await pool.query(`
      SELECT er.employee_id,
             er.employee_nombre AS empleado_nombre,
             er.id              AS evento_id
      FROM eventos_rrhh er
      WHERE DATE(er.fecha AT TIME ZONE 'America/Guatemala') = $1::date
        AND er.tipo_evento ILIKE '%suspens%'
        AND er.employee_id IS NOT NULL
        AND er.estado NOT IN ('anulado')
    `, [fecha]);

    for (const ev of eventosSupension) {
      await pool.query(`
        INSERT INTO novedades_nomina_diarias
          (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
           falta, suspension, descanso_trabajado, afecta_septimo, descuento_dia,
           fuente, cierre_id, updated_at)
        VALUES ($1,$2,$3,FALSE,0,0, FALSE,TRUE,FALSE,TRUE,TRUE, 'eventos_rrhh',$4,NOW())
        ON CONFLICT (fecha, employee_id)
        DO UPDATE SET
          suspension     = TRUE,
          afecta_septimo = TRUE,
          descuento_dia  = TRUE,
          fuente         = CASE
                             WHEN novedades_nomina_diarias.fuente = 'cierre_operativo'
                             THEN 'cierre_operativo'
                             ELSE 'eventos_rrhh'
                           END,
          cierre_id      = EXCLUDED.cierre_id,
          updated_at     = NOW()
        WHERE novedades_nomina_diarias.trabajo_dia = FALSE
      `, [fecha, ev.employee_id, ev.empleado_nombre ?? "Desconocido", cierreId]);

      // Marcar el evento como procesado en nómina
      await pool.query(`
        UPDATE eventos_rrhh SET estado = 'procesado', updated_at = NOW()
        WHERE id = $1 AND estado NOT IN ('anulado', 'procesado')
      `, [ev.evento_id]);
    }

    // ── Paso 5: Enriquecer novedades con datos de turno (tipo_turno_id) ────────
    // Para cada novedad del día, si el puesto_titular tiene tipo_turno_id configurado,
    // calcula trabajo_esperado y horas_esperadas y los guarda en la novedad.
    try {
      const { rows: novedadesHoy } = await pool.query(`
        SELECT n.id, n.employee_id, n.puesto_titular_id,
               po.tipo_turno_id, po.fecha_inicio_ciclo,
               e.dia_descanso,
               t.horas_trabajo, t.horas_descanso,
               (t.horas_trabajo + t.horas_descanso) AS ciclo_horas,
               t.nombre AS turno_nombre
        FROM novedades_nomina_diarias n
        LEFT JOIN puestos_operativos po ON po.id = n.puesto_titular_id
        LEFT JOIN employees e ON e.id = n.employee_id
        LEFT JOIN turnos t ON t.id = po.tipo_turno_id
        WHERE n.fecha = $1
          AND po.tipo_turno_id IS NOT NULL
      `, [fecha]);

      for (const nv of novedadesHoy) {
        const turno = {
          id: nv.tipo_turno_id,
          nombre: nv.turno_nombre,
          horas_trabajo: parseFloat(nv.horas_trabajo ?? 0),
          horas_descanso: parseFloat(nv.horas_descanso ?? 0),
          ciclo_horas: parseFloat(nv.ciclo_horas ?? nv.horas_trabajo ?? 0),
        };
        const { trabajaEseDia, horasEsperadas } = calcularJornadaEsperada(
          turno,
          nv.fecha_inicio_ciclo ? String(nv.fecha_inicio_ciclo).slice(0, 10) : null,
          fecha,
          nv.dia_descanso ?? null,
        );
        await pool.query(`
          UPDATE novedades_nomina_diarias SET
            tipo_turno_id    = $1,
            trabajo_esperado = $2,
            horas_esperadas  = $3,
            updated_at       = NOW()
          WHERE id = $4
        `, [nv.tipo_turno_id, trabajaEseDia, horasEsperadas.toFixed(2), nv.id]);
      }

      if (novedadesHoy.length > 0) {
        logger.info({ fecha, n: novedadesHoy.length }, "Turno calculado para novedades del día");
      }
    } catch (turnoErr) {
      // No bloquear si falla el enriquecimiento de turno
      logger.warn({ turnoErr, fecha }, "Turno enrichment falló (no bloqueante)");
    }

    // ── Paso 6: Regla de consistencia lógica obligatoria ────────────────────
    // Si trabajo_dia=TRUE → falta debe ser FALSE (no puede trabajar y estar ausente)
    // Si horas_trabajadas>0 → falta=FALSE, descuento_dia=FALSE
    // Esto corrige cualquier inconsistencia que pudiera quedar de pasos anteriores.
    try {
      await pool.query(`
        UPDATE novedades_nomina_diarias
        SET falta        = FALSE,
            descuento_dia = FALSE,
            updated_at    = NOW()
        WHERE fecha = $1
          AND trabajo_dia = TRUE
          AND falta = TRUE
      `, [fecha]);

      await pool.query(`
        UPDATE novedades_nomina_diarias
        SET trabajo_dia       = FALSE,
            horas_trabajadas  = 0,
            horas_extra       = 0,
            updated_at        = NOW()
        WHERE fecha = $1
          AND falta = TRUE
          AND horas_trabajadas > 0
          AND fuente != 'correccion_manual'
      `, [fecha]);
    } catch (consistErr) {
      logger.warn({ consistErr, fecha }, "Paso 6 consistencia lógica: falló (no bloqueante)");
    }

    logger.info({ fecha, count }, "Novedades de nómina generadas");
  } catch (err) {
    logger.error({ err, fecha }, "Error generando novedades de nómina");
  }

  return count;
}

// ─── GET /api/nomina/novedades ────────────────────────────────────────────────
// Novedades diarias por fecha o rango, con filtro por empleado
nominaRouter.get("/nomina/novedades", async (req, res) => {
  try {
    const fecha      = req.query.fecha      as string | undefined;
    const desde      = req.query.desde      as string | undefined;
    const hasta      = req.query.hasta      as string | undefined;
    const employeeId = req.query.employeeId as string | undefined;

    const clauses: string[] = [];
    const params: unknown[]  = [];

    if (fecha) {
      params.push(fecha);
      clauses.push(`n.fecha = $${params.length}`);
    } else if (desde || hasta) {
      const d = desde || hasta!;
      const h = hasta  || desde!;
      params.push(d, h);
      clauses.push(`n.fecha BETWEEN $${params.length - 1} AND $${params.length}`);
    } else {
      params.push(new Date().toISOString().split("T")[0]);
      clauses.push(`n.fecha = $${params.length}`);
    }

    if (employeeId) {
      params.push(Number(employeeId));
      clauses.push(`n.employee_id = $${params.length}`);
    }

    const { rows } = await pool.query(`
      SELECT n.*,
             e.nombre_completo AS nombre_empleado_join,
             e.puesto          AS puesto_empleado,
             e.area            AS area_empleado
      FROM novedades_nomina_diarias n
      LEFT JOIN employees e ON e.id = n.employee_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY n.fecha DESC, n.empleado_nombre
    `, params);

    // Resumen agregado
    const resumen = {
      total:              rows.length,
      trabajaron:         rows.filter((r: any) => r.trabajo_dia).length,
      faltas:             rows.filter((r: any) => r.falta).length,
      suspensiones:       rows.filter((r: any) => r.suspension).length,
      descansosTrabajos:  rows.filter((r: any) => r.descanso_trabajado).length,
      totalHoras:         rows.reduce((s: number, r: any) => s + parseFloat(r.horas_trabajadas ?? 0), 0).toFixed(2),
      totalHorasExtra:    rows.reduce((s: number, r: any) => s + parseFloat(r.horas_extra ?? 0), 0).toFixed(2),
      afectanSeptimo:     rows.filter((r: any) => r.afecta_septimo).length,
    };

    res.json({ novedades: rows, resumen });
  } catch (err) {
    logger.error({ err }, "GET /nomina/novedades error");
    res.status(500).json({ error: "Error al cargar novedades de nómina" });
  }
});

// ─── POST /api/nomina/novedades/generar ──────────────────────────────────────
// Genera o regenera manualmente las novedades para una fecha
nominaRouter.post("/nomina/novedades/generar", async (req, res) => {
  const { fecha, usuarioRol } = req.body;
  if (!fecha) return res.status(400).json({ error: "fecha es requerida" });
  if (!["admin", "supervisor"].includes(usuarioRol ?? "")) {
    return res.status(403).json({ error: "Solo supervisores y admin pueden generar novedades" });
  }

  try {
    const count = await generarNovedades(fecha, null);
    res.json({ ok: true, generadas: count, fecha });
  } catch (err) {
    logger.error({ err }, "POST /nomina/novedades/generar error");
    res.status(500).json({ error: "Error al generar novedades" });
  }
});

// ─── PUT /api/nomina/novedades/:id ───────────────────────────────────────────
// Editar manualmente una novedad antes de enviar a planilla
nominaRouter.put("/nomina/novedades/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id || isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const {
    trabajo_dia, horas_trabajadas, horas_extra,
    falta, suspension, descanso_trabajado,
    afecta_septimo, descuento_dia, observaciones,
  } = req.body;

  try {
    const { rows } = await pool.query(`
      UPDATE novedades_nomina_diarias
      SET trabajo_dia        = COALESCE($1, trabajo_dia),
          horas_trabajadas   = COALESCE($2, horas_trabajadas),
          horas_extra        = COALESCE($3, horas_extra),
          falta              = COALESCE($4, falta),
          suspension         = COALESCE($5, suspension),
          descanso_trabajado = COALESCE($6, descanso_trabajado),
          afecta_septimo     = COALESCE($7, afecta_septimo),
          descuento_dia      = COALESCE($8, descuento_dia),
          observaciones      = COALESCE($9, observaciones),
          fuente             = 'correccion_manual',
          updated_at         = NOW()
      WHERE id = $10
      RETURNING *
    `, [
      trabajo_dia   ?? null,
      horas_trabajadas  != null ? Number(horas_trabajadas)  : null,
      horas_extra       != null ? Number(horas_extra)       : null,
      falta         ?? null,
      suspension    ?? null,
      descanso_trabajado ?? null,
      afecta_septimo ?? null,
      descuento_dia  ?? null,
      observaciones  ?? null,
      id,
    ]);

    if (!rows.length) return res.status(404).json({ error: "Novedad no encontrada" });
    res.json({ ok: true, novedad: rows[0] });
  } catch (err) {
    logger.error({ err }, "PUT /nomina/novedades/:id error");
    res.status(500).json({ error: "Error al actualizar novedad" });
  }
});

// ─── GET /api/nomina/novedades/resumen-periodo ────────────────────────────────
// Resumen consolidado por período para pre-planilla
nominaRouter.get("/nomina/novedades/resumen-periodo", async (req, res) => {
  try {
    const desde = (req.query.desde as string) || new Date().toISOString().split("T")[0];
    const hasta = (req.query.hasta as string) || desde;

    const { rows } = await pool.query(`
      SELECT
        n.employee_id,
        n.empleado_nombre,
        e.nombre_completo               AS nombre_empleado_join,
        COUNT(*)                        AS dias_periodo,
        SUM(CASE WHEN n.trabajo_dia THEN 1 ELSE 0 END) AS dias_trabajados,
        SUM(CASE WHEN n.falta       THEN 1 ELSE 0 END) AS dias_falta,
        SUM(CASE WHEN n.suspension  THEN 1 ELSE 0 END) AS dias_suspension,
        SUM(CASE WHEN n.descanso_trabajado THEN 1 ELSE 0 END) AS dias_descanso_trabajado,
        SUM(CASE WHEN n.afecta_septimo    THEN 1 ELSE 0 END) AS dias_afectan_septimo,
        SUM(n.horas_trabajadas)         AS total_horas,
        SUM(n.horas_extra)              AS total_horas_extra
      FROM novedades_nomina_diarias n
      LEFT JOIN employees e ON e.id = n.employee_id
      WHERE n.fecha BETWEEN $1 AND $2
      GROUP BY n.employee_id, n.empleado_nombre, e.nombre_completo
      ORDER BY n.empleado_nombre
    `, [desde, hasta]);

    res.json({ desde, hasta, empleados: rows });
  } catch (err) {
    logger.error({ err }, "GET /nomina/novedades/resumen-periodo error");
    res.status(500).json({ error: "Error al generar resumen de período" });
  }
});
