/**
 * Portal Cliente — Operativo en vivo (Custodios Fase 4)
 *
 * Endpoints:
 *   GET /api/portal/operativo/custodias?fecha=YYYY-MM-DD
 *   GET /api/portal/operativo/puestos?fecha=YYYY-MM-DD
 *
 * Ambos exigen `requirePortalAuth` (definido en portal.ts) y filtran
 * estrictamente por el `cliente_id` resuelto en el middleware. Nunca
 * aceptan un cliente_id por query.
 */

import { Router } from "express";
import { pool, todayGT } from "@workspace/db";
import { requirePortalAuth } from "./portal";

export const portalOperativoRouter = Router();

function normFecha(f: unknown): string | null {
  const s = String(f ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

// ─── GET /portal/operativo/custodias ────────────────────────────────────────
portalOperativoRouter.get("/portal/operativo/custodias", requirePortalAuth, async (req, res) => {
  const clienteIntId: number | null = (req as any).portalClienteIntId;
  const fecha = normFecha(req.query.fecha) ?? todayGT();

  if (!clienteIntId) {
    return res.json({ fecha, custodias: [], resumen: { esperados: 0, presentes: 0, faltantes: 0 } });
  }

  try {
    // 1) Demanda esperada del día (fuerza_semanal con excepción puntual si existe)
    const diaSemana = new Date(fecha + "T12:00:00Z").getUTCDay();
    const { rows: fuerzaRows } = await pool.query<{
      esperados: number;
      excepcion: number | null;
    }>(`
      SELECT
        COALESCE(cfs.cantidad_agentes, 0)::int AS esperados,
        ce.cantidad::int                       AS excepcion
      FROM clients c
      LEFT JOIN custodia_fuerza_semanal cfs
        ON cfs.cliente_id = c.id AND cfs.dia_semana = $2
      LEFT JOIN custodia_excepciones ce
        ON ce.cliente_id = c.id AND ce.fecha = $3::date
      WHERE c.id = $1
      LIMIT 1
    `, [clienteIntId, diaSemana, fecha]);

    const esperados = fuerzaRows[0]?.excepcion ?? fuerzaRows[0]?.esperados ?? 0;

    // 2) Titulares de custodia (para detectar quién falta)
    const { rows: titulares } = await pool.query<{
      employee_id: number;
      nombre: string;
      slot_numero: number | null;
    }>(`
      SELECT DISTINCT ON (e.id)
        e.id AS employee_id, e.nombre_completo AS nombre, ct.slot_numero
      FROM (
        SELECT employee_id, slot_numero
          FROM custodia_titulares
         WHERE cliente_id = $1 AND activo = TRUE
        UNION
        SELECT pt.employee_id, NULL::int AS slot_numero
          FROM puesto_titulares pt
          JOIN puestos_operativos po ON po.id = pt.puesto_id
         WHERE po.cliente_id = $1 AND po.activo = TRUE AND pt.activo = TRUE
           AND COALESCE(po.tipo_puesto, 'fijo') = 'custodia'
      ) ct
      JOIN employees e ON e.id = ct.employee_id
      ORDER BY e.id
    `, [clienteIntId]);

    // 3) Asignaciones del día con ruta
    const { rows: asignaciones } = await pool.query<{
      employee_id: number;
      nombre: string;
      slot_numero: number | null;
      ruta_texto: string | null;
      hora_salida: string | null;
      hora_regreso: string | null;
    }>(`
      SELECT
        cad.employee_id,
        e.nombre_completo                          AS nombre,
        cad.slot_numero,
        cad.ruta_texto,
        to_char(cad.hora_salida,  'HH24:MI')       AS hora_salida,
        to_char(cad.hora_regreso, 'HH24:MI')       AS hora_regreso
      FROM custodia_asignacion_diaria cad
      JOIN employees e ON e.id = cad.employee_id
      WHERE cad.cliente_id = $1 AND cad.fecha = $2::date
      ORDER BY cad.slot_numero NULLS LAST, e.nombre_completo
    `, [clienteIntId, fecha]);

    const asignadosIds = new Set(asignaciones.map(a => a.employee_id));
    const faltantes = titulares
      .filter(t => !asignadosIds.has(t.employee_id))
      .map(t => ({
        employee_id: t.employee_id,
        nombre: t.nombre,
        slot_numero: t.slot_numero,
        ruta_texto: null,
        hora_salida: null,
        hora_regreso: null,
        estado: "faltante" as const,
      }));

    const presentes = asignaciones.map(a => ({
      employee_id: a.employee_id,
      nombre: a.nombre,
      slot_numero: a.slot_numero,
      ruta_texto: a.ruta_texto,
      hora_salida: a.hora_salida,
      hora_regreso: a.hora_regreso,
      estado: "presente" as const,
    }));

    res.json({
      fecha,
      custodias: [{
        id: clienteIntId,
        nombre: "Custodia",
        esperados,
        presentes: presentes.length,
        agentes: [...presentes, ...faltantes],
      }],
      resumen: {
        esperados,
        presentes: presentes.length,
        faltantes: Math.max(0, esperados - presentes.length),
      },
    });
  } catch (err) {
    req.log?.error({ err }, "[portal/operativo/custodias]");
    res.status(500).json({ error: "Error al cargar custodias del día" });
  }
});

// ─── GET /portal/operativo/puestos ──────────────────────────────────────────
portalOperativoRouter.get("/portal/operativo/puestos", requirePortalAuth, async (req, res) => {
  const clienteIntId: number | null = (req as any).portalClienteIntId;
  const fecha = normFecha(req.query.fecha) ?? todayGT();

  if (!clienteIntId) {
    return res.json({ fecha, puestos: [], resumen: { total: 0, cubiertos: 0, descubiertos: 0 } });
  }

  try {
    const { rows: puestos } = await pool.query<{
      puesto_id: number;
      puesto_nombre: string;
      turno: string | null;
      sede_nombre: string | null;
      titular_nombre: string | null;
      agente_nombre: string | null;
      en_servicio_nombre: string | null;
      estado: string | null;
    }>(`
      WITH turnos_activos AS (
        SELECT DISTINCT ON (af.puesto_id)
               af.puesto_id,
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
        po.id                                                    AS puesto_id,
        po.nombre                                                AS puesto_nombre,
        COALESCE(po.turno, po.jornada)                           AS turno,
        cs.nombre                                                AS sede_nombre,
        COALESCE(et.nombre_completo, po.titular_nombre)          AS titular_nombre,
        COALESCE(ea.nombre_completo, po.agente_nombre)           AS agente_nombre,
        ta.agente_nombre                                         AS en_servicio_nombre,
        po.estado
      FROM puestos_operativos po
      LEFT JOIN client_sedes cs ON cs.id = po.sede_id
      LEFT JOIN employees    et ON et.id = po.titular_employee_id
      LEFT JOIN employees    ea ON ea.id = po.agente_id
      LEFT JOIN turnos_activos ta ON ta.puesto_id = po.id
      WHERE po.cliente_id = $1
        AND po.activo = TRUE
        AND COALESCE(po.tipo_puesto, 'fijo') <> 'custodia'
      ORDER BY cs.nombre NULLS LAST, po.nombre
    `, [clienteIntId]);

    const result = puestos.map(p => {
      const cubierto = !!p.en_servicio_nombre || !!p.agente_nombre;
      return {
        puesto_id: p.puesto_id,
        nombre: p.puesto_nombre,
        turno: p.turno,
        sede: p.sede_nombre,
        titular_nombre: p.titular_nombre,
        agente_actual: p.en_servicio_nombre ?? p.agente_nombre,
        en_servicio: !!p.en_servicio_nombre,
        estado: cubierto ? "cubierto" : "descubierto",
      };
    });

    const cubiertos = result.filter(p => p.estado === "cubierto").length;
    res.json({
      fecha,
      puestos: result,
      resumen: {
        total: result.length,
        cubiertos,
        descubiertos: result.length - cubiertos,
      },
    });
  } catch (err) {
    req.log?.error({ err }, "[portal/operativo/puestos]");
    res.status(500).json({ error: "Error al cargar puestos del día" });
  }
});

export default portalOperativoRouter;
