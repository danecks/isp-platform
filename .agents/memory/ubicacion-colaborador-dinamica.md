---
name: Ubicación del colaborador es dinámica (titularidad)
description: La sede que se muestra en la ficha del colaborador se deriva de la titularidad vigente, no del campo estático sede.
---

# Ubicación mostrada en la ficha del colaborador

La columna `employees.sede` es **texto estático heredado de la carga maestra**;
NO refleja dónde opera la persona hoy y suele estar desactualizada (confunde:
muestra una ubicación donde la persona ya no está).

**Regla de negocio (decidida por el director):** la ubicación en la ficha se
muestra **dinámica** según dónde la persona es **titular** de un puesto. Si es
titular ⇒ mostrar el **cliente** de ese puesto. Si NO es titular de ningún
puesto ⇒ mostrar **"Sin puesto asignado"** (no la sede vieja).

**Cómo resolver la titularidad:** cubrir los TRES modelos (no solo uno):
`puestos_operativos.titular_employee_id`, `puesto_slots.empleado_id` (24x24),
`puesto_titulares.employee_id`, siempre filtrando por puesto activo. Una
custodia suelta (custodia_asignacion_diaria) NO es titularidad.

**Why:** los datos de `sede` entraron por importación y nunca se sincronizan con
la operación; tratarlos como ubicación actual genera reportes/fichas engañosos.

**How to apply:** al mostrar "dónde está" un colaborador, derivá de titularidad
vigente, nunca del campo `sede`. El resolver vive en el endpoint de lista de
empleados (LATERAL que devuelve el cliente titular). Las tablas son pequeñas
(~579 empleados, ~237 puestos) → el LATERAL por fila es barato.
