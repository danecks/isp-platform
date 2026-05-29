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

interface PuestoBase {
  puesto_id: number;
  puesto_nombre: string;
  turno: string | null;
  sede_nombre: string | null;
  legacy_agente: string | null;
}
interface SlotRow {
  puesto_id: number;
  horas_turno: number | null;
  empleado_id: number;
  agente_nombre: string;
  programado_hoy: boolean;
}
interface EnVivoRow {
  puesto_id: number;
  employee_id: number;
  nombre: string;
}
interface AgenteLive {
  nombre: string;
  horas_turno: number | null;
  programado_hoy: boolean;
  en_servicio: boolean;
}
interface PuestoLive {
  puesto_id: number;
  nombre: string;
  turno: string | null;
  sede: string | null;
  agentes: AgenteLive[];
  estado: "cubierto" | "descubierto";
}

function agruparPor<T>(rows: T[], key: (r: T) => number): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = map.get(k) ?? [];
    arr.push(r);
    map.set(k, arr);
  }
  return map;
}

/**
 * Combina puestos, slots y fichajes en vivo en la vista de operativo del portal.
 * Cada puesto lista todos sus agentes asignados (modelo de slots) con su jornada,
 * marcando quién está programado hoy y quién tiene turno abierto en vivo.
 */
function construirPuestosLive(
  puestos: PuestoBase[],
  slots: SlotRow[],
  enVivo: EnVivoRow[],
): PuestoLive[] {
  const enVivoEmp = new Set(enVivo.map(v => `${v.puesto_id}:${v.employee_id}`));
  const enVivoPorPuesto = agruparPor(enVivo, v => v.puesto_id);
  const slotsPorPuesto = agruparPor(slots, s => s.puesto_id);

  return puestos.map(p => {
    const empleadosSlot = new Set<number>();
    const agentes: AgenteLive[] = (slotsPorPuesto.get(p.puesto_id) ?? []).map(s => {
      empleadosSlot.add(s.empleado_id);
      return {
        nombre: s.agente_nombre,
        horas_turno: s.horas_turno != null ? Number(s.horas_turno) : null,
        programado_hoy: !!s.programado_hoy,
        en_servicio: enVivoEmp.has(`${p.puesto_id}:${s.empleado_id}`),
      };
    });

    // Agentes con turno en vivo que no están en los slots (relevo/cobertura puntual)
    for (const v of enVivoPorPuesto.get(p.puesto_id) ?? []) {
      if (!empleadosSlot.has(v.employee_id)) {
        agentes.push({ nombre: v.nombre, horas_turno: null, programado_hoy: false, en_servicio: true });
      }
    }

    // Fallback legacy: puesto sin slots pero con agente fijo del modelo viejo
    if (agentes.length === 0 && p.legacy_agente) {
      agentes.push({ nombre: p.legacy_agente, horas_turno: null, programado_hoy: true, en_servicio: false });
    }

    agentes.sort((a, b) =>
      Number(b.en_servicio) - Number(a.en_servicio) ||
      Number(b.programado_hoy) - Number(a.programado_hoy) ||
      (b.horas_turno ?? 0) - (a.horas_turno ?? 0)
    );

    const cubierto = agentes.some(a => a.en_servicio || a.programado_hoy);
    return {
      puesto_id: p.puesto_id,
      nombre: p.puesto_nombre,
      turno: p.turno,
      sede: p.sede_nombre,
      agentes,
      estado: cubierto ? "cubierto" : "descubierto",
    };
  });
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
    // 1) Puestos fijos del cliente (modelo base + agente legacy de un solo titular)
    const { rows: puestos } = await pool.query<{
      puesto_id: number;
      puesto_nombre: string;
      turno: string | null;
      sede_nombre: string | null;
      legacy_agente: string | null;
    }>(`
      SELECT
        po.id                                          AS puesto_id,
        po.nombre                                      AS puesto_nombre,
        COALESCE(po.turno, po.jornada)                 AS turno,
        cs.nombre                                      AS sede_nombre,
        COALESCE(ea.nombre_completo, po.agente_nombre) AS legacy_agente
      FROM puestos_operativos po
      LEFT JOIN client_sedes cs ON cs.id = po.sede_id
      LEFT JOIN employees    ea ON ea.id = po.agente_id
      WHERE po.cliente_id = $1
        AND po.activo = TRUE
        AND COALESCE(po.tipo_puesto, 'fijo') <> 'custodia'
      ORDER BY cs.nombre NULLS LAST, po.nombre
    `, [clienteIntId]);

    // 2) Agentes asignados vía puesto_slots (modelo de turnos por slot).
    //    programado_hoy: el día del ciclo cae dentro de los dias_trabajo del slot.
    //    Misma fórmula canónica que usa el tablero de operaciones.
    const { rows: slots } = await pool.query<{
      puesto_id: number;
      slot_numero: number;
      horas_turno: number | null;
      empleado_id: number;
      agente_nombre: string;
      programado_hoy: boolean;
    }>(`
      SELECT
        ps.puesto_id,
        ps.slot_numero,
        ps.horas_turno,
        ps.empleado_id,
        e.nombre_completo AS agente_nombre,
        (CASE
           WHEN ps.fecha_inicio_ciclo IS NULL THEN
             EXTRACT(ISODOW FROM $2::date)::int = ANY(ps.dias_trabajo)
           ELSE
             -- Día del ciclo con módulo normalizado a positivo (robusto si la
             -- fecha es anterior a fecha_inicio_ciclo). Igual que el tablero admin.
             (((((($2::date - ps.fecha_inicio_ciclo) % ps.longitud_ciclo) + ps.longitud_ciclo) % ps.longitud_ciclo)) + 1) = ANY(ps.dias_trabajo)
         END) AS programado_hoy
      FROM puesto_slots ps
      JOIN puestos_operativos po ON po.id = ps.puesto_id
      JOIN employees e ON e.id = ps.empleado_id
      WHERE po.cliente_id = $1
        AND po.activo = TRUE
        AND ps.activo = TRUE
        AND ps.empleado_id IS NOT NULL
        AND COALESCE(po.tipo_puesto, 'fijo') <> 'custodia'
        AND e.estado_laboral NOT IN ('baja', 'suspendido')
      ORDER BY ps.puesto_id, ps.slot_numero
    `, [clienteIntId, fecha]);

    // 3) Agentes con turno abierto en vivo (fichaje sin cierre).
    const { rows: enVivo } = await pool.query<{
      puesto_id: number;
      employee_id: number;
      nombre: string;
    }>(`
      SELECT DISTINCT ON (af.puesto_id, af.employee_id)
             af.puesto_id,
             af.employee_id,
             COALESCE(e.nombre_completo, u.nombre, u.username) AS nombre
        FROM agente_fichajes af
        LEFT JOIN employees e ON e.id = af.employee_id
        LEFT JOIN users     u ON u.employee_id = af.employee_id
       WHERE af.tipo = 'inicio_turno'
         AND af.turno_cerrado_en IS NULL
         AND af.registrado_en >= NOW() - INTERVAL '36 hours'
         AND af.puesto_id IN (SELECT id FROM puestos_operativos WHERE cliente_id = $1)
       ORDER BY af.puesto_id, af.employee_id, af.registrado_en DESC
    `, [clienteIntId]);

    const result = construirPuestosLive(puestos, slots, enVivo);
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
