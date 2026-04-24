import { Router } from "express";
import { pool } from "@workspace/db";
import { invalidatePermCache } from "../lib/permisos-middleware";

const router = Router();

function getSession(req: any): { nombre: string; username: string; rol: string } | null {
  try {
    const raw = req.headers["x-isp-session"] as string;
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function requireAdmin(req: any, res: any): boolean {
  const s = getSession(req);
  if (!s || s.rol !== "admin") {
    res.status(403).json({ error: "Solo administradores pueden gestionar roles" });
    return false;
  }
  return true;
}

// Lista de módulos disponibles (espejo del sidebar, fuente de verdad del frontend)
export const SYSTEM_MODULOS = [
  // General
  { clave: "dashboard",           label: "Dashboard",                  seccion: "General" },
  // Operaciones
  { clave: "pizarron",            label: "Pizarrón Operativo",         seccion: "Operaciones" },
  { clave: "seguimiento_ssa",     label: "Seguimiento SSA",            seccion: "Operaciones" },
  { clave: "pipeline_ssa",        label: "Pipeline SSA",               seccion: "Operaciones" },
  { clave: "tareas",              label: "Tareas",                     seccion: "Operaciones" },
  { clave: "incidencias",         label: "Incidencias",                seccion: "Operaciones" },
  { clave: "custodias",           label: "Custodias",                  seccion: "Operaciones" },
  { clave: "cambios_estructurales", label: "Cambios Estructurales",    seccion: "Operaciones" },
  // Clientes & Comercial
  { clave: "clientes",            label: "Clientes",                   seccion: "Clientes & Comercial" },
  { clave: "comercial",           label: "Comercial",                  seccion: "Clientes & Comercial" },
  { clave: "reportes",            label: "Reportería",                 seccion: "Clientes & Comercial" },
  { clave: "kpi",                 label: "KPI & Métricas",             seccion: "Clientes & Comercial" },
  // Personal & RRHH
  { clave: "empleados",           label: "Colaboradores",              seccion: "Personal & RRHH" },
  { clave: "reclutamiento",       label: "Reclutamiento",              seccion: "Personal & RRHH" },
  { clave: "anticipos",           label: "Anticipos",                  seccion: "Personal & RRHH" },
  { clave: "eventos_rrhh",        label: "Eventos RRHH",               seccion: "Personal & RRHH" },
  { clave: "alertas_rrhh",        label: "Alertas RRHH",               seccion: "Personal & RRHH" },
  { clave: "nomina",              label: "Novedades de Nómina",        seccion: "Personal & RRHH" },
  { clave: "pre_planilla",        label: "Pre-Planilla",               seccion: "Personal & RRHH" },
  { clave: "planilla",            label: "Planilla Final",             seccion: "Personal & RRHH" },
  { clave: "turnos",              label: "Tipos de Turno",             seccion: "Personal & RRHH" },
  { clave: "cambios_salariales",  label: "Cambios Salariales",         seccion: "Personal & RRHH" },
  { clave: "prestaciones",        label: "Prestaciones Laborales",     seccion: "Personal & RRHH" },
  { clave: "solicitudes_vacaciones", label: "Solicitudes de Vacaciones", seccion: "Personal & RRHH" },
  { clave: "amonestaciones",      label: "Amonestaciones",             seccion: "Personal & RRHH" },
  { clave: "planillas_especiales",label: "Bono 14 & Aguinaldo",        seccion: "Personal & RRHH" },
  { clave: "libro_salarios",      label: "Libro de Salarios",          seccion: "Personal & RRHH" },
  { clave: "igss_planilla",       label: "Planilla IGSS",              seccion: "Personal & RRHH" },
  { clave: "carnets_qr",          label: "Carnets QR",                 seccion: "Personal & RRHH" },
  { clave: "kiosco_solicitudes",  label: "Solicitudes Kiosco",         seccion: "Personal & RRHH" },
  { clave: "barracas",            label: "Barracas",                   seccion: "Personal & RRHH" },
  { clave: "seguros",             label: "Seguros",                    seccion: "Personal & RRHH" },
  // Sistema
  { clave: "solicitudes_eliminacion", label: "Solicitudes de Eliminación", seccion: "Sistema" },
  { clave: "usuarios",            label: "Usuarios del Sistema",       seccion: "Sistema" },
  { clave: "config_whatsapp",     label: "Configuración WhatsApp",     seccion: "Sistema" },
  { clave: "plantillas_contrato", label: "Plantillas de Contrato",     seccion: "Sistema" },
  { clave: "cms",                 label: "CMS Web",                    seccion: "Sistema" },
  { clave: "simulador_wa",        label: "Simulador WhatsApp",         seccion: "Sistema" },
  { clave: "modelo_datos",        label: "Modelo de Datos (ERD)",      seccion: "Sistema" },
  { clave: "documentacion",       label: "Documentación",              seccion: "Sistema" },
  // Bodega
  { clave: "bodega",              label: "Inventario General",         seccion: "Bodega e Inventario" },
  { clave: "vehiculos",           label: "Vehículos",                  seccion: "Bodega e Inventario" },
  { clave: "armeria",             label: "Armería",                    seccion: "Bodega e Inventario" },
  // Migración
  { clave: "importacion",         label: "Importar Datos",             seccion: "Migración" },
  { clave: "control_qr",          label: "Control Operativo QR",       seccion: "Control Operativo" },
];

// GET /roles — listar todos los roles con conteo de permisos
router.get("/roles", async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "No autenticado" });
  try {
    const { rows } = await pool.query(`
      SELECT r.clave, r.label, r.descripcion, r.color, r.activo, r.es_sistema,
             COALESCE(p.cnt, 0) AS permisos_count,
             (SELECT COUNT(*) FROM users u WHERE u.rol = r.clave AND u.estado = 'activo') AS usuarios_activos
      FROM system_roles r
      LEFT JOIN (
        SELECT rol_clave, COUNT(*) AS cnt FROM rol_permisos GROUP BY rol_clave
      ) p ON p.rol_clave = r.clave
      ORDER BY r.es_sistema DESC, r.clave
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al cargar roles" });
  }
});

// GET /roles/modulos — lista de módulos disponibles (estática)
router.get("/roles/modulos", (_req, res) => {
  res.json(SYSTEM_MODULOS);
});

// GET /session/permisos — módulos permitidos para el usuario actual
// IMPORTANTE: lee el rol ACTUAL desde la BD por username, no desde la sesión (que puede estar desactualizada)
router.get("/session/permisos", async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "No autenticado" });
  // Evitar cache/304: los permisos pueden cambiar al hacer deploy o asignar módulos.
  // Sin esto, el navegador conserva un JSON viejo que oculta los menús nuevos.
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  try {
    // Siempre consultar el rol actual desde la BD (evita stale session cuando el admin cambia el rol)
    const userRow = await pool.query(
      `SELECT rol FROM users WHERE username = $1 AND estado = 'activo'`,
      [session.username]
    );
    if (userRow.rows.length === 0) {
      return res.status(401).json({ error: "Usuario inactivo o no encontrado" });
    }
    const rolActual: string = userRow.rows[0].rol;
    if (rolActual === "admin") {
      return res.json({ rol: "admin", modulos: SYSTEM_MODULOS.map(m => m.clave) });
    }
    const { rows } = await pool.query(
      `SELECT modulo_clave FROM rol_permisos WHERE rol_clave = $1`,
      [rolActual]
    );
    res.json({ rol: rolActual, modulos: rows.map((r: any) => r.modulo_clave) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al cargar permisos" });
  }
});

// GET /roles/:clave/permisos — módulos asignados a un rol
router.get("/roles/:clave/permisos", async (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "No autenticado" });
  try {
    const { rows } = await pool.query(
      `SELECT modulo_clave FROM rol_permisos WHERE rol_clave = $1`,
      [req.params.clave]
    );
    res.json(rows.map((r: any) => r.modulo_clave));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al cargar permisos del rol" });
  }
});

// PUT /roles/:clave/permisos — reemplazar módulos asignados a un rol
router.put("/roles/:clave/permisos", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { clave } = req.params;
  const modulos: string[] = req.body.modulos ?? [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM rol_permisos WHERE rol_clave = $1`, [clave]);
    if (modulos.length > 0) {
      const values = modulos.map((m, i) => `($1, $${i + 2})`).join(", ");
      await client.query(
        `INSERT INTO rol_permisos (rol_clave, modulo_clave) VALUES ${values} ON CONFLICT DO NOTHING`,
        [clave, ...modulos]
      );
    }
    await client.query("COMMIT");
    invalidatePermCache(); // limpiar todo el cache (puede haber N usuarios con este rol)
    res.json({ ok: true, rol: clave, modulos });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Error al actualizar permisos" });
  } finally {
    client.release();
  }
});

