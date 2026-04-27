# Plan de Hardening de Autenticación y Autorización

**Fecha del plan:** 25 de abril de 2026
**Estado:** PROPUESTA — pendiente aprobación del usuario antes de ejecutar cualquier paso.
**Disparador:** prueba en vivo realizada por el usuario que demostró que `GET /api/users` responde 200 sin necesidad de iniciar sesión, exponiendo el listado completo de usuarios de la plataforma.

---

## 1. Diagnóstico: cuatro riesgos confirmados

### Riesgo #4 — Portero "fail-open" para rutas no catalogadas (CRÍTICO, recién descubierto)

**Dónde está:** `artifacts/api-server/src/lib/permisos-middleware.ts`, líneas 234-240.

**Qué hace hoy:**
```ts
if (!session) {
  if (moduloClave) {
    return res.status(401).json({ error: "Sesión requerida..." });
  }
  return next();   // ← ante la duda, deja pasar
}
```

**Consecuencia demostrada:** cualquier ruta que no esté listada en `ROUTE_MODULO_MAP` queda accesible sin sesión. Confirmado en producción:
- `GET /api/users` → 200 con la lista completa de usuarios (id, nombre, username, correo, rol, estado, teléfono, fechas).

**Otras rutas potencialmente expuestas (a auditar como Paso 1):** `/users/*`, `/clientes/:id/usuarios/*`, todo lo registrado en `users.ts`, y cualquier endpoint nuevo que se haya agregado sin actualizar el mapa.

### Riesgo #1 — Sesión admin sin firma criptográfica (CRÍTICO)

**Dónde está:** modelo de sesión actual.

**Qué hace hoy:** el frontend guarda en `sessionStorage` un texto JSON `{"username":"dan2336","rol":"admin"}` y lo envía en el header `x-isp-session`. El servidor lo parsea y le cree.

**Consecuencia:** quien conozca un username admin puede inventar el header desde curl/Postman/DevTools y obtener acceso completo sin contraseña ni login previo. (Aunque el middleware sí consulta el rol actual del usuario en BD para evitar sesiones desactualizadas, no verifica que la sesión sea legítima — sólo verifica permisos.)

### Riesgo #2 — Cierre/reabrir bitácora confía en el rol del cuerpo (ALTO)

**Dónde está:** `artifacts/api-server/src/routes/operaciones.ts`, líneas 3635 (`POST /operaciones/cierre`) y 4055 (`POST /operaciones/reabrir`).

**Qué hace hoy:**
```ts
const { rol, usuario, ... } = req.body;
if (!['admin','supervisor'].includes(rol)) return res.status(403)...;
```
El rol viene del cliente, no de la sesión validada.

**Consecuencia:** un usuario con permisos bajos (recepción, lectura) que ya esté logueado puede modificar la petición desde DevTools y enviar `"rol":"admin"` para cerrar/reabrir días, disparando recálculos de planilla, custodias y novedades.

### Riesgo #3 — PWA del agente acepta sin token de dispositivo (MEDIO)

**Dónde está:**
- `artifacts/api-server/src/routes/agente-fichaje.ts` líneas 1663 (`POST /agente/reporte-turno`) y 1880 (`GET /agente/puesto/:id/equipo-asignado`).

**Qué hace hoy:** `if (device_uuid && device_token) { ...validar... }` — si no llegan, deja pasar igual. `equipo-asignado` no valida absolutamente nada.

**Consecuencia:** desde un teléfono no registrado se puede enumerar el equipo (arma, munición, bodega) asignado a cualquier puesto, e incluso enviar reportes de turno falsos.

**Nota crítica:** verificado que la PWA del agente (`AgenteEscaneo.tsx`, `AgenteInicio.tsx`) **siempre envía** `device_uuid + device_token` en TODAS las peticiones. Hacer obligatorios estos campos NO rompe ningún flujo legítimo de operación.

---

## 2. Orden de ejecución propuesto

Cada paso es independiente y puede aprobarse, ejecutarse y desplegarse por separado. Después de cada paso se valida en desarrollo y se publica antes de pasar al siguiente.

| Orden | Riesgo | Por qué este orden |
|-------|--------|--------------------|
| Paso 1 | #4 fail-open | Es lo que el atacante acaba de explotar. Cierra la puerta principal. Cambio chico y reversible. |
| Paso 2 | #2 cierre/reabrir | Plug-in al Paso 1: una vez cerrado el portero, ya conviene leer el rol de la sesión validada y no del body. |
| Paso 3 | #3 PWA agente | Cierre del último handler permisivo. La PWA ya manda los campos necesarios; sólo es hacerlos obligatorios. |
| Paso 4 | #1 sesión sin firma (JWT) | El más invasivo: requiere cambios coordinados en login, middleware, wrapper del frontend y sesión guardada del usuario. Se hace al final, ya con todo lo demás endurecido. |

