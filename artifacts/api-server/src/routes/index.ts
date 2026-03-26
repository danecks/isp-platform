import { Router, type IRouter } from "express";
import healthRouter from "./health";
import leadsRouter from "./leads";
import applicationsRouter from "./applications";
import incidentsRouter from "./incidents";

const router: IRouter = Router();

router.use(healthRouter);
router.use(leadsRouter);
router.use(applicationsRouter);
router.use(incidentsRouter);

export default router;
