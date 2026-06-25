---
name: Agregar agente al puesto fuerza el puesto de la sesión
description: Por qué el "Agregar agente" del kiosko móvil debe fichar al puesto de la sesión y no a la titularidad propia del agente escaneado.
---

# "Agregar agente al puesto" (kiosko móvil, puestos fijos)

En el flujo multi-agente de puesto fijo (pantalla verde "En servicio"), el botón
"Agregar agente" escanea el carnet del segundo agente y debe dejarlo en servicio
**en el mismo puesto de la sesión activa**, no donde el agente sea titular.

**Regla:** el check-in de "agregar agente" pasa `sesion_fichaje_id` +
`tracking_token_sesion` al endpoint de iniciar turno; el backend valida la sesión
(fichaje de puesto abierto + hash del tracking token) y **fuerza** el servicio al
puesto de esa sesión (carga sus datos + GPS), saltando las barreras de
`puesto_no_coincide` y `sin_servicio`. Sigue bloqueando supervisores/jefes
(es_supervisor) y conserva el control de duplicado del día (`ya_iniciado`).

**Why:** la lista de "agentes en servicio" filtra ESTRICTAMENTE por el puesto de
la sesión. Si el segundo agente se resuelve por su propia titularidad (relevo /
cobertura / titular de otro puesto), queda fichado en otro puesto (o rechazado) y
"no aparece" en este — síntoma exacto reportado: "lee el carnet pero no lo agrega".

**How to apply:**
- El front debe enviar la sesión desde el turno activo (fichaje_id + tracking_token).
- Si llegan esos campos pero NO validan, responder 403 explícito (`sesion_invalida`),
  nunca caer al flujo normal en silencio (reintroduce el mismo síntoma).
- Sin esos campos, el endpoint conserva la resolución por titularidad/custodia
  (check-in normal del agente con su propio carnet).
