import { Router, type IRouter } from "express";
import healthRouter from "./health";
import bidshieldRouter from "./bidshield";

const router: IRouter = Router();

router.use(healthRouter);
router.use(bidshieldRouter);

export default router;
