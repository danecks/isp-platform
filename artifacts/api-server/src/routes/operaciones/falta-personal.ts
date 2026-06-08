import { Router } from "express";
import { pool, todayGT } from "@workspace/db";
import { logger } from "../../lib/logger";

const router = Router();

function getRol(req: any): string {
  try { return JSON.parse(req.headers["x-isp-session"] as string ?? "")?.rol ?? ""; }
  catch { return ""; }
}

// Personal de oficina (sin puesto operativo) cuya falta se registra desde el pizarrón.
// Los guardias/custodios usan el flujo del puesto (POST /operaciones/liberar).
const TIPOS_PERSONAL_OFICINA = [
  "supervisor", "jefe_servicio",
  "administrativo", "administrativo_rrhh", "administrativo_bodega", "gerencia",
];

// ─── POST /api/operaciones/falta-personal ────────────────────────────────────
// Registra una falta para personal sin puesto (administración, supervisores,
// jefes de servicio). Crea el evento RRHH 'falta' (pendiente) + la novedad de
// nómina pendiente de revisión, igual que el flujo de agentes en /liberar pero
// sin campos de puesto. NO toca puestos_operativos (estas personas no tienen).
router.post("/operaciones/falta-personal", async (req, res) => {
  const rol = getRol(req);
  if (!["admin", "operaciones"].includes(rol)) {
    return res.status(403).json({ error: "Solo admin u operaciones pueden registrar faltas" });
  }

  const { employeeId, usuario, notas, motivo, fecha } = req.body as {
    employeeId: number; usuario?: string; notas?: string; motivo?: string; fecha?: string;
  };
  if (!employeeId) return res.status(400).json({ error: "employeeId es requerido" });

  const fechaDia = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : todayGT();
  const observaciones = String(notas ?? motivo ?? "").trim().slice(0, 500) || null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Día no cerrado
    const { rows: cierreRows } = await client.query(
      `SELECT estado FROM cierre_operativo_diario WHERE fecha = $1`,
      [fechaDia],
    );
    if (cierreRows.length && cierreRows[0].estado === "cerrado") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "El día está cerrado. Reabra el día antes de registrar faltas." });
    }

    const { rows: empRows } = await client.query(
      `SELECT id, nombre_completo, dpi, COALESCE(tipo_personal, 'guardia') AS tipo_personal
         FROM employees WHERE id = $1`,
      [employeeId],
    );
    if (!empRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Empleado no encontrado" });
    }
    const emp = empRows[0];
    if (!TIPOS_PERSONAL_OFICINA.includes(emp.tipo_personal)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Use el flujo del puesto para registrar faltas de guardias" });
    }

    // Evitar falta duplicada para ese empleado y día
    const { rows: yaFalta } = await client.query(`
      SELECT id FROM eventos_rrhh
       WHERE employee_id = $1 AND tipo_evento = 'falta'
         AND fecha::date = $2::date AND estado NOT IN ('anulado', 'cancelado')
       LIMIT 1
    `, [employeeId, fechaDia]);
    if (yaFalta.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Esta persona ya tiene una falta registrada hoy" });
    }

    // Evento RRHH 'falta' (pendiente) — fuente del pizarrón
    const { rows: eventoRows } = await client.query(`
      INSERT INTO eventos_rrhh
        (employee_id, employee_nombre, employee_dpi, tipo_evento, fecha,
         generado_desde, estado, usuario_generador, observaciones)
      VALUES ($1, $2, $3, 'falta', $4::date, 'pizarron', 'pendiente', $5, $6)
      RETURNING id
    `, [emp.id, emp.nombre_completo, emp.dpi ?? null, fechaDia, usuario ?? "sistema", observaciones]);
    const eventoRrhhId = eventoRows[0]?.id ?? null;

    // Novedad pendiente de revisión RRHH — no descuenta hasta que RRHH resuelva
    await client.query(`
      INSERT INTO novedades_nomina_diarias
        (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
         falta, descuento_dia, impacto_nomina, requiere_revision_rrhh,
         tipo_novedad, evento_rrhh_id, fuente)
      VALUES ($1, $2, $3, FALSE, 0, 0, FALSE, FALSE, 'pendiente', TRUE,
              'falta_total', $4, 'falta_pizarron_personal')
      ON CONFLICT (fecha, employee_id) DO UPDATE SET
        trabajo_dia            = FALSE,
        horas_trabajadas       = 0,
        tipo_novedad           = COALESCE(novedades_nomina_diarias.tipo_novedad, 'falta_total'),
        evento_rrhh_id         = COALESCE(novedades_nomina_diarias.evento_rrhh_id, EXCLUDED.evento_rrhh_id),
        impacto_nomina         = CASE
          WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
          THEN novedades_nomina_diarias.impacto_nomina
          ELSE 'pendiente'
        END,
        requiere_revision_rrhh = CASE
          WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
          THEN novedades_nomina_diarias.requiere_revision_rrhh
          ELSE TRUE
        END,
        updated_at             = NOW()
    `, [fechaDia, emp.id, emp.nombre_completo, eventoRrhhId]);

    await client.query("COMMIT");
    logger.info({ employeeId, fechaDia, eventoRrhhId }, "falta-personal: incidencia creada como pendiente RRHH");
    res.json({ ok: true, eventoId: eventoRrhhId, mensaje: `Falta registrada para ${emp.nombre_completo}` });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "POST /operaciones/falta-personal error");
    res.status(500).json({ error: "Error al registrar falta" });
  } finally {
    client.release();
  }
});

