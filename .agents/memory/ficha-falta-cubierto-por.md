---
name: "Cubierto por" en la ficha del colaborador (historial disciplinario)
description: Cómo la ficha muestra el reverso falta→cobertura usando solo enlaces durables, no el fallback por puesto+fecha.
---

El historial disciplinario de la ficha del colaborador (KPI > SeccionDisciplinaria)
muestra, en cada falta del titular ausente, QUIÉN la cubrió y cuánto/cuántas horas.
Es el reverso del pareo HE↔falta; solo lectura.

**Regla:** resolver coberturas SOLO por los enlaces durables, NO por el fallback
puesto+fecha que sí usa el reporte /rrhh/horas-extra-cash:
- HE de planilla: `eventos_rrhh(tipo='horas_extra').evento_par_id → falta`
  (aporta cubridor, horas y el id del evento HE para enlazar).
- HE en efectivo: `incentivos_cash_cobertura(tipo='he_efectivo',
  estado<>'cancelado').evento_falta_id → falta` (aporta cubridor + monto).
Fusionar por cubridor (employee_id; nombre para agente externo con id NULL):
misma persona con horas (planilla) + monto (efectivo) = una sola fila.

**Why:** usar el fallback por puesto+fecha aquí (a) atribuiría coberturas a faltas
equivocadas cuando el ausente tiene varios slots, y (b) pisaría la tarea de backfill
de pagos antiguos sin evento_falta_id. La ficha confía en el enlace ya materializado.

**How to apply:** la resolución vive en `resolverCoberturasPorFalta` dentro de
`disciplinary-kpi.ts`; enriquece `EventoKPI.coberturas` solo para tipo_evento='falta'.
Frontend: `empleados/kpi.tsx` + tipo `CoberturaFalta` en `empleados/shared.tsx`.
