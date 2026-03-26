import { Router } from "express";
import { db, usersTable } from "@workspace/db";
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
  createdAt: usersTable.createdAt,
  updatedAt: usersTable.updatedAt,
};

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

// POST /api/users — create user
usersRouter.post("/users", async (req, res) => {
  const { nombre, username, correo, password, rol, estado, telefono, clienteId } = req.body ?? {};
  if (!nombre || !username || !password) {
    return res.status(400).json({ error: "Nombre, username y contraseña son requeridos" });
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
        telefono: telefono || null,
        clienteId: clienteId || null,
      })
      .returning(SAFE_FIELDS);

    res.status(201).json(user);
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({ error: "El username ya está en uso" });
    }
    res.status(500).json({ error: "Error al crear usuario" });
  }
});

// PATCH /api/users/:id — update user (role, estado, datos, password)
usersRouter.patch("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const { nombre, correo, rol, estado, telefono, clienteId, password } = req.body ?? {};
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (nombre !== undefined) updates.nombre = String(nombre);
  if (correo !== undefined) updates.correo = correo || null;
  if (rol !== undefined) updates.rol = String(rol);
  if (estado !== undefined) updates.estado = String(estado);
  if (telefono !== undefined) updates.telefono = telefono || null;
  if (clienteId !== undefined) updates.clienteId = clienteId || null;
  if (password) updates.passwordHash = await bcrypt.hash(String(password), 10);

  try {
    const [user] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, id))
      .returning(SAFE_FIELDS);

    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
});

export default usersRouter;
