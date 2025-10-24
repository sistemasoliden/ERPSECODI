// backend/helpers/supervision.js
import Team from "../models/EquipoSecodi.js"; // o Team.js
import User from "../models/User.js";
import mongoose from "mongoose";

export async function getSupervisorsForUser(userId) {
  // si User tiene referencia directa al equipo:
  const u = await User.findById(userId).select("equipo").lean();
  if (!u?.equipo) return [];
  const t = await Team.findById(u.equipo).select("supervisor").lean();
  return t?.supervisor ? [ new mongoose.Types.ObjectId(t.supervisor) ] : [];
}
