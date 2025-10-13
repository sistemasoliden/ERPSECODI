import { Router } from "express";
import SegmentoEmpresa from "../models/SegmentoEmpresa.js";

const router = Router();

// GET todos los segmentos
router.get("/", async (req, res) => {
  try {
    const segmentos = await SegmentoEmpresa.find().lean();
    res.json(segmentos);
  } catch (e) {
    res.status(500).json({ message: "Error obteniendo segmentos", error: e.message });
  }
});

// POST para crear un segmento nuevo (opcional, si lo necesitas)
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    const seg = new SegmentoEmpresa({ name });
    await seg.save();
    res.status(201).json(seg);
  } catch (e) {
    res.status(500).json({ message: "Error creando segmento", error: e.message });
  }
});

export default router;
