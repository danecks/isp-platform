import type { Agente, AgenteRankeado, GrupoRanking, Pool } from "./types";

export function rankCandidatos(pool: Pool, zonaId: number | null | undefined): AgenteRankeado[] {
  const result: AgenteRankeado[] = [];

  const toRanked = (agente: Agente, estado: "disponible" | "descansandoCiclo"): AgenteRankeado => {
    const mismaZona = !!zonaId && agente.zona_operativa_id === zonaId;

    // Supervisores y jefes de servicio → siempre P5 (contingencia operativa)
    const esContingencia = agente.tipo_personal === "supervisor" || agente.tipo_personal === "jefe_servicio";
    if (esContingencia) {
      return {
        ...agente,
        grupo: "P5",
        motivos: ["contingencia", ...(mismaZona ? ["misma_zona"] : [])],
        score: 20 + (mismaZona ? 10 : 0),
      };
    }

    const motivos: string[] = [];
    let score = estado === "disponible" ? 100 : 50;

    // Estado base
    motivos.push(estado === "disponible" ? "disponible" : "descanso_ciclo");

    // Zona
    if (mismaZona)                  { score += 40; motivos.push("misma_zona"); }
    else if (agente.misma_zona_exp) { score += 10; motivos.push("zona_exp"); }

    // Experiencia previa (más valiosa → más puntos)
    if (agente.conoce_puesto)  { score += 20; motivos.push("conoce_puesto"); }
    if (agente.conoce_cliente) { score += 12; motivos.push("conoce_cliente"); }

    let grupo: GrupoRanking;
    if      (estado === "disponible"       && mismaZona) grupo = "P1";
    else if (estado === "descansandoCiclo" && mismaZona) grupo = "P2";
    else if (estado === "disponible")                    grupo = "P3";
    else                                                 grupo = "P4";

    return { ...agente, grupo, motivos, score };
  };

  for (const a of pool.disponibles)      result.push(toRanked(a, "disponible"));
  for (const a of pool.descansandoCiclo) result.push(toRanked(a, "descansandoCiclo"));

  // Ordenar: primero por grupo (P1→P5) luego por score descendente
  const grupoOrd: Record<GrupoRanking, number> = { P1: 0, P2: 1, P3: 2, P4: 3, P5: 4 };
  return result.sort((a, b) => {
    const gd = grupoOrd[a.grupo] - grupoOrd[b.grupo];
    return gd !== 0 ? gd : b.score - a.score;
  });
}
