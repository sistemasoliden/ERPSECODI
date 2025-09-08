// models/AssignmentBatch.js
import mongoose from "mongoose";

const AssignmentBatchSchema = new mongoose.Schema({
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // destino
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // quien asignó
  note: { type: String }, // opcional, comentario de la asignación

  countRequested: Number,   // total enviado por el admin
  countMatched: Number,     // encontrados en BaseSecodi
  countModified: Number,    // efectivamente asignados
  countMissing: Number,     // no encontrados en la colección
  countConflicted: Number,  // omitidos por conflicto

  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("AssignmentBatch", AssignmentBatchSchema);
