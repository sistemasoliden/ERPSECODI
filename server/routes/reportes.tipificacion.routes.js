import { Router } from "express";
import { serieTipificacion, distribucionTipificacion } from "../controllers/reportes.tipificacion.js";
import { verifyToken } from "../middlewares/auth.js"; // o el middleware que uses

const router = Router();

router.get("/tipificacion/serie", verifyToken, serieTipificacion);
router.get("/tipificacion/distribucion", verifyToken, distribucionTipificacion);

export default router;
