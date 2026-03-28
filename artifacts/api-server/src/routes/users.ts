import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { pool } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import bcrypt from "bcryptjs";

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
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username y contraseña requeridos" });
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

// GET /api/users/:id
usersRouter.get("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    const [user] = await db.select(SAFE_FIELDS).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener usuario" });
  }
});

// GET /api/users/by-phone/:phone — lookup by WhatsApp phone number
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

export default usersRouter;
