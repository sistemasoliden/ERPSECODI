// backend/routes/ventasRoutes.js
import express from "express";
import {
  listVentas,
  createVenta,
  updateVenta,
  deleteVenta,
  duplicateVentas,
  getGraficoLineas,
  getDistribucionPorEstado,
  getDistribucionTipoVenta,
  getDistribucionPDV,
  getYearsActivacion,
  getMonthsActivacion,
  exportVentas,
  getComparativa,
  getMesVsYTD,
  getVentasPorProducto,
  getVentasPorConsultor
} from "../controllers/ventaController.js";

const router = express.Router();

/* ---------- REST principal ---------- */
router.get("/", listVentas);             // GET    /api/ventas
router.post("/", createVenta);           // POST   /api/ventas
router.put("/:id", updateVenta);         // PUT    /api/ventas/:id
// backend/routes/ventasRoutes.js
router.delete("/:id", deleteVenta);    // 1 solo
router.delete("/", deleteVenta);       // batch con query ?ids=

router.post("/duplicate", duplicateVentas); // POST /api/ventas/duplicate

/* ---------- utilitarios filtros ---------- */
router.get("/activacion/years", getYearsActivacion);   // GET /api/ventas/activacion/years
router.get("/activacion/months", getMonthsActivacion); // GET /api/ventas/activacion/months

/* ---------- analítica / gráficos ---------- */
router.get("/graficolineas", getGraficoLineas);                     // GET /api/ventas/graficolineas
router.get("/distribucion-estado", getDistribucionPorEstado);       // GET /api/ventas/distribucion-estado
router.get("/distribucion-tipo-venta", getDistribucionTipoVenta);   // GET /api/ventas/distribucion-tipo-venta
router.get("/distribucion-pdv", getDistribucionPDV);   

router.get("/export", exportVentas); // GET /api/ventas/export// GET /api/ventas/distribucion-pdv

// 📊 Comparativa (anual, mensual o trimestral)
router.get("/comparativa", getComparativa);

// 📊 Mes vs YTD con proyecciones
router.get("/mes-vs-ytd", getMesVsYTD);

router.get("/tablaproductos", getVentasPorProducto);
router.get("/tablaconsultores", getVentasPorConsultor);

export default router;
