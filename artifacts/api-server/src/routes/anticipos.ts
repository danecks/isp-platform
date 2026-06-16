/**
 * ANTICIPOS API — Solicitudes de anticipo salarial
 *
 * GET    /api/anticipos         — listar con filtros (estado, origen, periodo, fecha)
 * PATCH  /api/anticipos/:id     — actualizar estado y observaciones
 * GET    /api/anticipos/config  — configuración de períodos habilitados
 * GET    /api/anticipos/export  — exportar CSV (fecha, nombre, puesto, dpi, cantidad, telefono, estado)
 */

import { Router } from "express";
import { db, anticiposTable, pool } from "@workspace/db";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { getPermisosForUsername } from "../lib/permisos-middleware";
import { DIAS_HABILITADOS, getPeriodoActivo } from "../services/whatsapp/anticipo-session";
import { calcularLimiteAnticipo } from "../services/anticipo-limite";
import {
  notificarAnticipoCreadoPush,
  notificarResolucionPush,
} from "../services/push-notificaciones";
import { logger as pushLogger } from "../lib/logger";

const anticiposRouter = Router();

/**
 * Cálculo del cobro de un anticipo (modelo de interés fijo / "flat").
 * Recargo sobre el MONTO ORIGINAL: 10% la primera cuota + 5% por cada cuota
 * adicional => tasa = 0.10 + 0.05 * (cuotas - 1). Cuotas niveladas (iguales).
 * Ej: Q500 en 4 cuotas → 25% → Q625 → 4 de Q156.25.
 * Espejado en el frontend (isp-web/src/lib/anticipo-cobro.ts); cambiar en ambos.
 */
function calcularCobroAnticipo(monto: number, cuotas: number) {
  const n = Math.max(1, Math.floor(cuotas) || 1);
  const tasa = 0.1 + 0.05 * (n - 1);
  const cuotaMonto = Math.round(((monto * (1 + tasa)) / n) * 100) / 100;
  const montoCobro = Math.round(cuotaMonto * n * 100) / 100;
  return { n, tasa, cuotaMonto, montoCobro };
}

// ── GET /api/anticipos/config ──────────────────────────────────────────────
anticiposRouter.get("/anticipos/config", (_req, res) => {
  const periodoActual = getPeriodoActivo();
  res.json({
    diasHabilitados: DIAS_HABILITADOS,
    toleranciaDias: 1,
    periodoActual,
    habilitadoAhora: periodoActual !== null,
    estadosValidos: ["pendiente", "aprobada", "rechazada", "pagada"],
  });
});

