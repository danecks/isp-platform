import { Router } from "express";
import { pool, todayGT } from "@workspace/db";
import { logger } from "../../lib/logger";

import { calcularEstadoCiclo } from "../../lib/turno-calc";

const router = Router();

// ─── Helper PERS-SLOT-01: motor de ciclo basado en personal_slots ────────────
// Mismo cálculo que calcTrabajaPorSlot del bloque de puestos: días laborables
// dentro de un ciclo de longitud fija (7/14/21/28), anclado a un lunes.
function calcTrabajaPorSlotPersonal(
diasTrabajo: number[],
fechaInicioStr: string,
fechaConsulta: string,
longitudCiclo: number = 14,
): boolean {
const lc = (longitudCiclo && longitudCiclo > 0) ? longitudCiclo : 14;
const [iy, im, id] = fechaInicioStr.split("-").map(Number);
const [cy, cm, cd] = fechaConsulta.split("-").map(Number);
const inicio   = Date.UTC(iy, im - 1, id);
const consulta = Date.UTC(cy, cm - 1, cd);
const daysElapsed = Math.floor((consulta - inicio) / 86400000);
const cycleDay = ((daysElapsed % lc) + lc) % lc + 1;
return diasTrabajo.includes(cycleDay);
}

router.get("/operaciones/proximos-regresos-vacaciones", async (req, res) => {
  try {
    const dias = Math.max(1, Math.min(30, Number(req.query.dias) || 5));
    const fechaParam = typeof req.query.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha)
      ? req.query.fecha : null;
    const hoy = fechaParam ?? todayGT();

    // Trae empleados con vacación activa cuyo fin está entre hoy y hoy+dias.
    // El "regreso" es el día siguiente al fin → si fin=hoy regresa mañana (1 día).
    // Cruza con puestos donde es titular (puesto_slots OR puesto_titulares OR legacy).
    const { rows } = await pool.query(`
      WITH vac AS (
        SELECT er.employee_id,
               e.nombre_completo,
               to_char(er.fecha::date, 'YYYY-MM-DD') AS vac_inicio,
               to_char(COALESCE(er.fecha_fin, er.fecha)::date, 'YYYY-MM-DD') AS vac_fin,
               (COALESCE(er.fecha_fin, er.fecha)::date - $1::date + 1) AS dias_para_regreso
          FROM eventos_rrhh er
          JOIN employees e ON e.id = er.employee_id
         WHERE er.tipo_evento = 'vacaciones'
           AND er.estado NOT IN ('anulado', 'cancelado')
           AND $1::date BETWEEN er.fecha::date AND COALESCE(er.fecha_fin, er.fecha)::date
           AND COALESCE(er.fecha_fin, er.fecha)::date BETWEEN $1::date AND ($1::date + ($2::int - 1))
      ),
      puestos_titulares AS (
        -- Vía puesto_slots (multi-titular nuevo)
        SELECT ps.empleado_id AS employee_id,
               po.id AS puesto_id, po.nombre AS puesto_nombre, po.cliente_nombre
          FROM puesto_slots ps
          JOIN puestos_operativos po ON po.id = ps.puesto_id
         WHERE ps.activo = TRUE AND ps.empleado_id IS NOT NULL AND po.activo = TRUE
        UNION
        -- Vía puesto_titulares
        SELECT pt.employee_id,
               po.id, po.nombre, po.cliente_nombre
          FROM puesto_titulares pt
          JOIN puestos_operativos po ON po.id = pt.puesto_id
         WHERE pt.activo = TRUE AND po.activo = TRUE
        UNION
        -- Vía legacy
        SELECT po.titular_employee_id,
               po.id, po.nombre, po.cliente_nombre
          FROM puestos_operativos po
         WHERE po.titular_employee_id IS NOT NULL AND po.activo = TRUE
      )
      SELECT v.employee_id,
             v.nombre_completo,
             v.vac_inicio,
             v.vac_fin,
             v.dias_para_regreso,
             COALESCE(json_agg(
               json_build_object(
                 'id',             pt.puesto_id,
                 'nombre',         pt.puesto_nombre,
                 'cliente_nombre', pt.cliente_nombre
               )
             ) FILTER (WHERE pt.puesto_id IS NOT NULL), '[]'::json) AS puestos
        FROM vac v
        LEFT JOIN puestos_titulares pt ON pt.employee_id = v.employee_id
       GROUP BY v.employee_id, v.nombre_completo, v.vac_inicio, v.vac_fin, v.dias_para_regreso
       ORDER BY v.dias_para_regreso ASC, v.nombre_completo ASC
    `, [hoy, dias]);

    res.json({ fecha: hoy, dias, regresos: rows });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/proximos-regresos-vacaciones error");
    res.status(500).json({ error: "Error al obtener próximos regresos" });
  }
});

// Pool de agentes — clasificación inteligente con motor de turnos
// P-02 (v2): el SQL asigna categorías base (en_puesto, en_ssa, en_descanso,
// suspendido, faltando). Los "disponible" son post-procesados en JS con
// calcularEstadoCiclo para distinguir entre:
//   • trabajando         — su turno indica que laboran hoy
//   • descansandoCiclo   — su turno indica descanso normal (dPC=true)

