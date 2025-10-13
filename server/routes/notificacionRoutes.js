// server/routes/notificacionRoutes.js
import { Router } from "express";
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
} from "../controllers/notificationController.js";
import { verifyToken } from "../middlewares/auth.js";

const router = Router();

router.get("/", verifyToken, listNotifications);
router.patch("/:id/read", verifyToken, markAsRead);
router.post("/read-all", verifyToken, markAllAsRead);

export default router;
