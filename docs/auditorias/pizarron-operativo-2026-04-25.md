# Auditoría técnica — Pizarrón Operativo

**Fecha:** 25 de abril de 2026
**Alcance:** `artifacts/isp-web/src/admin/pages/Operaciones.tsx` (10,081 líneas) y `artifacts/api-server/src/routes/operaciones.ts` (4,821 líneas).
**Tipo:** Solo lectura — preparatoria del refactor agendado para el **6 de mayo de 2026** (ver `replit.md` líneas 4-5).
**Realizada por:** Architect (Claude) + investigación local en el repo.

---

## 1. Resumen ejecutivo

| Severidad | Hallazgo | Acción recomendada |
|-----------|----------|--------------------|
| 🔴 ALTA (seguridad) | `POST /operaciones/cierre` y `POST /operaciones/reabrir` confían en el `rol` enviado por el cliente en `req.body`. | **Hotfix antes del refactor.** Leer rol desde la sesión validada en servidor. |
| 🔴 ALTA (mantenibilidad) | `Operaciones()` es un god-component de ~2,700 líneas con 26 useState, 12 useQuery, 33 funciones internas y 118 setters. | Extraer en pasos según plan de mayo. |
| 🟠 MEDIA-ALTA (consistencia) | Helper `invalidate()` no cubre 5 de las 13 queries que se ven en pantalla → datos viejos tras mutaciones. | Centralizar invalidación + matriz query↔mutación. |
| 🟠 MEDIA-ALTA (acoplamiento) | El front consume ~45 endpoints de 8+ routers. | Extraer hooks de datos primero. |
| 🟡 MEDIA (performance) | 1 `useCallback` y 6 `useMemo` en 10k líneas, con polling agresivo (15-300 s) y drag & drop. | Memoizar derivados pesados al extraer secciones. |
| 🟡 MEDIA (backend) | `operaciones.ts` mezcla 36 endpoints de 5 dominios distintos; side-effects fuera de transacción. | Dividir el router por subdominio en una segunda fase. |

**Veredicto:** funcionalmente operativo, **no es seguro empezar el refactor sin antes** parchear la autorización de cierre/reabrir.

---

## 2. Hallazgo crítico de seguridad

### 2.1 Bug confirmado

**Archivo:** `artifacts/api-server/src/routes/operaciones.ts`

| Endpoint | Línea | Lectura insegura |
|----------|-------|------------------|
| `POST /operaciones/cierre` | 3635-3639 | `const { ..., rol, ... } = req.body;` → `if (!['admin', 'supervisor'].includes(rol)) return 403;` |
| `POST /operaciones/reabrir` | 4055-4059 | `const { ..., rol, ... } = req.body;` → `if (rol !== 'admin') return 403;` |

**Impacto:** un usuario con permiso de módulo `pizarron` (cualquier rol que tenga el permiso) puede enviar `rol: "admin"` en el cuerpo y cerrar/reabrir el día operativo, incluso días retroactivos sin el límite de 7 días que aplica a supervisores. El campo `usuario` que se persiste en `cierre_operativo_diario` también vendría falsificado.

**Por qué pasa:** el `permisosMiddleware` de `lib/permisos-middleware.ts` solo valida que el usuario tenga acceso al **módulo** `pizarron`. La diferenciación admin/supervisor dentro del módulo se delegó al endpoint, y se implementó leyendo del body (atajo histórico).

### 2.2 Patrón de fix recomendado

El middleware ya parsea la sesión desde `req.headers["x-isp-session"]` y existe `getPermisosForUsername(username)` en `lib/permisos-middleware.ts` que devuelve `{ rol, modulos }` consultando la tabla `users` (con caché de 30 s).

Pasos sugeridos:

1. **Exportar un helper** en `lib/permisos-middleware.ts`:
   ```ts
   export async function getActorFromReq(req: any): Promise<{ rol: string; username: string } | null>
   ```
   Lee `x-isp-session`, valida el JSON, llama a `getPermisosForUsername` y devuelve `{ rol, username }`.

