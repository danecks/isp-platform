import type { PoolClient } from "pg";
import { todayGT } from "@workspace/db";
import { logger } from "../../../lib/logger";

// ─── Helper: liberar TITULARIDAD activa de un agente (modo estricto) ────────
// Garantiza que un agente NO pueda quedar como titular en dos lugares al mismo
// tiempo (puestos fijos, custodias, o cruzado entre módulos).
//
// SOLO toca registros de titularidad. La cobertura diaria (`agente_id` cuando
// el agente NO es el titular del puesto) se respeta y NO se modifica.
// Cuando el agente SÍ era titular del puesto, también se limpia su `agente_id`
// del mismo registro (es el efecto natural de perder al titular).
//
// `excluir` preserva una titularidad que no debe tocarse (el destino actual).
//
// Debe correrse SIEMPRE dentro de una transacción del endpoint llamador,
// junto con el advisory lock y la asignación al destino, para garantizar
// atomicidad y evitar carreras.
export async function liberarTitularidadAgente(
  client: PoolClient,
  employeeId: number,
  excluir: {
    puestoId?: number | null;
    custodia?: { clienteId: number; slotNumero: number } | null;
  } = {},
): Promise<{
  puestos: Array<{ id: number; nombre: string; cliente_nombre: string }>;
  custodias: Array<{ cliente_id: number; slot_numero: number }>;
}> {
  const exPuestoId  = excluir.puestoId ?? -1;
  const exClienteId = excluir.custodia?.clienteId ?? -1;
  const exSlot      = excluir.custodia?.slotNumero ?? -1;

  // 1) Puestos fijos LEGACY: liberar donde el agente es titular vía
  //    puestos_operativos.titular_employee_id.
  //    Si el agente también figura como agente_id del MISMO registro
  //    (caso normal: titular cubriendo su propio puesto), se limpia también.
  const { rows: puestosLegacyLib } = await client.query(`
    UPDATE puestos_operativos
    SET
      agente_id           = CASE WHEN agente_id = $1 THEN NULL ELSE agente_id END,
      agente_nombre       = CASE WHEN agente_id = $1 THEN NULL ELSE agente_nombre END,
      titular_employee_id = NULL,
      titular_nombre      = NULL,
      updated_at          = NOW()
    WHERE titular_employee_id = $1
      AND activo = TRUE
      AND id != $2
    RETURNING id, nombre, cliente_nombre
  `, [employeeId, exPuestoId]);

  // 2) puesto_titulares (sistema intermedio): desactivar titularidad activa
  //    en TODOS los puestos excepto el destino actual.
  const { rows: ptLib } = await client.query(`
    UPDATE puesto_titulares pt
    SET activo = FALSE, updated_at = NOW()
    FROM puestos_operativos po
    WHERE pt.puesto_id = po.id
      AND pt.employee_id = $1
      AND pt.activo = TRUE
      AND pt.puesto_id != $2
    RETURNING pt.puesto_id AS id, po.nombre, po.cliente_nombre
  `, [employeeId, exPuestoId]);

  // 3) puesto_slots (sistema nuevo multi-titular 24x24): liberar empleado_id
  //    en TODOS los slots activos del agente excepto los del puesto destino.
  //    ESTA es la fuente que estaba permitiendo duplicidad cruzada (PIZ-DUP-01).
  const { rows: psLib } = await client.query(`
    UPDATE puesto_slots ps
    SET empleado_id = NULL
    FROM puestos_operativos po
    WHERE ps.puesto_id = po.id
      AND ps.empleado_id = $1
      AND ps.activo = TRUE
      AND ps.puesto_id != $2
    RETURNING ps.puesto_id AS id, po.nombre, po.cliente_nombre
  `, [employeeId, exPuestoId]);

  // Consolidar puestos liberados (cualquier fuente)
  const puestosLibMap = new Map<number, { id: number; nombre: string; cliente_nombre: string }>();
  for (const r of puestosLegacyLib) puestosLibMap.set(r.id, { id: r.id, nombre: r.nombre, cliente_nombre: r.cliente_nombre });
  for (const r of ptLib)            puestosLibMap.set(r.id, { id: r.id, nombre: r.nombre, cliente_nombre: r.cliente_nombre });
  for (const r of psLib)            puestosLibMap.set(r.id, { id: r.id, nombre: r.nombre, cliente_nombre: r.cliente_nombre });
  const puestosLib = Array.from(puestosLibMap.values());

  // 4) Cerrar historial de titularidad activo en cualquier puesto liberado.
  await client.query(`
    UPDATE puesto_titular_historico
    SET fecha_fin = CURRENT_DATE, updated_at = NOW()
    WHERE employee_id = $1 AND fecha_fin IS NULL AND puesto_id != $2
  `, [employeeId, exPuestoId]);

  // 5) Custodias: desactivar titularidad activa (excepto el destino actual)
  const { rows: custodiasLib } = await client.query(`
    UPDATE custodia_titulares
    SET activo = FALSE
    WHERE employee_id = $1 AND activo = TRUE
      AND NOT (cliente_id = $2 AND slot_numero = $3)
    RETURNING cliente_id, slot_numero
  `, [employeeId, exClienteId, exSlot]);

  // 6) Borrar asignación diaria de hoy en los slots de custodia liberados
  if (custodiasLib.length > 0) {
    const fechaHoy = todayGT();
    for (const c of custodiasLib) {
      await client.query(`
        DELETE FROM custodia_asignacion_diaria
        WHERE cliente_id = $1 AND slot_numero = $2 AND fecha = $3::date AND employee_id = $4
      `, [c.cliente_id, c.slot_numero, fechaHoy, employeeId]);
    }
  }

  // 7) EOA: desactivar asignaciones operacionales activas
  //    (se reabrirá el EOA del nuevo destino en el endpoint llamador)
  if (puestosLib.length > 0 || custodiasLib.length > 0) {
    await client.query(`
      UPDATE employee_operational_assignments
      SET activa = FALSE, updated_at = NOW()
      WHERE employee_id = $1 AND activa = TRUE
    `, [employeeId]);

    logger.info({
      employeeId,
      puestosLiberados: puestosLib.map(r => r.id),
      custodiasLiberadas: custodiasLib,
      excluir,
    }, "Titularidad previa liberada (modo estricto)");
  }

  return {
    puestos:   puestosLib.map(r => ({ id: r.id, nombre: r.nombre, cliente_nombre: r.cliente_nombre })),
    custodias: custodiasLib.map(r => ({ cliente_id: r.cliente_id, slot_numero: r.slot_numero })),
  };
}

