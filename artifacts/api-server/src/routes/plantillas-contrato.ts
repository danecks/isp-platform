import { Router, type Request, type Response } from "express";
import { db, plantillasContratoTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  plantillaDefault,
  PLANTILLA_INICIAL_DEFAULT,
  PLANTILLA_POSTPRUEBA_DEFAULT,
  VARIABLES_DISPONIBLES,
  type ClausulaPlantilla,
  type PlantillaContratoDefault,
} from "../lib/plantillas-contrato-default";

const router = Router();

const TIPOS_VALIDOS = ["inicial", "post_prueba"] as const;
type TipoPlantilla = (typeof TIPOS_VALIDOS)[number];

function tipoValido(t: string): t is TipoPlantilla {
  return (TIPOS_VALIDOS as readonly string[]).includes(t);
}

interface SesionInfo {
  username?: string;
  rol?: string;
}

function leerSesion(req: Request): SesionInfo {
  try {
    const raw = req.headers["x-isp-session"] as string | undefined;
    if (!raw) return {};
    const s = JSON.parse(raw);
    return { username: s.username ?? s.usuario, rol: s.rol };
  } catch {
    return {};
  }
}

function esAdmin(s: SesionInfo): boolean {
  const r = (s.rol ?? "").toLowerCase();
  return r === "admin" || r === "super_admin" || r === "rrhh" || s.username === "dan2336";
}

// Asegura que existe una versión activa para el tipo. Si no existe, inserta
// la plantilla por defecto como versión 1 activa.
async function asegurarPlantilla(tipo: TipoPlantilla) {
  const filas = await db
    .select()
    .from(plantillasContratoTable)
    .where(and(eq(plantillasContratoTable.tipo, tipo), eq(plantillasContratoTable.activa, true)))
    .limit(1);
  if (filas.length > 0) return filas[0];

  const def = plantillaDefault(tipo);
  const [insertada] = await db
    .insert(plantillasContratoTable)
    .values({
      tipo,
      version: 1,
      activa: true,
      titulo: def.titulo,
      subtitulo: def.subtitulo,
      encabezado: def.encabezado,
      clausulas: JSON.stringify(def.clausulas),
      cierre: def.cierre,
      createdBy: "system-seed",
    })
    .returning();
  logger.info(`Plantilla de contrato '${tipo}' inicializada con default v1`);
  return insertada;
}

function serializar(fila: typeof plantillasContratoTable.$inferSelect) {
  let clausulas: ClausulaPlantilla[] = [];
  try {
    clausulas = JSON.parse(fila.clausulas);
  } catch (e) {
    logger.warn(`Plantilla #${fila.id} tiene cláusulas inválidas`);
  }
  return {
    id: fila.id,
    tipo: fila.tipo,
    version: fila.version,
    activa: fila.activa,
    titulo: fila.titulo,
    subtitulo: fila.subtitulo,
    encabezado: fila.encabezado,
    clausulas,
    cierre: fila.cierre,
    notas: fila.notas,
    createdBy: fila.createdBy,
    createdAt: fila.createdAt,
    updatedAt: fila.updatedAt,
  };
}

// ──────────────────────────────────────────────────────────────────────
// GET /plantillas-contrato/variables
// ──────────────────────────────────────────────────────────────────────
router.get("/plantillas-contrato/variables", (_req, res) => {
  res.json({ variables: VARIABLES_DISPONIBLES });
});

// ──────────────────────────────────────────────────────────────────────
// GET /plantillas-contrato/:tipo/activa
// (lectura: cualquier sesión válida puede leerla, la usa el PDF)
// ──────────────────────────────────────────────────────────────────────
router.get("/plantillas-contrato/:tipo/activa", async (req, res) => {
  const tipo = req.params.tipo;
  if (!tipoValido(tipo)) return res.status(400).json({ error: "tipo inválido" });
  try {
    const fila = await asegurarPlantilla(tipo);
    res.json(serializar(fila));
  } catch (e) {
    logger.error("plantillas-contrato GET activa error", e);
    res.status(500).json({ error: "error interno" });
  }
});

