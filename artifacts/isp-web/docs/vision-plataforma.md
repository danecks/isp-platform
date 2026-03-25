# Visión de Plataforma — Investigaciones y Seguridad Profesional S.A.

**Versión:** 1.0  
**Fecha:** 2024  
**Estado:** Documento de arquitectura estratégica

---

## Resumen Ejecutivo

La presencia digital de ISP S.A. no es solo una página web corporativa. Es la base tecnológica sobre la que se construirá un ecosistema digital completo que conectará la operación en campo con los clientes, el equipo directivo, los canales de comunicación y las herramientas de gestión.

Este documento describe los cuatro pilares del ecosistema digital planificado:

1. **Web pública corporativa** (ya construida)
2. **Dashboard interno de operaciones** (próxima fase)
3. **Canal WhatsApp integrado** (próxima fase)
4. **Seguimiento operativo con Trello** (próxima fase)

> El sistema de pagos, contabilidad, bancos e inventario que ya existe en ISP **no forma parte de este ecosistema**. Seguirá funcionando de forma independiente. Esta plataforma cubre la operación de campo, los clientes y el crecimiento comercial.

---

## 1. Web Pública Corporativa (Activa)

### Propósito
Presencia digital premium de la empresa, captación de clientes y reclutamiento de agentes.

### Páginas actuales
| Ruta | Función |
|------|---------|
| `/` | Home — propuesta de valor e imagen corporativa |
| `/nosotros` | Misión, visión y valores |
| `/servicios` | Vista general de servicios |
| `/servicios/seguridad-fisica` | Detalle de seguridad física |
| `/servicios/custodia-transporte` | Detalle de custodia de transporte |
| `/sectores` | Sectores que atiende la empresa |
| `/reclutamiento` | Formulario de aplicación para aspirantes |
| `/solicitar-servicio` | Formulario de cotización para empresas |
| `/contacto` | Información de contacto |
| `/acceso-clientes` | Placeholder del portal de clientes con visión de plataforma |

### Formularios activos (sin backend aún)
- **Reclutamiento**: nombre, DPI, teléfono, correo, municipio, experiencia, puesto, licencia DIGECAM
- **Solicitar servicio**: empresa, contacto, cargo, teléfono, correo, tipo de servicio, agentes estimados, detalles

### Preparación para crecer
- Arquitectura basada en componentes reutilizables (PageLayout, FadeIn, Navbar, Footer)
- Formularios con validación Zod listos para conectar a endpoint real
- Rutas planificadas para dashboard futuro
- Código limpio y sin dependencias innecesarias

---

## 2. Dashboard Interno de Operaciones (Fase 2)

### Propósito
Vista centralizada para el equipo directivo y supervisores de ISP. No es para clientes, es para uso interno.

### Módulos planificados

#### 2.1 Panel de Agentes
- Lista de agentes activos por zona y turno
- Estado de cada puesto: cubierto / descubierto / relevo pendiente
- Historial de asistencias y eventos por agente

#### 2.2 Gestión de Incidencias
- Registro de incidentes: tipo, fecha, hora, agente, cliente, descripción
- Estado del caso: abierto / en proceso / resuelto
- Asignación a supervisor responsable
- Tiempo de respuesta y cierre

#### 2.3 Control de Clientes (CRM básico)
- Ficha por cliente: empresa, contacto, servicios contratados, agentes asignados
- Historial de incidencias y reportes por cliente
- Seguimiento de vencimiento de contratos

#### 2.4 Leads Comerciales
- Registro de solicitudes de cotización recibidas (web, WhatsApp, referidos)
- Asignación a ejecutivo de cuenta
- Estado del lead: nuevo / en contacto / cotizado / ganado / perdido

#### 2.5 KPIs de Operación
- Incidentes por mes
- Tiempo promedio de respuesta
- Cobertura efectiva de puestos
- Tasa de retención de personal
- Satisfacción de clientes

#### 2.6 Reclutamiento Interno
- Aplicaciones recibidas por la web o WhatsApp
- Estado de cada candidato: recibido / en revisión / entrevista / aprobado / rechazado
- Historial de contrataciones

### Tecnología recomendada para Fase 2
- Backend: Express.js (ya existe la base en este proyecto)
- Base de datos: PostgreSQL con Drizzle ORM (ya configurado)
- Autenticación: Replit Auth (ya disponible en el monorepo)
- Frontend: React con la misma base visual que la web actual

---

## 3. Canal WhatsApp Integrado (Fase 2)

### Propósito
WhatsApp no será un sistema separado. Será un canal de entrada al sistema de ISP.

### Concepto
Cada mensaje recibido en el número de WhatsApp de ISP será clasificado automáticamente y registrado en el dashboard. El equipo de operaciones responde desde un solo lugar, sin perder trazabilidad.

### Flujos planificados

