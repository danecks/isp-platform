/**
 * AMON-01 — Módulo de Amonestaciones
 *
 * Quién puede hacer qué:
 *   - RRHH:        crear (incl. ACTAS ADMINISTRATIVAS Art. 77), ver todas, editar, anular,
 *                  resolver solicitudes de modificación y de creación, registrar firmas, descargar PDF
 *   - Operaciones: crear (llamada/económica), ver todas (solo lectura), enviar solicitud de modificación
 *   - Supervisor:  ENVIAR SOLICITUD DE CREACIÓN a RRHH (no levanta directo), ver las suyas,
 *                  enviar solicitud de modificación
 *
 * Tipos:
 *   - llamada_atencion       → registro sin descuento
 *   - economica              → se descuenta en próxima planilla
 *   - acta_administrativa    → documento legal Art. 77 Código de Trabajo (solo RRHH).
 *                              Lleva causal_legal, número correlativo, PDF y firmas.
 *                              Puede tener `aplica_descuento=true` que crea en cadena una
 *                              amonestación económica vinculada (`amon_economica_id`).
 *
 * Flujo principal:
 *   - Crear:    POST /amonestaciones                 (rrhh, operaciones, supervisor)
 *   - Listar:   GET  /amonestaciones                 (filtros: empleado, tipo, estado, desde/hasta, autor)
 *   - Detalle:  GET  /amonestaciones/:id
 *   - Por emp.: GET  /amonestaciones/empleado/:id    (historial completo del agente)
 *   - Editar:   PATCH /amonestaciones/:id            (solo rrhh)
 *   - Anular:   POST /amonestaciones/:id/anular      (solo rrhh)
 *   - Pedir mod.: POST /amonestaciones/:id/solicitar-modificacion (operaciones, supervisor)
 *   - Bandeja: GET  /amonestaciones/solicitudes-modificacion       (rrhh)
 *   - Resolver: POST /amonestaciones/solicitudes-modificacion/:id/resolver (rrhh)
 *   - Catálogo: GET  /amonestaciones/motivos
 *
 * Cada amonestación creada se replica a `eventos_rrhh` para que aparezca en
 * la línea de tiempo del colaborador (sin duplicar fuente de verdad — la
 * tabla maestra sigue siendo `amonestaciones`).
 *
 * Las amonestaciones de tipo `economica` con estado `activa` y descontado=FALSE
 * son consumidas por la query de pre-planilla en "otros descuentos".
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface SessionInfo {
  username?: string;
  rol?: string;
  user_id?: number;
}

function getSession(req: Request): SessionInfo {
  try {
    const raw = req.headers["x-isp-session"] as string | undefined;
    if (!raw) return {};
    return JSON.parse(raw) as SessionInfo;
  } catch {
    return {};
  }
}

function esRRHH(rol?: string) {
  return rol === "rrhh" || rol === "admin";
}

// ────────────────────────────────────────────────────────────────────────────
// GET /amonestaciones/motivos — catálogo de motivos sugeridos
// ────────────────────────────────────────────────────────────────────────────
router.get("/amonestaciones/motivos", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, monto_sugerido::float AS monto_sugerido, activo
         FROM amonestacion_motivos
        WHERE activo = TRUE
        ORDER BY nombre ASC`
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /amonestaciones/motivos");
    res.status(500).json({ error: "Error al obtener motivos" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /amonestaciones/solicitudes-modificacion — bandeja RRHH
// ────────────────────────────────────────────────────────────────────────────
router.get("/amonestaciones/solicitudes-modificacion", async (req: Request, res: Response) => {
  try {
    const session = getSession(req);
    const estado = String(req.query.estado ?? "pendiente");
    const params: unknown[] = [];
    let where = "";
    if (estado !== "todas") {
      params.push(estado);
      where = `WHERE s.estado = $${params.length}`;
    }
    // Operaciones / Supervisor solo ven las suyas
    if (!esRRHH(session.rol)) {
      params.push(session.username ?? "");
      where += (where ? " AND " : "WHERE ") + `s.solicitada_por_username = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT s.*,
              a.empleado_nombre, a.tipo, a.motivo, a.monto::float AS monto,
              a.fecha, a.estado AS amon_estado, a.creado_por_username, a.creado_por_rol
         FROM amonestacion_solicitudes_modificacion s
         JOIN amonestaciones a ON a.id = s.amonestacion_id
         ${where}
        ORDER BY s.created_at DESC
        LIMIT 500`,
      params
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /amonestaciones/solicitudes-modificacion");
    res.status(500).json({ error: "Error al obtener solicitudes" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /amonestaciones/solicitudes-modificacion/:id/resolver — RRHH aprueba/rechaza
// ────────────────────────────────────────────────────────────────────────────
router.post("/amonestaciones/solicitudes-modificacion/:id/resolver", async (req: Request, res: Response) => {
  try {
    const session = getSession(req);
    if (!esRRHH(session.rol)) {
      return res.status(403).json({ error: "Solo RRHH puede resolver solicitudes" });
    }
    const id = parseInt(req.params.id, 10);
    const { accion, respuesta } = req.body ?? {};
    if (!["aprobada", "rechazada"].includes(accion)) {
      return res.status(400).json({ error: "accion debe ser 'aprobada' o 'rechazada'" });
    }
    await pool.query(
      `UPDATE amonestacion_solicitudes_modificacion
          SET estado = $1, respuesta_rrhh = $2, resuelta_por = $3, resuelta_at = NOW()
        WHERE id = $4`,
      [accion, respuesta || null, session.username || "rrhh", id]
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /amonestaciones/solicitudes-modificacion/:id/resolver");
    res.status(500).json({ error: "Error al resolver solicitud" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /amonestaciones/empleado/:id — historial del colaborador
// ────────────────────────────────────────────────────────────────────────────
router.get("/amonestaciones/empleado/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      `SELECT id, employee_id, empleado_nombre, creado_por_username, creado_por_rol,
              tipo, motivo, descripcion, monto::float AS monto, evidencia_url,
              cliente_nombre, puesto_nombre, fecha, estado, descontado, planilla_id,
              anulada_por, anulada_at, anulada_motivo, notas_rrhh, created_at,
              causal_legal, articulo_legal, acta_numero, acta_pdf_url,
              aplica_descuento, amon_economica_id,
              firma_colaborador, firma_levanta, firmada_at
         FROM amonestaciones
        WHERE employee_id = $1
        ORDER BY fecha DESC, id DESC`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /amonestaciones/empleado/:id");
    res.status(500).json({ error: "Error al obtener amonestaciones del empleado" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /amonestaciones — listado con filtros
// ────────────────────────────────────────────────────────────────────────────
router.get("/amonestaciones", async (req: Request, res: Response) => {
  try {
    const session = getSession(req);
    const { empleado_id, tipo, estado, desde, hasta, autor, rol_autor } = req.query;

    const conds: string[] = [];
    const params: unknown[] = [];

    // Supervisor solo ve las suyas
    if (session.rol === "supervisor") {
      params.push(session.username ?? "");
      conds.push(`creado_por_username = $${params.length}`);
    }

    if (empleado_id) { params.push(Number(empleado_id)); conds.push(`employee_id = $${params.length}`); }
    if (tipo)        { params.push(String(tipo));        conds.push(`tipo = $${params.length}`); }
    if (estado)      { params.push(String(estado));      conds.push(`estado = $${params.length}`); }
    if (desde)       { params.push(String(desde));       conds.push(`fecha >= $${params.length}`); }
    if (hasta)       { params.push(String(hasta));       conds.push(`fecha <= $${params.length}`); }
    if (autor)       { params.push(String(autor));       conds.push(`creado_por_username = $${params.length}`); }
    if (rol_autor)   { params.push(String(rol_autor));   conds.push(`creado_por_rol = $${params.length}`); }

    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT id, employee_id, empleado_nombre, creado_por_username, creado_por_rol,
              tipo, motivo, descripcion, monto::float AS monto, evidencia_url,
              cliente_nombre, puesto_nombre, fecha, estado, descontado, planilla_id,
              anulada_por, anulada_at, created_at,
              causal_legal, articulo_legal, acta_numero, acta_pdf_url,
              aplica_descuento, amon_economica_id,
              firma_colaborador, firma_levanta, firmada_at
         FROM amonestaciones
         ${where}
        ORDER BY fecha DESC, id DESC
        LIMIT 1000`,
      params
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /amonestaciones");
    res.status(500).json({ error: "Error al listar amonestaciones" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /amonestaciones/:id
// ────────────────────────────────────────────────────────────────────────────
router.get("/amonestaciones/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!/^\d+$/.test(req.params.id)) return next();
    const id = parseInt(req.params.id, 10);
    const { rows } = await pool.query(
      `SELECT a.*, a.monto::float AS monto
         FROM amonestaciones a
        WHERE a.id = $1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "No encontrada" });
    const { rows: solis } = await pool.query(
      `SELECT id, solicitada_por_username, solicitada_por_rol, cambio_solicitado,
              motivo_solicitud, estado, respuesta_rrhh, resuelta_por, resuelta_at, created_at
         FROM amonestacion_solicitudes_modificacion
        WHERE amonestacion_id = $1
        ORDER BY created_at DESC`,
      [id]
    );
    res.json({ ...rows[0], solicitudes_modificacion: solis });
  } catch (err) {
    logger.error({ err }, "GET /amonestaciones/:id");
    res.status(500).json({ error: "Error al obtener amonestación" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /amonestaciones — crear (rrhh, operaciones, supervisor)
// ────────────────────────────────────────────────────────────────────────────
router.post("/amonestaciones", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const session = getSession(req);
    const rol = session.rol || "rrhh";
    if (!["rrhh", "admin", "operaciones", "supervisor"].includes(rol)) {
      return res.status(403).json({ error: "Rol no autorizado" });
    }

    const {
      employee_id, tipo, motivo, descripcion, monto, evidencia_url,
      cliente_id, cliente_nombre, puesto_id, puesto_nombre, fecha,
      causal_legal_codigo, causal_legal_codigos, aplica_descuento,
    } = req.body ?? {};

    // Normalizar a array (compat con singular antiguo)
    const causalCodigos: string[] = Array.isArray(causal_legal_codigos)
      ? causal_legal_codigos.map((c: unknown) => String(c)).filter(Boolean)
      : (causal_legal_codigo ? [String(causal_legal_codigo)] : []);

    if (!employee_id) return res.status(400).json({ error: "employee_id requerido" });
    if (!["llamada_atencion", "economica", "acta_administrativa"].includes(tipo)) {
      return res.status(400).json({ error: "tipo inválido" });
    }
    if (tipo === "acta_administrativa" && !esRRHH(rol)) {
      return res.status(403).json({ error: "Solo RRHH puede levantar actas administrativas" });
    }
    if (!motivo || String(motivo).trim() === "") {
      return res.status(400).json({ error: "motivo requerido" });
    }
    if (tipo === "acta_administrativa" && causalCodigos.length === 0) {
      return res.status(400).json({ error: "Debe seleccionar al menos una causal legal para el acta administrativa" });
    }
    const montoNum = (tipo === "economica" || (tipo === "acta_administrativa" && aplica_descuento))
      ? Math.max(0, Number(monto) || 0)
      : 0;

    await client.query("BEGIN");

    // Nombre del empleado para snapshot
    const { rows: empRows } = await client.query(
      `SELECT nombre_completo FROM employees WHERE id = $1`,
      [employee_id]
    );
    if (empRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Empleado no encontrado" });
    }
    const empleadoNombre = empRows[0].nombre_completo;

    // Si es acta administrativa: resolver causal y asignar correlativo
    let causalLegalTexto: string | null = null;
    let articuloLegal: string | null = null;
    let actaNumero: number | null = null;
    if (tipo === "acta_administrativa") {
      const { rows: causalRows } = await client.query(
        `SELECT codigo, inciso, articulo, titulo, descripcion
           FROM amonestacion_causales_legales
          WHERE codigo = ANY($1::text[]) AND activo = TRUE
          ORDER BY orden`,
        [causalCodigos]
      );
      if (causalRows.length !== causalCodigos.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Una o más causales legales son inválidas" });
      }
      causalLegalTexto = causalRows.map(r => `${r.inciso} ${r.titulo}`).join("; ");
      articuloLegal = causalRows[0].articulo;
      // Asignar correlativo desde config_empresa.acta_correlativo
      const { rows: corrRows } = await client.query(
        `UPDATE config_empresa SET acta_correlativo = COALESCE(acta_correlativo,0) + 1, updated_at = NOW()
          WHERE id = 1 RETURNING acta_correlativo`
      );
      if (corrRows.length === 0 || corrRows[0]?.acta_correlativo == null) {
        await client.query("ROLLBACK");
        return res.status(500).json({ error: "config_empresa no inicializada (id=1). Configure datos de la empresa antes de levantar actas." });
      }
      actaNumero = corrRows[0].acta_correlativo;
    }

    // Si es acta + aplica_descuento, crear primero la económica vinculada
    let amonEconomicaId: number | null = null;
    if (tipo === "acta_administrativa" && aplica_descuento && montoNum > 0) {
      const { rows: ecoIns } = await client.query(
        `INSERT INTO amonestaciones (
           employee_id, empleado_nombre,
           creado_por_user_id, creado_por_username, creado_por_rol,
           tipo, motivo, descripcion, monto, evidencia_url,
           cliente_id, cliente_nombre, puesto_id, puesto_nombre, fecha
         ) VALUES (
           $1, $2, $3, $4, $5,
           'economica', $6, $7, $8, $9,
           $10, $11, $12, $13, COALESCE($14::date, CURRENT_DATE)
         ) RETURNING id`,
        [
          employee_id, empleadoNombre,
          session.user_id ?? null, session.username ?? null, rol,
          `Descuento por Acta #${actaNumero ?? "?"} — ${String(motivo).trim()}`,
          descripcion || null, montoNum, evidencia_url || null,
          cliente_id || null, cliente_nombre || null, puesto_id || null, puesto_nombre || null,
          fecha || null,
        ]
      );
      amonEconomicaId = ecoIns[0].id;
    }

    const { rows: ins } = await client.query(
      `INSERT INTO amonestaciones (
         employee_id, empleado_nombre,
         creado_por_user_id, creado_por_username, creado_por_rol,
         tipo, motivo, descripcion, monto, evidencia_url,
         cliente_id, cliente_nombre, puesto_id, puesto_nombre, fecha,
         causal_legal, articulo_legal, acta_numero, aplica_descuento, amon_economica_id
       ) VALUES (
         $1, $2,
         $3, $4, $5,
         $6, $7, $8, $9, $10,
         $11, $12, $13, $14, COALESCE($15::date, CURRENT_DATE),
         $16, $17, $18, $19, $20
       ) RETURNING id`,
      [
        employee_id, empleadoNombre,
        session.user_id ?? null, session.username ?? null, rol,
        tipo, String(motivo).trim(), descripcion || null,
        tipo === "acta_administrativa" ? 0 : montoNum,
        evidencia_url || null,
        cliente_id || null, cliente_nombre || null, puesto_id || null, puesto_nombre || null,
        fecha || null,
        causalLegalTexto, articuloLegal, actaNumero,
        tipo === "acta_administrativa" ? !!aplica_descuento : false,
        amonEconomicaId,
      ]
    );
    const amonId = ins[0].id;

    // Replicar a eventos_rrhh para línea de tiempo del colaborador
    let eventoId: number | null = null;
    try {
      const obs = tipo === "acta_administrativa"
        ? `Acta Administrativa #${actaNumero ?? "?"} — ${causalLegalTexto || motivo}${descripcion ? `: ${descripcion}` : ""}`
        : `${tipo === "economica" ? `Amonestación económica Q${montoNum.toFixed(2)}` : "Llamada de atención"} — ${motivo}${descripcion ? `: ${descripcion}` : ""}`;
      const tipoEvento = tipo === "acta_administrativa" ? "acta_administrativa" : "amonestacion";
      const { rows: evIns } = await client.query(
        `INSERT INTO eventos_rrhh (
           employee_id, employee_nombre, tipo_evento, fecha,
           observaciones, cliente_nombre, puesto_nombre,
           estado, generado_desde, usuario_generador
         ) VALUES (
           $1, $2, $9, COALESCE($3::date, CURRENT_DATE),
           $4, $5, $6,
           'aprobado', $7, $8
         ) RETURNING id`,
        [
          employee_id, empleadoNombre, fecha || null,
          obs, cliente_nombre || null, puesto_nombre || null,
          rol, session.username || null, tipoEvento,
        ]
      );
      eventoId = evIns[0].id;
      await client.query(`UPDATE amonestaciones SET evento_rrhh_id = $1 WHERE id = $2`, [eventoId, amonId]);
    } catch (evErr) {
      // No bloqueante: si eventos_rrhh tiene constraints distintos, seguimos sin perder la amonestación
      logger.warn({ evErr }, "AMON: no se pudo replicar a eventos_rrhh (no bloqueante)");
    }

    await client.query("COMMIT");
    res.status(201).json({
      id: amonId, evento_rrhh_id: eventoId,
      acta_numero: actaNumero, amon_economica_id: amonEconomicaId,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    logger.error({ err }, "POST /amonestaciones");
    res.status(500).json({ error: "Error al crear amonestación" });
  } finally {
    client.release();
  }
});

// ────────────────────────────────────────────────────────────────────────────
// PATCH /amonestaciones/:id — editar (solo RRHH)
// ────────────────────────────────────────────────────────────────────────────
router.patch("/amonestaciones/:id", async (req: Request, res: Response) => {
  try {
    const session = getSession(req);
    if (!esRRHH(session.rol)) {
      return res.status(403).json({ error: "Solo RRHH puede modificar amonestaciones" });
    }
    const id = parseInt(req.params.id, 10);
    const { tipo, motivo, descripcion, monto, fecha, evidencia_url, notas_rrhh } = req.body ?? {};

    const updates: string[] = [];
    const params: unknown[] = [id];
    if (tipo !== undefined) {
      if (!["llamada_atencion", "economica"].includes(tipo)) {
        return res.status(400).json({ error: "Solo se puede cambiar el tipo entre 'llamada_atencion' y 'economica'. Las actas administrativas no pueden cambiar de tipo por edición." });
      }
      // Bloquear si la actual es acta_administrativa
      const { rows: cur } = await pool.query(`SELECT tipo FROM amonestaciones WHERE id = $1`, [id]);
      if (cur[0]?.tipo === "acta_administrativa") {
        return res.status(400).json({ error: "No se puede cambiar el tipo de un acta administrativa" });
      }
      params.push(tipo); updates.push(`tipo = $${params.length}`);
    }
    if (motivo !== undefined) { params.push(String(motivo)); updates.push(`motivo = $${params.length}`); }
    if (descripcion !== undefined) { params.push(descripcion || null); updates.push(`descripcion = $${params.length}`); }
    if (monto !== undefined) { params.push(Math.max(0, Number(monto) || 0)); updates.push(`monto = $${params.length}`); }
    if (fecha !== undefined) { params.push(fecha || null); updates.push(`fecha = $${params.length}::date`); }
    if (evidencia_url !== undefined) { params.push(evidencia_url || null); updates.push(`evidencia_url = $${params.length}`); }
    if (notas_rrhh !== undefined) { params.push(notas_rrhh || null); updates.push(`notas_rrhh = $${params.length}`); }
    if (updates.length === 0) return res.json({ ok: true });
    updates.push(`updated_at = NOW()`);

    await pool.query(
      `UPDATE amonestaciones SET ${updates.join(", ")} WHERE id = $1`,
      params
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "PATCH /amonestaciones/:id");
    res.status(500).json({ error: "Error al modificar amonestación" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /amonestaciones/:id/anular — anular (solo RRHH)
// ────────────────────────────────────────────────────────────────────────────
router.post("/amonestaciones/:id/anular", async (req: Request, res: Response) => {
  try {
    const session = getSession(req);
    if (!esRRHH(session.rol)) {
      return res.status(403).json({ error: "Solo RRHH puede anular amonestaciones" });
    }
    const id = parseInt(req.params.id, 10);
    const motivoAnul = req.body?.motivo || null;

    const { rows } = await pool.query(
      `SELECT descontado, planilla_id, tipo, amon_economica_id FROM amonestaciones WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "No encontrada" });

    const client = await pool.connect();
    let economicaAnulada = false;
    let economicaYaDescontada = false;
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE amonestaciones
            SET estado = 'anulada',
                anulada_por = $1,
                anulada_at = NOW(),
                anulada_motivo = $2,
                updated_at = NOW()
          WHERE id = $3`,
        [session.username || "rrhh", motivoAnul, id]
      );
      // Cascada lógica: si es acta con económica vinculada, anular también la económica
      if (rows[0].tipo === "acta_administrativa" && rows[0].amon_economica_id) {
        const { rows: ecoRows } = await client.query(
          `SELECT estado, descontado FROM amonestaciones WHERE id = $1`,
          [rows[0].amon_economica_id]
        );
        if (ecoRows.length > 0 && ecoRows[0].estado === "activa") {
          await client.query(
            `UPDATE amonestaciones
                SET estado = 'anulada',
                    anulada_por = $1,
                    anulada_at = NOW(),
                    anulada_motivo = $2,
                    updated_at = NOW()
              WHERE id = $3`,
            [session.username || "rrhh", `Cascada por anulación de acta #${id}: ${motivoAnul ?? ""}`, rows[0].amon_economica_id]
          );
          economicaAnulada = true;
          economicaYaDescontada = ecoRows[0].descontado === true;
        }
      }
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK").catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    const yaDescontada = rows[0].descontado === true;
    res.json({
      ok: true,
      ya_descontada: yaDescontada,
      planilla_id: rows[0].planilla_id,
      economica_vinculada_anulada: economicaAnulada,
      economica_vinculada_ya_descontada: economicaYaDescontada,
      mensaje: yaDescontada || economicaYaDescontada
        ? "Anulada, pero algún descuento ya fue aplicado en planilla cerrada. Genera un ajuste manual si aplica."
        : economicaAnulada
          ? "Acta anulada y descuento económico vinculado también anulado. Excluidos de la próxima pre-planilla."
          : "Amonestación anulada. Será excluida de la próxima pre-planilla.",
    });
  } catch (err) {
    logger.error({ err }, "POST /amonestaciones/:id/anular");
    res.status(500).json({ error: "Error al anular amonestación" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /amonestaciones/:id/solicitar-modificacion — operaciones / supervisor
// ────────────────────────────────────────────────────────────────────────────
router.post("/amonestaciones/:id/solicitar-modificacion", async (req: Request, res: Response) => {
  try {
    const session = getSession(req);
    const id = parseInt(req.params.id, 10);
    const { cambio_solicitado, motivo_solicitud } = req.body ?? {};
    if (!cambio_solicitado || !motivo_solicitud) {
      return res.status(400).json({ error: "cambio_solicitado y motivo_solicitud requeridos" });
    }
    const { rows } = await pool.query(
      `INSERT INTO amonestacion_solicitudes_modificacion (
         amonestacion_id, solicitada_por_user_id, solicitada_por_username,
         solicitada_por_rol, cambio_solicitado, motivo_solicitud
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        id, session.user_id ?? null, session.username ?? null,
        session.rol ?? null, String(cambio_solicitado), String(motivo_solicitud),
      ]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    logger.error({ err }, "POST /amonestaciones/:id/solicitar-modificacion");
    res.status(500).json({ error: "Error al enviar solicitud" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /amonestaciones/causales-legales — catálogo Art. 77 Código de Trabajo
// ────────────────────────────────────────────────────────────────────────────
router.get("/amonestaciones/causales-legales", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, codigo, inciso, articulo, titulo, descripcion, orden
         FROM amonestacion_causales_legales
        WHERE activo = TRUE
        ORDER BY orden ASC, codigo ASC`
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /amonestaciones/causales-legales");
    res.status(500).json({ error: "Error al obtener causales legales" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /amonestaciones/:id/datos-pdf — datos para generar el PDF del acta
// ────────────────────────────────────────────────────────────────────────────
router.get("/amonestaciones/:id/datos-pdf", async (req: Request, res: Response) => {
  try {
    const session = getSession(req);
    const rol = String(session.rol || "").toLowerCase();
    if (!["rrhh", "admin", "operaciones", "supervisor"].includes(rol)) {
      return res.status(403).json({ error: "Rol no autorizado" });
    }
    const id = parseInt(req.params.id, 10);
    const { rows: amonRows } = await pool.query(
      `SELECT a.*, a.monto::float AS monto FROM amonestaciones a WHERE a.id = $1`,
      [id]
    );
    if (amonRows.length === 0) return res.status(404).json({ error: "No encontrada" });
    const amon = amonRows[0];

    // Para acta con descuento vinculado, traer el monto real del registro económico
    if (amon.tipo === "acta_administrativa" && amon.amon_economica_id) {
      const { rows: ecoRows } = await pool.query(
        `SELECT monto::float AS monto, estado FROM amonestaciones WHERE id = $1`,
        [amon.amon_economica_id]
      );
      if (ecoRows.length > 0) {
        amon.monto_descuento_vinculado = ecoRows[0].monto;
        amon.descuento_estado = ecoRows[0].estado;
      }
    }

    // Restringir alcance al supervisor: solo sus propias actas
    if (rol === "supervisor" && amon.creado_por_username !== session.username) {
      return res.status(403).json({ error: "No autorizado para ver esta acta" });
    }

    const { rows: configRows } = await pool.query(`
      SELECT ce.*,
             COALESCE(ce.representante_nombre, e.nombre_completo) AS representante_nombre,
             COALESCE(ce.representante_dpi, e.dpi)                AS representante_dpi
        FROM config_empresa ce
        LEFT JOIN employees e ON e.id = ce.representante_legal_id
       WHERE ce.id = 1
    `);
    const { rows: empRows } = await pool.query(
      `SELECT id, nombre_completo, dpi, fecha_ingreso, puesto AS cargo, tipo_personal
         FROM employees WHERE id = $1`,
      [amon.employee_id]
    );
    const { rows: puestoRows } = await pool.query(
      `SELECT po.nombre AS puesto_nombre, c.nombre AS cliente_nombre
         FROM puestos_operativos po
         LEFT JOIN clients c ON c.id = po.cliente_id
        WHERE po.titular_employee_id = $1 AND po.activo = TRUE
        LIMIT 1`,
      [amon.employee_id]
    );
    res.json({
      amonestacion: amon,
      config: configRows[0] || null,
      empleado: empRows[0] || null,
      puesto: puestoRows[0] || null,
    });
  } catch (err) {
    logger.error({ err }, "GET /amonestaciones/:id/datos-pdf");
    res.status(500).json({ error: "Error al obtener datos del PDF" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /amonestaciones/:id/firmar — registrar firmas (colaborador / quien levanta)
// ────────────────────────────────────────────────────────────────────────────
router.post("/amonestaciones/:id/firmar", async (req: Request, res: Response) => {
  try {
    const session = getSession(req);
    if (!esRRHH(session.rol)) {
      return res.status(403).json({ error: "Solo RRHH puede registrar las firmas" });
    }
    const id = parseInt(req.params.id, 10);
    const { firma_colaborador, firma_levanta, acta_pdf_url } = req.body ?? {};
    if (!firma_colaborador || String(firma_colaborador).trim() === "") {
      return res.status(400).json({ error: "firma_colaborador requerida" });
    }
    if (!firma_levanta || String(firma_levanta).trim() === "") {
      return res.status(400).json({ error: "firma_levanta requerida" });
    }
    await pool.query(
      `UPDATE amonestaciones
          SET firma_colaborador = $1,
              firma_levanta     = $2,
              firmada_at        = NOW(),
              acta_pdf_url      = COALESCE($3, acta_pdf_url),
              updated_at        = NOW()
        WHERE id = $4`,
      [String(firma_colaborador).trim(), String(firma_levanta).trim(), acta_pdf_url || null, id]
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "POST /amonestaciones/:id/firmar");
    res.status(500).json({ error: "Error al registrar firmas" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /amonestaciones/solicitudes-creacion — supervisor pide a RRHH levantar
// ────────────────────────────────────────────────────────────────────────────
router.post("/amonestaciones/solicitudes-creacion", async (req: Request, res: Response) => {
  try {
    const session = getSession(req);
    if (!session.rol || !["supervisor", "operaciones", "rrhh", "admin"].includes(session.rol)) {
      return res.status(403).json({ error: "Rol no autorizado" });
    }
    const {
      employee_id, tipo_solicitado, motivo, descripcion,
      causal_legal_codigo, causal_legal_codigos,
      monto_sugerido, evidencia_url,
      cliente_id, cliente_nombre, puesto_id, puesto_nombre, fecha_incidente,
    } = req.body ?? {};
    const causalCodigos: string[] = Array.isArray(causal_legal_codigos)
      ? causal_legal_codigos.map((c: unknown) => String(c)).filter(Boolean)
      : (causal_legal_codigo ? [String(causal_legal_codigo)] : []);
    if (!employee_id) return res.status(400).json({ error: "employee_id requerido" });
    if (!["llamada_atencion", "economica", "acta_administrativa"].includes(tipo_solicitado)) {
      return res.status(400).json({ error: "tipo_solicitado inválido" });
    }
    if (!motivo || String(motivo).trim() === "") {
      return res.status(400).json({ error: "motivo requerido" });
    }
    if (tipo_solicitado === "acta_administrativa" && causalCodigos.length === 0) {
      return res.status(400).json({ error: "Debe seleccionar al menos una causal legal" });
    }
    // Persistir como CSV en columna TEXT existente
    const causalCsv = causalCodigos.length > 0 ? causalCodigos.join(",") : null;
    const { rows: empRows } = await pool.query(
      `SELECT nombre_completo FROM employees WHERE id = $1`, [employee_id]
    );
    if (empRows.length === 0) return res.status(404).json({ error: "Empleado no encontrado" });

    const { rows } = await pool.query(
      `INSERT INTO amonestacion_solicitudes_creacion (
         employee_id, empleado_nombre, tipo_solicitado, motivo, descripcion,
         causal_legal_codigo, monto_sugerido, evidencia_url,
         cliente_id, cliente_nombre, puesto_id, puesto_nombre, fecha_incidente,
         solicitada_por_user_id, solicitada_por_username, solicitada_por_rol
       ) VALUES (
         $1,$2,$3,$4,$5,
         $6,$7,$8,
         $9,$10,$11,$12,$13,
         $14,$15,$16
       ) RETURNING id`,
      [
        employee_id, empRows[0].nombre_completo, tipo_solicitado, String(motivo).trim(), descripcion || null,
        causalCsv, Math.max(0, Number(monto_sugerido) || 0), evidencia_url || null,
        cliente_id || null, cliente_nombre || null, puesto_id || null, puesto_nombre || null,
        fecha_incidente || null,
        session.user_id ?? null, session.username ?? null, session.rol ?? null,
      ]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    logger.error({ err }, "POST /amonestaciones/solicitudes-creacion");
    res.status(500).json({ error: "Error al enviar solicitud de creación" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /amonestaciones/solicitudes-creacion — bandeja RRHH (o las del solicitante)
// ────────────────────────────────────────────────────────────────────────────
router.get("/amonestaciones/solicitudes-creacion", async (req: Request, res: Response) => {
  try {
    const session = getSession(req);
    const estado = String(req.query.estado ?? "pendiente");
    const params: unknown[] = [];
    let where = "";
    if (estado !== "todas") { params.push(estado); where = `WHERE estado = $${params.length}`; }
    if (!esRRHH(session.rol)) {
      params.push(session.username ?? "");
      where += (where ? " AND " : "WHERE ") + `solicitada_por_username = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT id, employee_id, empleado_nombre, tipo_solicitado, motivo, descripcion,
              causal_legal_codigo, monto_sugerido::float AS monto_sugerido, evidencia_url,
              cliente_nombre, puesto_nombre, fecha_incidente,
              solicitada_por_username, solicitada_por_rol,
              estado, respuesta_rrhh, amonestacion_creada_id, resuelta_por, resuelta_at, created_at
         FROM amonestacion_solicitudes_creacion
         ${where}
        ORDER BY created_at DESC
        LIMIT 500`,
      params
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /amonestaciones/solicitudes-creacion");
    res.status(500).json({ error: "Error al obtener solicitudes de creación" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /amonestaciones/solicitudes-creacion/:id/resolver — RRHH aprueba/rechaza
// ────────────────────────────────────────────────────────────────────────────
router.post("/amonestaciones/solicitudes-creacion/:id/resolver", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const session = getSession(req);
    if (!esRRHH(session.rol)) {
      return res.status(403).json({ error: "Solo RRHH puede resolver solicitudes" });
    }
    const id = parseInt(req.params.id, 10);
    const { accion, respuesta, monto, aplica_descuento } = req.body ?? {};
    if (!["aprobada", "rechazada"].includes(accion)) {
      return res.status(400).json({ error: "accion debe ser 'aprobada' o 'rechazada'" });
    }
    await client.query("BEGIN");

    const { rows: solRows } = await client.query(
      `SELECT * FROM amonestacion_solicitudes_creacion WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (solRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }
    if (solRows[0].estado !== "pendiente") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Solicitud ya resuelta" });
    }
    const sol = solRows[0];

    let amonCreadaId: number | null = null;
    if (accion === "aprobada") {
      // Crear la amonestación efectivamente — RRHH actúa como autor
      let causalLegalTexto: string | null = null;
      let articuloLegal: string | null = null;
      let actaNumero: number | null = null;
      if (sol.tipo_solicitado === "acta_administrativa") {
        const codigos: string[] = String(sol.causal_legal_codigo || "").split(",").map(s => s.trim()).filter(Boolean);
        if (codigos.length === 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "La solicitud no tiene causales legales" });
        }
        const { rows: causalRows } = await client.query(
          `SELECT inciso, articulo, titulo FROM amonestacion_causales_legales
            WHERE codigo = ANY($1::text[]) AND activo = TRUE
            ORDER BY orden`,
          [codigos]
        );
        if (causalRows.length !== codigos.length) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "Una o más causales de la solicitud ya no son válidas" });
        }
        causalLegalTexto = causalRows.map(r => `${r.inciso} ${r.titulo}`).join("; ");
        articuloLegal = causalRows[0].articulo;
        const { rows: corrRows } = await client.query(
          `UPDATE config_empresa SET acta_correlativo = COALESCE(acta_correlativo,0) + 1, updated_at = NOW()
            WHERE id = 1 RETURNING acta_correlativo`
        );
        if (corrRows.length === 0 || corrRows[0]?.acta_correlativo == null) {
          await client.query("ROLLBACK");
          return res.status(500).json({ error: "config_empresa no inicializada (id=1). Configure datos de la empresa antes de aprobar actas." });
        }
        actaNumero = corrRows[0].acta_correlativo;
      }
      const aplicaDesc = !!aplica_descuento;
      const montoFinal = Math.max(0, Number(monto ?? sol.monto_sugerido) || 0);

      let amonEcoId: number | null = null;
      if (sol.tipo_solicitado === "acta_administrativa" && aplicaDesc && montoFinal > 0) {
        const { rows: ecoIns } = await client.query(
          `INSERT INTO amonestaciones (
             employee_id, empleado_nombre,
             creado_por_user_id, creado_por_username, creado_por_rol,
             tipo, motivo, descripcion, monto, evidencia_url,
             cliente_id, cliente_nombre, puesto_id, puesto_nombre, fecha
           ) VALUES (
             $1,$2,$3,$4,'rrhh',
             'economica',$5,$6,$7,$8,
             $9,$10,$11,$12,COALESCE($13::date, CURRENT_DATE)
           ) RETURNING id`,
          [
            sol.employee_id, sol.empleado_nombre,
            session.user_id ?? null, session.username ?? null,
            `Descuento por Acta #${actaNumero ?? "?"} — ${sol.motivo}`,
            sol.descripcion || null, montoFinal, sol.evidencia_url || null,
            sol.cliente_id || null, sol.cliente_nombre || null,
            sol.puesto_id || null, sol.puesto_nombre || null,
            sol.fecha_incidente || null,
          ]
        );
        amonEcoId = ecoIns[0].id;
      }

      const tipoCreado = sol.tipo_solicitado;
      const montoAmon = tipoCreado === "economica" ? montoFinal : 0;
      const { rows: amonIns } = await client.query(
        `INSERT INTO amonestaciones (
           employee_id, empleado_nombre,
           creado_por_user_id, creado_por_username, creado_por_rol,
           tipo, motivo, descripcion, monto, evidencia_url,
           cliente_id, cliente_nombre, puesto_id, puesto_nombre, fecha,
           causal_legal, articulo_legal, acta_numero, aplica_descuento, amon_economica_id,
           notas_rrhh
         ) VALUES (
           $1,$2,$3,$4,'rrhh',
           $5,$6,$7,$8,$9,
           $10,$11,$12,$13,COALESCE($14::date, CURRENT_DATE),
           $15,$16,$17,$18,$19,
           $20
         ) RETURNING id`,
        [
          sol.employee_id, sol.empleado_nombre,
          session.user_id ?? null, session.username ?? null,
          tipoCreado, sol.motivo, sol.descripcion || null, montoAmon, sol.evidencia_url || null,
          sol.cliente_id || null, sol.cliente_nombre || null,
          sol.puesto_id || null, sol.puesto_nombre || null,
          sol.fecha_incidente || null,
          causalLegalTexto, articuloLegal, actaNumero,
          tipoCreado === "acta_administrativa" ? aplicaDesc : false,
          amonEcoId,
          `Aprobada desde solicitud #${id} de ${sol.solicitada_por_username} (${sol.solicitada_por_rol})`,
        ]
      );
      amonCreadaId = amonIns[0].id;
    }

    await client.query(
      `UPDATE amonestacion_solicitudes_creacion
          SET estado = $1, respuesta_rrhh = $2, resuelta_por = $3, resuelta_at = NOW(),
              amonestacion_creada_id = $4
        WHERE id = $5`,
      [accion, respuesta || null, session.username || "rrhh", amonCreadaId, id]
    );
    await client.query("COMMIT");
    res.json({ ok: true, amonestacion_id: amonCreadaId });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    logger.error({ err }, "POST /amonestaciones/solicitudes-creacion/:id/resolver");
    res.status(500).json({ error: "Error al resolver solicitud" });
  } finally {
    client.release();
  }
});

export const amonestacionesRouter = router;
export default router;
