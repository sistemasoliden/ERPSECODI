import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import { distribucionPorEjecutivo } from "../controllers/reportes.tipificacionsupervisor.js";

const router = Router();

router.get("/tipificacion/por-ejecutivo", verifyToken, distribucionPorEjecutivo);

export default router;
