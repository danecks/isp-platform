import { Router } from "express";
import { pool, todayGT } from "@workspace/db";
import { logger } from "../lib/logger";

export const custodiasRouter = Router();

custodiasRouter.get("/custodias/dashboard", async (req, res) => {
  try {
    const fecha = (req.query.fecha as string) || todayGT();
    const diaSemana = new Date(fecha + "T12:00:00Z").getDay();

    const { rows: clientes } = await pool.query(`
      SELECT
        c.id,
        c.nombre,
        c.nombre_comercial,
        COALESCE(cfs.cantidad_agentes, 0) AS fuerza_hoy
      FROM clients c
      LEFT JOIN custodia_fuerza_semanal cfs
        ON cfs.cliente_id = c.id AND cfs.dia_semana = $1
      WHERE c.tipo_servicio IN ('custodia', 'mixto')
        AND c.estado = 'activo'
      ORDER BY c.nombre
    `, [diaSemana]);

    const result = [];

    for (const cl of clientes) {
      // Titulares: unión de (1) puesto_titulares con tipo_puesto='custodia' y
      // (2) custodia_titulares (slots asignados desde Pizarrón Operativo).
      const { rows: titulares } = await pool.query(`
        SELECT DISTINCT ON (e.id)
          e.id AS employee_id,
          e.nombre_completo,
          e.empl_numero,
          e.estado_laboral
        FROM (
          SELECT pt.employee_id
          FROM puesto_titulares pt
          JOIN puestos_operativos po ON po.id = pt.puesto_id
          WHERE po.cliente_id = $1
            AND po.activo = TRUE
            AND pt.activo = TRUE
            AND COALESCE(po.tipo_puesto, 'fijo') = 'custodia'
          UNION
          SELECT ct.employee_id
          FROM custodia_titulares ct
          WHERE ct.cliente_id = $1 AND ct.activo = TRUE
        ) t
        JOIN employees e ON e.id = t.employee_id
      `, [cl.id]);

      const { rows: asignados } = await pool.query(`
        SELECT
          cad.employee_id,
          e.nombre_completo,
          e.empl_numero,
          e.estado_laboral,
          cad.notas
        FROM custodia_asignacion_diaria cad
        JOIN employees e ON e.id = cad.employee_id
        WHERE cad.cliente_id = $1 AND cad.fecha = $2::date
      `, [cl.id, fecha]);

      const titularIds = new Set(titulares.map((t: any) => t.employee_id));
      const asignadoIds = new Set(asignados.map((a: any) => a.employee_id));

      const titularesPresentes = asignados.filter((a: any) => titularIds.has(a.employee_id));
      const extras = asignados.filter((a: any) => !titularIds.has(a.employee_id));
      const titularesFaltantes = titulares.filter((t: any) => !asignadoIds.has(t.employee_id));

      result.push({
        clienteId: cl.id,
        clienteNombre: cl.nombre_comercial || cl.nombre,
        fuerzaHoy: Number(cl.fuerza_hoy),
        totalTitulares: titulares.length,
        titularesPresentes: titularesPresentes.length,
        titularesFaltantes: titularesFaltantes.map((t: any) => ({
          employeeId: t.employee_id,
          nombre: t.nombre_completo,
          codigo: t.empl_numero,
        })),
        extras: extras.map((e: any) => ({
          employeeId: e.employee_id,
          nombre: e.nombre_completo,
          codigo: e.empl_numero,
          notas: e.notas,
        })),
        totalAsignados: asignados.length,
        pendientes: Math.max(0, Number(cl.fuerza_hoy) - asignados.length),
        asignaciones: asignados.map((a: any) => ({
          employeeId: a.employee_id,
          nombre: a.nombre_completo,
          codigo: a.empl_numero,
          notas: a.notas,
          esTitular: titularIds.has(a.employee_id),
        })),
      });
    }

    res.json(result);
  } catch (err) {
    logger.error({ err }, "[Custodias/dashboard]");
    res.status(500).json({ error: "Error al cargar dashboard de custodias" });
  }
});

