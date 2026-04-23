import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { pool } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { invalidatePermCache } from "../lib/permisos-middleware";

const usersRouter = Router();

const SAFE_FIELDS = {
  id: usersTable.id,
  nombre: usersTable.nombre,
  username: usersTable.username,
  correo: usersTable.correo,
  rol: usersTable.rol,
  estado: usersTable.estado,
  telefono: usersTable.telefono,
  clienteId: usersTable.clienteId,
  employeeId: usersTable.employeeId,
  canReportEmergency: usersTable.canReportEmergency,
  canRequestAdvance: usersTable.canRequestAdvance,
  createdAt: usersTable.createdAt,
  updatedAt: usersTable.updatedAt,
};

/**
 * Normaliza número de teléfono al formato internacional sin '+'.
 * Elimina espacios, guiones y paréntesis.
 * Si el número comienza con 0, lo elimina.
 * Ejemplos:
 *   "+502 2345-6789" → "50223456789"
 *   "+50223456789"   → "50223456789"
 *   "50223456789"    → "50223456789"
 *   "23456789"       → "23456789" (sin código de país, se deja como está)
 */
function normalizePhone(raw: string): string {
  return raw
    .replace(/\s+/g, "")
    .replace(/[-()]/g, "")
    .replace(/^\+/, "");
}

// POST /api/auth/login
usersRouter.post("/auth/login", async (req, res) => {
  const { username, password, turnstileToken } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username y contraseña requeridos" });
  }

  const turnstileSecret = process.env["TURNSTILE_SECRET_KEY"];
  if (turnstileSecret) {
    if (!turnstileToken) {
      return res.status(400).json({ error: "Verificación de seguridad requerida" });
    }
    try {
      const ip = (req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.ip || "").trim();
      const params = new URLSearchParams();
      params.append("secret", turnstileSecret);
      params.append("response", String(turnstileToken));
      if (ip) params.append("remoteip", ip);
      const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: params,
      });
      const verifyData = (await verifyRes.json()) as { success: boolean };
      if (!verifyData.success) {
        return res.status(403).json({ error: "Verificación de seguridad fallida. Recargue la página." });
      }
    } catch (err) {
      req.log.error({ err }, "Turnstile verification error");
      return res.status(503).json({ error: "No se pudo verificar la seguridad. Intente de nuevo." });
    }
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, String(username).trim().toLowerCase()))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }
    if (user.estado !== "activo") {
      return res.status(403).json({ error: "Cuenta desactivada. Contacte al administrador." });
    }

    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const { passwordHash: _pw, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
});

// POST /api/auth/change-password — el usuario logueado cambia su propia contraseña
usersRouter.post("/auth/change-password", async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Contraseña actual y nueva son requeridas" });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: "La nueva contraseña debe tener al menos 8 caracteres" });
  }

  let session: { username?: string } | null = null;
  try {
    const raw = req.headers["x-isp-session"] as string | undefined;
    if (raw) session = JSON.parse(raw);
  } catch {
    return res.status(401).json({ error: "Sesión inválida" });
  }
  if (!session?.username) {
    return res.status(401).json({ error: "No hay sesión activa" });
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, String(session.username).trim().toLowerCase()))
      .limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    if (user.estado !== "activo") {
      return res.status(403).json({ error: "Cuenta desactivada" });
    }

    const valid = await bcrypt.compare(String(currentPassword), user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "La contraseña actual es incorrecta" });
    }

    const newHash = await bcrypt.hash(String(newPassword), 10);
    await db
      .update(usersTable)
      .set({ passwordHash: newHash })
      .where(eq(usersTable.id, user.id));

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al cambiar la contraseña" });
  }
});

