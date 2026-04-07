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

// ─── POST /api/importacion/sistema-antiguo ────────────────────────────────────
// Importa empleados desde el Excel del sistema anterior (columnas empl_*)
// Mapeo automático + detección DPI duplicado con opción de actualizar
importacionRouter.post("/importacion/sistema-antiguo", async (req: any, res: any) => {
  const session = requireAdmin(req, res);
  if (!session) return;

  const {
    rows,
    preview = false,
    actualizar_existentes = false,
  }: { rows: Record<string, any>[]; preview: boolean; actualizar_existentes: boolean } = req.body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "No hay filas para importar" });
  }

  // Mapa de bancos del sistema antiguo
  const BANCOS: Record<string, string> = {
    B001: "Banco de Guatemala",
    B002: "BAM (Banco Agromercantil)",
    B003: "Banrural",
    B004: "Banco de Crédito",
    B005: "Banco Promerica",
    B006: "Banco Industrial",
    B007: "G&T Continental",
    B008: "Banco Azteca",
    B009: "Banpaís",
    B010: "Banco Reformador",
  };

  // Convierte número serial de Excel a fecha ISO (YYYY-MM-DD)
  function excelSerial(v: any): string | null {
    const n = Number(v);
    if (!n || isNaN(n) || n < 1) return null;
    const ms = Date.UTC(1899, 11, 30) + n * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }

  // Nivel educativo más alto
  function nivelEducativo(row: Record<string, any>): string | null {
    const yn = (v: any) => String(v ?? "").trim().toUpperCase() === "S";
    if (yn(row.empl_universitario))  return "universitario";
    if (yn(row.empl_diversificado))  return "diversificado";
    if (yn(row.empl_secundaria))     return "secundaria";
    if (yn(row.empl_primaria))       return "primaria";
    return null;
  }

  const results: RowResult[] = [];
  let exitosos = 0, errores = 0, omitidos = 0, actualizados = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const fila = i + 2;

    // ── Construir nombre completo ───────────────────────────────────────────────
    const partes = [
      trim(row.empl_pnombre),
      trim(row.empl_snombre),
      trim(row.empl_papellido),
      trim(row.empl_sapellido),
      trim(row.empl_apecasada),
    ].filter(Boolean);
    const nombre_completo = partes.join(" ");

    if (!nombre_completo) {
      results.push({ fila, estado: "error", mensaje: "No se pudo construir nombre_completo" });
      errores++;
      continue;
    }

    // ── Mapear campos ───────────────────────────────────────────────────────────
    const dpi             = trim(row.empl_dpi)    || null;
    const telefono        = trim(row.empl_telefono) || null;
    const correo          = trim(row.empl_correo)   || null;
    const direccion       = trim(row.empl_direccion) || null;
    const nit             = trim(row.empl_nonit) === "CF" ? null : (trim(row.empl_nonit) || null);
    const igss_numero     = trim(row.empl_noigss)  || null;
    const fecha_nacimiento = excelSerial(row.empl_fechanac);
    const fecha_ingreso   = excelSerial(row.empl_fechaalta);
    const fecha_baja      = row.empl_fechabaja ? excelSerial(row.empl_fechabaja) : null;

    const sexo = (String(row.empl_sexo ?? "").trim().toUpperCase() === "M") ? "M"
               : (String(row.empl_sexo ?? "").trim().toUpperCase() === "F") ? "F" : null;

    const CIVIL_MAP: Record<string, string> = {
      S: "soltero", C: "casado", D: "divorciado", V: "viudo", U: "union_libre",
    };
    const estado_civil = CIVIL_MAP[String(row.empl_estcivil ?? "").trim().toUpperCase()] ?? null;

    const forma_pago = String(row.empl_formapago ?? "").trim().toUpperCase() === "D" ? "deposito"
                     : String(row.empl_formapago ?? "").trim().toUpperCase() === "C" ? "cheque" : null;
    const banco          = (BANCOS[String(row.ban_codigo ?? "").trim()] ?? trim(row.ban_codigo)) || null;
    const cuenta_bancaria = trim(row.empl_ctaban) || null;

    const num_dependencias = parseInt(String(row.empl_dependencias ?? "0"), 10) || 0;
    const nivel_educativo  = nivelEducativo(row);

    const CONDICION_MAP: Record<string, string> = { P: "permanente", T: "temporal" };
    const condicion_laboral = CONDICION_MAP[String(row.empl_condlaboral ?? "P").trim().toUpperCase()] ?? "permanente";

    const empl_numero = parseInt(String(row.empl_numero ?? ""), 10) || null;

    // Estado laboral
    const rawEstatus = String(row.empl_estatus ?? "").trim().toUpperCase();
    const estado_laboral = rawEstatus === "A" ? "activo" : "baja";

    // Depto código legacy → resolver cliente_id si ya existe en clients
    const depto_codigo_legacy = trim(row.depto_codigo) || null;
    let cliente_id: number | null = null;
    let cliente_nombre_match: string | null = null;
    if (depto_codigo_legacy) {
      const { rows: cliRows } = await pool.query(
        `SELECT id, nombre FROM clients WHERE depto_codigo = $1 LIMIT 1`,
        [depto_codigo_legacy]
      );
      if (cliRows.length > 0) {
        cliente_id = cliRows[0].id;
        cliente_nombre_match = cliRows[0].nombre;
      }
    }

    // Sin cliente (ej. código 004 = administración interna) → disponible para asignación
    const tipo_personal = cliente_id ? "guardia" : "disponible";

    const datos: Record<string, any> = {
      nombre_completo, dpi, telefono, correo, direccion, nit,
      igss_numero, fecha_nacimiento, fecha_ingreso, fecha_baja,
      sexo, estado_civil, forma_pago, banco, cuenta_bancaria,
      num_dependencias, nivel_educativo, condicion_laboral,
      empl_numero, estado_laboral, depto_codigo_legacy,
      tipo_personal,
      cliente: cliente_nombre_match ?? (cliente_id ? `ID ${cliente_id}` : depto_codigo_legacy ?? "—"),
    };

    // ── Detección DPI duplicado ─────────────────────────────────────────────────
    if (dpi) {
      const { rows: dup } = await pool.query(
        `SELECT id, nombre_completo, estado_laboral FROM employees WHERE dpi = $1 LIMIT 1`,
        [dpi]
      );
      if (dup.length > 0) {
        if (!actualizar_existentes) {
          results.push({
            fila,
            estado: "omitido",
            mensaje: `DPI ${dpi} ya existe → ${dup[0].nombre_completo} (ID ${dup[0].id}, estado: ${dup[0].estado_laboral}). Activa "actualizar existentes" para reactivar.`,
            datos,
          });
          omitidos++;
          continue;
        }

        // Actualizar (reactivar) colaborador existente
        if (!preview) {
          try {
            await pool.query(
              `UPDATE employees SET
                nombre_completo      = $2,
                telefono             = COALESCE($3, telefono),
                correo               = COALESCE($4, correo),
                direccion            = COALESCE($5, direccion),
                nit                  = COALESCE($6, nit),
                fecha_nacimiento     = COALESCE($7, fecha_nacimiento),
                fecha_ingreso        = COALESCE($8, fecha_ingreso),
                sexo                 = COALESCE($9, sexo),
                estado_civil         = COALESCE($10, estado_civil),
                forma_pago           = COALESCE($11, forma_pago),
                banco                = COALESCE($12, banco),
                cuenta_bancaria      = COALESCE($13, cuenta_bancaria),
                num_dependencias     = $14,
                nivel_educativo      = COALESCE($15, nivel_educativo),
                condicion_laboral    = $16,
                empl_numero          = COALESCE($17, empl_numero),
                estado_laboral       = $18,
                igss_numero          = COALESCE($19, igss_numero),
                depto_codigo_legacy  = COALESCE($20, depto_codigo_legacy),
                cliente_id           = COALESCE($21, cliente_id),
                tipo_personal        = $22,
                source_system        = 'importacion_legacy',
                updated_at           = NOW()
               WHERE dpi = $1`,
              [
                dpi, nombre_completo, telefono, correo, direccion, nit,
                fecha_nacimiento, fecha_ingreso, sexo, estado_civil,
                forma_pago, banco, cuenta_bancaria, num_dependencias,
                nivel_educativo, condicion_laboral, empl_numero,
                estado_laboral, igss_numero,
                depto_codigo_legacy, cliente_id,
                tipo_personal,
              ]
            );
          } catch (e: any) {
            results.push({ fila, estado: "error", mensaje: e.message, datos });
            errores++;
            continue;
          }
        }
        results.push({ fila, estado: "ok", mensaje: `Actualizado: ${nombre_completo} (DPI ya existía)`, datos });
        actualizados++;
        continue;
      }
    }

    if (preview) {
      results.push({ fila, estado: "ok", datos });
      exitosos++;
      continue;
    }

    // ── Insertar nuevo ──────────────────────────────────────────────────────────
    try {
      await pool.query(
        `INSERT INTO employees (
           nombre_completo, dpi, telefono, correo, direccion, nit,
           fecha_nacimiento, fecha_ingreso, fecha_baja, sexo, estado_civil,
           forma_pago, banco, cuenta_bancaria, num_dependencias,
           nivel_educativo, condicion_laboral, empl_numero,
           estado_laboral, igss_numero,
           depto_codigo_legacy, cliente_id,
           tipo_personal,
           aplica_igss_general, estado_igss,
           source_system, sync_status
         ) VALUES (
           $1,$2,$3,$4,$5,$6,
           $7,$8,$9,$10,$11,
           $12,$13,$14,$15,
           $16,$17,$18,
           $19,$20,
           $21,$22,
           $23,
           FALSE,'no_activo',
           'importacion_legacy','manual'
         )`,
        [
          nombre_completo, dpi, telefono, correo, direccion, nit,
          fecha_nacimiento, fecha_ingreso, fecha_baja, sexo, estado_civil,
          forma_pago, banco, cuenta_bancaria, num_dependencias,
          nivel_educativo, condicion_laboral, empl_numero,
          estado_laboral, igss_numero,
          depto_codigo_legacy, cliente_id,
          tipo_personal,
        ]
      );
      results.push({ fila, estado: "ok", datos: { nombre_completo, dpi } });
      exitosos++;
    } catch (e: any) {
      results.push({ fila, estado: "error", mensaje: e.message, datos });
      errores++;
    }
  }

  res.json({
    preview,
    exitosos,
    actualizados,
    errores,
    omitidos,
    total: rows.length,
    resultados: results,
  });
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

