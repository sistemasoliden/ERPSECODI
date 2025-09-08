import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import {
  createOpportunity,
  listMyOpportunities,
  updateEstado,
  listTipos,
} from "../controllers/opportunityController.js";

const router = Router();

router.post("/", verifyToken, createOpportunity);
router.get("/", verifyToken, listMyOpportunities);
router.patch("/:id/estado", verifyToken, updateEstado);

// Listar tipos para el dropdown en frontend
router.get("/tipos/all", verifyToken, listTipos);

export default router;
