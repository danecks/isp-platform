# Manual de Usuario — ISP, S.A.

> Guía paso a paso para usar la plataforma. Pensada para personal operativo, RRHH, gerencia y supervisores.

---

## Índice

1. [Acceso al sistema](#1-acceso-al-sistema)
2. [Operaciones (Pizarrón)](#2-operaciones-pizarrón)
3. [Empleados](#3-empleados)
4. [RRHH — Eventos, Alertas y Amonestaciones](#4-rrhh--eventos-alertas-y-amonestaciones)
5. [Pre-planilla y Planilla](#5-pre-planilla-y-planilla)
6. [Anticipos](#6-anticipos)
7. [IGSS y Libro de Salarios](#7-igss-y-libro-de-salarios)
8. [Vacaciones](#8-vacaciones)
9. [Prestaciones laborales](#9-prestaciones-laborales)
10. [Armería](#10-armería)
11. [Bodega y Dotación](#11-bodega-y-dotación)
12. [Vehículos](#12-vehículos)
13. [Custodias y Barracas](#13-custodias-y-barracas)
14. [Clientes y Comercial](#14-clientes-y-comercial)
15. [Solicitudes de Servicio (SSA)](#15-solicitudes-de-servicio-ssa)
16. [Control en campo (QR, GPS, Rondas)](#16-control-en-campo-qr-gps-rondas)
17. [Kiosco de solicitudes](#17-kiosco-de-solicitudes)
18. [Reportes y KPIs](#18-reportes-y-kpis)
19. [Configuración: usuarios, permisos, WhatsApp, CMS](#19-configuración)
20. [Importación masiva](#20-importación-masiva)
21. [Portal del cliente](#21-portal-del-cliente)

---

## 1. Acceso al sistema

### Iniciar sesión
1. Abrí `ispsa.net/admin/login`.
2. Ingresá tu usuario y contraseña.
3. Resolvé el captcha si aparece (verificación de seguridad de Cloudflare).
4. Click en **"Ingresar al Sistema"**.

### ¿Qué hacer si…?
- **El captcha no carga**: revisá tu conexión, desactivá bloqueadores de anuncios y recargá con **Ctrl+Shift+R** (o **Cmd+Shift+R** en Mac).
- **Olvidaste tu contraseña**: contactá al administrador del sistema.
- **El sistema te bloqueó por intentos fallidos**: esperá 5 minutos. Hay un límite de 10 intentos cada 5 minutos por IP.

---

## 2. Operaciones (Pizarrón)

**Ruta**: `/admin/operaciones`

El pizarrón operativo es la vista en tiempo real de **todos los puestos cubiertos**, organizados por cliente. Es el corazón del día a día.

### Vista principal
- Cada **tarjeta de cliente** muestra sus puestos.
- Cada **puesto** muestra al guardia titular y su estado del día (trabaja / descansa / falta).
- Los colores indican el estado:
  - 🟢 Verde: trabajando hoy
  - 🔵 Azul: descanso de ciclo
  - 🟡 Amarillo: falta o ausencia
  - 🔴 Rojo: puesto sin cobertura

### Acciones comunes

#### Asignar un guardia a un puesto vacante
1. Ubicá el puesto vacío en la tarjeta del cliente.
2. Click en **"Asignar"** o el ícono de "+".
3. Elegí al guardia disponible de la lista.
4. Confirmá. El sistema registra el movimiento en histórico.

#### Sustituir un guardia (otro guardia cubre por él)
1. Click sobre el guardia titular del puesto.
2. Elegí **"Sustituir"**.
3. Seleccioná al guardia que cubrirá.
4. Indicá si la sustitución es por:
   - Falta del titular
   - Vacaciones
   - Hora extra
   - Otra razón
5. Confirmá.

#### Marcar una falta
1. Click sobre el guardia.
2. Elegí **"Marcar falta"**.
3. El sistema crea automáticamente un evento RRHH y libera el puesto.

#### Navegar entre fechas
- Usá los botones de **fecha** en la parte superior.
- Podés ver pizarrones pasados (modo solo lectura) o futuros (planificación).
- Vista futura permite **planificar cambios** que se aplican al llegar la fecha.

### Panel "Administración"
En la parte inferior del pizarrón, si tenés personal administrativo cargado, aparece un panel con: **Gerencia, RRHH, Bodega y Admin** (genérico), mostrando quién trabaja hoy.

> **Si no aparece**: significa que ningún empleado tiene asignado un tipo administrativo. Los tipos válidos que aparecen acá son: `gerencia`, `administrativo_rrhh`, `administrativo_bodega` y `administrativo` (genérico). Andá a Empleados y cambiá el tipo de personal a quienes correspondan. Lo ideal es usar el subtipo específico (RRHH/Bodega/Gerencia) para que queden agrupados por departamento; si no se conoce, queda en "Admin" general.

### Panel "Servicios Especiales Activos (SSA)"
Lista los servicios especiales en curso (custodias, eventos, refuerzos), con su etapa actual.

### ¿Qué hacer si…?
- **Un puesto no aparece**: verificá que esté **activo** en el módulo de Clientes → Ficha del Cliente → Puestos.
- **Un guardia no aparece como disponible**: revisá su estado laboral (debe estar "activo") y que tenga un turno asignado.
- **Necesitás cerrar el día**: ver [Procedimiento: Cierre operativo diario](./03-procedimientos-operativos.md#1-cierre-operativo-diario).

---

## 3. Empleados

**Ruta**: `/admin/empleados`

Lista completa del personal con filtros por cliente, supervisor, tipo de personal y búsqueda libre.

### Crear un nuevo empleado
1. Click en **"Nuevo empleado"**.
2. Completá los datos personales: nombre, DPI, teléfono, dirección.
3. Datos laborales:
   - **Tipo de personal**: guardia, supervisor, jefe de servicio, administrativo bodega, administrativo RRHH, gerencia.
   - **Estado laboral**: activo (por defecto).
   - **Frecuencia de pago**: quincenal, mensual.
   - **Fecha de inicio**.
4. Click **Guardar**.

### Editar un empleado
- Click sobre el nombre → se abre la ficha completa con tabs:
  - **Datos personales**
  - **Asignación operativa** (cliente, puesto, supervisor, zona)
  - **Historial de períodos laborales** (ingresos, retiros, reingresos)
  - **Eventos RRHH**
  - **Anticipos**
  - **Vacaciones**
  - **Documentos** (DPI, contratos)

### Cambiar tipo de personal
> **Importante**: cambiar a/desde administrativo, RRHH o gerencia requiere permiso especial. Si no podés, contactá a RRHH.

### Retirar / dar de baja
1. Abrí la ficha del empleado.
2. Click en **"Retirar"** o cambiá el estado a "retirado".
3. Indicá la fecha y motivo.
4. El sistema cierra su período laboral, libera puestos y calcula prestaciones.

### ¿Qué hacer si…?
- **Sale "DPI duplicado"**: ya existe un empleado con ese DPI. Buscalo en la lista; si fue retirado, podés hacer un **reingreso** desde su ficha.
- **No podés editar a un administrativo**: tu rol no tiene permiso. RRHH/Gerencia debe hacerlo.

---

## 4. RRHH — Eventos, Alertas y Amonestaciones

### 4.1 Eventos RRHH
**Ruta**: `/admin/rrhh/eventos`

Registro de todo lo que pasa con el personal: faltas, suspensiones, licencias, horas extras, retiros.

#### Crear un evento manualmente
1. Click **"Nuevo evento"**.
2. Buscá al empleado.
3. Tipo de evento: falta, suspensión, licencia médica, etc.
4. Fechas de inicio y fin.
5. Indicá si **descuenta** o **paga** en planilla.
6. Guardá.

> Muchos eventos se crean automáticamente desde Operaciones (faltas, sustituciones).

### 4.2 Alertas RRHH
**Ruta**: `/admin/rrhh/alertas`

Lista de alertas pendientes: vencimientos de contratos, períodos de prueba, novedades sin procesar. Click en una alerta para resolverla.

### 4.3 Amonestaciones
**Ruta**: `/admin/rrhh/amonestaciones`

#### Crear una amonestación
1. **"Nueva amonestación"**.
2. Empleado, fecha, motivo (lista predefinida: ausencia, mal uso de uniforme, etc.).
3. Tipo: verbal, escrita, suspensión.
4. Detalle del hecho.
5. Guardá. El sistema genera **acta automática** descargable.

#### Modificar / anular
Solo con permiso. Queda registro de quién y cuándo modificó.

---

## 5. Pre-planilla y Planilla

### 5.1 Pre-planilla
**Ruta**: `/admin/pre-planilla` o `/admin/rrhh/pre-planilla`

Es la **vista previa** del cálculo de planilla quincenal antes de cerrar.

#### Flujo
1. Seleccioná el período (quincena).
2. El sistema muestra a cada empleado con:
   - Días trabajados (calculados desde el pizarrón cerrado)
   - Horas extras
   - Bonificaciones
   - Descuentos (anticipos, IGSS, seguro, suspensiones)
   - Total a pagar
3. Revisá línea por línea. Si hay algo raro, click en el empleado para ver el detalle.
4. Cuando todo esté correcto, presioná **"Cerrar pre-planilla"**.

> **Solo se puede cerrar si todos los días del período tienen el pizarrón cerrado.**

### 5.2 Planilla oficial
**Ruta**: `/admin/rrhh/planilla` o `/admin/rrhh/nomina`

La planilla oficial se genera a partir de la pre-planilla cerrada.

1. Seleccioná el período.
2. **"Generar planilla"**.
3. Revisá totales. Exportá a Excel/PDF para firma.
4. Marcá como pagada cuando se haga el depósito.

### 5.3 Planillas especiales
**Ruta**: `/admin/rrhh/planillas-especiales`

Para pagos extraordinarios: bonos, aguinaldo, bono 14, indemnizaciones puntuales.

### ¿Qué hacer si…?
- **No puedo cerrar la pre-planilla**: revisá el mensaje de error. Generalmente es porque hay días sin cerrar en Operaciones → Cierres.
- **Un empleado tiene mal el cálculo**: editá el evento RRHH correspondiente o ajustá su asignación operativa.

---

## 6. Anticipos

**Ruta**: `/admin/anticipos`

### Solicitar un anticipo (manual)
1. **"Nuevo anticipo"**.
2. Empleado, monto, motivo.
3. **Cuotas**: en cuántas quincenas se descontará.
4. Guardá. Se descontará automáticamente de planilla.

### Solicitudes desde Kiosco
Los empleados pueden solicitar anticipos desde `ispsa.net/solicitar-anticipo`. Aparecen en la lista con estado **"pendiente"** hasta que un administrador apruebe o rechace.

### ¿Qué hacer si…?
- **Cancelar un anticipo en curso**: editalo y marcá las cuotas restantes como **canceladas**.

---

## 7. IGSS y Libro de Salarios

### 7.1 IGSS
**Ruta**: `/admin/rrhh/igss`

#### Generar planilla IGSS
1. Seleccioná el mes.
2. **"Generar planilla IGSS"**.
3. El sistema calcula aportes patronales y de trabajadores.
4. Exportá a formato IGSS para presentar.

#### Configuración
En la pestaña **Configuración Patrono**: NIT patronal, número patronal IGSS, centro de trabajo. Cada cliente puede tener su propio centro de trabajo (algunos clientes son "patrono" del IGSS).

### 7.2 Libro de Salarios
**Ruta**: `/admin/rrhh/libro-salarios`

Reporte oficial requerido por el Ministerio de Trabajo. Generá el libro mensual o anual y exportalo a PDF/Excel.

---

## 8. Vacaciones

**Ruta**: `/admin/rrhh/vacaciones`

Cada empleado tiene **saldo de vacaciones** acumulado por antigüedad (15 días/año por ley).

### Otorgar vacaciones
1. Buscá al empleado.
2. **"Otorgar vacaciones"**.
3. Fecha de inicio y fin (días hábiles consumidos).
4. Confirmá. Se descuenta del saldo y se libera el puesto.

### ¿Qué hacer si…?
- **El saldo no cuadra**: revisá los movimientos en la pestaña histórica. El cálculo es: días por antigüedad − días tomados.

---

## 9. Prestaciones laborales

**Ruta**: `/admin/rrhh/prestaciones`

Cuando un empleado se retira, se calculan automáticamente:
- **Indemnización** (si aplica)
- **Aguinaldo** proporcional
- **Bono 14** proporcional
- **Vacaciones** no gozadas

### Liquidar a un empleado retirado
1. Buscá al empleado.
2. **"Calcular liquidación"**.
3. Revisá el detalle.
4. Generá el documento oficial.
5. Marcá como **pagada** al hacer el depósito.

---

## 10. Armería

**Ruta**: `/admin/armeria`

Inventario y control de armas de fuego con datos DIGECAM.

### Registrar un arma
1. **"Nueva arma"**.
2. Datos: tipo, marca, modelo, calibre, serie.
3. **Datos DIGECAM**: número de licencia, fecha de emisión, vencimiento.
4. **Portación**: vencimiento de portación.
5. Guardá.

### Asignar arma a un puesto
1. Click en el arma → **"Asignar"**.
2. Seleccioná el puesto operativo.
3. Confirmá. El sistema crea **orden de servicio**.

### Munición
Cada puesto tiene un control de munición. Registrá entrada/salida desde la pestaña de **Munición** del puesto.

### ¿Qué hacer si…?
- **Vencimientos próximos**: el sistema te alerta. Renová la portación/licencia y actualizá las fechas.

---

## 11. Bodega y Dotación

**Ruta**: `/admin/bodega`

### Categorías y artículos
Cada artículo (uniforme, radio, etc.) tiene categoría, talla y stock.

### Movimientos de bodega
- **Entrada**: cuando llega mercadería.
- **Salida**: cuando se entrega a empleado o puesto.
- **Solicitudes**: pedidos formales que esperan aprobación.

### Kit de ingreso
Cuando entra un nuevo guardia, se le entrega un **kit de ingreso** (uniforme completo, radio, etc.). Se registra desde la ficha del empleado → **Dotación**.

### Órdenes de compra
Para reponer stock: creá una orden de compra, agregá ítems, marcá como recibida cuando llegue.

### Uniformes
Pestaña especial para gestionar entregas de uniforme con cuotas (descuento parcial al guardia en planilla).

---

## 12. Vehículos

**Ruta**: `/admin/vehiculos`

Registro de vehículos de la empresa (radiopatrullas, custodia, etc.).

### Acciones
- Alta de vehículo (placa, marca, modelo, año).
- Asignación a custodia / servicio.
- Mantenimientos.

---

## 13. Custodias y Barracas

### 13.1 Custodias
**Ruta**: `/admin/custodias`

Servicio especial de protección personal o de mercadería en tránsito.

#### Asignar custodia
1. **"Nueva custodia"**.
2. Cliente, fecha, ruta, vehículo.
3. Asignar agentes (titulares y refuerzos).
4. Guardar.

#### Regla: un agente, un puesto a la vez
El sistema **bloquea** la asignación de un agente cuando:
- **Ya está asignado** ese día a otro Custodio (de cualquier cliente). Mensaje: *"X ya está asignado al Custodio N de 'CLIENTE' en esta fecha. Liberá ese slot primero."*
- **Es titular activo** de otro Custodio del **mismo cliente**. Mensaje: *"X es titular del Custodio N de este cliente. No puede ocupar otro Custodio del mismo cliente — asignalo a su slot titular."*

Esto evita que un mismo agente aparezca duplicado en el pizarrón. En asignaciones masivas (lote), los agentes con conflicto se omiten y la respuesta lista los `skipped` con motivo.

### 13.2 Barracas
**Ruta**: `/admin/rrhh/barracas`

Habitaciones donde duerme el personal de turno largo.

- Crear barraca.
- Asignar empleados a una barraca por período.

---

## 14. Clientes y Comercial

### 14.1 Clientes
**Ruta**: `/admin/clientes`

Lista de todos los clientes activos. Click sobre uno → **Ficha del Cliente** con:
- Datos generales
- Sedes
- Puestos operativos
- Personal asignado
- Histórico de servicios
- Facturación

### 14.2 Comercial / Leads
**Ruta**: `/admin/comercial`

Pipeline de ventas. Cada lead tiene etapa (prospecto → cotización → negociación → cerrado/perdido).

### 14.3 Pipeline de servicios
**Ruta**: `/admin/pipeline-servicios`

Etapas de implementación de un servicio nuevo (post-venta).

---

## 15. Solicitudes de Servicio (SSA)

**Ruta**: `/admin/tablero-servicios`

Las **SSA** son servicios especiales solicitados por clientes (refuerzos, eventos, custodias puntuales).

### Flujo
1. Cliente solicita (vía portal o llamada).
2. Operaciones recibe la SSA con etapa **"recibida"**.
3. Asigna agentes → etapa **"asignada"**.
4. Confirma con cliente → etapa **"confirmada"**.
5. Ejecución → **"en curso"**.
6. Cierre → **"finalizada"** o **"cancelada"**.

### Tablero
Vista tipo Kanban con todas las SSA por etapa. Arrastrá entre columnas para cambiar etapa.

---

## 16. Control en campo (QR, GPS, Rondas)

### 16.1 Fichaje QR
**Ruta admin**: `/admin/control-operativo-qr`

Cada puesto tiene un **código QR único** (token rotatorio). El guardia escanea con `ispsa.net/agente` para marcar entrada/salida.

#### Imprimir QR de un puesto
1. Andá a Operaciones → Click en puesto → **"Generar QR"**.
2. Imprimí y pegalo en el puesto físico.

### 16.2 Rondas QR
**Ruta**: `/admin/control-operativo-qr` (tab Rondas)

Para rondas nocturnas: se colocan **puntos QR** en zonas a recorrer. El guardia los escanea en orden con `ispsa.net/ronda`.

#### Estadísticas
**Ruta**: en módulo de cliente → **Estadísticas de rondas** muestra cumplimiento por puesto/agente.

### 16.3 Recorridos GPS
Custodios y supervisores transmiten ubicación. Vista en mapa desde la ficha del cliente o del empleado.

### 16.4 App de Supervisor
Supervisores se activan en `ispsa.net/supervisor/activar` con su dispositivo. Pueden registrar visitas a puestos, novedades, formularios.

---

## 17. Kiosco de solicitudes

**Ruta admin**: `/admin/rrhh/kiosco-solicitudes`
**Ruta empleado**: `ispsa.net/kiosco`

Tablet ubicada en oficinas para que los empleados hagan trámites:
- **Constancia laboral**
- **Boleta de pago**
- **Solicitud de anticipo**
- **Solicitud de vacaciones**

Las solicitudes aparecen en el panel admin para imprimir/aprobar.

---

## 18. Reportes y KPIs

### 18.1 Dashboard
**Ruta**: `/admin/dashboard`

Vista ejecutiva: total de personal, puestos cubiertos, faltas del día, alertas.

### 18.2 KPI
**Ruta**: `/admin/kpi`

Indicadores clave: cobertura, rotación, ausentismo, productividad.

### 18.3 Reportes
**Ruta**: `/admin/reportes` y `/admin/reportes/cobertura-zonas`

Reportes exportables (Excel/PDF) por: cliente, zona, período, tipo de servicio.

### 18.4 Cierres histórico
**Ruta**: `/admin/operaciones/cierres`

Histórico de cierres operativos diarios.

### 18.5 Pizarrón histórico
**Ruta**: `/admin/operaciones/pizarron-historico`

Vista del pizarrón en cualquier fecha pasada (solo lectura).

---

## 19. Configuración

### 19.1 Usuarios
**Ruta**: `/admin/usuarios`

Crear cuentas con rol asignado. Cada rol tiene permisos por módulo.

### 19.2 Roles y permisos
Configurables. Ver pestaña en Usuarios o módulo de configuración avanzada.

### 19.3 WhatsApp
**Ruta**: `/admin/configuracion/whatsapp`

Configuración de la integración con WhatsApp Business: menú de opciones, mensajes automáticos, plantillas.

### 19.4 Simulador WhatsApp
**Ruta**: `/admin/simulador-whatsapp`

Probar el flujo de WhatsApp sin enviar mensajes reales.

### 19.5 CMS
**Ruta**: `/admin/cms`

Editor del contenido del sitio público (`ispsa.net`). Cambiá textos, imágenes, logos de clientes sin tocar código.

### 19.6 Modelo de datos
**Ruta**: `/admin/modelo-datos`

Vista interna de la estructura del sistema (uso técnico).

### 19.7 Solicitudes de eliminación
**Ruta**: `/admin/solicitudes-eliminacion`

Cuando alguien intenta borrar un registro crítico (empleado, cliente), se crea una solicitud que requiere aprobación.

---

## 20. Importación masiva

**Ruta**: `/admin/importacion`

Cargar empleados, puestos o clientes desde Excel.

1. Descargá la **plantilla**.
2. Llená los datos.
3. Subí el archivo.
4. El sistema valida y muestra errores antes de confirmar.
5. Confirmá la importación.

---

## 21. Portal del cliente

**Ruta**: `/portal/dashboard` (acceso con cuenta tipo cliente)

Vista limitada para clientes. Pueden ver:
- Sus puestos cubiertos hoy
- Incidencias reportadas
- Sus agentes asignados
- KPIs de su servicio
- Solicitudes de servicio adicional
- Cobertura, fichajes, rondas, recorridos GPS

---

## Soporte

Si encontrás un error, escribí a soporte indicando:
- Tu usuario y rol.
- Módulo y acción que intentabas.
- Captura de pantalla del error.
- Hora aproximada.
