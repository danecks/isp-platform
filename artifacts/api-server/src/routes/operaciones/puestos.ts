import { Router } from "express";
import { pool, todayGT } from "@workspace/db";
import { logger } from "../../lib/logger";
import { puestoEstadoCoberturaSql } from "../../lib/cobertura-puesto";

import { calcularEstadoCiclo } from "../../lib/turno-calc";
import {
  liberarTitularidadAgente,
  lockTitularidadAgente,
} from "./_helpers/titularidad";

import { validarEmpleadoAsignable } from "../../lib/empleado-fecha-ingreso";
import { normalizarFechaALunesString } from "../../lib/fecha-lunes";

const router = Router();

router.post("/operaciones/puestos/:id/titular", async (req, res) => {
  const { titularEmployeeId, usuario } = req.body;
  const puestoId = req.params.id;

  try {
    const { rows: puestoRows } = await pool.query(`SELECT * FROM puestos_operativos WHERE id=$1`, [puestoId]);
    if (!puestoRows.length) return res.status(404).json({ error: "Puesto no encontrado" });

    if (!titularEmployeeId) {
      // Quitar titular
      await pool.query(
        `UPDATE puestos_operativos SET titular_employee_id=NULL, titular_nombre=NULL, updated_at=NOW() WHERE id=$1`,
        [puestoId]
      );
      return res.json({ ok: true, mensaje: "Titular removido" });
    }

    // Bloqueo fecha_ingreso: el titular debe haber iniciado labores (validado contra hoy)
    {
      const _v = await validarEmpleadoAsignable(pool, titularEmployeeId, todayGT());
      if (!_v.ok) return res.status(400).json({ error: _v.error });
    }

    const { rows: empRows } = await pool.query(`SELECT * FROM employees WHERE id=$1`, [titularEmployeeId]);
    if (!empRows.length) return res.status(404).json({ error: "Colaborador no encontrado" });
    const emp = empRows[0];
    const puesto = puestoRows[0];

    // Modo estricto: liberar titularidad previa del agente + setear titular en UNA tx con lock
    const txT = await pool.connect();
    try {
      await txT.query("BEGIN");
      await lockTitularidadAgente(txT, Number(titularEmployeeId));
      const _libT = await liberarTitularidadAgente(txT, Number(titularEmployeeId), {
        puestoId: Number(puestoId),
      });
      if (_libT.puestos.length > 0 || _libT.custodias.length > 0) {
        logger.info({ titularEmployeeId, puestoDestino: puestoId, liberado: _libT },
          "POST /puestos/:id/titular: titularidad previa liberada automáticamente");
      }
      await txT.query(
        `UPDATE puestos_operativos SET titular_employee_id=$1, titular_nombre=$2, updated_at=NOW() WHERE id=$3`,
        [titularEmployeeId, emp.nombre_completo, puestoId]
      );
      if (!puesto.agente_id) {
        await txT.query(
          `UPDATE puestos_operativos SET agente_id=$1, agente_nombre=$2, updated_at=NOW() WHERE id=$3`,
          [titularEmployeeId, emp.nombre_completo, puestoId]
        );
      }
      await txT.query("COMMIT");
    } catch (e) {
      await txT.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      txT.release();
    }

    res.json({ ok: true, mensaje: `${emp.nombre_completo} definido como titular de ${puestoRows[0].nombre}` });
  } catch (err) {
    logger.error({ err }, "POST /operaciones/puestos/:id/titular error");
    res.status(500).json({ error: "Error al definir titular" });
  }
});

// Quita la titularidad de un colaborador en un puesto operativo (puesto fijo).
// Reglas:
//   - Solo rol "admin" u "operaciones".
//   - Cierra puesto_titular_historico (fecha_fin = hoy GT).
//   - Marca puesto_titulares.activo = FALSE.
//   - Limpia titular/agente y libera el slot del puesto.
//   - Mueve EOA del colaborador a "disponible".

