/**
 * planilla.ts — Planilla Final de Nómina
 *
 * FLUJO COMPLETO:
 *   Operación diaria → Novedades → Pre-Planilla → [CIERRE] → Planilla Final
 *
 * ENDPOINTS:
 *   GET  /api/nomina/planillas                  → Lista todas las planillas generadas
 *   POST /api/nomina/planilla                   → Genera planilla desde snapshot cerrado
 *   GET  /api/nomina/planilla/:id               → Detalle de planilla + líneas
 *   PATCH /api/nomina/planilla/:id/estado       → Cambia estado (borrador→revisada→aprobada→pagada)
 *   GET  /api/nomina/planilla/:id/export        → Exporta CSV con BOM
 *
 * REGLAS:
 *   - La planilla SOLO se genera desde un período cerrado (pre_planilla_cierres)
 *   - Solo puede existir UNA planilla por período (unicidad forzada en BD)
 *   - La planilla no se edita directamente: si hay error, se corrige en pre-planilla y se re-cierra
 *   - El cálculo usa los datos del snapshot JSONB, nunca datos en vivo
 *
 * CÁLCULO (sin IGSS ni séptimo todavía):
 *   sueldoDia    = sueldo_base / 30
 *   sueldoPeriodo = sueldoDia * periodoTotalDias
 *   descFaltas   = sueldoDia * (faltas + suspensiones)
 *   horasDia     = horas_contrato / 6  (jornada 6 días) o 8 (default)
 *   valorHE      = (sueldoDia / horasDia) * 1.5 * horasExtra
 *   totalBruto   = sueldoPeriodo - descFaltas + valorHE
 *   totalNeto    = totalBruto - anticipos
 */

import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

export const planillaRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcularLinea(row: Record<string, unknown>, periodoTotalDias: number) {
  const sb       = parseFloat(String(row.sueldo_base  ?? 0));
  const hc       = parseFloat(String(row.horas_contrato ?? 48));
  const faltas   = parseInt(String(row.faltas       ?? 0));
  const susp     = parseInt(String(row.suspensiones ?? 0));
  const he       = parseFloat(String(row.horas_extra ?? 0));
  const anticipo = parseFloat(String(row.anticipos_monto ?? 0));

  const horasDia    = hc > 0 ? hc / 6 : 8;
  const sueldoDia   = sb / 30;
  const sueldoPeriodo = sueldoDia * periodoTotalDias;
  const descFaltas   = sueldoDia * (faltas + susp);
  const valorHE      = he > 0 ? (sueldoDia / horasDia) * 1.5 * he : 0;
  const totalBruto   = Math.max(0, sueldoPeriodo - descFaltas + valorHE);
  const totalNeto    = Math.max(0, totalBruto - anticipo);

  return {
    sueldo_base:      sb,
    horas_contrato:   hc,
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
  };
}

