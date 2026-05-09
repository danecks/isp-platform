/**
 * routes/employees — barrel
 *
 * El módulo histórico de ~2.3k líneas se dividió en submódulos por área
 * funcional (siguiendo el mismo patrón de routes/operaciones/*). Las URLs
 * y reglas de cálculo NO cambiaron; este archivo solo combina los
 * sub-routers en un único Router default exportado.
 *
 *   employees/_helpers.ts   → utilidades (snakeToCamel, lunesISO, …)
 *   employees/base.ts       → list, by-dpi, sync/status, GET/POST/PATCH /:id, periodos
 *   employees/kpi.ts        → /:id/kpi, /:id/disciplinary, /:id/rotation, /:id/anticipos
 *   employees/asignaciones.ts → /:id/asignaciones, /:id/operacion, /:id/historial-asignaciones,
 *                               /:id/asignacion-operativa (GET/PUT), /:id/titular-historico
 *   employees/estado.ts     → /:id/self-update, /:id/estado, /:id/renovar-suspension, /:id/reingreso
 *   employees/contratos.ts  → /:id/contratos (GET/POST), /:id/foto, /:id/foto-upload
 *   employees/descanso.ts   → /:id/user, /:id/descanso-semanal (GET/PUT/DELETE)
 */

import { Router } from "express";

import baseRouter from "./employees/base";
import kpiRouter from "./employees/kpi";
import asignacionesRouter from "./employees/asignaciones";
import estadoRouter from "./employees/estado";
import contratosRouter from "./employees/contratos";
import descansoRouter from "./employees/descanso";

const employeesRouter = Router();

// Las rutas con sufijo (/employees/:id/foo) no entran en conflicto con
// /employees/:id porque Express discrimina por nº de segmentos. Las rutas
// específicas que SÍ podrían chocar con /employees/:id (sync/status, by-dpi/:dpi)
// están en base.ts y se registran ahí en el orden correcto.
employeesRouter.use(kpiRouter);
employeesRouter.use(asignacionesRouter);
employeesRouter.use(estadoRouter);
employeesRouter.use(contratosRouter);
employeesRouter.use(descansoRouter);
employeesRouter.use(baseRouter);

export default employeesRouter;
