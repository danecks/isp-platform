import { logger } from "../../../lib/logger";

type DB = { query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number }> };

/**
 * Resuelve el ID del evento de falta del titular para un puesto+fecha (solo lectura).
 * Usado al crear un pago de HE en efectivo para parearlo de inmediato si la falta ya
 * existe. Normalmente la falta está diferida al cierre, así que devolverá null y el
 * enlace se completa después con `enlazarPagosCashAFalta`.
 *
 * El match es por puesto_nombre + cliente_nombre (la misma señal que usa el cierre);
 * para custodias el "puesto" es 'Custodio N'. Devuelve null si no hay falta activa.
 */
export async function resolverFaltaEvento(
  db: DB,
  opts: { fecha: string; puestoNombre?: string | null; clienteNombre?: string | null },
): Promise<number | null> {
  const { fecha, puestoNombre, clienteNombre } = opts;
  if (!fecha || !puestoNombre) return null;
  try {
    const { rows } = await db.query(
      `SELECT id FROM eventos_rrhh
        WHERE DATE(fecha) = $1::date AND tipo_evento = 'falta'
          AND puesto_nombre = $2 AND COALESCE(cliente_nombre,'') = COALESCE($3,'')
          AND estado NOT IN ('anulado','cancelado')
        ORDER BY id DESC LIMIT 1`,
      [fecha, puestoNombre, clienteNombre ?? null],
    );
    return rows[0]?.id ?? null;
  } catch (err) {
    logger.warn({ err, fecha, puestoNombre }, "resolverFaltaEvento: no se pudo resolver (no bloqueante)");
    return null;
  }
}

/**
 * Enlaza de forma DURABLE los pagos de HE en efectivo (incentivos_cash_cobertura,
 * tipo='he_efectivo') con la falta del titular cuando ésta se materializa o se
 * registra DESPUÉS del pago (cierre del día / registrar falta).
 *
 * Idempotente: solo rellena los pagos del mismo puesto+fecha que aún no tienen
 * enlace (`evento_falta_id IS NULL`) y que no están cancelados. El match es
 * inclusivo: por `puesto_id` (guardias) O por `puesto_nombre + cliente_nombre`
 * (custodia / pagos sin puesto_id), porque un mismo puesto puede tener pagos con y
 * sin puesto_id (p. ej. HE de colaborador vs externo). No bloquea el flujo:
 * cualquier error se loguea.
 *
 * Devuelve cuántos pagos quedaron enlazados.
 */
export async function enlazarPagosCashAFalta(
  db: DB,
  opts: {
    faltaEventoId: number;
    fecha: string; // YYYY-MM-DD
    puestoId?: number | null;
    puestoNombre?: string | null;
    clienteNombre?: string | null;
  },
): Promise<number> {
  const { faltaEventoId, fecha, puestoId, puestoNombre, clienteNombre } = opts;
  if (!faltaEventoId || !fecha) return 0;
  try {
    const { rowCount } = await db.query(
      `UPDATE incentivos_cash_cobertura
          SET evento_falta_id = $1
        WHERE tipo = 'he_efectivo'
          AND estado <> 'cancelado'
          AND evento_falta_id IS NULL
          AND fecha = $2::date
          AND (
            ($3::int IS NOT NULL AND puesto_id = $3)
            OR ($4::text IS NOT NULL AND puesto_nombre = $4
                AND COALESCE(cliente_nombre,'') = COALESCE($5,''))
          )`,
      [faltaEventoId, fecha, puestoId ?? null, puestoNombre ?? null, clienteNombre ?? null],
    );
    return rowCount ?? 0;
  } catch (err) {
    logger.warn({ err, faltaEventoId, fecha }, "enlazarPagosCashAFalta: no se pudo enlazar (no bloqueante)");
    return 0;
  }
}

/**
 * Materializa el evento RRHH de "horas_extra" a partir de la novedad de nómina del
 * colaborador que cubrió, y lo enlaza a la falta del puesto+fecha (si existe).
 *
 * Por qué: las horas extra de cobertura solo se volvían tarjeta en RRHH > Eventos al
 * cerrar la quincena. Este helper las hace visibles en vivo, apenas se registra la
 * cobertura desde el pizarrón.
 *
 * Idempotente: usa las MISMAS claves de dedupe que el cierre
 * (employee_id + fecha + puesto_nombre + cliente_nombre + tipo_evento='horas_extra'
 *  AND estado != 'anulado'). Si el evento ya existe, solo enlaza el par; nunca duplica.
 * Por eso es seguro llamarlo en vivo: al cerrar la quincena el cierre encontrará el
 * evento y lo enlazará en vez de crear otro (no hay doble pago).
 *
 * La cantidad_horas del evento toma la HE real de la novedad (lo que se paga).
 * No bloquea el flujo: cualquier error se registra y se devuelve null.
 */
