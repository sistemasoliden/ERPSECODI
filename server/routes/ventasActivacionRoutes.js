// backend/routes/ventasActivacionRoutes.js
import { Router } from "express";
import { getActivationYears, getActivationMonths } from "../controllers/ventaActivacionController.js";

const router = Router();

router.get("/activacion/years", getActivationYears);
router.get("/activacion/months", getActivationMonths);

export default router;
