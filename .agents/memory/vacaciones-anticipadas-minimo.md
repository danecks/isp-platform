---
name: Elegibilidad de vacaciones anticipadas (mínimo 3 meses)
description: Regla de negocio para adelantar vacaciones antes de cumplir 1 año y cómo se valida en front y back.
---

Reglas para `tipo === "vacaciones"` (goce inmediato):
- **≥ 1 año** de servicio: goce normal.
- **Entre 3 meses (90 días) y 1 año**: se permite ADELANTAR con `forzar_anticipada: true`
  (RRHH confirma; el excedente sobre lo ganado proporcionalmente se recupera en liquidación).
- **< 3 meses (90 días)**: NO se permite, ni siquiera forzando. El backend responde 400
  "Las vacaciones anticipadas requieren al menos 3 meses de servicio cumplidos".

**Solo aplica a `vacaciones`.** `vacaciones_programadas` (a futuro) y `vacaciones_trabajadas`
(ya laboradas) NO pasan por esta validación, por diseño — son flujos distintos del goce inmediato.

**Fuente única de verdad para evitar drift de zona horaria:** tanto el GET /vacaciones/saldo
como el POST /vacaciones calculan `dias_servicio` y el aniversario con SQL sobre `CURRENT_DATE`
(`(CURRENT_DATE - fecha_ingreso::date)::int`, `(fecha_ingreso + INTERVAL '1 year')::date <= CURRENT_DATE`).
El frontend bloquea con `saldo.dias_servicio >= 90`; el backend es la autoridad con la misma
definición SQL. NO usar math de fechas en JS aquí: causaba desfase de 1 día cerca del umbral.

**Why:** el director pidió permitir anticipar solo con ≥3 meses de antigüedad; antes el flag
`forzar_anticipada` saltaba TODA validación (cualquier antigüedad).
**How to apply:** al tocar la regla, cambiar el umbral 90 en AMBOS lados y mantener la
definición SQL idéntica entre saldo y POST.
