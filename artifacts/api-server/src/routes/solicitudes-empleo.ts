/**
 * solicitudes-empleo.ts
 * API para el módulo kiosco de solicitudes de empleo.
 *
 * ENDPOINTS PÚBLICOS (kiosco):
 *   POST /solicitudes-empleo/verificar-pin   → verifica PIN del kiosco
 *   POST /solicitudes-empleo                 → crear nueva solicitud
 *
 * ENDPOINTS ADMIN:
 *   GET  /solicitudes-empleo                 → listar solicitudes (con filtros)
 *   GET  /solicitudes-empleo/:id             → detalle de solicitud
 *   PATCH /solicitudes-empleo/:id/estado     → cambiar estado
 *   POST  /solicitudes-empleo/:id/contratar  → convertir en empleado
 *   DELETE /solicitudes-empleo/:id/foto      → borrar foto manualmente
 */
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const MAX_FOTO_BYTES = 5 * 1024 * 1024; // 5 MB

const pinRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Intente nuevamente en 15 minutos." },
});

export const solicitudesEmpleoRouter = Router();
const storageService = new ObjectStorageService();

// ── Subir foto de solicitud (almacenada como data URL en DB) ─────────────────
solicitudesEmpleoRouter.post("/solicitudes-empleo/foto", async (req: Request, res: Response) => {
  try {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let aborted = false;
    req.on("data", (chunk: Buffer) => {
      if (aborted) return;
      totalBytes += chunk.length;
      if (totalBytes > MAX_FOTO_BYTES) {
        aborted = true;
        req.destroy();
        res.status(413).json({ error: "La foto supera el tamaño máximo de 5 MB" });
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", async () => {
      if (aborted) return;
      try {
        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) return res.status(400).json({ error: "Foto vacía" });
        const objectPath = `data:image/jpeg;base64,${buffer.toString("base64")}`;
        res.json({ objectPath });
      } catch (err) {
        logger.error({ err }, "solicitudes-empleo/foto upload error");
        res.status(500).json({ error: "Error subiendo foto" });
      }
    });
  } catch (err) {
    logger.error({ err }, "solicitudes-empleo/foto error");
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ── Verificar PIN del kiosco ──────────────────────────────────────────────────
solicitudesEmpleoRouter.post("/solicitudes-empleo/verificar-pin", pinRateLimit, async (req: Request, res: Response) => {
  const { pin } = req.body ?? {};
  if (!pin) return res.status(400).json({ error: "PIN requerido" });
  try {
    const { rows } = await pool.query(
      `SELECT value FROM system_config WHERE key = 'kiosco_pin' LIMIT 1`
    );
    const pinCorrecto = rows[0]?.value ?? "1234";
    if (pin === pinCorrecto) {
      res.json({ ok: true });
    } else {
      res.status(401).json({ ok: false, error: "PIN incorrecto" });
    }
  } catch (err) {
    logger.error({ err }, "solicitudes-empleo/verificar-pin error");
    res.status(500).json({ error: "Error del servidor" });
  }
});

// ── Crear solicitud (kiosco) ──────────────────────────────────────────────────
solicitudesEmpleoRouter.post("/solicitudes-empleo", async (req: Request, res: Response) => {
  const {
    nombre_completo, fecha_nacimiento, dpi, genero, estado_civil,
    telefono, telefono_emergencia, nombre_contacto_emergencia,
    correo, direccion, municipio, departamento,
    nombre_padre, nombre_madre, num_dependientes,
    familiar_en_empresa, nombre_familiar_empresa,
    grado_estudios, experiencia_seguridad, anios_experiencia,
    empresa_anterior, licencia_armas, tiene_vehiculo,
    puesto_solicitado, disponibilidad_horario, disponible_exterior,
    pretension_salarial, foto_url,
  } = req.body ?? {};

  if (!nombre_completo?.trim()) {
    return res.status(400).json({ error: "Nombre completo requerido" });
  }

  try {
    const fotoExpira = foto_url
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { rows } = await pool.query(`
      INSERT INTO solicitudes_empleo (
        nombre_completo, fecha_nacimiento, dpi, genero, estado_civil,
        telefono, telefono_emergencia, nombre_contacto_emergencia,
        correo, direccion, municipio, departamento,
        nombre_padre, nombre_madre, num_dependientes,
        familiar_en_empresa, nombre_familiar_empresa,
        grado_estudios, experiencia_seguridad, anios_experiencia,
        empresa_anterior, licencia_armas, tiene_vehiculo,
        puesto_solicitado, disponibilidad_horario, disponible_exterior,
        pretension_salarial, foto_url, foto_expira_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
      RETURNING id, created_at
    `, [
      nombre_completo.trim(), fecha_nacimiento || null, dpi || null, genero || null, estado_civil || null,
      telefono || null, telefono_emergencia || null, nombre_contacto_emergencia || null,
      correo || null, direccion || null, municipio || null, departamento || null,
      nombre_padre || null, nombre_madre || null, num_dependientes || 0,
      familiar_en_empresa || false, nombre_familiar_empresa || null,
      grado_estudios || null, experiencia_seguridad || false, anios_experiencia || 0,
      empresa_anterior || null, licencia_armas || false, tiene_vehiculo || false,
      puesto_solicitado || null, disponibilidad_horario || null, disponible_exterior || false,
      pretension_salarial || null, foto_url || null, fotoExpira,
    ]);
    res.status(201).json({ ok: true, id: rows[0].id });
  } catch (err) {
    logger.error({ err }, "POST /solicitudes-empleo error");
    res.status(500).json({ error: "Error al guardar solicitud" });
  }
});

// ── Listar solicitudes (admin) ────────────────────────────────────────────────
solicitudesEmpleoRouter.get("/solicitudes-empleo", async (req: Request, res: Response) => {
  const { estado, q } = req.query as Record<string, string>;
  try {
    let where = "WHERE 1=1";
    const params: unknown[] = [];
    if (estado && estado !== "todos") {
      params.push(estado);
      where += ` AND estado = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (nombre_completo ILIKE $${params.length} OR dpi ILIKE $${params.length} OR puesto_solicitado ILIKE $${params.length})`;
    }
    const { rows } = await pool.query(`
      SELECT id, nombre_completo, dpi, telefono, puesto_solicitado,
             disponibilidad_horario, grado_estudios, experiencia_seguridad,
             foto_url, estado, created_at, revisado_por, revisado_at,
             employee_id, municipio, departamento
      FROM solicitudes_empleo
      ${where}
      ORDER BY created_at DESC
      LIMIT 200
    `, params);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /solicitudes-empleo error");
    res.status(500).json({ error: "Error obteniendo solicitudes" });
  }
});

// ── Detalle de solicitud ──────────────────────────────────────────────────────
solicitudesEmpleoRouter.get("/solicitudes-empleo/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    const { rows } = await pool.query(
      `SELECT * FROM solicitudes_empleo WHERE id = $1`, [id]
    );
    if (!rows[0]) return res.status(404).json({ error: "No encontrada" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "GET /solicitudes-empleo/:id error");
    res.status(500).json({ error: "Error obteniendo solicitud" });
  }
});

// ── Cambiar estado ────────────────────────────────────────────────────────────
solicitudesEmpleoRouter.patch("/solicitudes-empleo/:id/estado", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  const { estado, notas_reclutador, revisado_por } = req.body ?? {};
  if (!estado) return res.status(400).json({ error: "estado requerido" });
  try {
    await pool.query(`
      UPDATE solicitudes_empleo
      SET estado = $1, notas_reclutador = COALESCE($2, notas_reclutador),
          revisado_por = $3, revisado_at = NOW(), updated_at = NOW()
      WHERE id = $4
    `, [estado, notas_reclutador || null, revisado_por || null, id]);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "PATCH /solicitudes-empleo/:id/estado error");
    res.status(500).json({ error: "Error actualizando estado" });
  }
});