// ──────────────────────────────────────────────────────────────────────
// GET /plantillas-contrato/:tipo/versiones
// ──────────────────────────────────────────────────────────────────────
router.get("/plantillas-contrato/:tipo/versiones", async (req, res) => {
  const sesion = leerSesion(req);
  if (!esAdmin(sesion)) return res.status(403).json({ error: "no autorizado" });
  const tipo = req.params.tipo;
  if (!tipoValido(tipo)) return res.status(400).json({ error: "tipo inválido" });
  try {
    await asegurarPlantilla(tipo);
    const filas = await db
      .select()
      .from(plantillasContratoTable)
      .where(eq(plantillasContratoTable.tipo, tipo))
      .orderBy(desc(plantillasContratoTable.version));
    res.json({ versiones: filas.map(serializar) });
  } catch (e) {
    logger.error("plantillas-contrato GET versiones error", e);
    res.status(500).json({ error: "error interno" });
  }
});

// ──────────────────────────────────────────────────────────────────────
// PUT /plantillas-contrato/:tipo
// Crea nueva versión (version = max+1) y la marca activa.
// ──────────────────────────────────────────────────────────────────────
router.put("/plantillas-contrato/:tipo", async (req, res) => {
  const sesion = leerSesion(req);
  if (!esAdmin(sesion)) return res.status(403).json({ error: "no autorizado" });
  const tipo = req.params.tipo;
  if (!tipoValido(tipo)) return res.status(400).json({ error: "tipo inválido" });

  const { titulo, subtitulo, encabezado, clausulas, cierre, notas } = req.body ?? {};

  // Validaciones básicas
  if (typeof encabezado !== "string" || !encabezado.trim()) {
    return res.status(400).json({ error: "encabezado requerido" });
  }
  if (typeof cierre !== "string" || !cierre.trim()) {
    return res.status(400).json({ error: "cierre requerido" });
  }
  if (!Array.isArray(clausulas) || clausulas.length === 0) {
    return res.status(400).json({ error: "debe haber al menos una cláusula" });
  }
  for (const [i, c] of clausulas.entries()) {
    if (!c || typeof c.numero !== "string" || typeof c.titulo !== "string" || typeof c.contenido !== "string") {
      return res.status(400).json({ error: `cláusula #${i + 1} mal formada` });
    }
    if (!c.contenido.trim()) {
      return res.status(400).json({ error: `cláusula "${c.titulo || c.numero}" tiene contenido vacío` });
    }
  }

  try {
    // Atomicidad: cálculo de versión + desactivación previa + insert nuevo
    // todo en una transacción. Si falla cualquier paso no quedamos sin
    // plantilla activa.
    const def = plantillaDefault(tipo);
    const creada = await db.transaction(async (tx) => {
      const previas = await tx
        .select({ version: plantillasContratoTable.version })
        .from(plantillasContratoTable)
        .where(eq(plantillasContratoTable.tipo, tipo))
        .orderBy(desc(plantillasContratoTable.version))
        .limit(1);
      const nuevaVersion = (previas[0]?.version ?? 0) + 1;
      await tx
        .update(plantillasContratoTable)
        .set({ activa: false, updatedAt: new Date() })
        .where(and(eq(plantillasContratoTable.tipo, tipo), eq(plantillasContratoTable.activa, true)));
      const [fila] = await tx
        .insert(plantillasContratoTable)
        .values({
          tipo,
          version: nuevaVersion,
          activa: true,
          titulo: typeof titulo === "string" && titulo.trim() ? titulo : def.titulo,
          subtitulo: typeof subtitulo === "string" ? subtitulo : def.subtitulo,
          encabezado,
          clausulas: JSON.stringify(clausulas),
          cierre,
          notas: typeof notas === "string" ? notas : null,
          createdBy: sesion.username ?? null,
        })
        .returning();
      return fila;
    });
    logger.info(
      `Plantilla contrato '${tipo}' guardada v${creada.version} por ${sesion.username ?? "?"}`,
    );
    res.json(serializar(creada));
  } catch (e) {
    logger.error("plantillas-contrato PUT error", e);
    res.status(500).json({ error: "error interno" });
  }
});