---

## 3. Detalle de cada paso

### PASO 1 — Cerrar el portero (fail-closed) y catalogar todas las rutas

**Objetivo:** que el portero rechace por defecto cualquier ruta sin sesión, salvo las explícitamente declaradas como públicas.

**Cambios:**

1. **Auditoría completa** de todas las rutas registradas en `routes/*.ts`. Generar un listado exhaustivo de prefijos.
2. **Actualizar `ROUTE_MODULO_MAP`** en `permisos-middleware.ts` para incluir las rutas faltantes (al menos `/users` y `/clientes/:id/usuarios`).
3. **Cambiar la lógica del middleware a "fail-closed"**: si no hay sesión y la ruta no está explícitamente en `isPublicPath`, devolver 401, aunque no esté catalogada en `ROUTE_MODULO_MAP`.

```ts
// Antes
if (!session) {
  if (moduloClave) return res.status(401)...
  return next();   // ← fail-open
}
// Después
if (!session) {
  return res.status(401).json({ error: "Sesión requerida" });
}
```

4. **Asignar módulo por defecto** a rutas catalogadas pero sin módulo claro (ej: `/users` → módulo `usuarios` o `admin_general`).

**Qué se valida antes de aprobar:**
- Reproducir la prueba del usuario: `curl /api/users` → debe devolver **401**, no 200.
- Reproducir la prueba en TODOS los endpoints sospechosos.
- Verificar que la PWA pública (`/agente`, `/qr-rondas`, `/portal`) sigue funcionando.
- Verificar que los formularios públicos (`POST /leads`, `POST /applications`) siguen aceptando envíos.
- Verificar que el login (`POST /auth/login`) sigue funcionando.
- Verificar que el dashboard, incidencias, operaciones siguen cargando para usuarios con sesión válida.

**Qué puede romper:** algún endpoint público no catalogado en `isPublicPath` que el sistema esté usando sin sesión. La mitigación es la auditoría exhaustiva del paso 1.

**Cómo revertir:** un commit revert + restart workflow + republicación.

**Estimación:** 2-3 horas (incluyendo auditoría y pruebas).

---

### PASO 2 — Cierre/reabrir bitácora lee rol de la sesión validada

**Objetivo:** que los endpoints de cierre y reapertura de día confíen sólo en el rol que el portero ya validó contra BD, no en el rol enviado en el cuerpo.

**Cambios:**

1. En `POST /operaciones/cierre` (línea ~3635) y `POST /operaciones/reabrir` (línea ~4055), reemplazar `const { rol, ... } = req.body` por leer la sesión del header con un helper compartido (ya hay precedente — `getActorFromReq` propuesto en la auditoría del Pizarrón).
2. La lectura se hace en una función helper unificada que:
   - Parsea el header `x-isp-session`.
   - Confirma el rol contra BD vía `getPermisosForUsername(session.username)`.
   - Devuelve `{ username, rol }` confiable.
3. Los endpoints usan ese rol para sus checks de autorización.
4. (Opcional) Si el body sigue mandando `rol`, ignorarlo y loguear una advertencia.

**Qué se valida antes de aprobar:**
- Usuario admin cierra el día → ✅
- Usuario supervisor cierra el día → ✅
- Usuario admin reabre el día → ✅
- Usuario con rol "lectura" intenta cerrar mandando `"rol":"admin"` en el body → debe devolver **403**, no 200.
- Test integral: cerrar día, generar novedades, sincronizar custodias, reabrir.

**Qué puede romper:** nada en flujos normales. Sólo bloquea explotaciones.

**Cómo revertir:** revert del commit.

**Estimación:** 1 hora.

---

### PASO 3 — PWA agente exige device_token

**Objetivo:** que `POST /agente/reporte-turno` y `GET /agente/puesto/:id/equipo-asignado` exijan `device_uuid + device_token` válidos para cualquier petición.

**Cambios:**

1. En `agente-fichaje.ts` línea 1663 (`reporte-turno`): cambiar el bloque `if (device_uuid && device_token)` por validación obligatoria. Sin token → 401.
2. En `agente-fichaje.ts` línea 1880 (`equipo-asignado`): leer `device_uuid + device_token` de query params o headers, validarlos, y verificar que el dispositivo esté asignado al puesto consultado.
3. (Opcional, recomendado) Verificar que el `puestoId` consultado coincide con el `puesto_id` del dispositivo registrado.

