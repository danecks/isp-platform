---
name: Titular en servicio especial (SSA) en pizarrón de custodia
description: Cómo el tablero marca a un titular de custodia que hoy está en un Servicio Especial para que no aparezca presente ni como falta.
---

# Titular en SSA → slot de custodia descubierto (sin falta)

Si el titular de un slot de custodia está HOY asignado a un Servicio Especial (SSA)
activo y no tiene asignación diaria en su propio slot, el pizarrón debe mostrar el
slot como **descubierto con nota "En servicio especial"** (esperando relevo), NO
como presente ni como falta.

**Por qué:** una persona no puede estar en dos lugares a la vez; estar en SSA es
trabajo legítimo en otro lado, por eso NO descuenta ni genera falta. Es el mismo
principio que "titular cubriendo en otro lado" (ver custodia-titular-cubriendo-otro-lado),
pero la fuente es el SSA, no una cobertura.

**Cómo aplicar:**
- Backend (tablero de operaciones, sección de slots de custodia): se construye un
  mapa de empleados en SSA activo por fecha. La detección debe unir DOS fuentes,
  igual que el pool: la tabla multi-agente (`ssa_agentes` con estado asignado/confirmado)
  y el agente único de la cabecera (`solicitudes_servicio_adicional.agente_id`),
  filtrando `estado_general NOT IN ('cancelada','cerrada')` y la fecha vista
  `BETWEEN fecha AND COALESCE(fecha_fin, fecha)`. Si solo se mira `ssa_agentes` se
  pierden los SSA de un solo agente.
- El flag por slot (titular en SSA) debe EXCLUIR al titular de la rama que lo pinta
  como "cubierto" por sí mismo; si no, sigue apareciendo presente.
- Frontend (slot de custodia): rama de render propia (color distinto al rojo de
  falta) y se OCULTA el botón "Falta" cuando el titular está en SSA, para que el
  operador no lo marque falta por error y simplemente releve con otro agente.
