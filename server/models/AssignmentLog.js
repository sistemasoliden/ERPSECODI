// models/AssignmentLog.js
import mongoose from "mongoose";

const AssignmentLogSchema = new mongoose.Schema({
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: "AssignmentBatch", required: true },
  rucStr: { type: String, required: true },

  prevOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  newOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

  action: { 
    type: String, 
    enum: ["assign", "reassign", "no_change", "skip_conflict", "not_found"],
    required: true 
  },

  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("AssignmentLog", AssignmentLogSchema);
