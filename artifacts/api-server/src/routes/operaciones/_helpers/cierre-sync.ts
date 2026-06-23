import { pool } from "@workspace/db";
import { calcularEstadoCiclo } from "../../../lib/turno-calc";
import { calcularResponsablePuesto } from "../../armeria/_helpers";

// ─── Helper: calcula responsable de turno en zona (para sync vehículos) ──────
export async function calcularResponsableTurnoLocal(zonaId: number, fecha: string): Promise<any | null> {
  const { rows } = await pool.query(`
    SELECT
      e.id, e.nombre_completo, e.tipo_personal,
      t.id AS tipo_turno_id, t.nombre AS turno_nombre,
      t.tipo_ciclo, t.horas_trabajo, t.horas_descanso,
      eoa.fecha_inicio AS fecha_inicio_ciclo
    FROM employee_operational_assignments eoa
    JOIN employees e ON e.id = eoa.employee_id
    LEFT JOIN turnos t ON t.id = eoa.tipo_turno_id
    WHERE eoa.zona_operativa_id = $1
      AND eoa.activa = TRUE
      AND e.estado_laboral = 'activo'
      AND e.tipo_personal IN ('supervisor','jefe_servicio')
    ORDER BY e.nombre_completo
  `, [zonaId]);
  for (const sv of rows) {
    if (!sv.tipo_ciclo || !sv.horas_trabajo || !sv.fecha_inicio_ciclo) continue;
    const turno = {
      id: sv.tipo_turno_id ?? 0, nombre: sv.turno_nombre ?? "",
      tipo_ciclo: sv.tipo_ciclo,
      horas_trabajo:  Number(sv.horas_trabajo),
      horas_descanso: Number(sv.horas_descanso ?? sv.horas_trabajo),
    };
    const fechaStr = sv.fecha_inicio_ciclo instanceof Date
      ? sv.fecha_inicio_ciclo.toISOString().slice(0, 10)
      : String(sv.fecha_inicio_ciclo).slice(0, 10);
    const estado = calcularEstadoCiclo(turno, fechaStr, fecha);
    if (estado.trabaja) return sv;
  }
  return null;
}

