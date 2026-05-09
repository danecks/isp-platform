import { Router } from "express";
import tableroRouter from "./operaciones/tablero";
import poolRouter from "./operaciones/pool";
import asignacionRouter from "./operaciones/asignacion";
import puestosRouter from "./operaciones/puestos";
import custodiasAsignacionRouter from "./operaciones/custodias-asignacion";
import cierreRouter from "./operaciones/cierre";

const operacionesRouter = Router();

// Sub-routers (URL surface unchanged — every sub-router defines its own absolute paths)
operacionesRouter.use(tableroRouter);
operacionesRouter.use(poolRouter);
operacionesRouter.use(asignacionRouter);
operacionesRouter.use(puestosRouter);
operacionesRouter.use(custodiasAsignacionRouter);
operacionesRouter.use(cierreRouter);

export default operacionesRouter;
