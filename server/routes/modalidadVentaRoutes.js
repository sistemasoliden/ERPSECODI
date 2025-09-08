// routes/modalidadVentaRoutes.js
import express from "express";
import ModalidadVenta from "../models/ModalidadVenta.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const modalidades = await ModalidadVenta.find().lean();
    res.json(modalidades);
  } catch (err) {
    console.error("❌ Error al obtener modalidades de venta:", err);
    res.status(500).json({ error: "Error al obtener modalidades de venta" });
  }
});

export default router;