// ─── POST /api/importacion/sistema-antiguo-clientes ───────────────────────────
// Importa clientes desde dbo_Deptos.xlsx
// depto_nombre → clients.nombre | depto_codigo guardado para linking con empleados
importacionRouter.post("/importacion/sistema-antiguo-clientes", async (req: any, res: any) => {
  const session = requireAdmin(req, res);
  if (!session) return;

  const { rows, preview = false, actualizar_existentes = false }
    : { rows: Record<string,any>[]; preview: boolean; actualizar_existentes: boolean } = req.body;

  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ error: "No hay filas para importar" });

  const results: RowResult[] = [];
  let exitosos = 0, errores = 0, omitidos = 0, actualizados = 0;

  for (let i = 0; i < rows.length; i++) {
    const row  = rows[i];
    const fila = i + 2;

    const nombre       = trim(row.depto_nombre).toUpperCase();
    const depto_codigo = trim(row.depto_codigo);

    if (!nombre || !depto_codigo) {
      results.push({ fila, estado: "error", mensaje: "depto_nombre y depto_codigo son obligatorios" });
      errores++; continue;
    }

    const datos = { nombre, depto_codigo };

    // Detección duplicado: primero por depto_codigo exacto, luego por nombre
    const { rows: dupCodigo } = await pool.query(
      `SELECT id, nombre FROM clients WHERE depto_codigo = $1 LIMIT 1`, [depto_codigo]
    );
    const { rows: dupNombre } = await pool.query(
      `SELECT id, nombre FROM clients WHERE UPPER(nombre) = $1 LIMIT 1`, [nombre]
    );
    const dup = dupCodigo[0] ?? dupNombre[0] ?? null;

    if (dup) {
      if (!actualizar_existentes) {
        results.push({ fila, estado: "omitido",
          mensaje: `"${nombre}" ya existe (ID ${dup.id}). Activa "actualizar existentes" para vincular el código.`,
          datos });
        omitidos++; continue;
      }
      if (!preview) {
        try {
          await pool.query(
            `UPDATE clients SET depto_codigo = $2, updated_at = NOW() WHERE id = $1`,
            [dup.id, depto_codigo]
          );
        } catch (e: any) {
          results.push({ fila, estado: "error", mensaje: e.message, datos });
          errores++; continue;
        }
      }
      results.push({ fila, estado: "ok",
        mensaje: `Actualizado: "${nombre}" → código ${depto_codigo} vinculado`, datos });
      actualizados++; continue;
    }

    if (preview) {
      results.push({ fila, estado: "ok", datos });
      exitosos++; continue;
    }

    try {
      await pool.query(
        `INSERT INTO clients (nombre, nombre_comercial, depto_codigo, estado)
         VALUES ($1, $1, $2, 'activo')`,
        [nombre, depto_codigo]
      );
      results.push({ fila, estado: "ok", datos: { nombre, depto_codigo } });
      exitosos++;
    } catch (e: any) {
      results.push({ fila, estado: "error", mensaje: e.message, datos });
      errores++;
    }
  }

  res.json({ preview, exitosos, actualizados, errores, omitidos, total: rows.length, resultados: results });
});

