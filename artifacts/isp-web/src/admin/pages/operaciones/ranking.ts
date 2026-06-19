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

  // "En turno hoy" (P6): agentes que ya están trabajando o cubriendo un puesto
  // hoy. Antes quedaban completamente fuera del selector de tramos; ahora se
  // muestran como última prioridad para que el director pueda asignarlos si lo
  // necesita (implica doble cobertura, se confirma en el front).
  const toEnTurno = (agente: Agente): AgenteRankeado => {
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

    const motivos: string[] = ["en_turno"];
    let score = 30;
    if (mismaZona)                  { score += 40; motivos.push("misma_zona"); }
    else if (agente.misma_zona_exp) { score += 10; motivos.push("zona_exp"); }
    if (agente.conoce_puesto)  { score += 20; motivos.push("conoce_puesto"); }
    if (agente.conoce_cliente) { score += 12; motivos.push("conoce_cliente"); }

    return { ...agente, grupo: "P6", motivos, score };
  };

  for (const a of pool.disponibles)        result.push(toRanked(a, "disponible"));
  for (const a of pool.descansandoCiclo)   result.push(toRanked(a, "descansandoCiclo"));
  // Agentes de descanso que ya hacen horas extra hoy: el backend los separa en
  // haciendoHE; igual son personal de descanso de ciclo y deben poder elegirse.
  for (const a of (pool.haciendoHE ?? []))         result.push(toRanked(a, "descansandoCiclo"));
  // Agentes que están trabajando/cubriendo hoy → P6 (en turno).
  for (const a of (pool.trabajando ?? []))           result.push(toEnTurno(a));
  for (const a of (pool.enPuesto ?? []))             result.push(toEnTurno(a));
  for (const a of (pool.disponiblesCubriendo ?? [])) result.push(toEnTurno(a));

  // Contingencia operativa (P5): supervisores y jefes de servicio vienen en
  // listas aparte del pool (el backend los excluye de disponibles/descanso).
  // Se inyectan aquí para que puedan cubrir una falta o un puesto descubierto,
  // sin cambiar la titularidad (el backend lo marca como cobertura_supervisor).
  const aContingencia = (
    src: { id: number; nombre_completo: string; zona_operativa_id: number | null; puesto: string | null },
    tipo: "supervisor" | "jefe_servicio",
  ): AgenteRankeado => {
    const mismaZona = !!zonaId && src.zona_operativa_id === zonaId;
    return {
      ...(src as any),
      tipo_personal: tipo,
      grupo: "P5",
      motivos: ["contingencia", ...(mismaZona ? ["misma_zona"] : [])],
      score: 20 + (mismaZona ? 10 : 0),
    } as AgenteRankeado;
  };

  // Evita duplicar a quien ya esté rankeado (p. ej. inyectado en otra lista del pool).
  const yaIncluidos = new Set(result.map((r) => r.id));
  for (const s of (pool.supervisores ?? [])) {
    if (s.faltando || s.estado_laboral !== "activo" || s.puede_cubrir === false) continue;
    if (yaIncluidos.has(s.id)) continue;
    yaIncluidos.add(s.id);
    result.push(aContingencia(s, "supervisor"));
  }
  for (const j of (pool.jefes_servicio ?? [])) {
    if (j.faltando || j.estado_laboral !== "activo") continue;
    if (yaIncluidos.has(j.id)) continue;
    yaIncluidos.add(j.id);
    result.push(aContingencia(j, "jefe_servicio"));
  }

  // Dedupe defensivo por id: los loops empujan en orden de prioridad (P1→P6),
  // así que conservar la PRIMERA aparición mantiene el mejor grupo del agente.
  // Protege ante solapes futuros entre buckets del backend (p.ej. un agente que
  // figure a la vez en haciendoHE y en trabajando).
  const vistos = new Set<number>();
  const deduplicado = result.filter((a) => {
    if (vistos.has(a.id)) return false;
    vistos.add(a.id);
    return true;
  });

  // Ordenar: primero por grupo (P1→P6) luego por score descendente
  const grupoOrd: Record<GrupoRanking, number> = { P1: 0, P2: 1, P3: 2, P4: 3, P5: 4, P6: 5 };
  return deduplicado.sort((a, b) => {
    const gd = grupoOrd[a.grupo] - grupoOrd[b.grupo];
    return gd !== 0 ? gd : b.score - a.score;
  });
}
