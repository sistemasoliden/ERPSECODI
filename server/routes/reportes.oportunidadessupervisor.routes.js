// routes/reportes.oportunidades.supervisor.routes.js
import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import { distribucionPorEjecutivoOportunidades }
  from "../controllers/reportes.oportunidadessupervisor.js";

const router = Router();

// Bajo /api/reportes
// Barras y miembros del equipo del supervisor autenticado
router.get(
  "/oportunidades/por-ejecutivo",
  verifyToken,
  distribucionPorEjecutivoOportunidades
);

export default router;
