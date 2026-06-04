---
name: Liquidación bono 14 / aguinaldo — período único, no acumula años
description: Cómo calcula la liquidación el bono 14 y aguinaldo, y la decisión de negocio sobre pagos previos hechos por fuera del sistema.
---

La liquidación calcula bono 14 y aguinaldo de **un solo período**, el del **año de la fecha de baja (egreso)**, proporcional a los días trabajados acotados por ingreso/egreso. NO acumula años hacia atrás (un colaborador de alta en 2010 liquidado en 2026 NO recibe 15 años de bonos). Lo único acumulativo es la indemnización (años de servicio, por ley).

El descuento de "ya pagado" solo busca planilla especial del **mismo año de la baja** (`pe.anio = año egreso`). Si no hay registro, no descuenta.

**Decisión de negocio (jun-2026):** los bonos pasados se pagaron por fuera (programa anterior) y NO se registran en el sistema; se decidió **no hacer nada** y ajustar caso por caso.

**Why:** registrar 2010–2024 es innecesario porque el cálculo nunca toca esos años. El único riesgo real de pago doble es el período vigente que se solapa con un pago externo: el **bono 14 pagado en julio 2026** (cubre jul-2025→jun-2026). Si se liquida a alguien en la **2ª mitad de 2026**, el sistema recalcularía ese período ya pagado. Aguinaldo solo tendría el problema si la baja es en diciembre.

**How to apply:** al liquidar en la 2ª mitad de 2026, ajustar caso por caso: registrar el bono 14 2026 como planilla especial (el descuento se aplica solo) o sobrescribir el período del bono 14 vía `body.periodo_bono14_inicio/fin` en el endpoint de liquidación.
