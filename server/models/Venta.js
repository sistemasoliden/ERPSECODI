import mongoose from "mongoose";

const VentaSchema = new mongoose.Schema({}, { strict: false, collection: "ventas" });

export default mongoose.model("Venta", VentaSchema);
