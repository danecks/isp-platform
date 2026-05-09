import { Router } from "express";
import { pool } from "@workspace/db";

export const digecamRouter = Router();

// ── POST /api/armeria/importar-digecam ────────────────────────────────────────
// Importa armas desde el archivo DIGECAM (procesado en el frontend con XLSX).
// Body: { armas: ArmaDigecam[], preview: boolean }
digecamRouter.post("/armeria/importar-digecam", async (req: any, res: any) => {
  try {
    const raw = req.headers["x-isp-session"] as string;
    const session = JSON.parse(raw);
    if (!["admin"].includes(session.rol)) {
      return res.status(403).json({ error: "Solo administradores pueden importar datos" });
    }
  } catch {
    return res.status(401).json({ error: "Sesión inválida" });
  }

  const { armas: rows, preview = false } = req.body as { armas: any[]; preview: boolean };
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "No hay armas para importar" });
  }

  // Cargar clientes para match automático por ubicacion
  const { rows: clients } = await pool.query(`SELECT id, nombre, nombre_comercial FROM clients`);
  const clientMap = new Map<string, number>();
  for (const c of clients) {
    clientMap.set(c.nombre.toUpperCase().trim(), c.id);
    if (c.nombre_comercial) clientMap.set(c.nombre_comercial.toUpperCase().trim(), c.id);
  }

  function matchClient(ubicacion: string): number | null {
    if (!ubicacion) return null;
    const ub = ubicacion.toUpperCase().trim();
    if (clientMap.has(ub)) return clientMap.get(ub)!;
    for (const [key, id] of clientMap.entries()) {
      if (key.length >= 4 && ub.startsWith(key)) return id;
    }
    return null;
  }

  // Cargar puestos por cliente para reparto round-robin
  const { rows: puestosRows } = await pool.query(
    `SELECT id, cliente_id FROM puestos_operativos WHERE cliente_id IS NOT NULL ORDER BY id`
  );
  const puestosMap = new Map<number, number[]>(); // cliente_id → [puesto_id, ...]
  for (const p of puestosRows) {
    const cid = Number(p.cliente_id);
    if (!puestosMap.has(cid)) puestosMap.set(cid, []);
    puestosMap.get(cid)!.push(Number(p.id));
  }
  const puestoRR = new Map<number, number>(); // cliente_id → índice actual

  function nextPuesto(clientId: number | null): number | null {
    if (!clientId) return null;
    const puestos = puestosMap.get(clientId);
    if (!puestos || puestos.length === 0) return null;
    const idx = puestoRR.get(clientId) ?? 0;
    puestoRR.set(clientId, idx + 1);
    return puestos[idx % puestos.length];
  }

  const categorias: Record<string, number> = {};
  let insertadas = 0, actualizadas = 0, conPuesto = 0;
  const errores: string[] = [];

  // Prefijos de código por tipo de arma
  const TIPO_PREFIX: Record<string, string> = {
    pistola: "PIST", revolver: "REVO", escopeta: "ESCO",
    rifle: "RIFE", subametralladora: "SUBM", carabina: "CARB",
  };

  // Cache de conteos por tipo para generar códigos únicos
  const tipoCount: Record<string, number> = {};
  if (!preview) {
    const { rows: counts } = await pool.query(`SELECT tipo, COUNT(*) as cnt FROM armas GROUP BY tipo`);
    for (const r of counts) tipoCount[r.tipo.toLowerCase()] = Number(r.cnt);
  }

  for (const row of rows) {
    try {
      const tipo    = String(row.tipo || "").toLowerCase().trim();
      const estado  = String(row.estado || "activo").toLowerCase().trim();
      const serie   = String(row.serie  || "").trim();
      const numTen  = String(row.numero_tenencia || "").trim();

      if (!tipo) {
        errores.push(`Sin tipo: ${serie || numTen || "?"}`);
        continue;
      }

      categorias[estado] = (categorias[estado] || 0) + 1;

      if (preview) { insertadas++; continue; }

      const clientId  = matchClient(row.ubicacion || "");
      const puestoId  = nextPuesto(clientId);

      // Buscar arma existente por serie, luego por tenencia (case-insensitive,
      // sin espacios al borde — coincide con la lógica del índice único ARM-08).
      let existingId: number | null = null;
      if (serie) {
        const { rows: ex } = await pool.query(
          `SELECT id FROM armas WHERE LOWER(TRIM(serie)) = LOWER($1) LIMIT 1`,
          [serie.trim()],
        );
        if (ex[0]) existingId = ex[0].id;
      }
      if (!existingId && numTen) {
        const { rows: ex } = await pool.query(
          `SELECT id FROM armas WHERE LOWER(TRIM(numero_tenencia)) = LOWER($1) LIMIT 1`,
          [numTen.trim()],
        );
        if (ex[0]) existingId = ex[0].id;
      }

      // Solo "activo" y "en_mantenimiento" mantienen el arma operativa.
      // Cualquier otro estado (hurtada, robada, extraviada, consignada,
      // omision_huella, inservible, baja y variantes antiguas en masculino)
      // marca el arma como inactiva.
      const ESTADOS_ACTIVOS = ["activo", "en_mantenimiento"];
      const activo = ESTADOS_ACTIVOS.includes(estado);
      const obs    = String(row.observaciones || "").trim() || null;
      const fVenc  = row.fecha_vencimiento || null;
      const fEmis  = row.fecha_emision || null;
      const carnet = String(row.numero_carnet || "").trim() || null;
      const marca  = String(row.marca  || "").trim() || null;
      const modelo = String(row.modelo || "").trim() || null;
      const calibre = String(row.calibre || "").trim() || null;
      const ubicacion = String(row.ubicacion || "").trim() || null;

      if (existingId) {
        await pool.query(`
          UPDATE armas SET
            tipo = $1, marca = $2, modelo = $3, calibre = $4,
            serie = $5, estado = $6, activo = $7,
            numero_tenencia = $8, fecha_vencimiento_tenencia = $9,
            numero_carnet = $10, fecha_emision_tenencia = $11,
            ubicacion = $12, client_id = $13, observaciones = $14,
            puesto_id = COALESCE($15, puesto_id),
            updated_at = NOW()
          WHERE id = $16
        `, [tipo, marca, modelo, calibre, serie || null, estado, activo,
            numTen || null, fVenc, carnet, fEmis,
            ubicacion, clientId, obs, puestoId, existingId]);
        actualizadas++;
      } else {
        const tipoKey = tipo;
        tipoCount[tipoKey] = (tipoCount[tipoKey] || 0) + 1;
        const prefix = TIPO_PREFIX[tipoKey] ?? tipoKey.substring(0, 4).toUpperCase().padEnd(4, "X");
        let codigo = `${prefix}-${String(tipoCount[tipoKey]).padStart(3, "0")}`;
        // Garantizar unicidad de código
        const { rows: cEx } = await pool.query(`SELECT id FROM armas WHERE codigo = $1`, [codigo]);
        if (cEx[0]) {
          const { rows: cMax } = await pool.query(`SELECT MAX(codigo) as m FROM armas WHERE codigo LIKE $1`, [`${prefix}-%`]);
          const maxNum = parseInt((cMax[0]?.m || `${prefix}-000`).replace(`${prefix}-`, ""), 10) || 0;
          tipoCount[tipoKey] = maxNum + 1;
          codigo = `${prefix}-${String(tipoCount[tipoKey]).padStart(3, "0")}`;
        }
        await pool.query(`
          INSERT INTO armas (
            codigo, tipo, marca, modelo, calibre, serie, estado, activo,
            numero_tenencia, fecha_vencimiento_tenencia,
            numero_carnet, fecha_emision_tenencia,
            ubicacion, client_id, puesto_id, observaciones
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        `, [codigo, tipo, marca, modelo, calibre, serie || null, estado, activo,
            numTen || null, fVenc, carnet, fEmis, ubicacion, clientId, puestoId, obs]);
        insertadas++;
      }
      if (puestoId) conPuesto++;
    } catch (err: any) {
      errores.push(`${row.serie || row.numero_tenencia || "?"}: ${err.message}`);
    }
  }

  res.json({ insertadas, actualizadas, con_puesto: conPuesto, errores: errores.slice(0, 30), total_errores: errores.length, categorias, preview });
});
