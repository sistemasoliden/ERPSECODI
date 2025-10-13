// routes/reportes.citas.routes.js
import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import { serieCitas, distribucionCitas } from "../controllers/reportes.citas.js";

const router = Router();

// Bajo /api/reportes
router.get("/citas/serie", verifyToken, serieCitas);
router.get("/citas/distribucion", verifyToken, distribucionCitas);

export default router;
