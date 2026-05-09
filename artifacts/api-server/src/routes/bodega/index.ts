import { Router } from "express";
import { dashboardRouter } from "./dashboard";
import { categoriasRouter } from "./categorias";
import { articulosRouter } from "./articulos";
import { unidadesRouter } from "./unidades";
import { movimientosRouter } from "./movimientos";
import { stockRouter } from "./stock";

export const bodegaRouter = Router();
bodegaRouter.use(dashboardRouter);
bodegaRouter.use(categoriasRouter);
bodegaRouter.use(articulosRouter);
bodegaRouter.use(unidadesRouter);
bodegaRouter.use(movimientosRouter);
bodegaRouter.use(stockRouter);