**Qué se valida antes de aprobar:**
- Curl sin token a `/agente/reporte-turno` → debe devolver **401**.
- Curl sin token a `/agente/puesto/123/equipo-asignado` → debe devolver **401**.
- Fichaje normal desde teléfono registrado → ✅ funciona.
- Consulta de equipo del puesto desde teléfono registrado → ✅ funciona.
- Test end-to-end: agente escanea carnet → consulta equipo → reporta turno → todo OK.

**Qué puede romper:** sólo dispositivos no registrados. Confirmado por el usuario que todos los teléfonos de puesto pasan por el módulo formal de registro.

**Cómo revertir:** revert del commit.

**Estimación:** 1-2 horas.

---

### PASO 4 — Migrar sesión admin a tokens firmados (JWT)

**Objetivo:** reemplazar el JSON crudo en `x-isp-session` por un token firmado criptográficamente que el servidor pueda verificar.

**Por qué se hace al final:** es invasivo. Toca login, middleware, wrapper del frontend, sesión guardada, y posiblemente requiere que todos los usuarios actuales vuelvan a iniciar sesión una vez.

**Cambios propuestos:**

1. **Generar y guardar un secreto** `JWT_SECRET` en variables de entorno (sólo el servidor lo conoce).
2. **`POST /api/auth/login`**: tras validar credenciales, emitir un JWT firmado con HS256 que incluya `{username, rol, iat, exp}`. Devolverlo al frontend.
3. **Frontend (`AuthContext`, `lib/api.ts`)**: guardar el JWT en `sessionStorage` (en vez del JSON crudo). El wrapper `apiFetch` envía el JWT en el header `Authorization: Bearer <token>`.
4. **Middleware `permisosMiddleware`**: en lugar de parsear JSON crudo, verificar la firma del JWT con `jose` o `jsonwebtoken`. Si la firma es inválida o el token expiró → 401.
5. **Compatibilidad transitoria** (1-2 días): aceptar tanto el header viejo (`x-isp-session`) como el nuevo (`Authorization: Bearer`), con warning en logs cuando llegue el viejo. Después del periodo, eliminar el viejo.
6. **Manejo de expiración**: tokens válidos por X horas (¿8h? ¿la jornada laboral?). Decidir con el usuario.
7. **Logout**: invalidar el token del lado del cliente. (Para invalidación server-side se necesitaría una blacklist; opcional si no se considera crítico.)

**Qué se valida antes de aprobar:**
- Login emite token válido → ✅
- Petición con token válido → ✅
- Petición sin token → 401
- Petición con token modificado → 401
- Petición con token expirado → 401
- Petición con token de otro usuario → autoriza como ese otro usuario (correcto).
- Curl con header viejo `x-isp-session: {...}` durante el periodo de compatibilidad → ✅ (con warning en log).
- Después de eliminar compatibilidad: curl con header viejo → 401.

**Qué puede romper:**
- Sesiones activas en el momento del despliegue (los usuarios deberán reloguearse).
- Cualquier integración interna o script que use el header viejo (debe migrarse o coordinarse).
- Posibles puntos del frontend que aún esperen el formato viejo (audit completo del frontend).

**Cómo revertir:** plan de rollback documentado. Mantener compatibilidad con el header viejo durante el periodo de transición permite revertir con un solo flag.

**Estimación:** 1 día completo (incluyendo pruebas, deploy y monitoreo).

---

## 4. Plan de validación posterior a cada paso

Después de cada paso, antes de pasar al siguiente:

1. **Smoke test manual en DEV** (Replit dev): probar 3-5 flujos críticos del módulo afectado.
2. **Reproducción del ataque original**: confirmar que la prueba del usuario ya NO funciona después del cambio.
3. **Publicación a `ispsa.net`**.
4. **Smoke test en producción**: repetir las mismas pruebas en el dominio publicado.
5. **Monitoreo de logs por 24h**: revisar si aparecen 401 inesperados que indiquen flujos legítimos rotos.

---

## 5. Riesgos del plan en sí

- **Falsos positivos del Paso 1**: si quedó algún endpoint legítimo no catalogado, dejará de funcionar. Mitigación: auditoría exhaustiva ANTES del cambio + ventana de monitoreo intensa post-deploy.
- **Migración del Paso 4**: cambio de modelo de auth siempre tiene riesgo de dejar usuarios afuera. Mitigación: periodo de compatibilidad transitoria + comunicación previa al usuario.

---

## 6. Próxima acción

**Esperar aprobación del usuario** sobre:

1. ¿Aprueba este orden de ejecución (4 → 2 → 3 → 1)?
2. ¿Aprueba ejecutar el Paso 1 ahora?
3. Para el Paso 4 (JWT), ¿qué duración de sesión prefiere? (sugerencia: 12 horas, equivalente a una jornada larga).

**Una vez aprobado, se ejecuta UN paso a la vez, con publicación entre cada uno y monitoreo de 24h.**