// ── GET /api/anticipos/export — CSV ────────────────────────────────────────
anticiposRouter.get("/anticipos/export", async (req, res) => {
  try {
    const { estado, periodo, desde, hasta } = req.query as Record<string, string>;

    let rows = await db
      .select()
      .from(anticiposTable)
      .orderBy(desc(anticiposTable.fechaSolicitud));

    // Filtros
    if (estado) rows = rows.filter((r) => r.estado === estado);
    if (periodo) rows = rows.filter((r) => r.periodo === periodo);
    if (desde) rows = rows.filter((r) => new Date(r.fechaSolicitud) >= new Date(desde));
    if (hasta) rows = rows.filter((r) => new Date(r.fechaSolicitud) <= new Date(hasta));

    // CSV
    const header = "fecha,nombre,puesto,dpi,cantidad,telefono,estado,periodo,origen\n";
    const csvRows = rows.map((r) => {
      const cols = [
        r.fechaSolicitud.toISOString().split("T")[0],
        `"${(r.nombre ?? "").replace(/"/g, '""')}"`,
        `"${(r.puesto ?? "").replace(/"/g, '""')}"`,
        r.dpi ?? "",
        r.cantidad,
        r.telefono ?? "",
        r.estado,
        r.periodo ?? "",
        r.origen,
      ];
      return cols.join(",");
    });

    const csv = header + csvRows.join("\n");
    const filename = `anticipos-${new Date().toISOString().split("T")[0]}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csv); // BOM para Excel en español
  } catch (err) {
    res.status(500).json({ error: "Error al exportar CSV" });
  }
});

// ── GET /api/anticipos ─────────────────────────────────────────────────────
anticiposRouter.get("/anticipos", async (req, res) => {
  try {
    const { estado, origen, periodo, desde, hasta } = req.query as Record<string, string>;

    let rows = await db
      .select()
      .from(anticiposTable)
      .orderBy(desc(anticiposTable.fechaSolicitud));

    if (estado) rows = rows.filter((r) => r.estado === estado);
    if (origen) rows = rows.filter((r) => r.origen === origen);
    if (periodo) rows = rows.filter((r) => r.periodo === periodo);
    if (desde) rows = rows.filter((r) => new Date(r.fechaSolicitud) >= new Date(desde));
    if (hasta) rows = rows.filter((r) => new Date(r.fechaSolicitud) <= new Date(hasta));

    // ── Cliente + puesto ACTUAL del colaborador ───────────────────────────────
    // El campo `puesto` guardado es texto libre (lo que escribió quien solicitó)
    // y no dice ni el cliente ni el puesto real. Resolvemos la asignación vigente
    // por employee_id: guardias → puesto_slots/puesto_titulares/titular legacy
    // (de ahí salen cliente_nombre y el nombre del puesto); custodios sin puesto
    // → cliente de custodia_titulares / asignación diaria más reciente.
    const empleadoIds = Array.from(
      new Set(rows.map((r) => r.employeeId).filter((id): id is number => id != null)),
    );
    if (empleadoIds.length > 0) {
      const { rows: asignaciones } = await pool.query(
        `SELECT e.eid AS employee_id, asg.cliente_nombre, asg.puesto_nombre
           FROM unnest($1::int[]) AS e(eid)
           LEFT JOIN LATERAL (
             SELECT u.cliente_nombre, u.puesto_nombre
             FROM (
               SELECT po.cliente_nombre, po.nombre AS puesto_nombre, 0 AS prio, NULL::date AS fecha
                 FROM puesto_slots ps
                 JOIN puestos_operativos po ON po.id = ps.puesto_id AND po.activo = TRUE
                WHERE ps.empleado_id = e.eid AND ps.activo = TRUE
               UNION ALL
               SELECT po.cliente_nombre, po.nombre, 1 AS prio, NULL::date
                 FROM puesto_titulares pt
                 JOIN puestos_operativos po ON po.id = pt.puesto_id AND po.activo = TRUE
                WHERE pt.employee_id = e.eid AND pt.activo = TRUE
               UNION ALL
               SELECT po.cliente_nombre, po.nombre, 2 AS prio, NULL::date
                 FROM puestos_operativos po
                WHERE po.titular_employee_id = e.eid AND po.activo = TRUE
               UNION ALL
               SELECT c.nombre AS cliente_nombre, NULL::varchar AS puesto_nombre, 3 AS prio, NULL::date
                 FROM custodia_titulares ct
                 JOIN clients c ON c.id = ct.cliente_id
                WHERE ct.employee_id = e.eid AND ct.activo = TRUE
               UNION ALL
               SELECT c.nombre, NULL::varchar, 4 AS prio, cad.fecha
                 FROM custodia_asignacion_diaria cad
                 JOIN clients c ON c.id = cad.cliente_id
                WHERE cad.employee_id = e.eid AND cad.fecha <= CURRENT_DATE
             ) u
             ORDER BY u.prio ASC, u.fecha DESC NULLS LAST
             LIMIT 1
           ) asg ON TRUE`,
        [empleadoIds],
      );
      const mapa = new Map<number, { clienteNombre: string | null; puestoActual: string | null }>();
      for (const a of asignaciones as Array<Record<string, unknown>>) {
        mapa.set(a.employee_id as number, {
          clienteNombre: (a.cliente_nombre as string | null) ?? null,
          puestoActual: (a.puesto_nombre as string | null) ?? null,
        });
      }
      rows = rows.map((r) => {
        const asg = r.employeeId != null ? mapa.get(r.employeeId) : undefined;
        return {
          ...r,
          clienteNombre: asg?.clienteNombre ?? null,
          puestoActual: asg?.puestoActual ?? null,
        };
      });
    }

    // Totales por estado
    const all = await db.select().from(anticiposTable);
    const totales = {
      pendiente: all.filter((r) => r.estado === "pendiente").length,
      aprobada: all.filter((r) => r.estado === "aprobada").length,
      rechazada: all.filter((r) => r.estado === "rechazada").length,
      pagada: all.filter((r) => r.estado === "pagada").length,
      total: all.length,
      montoPendiente: all.filter((r) => r.estado === "pendiente").reduce((s, r) => s + r.cantidad, 0),
      montoAprobado: all.filter((r) => r.estado === "aprobada").reduce((s, r) => s + r.cantidad, 0),
    };

    res.json({ anticipos: rows, totales });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener anticipos" });
  }
});

// ── POST /api/anticipos — crear anticipo manual ────────────────────────────
anticiposRouter.post("/anticipos", async (req, res) => {
  const { nombre, cantidad, empleadoId, puesto, dpi, telefono, observaciones, origen: origenBody, extraordinario: extraordinarioBody } = req.body ?? {};

  if (!nombre || !cantidad) {
    return res.status(400).json({ error: "nombre y cantidad son requeridos" });
  }
  const monto = Number(cantidad);
  if (isNaN(monto) || monto <= 0) {
    return res.status(400).json({ error: "cantidad debe ser un número mayor a 0" });
  }

  try {
    const periodo = getPeriodoActivo() ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-manual`;

    // ¿Anticipo extraordinario? Solo el director (rol admin) puede autorizar uno
    // que se salte el tope dinámico. OJO: POST /anticipos es una ruta PÚBLICA
    // (la usa el kiosco /solicitar-anticipo sin sesión), así que aquí NO se
    // puede confiar en el `rol` que venga en el header. Igualamos la vía segura
    // del middleware: exigir username y resolver el rol REAL contra la BD.
    let esExtraordinario = false;
    let autorizadoPor: string | null = null;
    if (extraordinarioBody === true) {
      let username: string | null = null;
      const raw = req.headers["x-isp-session"] as string | undefined;
      if (raw) {
        try {
          const sess = JSON.parse(raw) as { username?: string };
          username = sess.username ?? null;
        } catch {
          username = null;
        }
      }
      const rol = username ? (await getPermisosForUsername(username)).rol : "";
      if (rol !== "admin") {
        return res.status(403).json({
          error: "no_autorizado",
          mensaje: "Solo el director puede autorizar un anticipo extraordinario.",
        });
      }
      esExtraordinario = true;
      autorizadoPor = username;
    }

    // Validar límite si el colaborador está vinculado (los extraordinarios lo saltan)
    if (empleadoId && !esExtraordinario) {
      const limite = await calcularLimiteAnticipo(Number(empleadoId), periodo);
      if (limite.tieneLimite && limite.restante !== null && monto > limite.restante) {
        let mensaje: string;
        if (limite.enRiesgo) {
          mensaje = `${nombre} no puede recibir anticipo: su KPI disciplinario está en riesgo (${limite.kpiScore} pts).`;
        } else if (limite.restante === 0) {
          mensaje = `${nombre} ya no tiene saldo disponible (tope Q${(limite.limite ?? 0).toLocaleString("es-GT")}, ya debe Q${limite.solicitado.toLocaleString("es-GT")}).`;
        } else {
          mensaje = `El monto Q${monto.toLocaleString("es-GT")} excede el disponible de Q${limite.restante.toLocaleString("es-GT")} (tope Q${(limite.limite ?? 0).toLocaleString("es-GT")} = 30% de la liquidación acumulada ajustado por KPI).`;
        }
        return res.status(422).json({
          error: "excede_limite",
          mensaje,
          limite: limite.limite,
          solicitado: limite.solicitado,
          restante: limite.restante,
          liquidacionAcumulada: limite.liquidacionAcumulada,
          kpiScore: limite.kpiScore,
          enRiesgo: limite.enRiesgo,
          periodo,
        });
      }
    }

    // Provisional: sin cuotas definidas se asume 1 pago (10%). Se recalcula al
    // aprobar según el número de cuotas que indique RRHH.
    const montoCobro = calcularCobroAnticipo(monto, 1).montoCobro;

    const [created] = await db
      .insert(anticiposTable)
      .values({
        employeeId: empleadoId ? Number(empleadoId) : null,
        nombre: String(nombre).trim(),
        puesto: puesto ? String(puesto).trim() : null,
        dpi: dpi ? String(dpi).trim() : null,
        telefono: telefono ? String(telefono).trim() : null,
        cantidad: monto,
        montoCobro: String(montoCobro),
        origen: origenBody === "kiosco" || origenBody === "whatsapp" ? origenBody : "manual",
        estado: "pendiente",
        periodo,
        observaciones: observaciones ? String(observaciones).trim() : null,
        extraordinario: esExtraordinario,
        autorizadoPor,
        fechaSolicitud: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Push a aprobadores (admin/rrhh) — fire and forget.
    // Cubre REST manual y kiosco web (SolicitarAnticipo POSTea aquí con
    // origen="kiosco"). El bot de WhatsApp insert directo y notifica
    // desde services/whatsapp/anticipo-session.ts.
    if (created.estado === "pendiente") {
      notificarAnticipoCreadoPush({
        anticipoId: created.id,
        nombre: created.nombre,
        cantidad: created.cantidad,
        origen: created.origen,
      }).catch((err) => {
        pushLogger.warn({ err, anticipoId: created.id }, "Push de anticipo pendiente falló (no bloqueante)");
      });
    }

    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear anticipo" });
  }
});

// ── GET /api/anticipos/:id ─────────────────────────────────────────────────
anticiposRouter.get("/anticipos/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    const [row] = await db
      .select()
      .from(anticiposTable)
      .where(eq(anticiposTable.id, id))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Anticipo no encontrado" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener anticipo" });
  }
});

