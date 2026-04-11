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

/** Elimina tildes/diacríticos de un nombre y lo deja en mayúsculas */
function normalizarNombre(str: string): string {
  if (!str) return str;
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

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

// ── Extraer datos del DPI usando IA (visión) ──────────────────────────────────
solicitudesEmpleoRouter.post("/solicitudes-empleo/extraer-dpi", async (req: Request, res: Response) => {
  try {
    const { imagen } = req.body ?? {};
    if (!imagen || typeof imagen !== "string") {
      return res.status(400).json({ error: "imagen requerida (base64 data URL)" });
    }

    const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    if (!baseUrl || !apiKey) {
      return res.status(503).json({ error: "Integración de IA no configurada" });
    }

    const imageUrl = imagen.startsWith("data:") ? imagen : `data:image/jpeg;base64,${imagen}`;

    const aiRes = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Eres un asistente que extrae datos del Documento Personal de Identificación (DPI/CUI) de Guatemala.
Analiza la imagen y extrae estos campos. El DPI muestra los apellidos antes que los nombres, pero debes devolverlos en orden NOMBRE APELLIDO (primero el nombre de pila, luego los apellidos).
Responde SOLO con un JSON válido con estas claves (deja vacío "" si no puedes leer el campo):
{
  "nombre_completo": "nombres de pila seguidos de los apellidos (ej: Juan Carlos Pérez García)",
  "dpi": "los 13 dígitos del CUI sin espacios",
  "fecha_nacimiento": "YYYY-MM-DD",
  "genero": "Masculino o Femenino",
  "municipio": "municipio de vecindad",
  "departamento": "departamento de vecindad"
}
No incluyas explicaciones, solo el JSON.`,
              },
              {
                type: "image_url",
                image_url: { url: imageUrl, detail: "high" },
              },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      logger.error({ status: aiRes.status, errText }, "extraer-dpi: AI error");
      return res.status(502).json({ error: "Error del servicio de IA", detalle: errText });
    }

    const aiData = await aiRes.json() as { choices?: { message?: { content?: string } }[] };
    const content = aiData.choices?.[0]?.message?.content ?? "";

    let datos: Record<string, string> = {};
    try {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) datos = JSON.parse(match[0]);
    } catch {
      logger.warn({ content }, "extraer-dpi: no se pudo parsear JSON de IA");
    }

    // Normalizar nombre: sin tildes, en mayúsculas
    if (datos.nombre_completo) datos.nombre_completo = normalizarNombre(datos.nombre_completo);

    res.json({ datos });
  } catch (err) {
    logger.error({ err }, "solicitudes-empleo/extraer-dpi error");
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
    pretension_salarial, foto_url, dpi_frente_url, dpi_reverso_url, canal,
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
        pretension_salarial, foto_url, foto_expira_at,
        dpi_frente_url, dpi_reverso_url, canal
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)
      RETURNING id, created_at
    `, [
      normalizarNombre(nombre_completo), fecha_nacimiento || null, dpi || null, genero || null, estado_civil || null,
      telefono || null, telefono_emergencia || null, nombre_contacto_emergencia || null,
      correo || null, direccion || null, municipio || null, departamento || null,
      nombre_padre || null, nombre_madre || null, num_dependientes || 0,
      familiar_en_empresa || false, nombre_familiar_empresa || null,
      grado_estudios || null, experiencia_seguridad || false, anios_experiencia || 0,
      empresa_anterior || null, licencia_armas || false, tiene_vehiculo || false,
      puesto_solicitado || null, disponibilidad_horario || null, disponible_exterior || false,
      pretension_salarial || null, foto_url || null, fotoExpira,
      dpi_frente_url || null, dpi_reverso_url || null, canal || "kiosco",
    ]);

    const solicitudId = rows[0].id;
    let esReingreso = false;

    // ── Detección de reingreso: ¿el DPI ya existe en employees? ─────────────
    if (dpi) {
      try {
        const { rows: empRows } = await pool.query(
          `SELECT id FROM employees WHERE dpi = $1 LIMIT 1`, [dpi.trim()]
        );
        if (empRows.length > 0) {
          esReingreso = true;
          await pool.query(
            `UPDATE solicitudes_empleo SET es_reingreso = TRUE WHERE id = $1`, [solicitudId]
          );
          await pool.query(
            `INSERT INTO solicitudes_merge_requests (solicitud_id, employee_id) VALUES ($1, $2)`,
            [solicitudId, empRows[0].id]
          );
          logger.info({ solicitudId, employeeId: empRows[0].id }, "Reingreso detectado — merge request creado");
        }
      } catch (mergeErr) {
        logger.error({ mergeErr }, "Error al verificar reingreso (no bloqueante)");
      }
    }

    res.status(201).json({ ok: true, id: solicitudId, es_reingreso: esReingreso });
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
             foto_url, estado, canal, created_at, revisado_por, revisado_at,
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

// ── Solicitud por DPI (para ficha del agente) ─────────────────────────────────
solicitudesEmpleoRouter.get("/solicitudes-empleo/by-dpi/:dpi", async (req: Request, res: Response) => {
  const { dpi } = req.params;
  if (!dpi) return res.status(400).json({ error: "DPI requerido" });
  try {
    const { rows } = await pool.query(
      `SELECT * FROM solicitudes_empleo WHERE dpi = $1 ORDER BY created_at DESC LIMIT 1`,
      [dpi]
    );
    if (!rows[0]) return res.status(404).json({ error: "No encontrada" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "GET /solicitudes-empleo/by-dpi/:dpi error");
    res.status(500).json({ error: "Error obteniendo solicitud" });
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

    // Parámetros de asignación enviados por RRHH (o defaults del formulario)
    const puestoAsignado   = req.body?.puesto_asignado   || sol.puesto_solicitado || null;
    const tipoPersonal     = req.body?.tipo_personal     || "guardia";
    const sueldoAsignado   = req.body?.sueldo_base != null
      ? parseFloat(req.body.sueldo_base)
      : (sol.pretension_salarial ? parseFloat(sol.pretension_salarial) : null);

    const sexo = sol.genero === "Masculino" ? "M" : sol.genero === "Femenino" ? "F" : null;
    const notasExtra = [
      sol.puesto_solicitado ? `Plaza solicitada: ${sol.puesto_solicitado}` : null,
      sol.pretension_salarial ? `Pretensión salarial: Q${sol.pretension_salarial}` : null,
      `Creado automáticamente desde solicitud SOL-${String(sol.id).padStart(5, "0")}`,
    ].filter(Boolean).join(" | ");

    // ── Verificar si el DPI ya existe (agente que regresa de baja) ──────────────
    let empId: number;
    if (sol.dpi) {
      const { rows: existentes } = await pool.query(
        `SELECT id, estado_laboral FROM employees WHERE dpi = $1 LIMIT 1`,
        [sol.dpi]
      );
      if (existentes.length > 0) {
        // Reactivar el registro existente en lugar de duplicar
        empId = existentes[0].id;
        await pool.query(`
          UPDATE employees SET
            estado_laboral  = 'activo',
            fecha_ingreso   = CURRENT_DATE,
            tipo_personal   = $2,
            sueldo_base     = COALESCE($3, sueldo_base),
            puesto          = COALESCE($4, puesto),
            foto_url        = COALESCE($5, foto_url),
            telefono        = COALESCE($6, telefono),
            correo          = COALESCE($7, correo),
            notas           = $8,
            updated_at      = NOW()
          WHERE id = $1
        `, [
          empId, tipoPersonal, sueldoAsignado, puestoAsignado,
          sol.foto_url || null,
          sol.telefono || null,
          sol.correo || null,
          notasExtra || null,
        ]);

        await pool.query(`
          UPDATE solicitudes_empleo
          SET employee_id = $1, estado = 'contratada', updated_at = NOW()
          WHERE id = $2
        `, [empId, id]);

        logger.info({ solicitudId: id, employeeId: empId, reactivado: true },
          "kiosco: agente reactivado desde solicitud (DPI ya existía)");
        return res.json({ ok: true, employee_id: empId, reactivado: true });
      }
    }

    const { rows: empRows } = await pool.query(`
      INSERT INTO employees (
        nombre_completo, dpi, telefono, correo,
        fecha_nacimiento, sexo, estado_civil, nivel_educativo,
        municipio, departamento, direccion,
        foto_url, estado_laboral, tipo_personal, fecha_ingreso,
        puesto, sueldo_base, notas, created_at, updated_at,
        -- EMP-EXT-01
        nit, igss_numero, banco, cuenta_bancaria, forma_pago,
        num_dependencias, telefono_secundario,
        -- SOL-EMP-FIELDS-01
        nombre_contacto_emergencia, telefono_emergencia, parentesco_emergencia,
        estatura, peso,
        tiene_licencia, tipo_licencia, vigencia_licencia,
        dpi_frente_url, dpi_reverso_url,
        habilidades, tiene_vehiculo, licencia_armas,
        disp_rotativo, disp_nocturno, disp_fds,
        disponible_exterior, disponibilidad_horario,
        lugar_nacimiento, profesion, tipo_vivienda, tiempo_residencia, renta_mensual,
        nombre_padre, nombre_madre, nombre_conyuge,
        facebook, instagram,
        experiencia_seguridad, anios_experiencia_seg, empresa_anterior_seg,
        tipos_seguridad, servicio_militar, rango_militar, unidad_militar, fue_policia
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'activo',$13,CURRENT_DATE,
        $14,$15,$16,NOW(),NOW(),
        $17,$18,$19,$20,$21,$22,$23,
        $24,$25,$26,$27,$28,$29,$30,$31,$32,$33,
        $34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,
        $47,$48,$49,$50,$51,$52,$53,$54,$55,$56,$57,$58,$59
      )
      RETURNING id
    `, [
      /* $1-$12 básicos */
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
      sol.direccion || null,
      sol.foto_url || null,
      /* $13-$16 laborales */
      tipoPersonal,
      puestoAsignado,
      sueldoAsignado,
      notasExtra || null,
      /* $17-$23 EMP-EXT-01 */
      sol.nit || null,
      sol.igss || null,
      sol.banco || null,
      sol.num_cuenta || null,
      sol.tipo_cuenta || null,
      sol.num_dependientes ? parseInt(sol.num_dependientes) || 0 : 0,
      sol.telefono_fijo || null,
      /* $24-$26 contacto emergencia */
      sol.nombre_contacto_emergencia || null,
      sol.telefono_emergencia || null,
      sol.parentesco_emergencia || null,
      /* $27-$28 físicos */
      sol.estatura || null,
      sol.peso || null,
      /* $29-$31 licencia conducir */
      sol.tiene_licencia || null,
      sol.tipo_licencia || null,
      sol.vigencia_licencia || null,
      /* $32-$33 DPI imágenes */
      sol.dpi_frente_url || null,
      sol.dpi_reverso_url || null,
      /* $34-$42 habilidades y disponibilidad */
      sol.habilidades || null,
      sol.tiene_vehiculo || null,
      sol.licencia_armas || null,
      sol.disp_rotativo || null,
      sol.disp_nocturno || null,
      sol.disp_fds || null,
      sol.disponible_exterior || null,
      sol.disponibilidad_horario || null,
      /* $43-$46 datos personales extendidos */
      sol.lugar_nacimiento || null,
      sol.profesion || null,
      sol.tipo_vivienda || null,
      sol.tiempo_residencia || null,
      /* $47 */
      sol.renta_mensual || null,
      /* $48-$50 familia */
      sol.nombre_padre || null,
      sol.nombre_madre || null,
      sol.nombre_conyuge || null,
      /* $51-$52 redes */
      sol.facebook || null,
      sol.instagram || null,
      /* $53-$59 seguridad previa */
      sol.experiencia_seguridad || null,
      sol.anios_experiencia || null,
      sol.empresa_anterior || null,
      sol.tipos_seguridad || null,
      sol.servicio_militar || null,
      sol.rango_militar || null,
      sol.unidad_militar || null,
      sol.fue_policia || null,
    ]);

    empId = empRows[0].id;

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

// ── Merge requests — listar ───────────────────────────────────────────────────
solicitudesEmpleoRouter.get("/solicitudes-empleo/merge-requests", async (req: Request, res: Response) => {
  const { estado } = req.query as Record<string, string>;
  try {
    const params: unknown[] = [];
    let where = "WHERE 1=1";
    if (estado && estado !== "todos") {
      params.push(estado);
      where += ` AND mr.estado = $${params.length}`;
    }
    const { rows } = await pool.query(`
      SELECT
        mr.id, mr.estado, mr.created_at, mr.revisado_por, mr.revisado_at, mr.notas,
        sol.id          AS solicitud_id,
        sol.nombre_completo AS sol_nombre,
        sol.dpi         AS sol_dpi,
        sol.foto_url    AS sol_foto,
        sol.telefono    AS sol_telefono,
        sol.municipio   AS sol_municipio,
        sol.departamento AS sol_departamento,
        sol.created_at  AS sol_created_at,
        emp.id          AS employee_id,
        emp.nombre_completo AS emp_nombre,
        emp.dpi         AS emp_dpi,
        emp.foto_url    AS emp_foto,
        emp.puesto      AS emp_puesto,
        emp.estado_laboral AS emp_estado,
        emp.fecha_ingreso  AS emp_fecha_ingreso
      FROM solicitudes_merge_requests mr
      JOIN solicitudes_empleo sol ON sol.id = mr.solicitud_id
      JOIN employees          emp ON emp.id = mr.employee_id
      ${where}
      ORDER BY mr.created_at DESC
      LIMIT 200
    `, params);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /solicitudes-empleo/merge-requests error");
    res.status(500).json({ error: "Error obteniendo merge requests" });
  }
});

// ── Merge requests — aprobar (es la misma persona) ───────────────────────────
solicitudesEmpleoRouter.post("/solicitudes-empleo/merge-requests/:id/aprobar", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  const { revisado_por, notas } = req.body ?? {};
  try {
    const { rows: mr } = await pool.query(
      `SELECT solicitud_id, employee_id FROM solicitudes_merge_requests WHERE id = $1`, [id]
    );
    if (!mr[0]) return res.status(404).json({ error: "No encontrado" });
    const { solicitud_id, employee_id } = mr[0];

    // Vincular la solicitud con el empleado existente
    await pool.query(
      `UPDATE solicitudes_empleo SET employee_id = $1, estado = 'aprobada' WHERE id = $2`,
      [employee_id, solicitud_id]
    );
    // Marcar merge como aprobado
    await pool.query(`
      UPDATE solicitudes_merge_requests
      SET estado = 'aprobado', revisado_por = $1, revisado_at = NOW(), notas = $2
      WHERE id = $3
    `, [revisado_por || null, notas || null, id]);

    logger.info({ id, solicitud_id, employee_id }, "Merge aprobado — reingreso vinculado");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /merge-requests/:id/aprobar error");
    res.status(500).json({ error: "Error aprobando merge" });
  }
});

// ── Merge requests — rechazar (DPI incorrecto) ────────────────────────────────
solicitudesEmpleoRouter.post("/solicitudes-empleo/merge-requests/:id/rechazar", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  const { revisado_por, notas, motivo } = req.body ?? {};
  try {
    const estado = motivo === "dpi_erroneo" ? "dpi_erroneo" : "rechazado";
    await pool.query(`
      UPDATE solicitudes_merge_requests
      SET estado = $1, revisado_por = $2, revisado_at = NOW(), notas = $3
      WHERE id = $4
    `, [estado, revisado_por || null, notas || null, id]);

    logger.info({ id, estado }, "Merge rechazado");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /merge-requests/:id/rechazar error");
    res.status(500).json({ error: "Error rechazando merge" });
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
