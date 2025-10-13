// models/EmailTemplate.js
import mongoose from "mongoose";

const EmailTemplateSchema = new mongoose.Schema(
  {
    ownerEmail: { type: String, index: true, required: true }, // correo SMTP de la sesión
    name: { type: String, required: true },                    // nombre visible
    subject: { type: String, default: "" },
    body: { type: String, default: "" },                       // HTML o texto (con {{variables}})
    isGlobal: { type: Boolean, default: false },               // por si quieres plantillas globales
  },
  { timestamps: true }
);

EmailTemplateSchema.index({ ownerEmail: 1, name: 1 }, { unique: true });

export default mongoose.model("EmailTemplate", EmailTemplateSchema);
