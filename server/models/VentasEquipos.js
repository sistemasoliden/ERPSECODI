// models/ventasequipos.js
import mongoose from "mongoose";

const VentaEquipoSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    collection: "ventasequipos", // 👈 asegura que use tu colección exacta
    timestamps: true,           // opcional: agrega createdAt y updatedAt
  }
);

export default mongoose.model("VentasEquipos", VentaEquipoSchema);
