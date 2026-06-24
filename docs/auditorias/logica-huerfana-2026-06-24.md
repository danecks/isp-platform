# Auditoría de lógica huérfana / duplicada / muerta — 2026-06-24

Inventario **verificado** (no especulativo) de lógica huérfana, duplicada y muerta
en `artifacts/api-server`. Cada hallazgo indica `archivo:línea`, cómo se verificó y
su clasificación:

- **(a) Seguro de limpiar/consolidar** — código muerto sin efectos o duplicación trivial.
- **(b) Requiere tu aprobación** — toca nómina/disciplina/operativo; riesgo de divergencia
  o doble pago si se unifica mal. **No tocar sin sign-off.**

> Regla de oro de esta auditoría: **no se cambió ninguna fórmula de cálculo ni regla
> de negocio.** El único cambio de código aplicado es la corrección de un token SQL
> basura (ver §6), que no altera ningún comportamiento en uso.

---

## 1. Endpoints sin consumidor (verificado)

Verificación: `rg` de cada ruta en `artifacts/isp-web/src` (frontend) y en el resto
del backend. Distinción clave entre **"no lo llama la web"** y **"alimenta nómina/otro proceso"**.

| Endpoint | ¿Lo llama la web? | ¿Lo usa otro proceso? | Clasificación |
|---|---|---|---|
| `GET /cobertura/diaria` (`cobertura.ts:29`) | No | No (la web usa `/cobertura/segmentos`) | (b) huérfano de web — ver nota |
| `POST /cobertura/diaria` (`cobertura.ts:64`) | No | Escribe `cobertura_diaria`, que **sí** lee nómina | (b) huérfano de web, ojo: tabla viva |
| `GET /cobertura/reporte` (`cobertura.ts:131`) | No | No | (b) huérfano de web — lectura inofensiva |
| `GET /cobertura/segmentos` (`cobertura.ts:210`) | **Sí** (`ModalSegmentos.tsx:33`) | — | EN USO |
| `POST /cobertura/segmentos` (`cobertura.ts:338`) | **Sí** (`ModalSegmentos.tsx:178`) | — | EN USO |
| `DELETE /cobertura/segmentos/:id` | **Sí** (`ModalSegmentos.tsx:260`) | — | EN USO |
| `GET /rrhh/eventos` (lista) | **Sí** (`RRHHEventos.tsx:70`) | — | EN USO |
| `POST /rrhh/eventos` (alta manual) | **Sí** (`RRHHEventos.tsx:120`) | También interno desde operaciones | EN USO |
| `GET /rrhh/eventos/:id` (`eventos-rrhh.ts:215`) | No | No detectado | (a) candidato huérfano (lectura) |
| `GET /rrhh/eventos/actas` (`eventos-rrhh.ts:1470`) | No | No detectado | (a) candidato huérfano (lectura) |
| `GET /incentivos` | **Sí** (`ModalSegmentos.tsx:203`, `use-assignment-flow.ts:432`) | — | EN USO |
| `POST /incentivos` | **Sí** (`ModalIncentivoCash.tsx:59`) | — | EN USO |
| `PATCH /incentivos/:id` (`incentivos.ts:231`) | No | No detectado | (a) candidato huérfano de web |
| `DELETE /incentivos/:id` (`incentivos.ts:269`) | No | No detectado | (a) candidato huérfano de web |

**Notas / recomendación**
- **`cobertura_diaria` NO es una tabla muerta.** Aunque la web ya no llama a
  `GET/POST /cobertura/diaria`, la tabla la **lee la nómina** en
  `services/nomina/generar-novedades.ts:301,415,560` (fallback "trabajó ese día" y
  ausencias sin cubrir) y los reportes en `reportes.ts:656,679,701`. Se mantiene
  sincronizada por `syncCoberturaDesdeSegmentos` (`cobertura.ts:252`) en cada alta/baja
  de segmento. **No eliminar la tabla ni la sincronización.**
- `GET /cobertura/diaria` y `GET /cobertura/reporte` son lecturas huérfanas de la web.
  Quitarlas es de bajo riesgo, pero como no estorban se recomienda **dejarlas marcadas
  como deprecadas** en vez de borrarlas (podrían usarse desde un cliente externo/reporte
  manual). Sign-off recomendado antes de borrar.
