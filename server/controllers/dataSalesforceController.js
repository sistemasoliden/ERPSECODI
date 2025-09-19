import mongoose from "mongoose";
import DataSalesforce from "../models/DataSalesforce.js";
import BaseSecodi from "../models/BaseSecodi.js";

const isOID = (id) => mongoose.isValidObjectId(id);

/**
 * GET /data-salesforce/by-base/:baseId
 * Lee registros de DataSalesforce donde ruc = ObjectId(BaseSecodi._id)
 */
export async function listByBase(req, res) {
  try {
    const { baseId } = req.params;
    if (!isOID(baseId)) {
      return res.status(400).json({ message: "baseId inválido" });
    }

    const items = await DataSalesforce.find({ ruc: baseId })
      .select("type segment primaryConsultant lastAssignmentDate nextDeassignmentDate createdAt updatedAt ruc")
      .populate("ruc", "ruc razonSocial") // 👈 trae ruc/razonSocial de la base
      .sort({ updatedAt: -1 })
      .lean();

    return res.json(items);
  } catch (err) {
    console.error("[dataSalesforce.byBase]", err);
    return res.status(500).json({ message: "Error cargando DataSalesforce" });
  }
}

/**
 * GET /data-salesforce/by-ruc/:ruc
 * 1) Normaliza RUC (11 dígitos string)
 * 2) Busca BaseSecodi por ruc (string)
 * 3) Consulta DataSalesforce por ruc = _id de la base
 */
export async function listByRuc(req, res) {
  try {
    const rucRaw = String(req.params.ruc || "");
    const ruc = rucRaw.replace(/\D/g, "");
    if (ruc.length !== 11) {
      return res.status(400).json({ message: "RUC inválido" });
    }

    const base = await BaseSecodi.findOne({ ruc }).select("_id ruc razonSocial").lean();
    if (!base?._id) return res.json([]);

    const items = await DataSalesforce.find({ ruc: base._id })
      .select("type segment primaryConsultant lastAssignmentDate nextDeassignmentDate createdAt updatedAt ruc")
      .populate("ruc", "ruc razonSocial")
      .sort({ updatedAt: -1 })
      .lean();

    return res.json(items);
  } catch (err) {
    console.error("[dataSalesforce.byRuc]", err);
    return res.status(500).json({ message: "Error cargando DataSalesforce" });
  }
}
