import mongoose from "mongoose";

const RolUsuarioSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },   // ej: "sistemas"
    slug:   { type: String, trim: true }                     // ej: "sistemas"
  },
  { timestamps: true, collection: "rolesusuarios" }
);

// 👇 IMPORTANTE: el nombre del modelo DEBE ser 'rolesusuarios' para coincidir con el ref
export default mongoose.models.rolesusuarios
  || mongoose.model("rolesusuarios", RolUsuarioSchema);
