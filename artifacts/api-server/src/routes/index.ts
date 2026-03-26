import { Router, type IRouter } from "express";
import healthRouter from "./health";
import leadsRouter from "./leads";
import applicationsRouter from "./applications";
import incidentsRouter from "./incidents";
import usersRouter from "./users";
import employeesRouter from "./employees";
import portalRouter from "./portal";
import whatsappWebhookRouter from "./whatsapp-webhook";
import trelloRouter from "./trello";

const router: IRouter = Router();

router.use(healthRouter);
router.use(leadsRouter);
router.use(applicationsRouter);
router.use(incidentsRouter);
router.use(usersRouter);
router.use(employeesRouter);
router.use(portalRouter);
router.use(whatsappWebhookRouter);
router.use(trelloRouter);

export default router;
