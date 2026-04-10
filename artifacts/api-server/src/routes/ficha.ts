import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const fichaRouter = Router();

// ─── GET /api/clientes/:id/ficha ──────────────────────────────────────────────
// Devuelve la ficha completa del cliente: datos generales + contractuales,
// sedes, puestos por sede, titulares y cobertura del día.
fichaRouter.get("/clientes/:id/ficha", async (req, res) => {
  const clientId = Number(req.params.id);
  if (!clientId) return res.status(400).json({ error: "id inválido" });

  try {
    // 1) Datos del cliente (incluyendo nuevos campos contractuales)
    const { rows: clientRows } = await pool.query(
      `SELECT id, nombre, nombre_comercial AS "nombreComercial", nit, sector, estado,
              observaciones_contractuales, fecha_inicio_contrato,
              tarifa_base_mensual, estado_contrato, notas, created_at AS "createdAt",
              igss_aplica, igss_codigo_centro, igss_direccion, igss_zona,
              igss_departamento, igss_municipio, igss_codigo_actividad,
              igss_contacto, igss_fax, igss_email, igss_telefono
       FROM clients WHERE id = $1`,
      [clientId]
    );
    if (!clientRows.length) return res.status(404).json({ error: "Cliente no encontrado" });
    const cliente = clientRows[0];

    // 2) Sedes del cliente
    const { rows: sedesRows } = await pool.query(
      `SELECT cs.*,
         (SELECT COUNT(*)::int FROM puestos_operativos po WHERE po.sede_id = cs.id AND po.activo = TRUE) AS total_puestos,
         (SELECT COUNT(*)::int FROM puestos_operativos po WHERE po.sede_id = cs.id AND po.activo = TRUE AND po.estado = 'cubierto') AS puestos_cubiertos,
         (SELECT COUNT(*)::int FROM puestos_operativos po WHERE po.sede_id = cs.id AND po.activo = TRUE AND po.titular_employee_id IS NOT NULL) AS puestos_con_titular
       FROM client_sedes cs
       WHERE cs.client_id = $1
       ORDER BY cs.nombre`,
      [clientId]
    );

    // 3) Puestos del cliente (incluyendo todos los campos nuevos)
    const { rows: puestosRows } = await pool.query(
      `SELECT
         po.id, po.nombre, po.turno, po.jornada, po.horario,
         po.hora_entrada, po.hora_salida, po.descanso_inicio, po.descanso_fin,
         po.cantidad_contratada, po.tarifa_puesto, po.tipo_servicio,
         po.elegible_horas_extra, po.costo_hora,
         po.sede_id, cs.nombre AS sede_nombre,
         po.titular_employee_id, po.titular_nombre,
         po.agente_id, po.agente_nombre,
         po.estado, po.orden, po.notas, po.activo,
         po.zona_operativa_id, oz.nombre AS zona_nombre,
         po.tipo_turno_id, t.nombre AS tipo_turno_nombre,
         po.fecha_inicio_ciclo,
         e.nombre_completo AS titular_nombre_completo,
         e.telefono AS titular_telefono,
         e.estado_laboral AS titular_estado_laboral
       FROM puestos_operativos po
       LEFT JOIN client_sedes cs ON cs.id = po.sede_id
       LEFT JOIN operational_zones oz ON oz.id = po.zona_operativa_id
       LEFT JOIN turnos t ON t.id = po.tipo_turno_id
       LEFT JOIN employees e ON e.id = po.titular_employee_id
       WHERE po.cliente_id = $1 AND po.activo = TRUE
       ORDER BY cs.nombre NULLS LAST, po.orden, po.nombre`,
      [clientId]
    );

    // 4) Cobertura del día (today)
    const { rows: coberturaRows } = await pool.query(
      `SELECT
         po.id AS puesto_id, po.nombre AS puesto_nombre,
         cs.nombre AS sede_nombre,
         po.turno, po.horario, po.hora_entrada, po.hora_salida,
         po.cantidad_contratada,
         po.titular_employee_id, po.titular_nombre,
         po.agente_id, po.agente_nombre,
         po.estado,
         CASE
           WHEN po.agente_id IS NULL THEN 'descubierto'
           WHEN po.agente_id = po.titular_employee_id THEN 'titular'
           ELSE 'relevo'
         END AS tipo_cobertura
       FROM puestos_operativos po
       LEFT JOIN client_sedes cs ON cs.id = po.sede_id
       WHERE po.cliente_id = $1 AND po.activo = TRUE
       ORDER BY cs.nombre NULLS LAST, po.orden, po.nombre`,
      [clientId]
    );

    // 5) Estadísticas de cobertura del día
    const totalPuestos = coberturaRows.length;
    const cubiertos = coberturaRows.filter((p: any) => p.agente_id !== null).length;
    const conTitular = coberturaRows.filter((p: any) => p.tipo_cobertura === "titular").length;
    const conRelevo = coberturaRows.filter((p: any) => p.tipo_cobertura === "relevo").length;
    const descubiertos = coberturaRows.filter((p: any) => p.tipo_cobertura === "descubierto").length;

    res.json({
      cliente,
      sedes: sedesRows,
      puestos: puestosRows,
      coberturaHoy: {
        puestos: coberturaRows,
        resumen: { totalPuestos, cubiertos, conTitular, conRelevo, descubiertos },
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /clientes/:id/ficha error");
    res.status(500).json({ error: "Error al cargar ficha del cliente" });
  }
});

// ─── PATCH /api/clientes/:id/contrato ─────────────────────────────────────────
// Actualiza los campos contractuales del cliente (no toca datos operativos)
fichaRouter.patch("/clientes/:id/contrato", async (req, res) => {
  const clientId = Number(req.params.id);
  const {
    observaciones_contractuales, fecha_inicio_contrato,
    tarifa_base_mensual, estado_contrato, notas,
    nombre, nombreComercial, nit, sector
  } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE clients
       SET observaciones_contractuales = COALESCE($1, observaciones_contractuales),
           fecha_inicio_contrato       = COALESCE($2::date, fecha_inicio_contrato),
           tarifa_base_mensual         = COALESCE($3, tarifa_base_mensual),
           estado_contrato             = COALESCE($4, estado_contrato),
           notas                       = COALESCE($5, notas),
           nombre                      = COALESCE($6, nombre),
           nombre_comercial            = COALESCE($7, nombre_comercial),
           nit                         = COALESCE($8, nit),
           sector                      = COALESCE($9, sector)
       WHERE id = $10
       RETURNING id, nombre, nombre_comercial AS "nombreComercial", nit, sector, estado,
                 observaciones_contractuales, fecha_inicio_contrato, tarifa_base_mensual, estado_contrato, notas`,
      [
        observaciones_contractuales ?? null,
        fecha_inicio_contrato ?? null,
        tarifa_base_mensual ?? null,
        estado_contrato ?? null,
        notas ?? null,
        nombre ?? null,
        nombreComercial ?? null,
        nit ?? null,
        sector ?? null,
        clientId,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: "Cliente no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /clientes/:id/contrato error");
    res.status(500).json({ error: "Error al actualizar cliente" });
  }
});

// ─── POST /api/clientes/:id/puestos ──────────────────────────────────────────
// Crear nuevo puesto desde la ficha del cliente (con campos completos)
fichaRouter.post("/clientes/:id/puestos", async (req, res) => {
  const clientId = Number(req.params.id);
  const {
    nombre, turno, jornada, horario,
    hora_entrada, hora_salida, descanso_inicio, descanso_fin,
    cantidad_contratada, tarifa_puesto, tipo_servicio,
    elegible_horas_extra, costo_hora,
    sede_id, notas, orden,
    zona_operativa_id, titular_employee_id,
    tipo_turno_id, fecha_inicio_ciclo, direccion,
  } = req.body;

  if (!nombre) return res.status(400).json({ error: "nombre es requerido" });
  if (!zona_operativa_id) {
    return res.status(400).json({ error: "El puesto debe tener una zona operativa asignada" });
  }

  try {
    // Obtener nombre del cliente
    const { rows: cRows } = await pool.query(`SELECT nombre, nombre_comercial FROM clients WHERE id = $1`, [clientId]);
    if (!cRows.length) return res.status(404).json({ error: "Cliente no encontrado" });
    const clienteNombre = cRows[0].nombre_comercial || cRows[0].nombre;

    // Obtener nombre del titular si se proporcionó
    let titularNombre: string | null = null;
    if (titular_employee_id) {
      const { rows: empRows } = await pool.query(
        `SELECT nombre_completo FROM employees WHERE id = $1`,
        [titular_employee_id]
      );
      if (empRows.length) titularNombre = empRows[0].nombre_completo;
    }

    const { rows } = await pool.query(
      `INSERT INTO puestos_operativos
         (cliente_id, cliente_nombre, nombre, turno, jornada, horario,
          hora_entrada, hora_salida, descanso_inicio, descanso_fin,
          cantidad_contratada, tarifa_puesto, tipo_servicio, elegible_horas_extra,
          costo_hora, sede_id, notas, orden, zona_operativa_id,
          titular_employee_id, titular_nombre, tipo_turno_id, fecha_inicio_ciclo,
          direccion, estado, activo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,'disponible',TRUE)
       RETURNING *`,
      [
        clientId, clienteNombre, nombre,
        turno || null, jornada || null, horario || null,
        hora_entrada || null, hora_salida || null,
        descanso_inicio || null, descanso_fin || null,
        cantidad_contratada || 1,
        tarifa_puesto || null,
        tipo_servicio || null,
        elegible_horas_extra === true,
        costo_hora || null,
        sede_id || null,
        notas || null,
        orden || 99,
        zona_operativa_id || null,
        titular_employee_id || null,
        titularNombre,
        tipo_turno_id || null,
        fecha_inicio_ciclo || null,
        direccion || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    logger.error({ err }, "POST /clientes/:id/puestos error");
    res.status(500).json({ error: "Error al crear puesto" });
  }
});

// ─── PATCH /api/puestos/:id ───────────────────────────────────────────────────
// Actualizar un puesto (campos contractuales/operativos, no cobertura diaria)
fichaRouter.patch("/puestos/:id", async (req, res) => {
  const {
    nombre, turno, jornada, horario,
    hora_entrada, hora_salida, descanso_inicio, descanso_fin,
    cantidad_contratada, tarifa_puesto, tipo_servicio,
    elegible_horas_extra, costo_hora,
    sede_id, notas, orden, activo,
    zona_operativa_id, titular_employee_id,
    tipo_turno_id, fecha_inicio_ciclo, direccion,
  } = req.body;

  try {
    // Obtener nombre del titular si se proporcionó
    let titularNombre: string | null | undefined = undefined;
    if (titular_employee_id !== undefined) {
      if (titular_employee_id === null) {
        titularNombre = null;
      } else {
        const { rows: empRows } = await pool.query(
          `SELECT nombre_completo FROM employees WHERE id = $1`,
          [titular_employee_id]
        );
        if (empRows.length) titularNombre = empRows[0].nombre_completo;
      }
    }

    const { rows } = await pool.query(
      `UPDATE puestos_operativos
       SET nombre               = COALESCE($1,  nombre),
           turno                = COALESCE($2,  turno),
           jornada              = COALESCE($3,  jornada),
           horario              = COALESCE($4,  horario),
           hora_entrada         = COALESCE($5,  hora_entrada),
           hora_salida          = COALESCE($6,  hora_salida),
           descanso_inicio      = COALESCE($7,  descanso_inicio),
           descanso_fin         = COALESCE($8,  descanso_fin),
           cantidad_contratada  = COALESCE($9,  cantidad_contratada),
           tarifa_puesto        = COALESCE($10, tarifa_puesto),
           tipo_servicio        = COALESCE($11, tipo_servicio),
           elegible_horas_extra = COALESCE($12, elegible_horas_extra),
           costo_hora           = COALESCE($13, costo_hora),
           sede_id              = COALESCE($14, sede_id),
           notas                = COALESCE($15, notas),
           orden                = COALESCE($16, orden),
           activo               = COALESCE($17, activo),
           zona_operativa_id    = COALESCE($18, zona_operativa_id),
           titular_employee_id  = COALESCE($19, titular_employee_id),
           titular_nombre       = COALESCE($20, titular_nombre),
           tipo_turno_id        = COALESCE($21, tipo_turno_id),
           fecha_inicio_ciclo   = COALESCE($22, fecha_inicio_ciclo),
           direccion            = COALESCE($23, direccion),
           updated_at           = NOW()
       WHERE id = $24
       RETURNING *`,
      [
        nombre ?? null, turno ?? null, jornada ?? null, horario ?? null,
        hora_entrada ?? null, hora_salida ?? null,
        descanso_inicio ?? null, descanso_fin ?? null,
        cantidad_contratada ?? null, tarifa_puesto ?? null, tipo_servicio ?? null,
        elegible_horas_extra ?? null, costo_hora ?? null,
        sede_id ?? null, notas ?? null, orden ?? null, activo ?? null,
        zona_operativa_id !== undefined ? zona_operativa_id : null,
        titular_employee_id !== undefined ? titular_employee_id : null,
        titularNombre !== undefined ? titularNombre : null,
        tipo_turno_id !== undefined ? (tipo_turno_id || null) : null,
        fecha_inicio_ciclo !== undefined ? (fecha_inicio_ciclo || null) : null,
        direccion !== undefined ? (direccion || null) : null,
        req.params.id,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: "Puesto no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /puestos/:id error");
    res.status(500).json({ error: "Error al actualizar puesto" });
  }
});

// ─── GET /api/puestos/:id ─────────────────────────────────────────────────────
// Datos frescos de un puesto (para re-poblar el modal de edición)
fichaRouter.get("/puestos/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         po.id, po.nombre, po.turno, po.jornada, po.horario,
         po.hora_entrada, po.hora_salida, po.descanso_inicio, po.descanso_fin,
         po.cantidad_contratada, po.tarifa_puesto, po.tipo_servicio,
         po.elegible_horas_extra, po.costo_hora,
         po.sede_id, cs.nombre AS sede_nombre,
         po.titular_employee_id, po.titular_nombre,
         po.agente_id, po.agente_nombre,
         po.estado, po.orden, po.notas, po.activo,
         po.zona_operativa_id, oz.nombre AS zona_nombre,
         po.tipo_turno_id, t.nombre AS turno_nombre,
         po.fecha_inicio_ciclo,
         e.nombre_completo AS titular_nombre_completo
       FROM puestos_operativos po
       LEFT JOIN client_sedes cs ON cs.id = po.sede_id
       LEFT JOIN operational_zones oz ON oz.id = po.zona_operativa_id
       LEFT JOIN turnos t ON t.id = po.tipo_turno_id
       LEFT JOIN employees e ON e.id = po.titular_employee_id
       WHERE po.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Puesto no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "GET /puestos/:id error");
    res.status(500).json({ error: "Error al cargar puesto" });
  }
});

// ─── DELETE /api/puestos/:id ──────────────────────────────────────────────────
// Desactivar un puesto (soft delete)
fichaRouter.delete("/puestos/:id", async (req, res) => {
  try {
    await pool.query(
      `UPDATE puestos_operativos SET activo = FALSE, updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "DELETE /puestos/:id error");
    res.status(500).json({ error: "Error al desactivar puesto" });
  }
});

// ─── GET /api/clientes ────────────────────────────────────────────────────────
// Lista de clientes con totales para el selector de fichas
fichaRouter.get("/clientes-lista", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.nombre, c.nombre_comercial AS "nombreComercial", c.sector, c.estado,
             c.estado_contrato,
             (SELECT COUNT(*)::int FROM client_sedes cs WHERE cs.client_id = c.id AND cs.activo = TRUE) AS total_sedes,
             (SELECT COUNT(*)::int FROM puestos_operativos po WHERE po.cliente_id = c.id AND po.activo = TRUE) AS total_puestos
      FROM clients c
      ORDER BY c.nombre
    `);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /clientes-lista error");
    res.status(500).json({ error: "Error al cargar clientes" });
  }
});

export default fichaRouter;
