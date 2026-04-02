import { Router } from "express";
import { pool } from "@workspace/db";
import { calcularEstadoCiclo } from "../lib/turno-calc";

export const armeriaRouter = Router();

// ── Función: quién está trabajando el puesto X en la fecha dada ──────────────
// Prioridad: 1) planificacion_futura (relevo del día) 2) titular (si no descansa)
async function calcularResponsablePuesto(puestoId: number, fecha: string): Promise<{
  id: number; nombre_completo: string; tipo_personal: string; tipo_origen: string;
} | null> {
  // 1. Relevo planificado para ese día
  const { rows: pfRows } = await pool.query(`
    SELECT
      pf.relevo_id        AS employee_id,
      e.nombre_completo,
      e.tipo_personal,
      pf.tipo_cobertura_futura AS tipo_origen
    FROM planificacion_futura pf
    JOIN employees e ON e.id = pf.relevo_id
    WHERE pf.puesto_id = $1
      AND pf.fecha = $2
      AND pf.relevo_id IS NOT NULL
      AND e.estado_laboral = 'activo'
    ORDER BY pf.created_at DESC
    LIMIT 1
  `, [puestoId, fecha]);

  if (pfRows[0]) {
    return {
      id:              pfRows[0].employee_id,
      nombre_completo: pfRows[0].nombre_completo,
      tipo_personal:   pfRows[0].tipo_personal ?? "",
      tipo_origen:     pfRows[0].tipo_origen ?? "relevo",
    };
  }

  // 2. Titular del puesto con motor de ciclos
  const { rows: poRows } = await pool.query(`
    SELECT
      po.agente_id,
      e.nombre_completo,
      e.tipo_personal,
      t.id             AS tipo_turno_id,
      t.nombre         AS turno_nombre,
      t.tipo_ciclo,
      t.horas_trabajo,
      t.horas_descanso,
      po.fecha_inicio_ciclo
    FROM puestos_operativos po
    JOIN employees e ON e.id = po.agente_id
    LEFT JOIN turnos t ON t.id = po.tipo_turno_id
    WHERE po.id = $1
      AND po.agente_id IS NOT NULL
      AND e.estado_laboral = 'activo'
  `, [puestoId]);

  if (!poRows[0]) return null;
  const po = poRows[0];

  if (!po.tipo_ciclo || !po.horas_trabajo || !po.fecha_inicio_ciclo) {
    return { id: po.agente_id, nombre_completo: po.nombre_completo, tipo_personal: po.tipo_personal ?? "", tipo_origen: "turno_normal" };
  }

  const turno = {
    id:             po.tipo_turno_id ?? 0,
    nombre:         po.turno_nombre ?? "",
    tipo_ciclo:     po.tipo_ciclo,
    horas_trabajo:  Number(po.horas_trabajo),
    horas_descanso: Number(po.horas_descanso ?? po.horas_trabajo),
  };
  const fechaStr = po.fecha_inicio_ciclo instanceof Date
    ? po.fecha_inicio_ciclo.toISOString().slice(0, 10)
    : String(po.fecha_inicio_ciclo).slice(0, 10);

  const estado = calcularEstadoCiclo(turno, fechaStr, fecha);
  if (estado.trabaja) {
    return { id: po.agente_id, nombre_completo: po.nombre_completo, tipo_personal: po.tipo_personal ?? "", tipo_origen: "turno_normal" };
  }

  return null; // Titular descansa, sin relevo planificado
}

