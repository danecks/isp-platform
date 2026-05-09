import { Router } from "express";
import { pool } from "@workspace/db";
import { calcularEstadoCiclo } from "../../lib/turno-calc";

export const estadoOperativoRouter = Router();

// ── GET /api/armas/estado-operativo ───────────────────────────────────────────
// Devuelve armas agrupadas por puesto con responsable de turno calculado.
estadoOperativoRouter.get("/armas/estado-operativo", async (req, res) => {
  const fecha = (req.query.fecha as string) || new Date().toISOString().slice(0, 10);
  try {
    // Puestos con arma asignada + agente titular + turno
    const { rows } = await pool.query(`
      SELECT
        a.id,
        a.id   AS arma_id,
        a.codigo, a.tipo, a.marca, a.modelo, a.calibre, a.estado AS arma_estado,
        a.numero_tenencia, a.fecha_vencimiento_tenencia,
        a.tenencia_en_tramite,
        CASE
          WHEN a.numero_tenencia IS NULL AND COALESCE(a.tenencia_en_tramite, FALSE) THEN 'en_tramite'
          WHEN a.numero_tenencia IS NULL THEN 'pendiente'
          WHEN a.fecha_vencimiento_tenencia IS NULL THEN 'vigente'
          WHEN a.fecha_vencimiento_tenencia < CURRENT_DATE THEN 'vencida'
          WHEN a.fecha_vencimiento_tenencia <= CURRENT_DATE + INTERVAL '180 days' THEN 'proximo_a_vencer'
          ELSE 'vigente'
        END AS estado_documental,
        CASE
          WHEN a.fecha_vencimiento_tenencia IS NULL THEN NULL
          ELSE (a.fecha_vencimiento_tenencia - CURRENT_DATE)::INTEGER
        END AS dias_restantes,
        a.numero_portacion, a.fecha_emision_portacion, a.fecha_vencimiento_portacion,
        a.portacion_en_tramite,
        CASE
          WHEN a.numero_portacion IS NULL AND COALESCE(a.portacion_en_tramite, FALSE) THEN 'en_tramite'
          WHEN a.numero_portacion IS NULL THEN 'pendiente'
          WHEN a.fecha_vencimiento_portacion IS NULL AND COALESCE(a.portacion_en_tramite, FALSE) THEN 'en_tramite'
          WHEN a.fecha_vencimiento_portacion IS NULL THEN 'pendiente'
          WHEN a.fecha_vencimiento_portacion < CURRENT_DATE THEN 'vencida'
          WHEN a.fecha_vencimiento_portacion <= CURRENT_DATE + INTERVAL '180 days' THEN 'proximo_a_vencer'
          ELSE 'vigente'
        END AS estado_documental_portacion,
        CASE
          WHEN a.fecha_vencimiento_portacion IS NULL THEN NULL
          ELSE (a.fecha_vencimiento_portacion - CURRENT_DATE)::INTEGER
        END AS dias_restantes_portacion,
        a.puesto_id,
        po.nombre      AS puesto_nombre,
        COALESCE(po.tipo_puesto, 'normal') AS tipo_puesto,
        po.cliente_nombre,
        po.zona_operativa_id,
        oz.nombre      AS zona_nombre,
        po.agente_id   AS titular_id,
        te.nombre_completo AS titular_nombre,
        te.tipo_personal   AS titular_tipo,
        po.tipo_turno_id,
        t.nombre       AS turno_nombre,
        t.tipo_ciclo,
        t.horas_trabajo,
        t.horas_descanso,
        po.fecha_inicio_ciclo,
        -- Ubicación interna (cuando NO está en puesto)
        COALESCE(a.ubicacion_interna, 'armeria') AS ubicacion_interna,
        -- Custodio asignado manualmente al arma (override del titular del puesto)
        a.custodio_employee_id,
        cae.nombre_completo AS custodio_asignado_nombre,
        -- Custodio actual registrado en arma_custodia
        ac.id          AS custodia_id,
        ce.id          AS custodio_id,
        ce.nombre_completo AS custodio_nombre,
        ce.tipo_personal   AS custodio_tipo,
        ac.fecha_inicio    AS custodia_desde,
        ac.tipo_origen     AS custodia_tipo_origen
      FROM armas a
      LEFT JOIN puestos_operativos po ON po.id = a.puesto_id
      LEFT JOIN employees te     ON te.id = po.agente_id
      LEFT JOIN turnos t         ON t.id  = po.tipo_turno_id
      LEFT JOIN operational_zones oz ON oz.id = po.zona_operativa_id
      LEFT JOIN arma_custodia ac ON ac.arma_id = a.id AND ac.fecha_fin IS NULL
      LEFT JOIN employees ce     ON ce.id = ac.employee_id
      LEFT JOIN employees cae    ON cae.id = a.custodio_employee_id
      WHERE a.activo = TRUE
      ORDER BY po.cliente_nombre, po.nombre, a.codigo
    `);

    // Para cada arma, calcular responsable de turno usando motor de ciclos + planificacion_futura
    // Hacemos la consulta de planificacion_futura una sola vez para todas las fechas
    const puestoIds = [...new Set(rows.map((r: any) => r.puesto_id).filter(Boolean))];

    const { rows: pfRows } = await pool.query(`
      SELECT
        pf.puesto_id,
        pf.relevo_id        AS employee_id,
        e.nombre_completo,
        e.tipo_personal,
        pf.tipo_cobertura_futura AS tipo_origen
      FROM planificacion_futura pf
      JOIN employees e ON e.id = pf.relevo_id
      WHERE pf.puesto_id = ANY($1::int[])
        AND pf.fecha = $2
        AND pf.relevo_id IS NOT NULL
        AND e.estado_laboral = 'activo'
      ORDER BY pf.created_at DESC
    `, [puestoIds, fecha]);

    const relevoPorPuesto: Record<number, any> = {};
    for (const pf of pfRows) {
      if (!relevoPorPuesto[pf.puesto_id]) relevoPorPuesto[pf.puesto_id] = pf;
    }

    const rowsEnriquecidos = rows.map((row: any) => {
      // Si hay relevo planificado hoy para este puesto, ese es el responsable
      const relevo = relevoPorPuesto[row.puesto_id] ?? null;
      if (relevo) {
        return {
          ...row,
          responsable_turno: {
            id: relevo.employee_id,
            nombre_completo: relevo.nombre_completo,
            tipo_personal: relevo.tipo_personal ?? "",
            tipo_origen: relevo.tipo_origen ?? "relevo",
          },
          descanso_por_ciclo: false,
        };
      }

      // Si no hay relevo, verificar si el titular trabaja hoy
      let responsable_turno: any = null;
      let descanso_por_ciclo = false;

      if (row.titular_id) {
        if (row.tipo_ciclo && row.horas_trabajo && row.fecha_inicio_ciclo) {
          const turno = {
            id:             row.tipo_turno_id ?? 0,
            nombre:         row.turno_nombre ?? "",
            tipo_ciclo:     row.tipo_ciclo,
            horas_trabajo:  Number(row.horas_trabajo),
            horas_descanso: Number(row.horas_descanso ?? row.horas_trabajo),
          };
          const fechaStr = row.fecha_inicio_ciclo instanceof Date
            ? row.fecha_inicio_ciclo.toISOString().slice(0, 10)
            : String(row.fecha_inicio_ciclo).slice(0, 10);
          const estado = calcularEstadoCiclo(turno, fechaStr, fecha);
          descanso_por_ciclo = estado.descansoPorCiclo ?? !estado.trabaja;
          if (estado.trabaja) {
            responsable_turno = {
              id: row.titular_id, nombre_completo: row.titular_nombre,
              tipo_personal: row.titular_tipo ?? "", tipo_origen: "turno_normal",
            };
          }
        } else {
          // Sin info de turno → asumir que trabaja
          responsable_turno = {
            id: row.titular_id, nombre_completo: row.titular_nombre,
            tipo_personal: row.titular_tipo ?? "", tipo_origen: "turno_normal",
          };
        }
      }

      return { ...row, responsable_turno, descanso_por_ciclo };
    });

    res.json(rowsEnriquecidos);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/armas/historial/global ───────────────────────────────────────────
estadoOperativoRouter.get("/armas/historial/global", async (req, res) => {
  const { limite = "100", arma_id, employee_id } = req.query as any;
  try {
    const conds: string[] = [];
    const params: any[] = [];
    if (arma_id)    { conds.push(`ac.arma_id = $${params.length + 1}`);    params.push(arma_id); }
    if (employee_id){ conds.push(`ac.employee_id = $${params.length + 1}`); params.push(employee_id); }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    params.push(Math.min(Number(limite), 500));
    const { rows } = await pool.query(`
      SELECT
        ac.*,
        a.codigo, a.tipo, a.marca, a.modelo, a.calibre,
        e.nombre_completo AS custodio_nombre,
        e.tipo_personal   AS custodio_tipo,
        po.nombre         AS puesto_nombre,
        po.cliente_nombre
      FROM arma_custodia ac
      LEFT JOIN armas a              ON a.id = ac.arma_id
      LEFT JOIN employees e          ON e.id = ac.employee_id
      LEFT JOIN puestos_operativos po ON po.id = ac.puesto_id
      ${where}
      ORDER BY ac.fecha_inicio DESC
      LIMIT $${params.length}
    `, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/armas/duplicados ─────────────────────────────────────────────────
// Lista grupos de armas con identificadores repetidos (serie / número de tenencia /
// número de portación). Para cada grupo devuelve el detalle de cada arma con su
// puesto, cliente, custodio actual y conteos de uso (custodias e historial de turno),
// para que el operador pueda decidir cuál conservar y cuál corregir/eliminar.
estadoOperativoRouter.get("/armas/duplicados", async (_req, res) => {
  try {
    const grupos: Array<{
      campo: "serie" | "numero_tenencia" | "numero_portacion";
      etiqueta: string;
      valor: string;
      armas: any[];
    }> = [];

    const checks: Array<{ col: "serie" | "numero_tenencia" | "numero_portacion"; etiqueta: string }> = [
      { col: "serie",            etiqueta: "Número de serie"     },
      { col: "numero_tenencia",  etiqueta: "Número de tenencia"  },
      { col: "numero_portacion", etiqueta: "Número de portación" },
    ];

    for (const ch of checks) {
      const { rows: dupes } = await pool.query(
        `SELECT LOWER(TRIM(${ch.col})) AS valor,
                ARRAY_AGG(id ORDER BY id) AS ids
           FROM armas
          WHERE ${ch.col} IS NOT NULL AND TRIM(${ch.col}) <> ''
          GROUP BY LOWER(TRIM(${ch.col}))
         HAVING COUNT(*) > 1
          ORDER BY MIN(id)`
      );

      for (const d of dupes) {
        const { rows: armas } = await pool.query(
          `SELECT
              a.id, a.codigo, a.tipo, a.marca, a.modelo, a.calibre,
              a.serie, a.numero_tenencia, a.numero_portacion,
              a.estado, a.activo, a.observaciones,
              a.created_at, a.updated_at,
              a.puesto_id, po.nombre AS puesto_nombre, po.cliente_nombre,
              a.custodia_cliente_id, a.custodia_slot_numero,
              cli.nombre AS custodia_cliente_nombre,
              -- custodia activa actual (si existe)
              (SELECT json_build_object(
                  'employee_id', ac.employee_id,
                  'nombre', e.nombre_completo,
                  'fecha_inicio', ac.fecha_inicio
                )
                 FROM arma_custodia ac
            LEFT JOIN employees e ON e.id = ac.employee_id
                WHERE ac.arma_id = a.id AND ac.fecha_fin IS NULL
             ORDER BY ac.fecha_inicio DESC LIMIT 1) AS custodia_actual,
              -- conteos de uso para evaluar el impacto de eliminar
              (SELECT COUNT(*)::int FROM arma_custodia        WHERE arma_id = a.id) AS total_custodias,
              (SELECT COUNT(*)::int FROM reporte_turno        WHERE arma_id = a.id) AS total_reportes,
              (SELECT COUNT(*)::int FROM arma_ordenes_servicio WHERE arma_id = a.id) AS total_ordenes
           FROM armas a
      LEFT JOIN puestos_operativos po ON po.id = a.puesto_id
      LEFT JOIN clients            cli ON cli.id = a.custodia_cliente_id
          WHERE a.id = ANY($1::int[])
          ORDER BY a.id`,
          [d.ids],
        );
        grupos.push({ campo: ch.col, etiqueta: ch.etiqueta, valor: d.valor, armas });
      }
    }
    res.json({ total: grupos.length, grupos });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
