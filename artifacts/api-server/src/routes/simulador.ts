/**
 * SIMULADOR DE WHATSAPP — ISP, S.A.
 *
 * Endpoint que permite al administrador probar el comportamiento del bot
 * con diferentes tipos de usuarios, mensajes y perfiles, SIN necesidad
 * de conectar la API real de WhatsApp.
 *
 * ─── MODOS ────────────────────────────────────────────────────────────────
 *   persistir=false (default) — DRY RUN
 *     · Valida el número (real)
 *     · Clasifica el mensaje (real)
 *     · Detecta la intención y genera la respuesta
 *     · NO escribe nada en la base de datos
 *     · Ideal para demostraciones y pruebas sin efectos secundarios
 *
 *   persistir=true — EJECUCIÓN REAL
 *     · Todo lo anterior + SÍ crea registros reales en la DB
 *     · Útil para probar el flujo completo end-to-end
 *     · Registros marcados con canal="simulador_admin"
 *
 * ─── LÓGICA REUTILIZADA ───────────────────────────────────────────────────
 *   · validarNumeroWA() — misma lógica que el webhook real
 *   · classifyMessage() — mismo clasificador de intenciones
 *   · getWaMessage()   — mismo sistema de mensajes configurables
 *   · anticipo-session — mismas sesiones en memoria
 *   · Alias resolver   — busca alias de teléfono en la tabla alias
 *
 * ─── ENDPOINTS ────────────────────────────────────────────────────────────
 *   POST /api/simulador          → Procesa un mensaje simulado
 *   GET  /api/simulador/usuarios → Lista usuarios con teléfono
 *   DELETE /api/simulador/sesion → Limpia sesión de anticipo (por teléfono)
 */

import { Router } from "express";
import { pool, db, incidentsTable, applicationsTable, leadsTable } from "@workspace/db";
import {
  classifyMessage,
  extractPhoneFromWaId,
} from "../services/whatsapp/classifier";
import {
  getSession,
  iniciarAnticipo,
  continuarAnticipo,
  deleteSession,
} from "../services/whatsapp/anticipo-session";
import { getWaMessage } from "../services/whatsapp/wa-config.service";
import { logger } from "../lib/logger";

const router = Router();

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface DebugInfo {
  validacion: {
    telefono: string;
    autorizado: boolean;
    motivo: string | null;
  };
  usuario: {
    id: number | null;
    nombre: string | null;
    rol: string | null;
    estado: string | null;
    tieneTelefono: boolean;
  } | null;
  clasificacion: {
    intencion: string;
    mensajeOriginal: string;
  };
  sesion: {
    activa: boolean;
    estado: string | null;
  };
  entidad: {
    creada: boolean;
    tabla: string | null;
    id: string | number | null;
    dryRun: boolean;
  };
  alias: string | null;
  persistencia: "real" | "simulado";
  errores: string[];
  duracionMs: number;
}

interface SimularParams {
  telefono: string;
  nombre: string;
  mensaje: string;
  persistir: boolean;
  skipValidacion?: boolean;
}

interface SimularResult {
  respuesta: string | null;
  tipo: string;
  debug: DebugInfo;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizarTelefono(tel: string): string {
  return tel.replace(/[\s\-\(\)\+]/g, "");
}

async function buscarUsuarioPorTelefono(telefono: string) {
  const { rows } = await pool.query<{
    id: number;
    nombre: string;
    rol: string;
    estado: string;
    telefono: string;
  }>(
    `SELECT id, nombre, rol, estado, telefono FROM users WHERE telefono = $1 LIMIT 1`,
    [telefono]
  );
  return rows[0] ?? null;
}

async function generarIdIncidencia(): Promise<string> {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(2);
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `SIM-${yy}${mm}${dd}-${rand}`;
}

// ─── Función principal de simulación ─────────────────────────────────────────

async function simularMensaje(params: SimularParams): Promise<SimularResult> {
  const t0 = Date.now();
  const { nombre, mensaje, persistir, skipValidacion } = params;
  const telefono = normalizarTelefono(params.telefono);
  const errores: string[] = [];

  const debug: DebugInfo = {
    validacion: { telefono, autorizado: true, motivo: null },
    usuario: null,
    clasificacion: { intencion: "pendiente", mensajeOriginal: mensaje },
    sesion: { activa: false, estado: null },
    entidad: { creada: false, tabla: null, id: null, dryRun: !persistir },
    alias: null,
    persistencia: persistir ? "real" : "simulado",
    errores,
    duracionMs: 0,
  };

  // 1. Buscar usuario real por teléfono
  const usuario = await buscarUsuarioPorTelefono(telefono);
  if (usuario) {
    debug.usuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol,
      estado: usuario.estado,
      tieneTelefono: true,
    };
  } else {
    debug.usuario = {
      id: null,
      nombre: nombre,
      rol: "externo",
      estado: null,
      tieneTelefono: false,
    };
  }

