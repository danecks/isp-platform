import { Router } from "express";
import { pool, todayGT } from "@workspace/db";
import { logger } from "../../lib/logger";
import { validarEmpleadoAsignable } from "../../lib/empleado-fecha-ingreso";

export const custodiasClienteRouter = Router();

custodiasClienteRouter.get("/custodias/cliente/:id/fuerza", async (req, res) => {
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

custodiasClienteRouter.put("/custodias/cliente/:id/fuerza", async (req, res) => {
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

custodiasClienteRouter.get("/custodias/cliente/:id/asignacion", async (req, res) => {
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

custodiasClienteRouter.post("/custodias/cliente/:id/asignar", async (req, res) => {
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

  // Bloqueo fecha_ingreso: el agente debe haber iniciado labores para esa fecha
  {
    const _v = await validarEmpleadoAsignable(pool, employeeId, fechaNorm);
    if (!_v.ok) return res.status(400).json({ error: _v.error });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Lock transaccional por (cliente, fecha) para evitar carreras al asignar slot.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`custodia:${clienteId}:${fechaNorm}`]);
    // Lock adicional por (agente, fecha) para serializar contra solicitudes de otros clientes
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`custodia-emp:${employeeId}:${fechaNorm}`]);

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

    // Validación 1: el agente NO puede estar asignado ya en otro slot/cliente esa fecha.
    const conflictAsig = await client.query(
      `SELECT cad.cliente_id, cad.slot_numero, c.nombre AS cliente_nombre
         FROM custodia_asignacion_diaria cad
         JOIN clients c ON c.id = cad.cliente_id
        WHERE cad.employee_id = $1 AND cad.fecha = $2::date
        LIMIT 1`,
      [employeeId, fechaNorm]
    );
    if (conflictAsig.rowCount && conflictAsig.rowCount > 0) {
      await client.query("ROLLBACK");
      const x = conflictAsig.rows[0];
      const empQ = await pool.query(`SELECT nombre_completo FROM employees WHERE id=$1`, [employeeId]);
      const nombre = empQ.rows[0]?.nombre_completo ?? `Agente #${employeeId}`;
      return res.status(409).json({
        error: `${nombre} ya está asignado al Custodio ${x.slot_numero} de "${x.cliente_nombre}" en esta fecha. Liberá ese slot primero.`
      });
    }

    // Validación 2: el agente NO puede ser titular activo de otro slot del MISMO cliente.
    const conflictTit = await client.query(
      `SELECT slot_numero FROM custodia_titulares
        WHERE employee_id = $1 AND cliente_id = $2 AND activo = TRUE
        ORDER BY slot_numero
        LIMIT 1`,
      [employeeId, clienteId]
    );
    if (conflictTit.rowCount && conflictTit.rowCount > 0) {
      await client.query("ROLLBACK");
      const empQ = await pool.query(`SELECT nombre_completo FROM employees WHERE id=$1`, [employeeId]);
      const nombre = empQ.rows[0]?.nombre_completo ?? `Agente #${employeeId}`;
      return res.status(409).json({
        error: `${nombre} es titular del Custodio ${conflictTit.rows[0].slot_numero} de este cliente. No puede ocupar otro Custodio del mismo cliente — asignalo a su slot titular.`
      });
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

custodiasClienteRouter.delete("/custodias/cliente/:id/desasignar", async (req, res) => {
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

custodiasClienteRouter.post("/custodias/cliente/:id/asignar-lote", async (req, res) => {
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
    const skipped: { employeeId: number; nombre: string; motivo: string }[] = [];
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`custodia:${clienteId}:${fechaNorm}`]);

      const maxQ = await client.query(
        `SELECT COALESCE(MAX(slot_numero), 0) AS max_slot
           FROM custodia_asignacion_diaria
          WHERE cliente_id = $1 AND fecha = $2::date`,
        [clienteId, fechaNorm]
      );
      let nextSlot: number = Number(maxQ.rows[0].max_slot) + 1;

      for (const eid of employeeIds) {
        // Lock por (agente, fecha) para serializar contra otros clientes
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`custodia-emp:${eid}:${fechaNorm}`]);

        // Bloqueo fecha_ingreso: si el agente aún no inicia, lo saltamos del lote (no aborta)
        const _vIng = await validarEmpleadoAsignable(client, eid, fechaNorm);
        if (!_vIng.ok) {
          skipped.push({ employeeId: eid, nombre: _vIng.nombre ?? `Agente #${eid}`, motivo: _vIng.error ?? "Aún no inicia labores." });
          continue;
        }

        // Idempotente: el agente ya está en este cliente esa fecha
        const exists = await client.query(
          `SELECT 1 FROM custodia_asignacion_diaria
            WHERE cliente_id = $1 AND fecha = $2::date AND employee_id = $3`,
          [clienteId, fechaNorm, eid]
        );
        if (exists.rowCount && exists.rowCount > 0) continue;

        // Conflicto 1: ya asignado en otro cliente/slot esa fecha
        const cAsig = await client.query(
          `SELECT cad.slot_numero, c.nombre AS cliente_nombre, e.nombre_completo
             FROM custodia_asignacion_diaria cad
             JOIN clients c ON c.id = cad.cliente_id
             JOIN employees e ON e.id = cad.employee_id
            WHERE cad.employee_id = $1 AND cad.fecha = $2::date
            LIMIT 1`,
          [eid, fechaNorm]
        );
        if (cAsig.rowCount && cAsig.rowCount > 0) {
          const x = cAsig.rows[0];
          skipped.push({ employeeId: eid, nombre: x.nombre_completo, motivo: `Ya asignado al Custodio ${x.slot_numero} de "${x.cliente_nombre}".` });
          continue;
        }

        // Conflicto 2: titular activo de otro slot del mismo cliente
        const cTit = await client.query(
          `SELECT ct.slot_numero, e.nombre_completo
             FROM custodia_titulares ct
             JOIN employees e ON e.id = ct.employee_id
            WHERE ct.employee_id = $1 AND ct.cliente_id = $2 AND ct.activo = TRUE
            ORDER BY ct.slot_numero
            LIMIT 1`,
          [eid, clienteId]
        );
        if (cTit.rowCount && cTit.rowCount > 0) {
          const x = cTit.rows[0];
          skipped.push({ employeeId: eid, nombre: x.nombre_completo, motivo: `Es titular del Custodio ${x.slot_numero} de este cliente.` });
          continue;
        }

        await client.query(
          `INSERT INTO custodia_asignacion_diaria (cliente_id, fecha, employee_id, slot_numero)
           VALUES ($1, $2::date, $3, $4)`,
          [clienteId, fechaNorm, eid, nextSlot]
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

    res.json({ ok: true, count: inserted, skipped });
  } catch (err) {
    logger.error({ err }, "[Custodias/asignar-lote]");
    res.status(500).json({ error: "Error al asignar lote" });
  }
});

// Asigna de un golpe a TODOS los titulares activos del cliente que no estén asignados ese día.
// Respeta la regla "un agente, un puesto a la vez": omite a quien ya esté en otro cliente esa fecha
// o cuyo slot ya esté ocupado por otro agente hoy. Devuelve { count, skipped[] }.
custodiasClienteRouter.post("/custodias/cliente/:id/asignar-titulares", async (req, res) => {
  try {
    const clienteId = parseInt(req.params.id);
    if (!clienteId) return res.status(400).json({ error: "ID inválido" });

    const { fecha } = req.body as { fecha: string };
    if (!fecha) return res.status(400).json({ error: "Falta fecha" });
    const fechaNorm = String(fecha).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaNorm)) {
      return res.status(400).json({ error: "Formato de fecha inválido (esperado YYYY-MM-DD)" });
    }

    const client = await pool.connect();
    let inserted = 0;
    const skipped: { employeeId: number; nombre: string; slot: number; motivo: string }[] = [];
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`custodia:${clienteId}:${fechaNorm}`]);

      // Lista de titulares activos pendientes (aún no asignados hoy en este cliente)
      const { rows: pendientes } = await client.query(
        `SELECT ct.employee_id, ct.slot_numero, e.nombre_completo
           FROM custodia_titulares ct
           JOIN employees e ON e.id = ct.employee_id
          WHERE ct.cliente_id = $1
            AND ct.activo = TRUE
            AND NOT EXISTS (
              SELECT 1 FROM custodia_asignacion_diaria cad
               WHERE cad.cliente_id = $1
                 AND cad.fecha = $2::date
                 AND cad.employee_id = ct.employee_id
            )
          ORDER BY ct.slot_numero`,
        [clienteId, fechaNorm]
      );

      for (const p of pendientes) {
        // Lock por (agente, fecha) para serializar contra otros clientes
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          [`custodia-emp:${p.employee_id}:${fechaNorm}`]
        );

        // Bloqueo fecha_ingreso: si el titular aún no inicia, lo saltamos
        const _vIngT = await validarEmpleadoAsignable(client, p.employee_id, fechaNorm);
        if (!_vIngT.ok) {
          skipped.push({
            employeeId: p.employee_id,
            nombre: _vIngT.nombre ?? p.nombre_completo,
            slot: p.slot_numero,
            motivo: _vIngT.error ?? "Aún no inicia labores.",
          });
          continue;
        }

        // ¿Ya está asignado en otro cliente esa fecha?
        const cAsig = await client.query(
          `SELECT cad.slot_numero, c.nombre AS cliente_nombre
             FROM custodia_asignacion_diaria cad
             JOIN clients c ON c.id = cad.cliente_id
            WHERE cad.employee_id = $1 AND cad.fecha = $2::date
            LIMIT 1`,
          [p.employee_id, fechaNorm]
        );
        if (cAsig.rowCount && cAsig.rowCount > 0) {
          const x = cAsig.rows[0];
          skipped.push({
            employeeId: p.employee_id,
            nombre: p.nombre_completo,
            slot: p.slot_numero,
            motivo: `Ya asignado al Custodio ${x.slot_numero} de "${x.cliente_nombre}".`,
          });
          continue;
        }

        // ¿El slot ya está ocupado por otro agente hoy en este cliente?
        const cSlot = await client.query(
          `SELECT employee_id FROM custodia_asignacion_diaria
            WHERE cliente_id = $1 AND fecha = $2::date AND slot_numero = $3
            LIMIT 1`,
          [clienteId, fechaNorm, p.slot_numero]
        );
        if (cSlot.rowCount && cSlot.rowCount > 0) {
          skipped.push({
            employeeId: p.employee_id,
            nombre: p.nombre_completo,
            slot: p.slot_numero,
            motivo: `El Custodio ${p.slot_numero} ya está ocupado por otro agente hoy.`,
          });
          continue;
        }

        await client.query(
          `INSERT INTO custodia_asignacion_diaria (cliente_id, fecha, employee_id, slot_numero)
           VALUES ($1, $2::date, $3, $4)`,
          [clienteId, fechaNorm, p.employee_id, p.slot_numero]
        );
        inserted++;
      }

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    res.json({ ok: true, count: inserted, skipped });
  } catch (err) {
    logger.error({ err }, "[Custodias/asignar-titulares]");
    res.status(500).json({ error: "Error al asignar titulares" });
  }
});

