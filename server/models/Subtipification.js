import mongoose from "mongoose";

const SubtipificationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // p.e. "CLIENTE INTERESADO"
    tipificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tipification",
      required: true,
      index: true,
    },
  },
  { timestamps: true, collection: "subtipificaciones" }
);

export default mongoose.model("Subtipification", SubtipificationSchema);
