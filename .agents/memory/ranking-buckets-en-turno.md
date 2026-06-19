---
name: rankCandidatos omite buckets en-turno
description: por qué el selector de tramos no mostraba a todos los agentes y cómo se exponen los buckets del pool en el ranking
---

# rankCandidatos debe cubrir TODOS los buckets del pool

El selector de agentes en modoRanking (SelectorAgenteAgrupado, usado por ModalSegmentos
"Tramos de cobertura" y por PanelPool) se alimenta de `rankCandidatos(pool, zonaId)`.

**Regla:** el backend `/operaciones/pool` devuelve muchos buckets (disponibles,
descansandoCiclo, haciendoHE, trabajando, enPuesto, disponiblesCubriendo,
supervisores, jefes_servicio...). `rankCandidatos` debe iterar TODOS los que sean
asignables, no solo disponibles+descanso+supervisores. Si un bucket no se itera, esos
agentes desaparecen del selector aunque el backend sí los mande.

Mapeo de grupos de prioridad:
- P1–P4: disponibles / descansandoCiclo (haciendoHE también va a descanso, P2–P4).
- P5: supervisores y jefes (contingencia) — ver pool-supervisores-contingencia.md.
- P6 ("En turno hoy"): trabajando / enPuesto / disponiblesCubriendo. Implica doble
  cobertura; el front exige confirmación y mapea P6 → grupo "en_puesto" en onSelect.

**Why:** el director reportó que faltaban agentes en turno y en descanso-con-HE en la
ventana de tramos; la causa era 100% frontend (ranking omitía esos buckets), no el API.

**How to apply:** al tocar `ranking.ts`, añadir loops por cada bucket nuevo y mantener
el dedupe por id (los loops empujan en orden de prioridad; conservar la primera
aparición preserva el mejor grupo). Cualquier consumidor que pinte grupos por array
(PanelPool hardcodea ["P1".."P6"], SelectorAgenteAgrupado igual) debe incluir el grupo
nuevo o no se renderiza. types.ts necesita el grupo en GrupoRanking +
RANKING_GRUPO_CONFIG + un motivo en RANKING_MOTIVO_CONFIG.
