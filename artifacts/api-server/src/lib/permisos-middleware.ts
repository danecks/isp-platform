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
  "/igss":                   "igss_planilla",
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
  "/qr-rondas":              "control_qr",
  "/agente/tokens":          "carnets_qr",
  "/agente":                 "control_qr",
  "/municion-puestos":       "control_qr",
  "/bodega-solicitudes":     "control_qr",
  "/arma-ordenes-servicio":  "control_qr",
  "/puestos-gps":            "control_qr",
  "/supervisor-devices":     "control_qr",
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
  "/barracas":               "barracas",
  "/amonestaciones":         "amonestaciones",
};

// Caché en memoria: username → { rol, modulos, expiresAt } (TTL 30s)
// Cacheamos por USERNAME (no por rol) para reflejar cambios de rol sin reiniciar sesión
interface CacheEntry { rol: string; modulos: Set<string>; expiresAt: number }
const permCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

export async function getPermisosForRol(rol: string): Promise<Set<string>> {
  try {
    const { rows } = await pool.query(
      `SELECT modulo_clave FROM rol_permisos WHERE rol_clave = $1`,
      [rol]
    );
    return new Set<string>(rows.map((r: any) => r.modulo_clave));
  } catch {
    return new Set();
  }
}

// Nueva función: obtiene permisos por USERNAME (consulta rol actual desde BD)
async function getPermisosForUsername(username: string): Promise<{ rol: string; modulos: Set<string> }> {
  const now = Date.now();
  const cached = permCache.get(username);
  if (cached && cached.expiresAt > now) return { rol: cached.rol, modulos: cached.modulos };
  try {
    const userRow = await pool.query(
      `SELECT rol FROM users WHERE username = $1 AND estado = 'activo'`,
      [username]
    );
    if (userRow.rows.length === 0) return { rol: "", modulos: new Set() };
    const rol: string = userRow.rows[0].rol;
    let modulos: Set<string>;
    if (rol === "admin") {
      modulos = new Set(["*"]); // admin: acceso total (marcador especial)
    } else {
      const { rows } = await pool.query(
        `SELECT modulo_clave FROM rol_permisos WHERE rol_clave = $1`,
        [rol]
      );
      modulos = new Set<string>(rows.map((r: any) => r.modulo_clave));
    }
    permCache.set(username, { rol, modulos, expiresAt: now + CACHE_TTL_MS });
    return { rol, modulos };
  } catch {
    return { rol: "", modulos: new Set() };
  }
}

export function invalidatePermCache(username?: string) {
  if (username) {
    permCache.delete(username);
  } else {
    permCache.clear();
  }
}

// Middleware Express — bloquea rutas según permisos del rol ACTUAL en BD
export async function permisosMiddleware(req: any, res: any, next: any) {
  // Rutas que no requieren sesión de admin
  const skipPaths = ["/health", "/portal", "/wa", "/whatsapp", "/users/login",
    "/session/permisos", "/roles/modulos", "/roles"];
  if (skipPaths.some(p => req.path.startsWith(p))) return next();

  let session: { rol: string; username?: string } | null = null;
  try {
    const raw = req.headers["x-isp-session"] as string;
    if (raw) session = JSON.parse(raw);
  } catch {
    return next();
  }

  if (!session) return next();

  // Determinar qué módulo corresponde a esta ruta.
  // Elegimos SIEMPRE el prefijo más largo (más específico) para que
  // mapeos como "/agente/tokens" ganen sobre "/agente".
  let moduloClave: string | undefined;
  let mejorPrefijo = -1;
  for (const [prefix, modulo] of Object.entries(ROUTE_MODULO_MAP)) {
    if (req.path === prefix || req.path.startsWith(prefix + "/") || req.path.startsWith(prefix + "?")) {
      if (prefix.length > mejorPrefijo) {
        mejorPrefijo = prefix.length;
        moduloClave = modulo;
      }
    }
  }

  // Si la ruta no está en el mapa, la dejamos pasar
  if (!moduloClave) return next();

  // Si hay username en la sesión, verificar rol ACTUAL desde BD (evita sesión desactualizada)
  if (session.username) {
    const { rol, modulos } = await getPermisosForUsername(session.username);
    if (rol === "admin" || modulos.has("*") || modulos.has(moduloClave)) return next();
    return res.status(403).json({
      error: "Acceso no autorizado a este módulo",
      modulo: moduloClave,
      rol,
    });
  }

  // Fallback: verificar por rol de sesión (compatibilidad con sesiones sin username)
  if (session.rol === "admin") return next();
  const permisos = await getPermisosForRol(session.rol);
  if (permisos.has(moduloClave)) return next();

  return res.status(403).json({
    error: "Acceso no autorizado a este módulo",
    modulo: moduloClave,
    rol: session.rol,
  });
}
