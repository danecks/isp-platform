import { Router } from "express";
import { pool, todayGT } from "@workspace/db";
import { logger } from "../../lib/logger";
import { generarNovedades } from "../nomina";

import { isoADDMMYYYY, calcFechaActiva } from "./_helpers/fechas";
import {
  calcularResponsableTurnoLocal,
  sincronizarCustodiasAlCierre,
} from "./_helpers/cierre-sync";
import { getActorFromReq } from "../../lib/auth-helpers";

const router = Router();

// Fecha de inicio de operación del sistema. Los "días sin cerrar" del pizarrón
// nunca se muestran antes de esta fecha (el sistema empezó a operar el 1-jun-2026,
// las filas previas son de pruebas). Si la fecha cambia, ajustar aquí.
const FECHA_INICIO_OPERACION = "2026-06-01";

router.get("/operaciones/cierre-hoy", async (req, res) => {
  try {
    const { fechaActivaISO, fechaActivaStr, esFechaFutura, cierreDeHoy } = await calcFechaActiva();

    // Cierre de la fecha activa (si existe — normalmente null cuando esFechaFutura)
    const { rows: cierreActivaRows } = await pool.query(
      `SELECT * FROM cierre_operativo_diario WHERE fecha = $1`,
      [fechaActivaISO]
    );
    const cierreActiva = cierreActivaRows[0] ?? null;

    const { rows: puestos } = await pool.query(`
      SELECT id, nombre, cliente_nombre, estado, agente_id, titular_employee_id
      FROM puestos_operativos WHERE activo = TRUE
    `);

    const totalPuestos        = puestos.length;
    const cubiertos           = puestos.filter((p: any) => p.estado === 'cubierto').length;
    const descubiertos        = totalPuestos - cubiertos;
    const cubiertosPorTitular = puestos.filter((p: any) => p.agente_id && p.agente_id === p.titular_employee_id).length;
    const cubiertosPorRelevo  = puestos.filter((p: any) => p.agente_id && p.agente_id !== p.titular_employee_id).length;

    const { rows: movHoy } = await pool.query(`
      SELECT tipo, motivo, COUNT(*) AS cantidad
      FROM movimientos_operativos
      WHERE DATE(fecha_hora AT TIME ZONE 'America/Guatemala') = $1
      GROUP BY tipo, motivo
    `, [fechaActivaISO]);

    const ausencias = movHoy
      .filter((m: any) => m.motivo === 'falta')
      .reduce((acc: number, m: any) => acc + parseInt(m.cantidad), 0);

    const { rows: relevosRows } = await pool.query(`
      SELECT COUNT(*) AS cantidad FROM movimientos_operativos
      WHERE DATE(fecha_hora AT TIME ZONE 'America/Guatemala') = $1
        AND tipo = 'sustitucion' AND (motivo IS NULL OR motivo = '')
    `, [fechaActivaISO]);
    const relevossinMotivo = parseInt(relevosRows[0]?.cantidad ?? '0');

    // Puestos cubiertos sin tramos registrados en cobertura_segmentos
    const { rows: sinSegmentos } = await pool.query(`
      SELECT COUNT(*)::int AS cantidad
      FROM puestos_operativos po
      WHERE po.activo = TRUE AND po.estado = 'cubierto'
        AND NOT EXISTS (
          SELECT 1 FROM cobertura_segmentos cs
          WHERE cs.puesto_id = po.id
            AND cs.fecha = $1
        )
    `, [fechaActivaISO]);
    const puestosSinTramos = sinSegmentos[0]?.cantidad ?? 0;

    let totalCustodiaSlots = 0;
    let custodiaCubiertos = 0;
    try {
      const diaSemCierre = new Date(fechaActivaISO + 'T12:00:00Z').getUTCDay();
      const { rows: custCl } = await pool.query(`
        SELECT c.id, COALESCE(cfs.cantidad_agentes, 0) AS fuerza
        FROM clients c
        LEFT JOIN custodia_fuerza_semanal cfs ON cfs.cliente_id = c.id AND cfs.dia_semana = $1
        WHERE c.estado = 'activo' AND c.tipo_servicio IN ('custodia','mixto')
      `, [diaSemCierre]);

      for (const cl of custCl) {
        const f = Number(cl.fuerza) || 0;
        if (f === 0) continue;
        totalCustodiaSlots += f;

        const { rows: titR } = await pool.query(
          `SELECT slot_numero, employee_id FROM custodia_titulares WHERE cliente_id = $1 AND activo = TRUE`, [cl.id]
        );
        const titMap = new Map<number, number>();
        for (const t of titR) titMap.set(Number(t.slot_numero), Number(t.employee_id));

        const { rows: asigR } = await pool.query(
          `SELECT slot_numero FROM custodia_asignacion_diaria WHERE cliente_id = $1 AND fecha = $2::date`, [cl.id, fechaActivaISO]
        );
        const asigSet = new Set(asigR.map((a: any) => Number(a.slot_numero)));

        const { rows: faltR } = await pool.query(
          `SELECT employee_id FROM eventos_rrhh WHERE tipo_evento = 'falta' AND DATE(fecha) = $1::date AND estado != 'anulado'`, [fechaActivaISO]
        );
        const faltSet = new Set(faltR.map((r: any) => Number(r.employee_id)));

        for (let i = 1; i <= f; i++) {
          const titEmp = titMap.get(i);
          if (asigSet.has(i)) { custodiaCubiertos++; }
          else if (titEmp && !faltSet.has(titEmp)) { custodiaCubiertos++; }
        }
      }
    } catch (custErr) {
      logger.warn({ custErr }, "cierre-hoy: error contando custodia (no bloqueante)");
    }
    const custodiaDescubiertos = totalCustodiaSlots - custodiaCubiertos;

    const advertencias: string[] = [];
    if (descubiertos > 0)     advertencias.push(`${descubiertos} puesto${descubiertos !== 1 ? 's' : ''} descubierto${descubiertos !== 1 ? 's' : ''}`);
    if (custodiaDescubiertos > 0) advertencias.push(`${custodiaDescubiertos} slot${custodiaDescubiertos !== 1 ? 's' : ''} de custodia descubierto${custodiaDescubiertos !== 1 ? 's' : ''}`);
    if (relevossinMotivo > 0) advertencias.push(`${relevossinMotivo} relevo${relevossinMotivo !== 1 ? 's' : ''} sin motivo registrado`);
    if (puestosSinTramos > 0) advertencias.push(`${puestosSinTramos} puesto${puestosSinTramos !== 1 ? 's' : ''} cubierto${puestosSinTramos !== 1 ? 's' : ''} sin tramos de cobertura registrados`);

    // Días pasados sin cierre: todos los días desde el primer cierre registrado
    // hasta ayer que NO están marcados como 'cerrado'.
    const { rows: pendientesRows } = await pool.query(`
      SELECT d::date::text AS fecha
      FROM generate_series(
        GREATEST(
          COALESCE(
            (SELECT MIN(fecha) FROM cierre_operativo_diario),
            $1::date
          ),
          $2::date
        ),
        $1::date - INTERVAL '1 day',
        '1 day'::interval
      ) AS s(d)
      WHERE NOT EXISTS (
        SELECT 1 FROM cierre_operativo_diario cod
        WHERE cod.fecha = d::date AND cod.estado = 'cerrado'
      )
      ORDER BY fecha
    `, [todayGT(), FECHA_INICIO_OPERACION]);

    const diasPendientesCierre = pendientesRows.map((r: any) => ({
      fecha:     r.fecha as string,
      fechaStr:  isoADDMMYYYY(r.fecha as string),
    }));

    // Días que SÍ están explícitamente cerrados (para que el frontend
    // pueda distinguir "día cerrado → solo lectura/Reabrir" vs "día abierto/sin registro → editable").
    // Incluye también el día de hoy si ya fue cerrado (caso: cerraron hoy temprano y siguen viendo el pizarrón).
    const { rows: cerradosRows } = await pool.query(`
      SELECT fecha::text AS fecha
      FROM cierre_operativo_diario
      WHERE estado = 'cerrado' AND fecha <= $1::date
      ORDER BY fecha
    `, [todayGT()]);

    const diasCerrados: string[] = cerradosRows.map((r: any) =>
      (r.fecha as string).substring(0, 10)
    );

    res.json({
      estado:         cierreActiva?.estado ?? 'abierto',
      cierre:         cierreActiva ?? null,
      fechaActiva:    fechaActivaISO,
      fechaActivaStr,
      esFechaFutura,
      cierreDeHoy:    cierreDeHoy ?? null,
      resumen: {
        totalPuestos,
        cubiertos,
        descubiertos,
        cubiertosPorTitular,
        cubiertosPorRelevo,
        ausencias,
        horasExtra: 0,
        totalCustodiaSlots,
        custodiaCubiertos,
        custodiaDescubiertos,
      },
      advertencias,
      diasPendientesCierre,
      diasCerrados,
    });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/cierre-hoy error");
    res.status(500).json({ error: "Error al consultar estado de cierre" });
  }
});

