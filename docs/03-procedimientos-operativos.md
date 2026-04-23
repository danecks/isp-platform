# Procedimientos Operativos — ISP, S.A.

> Flujos clave del negocio paso a paso. Referencia para supervisores, encargados de turno, RRHH y administración.

---

## Índice

1. [Cierre operativo diario](#1-cierre-operativo-diario)
2. [Procesar una falta](#2-procesar-una-falta)
3. [Sustitución de un guardia](#3-sustitución-de-un-guardia)
4. [Hora extra (HE)](#4-hora-extra-he)
5. [Cambio de titular en un puesto](#5-cambio-de-titular-en-un-puesto)
6. [Alta de un nuevo empleado (proceso completo)](#6-alta-de-un-nuevo-empleado)
7. [Reingreso de un empleado retirado](#7-reingreso-de-un-empleado-retirado)
8. [Retiro / liquidación de un empleado](#8-retiro--liquidación-de-un-empleado)
9. [Procesar la planilla quincenal](#9-procesar-la-planilla-quincenal)
10. [Generar planilla IGSS mensual](#10-generar-planilla-igss-mensual)
11. [Otorgar y registrar vacaciones](#11-otorgar-y-registrar-vacaciones)
12. [Asignar un anticipo](#12-asignar-un-anticipo)
13. [Atender una Solicitud de Servicio (SSA)](#13-atender-una-solicitud-de-servicio-ssa)
14. [Asignar un arma a un puesto](#14-asignar-un-arma-a-un-puesto)
15. [Renovar portación / DIGECAM](#15-renovar-portación--digecam)
16. [Activar un puesto QR para fichaje](#16-activar-un-puesto-qr-para-fichaje)
17. [Crear y operar una ronda QR](#17-crear-y-operar-una-ronda-qr)
18. [Alta de un cliente nuevo](#18-alta-de-un-cliente-nuevo)
19. [Apertura de un nuevo puesto operativo](#19-apertura-de-un-nuevo-puesto-operativo)
20. [Importación masiva de empleados](#20-importación-masiva-de-empleados)
21. [Levantar amonestación](#21-levantar-amonestación)

---

## 1. Cierre operativo diario

> **Cuándo**: cada día, después de que termine el último turno (recomendado: madrugada del día siguiente o primera hora del día).
> **Quién**: encargado de turno o jefe de servicio con permiso de cierre.

### Pasos
1. Andá a `/admin/operaciones`.
2. Verificá que la fecha mostrada sea la del día a cerrar.
3. Recorré cada cliente y revisá:
   - Todos los puestos cubiertos (verde).
   - Faltas marcadas con su sustitución correspondiente.
   - Novedades en el panel de "Servicios Especiales" cerradas.
4. En el panel inferior **"Cierre del día"**, click en **"Cerrar día"**.
5. Si hay puestos sin cubrir o sin marcar, el sistema te avisa. Resolvé y volvé a intentar.
6. Una vez cerrado, el día queda **bloqueado** y se puede usar para pre-planilla.

### ¿Qué hacer si…?
- **Necesitás reabrir un día cerrado**: solo gerencia/admin con permiso especial puede hacerlo desde `/admin/operaciones/cierres`. Cada reapertura queda en `cierre_auditoria`.
- **El sistema dice "puestos sin asignar"**: andá al pizarrón y resolvé cada uno (asignar guardia, marcar falta justificada, o reportar como vacante).

---

## 2. Procesar una falta

> **Cuándo**: el guardia titular no se presentó a su turno.
> **Quién**: encargado de turno.

### Pasos
1. En `/admin/operaciones`, ubicá al guardia faltante.
2. Click sobre él → **"Marcar falta"**.
3. Indicá:
   - **Tipo**: justificada (con documento) o injustificada.
   - **Motivo**: enfermedad, calamidad, sin aviso, etc.
4. El sistema:
   - Crea un evento RRHH en `eventos_rrhh`.
   - Libera el puesto.
   - Si hay sustituto pendiente, te ofrece asignarlo.
5. **Asignar sustituto**: ver [Sustitución de un guardia](#3-sustitución-de-un-guardia).

### Consecuencias automáticas
- El guardia faltante **NO se le paga ese día** en pre-planilla (si la falta es injustificada).
- Si es la 3ra falta en un mes, se genera alerta para amonestación.
- El sustituto **gana hora extra** o doble turno según configuración.

---

## 3. Sustitución de un guardia

### Pasos
1. En el puesto vacío, click **"Asignar sustituto"**.
2. El sistema sugiere guardias disponibles (descansando ese día, sin turno asignado).
3. Seleccioná uno y confirmá.
4. Indicá si es:
   - **Hora extra** (se paga adicional).
   - **Cambio de turno** (no se paga adicional, intercambio).
5. El movimiento queda en `cobertura_segmentos` y `movimientos_operativos`.

---

## 4. Hora extra (HE)

> **Cuándo**: un guardia trabaja más allá de su jornada normal (cubre falta, doblan turno).

### Pasos
1. Al asignar como sustituto, marcá **"Es hora extra"**.
2. El sistema calcula automáticamente:
   - HE diurnas: tarifa configurada en `config_tarifa_he`.
   - HE nocturnas: con recargo.
3. La HE aparece en pre-planilla del período correspondiente.

### Aprobación
- Si tu rol no tiene permiso de aprobación, queda **pendiente** de aprobación de RRHH.
- RRHH revisa en `/admin/rrhh/eventos` filtrando por "HE pendientes".

---

## 5. Cambio de titular en un puesto

> **Cuándo**: un guardia deja un puesto fijo y otro asume.

### Pasos
1. En `/admin/operaciones`, click sobre el puesto.
2. **"Gestionar titulares"**.
3. Quitá al titular actual con fecha de fin.
4. Agregá al nuevo titular con su **fecha de inicio de ciclo** (necesaria para calcular descansos).
5. Confirmá.
6. El cambio queda en `puesto_titular_historico`.

### Si es a futuro
- En lugar de aplicar de inmediato, registralo en **planificación futura** con la fecha de efectividad.
- El sistema lo aplica automáticamente al llegar el día.

---

## 6. Alta de un nuevo empleado

### Pasos
1. **Solicitud de empleo** (opcional pero recomendado):
   - El candidato llena `ispsa.net/solicitud-empleo` (público).
   - Aparece en `/admin/rrhh/eventos` o módulo de solicitudes para revisar.
2. **Crear empleado**: andá a `/admin/empleados` → **"Nuevo empleado"**.
3. Completá datos personales (DPI obligatorio).
4. Asigná tipo de personal (guardia por defecto), frecuencia de pago, fecha de inicio.
5. **Generar contrato** desde la ficha → **Documentos**.
6. **Asignación operativa**: cliente, puesto, supervisor, zona, turno.
7. **Kit de ingreso**: andá a Bodega → **Dotación** → asignar uniforme y equipo.
8. **Carnet QR**: generá su carnet desde `/admin/rrhh/carnets`.
9. **Cuenta WhatsApp** (opcional): registrá su número en su ficha para notificaciones.

### Período de prueba
- Por defecto, 60 días. Aparece en alertas RRHH al acercarse el vencimiento.
- Configurable por cliente (`contrato_sin_prueba` en `clients`).

---

## 7. Reingreso de un empleado retirado

> **Cuándo**: un ex-empleado vuelve a trabajar.

### Pasos
1. Buscá al empleado en `/admin/empleados` (filtro: estado = retirado).
2. Click en su ficha → **"Reingresar"**.
3. Indicá fecha de reingreso.
4. El sistema crea un nuevo período en `empleados_periodos_laborales` y conserva el histórico anterior.
5. **NO se pierden** sus datos: amonestaciones previas, eventos RRHH, prestaciones acumuladas se muestran en el histórico (pero los acumulados de prestaciones nuevos se calculan desde la fecha de reingreso).

---

## 8. Retiro / liquidación de un empleado

### Pasos
1. En la ficha del empleado, click **"Retirar"**.
2. Indicá:
   - **Fecha de retiro**.
   - **Motivo**: renuncia, despido justificado, despido injustificado, fin de contrato, jubilación, fallecimiento.
3. El sistema:
   - Cierra el período laboral activo.
   - Libera todos sus puestos asignados.
   - Calcula automáticamente la **liquidación** (indemnización si aplica, aguinaldo proporcional, bono 14 proporcional, vacaciones no gozadas).
4. Andá a `/admin/rrhh/prestaciones` → buscá al empleado → **"Calcular liquidación"**.
5. Revisá el detalle. Generá el documento.
6. Marcá como **pagada** cuando se haga el depósito.

### Consideraciones legales
- **Indemnización**: solo si el despido es injustificado o si renuncia con más de 5 años (depende de configuración).
- **Periodo de prueba**: si está dentro del período, no hay indemnización.

---

## 9. Procesar la planilla quincenal

### Cronograma típico (quincena del 1 al 15)
- **Día 1-15**: operación normal, cierres diarios.
- **Día 16 (am)**: revisar que todos los días tengan cierre.
- **Día 16-17**: pre-planilla.
- **Día 18-19**: revisión y ajustes.
- **Día 20**: planilla cerrada y depósito.

### Pasos detallados

#### A) Verificar pre-requisitos
1. `/admin/operaciones/cierres`: confirmar que los 15 días del período estén **cerrados**.
2. `/admin/anticipos`: confirmar que las solicitudes pendientes estén resueltas.
3. `/admin/rrhh/eventos`: confirmar que no haya eventos sin clasificar.

#### B) Generar pre-planilla
1. Andá a `/admin/pre-planilla`.
2. Seleccioná el período.
3. Click **"Generar pre-planilla"**.
4. Esperá (puede tomar 1-2 minutos según volumen).

#### C) Revisar
1. Buscá empleados con totales atípicos (muy alto, muy bajo, en cero).
2. Para cada anomalía, click en el empleado → revisar línea por línea.
3. Si encontrás un error, ajustá en el módulo correspondiente:
   - Asignación incorrecta → Operaciones.
   - Falta mal marcada → Eventos RRHH.
   - Anticipo mal cargado → Anticipos.
4. **Re-generar pre-planilla** (los cambios se reflejan).

#### D) Cerrar pre-planilla
1. Cuando todo esté correcto, click **"Cerrar pre-planilla"**.
2. Confirmá. Queda inmutable.

#### E) Generar planilla oficial
1. Andá a `/admin/rrhh/planilla`.
2. Click **"Generar planilla del período X"**.
3. Exportá a Excel/PDF.
4. Firmas y depósito.
5. Marcá como **pagada**.

### ¿Qué hacer si…?
- **Después de cerrar encontrás un error**: necesitás generar una **planilla especial** de ajuste (pago adicional o descuento en próxima planilla). NO reabrir la planilla cerrada.
- **Bonificaciones especiales**: usá `/admin/rrhh/planillas-especiales`.

---

## 10. Generar planilla IGSS mensual

> **Cuándo**: dentro de los primeros 5 días hábiles del mes siguiente.

### Pasos
1. Andá a `/admin/rrhh/igss`.
2. Verificá que la **configuración patrono** esté completa (NIT, número patronal, centro de trabajo).
3. Seleccioná el mes.
4. Click **"Generar planilla IGSS"**.
5. El sistema calcula:
   - Aporte patronal (12.67%).
   - Aporte trabajador (4.83%).
   - Por cada centro de trabajo configurado (algunos clientes son patrono propio).
6. Exportá en formato compatible con SIPAR/IGSS.
7. Subí al portal IGSS y pagá.

### Libro de Salarios
- Se genera en paralelo: `/admin/rrhh/libro-salarios`.
- Requerido por el Ministerio de Trabajo.

---

## 11. Otorgar y registrar vacaciones

### Pasos
1. `/admin/rrhh/vacaciones`.
2. Buscá al empleado.
3. Verificá su **saldo** (15 días/año por antigüedad).
4. Click **"Otorgar vacaciones"**.
5. Indicá fechas (inicio y fin).
6. El sistema:
   - Descuenta del saldo.
   - Crea evento RRHH "vacaciones" → libera puesto en esas fechas.
   - Calcula **bono vacacional** (si aplica) en próxima planilla.
7. Imprimí el **comprobante de vacaciones** para firma del empleado.

### Si el empleado no quiere tomarlas
- No se pueden "guardar" indefinidamente. Por ley, el empleador debe forzar el goce dentro del año siguiente.

---

## 12. Asignar un anticipo

### Aprobar solicitud del kiosco
1. `/admin/anticipos`.
2. Tab **"Pendientes"**.
3. Click sobre la solicitud → revisar monto y motivo.
4. **Aprobar** o **Rechazar**.
5. Si aprobás, indicá:
   - Cuotas (cuántas quincenas).
   - Quincena de inicio del descuento.
6. El descuento se aplica automáticamente en próximas planillas.

### Crear manualmente
- Mismo flujo, click **"Nuevo anticipo"** en lugar de aprobar pendiente.

---

## 13. Atender una Solicitud de Servicio (SSA)

> **Cuándo**: un cliente pide un servicio especial (refuerzo, evento, custodia puntual).

### Pasos
1. La SSA llega al `/admin/tablero-servicios` con etapa **"Recibida"**.
2. Click sobre la tarjeta → revisá detalles (cliente, fecha, ubicación, cantidad de agentes, requisitos).
3. **Asignar agentes**:
   - Filtrá guardias disponibles (no asignados ese día, sin restricciones).
   - Seleccioná los necesarios.
4. Cambiá la etapa a **"Asignada"**.
5. Confirmá con cliente (llamada/WhatsApp).
6. Cambiá etapa a **"Confirmada"**.
7. **Día del servicio**: cambiá a **"En curso"**.
8. **Después**: **"Finalizada"**.
9. Si se cancela: **"Cancelada"** con motivo.

### Consecuencias
- Los agentes asignados aparecen en el pizarrón del día.
- La SSA queda visible en el panel "Servicios Especiales Activos" del pizarrón.
- Al finalizar, los agentes vuelven a estar disponibles.

---

## 14. Asignar un arma a un puesto

### Pasos
1. `/admin/armeria`.
2. Buscá el arma (debe estar **disponible**).
3. Click → **"Asignar"**.
4. Seleccioná **puesto operativo**.
5. Indicá:
   - Munición entregada (cantidad).
   - Fecha y hora de entrega.
6. El sistema:
   - Marca el arma como **asignada**.
   - Crea **orden de servicio** (`arma_ordenes_servicio`).
   - Actualiza `puesto_municion`.

### Devolución
- Mismo flujo, click **"Devolver"**.
- Indicá munición devuelta. La diferencia queda como **gasto** o **discrepancia**.

---

## 15. Renovar portación / DIGECAM

> **Cuándo**: el sistema alerta cuando faltan 30 días para el vencimiento.

### Pasos
1. `/admin/armeria` → tab **"Vencimientos"**.
2. Click sobre el arma alertada.
3. Realizá el trámite externo en DIGECAM.
4. Volvé al sistema y actualizá:
   - Nueva fecha de emisión.
   - Nuevo vencimiento.
5. Subí el documento escaneado (opcional).

---

## 16. Activar un puesto QR para fichaje

### Pasos
1. `/admin/operaciones` → click sobre el puesto.
2. **"QR de fichaje"** → **"Generar / Imprimir"**.
3. El sistema genera un código QR único con token rotatorio.
4. Imprimí en buena calidad y plastificá.
5. Pegalo en el puesto físico, en lugar visible y accesible.
6. El guardia escanea con `ispsa.net/agente` desde su celular para entrar/salir.

### Mantenimiento
- Si el QR se rompe o pierde: regenerá uno nuevo (el anterior queda inválido).
- El **token rota** automáticamente cada cierto tiempo (`agente_qr_tokens`).

---

## 17. Crear y operar una ronda QR

> **Cuándo**: necesitás que un guardia recorra zonas específicas durante su turno (rondas nocturnas).

### Configuración inicial
1. `/admin/control-operativo-qr` → tab **"Rondas QR"**.
2. **"Nueva ronda"** para un cliente.
3. Definí los **puntos QR** (ubicaciones a recorrer): ej. portón principal, parqueo, sótano.
4. Generá los QR para cada punto, imprimí y pegá en cada zona.
5. Configurá la **frecuencia** esperada (ej. cada 2 horas).

### Operación
- El guardia escanea los QR en orden con `ispsa.net/ronda`.
- El sistema registra timestamp y GPS.
- Si no escanea en el tiempo esperado → alerta automática.

### Reportería
- `/admin/control-operativo-qr` → tab **"Estadísticas"**.
- Métricas: % cumplimiento, tiempo promedio entre puntos, alertas generadas.

---

## 18. Alta de un cliente nuevo

### Pasos
1. `/admin/clientes` → **"Nuevo cliente"**.
2. Datos generales: razón social, NIT, dirección, teléfono, contacto principal.
3. **Sedes**: agregá cada ubicación operativa.
4. **Configuración IGSS**:
   - ¿Es patrono propio o usa nuestro número patronal?
   - Centro de trabajo, departamento, municipio.
5. **Tarifas**: configurá las tarifas de horas extras (si aplica) en `config_tarifa_he`.
6. **Contrato**: marcá si tiene período de prueba o no.
7. Guardar.

### Próximos pasos
- Crear puestos operativos (ver siguiente procedimiento).
- Asignar supervisor.
- Definir zonas operativas.

---

## 19. Apertura de un nuevo puesto operativo

### Pasos
1. `/admin/clientes/:id` → tab **"Puestos"**.
2. **"Nuevo puesto"**.
3. Datos:
   - Nombre del puesto (ej. "Garita 1", "Patrullaje 3").
   - Sede.
   - Zona operativa.
   - Dirección.
   - Cantidad de slots (cuántos guardias simultáneos).
   - Tipo de turno (24x24, 12x12, etc.).
   - Horario.
4. Asignar **titulares** (1 a 4 guardias que rotan).
5. Definir **fecha de inicio de ciclo** de cada titular (clave para calcular descansos).
6. Generar **QR de fichaje**.
7. (Opcional) Asignar **arma** y munición.
8. (Opcional) Configurar **rondas QR** si requiere.

---

## 20. Importación masiva de empleados

### Pasos
1. `/admin/importacion`.
2. Descargá la **plantilla Excel**.
3. Llená los datos respetando el formato (especial atención a fechas YYYY-MM-DD, DPI sin guiones, tipos de personal exactos).
4. Subí el archivo.
5. El sistema valida y muestra:
   - Filas válidas (verde).
   - Filas con error (rojo, con detalle).
6. Corregí los errores en el Excel y volvé a subir.
7. Cuando todo esté en verde, **"Confirmar importación"**.

### Recomendaciones
- Importá lotes de máximo 500 empleados.
- Hacé **backup de la BD** antes de importar volúmenes grandes.
- Probá primero con 5-10 registros para validar el formato.

---

## 21. Levantar amonestación

### Pasos
1. `/admin/rrhh/amonestaciones` → **"Nueva amonestación"**.
2. Buscá al empleado.
3. Seleccioná **motivo** (lista predefinida en `amonestacion_motivos`).
4. Tipo: **verbal**, **escrita** o **suspensión**.
5. Si es suspensión: indicá días.
6. Detallá el hecho (descripción + fecha del incidente).
7. Adjuntá evidencias (fotos, reportes).
8. Guardar.
9. El sistema **genera el acta automáticamente** (PDF descargable con datos de la empresa de `config_empresa`).
10. Imprimí, firmá con el empleado, archivá.
11. Subí copia firmada al sistema.

### Si el empleado pide modificar
- Crea una **solicitud de modificación** en el sistema.
- RRHH revisa y aprueba/rechaza con comentarios.
- Queda histórico en `amonestacion_solicitudes_modificacion`.

---

## Apéndice: Calendario operativo recomendado

| Frecuencia | Tarea |
|------------|-------|
| **Diario** | Cierre operativo del día |
| **Diario** | Revisar alertas RRHH |
| **Semanal (lunes)** | Revisar SSA pendientes y planificación de la semana |
| **Semanal** | Revisar vencimientos de portación / DIGECAM |
| **Quincenal** | Pre-planilla → Planilla → Pago |
| **Mensual (día 1-5)** | Planilla IGSS + Libro de Salarios |
| **Mensual** | Revisar período de prueba próximos a vencer |
| **Anual** | Cálculo de bono 14 (junio) |
| **Anual** | Cálculo de aguinaldo (diciembre) |
| **Anual** | Revisión de saldos de vacaciones |
