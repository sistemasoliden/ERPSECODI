import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import { serieOportunidades, distribucionOportunidades } from "../controllers/reportes.oportunidades.js";

const router = Router();

router.get("/oportunidades/serie", verifyToken, serieOportunidades);
router.get("/oportunidades/distribucion", verifyToken, distribucionOportunidades);

export default router; // ← ¡que sea export default!
