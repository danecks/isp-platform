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
  "/personal-slots":         "pizarron",
  "/supervision-programaciones": "supervision",
  "/supervision-zonas":      "supervision",
  "/supervision-dashboard":  "supervision",
  "/supervision-plan-mensual": "supervision",
  "/supervision-reportes":   "supervision",
  "/personal/empleados":     "pizarron",
  "/solicitudes-turno":      "pizarron",
  "/planificacion-futura":   "pizarron",
  "/qr-rondas":              "control_qr",
  "/agente/tokens":          "carnets_qr",
  "/agente":                 "control_qr",
  "/admin/visitas":          "control_qr",          // visitas: admin/operaciones/supervisor (handler valida rol internamente)
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
  "/wa-config":              "simulador_wa",
  // ── Hardening 2026-04-25: rutas que antes pasaban por fail-open ──────────
  "/users":                  "usuarios",
  "/clientes":               "clientes",
  "/clientes-lista":         "clientes",
  "/sedes":                  "clientes",
  "/admin":                  "usuarios",            // /admin/reset-* — handlers validan rol=admin internamente
  "/actas":                  "eventos_rrhh",
  "/alias":                  "pizarron",
  "/config-empresa":         "usuarios",            // PUT/POST/etc → solo admin. (GET tiene override abajo: cualquier sesión válida.)
  "/empleados":              "empleados",           // alias en español de /employees
  "/puestos":                "pizarron",
  "/rentabilidad":           "reportes",
  "/rrhh":                   "eventos_rrhh",        // /rrhh/eventos, /rrhh/alertas, /rrhh/incidencias, /rrhh/horas-extra
  "/slots":                  "pizarron",
  "/solicitudes-cambio":     "pizarron",
  "/solicitudes-empleo":     "kiosco_solicitudes",  // los POST públicos viven en isPublicPath
  "/docs":                   "usuarios",            // documentación interna admin
  // Push notifications (TASK #52). Por defecto sólo admin/operaciones pueden
  // enviar push de prueba, ver tokens de otros usuarios o re-disparar
  // emergencias. La excepción son los endpoints que el APK del usuario llama
  // para registrar/borrar SU propio token, manejados en isPublicPath con
  // override de método (cualquier sesión válida basta — el handler valida
  // que el userId del body == sesión).
  "/push":                   "usuarios",
};