custodiasRouter.get("/custodias/cliente/:id/fuerza", async (req, res) => {
  try {
    const clienteId = parseInt(req.params.id);
    if (!clienteId) return res.status(400).json({ error: "ID inválido" });

    const { rows } = await pool.query(`
      SELECT dia_semana, cantidad_agentes
      FROM custodia_fuerza_semanal
      WHERE cliente_id = $1
      ORDER BY dia_semana
    `, [clienteId]);

    const fuerza: Record<number, number> = {};
    for (let i = 0; i <= 6; i++) fuerza[i] = 0;
    for (const r of rows) fuerza[r.dia_semana] = Number(r.cantidad_agentes);

    res.json({ clienteId, fuerza });
  } catch (err) {
    logger.error({ err }, "[Custodias/fuerza] GET");
    res.status(500).json({ error: "Error al cargar fuerza semanal" });
  }
});

custodiasRouter.put("/custodias/cliente/:id/fuerza", async (req, res) => {
  try {
    const clienteId = parseInt(req.params.id);
    if (!clienteId) return res.status(400).json({ error: "ID inválido" });

    const { fuerza } = req.body as { fuerza: Record<string, number> };
    if (!fuerza) return res.status(400).json({ error: "Falta campo 'fuerza'" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM custodia_fuerza_semanal WHERE cliente_id = $1", [clienteId]);
      for (const [dia, cantidad] of Object.entries(fuerza)) {
        const d = parseInt(dia);
        const c = parseInt(String(cantidad));
        if (d >= 0 && d <= 6 && c >= 0) {
          await client.query(
            `INSERT INTO custodia_fuerza_semanal (cliente_id, dia_semana, cantidad_agentes) VALUES ($1, $2, $3)`,
            [clienteId, d, c]
          );
        }
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[Custodias/fuerza] PUT");
    res.status(500).json({ error: "Error al guardar fuerza semanal" });
  }
});

custodiasRouter.get("/custodias/cliente/:id/asignacion", async (req, res) => {
  try {
    const clienteId = parseInt(req.params.id);
    const fecha = (req.query.fecha as string) || todayGT();
    if (!clienteId) return res.status(400).json({ error: "ID inválido" });

    const { rows } = await pool.query(`
      SELECT
        cad.id,
        cad.employee_id,
        e.nombre_completo,
        e.empl_numero,
        cad.notas,
        cad.created_at
      FROM custodia_asignacion_diaria cad
      JOIN employees e ON e.id = cad.employee_id
      WHERE cad.cliente_id = $1 AND cad.fecha = $2::date
      ORDER BY e.nombre_completo
    `, [clienteId, fecha]);

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "[Custodias/asignacion] GET");
    res.status(500).json({ error: "Error al cargar asignaciones" });
  }
});

custodiasRouter.post("/custodias/cliente/:id/asignar", async (req, res) => {
  const clienteId = parseInt(req.params.id);
  if (!clienteId) return res.status(400).json({ error: "ID inválido" });

  const { fecha, employeeId, notas } = req.body as {
    fecha: string;
    employeeId: number;
    notas?: string;
  };

  if (!fecha || !employeeId) {
    return res.status(400).json({ error: "Faltan campos requeridos (fecha, employeeId)" });
  }
  // Normalizar fecha a YYYY-MM-DD antes de usarla para el lock (evita locks distintos para misma fecha en formatos distintos).
  const fechaNorm = String(fecha).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNorm)) {
    return res.status(400).json({ error: "Formato de fecha inválido (esperado YYYY-MM-DD)" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Lock transaccional por (cliente, fecha) para evitar carreras al asignar slot.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`custodia:${clienteId}:${fechaNorm}`]);

    // ¿Ya está asignado? Si sí, solo actualizamos notas y devolvemos su slot.
    const existing = await client.query(
      `SELECT id, slot_numero FROM custodia_asignacion_diaria
        WHERE cliente_id = $1 AND fecha = $2::date AND employee_id = $3`,
      [clienteId, fecha, employeeId]
    );
    if (existing.rowCount && existing.rowCount > 0) {
      await client.query(
        `UPDATE custodia_asignacion_diaria SET notas = $1 WHERE id = $2`,
        [notas || null, existing.rows[0].id]
      );
      await client.query("COMMIT");
      return res.json({ ok: true, id: existing.rows[0].id, slot: existing.rows[0].slot_numero });
    }

    // Calcular siguiente slot libre para este (cliente, fecha).
    const maxQ = await client.query(
      `SELECT COALESCE(MAX(slot_numero), 0) + 1 AS next_slot
         FROM custodia_asignacion_diaria
        WHERE cliente_id = $1 AND fecha = $2::date`,
      [clienteId, fecha]
    );
    const nextSlot: number = maxQ.rows[0].next_slot;

    const ins = await client.query(
      `INSERT INTO custodia_asignacion_diaria (cliente_id, fecha, employee_id, slot_numero, notas)
       VALUES ($1, $2::date, $3, $4, $5)
       RETURNING id`,
      [clienteId, fecha, employeeId, nextSlot, notas || null]
    );
    await client.query("COMMIT");
    res.json({ ok: true, id: ins.rows[0].id, slot: nextSlot });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    logger.error({ err }, "[Custodias/asignar]");
    res.status(500).json({ error: "Error al asignar agente" });
  } finally {
    client.release();
  }
});

