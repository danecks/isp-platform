/**
 * importacion.ts — Importación masiva de datos desde CSV
 *
 * ENDPOINTS:
 *   POST /api/importacion/colaboradores   → Importar empleados
 *   POST /api/importacion/puestos         → Importar puestos operativos
 *   POST /api/importacion/articulos       → Importar artículos de bodega
 *
 * Cada endpoint acepta:
 *   { rows: Record<string,string>[], preview: boolean }
 *   Si preview=true: valida y devuelve resultados sin guardar nada en BD.
 *   Si preview=false: valida + guarda fila a fila, devuelve resumen.
 */

import { Router } from "express";
import { pool } from "@workspace/db";

export const importacionRouter = Router();

// ── Auth guard básico ──────────────────────────────────────────────────────────
function requireAdmin(req: any, res: any): { nombre: string; rol: string } | null {
  try {
    const raw = req.headers["x-isp-session"] as string;
    const session = JSON.parse(raw);
    if (!["admin"].includes(session.rol)) {
      res.status(403).json({ error: "Solo administradores pueden importar datos" });
      return null;
    }
    return session;
  } catch {
    res.status(401).json({ error: "Sesión inválida" });
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function trim(v: any): string {
  return String(v ?? "").trim();
}
function parseDate(v: string): string | null {
  if (!v) return null;
  // Acepta YYYY-MM-DD o DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [d, m, y] = v.split("/");
    return `${y}-${m}-${d}`;
  }
  return null;
}

type RowResult = {
  fila: number;
  estado: "ok" | "error" | "omitido";
  mensaje?: string;
  datos?: Record<string, any>;
};

// ─── POST /api/importacion/colaboradores ─────────────────────────────────────
importacionRouter.post("/importacion/colaboradores", async (req, res) => {
  const session = requireAdmin(req, res);
  if (!session) return;

  const { rows, preview = false }: { rows: Record<string, string>[]; preview: boolean } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "No hay filas para importar" });
  }

  const results: RowResult[] = [];
  let exitosos = 0;
  let errores = 0;
  let omitidos = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const fila = i + 2; // +2 porque fila 1 = encabezados, empezamos en 2

    const nombre = trim(row["nombre_completo"] ?? row["nombre"]);
    if (!nombre) {
      results.push({ fila, estado: "error", mensaje: "nombre_completo es obligatorio" });
      errores++;
      continue;
    }

    const dpi      = trim(row["dpi"]);
    const telefono = trim(row["telefono"]);
    const correo   = trim(row["correo"]);
    const puesto   = trim(row["puesto"]);
    const area     = trim(row["area"]);
    const sede     = trim(row["sede"]);
    const tipoSrv  = trim(row["tipo_servicio"]);
    const notas    = trim(row["notas"]);

    const rawEstado = trim(row["estado_laboral"]).toLowerCase();
    const estadoLaboral = ["activo", "inactivo", "suspendido"].includes(rawEstado)
      ? rawEstado : "activo";

    const fechaIngreso = parseDate(trim(row["fecha_ingreso"]));

    // Verificar DPI duplicado si se proporcionó
    if (dpi) {
      const { rows: dup } = await pool.query(
        `SELECT id FROM employees WHERE dpi = $1 LIMIT 1`,
        [dpi]
      );
      if (dup.length > 0) {
        results.push({
          fila,
          estado: "omitido",
          mensaje: `DPI ${dpi} ya existe en el sistema (ID ${dup[0].id})`,
        });
        omitidos++;
        continue;
      }
    }

    const datos = {
      nombre_completo: nombre,
      dpi:             dpi   || null,
      telefono:        telefono || null,
      correo:          correo   || null,
      puesto:          puesto   || null,
      area:            area     || null,
      sede:            sede     || null,
      tipo_servicio:   tipoSrv  || null,
      notas:           notas    || null,
      estado_laboral:  estadoLaboral,
      fecha_ingreso:   fechaIngreso,
    };

    if (preview) {
      results.push({ fila, estado: "ok", datos });
      exitosos++;
      continue;
    }

    try {
      await pool.query(
        `INSERT INTO employees
           (nombre_completo, dpi, telefono, correo, puesto, area, sede,
            tipo_servicio, notas, estado_laboral, fecha_ingreso, source_system, sync_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'importacion_csv','manual')`,
        [nombre, dpi||null, telefono||null, correo||null, puesto||null,
         area||null, sede||null, tipoSrv||null, notas||null,
         estadoLaboral, fechaIngreso]
      );
      results.push({ fila, estado: "ok", datos: { nombre } });
      exitosos++;
    } catch (e: any) {
      results.push({ fila, estado: "error", mensaje: e.message });
      errores++;
    }
  }

  res.json({ preview, exitosos, errores, omitidos, total: rows.length, resultados: results });
});