2. **Reescribir el chequeo en `/operaciones/cierre`:**
   ```ts
   const actor = await getActorFromReq(req);
   if (!actor || !['admin', 'supervisor'].includes(actor.rol)) {
     return res.status(403).json({ error: 'Solo supervisores y administradores pueden cerrar el día' });
   }
   const { confirmacion, comentario, fecha: fechaSolicitada, sincronizarCustodias } = req.body;
   // Usar actor.username y actor.rol para auditoría y reglas de retroactivo
   ```
   Aplicar lo mismo a `/operaciones/reabrir`.

3. **Eliminar `usuario`, `usuarioId` y `rol` del body** en frontend (`ModalCierre`, `ModalReabrir`) y persistir el `actor.username` real en `cierre_operativo_diario.usuario` y `motivo_reapertura_por`.

4. **Auditar más endpoints sospechosos** en el mismo router:
   - `POST /operaciones/asignar-custodia` (línea 847): `const { ..., usuario, fecha } = req.body;`
   - `POST /operaciones/registrar-falta-custodia` (881)
   - `POST /operaciones/cambiar-titular-custodia` (881)
   - `POST /operaciones/registrar-falta` (2048)
   - `POST /operaciones/sustituir`
   - `POST /operaciones/liberar` (2615)
   - `POST /operaciones/puestos/:id/titular` (2773)
   - `POST /operaciones/quitar-titularidad` (2848)

   Todos toman `usuario` del body para auditoría. **Ninguno** verifica que ese `usuario` coincida con la sesión real. Es bug de **trazabilidad** (no escalamiento, porque el rol no se chequea ahí), pero conviene corregir en la misma pasada.

5. **Tests:** dos casos REST con `curl`:
   - usuario operador con `rol: "admin"` en body → debe responder 403.
   - admin real → 200.

**Esfuerzo estimado:** 1-2 horas (incluyendo tests y limpieza del front).

---

## 3. Estado del frontend (Operaciones.tsx)

### 3.1 Métricas globales

| Métrica | Valor |
|---------|-------|
| Líneas | 10,081 (496 KB) |
| `useState` | 149 |
| `useQuery` | 20 |
| `useEffect` | 11 |
| `useMemo` | 6 |
| `useCallback` | **1** |
| `createPortal` (modales) | 17 |
| `apiPost` / `apiDelete` | 18 |
| Componentes top-level | 25 |

### 3.2 Mapa estructural

| Líneas | Bloque | Tamaño | Notas |
|-------:|--------|-------:|-------|
| 1-545 | Tipos e interfaces | 545 | `Puesto`, `Pool`, `PlanFuturo`, `CierreResumen`, etc. Candidato directo a `types.ts`. |
| 546-700 | Helpers globales | 155 | `fechaHoyStr`, `iniciales`, `fmtHora`, `apiPost`, `apiDelete`, `MiniAgente`, `DraggableAgente`, `parseHM`, `turnoBounds`. Candidato a `utils.ts` + `components/`. |
| 726-1182 | `ModalSegmentos` | 457 | Aislable. |
| 1197-1601 | Pool helpers + `SelectorAgenteAgrupado` | 405 | Lógica de agrupar pool actual/futuro — **duplica reglas con backend**. |
| 1648-2011 | `ModalPlanSSA`, `ModalPlanFuturo` | 364 | Dos modales pequeños del Plan Futuro. |
| **2026-3028** | **`ModalConfigTurno`** | **1,003** | **Hotspot #1.** Editor de slots/turnos con su propia lógica de horario, semanas, ciclo. Justifica módulo propio. |
| 3038-3717 | `TarjetaPuestoFuturo`, `PoolFuturoPanel`, `ClienteColumnaFutura` | 680 | Vista Plan Futuro. |
| 3718-4350 | `DroppableCustodiaSlot`, `DroppablePuesto` | 633 | Drag & drop "hoy". Re-renders frecuentes — sensibles a memoización. |
| 4350-4649 | `ClienteColumna`, `PanelHistorial` | 300 | UI por cliente. |
| 4675-5143 | `ModalSustituyeTitular`, `ModalEligeCobertura` | 469 | Aislables. |
| 5167-6637 | Modales operativos varios | 1,471 | `Custodia`, `Sustitución`, `NuevoPuesto`, `Liberar`, `Falta`, `Cierre`, `Reabrir`, `QuitarTitularidad`. |
| **6638-9337** | **`Operaciones()`** | **2,700** | **Hotspot #0 — el orquestador monstruo.** |
| 9337-9821 | `ModalIncentivoCash`, `TarjetaSSACard`, `ModalAsignarSSA` | 484 | Aislables. |

