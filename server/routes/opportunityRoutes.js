// routes/oportunidadesRoutes.js
import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import {
  createOpportunity,
  listMyOpportunities,
  updateEstado,
  listTipos,             // ← tipos de etapa (pipeline simple)
  updateCamposBasicos , // ← NUEVO: actualiza monto/cantidad/tipo/producto/notas
reportPorTipoVentaResumen,
listOpportunitiesSupervisor,

} from "../controllers/opportunityController.js";

const router = Router();

// CRUD básico
router.post("/", verifyToken, createOpportunity);
router.get("/", verifyToken, listMyOpportunities);

// Actualizar campos básicos (guardar del modal)
router.put("/:id", verifyToken, updateCamposBasicos);   // ← ¡ojo! verifyToken (no requireAuth)

// Cambiar etapa
router.patch("/:id/estado", verifyToken, updateEstado);

// Tipos de ETAPA (para el StagePath, si los necesitas en el front)
router.get("/tipos/all", verifyToken, listTipos);
// routes/opportunityRoutes.js
router.get(
  "/reportes/por-tipo-venta-resumen",
  verifyToken,
  reportPorTipoVentaResumen
);

router.get("/supervisorop", verifyToken, listOpportunitiesSupervisor);



export default router;
