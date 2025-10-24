import mongoose from "mongoose";

const CorreoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, index: true, required: true },
  smtpEmail: { type: String, required: true },
  smtpPassword: { type: String, required: true }, // ⚠️ texto plano, a pedido
}, { timestamps: true });

export default mongoose.model("Correo", CorreoSchema);