custodiasClienteRouter.get("/custodias/cliente/:id/hoja-imprimible", async (req, res) => {
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
        cad.ruta_texto,
        to_char(cad.hora_salida,  'HH24:MI') AS hora_salida,
        to_char(cad.hora_regreso, 'HH24:MI') AS hora_regreso,
        COALESCE(pm.cantidad_asignada, 0) AS municion
      FROM custodia_asignacion_diaria cad
      JOIN employees e ON e.id = cad.employee_id
      LEFT JOIN arma_custodia ac
             ON ac.employee_id = e.id
            AND ac.fecha_fin IS NULL
      LEFT JOIN armas arm
             ON arm.id = ac.arma_id
            AND arm.activo = TRUE
      LEFT JOIN puesto_municion pm
             ON pm.puesto_id = arm.puesto_id
            AND pm.activo = TRUE
      WHERE cad.cliente_id = $1 AND cad.fecha = $2::date
        -- Excluir custodios con boleta de falta registrada hoy: si el agente
        -- asignado tiene una 'falta' vigente en eventos_rrhh para esta fecha,
        -- no debe imprimirse en la hoja de ruta (mismo cruce que el pizarrón).
        AND NOT EXISTS (
          SELECT 1 FROM eventos_rrhh er
          WHERE er.employee_id = cad.employee_id
            AND er.tipo_evento = 'falta'
            AND er.fecha::date = $2::date
            AND er.estado NOT IN ('anulado', 'cancelado')
        )
      ORDER BY cad.slot_numero, e.nombre_completo
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
        ruta: r.ruta_texto || "",
        horaSalida: r.hora_salida || "",
        horaRegreso: r.hora_regreso || "",
        municion: Number(r.municion),
      })),
    });
  } catch (err) {
    logger.error({ err }, "[Custodias/hoja-imprimible]");
    res.status(500).json({ error: "Error al generar hoja imprimible" });
  }
});