### 3.3 Componente `Operaciones()` desmenuzado

Un solo componente con:

- **26 useState locales** (la enumeración exacta debe hacerse en el refactor; agrupables por dominio: modales, fecha-vista, contexto-puesto, drag-state, plan-futuro-state, cierre-state).
- **12 useQuery** principales (ver tabla 3.4).
- **33 funciones internas** (handlers de mutación, callbacks DnD, formateadores).
- **118 setters** llamados.
- **14 IIFE inline** (cálculos derivados que serían `useMemo` o componentes hijos).

**Riesgos derivados:**

- Cualquier cambio de estado dispara render de las ~2,700 líneas y de los 17 modales montados con createPortal.
- El estado de modales y el estado de "fecha vista" están mezclados con el estado de drag — un drag dispara invalidaciones que pueden re-fetch de queries no relacionadas.
- Probar manualmente todos los flujos requiere recorrer 8+ caminos de UI.

### 3.4 Inventario de queries y consistencia tras mutaciones

| `queryKey` | Línea declaración | ¿Está en `invalidate()`? | ¿Está en `invalidateFuture()`? | Riesgo |
|------------|------------------:|:-:|:-:|--------|
| `operaciones-tablero` | 6772 | ✅ | — | OK |
| `operaciones-pool` | 6786 | ✅ | — | OK |
| `operaciones-admin` | 6817 | **❌** | — | Tablero admin queda stale tras cierre. |
| `operaciones-historial` | 6830 | ✅ | — | OK |
| `operaciones-clientes` | 6842 | **❌** | — | Lista de clientes disponibles puede mostrar baja eliminada. |
| `operaciones-cierre-hoy` | 6852 | **❌** | — | Tras `POST /cierre` el banner "día abierto" puede quedar visible. |
| `ssa-tablero-pizarron` | 6862 | ✅ | — | OK |
| `puestos-sin-zona` | 6876 | **❌** | — | Tras crear puesto desde modal, pueden no aparecer en el panel. |
| `planificacion-futura` | 6888 | — | ✅ | OK |
| `planificacion-futura-proximos` | 6900 | — | ✅ | OK |
| `pool-futuro` | 6916 | — | ✅ | OK |
| `proximos-arranques` | 6928 | **❌** | **❌** | Arranques de proyecto no se refrescan tras mutar planificación. |
| `pool-disponibilidad` | (no declarada en este archivo) | ✅ (invalidada) | — | Invalidación huérfana — la query vive en otro componente. |

**Total:** 5 queries declaradas que **no** se invalidan + 1 invalidación huérfana.

> Recomendación: en el refactor crear un hook `useOperacionesInvalidator()` con dos métodos `invalidatePresent()` e `invalidateFuture()` que listen las claves de manera explícita, y eliminar los `qc.invalidateQueries` dispersos (líneas 9285, 9317-9318, 9422).

### 3.5 Performance

- Polling activo en 4-5 queries (intervalos típicos 15 s, 30 s, 60 s, 300 s). Cada poll dispara render del orquestador completo.
- `0 useCallback` significa que cada handler se recrea en cada render → cada `DraggableAgente`, `DroppablePuesto`, `ClienteColumna` re-renderiza aunque sus props "lógicas" no cambien.
- Listas filtradas (pool, tablero, ranking) se computan inline en el JSX, no memoizadas.
- 17 modales montados con `createPortal` significan que cada render de `Operaciones()` ejecuta sus closures aunque estén cerrados (su contenido sí está condicionado, pero su cuerpo de función corre).

