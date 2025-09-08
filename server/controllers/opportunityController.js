import mongoose from "mongoose";
import Opportunity from "../models/Opportunity.js";
import TipoOportunidad from "../models/TipoOportunidad.js";
import BaseSecodi from "../models/BaseSecodi.js"; // Importa tu modelo de la ba

// ID por defecto: "Propuesta identificada"
const DEFAULT_ESTADO_ID = new mongoose.Types.ObjectId("68b859269d14cf7b7e510848");

export async function createOpportunity(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const { ruc, monto, notas, estadoId } = req.body || {};
    if (!userId) return res.status(401).json({ error: "No autenticado" });
    if (!ruc) return res.status(400).json({ error: "RUC requerido" });

    // Buscar datos en tu base principal para completar la ficha
    const base = await BaseSecodi.findOne({ $or: [{ ruc }, { RUC: ruc }] });
    const razonSocial = base?.razonSocial || base?.RAZON_SOCIAL || "";

    // Resolver estado (si mandan uno válido lo usamos; si no, el DEFAULT)
    const estadoObjId = estadoId ? new mongoose.Types.ObjectId(estadoId) : DEFAULT_ESTADO_ID;
    const tipo = await TipoOportunidad.findById(estadoObjId);
    if (!tipo) return res.status(400).json({ error: "Estado inválido" });

    const item = await Opportunity.create({
      owner: userId,
      baseId: base?._id,
      ruc,
      razonSocial,
      estadoId: estadoObjId,
      estadoNombre: tipo.nombre,
      monto: Number(monto) || 0,
      notas: notas || "",
    });

    res.json({ ok: true, item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo crear la oportunidad" });
  }
}

export async function listMyOpportunities(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ error: "No autenticado" });

    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "20", 10);
    const q = String(req.query.q || "").trim();
    const estadoId = req.query.estadoId ? new mongoose.Types.ObjectId(req.query.estadoId) : null;

    const match = { owner: new mongoose.Types.ObjectId(userId) };
    if (estadoId) match.estadoId = estadoId;

    if (q) {
      match.$or = [
        { ruc: { $regex: q, $options: "i" } },
        { razonSocial: { $regex: q, $options: "i" } },
      ];
    }

    const pipeline = [
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },

      // Join con BaseGeneral usando RUC
      {
        $lookup: {
          from: "basesecodi", // 👈 ajusta al nombre real de tu colección (en plural de tu modelo)
          let: { r: "$ruc" },
          pipeline: [
            { $match: { $expr: { $or: [{ $eq: ["$ruc", "$$r"] }, { $eq: ["$RUC", "$$r"] }] } } },
            {
              $project: {
                ruc: { $ifNull: ["$ruc", "$RUC"] },
                razonSocial: { $ifNull: ["$razonSocial", "$RAZON_SOCIAL"] },
                direccion: 1,
                sunatDepartment: 1,
                sunatProvince: 1,
                sunatDistrict: 1,
                movistarLines: 1,
                claroLines: 1,
                entelLines: 1,
                otherLines: 1,
                uncountedLines: 1,
                totalLines: 1,
              },
            },
          ],
          as: "base",
        },
      },
      { $addFields: { base: { $arrayElemAt: ["$base", 0] } } },
    ];

    const count = await Opportunity.countDocuments(match);
    const items = await Opportunity.aggregate(pipeline);

    res.json({ items, total: count, page, pages: Math.ceil(count / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo listar oportunidades" });
  }
}

export async function updateEstado(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.params;
    const { estadoId } = req.body || {};
    if (!userId) return res.status(401).json({ error: "No autenticado" });
    if (!estadoId) return res.status(400).json({ error: "estadoId requerido" });

    const tipo = await TipoOportunidad.findById(estadoId);
    if (!tipo) return res.status(400).json({ error: "Estado inválido" });

    const updated = await Opportunity.findOneAndUpdate(
      { _id: id, owner: userId },
      { estadoId: tipo._id, estadoNombre: tipo.nombre },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: "Oportunidad no encontrada" });
    res.json({ ok: true, item: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo actualizar el estado" });
  }
}

export async function listTipos(req, res) {
  try {
    const tipos = await TipoOportunidad.find().sort({ nombre: 1 });
    res.json(tipos);
  } catch (e) {
    res.status(500).json({ error: "No se pudieron listar los tipos" });
  }
}
