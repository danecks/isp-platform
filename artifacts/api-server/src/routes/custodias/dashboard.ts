import { Router } from "express";
import { pool, todayGT } from "@workspace/db";
import { logger } from "../../lib/logger";

export const custodiasDashboardRouter = Router();

custodiasDashboardRouter.get("/custodias/dashboard", async (req, res) => {
  try {
    const fecha = (req.query.fecha as string) || todayGT();
    const diaSemana = new Date(fecha + "T12:00:00Z").getDay();

    const { rows: clientes } = await pool.query(`
      SELECT
        c.id,
        c.nombre,
        c.nombre_comercial,
        COALESCE(cfs.cantidad_agentes, 0) AS fuerza_hoy
      FROM clients c
      LEFT JOIN custodia_fuerza_semanal cfs
        ON cfs.cliente_id = c.id AND cfs.dia_semana = $1
      WHERE c.tipo_servicio IN ('custodia', 'mixto')
        AND c.estado = 'activo'
      ORDER BY c.nombre
    `, [diaSemana]);

    const result = [];

    for (const cl of clientes) {
      // Titulares: unión de (1) puesto_titulares con tipo_puesto='custodia' y
      // (2) custodia_titulares (slots asignados desde Pizarrón Operativo).
      const { rows: titulares } = await pool.query(`
        SELECT DISTINCT ON (e.id)
          e.id AS employee_id,
          e.nombre_completo,
          e.empl_numero,
          e.estado_laboral
        FROM (
          SELECT pt.employee_id
          FROM puesto_titulares pt
          JOIN puestos_operativos po ON po.id = pt.puesto_id
          WHERE po.cliente_id = $1
            AND po.activo = TRUE
            AND pt.activo = TRUE
            AND COALESCE(po.tipo_puesto, 'fijo') = 'custodia'
          UNION
          SELECT ct.employee_id
          FROM custodia_titulares ct
          WHERE ct.cliente_id = $1 AND ct.activo = TRUE
        ) t
        JOIN employees e ON e.id = t.employee_id
      `, [cl.id]);

      const { rows: asignados } = await pool.query(`
        SELECT
          cad.employee_id,
          e.nombre_completo,
          e.empl_numero,
          e.estado_laboral,
          cad.notas
        FROM custodia_asignacion_diaria cad
        JOIN employees e ON e.id = cad.employee_id
        WHERE cad.cliente_id = $1 AND cad.fecha = $2::date
      `, [cl.id, fecha]);

      const titularIds = new Set(titulares.map((t: any) => t.employee_id));
      const asignadoIds = new Set(asignados.map((a: any) => a.employee_id));

      const titularesPresentes = asignados.filter((a: any) => titularIds.has(a.employee_id));
      const extras = asignados.filter((a: any) => !titularIds.has(a.employee_id));
      const titularesFaltantes = titulares.filter((t: any) => !asignadoIds.has(t.employee_id));

      result.push({
        clienteId: cl.id,
        clienteNombre: cl.nombre_comercial || cl.nombre,
        fuerzaHoy: Number(cl.fuerza_hoy),
        totalTitulares: titulares.length,
        titularesPresentes: titularesPresentes.length,
        titularesFaltantes: titularesFaltantes.map((t: any) => ({
          employeeId: t.employee_id,
          nombre: t.nombre_completo,
          codigo: t.empl_numero,
        })),
        extras: extras.map((e: any) => ({
          employeeId: e.employee_id,
          nombre: e.nombre_completo,
          codigo: e.empl_numero,
          notas: e.notas,
        })),
        totalAsignados: asignados.length,
        pendientes: Math.max(0, Number(cl.fuerza_hoy) - asignados.length),
        asignaciones: asignados.map((a: any) => ({
          employeeId: a.employee_id,
          nombre: a.nombre_completo,
          codigo: a.empl_numero,
          notas: a.notas,
          esTitular: titularIds.has(a.employee_id),
        })),
      });
    }

    res.json(result);
  } catch (err) {
    logger.error({ err }, "[Custodias/dashboard]");
    res.status(500).json({ error: "Error al cargar dashboard de custodias" });
  }
});

