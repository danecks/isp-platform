---
name: Cliente principal de custodios en pre-planilla
description: Cómo resolver el cliente de un colaborador que no es titular de un puesto operativo (custodios del pool).
---

El "cliente principal" de la pre-planilla se resuelve por la titularidad de PUESTO
(histórico > puesto_slots > puesto_titulares > legacy titular_employee_id), todo vía
`puestos_operativos`. Los **custodios** del pool no son titulares de ningún puesto, así
que esa cadena devuelve NULL y la columna de cliente sale vacía.

**Regla:** la titularidad de custodia vive en tablas propias, no en puestos:
`custodia_titulares` (cliente_id + slot, asignación permanente) y, por día,
`custodia_asignacion_diaria` (cliente_id + fecha). Ambas referencian `clients`, no
`puestos_operativos`. Para el cliente principal se cae a custodia cuando no hay
cliente por puesto: COALESCE(cliente_por_puesto, cliente_de_custodia), prefiriendo el
titular permanente sobre la asignación del período.

**Why:** custodia es un servicio sin puesto fijo; su cliente no está en
`puestos_operativos`. Sin este fallback los custodios aparecen sin cliente en nómina.
**How to apply:** es solo lectura (no toca IGSS ni pago). NO meter custodia en
`igssTitularChainSQL` — esa cadena hace JOIN a puestos_operativos y custodia no tiene
puesto. El fallback de cliente es un sub-SELECT escalar aparte. Misma lógica aplicaría
a `clienteEmpleadoSQL` (scoping de feriados) si se quiere consistencia para custodios.
