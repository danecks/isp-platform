---
name: HE por cobertura — detección de descanso
description: De dónde se lee el horario para decidir si una cobertura genera horas extra, y la regla de negocio que la gobierna.
---

# Generación de horas extra (HE) por cobertura

**Regla de negocio (confirmada por el director):** una cobertura genera HE SOLO si el
agente que cubre estaba en su **día de descanso o de vacaciones**. Si estaba
disponible/trabajando, NO genera HE. No cambiar esta regla.

**De dónde leer el horario:** la fuente real del turno vive en `puesto_slots`
(`empleado_id`, `dias_trabajo`, `longitud_ciclo`, `fecha_inicio_ciclo`). NO usar:
- `puesto_titulares` → está vacía para los agentes reales.
- `puestos_operativos.titular_employee_id` → NULL en todos los puestos (nunca se pobló).

**Why:** ambas detecciones de descanso (en `/asignar` y `/sustituir`) consultaban esas
fuentes vacías, así que SIEMPRE daban "no está de descanso" y nunca generaban HE aunque
el agente sí estuviera de descanso. El bug se veía como "las HE no aparecen en RRHH>Eventos".

**How to apply:** detectar descanso con `puesto_slots WHERE ps.empleado_id = <agente>`
(ORDER BY fecha_inicio_ciclo DESC, LIMIT 1 para determinismo si hubiera varios slots) y
la fórmula de ciclo `cycleDay = ((daysElapsed % lc)+lc)%lc + 1` (módulo positivo, 1-based;
fechas como string + Date.UTC para evitar drift de zona). Descanso = `!dias_trabajo.includes(cycleDay)`.

**Pendiente conocido (no tocado, fuera de alcance):** `/asignar` exige `horas>10` para HE,
`/sustituir` no aplica umbral; difieren solo en relevos cortos (<10h). Confirmar con el
director antes de unificar, porque afecta nómina.
