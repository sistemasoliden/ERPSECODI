import mongoose from "mongoose";
import UnidadServicio from "../models/UnidadServicio.js";

export async function listByBase(req, res) {
  try {
    const { baseId } = req.params;
    if (!mongoose.isValidObjectId(baseId)) {
      return res.status(400).json({ message: "baseId inválido" });
    }

    const items = await UnidadServicio.find({ ruc: baseId })
      .sort({ updatedAt: -1 })
      .lean();

    return res.json(items);
  } catch (err) {
    console.error("[unidades.byBase]", err);
    return res.status(500).json({ message: "Error cargando unidades" });
  }
}
