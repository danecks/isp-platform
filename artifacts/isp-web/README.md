# Investigaciones y Seguridad Profesional S.A. — Web Corporativa

Sitio web corporativo profesional de **ISP S.A.**, empresa de seguridad privada en Guatemala.  
Construido con React + Vite + TypeScript + Tailwind CSS.

---

## Cómo correr el proyecto

Este proyecto forma parte de un monorepo pnpm. Desde la raíz del workspace:

```bash
# Instalar dependencias (solo la primera vez)
pnpm install

# Iniciar solo el servidor web
pnpm --filter @workspace/isp-web run dev
```

El sitio estará disponible en el servidor de Replit automáticamente en el preview.

---

## Estructura del proyecto

```
artifacts/isp-web/
├── public/
│   └── images/
│       └── logo-isp.jpg       ← Logo oficial de la empresa
├── src/
│   ├── pages/                 ← Cada página del sitio
│   │   ├── home.tsx           ← Página principal
│   │   ├── nosotros.tsx       ← Sobre la empresa
│   │   ├── sectores.tsx       ← Sectores que atiende
│   │   ├── reclutamiento.tsx  ← Formulario de aspirantes
│   │   ├── solicitar-servicio.tsx  ← Cotización para empresas
│   │   ├── contacto.tsx       ← Información y formulario de contacto
│   │   ├── acceso-clientes.tsx ← Portal de clientes (placeholder)
│   │   └── servicios/
│   │       ├── index.tsx      ← Lista de servicios
│   │       ├── seguridad-fisica.tsx
│   │       └── custodia-transporte.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx     ← Barra de navegación principal
│   │   │   ├── Footer.tsx     ← Pie de página
│   │   │   └── PageLayout.tsx ← Wrapper general de páginas
│   │   ├── animations/
│   │   │   └── FadeIn.tsx     ← Componente de animación de entrada
│   │   └── ui/                ← Componentes base (shadcn/ui)
│   ├── App.tsx                ← Rutas del sitio
│   ├── index.css              ← Paleta de colores y variables globales
│   └── main.tsx               ← Punto de entrada
└── docs/
    └── vision-plataforma.md   ← Visión estratégica del ecosistema digital
```

---

## Dónde editar los textos

| Qué cambiar | Dónde |
|-------------|-------|
| Textos del Hero (inicio) | `src/pages/home.tsx` |
| Estadísticas (+400 agentes, etc.) | `src/pages/home.tsx` — sección STATS |
| Misión y Visión | `src/pages/nosotros.tsx` |
| Descripción de servicios | `src/pages/servicios/index.tsx` y subdirectorios |
| Sectores atendidos | `src/pages/sectores.tsx` |
| Requisitos de reclutamiento | `src/pages/reclutamiento.tsx` |

---

## Dónde editar el branding

| Qué cambiar | Dónde |
|-------------|-------|
| **Logo** | Reemplazar `public/images/logo-isp.jpg` con el archivo de logo |
| **Nombre de la empresa** en navbar | `src/components/layout/Navbar.tsx` línea ~63 |
| **Nombre de la empresa** en footer | `src/components/layout/Footer.tsx` línea ~28 |
| **Colores (paleta)** | `src/index.css` — sección `:root` |
| **Color primario (dorado)** | `src/index.css` — variable `--primary` |
| **Tipografías** | `src/index.css` — variables `--app-font-sans` y `--app-font-display` |

---

## Dónde editar los datos de contacto

Buscar y reemplazar en los siguientes archivos:

| Dato | Archivo |
|------|---------|
| Teléfono (`+502 2200-0000`) | `src/components/layout/Footer.tsx` y `src/pages/contacto.tsx` |
| Correo (`contacto@isp-guatemala.com`) | `src/components/layout/Footer.tsx` y `src/pages/contacto.tsx` |
| WhatsApp (`50250000000`) | `src/pages/contacto.tsx`, `src/pages/acceso-clientes.tsx`, `src/pages/home.tsx` |
| Dirección | `src/components/layout/Footer.tsx` y `src/pages/contacto.tsx` |
| Licencia de operación | `src/components/layout/Footer.tsx` — sección bottom bar |

---

## Páginas y rutas

| Ruta | Página |
|------|--------|
| `/` | Home |
| `/nosotros` | Sobre ISP S.A. |
| `/servicios` | Todos los servicios |
| `/servicios/seguridad-fisica` | Servicio de seguridad física |
| `/servicios/custodia-transporte` | Custodia de transporte |
| `/sectores` | Sectores que atendemos |
| `/reclutamiento` | Formulario para aspirantes |
| `/solicitar-servicio` | Cotización para empresas |
| `/contacto` | Contacto |
| `/acceso-clientes` | Portal de clientes (placeholder + visión de plataforma) |

---

## Formularios

Los formularios actuales **no están conectados a un backend real**. Al enviar, muestran un mensaje de éxito (toast).

Para conectarlos, los formularios usan `react-hook-form` + `zod` y están listos para recibir un `onSubmit` que llame a un endpoint real.

**Formulario de reclutamiento** (`src/pages/reclutamiento.tsx`):
- Campos: nombre, DPI, teléfono, correo, municipio, experiencia, puesto, licencia DIGECAM, mensaje

**Formulario de cotización** (`src/pages/solicitar-servicio.tsx`):
- Campos: empresa, contacto, cargo, teléfono, correo, tipo de servicio, agentes estimados, descripción

---

## Qué partes están listas para la siguiente fase

| Componente | Estado | Siguiente paso |
|------------|--------|----------------|
| Web pública completa | ✅ Lista | — |
| Formularios (frontend) | ✅ Listos | Conectar a endpoint real en `api-server` |
| Backend Express | ✅ Existe | Agregar rutas para formularios |
| Base de datos PostgreSQL | ✅ Configurada | Crear tablas: leads, aplicaciones, incidencias |
| Autenticación | ⬜ Pendiente | Integrar Replit Auth para acceso al dashboard |
| Dashboard interno | ⬜ Pendiente | Nueva ruta `/dashboard` con acceso privado |
| Integración WhatsApp | ⬜ Pendiente | Configurar WhatsApp Business API + webhook |
| Integración Trello | ⬜ Pendiente | Configurar Trello API + sincronización de incidencias |

---

## Documentación adicional

- [`docs/vision-plataforma.md`](./docs/vision-plataforma.md) — Visión estratégica completa del ecosistema digital

---

## Tecnologías utilizadas

- **React 18** + **TypeScript**
- **Vite** (build tool)
- **Tailwind CSS v4** (estilos)
- **Wouter** (routing)
- **shadcn/ui** (componentes de UI)
- **react-hook-form** + **zod** (formularios y validación)
- **framer-motion** (animaciones)
- **lucide-react** (íconos)

---

*ISP S.A. — Investigaciones y Seguridad Profesional S.A. · Guatemala*
