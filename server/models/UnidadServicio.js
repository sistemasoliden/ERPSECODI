// models/UnidadServicio.js
import mongoose from "mongoose";

const UnidadServicioSchema = new mongoose.Schema(
  {
    ruc: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BaseSecodi",
      required: true,
      index: true,
    },
    phoneNumber: { type: String, default: "" },      // 51963320539
    equipmentType: { type: String, default: "" },    // Smart
    contractDate: { type: Date },
    statusDate: { type: Date },
    plan: { type: String, default: "" },             // Empresa Plus 37.90
    status: { type: String, default: "" },           // Active
    lastDate: { type: Date },
  },
  { timestamps: true, collection: "unidadesyservicios" } // 👈 nombre exacto de la colección
);

export default mongoose.model("UnidadServicio", UnidadServicioSchema);
