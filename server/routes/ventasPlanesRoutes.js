// routes/ventasPlanesRoutes.js
import { Router } from "express";
import VentasPlan from "../models/VentasPlan.js";

const router = Router();

// GET /api/ventas-planes  ->  [{ _id, name }]
router.get("/", async (_req, res) => {
  try {
    const docs = await VentasPlan.find({}, "_id name").sort({ name: 1 });
    res.json(docs);
  } catch (e) {
    res.status(500).json({ message: "Error obteniendo planes", error: e.message });
  }
});

export default router;