// Rutas públicas legítimas (login, webhooks, portal, healthcheck).
// Matcheo PRECISO: exacto o con prefijo + "/" — evita coincidencias accidentales
// como "/wa" matcheando "/wa-config" o "/roles" matcheando "/roles/:clave".
// Algunas rutas son públicas SOLO para ciertos métodos (formularios web).
function isPublicPath(path: string, method: string): boolean {
  // Coincidencias exactas (cualquier método)
  switch (path) {
    case "/healthz":
    case "/health":
    case "/auth/login":
    case "/auth/change-password":     // valida sesión internamente
    case "/session/permisos":          // necesario para que el frontend cargue módulos del usuario
    case "/roles/modulos":             // catálogo de módulos para UI de permisos
      return true;
  }
  // CMS: solo el contenido publicado de cada página es público (el sitio lo consume
  // por page_key). El listado /cms/pages incluye borradores y metadata interna
  // (status, updated_by) → queda como admin vía ROUTE_MODULO_MAP("/cms").
  if (method === "GET" && path.startsWith("/cms/pages/")) return true;
  // Prefijos seguros: el path debe ser exactamente el prefijo o seguir con "/"
  const safePrefixes = [
    "/portal",            // tiene su propio middleware requirePortalAuth
    "/webhooks/whatsapp", // webhook de Meta — sin sesión por diseño
  ];
  if (safePrefixes.some(p => path === p || path.startsWith(p + "/"))) return true;

  // Formularios web públicos: solo POST a la raíz del recurso
  // (GET/PATCH/DELETE quedan como admin a través de ROUTE_MODULO_MAP)
  if (method === "POST" && (path === "/leads" || path === "/applications")) return true;

  // ── Hardening 2026-04-25: kiosco/anticipos/actualización-datos públicos ──
  // Páginas /kiosco, /solicitar-anticipo, /actualizacion-datos consumen
  // estos endpoints sin sesión admin. Cada handler valida internamente
  // (DPI, captura del kiosco, etc.).
  if (method === "POST" && (
    path === "/anticipos" ||                         // /solicitar-anticipo: enviar solicitud
    path === "/empleados/upload-foto" ||             // /solicitar-anticipo: subir foto del DPI
    path === "/solicitudes-empleo" ||                // /kiosco: enviar solicitud completa
    path === "/solicitudes-empleo/foto" ||           // /kiosco, /actualizacion-datos: subir foto
    path === "/solicitudes-empleo/extraer-dpi" ||    // /kiosco, /solicitar-anticipo, /actualizacion-datos: OCR del DPI
    path === "/solicitudes-empleo/verificar-pin" ||  // /kiosco: validar PIN
    path === "/solicitudes-empleo/telemetria"        // /kiosco: telemetría de uso
  )) return true;

  // GETs públicos para formularios públicos (lookup por DPI, configs visibles)
  if (method === "GET" && (
    /^\/employees\/by-dpi\/[^/]+$/.test(path) ||             // /solicitar-anticipo, /actualizacion-datos
    /^\/solicitudes-empleo\/by-dpi\/[^/]+$/.test(path) ||    // /kiosco: validar si DPI ya postuló
    path === "/anticipos/config" ||                          // /solicitar-anticipo: config visible al usuario
    /^\/anticipos\/limite\/\d+$/.test(path)                  // /solicitar-anticipo: límite del solicitante
  )) return true;

  // PATCH público para que el empleado actualice sus propios datos desde /actualizacion-datos
  // (el handler ya está marcado como "actualización pública de datos (kiosco)")
  if (method === "PATCH" && /^\/employees\/\d+\/self-update$/.test(path)) return true;

  // ── PWA del agente / activación de supervisor ────────────────────────────
  // Estos endpoints se consumen SIN sesión admin desde páginas públicas:
  //   /agente (AgenteEscaneo), /agente/inicio (AgenteInicio),
  //   /ronda (RondaGuardia), /supervisor/activar (SupervisorActivar).
  // Cada handler valida internamente su propio token (qr_token, device_token,
  // employee_id), por lo que el middleware no debe pedir sesión admin aquí.

  // GET /api/agente/scan/:token  — info al escanear el carnet QR del agente
  // POST /api/agente/scan/:token/incidencia — reportar incidencia desde QR
  if (path === "/agente/scan" || path.startsWith("/agente/scan/")) return true;

  // GET /api/qr-rondas/scan/:token y POST /api/qr-rondas/scan
  // (página pública /ronda escanea puntos de ronda — handler valida token)
  if (path === "/qr-rondas/scan" || path.startsWith("/qr-rondas/scan/")) return true;

  // GET /api/agente/co-custodios/:fichaje_id — handler exige tracking_token
  if (method === "GET" && /^\/agente\/co-custodios\/\d+$/.test(path)) return true;

  // GET /api/agente/rondas-del-puesto/:fichaje_id — handler exige tracking_token
  if (method === "GET" && /^\/agente\/rondas-del-puesto\/\d+$/.test(path)) return true;

  // GET /api/agente/turnos-activos-del-puesto/:fichaje_id — handler exige tracking_token
  if (method === "GET" && /^\/agente\/turnos-activos-del-puesto\/\d+$/.test(path)) return true;

  // POST /api/agente/cerrar-turno-verificado — handler exige tracking_token + carnet
  if (method === "POST" && path === "/agente/cerrar-turno-verificado") return true;

  // POST /api/agente/marcar-ronda-puesto — handler exige tracking_token de sesión kiosco
  if (method === "POST" && path === "/agente/marcar-ronda-puesto") return true;

  // Visitas-puesto desde teléfono fijo del puesto: handlers exigen tracking_token
  if (method === "POST" && (
    path === "/agente/visitas-puesto/extraer-dpi" ||
    path === "/agente/visitas-puesto/foto" ||
    path === "/agente/visitas-puesto/entrada" ||
    path === "/agente/visitas-puesto/salida"
  )) return true;
  if (method === "GET" && /^\/agente\/visitas-puesto\/abiertas\/\d+$/.test(path)) return true;

  // GETs públicos del agente (modo kiosco / equipo asignado por puesto)
  if (method === "GET" && (
    path === "/agente/puesto-del-dia" ||
    /^\/agente\/puesto\/\d+\/equipo-asignado$/.test(path)
  )) return true;

  // PWA del supervisor — Fase B + C. Todo POST con credenciales en body
  // (device_uuid + device_token + qr_token); cada handler valida la identidad.
  if (method === "POST" && (
    path === "/agente/supervision/mi-agenda" ||
    path === "/agente/supervision/iniciar" ||
    path === "/agente/supervision/completar" ||
    path === "/agente/supervision/no-realizada" ||
    // Fase C: jornada del supervisor (clock-in/out + GPS continuo)
    path === "/agente/supervision/jornada/estado" ||
    path === "/agente/supervision/jornada/clock-in" ||
    path === "/agente/supervision/jornada/clock-out" ||
    path === "/agente/supervision/jornada/gps" ||
    // Fase C: inspección de agentes desde el teléfono del supervisor
    path === "/agente/supervision/inspeccion/agente-info" ||
    path === "/agente/supervision/inspeccion/registrar" ||
    // Fase C: novedad consolidada de jornada
    path === "/agente/supervision/novedad/generar" ||
    // Fase C: visita por-puesto sin escanear QR del agente (carnets pendientes)
    path === "/agente/supervision/visita/agentes" ||
    path === "/agente/supervision/visita/completar-con-novedad"
  )) return true;

  // POSTs públicos de la PWA del agente y validación de supervisor-device
  const agentePublicPosts = new Set([
    "/agente/fichaje",
    "/agente/iniciar-turno",
    "/agente/cerrar-turno",
    "/agente/recorrido-ping",
    "/agente/supervision",
    "/agente/ronda-check",
    "/agente/reporte-turno",
    "/supervisor-devices/validate",
  ]);
  if (method === "POST" && agentePublicPosts.has(path)) return true;

  // POST /api/agente/reporte-turno/:reporteId/equipo — adjuntar equipo al reporte
  if (method === "POST" && path.startsWith("/agente/reporte-turno/")) return true;

  // ── Visitas (entradas/salidas) — handlers validan device/cliente internamente ──
  // Agente PWA: /agente/visitas/{abiertas,foto,extraer-dpi,entrada,salida}
  // Cada handler usa validarDeviceQuery/validarDeviceBody (device_uuid + sha256(token)).
  if (path === "/agente/visitas" || path.startsWith("/agente/visitas/")) return true;
  // Portal cliente: /portal-cliente/visitas[/estadisticas]
  // Handler usa requireCliente que valida x-isp-userid + vínculo usuarios_clientes.
  if (method === "GET" && (path === "/portal-cliente/visitas" || path.startsWith("/portal-cliente/visitas/"))) return true;

  return false;
}

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
export async function getPermisosForUsername(username: string): Promise<{ rol: string; modulos: Set<string> }> {
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
  // Rutas legítimamente públicas (login, webhooks, portal, healthcheck)
  if (isPublicPath(req.path, req.method)) return next();

  let session: { rol: string; username?: string } | null = null;
  let sessionMalformed = false;
  try {
    const raw = req.headers["x-isp-session"] as string;
    if (raw) session = JSON.parse(raw);
  } catch {
    sessionMalformed = true;
  }

  // Header presente pero JSON inválido → bloquear (no asumir anónimo)
  if (sessionMalformed) {
    return res.status(401).json({ error: "Sesión inválida" });
  }

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

  // ── HARDENING 2026-04-25: fail-closed ────────────────────────────────────
  // Sin sesión y la ruta no está en isPublicPath → 401 SIEMPRE.
  // (Antes: las rutas no catalogadas pasaban por fail-open y exponían datos.
  // Ej: /api/users devolvía 200 sin sesión por no estar en ROUTE_MODULO_MAP.)
  if (!session) {
    return res.status(401).json({
      error: "Sesión requerida",
      modulo: moduloClave ?? null,
    });
  }

  // ── Overrides de método ──────────────────────────────────────────────────
  // GET /config-empresa: cualquier sesión válida puede LEER la configuración
  // global (RRHH la usa para generar contratos/actas/avisos). Las escrituras
  // siguen restringidas al módulo "usuarios" (admin) vía ROUTE_MODULO_MAP.
  if (req.method === "GET" && req.path === "/config-empresa") return next();

  // Push notifications — el APK de cada usuario registra/borra SU token
  // contra el servidor. Cualquier sesión válida puede hacerlo; el handler
  // verifica que el userId del body coincida con la sesión. El resto de
  // /push/* (test, listado, re-envío de emergencia, status) queda
  // restringido al módulo "usuarios" (admin) vía ROUTE_MODULO_MAP.
  if (req.method === "POST" && req.path === "/push/tokens") return next();
  if (req.method === "DELETE" && req.path.startsWith("/push/tokens/")) return next();

  // Sesión válida + ruta sin módulo asociado → dejar pasar
  // (rutas internas no catalogadas, basta con que la sesión sea válida)
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
