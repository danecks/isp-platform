import { Router } from "express";
import { pool, todayGT } from "@workspace/db";
import { logger } from "../../lib/logger";

// CUST-FASE3 — captura de ruta del día por agente.
// Endpoints REST sobre la tabla `custodia_asignacion_diaria` (columnas
// agregadas en Fase 3: ruta_texto, hora_salida, hora_regreso, observaciones,
// registrado_por, registrado_at). El UPSERT es por (cliente_id, fecha,
// employee_id) — clave única que ya existe.

export const custodiasRutasRouter = Router();

const ROLES_PERMITIDOS = new Set(["admin", "operaciones", "supervisor"]);

function leerSesion(req: any): { username: string; rol: string } | null {
  const raw = req.headers["x-isp-session"];
  if (typeof raw !== "string" || !raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!s?.username) return null;
    return { username: String(s.username), rol: String(s.rol ?? "") };
  } catch {
    return null;
  }
}

function normFecha(f: unknown): string | null {
  const s = String(f ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function normHora(h: unknown): string | null {
  if (h === null || h === undefined || h === "") return null;
  const s = String(h);
  // Acepta HH:MM o HH:MM:SS
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(s) ? s : null;
}

// ─── GET asignaciones del día con info de ruta ────────────────────────────────
// Devuelve TODAS las asignaciones de un (cliente, fecha) con los campos de
// ruta. Sirve tanto al modal del pizarrón como a la vista "Asignaciones del
// día" del módulo Custodias.
custodiasRutasRouter.get("/custodias/cliente/:id/rutas", async (req, res) => {
  try {
    const clienteId = parseInt(req.params.id);
    if (!clienteId) return res.status(400).json({ error: "ID inválido" });
    const fecha = normFecha(req.query.fecha) ?? todayGT();

    const { rows } = await pool.query(`
      SELECT
        cad.id,
        cad.employee_id,
        cad.slot_numero,
        cad.ruta_texto,
        to_char(cad.hora_salida,  'HH24:MI') AS hora_salida,
        to_char(cad.hora_regreso, 'HH24:MI') AS hora_regreso,
        cad.observaciones,
        cad.registrado_por,
        cad.registrado_at,
        cad.notas,
        e.nombre_completo,
        e.empl_numero
      FROM custodia_asignacion_diaria cad
      JOIN employees e ON e.id = cad.employee_id
      WHERE cad.cliente_id = $1 AND cad.fecha = $2::date
      ORDER BY cad.slot_numero, e.nombre_completo
    `, [clienteId, fecha]);

    res.json({ clienteId, fecha, asignaciones: rows });
  } catch (err) {
    logger.error({ err }, "[Custodias/rutas] GET");
    res.status(500).json({ error: "Error al cargar asignaciones del día" });
  }
});

// ─── UPSERT de ruta por (cliente, fecha, employee) ────────────────────────────
// La asignación debe existir (creada desde el pizarrón o desde "asignar"). Si
// no existe, devolvemos 404 — la captura de ruta no debe crear asignaciones,
// solo enriquecerlas.
custodiasRutasRouter.put("/custodias/cliente/:id/ruta", async (req, res) => {
  try {
    const ses = leerSesion(req);
    if (!ses || !ROLES_PERMITIDOS.has(ses.rol)) {
      return res.status(403).json({ error: "Solo admin, operaciones o supervisor pueden registrar rutas" });
    }

    const clienteId = parseInt(req.params.id);
    if (!clienteId) return res.status(400).json({ error: "ID inválido" });

    const { fecha, employeeId, rutaTexto, horaSalida, horaRegreso, observaciones } = req.body ?? {};
    const fechaNorm = normFecha(fecha);
    if (!fechaNorm) return res.status(400).json({ error: "fecha inválida (YYYY-MM-DD)" });
    if (!employeeId || !Number.isFinite(Number(employeeId))) {
      return res.status(400).json({ error: "employeeId requerido" });
    }
    const hs = horaSalida === undefined ? undefined : normHora(horaSalida);
    if (horaSalida && hs === null) return res.status(400).json({ error: "hora_salida inválida (HH:MM)" });
    const hr = horaRegreso === undefined ? undefined : normHora(horaRegreso);
    if (horaRegreso && hr === null) return res.status(400).json({ error: "hora_regreso inválida (HH:MM)" });

    const rutaNorm = rutaTexto === undefined ? undefined : (rutaTexto === null ? null : String(rutaTexto).slice(0, 500));
    const obsNorm  = observaciones === undefined ? undefined : (observaciones === null ? null : String(observaciones).slice(0, 1000));

    const { rows } = await pool.query(`
      UPDATE custodia_asignacion_diaria
         SET ruta_texto    = COALESCE($4, ruta_texto),
             hora_salida   = COALESCE($5::time, hora_salida),
             hora_regreso  = COALESCE($6::time, hora_regreso),
             observaciones = COALESCE($7, observaciones),
             registrado_por = $8,
             registrado_at  = NOW()
       WHERE cliente_id = $1 AND fecha = $2::date AND employee_id = $3
       RETURNING id, slot_numero
    `, [
      clienteId, fechaNorm, Number(employeeId),
      rutaNorm === undefined ? null : rutaNorm,
      hs === undefined ? null : hs,
      hr === undefined ? null : hr,
      obsNorm === undefined ? null : obsNorm,
      ses.username,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "No existe asignación para ese agente en esa fecha. Asigná primero el agente al cliente." });
    }

    res.json({ ok: true, id: rows[0].id, slot: rows[0].slot_numero });
  } catch (err) {
    logger.error({ err }, "[Custodias/rutas] PUT");
    res.status(500).json({ error: "Error al guardar ruta" });
  }
});

// ─── Historial de rutas del agente para un cliente (autocompletado) ──────────
// Devuelve las últimas N rutas no vacías que el agente ha hecho para ese
// cliente, ordenadas por fecha desc. El cliente las usa para construir el
// autocompletado in-memory del modal (sin hacer fetch por keystroke).
custodiasRutasRouter.get("/custodias/cliente/:id/rutas-historial/:employeeId", async (req, res) => {
  try {
    const clienteId = parseInt(req.params.id);
    const employeeId = parseInt(req.params.employeeId);
    if (!clienteId || !employeeId) return res.status(400).json({ error: "IDs inválidos" });
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20")) || 20));

    const { rows } = await pool.query(`
      SELECT
        ruta_texto,
        to_char(fecha, 'YYYY-MM-DD') AS fecha,
        COUNT(*) OVER (PARTITION BY ruta_texto) AS veces
      FROM custodia_asignacion_diaria
      WHERE cliente_id = $1 AND employee_id = $2
        AND ruta_texto IS NOT NULL AND ruta_texto <> ''
      ORDER BY fecha DESC
      LIMIT $3
    `, [clienteId, employeeId, limit]);

    // Devolvemos lista de rutas únicas con metadatos (última fecha y cuántas
    // veces). El cliente puede ordenarlas por frecuencia o por recencia.
    const vistas = new Set<string>();
    const rutas: { texto: string; ultimaFecha: string; veces: number }[] = [];
    for (const r of rows) {
      const t = String(r.ruta_texto);
      if (vistas.has(t)) continue;
      vistas.add(t);
      rutas.push({ texto: t, ultimaFecha: r.fecha, veces: Number(r.veces) });
    }

    res.json({ clienteId, employeeId, rutas });
  } catch (err) {
    logger.error({ err }, "[Custodias/rutas-historial] GET");
    res.status(500).json({ error: "Error al cargar historial de rutas" });
  }
});