#### Incidente operativo
```
Cliente escribe por WhatsApp → Bot clasifica como "incidente" 
→ Se crea registro en sistema → Supervisor de zona recibe alerta 
→ Se activa protocolo de respuesta → Resolución documentada
```

#### Solicitud de cotización
```
Prospecto escribe por WhatsApp → Bot captura datos básicos (empresa, contacto, tipo de servicio)
→ Se crea lead en el CRM → Ejecutivo de cuenta asignado recibe notificación
→ Seguimiento hasta cierre
```

#### Aplicación de empleo
```
Aspirante envía mensaje por WhatsApp → Bot solicita nombre, DPI, puesto de interés
→ Pre-registro en módulo de reclutamiento → RRHH revisa perfil
```

#### Emergencia
```
Cliente o agente reporta emergencia → Clasificación automática como URGENTE
→ Alerta inmediata a supervisores disponibles → Respuesta en menos de X minutos
→ Documentación del evento
```

### Tecnología para esta integración
- **WhatsApp Business API** (Meta Cloud API o Twilio)
- **Webhook** que recibe mensajes y los envía al backend de ISP
- **Bot básico** para clasificación inicial y captura de datos
- **Interfaz de atención** dentro del dashboard para responder desde el sistema

### Estado actual
- El número de WhatsApp actual (\`+502 5XXX-XXXX\`) ya está en producción
- Los botones de WhatsApp en la web ya están configurados con el enlace directo
- La integración con el sistema es la siguiente fase de desarrollo

---

## 4. Seguimiento con Trello (Fase 2)

### Propósito
Las incidencias operativas y tareas internas se gestionarán en tableros de Trello sincronizados con el sistema de ISP.

### Flujo de sincronización

```
Incidente registrado en sistema 
→ API de Trello crea tarjeta en tablero "Incidencias Activas"
→ Tarjeta incluye: descripción, cliente, agente, urgencia, folio
→ Supervisor actualiza la tarjeta con avances
→ Al resolver: tarjeta se mueve a columna "Resuelto"
→ Sistema registra tiempo de resolución y cierra el caso
```

### Estructura de tableros planificada

| Tablero | Columnas |
|---------|----------|
| Incidencias Operativas | Por atender / En proceso / Escalado / Resuelto |
| Seguimiento de Leads | Nuevo / Contactado / Cotización enviada / Ganado / Perdido |
| Reclutamiento | Recibido / Revisión / Entrevista / Aprobado / Descartado |
| Operaciones Generales | Pendiente / En ejecución / Completado |

### Qué se necesita para la integración
- Cuenta de Trello de la empresa (o Workspace)
- API Key y Token de Trello
- Configuración de webhooks en el backend de ISP
- Mapeo de eventos del sistema a acciones de Trello

---

## 5. Sistema Administrativo Separado

> Este sistema existente **NO se modifica ni se integra en esta plataforma.**

El sistema de pagos, contabilidad, bancos e inventario seguirá funcionando de forma completamente independiente. No hay dependencia entre los dos sistemas.

Si en el futuro se desea integrar datos contables (ejemplo: estado de cuenta de un cliente), se evaluará una integración vía API o exportación de datos, pero no está en el alcance actual.

---

## 6. Hoja de Ruta

| Fase | Descripción | Estado |
|------|-------------|--------|
| **Fase 1** | Web pública corporativa completa | ✅ Completado |
| **Fase 2** | Backend + base de datos + autenticación | 🔄 Siguiente |
| **Fase 3** | Dashboard interno (incidencias, agentes, KPI) | 📋 Planificado |
| **Fase 4** | Formularios web conectados a backend real | 📋 Planificado |
| **Fase 5** | Integración WhatsApp Business API | 📋 Planificado |
| **Fase 6** | Sincronización con Trello | 📋 Planificado |
| **Fase 7** | Portal de clientes con login y reportes | 📋 Planificado |
| **Fase 8** | KPIs avanzados y visualización de datos | 🔮 Futuro |

---

## 7. Arquitectura Técnica Actual

```
workspace/ (monorepo pnpm)
├── artifacts/
│   ├── isp-web/          ← Web pública (React + Vite + Tailwind)
│   │   ├── src/
│   │   │   ├── pages/    ← Páginas de la web
│   │   │   ├── components/layout/  ← Navbar, Footer, PageLayout
│   │   │   └── components/animations/  ← FadeIn
│   │   └── docs/         ← Esta documentación
│   └── api-server/       ← Backend Express (listo para Fase 2)
└── lib/
    ├── db/               ← PostgreSQL + Drizzle ORM (listo)
    ├── api-spec/         ← OpenAPI spec (listo)
    └── api-zod/          ← Validaciones Zod generadas
```

---

*Documento generado para uso interno de ISP S.A. — Actualizar conforme avance el desarrollo.*