custodiasRouter.delete("/custodias/cliente/:id/desasignar", async (req, res) => {
  try {
    // ── Auth: solo Operaciones o Admin ───────────────────────────────────────
    const sessionRaw = req.headers["x-isp-session"];
    let userRole = "";
    try { userRole = JSON.parse(sessionRaw as string)?.rol ?? ""; } catch {}
    if (!["admin", "operaciones"].includes(userRole)) {
      return res.status(403).json({ error: "Solo Operaciones o administradores pueden quitar custodios" });
    }

    const clienteId = parseInt(req.params.id);
    if (!clienteId) return res.status(400).json({ error: "ID inválido" });

    const { fecha, employeeId } = req.body as { fecha: string; employeeId: number };
    if (!fecha || !employeeId) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }

    // ── No permitir quitar custodios de fechas pasadas ───────────────────────
    const hoy = todayGT();
    if (fecha < hoy) {
      return res.status(409).json({ error: "No se puede quitar un custodio de una fecha pasada" });
    }

    // ── DELETE atómico: solo si NO existe fichaje del custodio ese día ──────
    const { rowCount } = await pool.query(
      `DELETE FROM custodia_asignacion_diaria
        WHERE cliente_id = $1 AND fecha = $2::date AND employee_id = $3
          AND NOT EXISTS (
            SELECT 1 FROM agente_fichajes
             WHERE employee_id = $3 AND cliente_id = $1
               AND DATE(timestamp AT TIME ZONE 'America/Guatemala') = $2::date
          )`,
      [clienteId, fecha, employeeId]
    );

    if (rowCount === 0) {
      // Verificamos por qué no se borró: puede que la asignación no exista o que ya inició
      const { rows: existeRows } = await pool.query(
        `SELECT 1 FROM custodia_asignacion_diaria
          WHERE cliente_id = $1 AND fecha = $2::date AND employee_id = $3 LIMIT 1`,
        [clienteId, fecha, employeeId]
      );
      if (existeRows.length > 0) {
        return res.status(409).json({ error: "El custodio ya inició su servicio; no se puede quitar" });
      }
      return res.status(404).json({ error: "La asignación no existe" });
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[Custodias/desasignar]");
    res.status(500).json({ error: "Error al desasignar agente" });
  }
});