// ─── Helper: ejecuta sync de custodias al cierre y escribe auditoría ─────────
export async function sincronizarCustodiasAlCierre(
  fecha: string,
  cierreId: number,
  snapshotPuestos: any[],
  usuario: string,
  usuarioId: number | null | undefined,
): Promise<{ armas: any[]; vehiculos: any[]; totalCambios: number }> {
  const resultadosArmas: any[] = [];
  const resultadosVehiculos: any[] = [];

  // ── Armas: usa agente real del snapshot ────────────────────────────────────
  const { rows: armas } = await pool.query(`
    SELECT a.id, a.codigo, a.puesto_id, a.custodio_employee_id,
           COALESCE(po.tipo_puesto, 'normal') AS tipo_puesto,
           po.nombre AS puesto_nombre
    FROM armas a
    JOIN puestos_operativos po ON po.id = a.puesto_id
    WHERE a.activo = TRUE AND a.puesto_id IS NOT NULL
  `);

  // índice snapshot: puesto_id → agente_id
  const snapMap = new Map<number, { agente_id: number | null; agente_nombre: string | null }>();
  for (const p of snapshotPuestos) {
    snapMap.set(Number(p.id), { agente_id: p.agente_id ?? null, agente_nombre: p.agente_nombre ?? null });
  }

  for (const arma of armas) {
    const snap = snapMap.get(Number(arma.puesto_id));
    let nuevoId: number | null = snap?.agente_id ?? null;
    if (!nuevoId) {
      // Fallback: el snapshot no registró agente para este puesto (p.ej. está
      // cubierto por su titular sin segmento de cobertura). Resolver desde el
      // modelo de turnos/slots — la misma fuente que usa el pizarrón en vivo —,
      // honrando el custodio asignado en puestos de tipo 'custodia' (rutas).
      if (arma.tipo_puesto === "custodia" && arma.custodio_employee_id) {
        nuevoId = Number(arma.custodio_employee_id);
      } else {
        const resp = await calcularResponsablePuesto(Number(arma.puesto_id), fecha);
        if (resp) nuevoId = resp.id;
      }
    }
    if (!nuevoId) {
      resultadosArmas.push({ codigo: arma.codigo, cambio: false, motivo: "Puesto sin agente al cierre" });
      continue;
    }

    const { rows: custRows } = await pool.query(
      `SELECT id, employee_id, (SELECT nombre_completo FROM employees WHERE id = employee_id) AS nombre
       FROM arma_custodia WHERE arma_id=$1 AND fecha_fin IS NULL`,
      [arma.id]
    );
    const custActual = custRows[0] ?? null;
    if (custActual && Number(custActual.employee_id) === Number(nuevoId)) {
      resultadosArmas.push({ codigo: arma.codigo, cambio: false, motivo: "Sin cambio" });
      continue;
    }

    const { rows: eNuevo } = await pool.query(`SELECT nombre_completo FROM employees WHERE id=$1`, [nuevoId]);
    const nombreNuevo = eNuevo[0]?.nombre_completo ?? null;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (custActual) {
        await client.query(`UPDATE arma_custodia SET fecha_fin=NOW() WHERE id=$1`, [custActual.id]);
      }
      await client.query(`
        INSERT INTO arma_custodia (arma_id, employee_id, puesto_id, tipo_origen, notas, registrado_por)
        VALUES ($1,$2,$3,'cierre_operativo',$4,$5)
      `, [arma.id, nuevoId, arma.puesto_id, `Custodia sincronizada al cierre — ${fecha}`, usuario]);
      await client.query(`
        INSERT INTO custodia_sync_log
          (cierre_id,fecha,tipo_activo,activo_id,activo_codigo,
           custodio_anterior_id,custodio_anterior_nombre,
           custodio_nuevo_id,custodio_nuevo_nombre,
           referencia_nombre,origen,usuario,usuario_id)
        VALUES ($1,$2,'arma',$3,$4,$5,$6,$7,$8,$9,'cierre_operativo',$10,$11)
      `, [
        cierreId, fecha, arma.id, arma.codigo,
        custActual?.employee_id ?? null, custActual?.nombre ?? null,
        nuevoId, nombreNuevo,
        arma.puesto_nombre, usuario, usuarioId ?? null,
      ]);
      await client.query("COMMIT");
      resultadosArmas.push({
        codigo: arma.codigo, cambio: true,
        custodioAnteriorNombre: custActual?.nombre ?? "(Sin custodio)",
        custodioNuevoNombre: nombreNuevo,
      });
    } catch (e: any) {
      await client.query("ROLLBACK").catch(() => {});
      resultadosArmas.push({ codigo: arma.codigo, cambio: false, error: e.message });
    } finally {
      client.release();
    }
  }

  // ── Vehículos: usa motor de turnos para la fecha del cierre ────────────────
  const { rows: vehiculos } = await pool.query(`
    SELECT v.id, v.placa, v.zona_operativa_id,
           oz.nombre AS zona_nombre
    FROM vehiculos v
    JOIN operational_zones oz ON oz.id = v.zona_operativa_id
    WHERE v.activo = TRUE AND v.zona_operativa_id IS NOT NULL
  `);

  for (const v of vehiculos) {
    const responsable = await calcularResponsableTurnoLocal(v.zona_operativa_id, fecha);
    if (!responsable) {
      resultadosVehiculos.push({ placa: v.placa, cambio: false, motivo: "Sin responsable en zona" });
      continue;
    }

    const { rows: custRows } = await pool.query(
      `SELECT id, employee_id, (SELECT nombre_completo FROM employees WHERE id = employee_id) AS nombre
       FROM vehiculo_custodia WHERE vehiculo_id=$1 AND fecha_fin IS NULL`,
      [v.id]
    );
    const custActual = custRows[0] ?? null;
    if (custActual && Number(custActual.employee_id) === Number(responsable.id)) {
      resultadosVehiculos.push({ placa: v.placa, cambio: false, motivo: "Sin cambio" });
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (custActual) {
        await client.query(`UPDATE vehiculo_custodia SET fecha_fin=NOW() WHERE id=$1`, [custActual.id]);
      }
      await client.query(`
        INSERT INTO vehiculo_custodia (vehiculo_id, employee_id, zona_operativa_id, tipo_relevo, notas, registrado_por)
        VALUES ($1,$2,$3,'cierre_operativo',$4,$5)
      `, [v.id, responsable.id, v.zona_operativa_id, `Custodia sincronizada al cierre — ${fecha}`, usuario]);
      await client.query(`
        INSERT INTO custodia_sync_log
          (cierre_id,fecha,tipo_activo,activo_id,activo_codigo,
           custodio_anterior_id,custodio_anterior_nombre,
           custodio_nuevo_id,custodio_nuevo_nombre,
           referencia_nombre,origen,usuario,usuario_id)
        VALUES ($1,$2,'vehiculo',$3,$4,$5,$6,$7,$8,$9,'cierre_operativo',$10,$11)
      `, [
        cierreId, fecha, v.id, v.placa,
        custActual?.employee_id ?? null, custActual?.nombre ?? null,
        responsable.id, responsable.nombre_completo,
        v.zona_nombre, usuario, usuarioId ?? null,
      ]);
      await client.query("COMMIT");
      resultadosVehiculos.push({
        placa: v.placa, cambio: true,
        custodioAnteriorNombre: custActual?.nombre ?? "(Sin custodio)",
        custodioNuevoNombre: responsable.nombre_completo,
      });
    } catch (e: any) {
      await client.query("ROLLBACK").catch(() => {});
      resultadosVehiculos.push({ placa: v.placa, cambio: false, error: e.message });
    } finally {
      client.release();
    }
  }

  return {
    armas: resultadosArmas,
    vehiculos: resultadosVehiculos,
    totalCambios:
      resultadosArmas.filter((r: any) => r.cambio).length +
      resultadosVehiculos.filter((r: any) => r.cambio).length,
  };
}
