import { pool } from "@workspace/db";
import { calcularEstadoCiclo } from "../../lib/turno-calc";

// ── Función: quién está trabajando el puesto X en la fecha dada ──────────────
// Prioridad:
//   1) planificacion_futura (relevo del día)
//   2) puesto_slots (modelo nuevo multi-titular 24x24): slot cuyo dias_trabajo
//      contenga el día del ciclo de hoy. Misma lógica que módulo Operaciones.
//   3) puesto_titulares (sistema intermedio) usando dias_trabajo del slot par.
//   4) Fallback legacy: puestos_operativos.titular_employee_id / agente_id +
//      motor de ciclos genérico.
//
// Compatibilidad clave: la fuente de verdad para titular hoy en este proyecto
// es puesto_slots.empleado_id (con dias_trabajo + longitud_ciclo +
// fecha_inicio_ciclo). El campo legacy `agente_id` casi nunca se usa.
export function calcTrabajaPorSlot(
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
  const cycleDay = ((daysElapsed % lc) + lc) % lc + 1; // 1-based, handles negative offsets
  return diasTrabajo.includes(cycleDay);
}

export async function calcularResponsablePuesto(puestoId: number, fecha: string): Promise<{
  id: number; nombre_completo: string; tipo_personal: string; tipo_origen: string;
} | null> {
  // 1. Relevo planificado para ese día
  const { rows: pfRows } = await pool.query(`
    SELECT
      pf.relevo_id        AS employee_id,
      e.nombre_completo,
      e.tipo_personal,
      pf.tipo_cobertura_futura AS tipo_origen
    FROM planificacion_futura pf
    JOIN employees e ON e.id = pf.relevo_id
    WHERE pf.puesto_id = $1
      AND pf.fecha = $2
      AND pf.relevo_id IS NOT NULL
      AND e.estado_laboral = 'activo'
    ORDER BY pf.created_at DESC
    LIMIT 1
  `, [puestoId, fecha]);

  if (pfRows[0]) {
    return {
      id:              pfRows[0].employee_id,
      nombre_completo: pfRows[0].nombre_completo,
      tipo_personal:   pfRows[0].tipo_personal ?? "",
      tipo_origen:     pfRows[0].tipo_origen ?? "relevo",
    };
  }

  // 2. puesto_slots: titular del slot que trabaja hoy (modelo nuevo).
  //    Prioridad por slot_numero ascendente (T1 antes que T2).
  const { rows: slotRows } = await pool.query(`
    SELECT
      ps.empleado_id,
      ps.slot_numero,
      ps.dias_trabajo,
      COALESCE(ps.longitud_ciclo, 14)::int AS longitud_ciclo,
      COALESCE(ps.fecha_inicio_ciclo, po.fecha_inicio_ciclo) AS fecha_inicio_ciclo,
      e.nombre_completo,
      e.tipo_personal
    FROM puesto_slots ps
    JOIN puestos_operativos po ON po.id = ps.puesto_id
    JOIN employees e ON e.id = ps.empleado_id
    WHERE ps.puesto_id = $1
      AND ps.activo = TRUE
      AND ps.empleado_id IS NOT NULL
      AND e.estado_laboral = 'activo'
    ORDER BY ps.slot_numero ASC
  `, [puestoId]);

  for (const slot of slotRows) {
    const diasTrabajo: number[] = Array.isArray(slot.dias_trabajo)
      ? slot.dias_trabajo.map((d: any) => Number(d))
      : [];
    const fic = slot.fecha_inicio_ciclo instanceof Date
      ? slot.fecha_inicio_ciclo.toISOString().slice(0, 10)
      : String(slot.fecha_inicio_ciclo ?? "").slice(0, 10);
    if (diasTrabajo.length === 0 || !fic) {
      // Sin configuración de ciclo → ese slot trabaja todos los días.
      return {
        id:              slot.empleado_id,
        nombre_completo: slot.nombre_completo,
        tipo_personal:   slot.tipo_personal ?? "",
        tipo_origen:     `slot_${slot.slot_numero}`,
      };
    }
    if (calcTrabajaPorSlot(diasTrabajo, fic, fecha, Number(slot.longitud_ciclo))) {
      return {
        id:              slot.empleado_id,
        nombre_completo: slot.nombre_completo,
        tipo_personal:   slot.tipo_personal ?? "",
        tipo_origen:     `slot_${slot.slot_numero}`,
      };
    }
  }

  // 3. puesto_titulares (sistema intermedio): aplica solo si NO hay slots con
  //    empleado_id en el puesto (mismo criterio que routes/operaciones.ts).
  if (slotRows.length === 0) {
    const { rows: ptRows } = await pool.query(`
      SELECT
        pt.employee_id,
        pt.orden,
        pt.fecha_inicio_ciclo AS pt_fic,
        ps2.dias_trabajo,
        COALESCE(ps2.longitud_ciclo, 14)::int AS longitud_ciclo,
        COALESCE(ps2.fecha_inicio_ciclo, po.fecha_inicio_ciclo) AS slot_fic,
        e.nombre_completo,
        e.tipo_personal
      FROM puesto_titulares pt
      JOIN puestos_operativos po ON po.id = pt.puesto_id
      JOIN employees e ON e.id = pt.employee_id
      LEFT JOIN puesto_slots ps2
        ON  ps2.puesto_id   = pt.puesto_id
        AND ps2.slot_numero = pt.orden
        AND ps2.activo      = TRUE
      WHERE pt.puesto_id = $1
        AND pt.activo = TRUE
        AND e.estado_laboral = 'activo'
      ORDER BY pt.orden ASC
    `, [puestoId]);

    for (const t of ptRows) {
      const diasTrabajo: number[] = Array.isArray(t.dias_trabajo)
        ? t.dias_trabajo.map((d: any) => Number(d))
        : [];
      const fic = (t.slot_fic ?? t.pt_fic);
      const ficStr = fic instanceof Date ? fic.toISOString().slice(0, 10) : String(fic ?? "").slice(0, 10);
      if (diasTrabajo.length === 0 || !ficStr) {
        return {
          id:              t.employee_id,
          nombre_completo: t.nombre_completo,
          tipo_personal:   t.tipo_personal ?? "",
          tipo_origen:     `titular_${t.orden}`,
        };
      }
      if (calcTrabajaPorSlot(diasTrabajo, ficStr, fecha, Number(t.longitud_ciclo))) {
        return {
          id:              t.employee_id,
          nombre_completo: t.nombre_completo,
          tipo_personal:   t.tipo_personal ?? "",
          tipo_origen:     `titular_${t.orden}`,
        };
      }
    }
  }

  // 4. Fallback legacy: titular_employee_id o agente_id en puestos_operativos
  const { rows: poRows } = await pool.query(`
    SELECT
      COALESCE(po.titular_employee_id, po.agente_id) AS employee_id,
      e.nombre_completo,
      e.tipo_personal,
      t.id             AS tipo_turno_id,
      t.nombre         AS turno_nombre,
      t.tipo_ciclo,
      t.horas_trabajo,
      t.horas_descanso,
      po.fecha_inicio_ciclo
    FROM puestos_operativos po
    JOIN employees e ON e.id = COALESCE(po.titular_employee_id, po.agente_id)
    LEFT JOIN turnos t ON t.id = po.tipo_turno_id
    WHERE po.id = $1
      AND COALESCE(po.titular_employee_id, po.agente_id) IS NOT NULL
      AND e.estado_laboral = 'activo'
  `, [puestoId]);

  if (!poRows[0]) return null;
  const po = poRows[0];

  if (!po.tipo_ciclo || !po.horas_trabajo || !po.fecha_inicio_ciclo) {
    return { id: po.employee_id, nombre_completo: po.nombre_completo, tipo_personal: po.tipo_personal ?? "", tipo_origen: "turno_normal" };
  }

  const turno = {
    id:             po.tipo_turno_id ?? 0,
    nombre:         po.turno_nombre ?? "",
    tipo_ciclo:     po.tipo_ciclo,
    horas_trabajo:  Number(po.horas_trabajo),
    horas_descanso: Number(po.horas_descanso ?? po.horas_trabajo),
  };
  const fechaStr = po.fecha_inicio_ciclo instanceof Date
    ? po.fecha_inicio_ciclo.toISOString().slice(0, 10)
    : String(po.fecha_inicio_ciclo).slice(0, 10);

  const estado = calcularEstadoCiclo(turno, fechaStr, fecha);
  if (estado.trabaja) {
    return { id: po.employee_id, nombre_completo: po.nombre_completo, tipo_personal: po.tipo_personal ?? "", tipo_origen: "turno_normal" };
  }

  return null; // Titular descansa, sin relevo planificado
}