// Cerrar la fecha activa o una fecha pasada (retroactivo, solo supervisor/admin).
//
// Body:
//   confirmacion  : string  — "CERRAR DD/MM/YYYY" (fecha a cerrar)
//   comentario    : string? — Motivo / nota libre
//   usuario       : string  — Nombre del usuario
//   usuarioId     : number? — ID del usuario
//   rol           : string  — Rol del usuario
//   fecha         : string? — "YYYY-MM-DD". Si no se envía → cierra la fecha activa.
//                             Si es pasada → cierre retroactivo (requiere admin/supervisor).
//                             Si es futura → rechazado.
// ─── GET /api/operaciones/cierre/preview-custodias ───────────────────────────
// Preview sin aplicar cambios: qué custodias cambiarían al cerrar.

router.get("/operaciones/cierre/preview-custodias", async (req, res) => {
  try {
    const fechaParam = req.query.fecha as string | undefined;
    const fecha = (fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam)) ? fechaParam : todayGT();

    // Armas: compara custodio actual con agente que cubre el puesto hoy
    const { rows: armasRows } = await pool.query(`
      SELECT
        a.id, a.codigo, a.puesto_id,
        po.nombre           AS puesto_nombre,
        po.cliente_nombre,
        po.agente_id        AS nuevo_custodio_id,
        e_nuevo.nombre_completo AS nuevo_custodio_nombre,
        ac.employee_id      AS custodio_actual_id,
        e_actual.nombre_completo AS custodio_actual_nombre
      FROM armas a
      JOIN puestos_operativos po     ON po.id = a.puesto_id
      LEFT JOIN arma_custodia ac     ON ac.arma_id = a.id AND ac.fecha_fin IS NULL
      LEFT JOIN employees e_actual   ON e_actual.id = ac.employee_id
      LEFT JOIN employees e_nuevo    ON e_nuevo.id  = po.agente_id
      WHERE a.activo = TRUE AND a.puesto_id IS NOT NULL
    `);

    const armasCambios = armasRows
      .filter((r: any) => r.nuevo_custodio_id && String(r.custodio_actual_id) !== String(r.nuevo_custodio_id))
      .map((r: any) => ({
        tipo: 'arma' as const,
        id: r.id,
        codigo: r.codigo,
        referencaNombre: r.puesto_nombre,
        clienteNombre: r.cliente_nombre,
        custodioAnteriorNombre: r.custodio_actual_nombre ?? '(Sin custodio)',
        custodioNuevoNombre: r.nuevo_custodio_nombre,
      }));

    // Vehículos: compara custodio actual con responsable de zona según motor de ciclos
    const { rows: vehiculosRows } = await pool.query(`
      SELECT
        v.id, v.placa, v.zona_operativa_id,
        oz.nombre AS zona_nombre,
        vc.employee_id AS custodio_actual_id,
        e_actual.nombre_completo AS custodio_actual_nombre
      FROM vehiculos v
      JOIN operational_zones oz      ON oz.id = v.zona_operativa_id
      LEFT JOIN vehiculo_custodia vc ON vc.vehiculo_id = v.id AND vc.fecha_fin IS NULL
      LEFT JOIN employees e_actual   ON e_actual.id = vc.employee_id
      WHERE v.activo = TRUE AND v.zona_operativa_id IS NOT NULL
    `);

    const vehiculosCambios: any[] = [];
    for (const v of vehiculosRows) {
      const responsable = await calcularResponsableTurnoLocal(v.zona_operativa_id, fecha);
      if (!responsable) continue;
      if (v.custodio_actual_id && String(v.custodio_actual_id) === String(responsable.id)) continue;
      vehiculosCambios.push({
        tipo: 'vehiculo',
        id: v.id,
        codigo: v.placa,
        referencaNombre: v.zona_nombre,
        custodioAnteriorNombre: v.custodio_actual_nombre ?? '(Sin custodio)',
        custodioNuevoNombre: responsable.nombre_completo,
      });
    }

    res.json({
      fecha,
      armas: armasCambios,
      vehiculos: vehiculosCambios,
      totalCambios: armasCambios.length + vehiculosCambios.length,
    });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/cierre/preview-custodias error");
    res.status(500).json({ error: "Error al calcular preview de custodias" });
  }
});


