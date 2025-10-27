import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import { distribucionPorEjecutivo, efectividadTipificacion} from "../controllers/reportes.tipificacionsupervisor.js";

const router = Router();

router.get("/tipificacion/por-ejecutivo", verifyToken, distribucionPorEjecutivo);
router.get("/tipificacion/efectividad", verifyToken, efectividadTipificacion);

export default router;