// ── Función: sincronizar custodia de un arma con el agente de turno ───────────
async function syncCustodiaArma(armaId: number, fecha: string, usuario: string): Promise<any> {
  const { rows: aRows } = await pool.query(
    `SELECT id, codigo, puesto_id FROM armas WHERE id=$1`, [armaId]
  );
  if (!aRows[0]) return { cambio: false, motivo: "Arma no encontrada" };
  const puesto_id = aRows[0].puesto_id;
  if (!puesto_id) return { cambio: false, codigo: aRows[0].codigo, motivo: "Sin puesto asignado" };

  const responsable = await calcularResponsablePuesto(puesto_id, fecha);

  const { rows: custodiaRows } = await pool.query(
    `SELECT id, employee_id FROM arma_custodia WHERE arma_id=$1 AND fecha_fin IS NULL`,
    [armaId]
  );
  const custodiaActual = custodiaRows[0] ?? null;

  const mismoResponsable = custodiaActual && responsable
    && Number(custodiaActual.employee_id) === Number(responsable.id);

  if (mismoResponsable) {
    return {
      cambio: false, codigo: aRows[0].codigo,
      motivo: "El responsable de turno ya coincide con la custodia actual",
      responsable_actual: { id: responsable.id, nombre: responsable.nombre_completo },
    };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (custodiaActual) {
      await client.query(
        `UPDATE arma_custodia SET fecha_fin=NOW() WHERE id=$1`,
        [custodiaActual.id]
      );
    }
    let nuevaCustodia: any = null;
    if (responsable) {
      const { rows: nc } = await client.query(`
        INSERT INTO arma_custodia
          (arma_id, employee_id, puesto_id, tipo_origen, notas, registrado_por)
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *
      `, [
        armaId, responsable.id, puesto_id,
        responsable.tipo_origen ?? "automatico_turno",
        `Custodia automática por turno — ${fecha}`,
        usuario,
      ]);
      nuevaCustodia = nc[0];
    }
    await client.query("COMMIT");
    return {
      cambio: true, codigo: aRows[0].codigo,
      responsable_nuevo: responsable
        ? { id: responsable.id, nombre: responsable.nombre_completo, tipo_origen: responsable.tipo_origen }
        : null,
      sin_responsable: !responsable,
      nueva_custodia: nuevaCustodia,
    };
  } catch (e: any) {
    await client.query("ROLLBACK").catch(() => {});
    return { cambio: false, codigo: aRows[0].codigo, error: e.message };
  } finally {
    client.release();
  }
}