// ── GET /api/anticipos/:id/pagos ───────────────────────────────────────────
// Resumen de cuotas: cuántas pagadas / pendientes, con la quincena y la fecha
// EXACTA de cierre de planilla en que se descontó cada una. Se reconstruye desde
// planilla_lineas (anticipo_ids JSONB) → planillas, SIN tocar el schema de
// anticipos. Cada línea de planilla no anulada que contenga este anticipo es
// una cuota efectivamente descontada.
anticiposRouter.get("/anticipos/:id/pagos", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
  try {
    const [ant] = await db
      .select()
      .from(anticiposTable)
      .where(eq(anticiposTable.id, id))
      .limit(1);
    if (!ant) return res.status(404).json({ error: "Anticipo no encontrado" });

    const { rows } = await pool.query(
      `SELECT p.id               AS planilla_id,
              p.periodo_desde    AS periodo_desde,
              p.periodo_hasta    AS periodo_hasta,
              p.fecha_generacion AS fecha_generacion
         FROM planilla_lineas pl
         JOIN planillas p ON p.id = pl.planilla_id
        WHERE pl.anticipo_ids @> $1::jsonb
          AND p.anulada = FALSE
        ORDER BY p.fecha_generacion ASC`,
      [JSON.stringify(id)]
    );

    const pagos = rows.map((r: Record<string, unknown>) => ({
      planillaId: r.planilla_id as number,
      periodoDesde: r.periodo_desde as string,
      periodoHasta: r.periodo_hasta as string,
      fechaGeneracion: r.fecha_generacion as string,
    }));

    const numCuotas = ant.numCuotas ?? 1;
    const cuotasPagadas = ant.cuotasPagadas ?? 0;

    return res.json({
      id: ant.id,
      estado: ant.estado,
      cantidad: ant.cantidad,
      montoCobro: ant.montoCobro,
      cuotaMonto: ant.cuotaMonto,
      numCuotas,
      cuotasPagadas,
      cuotasPendientes: Math.max(0, numCuotas - cuotasPagadas),
      pagos,
    });
  } catch (err) {
    return res.status(500).json({ error: "Error al obtener pagos del anticipo" });
  }
});