// GET /api/users — list all users (admin only, enforced on frontend)
usersRouter.get("/users", async (_req, res) => {
  try {
    const users = await db
      .select(SAFE_FIELDS)
      .from(usersTable)
      .orderBy(asc(usersTable.createdAt));
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

// GET /api/users/check?username=xxx — verificar disponibilidad de username (P-05)
usersRouter.get("/users/check", async (req, res) => {
  const { username, excludeId } = req.query as { username?: string; excludeId?: string };
  if (!username?.trim()) return res.status(400).json({ error: "Parámetro 'username' requerido" });
  try {
    const rows = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username.trim().toLowerCase()))
      .limit(1);
    const taken = rows.length > 0 && (!excludeId || rows[0].id !== parseInt(excludeId));
    res.json({ available: !taken });
  } catch (err) {
    res.status(500).json({ error: "Error al verificar username" });
  }
});

// GET /api/users/inconsistencias — MUST be before /users/:id
usersRouter.get("/users/inconsistencias", async (_req, res) => {
  const AREAS_OBL = [
    "administración", "administracion", "rrhh", "recursos humanos",
    "operaciones", "gerencia", "bodega", "comercial",
    "supervisión", "supervision", "facturación", "facturacion",
    "contabilidad", "compras", "sistemas", "legal",
  ];
  try {
    const { rows: empleadosSinUsuario } = await pool.query(`
      SELECT e.id, e.nombre_completo, e.area, e.puesto, e.estado_laboral
      FROM employees e
      WHERE e.estado_laboral = 'activo'
        AND LOWER(e.area) = ANY($1::text[])
        AND NOT EXISTS (
          SELECT 1 FROM users u WHERE u.employee_id = e.id
        )
      ORDER BY e.area, e.nombre_completo
    `, [AREAS_OBL]);
    const { rows: clientesSinUsuario } = await pool.query(`
      SELECT c.id, c.nombre, c.nombre_comercial, c.portal_cliente_id
      FROM clients c
      WHERE c.estado = 'activo'
        AND c.portal_cliente_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM users u WHERE u.cliente_id = c.portal_cliente_id
        )
      ORDER BY c.nombre
    `);
    res.json({
      empleadosSinUsuario,
      clientesSinUsuario,
      totalInconsistencias: empleadosSinUsuario.length + clientesSinUsuario.length,
    });
  } catch (err) {
    res.status(500).json({ error: "Error al calcular inconsistencias" });
  }
});

// GET /api/users/by-phone/:phone — MUST be before /users/:id
usersRouter.get("/users/by-phone/:phone", async (req, res) => {
  const raw = req.params.phone;
  const normalized = normalizePhone(raw);
  try {
    const [user] = await db
      .select(SAFE_FIELDS)
      .from(usersTable)
      .where(eq(usersTable.telefono, normalized))
      .limit(1);
    if (!user) return res.status(404).json({ error: "Número no registrado en el sistema" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Error al buscar usuario por teléfono" });
  }
});

// POST /api/users — create user
usersRouter.post("/users", async (req, res) => {
  const {
    nombre, username, correo, password, rol, estado,
    telefono, clienteId, employeeId, canReportEmergency, canRequestAdvance,
  } = req.body ?? {};
  if (!nombre || !username || !password) {
    return res.status(400).json({ error: "Nombre, username y contraseña son requeridos" });
  }

  const telefonoNorm = telefono ? normalizePhone(String(telefono)) : null;

  // M-01: Validar que el employeeId existe en la tabla employees
  if (employeeId) {
    const empId = parseInt(String(employeeId));
    if (isNaN(empId)) return res.status(400).json({ error: "employeeId debe ser un número entero" });
    const { rows: empRows } = await pool.query(
      `SELECT id FROM employees WHERE id = $1 LIMIT 1`, [empId]
    );
    if (empRows.length === 0) {
      return res.status(400).json({ error: `No existe el empleado con ID ${empId}` });
    }
  }

  try {
    const passwordHash = await bcrypt.hash(String(password), 10);
    const [user] = await db
      .insert(usersTable)
      .values({
        nombre: String(nombre),
        username: String(username).trim().toLowerCase(),
        correo: correo || null,
        passwordHash,
        rol: rol || "operaciones",
        estado: estado || "activo",
        telefono: telefonoNorm,
        clienteId: clienteId || null,
        employeeId: employeeId ? parseInt(String(employeeId)) : null,
        canReportEmergency: canReportEmergency === true || canReportEmergency === "true" ? true : null,
        canRequestAdvance: canRequestAdvance === true || canRequestAdvance === "true" ? true : null,
      })
      .returning(SAFE_FIELDS);

    res.status(201).json(user);
  } catch (err: any) {
    if (err?.code === "23505") {
      if (err?.detail?.includes("telefono") || err?.constraint?.includes("telefono")) {
        return res.status(409).json({ error: "El número de teléfono ya está registrado en otro usuario" });
      }
      return res.status(409).json({ error: "El username ya está en uso" });
    }
    res.status(500).json({ error: "Error al crear usuario" });
  }
});

// PATCH /api/users/:id — update user (role, estado, datos, password)
usersRouter.patch("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const {
    nombre, correo, rol, estado, telefono, clienteId,
    employeeId, canReportEmergency, canRequestAdvance, password,
  } = req.body ?? {};
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (nombre !== undefined) updates.nombre = String(nombre);
  if (correo !== undefined) updates.correo = correo || null;
  if (rol !== undefined) updates.rol = String(rol);
  if (estado !== undefined) updates.estado = String(estado);
  if (telefono !== undefined) {
    updates.telefono = telefono ? normalizePhone(String(telefono)) : null;
  }
  if (clienteId !== undefined) updates.clienteId = clienteId || null;
  if (employeeId !== undefined) {
    if (employeeId) {
      const empId = parseInt(String(employeeId));
      if (isNaN(empId)) return res.status(400).json({ error: "employeeId debe ser un número entero" });
      const { rows: empRows } = await pool.query(
        `SELECT id FROM employees WHERE id = $1 LIMIT 1`, [empId]
      );
      if (empRows.length === 0) {
        return res.status(400).json({ error: `No existe el empleado con ID ${empId}` });
      }
      updates.employeeId = empId;
    } else {
      updates.employeeId = null;
    }
  }
  if (canReportEmergency !== undefined) {
    updates.canReportEmergency = canReportEmergency === true || canReportEmergency === "true" ? true : canReportEmergency === false || canReportEmergency === "false" ? false : null;
  }
  if (canRequestAdvance !== undefined) {
    updates.canRequestAdvance = canRequestAdvance === true || canRequestAdvance === "true" ? true : canRequestAdvance === false || canRequestAdvance === "false" ? false : null;
  }
  if (password) updates.passwordHash = await bcrypt.hash(String(password), 10);

  try {
    const [user] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, id))
      .returning(SAFE_FIELDS);

    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    // Invalidar cache de permisos para este usuario (su rol puede haber cambiado)
    invalidatePermCache(user.username);
    res.json(user);
  } catch (err: any) {
    if (err?.code === "23505") {
      if (err?.detail?.includes("telefono") || err?.constraint?.includes("telefono")) {
        return res.status(409).json({ error: "El número de teléfono ya está registrado en otro usuario" });
      }
      return res.status(409).json({ error: "El username ya está en uso" });
    }
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/clientes/:clienteDbId/usuarios
// Devuelve los usuarios del sistema vinculados a este cliente
// Usa portal_cliente_id del cliente para cruzar con users.cliente_id
// ─────────────────────────────────────────────────────────────────────────────
usersRouter.get("/clientes/:clienteDbId/usuarios", async (req, res) => {
  const clienteDbId = parseInt(req.params.clienteDbId);
  if (isNaN(clienteDbId)) return res.status(400).json({ error: "ID inválido" });
  try {
    const { rows: clientRows } = await pool.query(
      `SELECT portal_cliente_id FROM clients WHERE id = $1 LIMIT 1`, [clienteDbId]
    );
    if (clientRows.length === 0) return res.status(404).json({ error: "Cliente no encontrado" });
    const portalId: string | null = clientRows[0].portal_cliente_id;
    if (!portalId) return res.json([]);
    // USR-MULTI-01: usa la tabla de vínculos N:M (incluye usuarios con varios clientes)
    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, u.username, u.correo, u.telefono, u.rol, u.estado, u.cliente_id, u.employee_id,
              u.can_report_emergency, u.can_request_advance, u.created_at, u.updated_at,
              (u.cliente_id = $1) AS es_default
         FROM users u
         JOIN usuarios_clientes uc ON uc.user_id = u.id
        WHERE uc.portal_cliente_id = $1
        ORDER BY es_default DESC, u.created_at ASC`,
      [portalId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener usuarios del cliente" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/users/cliente-disponibles
// Lista usuarios con rol='cliente' (con info del cliente al que ya están vinculados, si aplica)
// Útil para vincular usuarios existentes a un cliente desde la ficha
// ─────────────────────────────────────────────────────────────────────────────
usersRouter.get("/users/cliente-disponibles", async (_req, res) => {
  try {
    // Trae users con rol cliente + array de clientes a los que ya está vinculado
    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, u.username, u.correo, u.telefono, u.estado, u.cliente_id,
              c.id AS cliente_db_id, c.nombre AS cliente_nombre,
              COALESCE(
                (SELECT json_agg(json_build_object(
                   'portal_cliente_id', uc.portal_cliente_id,
                   'cliente_db_id', cc.id,
                   'cliente_nombre', COALESCE(cc.nombre_comercial, cc.nombre)
                 ) ORDER BY cc.nombre)
                   FROM usuarios_clientes uc
                   LEFT JOIN clients cc ON cc.portal_cliente_id = uc.portal_cliente_id
                  WHERE uc.user_id = u.id),
                '[]'::json
              ) AS clientes_vinculados
         FROM users u
         LEFT JOIN clients c ON c.portal_cliente_id = u.cliente_id
        WHERE u.rol = 'cliente'
        ORDER BY u.nombre ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener usuarios cliente" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/clientes/:clienteDbId/usuarios/vincular
// Vincula un usuario existente (rol cliente) a este cliente
// ─────────────────────────────────────────────────────────────────────────────
usersRouter.post("/clientes/:clienteDbId/usuarios/vincular", async (req, res) => {
  const clienteDbId = parseInt(req.params.clienteDbId);
  if (isNaN(clienteDbId)) return res.status(400).json({ error: "ID inválido" });
  const userId = parseInt(req.body?.userId);
  if (isNaN(userId)) return res.status(400).json({ error: "userId requerido" });
  try {
    const { rows: clientRows } = await pool.query(
      `SELECT portal_cliente_id FROM clients WHERE id = $1 LIMIT 1`, [clienteDbId]
    );
    if (clientRows.length === 0) return res.status(404).json({ error: "Cliente no encontrado" });
    let portalId: string | null = clientRows[0].portal_cliente_id;
    if (!portalId) {
      const { rows: genRows } = await pool.query(
        `UPDATE clients SET portal_cliente_id = gen_random_uuid()::text, updated_at = NOW()
         WHERE id = $1 AND portal_cliente_id IS NULL
         RETURNING portal_cliente_id`,
        [clienteDbId]
      );
      portalId = genRows[0]?.portal_cliente_id ?? null;
      if (!portalId) return res.status(500).json({ error: "No se pudo generar portal_cliente_id" });
    }

    const { rows: userRows } = await pool.query(
      `SELECT id, rol FROM users WHERE id = $1 LIMIT 1`, [userId]
    );
    if (userRows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });
    if (userRows[0].rol !== "cliente") {
      return res.status(400).json({ error: "Solo se pueden vincular usuarios con rol cliente" });
    }
    // USR-MULTI-01: insertar vínculo en tabla N:M (no sobreescribe vínculos existentes)
    await pool.query(
      `INSERT INTO usuarios_clientes (user_id, portal_cliente_id, es_default)
       VALUES ($1, $2, FALSE)
       ON CONFLICT (user_id, portal_cliente_id) DO NOTHING`,
      [userId, portalId]
    );
    // Si el user no tenía cliente_id default, este se vuelve el default
    await pool.query(
      `UPDATE users SET cliente_id = $1, updated_at = NOW() WHERE id = $2 AND cliente_id IS NULL`,
      [portalId, userId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al vincular usuario" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/clientes/:clienteDbId/usuarios/:userId/vinculo
// Desvincula un usuario cliente de este cliente (cliente_id = NULL)
// ─────────────────────────────────────────────────────────────────────────────
usersRouter.delete("/clientes/:clienteDbId/usuarios/:userId/vinculo", async (req, res) => {
  const clienteDbId = parseInt(req.params.clienteDbId);
  const userId = parseInt(req.params.userId);
  if (isNaN(userId) || isNaN(clienteDbId)) return res.status(400).json({ error: "ID inválido" });
  try {
    const { rows: clientRows } = await pool.query(
      `SELECT portal_cliente_id FROM clients WHERE id = $1 LIMIT 1`, [clienteDbId]
    );
    if (clientRows.length === 0) return res.status(404).json({ error: "Cliente no encontrado" });
    const portalId: string | null = clientRows[0].portal_cliente_id;
    if (!portalId) return res.json({ ok: true });

    // USR-MULTI-01: borrar vínculo N:M
    await pool.query(
      `DELETE FROM usuarios_clientes WHERE user_id = $1 AND portal_cliente_id = $2`,
      [userId, portalId]
    );
    // Si era el cliente_id default, mover a otro vínculo restante (o NULL)
    const { rows: remRows } = await pool.query(
      `SELECT portal_cliente_id FROM usuarios_clientes WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [userId]
    );
    const nuevoDefault: string | null = remRows[0]?.portal_cliente_id ?? null;
    await pool.query(
      `UPDATE users SET cliente_id = $1, updated_at = NOW()
        WHERE id = $2 AND cliente_id = $3`,
      [nuevoDefault, userId, portalId]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al desvincular usuario" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/clientes/:clienteDbId/usuarios
// Crea un usuario para este cliente, pre-vinculado con su portal_cliente_id
// ─────────────────────────────────────────────────────────────────────────────
usersRouter.post("/clientes/:clienteDbId/usuarios", async (req, res) => {
  const clienteDbId = parseInt(req.params.clienteDbId);
  if (isNaN(clienteDbId)) return res.status(400).json({ error: "ID inválido" });
  try {
    const { rows: clientRows } = await pool.query(
      `SELECT portal_cliente_id, nombre FROM clients WHERE id = $1 LIMIT 1`, [clienteDbId]
    );
    if (clientRows.length === 0) return res.status(404).json({ error: "Cliente no encontrado" });
    let portalId: string | null = clientRows[0].portal_cliente_id;
    if (!portalId) {
      const { rows: genRows } = await pool.query(
        `UPDATE clients SET portal_cliente_id = gen_random_uuid()::text, updated_at = NOW()
         WHERE id = $1 AND portal_cliente_id IS NULL
         RETURNING portal_cliente_id`,
        [clienteDbId]
      );
      portalId = genRows[0]?.portal_cliente_id ?? null;
      if (!portalId) return res.status(500).json({ error: "No se pudo generar portal_cliente_id" });
    }

    const { nombre, username, correo, password, telefono, estado } = req.body ?? {};
    if (!nombre || !username || !password) {
      return res.status(400).json({ error: "Nombre, username y contraseña son requeridos" });
    }
    const telefonoNorm = telefono ? normalizePhone(String(telefono)) : null;
    const passwordHash = await bcrypt.hash(String(password), 10);
    const { rows } = await pool.query(
      `INSERT INTO users (nombre, username, correo, password_hash, rol, estado, telefono, cliente_id)
       VALUES ($1, $2, $3, $4, 'cliente', $5, $6, $7)
       RETURNING id, nombre, username, correo, telefono, rol, estado, cliente_id, created_at`,
      [String(nombre), String(username).trim().toLowerCase(), correo || null,
       passwordHash, estado || "activo", telefonoNorm, portalId]
    );
    // USR-MULTI-01: insertar en tabla N:M como vínculo default
    await pool.query(
      `INSERT INTO usuarios_clientes (user_id, portal_cliente_id, es_default)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (user_id, portal_cliente_id) DO NOTHING`,
      [rows[0].id, portalId]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    if (err?.code === "23505") {
      if (err?.constraint?.includes("telefono") || err?.detail?.includes("telefono")) {
        return res.status(409).json({ error: "El número de teléfono ya está registrado" });
      }
      return res.status(409).json({ error: "El username ya está en uso" });
    }
    res.status(500).json({ error: "Error al crear usuario del cliente" });
  }
});


export default usersRouter;
