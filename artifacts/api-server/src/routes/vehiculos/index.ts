import { Router } from "express";
import { vehiculosBaseRouter } from "./base";
import { vehiculosCustodiaRouter } from "./custodia";

export const vehiculosRouter = Router();
vehiculosRouter.use(vehiculosBaseRouter);
vehiculosRouter.use(vehiculosCustodiaRouter);
