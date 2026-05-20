import { Router } from "express";
import { custodiasDashboardRouter } from "./dashboard";
import { custodiasClienteRouter } from "./cliente";
import { custodiasPoolRouter } from "./pool";
import { custodiasPlanificacionRouter } from "./planificacion";
import { custodiasRutasRouter } from "./rutas";

export const custodiasRouter = Router();
custodiasRouter.use(custodiasDashboardRouter);
custodiasRouter.use(custodiasClienteRouter);
custodiasRouter.use(custodiasPoolRouter);
custodiasRouter.use(custodiasPlanificacionRouter);
custodiasRouter.use(custodiasRutasRouter);

export default custodiasRouter;