router.post("/operaciones/quitar-titularidad", async (req, res) => {
  const sessionRaw = req.headers["x-isp-session"];
  let userRole = "";
  try { userRole = JSON.parse(sessionRaw as string)?.rol ?? ""; } catch {}
  if (!["admin", "operaciones"].includes(userRole)) {
    return res.status(403).json({ error: "Solo Operaciones o administradores pueden quitar la titularidad" });
  }

  const { puestoId, employeeId, motivo, usuario } = req.body as {
    puestoId: number; employeeId: number; motivo?: string; usuario?: string;
  };
  if (!puestoId || !employeeId) {
    return res.status(400).json({ error: "puestoId y employeeId son requeridos" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: puestoRows } = await client.query(
      `SELECT id, nombre, cliente_nombre, titular_employee_id, agente_id
         FROM puestos_operativos WHERE id = $1 FOR UPDATE`,
      [puestoId]
    );
    if (!puestoRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Puesto no encontrado" });
    }
    const puesto = puestoRows[0];

    // Validar que el empleado sea titular en CUALQUIERA de las 3 fuentes que
    // el pizarrón considera para mostrar titularidad (ver query del GET tablero):
    //   A) puesto_slots.empleado_id (sistema nuevo, multi-titular 24x24)
    //   B) puesto_titulares (sistema intermedio)
    //   C) puestos_operativos.titular_employee_id (legacy single-titular)
    // Bug PIZ-LIB-02: antes solo se validaban B y C, lo que rompía cuando el
    // titular venía de puesto_slots → "El colaborador no es titular activo".
    const { rows: ptRows } = await client.query(
      `SELECT id FROM puesto_titulares
        WHERE puesto_id = $1 AND employee_id = $2 AND activo = TRUE`,
      [puestoId, employeeId]
    );
    const { rows: psRows } = await client.query(
      `SELECT id FROM puesto_slots
        WHERE puesto_id = $1 AND empleado_id = $2 AND activo = TRUE`,
      [puestoId, employeeId]
    );
    const esTitularLegacy = puesto.titular_employee_id === employeeId;
    if (ptRows.length === 0 && psRows.length === 0 && !esTitularLegacy) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "El colaborador no es titular activo de este puesto" });
    }

    const { rows: empRows } = await client.query(
      `SELECT nombre_completo FROM employees WHERE id = $1`, [employeeId]
    );
    const empNombre = empRows[0]?.nombre_completo ?? "";
    const hoy = todayGT();

    // 1) Cerrar histórico de titularidad
    await client.query(
      `UPDATE puesto_titular_historico
          SET fecha_fin = $1, motivo = COALESCE(motivo, $2), updated_at = NOW()
        WHERE puesto_id = $3 AND employee_id = $4 AND fecha_fin IS NULL`,
      [hoy, motivo || "Quitado de titularidad", puestoId, employeeId]
    );

    // 2) Marcar puesto_titulares como inactivo
    await client.query(
      `UPDATE puesto_titulares
          SET activo = FALSE, updated_at = NOW()
        WHERE puesto_id = $1 AND employee_id = $2`,
      [puestoId, employeeId]
    );

    // 3) Liberar slot ocupado por el empleado
    await client.query(
      `UPDATE puesto_slots SET empleado_id = NULL
        WHERE puesto_id = $1 AND empleado_id = $2`,
      [puestoId, employeeId]
    );

    // 4) Limpiar titular/agente del puesto si coinciden
    if (puesto.titular_employee_id === employeeId) {
      await client.query(
        `UPDATE puestos_operativos
            SET titular_employee_id = NULL, titular_nombre = NULL, updated_at = NOW()
          WHERE id = $1`,
        [puestoId]
      );
    }
    if (puesto.agente_id === employeeId) {
      await client.query(
        `UPDATE puestos_operativos
            SET agente_id = NULL, agente_nombre = NULL, updated_at = NOW()
          WHERE id = $1`,
        [puestoId]
      );
    }

    // 5) Desactivar EOA del empleado para este puesto y crear "disponible"
    await client.query(
      `UPDATE employee_operational_assignments
          SET activa = FALSE, updated_at = NOW()
        WHERE employee_id = $1 AND activa = TRUE`,
      [employeeId]
    );
    await client.query(
      `INSERT INTO employee_operational_assignments
         (employee_id, puesto_id, sede_id, cliente_id, zona_operativa_id, tipo_turno_id,
          tipo_asignacion, activa, fecha_inicio, notas, created_at, updated_at)
       VALUES ($1, NULL, NULL, NULL, NULL, NULL, 'disponible', TRUE, NOW(),
               'Quitado de titularidad desde pizarrón', NOW(), NOW())`,
      [employeeId]
    );

    // 6) Registrar movimiento operativo
    await client.query(
      `INSERT INTO movimientos_operativos
         (puesto_id, cliente_nombre, puesto_nombre, agente_saliente_id, agente_saliente_nombre,
          tipo, usuario_cambio, notas)
       VALUES ($1, $2, $3, $4, $5, 'quitar_titularidad', $6, $7)`,
      [puestoId, puesto.cliente_nombre, puesto.nombre, employeeId, empNombre,
       usuario || 'sistema', motivo || null]
    );

    await client.query("COMMIT");
    return res.json({ ok: true, mensaje: `${empNombre} ya no es titular de ${puesto.nombre}` });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "POST /operaciones/quitar-titularidad error");
    return res.status(500).json({ error: "Error al quitar titularidad" });
  } finally {
    client.release();
  }
});

// ─── PATCH /api/operaciones/puestos/:id ──────────────────────────────────────