// ── Función: sincronizar custodia de un arma con el agente de turno ───────────
export async function syncCustodiaArma(armaId: number, fecha: string, usuario: string): Promise<any> {
  const { rows: aRows } = await pool.query(
    `SELECT a.id, a.codigo, a.puesto_id, a.custodio_employee_id,
            COALESCE(po.tipo_puesto, 'normal') AS tipo_puesto
     FROM armas a
     LEFT JOIN puestos_operativos po ON po.id = a.puesto_id
     WHERE a.id=$1`,
    [armaId]
  );
  if (!aRows[0]) return { cambio: false, motivo: "Arma no encontrada" };
  const puesto_id = aRows[0].puesto_id;
  if (!puesto_id) return { cambio: false, codigo: aRows[0].codigo, motivo: "Sin puesto asignado" };

  const tipoPuesto = aRows[0].tipo_puesto as "normal" | "custodia";
  const custodioOverride = aRows[0].custodio_employee_id as number | null;

  // ARM-08: en puestos de tipo 'custodia' (rutas), si el arma tiene un
  // custodio_employee_id asignado, ese override tiene prioridad sobre el
  // titular calculado por turno. Esto preserva la intención del operador.
  let responsable: { id: number; nombre_completo: string; tipo_origen?: string } | null = null;
  let tipoOrigenOverride: string | null = null;
  if (tipoPuesto === "custodia" && custodioOverride) {
    const { rows: empRows } = await pool.query(
      `SELECT id, nombre_completo FROM employees WHERE id=$1`,
      [custodioOverride]
    );
    if (empRows[0]) {
      responsable = { id: empRows[0].id, nombre_completo: empRows[0].nombre_completo };
      tipoOrigenOverride = "custodia_asignada";
    }
  }
  if (!responsable) {
    responsable = await calcularResponsablePuesto(puesto_id, fecha);
  }

  const { rows: custodiaRows } = await pool.query(
    `SELECT id, employee_id FROM arma_custodia WHERE arma_id=$1 AND fecha_fin IS NULL`,
    [armaId]
  );
  const custodiaActual = custodiaRows[0] ?? null;

  const mismoResponsable = custodiaActual && responsable
    && Number(custodiaActual.employee_id) === Number(responsable.id);

  if (mismoResponsable) {
    return {
      cambio: false, codigo: aRows[0].codigo,
      motivo: "El responsable de turno ya coincide con la custodia actual",
      responsable_actual: { id: responsable.id, nombre: responsable.nombre_completo },
    };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (custodiaActual) {
      await client.query(
        `UPDATE arma_custodia SET fecha_fin=NOW() WHERE id=$1`,
        [custodiaActual.id]
      );
    }
    let nuevaCustodia: any = null;
    if (responsable) {
      const tipoOrigen = tipoOrigenOverride
        ?? responsable.tipo_origen
        ?? "automatico_turno";
      const notas = tipoOrigenOverride === "custodia_asignada"
        ? `Custodio asignado (ruta) — ${fecha}`
        : `Custodia automática por turno — ${fecha}`;
      const { rows: nc } = await client.query(`
        INSERT INTO arma_custodia
          (arma_id, employee_id, puesto_id, tipo_origen, notas, registrado_por)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *
      `, [
        armaId, responsable.id, puesto_id, tipoOrigen, notas, usuario,
      ]);
      nuevaCustodia = nc[0];
    }
    await client.query("COMMIT");
    return {
      cambio: true, codigo: aRows[0].codigo,
      responsable_nuevo: responsable
        ? { id: responsable.id, nombre: responsable.nombre_completo, tipo_origen: tipoOrigenOverride ?? responsable.tipo_origen }
        : null,
      sin_responsable: !responsable,
      nueva_custodia: nuevaCustodia,
    };
  } catch (e: any) {
    await client.query("ROLLBACK").catch(() => {});
    return { cambio: false, codigo: aRows[0].codigo, error: e.message };
  } finally {
    client.release();
  }
}
/**
 * Genera el siguiente código de arma en formato ARM-####.
 * El ancho mínimo es 4 dígitos; si la cantidad supera 9999 crece automáticamente.
 * Se ejecuta dentro de la misma transacción del INSERT para evitar carreras
 * (combinado con UNIQUE(codigo) y reintentos).
 */
