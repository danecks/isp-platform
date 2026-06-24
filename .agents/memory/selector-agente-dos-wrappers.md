---
name: SelectorAgenteAgrupado tiene dos wrappers de lista
description: El selector de agentes del pizarrón renderiza la lista en DOS ramas distintas (ranking y estándar); cualquier cambio de layout/scroll debe aplicarse a ambas.
---

SelectorAgenteAgrupado (operaciones) tiene `modoRanking = !esFuturo && !!puestoId && !!zonaId`. Renderiza la lista de candidatos en DOS bloques distintos: el de ranking (P1–P6) y el estándar (disponible/descansando/...). Son JSX separados con clases casi idénticas pero distinta indentación.

**Regla:** cualquier cambio de layout/scroll en la lista (max-height, overflow, padding, etc.) debe aplicarse a AMBOS wrappers, no a uno solo.

**Why:** ModalSegmentos puede caer al modo estándar cuando falta zonaId o la fecha es futura. Si solo se cambia el wrapper de ranking, el bug reaparece en el fallback. Pasó con el fix de "scroll tramos no funciona": el scroll anidado se eliminó con el prop `scrollInterno` pero al inicio solo se aplicó a la rama de ranking; un `replace_all` no tocó la otra por indentación distinta.

**How to apply:** al tocar las listas del selector, grepea `space-y-3 pr-0.5` (aparece en ambos wrappers) y verifica que el cambio quedó en los dos. El prop `scrollInterno` (default true) desactiva el scroll interno cuando el modal padre ya tiene su propio scroll (Tramos pasa `scrollInterno={false}`); SlotAgentePlan depende del scroll interno (default).