  // 2. Validación de número (misma lógica que el webhook real)
  let respuestaBloqueo: string | null = null;

  if (!skipValidacion) {
    if (!usuario) {
      debug.validacion.autorizado = false;
      debug.validacion.motivo = "no_registrado";
      respuestaBloqueo = await getWaMessage(
        "acceso_no_autorizado",
        "⛔ Tu número no está autorizado para usar este sistema. Comunícate con ISP, S.A. para solicitar acceso."
      );
    } else if (usuario.estado !== "activo") {
      debug.validacion.autorizado = false;
      debug.validacion.motivo = "inactivo";
      respuestaBloqueo = await getWaMessage(
        "acceso_inactivo",
        "🚫 Tu acceso al sistema ha sido desactivado temporalmente. Contacta a tu supervisor."
      );
    }
  } else {
    debug.validacion.motivo = "omitido_skip";
  }

  if (respuestaBloqueo) {
    debug.clasificacion.intencion = debug.validacion.motivo ?? "bloqueado";
    debug.duracionMs = Date.now() - t0;
    return { respuesta: respuestaBloqueo, tipo: debug.validacion.motivo ?? "bloqueado", debug };
  }

  // 3. Buscar alias en service_locations / clients
  try {
    const aliasResult = await pool.query<{ alias: string; nombre: string }>(
      `SELECT alias, nombre FROM service_locations WHERE alias ILIKE $1 LIMIT 1`,
      [`%${mensaje.substring(0, 30)}%`]
    );
    if (aliasResult.rows[0]) {
      debug.alias = aliasResult.rows[0].nombre;
    }
  } catch {}

  // 4. Verificar sesión de anticipo activa
  const sesionActiva = getSession(telefono);
  if (sesionActiva) {
    debug.sesion.activa = true;
    debug.sesion.estado = sesionActiva.state;
    debug.clasificacion.intencion = "anticipo_sesion";

    const { respuesta, completada } = await continuarAnticipo(sesionActiva, mensaje);
    debug.entidad = {
      creada: completada,
      tabla: completada ? "anticipos" : null,
      id: null,
      dryRun: !persistir,
    };

    if (!persistir && completada) {
      // En dry-run, limpiar la sesión para que no quede contaminada
      deleteSession(telefono);
    }

    debug.duracionMs = Date.now() - t0;
    return { respuesta, tipo: "anticipo_sesion", debug };
  }

  // 5. Clasificar mensaje
  const intencion = classifyMessage(mensaje);
  debug.clasificacion.intencion = intencion;

  // 6. Procesar según intención
  let respuesta: string | null = null;
  let tipo = intencion;