router.patch("/operaciones/puestos/:id", async (req, res) => {
  const { horario, jornada, sedeId, notas, turno, zonaOperativaId, tipoPuesto } = req.body;

  // P-03: rechazar body vacío para evitar UPDATE sin efecto
  if ([horario, jornada, sedeId, notas, turno, zonaOperativaId, tipoPuesto].every(v => v === undefined || v === null)) {
    return res.status(400).json({ error: "Debe proporcionar al menos un campo para actualizar (horario, jornada, sedeId, notas, turno, zonaOperativaId, tipoPuesto)" });
  }

  // Zona no puede quitarse una vez asignada — es parte estructural del modelo
  if (zonaOperativaId === null) {
    return res.status(400).json({ error: "El puesto debe tener una zona operativa asignada" });
  }

  // Validar tipo_puesto si viene
  if (tipoPuesto !== undefined && !['normal', 'custodia'].includes(tipoPuesto)) {
    return res.status(400).json({ error: "tipoPuesto debe ser 'normal' o 'custodia'" });
  }

  try {
    // Si se actualiza zona, verificar que exista
    if (zonaOperativaId !== undefined) {
      const { rows: zonaRows } = await pool.query(
        `SELECT id FROM operational_zones WHERE id = $1`, [zonaOperativaId]
      );
      if (!zonaRows.length) {
        return res.status(400).json({ error: `La zona operativa con id=${zonaOperativaId} no existe` });
      }
    }

    const { rows } = await pool.query(
      `UPDATE puestos_operativos
       SET horario             = COALESCE($1, horario),
           jornada             = COALESCE($2, jornada),
           sede_id             = COALESCE($3, sede_id),
           notas               = COALESCE($4, notas),
           turno               = COALESCE($5, turno),
           zona_operativa_id   = COALESCE($6, zona_operativa_id),
           tipo_puesto         = COALESCE($7, tipo_puesto),
           updated_at          = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        horario ?? null, jornada ?? null, sedeId ?? null, notas ?? null,
        turno ?? null, zonaOperativaId ?? null, tipoPuesto ?? null, req.params.id,
      ]
    );
    if (!rows.length) return res.status(404).json({ error: "Puesto no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /operaciones/puestos/:id error");
    res.status(500).json({ error: "Error al actualizar puesto" });
  }
});

// ─── PATCH /api/operaciones/puestos/:id/salario ──────────────────────────────

router.patch("/operaciones/puestos/:id/salario", async (req, res) => {
  const sessionRaw = req.headers["x-isp-session"];
  let userRole = "";
  try { userRole = JSON.parse(sessionRaw as string)?.rol ?? ""; } catch {}
  if (!["admin", "rrhh"].includes(userRole)) {
    return res.status(403).json({ error: "Solo RRHH o administradores pueden modificar el salario del puesto" });
  }
  const { salarioPuesto } = req.body;
  if (salarioPuesto === undefined) {
    return res.status(400).json({ error: "salarioPuesto es requerido" });
  }
  const salarioVal = salarioPuesto === null ? null : Number(salarioPuesto);
  if (salarioPuesto !== null && (isNaN(salarioVal!) || salarioVal! < 0)) {
    return res.status(400).json({ error: "salarioPuesto debe ser un número positivo" });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE puestos_operativos SET salario_puesto = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, nombre, cliente_nombre, salario_puesto`,
      [salarioVal, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Puesto no encontrado" });
    res.json({ ok: true, puesto: rows[0] });
  } catch (err) {
    logger.error({ err }, "PATCH /operaciones/puestos/:id/salario error");
    res.status(500).json({ error: "Error al actualizar salario del puesto" });
  }
});

// ─── GET /api/operaciones/puestos-salarios ───────────────────────────────────

router.get("/operaciones/puestos-salarios", async (req, res) => {
  const sessionRaw = req.headers["x-isp-session"];
  let userRole = "";
  try { userRole = JSON.parse(sessionRaw as string)?.rol ?? ""; } catch {}
  if (!["admin", "rrhh"].includes(userRole)) {
    return res.status(403).json({ error: "Solo RRHH o administradores pueden ver los salarios" });
  }
  try {
    const { rows } = await pool.query(`
      SELECT
        po.id, po.nombre, po.cliente_id, po.cliente_nombre,
        po.salario_puesto, po.activo, ${puestoEstadoCoberturaSql("po")} AS estado,
        c.nombre_comercial AS cliente_nombre_comercial
      FROM puestos_operativos po
      LEFT JOIN clients c ON c.id = po.cliente_id
      WHERE po.activo = true
      ORDER BY po.cliente_nombre, po.nombre
    `);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /operaciones/puestos-salarios error");
    res.status(500).json({ error: "Error al obtener puestos" });
  }
});

// ─── PATCH /api/operaciones/puestos/:id/igss ─────────────────────────────────

router.patch("/operaciones/puestos/:id/igss", async (req, res) => {
  const { aplicaIgss, regimenIgss, notasIgss } = req.body ?? {};
  const puestoId = parseInt(req.params.id);
  if (isNaN(puestoId)) return res.status(400).json({ error: "ID inválido" });

  const REGIMENES_VALIDOS = ["aplica", "no_aplica", "en_transicion"];
  if (regimenIgss !== undefined && !REGIMENES_VALIDOS.includes(regimenIgss)) {
    return res.status(400).json({ error: "regimen_igss inválido. Use: aplica, no_aplica, en_transicion" });
  }

  const sets: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [puestoId];

  if (aplicaIgss !== undefined) {
    params.push(!!aplicaIgss);
    sets.push(`aplica_igss = $${params.length}`);
    // Sincronizar regimen_igss automáticamente si no se pasa explícito
    if (regimenIgss === undefined) {
      params.push(aplicaIgss ? "aplica" : "no_aplica");
      sets.push(`regimen_igss = $${params.length}`);
    }
  }
  if (regimenIgss !== undefined) {
    params.push(regimenIgss);
    sets.push(`regimen_igss = $${params.length}`);
  }
  if (notasIgss !== undefined) {
    params.push(notasIgss || null);
    sets.push(`notas_igss = $${params.length}`);
  }

  try {
    const { rows } = await pool.query(
      `UPDATE puestos_operativos SET ${sets.join(", ")} WHERE id = $1 RETURNING id, nombre, cliente_nombre, aplica_igss, regimen_igss, notas_igss`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: "Puesto no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "PATCH /operaciones/puestos/:id/igss error");
    res.status(500).json({ error: "Error al actualizar IGSS del puesto" });
  }
});

// ─── GET /api/operaciones/puestos/sin-zona ───────────────────────────────────

router.get("/operaciones/puestos/sin-zona", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT po.id,
             po.nombre,
             po.cliente_nombre AS cliente
      FROM puestos_operativos po
      WHERE po.activo = TRUE AND po.zona_operativa_id IS NULL
      ORDER BY po.cliente_nombre, po.nombre
    `);
    res.json({ total: rows.length, puestos: rows });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/puestos/sin-zona error");
    res.status(500).json({ error: "Error al consultar puestos sin zona" });
  }
});

// ─── POST /api/operaciones/puestos ───────────────────────────────────────────
// Crear un nuevo puesto operativo

router.post("/operaciones/puestos", async (req, res) => {
  const {
    clienteId, clienteNombre, nombre, turno, notas, sedeId, horario, jornada,
    tipoTurnoId, fechaInicioCiclo, zonaOperativaId, tipoPuesto,
  } = req.body;

  if (!clienteNombre || !nombre) {
    return res.status(400).json({ error: "clienteNombre y nombre son requeridos" });
  }
  if (!tipoTurnoId) {
    return res.status(400).json({ error: "tipoTurnoId es requerido para crear un puesto" });
  }
  if (!fechaInicioCiclo || !/^\d{4}-\d{2}-\d{2}$/.test(fechaInicioCiclo)) {
    return res.status(400).json({ error: "fechaInicioCiclo (YYYY-MM-DD) es requerida para crear un puesto" });
  }
  // Zona obligatoria — parte estructural del modelo operativo
  if (!zonaOperativaId) {
    return res.status(400).json({ error: "El puesto debe tener una zona operativa asignada" });
  }

  try {
    // Verificar que el turno exista
    const { rows: turnoRows } = await pool.query(
      `SELECT id FROM turnos WHERE id = $1 AND activo = TRUE`, [tipoTurnoId]
    );
    if (!turnoRows.length) {
      return res.status(400).json({ error: `El turno con id=${tipoTurnoId} no existe o está inactivo` });
    }

    // Verificar que la zona exista
    const { rows: zonaRows } = await pool.query(
      `SELECT id FROM operational_zones WHERE id = $1`, [zonaOperativaId]
    );
    if (!zonaRows.length) {
      return res.status(400).json({ error: `La zona operativa con id=${zonaOperativaId} no existe` });
    }

    const { rows: ordenRows } = await pool.query(
      `SELECT COALESCE(MAX(orden), -1) + 1 AS siguiente FROM puestos_operativos WHERE cliente_nombre=$1`,
      [clienteNombre]
    );
    const orden = ordenRows[0].siguiente;

    const tipoPuestoFinal = (tipoPuesto === 'custodia') ? 'custodia' : 'normal';

    const { rows } = await pool.query(
      `INSERT INTO puestos_operativos
         (cliente_id, cliente_nombre, nombre, turno, orden, notas, sede_id, horario, jornada,
          tipo_turno_id, fecha_inicio_ciclo, zona_operativa_id, tipo_puesto)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        clienteId || null, clienteNombre, nombre, turno || 'día', orden,
        notas || null, sedeId || null, horario || null, jornada || null,
        tipoTurnoId, fechaInicioCiclo, zonaOperativaId, tipoPuestoFinal,
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "POST /operaciones/puestos error");
    res.status(500).json({ error: "Error al crear puesto" });
  }
});

