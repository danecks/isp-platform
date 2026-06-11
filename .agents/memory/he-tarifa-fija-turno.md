---
name: HE se paga por tarifa fija por turno, no 1.5x legal
description: El valor de horas extra usa config_tarifa_he (Q150/12h, Q300/24h = Q12.50/h flat); pre-planilla y planilla final deben compartir la misma fuente y resolución de jornada.
---

El negocio NO paga las horas extra con la fórmula legal (sueldoDia/horasDia)×1.5×he.
Paga una tarifa fija por turno guardada en `config_tarifa_he`: 12h→Q150, 24h→Q300
(equivale a Q12.50/h flat). valorHE = tarifa × turnos, turnos = horasExtra / horas_turno.

**Por qué:** el director confirmó que las boletas de HE se pagan por turno completo
(Q300 por turno de 24h, Q150 por turno de 12h), no por el factor 1.5x. Con 1.5x un
turno de 24h salía ~Q600 (depende del sueldo), que no es lo que se paga.

**Fuente única:** `calcularValorHE` en `nomina-calc.ts` (devuelve {valorHE,
tarifaFijaTurnoHE, turnosHE}). La usan la planilla final y la pre-planilla. Si no hay
tarifa configurada cae a la fórmula legal 1.5x como respaldo.

**How to apply:** cualquier flujo que muestre o liquide HE debe pasar por
`calcularValorHE` (o por `calcularBruto` con tarifaFijaTurnoHE/turnosHE), nunca
recomputar 1.5x. La pre-planilla expone `valor_he` por colaborador en el GET
consolidado y el frontend solo lo muestra. Para que pre-planilla y planilla final
coincidan SIEMPRE, ambos resuelven la jornada igual: `row.jornada ??
turno_horas_trabajo+"h" ?? "12h"` (NO usar `tipo_jornada` libre, que puede no
coincidir con las claves '12h'/'24h' y caer al fallback divergente).