// ─── POST /api/importacion/sistema-antiguo-vincular ───────────────────────────
// Paso 2: después de importar clientes y empleados por separado,
// vincula employees.cliente_id usando el depto_codigo_legacy de cada empleado.
importacionRouter.post("/importacion/sistema-antiguo-vincular", async (req: any, res: any) => {
  const session = requireAdmin(req, res);
  if (!session) return;

  const { preview = false } = req.body as { preview: boolean };

  // Buscar todos los empleados que tienen depto_codigo_legacy pero no tienen cliente_id
  const { rows: empRows } = await pool.query(`
    SELECT e.id, e.nombre_completo, e.depto_codigo_legacy,
           c.id AS cliente_id, c.nombre AS cliente_nombre
    FROM employees e
    JOIN clients c ON c.depto_codigo = e.depto_codigo_legacy
    WHERE e.depto_codigo_legacy IS NOT NULL
      AND e.cliente_id IS NULL
    ORDER BY e.id
  `);

  // También reportar los que no tienen match
  const { rows: sinMatch } = await pool.query(`
    SELECT e.id, e.nombre_completo, e.depto_codigo_legacy
    FROM employees e
    WHERE e.depto_codigo_legacy IS NOT NULL
      AND e.cliente_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM clients c WHERE c.depto_codigo = e.depto_codigo_legacy
      )
  `);

  if (!preview) {
    for (const emp of empRows) {
      await pool.query(
        `UPDATE employees SET cliente_id = $1, updated_at = NOW() WHERE id = $2`,
        [emp.cliente_id, emp.id]
      );
    }
  }

  // Agrupar sin match por codigo para el reporte
  const sinMatchAgrupado: Record<string, number> = {};
  sinMatch.forEach(r => {
    const k = r.depto_codigo_legacy || "(sin código)";
    sinMatchAgrupado[k] = (sinMatchAgrupado[k] || 0) + 1;
  });

  res.json({
    preview,
    vinculados: empRows.length,
    sin_match: sinMatch.length,
    sin_match_codigos: sinMatchAgrupado,
    muestra: empRows.slice(0, 10).map(r => ({
      empleado: r.nombre_completo,
      depto_codigo: r.depto_codigo_legacy,
      cliente: r.cliente_nombre,
    })),
  });
});