**No hay evidencia de problemas de performance reportados por el usuario hoy** — pero al añadir más zonas/clientes el costo se multiplicará. Memoizar al extraer es la oportunidad natural.

---

## 4. Estado del backend (`operaciones.ts`)

### 4.1 Inventario de endpoints (36)

```
GET    /operaciones/tablero
POST   /operaciones/asignar-custodia
POST   /operaciones/registrar-falta-custodia
POST   /operaciones/cambiar-titular-custodia
GET    /operaciones/proximos-regresos-vacaciones
GET    /operaciones/pool
POST   /operaciones/asignar
POST   /operaciones/registrar-falta
POST   /operaciones/sustituir
POST   /operaciones/liberar
POST   /operaciones/puestos/:id/titular
POST   /operaciones/quitar-titularidad
PATCH  /operaciones/puestos/:id
PATCH  /operaciones/puestos/:id/salario
GET    /operaciones/puestos-salarios
PATCH  /operaciones/puestos/:id/igss
GET    /operaciones/puestos/sin-zona
POST   /operaciones/puestos
DELETE /operaciones/puestos/:id
GET    /operaciones/historial
GET    /operaciones/agentes/:id/disponibilidad
GET    /operaciones/cierre-hoy
GET    /operaciones/cierre/preview-custodias
POST   /operaciones/cierre              ← bug authz
POST   /operaciones/reabrir             ← bug authz
GET    /operaciones/cierres
GET    /operaciones/cierres/:fecha
GET    /operaciones/pizarron-historico/:fecha
GET    /operaciones/puestos/:id/titular-historico
GET    /operaciones/clientes-disponibles
PATCH  /operaciones/puestos/:id/turno
GET    /operaciones/puestos/:id/turno
GET    /operaciones/tablero/administracion
GET    /operaciones/puestos/:id/titulares
PUT    /operaciones/puestos/:id/titulares
GET    /custodias/puestos               ← dominio distinto, vive aquí
```

### 4.2 Subdominios identificables

Si en una segunda fase se quisiera dividir el router:

| Sub-router sugerido | Endpoints | Líneas aprox. |
|---------------------|-----------|---------------|
| `operaciones-tablero.ts` | `/tablero`, `/tablero/administracion`, `/pool`, `/historial`, `/clientes-disponibles` | ~700 |
| `operaciones-puestos.ts` | `/puestos*`, `/puestos/:id/turno`, `/puestos/:id/salario`, `/puestos/:id/igss`, `/puestos/:id/titulares` | ~1,200 |
| `operaciones-mutaciones.ts` | `/asignar`, `/sustituir`, `/liberar`, `/registrar-falta`, `/quitar-titularidad`, `/puestos/:id/titular` | ~1,100 |
| `operaciones-custodias.ts` | `/asignar-custodia`, `/registrar-falta-custodia`, `/cambiar-titular-custodia`, `/custodias/puestos` | ~400 |
| `operaciones-cierre.ts` | `/cierre`, `/reabrir`, `/cierre-hoy`, `/cierres`, `/cierres/:fecha`, `/cierre/preview-custodias`, `/pizarron-historico/:fecha` | ~1,100 |
| `operaciones-helpers.ts` | `calcFechaActiva`, `todayGT`, `isoADDMMYYYY`, `cierreSync`, `titularidadHelpers` | ~300 |

### 4.3 Side-effects fuera de transacción

Esta auditoría no entra en cada endpoint, pero el architect señaló que **algunos efectos secundarios críticos** (sincronización de custodias, eventos RRHH automáticos) se ejecutan **best-effort** después del `COMMIT` principal. Riesgo: una falla en el side-effect deja datos parcialmente actualizados sin posibilidad fácil de rollback.

> Recomendación de revisión específica en mayo: identificar todos los `await` posteriores a `COMMIT` y decidir caso por caso si deben entrar en la transacción principal o convertirse en colas con reintento.

---

## 5. Plan de refactor — propuesta ajustada

El plan original en `replit.md` contempla 6 pasos. El architect recomienda agregar un **Paso 0** y reordenar.

