// routes/smtpRoutes.js
import { Router } from "express";
import { loginSmtp, sessionStatus, logout, sendOne } from "../controllers/smtpController.js";

const router = Router();

// mantiene los mismos paths
router.post("/auth/smtp/login", loginSmtp);
router.get("/auth/smtp/status", sessionStatus);
router.post("/auth/logout", logout);

router.post("/send", sendOne);

export default router;