router.get("/operaciones/pool", async (req, res) => {
  try {
    const fechaParam = typeof req.query.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha)
      ? req.query.fecha : null;
    const hoy = fechaParam ?? todayGT();
    const mañanaDt = new Date(hoy + "T12:00:00Z");
    mañanaDt.setUTCDate(mañanaDt.getUTCDate() + 1);
    const mañana = mañanaDt.toISOString().slice(0, 10);
    // Contexto de puesto: para enriquecer con hints de experiencia previa
    const puestoIdParam = req.query.puesto_id ? Number(req.query.puesto_id) : null;

    const { rows: agentes } = await pool.query(`
      SELECT
        e.id, e.nombre_completo, e.estado_laboral, e.puesto, e.area, e.sede,
        e.telefono, e.wa_autorizado, e.supervisor_id,
        e.fecha_ingreso::text AS fecha_ingreso,
        COALESCE(e.tipo_personal, 'guardia') AS tipo_personal,
        COALESCE(e.elegible_pool, TRUE) AS elegible_pool,
        COALESCE(eoa.tipo_asignacion, 'sin_asignacion') AS tipo_asignacion_eoa,
        titular_po.estado_operativo_puesto AS estado_puesto_titular,
        titular_po.nombre                  AS nombre_puesto_titular,
        titular_po.cliente_nombre          AS cliente_puesto_titular,
        COALESCE(eoa.zona_operativa_id, titular_po.zona_operativa_id) AS zona_operativa_id,
        oz.nombre AS zona_nombre,
        COALESCE(t.tipo_ciclo, CASE WHEN t.horas_trabajo <= 24 THEN 'diario' ELSE 'ciclo_bloques' END) AS tipo_ciclo_turno,
        t.horas_trabajo  AS horas_trabajo_turno,
        t.horas_descanso AS horas_descanso_turno,
        t.nombre         AS turno_nombre,
        titular_po.fecha_inicio_ciclo AS fecha_inicio_ciclo_turno,
        titular_po.hora_entrada AS hora_entrada_puesto,
        vac_activa.tipo_evento AS vacacion_activa_tipo,
        vac_activa.fecha::date AS vacacion_inicio,
        vac_activa.fecha_fin   AS vacacion_fin,
        cs_faltando.tiene_relevo IS NOT NULL    AS hay_relevo_hoy_faltando,
        cs_trabajando.trabajando_hoy IS NOT NULL AS cs_trabajando_hoy,
        slot_hoy.trabaja_hoy AS slot_trabaja_hoy,
        ev_falta.tiene_falta IS NOT NULL AS tiene_falta_evento,
        CASE
          WHEN e.estado_laboral = 'licencia'   THEN 'en_descanso'
          WHEN e.estado_laboral = 'suspendido' THEN 'suspendido'
          -- FALTANDO: evento de falta registrado en eventos_rrhh para la fecha consultada
          WHEN e.estado_laboral = 'activo'
               AND ev_falta.tiene_falta IS NOT NULL
               AND (po.agente_id IS NOT NULL OR titular_po.id IS NOT NULL)
               THEN 'faltando'
          -- FALTANDO: falta diferida (pre-cierre) marcada en puestos_operativos
          WHEN e.estado_laboral = 'activo'
               AND titular_po.estado_operativo_puesto = 'faltando'
               AND titular_po.falta_employee_id = e.id
               THEN 'faltando'
          -- FALTANDO: agente titular cuyo puesto tiene un relevo activo hoy
          WHEN e.estado_laboral = 'activo'
               AND cs_faltando.tiene_relevo IS NOT NULL
               AND COALESCE(slot_hoy.trabaja_hoy, TRUE) = TRUE
               AND (po.agente_id IS NOT NULL OR titular_po.id IS NOT NULL)
               THEN 'faltando'
          -- EN_PUESTO: agente cubriendo custodia hoy (daily assignment)
          WHEN custodia_cob.employee_id IS NOT NULL
               AND e.estado_laboral = 'activo'
               THEN 'en_puesto'
          -- EN_PUESTO: agente titular custodia activo
          WHEN custodia_tit.employee_id IS NOT NULL
               AND e.estado_laboral = 'activo'
               AND ev_falta.tiene_falta IS NULL
               THEN 'en_puesto'
          -- FALTANDO: titular custodia con falta hoy
          WHEN custodia_tit.employee_id IS NOT NULL
               AND e.estado_laboral = 'activo'
               AND ev_falta.tiene_falta IS NOT NULL
               THEN 'faltando'
          -- EN_PUESTO: agente titular y el ciclo confirma que HOY trabaja.
          WHEN (po.agente_id IS NOT NULL OR titular_po.id IS NOT NULL)
               AND e.estado_laboral = 'activo'
               AND COALESCE(slot_hoy.trabaja_hoy, TRUE) = TRUE
               THEN 'en_puesto'
          WHEN (ssa.agente_id IS NOT NULL OR ssa_ag.employee_id IS NOT NULL)
               AND e.estado_laboral = 'activo'
               THEN 'en_ssa'
          ELSE 'disponible'
        END AS categoria
      FROM employees e
      LEFT JOIN (
        SELECT DISTINCT agente_id
        FROM puestos_operativos
        WHERE activo = TRUE AND agente_id IS NOT NULL
      ) po ON po.agente_id = e.id
      LEFT JOIN (
        SELECT DISTINCT agente_id
        FROM solicitudes_servicio_adicional
        WHERE agente_id IS NOT NULL
          AND estado_general NOT IN ('cancelada', 'cerrada')
          AND $1::date BETWEEN fecha AND COALESCE(fecha_fin, fecha)
      ) ssa ON ssa.agente_id = e.id
      LEFT JOIN (
        SELECT DISTINCT sa.employee_id
        FROM ssa_agentes sa
        JOIN solicitudes_servicio_adicional s2
          ON s2.id = sa.ssa_id
         AND s2.estado_general NOT IN ('cancelada', 'cerrada')
         AND $1::date BETWEEN s2.fecha AND COALESCE(s2.fecha_fin, s2.fecha)
        WHERE sa.estado IN ('asignado', 'confirmado')
      ) ssa_ag ON ssa_ag.employee_id = e.id
      LEFT JOIN employee_operational_assignments eoa
        ON eoa.employee_id = e.id AND eoa.activa = TRUE
      LEFT JOIN LATERAL (
        SELECT po2.id, po2.estado_operativo_puesto, po2.nombre, po2.cliente_nombre,
               po2.agente_id, po2.tipo_turno_id,
               COALESCE(src.fic, po2.fecha_inicio_ciclo) AS fecha_inicio_ciclo,
               po2.zona_operativa_id,
               po2.hora_entrada,
               po2.falta_employee_id
        FROM (
          SELECT pt2.employee_id, pt2.puesto_id, pt2.fecha_inicio_ciclo AS fic
          FROM puesto_titulares pt2
          WHERE pt2.employee_id = e.id AND pt2.activo = TRUE
          UNION ALL
          SELECT ps2.empleado_id, ps2.puesto_id, ps2.fecha_inicio_ciclo AS fic
          FROM puesto_slots ps2
          WHERE ps2.empleado_id = e.id AND ps2.activo = TRUE
            AND NOT EXISTS (
              SELECT 1 FROM puesto_titulares pt3
              WHERE pt3.employee_id = e.id AND pt3.activo = TRUE
            )
        ) src
        JOIN puestos_operativos po2 ON po2.id = src.puesto_id AND po2.activo = TRUE
        ORDER BY po2.id
        LIMIT 1
      ) titular_po ON TRUE
      LEFT JOIN turnos t ON t.id = titular_po.tipo_turno_id
      LEFT JOIN LATERAL (
        SELECT ct.employee_id
        FROM custodia_titulares ct
        WHERE ct.employee_id = e.id AND ct.activo = TRUE
        LIMIT 1
      ) custodia_tit ON TRUE
      LEFT JOIN LATERAL (
        SELECT cad.employee_id
        FROM custodia_asignacion_diaria cad
        WHERE cad.employee_id = e.id AND cad.fecha = $1::date
        LIMIT 1
      ) custodia_cob ON TRUE
      LEFT JOIN operational_zones oz ON oz.id = COALESCE(eoa.zona_operativa_id, titular_po.zona_operativa_id)
      LEFT JOIN LATERAL (
        SELECT er.tipo_evento, er.fecha, er.fecha_fin
        FROM eventos_rrhh er
        WHERE er.employee_id = e.id
          AND er.tipo_evento IN ('vacaciones', 'vacaciones_trabajadas')
          AND er.estado NOT IN ('anulado', 'cancelado')
          AND er.fecha::date <= $1::date
          AND (er.fecha_fin IS NULL OR er.fecha_fin >= $1::date)
        ORDER BY er.created_at DESC
        LIMIT 1
      ) vac_activa ON TRUE
      -- Evento de falta registrado en eventos_rrhh para la fecha consultada
      LEFT JOIN LATERAL (
        SELECT TRUE AS tiene_falta
        FROM eventos_rrhh er_f
        WHERE er_f.employee_id = e.id
          AND er_f.tipo_evento = 'falta'
          AND er_f.fecha::date = $1::date
          AND er_f.estado NOT IN ('anulado', 'cancelado')
        LIMIT 1
      ) ev_falta ON TRUE
      LEFT JOIN LATERAL (
        SELECT TRUE AS tiene_relevo
        FROM cobertura_segmentos cs_f
        WHERE cs_f.fecha = $1::date
          AND cs_f.tipo_cobertura IN ('relevo','cobertura_supervisor','cobertura_jefe_servicio')
          AND cs_f.employee_id IS DISTINCT FROM e.id
          AND (
            cs_f.puesto_id = titular_po.id
            OR EXISTS (
              SELECT 1 FROM puestos_operativos po_x
              WHERE po_x.id = cs_f.puesto_id
                AND po_x.agente_id = e.id
                AND po_x.activo = TRUE
            )
          )
        LIMIT 1
      ) cs_faltando ON TRUE
      LEFT JOIN LATERAL (
        SELECT TRUE AS trabajando_hoy
        FROM cobertura_segmentos cs_t
        WHERE cs_t.employee_id = e.id
          AND cs_t.fecha = $1::date
          AND cs_t.tipo_cobertura IN ('relevo','cobertura_supervisor','cobertura_jefe_servicio','titular')
        LIMIT 1
      ) cs_trabajando ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          ((($1::date - COALESCE(ps.fecha_inicio_ciclo, po_s.fecha_inicio_ciclo, $1::date)::date)
             % COALESCE(ps.longitud_ciclo, 14) + COALESCE(ps.longitud_ciclo, 14))
             % COALESCE(ps.longitud_ciclo, 14) + 1) = ANY(ps.dias_trabajo)
          AS trabaja_hoy
        FROM puesto_slots ps
        JOIN puestos_operativos po_s ON po_s.id = ps.puesto_id
        WHERE ps.empleado_id = e.id AND ps.activo = TRUE
        ORDER BY ps.slot_numero ASC
        LIMIT 1
      ) slot_hoy ON TRUE
      WHERE e.estado_laboral IN ('activo', 'suspendido', 'licencia')
        AND COALESCE(e.tipo_personal, 'guardia') IN ('guardia', 'custodio')
        AND (
          COALESCE(e.elegible_pool, TRUE) = TRUE
          OR (
            (titular_po.id IS NOT NULL OR po.agente_id IS NOT NULL)
            AND e.estado_laboral = 'activo'
            AND (
              ev_falta.tiene_falta IS NOT NULL
              OR (
                cs_faltando.tiene_relevo IS NOT NULL
                AND COALESCE(slot_hoy.trabaja_hoy, TRUE) = TRUE
              )
            )
          )
          OR ssa.agente_id IS NOT NULL
          OR ssa_ag.employee_id IS NOT NULL
        )
      ORDER BY e.estado_laboral, e.nombre_completo
    `, [hoy]);

    // Supervisores — personal operativo con turno real (12h o 24x24)
    // La zona se resuelve primero por la FK formal (operational_zones.supervisor_employee_id),
    // luego por la asignación operativa del empleado
    const { rows: supervisoresRows } = await pool.query(`
      SELECT
        e.id, e.nombre_completo, e.estado_laboral, e.puesto, e.area, e.sede,
        e.telefono, e.wa_autorizado,
        COALESCE(oz_formal.id, eoa.zona_operativa_id)          AS zona_operativa_id,
        COALESCE(oz_formal.nombre, oz_eoa.nombre)              AS zona_nombre,
        t.id                                                   AS tipo_turno_id,
        t.nombre                                               AS turno_nombre,
        t.tipo_ciclo                                           AS tipo_ciclo_turno,
        t.horas_trabajo                                        AS horas_trabajo_turno,
        t.horas_descanso                                       AS horas_descanso_turno,
        eoa.fecha_inicio                                       AS fecha_inicio_ciclo_turno,
        ps.dias_trabajo                                        AS ps_dias_trabajo,
        to_char(ps.fecha_inicio_ciclo, 'YYYY-MM-DD')           AS ps_fecha_inicio_ciclo,
        ps.longitud_ciclo                                      AS ps_longitud_ciclo,
        ps.horas_turno                                         AS ps_horas_turno,
        ps.hora_entrada                                        AS ps_hora_entrada,
        CASE
          WHEN e.estado_laboral = 'licencia'   THEN 'licencia'
          WHEN e.estado_laboral = 'suspendido' THEN 'suspendido'
          ELSE 'activo'
        END AS estado_display,
        veh_zona.vehiculos_zona,
        ev_falta.evento_id               AS falta_evento_id,
        (ev_falta.evento_id IS NOT NULL) AS faltando
      FROM employees e
      LEFT JOIN employee_operational_assignments eoa ON eoa.employee_id = e.id AND eoa.activa = TRUE
      LEFT JOIN operational_zones oz_eoa   ON oz_eoa.id  = eoa.zona_operativa_id
      LEFT JOIN operational_zones oz_formal ON oz_formal.supervisor_employee_id = e.id
      LEFT JOIN turnos t ON t.id = eoa.tipo_turno_id
      LEFT JOIN LATERAL (
        SELECT dias_trabajo, fecha_inicio_ciclo, longitud_ciclo, horas_turno, hora_entrada
        FROM personal_slots
        WHERE employee_id = e.id AND tipo = 'supervisor' AND activo = TRUE
        ORDER BY slot_numero ASC
        LIMIT 1
      ) ps ON TRUE
      LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
          'id',     v.id,
          'placa',  v.placa,
          'tipo',   v.tipo,
          'marca',  v.marca,
          'color',  v.color,
          'estado', v.estado
        ) ORDER BY v.id) AS vehiculos_zona
        FROM vehiculos v
        WHERE v.zona_operativa_id = COALESCE(oz_formal.id, eoa.zona_operativa_id)
          AND v.activo = TRUE
      ) veh_zona ON TRUE
      LEFT JOIN LATERAL (
        SELECT er.id AS evento_id
        FROM eventos_rrhh er
        WHERE er.employee_id = e.id AND er.tipo_evento = 'falta'
          AND er.fecha::date = $1::date AND er.estado NOT IN ('anulado', 'cancelado')
        ORDER BY er.id DESC
        LIMIT 1
      ) ev_falta ON TRUE
      WHERE COALESCE(e.tipo_personal, 'guardia') = 'supervisor'
        AND e.estado_laboral IN ('activo', 'licencia', 'suspendido')
      ORDER BY COALESCE(oz_formal.id, eoa.zona_operativa_id) NULLS LAST, e.nombre_completo
    `, [hoy]);

    // ── Aplicar motor de ciclos a supervisores ────────────────────────────────
    const supervisoresEnriquecidos = supervisoresRows.map((sv: any) => {
      if (sv.estado_display !== 'activo') {
        return { ...sv, trabaja_hoy: false, trabaja_mañana: false, estado_ciclo: sv.estado_display, puede_cubrir: false, disponible_he: false };
      }
      // Prioridad PERS-SLOT-01: si el supervisor tiene plantilla en personal_slots,
      // se usa el motor de slots (mismo que puestos: dias_trabajo + longitud_ciclo).
      // Si no, fallback al motor de turnos legacy basado en eoa+turno.
      if (Array.isArray(sv.ps_dias_trabajo) && sv.ps_dias_trabajo.length > 0 && sv.ps_fecha_inicio_ciclo) {
        const dias = (sv.ps_dias_trabajo as any[]).map((d) => Number(d)).filter((d) => Number.isFinite(d));
        const lc = Number(sv.ps_longitud_ciclo) || 14;
        const trabajaHoy    = calcTrabajaPorSlotPersonal(dias, sv.ps_fecha_inicio_ciclo, hoy, lc);
        const trabajaMañana = calcTrabajaPorSlotPersonal(dias, sv.ps_fecha_inicio_ciclo, mañana, lc);
        return {
          ...sv,
          trabaja_hoy:    trabajaHoy,
          trabaja_mañana: trabajaMañana,
          disponible_he:  false,
          estado_ciclo:   trabajaHoy ? "trabajando" : "descansando_ciclo",
          puede_cubrir:   trabajaHoy,
        };
      }
      if (sv.tipo_ciclo_turno && sv.horas_trabajo_turno && sv.fecha_inicio_ciclo_turno) {
        const turnoObj = {
          id: sv.tipo_turno_id ?? 0,
          nombre: sv.turno_nombre ?? "",
          tipo_ciclo: sv.tipo_ciclo_turno,
          horas_trabajo:  Number(sv.horas_trabajo_turno),
          horas_descanso: Number(sv.horas_descanso_turno ?? 0),
        };
        const fechaInicioStr = sv.fecha_inicio_ciclo_turno instanceof Date
          ? sv.fecha_inicio_ciclo_turno.toISOString().slice(0, 10)
          : String(sv.fecha_inicio_ciclo_turno).slice(0, 10);

        const estadoHoy    = calcularEstadoCiclo(turnoObj, fechaInicioStr, hoy);
        const estadoMañana = calcularEstadoCiclo(turnoObj, fechaInicioStr, mañana);

        // Un supervisor puede cubrir si: trabaja hoy (turno activo) o descansa pero disponibleHE
        const puedeHoy = estadoHoy.trabaja || (estadoHoy.disponibleHE === true);

        return {
          ...sv,
          trabaja_hoy:    estadoHoy.trabaja,
          trabaja_mañana: estadoMañana.trabaja,
          disponible_he:  !estadoHoy.trabaja && (estadoHoy.disponibleHE === true),
          estado_ciclo:   estadoHoy.trabaja ? "trabajando"
            : (estadoHoy.disponibleHE ? "disponible_he" : "descansando_ciclo"),
          puede_cubrir:   puedeHoy,
        };
      }
      // Sin turno → disponible por defecto
      return { ...sv, trabaja_hoy: null, trabaja_mañana: null, estado_ciclo: "sin_turno", puede_cubrir: true, disponible_he: false };
    });

    // Jefes de servicio — personal operativo con turno real 24x24, procesados por el motor de ciclos
    const { rows: jefesServicioRows } = await pool.query(`
      SELECT
        e.id, e.nombre_completo, e.estado_laboral, e.puesto, e.area,
        e.telefono, e.wa_autorizado,
        eoa.zona_operativa_id,
        oz.nombre                                              AS zona_nombre,
        t.id                                                   AS tipo_turno_id,
        t.nombre                                               AS turno_nombre,
        t.tipo_ciclo                                           AS tipo_ciclo_turno,
        t.horas_trabajo                                        AS horas_trabajo_turno,
        t.horas_descanso                                       AS horas_descanso_turno,
        eoa.fecha_inicio                                       AS fecha_inicio_ciclo_turno,
        CASE
          WHEN e.estado_laboral = 'licencia'   THEN 'licencia'
          WHEN e.estado_laboral = 'suspendido' THEN 'suspendido'
          ELSE 'activo'
        END AS estado_display,
        ev_falta.evento_id               AS falta_evento_id,
        (ev_falta.evento_id IS NOT NULL) AS faltando
      FROM employees e
      LEFT JOIN employee_operational_assignments eoa ON eoa.employee_id = e.id AND eoa.activa = TRUE
      LEFT JOIN operational_zones oz ON oz.id = eoa.zona_operativa_id
      LEFT JOIN turnos t ON t.id = eoa.tipo_turno_id
      LEFT JOIN LATERAL (
        SELECT er.id AS evento_id
        FROM eventos_rrhh er
        WHERE er.employee_id = e.id AND er.tipo_evento = 'falta'
          AND er.fecha::date = $1::date AND er.estado NOT IN ('anulado', 'cancelado')
        ORDER BY er.id DESC
        LIMIT 1
      ) ev_falta ON TRUE
      WHERE COALESCE(e.tipo_personal, 'guardia') = 'jefe_servicio'
        AND e.estado_laboral IN ('activo', 'licencia', 'suspendido')
      ORDER BY oz.id NULLS LAST, e.nombre_completo
    `, [hoy]);

    // ── Aplicar motor de ciclos a jefes de servicio ──────────────────────────
    // Calculamos estado HOY y MAÑANA para el panel "Jefe de Servicio del Día"

    const jefesServicioEnriquecidos = jefesServicioRows.map((js: any) => {
      if (js.estado_display !== 'activo') {
        return { ...js, trabaja_hoy: false, trabaja_mañana: false, estado_ciclo: js.estado_display };
      }
      if (js.tipo_ciclo_turno && js.horas_trabajo_turno && js.fecha_inicio_ciclo_turno) {
        const turnoObj = {
          id: js.tipo_turno_id ?? 0,
          nombre: js.turno_nombre ?? "",
          tipo_ciclo: js.tipo_ciclo_turno,
          horas_trabajo:  Number(js.horas_trabajo_turno),
          horas_descanso: Number(js.horas_descanso_turno ?? js.horas_trabajo_turno),
        };
        const fechaInicioStr = js.fecha_inicio_ciclo_turno instanceof Date
          ? js.fecha_inicio_ciclo_turno.toISOString().slice(0, 10)
          : String(js.fecha_inicio_ciclo_turno).slice(0, 10);

        const estadoHoy     = calcularEstadoCiclo(turnoObj, fechaInicioStr, hoy);
        const estadoMañana  = calcularEstadoCiclo(turnoObj, fechaInicioStr, mañana);
        return {
          ...js,
          trabaja_hoy:     estadoHoy.trabaja,
          trabaja_mañana:  estadoMañana.trabaja,
          estado_ciclo:    estadoHoy.trabaja ? "trabajando" : "descansando_ciclo",
        };
      }
      // Sin datos de ciclo → disponible pero sin estado de turno conocido
      return { ...js, trabaja_hoy: null, trabaja_mañana: null, estado_ciclo: "sin_turno" };
    });

    // ─── Personal Administrativo (PERS-SLOT-01) ───────────────────────────────
    // Solo se calcula trabaja_hoy/mañana cuando hay plantilla en personal_slots.
    // Sin plantilla → se muestra como "sin_turno" (no participa en cobertura).
    const { rows: administrativosRows } = await pool.query(`
      SELECT
        e.id, e.nombre_completo, e.estado_laboral, e.puesto, e.area, e.sede,
        e.telefono, e.wa_autorizado,
        e.tipo_personal,
        ps.dias_trabajo                                AS ps_dias_trabajo,
        to_char(ps.fecha_inicio_ciclo, 'YYYY-MM-DD')   AS ps_fecha_inicio_ciclo,
        ps.longitud_ciclo                              AS ps_longitud_ciclo,
        ps.horas_turno                                 AS ps_horas_turno,
        ps.hora_entrada                                AS ps_hora_entrada,
        CASE
          WHEN e.estado_laboral = 'licencia'   THEN 'licencia'
          WHEN e.estado_laboral = 'suspendido' THEN 'suspendido'
          ELSE 'activo'
        END AS estado_display,
        ev_falta.evento_id               AS falta_evento_id,
        (ev_falta.evento_id IS NOT NULL) AS faltando
      FROM employees e
      LEFT JOIN LATERAL (
        SELECT dias_trabajo, fecha_inicio_ciclo, longitud_ciclo, horas_turno, hora_entrada
        FROM personal_slots
        WHERE employee_id = e.id AND tipo = 'administrativo' AND activo = TRUE
        ORDER BY slot_numero ASC
        LIMIT 1
      ) ps ON TRUE
      LEFT JOIN LATERAL (
        SELECT er.id AS evento_id
        FROM eventos_rrhh er
        WHERE er.employee_id = e.id AND er.tipo_evento = 'falta'
          AND er.fecha::date = $1::date AND er.estado NOT IN ('anulado', 'cancelado')
        ORDER BY er.id DESC
        LIMIT 1
      ) ev_falta ON TRUE
      WHERE COALESCE(e.tipo_personal, 'guardia') IN ('administrativo', 'administrativo_rrhh', 'administrativo_bodega', 'gerencia')
        AND e.estado_laboral IN ('activo', 'licencia', 'suspendido')
      ORDER BY
        CASE COALESCE(e.tipo_personal, 'administrativo')
          WHEN 'gerencia'              THEN 1
          WHEN 'administrativo_rrhh'   THEN 2
          WHEN 'administrativo_bodega' THEN 3
          WHEN 'administrativo'        THEN 4
          ELSE 5
        END,
        e.area NULLS LAST, e.nombre_completo
    `, [hoy]);

    const administrativosEnriquecidos = administrativosRows.map((ad: any) => {
      if (ad.estado_display !== 'activo') {
        return { ...ad, trabaja_hoy: false, trabaja_mañana: false, estado_ciclo: ad.estado_display };
      }
      if (Array.isArray(ad.ps_dias_trabajo) && ad.ps_dias_trabajo.length > 0 && ad.ps_fecha_inicio_ciclo) {
        const dias = (ad.ps_dias_trabajo as any[]).map((d) => Number(d)).filter((d) => Number.isFinite(d));
        const lc = Number(ad.ps_longitud_ciclo) || 14;
        const trabajaHoy    = calcTrabajaPorSlotPersonal(dias, ad.ps_fecha_inicio_ciclo, hoy, lc);
        const trabajaMañana = calcTrabajaPorSlotPersonal(dias, ad.ps_fecha_inicio_ciclo, mañana, lc);
        return {
          ...ad,
          trabaja_hoy:    trabajaHoy,
          trabaja_mañana: trabajaMañana,
          estado_ciclo:   trabajaHoy ? "trabajando" : "descansando_ciclo",
        };
      }
      return { ...ad, trabaja_hoy: null, trabaja_mañana: null, estado_ciclo: "sin_turno" };
    });

    // ── Post-proceso: reclasificar "disponible" con el motor de turnos ────────
    // Un agente laboral-activo sin asignación especial puede estar:
    //   a) Trabajando hoy (su turno dice que trabaja)
    //   b) Descansando por ciclo (su turno dice que descansa)
    //   c) Genuinamente disponible (no tiene puesto titular o turno sin ciclo)
    const trabajando:       any[] = [];
    const descansandoCiclo: any[] = [];
    const disponibles:      any[] = [];
    const enPuesto:         any[] = [];
    const enSSA:            any[] = [];
    const enDescanso:       any[] = [];
    const suspendidos:      any[] = [];
    const faltando:         any[] = [];
    const enVacaciones:     any[] = [];

    // Helper: ¿el agente está DENTRO de su ventana laboral ahora mismo?
    // Para turnos diarios cortos (≤12h) con hora_entrada configurada.
    // Maneja cruce de medianoche (ej. turno 19:00-07:00).
    const estaEnVentanaLaboral = (horaEntradaStr: string, horasTrabajo: number): boolean => {
      const [hh, mm] = horaEntradaStr.split(":").map(Number);
      if (isNaN(hh) || isNaN(mm)) return true; // sin dato → asumir trabajando
      const nowGT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Guatemala" }));
      const ahora = nowGT.getHours() * 60 + nowGT.getMinutes();
      const inicio = hh * 60 + mm;
      const fin    = inicio + horasTrabajo * 60;
      return fin > 1440
        ? (ahora >= inicio || ahora < fin - 1440)   // turno cruza medianoche
        : (ahora >= inicio && ahora < fin);
    };

    for (const a of agentes) {
      // Vacaciones activas tienen prioridad sobre la categoría de ciclo
      if (a.vacacion_activa_tipo) {
        if (a.vacacion_activa_tipo === 'vacaciones_trabajadas') {
          // Vacaciones trabajadas: el empleado SÍ trabaja, pero se señala con badge especial.
          // Se deja pasar al motor de turnos y queda en 'trabajando' con flag vacacion_trabajada=true.
          a.vacacion_trabajada = true;
          // No hacemos continue: cae al switch normal → motor de turnos → trabajando/descansandoCiclo
        } else {
          // Vacaciones normales: el empleado está ausente.
          enVacaciones.push(a);
          continue;
        }
      }
      switch (a.categoria) {
        case 'en_puesto': {
          // Para turnos cortos diarios (≤12h): si el agente está fuera de su ventana laboral,
          // va a descansandoCiclo (disponible para HE) en lugar de enPuesto
          if (Number(a.horas_trabajo_turno) <= 12 && a.hora_entrada_puesto) {
            const enVentana = estaEnVentanaLaboral(String(a.hora_entrada_puesto), Number(a.horas_trabajo_turno));
            if (!enVentana) {
              descansandoCiclo.push({ ...a, disponibleHE: true });
              break;
            }
          }
          enPuesto.push(a);
          break;
        }
        case 'en_ssa':      enSSA.push(a);        break;
        case 'en_descanso': enDescanso.push(a);   break;
        case 'suspendido':  suspendidos.push(a);  break;
        case 'faltando':    faltando.push(a);     break;
        default: {
          // ── Prioridad: slot_trabaja_hoy (fuente de verdad cuando hay puesto_slots) ─────
          if (a.slot_trabaja_hoy !== null && a.slot_trabaja_hoy !== undefined) {
            if (a.slot_trabaja_hoy === false) {
              descansandoCiclo.push({ ...a, disponibleHE: true });
            } else {
              trabajando.push({ ...a, disponibleHE: false });
            }
            break;
          }
          // ── Aplicar motor de turnos si el agente tiene datos de ciclo ──────
          if (a.tipo_ciclo_turno && a.horas_trabajo_turno && a.fecha_inicio_ciclo_turno) {
            const turnoObj = {
              id: 0,
              nombre: a.turno_nombre ?? "",
              tipo_ciclo: a.tipo_ciclo_turno,
              horas_trabajo: Number(a.horas_trabajo_turno),
              horas_descanso: Number(a.horas_descanso_turno),
            };
            const fechaInicioStr = a.fecha_inicio_ciclo_turno instanceof Date
              ? a.fecha_inicio_ciclo_turno.toISOString().slice(0, 10)
              : String(a.fecha_inicio_ciclo_turno).slice(0, 10);

            const estado = calcularEstadoCiclo(turnoObj, fechaInicioStr, hoy);

            // ── Refinamiento intra-día para turnos diarios cortos (≤12h) ─────
            // calcularEstadoCiclo opera a nivel de día: para un 12x12 siempre dice "trabaja"
            // porque el ciclo cabe dentro de un día. Aquí verificamos la hora actual:
            // si el agente está fuera de su ventana laboral → descanso, disponible para HE.
            if (estado.trabaja && Number(a.horas_trabajo_turno) <= 12 && a.hora_entrada_puesto) {
              if (!estaEnVentanaLaboral(String(a.hora_entrada_puesto), Number(a.horas_trabajo_turno))) {
                descansandoCiclo.push({ ...a, disponibleHE: true });
                break;
              }
            }

            if (estado.trabaja) {
              trabajando.push({ ...a, disponibleHE: false });
            } else {
              descansandoCiclo.push({ ...a, disponibleHE: estado.disponibleHE ?? true });
            }
          } else {
            // Sin turno de ciclo → genuinamente disponible
            disponibles.push(a);
          }
        }
      }
    }

    // ── Enriquecer con hints de experiencia si se proveyó puesto_id ──────────
    if (puestoIdParam) {
      // Obtener cliente y zona del puesto contexto
      const { rows: pCtx } = await pool.query(
        `SELECT cliente_id, zona_operativa_id FROM puestos_operativos WHERE id = $1`,
        [puestoIdParam]
      );
      const ctxClienteId   = pCtx[0]?.cliente_id   ?? null;
      const ctxZonaId      = pCtx[0]?.zona_operativa_id ?? null;

      // Agentes que ya cubrieron este puesto específico (historial titular)
      const { rows: rvPuesto } = await pool.query(
        `SELECT DISTINCT employee_id FROM puesto_titular_historico WHERE puesto_id = $1`,
        [puestoIdParam]
      );
      const conocenPuestoSet = new Set(rvPuesto.map((r: any) => Number(r.employee_id)));

      // Agentes que conocen el cliente (EOA actual o historial titular de cualquier puesto de ese cliente)
      let conocenClienteSet = new Set<number>();
      if (ctxClienteId) {
        const { rows: rvCliente } = await pool.query(
          `SELECT DISTINCT eoa.employee_id
           FROM employee_operational_assignments eoa
           WHERE eoa.cliente_id = $1
           UNION
           SELECT DISTINCT pth.employee_id
           FROM puesto_titular_historico pth
           JOIN puestos_operativos po ON po.id = pth.puesto_id
           WHERE po.cliente_id = $1`,
          [ctxClienteId]
        );
        conocenClienteSet = new Set(rvCliente.map((r: any) => Number(r.employee_id)));
      }

      // Agentes con puesto titular en la misma zona (refuerza la señal de zona)
      let zonaExpSet = new Set<number>();
      if (ctxZonaId) {
        const { rows: rvZona } = await pool.query(
          `SELECT DISTINCT titular_employee_id AS employee_id
           FROM puestos_operativos
           WHERE zona_operativa_id = $1 AND activo = TRUE AND titular_employee_id IS NOT NULL`,
          [ctxZonaId]
        );
        zonaExpSet = new Set(rvZona.map((r: any) => Number(r.employee_id)));
      }

      // Anotar todos los grupos con los hints
      const annotate = (arr: any[]) =>
        arr.map((a: any) => ({
          ...a,
          conoce_puesto:  conocenPuestoSet.has(Number(a.id)),
          conoce_cliente: conocenClienteSet.has(Number(a.id)),
          misma_zona_exp: zonaExpSet.has(Number(a.id)),
        }));

      trabajando.splice(0, trabajando.length, ...annotate(trabajando));
      descansandoCiclo.splice(0, descansandoCiclo.length, ...annotate(descansandoCiclo));
      disponibles.splice(0, disponibles.length, ...annotate(disponibles));
      faltando.splice(0, faltando.length, ...annotate(faltando));
      enSSA.splice(0, enSSA.length, ...annotate(enSSA));
      enPuesto.splice(0, enPuesto.length, ...annotate(enPuesto));
    }

    // ── Inyectar supervisores/jefes disponibles como contingencia en el pool ─────
    // Solo los que pueden cubrir pero NO están en turno activo:
    //   - supervisores con disponible_he=true → van a descansandoCiclo (disponibles para HE)
    //   - jefes_servicio que no trabajan hoy y están activos → igual
    // Así rankCandidatos los ve y les asigna grupo P5 (contingencia).
    for (const sv of supervisoresEnriquecidos) {
      if (sv.estado_laboral !== 'activo') continue;
      if (sv.disponible_he) {
        descansandoCiclo.push({ ...sv, tipo_personal: 'supervisor', disponibleHE: true });
      }
    }
    for (const js of jefesServicioEnriquecidos) {
      if (js.estado_laboral !== 'activo') continue;
      if (!js.trabaja_hoy) {
        descansandoCiclo.push({ ...js, tipo_personal: 'jefe_servicio', disponibleHE: true });
      }
    }

    // ── Separar "Haciendo horas extra" de descansandoCiclo ───────────────────────
    // Un agente de descanso que tiene una cobertura activa hoy (relevo en su día libre)
    // se mueve a haciendoHE para mostrarlo separado en el pool y no confundir el conteo
    // de agentes genuinamente disponibles para cubrir.
    const haciendoHE: any[] = [];
    {
      const quedanDescansando: any[] = [];
      for (const a of descansandoCiclo) {
        if (a.cs_trabajando_hoy === true) {
          haciendoHE.push({ ...a, disponibleHE: false, haciendo_he: true });
        } else {
          quedanDescansando.push(a);
        }
      }
      descansandoCiclo.splice(0, descansandoCiclo.length, ...quedanDescansando);
    }

    // ── Separar disponibles que ya están cubriendo hoy ─────────────────────────
    const disponiblesCubriendo: any[] = [];
    {
      const quedanDisponibles: any[] = [];
      for (const a of disponibles) {
        if (a.cs_trabajando_hoy === true) {
          disponiblesCubriendo.push({ ...a, cubriendo_hoy: true });
        } else {
          quedanDisponibles.push(a);
        }
      }
      disponibles.splice(0, disponibles.length, ...quedanDisponibles);
    }

    // ── Separar vacacionistas que están cubriendo hoy ──────────────────────────
    const vacacionistasCubriendo: any[] = [];
    {
      const quedanVacaciones: any[] = [];
      for (const a of enVacaciones) {
        if (a.cs_trabajando_hoy === true) {
          vacacionistasCubriendo.push({ ...a, cubriendo_hoy: true });
        } else {
          quedanVacaciones.push(a);
        }
      }
      enVacaciones.splice(0, enVacaciones.length, ...quedanVacaciones);
    }

    res.json({
      trabajando,
      descansandoCiclo,
      haciendoHE,
      disponibles,
      disponiblesCubriendo,
      vacacionistasCubriendo,
      enPuesto,
      enSSA,
      enDescanso,
      suspendidos,
      faltando,
      enVacaciones,
      supervisores: supervisoresEnriquecidos,
      jefes_servicio: jefesServicioEnriquecidos,
      administrativos: administrativosEnriquecidos,
      fecha_hoy: hoy,
      fecha_mañana: mañana,
      total: agentes.length,
    });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/pool error");
    res.status(500).json({ error: "Error al cargar pool" });
  }
});

// ─── GET /api/operaciones/agentes/:id/disponibilidad ─────────────────────────

router.get("/operaciones/agentes/:id/disponibilidad", async (req, res) => {
  try {
    const { rows: puestos } = await pool.query(
      `SELECT po.nombre, po.cliente_nombre, po.turno
       FROM puestos_operativos po
       WHERE po.agente_id=$1 AND po.activo=TRUE`,
      [req.params.id]
    );
    const { rows: emp } = await pool.query(
      `SELECT id, nombre_completo, estado_laboral, puesto FROM employees WHERE id=$1`,
      [req.params.id]
    );
    if (!emp.length) return res.status(404).json({ error: "Agente no encontrado" });

    res.json({
      agente: emp[0],
      puestosActivos: puestos,
      disponible: puestos.length === 0 && emp[0].estado_laboral === 'activo',
    });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/agentes/:id/disponibilidad error");
    res.status(500).json({ error: "Error al verificar disponibilidad" });
  }
});

export default router;