// ─── POST /api/importacion/puestos ───────────────────────────────────────────
importacionRouter.post("/importacion/puestos", async (req, res) => {
  const session = requireAdmin(req, res);
  if (!session) return;

  const { rows, preview = false }: { rows: Record<string, string>[]; preview: boolean } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "No hay filas para importar" });
  }

  const results: RowResult[] = [];
  let exitosos = 0;
  let errores = 0;
  let omitidos = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const fila = i + 2;

    const nombre       = trim(row["nombre"]);
    const clienteNombre = trim(row["cliente_nombre"] ?? row["cliente"]);

    if (!nombre) {
      results.push({ fila, estado: "error", mensaje: "nombre es obligatorio" });
      errores++;
      continue;
    }
    if (!clienteNombre) {
      results.push({ fila, estado: "error", mensaje: "cliente_nombre es obligatorio" });
      errores++;
      continue;
    }

    const rawTurno = trim(row["turno"]).toLowerCase();
    const turno = ["día", "dia", "noche", "mixto"].includes(rawTurno)
      ? (rawTurno === "dia" ? "día" : rawTurno)
      : "día";

    const horario  = trim(row["horario"]) || null;
    const jornada  = trim(row["jornada"]) || null;
    const notas    = trim(row["notas"])   || null;
    const cantRaw  = parseInt(trim(row["cantidad_contratada"]) || "1");
    const cantidad = isNaN(cantRaw) ? 1 : Math.max(1, cantRaw);
    const costoRaw = parseFloat(trim(row["costo_hora"]) || "0");
    const costoHora = isNaN(costoRaw) ? null : costoRaw;

    // Verificar si ya existe el mismo puesto con el mismo cliente
    if (!preview) {
      const { rows: dup } = await pool.query(
        `SELECT id FROM puestos_operativos WHERE nombre = $1 AND cliente_nombre = $2 LIMIT 1`,
        [nombre, clienteNombre]
      );
      if (dup.length > 0) {
        results.push({
          fila,
          estado: "omitido",
          mensaje: `Puesto "${nombre}" para "${clienteNombre}" ya existe (ID ${dup[0].id})`,
        });
        omitidos++;
        continue;
      }
    }

    const datos = {
      nombre,
      cliente_nombre: clienteNombre,
      turno,
      horario,
      jornada,
      cantidad_contratada: cantidad,
      costo_hora: costoHora,
      notas,
    };

    if (preview) {
      results.push({ fila, estado: "ok", datos });
      exitosos++;
      continue;
    }

    try {
      await pool.query(
        `INSERT INTO puestos_operativos
           (nombre, cliente_nombre, turno, horario, jornada,
            cantidad_contratada, costo_hora, notas, estado, activo, orden)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'descubierto',TRUE,0)`,
        [nombre, clienteNombre, turno, horario, jornada, cantidad, costoHora, notas]
      );
      results.push({ fila, estado: "ok", datos: { nombre, clienteNombre } });
      exitosos++;
    } catch (e: any) {
      results.push({ fila, estado: "error", mensaje: e.message });
      errores++;
    }
  }

  res.json({ preview, exitosos, errores, omitidos, total: rows.length, resultados: results });
});