// ─── POST /api/operaciones/anular-falta-personal ─────────────────────────────
// Deshace una falta de personal de oficina registrada por error: anula el(los)
// evento(s) RRHH 'falta' del día y elimina la novedad pendiente asociada (si
// RRHH aún no la resolvió). No hay puesto/slot/HE par que tocar.
router.post("/operaciones/anular-falta-personal", async (req, res) => {
  const rol = getRol(req);
  if (!["admin", "operaciones"].includes(rol)) {
    return res.status(403).json({ error: "Solo admin u operaciones pueden anular faltas" });
  }

  const { employeeId, usuario, motivo, fecha } = req.body as {
    employeeId: number; usuario?: string; motivo?: string; fecha?: string;
  };
  if (!employeeId) return res.status(400).json({ error: "employeeId es requerido" });
  const motivoTxt = String(motivo ?? "").trim();
  if (!motivoTxt) return res.status(400).json({ error: "motivo es requerido" });
  if (motivoTxt.length > 500) return res.status(400).json({ error: "motivo no puede exceder 500 caracteres" });

  const fechaDia = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : todayGT();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Día no cerrado
    const { rows: cierreRows } = await client.query(
      `SELECT estado FROM cierre_operativo_diario WHERE fecha = $1`,
      [fechaDia],
    );
    if (cierreRows.length && cierreRows[0].estado === "cerrado") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "El día está cerrado. Reabra el día antes de anular faltas." });
    }

    // Solo personal de oficina: los guardias/custodios usan /operaciones/anular-falta
    const { rows: empRows } = await client.query(
      `SELECT COALESCE(tipo_personal, 'guardia') AS tipo_personal FROM employees WHERE id = $1`,
      [employeeId],
    );
    if (!empRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Empleado no encontrado" });
    }
    if (!TIPOS_PERSONAL_OFICINA.includes(empRows[0].tipo_personal)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Use el flujo del puesto para anular faltas de guardias" });
    }

    // Solo faltas generadas desde el pizarrón de personal (no toca otras fuentes)
    const { rows: faltaEvs } = await client.query(`
      SELECT id, estado FROM eventos_rrhh
       WHERE employee_id = $1 AND tipo_evento = 'falta'
         AND fecha::date = $2::date AND estado NOT IN ('anulado', 'cancelado')
         AND generado_desde = 'pizarron'
    `, [employeeId, fechaDia]);
    if (!faltaEvs.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "No hay una falta activa para anular" });
    }

    for (const ev of faltaEvs) {
      await client.query(`
        UPDATE eventos_rrhh
           SET estado = 'anulado', estado_anterior = $1, anulado_por = $2,
               anulado_at = NOW(), motivo_anulacion = $3, updated_at = NOW()
         WHERE id = $4
      `, [ev.estado, usuario ?? "sistema", motivoTxt, ev.id]);
    }

    // Eliminar la novedad pendiente generada por esta falta (si RRHH no la resolvió)
    await client.query(`
      DELETE FROM novedades_nomina_diarias
       WHERE fecha = $1 AND employee_id = $2
         AND fuente = 'falta_pizarron_personal'
         AND impacto_nomina NOT IN ('aprobado_rrhh', 'rechazado_rrhh')
    `, [fechaDia, employeeId]);

    await client.query("COMMIT");
    logger.info({ employeeId, fechaDia, usuario }, "anular-falta-personal: falta anulada");
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "POST /operaciones/anular-falta-personal error");
    res.status(500).json({ error: "Error al anular falta" });
  } finally {
    client.release();
  }
});

export default router;
