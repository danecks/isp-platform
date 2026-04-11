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
import { pool, todayGT } from "@workspace/db";
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
// Tipos de evento RRHH que implican ausencia del empleado
const TIPOS_AUSENCIA_RRHH = [
  "permiso_sin_goce", "permiso_con_goce", "vacaciones", "relevo_vacaciones",
  "incapacidad", "suspension", "permiso", "descanso",
];
// Tipos de ausencia que NO generan falta ni descuento (solo ausencia justificada)
const TIPOS_RRHH_SIN_DESCUENTO = [
  "vacaciones", "relevo_vacaciones", "incapacidad", "permiso_con_goce", "permiso", "descanso",
];

export async function generarNovedades(fecha: string, cierreId: number | null): Promise<number> {
  let count = 0;

  try {
    // ── Paso RRHH: Cargar todos los eventos de ausencia aplicables para la fecha ──
    // Fuente de verdad de RRHH: si un empleado tiene evento de ausencia ese día,
    // NO debe recibir novedad de trabajo aunque aparezca en cobertura_segmentos.
    let eventosRRHHMap = new Map<number, string>(); // employeeId → tipo_evento
    try {
      const { rows: eventosRRHH } = await pool.query(`
        SELECT er.employee_id, er.tipo_evento
        FROM eventos_rrhh er
        WHERE $1::date BETWEEN er.fecha::date
              AND COALESCE(er.fecha_fin::date, er.fecha::date)
          AND er.tipo_evento = ANY($2::text[])
          AND er.estado NOT IN ('anulado', 'cancelado')
          AND er.employee_id IS NOT NULL
      `, [fecha, TIPOS_AUSENCIA_RRHH]);

      for (const ev of eventosRRHH) {
        eventosRRHHMap.set(Number(ev.employee_id), ev.tipo_evento);
      }
      logger.info({ fecha, totalEventosRRHH: eventosRRHHMap.size }, "Paso RRHH: eventos de ausencia cargados");
    } catch (rrhhErr) {
      logger.warn({ rrhhErr, fecha }, "Paso RRHH: falló carga de eventos (no bloqueante)");
    }

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
        -- TH: puesto titular del empleado en esa fecha (histórico con fallback a actual)
        COALESCE(
          (SELECT pth.puesto_id FROM puesto_titular_historico pth
           WHERE pth.employee_id = cs.employee_id
             AND pth.fecha_inicio <= $1::date
             AND (pth.fecha_fin IS NULL OR pth.fecha_fin >= $1::date)
           ORDER BY pth.fecha_inicio DESC LIMIT 1),
          (SELECT po2.id FROM puestos_operativos po2 WHERE po2.titular_employee_id = cs.employee_id AND po2.activo = TRUE LIMIT 1)
        ) AS puesto_titular_id,
        (SELECT po3.nombre FROM puestos_operativos po3 WHERE po3.id = COALESCE(
          (SELECT pth.puesto_id FROM puesto_titular_historico pth
           WHERE pth.employee_id = cs.employee_id
             AND pth.fecha_inicio <= $1::date
             AND (pth.fecha_fin IS NULL OR pth.fecha_fin >= $1::date)
           ORDER BY pth.fecha_inicio DESC LIMIT 1),
          (SELECT po2.id FROM puestos_operativos po2 WHERE po2.titular_employee_id = cs.employee_id AND po2.activo = TRUE LIMIT 1)
        )) AS puesto_titular_nombre,
        -- si es relevo, el puesto que cubrió (el primero del día)
        (SELECT cs2.puesto_id   FROM cobertura_segmentos cs2 WHERE cs2.fecha = $1 AND cs2.employee_id = cs.employee_id AND cs2.tipo_cobertura = 'relevo' LIMIT 1) AS puesto_cubierto_id,
        -- tipo_novedad del segmento de relevo (motivo de la sustitución)
        (SELECT cs3.tipo_novedad FROM cobertura_segmentos cs3 WHERE cs3.fecha = $1 AND cs3.employee_id = cs.employee_id AND cs3.tipo_cobertura = 'relevo' AND cs3.tipo_novedad IS NOT NULL LIMIT 1) AS tipo_novedad_relevo
      FROM cobertura_segmentos cs
      LEFT JOIN employees e ON e.id = cs.employee_id
      WHERE cs.fecha = $1
        AND cs.employee_id IS NOT NULL
      GROUP BY cs.employee_id, cs.empleado_nombre, e.nombre_completo
    `, [fecha]);

    // Índice rápido: empleados que ya tienen cobertura_segmentos ese día
    const empIdsConSegmento = new Set<number>(segmentos.map((s: any) => Number(s.employee_id)));

    for (const s of segmentos) {
      const nombreFinal = s.nombre_emp ?? s.empleado_nombre ?? "Desconocido";
      const empId = Number(s.employee_id);

      // ── GUARD RRHH: Si el empleado tiene ausencia registrada en RRHH para esta fecha,
      // NO puede recibir novedad de trabajo — aunque tenga segmento de cobertura.
      // Esto puede ocurrir cuando el segmento fue creado antes de que RRHH registrara el evento,
      // o cuando el segmento quedó stale de una corrección posterior.
      const rrhhEventoSegmento = eventosRRHHMap.get(empId);
      if (rrhhEventoSegmento) {
        logger.info(
          { fecha, employeeId: empId, tipoEvento: rrhhEventoSegmento },
          "RRHH Guard (segmento): empleado tiene ausencia RRHH — generando novedad de ausencia en lugar de trabajo"
        );
        const sinDescuentoRRHH = TIPOS_RRHH_SIN_DESCUENTO.includes(rrhhEventoSegmento);
        const esSuspRRHH       = rrhhEventoSegmento === "suspension";
        await pool.query(`
          INSERT INTO novedades_nomina_diarias
            (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
             falta, suspension, descanso_trabajado, afecta_septimo, descuento_dia,
             puesto_titular_id, puesto_titular_nombre, tipo_novedad, fuente, cierre_id, updated_at)
          VALUES ($1,$2,$3,FALSE,0,0, $4,$5,FALSE,$6,$7, $8,$9,$10,'eventos_rrhh',$11,NOW())
          ON CONFLICT (fecha, employee_id) DO UPDATE SET
            trabajo_dia           = FALSE,
            horas_trabajadas      = 0,
            horas_extra           = 0,
            falta                 = EXCLUDED.falta,
            suspension            = EXCLUDED.suspension,
            afecta_septimo        = EXCLUDED.afecta_septimo,
            descuento_dia         = EXCLUDED.descuento_dia,
            tipo_novedad          = EXCLUDED.tipo_novedad,
            fuente                = 'eventos_rrhh',
            cierre_id             = EXCLUDED.cierre_id,
            updated_at            = NOW()
        `, [
          fecha, empId, nombreFinal,
          !sinDescuentoRRHH,  // falta
          esSuspRRHH,         // suspension
          !sinDescuentoRRHH,  // afecta_septimo
          !sinDescuentoRRHH,  // descuento_dia
          s.puesto_titular_id ?? null, s.puesto_titular_nombre ?? null,
          rrhhEventoSegmento,
          cierreId,
        ]);
        count++;
        continue; // No generar novedad de trabajo para este empleado
      }

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
           num_puestos_cubiertos, tipo_novedad, fuente, cierre_id, updated_at)
        VALUES ($1,$2,$3,TRUE,$4,$5, FALSE,FALSE,$6,FALSE,FALSE, $7,$8,$9,$10,$11,$13,'cierre_operativo',$12,NOW())
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
          tipo_novedad          = COALESCE(EXCLUDED.tipo_novedad, novedades_nomina_diarias.tipo_novedad),
          cierre_id             = EXCLUDED.cierre_id,
          updated_at            = NOW()
      `, [
        fecha, empId, nombreFinal,
        parseFloat(s.horas_trabajadas ?? 0).toFixed(2),
        parseFloat(s.horas_extra ?? 0).toFixed(2),
        s.descanso_trabajado ?? false,
        s.puesto_titular_id ?? null, s.puesto_titular_nombre ?? null,
        s.puesto_cubierto_id ?? null, puestoCubierto,
        parseInt(s.num_puestos_cubiertos ?? 0),
        cierreId,
        s.tipo_novedad_relevo ?? null,
      ]);
      count++;
    }

    // ── Paso 1.5: Fallback cobertura_diaria → novedades ─────────────────────────
    // Para puestos donde existe cobertura_diaria (tipo titular/relevo/titular_he)
    // pero NO existen cobertura_segmentos, se genera la novedad directamente
    // desde cobertura_diaria. Esto garantiza que ningún agente que trabajó
    // quede sin novedad de nómina por no tener segmentos registrados.
    try {
      const { rows: coberturaFallback } = await pool.query(`
        SELECT
          cd.cobertura_employee_id                                          AS employee_id,
          COALESCE(e.nombre_completo, cd.cobertura_nombre)                  AS empleado_nombre,
          cd.puesto_id                                                      AS puesto_cubierto_id,
          cd.puesto_nombre                                                  AS puesto_cubierto_nombre,
          cd.horas_trabajadas,
          cd.horas_extra,
          cd.tipo_cobertura,
          -- TH: puesto titular del empleado en esa fecha (histórico con fallback)
          COALESCE(
            (SELECT pth.puesto_id FROM puesto_titular_historico pth
             WHERE pth.employee_id = cd.cobertura_employee_id
               AND pth.fecha_inicio <= $1::date
               AND (pth.fecha_fin IS NULL OR pth.fecha_fin >= $1::date)
             ORDER BY pth.fecha_inicio DESC LIMIT 1),
            (SELECT po2.id FROM puestos_operativos po2 WHERE po2.titular_employee_id = cd.cobertura_employee_id AND po2.activo = TRUE ORDER BY po2.updated_at DESC NULLS LAST LIMIT 1)
          ) AS puesto_titular_id,
          (SELECT po3.nombre FROM puestos_operativos po3 WHERE po3.id = COALESCE(
            (SELECT pth.puesto_id FROM puesto_titular_historico pth
             WHERE pth.employee_id = cd.cobertura_employee_id
               AND pth.fecha_inicio <= $1::date
               AND (pth.fecha_fin IS NULL OR pth.fecha_fin >= $1::date)
             ORDER BY pth.fecha_inicio DESC LIMIT 1),
            (SELECT po2.id FROM puestos_operativos po2 WHERE po2.titular_employee_id = cd.cobertura_employee_id AND po2.activo = TRUE ORDER BY po2.updated_at DESC NULLS LAST LIMIT 1)
          )) AS puesto_titular_nombre
        FROM cobertura_diaria cd
        LEFT JOIN employees e ON e.id = cd.cobertura_employee_id
        WHERE cd.fecha = $1
          AND cd.tipo_cobertura IN ('titular', 'titular_he', 'relevo')
          AND cd.cobertura_employee_id IS NOT NULL
      `, [fecha]);

      for (const cd of coberturaFallback) {
        const empId = Number(cd.employee_id);

        // Caso A: ya tiene segmentos → ya fue procesado en Paso 1, saltar
        if (empIdsConSegmento.has(empId)) continue;

        const nombreFinal = cd.empleado_nombre ?? "Desconocido";
        const horasTrab   = parseFloat(cd.horas_trabajadas ?? 0).toFixed(2);
        const horasExtra  = parseFloat(cd.horas_extra ?? 0).toFixed(2);
        const esRelevo    = cd.tipo_cobertura === "relevo";
        const tipoNov     = esRelevo ? "relevo" : null;

        // GUARD RRHH: si el empleado tiene ausencia RRHH ese día, no marcar como trabajó
        const rrhhEventoFB = eventosRRHHMap.get(empId);
        if (rrhhEventoFB) {
          const sinDescRRHH = TIPOS_RRHH_SIN_DESCUENTO.includes(rrhhEventoFB);
          const esSuspRRHH  = rrhhEventoFB === "suspension";
          logger.info(
            { fecha, employeeId: empId, tipoEvento: rrhhEventoFB },
            "RRHH Guard (fallback cd): empleado tiene ausencia RRHH — generando novedad de ausencia"
          );
          await pool.query(`
            INSERT INTO novedades_nomina_diarias
              (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
               falta, suspension, descanso_trabajado, afecta_septimo, descuento_dia,
               puesto_titular_id, puesto_titular_nombre, tipo_novedad, fuente, cierre_id, updated_at)
            VALUES ($1,$2,$3,FALSE,0,0, $4,$5,FALSE,$6,$7, $8,$9,$10,'eventos_rrhh',$11,NOW())
            ON CONFLICT (fecha, employee_id) DO UPDATE SET
              trabajo_dia           = FALSE,
              horas_trabajadas      = 0,
              horas_extra           = 0,
              falta                 = EXCLUDED.falta,
              suspension            = EXCLUDED.suspension,
              afecta_septimo        = EXCLUDED.afecta_septimo,
              descuento_dia         = EXCLUDED.descuento_dia,
              tipo_novedad          = EXCLUDED.tipo_novedad,
              fuente                = 'eventos_rrhh',
              cierre_id             = EXCLUDED.cierre_id,
              updated_at            = NOW()
          `, [
            fecha, empId, nombreFinal,
            !sinDescRRHH, esSuspRRHH, !sinDescRRHH, !sinDescRRHH,
            cd.puesto_titular_id ?? null, cd.puesto_titular_nombre ?? null,
            rrhhEventoFB, cierreId,
          ]);
          count++;
          continue;
        }

        // Caso B: sin segmentos y sin evento RRHH → generar novedad de trabajo desde cobertura_diaria
        logger.info(
          { fecha, employeeId: empId, tipoCob: cd.tipo_cobertura, horas: horasTrab },
          "Fallback cobertura_diaria: generando novedad sin segmentos"
        );
        await pool.query(`
          INSERT INTO novedades_nomina_diarias
            (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
             falta, suspension, descanso_trabajado, afecta_septimo, descuento_dia,
             puesto_titular_id, puesto_titular_nombre, puesto_cubierto_id, puesto_cubierto_nombre,
             tipo_novedad, fuente, cierre_id, updated_at)
          VALUES ($1,$2,$3,TRUE,$4,$5, FALSE,FALSE,FALSE,FALSE,FALSE, $6,$7,$8,$9,$10,'cobertura_diaria_fallback',$11,NOW())
          ON CONFLICT (fecha, employee_id) DO UPDATE SET
            trabajo_dia           = TRUE,
            horas_trabajadas      = GREATEST(EXCLUDED.horas_trabajadas, novedades_nomina_diarias.horas_trabajadas),
            horas_extra           = GREATEST(EXCLUDED.horas_extra, novedades_nomina_diarias.horas_extra),
            falta                 = FALSE,
            descuento_dia         = FALSE,
            puesto_titular_id     = COALESCE(novedades_nomina_diarias.puesto_titular_id, EXCLUDED.puesto_titular_id),
            puesto_titular_nombre = COALESCE(novedades_nomina_diarias.puesto_titular_nombre, EXCLUDED.puesto_titular_nombre),
            puesto_cubierto_id    = COALESCE(EXCLUDED.puesto_cubierto_id, novedades_nomina_diarias.puesto_cubierto_id),
            puesto_cubierto_nombre= COALESCE(EXCLUDED.puesto_cubierto_nombre, novedades_nomina_diarias.puesto_cubierto_nombre),
            tipo_novedad          = COALESCE(novedades_nomina_diarias.tipo_novedad, EXCLUDED.tipo_novedad),
            fuente                = CASE
                                      WHEN novedades_nomina_diarias.fuente IN ('cierre_operativo','correccion_manual')
                                      THEN novedades_nomina_diarias.fuente
                                      ELSE 'cobertura_diaria_fallback'
                                    END,
            cierre_id             = EXCLUDED.cierre_id,
            updated_at            = NOW()
          WHERE novedades_nomina_diarias.trabajo_dia = FALSE
             OR novedades_nomina_diarias.fuente NOT IN ('cierre_operativo','correccion_manual')
        `, [
          fecha, empId, nombreFinal,
          horasTrab, horasExtra,
          cd.puesto_titular_id ?? null, cd.puesto_titular_nombre ?? null,
          cd.puesto_cubierto_id ?? null, cd.puesto_cubierto_nombre ?? null,
          tipoNov, cierreId,
        ]);
        count++;
        // Añadir al índice para que P-NOM-04 no lo marque como falta
        empIdsConSegmento.add(empId);
      }
    } catch (fb1Err) {
      logger.warn({ fb1Err, fecha }, "Paso 1.5 fallback cobertura_diaria: falló (no bloqueante)");
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
      // Buscar tipo_novedad del relevo para este puesto ese día (si existe)
      const { rows: tnRowsA } = await pool.query(`
        SELECT tipo_novedad FROM cobertura_segmentos
        WHERE fecha=$1 AND puesto_id=$2 AND tipo_cobertura='relevo' AND tipo_novedad IS NOT NULL
        LIMIT 1
      `, [fecha, a.puesto_titular_id]);
      const tipoNovA = tnRowsA[0]?.tipo_novedad ?? null;

      // Tipos que NO generan falta ni descuento al titular
      // NOTA: permiso_con_goce → no descuenta. permiso_sin_goce → sí descuenta (default).
      const TIPOS_SIN_FALTA = ["vacaciones", "relevo_vacaciones", "incapacidad", "permiso_con_goce"];
      const sinFalta = TIPOS_SIN_FALTA.includes(tipoNovA ?? "");
      const esSuspension = tipoNovA === "suspension";

      // Incidentes no pre-aprobados van a revisión RRHH; RRHH aprobados (vacaciones/incapacidad/etc.) no requieren revisión
      await pool.query(`
        INSERT INTO novedades_nomina_diarias
          (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
           falta, suspension, descanso_trabajado, afecta_septimo, descuento_dia,
           impacto_nomina, requiere_revision_rrhh,
           puesto_titular_id, puesto_titular_nombre, tipo_novedad, fuente, cierre_id, updated_at)
        VALUES ($1,$2,$3,FALSE,0,0, FALSE,FALSE,FALSE,FALSE,FALSE, $7,$8, $4,$5,$6,'cierre_operativo',$9,NOW())
        ON CONFLICT (fecha, employee_id)
        DO UPDATE SET
          trabajo_dia           = FALSE,
          falta                 = FALSE,
          suspension            = FALSE,
          afecta_septimo        = FALSE,
          descuento_dia         = FALSE,
          impacto_nomina        = CASE
            WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
            THEN novedades_nomina_diarias.impacto_nomina
            WHEN EXCLUDED.impacto_nomina IS NOT NULL
            THEN EXCLUDED.impacto_nomina
            ELSE novedades_nomina_diarias.impacto_nomina
          END,
          requiere_revision_rrhh = CASE
            WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
            THEN novedades_nomina_diarias.requiere_revision_rrhh
            ELSE EXCLUDED.requiere_revision_rrhh
          END,
          tipo_novedad          = COALESCE(EXCLUDED.tipo_novedad, novedades_nomina_diarias.tipo_novedad),
          puesto_titular_id     = EXCLUDED.puesto_titular_id,
          puesto_titular_nombre = EXCLUDED.puesto_titular_nombre,
          cierre_id             = EXCLUDED.cierre_id,
          updated_at            = NOW()
        WHERE novedades_nomina_diarias.trabajo_dia = FALSE
      `, [fecha, a.employee_id, a.empleado_nombre ?? "Desconocido",
          a.puesto_titular_id ?? null, a.puesto_titular_nombre ?? null, tipoNovA,
          !sinFalta ? 'pendiente' : null,  // $7 impacto_nomina
          !sinFalta,                        // $8 requiere_revision_rrhh
          cierreId]);                       // $9
      count++;
    }

    // Fix P-NOM-04 + TH (Titularidad Histórica): Titulares con puesto activo pero SIN ningún
    // segmento ese día. Usa puesto_titular_historico para determinar quién era titular en esa
    // fecha exacta (no el titular_employee_id actual). Fallback: titular_employee_id actual.
    // GUARD: no marcar falta si el titular tiene asignación activa en puesto o SSA
    // (evita faltas prematuras cuando la auto-auditoría corre antes de que se registren segmentos)
    const { rows: titularesSinPresencia } = await pool.query(`
      SELECT
             -- Titular efectivo para la fecha (histórico con fallback a actual)
             COALESCE(
               (SELECT pth.employee_id FROM puesto_titular_historico pth
                WHERE pth.puesto_id = po.id
                  AND pth.fecha_inicio <= $1::date
                  AND (pth.fecha_fin IS NULL OR pth.fecha_fin >= $1::date)
                ORDER BY pth.fecha_inicio DESC LIMIT 1),
               po.titular_employee_id
             )                          AS employee_id,
             e.nombre_completo          AS empleado_nombre,
             po.id                      AS puesto_titular_id,
             po.nombre                  AS puesto_titular_nombre,
             -- Turno del puesto para determinar si es día de descanso del ciclo
             t.id                       AS turno_id,
             t.nombre                   AS turno_nombre,
             t.horas_trabajo::float     AS horas_trabajo,
             t.horas_descanso::float    AS horas_descanso,
             (t.horas_trabajo + t.horas_descanso)::float AS ciclo_horas,
             po.fecha_inicio_ciclo::text AS fecha_inicio_ciclo,
             e.dia_descanso
      FROM puestos_operativos po
      -- Determinar titular efectivo para la fecha (histórico con fallback)
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          (SELECT pth2.employee_id FROM puesto_titular_historico pth2
           WHERE pth2.puesto_id = po.id
             AND pth2.fecha_inicio <= $1::date
             AND (pth2.fecha_fin IS NULL OR pth2.fecha_fin >= $1::date)
           ORDER BY pth2.fecha_inicio DESC LIMIT 1),
          po.titular_employee_id
        ) AS efectivo_id
      ) th_hist ON TRUE
      JOIN employees e ON e.id = th_hist.efectivo_id
      LEFT JOIN turnos t ON t.id = po.tipo_turno_id
      WHERE po.activo = TRUE
        AND th_hist.efectivo_id IS NOT NULL
        -- Sin segmento registrado para ese día
        AND NOT EXISTS (
          SELECT 1 FROM cobertura_segmentos cs
          WHERE cs.fecha = $1
            AND cs.employee_id = th_hist.efectivo_id
        )
        -- GUARD: no marcar si el agente está activamente cubriendo algún puesto ahora
        AND NOT EXISTS (
          SELECT 1 FROM puestos_operativos po2
          WHERE po2.agente_id = th_hist.efectivo_id
            AND po2.activo = TRUE
        )
        -- GUARD: no marcar si el agente está en un SSA activo con tarjeta activa
        AND NOT EXISTS (
          SELECT 1 FROM solicitudes_servicio_adicional ssa
          WHERE ssa.agente_id = th_hist.efectivo_id
            AND ssa.estado_general NOT IN ('cancelada', 'cerrada')
            AND ssa.tarjeta_activa = TRUE
        )
        -- GUARD: no marcar si ya tiene cobertura_diaria como trabajador ese día
        -- (el Paso 1.5 ya generó su novedad; evitar marcar erróneamente como falta)
        AND NOT EXISTS (
          SELECT 1 FROM cobertura_diaria cd
          WHERE cd.fecha = $1
            AND cd.cobertura_employee_id = th_hist.efectivo_id
            AND cd.tipo_cobertura IN ('titular', 'titular_he', 'relevo')
        )
    `, [fecha]);

    for (const t of titularesSinPresencia) {
      // GUARD DEL CICLO: Si el agente tiene turno configurado y HOY es su día de descanso
      // del ciclo (ej. 24x24 en día impar), no es una falta — es descanso programado.
      if (t.turno_id) {
        const turnoObj = {
          id: t.turno_id,
          nombre: t.turno_nombre,
          horas_trabajo: Number(t.horas_trabajo),
          horas_descanso: Number(t.horas_descanso),
          ciclo_horas: Number(t.ciclo_horas),
        };
        const { trabajaEseDia } = calcularJornadaEsperada(
          turnoObj,
          t.fecha_inicio_ciclo ?? null,
          fecha,
          t.dia_descanso ?? null,
        );
        if (!trabajaEseDia) {
          // No es una falta: hoy le toca descanso según su ciclo de turno.
          // Contrato mensual: descanso de ciclo es día pagado con horas del turno.
          const turnoHorasDescanso = Number(t.horas_trabajo ?? 24);
          await pool.query(`
            INSERT INTO novedades_nomina_diarias
              (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
               falta, suspension, descanso_trabajado, afecta_septimo, descuento_dia,
               puesto_titular_id, puesto_titular_nombre, tipo_novedad, fuente, updated_at)
            VALUES ($1,$2,$3,TRUE,$6,0, FALSE,FALSE,FALSE,FALSE,FALSE, $4,$5,'descanso_ciclo','auto_auditoria',NOW())
            ON CONFLICT (fecha, employee_id) DO NOTHING
          `, [fecha, t.employee_id, t.empleado_nombre ?? "Desconocido",
              t.puesto_titular_id ?? null, t.puesto_titular_nombre ?? null,
              turnoHorasDescanso.toFixed(2)]);
          count++;
          continue;
        }
      }

      // ── GUARD RRHH en P-NOM-04: si RRHH ya registró una ausencia para este empleado,
      // usar esa como fuente de verdad del tipo de ausencia (no el cobertura_segmento relevo).
      const rrhhEventoTitular = eventosRRHHMap.get(Number(t.employee_id));

      // Buscar tipo_novedad del relevo para este puesto ese día (si existe)
      const { rows: tnRowsT } = await pool.query(`
        SELECT tipo_novedad FROM cobertura_segmentos
        WHERE fecha=$1 AND puesto_id=$2 AND tipo_cobertura='relevo' AND tipo_novedad IS NOT NULL
        LIMIT 1
      `, [fecha, t.puesto_titular_id]);
      const tipoNovRelevo = tnRowsT[0]?.tipo_novedad ?? null;

      // RRHH tiene prioridad sobre el tipo_novedad del segmento de relevo
      const tipoNovT = rrhhEventoTitular ?? tipoNovRelevo;

      if (rrhhEventoTitular) {
        logger.info(
          { fecha, employeeId: t.employee_id, tipoEvento: rrhhEventoTitular },
          "RRHH Guard (P-NOM-04): usando tipo_novedad de RRHH para titular ausente"
        );
      }

      // Tipos que NO generan falta ni descuento al titular
      const sinFaltaT = TIPOS_RRHH_SIN_DESCUENTO.includes(tipoNovT ?? "");
      const esSuspensionT = tipoNovT === "suspension";

      // Incidentes sin evento RRHH van a revisión RRHH; RRHH aprobados (vacaciones/etc.) no requieren
      await pool.query(`
        INSERT INTO novedades_nomina_diarias
          (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
           falta, suspension, descanso_trabajado, afecta_septimo, descuento_dia,
           impacto_nomina, requiere_revision_rrhh,
           puesto_titular_id, puesto_titular_nombre, tipo_novedad, fuente, cierre_id, updated_at)
        VALUES ($1,$2,$3,FALSE,0,0, FALSE,FALSE,FALSE,FALSE,FALSE, $7,$8, $4,$5,$6,'auto_auditoria',$9,NOW())
        ON CONFLICT (fecha, employee_id)
        DO UPDATE SET
          falta                 = FALSE,
          suspension            = FALSE,
          afecta_septimo        = FALSE,
          descuento_dia         = FALSE,
          impacto_nomina        = CASE
            WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
            THEN novedades_nomina_diarias.impacto_nomina
            WHEN EXCLUDED.impacto_nomina IS NOT NULL
            THEN EXCLUDED.impacto_nomina
            ELSE novedades_nomina_diarias.impacto_nomina
          END,
          requiere_revision_rrhh = CASE
            WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
            THEN novedades_nomina_diarias.requiere_revision_rrhh
            ELSE EXCLUDED.requiere_revision_rrhh
          END,
          tipo_novedad          = COALESCE(EXCLUDED.tipo_novedad, novedades_nomina_diarias.tipo_novedad),
          puesto_titular_id     = EXCLUDED.puesto_titular_id,
          puesto_titular_nombre = EXCLUDED.puesto_titular_nombre,
          cierre_id             = COALESCE(novedades_nomina_diarias.cierre_id, EXCLUDED.cierre_id),
          updated_at            = NOW()
        WHERE novedades_nomina_diarias.trabajo_dia = FALSE
      `, [fecha, t.employee_id, t.empleado_nombre ?? "Desconocido",
          t.puesto_titular_id ?? null, t.puesto_titular_nombre ?? null, tipoNovT,
          !sinFaltaT ? 'pendiente' : null,  // $7 impacto_nomina
          !sinFaltaT,                        // $8 requiere_revision_rrhh
          cierreId]);                        // $9
      count++;
    }

    // ── Paso 4.5: Novedades base para TODOS los titulares activos ─────────────
    // Contrato mensual: TODOS los días cuentan como pagados (turno normal = trabajo,
    // descanso de ciclo = día pagado con horas del turno). Solo faltas descuentan.
    // Este paso garantiza que titulares que trabajaron su turno normal
    // (y no aparecen en pasos anteriores porque no tuvieron incidentes) tengan novedad.
    try {
      const { rows: titularesFaltantes } = await pool.query(`
        SELECT DISTINCT ON (pt.employee_id)
          pt.employee_id,
          e.nombre_completo AS empleado_nombre,
          po.id AS puesto_id,
          po.nombre AS puesto_nombre,
          t.id AS turno_id,
          t.nombre AS turno_nombre,
          t.horas_trabajo::float AS horas_trabajo,
          t.horas_descanso::float AS horas_descanso,
          (t.horas_trabajo + t.horas_descanso)::float AS ciclo_horas,
          po.fecha_inicio_ciclo::text AS fecha_inicio_ciclo,
          e.dia_descanso
        FROM puesto_titulares pt
        JOIN employees e ON e.id = pt.employee_id
        JOIN puestos_operativos po ON po.id = pt.puesto_id
        LEFT JOIN turnos t ON t.id = po.tipo_turno_id
        WHERE pt.activo = true
        ORDER BY pt.employee_id, po.id
      `, []);

      for (const tit of titularesFaltantes) {
        const turnoHoras = Number(tit.horas_trabajo ?? 24);
        let esDescanso = false;

        if (tit.turno_id) {
          const turnoObj = {
            id: tit.turno_id,
            nombre: tit.turno_nombre,
            horas_trabajo: Number(tit.horas_trabajo),
            horas_descanso: Number(tit.horas_descanso),
            ciclo_horas: Number(tit.ciclo_horas),
          };
          const { trabajaEseDia } = calcularJornadaEsperada(
            turnoObj,
            tit.fecha_inicio_ciclo ?? null,
            fecha,
            tit.dia_descanso ?? null,
          );
          esDescanso = !trabajaEseDia;
        }

        await pool.query(`
          INSERT INTO novedades_nomina_diarias
            (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
             falta, suspension, descanso_trabajado, afecta_septimo, descuento_dia,
             puesto_titular_id, puesto_titular_nombre, tipo_novedad, fuente, cierre_id, updated_at)
          VALUES ($1,$2,$3,TRUE,$4,0, FALSE,FALSE,FALSE,FALSE,FALSE, $5,$6,$7,'cierre_operativo',$8,NOW())
          ON CONFLICT (fecha, employee_id) DO UPDATE SET
            trabajo_dia = CASE WHEN EXCLUDED.falta = FALSE AND novedades_nomina_diarias.falta = FALSE
                               AND COALESCE(novedades_nomina_diarias.impacto_nomina,'pendiente') NOT IN ('aprobado_rrhh','rechazado_rrhh')
                          THEN TRUE ELSE novedades_nomina_diarias.trabajo_dia END,
            horas_trabajadas = CASE WHEN EXCLUDED.falta = FALSE AND novedades_nomina_diarias.falta = FALSE
                                    AND novedades_nomina_diarias.horas_trabajadas::numeric = 0
                                    AND COALESCE(novedades_nomina_diarias.impacto_nomina,'pendiente') NOT IN ('aprobado_rrhh','rechazado_rrhh')
                               THEN EXCLUDED.horas_trabajadas ELSE novedades_nomina_diarias.horas_trabajadas END,
            tipo_novedad = CASE WHEN novedades_nomina_diarias.tipo_novedad IS NULL
                                AND COALESCE(novedades_nomina_diarias.impacto_nomina,'pendiente') NOT IN ('aprobado_rrhh','rechazado_rrhh')
                           THEN EXCLUDED.tipo_novedad ELSE novedades_nomina_diarias.tipo_novedad END,
            updated_at = NOW()
        `, [
          fecha, tit.employee_id, tit.empleado_nombre ?? "Desconocido",
          turnoHoras.toFixed(2),
          tit.puesto_id, tit.puesto_nombre,
          esDescanso ? 'descanso_ciclo' : null,
          cierreId,
        ]);
        count++;
      }
      if (titularesFaltantes.length > 0) {
        logger.info({ fecha, total: titularesFaltantes.length }, "Paso 4.5: novedades base generadas para titulares sin registro");
      }
    } catch (paso45Err) {
      logger.warn({ paso45Err, fecha }, "Paso 4.5 novedades base titulares: falló (no bloqueante)");
    }

    // ── Paso 4.6: Ajustar horas para descanso con cobertura ─────────────────
    // Si un titular en día de descanso cubrió a alguien (tiene horas_extra > 0),
    // sus horas_trabajadas deben incluir las horas base del turno (descanso pagado) + las HE.
    try {
      const { rows: cobDescanso } = await pool.query(`
        SELECT n.id, n.employee_id, n.horas_trabajadas, n.horas_extra,
               po.tipo_turno_id,
               t.horas_trabajo::float AS turno_horas,
               t.horas_descanso::float AS turno_descanso,
               po.fecha_inicio_ciclo::text AS fecha_inicio_ciclo,
               e.dia_descanso,
               t.nombre AS turno_nombre
        FROM novedades_nomina_diarias n
        JOIN puesto_titulares pt ON pt.employee_id = n.employee_id AND pt.activo = true
        JOIN puestos_operativos po ON po.id = pt.puesto_id
        LEFT JOIN turnos t ON t.id = po.tipo_turno_id
        LEFT JOIN employees e ON e.id = n.employee_id
        WHERE n.fecha = $1
          AND n.trabajo_dia = TRUE
          AND n.horas_extra > 0
          AND po.tipo_turno_id IS NOT NULL
      `, [fecha]);

      for (const cd of cobDescanso) {
        const turnoObj = {
          id: cd.tipo_turno_id,
          nombre: cd.turno_nombre,
          horas_trabajo: Number(cd.turno_horas),
          horas_descanso: Number(cd.turno_descanso),
          ciclo_horas: Number(cd.turno_horas) + Number(cd.turno_descanso),
        };
        const { trabajaEseDia } = calcularJornadaEsperada(
          turnoObj,
          cd.fecha_inicio_ciclo ?? null,
          fecha,
          cd.dia_descanso ?? null,
        );

        if (!trabajaEseDia) {
          const turnoBase = Number(cd.turno_horas);
          const heHoras = Number(cd.horas_extra);
          const newHorasTrab = turnoBase + heHoras;
          if (Number(cd.horas_trabajadas) < newHorasTrab) {
            await pool.query(`
              UPDATE novedades_nomina_diarias
              SET horas_trabajadas = $1,
                  descanso_trabajado = TRUE,
                  updated_at = NOW()
              WHERE id = $2
            `, [newHorasTrab.toFixed(2), cd.id]);
          }
        }
      }
    } catch (paso46Err) {
      logger.warn({ paso46Err, fecha }, "Paso 4.6 descanso+cobertura: falló (no bloqueante)");
    }

    // ── Paso 4.7: Establecer dias_descuento para faltas según turno ─────────
    // Regla de negocio: falta en turno 24h = 3 días descuento, 12h = 2 días descuento
    try {
      await pool.query(`
        UPDATE novedades_nomina_diarias n
        SET dias_descuento = CASE
              WHEN t.horas_trabajo >= 24 THEN 3
              WHEN t.horas_trabajo >= 12 THEN 2
              ELSE 1
            END,
            updated_at = NOW()
        FROM puesto_titulares pt
        JOIN puestos_operativos po ON po.id = pt.puesto_id
        LEFT JOIN turnos t ON t.id = po.tipo_turno_id
        WHERE n.fecha = $1
          AND pt.employee_id = n.employee_id
          AND pt.activo = true
          AND n.falta = TRUE
          AND (n.dias_descuento IS NULL OR n.dias_descuento = 0)
      `, [fecha]);
    } catch (paso47Err) {
      logger.warn({ paso47Err, fecha }, "Paso 4.7 dias_descuento faltas: falló (no bloqueante)");
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
      // Suspensión desde pizarrón → requiere revisión RRHH para confirmar impacto nómina
      await pool.query(`
        INSERT INTO novedades_nomina_diarias
          (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
           falta, suspension, descanso_trabajado, afecta_septimo, descuento_dia,
           impacto_nomina, requiere_revision_rrhh,
           tipo_novedad, fuente, cierre_id, updated_at)
        VALUES ($1,$2,$3,FALSE,0,0, FALSE,FALSE,FALSE,FALSE,FALSE,
                'pendiente',TRUE, 'suspension','cierre_operativo',$4,NOW())
        ON CONFLICT (fecha, employee_id)
        DO UPDATE SET
          suspension             = FALSE,
          afecta_septimo         = FALSE,
          descuento_dia          = FALSE,
          tipo_novedad           = COALESCE(novedades_nomina_diarias.tipo_novedad, 'suspension'),
          impacto_nomina         = CASE
            WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
            THEN novedades_nomina_diarias.impacto_nomina
            ELSE 'pendiente'
          END,
          requiere_revision_rrhh = CASE
            WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
            THEN novedades_nomina_diarias.requiere_revision_rrhh
            ELSE TRUE
          END,
          cierre_id              = EXCLUDED.cierre_id,
          updated_at             = NOW()
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
      params.push(todayGT());
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
    const desde = (req.query.desde as string) || todayGT();
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