- `PATCH /incentivos/:id`, `DELETE /incentivos/:id`, `GET /rrhh/eventos/:id` y
  `GET /rrhh/eventos/actas` no tienen llamador en la web actual. La anulación de HE en
  efectivo se hace por `POST /rrhh/horas-extra-cash/anular`, **no** por `DELETE /incentivos`.
  Son candidatos a deprecar/eliminar, pero al ser CRUD sobre datos financieros se dejan
  en **(a) con recomendación de confirmar** que ningún panel admin nuevo los necesite.

---

## 2. Columnas / estado legacy (verificado)

### 2.1 `puestos_operativos.estado` ('cubierto' / 'descubierto') — DIVERGENCIA VIVA
Verificación: `rg "po\.estado"`. La columna **sigue leyéndose** en varios módulos:
- `agente-fichaje.ts:295,489,1237,1342,1517,2544,2650` (fichaje del agente)
- `zonas.ts:40,41,121,327,346` (conteos de zona)
- `portal.ts:650,724` (portal cliente)
- `asignacion.ts` (la escribe al asignar/liberar)
- `cierre.ts:412,504` (snapshot del cierre)

Pero el **conteo de cobertura del cierre** y el **pizarrón** ya NO confían en ella:
`cierre.ts:21-54` cuenta desde `puesto_slots` (modelo 24x24) y comenta explícitamente
que `puestos_operativos.estado` "quedó obsoleta… reportaba casi todo 'descubierto'".
El tablero (`tablero.ts:350,401,408,419`) **fuerza** `estado='cubierto'` para el frontend.

→ **Clasificación (b) — riesgo de divergencia.** Hay dos verdades simultáneas:
slots (pizarrón/cierre) vs `estado` (fichaje/zonas/portal). Un puesto cubierto por
ciclo de slots puede seguir con `estado='descubierto'` y viceversa.
**Recomendación:** unificar a una sola fuente (slots) detrás de un helper, migrando
`agente-fichaje`, `zonas` y `portal`. **No tocar sin sign-off** (afecta fichaje y portal cliente).

### 2.2 `puestos_operativos.agente_id` (titular legacy single)
Verificación: usado como **fallback** junto a slots en `cierre.ts:33`
(`OR po.agente_id IS NOT NULL`) y en `tablero.ts:78,94,108`. No es muerto: es la rama
legacy para puestos de 1 titular que aún no migraron a slots.
→ **(b)** — mantener mientras existan puestos sin slot; documentar como deuda de migración.

### 2.3 `novedades_nomina_diarias.impacto_nomina = 'pagado_efectivo'`
Verificación: se **escribe** en `incentivos.ts:170` y `eventos-rrhh.ts:1070`, y la
nómina lo **respeta** (excluye de planilla; ver `pre-planilla.ts:104,957`). NO es muerto;
es el mecanismo anti-doble-pago de HE en efectivo. → EN USO, sin acción.

---

## 3. Duplicación de dominio crítico — DOCUMENTAR, no unificar sin sign-off

### 3.1 Valor monetario de Horas Extra
Fuente única correcta: **`lib/nomina-calc.ts:99` `calcularValorHE`** (tarifa fija
`config_tarifa_he` Q150/12h, Q300/24h; si no hay, cae a `(sueldoDia/horasDia)×1.5×he`).
La usan `planilla.ts:93` y `pre-planilla.ts:624,1501` (correcto, importada).

**Re-implementaciones divergentes (riesgo de montos distintos):**
- `clientes/ficha.ts:481` — hardcodea `(sueldoDia/horasDia)*1.5*he`, **ignora la tarifa fija**.
- `igss.ts:453` — hardcodea `valorHora*1.5*he`, **ignora la tarifa fija**.
- (UI) `isp-web/.../planilla/TabHorasExtra.tsx:39` y `pre-planilla/helpers.ts:104` — fórmula
  legal como fallback de display.

→ **(b)** Recomendación: que `ficha.ts` e `igss.ts` consuman `calcularValorHE` (cargando
el `Map` de `config_tarifa_he`). **Requiere sign-off**: hoy `ficha`/`igss` pueden mostrar
un valor de HE distinto al que paga la planilla cuando hay tarifa fija configurada.

### 3.2 Resolución del titular de un puesto
Fuente canónica: **`operaciones/_helpers/titularidad.ts:158` `TITULARES_UNIFICADOS_CTE`**
(prioridad: `puesto_slots` → `puesto_titulares` → `po.titular_employee_id` legacy).

