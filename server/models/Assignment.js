// backend/models/Assignment.js
import mongoose from "mongoose";

const AssignmentSchema = new mongoose.Schema(
  {
    rucId: { type: mongoose.Schema.Types.ObjectId, ref: "BaseSecodi", required: true, index: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, default: "" },
  },
  { timestamps: true, collection: "assignments" }
);

export default mongoose.model("Assignment", AssignmentSchema);