// ── Contratar: convertir solicitud en ficha de empleado ──────────────────────
solicitudesEmpleoRouter.post("/solicitudes-empleo/:id/contratar", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    const { rows } = await pool.query(`SELECT * FROM solicitudes_empleo WHERE id = $1`, [id]);
    const sol = rows[0];
    if (!sol) return res.status(404).json({ error: "Solicitud no encontrada" });

    if (sol.employee_id) {
      return res.json({ ok: true, employee_id: sol.employee_id });
    }

    const sexo = sol.genero === "Masculino" ? "M" : sol.genero === "Femenino" ? "F" : null;
    const notasExtra = [
      sol.municipio && sol.departamento ? `Domicilio: ${sol.municipio}, ${sol.departamento}` : null,
      sol.puesto_solicitado ? `Puesto solicitado: ${sol.puesto_solicitado}` : null,
      sol.pretension_salarial ? `Pretensión salarial: Q${sol.pretension_salarial}` : null,
      `Creado automáticamente desde solicitud SOL-${String(sol.id).padStart(5, "0")}`,
    ].filter(Boolean).join(" | ");

    const { rows: empRows } = await pool.query(`
      INSERT INTO employees (
        nombre_completo, dpi, telefono, correo,
        fecha_nacimiento, sexo, estado_civil, nivel_educativo,
        municipio, departamento,
        foto_url, estado_laboral, tipo_personal, fecha_ingreso,
        notas, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'activo','guardia',CURRENT_DATE,$12,NOW(),NOW())
      RETURNING id
    `, [
      sol.nombre_completo,
      sol.dpi || null,
      sol.telefono || null,
      sol.correo || null,
      sol.fecha_nacimiento || null,
      sexo,
      sol.estado_civil || null,
      sol.grado_estudios || null,
      sol.municipio || null,
      sol.departamento || null,
      sol.foto_url || null,
      notasExtra || null,
    ]);

    const empId = empRows[0].id;

    await pool.query(`
      UPDATE solicitudes_empleo
      SET employee_id = $1, estado = 'contratada', updated_at = NOW()
      WHERE id = $2
    `, [empId, id]);

    logger.info({ solicitudId: id, employeeId: empId }, "kiosco: solicitud convertida en empleado");
    res.json({ ok: true, employee_id: empId });
  } catch (err) {
    logger.error({ err }, "POST /solicitudes-empleo/:id/contratar error");
    res.status(500).json({ error: "Error al contratar" });
  }
});

