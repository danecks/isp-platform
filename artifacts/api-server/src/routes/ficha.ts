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
         (SELECT COUNT(*)::int FROM puestos_operativos po WHERE po.sede_id = cs.id AND po.activo = TRUE AND EXISTS (SELECT 1 FROM puesto_slots ps WHERE ps.puesto_id = po.id AND ps.activo = TRUE AND ps.empleado_id IS NOT NULL)) AS puestos_con_titular
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
         e.estado_laboral AS titular_estado_laboral,
         (SELECT COUNT(*)::int FROM puesto_slots ps WHERE ps.puesto_id = po.id AND ps.activo = TRUE AND ps.empleado_id IS NOT NULL) AS slots_con_titular
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

// ─── GET /api/clientes/:id/rentabilidad ───────────────────────────────────────
fichaRouter.get("/clientes/:id/rentabilidad", async (req, res) => {
  const clientId = Number(req.params.id);
  if (!clientId) return res.status(400).json({ error: "id inválido" });

  try {
    const { rows: puestoRows } = await pool.query(`
      SELECT
        po.id,
        po.nombre,
        po.tarifa_puesto,
        po.tipo_servicio,
        cs.nombre AS sede_nombre,
        t.nombre AS turno_nombre,
        (
          SELECT json_agg(json_build_object(
            'employee_id', e.id,
            'nombre', e.nombre_completo,
            'sueldo_base', e.sueldo_base,
            'horas_contrato', e.horas_contrato,
            'aplica_igss', COALESCE(e.aplica_igss_general, TRUE),
            'bonificacion_incentivo', COALESCE(e.bonificacion_incentivo, 250),
            'fecha_ingreso', e.fecha_ingreso
          ))
          FROM puesto_slots ps
          JOIN employees e ON e.id = ps.empleado_id
          WHERE ps.puesto_id = po.id AND ps.activo = TRUE AND e.estado_laboral = 'activo'
        ) AS titulares,
        (
          SELECT COALESCE(SUM(nnd.horas_extra), 0)
          FROM novedades_nomina_diarias nnd
          WHERE nnd.puesto_titular_id = po.id
            AND nnd.horas_extra > 0
            AND nnd.fecha >= (CURRENT_DATE - INTERVAL '30 days')
        ) AS he_30d,
        (
          SELECT COALESCE(COUNT(*), 0)
          FROM cobertura_segmentos cseg
          WHERE cseg.puesto_id = po.id
            AND cseg.tipo_cobertura IN ('relevo', 'cobertura')
            AND cseg.fecha >= (CURRENT_DATE - INTERVAL '30 days')
        ) AS relevos_30d
      FROM puestos_operativos po
      LEFT JOIN client_sedes cs ON cs.id = po.sede_id
      LEFT JOIN turnos t ON t.id = po.tipo_turno_id
      WHERE po.cliente_id = $1 AND po.activo = TRUE
      ORDER BY po.nombre
    `, [clientId]);

    const IGSS_PATRONAL = 0.1267;
    const PREST_FACTOR = 0.4183;
    const BONO_MENSUAL = 250;
    const IVA_RATE = 0.12;
    const ISR_SERVICIOS_RATE = 0.05;

    const r2 = (n: number) => Math.round(n * 100) / 100;

    const puestos = puestoRows.map(p => {
      const tarifaBruta = Number(p.tarifa_puesto || 0);
      const titulares = p.titulares || [];
      const numTitulares = titulares.length;

      const ivaFactura = r2(tarifaBruta - tarifaBruta / (1 + IVA_RATE));
      const baseFactura = r2(tarifaBruta - ivaFactura);
      const isrFactura = r2(baseFactura * ISR_SERVICIOS_RATE);
      const ingresoNeto = r2(baseFactura - isrFactura);

      let costoSueldos = 0;
      let costoIGSS = 0;
      let costoPrestaciones = 0;
      let costoBonificacion = 0;

      for (const t of titulares) {
        const sb = Number(t.sueldo_base || 0);
        costoSueldos += sb;
        if (t.aplica_igss) costoIGSS += sb * IGSS_PATRONAL;
        costoPrestaciones += sb * PREST_FACTOR;
        costoBonificacion += Number(t.bonificacion_incentivo || BONO_MENSUAL);
      }

      const heAprobadas = Number(p.he_30d || 0);
      let costoHE = 0;
      if (heAprobadas > 0 && titulares.length > 0) {
        const avgSueldo = costoSueldos / titulares.length;
        const sueldoDia = avgSueldo / 30;
        const horasDia = 8;
        costoHE = (sueldoDia / horasDia) * 1.5 * heAprobadas;
      }

      const costoOperativo = costoSueldos + costoIGSS + costoPrestaciones + costoBonificacion + costoHE;
      const costoTotal = costoOperativo + ivaFactura + isrFactura;
      const margen = ingresoNeto - costoOperativo;
      const margenPct = ingresoNeto > 0 ? (margen / ingresoNeto) * 100 : 0;

      return {
        id: p.id,
        nombre: p.nombre,
        sede: p.sede_nombre,
        turno: p.turno_nombre,
        tipo_servicio: p.tipo_servicio,
        tarifa_bruta: tarifaBruta,
        iva_factura: ivaFactura,
        isr_factura: isrFactura,
        ingreso_neto: ingresoNeto,
        num_titulares: numTitulares,
        costo_sueldos: r2(costoSueldos),
        costo_igss_patronal: r2(costoIGSS),
        costo_prestaciones: r2(costoPrestaciones),
        costo_bonificacion: r2(costoBonificacion),
        costo_he_30d: r2(costoHE),
        he_horas_30d: heAprobadas,
        relevos_30d: Number(p.relevos_30d || 0),
        costo_operativo: r2(costoOperativo),
        costo_total: r2(costoTotal),
        margen: r2(margen),
        margen_pct: Math.round(margenPct * 10) / 10,
      };
    });

    const { rows: bajasRows } = await pool.query(`
      SELECT
        pl.causal_egreso,
        pl.total_indemnizacion,
        pl.total_general,
        pl.fecha_egreso,
        pl.empleado_nombre,
        pl.anios_servicio
      FROM prestaciones_liquidaciones pl
      JOIN employees e ON e.id = pl.employee_id
      WHERE e.cliente_id = $1
        AND pl.estado = 'confirmada'
        AND pl.simulacion = FALSE
      ORDER BY pl.fecha_egreso DESC
    `, [clientId]);

    const causalesConIndemnizacion = ['despido_injustificado', 'finalizacion_contrato', 'mutuo_acuerdo'];

    const bajasConIndemnizacion = bajasRows.filter(b => causalesConIndemnizacion.includes(b.causal_egreso));
    const bajasSinIndemnizacion = bajasRows.filter(b => !causalesConIndemnizacion.includes(b.causal_egreso));

    const totalTarifaBruta = puestos.reduce((s, p) => s + p.tarifa_bruta, 0);
    const totalIVA = puestos.reduce((s, p) => s + p.iva_factura, 0);
    const totalISR = puestos.reduce((s, p) => s + p.isr_factura, 0);
    const totalIngresoNeto = puestos.reduce((s, p) => s + p.ingreso_neto, 0);
    const totalCostoOp = puestos.reduce((s, p) => s + p.costo_operativo, 0);
    const totalMargen = totalIngresoNeto - totalCostoOp;

    res.json({
      puestos,
      resumen: {
        total_tarifa_bruta: r2(totalTarifaBruta),
        total_iva: r2(totalIVA),
        total_isr: r2(totalISR),
        total_ingreso_neto: r2(totalIngresoNeto),
        total_costo_operativo: r2(totalCostoOp),
        margen_global: r2(totalMargen),
        margen_pct: totalIngresoNeto > 0 ? Math.round((totalMargen / totalIngresoNeto) * 1000) / 10 : 0,
        total_puestos: puestos.length,
      },
      bajas: {
        con_indemnizacion: {
          total: bajasConIndemnizacion.length,
          monto_indemnizacion: Math.round(bajasConIndemnizacion.reduce((s, b) => s + Number(b.total_indemnizacion || 0), 0) * 100) / 100,
          monto_total: Math.round(bajasConIndemnizacion.reduce((s, b) => s + Number(b.total_general || 0), 0) * 100) / 100,
          detalle: bajasConIndemnizacion.map(b => ({
            nombre: b.empleado_nombre,
            causal: b.causal_egreso,
            fecha: b.fecha_egreso,
            indemnizacion: Number(b.total_indemnizacion || 0),
            total: Number(b.total_general || 0),
            anios: Number(b.anios_servicio || 0),
          })),
        },
        sin_indemnizacion: {
          total: bajasSinIndemnizacion.length,
          monto_total: Math.round(bajasSinIndemnizacion.reduce((s, b) => s + Number(b.total_general || 0), 0) * 100) / 100,
          detalle: bajasSinIndemnizacion.map(b => ({
            nombre: b.empleado_nombre,
            causal: b.causal_egreso,
            fecha: b.fecha_egreso,
            total: Number(b.total_general || 0),
            anios: Number(b.anios_servicio || 0),
          })),
        },
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /clientes/:id/rentabilidad error");
    res.status(500).json({ error: "Error al calcular rentabilidad" });
  }
});

// ─── GET /api/rentabilidad/global ──────────────────────────────────────────────
fichaRouter.get("/rentabilidad/global", async (_req, res) => {
  try {
    const IVA_RATE = 0.12;
    const ISR_SERVICIOS_RATE = 0.05;
    const IGSS_PATRONAL = 0.1267;
    const PREST_FACTOR = 0.4183;
    const BONO_MENSUAL = 250;
    const r2 = (n: number) => Math.round(n * 100) / 100;

    const { rows } = await pool.query(`
      SELECT
        c.id, c.nombre, c.nombre_comercial,
        c.estado, c.estado_contrato,
        (SELECT COUNT(*)::int FROM puestos_operativos po WHERE po.cliente_id = c.id AND po.activo = TRUE) AS total_puestos,
        (SELECT COALESCE(SUM(po.tarifa_puesto), 0) FROM puestos_operativos po WHERE po.cliente_id = c.id AND po.activo = TRUE) AS tarifa_total,
        (
          SELECT json_agg(json_build_object(
            'sueldo_base', e.sueldo_base,
            'aplica_igss', COALESCE(e.aplica_igss_general, TRUE),
            'bonificacion', COALESCE(e.bonificacion_incentivo, 250)
          ))
          FROM puesto_slots ps2
          JOIN employees e ON e.id = ps2.empleado_id
          WHERE ps2.puesto_id IN (SELECT po2.id FROM puestos_operativos po2 WHERE po2.cliente_id = c.id AND po2.activo = TRUE)
            AND ps2.activo = TRUE AND e.estado_laboral = 'activo'
        ) AS titulares_data,
        (SELECT COUNT(*)::int FROM prestaciones_liquidaciones pl
         JOIN employees e2 ON e2.id = pl.employee_id
         WHERE e2.cliente_id = c.id AND pl.estado = 'confirmada' AND pl.simulacion = FALSE
           AND pl.causal_egreso IN ('despido_injustificado','finalizacion_contrato','mutuo_acuerdo')
        ) AS bajas_con_indem,
        (SELECT COUNT(*)::int FROM prestaciones_liquidaciones pl
         JOIN employees e2 ON e2.id = pl.employee_id
         WHERE e2.cliente_id = c.id AND pl.estado = 'confirmada' AND pl.simulacion = FALSE
           AND pl.causal_egreso NOT IN ('despido_injustificado','finalizacion_contrato','mutuo_acuerdo')
        ) AS bajas_sin_indem
      FROM clients c
      WHERE c.estado = 'activo'
      ORDER BY c.nombre
    `);

    const clientes = rows.map(c => {
      const tarifaBruta = Number(c.tarifa_total || 0);
      const ivaFactura = r2(tarifaBruta - tarifaBruta / (1 + IVA_RATE));
      const baseFactura = r2(tarifaBruta - ivaFactura);
      const isrFactura = r2(baseFactura * ISR_SERVICIOS_RATE);
      const ingresoNeto = r2(baseFactura - isrFactura);

      const titulares = c.titulares_data || [];
      let costoOp = 0;
      for (const t of titulares) {
        const sb = Number(t.sueldo_base || 0);
        costoOp += sb;
        if (t.aplica_igss) costoOp += sb * IGSS_PATRONAL;
        costoOp += sb * PREST_FACTOR;
        costoOp += Number(t.bonificacion || BONO_MENSUAL);
      }

      const margen = r2(ingresoNeto - costoOp);
      const margenPct = ingresoNeto > 0 ? Math.round((margen / ingresoNeto) * 1000) / 10 : 0;

      return {
        id: c.id,
        nombre: c.nombre_comercial || c.nombre,
        estado_contrato: c.estado_contrato,
        total_puestos: Number(c.total_puestos),
        num_titulares: titulares.length,
        tarifa_bruta: tarifaBruta,
        ingreso_neto: ingresoNeto,
        costo_operativo: r2(costoOp),
        margen,
        margen_pct: margenPct,
        bajas_con_indem: Number(c.bajas_con_indem),
        bajas_sin_indem: Number(c.bajas_sin_indem),
      };
    });

    const totales = {
      tarifa_bruta: r2(clientes.reduce((s, c) => s + c.tarifa_bruta, 0)),
      ingreso_neto: r2(clientes.reduce((s, c) => s + c.ingreso_neto, 0)),
      costo_operativo: r2(clientes.reduce((s, c) => s + c.costo_operativo, 0)),
      margen: r2(clientes.reduce((s, c) => s + c.margen, 0)),
      total_puestos: clientes.reduce((s, c) => s + c.total_puestos, 0),
      total_titulares: clientes.reduce((s, c) => s + c.num_titulares, 0),
      bajas_con_indem: clientes.reduce((s, c) => s + c.bajas_con_indem, 0),
      bajas_sin_indem: clientes.reduce((s, c) => s + c.bajas_sin_indem, 0),
    };
    const margenPctGlobal = totales.ingreso_neto > 0 ? Math.round((totales.margen / totales.ingreso_neto) * 1000) / 10 : 0;

    res.json({ clientes, totales: { ...totales, margen_pct: margenPctGlobal } });
  } catch (err) {
    logger.error({ err }, "GET /rentabilidad/global error");
    res.status(500).json({ error: "Error al calcular rentabilidad global" });
  }
});

export default fichaRouter;
