/**
 * planilla.ts — Planilla Final de Nómina
 *
 * ─── FLUJO COMPLETO ─────────────────────────────────────────────────────────
 *   Operación diaria → Novedades → Pre-Planilla → [CIERRE] → Planilla Final
 *
 * ─── CONTROL DE DOBLE DESCUENTO ─────────────────────────────────────────────
 *   Al generar la planilla, todos los anticipos del empleado con estado
 *   'pendiente' o 'aprobada' y planilla_id IS NULL se vinculan:
 *     • anticipos.planilla_id = planilla.id
 *     • anticipos.estado = 'descontado'
 *   Si un anticipo ya está vinculado, el PATCH lo rechaza con 409.
 *   Esto garantiza que ningún anticipo se descuente dos veces.
 *
 * ─── CORRECCIÓN DE PLANILLA ──────────────────────────────────────────────────
 *   DELETE /api/nomina/planilla/:id (solo si estado != 'pagada'):
 *     1. Desvincula anticipos (planilla_id = NULL, estado = 'aprobada')
 *     2. Marca el cierre como anulado (pre_planilla_cierres.anulado = TRUE)
 *     3. Reabre las revisiones (pre_planilla_revision.periodo_cerrado = FALSE)
 *     4. Elimina la planilla (CASCADE borra planilla_lineas)
 *   Luego RRHH puede corregir en pre-planilla, re-cerrar y regenerar.
 *
 * ─── TRAZABILIDAD ────────────────────────────────────────────────────────────
 *   planilla_lineas.anticipo_ids  → JSONB: IDs de anticipos vinculados a este empleado
 *   planilla_lineas.novedad_ids   → JSONB: IDs de novedades que originaron datos (reservado)
 *   planilla_lineas.segmento_ids  → JSONB: IDs de segmentos de cobertura (reservado)
 *
 * ─── PREPARACIÓN PARA DEDUCCIONES FUTURAS ────────────────────────────────────
 *   planilla_lineas contiene (en 0 por ahora, sin cálculo):
 *     • igss_trabajador   → 4.83% del total bruto (Guatemala)
 *     • igss_patronal     → 12.67% del total bruto
 *     • otros_descuentos  → campo libre
 *
 * ─── LIMITACIONES ACTUALES ───────────────────────────────────────────────────
 *   ❌ IGSS no calculado (campos presentes como 0)
 *   ❌ Bonificación incentivo no incluida
 *   ❌ Séptimo no incluido
 *
 * ENDPOINTS:
 *   GET    /api/nomina/planillas            → Lista todas las planillas activas
 *   POST   /api/nomina/planilla             → Genera planilla desde snapshot cerrado
 *   GET    /api/nomina/planilla/:id         → Detalle de planilla + líneas
 *   PATCH  /api/nomina/planilla/:id/estado  → Avanza estado (borrador→revisada→aprobada→pagada)
 *   DELETE /api/nomina/planilla/:id         → Revierte planilla (no pagada)
 *   GET    /api/nomina/planilla/:id/export  → Exporta CSV con BOM
 */

import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

export const planillaRouter = Router();

// ─── Cálculo por colaborador ──────────────────────────────────────────────────

// ─── Detecta si un período es primera o segunda quincena ─────────────────────
function detectarQuincena(hasta: string): "primera" | "segunda" {
  const d = new Date(hasta);
  return d.getUTCDate() <= 15 ? "primera" : "segunda";
}