custodiasRouter.post("/custodias/cliente/:id/asignar-lote", async (req, res) => {
  try {
    const clienteId = parseInt(req.params.id);
    if (!clienteId) return res.status(400).json({ error: "ID inválido" });

    const { fecha, employeeIds } = req.body as { fecha: string; employeeIds: number[] };
    if (!fecha || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }
    const fechaNorm = String(fecha).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNorm)) {
      return res.status(400).json({ error: "Formato de fecha inválido (esperado YYYY-MM-DD)" });
    }

    const client = await pool.connect();
    let inserted = 0;
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`custodia:${clienteId}:${fechaNorm}`]);

      const maxQ = await client.query(
        `SELECT COALESCE(MAX(slot_numero), 0) AS max_slot
           FROM custodia_asignacion_diaria
          WHERE cliente_id = $1 AND fecha = $2::date`,
        [clienteId, fecha]
      );
      let nextSlot: number = Number(maxQ.rows[0].max_slot) + 1;

      for (const eid of employeeIds) {
        const exists = await client.query(
          `SELECT 1 FROM custodia_asignacion_diaria
            WHERE cliente_id = $1 AND fecha = $2::date AND employee_id = $3`,
          [clienteId, fecha, eid]
        );
        if (exists.rowCount && exists.rowCount > 0) continue;

        await client.query(
          `INSERT INTO custodia_asignacion_diaria (cliente_id, fecha, employee_id, slot_numero)
           VALUES ($1, $2::date, $3, $4)`,
          [clienteId, fecha, eid, nextSlot]
        );
        nextSlot++;
        inserted++;
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    res.json({ ok: true, count: inserted });
  } catch (err) {
    logger.error({ err }, "[Custodias/asignar-lote]");
    res.status(500).json({ error: "Error al asignar lote" });
  }
});

custodiasRouter.get("/custodias/cliente/:id/hoja-imprimible", async (req, res) => {
  try {
    const clienteId = parseInt(req.params.id);
    const fecha = (req.query.fecha as string) || todayGT();
    if (!clienteId) return res.status(400).json({ error: "ID inválido" });

    const { rows: clienteRows } = await pool.query(
      `SELECT nombre, nombre_comercial FROM clients WHERE id = $1`, [clienteId]
    );
    if (clienteRows.length === 0) return res.status(404).json({ error: "Cliente no encontrado" });

    const { rows } = await pool.query(`
      SELECT
        e.id AS employee_id,
        e.nombre_completo,
        e.empl_numero AS codigo_empleado,
        arm.marca AS arma_marca,
        arm.serie AS arma_serie,
        arm.tipo AS arma_tipo,
        COALESCE(pm.cantidad_actual, 0) AS municion
      FROM custodia_asignacion_diaria cad
      JOIN employees e ON e.id = cad.employee_id
      LEFT JOIN armas arm ON arm.empleado_id = e.id AND arm.activo = TRUE
      LEFT JOIN puesto_municion pm ON pm.arma_id = arm.id
      WHERE cad.cliente_id = $1 AND cad.fecha = $2::date
      ORDER BY e.nombre_completo
    `, [clienteId, fecha]);

    const cliente = clienteRows[0];

    res.json({
      clienteNombre: cliente.nombre_comercial || cliente.nombre,
      fecha,
      agentes: rows.map((r: any) => ({
        employeeId: r.employee_id,
        nombre: r.nombre_completo,
        codigoEmpleado: r.codigo_empleado,
        armaMarca: r.arma_marca || "",
        armaSerie: r.arma_serie || "",
        armaTipo: r.arma_tipo || "",
        municion: Number(r.municion),
      })),
    });
  } catch (err) {
    logger.error({ err }, "[Custodias/hoja-imprimible]");
    res.status(500).json({ error: "Error al generar hoja imprimible" });
  }
});

custodiasRouter.get("/custodias/pool-disponible", async (req, res) => {
  try {
    const fecha = (req.query.fecha as string) || todayGT();
    const clienteId = req.query.clienteId ? parseInt(req.query.clienteId as string) : null;

    const { rows } = await pool.query(`
      SELECT
        e.id,
        e.nombre_completo,
        e.empl_numero,
        e.estado_laboral,
        e.tipo_personal
      FROM employees e
      WHERE e.estado_laboral = 'activo'
        AND NOT EXISTS (
          SELECT 1 FROM custodia_asignacion_diaria cad2
          WHERE cad2.employee_id = e.id AND cad2.fecha = $1::date
            ${clienteId ? '' : ''}
        )
      ORDER BY e.nombre_completo
    `, [fecha]);

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "[Custodias/pool-disponible]");
    res.status(500).json({ error: "Error al cargar pool disponible" });
  }
});

export default custodiasRouter;