// ─── POST /api/importacion/articulos ─────────────────────────────────────────
importacionRouter.post("/importacion/articulos", async (req, res) => {
  const session = requireAdmin(req, res);
  if (!session) return;

  const { rows, preview = false }: { rows: Record<string, string>[]; preview: boolean } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "No hay filas para importar" });
  }

  const results: RowResult[] = [];
  let exitosos = 0;
  let errores = 0;
  let omitidos = 0;

  // Cache de categorías creadas en esta importación
  const catCache: Record<string, number> = {};

  // Pre-cargar categorías existentes
  const { rows: catExistentes } = await pool.query(
    `SELECT id, nombre FROM bodega_categorias`
  );
  for (const c of catExistentes) {
    catCache[String(c.nombre).toLowerCase()] = c.id;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const fila = i + 2;

    const nombre   = trim(row["nombre"]);
    const prefijo  = trim(row["codigo_prefijo"]).toUpperCase().substring(0, 6);
    const catNombre = trim(row["categoria"] ?? row["categoria_nombre"]);

    if (!nombre) {
      results.push({ fila, estado: "error", mensaje: "nombre es obligatorio" });
      errores++;
      continue;
    }
    if (!prefijo) {
      results.push({ fila, estado: "error", mensaje: "codigo_prefijo es obligatorio" });
      errores++;
      continue;
    }

    const rawTipoRastreo = trim(row["tipo_rastreo"]).toLowerCase();
    const tipoRastreo = ["seriado", "lote", "sin_rastreo"].includes(rawTipoRastreo)
      ? rawTipoRastreo : "seriado";

    const rawTipoAsig = trim(row["tipo_asignacion"]).toLowerCase();
    const tipoAsignacion = ["colaborador", "puesto", "ambos"].includes(rawTipoAsig)
      ? rawTipoAsig : "colaborador";

    const descripcion = trim(row["descripcion"]) || null;

    // Resolver/crear categoría
    let categoriaId: number | null = null;
    if (catNombre) {
      const key = catNombre.toLowerCase();
      if (catCache[key]) {
        categoriaId = catCache[key];
      } else if (!preview) {
        const { rows: newCat } = await pool.query(
          `INSERT INTO bodega_categorias (nombre) VALUES ($1) ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id`,
          [catNombre]
        );
        categoriaId = newCat[0].id;
        catCache[key] = categoriaId;
      }
    }

    // Verificar duplicado por nombre
    if (!preview) {
      const { rows: dup } = await pool.query(
        `SELECT id FROM bodega_articulos WHERE nombre = $1 LIMIT 1`,
        [nombre]
      );
      if (dup.length > 0) {
        results.push({
          fila,
          estado: "omitido",
          mensaje: `Artículo "${nombre}" ya existe (ID ${dup[0].id})`,
        });
        omitidos++;
        continue;
      }
    }

    const datos = {
      nombre,
      codigo_prefijo: prefijo,
      categoria: catNombre || "(sin categoría)",
      tipo_rastreo: tipoRastreo,
      tipo_asignacion: tipoAsignacion,
      descripcion,
    };

    if (preview) {
      results.push({ fila, estado: "ok", datos });
      exitosos++;
      continue;
    }

    try {
      await pool.query(
        `INSERT INTO bodega_articulos
           (nombre, descripcion, codigo_prefijo, tipo_rastreo, tipo_asignacion, categoria_id, activo)
         VALUES ($1,$2,$3,$4,$5,$6,TRUE)`,
        [nombre, descripcion, prefijo, tipoRastreo, tipoAsignacion, categoriaId]
      );
      results.push({ fila, estado: "ok", datos: { nombre } });
      exitosos++;
    } catch (e: any) {
      results.push({ fila, estado: "error", mensaje: e.message });
      errores++;
    }
  }

  res.json({ preview, exitosos, errores, omitidos, total: rows.length, resultados: results });
});

