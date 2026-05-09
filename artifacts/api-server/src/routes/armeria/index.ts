import { Router } from "express";
import { armasRouter } from "./armas";
import { sugerenciasRouter } from "./sugerencias";
import { estadoOperativoRouter } from "./estado-operativo";
import { digecamRouter } from "./digecam";
import { reportesArmeriaRouter } from "./reportes";

export const armeriaRouter = Router();
armeriaRouter.use(estadoOperativoRouter);
armeriaRouter.use(armasRouter);
armeriaRouter.use(sugerenciasRouter);
armeriaRouter.use(digecamRouter);
armeriaRouter.use(reportesArmeriaRouter);