export async function siguienteCodigoArma(client: any): Promise<string> {
  // Consideramos solo códigos que matchean el patrón ARM-<dígitos> para extraer
  // el siguiente número. Cualquier código manual heredado fuera de este patrón
  // es ignorado por esta secuencia (la migración ARM-07 los renombra al arrancar).
  const { rows } = await client.query(
    `SELECT MAX(SUBSTRING(codigo FROM 5)::INTEGER) AS max_num
     FROM armas
     WHERE codigo ~ '^ARM-[0-9]+$'`
  );
  const next = (rows[0]?.max_num ?? 0) + 1;
  // Ancho mínimo 4 dígitos. Si rebasa 9999 (next>=10000) toma su propio largo.
  const width = Math.max(4, String(next).length);
  return `ARM-${String(next).padStart(width, "0")}`;
}

// ── Helper: traducir error 23505 del índice único a mensaje en español ──────
// Cuando una carrera burla la validación previa, postgres devuelve 23505 con
// `constraint`. Mapeamos los nombres de los índices ARM-08 a un mensaje útil.
export function traducirErrorUnicoArma(err: any): string | null {
  if (!err || err.code !== "23505") return null;
  const c: string = err.constraint || "";
  if (c === "armas_serie_uq")            return "Ya existe un arma con ese número de serie. No se permiten duplicados.";
  if (c === "armas_numero_tenencia_uq")  return "Ya existe un arma con ese número de tenencia. No se permiten duplicados.";
  if (c === "armas_numero_portacion_uq") return "Ya existe un arma con ese número de portación. No se permiten duplicados.";
  if (c === "armas_puesto_uq")           return "Este puesto ya tiene un arma asignada. Solo se permite un arma activa por puesto.";
  return null;
}