**Copias / variantes:**
- `pre-planilla.ts:407` `clienteEmpleadoSQL` — misma lógica reescrita como string SQL.
- `armeria/_helpers.ts:32` `calcularResponsablePuesto` — **divergente**: mete
  `planificacion_futura` (relevos) antes de slots.
- `tablero.ts` — arma `titulares_json` con su propio JOIN dual (slots A / titulares B).
- (UI) `clientes/TabTitulares.tsx:19`.

→ **(b)** Recomendación: una sola función/CTE compartida. **Requiere sign-off** (afecta
quién es "el titular que faltó" → falta/descuento del titular correcto).

### 3.3 Ciclo 24x24 — `calcTrabajaPorSlot`
Función idéntica copiada en:
- `operaciones/tablero.ts:243` (referencia del pizarrón)
- `cobertura.ts:11`
- `armeria/_helpers.ts:16`
- `operaciones/pool.ts:12` (`calcTrabajaPorSlotPersonal`, mismo cuerpo)
- `operaciones/asignacion.ts:296` — **inline divergente** (lógica `((daysElapsed%lc)+lc)%lc+1`
  duplicada dentro de un loop, sin helper).
- `lib/domain/src/turnos.ts:8` menciona el plan de unificar; las copias siguen activas.

→ **(b)** Aunque hoy las copias son idénticas, el riesgo es que diverjan (pizarrón vs
nómina vs armería). Recomendación: exportar UNA función desde `lib/domain` y reemplazar
las copias. **Marcado para sign-off** por instrucción de la tarea (ciclos 24x24).

---

## 4. Ramas muertas y errores silenciados (verificado)

### 4.1 Conteo de custodia del cierre — error tragado
`cierre.ts:~92-132`: todo el bloque de conteo de custodia está en un `try { … }
catch (custErr) { logger.warn(…, "no bloqueante") }`. Si cualquier query falla,
`custodiaCubiertos` queda en 0 y el resumen del cierre puede **sub-reportar cobertura
de custodia** sin avisar al usuario (solo queda un warn en logs).
→ **(b)** Recomendación: además del warn, **exponer una bandera** en la respuesta
(p.ej. `custodiaConteoIncompleto: true`) para que el cierre muestre "no se pudo calcular
custodia" en vez de "0 descubiertos". No fallar duro (rompería el cierre), pero **fallar
visible**. Requiere sign-off de UX del cierre.

### 4.2 Auto-migración — error tragado
`auto-seed.ts:382-384`: el bloque de auto-migrate hace `catch { logger.error(…,
"continuando de todas formas") }`. Por diseño no debe tumbar el arranque, pero un fallo
de migración queda solo en logs y el servidor levanta como si todo estuviera bien.
→ **(b)** Por instrucción de la tarea (no eliminar parches de auto-migración), **solo se
documenta**. Recomendación opcional: registrar el resultado de cada paso en una tabla de
estado para diagnóstico, sin cambiar el comportamiento de arranque.

---

## 5. Cosas que parecían muertas pero NO lo son (para evitar borrados peligrosos)
- `cobertura_diaria` (tabla) — alimenta nómina (§1).
- `impacto_nomina='pagado_efectivo'` — anti-doble-pago (§2.3).
- `po.agente_id` — fallback de 1 titular (§2.2).
- Helpers de `cobertura.ts` (`horaAMinutos`, `calcularHoras`, `solapaCon`,
  `calcTrabajaPorSlot`) — todos usados dentro de `POST /cobertura/segmentos`.

---

## 6. Limpieza segura aplicada en esta tarea (única modificación de código)

- **`cobertura.ts:40`** — el `SELECT` de `GET /cobertura/diaria` tenía un token basura:
  `et.telefono    jo    AS titular_telefono`. Ese `jo` es un error de tipeo que hace que
  la consulta sea SQL inválido; el endpoint daría error 500 si alguien lo llamara (lo que
  además confirma que hoy nadie lo llama). Corregido a `et.telefono AS titular_telefono`.
  **Sin efecto en ningún flujo en uso** (endpoint sin consumidor) y sin cambio de cálculo.

No se aplicó ninguna otra modificación: todo lo demás de §1–§4 queda **documentado para
tu decisión**, por tocar nómina, disciplina, fichaje o portal.
