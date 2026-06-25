---
name: Conteo de cobertura en el resumen del cierre
description: De dónde debe salir cubiertos/descubiertos del cierre operativo y por qué el cierre del día activo corre como retroactivo.
---

# Resumen del cierre: contar cobertura desde el modelo de turnos

## Regla
El resumen del cierre operativo (`operaciones/cierre.ts`) cuenta
cubiertos/descubiertos/titular/relevo desde el modelo de turnos (`puesto_slots`
con `empleado_id`, fallback `agente_id` legacy), NO desde la columna
`puestos_operativos.estado`. El relevo del día sale de `cobertura_segmentos`
(`tipo_cobertura='relevo'`) para esa fecha. Hay un helper único
`contarCoberturaPuestos(fechaISO)` usado tanto en el GET en vivo como en el POST.

**Why:** `puestos_operativos.estado/agente_id` quedó obsoleto con el modelo 24x24
(misma raíz que `operativo-slots.md`). Reportaba ~180/190 descubiertos cuando la
realidad era ~185 cubiertos / ~5 descubiertos. Las custodias salían bien porque
usan su propia tabla.

## Trampa: el cierre del día activo corre como RETROACTIVO
`esRetroactivo = fechaACerrar < hoy`. La fecha activa del pizarrón va un día
detrás del calendario, así que al cerrar el día activo (ej. cerrar 06-22 el
06-23) `esRetroactivo=true`. Por eso el conteo retroactivo NO puede basarse solo
en `cobertura_segmentos` (un día normal tiene poquísimos segmentos → daba
`totalPuestos` minúsculo y `descubiertos=0`). Se usa el helper del modelo en
ambos caminos.

**Limitación conocida:** el helper cuenta la dotación ESTRUCTURAL actual (slots de
hoy); para cierres retroactivos de días lejanos puede no reflejar la dotación
exacta de esa fecha. El relevo sí es histórico (parametrizado por fecha). Es una
aproximación aceptable y muy superior al `descubiertos=0` previo.

## Cuidado: NO tocar `snapshotPuestos`
`snapshotPuestos` (reconstruido desde segmentos en retroactivo, o desde
`puestos_operativos` en normal) alimenta `sincronizarCustodiasAlCierre` y la
generación de novedades. Los conteos del resumen se calculan APARTE; no derivar
los conteos de `snapshotPuestos`.

## Advertencia eliminada
Se quitó la advertencia "puestos cubiertos sin tramos de cobertura registrados":
se basaba en `po.estado='cubierto'` legacy y daba falsas alarmas. En el modelo de
turnos un titular normal no requiere tramos y los relevos YA son los segmentos.

## El modal de cierre debe pedir el resumen POR FECHA
El resumen vive en un helper único `computarResumenDia(fechaISO)` y hay un endpoint
`GET /operaciones/cierre-resumen?fecha=YYYY-MM-DD` (mismo módulo/sesión que el resto
de operaciones, misma validación ISO que `preview-custodias`). `ModalCierre.tsx`
DEBE hacer fetch a ese endpoint y pintar `resumenDia`, NO el prop `resumen`.

**Why:** `OperacionesModales.tsx` arma los `<ModalCierre>` retroactivos con `resumen`
hardcodeado en ceros (no tenía de dónde sacar números por fecha). Resultado: el
modal "Cerrar día operativo" de un día pasado mostraba TODO EN CEROS aunque el
pizarrón mostrara 294 cubiertos / 21 descubiertos. El prop solo sirve como valor
inicial del día activo; el valor real siempre llega del endpoint por fecha.