function calcularLinea(
  row: Record<string, unknown>,
  periodoTotalDias: number,
  igssData: { aplica_igss: boolean; motivo_exclusion_igss: string | null },
  quincenaTipo: "primera" | "segunda"
) {
  const sb       = parseFloat(String(row.sueldo_base  ?? 0));
  const hc       = parseFloat(String(row.horas_contrato ?? 48));
  const faltas   = parseInt(String(row.faltas       ?? 0));
  const susp     = parseInt(String(row.suspensiones ?? 0));
  const he       = parseFloat(String(row.horas_extra ?? 0));
  const anticipo = parseFloat(String(row.anticipos_monto ?? 0));
  const frecuencia = String(row.frecuencia_pago ?? "quincenal");

  const horasDia  = hc > 0 ? hc / 6 : 8;
  const sueldoDia = sb / 30;

  // Mensual en segunda quincena recibe el sueldo mensual completo (sb); cualquier otro caso usa la fórmula estándar
  const esMensualSegunda = frecuencia === "mensual" && quincenaTipo === "segunda";
  const sueldoPeriodo = esMensualSegunda ? sb : sueldoDia * periodoTotalDias;

  const descFaltas  = sueldoDia * (faltas + susp);
  const valorHE     = he > 0 ? (sueldoDia / horasDia) * 1.5 * he : 0;
  const totalBruto  = Math.max(0, sueldoPeriodo - descFaltas + valorHE);
  const totalNeto   = Math.max(0, totalBruto - anticipo);

  return {
    sueldo_base:      sb,
    horas_contrato:   hc,
    frecuencia_pago:  frecuencia,
    periodo_dias:     periodoTotalDias,
    dias_trabajados:  parseInt(String(row.dias_trabajados ?? 0)),
    faltas:           faltas,
    suspensiones:     susp,
    horas_trabajadas: parseFloat(String(row.horas_trabajadas ?? 0)),
    horas_extra:      he,
    sueldo_periodo:   parseFloat(sueldoPeriodo.toFixed(2)),
    desc_faltas:      parseFloat(descFaltas.toFixed(2)),
    valor_he:         parseFloat(valorHE.toFixed(2)),
    total_bruto:      parseFloat(totalBruto.toFixed(2)),
    anticipos:        parseFloat(anticipo.toFixed(2)),
    total_neto:       parseFloat(totalNeto.toFixed(2)),
    // IGSS — clasificación (sin cálculo todavía)
    aplica_igss:          igssData.aplica_igss,
    motivo_exclusion_igss: igssData.motivo_exclusion_igss,
    igss_trabajador:  0,
    igss_patronal:    0,
    otros_descuentos: 0,
  };
}

// ─── Clasificación IGSS por empleado ─────────────────────────────────────────
// Consulta la situación actual del colaborador y su puesto titular para
// determinar si aplica IGSS en esta planilla y por qué motivo no aplica.

async function clasificarIgss(employeeId: number | null): Promise<{
  aplica_igss: boolean;
  motivo_exclusion_igss: string | null;
}> {
  if (!employeeId) {
    return { aplica_igss: false, motivo_exclusion_igss: "Sin ID de empleado vinculado" };
  }
  try {
    const { rows } = await pool.query(`
      SELECT
        COALESCE(e.aplica_igss_general, FALSE)  AS aplica_igss_general,
        COALESCE(e.estado_igss, 'no_activo')    AS estado_igss,
        COALESCE(po.aplica_igss, FALSE)         AS puesto_aplica_igss,
        COALESCE(po.regimen_igss, 'no_aplica')  AS puesto_regimen_igss
      FROM employees e
      LEFT JOIN puestos_operativos po
        ON po.titular_employee_id = e.id AND po.activo = TRUE
      WHERE e.id = $1
      LIMIT 1
    `, [employeeId]);

    if (!rows.length) {
      return { aplica_igss: false, motivo_exclusion_igss: "Empleado no encontrado" };
    }
    const r = rows[0];

    if (!r.aplica_igss_general) {
      return { aplica_igss: false, motivo_exclusion_igss: "Colaborador sin IGSS activado" };
    }
    if (r.estado_igss === "pendiente_regularizacion") {
      return { aplica_igss: false, motivo_exclusion_igss: "Colaborador en proceso de regularización IGSS" };
    }
    if (r.estado_igss !== "activo") {
      return { aplica_igss: false, motivo_exclusion_igss: "Estado IGSS del colaborador: no activo" };
    }
    if (!r.puesto_aplica_igss) {
      return { aplica_igss: false, motivo_exclusion_igss: "Servicio/puesto no incluye IGSS (tarifa)" };
    }
    return { aplica_igss: true, motivo_exclusion_igss: null };
  } catch {
    return { aplica_igss: false, motivo_exclusion_igss: "Error al verificar elegibilidad IGSS" };
  }
}