// ── GET /api/armas ─────────────────────────────────────────────────────────────
armeriaRouter.get("/armas", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        a.id, a.codigo, a.tipo, a.marca, a.modelo, a.calibre, a.serie,
        a.estado, a.activo, a.observaciones,
        a.puesto_id,
        po.nombre   AS puesto_nombre,
        po.agente_id AS titular_id,
        te.nombre_completo AS titular_nombre,
        po.cliente_nombre,
        -- Custodio actual registrado
        ac.id           AS custodia_id,
        ac.employee_id  AS custodio_id,
        ce.nombre_completo AS custodio_nombre,
        ce.tipo_personal   AS custodio_tipo,
        ac.fecha_inicio    AS custodia_desde,
        ac.tipo_origen     AS custodia_tipo_origen,
        a.created_at, a.updated_at
      FROM armas a
      LEFT JOIN puestos_operativos po ON po.id = a.puesto_id
      LEFT JOIN employees te          ON te.id = po.agente_id
      LEFT JOIN arma_custodia ac      ON ac.arma_id = a.id AND ac.fecha_fin IS NULL
      LEFT JOIN employees ce          ON ce.id = ac.employee_id
      ORDER BY a.activo DESC, a.codigo
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/armas/estado-operativo ───────────────────────────────────────────
// Devuelve armas agrupadas por puesto con responsable de turno calculado.
armeriaRouter.get("/armas/estado-operativo", async (req, res) => {
  const fecha = (req.query.fecha as string) || new Date().toISOString().slice(0, 10);
  try {
    // Puestos con arma asignada + agente titular + turno
    const { rows } = await pool.query(`
      SELECT
        a.id   AS arma_id,
        a.codigo, a.tipo, a.marca, a.modelo, a.calibre, a.estado AS arma_estado,
        a.puesto_id,
        po.nombre      AS puesto_nombre,
        po.cliente_nombre,
        po.zona_operativa_id,
        oz.nombre      AS zona_nombre,
        po.agente_id   AS titular_id,
        te.nombre_completo AS titular_nombre,
        te.tipo_personal   AS titular_tipo,
        po.tipo_turno_id,
        t.nombre       AS turno_nombre,
        t.tipo_ciclo,
        t.horas_trabajo,
        t.horas_descanso,
        po.fecha_inicio_ciclo,
        -- Custodio actual registrado en arma_custodia
        ac.id          AS custodia_id,
        ce.id          AS custodio_id,
        ce.nombre_completo AS custodio_nombre,
        ce.tipo_personal   AS custodio_tipo,
        ac.fecha_inicio    AS custodia_desde,
        ac.tipo_origen     AS custodia_tipo_origen
      FROM armas a
      LEFT JOIN puestos_operativos po ON po.id = a.puesto_id
      LEFT JOIN employees te     ON te.id = po.agente_id
      LEFT JOIN turnos t         ON t.id  = po.tipo_turno_id
      LEFT JOIN operational_zones oz ON oz.id = po.zona_operativa_id
      LEFT JOIN arma_custodia ac ON ac.arma_id = a.id AND ac.fecha_fin IS NULL
      LEFT JOIN employees ce     ON ce.id = ac.employee_id
      WHERE a.activo = TRUE
      ORDER BY po.cliente_nombre, po.nombre, a.codigo
    `);

    // Para cada arma, calcular responsable de turno usando motor de ciclos + planificacion_futura
    // Hacemos la consulta de planificacion_futura una sola vez para todas las fechas
    const puestoIds = [...new Set(rows.map((r: any) => r.puesto_id).filter(Boolean))];

    const { rows: pfRows } = await pool.query(`
      SELECT
        pf.puesto_id,
        pf.relevo_id        AS employee_id,
        e.nombre_completo,
        e.tipo_personal,
        pf.tipo_cobertura_futura AS tipo_origen
      FROM planificacion_futura pf
      JOIN employees e ON e.id = pf.relevo_id
      WHERE pf.puesto_id = ANY($1::int[])
        AND pf.fecha = $2
        AND pf.relevo_id IS NOT NULL
        AND e.estado_laboral = 'activo'
      ORDER BY pf.created_at DESC
    `, [puestoIds, fecha]);

    const relevoPorPuesto: Record<number, any> = {};
    for (const pf of pfRows) {
      if (!relevoPorPuesto[pf.puesto_id]) relevoPorPuesto[pf.puesto_id] = pf;
    }

    const rowsEnriquecidos = rows.map((row: any) => {
      // Si hay relevo planificado hoy para este puesto, ese es el responsable
      const relevo = relevoPorPuesto[row.puesto_id] ?? null;
      if (relevo) {
        return {
          ...row,
          responsable_turno: {
            id: relevo.employee_id,
            nombre_completo: relevo.nombre_completo,
            tipo_personal: relevo.tipo_personal ?? "",
            tipo_origen: relevo.tipo_origen ?? "relevo",
          },
          descanso_por_ciclo: false,
        };
      }

      // Si no hay relevo, verificar si el titular trabaja hoy
      let responsable_turno: any = null;
      let descanso_por_ciclo = false;

      if (row.titular_id) {
        if (row.tipo_ciclo && row.horas_trabajo && row.fecha_inicio_ciclo) {
          const turno = {
            id:             row.tipo_turno_id ?? 0,
            nombre:         row.turno_nombre ?? "",
            tipo_ciclo:     row.tipo_ciclo,
            horas_trabajo:  Number(row.horas_trabajo),
            horas_descanso: Number(row.horas_descanso ?? row.horas_trabajo),
          };
          const fechaStr = row.fecha_inicio_ciclo instanceof Date
            ? row.fecha_inicio_ciclo.toISOString().slice(0, 10)
            : String(row.fecha_inicio_ciclo).slice(0, 10);
          const estado = calcularEstadoCiclo(turno, fechaStr, fecha);
          descanso_por_ciclo = estado.descansoPorCiclo ?? !estado.trabaja;
          if (estado.trabaja) {
            responsable_turno = {
              id: row.titular_id, nombre_completo: row.titular_nombre,
              tipo_personal: row.titular_tipo ?? "", tipo_origen: "turno_normal",
            };
          }
        } else {
          // Sin info de turno → asumir que trabaja
          responsable_turno = {
            id: row.titular_id, nombre_completo: row.titular_nombre,
            tipo_personal: row.titular_tipo ?? "", tipo_origen: "turno_normal",
          };
        }
      }

      return { ...row, responsable_turno, descanso_por_ciclo };
    });

    res.json(rowsEnriquecidos);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/armas/historial/global ───────────────────────────────────────────
armeriaRouter.get("/armas/historial/global", async (req, res) => {
  const { limite = "100", arma_id, employee_id } = req.query as any;
  try {
    const conds: string[] = [];
    const params: any[] = [];
    if (arma_id)    { conds.push(`ac.arma_id = $${params.length + 1}`);    params.push(arma_id); }
    if (employee_id){ conds.push(`ac.employee_id = $${params.length + 1}`); params.push(employee_id); }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    params.push(Math.min(Number(limite), 500));
    const { rows } = await pool.query(`
      SELECT
        ac.*,
        a.codigo, a.tipo, a.marca, a.modelo, a.calibre,
        e.nombre_completo AS custodio_nombre,
        e.tipo_personal   AS custodio_tipo,
        po.nombre         AS puesto_nombre,
        po.cliente_nombre
      FROM arma_custodia ac
      LEFT JOIN armas a              ON a.id = ac.arma_id
      LEFT JOIN employees e          ON e.id = ac.employee_id
      LEFT JOIN puestos_operativos po ON po.id = ac.puesto_id
      ${where}
      ORDER BY ac.fecha_inicio DESC
      LIMIT $${params.length}
    `, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/armas/:id ────────────────────────────────────────────────────────
armeriaRouter.get("/armas/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rows } = await pool.query(`
      SELECT
        a.*, po.nombre AS puesto_nombre, po.cliente_nombre,
        ac.id AS custodia_id, ac.employee_id AS custodio_id,
        e.nombre_completo AS custodio_nombre,
        ac.fecha_inicio AS custodia_desde, ac.tipo_origen AS custodia_tipo_origen
      FROM armas a
      LEFT JOIN puestos_operativos po ON po.id = a.puesto_id
      LEFT JOIN arma_custodia ac      ON ac.arma_id = a.id AND ac.fecha_fin IS NULL
      LEFT JOIN employees e           ON e.id = ac.employee_id
      WHERE a.id = $1
    `, [id]);
    if (!rows[0]) return res.status(404).json({ error: "Arma no encontrada" });
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/armas/:id/custodia ───────────────────────────────────────────────
armeriaRouter.get("/armas/:id/custodia", async (req, res) => {
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
// Lista puestos activos con agente asignado para el selector del formulario
armeriaRouter.get("/armas/puestos/disponibles", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        po.id,
        po.nombre,
        po.cliente_nombre,
        po.agente_id,
        e.nombre_completo AS agente_nombre,
        oz.nombre AS zona_nombre
      FROM puestos_operativos po
      LEFT JOIN employees e        ON e.id  = po.agente_id
      LEFT JOIN operational_zones oz ON oz.id = po.zona_operativa_id
      WHERE po.activo = TRUE
      ORDER BY po.cliente_nombre, po.nombre
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/armas ───────────────────────────────────────────────────────────
armeriaRouter.post("/armas", async (req, res) => {
  const { codigo, tipo, marca, modelo, calibre, serie, estado, activo, puesto_id, observaciones, usuario } = req.body;
  if (!codigo || !tipo) return res.status(400).json({ error: "codigo y tipo son requeridos" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`
      INSERT INTO armas (codigo, tipo, marca, modelo, calibre, serie, estado, activo, puesto_id, observaciones)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [
      codigo.toUpperCase().trim(), tipo,
      marca || null, modelo || null, calibre || null, serie || null,
      estado ?? "activo", activo !== false,
      puesto_id ? Number(puesto_id) : null,
      observaciones || null,
    ]);
    const arma = rows[0];

    // Si tiene puesto, calcular responsable actual y crear custodia inicial
    if (arma.puesto_id) {
      const fecha = new Date().toISOString().slice(0, 10);
      const responsable = await calcularResponsablePuesto(arma.puesto_id, fecha);
      if (responsable) {
        await client.query(`
          INSERT INTO arma_custodia (arma_id, employee_id, puesto_id, tipo_origen, notas, registrado_por)
          VALUES ($1,$2,$3,'turno_normal','Custodia inicial al registrar arma',$4)
        `, [arma.id, responsable.id, arma.puesto_id, usuario ?? "sistema"]);
      }
    }

    await client.query("COMMIT");
    res.status(201).json(arma);
  } catch (err: any) {
    await client.query("ROLLBACK");
    if (err.code === "23505") return res.status(409).json({ error: `Código ${codigo} ya está registrado` });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── PATCH /api/armas/:id ──────────────────────────────────────────────────────
armeriaRouter.patch("/armas/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { codigo, tipo, marca, modelo, calibre, serie, estado, activo, puesto_id, observaciones, usuario } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: prevRows } = await client.query(`SELECT puesto_id FROM armas WHERE id=$1`, [id]);
    if (!prevRows[0]) { await client.query("ROLLBACK"); return res.status(404).json({ error: "No encontrada" }); }
    const puestoAnterior = prevRows[0].puesto_id;
    const puestoNuevo = puesto_id !== undefined ? (puesto_id ? Number(puesto_id) : null) : puestoAnterior;

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
        observaciones = COALESCE($10, observaciones),
        updated_at    = NOW()
      WHERE id = $11
      RETURNING *
    `, [
      codigo ? codigo.toUpperCase().trim() : null,
      tipo ?? null, marca ?? null, modelo ?? null, calibre ?? null, serie ?? null,
      estado ?? null, activo !== undefined ? activo : null,
      puestoNuevo, observaciones ?? null, id,
    ]);

    // Si cambió el puesto, sincronizar custodia automáticamente
    if (puestoNuevo !== puestoAnterior) {
      await client.query(
        `UPDATE arma_custodia SET fecha_fin=NOW() WHERE arma_id=$1 AND fecha_fin IS NULL`, [id]
      );
      if (puestoNuevo) {
        const fecha = new Date().toISOString().slice(0, 10);
        const responsable = await calcularResponsablePuesto(puestoNuevo, fecha);
        if (responsable) {
          await client.query(`
            INSERT INTO arma_custodia (arma_id, employee_id, puesto_id, tipo_origen, notas, registrado_por)
            VALUES ($1,$2,$3,'turno_normal','Reasignación de puesto',$4)
          `, [id, responsable.id, puestoNuevo, usuario ?? "sistema"]);
        }
      }
    }

    await client.query("COMMIT");
    res.json(rows[0]);
  } catch (err: any) {
    await client.query("ROLLBACK");
    if (err.code === "23505") return res.status(409).json({ error: "Código duplicado" });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── POST /api/armas/:id/sync-custodia ─────────────────────────────────────────
armeriaRouter.post("/armas/:id/sync-custodia", async (req, res) => {
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
armeriaRouter.post("/armas/sync-custodias", async (req, res) => {
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
armeriaRouter.post("/armas/:id/relevo", async (req, res) => {
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