// Al desactivar un puesto:
//   1. Marca el puesto como inactivo
//   2. Desactiva sus registros en puesto_titulares
//   3. Marca los agentes involucrados como elegibles para el pool (disponibles)

router.delete("/operaciones/puestos/:id", async (req, res) => {
  const sessionRaw = req.headers["x-isp-session"];
  const session = sessionRaw ? JSON.parse(Buffer.from(String(sessionRaw), "base64").toString()) : null;
  const usuario = session?.nombre ?? session?.username ?? "sistema";

  try {
    const puestoId = parseInt(req.params.id);

    // Leer el puesto antes de desactivarlo para saber quién es el titular/agente
    const { rows: puestoRows } = await pool.query(
      `SELECT id, nombre, cliente_nombre, titular_employee_id, agente_id
       FROM puestos_operativos WHERE id = $1`,
      [puestoId]
    );
    if (!puestoRows.length) return res.status(404).json({ error: "Puesto no encontrado" });
    const puesto = puestoRows[0];

    // 1. Desactivar el puesto
    await pool.query(
      `UPDATE puestos_operativos SET activo = FALSE, agente_id = NULL, agente_nombre = NULL, updated_at = NOW() WHERE id = $1`,
      [puestoId]
    );

    // 2. Desactivar registros de puesto_titulares para este puesto
    await pool.query(
      `UPDATE puesto_titulares SET activo = FALSE, updated_at = NOW() WHERE puesto_id = $1 AND activo = TRUE`,
      [puestoId]
    );

    // 3. Recolectar IDs de empleados afectados (titular y/o agente activo)
    const afectadosSet = new Set<number>();
    if (puesto.titular_employee_id) afectadosSet.add(Number(puesto.titular_employee_id));
    if (puesto.agente_id && puesto.agente_id !== puesto.titular_employee_id) afectadosSet.add(Number(puesto.agente_id));

    // También los titulares registrados en puesto_titulares (multi-titular)
    const { rows: titularesRows } = await pool.query(
      `SELECT employee_id FROM puesto_titulares WHERE puesto_id = $1`,
      [puestoId]
    );
    for (const t of titularesRows) {
      if (t.employee_id) afectadosSet.add(Number(t.employee_id));
    }

    const afectadosArr = [...afectadosSet];

    if (afectadosArr.length > 0) {
      // 4. Marcar empleados afectados como elegibles para el pool (disponibles)
      await pool.query(
        `UPDATE employees SET elegible_pool = TRUE, updated_at = NOW()
         WHERE id = ANY($1::int[]) AND estado_laboral = 'activo'`,
        [afectadosArr]
      );

      // 5. Registrar movimiento operativo por cada empleado liberado
      for (const empId of afectadosArr) {
        const { rows: empRows } = await pool.query(
          `SELECT nombre_completo FROM employees WHERE id = $1`, [empId]
        );
        const empNombre = empRows[0]?.nombre_completo ?? "Desconocido";
        await pool.query(
          `INSERT INTO movimientos_operativos
             (tipo, motivo, puesto_id, puesto_nombre, cliente_nombre,
              agente_saliente_id, agente_saliente_nombre, usuario_cambio, fecha_hora)
           VALUES ('salida', 'puesto_desactivado', $1, $2, $3, $4, $5, $6, NOW())`,
          [puestoId, puesto.nombre, puesto.cliente_nombre, empId, empNombre, usuario]
        );
      }
    }

    logger.info(
      { puestoId, nombre: puesto.nombre, afectados: afectadosArr },
      "Puesto desactivado — agentes liberados al pool"
    );

    res.json({
      ok: true,
      agentes_liberados: afectadosArr.length,
      mensaje: afectadosArr.length > 0
        ? `Puesto desactivado. ${afectadosArr.length} agente(s) pasaron a disponibles en el pool.`
        : "Puesto desactivado. No había agentes asignados.",
    });
  } catch (err) {
    logger.error({ err }, "DELETE /operaciones/puestos/:id error");
    res.status(500).json({ error: "Error al eliminar puesto" });
  }
});

