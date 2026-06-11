---
name: IGSS cobertura por cliente centro
description: Quién cubre IGSS en planilla = puesto OR cliente como Centro de Trabajo IGSS; pre-planilla y planilla deben clasificar igual.
---

# "Puesto cubre IGSS" = puesto OR cliente centro

Elegibilidad IGSS de un colaborador exige tres cosas: empleado con
`aplica_igss_general` y `estado_igss='activo'`, y que **su puesto cubra IGSS**.

"Puesto cubre IGSS" ya no es solo el flag del puesto: es flag del puesto **OR**
que su cliente esté marcado como Centro de Trabajo IGSS (`clients.igss_aplica`,
toggle de la ficha del cliente que antes solo alimentaba el TXT mensual).

**Why:** el flag a nivel puesto nunca tuvo pantalla para activarse (default
FALSE → IGSS no aplicaba a nadie). El director aprobó usar el toggle del cliente
como interruptor único; el enlace puesto→cliente se asume poblado (verificar si
aparecen puestos sin cliente, que quedarían sin cobertura por esta vía).

**How to apply:**
- La regla vive centralizada en `lib/igss-clasificacion.ts`; cada consulta inyecta
  su expresión "puesto cubre" y debe traer el flag del cliente con un JOIN a
  `clients` dentro de su LATERAL del puesto titular.
- **Paridad obligatoria pre-planilla ↔ planilla:** ambas deben resolver el puesto
  titular con la MISMA cadena de prioridad (histórico vigente > puesto_slots >
  puesto_titulares > legacy titular). El modelo vigente es puesto_slots (24x24);
  resolver solo por `titular_employee_id` deja fuera a los agentes por slot y la
  planilla final dejaría de deducir IGSS aunque la pre-planilla sí lo muestre.
  La cadena está centralizada en un helper compartido por ambas rutas.
