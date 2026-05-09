import { Router } from "express";
import { pool } from "@workspace/db";
import {
  calcularResponsablePuesto,
  syncCustodiaArma,
  siguienteCodigoArma,
  traducirErrorUnicoArma,
  validarPuestoSinArmaActiva,
  validarUnicidadArma,
} from "./_helpers";

export const armasRouter = Router();

// ── GET /api/armas ─────────────────────────────────────────────────────────────
armasRouter.get("/armas", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        a.id, a.codigo, a.tipo, a.marca, a.modelo, a.calibre, a.serie,
        a.estado, a.activo, a.observaciones,
        a.numero_tenencia, a.fecha_vencimiento_tenencia,
        a.tenencia_en_tramite,
        CASE
          WHEN a.numero_tenencia IS NULL AND COALESCE(a.tenencia_en_tramite, FALSE) THEN 'en_tramite'
          WHEN a.numero_tenencia IS NULL THEN 'pendiente'
          WHEN a.fecha_vencimiento_tenencia IS NULL THEN 'vigente'
          WHEN a.fecha_vencimiento_tenencia < CURRENT_DATE THEN 'vencida'
          WHEN a.fecha_vencimiento_tenencia <= CURRENT_DATE + INTERVAL '180 days' THEN 'proximo_a_vencer'
          ELSE 'vigente'
        END AS estado_documental,
        CASE
          WHEN a.fecha_vencimiento_tenencia IS NULL THEN NULL
          ELSE (a.fecha_vencimiento_tenencia - CURRENT_DATE)::INTEGER
        END AS dias_restantes,
        a.numero_portacion,
        a.fecha_emision_portacion,
        a.fecha_vencimiento_portacion,
        a.portacion_en_tramite,
        CASE
          WHEN a.numero_portacion IS NULL AND COALESCE(a.portacion_en_tramite, FALSE) THEN 'en_tramite'
          WHEN a.numero_portacion IS NULL THEN 'pendiente'
          WHEN a.fecha_vencimiento_portacion IS NULL AND COALESCE(a.portacion_en_tramite, FALSE) THEN 'en_tramite'
          WHEN a.fecha_vencimiento_portacion IS NULL THEN 'pendiente'
          WHEN a.fecha_vencimiento_portacion < CURRENT_DATE THEN 'vencida'
          WHEN a.fecha_vencimiento_portacion <= CURRENT_DATE + INTERVAL '180 days' THEN 'proximo_a_vencer'
          ELSE 'vigente'
        END AS estado_documental_portacion,
        CASE
          WHEN a.fecha_vencimiento_portacion IS NULL THEN NULL
          ELSE (a.fecha_vencimiento_portacion - CURRENT_DATE)::INTEGER
        END AS dias_restantes_portacion,
        a.puesto_id,
        po.nombre   AS puesto_nombre,
        COALESCE(po.tipo_puesto, 'normal') AS tipo_puesto,
        po.agente_id AS titular_id,
        te.nombre_completo AS titular_nombre,
        po.cliente_nombre,
        po.direccion AS puesto_direccion,
        -- Ubicación interna cuando NO está en puesto ('armeria' | 'jefatura_servicios')
        COALESCE(a.ubicacion_interna, 'armeria') AS ubicacion_interna,
        -- Custodio asignado manualmente al arma (override del titular del puesto)
        a.custodio_employee_id,
        cae.nombre_completo AS custodio_asignado_nombre,
        -- Custodio actual registrado
        ac.id           AS custodia_id,
        ac.employee_id  AS custodio_id,
        ce.nombre_completo AS custodio_nombre,
        ce.tipo_personal   AS custodio_tipo,
        ac.fecha_inicio    AS custodia_desde,
        ac.tipo_origen     AS custodia_tipo_origen,
        a.created_at, a.updated_at,
        -- Sugerencias pendientes del supervisor
        COALESCE((
          SELECT COUNT(*)::int FROM arma_sugerencias s
          WHERE s.arma_id = a.id AND s.atendido = FALSE
        ), 0) AS sugerencias_pendientes
      FROM armas a
      LEFT JOIN puestos_operativos po ON po.id = a.puesto_id
      LEFT JOIN employees te          ON te.id = po.agente_id
      LEFT JOIN arma_custodia ac      ON ac.arma_id = a.id AND ac.fecha_fin IS NULL
      LEFT JOIN employees ce          ON ce.id = ac.employee_id
      LEFT JOIN employees cae         ON cae.id = a.custodio_employee_id
      ORDER BY a.activo DESC, a.codigo
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/armas/:id ────────────────────────────────────────────────────────
armasRouter.get("/armas/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rows } = await pool.query(`
      SELECT
        a.*,
        a.tenencia_en_tramite,
        CASE
          WHEN a.numero_tenencia IS NULL AND COALESCE(a.tenencia_en_tramite, FALSE) THEN 'en_tramite'
          WHEN a.numero_tenencia IS NULL THEN 'pendiente'
          WHEN a.fecha_vencimiento_tenencia IS NULL THEN 'vigente'
          WHEN a.fecha_vencimiento_tenencia < CURRENT_DATE THEN 'vencida'
          WHEN a.fecha_vencimiento_tenencia <= CURRENT_DATE + INTERVAL '180 days' THEN 'proximo_a_vencer'
          ELSE 'vigente'
        END AS estado_documental,
        CASE
          WHEN a.fecha_vencimiento_tenencia IS NULL THEN NULL
          ELSE (a.fecha_vencimiento_tenencia - CURRENT_DATE)::INTEGER
        END AS dias_restantes,
        po.nombre AS puesto_nombre, po.cliente_nombre, po.direccion AS puesto_direccion,
        COALESCE(po.tipo_puesto, 'normal') AS tipo_puesto,
        COALESCE(a.ubicacion_interna, 'armeria') AS ubicacion_interna,
        a.custodio_employee_id,
        cae.nombre_completo AS custodio_asignado_nombre,
        ac.id AS custodia_id, ac.employee_id AS custodio_id,
        e.nombre_completo AS custodio_nombre,
        ac.fecha_inicio AS custodia_desde, ac.tipo_origen AS custodia_tipo_origen,
        a.portacion_en_tramite,
        CASE
          WHEN a.numero_portacion IS NULL AND COALESCE(a.portacion_en_tramite, FALSE) THEN 'en_tramite'
          WHEN a.numero_portacion IS NULL THEN 'pendiente'
          WHEN a.fecha_vencimiento_portacion IS NULL AND COALESCE(a.portacion_en_tramite, FALSE) THEN 'en_tramite'
          WHEN a.fecha_vencimiento_portacion IS NULL THEN 'pendiente'
          WHEN a.fecha_vencimiento_portacion < CURRENT_DATE THEN 'vencida'
          WHEN a.fecha_vencimiento_portacion <= CURRENT_DATE + INTERVAL '180 days' THEN 'proximo_a_vencer'
          ELSE 'vigente'
        END AS estado_documental_portacion,
        CASE
          WHEN a.fecha_vencimiento_portacion IS NULL THEN NULL
          ELSE (a.fecha_vencimiento_portacion - CURRENT_DATE)::INTEGER
        END AS dias_restantes_portacion
      FROM armas a
      LEFT JOIN puestos_operativos po ON po.id = a.puesto_id
      LEFT JOIN arma_custodia ac      ON ac.arma_id = a.id AND ac.fecha_fin IS NULL
      LEFT JOIN employees e           ON e.id = ac.employee_id
      LEFT JOIN employees cae         ON cae.id = a.custodio_employee_id
      WHERE a.id = $1
    `, [id]);
    if (!rows[0]) return res.status(404).json({ error: "Arma no encontrada" });
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/armas/:id/custodia ───────────────────────────────────────────────
armasRouter.get("/armas/:id/custodia", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rows } = await pool.query(`
      SELECT ac.*, e.nombre_completo AS custodio_nombre, e.tipo_personal AS custodio_tipo,
             po.nombre AS puesto_nombre, po.cliente_nombre
      FROM arma_custodia ac
      LEFT JOIN employees e           ON e.id  = ac.employee_id
      LEFT JOIN puestos_operativos po ON po.id = ac.puesto_id
      WHERE ac.arma_id = $1
      ORDER BY ac.fecha_inicio DESC
      LIMIT 200
    `, [id]);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/armas/puestos/disponibles ────────────────────────────────────────
// Lista puestos activos para el selector del formulario de Armería.
// Incluye tipo_puesto ('normal' | 'custodia') y el titular real (titular_employee_id
// o agente_id legacy) para que el frontend pueda agrupar y precargar el custodio.
armasRouter.get("/armas/puestos/disponibles", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        po.id,
        po.nombre,
        po.cliente_nombre,
        COALESCE(po.tipo_puesto, 'normal') AS tipo_puesto,
        po.agente_id,
        e.nombre_completo AS agente_nombre,
        COALESCE(po.titular_employee_id, po.agente_id) AS titular_id,
        te.nombre_completo AS titular_nombre,
        oz.nombre AS zona_nombre,
        po.direccion
      FROM puestos_operativos po
      LEFT JOIN employees e        ON e.id  = po.agente_id
      LEFT JOIN employees te       ON te.id = COALESCE(po.titular_employee_id, po.agente_id)
      LEFT JOIN operational_zones oz ON oz.id = po.zona_operativa_id
      WHERE po.activo = TRUE
      ORDER BY
        CASE WHEN COALESCE(po.tipo_puesto, 'normal') = 'custodia' THEN 1 ELSE 0 END,
        po.cliente_nombre, po.nombre
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/armas ───────────────────────────────────────────────────────────
armasRouter.post("/armas", async (req, res) => {
  // El campo `codigo` se IGNORA si llega: el sistema lo genera automáticamente.
  const { tipo, marca, modelo, calibre, serie, estado, activo, puesto_id, observaciones,
          numero_tenencia, fecha_vencimiento_tenencia,
          numero_portacion, fecha_emision_portacion,
          ubicacion_interna, custodio_employee_id, usuario } = req.body;
  if (!tipo) return res.status(400).json({ error: "tipo es requerido" });

  // Normaliza ubicacion_interna: solo 'armeria' o 'jefatura_servicios'
  const ubicacionFinal: "armeria" | "jefatura_servicios" =
    ubicacion_interna === "jefatura_servicios" ? "jefatura_servicios" : "armeria";
  let custodioOverride = custodio_employee_id != null && custodio_employee_id !== ""
    ? Number(custodio_employee_id) : null;

  // ARM-08 invariante: custodio_employee_id solo se persiste cuando el puesto
  // existe Y es de tipo 'custodia'. En cualquier otro caso (sin puesto o puesto
  // normal) se fuerza a NULL para evitar inconsistencias por payloads externos.
  const puestoIdNum = puesto_id ? Number(puesto_id) : null;
  if (custodioOverride && puestoIdNum) {
    const { rows: tpRows } = await pool.query(
      `SELECT COALESCE(tipo_puesto, 'normal') AS tipo_puesto FROM puestos_operativos WHERE id=$1`,
      [puestoIdNum]
    );
    if (tpRows[0]?.tipo_puesto !== "custodia") custodioOverride = null;
  } else if (!puestoIdNum) {
    custodioOverride = null;
  }

  // Validación de unicidad: serie / tenencia / portación no pueden repetirse.
  const errUnico = await validarUnicidadArma(pool, { serie, numero_tenencia, numero_portacion });
  if (errUnico) return res.status(409).json({ error: errUnico });

  // ARM-09: 1 puesto = 1 arma. Si el puesto ya tiene otra arma activa, rechazar.
  // Solo se valida cuando el arma se crea como activa (activo !== false) y con puesto.
  if (puestoIdNum && activo !== false) {
    const errPuesto = await validarPuestoSinArmaActiva(pool, puestoIdNum);
    if (errPuesto) return res.status(409).json({ error: errPuesto });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Reintentos cortos por si hay carrera en la generación de código.
    // Usamos SAVEPOINT por intento: si el INSERT viola el UNIQUE (23505),
    // hacemos ROLLBACK al SAVEPOINT (la transacción sigue viva) y probamos
    // el siguiente número.
    let arma: any = null;
    let lastErr: any = null;
    for (let attempt = 0; attempt < 5 && !arma; attempt++) {
      const codigoGenerado = await siguienteCodigoArma(client);
      await client.query("SAVEPOINT sp_codigo_arma");
      try {
        const { rows } = await client.query(`
          INSERT INTO armas (codigo, tipo, marca, modelo, calibre, serie, estado, activo, puesto_id, observaciones,
                             numero_tenencia, fecha_vencimiento_tenencia,
                             numero_portacion, fecha_emision_portacion, fecha_vencimiento_portacion,
                             ubicacion_interna, custodio_employee_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
                  CASE WHEN $14::date IS NOT NULL THEN ($14::date + INTERVAL '1 year')::date ELSE NULL END,
                  $15,$16)
          RETURNING *
        `, [
          codigoGenerado, tipo,
          marca || null, modelo || null, calibre || null, serie || null,
          estado ?? "activo", activo !== false,
          puesto_id ? Number(puesto_id) : null,
          observaciones || null,
          numero_tenencia || null,
          fecha_vencimiento_tenencia || null,
          numero_portacion || null,
          fecha_emision_portacion || null,
          ubicacionFinal,
          custodioOverride,
        ]);
        await client.query("RELEASE SAVEPOINT sp_codigo_arma");
        arma = rows[0];
      } catch (e: any) {
        lastErr = e;
        await client.query("ROLLBACK TO SAVEPOINT sp_codigo_arma");
        await client.query("RELEASE SAVEPOINT sp_codigo_arma");
        if (e.code !== "23505") throw e; // si no es violación de UNIQUE, propaga
        // Carrera de código: el siguiente loop recalcula y reintenta.
      }
    }
    if (!arma) throw lastErr ?? new Error("No se pudo generar un código único");

    // Si tiene puesto, calcular responsable inicial y crear custodia.
    // Para puestos de tipo 'custodia' (rutas), si el operador asignó un
    // custodio_employee_id manualmente, ese tiene prioridad sobre el titular
    // calculado. Para puestos 'normal' se mantiene la lógica existente.
    if (arma.puesto_id) {
      const fecha = new Date().toISOString().slice(0, 10);
      const { rows: tipoRows } = await client.query(
        `SELECT COALESCE(tipo_puesto, 'normal') AS tipo_puesto FROM puestos_operativos WHERE id=$1`,
        [arma.puesto_id]
      );
      const tipoPuesto = tipoRows[0]?.tipo_puesto ?? "normal";
      let responsableId: number | null = null;
      let tipoOrigen = "turno_normal";
      let notas = "Custodia inicial al registrar arma";

      if (tipoPuesto === "custodia" && custodioOverride) {
        responsableId = custodioOverride;
        tipoOrigen = "custodia_asignada";
        notas = "Custodio asignado al registrar arma (ruta)";
      } else {
        const responsable = await calcularResponsablePuesto(arma.puesto_id, fecha);
        if (responsable) responsableId = responsable.id;
      }

      if (responsableId) {
        await client.query(`
          INSERT INTO arma_custodia (arma_id, employee_id, puesto_id, tipo_origen, notas, registrado_por)
          VALUES ($1,$2,$3,$4,$5,$6)
        `, [arma.id, responsableId, arma.puesto_id, tipoOrigen, notas, usuario ?? "sistema"]);
      }
    }

    await client.query("COMMIT");
    res.status(201).json(arma);
  } catch (err: any) {
    await client.query("ROLLBACK");
    // Si el índice único de la BD atrapó una carrera (cuando dos peticiones simultáneas
    // pasaron la validación previa), traducimos el error a un mensaje claro en español.
    const msg = traducirErrorUnicoArma(err);
    if (msg) return res.status(409).json({ error: msg });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── PATCH /api/armas/:id ──────────────────────────────────────────────────────
armasRouter.patch("/armas/:id", async (req, res) => {
  const id = Number(req.params.id);
  // Nota: el campo `codigo` se ignora — el código del arma es inmutable y
  // generado por el sistema (ver POST /armas y migración ARM-07).
  const { tipo, marca, modelo, calibre, serie, estado, activo, puesto_id, observaciones,
          numero_tenencia, fecha_vencimiento_tenencia,
          numero_portacion, fecha_emision_portacion,
          tenencia_en_tramite, portacion_en_tramite,
          ubicacion_interna, custodio_employee_id, usuario } = req.body;

  // Validación de unicidad: solo evaluamos los campos que el cliente está enviando.
  // (Si no se envía el campo, no hay riesgo de cambiarlo a un duplicado.)
  const camposParaValidar: { serie?: string | null; numero_tenencia?: string | null; numero_portacion?: string | null } = {};
  if ('serie'            in req.body) camposParaValidar.serie            = serie;
  if ('numero_tenencia'  in req.body) camposParaValidar.numero_tenencia  = numero_tenencia;
  if ('numero_portacion' in req.body) camposParaValidar.numero_portacion = numero_portacion;
  if (Object.keys(camposParaValidar).length > 0) {
    const errUnico = await validarUnicidadArma(pool, camposParaValidar, id);
    if (errUnico) return res.status(409).json({ error: errUnico });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: prevRows } = await client.query(
      `SELECT puesto_id, custodio_employee_id, activo FROM armas WHERE id=$1`, [id]
    );
    if (!prevRows[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "No encontrada" }); }
    const puestoAnterior = prevRows[0].puesto_id;
    const custodioAnterior = prevRows[0].custodio_employee_id;
    const activoAnterior  = prevRows[0].activo;
    const puestoNuevo = puesto_id !== undefined ? (puesto_id ? Number(puesto_id) : null) : puestoAnterior;
    let custodioNuevo: number | null = 'custodio_employee_id' in req.body
      ? (custodio_employee_id != null && custodio_employee_id !== "" ? Number(custodio_employee_id) : null)
      : custodioAnterior;

    // ARM-08 invariante: custodio_employee_id solo válido si el puesto efectivo
    // es de tipo 'custodia'. Forzar NULL en cualquier otro caso para que la
    // base de datos refleje el estado real (sin importar lo que envíe el cliente).
    if (custodioNuevo && puestoNuevo) {
      const { rows: tpRows } = await client.query(
        `SELECT COALESCE(tipo_puesto, 'normal') AS tipo_puesto FROM puestos_operativos WHERE id=$1`,
        [puestoNuevo]
      );
      if (tpRows[0]?.tipo_puesto !== "custodia") custodioNuevo = null;
    } else if (!puestoNuevo) {
      custodioNuevo = null;
    }
    // Si la normalización vació el override pero no estaba en el body, igual
    // necesitamos persistirlo para limpiar valores residuales.
    const custodioCambio = custodioNuevo !== custodioAnterior;

    // ARM-09: 1 puesto = 1 arma. Si está cambiando a un puesto que ya tiene
    // otra arma activa, o si está cambiando 'activo' a TRUE estando en un
    // puesto ocupado, rechazar con 409 (excluyendo el arma actual).
    // El estado 'activo' efectivo se calcula a partir del payload; si no vino,
    // se conserva el valor actual de la BD para no rechazar PATCHes no
    // relacionados sobre armas ya inactivas.
    const armaQuedaraActiva = activo !== undefined ? activo !== false : activoAnterior !== false;
    if (puestoNuevo && armaQuedaraActiva) {
      const errPuesto = await validarPuestoSinArmaActiva(client, puestoNuevo, id);
      if (errPuesto) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: errPuesto });
      }
    }

    const params: any[] = [
      null, // codigo: placeholder para mantener los índices de los $N existentes; el SET COALESCE($1, codigo) deja el código intacto
      tipo ?? null, marca ?? null, modelo ?? null, calibre ?? null, serie ?? null,
      estado ?? null, activo !== undefined ? activo : null,
      puestoNuevo, observaciones ?? null,
    ];
    const extraFields: string[] = [];
    if ('numero_tenencia' in req.body) {
      params.push(numero_tenencia || null);
      extraFields.push(`numero_tenencia = $${params.length}`);
    }
    if ('fecha_vencimiento_tenencia' in req.body) {
      params.push(fecha_vencimiento_tenencia || null);
      extraFields.push(`fecha_vencimiento_tenencia = $${params.length}`);
    }
    if ('numero_portacion' in req.body) {
      params.push(numero_portacion || null);
      extraFields.push(`numero_portacion = $${params.length}`);
    }
    if ('fecha_emision_portacion' in req.body) {
      const emision = fecha_emision_portacion || null;
      params.push(emision);
      const emisionIdx = `$${params.length}`;
      extraFields.push(`fecha_emision_portacion = ${emisionIdx}`);
      extraFields.push(
        `fecha_vencimiento_portacion = CASE WHEN ${emisionIdx}::date IS NOT NULL THEN (${emisionIdx}::date + INTERVAL '1 year')::date ELSE NULL END`
      );
    }
    if ('tenencia_en_tramite' in req.body) {
      params.push(Boolean(tenencia_en_tramite));
      extraFields.push(`tenencia_en_tramite = $${params.length}`);
    }
    if ('portacion_en_tramite' in req.body) {
      params.push(Boolean(portacion_en_tramite));
      extraFields.push(`portacion_en_tramite = $${params.length}`);
    }
    if ('ubicacion_interna' in req.body) {
      const ubic = ubicacion_interna === "jefatura_servicios" ? "jefatura_servicios" : "armeria";
      params.push(ubic);
      extraFields.push(`ubicacion_interna = $${params.length}`);
    }
    // Persistimos custodio_employee_id cuando vino en el body O cuando la
    // normalización de invariante lo cambió (limpieza de valor residual).
    if ('custodio_employee_id' in req.body || custodioCambio) {
      params.push(custodioNuevo);
      extraFields.push(`custodio_employee_id = $${params.length}`);
    }
    params.push(id);
    const tenenciaSQL = extraFields.length > 0 ? `, ${extraFields.join(", ")}` : "";

    const { rows } = await client.query(`
      UPDATE armas SET
        codigo        = COALESCE($1, codigo),
        tipo          = COALESCE($2, tipo),
        marca         = COALESCE($3, marca),
        modelo        = COALESCE($4, modelo),
        calibre       = COALESCE($5, calibre),
        serie         = COALESCE($6, serie),
        estado        = COALESCE($7, estado),
        activo        = COALESCE($8, activo),
        puesto_id     = $9,
        observaciones = COALESCE($10, observaciones)
        ${tenenciaSQL},
        updated_at    = NOW()
      WHERE id = $${params.length}
      RETURNING *
    `, params);

    // Si cambió el puesto, sincronizar custodia automáticamente
    if (puestoNuevo !== puestoAnterior) {
      await client.query(
        `UPDATE arma_custodia SET fecha_fin=NOW() WHERE arma_id=$1 AND fecha_fin IS NULL`, [id]
      );
      if (puestoNuevo) {
        const fecha = new Date().toISOString().slice(0, 10);
        const { rows: tipoRows } = await client.query(
          `SELECT COALESCE(tipo_puesto, 'normal') AS tipo_puesto FROM puestos_operativos WHERE id=$1`,
          [puestoNuevo]
        );
        const tipoPuesto = tipoRows[0]?.tipo_puesto ?? "normal";
        let responsableId: number | null = null;
        let tipoOrigen = "turno_normal";
        let notas = "Reasignación de puesto";

        if (tipoPuesto === "custodia" && custodioNuevo) {
          responsableId = custodioNuevo;
          tipoOrigen = "custodia_asignada";
          notas = "Custodio asignado al cambiar de puesto (ruta)";
        } else {
          const responsable = await calcularResponsablePuesto(puestoNuevo, fecha);
          if (responsable) responsableId = responsable.id;
        }

        if (responsableId) {
          await client.query(`
            INSERT INTO arma_custodia (arma_id, employee_id, puesto_id, tipo_origen, notas, registrado_por)
            VALUES ($1,$2,$3,$4,$5,$6)
          `, [id, responsableId, puestoNuevo, tipoOrigen, notas, usuario ?? "sistema"]);
        }
      }
    } else if (
      // Mismo puesto, pero cambió el custodio asignado (incluye el caso de
      // limpieza de residuales aunque el body no traiga el campo).
      puestoNuevo && custodioCambio
    ) {
      const { rows: tipoRows } = await client.query(
        `SELECT COALESCE(tipo_puesto, 'normal') AS tipo_puesto FROM puestos_operativos WHERE id=$1`,
        [puestoNuevo]
      );
      const tipoPuesto = tipoRows[0]?.tipo_puesto ?? "normal";
      if (tipoPuesto === "custodia") {
        await client.query(
          `UPDATE arma_custodia SET fecha_fin=NOW() WHERE arma_id=$1 AND fecha_fin IS NULL`, [id]
        );
        if (custodioNuevo) {
          await client.query(`
            INSERT INTO arma_custodia (arma_id, employee_id, puesto_id, tipo_origen, notas, registrado_por)
            VALUES ($1,$2,$3,'custodia_asignada','Cambio de custodio asignado (ruta)',$4)
          `, [id, custodioNuevo, puestoNuevo, usuario ?? "sistema"]);
        }
      }
    }

    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err: any) {
    await client.query("ROLLBACK");
    const msg = traducirErrorUnicoArma(err);
    if (msg) return res.status(409).json({ error: msg });
    if (err.code === "23505") return res.status(409).json({ error: "Código duplicado" });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── DELETE /api/armas/:id ─────────────────────────────────────────────────────
// Eliminación física del arma. Pensado para resolver duplicados (cargas repetidas).
// Las tablas dependientes (arma_custodia, arma_ordenes_servicio, reporte_turno,
// arma_sugerencias) tienen ON DELETE CASCADE / SET NULL, así que no rompemos integridad.
armasRouter.delete("/armas/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "id inválido" });
  try {
    const { rows } = await pool.query(`SELECT codigo FROM armas WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ error: "Arma no encontrada" });
    const codigo = rows[0].codigo;
    await pool.query(`DELETE FROM armas WHERE id = $1`, [id]);
    res.json({ ok: true, codigo, mensaje: `Arma ${codigo} eliminada` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/armas/:id/sync-custodia ─────────────────────────────────────────
armasRouter.post("/armas/:id/sync-custodia", async (req, res) => {
  const armaId = Number(req.params.id);
  const fecha   = (req.body.fecha as string) || new Date().toISOString().slice(0, 10);
  const usuario = (req.body.usuario as string) || "sistema";
  try {
    const resultado = await syncCustodiaArma(armaId, fecha, usuario);
    if (resultado.motivo === "Arma no encontrada") return res.status(404).json(resultado);
    res.json(resultado);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/armas/sync-custodias ────────────────────────────────────────────
// Sincroniza TODAS las armas activas con puesto asignado
armasRouter.post("/armas/sync-custodias", async (req, res) => {
  const fecha   = (req.body.fecha as string) || new Date().toISOString().slice(0, 10);
  const usuario = (req.body.usuario as string) || "sistema";
  try {
    const { rows: armas } = await pool.query(
      `SELECT id FROM armas WHERE activo=TRUE AND puesto_id IS NOT NULL`
    );
    const resultados = await Promise.all(
      armas.map((a: any) => syncCustodiaArma(a.id, fecha, usuario))
    );
    const cambios = resultados.filter((r: any) => r.cambio).length;
    res.json({ fecha, total: armas.length, cambios, resultados });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/armas/:id/relevo ────────────────────────────────────────────────
// Relevo manual (override excepcional)
armasRouter.post("/armas/:id/relevo", async (req, res) => {
  const armaId = Number(req.params.id);
  const { nuevo_employee_id, notas, tipo_origen, usuario } = req.body;
  if (!nuevo_employee_id) return res.status(400).json({ error: "nuevo_employee_id es requerido" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE arma_custodia SET fecha_fin=NOW() WHERE arma_id=$1 AND fecha_fin IS NULL`, [armaId]
    );
    const { rows: aRows } = await client.query(`SELECT puesto_id FROM armas WHERE id=$1`, [armaId]);
    const puesto_id = aRows[0]?.puesto_id ?? null;

    const { rows } = await client.query(`
      INSERT INTO arma_custodia (arma_id, employee_id, puesto_id, tipo_origen, notas, registrado_por)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `, [armaId, Number(nuevo_employee_id), puesto_id, tipo_origen ?? "manual", notas ?? null, usuario ?? "sistema"]);

    await client.query("COMMIT");
    res.status(201).json(rows[0]);
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
