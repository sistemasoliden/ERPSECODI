import mongoose from "mongoose";
import Assignment from "../models/Assignment.js";
import Subtipification from "../models/Subtipification.js";

const isOID = (v) => mongoose.isValidObjectId(v);

/**
 * POST /api/assignments/tipificar-latest
 * body: { rucId, tipificationId, subtipificationId, note? }
 * Requiere verifyToken + requireRoles.
 */
// controllers/assignmentsController.js

export async function tipificarLatest(req, res) {
  try {
    const { rucId, tipificationId, subtipificationId, note } = req.body;
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "No autenticado" });

    // ...tus validaciones previas (ObjectId, sub->tip)...

    const assig = await Assignment.findOne({ rucId, toUserId: userId }).sort({ createdAt: -1 });
    if (!assig) return res.status(404).json({ message: "No hay assignment activo para este RUC" });

    assig.tipificationId   = tipificationId;
    assig.subtipificationId = subtipificationId;
    if (typeof note === "string") assig.tipificationNote = note;
    assig.tipifiedAt = new Date();
    assig.tipifiedBy = userId;

    await assig.save();

    // 👇 Un solo populate con array (sin encadenar)
    await assig.populate([
      { path: "tipificationId", select: "categorytip" },
      { path: "subtipificationId", select: "name" },
    ]);

    return res.json(assig.toObject());
  } catch (err) {
    console.error("[assignments.tipificarLatest]", err);
    return res.status(500).json({ message: "Error guardando tipificación" });
  }
}