export async function materializarHEDesdeNovedad(
  db: DB,
  opts: {
    fecha: string; // YYYY-MM-DD
    employeeId: number;
    empleadoNombre: string;
    employeeDpi?: string | null;
    puestoNombre: string;
    clienteNombre?: string | null;
    usuario?: string | null;
  },
): Promise<number | null> {
  const { fecha, employeeId, empleadoNombre, employeeDpi, puestoNombre, clienteNombre, usuario } = opts;
  try {
    if (!fecha || !employeeId || !puestoNombre) return null;

    const { rows: nv } = await db.query(
      `SELECT horas_extra
         FROM novedades_nomina_diarias
        WHERE fecha = $1::date AND employee_id = $2`,
      [fecha, employeeId],
    );
    const horasExtra = nv.length ? Number(nv[0].horas_extra) || 0 : 0;
    if (horasExtra <= 0) return null;

    // ¿Ya existe el evento HE? (misma clave de dedupe que el cierre)
    const { rows: ex } = await db.query(
      `SELECT id, evento_par_id FROM eventos_rrhh
        WHERE employee_id = $1 AND DATE(fecha) = $2::date AND tipo_evento = 'horas_extra'
          AND puesto_nombre = $3 AND COALESCE(cliente_nombre,'') = COALESCE($4,'')
          AND estado != 'anulado'
        ORDER BY id DESC LIMIT 1`,
      [employeeId, fecha, puestoNombre, clienteNombre ?? null],
    );

    // Falta activa del mismo puesto+fecha (para enlazar el par)
    const { rows: fa } = await db.query(
      `SELECT id FROM eventos_rrhh
        WHERE DATE(fecha) = $1::date AND tipo_evento = 'falta'
          AND puesto_nombre = $2 AND COALESCE(cliente_nombre,'') = COALESCE($3,'')
          AND estado NOT IN ('anulado','cancelado')
        ORDER BY id DESC LIMIT 1`,
      [fecha, puestoNombre, clienteNombre ?? null],
    );
    const faltaId: number | null = fa[0]?.id ?? null;

    let heId: number | null = ex.length ? ex[0].id : null;
    if (heId) {
      if (faltaId && !ex[0].evento_par_id) {
        await db.query(`UPDATE eventos_rrhh SET evento_par_id = $1 WHERE id = $2`, [faltaId, heId]);
      }
    } else {
      const { rows: ins } = await db.query(
        `INSERT INTO eventos_rrhh
           (employee_id, employee_nombre, employee_dpi, tipo_evento, fecha,
            cliente_nombre, puesto_nombre, generado_desde, estado, usuario_generador,
            observaciones, documentos_generados, evento_par_id, cantidad_horas)
         VALUES ($1,$2,$3,'horas_extra',$4::date,$5,$6,'asignacion_pizarron','pendiente_aprobacion',$7,$8,'[]',$9,$10)
         RETURNING id`,
        [
          employeeId, empleadoNombre, employeeDpi ?? null, fecha,
          clienteNombre ?? null, puestoNombre, usuario ?? "sistema",
          `Cobertura HE en ${puestoNombre}${clienteNombre ? ` (${clienteNombre})` : ""}`,
          faltaId, horasExtra,
        ],
      );
      heId = ins[0]?.id ?? null;
    }

    if (heId) {
      // Enlaza la novedad al evento (si aún no lo está)
      await db.query(
        `UPDATE novedades_nomina_diarias
            SET evento_rrhh_id = COALESCE(evento_rrhh_id, $1), updated_at = NOW()
          WHERE fecha = $2::date AND employee_id = $3`,
        [heId, fecha, employeeId],
      );
      // Back-compat 1:1: si la falta no tiene par, apúntala a esta HE
      if (faltaId) {
        await db.query(
          `UPDATE eventos_rrhh SET evento_par_id = COALESCE(evento_par_id, $1) WHERE id = $2`,
          [heId, faltaId],
        );
      }
    }
    return heId;
  } catch (err) {
    logger.warn({ err, fecha, employeeId }, "materializarHEDesdeNovedad: no se pudo materializar HE (no bloqueante)");
    return null;
  }
}
