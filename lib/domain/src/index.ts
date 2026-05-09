// @workspace/domain — librería compartida de dominio (Fase 0).
//
// Reúne utilidades puras (sin dependencias de Express, React ni la BD)
// que pueden ser usadas tanto por el backend como por el frontend.
//
// Submódulos:
//   - dates       → helpers de fechas y zona horaria Guatemala
//   - turnos      → motor de cálculo de ciclos de turno (D1..Dn)
//   - types       → tipos comunes de dominio (estados, roles, prioridades)
//   - validators  → helpers Zod / validaciones reutilizables
//
// Las implementaciones extensas que hoy viven en
// `artifacts/api-server/src/lib/turno-calc.ts`, `semana-mes.ts`,
// `fecha-lunes.ts`, etc. se irán migrando aquí en fases posteriores.
export * from "./dates";
export * from "./turnos";
export * from "./types";
export * from "./validators";
