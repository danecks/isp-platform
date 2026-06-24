---
name: Falta no oculta a relevo/cobertura en custodia
description: En el pizarrón, una falta global del empleado solo debe ocultar al asignado si es el TITULAR de ese slot; un relevo/cobertura colocado explícitamente no se oculta.
---

# Falta no debe "fugar" y ocultar a un relevo/cobertura en custodia

El `custodiaFaltaSet` del tablero se arma por `employee_id` global (cualquier
`eventos_rrhh` de falta del día con estado NOT IN ('anulado','cancelado')). Al
renderizar cada slot de custodia, `asignadoFaltando` decide si el asignado del
día se oculta (slot queda descubierto).

**Regla correcta:** `asignadoFaltando` es true SOLO si el asignado es el TITULAR
de ESE slot:
`asignadoEsTitularDeEsteSlot = !!asig && !asig.es_externo && !!titular && Number(asig.employee_id) === titular.employee_id`,
y además está en el faltaSet. Si el asignado es un relevo/cobertura puesto
explícitamente ahí (distinto del titular, o slot SIN titular = hueco), su falta
pertenece a su puesto de ORIGEN y NO debe ocultarlo donde hoy cubre.

**Why:** un custodio titular de la custodia A, cubierto por otro en A, puede ser
asignado (custodia_asignacion_diaria) a cubrir un slot-hueco de la custodia B.
Si tiene una falta registrada en A, el set global la cruzaba en B y lo hacía
desaparecer de B aunque la asignación existía en BD ("no aparece donde se le
asignó"). El caso a PRESERVAR es el opuesto: día armado copiando al titular en
su propio slot y luego el titular falta → ahí sí debe ocultarse (asig==titular).

**How to apply:** cualquier salida que liste custodios del día y cruce faltas
(pizarrón, y también la hoja imprimible / export, que usan un NOT EXISTS por
employee_id) debe limitar el cruce al titular del slot, no al employee_id global.
Solo se tocó el pizarrón (`tablero.ts`); la hoja imprimible sigue con cruce
global y podría ocultar a un relevo con falta de origen → pendiente si se reporta.

**Dato lateral:** marcar "Falta" a un titular que en realidad fue reasignado a
cubrir otro puesto también le genera descuento de planilla (registrar-falta crea
novedad con días de descuento). Lo correcto operativo es cobertura/relevo, no
falta. El fix arregla el display; la falta errónea en datos se anula aparte.
