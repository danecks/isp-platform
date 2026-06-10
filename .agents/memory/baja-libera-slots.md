---
name: Baja libera puesto_slots
description: Al dar de baja a un empleado hay que liberarlo también de puesto_slots (24x24), no solo de la titularidad legacy.
---

# Baja debe liberar puesto_slots (no solo titularidad legacy)

**Regla:** cuando un empleado pasa a `estado_laboral='baja'`, hay que liberarlo de
TODAS las fuentes de titularidad/cobertura del pizarrón: legacy
(`puestos_operativos.titular_employee_id`), `puesto_titulares` Y `puesto_slots`
(modelo 24x24). El helper `liberarTitularidadAgente` cubre las tres; siempre
precedido de `lockTitularidadAgente` (mismo cliente de la transacción).

**Why:** un flujo de baja limpiaba solo legacy + puesto_titulares y dejaba el
`puesto_slots.empleado_id` ocupado. El tablero (PIZ-BAJA-01) ya vacía el slot
virtualmente, así que el puesto se veía "descubierto fantasma" pero el dato real
seguía apuntando al empleado de baja. Caso real: ALMAGUATE / JEFES DE GRUPO.

**How to apply:**
- Liquidación de baja: en el endpoint de prestaciones, dentro de la misma
  transacción que marca la baja.
- Baja manual desde ficha: en el PATCH de estado, solo en la rama
  `baja` (suspensión/licencia NO liberan: el agente regresa y conserva su puesto).
- Reconciliación de registros previos: paso idempotente en auto-seed
  (`UPDATE puesto_slots SET empleado_id=NULL` para `estado_laboral='baja'`),
  porque prod es read-only y el fix no corre retroactivamente sobre bajas viejas.
