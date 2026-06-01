---
name: Atribución de rondas QR por agente (employee_id)
description: Las rondas QR se atribuyen al agente (employee_id), no a la cuenta web (user_id).
---

Los eventos de ronda QR (`qr_ronda_eventos`) se atribuyen por **`employee_id`** (agente), no por `user_id` (cuenta web).

- **Why:** todos los agentes/supervisores activos en un puesto deben poder marcar rondas desde el kiosco, tengan o no cuenta web. Antes el flujo exigía `user_id` y bloqueaba a los agentes sin cuenta ("Sin usuario web — no puede marcar rondas").
- `user_id` quedó como dato **opcional**: se guarda si el agente tiene cuenta, pero no es requisito.
- **How to apply:** cualquier reporte que muestre el nombre del guardia de una ronda debe resolverlo con `COALESCE(u.nombre, emp.nombre_completo)` (LEFT JOIN users + LEFT JOIN employees), no solo por `user_id`. Sitios afectados: ranking/eventos en `qr-rondas.ts` y `/portal/qr/rondas` en `portal.ts`.
- El endpoint `POST /agente/marcar-ronda-puesto` acepta `agente_employee_id` (preferido) y `agente_user_id` (legacy), valida que el agente esté activo en el `puesto_id` de la sesión, y exige que el punto QR pertenezca al mismo `cliente_id` de la sesión (si no, `punto_fuera_de_puesto`).
- El otro INSERT, `POST /qr-rondas/scan` (escaneo del supervisor logueado), sigue usando solo `user_id`; es correcto.
