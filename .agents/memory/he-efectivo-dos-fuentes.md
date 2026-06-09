---
name: HE en efectivo dos fuentes
description: El reporte de HE pagadas en efectivo debe unir dos tablas distintas; en pre-planilla normal se ocultan.
---

Las HE pagadas en EFECTIVO viven en DOS tablas distintas y un reporte completo debe unir ambas:
- `novedades_nomina_diarias` con `horas_extra_estado='pagado_efectivo'` → tiene HORAS, no monto (origen "anexo").
- `incentivos_cash_cobertura` con `tipo='he_efectivo'` (excluir `estado='cancelado'`) → tiene MONTO en Q, no horas (origen "pizarrón").

El reporte separado `GET /rrhh/horas-extra-cash` hace UNION ALL de ambas; cada fila lleva `origen`, `horas_extra` nullable y `monto` nullable.

**Why:** el reporte viejo solo leía la fuente "anexo" y salía vacío porque los pagos reales venían del pizarrón (incentivos_cash). El director quería verlos todos juntos en una pre-planilla en efectivo aparte.

**How to apply:** las HE en efectivo NO se muestran en el detalle de la pre-planilla normal (DetalleModal filtra `tipo !== 'he_efectivo'` en el bloque de incentivos cash). Esto es solo display: la protección anti doble pago vive en los totales SQL de pre-planilla.ts (excluye `pagado_efectivo` y no suma incentivos_cash al bruto), así que ocultar el bloque no reintroduce riesgo.
