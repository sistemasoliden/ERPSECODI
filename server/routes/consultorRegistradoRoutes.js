import { Router } from "express";
import ConsultorRegistrado from "../models/ConsultorRegistrado.js";

const router = Router();

// GET todos
router.get("/", async (req, res) => {
  try {
    const docs = await ConsultorRegistrado.find({}, { nombre: 1, fechaRegistro: 1 }).lean();
    res.json(docs);
  } catch (e) {
    res.status(500).json({ message: "Error leyendo consultores registrados", error: e.message });
  }
});

export default router;