  try {
    if (intencion === "anticipo") {
      // Anticipo: siempre inicia sesión (la sesión se almacena en memoria)
      // En dry-run la sesión se crea pero se limpia inmediatamente
      respuesta = await iniciarAnticipo(nombre, telefono);
      debug.clasificacion.intencion = "anticipo_inicio";
      tipo = "anticipo_inicio";

      if (!persistir) {
        // En dry-run: limpiar la sesión recién creada
        deleteSession(telefono);
        debug.entidad = { creada: false, tabla: "anticipos", id: null, dryRun: true };
      } else {
        debug.entidad = { creada: false, tabla: "anticipos", id: null, dryRun: false };
      }

    } else if (intencion === "incidencia") {
      const incidenciaRespuesta = await getWaMessage(
        "incidencia_registrada",
        "🚨 Incidencia recibida. Nuestro equipo fue notificado y tomará acción inmediata. ID de seguimiento: {id}"
      );

      if (persistir) {
        const id = await generarIdIncidencia();
        const inserted = await db.insert(incidentsTable).values({
          id,
          cliente: nombre,
          tipo: "Alerta WhatsApp",
          origen: "simulador_admin",
          ubicacion: "Por confirmar",
          prioridad: "alta",
          estado: "abierta",
          responsable: "Sin asignar",
          descripcion: `[SIM:${Date.now()}] ${mensaje}`,
        }).returning();
        debug.entidad = { creada: true, tabla: "incidentes", id: inserted[0].id, dryRun: false };
        respuesta = incidenciaRespuesta.replace("{id}", inserted[0].id);
      } else {
        const simId = await generarIdIncidencia();
        debug.entidad = { creada: false, tabla: "incidentes", id: simId + "(sim)", dryRun: true };
        respuesta = incidenciaRespuesta.replace("{id}", simId + "-SIM");
      }

    } else if (intencion === "postulacion") {
      const postulacionRespuesta = await getWaMessage(
        "postulacion_registrada",
        "✅ Tu solicitud fue registrada exitosamente. Te contactaremos en los próximos días para continuar el proceso."
      );

      if (persistir) {
        const inserted = await db.insert(applicationsTable).values({
          nombre,
          telefono,
          correo: null,
          experiencia: "Por evaluar",
          ubicacion: "Guatemala",
          puesto: "Agente de Seguridad",
          canal: "simulador_admin",
          notas: mensaje,
        }).returning();
        debug.entidad = { creada: true, tabla: "postulaciones", id: inserted[0].id, dryRun: false };
      } else {
        debug.entidad = { creada: false, tabla: "postulaciones", id: null, dryRun: true };
      }
      respuesta = postulacionRespuesta;

    } else {
      // Lead / sin coincidencia
      const leadRespuesta = await getWaMessage(
        "lead_registrado",
        "Gracias por contactarnos. Un ejecutivo de ISP, S.A. se comunicará con usted a la brevedad."
      );

      if (persistir) {
        const inserted = await db.insert(leadsTable).values({
          empresa: nombre,
          contacto: nombre,
          telefono,
          correo: null,
          servicio: "Por definir",
          ubicacion: "Guatemala",
          canal: "simulador_admin",
          notas: mensaje,
        }).returning();
        debug.entidad = { creada: true, tabla: "leads", id: inserted[0].id, dryRun: false };
      } else {
        debug.entidad = { creada: false, tabla: "leads", id: null, dryRun: true };
      }
      respuesta = leadRespuesta;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errores.push(msg);
    logger.error({ err }, "[Simulador] Error procesando intención");
  }

  debug.duracionMs = Date.now() - t0;
  return { respuesta, tipo, debug };
}

// ─── POST /api/simulador ──────────────────────────────────────────────────────
router.post("/simulador", async (req, res) => {
  try {
    const {
      telefono,
      nombre = "Simulado",
      mensaje,
      persistir = false,
      skipValidacion = false,
    } = req.body;

    if (!telefono?.trim()) return res.status(400).json({ error: "El teléfono es obligatorio" });
    if (!mensaje?.trim()) return res.status(400).json({ error: "El mensaje es obligatorio" });

    const result = await simularMensaje({
      telefono: telefono.trim(),
      nombre: nombre.trim(),
      mensaje: mensaje.trim(),
      persistir: Boolean(persistir),
      skipValidacion: Boolean(skipValidacion),
    });

    logger.info({
      telefono,
      intencion: result.debug.clasificacion.intencion,
      persistir,
      duracionMs: result.debug.duracionMs,
    }, "[Simulador] Mensaje procesado");

    res.json(result);
  } catch (err) {
    logger.error({ err }, "[Simulador] Error inesperado");
    res.status(500).json({ error: "Error al simular mensaje" });
  }
});

// ─── GET /api/simulador/usuarios ──────────────────────────────────────────────
// Lista usuarios del sistema para el selector del simulador
router.get("/simulador/usuarios", async (_req, res) => {
  try {
    const { rows } = await pool.query<{
      id: number;
      nombre: string;
      rol: string;
      telefono: string | null;
      estado: string;
    }>(
      `SELECT id, nombre, rol, telefono, estado
       FROM users
       WHERE estado = 'activo'
       ORDER BY nombre ASC`
    );
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "[Simulador] Error al listar usuarios");
    res.status(500).json({ error: "Error al listar usuarios" });
  }
});

// ─── DELETE /api/simulador/sesion ─────────────────────────────────────────────
// Limpia la sesión de anticipo activa para un número (útil en el simulador)
router.delete("/simulador/sesion", async (req, res) => {
  try {
    const { telefono } = req.body;
    if (!telefono) return res.status(400).json({ error: "Teléfono requerido" });
    const tel = normalizarTelefono(telefono);
    deleteSession(tel);
    logger.info({ telefono: tel }, "[Simulador] Sesión anticipo limpiada");
    res.json({ ok: true, telefono: tel });
  } catch (err) {
    logger.error({ err }, "[Simulador] Error limpiando sesión");
    res.status(500).json({ error: "Error al limpiar sesión" });
  }
});

export default router;
