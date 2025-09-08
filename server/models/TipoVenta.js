// models/TipoVenta.js
import mongoose from "mongoose";

const TipoVentaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
  },
  { timestamps: true, collection: "tiposventas" }
);

export default mongoose.model("TipoVenta", TipoVentaSchema);
