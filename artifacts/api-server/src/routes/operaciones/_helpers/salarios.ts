import { pool } from "@workspace/db";
import { logger } from "../../../lib/logger";

// ─── Helper: detectar y registrar impacto salarial ───────────────────────────
// Llámalo DESPUÉS de actualizar puestos_operativos.
// No lanza excepciones — falla silenciosamente para no bloquear la operación.
export async function registrarImpactoSalarial(opts: {
  agenteId:       number;
  agenteNombre:   string;
  puestoId:       number;
  puestoNombre:   string;
  clienteNombre:  string;
  salarioPuesto:  number | null;
  salarioActual:  number | null;
  movimientoId?:  number | null;
  usuario?:       string;
  tipoMovimiento: string;
  snapshotPuesto?: Record<string, unknown>;
}): Promise<{ tieneImpacto: boolean; impactoId?: number }> {
  try {
    const { salarioPuesto, salarioActual } = opts;
    // Solo aplica si ambos salarios están definidos y son distintos
    if (!salarioPuesto || !salarioActual) return { tieneImpacto: false };
    const diferencia = salarioPuesto - salarioActual;
    if (Math.abs(diferencia) < 0.01) return { tieneImpacto: false };

    const tipoImpacto = diferencia > 0 ? "aumento" : "disminucion";
    const { rows } = await pool.query(
      `INSERT INTO cambios_salariales
         (employee_id, empleado_nombre, puesto_id, puesto_nombre, cliente_nombre,
          salario_actual, salario_puesto, diferencia, tipo_impacto,
          movimiento_id, operacion_usuario, tipo_movimiento, snapshot_puesto)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [
        opts.agenteId, opts.agenteNombre, opts.puestoId, opts.puestoNombre, opts.clienteNombre,
        salarioActual, salarioPuesto, Math.abs(diferencia), tipoImpacto,
        opts.movimientoId ?? null, opts.usuario ?? null, opts.tipoMovimiento,
        opts.snapshotPuesto ? JSON.stringify(opts.snapshotPuesto) : null
      ]
    );
    logger.info({ impactoId: rows[0].id, tipoImpacto, diferencia }, "Impacto salarial registrado");
    return { tieneImpacto: true, impactoId: rows[0].id };
  } catch (err) {
    logger.warn({ err }, "registrarImpactoSalarial: error no bloqueante");
    return { tieneImpacto: false };
  }
}
