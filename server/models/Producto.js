// models/Producto.js
import mongoose from "mongoose";

const ProductoSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
  },
  { timestamps: true, collection: "productos" }
);

export default mongoose.model("Producto", ProductoSchema);
