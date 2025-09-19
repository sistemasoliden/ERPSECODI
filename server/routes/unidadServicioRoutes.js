import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import { listByBase } from "../controllers/unidadServicioController.js";

const router = Router();

router.get("/by-base/:baseId", verifyToken, listByBase);

export default router;
