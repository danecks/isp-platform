/**
 * alert-generator.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Genera alertas automáticas para RRHH analizando los KPIs de todos los
 * colaboradores activos.
 *
 * TIPOS DE ALERTA:
 *
 *  rotacion_alta       – score de rotación < 60  |  salidas ≥ 3  |  clientes ≥ 4
 *  disciplina          – faltas ≥ 3 en 30 días   |  suspensiones > 0
 *  combinada           – rotación alta + indicadores disciplinarios
 *  tendencia_negativa  – tendencia 'sube' en ambas dimensiones + actividad ≥ 2
 *
 * PRIORIDAD:
 *  alta  – riesgo inminente (combinada, disciplina con suspensiones, rotación score < 50)
 *  media – señales moderadas (rotación alta sin combinación, tendencia negativa)
 *  baja  – alertas preventivas
 *
 * DEDUPLICACIÓN:
 *  No se crea una nueva alerta si ya existe una 'nueva' o 'en_revision' del
 *  mismo tipo para el mismo empleado (evita spam).
 */

import { pool } from "@workspace/db";
import { calcularKPIDisciplinario } from "./disciplinary-kpi";
import { calcularKPIRotacion } from "./rotation-kpi";

export interface AlertaGenerada {
  employeeId: number;
  tipo: string;
  nueva: boolean;
}

export interface ResultadoGeneracion {
  procesados: number;
  alertasNuevas: number;
  alertasDuplicadas: number;
  errores: number;
  detalle: AlertaGenerada[];
}

const SUGERENCIAS: Record<string, string> = {
  rotacion_alta:
    "Evaluar asignación estable en un puesto fijo. Revisar el plan de rotaciones y coordinar con operaciones.",
  disciplina:
    "Revisar el historial disciplinario completo y aplicar el protocolo de acción correctiva según reglamento interno.",
  combinada:
    "Colaborador con riesgo múltiple (operativo y disciplinario). Se recomienda intervención inmediata y seguimiento supervisado.",
  tendencia_negativa:
    "Tendencia negativa detectada en los últimos 90 días. Monitoreo preventivo recomendado antes de que el riesgo escale.",
};

function calcularPrioridad(
  tipo: string,
  discScore: number,
  rotScore: number,
  faltas30d: number,
  suspensiones: number,
  salidas: number,
): "alta" | "media" | "baja" {
  if (tipo === "combinada") return "alta";
  if (tipo === "disciplina" && suspensiones > 0) return "alta";
  if (tipo === "disciplina" && faltas30d >= 3) return "alta";
  if (tipo === "rotacion_alta" && rotScore < 50) return "alta";
  if (tipo === "rotacion_alta" && salidas >= 3) return "alta";
  if (tipo === "tendencia_negativa") return "media";
  return "media";
}

export async function generarAlertas(): Promise<ResultadoGeneracion> {
  const resultado: ResultadoGeneracion = {
    procesados: 0,
    alertasNuevas: 0,
    alertasDuplicadas: 0,
    errores: 0,
    detalle: [],
  };

  // Obtener todos los empleados activos
  const { rows: empleados } = await pool.query<{ id: number; nombre_completo: string }>(
    `SELECT id, nombre_completo FROM employees WHERE estado_laboral = 'activo' ORDER BY id`,
  );

  // Cargar alertas abiertas existentes para deduplicar
  const { rows: alertasAbiertas } = await pool.query<{ employee_id: number; tipo: string }>(
    `SELECT employee_id, tipo FROM rrhh_alertas WHERE estado IN ('nueva', 'en_revision')`,
  );
  const alertaSet = new Set(alertasAbiertas.map((a) => `${a.employee_id}:${a.tipo}`));

  for (const emp of empleados) {
    resultado.procesados++;
    try {
      const [disc, rot] = await Promise.all([
        calcularKPIDisciplinario(emp.id),
        calcularKPIRotacion(emp.id),
      ]);

      // Candidatos de alerta para este empleado
      const candidatos: { tipo: string; datos: Record<string, unknown> }[] = [];

      // ── A. Rotación alta ─────────────────────────────────────────────────────
      if (rot.score < 60 || rot.totalSalidas >= 3 || rot.clientesDistintos >= 4) {
        candidatos.push({
          tipo: "rotacion_alta",
          datos: {
            scoreRotacion: rot.score,
            nivelRotacion: rot.nivel,
            totalSalidas: rot.totalSalidas,
            movimientos90d: rot.movimientos90d,
            clientesDistintos: rot.clientesDistintos,
            puestosDistintos: rot.puestosDistintos,
            tendencia: rot.tendencia,
          },
        });
      }

      // ── B. Disciplina ────────────────────────────────────────────────────────
      if (disc.faltas30d >= 3 || disc.totalSuspensiones > 0) {
        candidatos.push({
          tipo: "disciplina",
          datos: {
            scoreDisc: disc.score,
            clasificacion: disc.clasificacion,
            faltas30d: disc.faltas30d,
            totalFaltas: disc.totalFaltas,
            suspensiones: disc.totalSuspensiones,
            nivelRiesgo: disc.nivelRiesgo,
          },
        });
      }

      // ── C. Combinada ─────────────────────────────────────────────────────────
      const tieneRotacion = rot.score < 60 || rot.totalSalidas >= 3 || rot.clientesDistintos >= 4;
      const tieneDisciplina = disc.totalFaltas >= 2 || disc.totalSuspensiones > 0;
      if (tieneRotacion && tieneDisciplina) {
        candidatos.push({
          tipo: "combinada",
          datos: {
            scoreRotacion: rot.score,
            scoreDisc: disc.score,
            salidas: rot.totalSalidas,
            faltas: disc.totalFaltas,
            suspensiones: disc.totalSuspensiones,
            clientes: rot.clientesDistintos,
          },
        });
      }

      // ── D. Tendencia negativa ────────────────────────────────────────────────
      if (
        rot.tendencia === "sube" &&
        rot.movimientos90d >= 2 &&
        (disc.tendencia === "sube" || disc.faltas30d >= 1)
      ) {
        candidatos.push({
          tipo: "tendencia_negativa",
          datos: {
            tendenciaRotacion: rot.tendencia,
            movimientos90d: rot.movimientos90d,
            movimientosPrev90d: rot.movimientosPrev90d,
            tendenciaDisc: disc.tendencia,
            faltas30d: disc.faltas30d,
          },
        });
      }

      // Insertar los candidatos no duplicados
      for (const c of candidatos) {
        const key = `${emp.id}:${c.tipo}`;
        if (alertaSet.has(key)) {
          resultado.alertasDuplicadas++;
          resultado.detalle.push({ employeeId: emp.id, tipo: c.tipo, nueva: false });
          continue;
        }

        const prioridad = calcularPrioridad(
          c.tipo,
          disc.score,
          rot.score,
          disc.faltas30d,
          disc.totalSuspensiones,
          rot.totalSalidas,
        );

        await pool.query(
          `INSERT INTO rrhh_alertas
             (employee_id, employee_nombre, tipo, prioridad, estado, datos_clave, sugerencia)
           VALUES ($1, $2, $3, $4, 'nueva', $5, $6)`,
          [
            emp.id,
            emp.nombre_completo,
            c.tipo,
            prioridad,
            JSON.stringify(c.datos),
            SUGERENCIAS[c.tipo] ?? "",
          ],
        );

        alertaSet.add(key);
        resultado.alertasNuevas++;
        resultado.detalle.push({ employeeId: emp.id, tipo: c.tipo, nueva: true });
      }
    } catch (err) {
      resultado.errores++;
    }
  }

  return resultado;
}
