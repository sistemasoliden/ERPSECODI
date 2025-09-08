import mongoose from "mongoose";

const EstadoVentaSchema = new mongoose.Schema({
  nombre: { type: String, required: true }
}, { collection: "estadoventa" });

export default mongoose.model("EstadoVenta", EstadoVentaSchema);
