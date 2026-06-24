---
name: Resolución de HE pendiente debe ser transición exclusiva
description: Por qué aprobar/cash/rechazar de horas extra deben exigir estado pendiente y devolver 409 si ya se resolvió.
---

# HE pendiente: una sola resolución, exclusiva

Las alertas de horas extra pendientes pueden resolverse por TRES canales:
a planilla (aprobar), en efectivo (cash) o rechazo. Cada endpoint de resolución
debe actualizar SOLO si la HE sigue pendiente
(`horas_extra_estado IS NULL OR horas_extra_estado = 'pendiente'`) y devolver 409
si ya fue resuelta por otro canal. El frontend trata el 409 como "ya resuelta",
muestra el mensaje y refresca la lista.

**Por qué:** al existir doble ruta (efectivo vs planilla) desde la misma alerta,
sin la precondición de estado una segunda acción (reintento o sesión concurrente)
pisa la decisión previa → la HE puede terminar pagada por el canal equivocado o
doble. La exclusividad de estado es la barrera contra doble pago aquí.

**Cómo aplicar:** añadir el `WHERE ... AND (estado IS NULL OR estado='pendiente')`
al UPDATE; si `rows.length === 0`, distinguir 404 (no existe) de 409 (ya resuelta)
con un SELECT del estado. Mantener los tres handlers (aprobar/cash/rechazar) con la
misma regla.
