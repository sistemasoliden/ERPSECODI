// models/ModalidadVenta.js
import mongoose from "mongoose";

const ModalidadVentaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
  },
  { timestamps: true, collection: "modalidadventa" }
);

export default mongoose.model("ModalidadVenta", ModalidadVentaSchema);
