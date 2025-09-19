import mongoose from "mongoose";

const AssignmentSchema = new mongoose.Schema(
  {
    rucId: { type: mongoose.Schema.Types.ObjectId, ref: "BaseSecodi", required: true, index: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    note: { type: String },

    // 👇 NUEVOS CAMPOS DE TIPIFICACIÓN
    tipificationId: { type: mongoose.Schema.Types.ObjectId, ref: "Tipification" },
    subtipificationId: { type: mongoose.Schema.Types.ObjectId, ref: "Subtipification" },
    tipificationNote: { type: String }, // opcional, notas del ejecutivo
    tipifiedAt: { type: Date },
    tipifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// útil para buscar el último assignment de un usuario sobre un RUC
AssignmentSchema.index({ rucId: 1, toUserId: 1, createdAt: -1 });

export default mongoose.model("Assignment", AssignmentSchema);
