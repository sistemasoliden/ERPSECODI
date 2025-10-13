import { Router } from "express";
import { listTipificaciones, listSubByTipificacion } from "../controllers/tipificacionesController.js";

const router = Router();
router.get("/tipostipificaciones", listTipificaciones);
router.get("/subtipificaciones/by-tipificacion/:tipificationId", listSubByTipificacion);
export default router;
