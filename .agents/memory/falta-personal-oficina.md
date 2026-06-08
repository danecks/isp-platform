---
name: Falta de personal de oficina (pizarrón)
description: Flujo de falta para supervisores/jefes/administrativos en el pizarrón, separado del flujo de guardias.
---

El pizarrón de operaciones tiene DOS flujos de falta distintos que no deben mezclarse:

- **Guardias/custodios** (tienen puesto operativo): se registran/anulan por el flujo del puesto (`/operaciones/liberar` + `/operaciones/anular-falta`), que además toca `puestos_operativos`, slots y el HE par.
- **Personal de oficina** (supervisores, jefes_servicio, administrativo*, gerencia — sin puesto): par propio de endpoints `/operaciones/falta-personal` y `/operaciones/anular-falta-personal`. Solo crean/anulan el `evento_rrhh` tipo 'falta' + la novedad de nómina pendiente; NO tocan puestos.

**Regla:** ambos endpoints de oficina deben validar que el empleado pertenezca a `TIPOS_PERSONAL_OFICINA` ANTES de mutar, y el anular debe filtrar `generado_desde = 'pizarron'` para no tocar faltas de otra fuente.

**Why:** sin la validación de tipo en el anular, un admin podía cancelar la falta de un guardia por el endpoint equivocado, dejando el estado del puesto y el de RRHH desincronizados. La validación en el registro no basta; el anular es una segunda puerta.

**How to apply:** al tocar cualquier endpoint de falta del pizarrón, replicar la guarda de tipo de personal en TODAS las rutas (registrar y anular), no solo en una.
