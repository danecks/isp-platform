---
name: Limpieza total de colaboradores (preview)
description: Cómo borrar TODOS los employees y su data asociada en preview conservando estructura; clasificación durable tabla=operativa(borrar) vs estructural(desligar).
---

# Wipe de colaboradores en preview (dejar planilla en cero para pruebas)

Operación de DATOS (no código) contra `environment: "development"`, en UNA transacción
`BEGIN…COMMIT`. SIEMPRE re-verificar el grafo de FK en vivo antes (information_schema):
las columnas/tablas cambian (aparecieron `bodega_unidades`, `incidents.responsable_id`,
`nfc_supervisor_forms`, `cobertura_diaria.cobertura_employee_id` que no estaban en notas viejas).

**Clasificación durable (el juicio no derivable del schema):**
- **DESLIGAR (conservar fila, poner ref en NULL):** lo *estructural* — users, puestos_operativos
  (agente/titular/falta + sus nombres denormalizados), armas, operational_zones, config_empresa,
  supervisor_devices, nfc_tags, arma_ordenes_servicio, e inventario tipo `bodega_unidades`.
  Las cols con FK SET NULL se anulan solas al borrar employees; users.employee_id y
  puestos_operativos.falta_* NO tienen FK → anular a mano.
- **BORRAR TODO (operativo/nómina/supervisión):** planillas(+lineas/especiales/pagos),
  pre_planilla_*, prestaciones_liquidaciones(detalle/ediciones CASCADE), entregas_uniforme
  (cuotas CASCADE), puesto_titulares, supervision_*, ssa_agentes/historial, eventos_rrhh,
  novedades_nomina_diarias, cobertura_*, puesto_slots, reporte_turno(+relevo), qr_ronda_eventos,
  movimientos_operativos, planificacion_futura, solicitudes_servicio_adicional, visitas,
  vehiculo_custodia, arma_custodia, armas_alertas, bodega_movimientos/solicitudes, nfc_*_events,
  anticipos, agent_assignments, incentivos_cash_cobertura, phone_auth_log, task_evidencias,
  wa_*_sessions, amonestacion_solicitudes_creacion.
  **Distinción clave:** `*_custodia`/`*_movimientos`/`*_solicitudes`/`*_asignacion` = enlaces
  operativos → borrar; el activo en sí (armas, bodega_unidades, vehículos) = inventario → conservar.
- **RECLUTAMIENTO (preservar pipeline):** applications, solicitudes_empleo, solicitudes_merge_requests
  → `DELETE WHERE employee_id IS NOT NULL` (no vaciar; las filas sin empleado son candidatos).

**Orden:** dentro del set, único bloqueante real fue `planillas` (cierre_id) antes de
`pre_planilla_cierres` (RESTRICT). Lo demás: CASCADE/SET NULL se resuelven al borrar employees.

**Why:** un agente de tarea aislado corre sobre OTRA base; este wipe debe ejecutarlo el agente
principal en Build sobre la base de preview real, o no se refleja. Dev soporta rollback por checkpoint.
