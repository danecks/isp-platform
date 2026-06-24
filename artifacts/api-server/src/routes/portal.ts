/**
 * Portal de Clientes — API Routes
 *
 * Todos los endpoints requieren:
 *   x-isp-role: "cliente"
 *   x-isp-clienteid: "<clienteId del usuario autenticado>"
 *
 * El clienteId se usa como llave de aislamiento — un cliente nunca
 * puede ver datos de otro, aunque manipule los headers (validación adicional
 * por JWT/session real se puede agregar en el futuro sin cambiar estos endpoints).
 */

import { Router, Request, Response, NextFunction } from "express";
import { db, incidentsTable, agentAssignmentsTable, employeesTable } from "@workspace/db";
import { pool } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, and, desc, gte, count, sql } from "drizzle-orm";
import { puestoEstadoCoberturaSql } from "../lib/cobertura-puesto";

const portalRouter = Router();

// ─── Middleware de autenticación del portal — C-02 (valida contra DB) ─────────
export async function requirePortalAuth(req: Request, res: Response, next: NextFunction) {
  const rol = (req.headers["x-isp-role"] as string)?.toLowerCase();
  const clienteId = req.headers["x-isp-clienteid"] as string;

  if (rol !== "cliente" || !clienteId || clienteId.trim() === "") {
    return res.status(403).json({ error: "Acceso denegado al portal de clientes" });
  }

  const cid = clienteId.trim();
  const userIdHeader = req.headers["x-isp-userid"] as string | undefined;
  const userId = userIdHeader ? parseInt(userIdHeader) : NaN;

  try {
    // USR-MULTI-01: validar que el usuario tenga vínculo con el cliente solicitado.
    // Compatibilidad: si no se manda x-isp-userid, fallback a validación legacy users.cliente_id.
    if (!isNaN(userId)) {
      const { rows } = await pool.query<{ id: number }>(
        `SELECT u.id
           FROM users u
           JOIN usuarios_clientes uc ON uc.user_id = u.id
          WHERE u.id = $1
            AND uc.portal_cliente_id = $2
            AND u.estado = 'activo'
            AND u.rol = 'cliente'
          LIMIT 1`,
        [userId, cid]
      );
      if (rows.length === 0) {
        return res.status(403).json({ error: "Acceso denegado: el usuario no está vinculado a este cliente" });
      }
      (req as any).portalUserId = userId;
    } else {
      // Legacy (sesiones antiguas sin x-isp-userid)
      const { rows } = await pool.query<{ id: number }>(
        `SELECT id FROM users WHERE cliente_id = $1 AND estado = 'activo' AND rol = 'cliente' LIMIT 1`,
        [cid]
      );
      if (rows.length === 0) {
        return res.status(403).json({ error: "Credenciales de portal inválidas o cuenta inactiva" });
      }
      (req as any).portalUserId = rows[0].id;
    }

    // Resolver el ID entero en la tabla clients (via portal_cliente_id)
    const { rows: clientRows } = await pool.query<{ id: number }>(
      `SELECT id FROM clients WHERE portal_cliente_id = $1 LIMIT 1`,
      [cid]
    );
    (req as any).portalClienteIntId = clientRows[0]?.id ?? null;
  } catch (err) {
    // Fail-closed: si falla la validación de acceso, NO permitir el request.
    req.log?.error({ err }, "requirePortalAuth: fallo validando acceso");
    return res.status(500).json({ error: "No fue posible validar el acceso al portal" });
  }

  (req as any).portalClienteId = cid;
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/portal/mis-clientes — lista clientes vinculados al usuario actual
// No usa requirePortalAuth porque puede llamarse antes de tener cliente activo
// ─────────────────────────────────────────────────────────────────────────────
portalRouter.get("/portal/mis-clientes", async (req, res) => {
  const rol = (req.headers["x-isp-role"] as string)?.toLowerCase();
  const userIdHeader = req.headers["x-isp-userid"] as string | undefined;
  const userId = userIdHeader ? parseInt(userIdHeader) : NaN;
  if (rol !== "cliente" || isNaN(userId)) {
    return res.status(403).json({ error: "Acceso denegado" });
  }
  try {
    // Verificar usuario activo
    const { rows: uRows } = await pool.query(
      `SELECT id, cliente_id FROM users WHERE id = $1 AND estado = 'activo' AND rol = 'cliente' LIMIT 1`,
      [userId]
    );
    if (uRows.length === 0) {
      return res.status(403).json({ error: "Usuario inactivo o no autorizado" });
    }
    const defaultCid: string | null = uRows[0].cliente_id;

    const { rows } = await pool.query(
      `SELECT uc.portal_cliente_id, uc.es_default,
              c.id AS cliente_db_id,
              COALESCE(c.nombre_comercial, c.nombre, uc.portal_cliente_id) AS nombre
         FROM usuarios_clientes uc
         LEFT JOIN clients c ON c.portal_cliente_id = uc.portal_cliente_id
        WHERE uc.user_id = $1
        ORDER BY uc.es_default DESC, nombre ASC`,
      [userId]
    );

    // Marcar default real (la columna es_default puede estar desincronizada con users.cliente_id)
    const enriched = rows.map((r: any) => ({
      ...r,
      es_default: r.portal_cliente_id === defaultCid || r.es_default,
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener clientes vinculados" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/portal/dashboard — resumen ejecutivo del cliente
// ─────────────────────────────────────────────────────────────────────────────
portalRouter.get("/portal/dashboard", requirePortalAuth, async (req, res) => {
  const clienteId: string = (req as any).portalClienteId;
  const clienteIntId: number | null = (req as any).portalClienteIntId;

  try {
    // ─── Incidencias (agregaciones SQL en lugar de cargar todo a memoria) ───
    const { rows: incRes } = await pool.query<{
      total: string; activas: string; resueltas: string;
      del_mes: string; del_mes_anterior: string;
    }>(
      `SELECT
         COUNT(*)::text                                                            AS total,
         COUNT(*) FILTER (WHERE estado IN ('abierta','en_proceso'))::text          AS activas,
         COUNT(*) FILTER (WHERE estado = 'cerrada')::text                          AS resueltas,
         COUNT(*) FILTER (WHERE fecha >= date_trunc('month', NOW()))::text         AS del_mes,
         COUNT(*) FILTER (
           WHERE fecha >= date_trunc('month', NOW() - INTERVAL '1 month')
             AND fecha <  date_trunc('month', NOW())
         )::text                                                                   AS del_mes_anterior
       FROM incidents
       WHERE cliente_ref_id = $1`,
      [clienteId]
    );
    const incAgg = incRes[0] ?? { total: "0", activas: "0", resueltas: "0", del_mes: "0", del_mes_anterior: "0" };
    const total          = parseInt(incAgg.total, 10) || 0;
    const activas        = parseInt(incAgg.activas, 10) || 0;
    const resueltas      = parseInt(incAgg.resueltas, 10) || 0;
    const delMes         = parseInt(incAgg.del_mes, 10) || 0;
    const delMesAnterior = parseInt(incAgg.del_mes_anterior, 10) || 0;

    // ─── Recientes (top 5) ───
    const { rows: recientes } = await pool.query(
      `SELECT id, tipo, prioridad, estado, ubicacion, fecha, responsable
         FROM incidents
        WHERE cliente_ref_id = $1
        ORDER BY fecha DESC
        LIMIT 5`,
      [clienteId]
    );

    // ─── Agentes asignados (fuente real: puesto_slots + fallback titular legacy) ───
    // Cuenta empleados ÚNICOS asignados a algún slot/puesto activo del cliente.
    let agentesActivos = 0;
    let agentesEnServicio = 0;
    let puestosActivos = 0;
    if (clienteIntId) {
      const { rows: agRes } = await pool.query<{
        agentes: string; puestos: string; en_servicio: string;
      }>(
        `WITH puestos_cli AS (
           SELECT id FROM puestos_operativos
            WHERE cliente_id = $1 AND activo = TRUE
         ),
         empleados_asignados AS (
           SELECT DISTINCT ps.empleado_id AS emp_id
             FROM puesto_slots ps
            WHERE ps.puesto_id IN (SELECT id FROM puestos_cli)
              AND ps.activo = TRUE
              AND ps.empleado_id IS NOT NULL
           UNION
           SELECT DISTINCT COALESCE(po.titular_employee_id, po.agente_id) AS emp_id
             FROM puestos_operativos po
            WHERE po.id IN (SELECT id FROM puestos_cli)
              AND COALESCE(po.titular_employee_id, po.agente_id) IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM puesto_slots ps2
                 WHERE ps2.puesto_id = po.id AND ps2.activo = TRUE
              )
         ),
         en_servicio_ahora AS (
           SELECT DISTINCT af.employee_id
             FROM agente_fichajes af
            WHERE af.puesto_id IN (SELECT id FROM puestos_cli)
              AND af.tipo = 'inicio_turno'
              AND af.turno_cerrado_en IS NULL
              AND af.employee_id IS NOT NULL
              AND af.registrado_en >= NOW() - INTERVAL '36 hours'
         )
         SELECT
           (SELECT COUNT(*) FROM empleados_asignados)::text AS agentes,
           (SELECT COUNT(*) FROM puestos_cli)::text         AS puestos,
           (SELECT COUNT(*) FROM en_servicio_ahora)::text   AS en_servicio`,
        [clienteIntId]
      );
      agentesActivos    = parseInt(agRes[0]?.agentes ?? "0", 10) || 0;
      puestosActivos    = parseInt(agRes[0]?.puestos ?? "0", 10) || 0;
      agentesEnServicio = parseInt(agRes[0]?.en_servicio ?? "0", 10) || 0;
    }

    res.json({
      clienteId,
      incidencias: {
        total,
        activas,
        resueltas,
        delMes,
        delMesAnterior,
        variacionMes: delMesAnterior > 0
          ? Math.round(((delMes - delMesAnterior) / delMesAnterior) * 100)
          : 0,
        recientes,
      },
      agentes: {
        activos: agentesActivos,
        enServicioAhora: agentesEnServicio,
        puestos: puestosActivos,
      },
      estadoServicio: activas === 0
        ? "operativo"
        : activas <= 2
        ? "atencion"
        : "critico",
    });
  } catch (err) {
    console.error("[portal/dashboard]", err);
    res.status(500).json({ error: "Error al obtener datos del dashboard" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/portal/incidencias — incidencias del cliente (filtradas)
// ─────────────────────────────────────────────────────────────────────────────
portalRouter.get("/portal/incidencias", requirePortalAuth, async (req, res) => {
  const clienteId: string = (req as any).portalClienteId;
  const { estado, tipo } = req.query as Record<string, string>;

  try {
    const incidents = await db
      .select()
      .from(incidentsTable)
      .where(eq(incidentsTable.clienteRefId, clienteId))
      .orderBy(desc(incidentsTable.fecha));

    const filtered = incidents.filter((i) => {
      if (estado && i.estado !== estado) return false;
      if (tipo && i.tipo !== tipo) return false;
      return true;
    });

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener incidencias" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/portal/incidencias — el cliente reporta una nueva incidencia
// ─────────────────────────────────────────────────────────────────────────────
portalRouter.post("/portal/incidencias", requirePortalAuth, async (req, res) => {
  const clienteId: string = (req as any).portalClienteId;
  const clienteIntId: number | null = (req as any).portalClienteIntId;

  const { tipo, prioridad, ubicacion, descripcion, esEmergencia } = (req.body ?? {}) as {
    tipo?: string;
    prioridad?: string;
    ubicacion?: string;
    descripcion?: string;
    esEmergencia?: boolean;
  };

  // Validación mínima
  const tipoLimpio = (tipo ?? "").trim();
  const descLimpia = (descripcion ?? "").trim();
  if (!tipoLimpio || tipoLimpio.length > 100) {
    return res.status(400).json({ error: "El tipo de incidencia es requerido (máx 100 caracteres)." });
  }
  if (!descLimpia || descLimpia.length < 5) {
    return res.status(400).json({ error: "La descripción es requerida (mínimo 5 caracteres)." });
  }
  if (descLimpia.length > 2000) {
    return res.status(400).json({ error: "La descripción es demasiado larga (máx 2000 caracteres)." });
  }
  const ubicacionLimpia = (ubicacion ?? "").trim();
  if (ubicacionLimpia.length > 200) {
    return res.status(400).json({ error: "La ubicación es demasiado larga (máx 200 caracteres)." });
  }
  const prioridadOk = ["alta", "media", "baja"].includes((prioridad ?? "").toLowerCase());
  const prioridadFinal = prioridadOk ? (prioridad as string).toLowerCase() : "media";

  // Resolver el nombre del cliente para el campo `cliente` (texto)
  let clienteNombre = clienteId;
  try {
    if (clienteIntId) {
      const { rows } = await pool.query<{ nombre_comercial: string | null; nombre: string | null }>(
        `SELECT nombre_comercial, nombre FROM clients WHERE id = $1 LIMIT 1`,
        [clienteIntId]
      );
      clienteNombre = rows[0]?.nombre_comercial || rows[0]?.nombre || clienteId;
    }
  } catch { /* fallback a clienteId */ }

  // Generar id legible: INC-YYMMDD-NNNN
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(2);
  const rand = Math.floor(Math.random() * 9000) + 1000;
  const id = `INC-${yy}${mm}${dd}-${rand}`;

  try {
    await pool.query(
      `INSERT INTO incidents
         (id, origen, cliente, cliente_ref_id, client_id, ubicacion, tipo,
          prioridad, estado, responsable, descripcion, es_emergencia, reportado_por)
       VALUES ($1, 'portal_cliente', $2, $3, $4, $5, $6, $7, 'abierta',
               'Sin asignar', $8, $9, $10)`,
      [
        id,
        clienteNombre,
        clienteId,
        clienteIntId ?? null,
        ubicacionLimpia || null,
        tipoLimpio,
        prioridadFinal,
        descLimpia,
        !!esEmergencia,
        `Cliente vía portal (${clienteNombre})`,
      ]
    );

    res.status(201).json({ ok: true, id });
  } catch (err) {
    console.error("[portal/incidencias POST]", err);
    res.status(500).json({ error: "No se pudo registrar la incidencia. Intente más tarde." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/portal/kpi — métricas KPI del cliente
// ─────────────────────────────────────────────────────────────────────────────
// A-15: KPI con agregación SQL en lugar de JS en memoria
portalRouter.get("/portal/kpi", requirePortalAuth, async (req, res) => {
  const clienteId: string = (req as any).portalClienteId;

  try {
    // 1. Resumen general
    const { rows: resumenRows } = await pool.query<{
      total: string; activas: string; resueltas: string;
    }>(`
      SELECT
        COUNT(*)                                                     AS total,
        COUNT(*) FILTER (WHERE estado IN ('abierta','en_proceso'))   AS activas,
        COUNT(*) FILTER (WHERE estado IN ('cerrada','resuelta'))     AS resueltas
      FROM incidents
      WHERE cliente_ref_id = $1
    `, [clienteId]);

    const resumen = resumenRows[0] ?? { total: "0", activas: "0", resueltas: "0" };
    const total = parseInt(resumen.total);
    const resueltas = parseInt(resumen.resueltas);
    const tasaResolucion = total > 0 ? Math.round((resueltas / total) * 100) : 0;

    // 2. Tendencia mensual (últimos 6 meses) con DATE_TRUNC
    const now = new Date();
    const seisAtras = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const { rows: tendRows } = await pool.query<{
      mes_label: string; total: string; resueltas: string; abiertas: string;
    }>(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', fecha), 'Mon YY')               AS mes_label,
        COUNT(*)                                                      AS total,
        COUNT(*) FILTER (WHERE estado IN ('cerrada','resuelta'))      AS resueltas,
        COUNT(*) FILTER (WHERE estado IN ('abierta','en_proceso'))    AS abiertas
      FROM incidents
      WHERE cliente_ref_id = $1
        AND fecha >= $2
      GROUP BY DATE_TRUNC('month', fecha)
      ORDER BY DATE_TRUNC('month', fecha) ASC
    `, [clienteId, seisAtras]);

    const tendenciaMensual = tendRows.map((r) => ({
      mes: r.mes_label,
      total: parseInt(r.total),
      resueltas: parseInt(r.resueltas),
      abiertas: parseInt(r.abiertas),
    }));

    // 3. Por tipo
    const { rows: tipoRows } = await pool.query<{ tipo: string; total: string }>(`
      SELECT tipo, COUNT(*) AS total
      FROM incidents
      WHERE cliente_ref_id = $1
      GROUP BY tipo
      ORDER BY total DESC
    `, [clienteId]);

    const porTipo: Record<string, number> = {};
    for (const row of tipoRows) { porTipo[row.tipo] = parseInt(row.total); }

    // 4. Por prioridad
    const { rows: prioRows } = await pool.query<{ prioridad: string; total: string }>(`
      SELECT prioridad, COUNT(*) AS total
      FROM incidents
      WHERE cliente_ref_id = $1
      GROUP BY prioridad
    `, [clienteId]);

    const porPrioridad = { alta: 0, media: 0, baja: 0 } as Record<string, number>;
    for (const row of prioRows) { porPrioridad[row.prioridad] = parseInt(row.total); }

    // 5. Tiempo promedio de resolución (ahora tenemos fecha_cierre)
    const { rows: slaRows } = await pool.query<{ promedio_horas: string | null }>(`
      SELECT AVG(EXTRACT(EPOCH FROM (fecha_cierre - fecha)) / 3600) AS promedio_horas
      FROM incidents
      WHERE cliente_ref_id = $1
        AND fecha_cierre IS NOT NULL
        AND estado IN ('cerrada','resuelta')
    `, [clienteId]);

    const tiempoPromedioHoras = slaRows[0]?.promedio_horas
      ? Math.round(parseFloat(slaRows[0].promedio_horas) * 10) / 10
      : null;

    res.json({
      clienteId,
      resumen: {
        total,
        activas: parseInt(resumen.activas),
        resueltas,
        tasaResolucion,
      },
      tendenciaMensual,
      porTipo,
      porPrioridad,
      tiempoPromedioResolucion: tiempoPromedioHoras,
    });
  } catch (err) {
    console.error("[portal/kpi]", err);
    res.status(500).json({ error: "Error al obtener KPI" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/portal/agentes — agentes asignados al cliente
//
// C-04 FIX: Ahora lee desde puestos_operativos (fuente oficial) en lugar de
// agent_assignments (tabla legada). Cada puesto activo del cliente con un
// empleado titular/agente asignado aparece como un registro.
//
// PRIVACIDAD: Solo expone datos operativos seguros.
// NO se incluye: DPI, teléfono personal, correo, dirección, info disciplinaria.
// ─────────────────────────────────────────────────────────────────────────────
portalRouter.get("/portal/agentes", requirePortalAuth, async (req, res) => {
  // FIX BUG-PORTAL-AG: el portal_cliente_id es un string (UUID o slug),
  // no un número. Usamos el ID entero ya resuelto por el middleware (portalClienteIntId).
  const clienteIntId: number | null = (req as any).portalClienteIntId;

  if (!clienteIntId) {
    // Sin cliente vinculado: lista vacía en lugar de 400, evita pantalla negra en el portal.
    return res.json([]);
  }
  const clienteIdNum = clienteIntId;

  try {
    // Devolvemos un registro por SLOT del puesto (cada puesto puede tener varios slots
    // con titulares y horarios distintos). Si un puesto no tiene slots configurados,
    // se devuelve 1 fila con los datos del titular legacy del puesto.
    // Calculamos día actual del ciclo y si el agente trabaja o descansa hoy.
    const { rows } = await pool.query<any>(
      `WITH slots_unidos AS (
         -- Slots reales (puesto_slots): 1 fila por slot
         SELECT
           po.id                          AS puesto_id,
           ps.slot_numero                 AS slot_numero,
           ps.empleado_id                 AS slot_emp_id,
           ps.hora_entrada::text          AS slot_hora_entrada,
           ps.horas_turno                 AS slot_horas_turno,
           ps.dias_trabajo                AS slot_dias_trabajo,
           ps.longitud_ciclo              AS slot_longitud_ciclo,
           COALESCE(ps.fecha_inicio_ciclo, po.fecha_inicio_ciclo, po.created_at::date) AS slot_inicio_ciclo
         FROM puestos_operativos po
         JOIN puesto_slots ps ON ps.puesto_id = po.id AND ps.activo = TRUE
         WHERE po.cliente_id = $1 AND po.activo = TRUE

         UNION ALL

         -- Fallback: puestos sin slots → 1 fila virtual usando titular legacy del puesto
         SELECT
           po.id                          AS puesto_id,
           1                              AS slot_numero,
           COALESCE(po.titular_employee_id, po.agente_id) AS slot_emp_id,
           po.hora_entrada                AS slot_hora_entrada,
           NULL::int                      AS slot_horas_turno,
           NULL::int[]                    AS slot_dias_trabajo,
           NULL::smallint                 AS slot_longitud_ciclo,
           COALESCE(po.fecha_inicio_ciclo, po.created_at::date) AS slot_inicio_ciclo
         FROM puestos_operativos po
         WHERE po.cliente_id = $1 AND po.activo = TRUE
           AND NOT EXISTS (SELECT 1 FROM puesto_slots ps WHERE ps.puesto_id = po.id AND ps.activo = TRUE)
       ),
       turnos_activos AS (
         -- Último fichaje abierto por (puesto, slot) en últimas 36h
         SELECT DISTINCT ON (af.puesto_id, COALESCE(af.slot_numero, 1))
           af.puesto_id,
           COALESCE(af.slot_numero, 1) AS slot_numero,
           af.employee_id              AS en_servicio_emp_id
         FROM agente_fichajes af
         WHERE af.tipo = 'inicio_turno'
           AND af.turno_cerrado_en IS NULL
           AND af.registrado_en >= NOW() - INTERVAL '36 hours'
         ORDER BY af.puesto_id, COALESCE(af.slot_numero, 1), af.registrado_en DESC
       )
       SELECT
         (su.puesto_id * 100 + su.slot_numero)        AS "asignacionId",
         NULLIF(TRIM(po.nombre), '')                  AS "codigoAsignacion",
         po.nombre                                    AS "puesto",
         COALESCE(po.turno, po.jornada, po.tipo_servicio) AS "servicio",
         COALESCE(
           NULLIF(TRIM(CONCAT_WS(' — ', cs.nombre, cs.direccion)), ''),
           NULLIF(TRIM(po.direccion), ''),
           oz.nombre
         )                                            AS "ubicacion",
         COALESCE(e_emp.supervisor_nombre, e_tit.supervisor_nombre) AS "supervisorNombre",
         COALESCE(po.fecha_inicio_ciclo, po.created_at, NOW()) AS "fechaInicio",
         NULL::timestamptz                            AS "fechaFin",
         CASE
           WHEN COALESCE(e_emp.nombre_completo, e_tit.nombre_completo, po.titular_nombre, po.agente_nombre) IS NULL
             THEN 'vacante'
           ELSE 'activa'
         END                                          AS "estadoAsignacion",
         COALESCE(
           e_emp.nombre_completo,
           e_tit.nombre_completo,
           po.titular_nombre,
           po.agente_nombre,
           'Puesto sin titular asignado'
         )                                            AS "empleadoNombreCompleto",
         COALESCE(e_emp.area, e_tit.area)             AS "empleadoArea",
         COALESCE(e_emp.estado_laboral, e_tit.estado_laboral, 'activo') AS "empleadoEstadoLaboral",
         COALESCE(e_emp.sede, e_tit.sede, cs.nombre)  AS "empleadoSede",
         COALESCE(e_emp.source_system, e_tit.source_system, 'manual') AS "empleadoFuente",
         (ta.en_servicio_emp_id IS NOT NULL)         AS "enServicioAhora",
         e_serv.nombre_completo                       AS "enServicioNombre",
         -- Datos del slot
         su.slot_numero                               AS "slotNumero",
         su.slot_hora_entrada                         AS "slotHoraEntrada",
         su.slot_horas_turno                          AS "slotHorasTurno",
         su.slot_dias_trabajo                         AS "slotDiasTrabajo",
         COALESCE(su.slot_longitud_ciclo, 14)         AS "slotLongitudCiclo",
         -- Día actual del ciclo (1..longitud_ciclo). NULL si el ciclo aún no inicia.
         CASE
           WHEN CURRENT_DATE < su.slot_inicio_ciclo THEN NULL::int
           ELSE (((CURRENT_DATE - su.slot_inicio_ciclo)::int % NULLIF(COALESCE(su.slot_longitud_ciclo, 14)::int, 0)) + 1)
         END                                          AS "diaCicloActual",
         -- ¿Trabaja hoy? NULL si dias_trabajo vacío o ciclo aún no inicia.
         CASE
           WHEN su.slot_dias_trabajo IS NULL OR array_length(su.slot_dias_trabajo, 1) IS NULL THEN NULL::boolean
           WHEN CURRENT_DATE < su.slot_inicio_ciclo THEN NULL::boolean
           ELSE (
             (((CURRENT_DATE - su.slot_inicio_ciclo)::int % NULLIF(COALESCE(su.slot_longitud_ciclo, 14)::int, 0)) + 1)
             = ANY(su.slot_dias_trabajo)
           )
         END                                          AS "trabajaHoy"
       FROM slots_unidos su
       JOIN puestos_operativos po          ON po.id = su.puesto_id
       LEFT JOIN client_sedes       cs     ON cs.id = po.sede_id
       LEFT JOIN operational_zones  oz     ON oz.id = po.zona_operativa_id
       LEFT JOIN employees          e_emp  ON e_emp.id = su.slot_emp_id
       LEFT JOIN employees          e_tit  ON e_tit.id = COALESCE(po.titular_employee_id, po.agente_id)
       LEFT JOIN turnos_activos     ta     ON ta.puesto_id = su.puesto_id AND ta.slot_numero = su.slot_numero
       LEFT JOIN employees          e_serv ON e_serv.id = ta.en_servicio_emp_id
       ORDER BY cs.nombre NULLS LAST, po.nombre, su.slot_numero`,
      [clienteIdNum]
    );

    res.json(rows);
  } catch (err) {
    console.error("[portal/agentes]", err);
    res.status(500).json({ error: "Error al obtener agentes asignados" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/portal/cobertura — puestos contratados y estado de cobertura
// ─────────────────────────────────────────────────────────────────────────────
portalRouter.get("/portal/cobertura", requirePortalAuth, async (req, res) => {
  const clienteIntId: number | null = (req as any).portalClienteIntId;

  if (!clienteIntId) {
    return res.json({ puestos: [], resumen: { total: 0, cubiertos: 0, vacantes: 0, tasa: 0 } });
  }

  try {
    // 1) Puestos operativos "estándar" (modelo de fijos / planta)
    //    FIX BUG-PORTAL-COB: además del titular formal, considerar como "cubierto"
    //    cualquier puesto donde haya un agente con turno abierto (fichaje sin cierre).
    //    Devolvemos también el nombre del agente real que está adentro ahora.
    const { rows: puestosFijos } = await pool.query<{
      puesto_id: number;
      puesto_nombre: string;
      turno: string | null;
      jornada: string | null;
      horario: string | null;
      estado: string | null;
      sede_nombre: string | null;
      sede_direccion: string | null;
      zona_nombre: string | null;
      titular_nombre: string | null;
      titular_area: string | null;
      en_servicio_nombre: string | null;
      en_servicio_desde: string | null;
    }>(`
      WITH turnos_activos AS (
        SELECT DISTINCT ON (af.puesto_id)
               af.puesto_id,
               af.registrado_en,
               COALESCE(e.nombre_completo, u.nombre, u.username) AS agente_nombre
          FROM agente_fichajes af
          LEFT JOIN employees e ON e.id = af.employee_id
          LEFT JOIN users     u ON u.employee_id = af.employee_id
         WHERE af.tipo = 'inicio_turno'
           AND af.turno_cerrado_en IS NULL
           AND af.registrado_en >= NOW() - INTERVAL '36 hours'
         ORDER BY af.puesto_id, af.registrado_en DESC
      )
      SELECT
        po.id                                     AS puesto_id,
        po.nombre                                 AS puesto_nombre,
        po.turno,
        po.jornada,
        po.horario,
        ${puestoEstadoCoberturaSql("po")}         AS estado,
        cs.nombre                                 AS sede_nombre,
        cs.direccion                              AS sede_direccion,
        oz.nombre                                 AS zona_nombre,
        COALESCE(e.nombre_completo, po.titular_nombre) AS titular_nombre,
        e.area                                    AS titular_area,
        ta.agente_nombre                          AS en_servicio_nombre,
        ta.registrado_en                          AS en_servicio_desde
      FROM puestos_operativos po
      LEFT JOIN client_sedes      cs ON cs.id  = po.sede_id
      LEFT JOIN employees         e  ON e.id   = COALESCE(po.titular_employee_id, po.agente_id)
      LEFT JOIN operational_zones oz ON oz.id  = po.zona_operativa_id
      LEFT JOIN turnos_activos    ta ON ta.puesto_id = po.id
      WHERE po.cliente_id = $1
        AND po.activo = TRUE
      ORDER BY cs.nombre NULLS LAST, po.turno, po.nombre
    `, [clienteIntId]);

    // 2) Slots de custodia (modelo de custodia / mixto) — fuente del Pizarrón
    //    Total de slots = MAX(slot_numero asignado, fuerza configurada del día actual).
    const diaSemana = new Date().getUTCDay();
    const { rows: cliRow } = await pool.query<{
      tipo_servicio: string | null;
      fuerza_hoy: number;
      max_slot_titular: number;
    }>(`
      SELECT
        c.tipo_servicio,
        COALESCE(cfs.cantidad_agentes, 0) AS fuerza_hoy,
        COALESCE((
          SELECT MAX(ct.slot_numero)
            FROM custodia_titulares ct
           WHERE ct.cliente_id = c.id AND ct.activo = TRUE
        ), 0) AS max_slot_titular
      FROM clients c
      LEFT JOIN custodia_fuerza_semanal cfs
             ON cfs.cliente_id = c.id AND cfs.dia_semana = $2
      WHERE c.id = $1
      LIMIT 1
    `, [clienteIntId, diaSemana]);

    const tipoSrv = (cliRow[0]?.tipo_servicio ?? "").toLowerCase();
    const esCustodia = tipoSrv === "custodia" || tipoSrv === "mixto";
    const fuerzaHoy = Number(cliRow[0]?.fuerza_hoy ?? 0);
    const maxSlotTitular = Number(cliRow[0]?.max_slot_titular ?? 0);
    const totalSlots = esCustodia ? Math.max(fuerzaHoy, maxSlotTitular) : 0;

    const puestosCustodia: typeof puestosFijos = [];
    if (totalSlots > 0) {
      const { rows: titularesRows } = await pool.query<{
        slot_numero: number;
        nombre: string | null;
        area: string | null;
      }>(`
        SELECT ct.slot_numero, e.nombre_completo AS nombre, e.area
          FROM custodia_titulares ct
          LEFT JOIN employees e ON e.id = ct.employee_id
         WHERE ct.cliente_id = $1 AND ct.activo = TRUE
         ORDER BY ct.slot_numero
      `, [clienteIntId]);
      const titularMap = new Map<number, { nombre: string | null; area: string | null }>();
      for (const t of titularesRows) {
        titularMap.set(Number(t.slot_numero), { nombre: t.nombre, area: t.area });
      }

      for (let i = 1; i <= totalSlots; i++) {
        const t = titularMap.get(i);
        const cubierto = !!t?.nombre;
        puestosCustodia.push({
          puesto_id: -i, // id negativo para no chocar con puestos_operativos
          puesto_nombre: `Custodio ${i}`,
          turno: "Custodia",
          jornada: null,
          horario: null,
          estado: cubierto ? "cubierto" : "descubierto",
          sede_nombre: null,
          sede_direccion: null,
          zona_nombre: null,
          titular_nombre: t?.nombre ?? null,
          titular_area: t?.area ?? null,
          en_servicio_nombre: null,
          en_servicio_desde: null,
        });
      }
    }

    const puestos = [...puestosFijos, ...puestosCustodia];
    const total = puestos.length;
    // FIX BUG-PORTAL-COB: cubierto = titular asignado O agente con turno abierto en el puesto.
    const cubiertos = puestos.filter(
      (p) => !!p.titular_nombre || !!p.en_servicio_nombre
    ).length;
    const vacantes = total - cubiertos;
    const tasa     = total > 0 ? Math.round((cubiertos / total) * 100) : 0;

    res.json({
      puestos,
      resumen: { total, cubiertos, vacantes, tasa },
    });
  } catch (err) {
    console.error("[portal/cobertura]", err);
    res.status(500).json({ error: "Error al obtener cobertura de puestos" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/portal/info — nombre comercial del cliente para el portal
// ─────────────────────────────────────────────────────────────────────────────
portalRouter.get("/portal/info", requirePortalAuth, async (req, res) => {
  const clienteIntId: number | null = (req as any).portalClienteIntId;
  const clienteId: string = (req as any).portalClienteId;

  try {
    if (clienteIntId) {
      const { rows } = await pool.query<{ nombre_comercial: string; estado_contrato: string | null; fecha_inicio_contrato: string | null }>(
        `SELECT nombre_comercial, estado_contrato, fecha_inicio_contrato FROM clients WHERE id = $1 LIMIT 1`,
        [clienteIntId]
      );
      if (rows[0]) return res.json(rows[0]);
    }
    res.json({ nombre_comercial: clienteId, estado_contrato: null, fecha_inicio_contrato: null });
  } catch {
    res.json({ nombre_comercial: clienteId, estado_contrato: null, fecha_inicio_contrato: null });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper periodo: 'hoy' | '7d' | '15d' → fecha desde (ISO)
// ─────────────────────────────────────────────────────────────────────────────
function periodoToDesde(periodo: string): string {
  const now = new Date();
  if (periodo === "hoy") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    return d.toISOString();
  }
  const dias = periodo === "15d" ? 15 : 7;
  const d = new Date(now.getTime() - dias * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/portal/qr/fichajes?periodo=hoy|7d|15d
// Fichajes de agentes en puestos del cliente
// ─────────────────────────────────────────────────────────────────────────────
portalRouter.get("/portal/qr/fichajes", requirePortalAuth, async (req, res) => {
  const clienteIntId: number | null = (req as any).portalClienteIntId;
  if (!clienteIntId) return res.json([]);
  const periodo = String(req.query.periodo || "7d");
  const desde = periodoToDesde(periodo);
  try {
    // Incluye fichajes de puesto fijo (JOIN puestos_operativos) y de custodia (cliente_id directo, sin puesto)
    const { rows } = await pool.query(
      `SELECT af.id, af.tipo, af.resultado, af.registrado_en,
              af.distancia_metros, af.calificacion,
              e.id AS employee_id, e.nombres, e.apellidos, e.empl_numero,
              po.id AS puesto_id, po.nombre AS puesto_nombre,
              af.slot_numero,
              CASE
                WHEN po.id IS NOT NULL THEN po.nombre
                WHEN af.slot_numero IS NOT NULL THEN 'Custodio ' || af.slot_numero
                ELSE 'Custodia'
              END AS servicio_nombre
         FROM agente_fichajes af
         LEFT JOIN puestos_operativos po ON po.id = af.puesto_id
         LEFT JOIN employees e ON e.id = af.employee_id
        WHERE (po.cliente_id = $1 OR af.cliente_id = $1)
          AND af.registrado_en >= $2
        ORDER BY af.registrado_en DESC
        LIMIT 500`,
      [clienteIntId, desde]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener fichajes" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/portal/qr/rondas?periodo=hoy|7d|15d
// Eventos de rondas QR escaneadas en puestos del cliente
// ─────────────────────────────────────────────────────────────────────────────
portalRouter.get("/portal/qr/rondas", requirePortalAuth, async (req, res) => {
  const clienteIntId: number | null = (req as any).portalClienteIntId;
  if (!clienteIntId) return res.json([]);
  const periodo = String(req.query.periodo || "7d");
  const desde = periodoToDesde(periodo);
  try {
    const { rows } = await pool.query(
      `SELECT ev.id, ev.escaneado_en, ev.resultado, ev.distancia_metros,
              p.id AS punto_id, p.nombre AS punto_nombre,
              r.id AS ronda_id, r.nombre AS ronda_nombre,
              u.id AS user_id, COALESCE(u.nombre, emp.nombre_completo) AS user_nombre, u.username
         FROM qr_ronda_eventos ev
         JOIN qr_ronda_puntos p ON p.id = ev.punto_id
         JOIN qr_rondas r ON r.id = p.ronda_id
         LEFT JOIN users u ON u.id = ev.user_id
         LEFT JOIN employees emp ON emp.id = ev.employee_id
        WHERE r.cliente_id = $1
          AND ev.escaneado_en >= $2
        ORDER BY ev.escaneado_en DESC
        LIMIT 500`,
      [clienteIntId, desde]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener rondas" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/portal/qr/cumplimiento?periodo=hoy|7d|15d
// Estadísticas de cumplimiento: rondas y fichajes
// ─────────────────────────────────────────────────────────────────────────────
portalRouter.get("/portal/qr/cumplimiento", requirePortalAuth, async (req, res) => {
  const clienteIntId: number | null = (req as any).portalClienteIntId;
  if (!clienteIntId) return res.json({ rondas: null, fichajes: null });
  const periodo = String(req.query.periodo || "7d");
  const desde = periodoToDesde(periodo);
  try {
    // Total puntos QR activos del cliente
    const { rows: puntosRows } = await pool.query(
      `SELECT COUNT(*)::int AS total
         FROM qr_ronda_puntos p
         JOIN qr_rondas r ON r.id = p.ronda_id
        WHERE r.cliente_id = $1 AND p.activo = TRUE AND r.activo = TRUE`,
      [clienteIntId]
    );
    const totalPuntos: number = puntosRows[0]?.total ?? 0;

    // Eventos OK por punto en el período
    const { rows: evRows } = await pool.query(
      `SELECT p.id AS punto_id, p.nombre AS punto_nombre,
              COUNT(ev.id)::int AS escaneos,
              MAX(ev.escaneado_en) AS ultimo
         FROM qr_ronda_puntos p
         JOIN qr_rondas r ON r.id = p.ronda_id
         LEFT JOIN qr_ronda_eventos ev
                ON ev.punto_id = p.id
               AND ev.escaneado_en >= $2
               AND ev.resultado = 'ok'
        WHERE r.cliente_id = $1 AND p.activo = TRUE AND r.activo = TRUE
        GROUP BY p.id, p.nombre
        ORDER BY p.nombre`,
      [clienteIntId, desde]
    );
    const puntosConEscaneo = evRows.filter((r: any) => r.escaneos > 0).length;
    const pctCumplimiento = totalPuntos > 0 ? Math.round((puntosConEscaneo / totalPuntos) * 100) : null;

    // Fichajes por puesto del cliente
    const { rows: fichRows } = await pool.query(
      `SELECT po.id AS puesto_id, po.nombre AS puesto_nombre,
              COUNT(af.id)::int AS total_fichajes,
              COUNT(*) FILTER (WHERE af.resultado = 'ok')::int AS fichajes_ok,
              MAX(af.registrado_en) AS ultimo
         FROM puestos_operativos po
         LEFT JOIN agente_fichajes af
                ON af.puesto_id = po.id
               AND af.registrado_en >= $2
        WHERE po.cliente_id = $1
        GROUP BY po.id, po.nombre
        ORDER BY po.nombre`,
      [clienteIntId, desde]
    );
    const totalPuestos = fichRows.length;
    const puestosConFichaje = fichRows.filter((r: any) => r.total_fichajes > 0).length;
    const pctFichajes = totalPuestos > 0 ? Math.round((puestosConFichaje / totalPuestos) * 100) : null;

    res.json({
      rondas: {
        total_puntos: totalPuntos,
        puntos_con_escaneo: puntosConEscaneo,
        pct_cumplimiento: pctCumplimiento,
        detalle: evRows,
      },
      fichajes: {
        total_puestos: totalPuestos,
        puestos_con_fichaje: puestosConFichaje,
        pct_cobertura: pctFichajes,
        detalle: fichRows,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener cumplimiento" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/portal/recorridos-del-dia — turnos de custodia con tracking GPS hoy
// Filtra automáticamente por el cliente activo de la sesión
// ─────────────────────────────────────────────────────────────────────────────
portalRouter.get("/portal/recorridos-del-dia", requirePortalAuth, async (req, res) => {
  const clienteIntId = (req as any).portalClienteIntId as number | null;
  if (!clienteIntId) {
    return res.status(404).json({ error: "Cliente no encontrado" });
  }
  const fecha = typeof req.query.fecha === "string" ? req.query.fecha : null;
  try {
    const params: unknown[] = [clienteIntId];
    let whereFecha = `DATE((af.registrado_en AT TIME ZONE 'America/Guatemala')) = DATE((NOW() AT TIME ZONE 'America/Guatemala'))`;
    if (fecha) {
      params.push(fecha);
      whereFecha = `DATE((af.registrado_en AT TIME ZONE 'America/Guatemala')) = $${params.length}::date`;
    }
    const { rows } = await pool.query(
      `SELECT af.id AS fichaje_id, af.employee_id, af.cliente_id, af.slot_numero,
              af.registrado_en AS inicio_en, af.turno_cerrado_en,
              e.nombre_completo AS agente_nombre,
              c.nombre AS cliente_nombre,
              (SELECT COUNT(*) FROM agente_recorrido_gps r WHERE r.fichaje_id = af.id)::int AS total_puntos,
              (SELECT MAX(r.capturado_en) FROM agente_recorrido_gps r WHERE r.fichaje_id = af.id) AS ultimo_ping
         FROM agente_fichajes af
         JOIN employees e ON e.id = af.employee_id
         LEFT JOIN clients c ON c.id = af.cliente_id
        WHERE af.tipo = 'inicio_turno'
          AND af.tracking_token_hash IS NOT NULL
          AND af.cliente_id = $1
          AND ${whereFecha}
        ORDER BY af.turno_cerrado_en NULLS FIRST, af.registrado_en DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo recorridos" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/portal/recorrido/:fichaje_id — puntos GPS de un turno (filtrado por cliente)
// ─────────────────────────────────────────────────────────────────────────────
portalRouter.get("/portal/recorrido/:fichaje_id", requirePortalAuth, async (req, res) => {
  const clienteIntId = (req as any).portalClienteIntId as number | null;
  const fichajeId = Number(req.params.fichaje_id);
  if (!clienteIntId) return res.status(404).json({ error: "Cliente no encontrado" });
  if (!Number.isFinite(fichajeId)) return res.status(400).json({ error: "id_invalido" });
  try {
    // Verificar que el turno pertenece al cliente del portal
    const { rows: turnoRows } = await pool.query(
      `SELECT af.id, af.employee_id, af.cliente_id, af.slot_numero,
              af.registrado_en AS inicio_en, af.turno_cerrado_en,
              e.nombre_completo AS agente_nombre,
              c.nombre AS cliente_nombre
         FROM agente_fichajes af
         JOIN employees e ON e.id = af.employee_id
         LEFT JOIN clients c ON c.id = af.cliente_id
        WHERE af.id = $1
          AND af.cliente_id = $2
          AND af.tipo = 'inicio_turno'
          AND af.tracking_token_hash IS NOT NULL
        LIMIT 1`,
      [fichajeId, clienteIntId]
    );
    if (turnoRows.length === 0) {
      return res.status(404).json({ error: "Turno no encontrado" });
    }
    const { rows: puntos } = await pool.query(
      `SELECT latitud AS lat, longitud AS lng, precision_metros, velocidad_mps, rumbo_grados, bateria_pct, capturado_en
         FROM agente_recorrido_gps
        WHERE fichaje_id = $1
        ORDER BY capturado_en ASC`,
      [fichajeId]
    );
    // GPS-RECO-02: incluir co-custodios anexados (líder + hijos del grupo)
    const { rows: coCustodios } = await pool.query(
      `SELECT af.id AS fichaje_id, af.employee_id, e.nombre_completo AS nombre,
              (af.id = $1) AS es_lider
         FROM agente_fichajes af
         JOIN employees e ON e.id = af.employee_id
        WHERE af.id = $1 OR af.recorrido_padre_id = $1
        ORDER BY af.registrado_en ASC`,
      [fichajeId]
    );
    res.json({ turno: turnoRows[0], puntos, total_puntos: puntos.length, co_custodios: coCustodios });
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo recorrido" });
  }
});

export default portalRouter;
