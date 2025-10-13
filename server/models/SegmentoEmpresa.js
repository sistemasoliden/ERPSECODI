import mongoose from "mongoose";

const { Schema, model } = mongoose;

const SegmentoEmpresaSchema = new Schema(
  {
    name: { type: String, required: true },   // "Pyme", "Microempresa", etc.
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "segmentoempresa" } // 👈 nombre exacto de la colección
);

export default model("SegmentoEmpresa", SegmentoEmpresaSchema);
