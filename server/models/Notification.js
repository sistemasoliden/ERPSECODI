// server/models/Notification.js
import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["cita", "sistema", "oportunidad"], default: "sistema", index: true },
    title: { type: String, required: true },
    message: { type: String },
    data: { type: Object },    // payload (ids, ruc, etc.)
    scheduledAt: { type: Date }, // p.ej. fecha/hora de la cita
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

const Notification =
  mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);

export default Notification;
