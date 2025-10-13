import Estado from "../models/EstadoUsuario.js";
export const listarEstados = async (_req, res) => {
  try {
    const estados = await Estado.find().select("_id nombre").sort({ nombre: 1 }).lean();
    res.json(estados);
  } catch { res.status(500).json({ error: "Error listando estados" }); }
};