// backend/routes/baseSecodi.routes.js
import { Router } from "express";
import {
  verifyToken,
  requireRoles,
  ensureTargetIsActiveCommercial,
  ROLES_IDS,
} from "../middlewares/auth.js";
import {
  getByRuc,
  search,
  listAssigned,
  getStats,
  findByRucs,
  assignRucs,
  listBatches,
  getBatchLogs,
  markTipificada,
  execDashboard,
  reassignOne,
} from "../controllers/baseSecodiController.js";

const router = Router();

// Público autenticado
router.get("/ruc/:ruc", verifyToken, getByRuc);
router.get("/search", verifyToken, search);
router.get("/assigned", verifyToken, listAssigned);
router.get("/stats", verifyToken, getStats);

// Previsualización y asignación
router.post("/by-rucs", verifyToken, findByRucs);
router.post(
  "/assign",
  verifyToken,
  requireRoles([
    ROLES_IDS.sistemas,
    ROLES_IDS.gerencia,
    ROLES_IDS.administracion,          // <-- antes decía backoffice
    ROLES_IDS.supervisorcomercial,
  ]),
  ensureTargetIsActiveCommercial,
  assignRucs
);

router.post("/mark-tipificada", verifyToken, markTipificada);

// Admin
router.get(
  "/admin/batches",
  verifyToken,
  requireRoles([ROLES_IDS.sistemas, ROLES_IDS.gerencia]),
  listBatches
);
router.get(
  "/admin/batch/:id/logs",
  verifyToken,
  requireRoles([ROLES_IDS.sistemas, ROLES_IDS.gerencia]),
  getBatchLogs
);

// Dashboard & Reasignación
router.get(
  "/exec-dashboard",
  verifyToken,
  requireRoles([
    ROLES_IDS.sistemas,
    ROLES_IDS.gerencia,
    ROLES_IDS.supervisorcomercial,     // <-- opcional pero recomendado
  ]),
  execDashboard
);

router.post(
  "/reassign-one",
  verifyToken,
  requireRoles([
    ROLES_IDS.sistemas,
    ROLES_IDS.gerencia,
    ROLES_IDS.supervisorcomercial,
  ]),
  reassignOne
);

export default router;
