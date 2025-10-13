// models/VentasPlan.js
import { Schema, model } from "mongoose";

// Forzamos a usar la colección EXACTA "ventasplanes"
const VentasPlanSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
  },
  {
    collection: "ventasplanes",   // <-- evita pluralizaciones raras
    timestamps: true,
    versionKey: false,
  }
);

export default model("VentasPlan", VentasPlanSchema);
