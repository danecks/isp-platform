import type { Agente, ClienteBoard, PlanFuturo, Pool, Puesto } from "../types";
import { rankCandidatos } from "../ranking";
import type { PoolTab } from "../sections/PanelPool";

interface Args {
  pool: Pool | undefined;
  busquedaPool: string;
  poolTab: PoolTab;
  puestoContexto: Puesto | null;
  tablero: ClienteBoard[];
  filtroCliente: string;
  filtroZona: string;
  busquedaPersona: string;
  planFuturoPorPuesto: Record<number, PlanFuturo>;
}

export function useTableroDerivado({
  pool,
  busquedaPool,
  poolTab,
  puestoContexto,
  tablero,
  filtroCliente,
  filtroZona,
  busquedaPersona,
  planFuturoPorPuesto,
}: Args) {
  const poolActual: Agente[] = (() => {
    if (!pool) return [];
    if (busquedaPool.trim()) {
      const q = busquedaPool.toLowerCase();
      const secciones: Array<[string, Agente[]]> = [
        ["Disponible",              pool.disponibles            ?? []],
        ["Disp. cubriendo",         pool.disponiblesCubriendo   ?? []],
        ["Descanso ciclo",          pool.descansandoCiclo       ?? []],
        ["Desc/Vac cubriendo",      [...(pool.haciendoHE ?? []), ...(pool.vacacionistasCubriendo ?? [])]],
        ["Trabaja hoy",             pool.trabajando             ?? []],
        ["Faltando",                pool.faltando               ?? []],
        ["Licencia",                pool.enDescanso             ?? []],
        ["En puesto",               pool.enPuesto               ?? []],
        ["En SSA",                  pool.enSSA                  ?? []],
        ["Suspendido",              pool.suspendidos            ?? []],
        ["Vacaciones",              pool.enVacaciones           ?? []],
      ];
      return secciones.flatMap(([label, lista]) =>
        lista
          .filter((a) =>
            a.nombre_completo.toLowerCase().includes(q) ||
            a.puesto?.toLowerCase().includes(q) ||
            a.area?.toLowerCase().includes(q)
          )
          .map((a) => ({ ...a, _seccionLabel: label }))
      );
    }
    if (poolTab === "haciendoHE") {
      return [...(pool.haciendoHE ?? []), ...(pool.vacacionistasCubriendo ?? [])];
    }
    return (pool[poolTab] as Agente[] | undefined) ?? [];
  })();

  const candidatosRankeados = puestoContexto && pool
    ? rankCandidatos(pool, puestoContexto.zona_operativa_id)
    : [];

  const zonasDisponibles = (() => {
    const mapa: Record<string, string> = {};
    tablero.flatMap((c) => c.puestos).forEach((p) => {
      if (p.zona_operativa_id && p.zona_nombre) {
        mapa[String(p.zona_operativa_id)] = p.zona_nombre;
      }
    });
    return Object.entries(mapa).map(([id, nombre]) => ({ id, nombre }));
  })();

  const clientesDisponiblesFiltro = tablero.map((c) => ({ id: String(c.clienteId), nombre: c.clienteNombre }));

  const tableroFiltrado: ClienteBoard[] = (() => {
    let result = tablero;
    if (filtroCliente) {
      result = result.filter((c) => String(c.clienteId) === filtroCliente);
    }
    if (filtroZona) {
      result = result
        .map((c) => ({ ...c, puestos: c.puestos.filter((p) => String(p.zona_operativa_id) === filtroZona) }))
        .filter((c) => c.puestos.length > 0);
    }
    if (busquedaPersona.trim()) {
      const q = busquedaPersona.toLowerCase().trim();
      result = result
        .map((c) => ({
          ...c,
          puestos: c.puestos.filter((p) => {
            const campos: (string | null | undefined)[] = [
              p.agente_nombre,
              p.titular_nombre,
              planFuturoPorPuesto[p.id]?.relevo_nombre,
              planFuturoPorPuesto[p.id]?.titular_ausente_nombre,
            ];
            return campos.some((v) => v && v.toLowerCase().includes(q));
          }),
        }))
        .filter((c) => c.puestos.length > 0);
    }
    return result;
  })();

  const totalPuestos = tableroFiltrado.flatMap((c) => c.puestos).length;
  const puestosCubiertos = tableroFiltrado.flatMap((c) => c.puestos).filter((p) => p.estado === "cubierto").length;
  const puestosDescubiertos = totalPuestos - puestosCubiertos;
  const coberturaGlobal = totalPuestos > 0 ? Math.round((puestosCubiertos / totalPuestos) * 100) : 0;

  return {
    poolActual,
    candidatosRankeados,
    zonasDisponibles,
    clientesDisponiblesFiltro,
    tableroFiltrado,
    totalPuestos,
    puestosCubiertos,
    puestosDescubiertos,
    coberturaGlobal,
  };
}
