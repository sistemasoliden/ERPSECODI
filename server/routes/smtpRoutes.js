// routes/smtpRoutes.js
import { Router } from "express";
import {
  loginSmtp, sessionStatus, logout, sendOne,
  getCredenciales, saveCredenciales, deleteCredenciales
} from "../controllers/smtpController.js";

import { getStats } from "../controllers/smtpStatsController.js";
import { verifyToken } from "../middlewares/auth.js"; // debe setear req.user

const router = Router();

// existentes
router.post("/auth/smtp/login", verifyToken, loginSmtp);
router.get("/auth/smtp/status", verifyToken, sessionStatus);
router.post("/auth/logout", verifyToken, logout);
router.post("/send", verifyToken, sendOne);

// nuevas credenciales persistentes en DB
router.get("/correos/me", verifyToken, getCredenciales);
router.post("/correos/me", verifyToken, saveCredenciales);
router.delete("/correos/me", verifyToken, deleteCredenciales);

router.get("/smtp/stats", verifyToken, getStats);

export default router;

