import mongoose from "mongoose";
import Tipification from "../models/Tipification.js";
import Subtipification from "../models/Subtipification.js";

const isOID = (v) => mongoose.isValidObjectId(v);

export async function listTipificaciones(_req, res) {
  try {
    const items = await Tipification.find().sort({ categorytip: 1 }).lean();
    res.json(items);
  } catch (err) {
    console.error("[tipificaciones.list]", err);
    res.status(500).json({ message: "Error cargando tipificaciones" });
  }
}

export async function listSubByTipificacion(req, res) {
  try {
    const { tipificationId } = req.params;
    if (!isOID(tipificationId))
      return res.status(400).json({ message: "tipificationId inválido" });
    const items = await Subtipification.find({ tipificationId })
      .sort({ name: 1 })
      .lean();
    res.json(items);
  } catch (err) {
    console.error("[subtipificaciones.byTip]", err);
    res.status(500).json({ message: "Error cargando subtipificaciones" });
  }
}