### Paso 0 (NUEVO) — Hardening de seguridad y trazabilidad
**Cuándo:** ANTES del 6 de mayo (hotfix) o como primer paso del refactor.
**Esfuerzo:** 1-2 h.

- [ ] Exportar `getActorFromReq()` en `lib/permisos-middleware.ts`.
- [ ] Reescribir `/operaciones/cierre` y `/operaciones/reabrir` para leer rol de la sesión.
- [ ] Auditar y corregir `usuario` en los 8 endpoints listados en §2.2 punto 4.
- [ ] Tests REST con `curl` documentados en `docs/02-documentacion-tecnica.md`.
- [ ] Migración (si aplica): backfill / nota en `cierre_operativo_diario` aclarando que el campo `usuario` ahora viene del backend.

**Criterio de aceptación:** un operador sin rol admin/supervisor recibe 403 al intentar cerrar día, aunque envíe `rol: "admin"` en el body.

---

### Paso 1 — Tests E2E del Pizarrón (ancla de regresión)
**Esfuerzo:** 4-6 h.

Antes de mover una línea de Operaciones.tsx, dejar grabados los flujos críticos:

- [ ] Asignar agente a puesto vacío.
- [ ] Sustituir titular por cobertura.
- [ ] Registrar falta.
- [ ] Cierre del día con texto "CERRAR DD-MM-YYYY".
- [ ] Reabrir día (admin).
- [ ] Plan Futuro: arrastrar agente a un día futuro.
- [ ] Plan SSA: asignar y remover agente de un servicio sin asignar.
- [ ] Custodias: asignar arma, registrar falta de custodia.

**Criterio de aceptación:** suite verde en green build local. Los tests sirven para detectar regresiones durante los pasos 3-7.

---

### Paso 2 — Extracción de tipos y helpers puros
**Esfuerzo:** 2-3 h. Riesgo bajo.

- [ ] `Operaciones.tsx` líneas 1-545 → `Operaciones/types.ts`.
- [ ] `Operaciones.tsx` líneas 546-700 → `Operaciones/utils.ts` + `Operaciones/api.ts` (apiPost/apiDelete).
- [ ] `MiniAgente`, `DraggableAgente` → `Operaciones/components/atoms/`.
- [ ] Confirmar imports en `ModalFichaArma.tsx` y otros consumidores externos siguen compilando.

---

### Paso 3 (REORDENADO — antes era paso 5) — Hooks de datos centralizados
**Esfuerzo:** 4-6 h.

Razón del adelanto: los modales y secciones complejas dependen de las queries y mutaciones. Si estabilizamos primero la capa de datos, los pasos siguientes son trasplantes mecánicos.

- [ ] `Operaciones/hooks/useOperacionesQueries.ts` — declarar las 12 queries del orquestador con sus opciones (intervalos, enabled, staleTime).
- [ ] `Operaciones/hooks/useOperacionesMutations.ts` — `useAsignar`, `useSustituir`, `useLiberar`, `useRegistrarFalta`, `useCierre`, `useReabrir`, `useQuitarTitularidad`. Cada hook declara explícitamente qué `queryKey`s invalida.
- [ ] `Operaciones/hooks/useOperacionesInvalidator.ts` — `invalidatePresent()` e `invalidateFuture()` con la lista COMPLETA de queries (corrige las 5 omisiones documentadas en §3.4).
- [ ] Eliminar todos los `apiPost`/`apiDelete` directos del orquestador y los `qc.invalidateQueries` sueltos.

**Criterio de aceptación:** matriz query↔mutación documentada en `docs/02-documentacion-tecnica.md` §nuevo. Tests del paso 1 siguen verdes.

---

### Paso 4 — Extracción de modales (uno por archivo)
**Esfuerzo:** 6-8 h. Lote por lote.

Orden propuesto (de más simple a más complejo):

