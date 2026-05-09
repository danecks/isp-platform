// Schema dividido por dominio (Fase 0 — refactor de fundaciones).
//
// Cada archivo agrupa las tablas Drizzle, esquemas Zod y tipos TypeScript de
// un dominio del negocio. El archivo `isp.ts` permanece como barrel
// retrocompatible para no romper imports existentes.
//
// Dominios:
//   - usuarios.ts    → cuentas/login (users)
//   - clientes.ts    → clientes operativos, alias, puestos
//   - rrhh.ts        → empleados, anticipos, plantillas de contrato
//   - operaciones.ts → incidencias, asignaciones, tareas, evidencias, log WA
//   - comercial.ts   → leads, postulaciones (applications)
//   - whatsapp.ts    → configuración / mensajes / menús del bot WA
//
// Las tablas de Armería, Vehículos, Bodega, Custodias, etc. NO viven aquí: se
// crean dinámicamente con CREATE TABLE IF NOT EXISTS desde
// `artifacts/api-server/src/lib/auto-seed.ts` y aún no tienen definición
// Drizzle. Se documenta en `docs/auditoria-sistema.md` para futura migración.

export * from "./usuarios";
export * from "./clientes";
export * from "./rrhh";
export * from "./operaciones";
export * from "./comercial";
export * from "./whatsapp";
