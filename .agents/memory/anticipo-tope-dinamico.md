---
name: Tope dinámico de anticipos
description: Cómo se calcula el límite de anticipo por colaborador (liquidación acumulada × 30% × KPI) y contra qué saldo se mide.
---

# Tope dinámico de anticipos

El tope de anticipo de un colaborador NO es un monto fijo por quincena: es una
propiedad de la persona que se recalcula cada vez.

**Regla:** `tope = liquidación acumulada a la fecha × 30% × (KPI disciplinario ÷ 100)`.
Si el KPI cae en riesgo (< 70 pts) el tope = 0 (corte incondicional, aplica incluso
si la liquidación no es computable).

**Base de garantía = liquidación "renuncia":** aguinaldo + bono14 + vacaciones
proporcionales a hoy. SIN indemnización (esa solo existe en despido injustificado).
Es lo recuperable "si se va por su cuenta". Se reusa el mismo cálculo y el SQL de
días de vacaciones del ciclo vigente que prestaciones.

**Se mide contra el SALDO TOTAL adeudado**, no por quincena: suma todos los
anticipos vivos. Si `cuotasPagadas > 0` cuenta solo el principal que falta (en
cualquier estado vivo, no solo 'pagada' — evita sobre-restringir por data legacy);
si no, cuenta el monto completo. Rechazada y pagada-completa no cuentan.

**Why:** el director quiere premiar comportamiento (KPI) y prestar solo lo que se
puede recuperar de la liquidación si la persona se va; el 30% es el techo acordado.

**How to apply:**
- Si falta fecha_ingreso o sueldo, `computable=false` → fallback al límite manual
  de la ficha (`employees.limite_anticipo`); el corte por riesgo sigue aplicando.
- El display del tope se calcula SIEMPRE (no gateado por día hábil), porque es
  propiedad de la persona, no de la quincena.
- Distinto del recargo/interés del cobro (ver `anticipo-cobro-modelo.md`): ese es
  cuánto se cobra de más; esto es cuánto se puede prestar.