router.post("/operaciones/cierre", async (req, res) => {
  const { confirmacion, comentario, fecha: fechaSolicitada, sincronizarCustodias } = req.body;

  // Hardening 2026-04-25: rol/usuario/usuarioId vienen de la sesión real (BD),
  // NO del body. (Antes: el cliente podía enviar `"rol":"admin"` o falsificar
  // `usuario` para que la bitácora atribuyera el cierre a otra persona.)
  const actor = await getActorFromReq(req);
  if (!actor) {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
  const rol = actor.rol;
  const usuario = actor.username;
  const usuarioId = actor.id;
  if (!['admin', 'supervisor'].includes(rol)) {
    return res.status(403).json({ error: 'Solo supervisores y administradores pueden cerrar el día' });
  }

  try {
    const todayISO = todayGT();

    // ── Determinar fecha a cerrar y si es retroactiva ──────────────────────
    // REGLA: si el frontend envía una `fecha` explícita, esa fecha manda.
    // Solo si no envía nada, calculamos la fecha activa (siguiente día abierto).
    let fechaACerrarISO: string;
    let esRetroactivo: boolean;

    if (fechaSolicitada) {
      if (fechaSolicitada > todayISO) {
        return res.status(400).json({ error: 'No se puede cerrar una fecha futura' });
      }
      esRetroactivo = fechaSolicitada < todayISO;
      if (esRetroactivo) {
        const diasAtras = Math.floor(
          (new Date(todayISO).getTime() - new Date(fechaSolicitada).getTime()) / 86_400_000
        );
        // Supervisor puede cerrar hasta 7 días atrás; admin sin límite
        if (rol === 'supervisor' && diasAtras > 7) {
          return res.status(403).json({
            error: `Supervisores solo pueden cerrar hasta 7 días atrás (esta fecha tiene ${diasAtras} días). Contacta a un administrador.`,
          });
        }
      }
      fechaACerrarISO = fechaSolicitada;
    } else {
      // Sin fecha explícita: usar la fecha activa calculada por calcFechaActiva()
      const { fechaActivaISO } = await calcFechaActiva();
      fechaACerrarISO = fechaActivaISO;
      esRetroactivo = fechaActivaISO < todayISO;
    }

    const fechaACerrarStr = isoADDMMYYYY(fechaACerrarISO);

    // ── Validar confirmación ────────────────────────────────────────────────
    const confirmacionEsperada = `CERRAR ${fechaACerrarStr}`;
    if (confirmacion !== confirmacionEsperada) {
      return res.status(400).json({ error: `Texto incorrecto. Escribe exactamente: ${confirmacionEsperada}` });
    }

    // ── Verificar que no esté ya cerrado ───────────────────────────────────
    const { rows: existente } = await pool.query(
      `SELECT estado FROM cierre_operativo_diario WHERE fecha = $1`,
      [fechaACerrarISO]
    );
    if (existente[0]?.estado === 'cerrado') {
      return res.status(400).json({ error: `El día ${fechaACerrarStr} ya está cerrado` });
    }

    // ── Snapshot de cobertura ──────────────────────────────────────────────
    // Retroactivo: reconstruir desde cobertura_segmentos de esa fecha
    // Normal: estado actual del pizarrón
    let snapshotPuestos: any[];

    if (esRetroactivo) {
      // Reconstruir puestos cubiertos desde segmentos históricos de la fecha
      const { rows: segSnap } = await pool.query(`
        SELECT DISTINCT ON (cs.puesto_id)
               po.id, po.nombre, po.cliente_nombre, po.cliente_id,
               'cubierto'           AS estado,
               cs.employee_id       AS agente_id,
               cs.empleado_nombre   AS agente_nombre,
               -- TH: titular efectivo para la fecha del cierre (histórico con fallback)
               COALESCE(
                 (SELECT pth.employee_id FROM puesto_titular_historico pth
                  WHERE pth.puesto_id = po.id
                    AND pth.fecha_inicio <= $1::date
                    AND (pth.fecha_fin IS NULL OR pth.fecha_fin >= $1::date)
                  ORDER BY pth.fecha_inicio DESC LIMIT 1),
                 po.titular_employee_id
               ) AS titular_employee_id,
               COALESCE(
                 (SELECT e2.nombre_completo
                  FROM puesto_titular_historico pth
                  JOIN employees e2 ON e2.id = pth.employee_id
                  WHERE pth.puesto_id = po.id
                    AND pth.fecha_inicio <= $1::date
                    AND (pth.fecha_fin IS NULL OR pth.fecha_fin >= $1::date)
                  ORDER BY pth.fecha_inicio DESC LIMIT 1),
                 po.titular_nombre
               ) AS titular_nombre,
               po.turno, po.horario, po.jornada, po.notas, po.orden,
               po.zona_operativa_id, oz.nombre AS zona_nombre,
               po.sede_id,          sedes.nombre AS sede_nombre
        FROM cobertura_segmentos cs
        JOIN puestos_operativos po   ON po.id = cs.puesto_id
        LEFT JOIN operational_zones oz ON oz.id = po.zona_operativa_id
        LEFT JOIN client_sedes sedes   ON sedes.id = po.sede_id
        WHERE cs.fecha = $1
        ORDER BY cs.puesto_id, cs.hora_inicio
      `, [fechaACerrarISO]);
      snapshotPuestos = segSnap;
    } else {
      // Estado actual del pizarrón — titular histórico de hoy
      const { rows: puestoSnap } = await pool.query(`
        SELECT po.id, po.nombre, po.cliente_nombre, po.cliente_id, po.estado,
               po.agente_id, po.agente_nombre,
               -- TH: titular efectivo para hoy (histórico con fallback)
               COALESCE(
                 (SELECT pth.employee_id FROM puesto_titular_historico pth
                  WHERE pth.puesto_id = po.id
                    AND pth.fecha_inicio <= CURRENT_DATE
                    AND (pth.fecha_fin IS NULL OR pth.fecha_fin >= CURRENT_DATE)
                  ORDER BY pth.fecha_inicio DESC LIMIT 1),
                 po.titular_employee_id
               ) AS titular_employee_id,
               COALESCE(
                 (SELECT e2.nombre_completo
                  FROM puesto_titular_historico pth
                  JOIN employees e2 ON e2.id = pth.employee_id
                  WHERE pth.puesto_id = po.id
                    AND pth.fecha_inicio <= CURRENT_DATE
                    AND (pth.fecha_fin IS NULL OR pth.fecha_fin >= CURRENT_DATE)
                  ORDER BY pth.fecha_inicio DESC LIMIT 1),
                 po.titular_nombre
               ) AS titular_nombre,
               po.turno, po.horario, po.jornada, po.notas, po.orden,
               po.zona_operativa_id, oz.nombre AS zona_nombre,
               po.sede_id, sedes.nombre AS sede_nombre
        FROM puestos_operativos po
        LEFT JOIN operational_zones oz  ON oz.id = po.zona_operativa_id
        LEFT JOIN client_sedes sedes    ON sedes.id = po.sede_id
        WHERE po.activo = TRUE
        ORDER BY po.cliente_nombre, po.orden, po.nombre
      `);
      snapshotPuestos = puestoSnap;
    }

    const totalPuestos        = snapshotPuestos.length;
    const cubiertos           = snapshotPuestos.filter((p: any) => p.estado === 'cubierto').length;
    const descubiertos        = totalPuestos - cubiertos;
    const cubiertosPorTitular = snapshotPuestos.filter((p: any) => p.agente_id && p.agente_id === p.titular_employee_id).length;
    const cubiertosPorRelevo  = snapshotPuestos.filter((p: any) => p.agente_id && p.agente_id !== p.titular_employee_id).length;

    // ── Snapshot de custodia slots ──────────────────────────────────────────
    let snapshotCustodias: any[] = [];
    try {
      const diaSemana = new Date(fechaACerrarISO + 'T12:00:00Z').getUTCDay();

      const { rows: custClients } = await pool.query(`
        SELECT c.id, c.nombre, c.nombre_comercial, c.tipo_servicio,
               COALESCE(cfs.cantidad_agentes, 0) AS fuerza_hoy
        FROM clients c
        LEFT JOIN custodia_fuerza_semanal cfs ON cfs.cliente_id = c.id AND cfs.dia_semana = $1
        WHERE c.estado = 'activo' AND c.tipo_servicio IN ('custodia','mixto')
      `, [diaSemana]);

      for (const cl of custClients) {
        const fuerza = Number(cl.fuerza_hoy) || 0;
        if (fuerza === 0) continue;

        const { rows: titRows } = await pool.query(
          `SELECT slot_numero, employee_id, (SELECT nombre_completo FROM employees WHERE id = ct.employee_id) AS nombre
           FROM custodia_titulares ct WHERE cliente_id = $1 AND activo = TRUE`,
          [cl.id]
        );
        const titMap = new Map<number, any>();
        for (const t of titRows) titMap.set(Number(t.slot_numero), t);

        const { rows: asigRows } = await pool.query(
          `SELECT cad.slot_numero, cad.employee_id, e.nombre_completo
           FROM custodia_asignacion_diaria cad
           JOIN employees e ON e.id = cad.employee_id
           WHERE cad.cliente_id = $1 AND cad.fecha = $2::date`,
          [cl.id, fechaACerrarISO]
        );
        const asigMap = new Map<number, any>();
        for (const a of asigRows) asigMap.set(Number(a.slot_numero), a);

        const { rows: faltaRows } = await pool.query(
          `SELECT employee_id FROM eventos_rrhh
           WHERE tipo_evento = 'falta' AND DATE(fecha) = $1::date AND estado != 'anulado'`,
          [fechaACerrarISO]
        );
        const faltaSet = new Set(faltaRows.map((f: any) => Number(f.employee_id)));

        for (let i = 1; i <= fuerza; i++) {
          const tit = titMap.get(i);
          const asig = asigMap.get(i);
          const titFaltando = tit && faltaSet.has(Number(tit.employee_id));

          let agente_id: number | null = null;
          let agente_nombre: string | null = null;
          let estado = 'descubierto';
          let es_relevo = false;

          if (asig) {
            agente_id = asig.employee_id;
            agente_nombre = asig.nombre_completo;
            estado = 'cubierto';
            if (tit && Number(asig.employee_id) !== Number(tit.employee_id)) es_relevo = true;
          } else if (tit && !titFaltando) {
            agente_id = tit.employee_id;
            agente_nombre = tit.nombre;
            estado = 'cubierto';
          }

          snapshotCustodias.push({
            id: `custodia-${cl.id}-${i}`,
            es_custodia: true,
            slot_numero: i,
            cliente_id: cl.id,
            cliente_nombre: cl.nombre_comercial || cl.nombre,
            estado,
            agente_id,
            agente_nombre,
            titular_employee_id: tit?.employee_id ?? null,
            titular_nombre: tit?.nombre ?? null,
            titular_faltando: titFaltando || false,
            es_relevo_dia: es_relevo,
          });
        }
      }
    } catch (custErr) {
      logger.warn({ custErr }, "Cierre: error al generar snapshot custodia (no bloqueante)");
    }

    const totalCustodiaSlots = snapshotCustodias.length;
    const custodiaCubiertos  = snapshotCustodias.filter((s: any) => s.estado === 'cubierto').length;

    // Movimientos de la fecha cerrada (históricos)
    const { rows: movDia } = await pool.query(`
      SELECT tipo, motivo, agente_saliente_nombre, agente_entrante_nombre,
             puesto_nombre, cliente_nombre, fecha_hora
      FROM movimientos_operativos
      WHERE DATE(fecha_hora AT TIME ZONE 'America/Guatemala') = $1::date
      ORDER BY fecha_hora
    `, [fechaACerrarISO]);
    const ausencias = movDia.filter((m: any) => m.motivo === 'falta').length;

    const resumen = {
      totalPuestos, cubiertos, descubiertos,
      cubiertosPorTitular, cubiertosPorRelevo,
      ausencias, horasExtra: 0,
      snapshotPuestos,
      snapshotCustodias,
      totalCustodiaSlots,
      custodiaCubiertos,
      custodiaDescubiertos: totalCustodiaSlots - custodiaCubiertos,
      movimientosHoy:   movDia,
      fechaCierre:      new Date().toISOString(),
      retroactivo:      esRetroactivo,
      cerradoPor:       usuario,
      cerradoEn:        new Date().toISOString(),
    };

    const { rows: cierreRows } = await pool.query(`
      INSERT INTO cierre_operativo_diario
        (fecha, estado, resumen_json, cerrado_por_id, cerrado_por, cerrado_en, comentario, retroactivo)
      VALUES ($1, 'cerrado', $2, $3, $4, NOW(), $5, $6)
      ON CONFLICT (fecha) DO UPDATE
        SET estado        = 'cerrado',
            resumen_json  = $2,
            cerrado_por_id = $3,
            cerrado_por   = $4,
            cerrado_en    = NOW(),
            comentario    = $5,
            retroactivo   = $6,
            updated_at    = NOW()
      RETURNING *
    `, [fechaACerrarISO, JSON.stringify(resumen), usuarioId ?? null, usuario ?? 'sistema', comentario ?? null, esRetroactivo]);

    // ── Auditoría ──────────────────────────────────────────────────────────
    const accionAudit  = esRetroactivo ? 'cerrar_retroactivo' : 'cerrar';
    const detalleAudit = esRetroactivo
      ? `Cierre RETROACTIVO de ${fechaACerrarStr} realizado por ${usuario ?? 'sistema'} el ${isoADDMMYYYY(todayISO)}.${comentario ? ` Motivo: ${comentario}` : ''}`
      : `Día ${fechaACerrarStr} cerrado.${comentario ? ` Comentario: ${comentario}` : ''}`;

    await pool.query(`
      INSERT INTO cierre_auditoria (cierre_id, accion, user_id, user_nombre, detalle)
      VALUES ($1, $2, $3, $4, $5)
    `, [cierreRows[0].id, accionAudit, usuarioId ?? null, usuario ?? 'sistema', detalleAudit]);

    // ── Generar eventos RRHH diferidos para puestos que siguen "faltando" ──
    let faltasDiferidas = 0;
    try {
      const { rows: puestosFaltando } = await pool.query(`
        SELECT po.id, po.nombre, po.cliente_nombre, po.falta_employee_id, po.falta_motivo, po.falta_notas, po.falta_usuario,
               COALESCE(t.horas_trabajo, 24) AS turno_horas
        FROM puestos_operativos po
        LEFT JOIN turnos t ON t.id = po.tipo_turno_id
        WHERE po.estado_operativo_puesto = 'faltando'
          AND po.falta_employee_id IS NOT NULL
      `);

      for (const pf of puestosFaltando) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          const { rows: yaExiste } = await client.query(`
            SELECT id FROM eventos_rrhh
            WHERE employee_id = $1
              AND DATE(fecha) = $2
              AND tipo_evento = 'falta'
              AND estado != 'anulado'
              AND puesto_nombre = $3
          `, [pf.falta_employee_id, fechaACerrarISO, pf.nombre]);

          let eventoId: number | null = null;

          if (yaExiste.length === 0) {
            const { rows: empRows } = await client.query(
              `SELECT nombre_completo FROM employees WHERE id = $1`,
              [pf.falta_employee_id]
            );
            const empNombre = empRows[0]?.nombre_completo ?? "Colaborador";

            const { rows: evRows } = await client.query(`
              INSERT INTO eventos_rrhh (employee_id, employee_nombre, tipo_evento, fecha, observaciones,
                usuario_generador, puesto_nombre, cliente_nombre, generado_desde, estado)
              VALUES ($1, $2, 'falta', $3::date, $4, $5, $6, $7, 'cierre_operativo', 'pendiente_aprobacion')
              RETURNING id
            `, [
              pf.falta_employee_id, empNombre, fechaACerrarISO,
              pf.falta_notas ?? `${pf.falta_motivo ?? "inasistencia"} — ${pf.nombre} (${pf.cliente_nombre})`,
              pf.falta_usuario ?? usuario ?? 'sistema',
              pf.nombre, pf.cliente_nombre,
            ]);
            eventoId = evRows[0]?.id ?? null;
          } else {
            eventoId = yaExiste[0].id;
          }

          const { rows: empRows2 } = await client.query(
            `SELECT nombre_completo FROM employees WHERE id = $1`,
            [pf.falta_employee_id]
          );
          const empNombre2 = empRows2[0]?.nombre_completo ?? "Colaborador";

          const turnoHoras = parseFloat(pf.turno_horas) || 24;
          const diasDescFalta = turnoHoras >= 24 ? 3 : 2;

          await client.query(`
            INSERT INTO novedades_nomina_diarias
              (fecha, employee_id, empleado_nombre, trabajo_dia, horas_trabajadas, horas_extra,
               falta, descuento_dia, impacto_nomina, requiere_revision_rrhh,
               tipo_novedad, evento_rrhh_id, puesto_titular_id, puesto_titular_nombre, fuente,
               dias_descuento)
            VALUES ($1, $2, $3, FALSE, 0, 0, FALSE, FALSE, 'pendiente', TRUE,
                    'falta_total', $6, $4, $5, 'cierre_falta_diferida', $7)
            ON CONFLICT (fecha, employee_id) DO UPDATE SET
              trabajo_dia            = FALSE,
              horas_trabajadas       = 0,
              tipo_novedad           = COALESCE(novedades_nomina_diarias.tipo_novedad, 'falta_total'),
              evento_rrhh_id         = COALESCE(novedades_nomina_diarias.evento_rrhh_id, EXCLUDED.evento_rrhh_id),
              dias_descuento         = EXCLUDED.dias_descuento,
              impacto_nomina         = CASE
                WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                THEN novedades_nomina_diarias.impacto_nomina
                ELSE 'pendiente'
              END,
              requiere_revision_rrhh = CASE
                WHEN novedades_nomina_diarias.impacto_nomina IN ('aprobado_rrhh','rechazado_rrhh')
                THEN novedades_nomina_diarias.requiere_revision_rrhh
                ELSE TRUE
              END,
              updated_at             = NOW()
          `, [fechaACerrarISO, pf.falta_employee_id, empNombre2, pf.id, pf.nombre, eventoId, diasDescFalta]);

          // ── Enlazar horas extra generadas por la cobertura de esta falta ──────
          // Opción 1: une TODAS las coberturas del puesto/día marcadas como hora extra.
          // Usa genera_horas_extra (señal confiable: solo TRUE cuando de verdad es HE).
          // Las HE creadas por /sustituir tienen genera_horas_extra=FALSE y su propio
          // evento, por lo que no se duplican aquí.
          if (eventoId) {
            const { rows: coberturasHE } = await client.query(`
              SELECT cs.employee_id, cs.empleado_nombre, cs.horas_calculadas, emp.dpi
              FROM cobertura_segmentos cs
              LEFT JOIN employees emp ON emp.id = cs.employee_id
              WHERE cs.fecha = $1::date AND cs.puesto_id = $2 AND cs.genera_horas_extra = TRUE
            `, [fechaACerrarISO, pf.id]);

            for (const cov of coberturasHE) {
              const { rows: heExiste } = await client.query(`
                SELECT id, evento_par_id FROM eventos_rrhh
                WHERE employee_id = $1 AND DATE(fecha) = $2 AND tipo_evento = 'horas_extra'
                  AND puesto_nombre = $3 AND COALESCE(cliente_nombre,'') = COALESCE($4,'') AND estado != 'anulado'
                ORDER BY id DESC
                LIMIT 1
              `, [cov.employee_id, fechaACerrarISO, pf.nombre, pf.cliente_nombre]);

              let heId: number | null = null;
              if (heExiste.length > 0) {
                heId = heExiste[0].id;
                if (!heExiste[0].evento_par_id) {
                  await client.query(`UPDATE eventos_rrhh SET evento_par_id = $1 WHERE id = $2`, [eventoId, heId]);
                }
              } else {
                const { rows: heRows } = await client.query(`
                  INSERT INTO eventos_rrhh (employee_id, employee_nombre, employee_dpi, tipo_evento, fecha,
                    cliente_nombre, puesto_nombre, generado_desde, estado, usuario_generador,
                    observaciones, documentos_generados, evento_par_id, cantidad_horas)
                  VALUES ($1,$2,$3,'horas_extra',$4::date,$5,$6,'cierre_operativo','pendiente_aprobacion',$7,$8,'[]',$9,$10)
                  RETURNING id
                `, [cov.employee_id, cov.empleado_nombre, cov.dpi ?? null, fechaACerrarISO,
                    pf.cliente_nombre, pf.nombre, usuario ?? 'sistema',
                    `Cobertura HE por falta de ${empNombre2} en ${pf.nombre} (${pf.cliente_nombre})`,
                    eventoId, cov.horas_calculadas]);
                heId = heRows[0]?.id ?? null;
              }

              // Back-compat 1:1: si la falta aún no tiene par, apúntala a la primera HE.
              if (heId) {
                await client.query(
                  `UPDATE eventos_rrhh SET evento_par_id = COALESCE(evento_par_id, $1) WHERE id = $2`,
                  [heId, eventoId]
                );
              }
            }
          }

          await client.query('COMMIT');

          if (yaExiste.length === 0) faltasDiferidas++;
          logger.info({ puestoId: pf.id, employeeId: pf.falta_employee_id, fecha: fechaACerrarISO },
            yaExiste.length === 0 ? "Falta diferida materializada al cierre" : "Falta diferida: novedad backfill al cierre");
        } catch (txErr) {
          await client.query('ROLLBACK');
          logger.warn({ txErr, puestoId: pf.id }, "Falta diferida: transacción falló (no bloqueante)");
        } finally {
          client.release();
        }
      }

      if (faltasDiferidas > 0) {
        logger.info({ faltasDiferidas }, "Faltas diferidas generadas al cierre del pizarrón");
      }
    } catch (faltaErr) {
      logger.warn({ faltaErr }, "Error al generar faltas diferidas al cierre (no bloqueante)");
    }

    // ── Generar novedades de nómina desde segmentos de cobertura ──────────
    const novedadesGeneradas = await generarNovedades(fechaACerrarISO, cierreRows[0].id);

    // ── Sincronización de custodias (opcional) ─────────────────────────────
    let syncCustodias: { armas: any[]; vehiculos: any[]; totalCambios: number } | null = null;
    if (sincronizarCustodias) {
      try {
        syncCustodias = await sincronizarCustodiasAlCierre(
          fechaACerrarISO, cierreRows[0].id, snapshotPuestos,
          usuario ?? 'sistema', usuarioId ?? null
        );
        logger.info({ totalCambios: syncCustodias.totalCambios }, "Custodias sincronizadas al cierre");
      } catch (syncErr) {
        logger.error({ syncErr }, "Error al sincronizar custodias al cierre (no bloqueante)");
      }
    }

    const faltasMsg = faltasDiferidas > 0 ? ` ${faltasDiferidas} falta(s) pendiente(s) generada(s).` : "";
    const mensaje = esRetroactivo
      ? `Cierre retroactivo de ${fechaACerrarStr} completado. ${novedadesGeneradas} novedad(es) de nómina generada(s).${faltasMsg}`
      : `Día ${fechaACerrarStr} cerrado. ${novedadesGeneradas} novedad(es) de nómina generada(s).${faltasMsg}`;

    logger.info({ usuario, fecha: fechaACerrarStr, esRetroactivo, novedadesGeneradas, faltasDiferidas }, "Día operativo cerrado");
    res.json({ ok: true, cierre: cierreRows[0], resumen, novedadesGeneradas, faltasDiferidas, retroactivo: esRetroactivo, mensaje, syncCustodias });
  } catch (err) {
    logger.error({ err }, "POST /operaciones/cierre error");
    res.status(500).json({ error: "Error al cerrar el día" });
  }
});