// ──────────────────────────────────────────────────────────────────────
// POST /plantillas-contrato/:tipo/restaurar/:version
// Marca una versión vieja como activa (no crea nueva fila).
// ──────────────────────────────────────────────────────────────────────
router.post("/plantillas-contrato/:tipo/restaurar/:version", async (req, res) => {
  const sesion = leerSesion(req);
  if (!esAdmin(sesion)) return res.status(403).json({ error: "no autorizado" });
  const tipo = req.params.tipo;
  if (!tipoValido(tipo)) return res.status(400).json({ error: "tipo inválido" });
  const version = parseInt(req.params.version, 10);
  if (!Number.isFinite(version) || version <= 0) {
    return res.status(400).json({ error: "versión inválida" });
  }
  try {
    const filas = await db
      .select()
      .from(plantillasContratoTable)
      .where(and(eq(plantillasContratoTable.tipo, tipo), eq(plantillasContratoTable.version, version)))
      .limit(1);
    if (filas.length === 0) return res.status(404).json({ error: "versión no encontrada" });

    await db
      .update(plantillasContratoTable)
      .set({ activa: false, updatedAt: new Date() })
      .where(and(eq(plantillasContratoTable.tipo, tipo), eq(plantillasContratoTable.activa, true)));
    await db
      .update(plantillasContratoTable)
      .set({ activa: true, updatedAt: new Date() })
      .where(eq(plantillasContratoTable.id, filas[0].id));
    logger.info(`Plantilla '${tipo}' v${version} restaurada por ${sesion.username ?? "?"}`);
    const activada = await db
      .select()
      .from(plantillasContratoTable)
      .where(eq(plantillasContratoTable.id, filas[0].id))
      .limit(1);
    res.json(serializar(activada[0]));
  } catch (e) {
    logger.error("plantillas-contrato restaurar error", e);
    res.status(500).json({ error: "error interno" });
  }
});

// ──────────────────────────────────────────────────────────────────────
// POST /plantillas-contrato/:tipo/reset-default
// Crea una nueva versión que es exactamente la plantilla original
// hardcodeada y la marca activa. No borra historial.
// ──────────────────────────────────────────────────────────────────────
router.post("/plantillas-contrato/:tipo/reset-default", async (req, res) => {
  const sesion = leerSesion(req);
  if (!esAdmin(sesion)) return res.status(403).json({ error: "no autorizado" });
  const tipo = req.params.tipo;
  if (!tipoValido(tipo)) return res.status(400).json({ error: "tipo inválido" });
  try {
    const def: PlantillaContratoDefault =
      tipo === "inicial" ? PLANTILLA_INICIAL_DEFAULT : PLANTILLA_POSTPRUEBA_DEFAULT;
    const creada = await db.transaction(async (tx) => {
      const previas = await tx
        .select({ version: plantillasContratoTable.version })
        .from(plantillasContratoTable)
        .where(eq(plantillasContratoTable.tipo, tipo))
        .orderBy(desc(plantillasContratoTable.version))
        .limit(1);
      const nuevaVersion = (previas[0]?.version ?? 0) + 1;
      await tx
        .update(plantillasContratoTable)
        .set({ activa: false, updatedAt: new Date() })
        .where(and(eq(plantillasContratoTable.tipo, tipo), eq(plantillasContratoTable.activa, true)));
      const [fila] = await tx
        .insert(plantillasContratoTable)
        .values({
          tipo,
          version: nuevaVersion,
          activa: true,
          titulo: def.titulo,
          subtitulo: def.subtitulo,
          encabezado: def.encabezado,
          clausulas: JSON.stringify(def.clausulas),
          cierre: def.cierre,
          notas: `Restaurado a default por ${sesion.username ?? "?"}`,
          createdBy: sesion.username ?? null,
        })
        .returning();
      return fila;
    });
    logger.info(`Plantilla '${tipo}' reseteada a default v${creada.version}`);
    res.json(serializar(creada));
  } catch (e) {
    logger.error("plantillas-contrato reset-default error", e);
    res.status(500).json({ error: "error interno" });
  }
});

export default router;
