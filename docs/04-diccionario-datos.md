# Diccionario de Datos — ISP, S.A.

> Glosario completo de estados, tipos y conceptos del sistema. Referencia obligada para cualquier desarrollo o análisis.

---

## Índice

1. [Conceptos generales](#1-conceptos-generales)
2. [Empleado: tipos y estados](#2-empleado-tipos-y-estados)
3. [Operaciones: estados de puesto y ciclo](#3-operaciones-estados-de-puesto-y-ciclo)
4. [Eventos RRHH: tipos](#4-eventos-rrhh-tipos)
5. [Amonestaciones: tipos y motivos](#5-amonestaciones-tipos-y-motivos)
6. [Planilla: estados y conceptos](#6-planilla-estados-y-conceptos)
7. [SSA: etapas](#7-ssa-etapas)
8. [Solicitudes (cambios, eliminación, empleo): estados](#8-solicitudes-estados)
9. [Anticipos: estados](#9-anticipos-estados)
10. [Vacaciones: tipos de movimiento](#10-vacaciones-tipos-de-movimiento)
11. [Prestaciones: tipos](#11-prestaciones-tipos)
12. [Armería: estados y conceptos](#12-armería-estados-y-conceptos)
13. [Bodega: tipos de movimiento](#13-bodega-tipos-de-movimiento)
14. [Turnos y ciclos](#14-turnos-y-ciclos)
15. [Roles y permisos](#15-roles-y-permisos)
16. [Cliente: estados y conceptos](#16-cliente-estados-y-conceptos)
17. [Fichaje y QR](#17-fichaje-y-qr)
18. [WhatsApp: tipos de mensaje](#18-whatsapp-tipos-de-mensaje)

---

## 1. Conceptos generales

| Concepto | Significado |
|----------|-------------|
| **Pizarrón** | Vista en tiempo real del estado operativo del día (todos los puestos, sus guardias, novedades). |
| **Puesto operativo** | Posición fija en una sede de cliente que requiere cobertura 24/7 o por horario. Cada puesto tiene 1 a 4 guardias titulares que rotan. |
| **Slot** | Unidad horaria de cobertura dentro de un puesto. Algunos puestos tienen múltiples slots simultáneos. |
| **Titular** | Guardia asignado fijo a un puesto. Rota según su turno. |
| **Sustituto** | Guardia que cubre temporalmente por falta o vacaciones del titular. |
| **Cobertura** | Acto de cubrir un slot/puesto en una fecha específica. |
| **Cierre del día** | Acción que congela el día operativo y lo hace válido para planilla. |
| **Cliente** | Empresa que contrata servicios de seguridad. |
| **Sede** | Ubicación física específica de un cliente (puede tener varias). |
| **Zona operativa** | Agrupación geográfica de puestos bajo un supervisor. |
| **Período laboral** | Lapso continuo en que un empleado trabajó. Un empleado puede tener varios si reingresó. |

---

## 2. Empleado: tipos y estados

### Tipos de personal (`employees.tipo_personal`)

| Valor | Significado | Aparece en pizarrón |
|-------|-------------|---------------------|
| `guardia` | Personal operativo de seguridad estática (default). | Sí, en puestos. |
| `custodio` | Personal operativo de custodia/escolta de mercadería. | Sí, en custodias. |
| `supervisor` | Supervisor de zona, recorre puestos. | Sí, en panel supervisores. |
| `jefe_servicio` | Jefe de servicio, coordina supervisores. | Sí, en panel jefes. |
| `administrativo_bodega` | Personal de bodega. | Sí, en panel administración. |
| `administrativo_rrhh` | Personal de RRHH. | Sí, en panel administración. |
| `gerencia` | Gerentes, dirección. | Sí, en panel administración. |
| `administrativo` | Administrativo genérico (legacy). | No (categoría sin panel propio). |

### Estado laboral (`employees.estado_laboral`)

| Valor | Significado | Cobra planilla |
|-------|-------------|----------------|
| `activo` | Trabajando normalmente. | Sí. |
| `licencia` | Licencia médica o personal aprobada. | Solo si la licencia es pagada. |
| `suspendido` | Suspendido (disciplinario). | No, durante la suspensión. |
| `vacaciones` | En vacaciones (legales). | Sí. |
| `retirado` | Ya no trabaja en la empresa. | No. |
| `cesado` | Despido. | No. |

### Frecuencia de pago (`employees.frecuencia_pago`)

| Valor | Significado |
|-------|-------------|
| `quincenal` | Cobra cada 15 días (default para guardias). |
| `mensual` | Cobra mensual (default para administrativos/gerencia). |

### Tipo de cuenta (`employees.tipo_cuenta`)

| Valor | Significado |
|-------|-------------|
| `monetaria` | Cuenta corriente / cheques. |
| `ahorro` | Cuenta de ahorro. |

---

## 3. Operaciones: estados de puesto y ciclo

### Estado de ciclo (`estado_ciclo` calculado)

| Valor | Significado |
|-------|-------------|
| `trabajando` | El guardia trabaja hoy (le toca turno). |
| `descansando_ciclo` | El guardia tiene día de descanso por su ciclo de turno. |
| `licencia` | En licencia médica/personal. |
| `suspendido` | Suspendido. |
| `sin_turno` | No tiene turno asignado (no aplica cálculo). |

### Tipo de cobertura (`cobertura_segmentos.tipo_cobertura`)

| Valor | Significado |
|-------|-------------|
| `titular` | Cubierto por su titular asignado. |
| `sustitucion` | Cubierto por un sustituto. |
| `relevo` | Relevo planificado (cambio de titular en curso). |
| `vacante` | Puesto sin cobertura. |

### Tipo de movimiento operativo (`movimientos_operativos.tipo`)

| Valor | Significado |
|-------|-------------|
| `asignacion_pizarron` | Asignación manual desde el pizarrón. |
| `sustitucion_pizarron` | Sustitución manual desde el pizarrón. |
| `falta` | Marcada falta. |
| `liberacion_pizarron` | Liberación manual del puesto. |
| `falta_total` | Falta sin sustituto. |
| `cambio_titular` | Cambio definitivo de titular. |

### Estado de cierre operativo diario (`cierre_operativo_diario.estado`)

| Valor | Significado |
|-------|-------------|
| `abierto` | Día en curso, editable. |
| `cerrado` | Día cerrado, inmutable. |
| `reabierto` | Reabierto manualmente (queda en auditoría). |

---

## 4. Eventos RRHH: tipos

Tabla `eventos_rrhh.tipo`:

| Tipo | Descuenta planilla | Paga adicional |
|------|-------------------|----------------|
| `falta` | Sí (si injustificada). | No. |
| `falta_justificada` | No. | No. |
| `falta_diferida` | Pendiente de procesar. | — |
| `suspension` | Sí. | No. |
| `licencia_medica` | Variable según política. | No. |
| `licencia_personal` | Sí. | No. |
| `vacaciones` | No (se paga normal). | Bono vacacional opcional. |
| `hora_extra` | No. | Sí (HE). |
| `bonificacion` | No. | Sí. |
| `retiro` | Cierra período. | Liquidación. |
| `reingreso` | Abre período. | — |
| `amonestacion` | No. | No. |
| `acta` | No. | No. |
| `cambio_turno` | No. | No. |
| `cambio_asignacion` | No. | No. |

### Estado del evento (`eventos_rrhh.estado`)

| Valor | Significado |
|-------|-------------|
| `pendiente` | Recién creado, esperando procesamiento. |
| `aprobado` | Validado, se aplica en planilla. |
| `rechazado` | No aplica. |
| `procesado` | Ya impactó planilla. |

---

## 5. Amonestaciones: tipos y motivos

### Tipo (`amonestaciones.tipo`)

| Valor | Significado |
|-------|-------------|
| `verbal` | Llamada de atención sin documento físico. |
| `escrita` | Acta firmada. |
| `suspension` | Implica días sin goce de sueldo. |

### Motivos (`amonestacion_motivos.codigo`)

Tabla configurable. Ejemplos típicos:
- `ausencia_sin_aviso`
- `mal_uso_uniforme`
- `incumplimiento_orden`
- `dormir_en_servicio`
- `abandono_puesto`
- `consumo_alcohol`
- `agresion`
- `robo`
- `falta_respeto`
- `incumplimiento_ronda`

---

## 6. Planilla: estados y conceptos

### Estado de planilla (`planillas.estado`)

| Valor | Significado |
|-------|-------------|
| `borrador` | En construcción. |
| `cerrada` | Lista para pago. |
| `pagada` | Depositada. |
| `anulada` | Cancelada (queda histórico). |

### Estado de pre-planilla (`pre_planilla_cierres.estado`)

| Valor | Significado |
|-------|-------------|
| `abierta` | Editable. |
| `cerrada` | Lista para generar planilla oficial. |

### Conceptos de cálculo

| Concepto | Cálculo |
|----------|---------|
| **Salario base** | Salario diario × días trabajados. |
| **Bonificación 1** | Bonificación incentivo de Q.250 mensuales (Q.8.33 diarios) por ley. |
| **Bonificación 2** | Bonificación adicional configurable. |
| **Bonificación 3** | Bonificación variable (puede ser por desempeño). |
| **HE diurnas** | Tarifa configurada × horas. |
| **HE nocturnas** | HE diurna + recargo nocturno. |
| **Aporte IGSS trabajador** | 4.83% del salario ordinario (no incluye bonificación). |
| **Aporte IGSS patronal** | 12.67% del salario ordinario. |
| **Descuento anticipo** | Cuota configurada al asignar el anticipo. |
| **Descuento seguro de vida** | Configurado en `seguros_config`. |
| **Aguinaldo** | 1 mes de salario por cada año trabajado, pagado en diciembre. |
| **Bono 14** | 1 mes de salario por cada año trabajado, pagado en julio. |
| **Indemnización** | 1 mes de salario por cada año trabajado (si despido injustificado). |

---

## 7. SSA: etapas

`solicitudes_servicio_adicional.etapa`:

| Valor | Significado |
|-------|-------------|
| `recibida` | Cliente solicitó, sin asignar. |
| `analisis` | En revisión por operaciones. |
| `cotizacion` | Se está cotizando. |
| `asignada` | Agentes asignados. |
| `confirmada` | Cliente confirmó. |
| `en_curso` | Servicio ejecutándose. |
| `finalizada` | Completada exitosamente. |
| `cancelada` | Cancelada (por cliente o ISP). |

---

## 8. Solicitudes: estados

### Solicitudes de empleo (`solicitudes_empleo.estado`)

| Valor | Significado |
|-------|-------------|
| `recibida` | Recién enviada. |
| `en_revision` | RRHH revisando. |
| `entrevista` | Citado a entrevista. |
| `aprobada` | Aprobada para contratación. |
| `contratada` | Ya creada como empleado. |
| `rechazada` | No aplica. |
| `descartada` | Cerrada sin avanzar. |

### Canal (`solicitudes_empleo.canal`)
- `web` — desde el sitio público.
- `kiosco` — desde tablet en oficina.
- `whatsapp` — vía WhatsApp.
- `presencial` — alguien la cargó en sistema.
- `referido` — referencia de otro empleado.

### Solicitudes de cambio de turno (`solicitudes_cambio_turno.estado`)

| Valor | Significado |
|-------|-------------|
| `pendiente` | Esperando aprobación del supervisor. |
| `aprobada` | Aprobada y aplicada. |
| `rechazada` | No procede. |

### Solicitudes de eliminación (`solicitudes_eliminacion.estado`)

| Valor | Significado |
|-------|-------------|
| `pendiente` | Esperando aprobación de admin. |
| `aprobada` | Eliminación ejecutada. |
| `rechazada` | Eliminación denegada. |

---

## 9. Anticipos: estados

`anticipos.estado`:

| Valor | Significado |
|-------|-------------|
| `pendiente` | Solicitado, esperando aprobación. |
| `aprobado` | Aprobado, se va a descontar. |
| `descontando` | En proceso de descuento por cuotas. |
| `pagado` | Totalmente descontado. |
| `cancelado` | Cancelado (cuotas restantes liberadas). |
| `rechazado` | No aprobado. |

---

## 10. Vacaciones: tipos de movimiento

`vacaciones_movimientos.tipo`:

| Valor | Significado |
|-------|-------------|
| `acumulacion` | Suma de días por antigüedad (ej. cumple 1 año → +15 días). |
| `goce` | Días tomados de vacaciones. |
| `pago_no_gozadas` | Pago en liquidación de días no gozados. |
| `ajuste` | Corrección manual con justificación. |

---

## 11. Prestaciones: tipos

| Concepto | Significado |
|----------|-------------|
| **Indemnización** | Pago al despido injustificado. 1 mes por año trabajado. |
| **Aguinaldo** | Diciembre. 100% del salario / año. |
| **Bono 14** | Julio. 100% del salario / año. |
| **Vacaciones no gozadas** | Días pendientes al retiro pagados en efectivo. |
| **Prestaciones acumuladas** | Provisión mensual de cada concepto (`prestaciones_acumulados`). |
| **Liquidación** | Cálculo final al retirar a un empleado. |

---

## 12. Armería: estados y conceptos

### Estado del arma (`armas.estado`)

| Valor | Significado |
|-------|-------------|
| `disponible` | En bodega, sin asignar. |
| `asignada` | En un puesto operativo. |
| `mantenimiento` | En reparación. |
| `dada_de_baja` | Fuera de servicio. |
| `extraviada` | Reportada como perdida. |

### Conceptos DIGECAM
| Campo | Significado |
|-------|-------------|
| `licencia_digecam` | Número de licencia oficial. |
| `fecha_emision_portacion` | Cuándo se emitió la portación. |
| `vencimiento_portacion` | Cuándo expira (alerta a 30 días). |

---

## 13. Bodega: tipos de movimiento

`bodega_movimientos.tipo`:

| Valor | Significado |
|-------|-------------|
| `entrada` | Mercadería que llega. |
| `salida` | Entrega a empleado o puesto. |
| `devolucion` | Empleado devuelve equipo. |
| `traslado` | Movimiento entre bodegas (si hay varias). |
| `merma` | Pérdida o daño. |
| `ajuste` | Corrección de inventario. |

---

## 14. Turnos y ciclos

### Tipo de ciclo (`turnos.tipo_ciclo`)

| Valor | Significado |
|-------|-------------|
| `24x24` | 24 horas trabajo, 24 descanso. |
| `12x12` | 12 horas trabajo, 12 descanso. |
| `8x8` | 8 horas trabajo, 8 descanso. |
| `14_dias` | Ciclo de 14 días con descansos específicos. |
| `lun_vie` | Lunes a viernes (administrativos). |
| `lun_sab` | Lunes a sábado. |
| `personalizado` | Configuración manual por slot. |

### Conceptos
- **Fecha inicio de ciclo**: día desde el que se calcula el ciclo del guardia. Crítico para saber si trabaja o descansa hoy.
- **Slot**: ranura horaria del puesto. Algunos puestos tienen 2-3 slots simultáneos.

---

## 15. Roles y permisos

### Roles base (`system_roles.codigo`)

| Rol | Alcance |
|-----|---------|
| `superadmin` | Acceso total. |
| `admin` | Casi todo, sin destructivos críticos. |
| `gerencia` | Vista ejecutiva + aprobaciones. |
| `rrhh` | Empleados, planilla, IGSS, prestaciones, vacaciones. |
| `operaciones` | Pizarrón, asignaciones, SSA, cierres. |
| `jefe_servicio` | Operaciones limitada a su zona. |
| `supervisor` | Vista limitada a sus puestos. |
| `bodega` | Solo bodega y dotación. |
| `armeria` | Solo armería. |
| `comercial` | Leads y pipeline. |
| `cliente` | Portal del cliente, solo lectura de su servicio. |

### Permisos (`rol_permisos.permiso`)

Formato: `<modulo>.<accion>`.

Ejemplos:
- `empleados.ver`
- `empleados.crear`
- `empleados.editar`
- `empleados.eliminar`
- `planilla.cerrar`
- `operaciones.cerrar_dia`
- `operaciones.reabrir_dia`
- `armeria.asignar`
- `igss.generar`

---

## 16. Cliente: estados y conceptos

### Estado del cliente (`clients.estado`)

| Valor | Significado |
|-------|-------------|
| `activo` | Servicio en curso. |
| `inactivo` | Sin servicio actualmente. |
| `prospecto` | Aún no es cliente (lead). |
| `terminado` | Contrato finalizado. |

### Conceptos
- **Centro de trabajo IGSS**: cada cliente puede tener su propio número patronal IGSS o usar el de ISP.
- **Contrato sin prueba** (`contrato_sin_prueba`): si el cliente exige no aplicar período de prueba a guardias.
- **Tipo de servicio** (`tipo_servicio`): seguridad física, custodia, mixto.

---

## 17. Fichaje y QR

### Tipos de evento de fichaje (`agente_fichajes.tipo`)

| Valor | Significado |
|-------|-------------|
| `entrada` | Guardia llega al puesto. |
| `salida` | Guardia se va. |
| `relevo_inicio` | Inicio de relevo de equipo. |
| `relevo_fin` | Fin de relevo. |
| `ronda` | Punto de ronda escaneado. |
| `novedad` | Reportó novedad. |

### Estado de fichaje
- `valido` — registrado correctamente.
- `tarde` — llegó después del horario tolerado.
- `incompleto` — falta entrada o salida.
- `rechazado` — el sistema lo invalidó (QR fuera de tiempo o GPS lejano).

### QR rotatorio
- `agente_qr_tokens`: cada puesto tiene un token que rota cada cierto tiempo. Esto evita que se compartan fotos del QR.

---

## 18. WhatsApp: tipos de mensaje

`wa_messages.tipo`:

| Valor | Significado |
|-------|-------------|
| `entrante` | Recibido del usuario. |
| `saliente` | Enviado por el sistema. |
| `notificacion` | Notificación automática (recibo, alerta). |
| `respuesta_menu` | Respuesta a opción de menú. |
| `template` | Plantilla aprobada por Meta. |

### Estado de notificación (`wa_notificaciones_log.estado`)

| Valor | Significado |
|-------|-------------|
| `pendiente` | En cola para enviar. |
| `enviado` | Despachado a Meta. |
| `entregado` | Confirmado por WhatsApp. |
| `leido` | Usuario lo leyó. |
| `error` | Falló el envío. |

---

## Apéndice: convenciones de fechas

- **Hora local**: Guatemala (GMT-6, sin horario de verano).
- **Fecha operativa**: la fecha que aparece en el pizarrón puede no coincidir con la fecha calendario en madrugadas (ej. un turno 24x24 que arrancó ayer a las 18:00 sigue siendo "ayer" hasta hoy a las 18:00).
- **Inicio del día operativo**: configurable, por defecto 06:00 hrs.

## Apéndice: criterios de cálculo

- **Antigüedad**: se calcula desde `fecha_inicio_prestaciones` (puede ser distinta de `fecha_ingreso` si hubo reingreso con continuidad reconocida).
- **Días trabajados**: días donde el cierre operativo registró cobertura efectiva del guardia.
- **Días descontados**: faltas injustificadas + suspensiones + licencias no pagadas.
- **Bonificación incentivo Q.250**: prorrateada por días trabajados.

---

> **Cuándo actualizar este diccionario**: cada vez que agregues un nuevo estado, tipo, módulo o concepto. Es la única forma de evitar que el equipo se confunda con valores indocumentados.
