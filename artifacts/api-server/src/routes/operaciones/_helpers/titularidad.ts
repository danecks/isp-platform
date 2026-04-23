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

  // 1) Puestos fijos: liberar SOLO donde el agente es titular.
  //    Si el agente también figura como agente_id del MISMO registro
  //    (caso normal: titular cubriendo su propio puesto), se limpia también.
  const { rows: puestosLib } = await client.query(`
    UPDATE puestos_operativos
    SET
      agente_id           = CASE WHEN agente_id = $1 THEN NULL ELSE agente_id END,
      agente_nombre       = CASE WHEN agente_id = $1 THEN NULL ELSE agente_nombre END,
      titular_employee_id = NULL,
      titular_nombre      = NULL,
      estado              = CASE WHEN agente_id = $1 THEN 'descubierto' ELSE estado END,
      updated_at          = NOW()
    WHERE titular_employee_id = $1
      AND activo = TRUE
      AND id != $2
    RETURNING id, nombre, cliente_nombre
  `, [employeeId, exPuestoId]);

  // 2) Cerrar historial de titularidad activo (solo del/los puestos liberados)
  await client.query(`
    UPDATE puesto_titular_historico
    SET fecha_fin = CURRENT_DATE, updated_at = NOW()
    WHERE employee_id = $1 AND fecha_fin IS NULL AND puesto_id != $2
  `, [employeeId, exPuestoId]);

  // 3) Liberar slots de plantilla SOLO de los puestos donde dejó de ser titular.
  if (puestosLib.length > 0) {
    const ids = puestosLib.map(r => r.id);
    await client.query(`
      UPDATE puesto_slots
      SET empleado_id = NULL
      WHERE empleado_id = $1 AND puesto_id = ANY($2::int[])
    `, [employeeId, ids]);
  }

  // 4) Custodias: desactivar titularidad activa (excepto el destino actual)
  const { rows: custodiasLib } = await client.query(`
    UPDATE custodia_titulares
    SET activo = FALSE
    WHERE employee_id = $1 AND activo = TRUE
      AND NOT (cliente_id = $2 AND slot_numero = $3)
    RETURNING cliente_id, slot_numero
  `, [employeeId, exClienteId, exSlot]);

  // 5) Borrar asignación diaria de hoy en los slots de custodia liberados
  if (custodiasLib.length > 0) {
    const fechaHoy = todayGT();
    for (const c of custodiasLib) {
      await client.query(`
        DELETE FROM custodia_asignacion_diaria
        WHERE cliente_id = $1 AND slot_numero = $2 AND fecha = $3::date AND employee_id = $4
      `, [c.cliente_id, c.slot_numero, fechaHoy, employeeId]);
    }
  }

  // 6) EOA: desactivar asignaciones operacionales activas
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
