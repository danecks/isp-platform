import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { autenticarSupervisor } from "./agente-supervision";

// Fase C — Jornada del supervisor: clock-in/out, GPS continuo, inspección de
// agentes con catálogo configurable, alertas de armas y novedades.
// Auth: device_uuid + device_token + qr_token (mismo patrón que mi-agenda).

export const agenteSupervisionJornadaRouter = Router();

const TIPOS_ALERTA_ARMA = [
  "arma_mal_estado",
  "portacion_extraviada", "portacion_no_legible",
  "tenencia_extraviada", "tenencia_no_legible",
  "otro",
] as const;
type TipoAlertaArma = typeof TIPOS_ALERTA_ARMA[number];

// Calcula horario planificado del supervisor desde personal_slots (turno actual).
async function horarioPlanificado(employeeId: number): Promise<{
  hora_inicio: string | null; hora_fin: string | null;
}> {
  try {
    const { rows } = await pool.query(
      `SELECT to_char(hora_entrada, 'HH24:MI:SS') AS hora_entrada, horas_turno
         FROM personal_slots
        WHERE employee_id = $1 AND activo = TRUE AND tipo = 'supervisor'
        ORDER BY id ASC LIMIT 1`,
      [employeeId]
    );
    if (!rows[0]) return { hora_inicio: null, hora_fin: null };
    const hi: string = rows[0].hora_entrada;
    const horas = Number(rows[0].horas_turno) || 8;
    const [h, m] = hi.split(":").map(Number);
    const finH = (h + horas) % 24;
    const hf = `${String(finH).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    return { hora_inicio: hi, hora_fin: hf };
  } catch {
    return { hora_inicio: null, hora_fin: null };
  }
}

// Auto-cierra sesiones del supervisor que quedaron abiertas de DÍAS ANTERIORES
// (típicamente porque olvidó pulsar "Terminar jornada"). NUNCA cierra una sesión
// del día actual aunque ya haya pasado la hora_fin_planificada — los supervisores
// con frecuencia trabajan más allá de su horario planificado y deben poder seguir
// transmitiendo GPS y registrando inspecciones hasta que cierren manualmente.
async function autoCerrarVencidas(employeeId: number): Promise<void> {
  try {
    await pool.query(
      `UPDATE supervision_sesiones
          SET estado = 'cerrada_auto', hora_fin_real = NOW()
        WHERE supervisor_employee_id = $1
          AND estado = 'activa'
          AND fecha < (NOW() AT TIME ZONE 'America/Guatemala')::date`,
      [employeeId]
    );
  } catch (err) {
    logger.warn({ err, employeeId }, "auto-cerrar sesiones vencidas: error no bloqueante");
  }
}

async function sesionActiva(employeeId: number) {
  const { rows } = await pool.query(
    `SELECT id, fecha, hora_inicio_real, hora_inicio_planificada, hora_fin_planificada, estado
       FROM supervision_sesiones
      WHERE supervisor_employee_id = $1 AND estado = 'activa'
      ORDER BY id DESC LIMIT 1`,
    [employeeId]
  );
  return rows[0] || null;
}

// ── POST /agente/supervision/jornada/estado ─────────────────────────────────
// Devuelve estado completo: sesión activa (si hay), próxima visita, catálogo.
agenteSupervisionJornadaRouter.post("/agente/supervision/jornada/estado", async (req, res) => {
  const b = req.body || {};
  const a = await autenticarSupervisor(b.device_uuid, b.device_token, b.qr_token);
  if (!a.ctx) return res.status(a.status || 403).json({ error: a.error });

  await autoCerrarVencidas(a.ctx.employee_id);
  try {
    const sesion = await sesionActiva(a.ctx.employee_id);
    const horario = await horarioPlanificado(a.ctx.employee_id);

    const { rows: prox } = await pool.query(
      `SELECT sp.id, sp.cliente_id, sp.puesto_id,
              to_char(sp.fecha_planificada, 'YYYY-MM-DD') AS fecha_planificada,
              to_char(sp.ventana_inicio, 'HH24:MI') AS ventana_inicio,
              to_char(sp.ventana_fin, 'HH24:MI')   AS ventana_fin,
              sp.tipo, sp.prioridad, sp.estado, sp.instrucciones,
              c.nombre AS cliente_nombre, po.nombre AS puesto_nombre,
              po.direccion AS puesto_direccion
         FROM supervision_visitas_programadas sp
         LEFT JOIN clients c             ON c.id  = sp.cliente_id
         LEFT JOIN puestos_operativos po ON po.id = sp.puesto_id
        WHERE sp.supervisor_employee_id = $1
          AND sp.estado IN ('pendiente','en_curso')
          AND sp.fecha_planificada <= CURRENT_DATE + INTERVAL '7 days'
        ORDER BY sp.fecha_planificada ASC, sp.ventana_inicio ASC NULLS LAST, sp.id ASC
        LIMIT 1`,
      [a.ctx.employee_id]
    );

    res.json({
      ok: true,
      supervisor: { id: a.ctx.employee_id, nombre: a.ctx.supervisor_nombre },
      sesion,
      horario_planificado: horario,
      proxima_visita: prox[0] || null,
    });
  } catch (err) {
    logger.error({ err }, "POST /agente/supervision/jornada/estado error");
    res.status(500).json({ error: "Error al cargar estado" });
  }
});

// ── POST /agente/supervision/jornada/clock-in ───────────────────────────────
agenteSupervisionJornadaRouter.post("/agente/supervision/jornada/clock-in", async (req, res) => {
  const b = req.body || {};
  const a = await autenticarSupervisor(b.device_uuid, b.device_token, b.qr_token);
  if (!a.ctx) return res.status(a.status || 403).json({ error: a.error });

  await autoCerrarVencidas(a.ctx.employee_id);
  try {
    const ya = await sesionActiva(a.ctx.employee_id);
    if (ya) return res.json({ ok: true, sesion: ya, ya_activa: true });

    const horario = await horarioPlanificado(a.ctx.employee_id);
    const { rows } = await pool.query(
      `INSERT INTO supervision_sesiones
         (supervisor_employee_id, fecha, hora_inicio_planificada, hora_fin_planificada, device_id)
       VALUES ($1, CURRENT_DATE, $2, $3, $4)
       RETURNING id, fecha, hora_inicio_real, hora_inicio_planificada, hora_fin_planificada, estado`,
      [a.ctx.employee_id, horario.hora_inicio, horario.hora_fin, a.ctx.device_id]
    );
    res.json({ ok: true, sesion: rows[0] });
  } catch (err: any) {
    if (err?.code === "23505") {
      const ya = await sesionActiva(a.ctx.employee_id);
      return res.json({ ok: true, sesion: ya, ya_activa: true });
    }
    logger.error({ err }, "POST /agente/supervision/jornada/clock-in error");
    res.status(500).json({ error: "Error al iniciar jornada" });
  }
});

// ── POST /agente/supervision/jornada/clock-out ──────────────────────────────
agenteSupervisionJornadaRouter.post("/agente/supervision/jornada/clock-out", async (req, res) => {
  const b = req.body || {};
  const a = await autenticarSupervisor(b.device_uuid, b.device_token, b.qr_token);
  if (!a.ctx) return res.status(a.status || 403).json({ error: a.error });

  try {
    const { rowCount } = await pool.query(
      `UPDATE supervision_sesiones
          SET estado = 'cerrada_manual', hora_fin_real = NOW()
        WHERE supervisor_employee_id = $1 AND estado = 'activa'`,
      [a.ctx.employee_id]
    );
    res.json({ ok: true, cerradas: rowCount || 0 });
  } catch (err) {
    logger.error({ err }, "POST /agente/supervision/jornada/clock-out error");
    res.status(500).json({ error: "Error al cerrar jornada" });
  }
});

// ── POST /agente/supervision/jornada/gps ────────────────────────────────────
// body: ...auth + { lat, lng, accuracy_m? }
agenteSupervisionJornadaRouter.post("/agente/supervision/jornada/gps", async (req, res) => {
  const b = req.body || {};
  const a = await autenticarSupervisor(b.device_uuid, b.device_token, b.qr_token);
  if (!a.ctx) return res.status(a.status || 403).json({ error: a.error });

  const lat = Number(b.lat), lng = Number(b.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: "lat/lng inválidos" });
  }
  await autoCerrarVencidas(a.ctx.employee_id);
  try {
    const sesion = await sesionActiva(a.ctx.employee_id);
    if (!sesion) return res.status(409).json({ error: "sin_sesion_activa" });
    const acc = Number.isFinite(Number(b.accuracy_m)) ? Number(b.accuracy_m) : null;
    await pool.query(
      `INSERT INTO supervision_gps_tracks (sesion_id, lat, lng, accuracy_m)
       VALUES ($1, $2, $3, $4)`,
      [sesion.id, lat, lng, acc]
    );
    res.json({ ok: true, sesion_id: sesion.id });
  } catch (err) {
    logger.error({ err }, "POST /agente/supervision/jornada/gps error");
    res.status(500).json({ error: "Error al guardar GPS" });
  }
});

// ── POST /agente/supervision/inspeccion/agente-info ─────────────────────────
// Recibe el qr_token del AGENTE escaneado y devuelve sus datos + arma + catálogo
// del cliente (o global si el cliente no tiene catálogo propio).
agenteSupervisionJornadaRouter.post("/agente/supervision/inspeccion/agente-info", async (req, res) => {
  const b = req.body || {};
  const a = await autenticarSupervisor(b.device_uuid, b.device_token, b.qr_token);
  if (!a.ctx) return res.status(a.status || 403).json({ error: a.error });

  const agenteToken = String(b.agente_qr_token || "").trim();
  if (!agenteToken) return res.status(400).json({ error: "agente_qr_token requerido" });

  try {
    const { rows: empRows } = await pool.query(
      `SELECT e.id, e.nombre_completo, e.tipo_personal,
              pt.puesto_id, po.nombre AS puesto_nombre, po.cliente_id, c.nombre AS cliente_nombre
         FROM agente_qr_tokens aqt
         JOIN employees e ON e.id = aqt.employee_id
         LEFT JOIN puesto_titulares pt ON pt.employee_id = e.id AND pt.activo = TRUE
         LEFT JOIN puestos_operativos po ON po.id = pt.puesto_id
         LEFT JOIN clients c ON c.id = po.cliente_id
        WHERE aqt.qr_token = $1 AND aqt.activo = TRUE
        ORDER BY pt.id ASC LIMIT 1`,
      [agenteToken]
    );
    const emp = empRows[0];
    if (!emp) return res.status(404).json({ error: "agente_no_encontrado" });

    const { rows: armaRows } = await pool.query(
      `SELECT id, codigo, tipo, marca, modelo, calibre, serie,
              numero_portacion, numero_tenencia,
              to_char(fecha_vencimiento_portacion, 'YYYY-MM-DD') AS vence_portacion,
              to_char(fecha_vencimiento_tenencia,  'YYYY-MM-DD') AS vence_tenencia
         FROM armas
        WHERE custodio_employee_id = $1 AND activo = TRUE
        ORDER BY id ASC LIMIT 1`,
      [emp.id]
    );

    const { rows: catRows } = await pool.query(
      `WITH custom AS (
         SELECT * FROM supervision_catalogo_items
          WHERE cliente_id = $1 AND activo = TRUE
       )
       SELECT id, categoria, clave, etiqueta, tipo, orden
         FROM custom
       UNION ALL
       SELECT g.id, g.categoria, g.clave, g.etiqueta, g.tipo, g.orden
         FROM supervision_catalogo_items g
        WHERE g.cliente_id IS NULL AND g.activo = TRUE
          AND NOT EXISTS (SELECT 1 FROM custom cu WHERE cu.clave = g.clave)
        ORDER BY orden ASC, id ASC`,
      [emp.cliente_id]
    );

    res.json({
      ok: true,
      agente: {
        id: emp.id, nombre: emp.nombre_completo, tipo_personal: emp.tipo_personal,
        puesto_id: emp.puesto_id, puesto_nombre: emp.puesto_nombre,
        cliente_id: emp.cliente_id, cliente_nombre: emp.cliente_nombre,
      },
      arma: armaRows[0] || null,
      catalogo: catRows,
    });
  } catch (err) {
    logger.error({ err }, "POST /agente/supervision/inspeccion/agente-info error");
    res.status(500).json({ error: "Error al cargar agente" });
  }
});

// ── POST /agente/supervision/inspeccion/registrar ───────────────────────────
// body: ...auth + { agente_employee_id, datos, observaciones?, lat?, lng?,
//                   arma_id?, arma_estado? { fisica, portacion, tenencia, alertas: [{tipo, descripcion?}] } }
agenteSupervisionJornadaRouter.post("/agente/supervision/inspeccion/registrar", async (req, res) => {
  const b = req.body || {};
  const a = await autenticarSupervisor(b.device_uuid, b.device_token, b.qr_token);
  if (!a.ctx) return res.status(a.status || 403).json({ error: a.error });

  const agenteId = Number(b.agente_employee_id);
  if (!Number.isInteger(agenteId) || agenteId <= 0) {
    return res.status(400).json({ error: "agente_employee_id inválido" });
  }
  const datos = (b.datos && typeof b.datos === "object") ? b.datos : {};
  const armaId = Number.isInteger(Number(b.arma_id)) ? Number(b.arma_id) : null;
  const armaEstado = (b.arma_estado && typeof b.arma_estado === "object") ? b.arma_estado : null;
  const lat = Number.isFinite(Number(b.lat)) ? Number(b.lat) : null;
  const lng = Number.isFinite(Number(b.lng)) ? Number(b.lng) : null;

  await autoCerrarVencidas(a.ctx.employee_id);

  // Pre-validaciones (sin client del pool para no filtrar conexiones en early-return).
  const sesion = await sesionActiva(a.ctx.employee_id);
  if (!sesion) return res.status(409).json({ error: "sin_sesion_activa" });

  // Validar que el arma (si vino) realmente pertenezca a este agente.
  // Evita IDOR: un supervisor no puede crear inspecciones/alertas sobre
  // armas ajenas inyectando arma_id en el payload.
  if (armaId) {
    const { rows: ar } = await pool.query(
      `SELECT custodio_employee_id FROM armas WHERE id = $1 LIMIT 1`,
      [armaId]
    );
    if (ar.length === 0) {
      return res.status(404).json({ error: "arma_no_existe" });
    }
    if (Number(ar[0].custodio_employee_id) !== agenteId) {
      return res.status(403).json({ error: "arma_no_pertenece_al_agente" });
    }
  }

  const client = await pool.connect();
  try {
    const { rows: ag } = await client.query(
      `SELECT pt.puesto_id, po.cliente_id
         FROM puesto_titulares pt
         LEFT JOIN puestos_operativos po ON po.id = pt.puesto_id
        WHERE pt.employee_id = $1 AND pt.activo = TRUE
        ORDER BY pt.id ASC LIMIT 1`,
      [agenteId]
    );
    const puestoId = ag[0]?.puesto_id || null;
    const clienteId = ag[0]?.cliente_id || null;

    await client.query("BEGIN");

    const { rows: insRows } = await client.query(
      `INSERT INTO supervision_inspecciones
         (sesion_id, supervisor_employee_id, agente_employee_id, puesto_id, cliente_id,
          arma_id, datos, arma_estado, observaciones, lat, lng)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [sesion.id, a.ctx.employee_id, agenteId, puestoId, clienteId,
       armaId, JSON.stringify(datos), armaEstado ? JSON.stringify(armaEstado) : null,
       String(b.observaciones || "").trim() || null, lat, lng]
    );
    const inspeccionId = insRows[0].id;

    // Crear armas_alertas si vinieron flags abiertas.
    if (armaId && armaEstado && Array.isArray(armaEstado.alertas)) {
      for (const al of armaEstado.alertas) {
        const tipo = String(al?.tipo || "");
        if (!TIPOS_ALERTA_ARMA.includes(tipo as TipoAlertaArma)) continue;
        await client.query(
          `INSERT INTO armas_alertas
             (arma_id, inspeccion_id, sesion_id, supervisor_employee_id, agente_employee_id,
              tipo, descripcion)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [armaId, inspeccionId, sesion.id, a.ctx.employee_id, agenteId,
           tipo, String(al?.descripcion || "").trim() || null]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ ok: true, inspeccion_id: inspeccionId });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    logger.error({ err }, "POST /agente/supervision/inspeccion/registrar error");
    res.status(500).json({ error: "Error al registrar inspección" });
  } finally {
    client.release();
  }
});

// ── POST /agente/supervision/novedad/generar ────────────────────────────────
// Consolida las inspecciones de la sesión activa, agrupadas por puesto.
// body: ...auth + { observaciones? }
agenteSupervisionJornadaRouter.post("/agente/supervision/novedad/generar", async (req, res) => {
  const b = req.body || {};
  const a = await autenticarSupervisor(b.device_uuid, b.device_token, b.qr_token);
  if (!a.ctx) return res.status(a.status || 403).json({ error: a.error });

  await autoCerrarVencidas(a.ctx.employee_id);
  try {
    const sesion = await sesionActiva(a.ctx.employee_id);
    if (!sesion) return res.status(409).json({ error: "sin_sesion_activa" });

    const { rows: inspecciones } = await pool.query(
      `SELECT i.id, i.agente_employee_id, e.nombre_completo AS agente_nombre,
              i.puesto_id, po.nombre AS puesto_nombre,
              i.cliente_id, c.nombre AS cliente_nombre,
              i.arma_id, ar.codigo AS arma_codigo,
              i.datos, i.arma_estado, i.observaciones,
              to_char(i.realizada_at, 'YYYY-MM-DD HH24:MI') AS realizada_at
         FROM supervision_inspecciones i
         JOIN employees e ON e.id = i.agente_employee_id
         LEFT JOIN puestos_operativos po ON po.id = i.puesto_id
         LEFT JOIN clients c ON c.id = i.cliente_id
         LEFT JOIN armas ar ON ar.id = i.arma_id
        WHERE i.sesion_id = $1
        ORDER BY i.puesto_id NULLS LAST, i.realizada_at ASC`,
      [sesion.id]
    );
    if (inspecciones.length === 0) {
      return res.status(409).json({ error: "sin_inspecciones_para_consolidar" });
    }

    // Agrupar por puesto y crear una novedad por cada puesto inspeccionado.
    const porPuesto = new Map<string, any[]>();
    for (const it of inspecciones) {
      const k = String(it.puesto_id ?? "sin_puesto");
      if (!porPuesto.has(k)) porPuesto.set(k, []);
      porPuesto.get(k)!.push(it);
    }

    const creadas: number[] = [];
    for (const [, items] of porPuesto) {
      const puestoId = items[0].puesto_id;
      const clienteId = items[0].cliente_id;
      const consolidado = {
        sesion_id: sesion.id,
        puesto_nombre: items[0].puesto_nombre,
        cliente_nombre: items[0].cliente_nombre,
        agentes: items.map(it => ({
          agente_id: it.agente_employee_id,
          agente_nombre: it.agente_nombre,
          arma_id: it.arma_id, arma_codigo: it.arma_codigo,
          datos: it.datos, arma_estado: it.arma_estado,
          observaciones: it.observaciones,
          realizada_at: it.realizada_at,
        })),
      };
      // Idempotente: UPDATE-then-INSERT, compatible con índices parciales
      // (uno para puesto_id NOT NULL, otro para puesto_id NULL). Evita
      // ON CONFLICT con expresiones (que el introspector no puede mirrorear).
      const obsTxt = String(b.observaciones || "").trim() || null;
      const upd = await pool.query(
        `UPDATE supervision_novedades
            SET datos_consolidados = $4,
                observaciones      = $5,
                generada_at        = NOW()
          WHERE sesion_id = $1
            AND puesto_id IS NOT DISTINCT FROM $2
            AND supervisor_employee_id = $3
          RETURNING id`,
        [sesion.id, puestoId, a.ctx.employee_id, JSON.stringify(consolidado), obsTxt]
      );
      let novId: number;
      if (upd.rowCount && upd.rowCount > 0) {
        novId = upd.rows[0].id;
      } else {
        const ins = await pool.query(
          `INSERT INTO supervision_novedades
             (sesion_id, supervisor_employee_id, fecha, puesto_id, cliente_id,
              observaciones, datos_consolidados)
           VALUES ($1,$2,CURRENT_DATE,$3,$4,$5,$6)
           RETURNING id`,
          [sesion.id, a.ctx.employee_id, puestoId, clienteId, obsTxt,
           JSON.stringify(consolidado)]
        );
        novId = ins.rows[0].id;
      }
      creadas.push(novId);
    }
    res.json({ ok: true, novedades_creadas: creadas });
  } catch (err) {
    logger.error({ err }, "POST /agente/supervision/novedad/generar error");
    res.status(500).json({ error: "Error al generar novedad" });
  }
});