// ── POST /importacion/armas ────────────────────────────────────────────────────
importacionRouter.post("/importacion/armas", async (req: any, res: any) => {
  const session = requireAdmin(req, res);
  if (!session) return;

  const { rows, preview } = req.body as {
    rows: Record<string, string>[];
    preview: boolean;
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "No hay filas para importar" });
  }

  let autoCodeBase = 0;
  if (!preview) {
    const { rows: cnt } = await pool.query(`SELECT COUNT(*)::int AS n FROM armas`);
    autoCodeBase = cnt[0].n;
  }

  const results: any[] = [];
  let exitosos = 0, errores = 0, omitidos = 0;
  const TIPOS_VALIDOS = ["pistola", "revolver", "escopeta", "fusil", "subametralladora", "otro"];
  const ESTADOS_VALIDOS = ["activo", "inactivo", "baja", "mantenimiento", "disponible", "asignada"];
  let autoIdx = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const fila = i + 2;

    const rawTipo = trim(row["tipo"]).toLowerCase();
    const tipo = TIPOS_VALIDOS.includes(rawTipo) ? rawTipo : (rawTipo || "pistola");

    let codigo = trim(row["codigo"]).toUpperCase();
    if (!codigo) {
      autoIdx++;
      const n = String(autoCodeBase + autoIdx).padStart(3, "0");
      const prefix = tipo.slice(0, 4).toUpperCase();
      codigo = `${prefix}-${n}`;
    }

    const marca          = trim(row["marca"])   || null;
    const modelo         = trim(row["modelo"])  || null;
    const calibre        = trim(row["calibre"]) || null;
    const serie          = trim(row["serie"])   || null;
    const rawEstado      = trim(row["estado"]).toLowerCase();
    const estado         = ESTADOS_VALIDOS.includes(rawEstado) ? rawEstado : "activo";
    const numeroTenencia = trim(row["numero_tenencia"]) || null;
    const rawFecha       = trim(row["fecha_vencimiento_tenencia"]);
    const fechaVence     = rawFecha ? parseDate(rawFecha) : null;
    const observaciones  = trim(row["observaciones"]) || null;

    const datos = { codigo, tipo, marca, modelo, calibre, serie, estado,
                    numero_tenencia: numeroTenencia,
                    fecha_vencimiento_tenencia: fechaVence, observaciones };

    if (preview) {
      results.push({ fila, estado: "ok", datos });
      exitosos++;
      continue;
    }

    const { rows: dupCodigo } = await pool.query(
      `SELECT id FROM armas WHERE codigo = $1 LIMIT 1`, [codigo]
    );
    if (dupCodigo.length > 0) {
      results.push({ fila, estado: "omitido",
        mensaje: `Código "${codigo}" ya existe (ID ${dupCodigo[0].id})` });
      omitidos++;
      continue;
    }

    if (serie) {
      const { rows: dupSerie } = await pool.query(
        `SELECT id, codigo FROM armas WHERE serie = $1 LIMIT 1`, [serie]
      );
      if (dupSerie.length > 0) {
        results.push({ fila, estado: "omitido",
          mensaje: `No. serie "${serie}" ya existe (arma ${dupSerie[0].codigo})` });
        omitidos++;
        continue;
      }
    }

    try {
      await pool.query(
        `INSERT INTO armas
           (codigo, tipo, marca, modelo, calibre, serie, estado, activo,
            numero_tenencia, fecha_vencimiento_tenencia, observaciones)
         VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9,$10)`,
        [codigo, tipo, marca, modelo, calibre, serie, estado,
         numeroTenencia, fechaVence, observaciones]
      );
      results.push({ fila, estado: "ok", datos: { codigo, tipo, marca } });
      exitosos++;
    } catch (e: any) {
      results.push({ fila, estado: "error", mensaje: e.message });
      errores++;
    }
  }

  res.json({ preview, exitosos, errores, omitidos, total: rows.length, resultados: results });
});
