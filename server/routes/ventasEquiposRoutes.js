// routes/ventasequipos.js
import express from "express";
import VentasEquipos from "../models/VentasEquipos.js";
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const data = await VentasEquipos.aggregate([
      {
        $addFields: {
          prioridad: {
            $cond: [
              { $regexMatch: { input: "$name", regex: /chip/i } }, // si contiene "CHIP"
              0, // prioridad más alta
              1, // el resto
            ],
          },
        },
      },
      { $sort: { prioridad: 1, name: 1 } }, // primero CHIP, luego alfabético
      { $project: { prioridad: 0 } }, // opcional: quitar el campo auxiliar
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Error al cargar equipos" });
  }
});

export default router;
