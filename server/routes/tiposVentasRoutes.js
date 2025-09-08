// routes/tiposVentasRoutes.js
import express from "express";
import TipoVenta from "../models/TipoVenta.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const tipos = await TipoVenta.find().lean();
    res.json(tipos);
  } catch (err) {
    console.error("❌ Error al obtener tipos de venta:", err);
    res.status(500).json({ error: "Error al obtener tipos de venta" });
  }
});

export default router;
