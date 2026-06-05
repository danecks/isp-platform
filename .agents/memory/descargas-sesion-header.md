---
name: Descargas de endpoints protegidos
description: Por qué window.open falla en descargas autenticadas y cómo descargar con sesión
---

La sesión del portal web viaja en el header `x-isp-session` (no en cookie), leído
de sessionStorage. El middleware de permisos es fail-closed: sin sesión devuelve
401 `{"error":"Sesión requerida","modulo":...}`.

**Regla:** para descargar de un endpoint protegido NO uses `window.open(url)` ni un
`<a href>` de navegación: una navegación del browser no puede adjuntar headers
personalizados, así que el backend no ve la sesión y responde 401. Usa el helper
`downloadFile(path, filename)` de `lib/httpClient.ts`, que hace `fetch` con el
header de sesión, recibe el Blob y fuerza la descarga con un `<a download>` temporal
(revoke diferido del object URL).

**Why:** la descarga del CSV de Seguros mostraba "Sesión requerida" justamente por
usar window.open. El mismo patrón afecta a otras pantallas que aún usan window.open
para exportar (planilla export, custodias, transferencias) — si reportan el mismo
error, migrarlas a `downloadFile`.

**How to apply:** cualquier botón de "descargar/exportar" que pegue a `/api/...`
protegido debe ir por `downloadFile`, no por window.open/anchor de navegación.
