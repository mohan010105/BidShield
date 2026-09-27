import { Router, type IRouter } from "express";
import healthRouter from "./health";
import bidshieldRouter from "./bidshield";
import { aiRouter } from "./ai.js";
import { assistantRouter } from "./assistant.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/ai", aiRouter);
router.use("/assistant", assistantRouter);
router.use(bidshieldRouter);

export default router;