// POST /roles — crear rol
router.post("/roles", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { clave, label, descripcion, color } = req.body;
  if (!clave || !label) return res.status(400).json({ error: "clave y label son requeridos" });
  const cleanClave = clave.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  try {
    const { rows } = await pool.query(
      `INSERT INTO system_roles (clave, label, descripcion, color, es_sistema)
       VALUES ($1, $2, $3, $4, FALSE)
       RETURNING *`,
      [cleanClave, label, descripcion ?? null, color ?? "text-white/50 bg-white/5 border-white/10"]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) {
    if (err.code === "23505") return res.status(409).json({ error: "Ya existe un rol con esa clave" });
    console.error(err);
    res.status(500).json({ error: "Error al crear rol" });
  }
});

// PATCH /roles/:clave — actualizar rol
router.patch("/roles/:clave", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { label, descripcion, color, activo } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE system_roles SET
         label       = COALESCE($1, label),
         descripcion = COALESCE($2, descripcion),
         color       = COALESCE($3, color),
         activo      = COALESCE($4, activo)
       WHERE clave = $5 RETURNING *`,
      [label ?? null, descripcion ?? null, color ?? null, activo ?? null, req.params.clave]
    );
    if (!rows.length) return res.status(404).json({ error: "Rol no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar rol" });
  }
});

// DELETE /roles/:clave — eliminar rol (solo si no tiene usuarios asignados y no es de sistema)
router.delete("/roles/:clave", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { clave } = req.params;
  try {
    const rolResult = await pool.query(`SELECT es_sistema FROM system_roles WHERE clave = $1`, [clave]);
    if (!rolResult.rows.length) return res.status(404).json({ error: "Rol no encontrado" });
    if (rolResult.rows[0].es_sistema) return res.status(409).json({ error: "No se pueden eliminar roles del sistema" });
    const userCount = await pool.query(`SELECT COUNT(*) FROM users WHERE rol = $1`, [clave]);
    if (parseInt(userCount.rows[0].count) > 0) {
      return res.status(409).json({ error: "No se puede eliminar: hay usuarios con este rol" });
    }
    await pool.query(`DELETE FROM system_roles WHERE clave = $1`, [clave]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar rol" });
  }
});

export { router as rolesRouter };
