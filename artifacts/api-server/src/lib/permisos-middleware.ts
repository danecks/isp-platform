import { pool } from "@workspace/db";

// Mapa: prefijo de ruta API → clave de módulo
const ROUTE_MODULO_MAP: Record<string, string> = {
  "/employees":              "empleados",
  "/anticipos":              "anticipos",
  "/incidents":              "incidencias",
  "/custodias":              "custodias",
  "/nomina":                 "nomina",
  "/pre-planilla":           "pre_planilla",
  "/planilla":               "planilla",
  "/planillas-especiales":   "planillas_especiales",
  "/libro-salarios":         "libro_salarios",
  "/kpi":                    "kpi",
  "/tareas":                 "tareas",
  "/reportes":               "reportes",
  "/bodega":                 "bodega",
  "/vehiculos":              "vehiculos",
  "/armeria":                "armeria",
  "/cambios-salariales":     "cambios_salariales",
  "/prestaciones":           "prestaciones",
  "/vacaciones":             "solicitudes_vacaciones",
  "/eventos-rrhh":           "eventos_rrhh",
  "/rrhh-alertas":           "alertas_rrhh",
  "/operaciones":            "pizarron",
  "/puesto-slots":           "pizarron",
  "/solicitudes-turno":      "pizarron",
  "/planificacion-futura":   "pizarron",
  "/qr-rondas":              "rondas_qr",
  "/importacion":            "importacion",
  "/dashboard":              "dashboard",
  "/cms":                    "cms",
  "/simulador":              "simulador_wa",
  "/zonas":                  "pizarron",
  "/incentivos":             "nomina",
  "/dotacion":               "empleados",
  "/uniformes":              "bodega",
  "/cambios-estructurales":  "cambios_estructurales",
  "/solicitudes-eliminacion":"solicitudes_eliminacion",
  "/cobertura":              "reportes",
  "/solicitudes-servicio":   "seguimiento_ssa",
  "/leads":                  "reclutamiento",
  "/applications":           "reclutamiento",
  "/turnos":                 "turnos",
  "/agente":                 "fichaje_qr",
  "/puestos-gps":            "fichaje_qr",
  "/supervisor-devices":     "fichaje_qr",
};

// Caché en memoria: rol → Set de modulo_claves permitidos (TTL 60s)
interface CacheEntry { modulos: Set<string>; expiresAt: number }
const permCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

export async function getPermisosForRol(rol: string): Promise<Set<string>> {
  const now = Date.now();
  const cached = permCache.get(rol);
  if (cached && cached.expiresAt > now) return cached.modulos;
  try {
    const { rows } = await pool.query(
      `SELECT modulo_clave FROM rol_permisos WHERE rol_clave = $1`,
      [rol]
    );
    const modulos = new Set<string>(rows.map((r: any) => r.modulo_clave));
    permCache.set(rol, { modulos, expiresAt: now + CACHE_TTL_MS });
    return modulos;
  } catch {
    return new Set();
  }
}

export function invalidatePermCache(rol?: string) {
  if (rol) {
    permCache.delete(rol);
  } else {
    permCache.clear();
  }
}

// Middleware Express — bloquea rutas según permisos del rol
export async function permisosMiddleware(req: any, res: any, next: any) {
  // Rutas que no requieren sesión de admin
  const skipPaths = ["/health", "/portal", "/wa", "/whatsapp", "/users/login",
    "/session/permisos", "/roles/modulos", "/roles"];
  if (skipPaths.some(p => req.path.startsWith(p))) return next();

  let session: { rol: string } | null = null;
  try {
    const raw = req.headers["x-isp-session"] as string;
    if (raw) session = JSON.parse(raw);
  } catch {
    return next();
  }

  if (!session) return next();
  // Admin siempre tiene acceso total
  if (session.rol === "admin") return next();

  // Determinar qué módulo corresponde a esta ruta
  let moduloClave: string | undefined;
  for (const [prefix, modulo] of Object.entries(ROUTE_MODULO_MAP)) {
    if (req.path === prefix || req.path.startsWith(prefix + "/") || req.path.startsWith(prefix + "?")) {
      moduloClave = modulo;
      break;
    }
  }

  // Si la ruta no está en el mapa, la dejamos pasar
  if (!moduloClave) return next();

  const permisos = await getPermisosForRol(session.rol);
  if (permisos.has(moduloClave)) return next();

  return res.status(403).json({
    error: "Acceso no autorizado a este módulo",
    modulo: moduloClave,
    rol: session.rol,
  });
}