// ── ARM-09: validar que el puesto no tenga ya otra arma activa ──────────────
// Regla operativa: 1 puesto = 1 arma. Los agentes que rotan en el puesto se
// pasan la misma arma entre sí (la custodia se transfiere en cada cambio de
// turno). Si el puesto ya tiene un arma activa, devuelve mensaje en español
// con el código del arma existente para que el operador retire/mueva primero.
export async function validarPuestoSinArmaActiva(
  db: { query: (...a: any[]) => Promise<any> },
  puestoId: number,
  excluirArmaId?: number,
): Promise<string | null> {
  const params: any[] = [puestoId];
  let sql = `
    SELECT a.codigo, e.nombre_completo AS titular
    FROM armas a
    LEFT JOIN puesto_slots ps ON ps.puesto_id = a.puesto_id AND ps.slot_numero = 1 AND COALESCE(ps.activo, TRUE)
    LEFT JOIN employees e ON e.id = ps.empleado_id
    WHERE a.puesto_id = $1 AND a.activo = TRUE
  `;
  if (excluirArmaId) { params.push(excluirArmaId); sql += ` AND a.id <> $${params.length}`; }
  sql += ` LIMIT 1`;
  const { rows } = await db.query(sql, params);
  if (rows.length === 0) return null;
  const cod = rows[0].codigo ?? "?";
  const tit = rows[0].titular ? ` (${rows[0].titular})` : "";
  return `Este puesto ya tiene asignada el arma ${cod}${tit}. Para asignar otra arma, primero retira o mueve la actual a otro puesto.`;
}

// ── Helper: validar unicidad de identificadores del arma ────────────────────
// Devuelve mensaje de error en español si la serie / numero_tenencia / numero_portacion
// ya existe en otra arma. Compara case-insensitive y sin espacios al borde.
// `excluirId` permite ignorar el arma actual durante un PATCH.
export async function validarUnicidadArma(
  db: { query: (...a: any[]) => Promise<any> },
  campos: { serie?: string | null; numero_tenencia?: string | null; numero_portacion?: string | null },
  excluirId?: number,
): Promise<string | null> {
  const checks: Array<{ col: "serie" | "numero_tenencia" | "numero_portacion"; valor: string; etiqueta: string }> = [];
  const s  = (campos.serie ?? "").trim();
  const nt = (campos.numero_tenencia ?? "").trim();
  const np = (campos.numero_portacion ?? "").trim();
  if (s)  checks.push({ col: "serie",            valor: s,  etiqueta: "número de serie" });
  if (nt) checks.push({ col: "numero_tenencia",  valor: nt, etiqueta: "número de tenencia" });
  if (np) checks.push({ col: "numero_portacion", valor: np, etiqueta: "número de portación" });
  if (checks.length === 0) return null;

  for (const ch of checks) {
    const params: any[] = [ch.valor];
    let sql = `SELECT id, codigo FROM armas WHERE LOWER(TRIM(${ch.col})) = LOWER($1)`;
    if (excluirId) { params.push(excluirId); sql += ` AND id <> $${params.length}`; }
    sql += ` LIMIT 1`;
    const { rows } = await db.query(sql, params);
    if (rows.length > 0) {
      const cod = rows[0].codigo ? ` (${rows[0].codigo})` : "";
      return `Ya existe un arma con ese ${ch.etiqueta}${cod}. No se permiten duplicados.`;
    }
  }
  return null;
}
