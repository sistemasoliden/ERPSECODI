import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import { distribucionPorEjecutivoCitas } from "../controllers/reportes.citassupervisor.js";

const router = Router();

// Bajo /api/reportes
router.get("/citas/por-ejecutivo", verifyToken, distribucionPorEjecutivoCitas);

export default router;