// ─── GET /api/nomina/planillas ────────────────────────────────────────────────

planillaRouter.get("/nomina/planillas", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, ppc.cerrado_por, ppc.cerrado_at, ppc.anulado AS cierre_anulado
      FROM planillas p
      JOIN pre_planilla_cierres ppc ON ppc.id = p.cierre_id
      WHERE p.anulada = FALSE
      ORDER BY p.fecha_generacion DESC
    `);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /nomina/planillas error");
    res.status(500).json({ error: "Error al obtener planillas" });
  }
});

// ─── POST /api/nomina/planilla ────────────────────────────────────────────────

planillaRouter.post("/nomina/planilla", async (req, res) => {
  const { desde, hasta, generadoPor, observaciones } = req.body ?? {};

  if (!desde || !hasta || !generadoPor) {
    return res.status(400).json({ error: "desde, hasta y generadoPor son requeridos" });
  }

  try {
    // Verificar que el período esté cerrado y no anulado
    const { rows: cierres } = await pool.query(
      `SELECT * FROM pre_planilla_cierres
       WHERE periodo_desde = $1::date AND periodo_hasta = $2::date AND anulado = FALSE`,
      [desde, hasta]
    );
    if (!cierres.length) {
      return res.status(422).json({
        error: "El período no está cerrado. Debes cerrar la pre-planilla primero.",
      });
    }
    const cierre = cierres[0];

    // Verificar que no exista ya una planilla activa para este período
    const { rows: existing } = await pool.query(
      `SELECT id FROM planillas WHERE periodo_desde = $1::date AND periodo_hasta = $2::date AND anulada = FALSE`,
      [desde, hasta]
    );
    if (existing.length) {
      return res.status(409).json({
        error: "Ya existe una planilla para este período.",
        planilla_id: existing[0].id,
      });
    }

    // Calcular días del período y detectar quincena
    const d1 = new Date(desde);
    const d2 = new Date(hasta);
    const periodoTotalDias = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
    const quincenaTipo = detectarQuincena(hasta);

    // Leer snapshot del cierre (ya filtrado por quincena desde el cierre)
    const snapshot: Record<string, unknown>[] = cierre.snapshot ?? [];
    if (!snapshot.length) {
      return res.status(422).json({ error: "El snapshot del cierre está vacío." });
    }

    // Clasificar IGSS para cada colaborador (consulta actual de DB, independiente del snapshot)
    const igssMap = new Map<number, { aplica_igss: boolean; motivo_exclusion_igss: string | null }>();
    const empIds = [...new Set(
      snapshot
        .map((r) => r.employee_id as number | null)
        .filter((id): id is number => id != null)
    )];
    if (empIds.length > 0) {
      const { rows: igssRows } = await pool.query(`
        SELECT
          e.id                                        AS employee_id,
          COALESCE(e.aplica_igss_general, FALSE)      AS aplica_igss_general,
          COALESCE(e.estado_igss, 'no_activo')        AS estado_igss,
          COALESCE(po.aplica_igss, FALSE)             AS puesto_aplica_igss
        FROM employees e
        LEFT JOIN puestos_operativos po
          ON po.titular_employee_id = e.id AND po.activo = TRUE
        WHERE e.id = ANY($1::int[])
      `, [empIds]);

      for (const r of igssRows) {
        let aplica = false;
        let motivo: string | null = null;
        if (!r.aplica_igss_general) {
          motivo = "Colaborador sin IGSS activado";
        } else if (r.estado_igss === "pendiente_regularizacion") {
          motivo = "Colaborador en proceso de regularización IGSS";
        } else if (r.estado_igss !== "activo") {
          motivo = "Estado IGSS del colaborador: no activo";
        } else if (!r.puesto_aplica_igss) {
          motivo = "Servicio/puesto no incluye IGSS (tarifa)";
        } else {
          aplica = true;
        }
        igssMap.set(r.employee_id as number, { aplica_igss: aplica, motivo_exclusion_igss: motivo });
      }
    }

    // Calcular líneas por colaborador
    const lineas = snapshot.map((row) => {
      const empId = row.employee_id as number | null;
      const igssData = empId && igssMap.has(empId)
        ? igssMap.get(empId)!
        : { aplica_igss: false, motivo_exclusion_igss: empId ? "Sin datos IGSS" : "Sin ID de empleado" };
      return {
        employee_id:        empId,
        nombre_completo:    String(row.nombre_completo ?? ""),
        dpi:                row.dpi as string | null,
        puesto:             (row.puesto_titular_nombre ?? row.puesto_empleado) as string | null,
        sede:               row.sede as string | null,
        cliente:            row.cliente_principal as string | null,
        tipo_jornada:       row.tipo_jornada as string | null,
        revision_estado:    row.revision_estado as string | null,
        observaciones_rrhh: row.revision_observaciones as string | null,
        ...calcularLinea(row, periodoTotalDias, igssData, quincenaTipo),
      };
    });

    // Totales de planilla
    const totales = lineas.reduce(
      (acc, l) => ({
        total_sueldo_periodo: acc.total_sueldo_periodo + l.sueldo_periodo,
        total_desc_faltas:    acc.total_desc_faltas    + l.desc_faltas,
        total_valor_he:       acc.total_valor_he       + l.valor_he,
        total_bruto:          acc.total_bruto          + l.total_bruto,
        total_anticipos:      acc.total_anticipos      + l.anticipos,
        total_neto:           acc.total_neto           + l.total_neto,
      }),
      { total_sueldo_periodo: 0, total_desc_faltas: 0, total_valor_he: 0, total_bruto: 0, total_anticipos: 0, total_neto: 0 }
    );

    // Insertar planilla
    const { rows: planRows } = await pool.query(`
      INSERT INTO planillas
        (periodo_desde, periodo_hasta, cierre_id, generado_por, observaciones,
         total_colaboradores, total_sueldo_periodo, total_desc_faltas, total_valor_he,
         total_bruto, total_anticipos, total_neto)
      VALUES ($1::date, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `, [
      desde, hasta, cierre.id, generadoPor, observaciones ?? null,
      lineas.length,
      totales.total_sueldo_periodo.toFixed(2),
      totales.total_desc_faltas.toFixed(2),
      totales.total_valor_he.toFixed(2),
      totales.total_bruto.toFixed(2),
      totales.total_anticipos.toFixed(2),
      totales.total_neto.toFixed(2),
    ]);

    const planillaId = planRows[0].id;

    // Insertar líneas con trazabilidad de anticipos
    let totalAnticiposVinculados = 0;

    for (const l of lineas) {
      // Buscar anticipos del empleado que aún no estén vinculados a una planilla
      let anticipoIds: number[] = [];
      if (l.employee_id) {
        const { rows: antRows } = await pool.query(`
          SELECT id, cantidad FROM anticipos
          WHERE employee_id = $1
            AND planilla_id IS NULL
            AND estado IN ('pendiente', 'aprobada')
          ORDER BY fecha_solicitud ASC
        `, [l.employee_id]);
        anticipoIds = antRows.map((r: Record<string, unknown>) => r.id as number);
        totalAnticiposVinculados += anticipoIds.length;

        // Vincular anticipos: marcar como descontados en esta planilla
        if (anticipoIds.length > 0) {
          await pool.query(`
            UPDATE anticipos
            SET planilla_id = $1, estado = 'descontado', updated_at = NOW()
            WHERE id = ANY($2::int[])
          `, [planillaId, anticipoIds]);
        }
      }

      await pool.query(`
        INSERT INTO planilla_lineas
          (planilla_id, employee_id, nombre_completo, dpi, puesto, sede, cliente,
           tipo_jornada, horas_contrato, frecuencia_pago, sueldo_base, periodo_dias,
           dias_trabajados, faltas, suspensiones, horas_trabajadas, horas_extra,
           sueldo_periodo, desc_faltas, valor_he, total_bruto, anticipos, total_neto,
           aplica_igss, motivo_exclusion_igss,
           igss_trabajador, igss_patronal, otros_descuentos,
           anticipo_ids, novedad_ids, segmento_ids,
           revision_estado, observaciones_rrhh)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33)
      `, [
        planillaId, l.employee_id, l.nombre_completo, l.dpi, l.puesto, l.sede, l.cliente,
        l.tipo_jornada, l.horas_contrato, l.frecuencia_pago, l.sueldo_base, l.periodo_dias,
        l.dias_trabajados, l.faltas, l.suspensiones,
        l.horas_trabajadas, l.horas_extra,
        l.sueldo_periodo, l.desc_faltas, l.valor_he, l.total_bruto, l.anticipos, l.total_neto,
        l.aplica_igss, l.motivo_exclusion_igss,
        l.igss_trabajador, l.igss_patronal, l.otros_descuentos,
        JSON.stringify(anticipoIds), JSON.stringify([]), JSON.stringify([]),
        l.revision_estado, l.observaciones_rrhh,
      ]);
    }

    // Registrar en auditoría
    await pool.query(`
      INSERT INTO pre_planilla_auditoria
        (periodo_desde, periodo_hasta, employee_id, accion, usuario, observaciones, metadata)
      VALUES ($1::date, $2::date, NULL, 'planilla_generada', $3, $4, $5)
    `, [
      desde, hasta, generadoPor, observaciones ?? null,
      JSON.stringify({
        planilla_id: planillaId,
        total_colaboradores: lineas.length,
        total_neto: totales.total_neto.toFixed(2),
        anticipos_vinculados: totalAnticiposVinculados,
      }),
    ]);

    res.status(201).json({
      id: planillaId,
      periodo_desde: desde,
      periodo_hasta: hasta,
      total_colaboradores: lineas.length,
      total_neto: totales.total_neto.toFixed(2),
      anticipos_vinculados: totalAnticiposVinculados,
      mensaje: `Planilla generada para el período ${desde} — ${hasta}. ${totalAnticiposVinculados} anticipo(s) vinculado(s) y marcado(s) como descontados.`,
    });
  } catch (err) {
    logger.error({ err }, "POST /nomina/planilla error");
    res.status(500).json({ error: "Error al generar planilla" });
  }
});

// ─── GET /api/nomina/planilla/:id ─────────────────────────────────────────────

planillaRouter.get("/nomina/planilla/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "id inválido" });

  try {
    const { rows: plan } = await pool.query(`
      SELECT p.*, ppc.cerrado_por, ppc.cerrado_at, ppc.anulado AS cierre_anulado
      FROM planillas p
      JOIN pre_planilla_cierres ppc ON ppc.id = p.cierre_id
      WHERE p.id = $1
    `, [id]);
    if (!plan.length) return res.status(404).json({ error: "Planilla no encontrada" });

    const { rows: lineas } = await pool.query(`
      SELECT * FROM planilla_lineas WHERE planilla_id = $1 ORDER BY nombre_completo
    `, [id]);

    res.json({ ...plan[0], lineas });
  } catch (err) {
    logger.error({ err }, "GET /nomina/planilla/:id error");
    res.status(500).json({ error: "Error al obtener planilla" });
  }
});

// ─── PATCH /api/nomina/planilla/:id/estado ────────────────────────────────────

planillaRouter.patch("/nomina/planilla/:id/estado", async (req, res) => {
  const id = parseInt(req.params.id);
  const { estado, aprobadoPor, observaciones } = req.body ?? {};

  if (isNaN(id) || !estado) return res.status(400).json({ error: "id y estado son requeridos" });

  const estadosValidos = ["borrador", "revisada", "aprobada", "pagada"];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser: ${estadosValidos.join(", ")}` });
  }

  try {
    const { rows: current } = await pool.query(
      `SELECT estado, anulada FROM planillas WHERE id = $1`, [id]
    );
    if (!current.length) return res.status(404).json({ error: "Planilla no encontrada" });
    if (current[0].anulada) return res.status(409).json({ error: "La planilla está anulada y no puede modificarse." });

    const { rows } = await pool.query(
      `UPDATE planillas SET estado = $1, observaciones = COALESCE($2, observaciones) WHERE id = $3 RETURNING *`,
      [estado, observaciones ?? null, id]
    );

    // Auditoría
    const p = rows[0];
    await pool.query(`
      INSERT INTO pre_planilla_auditoria
        (periodo_desde, periodo_hasta, employee_id, accion, usuario, observaciones, metadata)
      VALUES ($1::date, $2::date, NULL, 'planilla_estado', $3, $4, $5)
    `, [
      p.periodo_desde, p.periodo_hasta,
      aprobadoPor ?? "sistema", observaciones ?? null,
      JSON.stringify({ planilla_id: id, estado }),
    ]);

    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /nomina/planilla/:id/estado error");
    res.status(500).json({ error: "Error al actualizar estado" });
  }
});

