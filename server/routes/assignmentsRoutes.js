import { Router } from "express";
import { tipificarLatest } from "../controllers/assignmentsController.js";
import { verifyToken, requireRoles, ROLES_IDS } from "../middlewares/auth.js"; // ← tu archivo

const router = Router();

// Puede tipificar: comercial, supervisor, gerencia, sistemas
router.post(
  "/tipificar-latest",
  verifyToken,
  requireRoles([
    ROLES_IDS.comercial,
    ROLES_IDS.supervisorcomercial,
    ROLES_IDS.gerencia,
    ROLES_IDS.sistemas,
  ]),
  tipificarLatest
);

export default router;