1. `ModalSegmentos`
2. `ModalPlanSSA`, `ModalPlanFuturo`
3. `ModalSustituyeTitular`, `ModalEligeCobertura`
4. `ModalCustodiaTipo`, `ModalSustitucion`, `ModalNuevoPuesto`, `ModalLiberar`, `ModalRegistrarFalta`
5. `ModalCierre`, `ModalReabrir`, `ModalQuitarTitularidad`
6. `ModalIncentivoCash`, `ModalAsignarSSA`
7. **Aparte: `ModalConfigTurno` (1,003 líneas)** — su propio mini-refactor; quizá merece subdividirse en `Editor`, `PreviewSemanas`, `SelectorSlots`.

Cada modal extraído debe consumir hooks del Paso 3 (no `apiPost` directo).

---

### Paso 5 — Extracción de secciones (paneles)
**Esfuerzo:** 4-6 h.

- [ ] `Operaciones/sections/PanelPool.tsx` (incluye `PoolFuturoPanel`).
- [ ] `Operaciones/sections/PanelClientes.tsx` (incluye `ClienteColumna`, `ClienteColumnaFutura`).
- [ ] `Operaciones/sections/PanelHistorial.tsx`.
- [ ] `Operaciones/sections/PanelDnD.tsx` (`DroppablePuesto`, `DroppableCustodiaSlot`).
- [ ] `Operaciones/sections/PanelSSA.tsx` (`TarjetaSSACard`).

**Criterio de aceptación:** orquestador queda < 800 líneas componiendo secciones.

---

### Paso 6 — Memoización y optimización
**Esfuerzo:** 2-4 h.

- [ ] Convertir handlers a `useCallback` en componentes que se renderizan dentro de listas.
- [ ] `useMemo` en derivados pesados (filtros de pool, ranking, agrupación por zona).
- [ ] Evaluar `React.memo` en `DraggableAgente`, `DroppablePuesto`, `ClienteColumna`.
- [ ] Revisar intervalos de polling — bajar `operaciones-clientes` y `puestos-sin-zona` a `staleTime: 60_000` (cambian poco).

---

### Paso 7 (opcional, segunda iteración) — Sub-routers backend
**Esfuerzo:** 6-10 h.

Solo si en el camino se detecta que el backend monolítico estorba para los tests. Dividir según §4.2.

---

## 6. Archivos involucrados (referencia rápida)

### Frontend
- `artifacts/isp-web/src/admin/pages/Operaciones.tsx` — todo el módulo.
- `artifacts/isp-web/src/admin/components/ModalFichaArma.tsx` — consumidor externo de tipos. **No tocar al refactorizar Operaciones**, pero verificar imports.
- `artifacts/isp-web/src/admin/pages/Armeria.tsx` — independiente, no afecta.

### Backend
- `artifacts/api-server/src/routes/operaciones.ts` — router monolítico.
- `artifacts/api-server/src/lib/permisos-middleware.ts` — sede del helper `getActorFromReq` propuesto.
- `artifacts/api-server/src/routes/operaciones/_helpers/` — carpeta sugerida para extraer `fechas.ts`, `cierre-sync.ts`, `titularidad.ts`.
- Routers vecinos consumidos por la página: `planificacion-futura.ts`, `solicitudes-servicio.ts`, `incentivos.ts`, `puesto-slots.ts`, `turnos.ts`, `zonas.ts`.

### Documentación
- `replit.md` (líneas 4-5) — actualizar el plan tras aprobar este documento.
- `docs/02-documentacion-tecnica.md` — agregar §nuevo "Refactor Pizarrón Operativo (mayo 2026)" con la matriz query↔mutación al cerrar Paso 3.

---

## 7. Decisiones pendientes para el usuario

1. **¿Aplicar el Paso 0 (hotfix authz) ya, o dejarlo como primer paso del refactor de mayo?** Es el único hallazgo que puede explotarse en producción ahora mismo.
2. **¿Quién ejecuta el refactor — Replit Agent solo, o se involucra otra persona?** Si es solo el agente, conviene dividir en 7 sesiones (una por paso) para mantener checkpoints frecuentes.
3. **¿Se acepta extender el alcance al Paso 7 (backend)?** Es trabajo adicional pero alivia la mantenibilidad a largo plazo.

---

*Este documento se generó como respuesta a la solicitud "auditoría con Claude" del 25 de abril de 2026. No se modificó código durante su elaboración.*
