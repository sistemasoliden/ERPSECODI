import mongoose from "mongoose";

const ventaSchema = new mongoose.Schema({}, { strict: false, collection: "ventas" });

export default mongoose.model("Venta", ventaSchema);
