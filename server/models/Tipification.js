import mongoose from "mongoose";

const TipificationSchema = new mongoose.Schema(
  {
    categorytip: { type: String, required: true, trim: true }, // p.e. "CONTACTO EXITOSO"
  },
  { timestamps: true , collection: "tipificaciones" }
);

export default mongoose.model("Tipification", TipificationSchema);
