/**
 * ALIAS RESOLVER — ISP, S.A.
 *
 * Permite mapear texto libre (ingresado por agentes o guardias) a clientes
 * y puestos/rutas/servicios registrados en el sistema.
 *
 * DISEÑO:
 * - Input: texto libre, ej. "gallo", "custodio gallo", "ruta norte gallo"
 * - Output: lista de coincidencias ordenadas por confianza (0‒1)
 *
 * ALGORITMO DE PUNTUACIÓN:
 *   1.0 — coincidencia exacta con alias
 *   0.85 — uno contiene al otro (substring)
 *   0.70 — coincidencia parcial de palabras (≥ 1 palabra en común)
 *   0.50 — coincidencia del nombre legal/comercial del cliente
 *
 * AMBIGÜEDAD:
 *   Si hay más de un resultado con confianza ≥ 0.7, se devuelven todos.
 *   El consumidor (WhatsApp bot, formulario, etc.) decide cómo presentarlos.
 */

import { db } from "@workspace/db";
import {
  clientsTable,
  clientAliasesTable,
  serviceLocationsTable,
  positionAliasesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface AliasMatchCliente {
  tipo: "cliente";
  confianza: number;
  clienteId: number;
  nombre: string;
  nombreComercial: string | null;
  sector: string | null;
  estado: string;
  aliasCoincidente: string;
}

export interface AliasMatchPuesto {
  tipo: "puesto";
  confianza: number;
  puestoId: number;
  clienteId: number;
  clienteNombre: string;
  nombrePuesto: string;
  ubicacion: string | null;
  tipoPuesto: string;
  estado: string;
  aliasCoincidente: string;
}

export type AliasMatch = AliasMatchCliente | AliasMatchPuesto;

export interface ResolverResult {
  input: string;
  inputNormalizado: string;
  totalCoincidencias: number;
  confianzaMaxima: number;
  ambiguo: boolean;           // true si hay más de una coincidencia ≥ 0.7
  resultados: AliasMatch[];
  sugerencia: string | null;  // texto descriptivo para el usuario final
}

// ─── Normalización ────────────────────────────────────────────────────────────

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // strip accents
    .replace(/[^a-z0-9\s]/g, " ")     // remove punctuation
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Puntuación de coincidencia ───────────────────────────────────────────────

export function scoreMatch(input: string, candidate: string): number {
  const i = normalize(input);
  const c = normalize(candidate);

  if (!i || !c) return 0;

  // Exacta
  if (i === c) return 1.0;

  // Substring directo
  if (i.startsWith(c) || c.startsWith(i)) return 0.88;
  if (i.includes(c) || c.includes(i)) return 0.78;

  // Coincidencia por palabras individuales
  const iWords = new Set(i.split(" ").filter((w) => w.length >= 3));
  const cWords = new Set(c.split(" ").filter((w) => w.length >= 3));
  if (iWords.size === 0 || cWords.size === 0) return 0;

  let matching = 0;
  for (const w of iWords) {
    if (cWords.has(w)) matching++;
    else {
      // Coincidencia parcial de palabra (substring de 4+ chars)
      for (const cw of cWords) {
        if (w.length >= 4 && cw.includes(w)) { matching += 0.6; break; }
        if (cw.length >= 4 && w.includes(cw)) { matching += 0.6; break; }
      }
    }
  }

  if (matching === 0) return 0;
  const ratio = matching / Math.max(iWords.size, cWords.size);
  return 0.40 + ratio * 0.30;
}

// ─── Función principal ────────────────────────────────────────────────────────

export async function resolverAlias(input: string): Promise<ResolverResult> {
  const inputNorm = normalize(input);
  const resultados: AliasMatch[] = [];

  // ── 1. Buscar en alias de clientes ──────────────────────────────────────────
  const clientAliases = await db
    .select({
      aliasId: clientAliasesTable.id,
      alias: clientAliasesTable.alias,
      tipoAlias: clientAliasesTable.tipoAlias,
      clientId: clientsTable.id,
      nombre: clientsTable.nombre,
      nombreComercial: clientsTable.nombreComercial,
      sector: clientsTable.sector,
      estado: clientsTable.estado,
    })
    .from(clientAliasesTable)
    .innerJoin(clientsTable, eq(clientAliasesTable.clientId, clientsTable.id))
    .where(eq(clientsTable.estado, "activo"));

  const seenClientIds = new Set<number>();

  for (const row of clientAliases) {
    const score = scoreMatch(input, row.alias);
    if (score >= 0.4 && !seenClientIds.has(row.clientId)) {
      seenClientIds.add(row.clientId);
      resultados.push({
        tipo: "cliente",
        confianza: score,
        clienteId: row.clientId,
        nombre: row.nombre,
        nombreComercial: row.nombreComercial,
        sector: row.sector,
        estado: row.estado,
        aliasCoincidente: row.alias,
      });
    } else if (score >= 0.4 && seenClientIds.has(row.clientId)) {
      // Si el nuevo alias tiene mayor confianza, actualizar
      const idx = resultados.findIndex(
        (r) => r.tipo === "cliente" && (r as AliasMatchCliente).clienteId === row.clientId
      );
      if (idx !== -1 && score > resultados[idx].confianza) {
        (resultados[idx] as AliasMatchCliente).confianza = score;
        (resultados[idx] as AliasMatchCliente).aliasCoincidente = row.alias;
      }
    }
  }

  // También buscar por nombre legal/comercial del cliente (confianza reducida)
  const clientsByName = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.estado, "activo"));

  for (const c of clientsByName) {
    if (seenClientIds.has(c.id)) continue;
    const scoreNombre = scoreMatch(input, c.nombre);
    const scoreComercial = c.nombreComercial ? scoreMatch(input, c.nombreComercial) : 0;
    const best = Math.max(scoreNombre, scoreComercial) * 0.85; // penalización leve
    if (best >= 0.4) {
      seenClientIds.add(c.id);
      resultados.push({
        tipo: "cliente",
        confianza: best,
        clienteId: c.id,
        nombre: c.nombre,
        nombreComercial: c.nombreComercial,
        sector: c.sector,
        estado: c.estado,
        aliasCoincidente: scoreNombre >= scoreComercial ? c.nombre : (c.nombreComercial ?? c.nombre),
      });
    }
  }

  // ── 2. Buscar en alias de puestos ────────────────────────────────────────────
  const positionAliases = await db
    .select({
      aliasId: positionAliasesTable.id,
      alias: positionAliasesTable.alias,
      puestoId: serviceLocationsTable.id,
      clientId: serviceLocationsTable.clientId,
      nombrePuesto: serviceLocationsTable.nombrePuesto,
      ubicacion: serviceLocationsTable.ubicacion,
      tipo: serviceLocationsTable.tipo,
      estadoPuesto: serviceLocationsTable.estado,
      clienteNombre: clientsTable.nombre,
    })
    .from(positionAliasesTable)
    .innerJoin(serviceLocationsTable, eq(positionAliasesTable.puestoId, serviceLocationsTable.id))
    .innerJoin(clientsTable, eq(serviceLocationsTable.clientId, clientsTable.id))
    .where(eq(serviceLocationsTable.estado, "activo"));

  const seenPuestoIds = new Set<number>();

  for (const row of positionAliases) {
    const score = scoreMatch(input, row.alias);
    if (score >= 0.4 && !seenPuestoIds.has(row.puestoId)) {
      seenPuestoIds.add(row.puestoId);
      resultados.push({
        tipo: "puesto",
        confianza: score,
        puestoId: row.puestoId,
        clienteId: row.clientId,
        clienteNombre: row.clienteNombre,
        nombrePuesto: row.nombrePuesto,
        ubicacion: row.ubicacion,
        tipoPuesto: row.tipo,
        estado: row.estadoPuesto,
        aliasCoincidente: row.alias,
      });
    } else if (score >= 0.4 && seenPuestoIds.has(row.puestoId)) {
      const idx = resultados.findIndex(
        (r) => r.tipo === "puesto" && (r as AliasMatchPuesto).puestoId === row.puestoId
      );
      if (idx !== -1 && score > resultados[idx].confianza) {
        (resultados[idx] as AliasMatchPuesto).confianza = score;
        (resultados[idx] as AliasMatchPuesto).aliasCoincidente = row.alias;
      }
    }
  }

  // ── 3. Ordenar y calcular resultado ─────────────────────────────────────────
  resultados.sort((a, b) => b.confianza - a.confianza);

  const UMBRAL_AMBIGUEDAD = 0.7;
  const altosPuntaje = resultados.filter((r) => r.confianza >= UMBRAL_AMBIGUEDAD);
  const ambiguo = altosPuntaje.length > 1;
  const confianzaMaxima = resultados[0]?.confianza ?? 0;

  // Sugerencia textual
  let sugerencia: string | null = null;
  if (resultados.length === 0) {
    sugerencia = `No se encontró ningún cliente o puesto que coincida con "${input}". Verifique el alias o agréguelo al sistema.`;
  } else if (ambiguo) {
    sugerencia = `Se encontraron ${altosPuntaje.length} coincidencias para "${input}". Por favor especifique más: ${altosPuntaje.map((r) => r.tipo === "cliente" ? (r as AliasMatchCliente).nombreComercial || (r as AliasMatchCliente).nombre : (r as AliasMatchPuesto).nombrePuesto).join(", ")}.`;
  } else {
    const top = resultados[0];
    if (top.tipo === "cliente") {
      const c = top as AliasMatchCliente;
      sugerencia = `Cliente encontrado: ${c.nombreComercial || c.nombre} (confianza ${Math.round(c.confianza * 100)}%)`;
    } else {
      const p = top as AliasMatchPuesto;
      sugerencia = `Puesto encontrado: ${p.nombrePuesto} — ${p.clienteNombre} (confianza ${Math.round(p.confianza * 100)}%)`;
    }
  }

  return {
    input,
    inputNormalizado: inputNorm,
    totalCoincidencias: resultados.length,
    confianzaMaxima,
    ambiguo,
    resultados,
    sugerencia,
  };
}
