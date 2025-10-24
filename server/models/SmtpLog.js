// models/SmtpLog.js
import mongoose from "mongoose";

const SmtpLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, index: true },
    date: { type: Date, default: () => new Date(), index: true },
    ok: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("SmtpLog", SmtpLogSchema);