// ─── GET /api/nomina/planillas ────────────────────────────────────────────────
planillaRouter.get("/nomina/planillas", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, ppc.cerrado_por, ppc.cerrado_at
      FROM planillas p
      JOIN pre_planilla_cierres ppc ON ppc.id = p.cierre_id
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
    // Verificar que el período esté cerrado
    const { rows: cierres } = await pool.query(
      `SELECT * FROM pre_planilla_cierres WHERE periodo_desde = $1::date AND periodo_hasta = $2::date`,
      [desde, hasta]
    );
    if (!cierres.length) {
      return res.status(422).json({
        error: "El período no está cerrado. Debes cerrar la pre-planilla primero.",
      });
    }
    const cierre = cierres[0];

    // Verificar que no exista ya una planilla para este período
    const { rows: existing } = await pool.query(
      `SELECT id FROM planillas WHERE periodo_desde = $1::date AND periodo_hasta = $2::date`,
      [desde, hasta]
    );
    if (existing.length) {
      return res.status(409).json({
        error: "Ya existe una planilla para este período.",
        planilla_id: existing[0].id,
      });
    }

    // Calcular días del período
    const d1 = new Date(desde);
    const d2 = new Date(hasta);
    const periodoTotalDias = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;

    // Leer snapshot del cierre
    const snapshot: Record<string, unknown>[] = cierre.snapshot ?? [];

    if (!snapshot.length) {
      return res.status(422).json({ error: "El snapshot del cierre está vacío." });
    }

    // Calcular líneas por colaborador
    const lineas = snapshot.map((row) => ({
      employee_id:      row.employee_id as number | null,
      nombre_completo:  String(row.nombre_completo ?? ""),
      dpi:              row.dpi as string | null,
      puesto:           (row.puesto_titular_nombre ?? row.puesto_empleado) as string | null,
      sede:             row.sede as string | null,
      cliente:          row.cliente_principal as string | null,
      tipo_jornada:     row.tipo_jornada as string | null,
      revision_estado:  row.revision_estado as string | null,
      observaciones_rrhh: row.revision_observaciones as string | null,
      ...calcularLinea(row, periodoTotalDias),
    }));

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

    // Insertar líneas
    for (const l of lineas) {
      await pool.query(`
        INSERT INTO planilla_lineas
          (planilla_id, employee_id, nombre_completo, dpi, puesto, sede, cliente,
           tipo_jornada, horas_contrato, sueldo_base, periodo_dias,
           dias_trabajados, faltas, suspensiones, horas_trabajadas, horas_extra,
           sueldo_periodo, desc_faltas, valor_he, total_bruto, anticipos, total_neto,
           revision_estado, observaciones_rrhh)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
      `, [
        planillaId, l.employee_id, l.nombre_completo, l.dpi, l.puesto, l.sede, l.cliente,
        l.tipo_jornada, l.horas_contrato, l.sueldo_base, l.periodo_dias,
        l.dias_trabajados, l.faltas, l.suspensiones,
        l.horas_trabajadas, l.horas_extra,
        l.sueldo_periodo, l.desc_faltas, l.valor_he, l.total_bruto, l.anticipos, l.total_neto,
        l.revision_estado, l.observaciones_rrhh,
      ]);
    }

    // Registrar en auditoría
    await pool.query(`
      INSERT INTO pre_planilla_auditoria (periodo_desde, periodo_hasta, employee_id, accion, usuario, observaciones, metadata)
      VALUES ($1::date, $2::date, NULL, 'planilla_generada', $3, $4, $5)
    `, [desde, hasta, generadoPor, observaciones ?? null, JSON.stringify({ planilla_id: planillaId, total_colaboradores: lineas.length, total_neto: totales.total_neto.toFixed(2) })]);

    res.status(201).json({
      id: planillaId,
      periodo_desde: desde,
      periodo_hasta: hasta,
      total_colaboradores: lineas.length,
      total_neto: totales.total_neto.toFixed(2),
      mensaje: `Planilla generada para el período ${desde} — ${hasta}`,
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
    const { rows: plan } = await pool.query(
      `SELECT p.*, ppc.cerrado_por, ppc.cerrado_at FROM planillas p
       JOIN pre_planilla_cierres ppc ON ppc.id = p.cierre_id
       WHERE p.id = $1`, [id]
    );
    if (!plan.length) return res.status(404).json({ error: "Planilla no encontrada" });

    const { rows: lineas } = await pool.query(
      `SELECT * FROM planilla_lineas WHERE planilla_id = $1 ORDER BY nombre_completo`, [id]
    );

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
    const { rows } = await pool.query(
      `UPDATE planillas SET estado = $1, observaciones = COALESCE($2, observaciones) WHERE id = $3 RETURNING *`,
      [estado, observaciones ?? null, id]
    );
    if (!rows.length) return res.status(404).json({ error: "Planilla no encontrada" });

    // Auditoría
    const p = rows[0];
    await pool.query(`
      INSERT INTO pre_planilla_auditoria (periodo_desde, periodo_hasta, employee_id, accion, usuario, observaciones, metadata)
      VALUES ($1::date, $2::date, NULL, 'planilla_estado', $3, $4, $5)
    `, [p.periodo_desde, p.periodo_hasta, aprobadoPor ?? "sistema", observaciones ?? null, JSON.stringify({ planilla_id: id, estado })]);

    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /nomina/planilla/:id/estado error");
    res.status(500).json({ error: "Error al actualizar estado" });
  }
});

// ─── GET /api/nomina/planilla/:id/export ──────────────────────────────────────
planillaRouter.get("/nomina/planilla/:id/export", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "id inválido" });

  try {
    const { rows: plan } = await pool.query(`SELECT * FROM planillas WHERE id = $1`, [id]);
    if (!plan.length) return res.status(404).json({ error: "Planilla no encontrada" });

    const { rows: lineas } = await pool.query(
      `SELECT * FROM planilla_lineas WHERE planilla_id = $1 ORDER BY nombre_completo`, [id]
    );

    const p = plan[0];
    const BOM = "\uFEFF";
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const fmtQ = (v: unknown) => `Q ${parseFloat(String(v ?? 0)).toFixed(2)}`;

    const headers = [
      "ID", "Nombre", "DPI",
      "Puesto", "Sede", "Cliente",
      "Jornada", "Hrs/Sem",
      "Sueldo Base (Q)", "Días Período", "Días Trabajados",
      "Faltas", "Suspensiones",
      "H. Trabajadas", "H. Extra",
      "Sueldo Período (Q)", "Desc. Faltas (Q)", "Valor HE (Q)",
      "Total Bruto (Q)", "Anticipos (Q)", "Total Neto (Q)",
      "Revisión RRHH",
    ];

    const lines = [
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
        fmtQ(l.total_bruto), fmtQ(l.anticipos), fmtQ(l.total_neto),
        l.revision_estado ?? "",
      ].map(esc).join(",")),
      "",
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "",
       fmtQ(p.total_sueldo_periodo), fmtQ(p.total_desc_faltas), fmtQ(p.total_valor_he),
       fmtQ(p.total_bruto), fmtQ(p.total_anticipos), fmtQ(p.total_neto),
       "TOTALES"].map(esc).join(","),
    ];

    const filename = `planilla_${p.periodo_desde}_${p.periodo_hasta}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(BOM + lines.join("\r\n"));
  } catch (err) {
    logger.error({ err }, "GET /nomina/planilla/:id/export error");
    res.status(500).json({ error: "Error al exportar planilla" });
  }
});
