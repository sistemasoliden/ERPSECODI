import { Router } from "express";
import { listarEstados } from "../controllers/estadosUsuarioController.js";
import { verifyToken } from "../middlewares/auth.js";
const router = Router();
router.get("/", verifyToken, listarEstados);
export default router;