// ── PATCH /api/anticipos/:id ───────────────────────────────────────────────
anticiposRouter.patch("/anticipos/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  const { estado, observaciones, num_cuotas, cantidad, nombre, puesto, dpi, telefono } = req.body ?? {};
  const ESTADOS_VALIDOS = ["pendiente", "aprobada", "rechazada", "pagada"];
  if (estado && !ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: "Estado inválido", validos: ESTADOS_VALIDOS });
  }
  // ¿Se está intentando editar los DATOS de la solicitud (monto, nombre, etc.)?
  // Esto solo se permite mientras el anticipo sigue pendiente (sin aprobar).
  const editaDatos =
    cantidad !== undefined ||
    nombre !== undefined ||
    puesto !== undefined ||
    dpi !== undefined ||
    telefono !== undefined;

  try {
    // Bloqueo de seguridad: anticipos vinculados a una planilla no se pueden editar
    const existing = await db.select().from(anticiposTable).where(eq(anticiposTable.id, id)).limit(1);
    if (!existing.length) return res.status(404).json({ error: "Anticipo no encontrado" });

    if (existing[0].planillaId !== null) {
      return res.status(409).json({
        error: "Este anticipo está vinculado a una planilla y no puede modificarse. Para corregirlo, revierte la planilla primero.",
        planilla_id: existing[0].planillaId,
      });
    }

    // ── Bloqueo tras aprobación ───────────────────────────────────────────────
    // Una vez aprobado, el número de cuotas y los montos quedan FIJOS para que
    // nadie pueda alterarlos "porque me equivoqué". Única excepción: el DIRECTOR
    // (rol admin) puede CANCELAR el anticipo, y SOLO si todavía no se descontó
    // ninguna cuota (cuotas_pagadas === 0). Editar solo las observaciones
    // siempre está permitido.
    const actual = existing[0];

    // ── Editar DATOS solo si sigue pendiente ──────────────────────────────────
    // El director pidió poder corregir el MONTO (y datos) de solicitudes que
    // todavía no se aprobaron ("un par se equivocaron de monto y ya no se pudo
    // modificar"). Una vez aprobado el anticipo, los datos quedan fijos.
    if (editaDatos && actual.estado !== "pendiente") {
      return res.status(409).json({
        error: "Solo se pueden editar los datos (monto, nombre, etc.) mientras el anticipo está pendiente.",
      });
    }

    const ESTADOS_BLOQUEADOS = ["aprobada", "descontado", "pagada"];
    if (ESTADOS_BLOQUEADOS.includes(actual.estado)) {
      // ¿Quién edita? El director es el rol "admin".
      let esDirector = false;
      try {
        const raw = req.headers["x-isp-session"] as string | undefined;
        if (raw) {
          const sess = JSON.parse(raw) as { rol?: string; username?: string };
          if (sess?.username) {
            const { rol } = await getPermisosForUsername(sess.username);
            esDirector = rol === "admin";
          } else {
            esDirector = sess?.rol === "admin";
          }
        }
      } catch {
        esDirector = false;
      }

      const cuotasPagadas = actual.cuotasPagadas ?? 0;
      const intentaCancelar = estado === "rechazada";
      const cambiaSoloObservaciones =
        (estado === undefined || estado === actual.estado) && num_cuotas === undefined;

      if (intentaCancelar) {
        if (!esDirector) {
          return res.status(403).json({
            error: "Este anticipo ya fue aprobado. Solo el director puede cancelarlo.",
          });
        }
        if (cuotasPagadas > 0) {
          return res.status(409).json({
            error: "No se puede cancelar: ya se descontaron cuotas de este anticipo.",
            cuotas_pagadas: cuotasPagadas,
          });
        }
        // Permitido: el director cancela un anticipo aprobado sin cuotas pagadas.
      } else if (!cambiaSoloObservaciones) {
        return res.status(409).json({
          error: "Este anticipo ya fue aprobado y sus cuotas/montos quedaron fijos. No se pueden modificar.",
        });
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (estado) updates.estado = estado;
    if (observaciones !== undefined) updates.observaciones = observaciones;

    // ── Edición de datos (solo pendientes, ya validado arriba) ────────────────
    if (editaDatos) {
      if (nombre !== undefined) {
        const n = String(nombre).trim();
        if (!n) return res.status(400).json({ error: "El nombre no puede quedar vacío." });
        updates.nombre = n;
      }
      if (puesto !== undefined) updates.puesto = puesto ? String(puesto).trim() : null;
      if (dpi !== undefined) updates.dpi = dpi ? String(dpi).trim() : null;
      if (telefono !== undefined) updates.telefono = telefono ? String(telefono).trim() : null;
      if (cantidad !== undefined) {
        const monto = Number(cantidad);
        if (isNaN(monto) || monto <= 0) {
          return res.status(400).json({ error: "El monto debe ser un número mayor a 0." });
        }
        updates.cantidad = monto;
        // Recalcular el cobro provisional (1 cuota, 10%), igual que al crear: las
        // cuotas reales se definen al aprobar.
        updates.montoCobro = String(calcularCobroAnticipo(monto, 1).montoCobro);
      }
    }

    // Cuando se aprueba: calcular cuotas si se indicó num_cuotas
    if (estado === "aprobada" && num_cuotas) {
      const cuotas = Math.max(1, parseInt(num_cuotas, 10) || 1);
      const montoBase = (updates.cantidad as number | undefined) ?? existing[0].cantidad;
      const { cuotaMonto, montoCobro } = calcularCobroAnticipo(montoBase, cuotas);
      updates.numCuotas = cuotas;
      updates.cuotaMonto = String(cuotaMonto);
      updates.montoCobro = String(montoCobro);
    }

    const [updated] = await db
      .update(anticiposTable)
      .set(updates)
      .where(eq(anticiposTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Anticipo no encontrado" });

    // Push al colaborador cuando la solicitud cambia a un estado terminal.
    const ESTADOS_RESUELTO = ["aprobada", "rechazada", "pagada"] as const;
    if (
      estado &&
      ESTADOS_RESUELTO.includes(estado as typeof ESTADOS_RESUELTO[number]) &&
      existing[0].estado !== estado &&
      updated.employeeId
    ) {
      notificarResolucionPush({
        tipo: "anticipo",
        solicitudId: updated.id,
        employeeId: updated.employeeId,
        estado: estado as typeof ESTADOS_RESUELTO[number],
        resumen: `Q${updated.cantidad}${observaciones ? ` — ${String(observaciones).slice(0, 80)}` : ""}`,
      }).catch((err) => {
        pushLogger.warn({ err, anticipoId: updated.id }, "Push de resolución de anticipo falló (no bloqueante)");
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar anticipo" });
  }
});

// ── DELETE /api/anticipos/:id ──────────────────────────────────────────────
// Borrar una solicitud SOLO si todavía está pendiente (sin aprobar), no está
// vinculada a una planilla y no tiene cuotas descontadas. Es la salida para
// cuando alguien se equivocó de datos y la solicitud aún no se procesó. El
// bloqueo tras aprobar/vincular se mantiene intacto.
anticiposRouter.delete("/anticipos/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

  try {
    const [existing] = await db
      .select()
      .from(anticiposTable)
      .where(eq(anticiposTable.id, id))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Anticipo no encontrado" });

    if (existing.planillaId !== null) {
      return res.status(409).json({
        error: "Este anticipo está vinculado a una planilla y no puede borrarse.",
        planilla_id: existing.planillaId,
      });
    }
    if (existing.estado !== "pendiente") {
      return res.status(409).json({
        error: "Solo se pueden borrar solicitudes pendientes (sin aprobar).",
      });
    }
    if ((existing.cuotasPagadas ?? 0) > 0) {
      return res.status(409).json({
        error: "No se puede borrar: ya se descontaron cuotas de este anticipo.",
        cuotas_pagadas: existing.cuotasPagadas,
      });
    }

    await db.delete(anticiposTable).where(eq(anticiposTable.id, id));
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: "Error al borrar anticipo" });
  }
});

export default anticiposRouter;
