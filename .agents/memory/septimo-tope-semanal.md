---
name: Tope semanal del séptimo en faltas
description: El séptimo embebido en dias_descuento (12h/24h) se pierde solo una vez por semana, y la planilla final debe pagar igual que la pre-planilla.
---

# Tope semanal del séptimo en faltas

**Regla de negocio (confirmada por el director):** una falta de 12h tiene
`dias_descuento=2` (1 día real + 1 séptimo) y una de 24h tiene `dias_descuento=3`
(2 reales + 1 séptimo). El séptimo embebido se pierde **una sola vez por semana
ISO (lun–dom)**. Ej.: 2 faltas 12h misma semana = 3 (no 4); 2 faltas 24h = 5 (no 6);
faltas en semanas distintas conservan un séptimo cada una.

**Cómo se aplica:**
- El tope vive en la **agregación**, no en el dato por día. `dias_descuento` por
  fila queda intacto (auditoría/clawback). En `QUERY_CONSOLIDADO`,
  `total_dias_descuento = SUM(dias_descuento) − septimos_duplicados`, donde
  `septimos_duplicados = SUM(GREATEST(0, cnt-1))` por `date_trunc('week', fecha)`
  contando faltas con `dias_descuento>=2` (no `rechazado_rrhh`).
- **Pantalla = pago:** la planilla final (`calcularLinea` en planilla.ts) debe
  pasar `diasDescuento = total_dias_descuento` del snapshot. Antes usaba el
  conteo `faltas` (1/falta) → pre-planilla y planilla divergían. Producción
  confirmó que el pago real era 1/falta hasta este cambio.
- `calcularBruto` (nomina-calc.ts) honra un `diasDescuento` explícito **aunque sea
  0** (`!= null`, no `> 0`); si no, una falta `rechazado_rrhh` (excluida de
  `total_dias_descuento` pero contada en la columna `faltas`) se descontaría por
  el fallback al conteo. Callers de tests/validación que NO pasan `diasDescuento`
  siguen cayendo al conteo (intacto).
- El frontend (`helpers.ts` calcularTotalEstimado) usa `total_dias_descuento`
  directo (sin caer a `faltas`).
- El clawback de anticipados (`reconciliarAnticipados`) topa por semana aparte,
  con `lunesDeSemana()` (lunes, igual que `date_trunc('week')`).

**Limitaciones conocidas (aceptadas):**
- Semana ISO partida por el corte de quincena: una falta anticipada (`fecha<desde`)
  y una del período en la misma semana topan por separado → puede perderse 2
  séptimos esa semana. Caso límite raro (solo en el borde 1/16), no se consolidó.
- Snapshots de cierres viejos (pre-cambio) quedan sin topar; la planilla paga lo
  congelado (sigue cumpliendo pantalla=pago para ese cierre), no se recalculan.

**Why:** es dinero y el director es no técnico; el riesgo era doble séptimo y que
lo revisado (pre-planilla) no coincidiera con lo pagado (planilla final).

**Relación con el mecanismo 2 (RRHH):** el séptimo "oficial" por
`eventos_rrhh.afecta_septimo_res` → `septimosPerdidos` está **dormido** en prod
(0 en 120 días) y NO se tocó. Si RRHH lo activa, habría que reconciliarlo con el
séptimo embebido para no duplicar.