// ─── GET /api/operaciones/puestos/:id/titular-historico ──────────────────────

router.get("/operaciones/puestos/:id/titular-historico", async (req, res) => {
  const puestoId = parseInt(req.params.id);
  try {
    const { rows } = await pool.query(
      `SELECT
         pth.id,
         pth.puesto_id,
         pth.employee_id,
         TO_CHAR(pth.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
         TO_CHAR(pth.fecha_fin,   'YYYY-MM-DD') AS fecha_fin,
         pth.motivo,
         pth.creado_por,
         e.nombre_completo AS empleado_nombre
       FROM puesto_titular_historico pth
       JOIN employees e ON e.id = pth.employee_id
       WHERE pth.puesto_id = $1
       ORDER BY pth.fecha_inicio DESC`,
      [puestoId]
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /operaciones/puestos/:id/titular-historico error");
    res.status(500).json({ error: "Error al cargar historial de titularidad" });
  }
});

// ─── GET /api/operaciones/clientes-disponibles ───────────────────────────────

router.get("/operaciones/clientes-disponibles", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, nombre_comercial, portal_cliente_id FROM clients WHERE estado='activo' ORDER BY nombre`
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /operaciones/clientes-disponibles error");
    res.status(500).json({ error: "Error al cargar clientes" });
  }
});

// ─── PATCH /api/operaciones/puestos/:id/turno ────────────────────────────────
// Asigna o actualiza el turno y fecha_inicio_ciclo de un puesto operativo.

router.patch("/operaciones/puestos/:id/turno", async (req, res) => {
  const puestoId = parseInt(req.params.id);
  if (isNaN(puestoId)) return res.status(400).json({ error: "ID de puesto inválido" });

  const { tipo_turno_id, fecha_inicio_ciclo, hora_entrada } = req.body ?? {};

  // Validación: si se provee un turno, la fecha_inicio_ciclo es obligatoria
  if (tipo_turno_id != null && !fecha_inicio_ciclo) {
    return res.status(400).json({ error: "fecha_inicio_ciclo es requerida al asignar un turno" });
  }

  // Validar formato de fecha
  if (fecha_inicio_ciclo && !/^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio_ciclo)) {
    return res.status(400).json({ error: "fecha_inicio_ciclo debe tener formato YYYY-MM-DD" });
  }

  // SLOT-FIC-MON-01: normalizar al LUNES anterior antes de persistir.
  // La grilla del modal asume D1=Lun; cualquier fecha distinta desfasaría el
  // motor del pizarrón. Ver lib/fecha-lunes.ts.
  const ficNormalizada = normalizarFechaALunesString(fecha_inicio_ciclo);

  // Validar hora_entrada: si se provee, debe ser HH:MM
  if (hora_entrada != null && hora_entrada !== "" && !/^\d{2}:\d{2}$/.test(hora_entrada)) {
    return res.status(400).json({ error: "hora_entrada debe tener formato HH:MM" });
  }

  try {
    // Verificar que el puesto existe
    const { rows: puestos } = await pool.query(
      `SELECT id, nombre FROM puestos_operativos WHERE id = $1 AND activo = TRUE`,
      [puestoId]
    );
    if (puestos.length === 0) {
      return res.status(404).json({ error: "Puesto no encontrado" });
    }

    // Verificar que el turno existe (si se asigna uno)
    if (tipo_turno_id != null) {
      const { rows: turnos } = await pool.query(
        `SELECT id, nombre FROM turnos WHERE id = $1 AND activo = TRUE`,
        [tipo_turno_id]
      );
      if (turnos.length === 0) {
        return res.status(404).json({ error: "Turno no encontrado o inactivo" });
      }
    }

    // hora_entrada solo aplica a turnos diarios (< 24h); para alternados se limpia
    const horaEntradaFinal = (tipo_turno_id != null && hora_entrada && hora_entrada !== "")
      ? hora_entrada
      : null;

    // SLOT-DATE-SYNC-01: la fecha de inicio del ciclo vive en DOS lugares —
    // `puestos_operativos.fecha_inicio_ciclo` (dato del puesto) y
    // `puesto_slots.fecha_inicio_ciclo` (lo que realmente usa el cálculo del
    // pizarrón). Si solo se actualiza el puesto y no los slots, el modal
    // muestra una fecha pero el pizarrón calcula con la vieja → "Sin
    // cobertura" en fechas que sí deberían estar cubiertas. Sincronizar
    // ambos en una transacción.
    const client = await pool.connect();
    let slotsActualizados = 0;
    try {
      await client.query("BEGIN");

      await client.query(`
        UPDATE puestos_operativos
        SET
          tipo_turno_id      = $1,
          fecha_inicio_ciclo = $2,
          hora_entrada       = $3,
          updated_at         = NOW()
        WHERE id = $4
      `, [
        tipo_turno_id ?? null,
        tipo_turno_id != null ? ficNormalizada : null,
        horaEntradaFinal,
        puestoId,
      ]);

      // Propagar fecha_inicio_ciclo a los slots activos del puesto
      // (solo si el turno sigue asignado y la fecha viene del cliente).
      if (tipo_turno_id != null && ficNormalizada) {
        const { rowCount } = await client.query(
          `UPDATE puesto_slots
              SET fecha_inicio_ciclo = $1,
                  updated_at         = NOW()
            WHERE puesto_id = $2
              AND activo    = TRUE
              AND (fecha_inicio_ciclo IS DISTINCT FROM $1::date)`,
          [ficNormalizada, puestoId]
        );
        slotsActualizados = rowCount ?? 0;
      }

      // Si hay asignaciones operativas activas para este puesto, actualizarlas también
      if (tipo_turno_id != null) {
        await client.query(`
          UPDATE employee_operational_assignments
          SET tipo_turno_id = $1
          WHERE puesto_id = $2 AND activa = TRUE
        `, [tipo_turno_id, puestoId]);
      }

      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK").catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }

    // Obtener datos completos del puesto actualizado con turno
    const { rows: resultado } = await pool.query(`
      SELECT
        po.id,
        po.nombre,
        po.tipo_turno_id,
        po.fecha_inicio_ciclo,
        t.nombre         AS turno_nombre,
        t.horas_trabajo,
        t.horas_descanso,
        (t.horas_trabajo + COALESCE(t.horas_descanso, 0)) AS ciclo_horas,
        COALESCE(t.tipo_ciclo,
          CASE
            WHEN (t.horas_trabajo + COALESCE(t.horas_descanso, 0)) <= 24
              THEN 'diario'
            ELSE 'alternado'
          END
        ) AS tipo_ciclo
      FROM puestos_operativos po
      LEFT JOIN turnos t ON t.id = po.tipo_turno_id
      WHERE po.id = $1
    `, [puestoId]);

    logger.info(
      { puestoId, tipo_turno_id, fecha_inicio_ciclo, slotsActualizados },
      "PATCH /operaciones/puestos/:id/turno: turno actualizado"
    );
    res.json({ ok: true, puesto: resultado[0] });
  } catch (err) {
    logger.error({ err }, "PATCH /operaciones/puestos/:id/turno error");
    res.status(500).json({ error: "Error al actualizar turno del puesto" });
  }
});

// ─── GET /api/operaciones/puestos/:id/turno ──────────────────────────────────

router.get("/operaciones/puestos/:id/turno", async (req, res) => {
  const puestoId = parseInt(req.params.id);
  if (isNaN(puestoId)) return res.status(400).json({ error: "ID de puesto inválido" });

  const fecha = (req.query.fecha as string) || todayGT();

  try {
    const { rows } = await pool.query(`
      SELECT
        po.id,
        po.nombre,
        po.tipo_turno_id,
        TO_CHAR(po.fecha_inicio_ciclo, 'YYYY-MM-DD') AS fecha_inicio_ciclo,
        t.nombre         AS turno_nombre,
        t.descripcion    AS turno_descripcion,
        t.horas_trabajo,
        t.horas_descanso,
        (t.horas_trabajo + COALESCE(t.horas_descanso, 0))  AS ciclo_horas,
        COALESCE(t.tipo_ciclo,
          CASE
            WHEN (t.horas_trabajo + COALESCE(t.horas_descanso, 0)) <= 24 THEN 'diario'
            ELSE 'alternado'
          END
        ) AS tipo_ciclo,
        CEIL(t.horas_trabajo / 24.0)                        AS dias_trabajo,
        CEIL(COALESCE(t.horas_descanso, 0) / 24.0)          AS dias_descanso
      FROM puestos_operativos po
      LEFT JOIN turnos t ON t.id = po.tipo_turno_id
      WHERE po.id = $1 AND po.activo = TRUE
    `, [puestoId]);

    if (rows.length === 0) return res.status(404).json({ error: "Puesto no encontrado" });

    const p = rows[0];
    let estado_turno: string | null = null;
    let descanso_por_ciclo = false;
    let disponible_he = false;

    if (p.tipo_turno_id) {
      const ec = calcularEstadoCiclo(
        { id: p.tipo_turno_id, horas_trabajo: p.horas_trabajo, horas_descanso: p.horas_descanso, tipo_ciclo: p.tipo_ciclo },
        p.fecha_inicio_ciclo,
        fecha,
      );
      estado_turno       = ec.trabaja ? "trabajando" : "descansando";
      descanso_por_ciclo = ec.descansoPorCiclo;
      disponible_he      = ec.disponibleHE;
    }

    res.json({ ...p, estado_turno, descanso_por_ciclo, disponible_he, fecha_consultada: fecha });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/puestos/:id/turno error");
    res.status(500).json({ error: "Error al obtener turno del puesto" });
  }
});

// ─── GET /api/operaciones/puestos/:id/titulares ──────────────────────────────
// Devuelve personal administrativo (bodega, rrhh, gerencia y administrativo genérico) con estado de turno.

router.get("/operaciones/puestos/:id/titulares", async (req, res) => {
  const puestoId = parseInt(req.params.id);
  if (isNaN(puestoId)) return res.status(400).json({ error: "ID de puesto inválido" });

  try {
    const { rows } = await pool.query(`
      SELECT
        pt.id,
        pt.employee_id,
        pt.orden,
        TO_CHAR(pt.fecha_inicio_ciclo, 'YYYY-MM-DD') AS fecha_inicio_ciclo,
        pt.activo,
        e.nombre_completo,
        e.puesto          AS cargo,
        e.estado_laboral
      FROM puesto_titulares pt
      JOIN employees e ON e.id = pt.employee_id
      WHERE pt.puesto_id = $1 AND pt.activo = TRUE
      ORDER BY pt.orden
    `, [puestoId]);

    res.json({ titulares: rows });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/puestos/:id/titulares error");
    res.status(500).json({ error: "Error al obtener titulares" });
  }
});

// ─── PUT /api/operaciones/puestos/:id/titulares ──────────────────────────────
// Reemplaza todos los titulares activos del puesto.

router.put("/operaciones/puestos/:id/titulares", async (req, res) => {
  const puestoId = parseInt(req.params.id);
  if (isNaN(puestoId)) return res.status(400).json({ error: "ID de puesto inválido" });

  const { titulares } = req.body ?? {};
  if (!Array.isArray(titulares)) {
    return res.status(400).json({ error: "Se requiere un arreglo de titulares" });
  }

  for (const t of titulares) {
    if (!t.employee_id || !t.fecha_inicio_ciclo) {
      return res.status(400).json({ error: "Cada titular requiere employee_id y fecha_inicio_ciclo" });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.fecha_inicio_ciclo)) {
      return res.status(400).json({ error: "fecha_inicio_ciclo debe tener formato YYYY-MM-DD" });
    }
  }

  // Bloqueo fecha_ingreso: ningún titular puede tener fecha de ingreso futura respecto al inicio de su ciclo
  for (const t of titulares) {
    const _v = await validarEmpleadoAsignable(pool, t.employee_id, t.fecha_inicio_ciclo);
    if (!_v.ok) return res.status(400).json({ error: _v.error });
  }

  try {
    const { rows: puestos } = await pool.query(
      `SELECT id, nombre FROM puestos_operativos WHERE id = $1 AND activo = TRUE`,
      [puestoId]
    );
    if (puestos.length === 0) return res.status(404).json({ error: "Puesto no encontrado" });

    await pool.query(`DELETE FROM puesto_titulares WHERE puesto_id = $1`, [puestoId]);

    if (titulares.length > 0) {
      const params: any[] = [puestoId];
      const values = titulares.map((t: any, i: number) => {
        params.push(t.employee_id, t.fecha_inicio_ciclo, i + 1);
        const base = i * 3 + 2;
        return `($1, $${base}, $${base + 1}, $${base + 2})`;
      }).join(", ");

      await pool.query(
        `INSERT INTO puesto_titulares (puesto_id, employee_id, fecha_inicio_ciclo, orden)
         VALUES ${values}`,
        params
      );

      // Si sólo hay 1 titular, actualizar agente_id/nombre en el puesto también
      if (titulares.length >= 1) {
        const { rows: emp } = await pool.query(
          `SELECT nombre_completo FROM employees WHERE id = $1`,
          [titulares[0].employee_id]
        );
        if (emp.length > 0) {
          await pool.query(`
            UPDATE puestos_operativos
            SET titular_employee_id = $1,
                titular_nombre       = $2,
                fecha_inicio_ciclo   = $3,
                updated_at           = NOW()
            WHERE id = $4
          `, [titulares[0].employee_id, emp[0].nombre_completo, titulares[0].fecha_inicio_ciclo, puestoId]);
        }
      }
    }

    const { rows: resultado } = await pool.query(`
      SELECT pt.id, pt.employee_id, pt.orden,
             TO_CHAR(pt.fecha_inicio_ciclo, 'YYYY-MM-DD') AS fecha_inicio_ciclo,
             e.nombre_completo
      FROM puesto_titulares pt
      JOIN employees e ON e.id = pt.employee_id
      WHERE pt.puesto_id = $1 AND pt.activo = TRUE
      ORDER BY pt.orden
    `, [puestoId]);

    logger.info({ puestoId, count: titulares.length }, "PUT /operaciones/puestos/:id/titulares: titulares actualizados");
    res.json({ ok: true, titulares: resultado });
  } catch (err) {
    logger.error({ err }, "PUT /operaciones/puestos/:id/titulares error");
    res.status(500).json({ error: "Error al actualizar titulares" });
  }
});

// Lista puestos marcados como tipo_puesto = 'custodia' con estado operativo calculado.
// Estado:
//   incidente_activo    → tiene incident activo ligado al puesto
//   incidente_completado → sólo incidentes cerrados
//   en_ruta             → agente asignado hoy, sin incidentes abiertos

export default router;
