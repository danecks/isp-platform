/**
 * EMERGENCIAS SERVICE — ISP, S.A.
 *
 * Servicio centralizado para el flujo de emergencias vía WhatsApp.
 *
 * FUNCIONES PRINCIPALES:
 *   esTextoEmergencia(texto)   — detecta si un mensaje activa el flujo
 *   puedeReportarEmergencia(usuario) — valida permiso del usuario
 *   crearEmergencia(datos)     — crea la incidencia con marca de emergencia
 *
 * INTEGRACIÓN CON ALIAS:
 *   Usa resolverAlias() para mapear texto libre → cliente/puesto.
 *   Si hay ambigüedad, devuelve las opciones para que el bot pida confirmación.
 *
 * ROLES CON PERMISO POR DEFECTO:
 *   admin, operaciones, supervisor
 *
 * ROLES QUE REQUIEREN canReportEmergency=true:
 *   cliente, rrhh, comercial
 *
 * PARA INTEGRAR CON WHATSAPP WEBHOOK (fase siguiente):
 *   1. Detectar mensaje: if (esTextoEmergencia(msg.body)) startEmergencyFlow(from)
 *   2. Validar usuario: if (!puedeReportarEmergencia(user)) sendNoAuthorizado()
 *   3. Resolver alias: resolverAlias(ubicacionTexto)
 *   4. Crear incidencia: crearEmergencia({ ... })
 */

import { db, incidentsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { resolverAlias, type ResolverResult } from "../alias/resolver";

// ─── Palabras clave que activan el flujo de emergencia ───────────────────────

export const PALABRAS_EMERGENCIA = [
  "emergencia",
  "auxilio",
  "ayuda",
  "apoyo urgente",
  "apoyo inmediato",
  "robo",
  "asalto",
  "incidente armado",
  "intrusion",
  "intrusión",
  "alerta",
  "alerta roja",
  "sos",
  "socorro",
  "herido",
  "disparo",
  "disparos",
  "violencia",
  "amenaza",
  "evacuacion",
  "evacuación",
  "incendio",
];

// ─── Tipos de emergencia editables ──────────────────────────────────────────

export const TIPOS_EMERGENCIA_DEFAULT = [
  { id: "robo",            label: "Robo / Asalto" },
  { id: "intrusion",       label: "Intrusión no autorizada" },
  { id: "incidente_armado", label: "Incidente armado" },
  { id: "emergencia_medica", label: "Emergencia médica" },
  { id: "incendio",        label: "Incendio" },
  { id: "evacuacion",      label: "Evacuación" },
  { id: "disturbio",       label: "Disturbio / Altercado" },
  { id: "otro",            label: "Otro (especificar)" },
];

// ─── Normalización interna ───────────────────────────────────────────────────

function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Detección de emergencia ─────────────────────────────────────────────────

/**
 * Detecta si el texto del mensaje activa el flujo de emergencia.
 * @returns { esEmergencia, palabraClave } — la palabra que lo activó (si hay)
 */
export function esTextoEmergencia(texto: string): { esEmergencia: boolean; palabraClave: string | null } {
  const norm = normalizarTexto(texto);
  for (const palabra of PALABRAS_EMERGENCIA) {
    const normPalabra = normalizarTexto(palabra);
    if (norm === normPalabra || norm.includes(normPalabra)) {
      return { esEmergencia: true, palabraClave: palabra };
    }
  }
  return { esEmergencia: false, palabraClave: null };
}

// ─── Validación de permiso ───────────────────────────────────────────────────

const ROLES_CON_PERMISO_BASE = ["admin", "operaciones", "supervisor", "guardia"];

export interface PermisoEmergencia {
  autorizado: boolean;
  razon: string;
}

/**
 * Evalúa si un usuario del sistema puede reportar emergencias.
 * Recibe el objeto del usuario de la BD (o partial).
 */
export function puedeReportarEmergencia(usuario: {
  rol: string;
  estado: string;
  canReportEmergency?: boolean | null;
}): PermisoEmergencia {
  if (usuario.estado !== "activo") {
    return { autorizado: false, razon: "Usuario inactivo" };
  }

  // Permiso explícito en BD (sobreescribe regla de rol)
  if (usuario.canReportEmergency === true) {
    return { autorizado: true, razon: "Permiso explícito habilitado" };
  }
  if (usuario.canReportEmergency === false) {
    return { autorizado: false, razon: "Permiso explícito deshabilitado" };
  }

  // Null = derivar del rol
  if (ROLES_CON_PERMISO_BASE.includes(usuario.rol)) {
    return { autorizado: true, razon: `Rol '${usuario.rol}' tiene permiso por defecto` };
  }

  return {
    autorizado: false,
    razon: `Rol '${usuario.rol}' no tiene permiso para reportar emergencias. Solicite habilitación al administrador.`,
  };
}

// ─── Creación de emergencia ──────────────────────────────────────────────────

function generarIdIncidencia(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(2);
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `INC-${yy}${mm}${dd}-${rand}`;
}

export interface DatosEmergencia {
  clienteNombre: string;           // Nombre del cliente (ya resuelto)
  clienteRefId?: string | null;    // ID de referencia del portal (si aplica)
  ubicacion: string;               // Texto de ubicación o alias ya resuelto
  tipoEmergencia: string;          // Tipo del catálogo (ej. "robo")
  descripcion: string;             // Descripción breve del evento
  reportadoPor: string;            // Nombre/teléfono del reportante
  origen?: string;                 // "whatsapp" | "manual" | etc.
}

/**
 * Crea una incidencia en la BD con marca de emergencia, prioridad urgente.
 */
export async function crearEmergencia(datos: DatosEmergencia) {
  const tipoLabel =
    TIPOS_EMERGENCIA_DEFAULT.find((t) => t.id === datos.tipoEmergencia)?.label ??
    datos.tipoEmergencia;

  const id = generarIdIncidencia();

  const [incidencia] = await db
    .insert(incidentsTable)
    .values({
      id,
      origen: datos.origen ?? "whatsapp",
      cliente: datos.clienteNombre,
      clienteRefId: datos.clienteRefId ?? null,
      ubicacion: datos.ubicacion,
      tipo: `Emergencia — ${tipoLabel}`,
      prioridad: "urgente",
      estado: "abierta",
      responsable: "Sin asignar",
      descripcion: datos.descripcion,
      esEmergencia: true,
      reportadoPor: datos.reportadoPor,
    })
    .returning();

  return incidencia;
}

// ─── Resolución de alias para emergencias ────────────────────────────────────

/**
 * Toma un texto libre (ej. "custodio gallo, zona 12") y resuelve cliente/puesto.
 * Devuelve el ResolverResult para que el consumidor decida si hay ambigüedad.
 */
export async function resolverUbicacionEmergencia(texto: string): Promise<ResolverResult> {
  return resolverAlias(texto);
}

// ─── Buscar usuario por teléfono (para WA webhook) ──────────────────────────

/**
 * Dado un número de teléfono (formato WA: 50299998888), busca el usuario en BD.
 * Útil para validar identidad antes de permitir reportar emergencia vía WA.
 */
export async function buscarUsuarioPorTelefono(telefono: string) {
  const tel = telefono.replace(/\D/g, "");
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.estado, "activo"));

  return rows.find((u) => {
    if (!u.telefono) return false;
    const uTel = u.telefono.replace(/\D/g, "");
    return uTel === tel || uTel.endsWith(tel) || tel.endsWith(uTel);
  }) ?? null;
}
