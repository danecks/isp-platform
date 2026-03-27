/**
 * rotation-kpi.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Cálculo dinámico del KPI de rotación operativa de un colaborador.
 *
 * FUENTE DE DATOS:
 *   Tabla movimientos_operativos.
 *   - agente_saliente_id : empleado que SALIÓ de un puesto (fue relevado / removido)
 *   - agente_entrante_id : empleado que ENTRÓ a un puesto (fue asignado / sustituyó)
 *   - tipo               : 'asignacion' | 'sustitucion'
 *
 * MÉTRICAS CALCULADAS (ventana: últimos 90 días):
 *   totalMovimientos    – cualquier registro donde el empleado aparezca
 *   totalSalidas        – veces que fue removido de un puesto
 *   totalEntradas       – veces que ingresó a un puesto
 *   sustituciones       – movimientos de tipo='sustitucion' donde participó
 *   puestosDistintos    – cantidad de puestos únicos cubiertos
 *   clientesDistintos   – cantidad de clientes únicos atendidos
 *   movimientos90d      – total en los últimos 90 días
 *   movimientosPrev90d  – total en los 90 días anteriores (91–180 d)
 *   tendencia           – 'sube' | 'baja' | 'estable'
 *   ultimoMovimiento    – fecha/hora del movimiento más reciente
 *
 * SCORE DE ESTABILIDAD (mayor = más estable):
 *   Base: 100
 *   − 15 por cada salida (ser removido de un puesto es un evento de impacto alto)
 *   −  8 por cada sustitución realizada en los 90 días (más allá de 2 aceptables)
 *   − 10 por cada cliente distinto más allá de 2 (diversidad excesiva)
 *   −  5 por cada puesto distinto más allá de 3 (rotación de cobertura)
 *   Mínimo: 0
 *
 * NIVEL DE ROTACIÓN:
 *   bajo  : score >= 80  (empleado estable, pocas rotaciones)
 *   medio : score 60–79  o  movimientos90d >= 3
 *   alto  : score < 60   o  salidas >= 3   o  clientesDistintos >= 4
 *
 * ALERTAS AUTOMÁTICAS:
 *   - 3+ salidas en 90 días → posible inestabilidad
 *   - 4+ clientes distintos → alta dispersión operativa
 *   - tendencia en aumento  → movimientos en incremento vs período anterior
 */

import { pool } from "@workspace/db";

export interface MovimientoRotacion {
  id: number;
  tipo: string;
  rol: "entrante" | "saliente";
  clienteNombre: string | null;
  puestoNombre: string | null;
  contraparte: string | null;
  fechaHora: string;
}

export interface KPIRotacion {
  score: number;
  nivel: "bajo" | "medio" | "alto";
  totalMovimientos: number;
  totalSalidas: number;
  totalEntradas: number;
  sustituciones: number;
  puestosDistintos: number;
  clientesDistintos: number;
  movimientos90d: number;
  movimientosPrev90d: number;
  tendencia: "sube" | "baja" | "estable";
  ultimoMovimiento: string | null;
  alertas: string[];
  historial: MovimientoRotacion[];
}

export async function calcularKPIRotacion(employeeId: number): Promise<KPIRotacion> {
  const { rows } = await pool.query<{
    id: number;
    tipo: string;
    cliente_nombre: string | null;
    puesto_nombre: string | null;
    agente_saliente_id: number | null;
    agente_saliente_nombre: string | null;
    agente_entrante_id: number | null;
    agente_entrante_nombre: string | null;
    fecha_hora: string;
  }>(
    `SELECT id, tipo, cliente_nombre, puesto_nombre,
            agente_saliente_id, agente_saliente_nombre,
            agente_entrante_id, agente_entrante_nombre,
            fecha_hora
     FROM movimientos_operativos
     WHERE agente_saliente_id = $1 OR agente_entrante_id = $1
     ORDER BY fecha_hora DESC`,
    [employeeId],
  );

  const ahora = new Date();
  const hace90  = new Date(ahora.getTime() - 90  * 24 * 60 * 60 * 1000);
  const hace180 = new Date(ahora.getTime() - 180 * 24 * 60 * 60 * 1000);

  const ultimas90   = rows.filter((r) => new Date(r.fecha_hora) >= hace90);
  const anteriores  = rows.filter((r) => {
    const d = new Date(r.fecha_hora);
    return d >= hace180 && d < hace90;
  });

  const esSaliente = (r: (typeof rows)[number]) => r.agente_saliente_id === employeeId;
  const esEntrante = (r: (typeof rows)[number]) => r.agente_entrante_id === employeeId;

  const totalSalidas   = rows.filter(esSaliente).length;
  const totalEntradas  = rows.filter(esEntrante).length;
  const totalMovimientos = rows.length;
  const sustituciones  = rows.filter((r) => r.tipo === "sustitucion").length;

  const puestosSet   = new Set(rows.map((r) => r.puesto_nombre).filter(Boolean));
  const clientesSet  = new Set(rows.map((r) => r.cliente_nombre).filter(Boolean));
  const puestosDistintos   = puestosSet.size;
  const clientesDistintos  = clientesSet.size;

  const movimientos90d     = ultimas90.length;
  const movimientosPrev90d = anteriores.length;

  const ultimoMovimiento = rows.length > 0 ? rows[0].fecha_hora : null;

  let tendencia: KPIRotacion["tendencia"] = "estable";
  if (movimientos90d > movimientosPrev90d) tendencia = "sube";
  else if (movimientos90d < movimientosPrev90d) tendencia = "baja";

  // Score de estabilidad
  const salidasPenalty    = totalSalidas * 15;
  const sustPenalty       = Math.max(0, sustituciones - 2) * 8;
  const clientesPenalty   = Math.max(0, clientesDistintos - 2) * 10;
  const puestosPenalty    = Math.max(0, puestosDistintos - 3) * 5;
  const score = Math.max(0, 100 - salidasPenalty - sustPenalty - clientesPenalty - puestosPenalty);

  let nivel: KPIRotacion["nivel"] = "bajo";
  if (score < 60 || totalSalidas >= 3 || clientesDistintos >= 4) {
    nivel = "alto";
  } else if (score < 80 || movimientos90d >= 3) {
    nivel = "medio";
  }

  const alertas: string[] = [];
  if (totalSalidas >= 3) {
    alertas.push(`${totalSalidas} salidas registradas — posible inestabilidad en asignaciones`);
  }
  if (clientesDistintos >= 4) {
    alertas.push(`Cubrió ${clientesDistintos} clientes distintos — alta dispersión operativa`);
  }
  if (tendencia === "sube" && movimientos90d >= 3) {
    alertas.push("Tendencia en aumento — movimientos operativos se incrementaron vs período anterior");
  }

  const historial: MovimientoRotacion[] = rows.slice(0, 15).map((r) => {
    const rol: "entrante" | "saliente" = r.agente_saliente_id === employeeId ? "saliente" : "entrante";
    const contraparte =
      rol === "saliente"
        ? r.agente_entrante_nombre
        : r.agente_saliente_nombre;
    return {
      id: r.id,
      tipo: r.tipo,
      rol,
      clienteNombre: r.cliente_nombre,
      puestoNombre: r.puesto_nombre,
      contraparte,
      fechaHora: r.fecha_hora,
    };
  });

  return {
    score,
    nivel,
    totalMovimientos,
    totalSalidas,
    totalEntradas,
    sustituciones,
    puestosDistintos,
    clientesDistintos,
    movimientos90d,
    movimientosPrev90d,
    tendencia,
    ultimoMovimiento,
    alertas,
    historial,
  };
}