// Lock advisory por employee_id — serializa operaciones de titularidad por agente
// dentro de la transacción actual. Hash estable para evitar colisiones globales.
export async function lockTitularidadAgente(client: PoolClient, employeeId: number) {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext('titularidad'), $1)`, [employeeId]);
}

// ─── CTE unificada de titulares por puesto ──────────────────────────────────
// Fusiona las TRES fuentes históricas de titularidad en un solo conjunto
// `(puesto_id, employee_id, prioridad_fuente, orden)`, deduplicando por par
// y conservando la prioridad más alta (1 > 2 > 3). Usar embebida como prefijo
// `WITH` en queries de lectura.
//
//   prioridad 1) puesto_slots          — fuente actual del Pizarrón Operativo (24x24)
//   prioridad 2) puesto_titulares      — sistema intermedio multi-titular
//   prioridad 3) puestos_operativos    — campo legacy `titular_employee_id`
//
// Importante para el ORDER BY del caller: usar `prioridad_fuente ASC, orden ASC`
// para que un registro legacy stale NO gane sobre un slot vigente del Pizarrón
// cuando un agente tiene asignaciones en más de una fuente.
//
// Solo lectura. No filtra por puesto activo (el caller decide con su JOIN).
export const TITULARES_UNIFICADOS_CTE = `
  titulares_unificados AS (
    SELECT puesto_id, employee_id,
           MIN(prioridad_fuente) AS prioridad_fuente,
           MIN(orden) AS orden
      FROM (
        SELECT puesto_id, empleado_id AS employee_id,
               1 AS prioridad_fuente, slot_numero AS orden
          FROM puesto_slots
         WHERE empleado_id IS NOT NULL AND activo = TRUE
        UNION ALL
        SELECT puesto_id, employee_id,
               2 AS prioridad_fuente, COALESCE(orden, 99) AS orden
          FROM puesto_titulares
         WHERE activo = TRUE
        UNION ALL
        SELECT id AS puesto_id, titular_employee_id AS employee_id,
               3 AS prioridad_fuente, 0 AS orden
          FROM puestos_operativos
         WHERE titular_employee_id IS NOT NULL AND activo = TRUE
      ) t
     GROUP BY puesto_id, employee_id
  )
`;
