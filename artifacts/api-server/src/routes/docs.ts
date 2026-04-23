import { Router, type IRouter } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";

const docsRouter: IRouter = Router();

// Resuelve el directorio /docs del monorepo subiendo desde process.cwd()
// hasta encontrarlo. Funciona tanto en dev (cwd=artifacts/api-server) como
// en producción (cwd puede variar).
async function findDocsDir(): Promise<string | null> {
  const candidates = [
    path.resolve(process.cwd(), "docs"),
    path.resolve(process.cwd(), "..", "docs"),
    path.resolve(process.cwd(), "..", "..", "docs"),
    path.resolve(process.cwd(), "..", "..", "..", "docs"),
  ];
  for (const c of candidates) {
    try {
      const stat = await fs.stat(c);
      if (stat.isDirectory()) return c;
    } catch {
      /* sigue */
    }
  }
  return null;
}

interface DocItem {
  slug: string;
  title: string;
  order: number;
}

function tituloDesdeNombre(nombre: string): string {
  // "01-manual-usuario.md" -> "Manual Usuario"
  const sinExt = nombre.replace(/\.md$/i, "");
  const sinPrefijo = sinExt.replace(/^\d+[-_]?/, "");
  return sinPrefijo
    .split(/[-_]+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function ordenDesdeNombre(nombre: string): number {
  const m = nombre.match(/^(\d+)/);
  if (m) return parseInt(m[1], 10);
  if (nombre.toLowerCase().startsWith("readme")) return -1;
  return 999;
}

// GET /api/docs — lista todos los documentos
docsRouter.get("/docs", async (_req, res) => {
  try {
    const dir = await findDocsDir();
    if (!dir) return res.status(404).json({ error: "Directorio docs/ no encontrado" });

    const archivos = await fs.readdir(dir);
    const items: DocItem[] = archivos
      .filter((f) => f.toLowerCase().endsWith(".md"))
      .map((f) => ({
        slug: f.replace(/\.md$/i, ""),
        title: tituloDesdeNombre(f),
        order: ordenDesdeNombre(f),
      }))
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "es"));

    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: "Error al listar documentación", detail: String(err) });
  }
});

// GET /api/docs/:slug — devuelve el markdown crudo
docsRouter.get("/docs/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug || "");
    // Sanitizar: solo letras, números, guion y guion bajo
    if (!/^[A-Za-z0-9_-]+$/.test(slug)) {
      return res.status(400).json({ error: "Slug inválido" });
    }
    const dir = await findDocsDir();
    if (!dir) return res.status(404).json({ error: "Directorio docs/ no encontrado" });

    const filePath = path.resolve(dir, `${slug}.md`);
    // Garantizar que no escape del directorio docs/
    if (!filePath.startsWith(dir + path.sep) && filePath !== path.join(dir, `${slug}.md`)) {
      return res.status(400).json({ error: "Ruta inválida" });
    }
    const content = await fs.readFile(filePath, "utf-8");
    res.type("text/markdown; charset=utf-8").send(content);
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "ENOENT") {
      return res.status(404).json({ error: "Documento no encontrado" });
    }
    res.status(500).json({ error: "Error al leer documento", detail: String(err) });
  }
});

export default docsRouter;
