import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import { listContactTypes } from "../controllers/contactTypeController.js";

const router = Router();

// GET /api/contact-types
router.get("/", verifyToken, listContactTypes);

export default router;
