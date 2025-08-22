import mongoose from "mongoose";

const EstadoUsuarioSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true }, // ej: "Activo"
    descripcion: { type: String, trim: true }
  },
  { timestamps: true, collection: "estadousuario" }
);

export default mongoose.models.estadousuario
  || mongoose.model("estadousuario", EstadoUsuarioSchema);
