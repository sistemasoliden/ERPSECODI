// routes/productosRoutes.js
import express from "express";
import Producto from "../models/Producto.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const productos = await Producto.find().lean();
    res.json(productos);
  } catch (err) {
    console.error("❌ Error al obtener productos:", err);
    res.status(500).json({ error: "Error al obtener productos" });
  }
});

export default router;
