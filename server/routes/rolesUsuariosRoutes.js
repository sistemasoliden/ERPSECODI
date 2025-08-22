import { Router } from "express";
import { listarRoles } from "../controllers/rolesUsuariosController.js";
import { verifyToken } from "../middlewares/auth.js";
const router = Router();
router.get("/", verifyToken, listarRoles);
export default router;