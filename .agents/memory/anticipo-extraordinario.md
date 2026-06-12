---
name: Anticipo extraordinario (override de admin)
description: Cómo el director (rol admin) crea un anticipo que se salta el tope dinámico, y por qué la autorización debe resolverse contra BD.
---

# Anticipo extraordinario

El director puede crear un anticipo que se salta el tope dinámico
(ver `anticipo-tope-dinamico.md`) marcando `extraordinario: true` en el POST.
Queda registrado en `anticipos.extraordinario` + `anticipos.autorizado_por`
(username del admin que lo aprobó).

**Autorización contra BD, NO contra el header:** `POST /anticipos` es una ruta
PÚBLICA en `permisos-middleware` (la consume el kiosco `/solicitar-anticipo` sin
sesión), así que NO pasa por el middleware de permisos. Por eso el handler NO
puede confiar en el `rol` que venga en `x-isp-session`. Para el flag
extraordinario se exige `username` y se resuelve el rol REAL con
`getPermisosForUsername(username)` (consulta `users` por estado activo).

**Why:** confiar en `sess.rol === "admin"` del header en una ruta pública es
escalación de privilegios: cualquiera podría mandar `{"rol":"admin"}`. La vía
segura del propio middleware es username → BD; el handler la replica.

**How to apply:**
- Si en el futuro se añaden más overrides admin sobre rutas públicas, repetir el
  patrón: username obligatorio + lookup en BD; nunca aceptar el `rol` del header.
- La UI (Anticipos.tsx) muestra el toggle solo a `esDirector` y solo cuando hay
  restricción de tope; es UX, no seguridad — la barrera real está en el backend.
- Sigue siendo header-trust por username (modelo de toda la app): un atacante que
  conozca el username de un admin podría forjarlo. Endurecerlo de verdad exige
  tokens de sesión firmados a nivel de toda la app (fuera de alcance aquí).