// ─── DELETE /api/nomina/planilla/:id ─────────────────────────────────────────
// Revierte la planilla:
//   1. Solo si estado != 'pagada'
//   2. Desvincula anticipos → planilla_id = NULL, estado = 'aprobada'
//   3. Marca el cierre como anulado → permite re-cerrar pre-planilla
//   4. Reabre revisiones RRHH del período → periodo_cerrado = FALSE
//   5. Anula la planilla (soft delete) + borra líneas via CASCADE

planillaRouter.delete("/nomina/planilla/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { anuladoPor, motivo } = req.body ?? {};

  if (isNaN(id)) return res.status(400).json({ error: "id inválido" });
  if (!anuladoPor) return res.status(400).json({ error: "anuladoPor es requerido" });

  try {
    const { rows: plan } = await pool.query(`SELECT * FROM planillas WHERE id = $1`, [id]);
    if (!plan.length) return res.status(404).json({ error: "Planilla no encontrada" });

    const p = plan[0];

    if (p.anulada) {
      return res.status(409).json({ error: "La planilla ya fue anulada anteriormente." });
    }

    if (p.estado === "pagada") {
      return res.status(409).json({
        error: "No se puede revertir una planilla que ya fue pagada. Contacta al administrador.",
      });
    }

    // 1. Desvincular anticipos: volver a 'aprobada' y limpiar planilla_id
    await pool.query(`
      UPDATE anticipos
      SET planilla_id = NULL, estado = 'aprobada', updated_at = NOW()
      WHERE planilla_id = $1
    `, [id]);

    // 2. Marcar cierre como anulado → reabre la pre-planilla
    await pool.query(`
      UPDATE pre_planilla_cierres
      SET anulado = TRUE, anulado_por = $1, anulado_at = NOW()
      WHERE id = $2
    `, [anuladoPor, p.cierre_id]);

    // 3. Reabrir revisiones RRHH del período
    await pool.query(`
      UPDATE pre_planilla_revision
      SET periodo_cerrado = FALSE, updated_at = NOW()
      WHERE periodo_desde = $1::date AND periodo_hasta = $2::date
    `, [p.periodo_desde, p.periodo_hasta]);

    // 4. Anular planilla (soft delete) — planilla_lineas se borran via CASCADE en DELETE
    //    Usamos soft delete para conservar el registro de auditoría
    await pool.query(`
      UPDATE planillas
      SET anulada = TRUE, anulada_por = $1, anulada_at = NOW(),
          estado = 'borrador', observaciones = COALESCE($2, observaciones)
      WHERE id = $3
    `, [anuladoPor, motivo ?? null, id]);

    // Borrar líneas de esta planilla (por claridad, aunque podría hacerse por CASCADE)
    await pool.query(`DELETE FROM planilla_lineas WHERE planilla_id = $1`, [id]);

    // 5. Auditoría
    await pool.query(`
      INSERT INTO pre_planilla_auditoria
        (periodo_desde, periodo_hasta, employee_id, accion, usuario, observaciones, metadata)
      VALUES ($1::date, $2::date, NULL, 'planilla_revertida', $3, $4, $5)
    `, [
      p.periodo_desde, p.periodo_hasta, anuladoPor, motivo ?? null,
      JSON.stringify({ planilla_id: id, estado_previo: p.estado, cierre_id: p.cierre_id }),
    ]);

    res.json({
      mensaje: `Planilla del período ${p.periodo_desde}—${p.periodo_hasta} revertida correctamente.
La pre-planilla está abierta nuevamente. Los anticipos quedan disponibles.
Corrige en pre-planilla, re-cierra el período y genera una nueva planilla.`,
      planilla_id: id,
      periodo_desde: p.periodo_desde,
      periodo_hasta: p.periodo_hasta,
    });
  } catch (err) {
    logger.error({ err }, "DELETE /nomina/planilla/:id error");
    res.status(500).json({ error: "Error al revertir planilla" });
  }
});

