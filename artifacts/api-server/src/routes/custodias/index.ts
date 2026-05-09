import { Router } from "express";
import { custodiasDashboardRouter } from "./dashboard";
import { custodiasClienteRouter } from "./cliente";
import { custodiasPoolRouter } from "./pool";

export const custodiasRouter = Router();
custodiasRouter.use(custodiasDashboardRouter);
custodiasRouter.use(custodiasClienteRouter);
custodiasRouter.use(custodiasPoolRouter);

export default custodiasRouter;
