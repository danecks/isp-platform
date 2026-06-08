---
name: HE de cobertura materializadas en vivo
description: Por qué las horas extra de cobertura se detectan desde la novedad (no desde genera_horas_extra) y la clave de dedupe que comparten el flujo en vivo y el cierre.
---

# Horas extra de cobertura: señal de detección y dedupe

La señal confiable de HE común a TODOS los flujos de cobertura es
`novedades_nomina_diarias.horas_extra > 0`, **no** `cobertura_segmentos.genera_horas_extra`.

**Por qué:** la sustitución desde el pizarrón siempre marca
`cobertura_segmentos.genera_horas_extra = FALSE` y maneja la HE por un camino aparte.
Si ese camino no dispara o su escritura del evento falla (es no bloqueante), la HE queda
huérfana (novedad con horas pero sin evento RRHH) y antes solo se volvía tarjeta al cerrar
la quincena. El cierre filtra por `genera_horas_extra`, así que tampoco la recuperaba.
Decisión: materializar el evento de HE en vivo desde `novedad.horas_extra`, apenas se
registra la cobertura, para que sea visible de inmediato junto a la falta.

**Clave de dedupe canónica (debe ser idéntica en el flujo en vivo y en el cierre):**
`employee_id + DATE(fecha) + puesto_nombre + COALESCE(cliente_nombre,'') + tipo_evento='horas_extra' AND estado!='anulado'`.
**Why:** si las dos rutas no usan EXACTAMENTE esta clave (ojo: `cliente_nombre = $4`
NO matchea cuando el cliente es NULL — hay que usar `COALESCE`), el cierre no reconoce el
evento ya materializado y crea un duplicado → riesgo de doble pago.

**Riesgo conocido (aceptado):** ambas rutas hacen SELECT-luego-INSERT sin índice único,
así que en teoría dos escrituras concurrentes para la misma clave podrían duplicar. En la
práctica es una herramienta de un solo despachador (concurrencia ínfima) y el patrón ya
existía en el cierre. Si alguna vez se quiere blindar, va un índice único parcial sobre la
clave canónica (requiere auditar/limpiar duplicados antes), no a ciegas.