// ─── GET /api/nomina/planilla/:id/export ──────────────────────────────────────

planillaRouter.get("/nomina/planilla/:id/export", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "id inválido" });

  try {
    const { rows: plan } = await pool.query(`SELECT * FROM planillas WHERE id = $1`, [id]);
    if (!plan.length) return res.status(404).json({ error: "Planilla no encontrada" });

    const { rows: lineas } = await pool.query(`
      SELECT * FROM planilla_lineas WHERE planilla_id = $1 ORDER BY nombre_completo
    `, [id]);

    const p = plan[0];
    const BOM = "\uFEFF";
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const fmtQ = (v: unknown) => `Q ${parseFloat(String(v ?? 0)).toFixed(2)}`;

    // Calcular anticipo count por línea
    const anticCountMap = new Map<number, number>();
    for (const l of lineas) {
      const ids: number[] = Array.isArray(l.anticipo_ids) ? l.anticipo_ids : [];
      anticCountMap.set(l.id, ids.length);
    }

    const headers = [
      "ID", "Nombre", "DPI",
      "Puesto", "Sede", "Cliente", "Jornada", "Hrs/Sem",
      "Sueldo Base (Q)", "Días Período", "Días Trabajados",
      "Faltas", "Suspensiones", "H. Trabajadas", "H. Extra",
      "Sueldo Período (Q)", "Desc. Faltas (Q)", "Valor HE (Q)",
      "IGSS Trab. (Q)", "IGSS Pat. (Q)", "Otros Desc. (Q)",
      "Total Bruto (Q)", "Anticipos (Q)", "# Anticipos",
      "Total Neto (Q)", "Revisión RRHH",
    ];

    const csvLines = [
      [`PLANILLA FINAL — ${p.periodo_desde} — ${p.periodo_hasta} — Estado: ${p.estado.toUpperCase()} — Generado por: ${p.generado_por}`].map(esc).join(","),
      "",
      headers.map(esc).join(","),
      ...lineas.map((l) => [
        l.employee_id ? `EMP-${String(l.employee_id).padStart(4, "0")}` : "—",
        l.nombre_completo, l.dpi ?? "",
        l.puesto ?? "", l.sede ?? "", l.cliente ?? "",
        l.tipo_jornada ?? "", l.horas_contrato ?? "",
        fmtQ(l.sueldo_base), l.periodo_dias, l.dias_trabajados,
        l.faltas, l.suspensiones,
        parseFloat(l.horas_trabajadas || 0).toFixed(2),
        parseFloat(l.horas_extra || 0).toFixed(2),
        fmtQ(l.sueldo_periodo), fmtQ(l.desc_faltas), fmtQ(l.valor_he),
        fmtQ(l.igss_trabajador ?? 0), fmtQ(l.igss_patronal ?? 0), fmtQ(l.otros_descuentos ?? 0),
        fmtQ(l.total_bruto), fmtQ(l.anticipos),
        anticCountMap.get(l.id) ?? 0,
        fmtQ(l.total_neto), l.revision_estado ?? "",
      ].map(esc).join(",")),
      "",
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
       fmtQ(p.total_sueldo_periodo), fmtQ(p.total_desc_faltas), fmtQ(p.total_valor_he),
       "—", "—", "—",
       fmtQ(p.total_bruto), fmtQ(p.total_anticipos), "",
       fmtQ(p.total_neto), "TOTALES"].map(esc).join(","),
    ];

    const filename = `planilla_${p.periodo_desde}_${p.periodo_hasta}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(BOM + csvLines.join("\r\n"));
  } catch (err) {
    logger.error({ err }, "GET /nomina/planilla/:id/export error");
    res.status(500).json({ error: "Error al exportar planilla" });
  }
});