// ── Borrar foto ───────────────────────────────────────────────────────────────
solicitudesEmpleoRouter.delete("/solicitudes-empleo/:id/foto", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    const { rows } = await pool.query(
      `SELECT foto_url FROM solicitudes_empleo WHERE id = $1`, [id]
    );
    const fotoUrl = rows[0]?.foto_url;
    if (fotoUrl && !fotoUrl.startsWith("data:")) {
      try {
        const file = await storageService.getObjectEntityFile(fotoUrl);
        await file.delete();
      } catch (e) {
        if (!(e instanceof ObjectNotFoundError)) logger.warn({ e }, "foto no encontrada en storage");
      }
    }
    await pool.query(
      `UPDATE solicitudes_empleo SET foto_url = NULL, foto_expira_at = NULL, updated_at = NOW() WHERE id = $1`, [id]
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /solicitudes-empleo/:id/foto error");
    res.status(500).json({ error: "Error borrando foto" });
  }
});

// ── Auto-cleanup: borrar fotos expiradas ─────────────────────────────────────
export async function limpiarFotosExpiradas() {
  try {
    const { rows } = await pool.query(`
      SELECT id, foto_url FROM solicitudes_empleo
      WHERE foto_url IS NOT NULL
        AND foto_expira_at < NOW()
        AND estado NOT IN ('contratada')
    `);
    if (rows.length === 0) return;
    logger.info({ count: rows.length }, "kiosco: limpiando fotos expiradas");
    for (const row of rows) {
      if (!row.foto_url.startsWith("data:")) {
        try {
          const file = await storageService.getObjectEntityFile(row.foto_url);
          await file.delete();
        } catch { /* ignorar si ya no existe */ }
      }
      await pool.query(
        `UPDATE solicitudes_empleo SET foto_url = NULL, foto_expira_at = NULL, updated_at = NOW() WHERE id = $1`,
        [row.id]
      );
    }
    logger.info({ count: rows.length }, "kiosco: fotos expiradas limpiadas");
  } catch (err) {
    logger.error({ err }, "kiosco: error limpiando fotos expiradas");
  }
}
