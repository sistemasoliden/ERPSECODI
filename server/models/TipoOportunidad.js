import mongoose from "mongoose";

const TipoOportunidadSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true, unique: true },
  },
  { timestamps: true, collection: "tipooportunidades" }
);

export default mongoose.model("TipoOportunidad", TipoOportunidadSchema);
