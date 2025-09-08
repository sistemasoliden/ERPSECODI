import express from "express";
import { listEstadosVenta } from "../controllers/estadoVentaController.js";

const router = express.Router();

// GET /api/estadosventa
router.get("/", listEstadosVenta);

export default router;
