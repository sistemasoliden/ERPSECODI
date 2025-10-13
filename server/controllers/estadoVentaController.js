import EstadoVenta from "../models/EstadoVenta.js";

export async function listEstadosVenta(req, res) {
  try {
    const estados = await EstadoVenta.find().lean();
    res.json(estados);
  } catch (err) {
    console.error("❌ Error al obtener estados de venta:", err);
    res.status(500).json({ error: "Error al obtener estados de venta" });
  }
}
