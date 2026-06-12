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

## Jornada y descuento por falta (sigue la jornada)
- **La jornada de custodios es de 12 horas** (regla de negocio confirmada por el
  director) ⇒ su falta descuenta **2 días**.
- Regla general del descuento por falta: 12h ⇒ 2 días, 24h ⇒ 3 días. El descuento sale
  de `novedades_nomina_diarias.dias_descuento`, pero pre-planilla solo lo cuenta cuando
  `falta=TRUE`. El flujo es: se crea incidencia PENDIENTE (`falta=FALSE`,
  `requiere_revision_rrhh=TRUE`, `dias_descuento=N`) y RRHH la resuelve en
  `/rrhh/incidencias/:id/resolver` (pone `falta=TRUE`, deja `dias_descuento` intacto).
  "Automático" = el sistema pre-carga los días correctos; RRHH sigue clasificando.
- **Custodios**: `/operaciones/registrar-falta-custodia` ahora crea, en una transacción,
  el `eventos_rrhh` 'falta' MÁS la novedad pendiente con `dias_descuento=2`,
  `puesto_titular_id=NULL`, `fuente='falta_custodia'`, replicando el patrón del cierre.
  Antes solo insertaba el evento (sin descuento). La anulación va por
  `/rrhh/eventos/:id/anular` (C-03 revierte `falta=FALSE` por fecha+empleado) porque
  `anular-falta.ts` rechaza custodia.
- **Guardias**: el tramo de jornada del cierre lee la jornada REAL del agente que faltó
  desde `puesto_slots.horas_turno` (WHERE puesto_id + empleado_id=falta_employee_id),
  con fallback a `turnos.horas_trabajo` y 24. Antes leía solo el turno del PUESTO
  (`po.tipo_turno_id`), lo que fallaba en puestos 24x24 con titulares de jornada distinta.
