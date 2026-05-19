/**
 * RECORDATORIO DE ABANDONO SIN RECONOCER — ISP, S.A.
 *
 * Job periódico que detecta alertas de tipo `abandono_puesto` en
 * `supervision_novedades` que llevan demasiado tiempo sin reconocerse
 * (`reconocida_at IS NULL` y `generada_at` antiguo) y vuelve a notificar
 * por push a los supervisores para que entren al dashboard a marcarlas
 * como atendidas.
 *
 * Configuración por env:
 *   - RECORDATORIO_ABANDONO_UMBRAL_MIN  (default 30)
 *       Minutos que debe llevar una alerta sin reconocer para que se
 *       dispare el primer recordatorio.
 *   - RECORDATORIO_ABANDONO_INTERVAL_MIN (default 5)
 *       Frecuencia con la que corre el job.
 *
 * Anti-spam: usa la columna `recordatorio_enviado_at` de
 * `supervision_novedades` (separada de `push_enviado_at` del push
 * inicial). El UPDATE condicional sólo marca la fila si
 * `recordatorio_enviado_at` es NULL o tiene más de 1 hora — así una
 * misma novedad recibe como máximo un recordatorio por hora, sin que
 * el timing del push inicial retrase el primer recordatorio.
 */

import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { notificarRecordatorioAbandonoPush } from "./push-notificaciones";
import { notificarRecordatorioAbandonoWhatsApp } from "./whatsapp/notificaciones.service";

function envInt(name: string, def: number): number {
  const raw = process.env[name];
  if (!raw) return def;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

interface NovedadPendienteRow {
  id: number;
  cliente_id: number | null;
  puesto_nombre: string | null;
  cliente_nombre: string | null;
  supervisor_nombre: string | null;
  minutos_sin_reconocer: number;
}

export async function ejecutarRecordatorioAbandono(): Promise<{
  candidatos: number;
  enviados: number;
  omitidos: number;
}> {
  const umbralMin = envInt("RECORDATORIO_ABANDONO_UMBRAL_MIN", 30);

  // Candidatos: abandono sin reconocer, generadas hace ≥ umbral, y cuyo
  // último recordatorio ocurrió hace ≥ 1h (o nunca). El push inicial
  // (push_enviado_at) tiene su propia ventana anti-spam y no influye aquí,
  // para que el primer recordatorio dispare apenas se cumple el umbral.
  const { rows } = await pool.query<NovedadPendienteRow>(
    `SELECT
       n.id,
       n.cliente_id                 AS cliente_id,
       po.nombre                    AS puesto_nombre,
       c.nombre                     AS cliente_nombre,
       e.nombre_completo            AS supervisor_nombre,
       FLOOR(EXTRACT(EPOCH FROM (NOW() - n.generada_at)) / 60)::int
                                    AS minutos_sin_reconocer
       FROM supervision_novedades n
       LEFT JOIN puestos_operativos po ON po.id = n.puesto_id
       LEFT JOIN clients c             ON c.id  = n.cliente_id
       LEFT JOIN employees e           ON e.id  = n.supervisor_employee_id
      WHERE n.tipo = 'abandono_puesto'
        AND n.reconocida_at IS NULL
        AND n.generada_at < NOW() - ($1::int || ' minutes')::interval
        AND (n.recordatorio_enviado_at IS NULL
             OR n.recordatorio_enviado_at < NOW() - INTERVAL '1 hour')
      ORDER BY n.generada_at ASC
      LIMIT 100`,
    [umbralMin]
  );

  let enviados = 0;
  let omitidos = 0;

  for (const row of rows) {
    // UPDATE condicional: si entre el SELECT y el UPDATE alguien más
    // (otro envío, otro proceso) ya marcó la fila, no enviamos.
    const marca = await pool.query(
      `UPDATE supervision_novedades
          SET recordatorio_enviado_at = NOW()
        WHERE id = $1
          AND tipo = 'abandono_puesto'
          AND reconocida_at IS NULL
          AND (recordatorio_enviado_at IS NULL
               OR recordatorio_enviado_at < NOW() - INTERVAL '1 hour')
        RETURNING id`,
      [row.id]
    );
    if (!marca.rowCount) {
      omitidos++;
      continue;
    }
    try {
      await notificarRecordatorioAbandonoPush({
        novedadId: row.id,
        clienteId: row.cliente_id,
        puestoNombre: row.puesto_nombre,
        clienteNombre: row.cliente_nombre,
        supervisorNombre: row.supervisor_nombre,
        minutosSinReconocer: row.minutos_sin_reconocer,
      });
      enviados++;
    } catch (err) {
      logger.error(
        { err, novedadId: row.id },
        "[Recordatorio-Abandono] error enviando push (no bloqueante)"
      );
    }
    // Canal paralelo: WhatsApp. Comparte el anti-spam de
    // `recordatorio_enviado_at` (ya marcado arriba), así que sólo se
    // dispara una vez por hora por novedad, igual que el push.
    try {
      await notificarRecordatorioAbandonoWhatsApp({
        novedadId: row.id,
        clienteId: row.cliente_id,
        puestoNombre: row.puesto_nombre,
        clienteNombre: row.cliente_nombre,
        minutosSinReconocer: row.minutos_sin_reconocer,
      });
    } catch (err) {
      logger.error(
        { err, novedadId: row.id },
        "[Recordatorio-Abandono] error enviando WhatsApp (no bloqueante)"
      );
    }
  }

  if (rows.length > 0) {
    logger.info(
      { candidatos: rows.length, enviados, omitidos, umbralMin },
      "[Recordatorio-Abandono] tanda procesada"
    );
  }

  return { candidatos: rows.length, enviados, omitidos };
}

let timer: NodeJS.Timeout | null = null;

export function startRecordatorioAbandonoJob(): void {
  if (timer) return;
  const intervalMin = envInt("RECORDATORIO_ABANDONO_INTERVAL_MIN", 5);
  const tick = async () => {
    try {
      await ejecutarRecordatorioAbandono();
    } catch (err) {
      logger.error({ err }, "[Recordatorio-Abandono] error en tick (no bloqueante)");
    }
  };
  // Primer disparo en frío al arrancar (no bloquea startup).
  tick();
  timer = setInterval(tick, intervalMin * 60 * 1000);
  logger.info({ intervalMin }, "[Recordatorio-Abandono] job programado");
}