// ─── POST /api/importacion/crear-puestos-legacy ───────────────────────────────
// Paso 4: por cada colaborador con cliente_id asignado, crea un puesto operativo
// numerado ("Puesto 1", "Puesto 2"…) por cliente. Omite si ya existe un puesto
// con ese titular_employee_id para ese cliente.
importacionRouter.post("/importacion/crear-puestos-legacy", async (req: any, res: any) => {
  const session = requireAdmin(req, res);
  if (!session) return;

  const { preview = false } = req.body as { preview: boolean };

  // Todos los colaboradores con cliente asignado, ordenados por cliente y nombre
  const { rows: empRows } = await pool.query(`
    SELECT e.id AS emp_id, e.nombre_completo, e.cliente_id, c.nombre AS cliente_nombre
    FROM employees e
    JOIN clients c ON c.id = e.cliente_id
    WHERE e.cliente_id IS NOT NULL
      AND e.estado_laboral = 'activo'
    ORDER BY c.nombre, e.nombre_completo
  `);

  // Puestos que ya tienen titular asignado de la importación anterior
  const { rows: existentes } = await pool.query(`
    SELECT titular_employee_id, cliente_id
    FROM puestos_operativos
    WHERE titular_employee_id IS NOT NULL
  `);
  const yaExiste = new Set(existentes.map(r => `${r.cliente_id}-${r.titular_employee_id}`));

  // Contador secuencial por cliente para numerar puestos
  const contadorCliente: Record<number, number> = {};
  // Contar puestos ya existentes por cliente para continuar la numeración
  const { rows: puestosExist } = await pool.query(`
    SELECT cliente_id, COUNT(*) AS cnt
    FROM puestos_operativos
    WHERE cliente_id IS NOT NULL
    GROUP BY cliente_id
  `);
  puestosExist.forEach(r => { contadorCliente[r.cliente_id] = parseInt(r.cnt, 10); });

  const puestosACrear: { nombre: string; cliente_nombre: string; empleado: string }[] = [];
  const omitidos: { empleado: string; razon: string }[] = [];

  for (const emp of empRows) {
    const key = `${emp.cliente_id}-${emp.emp_id}`;
    if (yaExiste.has(key)) {
      omitidos.push({ empleado: emp.nombre_completo, razon: "ya tiene puesto asignado" });
      continue;
    }
    contadorCliente[emp.cliente_id] = (contadorCliente[emp.cliente_id] ?? 0) + 1;
    const numPuesto = contadorCliente[emp.cliente_id];
    const nombrePuesto = `Puesto ${numPuesto}`;
    puestosACrear.push({ nombre: nombrePuesto, cliente_nombre: emp.cliente_nombre, empleado: emp.nombre_completo });

    if (!preview) {
      const { rows: inserted } = await pool.query(
        `INSERT INTO puestos_operativos (
           cliente_id, cliente_nombre, nombre, orden,
           titular_employee_id, titular_nombre,
           estado, activo
         ) VALUES ($1, $2, $3, $4, $5, $6, 'cubierto', true)
         RETURNING id`,
        [emp.cliente_id, emp.cliente_nombre, nombrePuesto, numPuesto,
         emp.emp_id, emp.nombre_completo]
      );
      // Registrar en puesto_titulares para el sistema de ciclo
      const puestoId = inserted[0].id;
      await pool.query(
        `INSERT INTO puesto_titulares (puesto_id, employee_id, orden, activo)
         VALUES ($1, $2, 1, true)
         ON CONFLICT (puesto_id, employee_id) DO NOTHING`,
        [puestoId, emp.emp_id]
      );
    }
  }

  res.json({
    preview,
    creados: puestosACrear.length,
    omitidos: omitidos.length,
    muestra: puestosACrear.slice(0, 15),
    omitidos_detalle: omitidos.slice(0, 10),
  });
});