// ─── POST /api/operaciones/reabrir ───────────────────────────────────────────

router.post("/operaciones/reabrir", async (req, res) => {
  const { confirmacion, motivo, fecha } = req.body;

  // Hardening 2026-04-25: rol/usuario/usuarioId vienen de la sesión real (BD), NO del body.
  const actor = await getActorFromReq(req);
  if (!actor) {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
  const rol = actor.rol;
  const usuario = actor.username;
  const usuarioId = actor.id;
  if (rol !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores pueden reabrir el día' });
  }
  if (!motivo?.trim()) {
    return res.status(400).json({ error: 'El motivo de reapertura es obligatorio' });
  }

  try {
    // Determinar la fecha a reabrir
    let fechaISO: string;
    let fechaStr: string;
    if (fecha) {
      fechaISO = (fecha as string).substring(0, 10);
      fechaStr = isoADDMMYYYY(fechaISO);
    } else {
      fechaISO = todayGT();
      fechaStr = isoADDMMYYYY(fechaISO);
    }

    const confirmacionEsperada = `REABRIR ${fechaStr}`;
    if (confirmacion !== confirmacionEsperada) {
      return res.status(400).json({ error: `Texto incorrecto. Escribe exactamente: ${confirmacionEsperada}` });
    }

    const { rows: cierreRows } = await pool.query(
      `SELECT * FROM cierre_operativo_diario WHERE fecha = $1`,
      [fechaISO]
    );
    if (!cierreRows[0] || cierreRows[0].estado !== 'cerrado') {
      return res.status(400).json({ error: 'El día operativo no está cerrado' });
    }

    const { rows: updated } = await pool.query(`
      UPDATE cierre_operativo_diario
      SET estado='abierto', reabierto_por_id=$1, reabierto_por=$2,
          reabierto_en=NOW(), motivo_reapertura=$3, updated_at=NOW()
      WHERE fecha = $4
      RETURNING *
    `, [usuarioId ?? null, usuario ?? 'sistema', motivo, fechaISO]);

    await pool.query(`
      INSERT INTO cierre_auditoria (cierre_id, accion, user_id, user_nombre, detalle)
      VALUES ($1, 'reabrir', $2, $3, $4)
    `, [updated[0].id, usuarioId ?? null, usuario ?? 'sistema', `Reapertura: ${motivo}`]);

    logger.info({ usuario, fecha: fechaStr, motivo }, "Día operativo reabierto");
    res.json({ ok: true, cierre: updated[0] });
  } catch (err) {
    logger.error({ err }, "POST /operaciones/reabrir error");
    res.status(500).json({ error: "Error al reabrir el día" });
  }
});

// ─── GET /api/operaciones/cierres ────────────────────────────────────────────

router.get("/operaciones/cierres", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        cod.id,
        cod.fecha::text                                                           AS fecha_iso,
        TO_CHAR(cod.fecha, 'DD-MM-YYYY')                                          AS fecha_str,
        cod.estado,
        cod.cerrado_por,
        TO_CHAR(cod.cerrado_en AT TIME ZONE 'America/Guatemala', 'DD/MM/YY HH24:MI') AS cerrado_en_str,
        cod.reabierto_por,
        TO_CHAR(cod.reabierto_en AT TIME ZONE 'America/Guatemala', 'DD/MM/YY HH24:MI') AS reabierto_en_str,
        cod.motivo_reapertura,
        cod.comentario,
        cod.retroactivo,
        (cod.resumen_json->>'totalPuestos')::int  AS total_puestos,
        (cod.resumen_json->>'cubiertos')::int     AS cubiertos,
        (cod.resumen_json->>'descubiertos')::int  AS descubiertos,
        (cod.resumen_json->>'ausencias')::int     AS ausencias
      FROM cierre_operativo_diario cod
      ORDER BY cod.fecha DESC
      LIMIT 90
    `);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "GET /operaciones/cierres error");
    res.status(500).json({ error: "Error al cargar historial de cierres" });
  }
});

// ─── GET /api/operaciones/cierres/:fecha ─────────────────────────────────────

router.get("/operaciones/cierres/:fecha", async (req, res) => {
  try {
    const { fecha } = req.params;

    const { rows: cierreRows } = await pool.query(`
      SELECT
        *,
        TO_CHAR(fecha, 'DD-MM-YYYY')                                                  AS fecha_str,
        TO_CHAR(cerrado_en AT TIME ZONE 'America/Guatemala', 'DD/MM/YYYY HH24:MI')    AS cerrado_en_str,
        TO_CHAR(reabierto_en AT TIME ZONE 'America/Guatemala', 'DD/MM/YYYY HH24:MI')  AS reabierto_en_str
      FROM cierre_operativo_diario
      WHERE fecha = $1
    `, [fecha]);

    if (!cierreRows.length) {
      return res.status(404).json({ error: "No existe cierre para esta fecha" });
    }

    const cierre = cierreRows[0];

    const { rows: auditoria } = await pool.query(`
      SELECT
        id,
        accion,
        user_nombre,
        detalle,
        TO_CHAR(fecha_accion AT TIME ZONE 'America/Guatemala', 'DD/MM/YYYY HH24:MI') AS fecha_str,
        fecha_accion
      FROM cierre_auditoria
      WHERE cierre_id = $1
      ORDER BY fecha_accion ASC
    `, [cierre.id]);

    res.json({ cierre, auditoria });
  } catch (err) {
    logger.error({ err }, "GET /operaciones/cierres/:fecha error");
    res.status(500).json({ error: "Error al cargar detalle del cierre" });
  }
});

// Devuelve el pizarrón completo congelado de un día cerrado:
//   - snapshotPuestos del cierre (agrupados por cliente, tal como quedaron)
//   - movimientosHoy del cierre
//   - cobertura_segmentos de esa fecha (tramos de cobertura granulares)

export default router;
