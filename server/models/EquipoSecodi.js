import mongoose from "mongoose";

const equipoSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  supervisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  createdAt: { type: Date, default: Date.now },
});

const EquipoSecodi =
  mongoose.models.EquipoSecodi ||
  mongoose.model("EquipoSecodi", equipoSchema, "equipossecodi");

export default EquipoSecodi;
