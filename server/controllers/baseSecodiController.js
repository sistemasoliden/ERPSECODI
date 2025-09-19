// backend/controllers/baseSecodiController.js
import mongoose from "mongoose";
import BaseSecodi from "../models/BaseSecodi.js";
import AssignmentBatch from "../models/AssignmentBatch.js";
import AssignmentLog from "../models/AssignmentLog.js";
import Assignment from "../models/Assignment.js";
import Opportunity from "../models/Opportunity.js";

const onlyDigits = (v) => String(v || "").replace(/\D/g, "");
const keyOf = (d) => d?.rucStr || onlyDigits(d?.ruc);

const DEFAULT_ESTADO_ID = "68b859269d14cf7b7e510848"; // Propuesta identificada
const TIPO_MAP = {
  "68b859269d14cf7b7e510848": "Propuesta identificada",
  "68b859269d14cf7b7e510849": "Propuesta calificada",
  "68b859269d14cf7b7e51084a": "Propuesta entregada",
  "68b859269d14cf7b7e51084b": "Negociación",
  "68b859269d14cf7b7e51084c": "Negociación aprobada",
  "68b859269d14cf7b7e51084d": "Propuesta cerrada ganada",
  "68b859269d14cf7b7e51084e": "Propuesta cerrada perdida",
};
// helper: normaliza payload
function parseRucs(raw = []) {
  return Array.from(new Set(
    (raw || [])
      .map(r => onlyDigits(r))
      .filter(r => /^\d{11}$/.test(r))
  ));
}
/** GET /api/basesecodi/ruc/:ruc  -> devuelve todo el doc (sin _id/__v) */
export async function getByRuc(req, res) {
  try {
    const norm = onlyDigits(req.params.ruc || "");
    if (!norm) return res.status(400).json({ message: "RUC inválido" });

    const doc = await BaseSecodi.findOne({
      $or: [{ rucStr: norm }, { ruc: norm }, { ruc: Number(norm) }],
    })
      .select("-__v -_id")
      .lean();

    if (!doc) return res.status(404).json({ message: "RUC no encontrado" });
    return res.json(doc);
  } catch (err) {
    console.error("getByRuc error:", err);
    return res.status(500).json({ message: "Error del servidor" });
  }
}

/** GET /api/basesecodi/search?q= */
export async function search(req, res) {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json([]);

    const norm = onlyDigits(q);
    const rxName = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const docs = await BaseSecodi.find({
      $or: [
        ...(norm ? [{ rucStr: new RegExp("^" + norm) }] : []),
        { razonSocial: rxName },
        { razon_social: rxName },
      ],
    })
      .limit(10)
      .select("ruc rucStr razonSocial razon_social sunatDistrict")
      .lean();

    const items = docs.map((d) => ({
      ruc: d.rucStr || String(d.ruc || ""),
      razonSocial: d.razonSocial || d.razon_social || "",
      distrito: d.sunatDistrict || "",
    }));

    return res.json(items);
  } catch (err) {
    console.error("search error:", err);
    return res.status(500).json({ message: "Error del servidor" });
  }
}

// controllers/baseSecodiController.js
// controllers/baseSecodiController.js
export async function assignRucs(req, res) {
  try {
    const { rucs = [], userId, allowReassign = false, note = "" } = req.body || {};
    const assignedBy = req.user?._id;
    if (!assignedBy) return res.status(401).json({ message: "Sin usuario autenticado." });

    const norm = parseRucs(rucs);
    if (!norm.length) return res.status(400).json({ message: "RUCs inválidos" });

    // 1) Trae los RUCs existentes (rucStr | ruc string | ruc number)
    const rucsNum = norm.map((r) => Number(r));
    const docs = await BaseSecodi.find({
      $or: [
        { rucStr: { $in: norm } },
        { ruc:    { $in: norm } },
        { ruc:    { $in: rucsNum } },
      ],
    }).select("_id ruc rucStr razonSocial razon_social").lean();

    const key = (d) => d.rucStr || onlyDigits(d.ruc);
    const foundSet = new Set(docs.map(key));
    const missing = norm.filter((r) => !foundSet.has(r));

    // 2) Últimos dueños actuales por RUC (si los hay)
    const docIds = docs.map(d => d._id);
    const lastOwnersAgg = await Assignment.aggregate([
      { $match: { rucId: { $in: docIds } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$rucId", last: { $first: "$$ROOT" } } },
    ]);
    const lastByRucId = new Map(lastOwnersAgg.map(x => [String(x._id), x.last]));

    // 3) Crea un batch (se actualizarán los contadores al final)
    const batch = await AssignmentBatch.create({
      toUserId: userId,
      assignedBy,
      note: note?.trim() || "",
      countRequested: norm.length,
      countMatched: docs.length,
      countModified: 0,
      countMissing: missing.length,
      countConflicted: 0,
    });

    // 4) Decide acciones por cada doc
    const toInsert = [];
    const logs = [];
    const conflicted = [];
    let modified = 0;

    // 👇 NUEVO: set con los RUCs que finalmente quedarán **asignados a userId**
    const finalKeys = new Set();

    for (const d of docs) {
      const k = key(d);
      const last = lastByRucId.get(String(d._id)); // último assignment (si existe)

      if (!last) {
        // Asignación nueva
        toInsert.push({
          rucId: d._id,
          toUserId: userId,
          assignedBy,
          note,
          createdAt: new Date(),
        });
        logs.push({ batchId: batch._id, rucStr: k, prevOwner: null, newOwner: userId, action: "assign", assignedBy });
        modified += 1;
        finalKeys.add(k);
        continue;
      }

      const lastOwner = String(last.toUserId);
      if (lastOwner === String(userId)) {
        // Ya lo tiene el mismo usuario
        logs.push({ batchId: batch._id, rucStr: k, prevOwner: userId, newOwner: userId, action: "no_change", assignedBy });
        finalKeys.add(k); // 👈 asegurar oportunidad también en este caso
        continue;
      }

      if (allowReassign) {
        // Reasignar
        toInsert.push({
          rucId: d._id,
          toUserId: userId,
          assignedBy,
          note,
          createdAt: new Date(),
        });
        logs.push({ batchId: batch._id, rucStr: k, prevOwner: last.toUserId, newOwner: userId, action: "reassign", assignedBy });
        modified += 1;
        finalKeys.add(k);
      } else {
        conflicted.push(k);
        logs.push({ batchId: batch._id, rucStr: k, prevOwner: last.toUserId, newOwner: null, action: "skip_conflict", assignedBy });
      }
    }

    // 5) Inserta assignments y logs
    if (toInsert.length) await Assignment.insertMany(toInsert, { ordered: false });
    if (logs.length)     await AssignmentLog.insertMany(logs, { ordered: false });

    // 6) Actualiza contadores del batch
    batch.countModified   = modified;
    batch.countConflicted = conflicted.length;
    await batch.save();

    // 7) 👇 **AUTO-CREAR / ASEGURAR OPORTUNIDADES ABIERTAS**
    // Estados de cierre:
  const CLOSED_IDS = [
      new mongoose.Types.ObjectId("68b859269d14cf7b7e51084d"), // cerrada ganada
      new mongoose.Types.ObjectId("68b859269d14cf7b7e51084e"), // cerrada perdida
    ];
    // 7) AUTO-CREAR / ASEGURAR OPORTUNIDADES ABIERTAS (cerrada=false)
const DEFAULT_ESTADO_ID_STR = DEFAULT_ESTADO_ID; // "68b859269d14cf7b7e510848"
const finalList = Array.from(finalKeys);

// Razon social por RUC
const baseDocs = await BaseSecodi.find({
  $or: [{ rucStr: { $in: finalList } }, { ruc: { $in: finalList } }, { ruc: { $in: finalList.map(Number) } }],
}).select("ruc rucStr razonSocial razon_social").lean();

const razonByRuc = new Map(
  baseDocs.map(d => [ (d.rucStr || String(d.ruc || "")), (d.razonSocial || d.razon_social || "") ])
);

// ¿Cuáles ya tienen una oportunidad ABIERTA (cerrada=false) para este owner?
const alreadyOpen = await Opportunity.find({
  ruc: { $in: finalList },
  ownerId: new mongoose.Types.ObjectId(userId),   // 👈 ownerId
  cerrada: false,                                 // 👈 bandera
}).select("ruc").lean();

const skip = new Set(alreadyOpen.map(x => x.ruc));
const toCreate = finalList
  .filter(r => !skip.has(r))
  .map(r => ({
    ownerId: new mongoose.Types.ObjectId(userId), // 👈 ownerId
    ruc: r,
    razonSocial: razonByRuc.get(r) || "",
    estadoId: DEFAULT_ESTADO_ID_STR,              // 👈 string
    estadoNombre: TIPO_MAP[DEFAULT_ESTADO_ID_STR] || "Propuesta identificada",
    monto: 0,
    notas: note || "",
    cerrada: false,                                // 👈 explícito
  }));

const opportunitiesCreated = 0;
    // 8) Respuesta con el shape que necesita tu UI + campo nuevo
    return res.json({
      matched: docs.length,
      modified,
      missing,
      conflicted,
      batchId: batch._id,
      opportunitiesCreated, // 👈 NUEVO
    });
  } catch (err) {
    console.error("[assignRucs]", err);
    return res.status(500).json({ message: "Error asignando RUCs." });
  }
}



// GET /api/basesecodi/assigned
// GET /api/basesecodi/assigned?userId=me&page=&limit=&q=
// controllers/baseSecodiController.js
export async function listAssigned(req, res) {
  try {
    const { userId = "me", page = 1, limit = 24, q = "" } = req.query;
    const oid = userId === "me" ? req.user._id : new mongoose.Types.ObjectId(userId);
    const skip = (parseInt(page,10) - 1) * parseInt(limit,10);
    const nameRx = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;

    const pipeline = [
      { $sort: { rucId: 1, createdAt: -1, _id: -1 } },        // último assignment por ruc
      { $group: { _id: "$rucId", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
      { $match: { toUserId: oid } },                          // dueño vigente (tú)
      // ⬇️ Mostrar SOLO los no tipificados
      { $match: { $or: [ { tipifiedAt: { $exists: false } }, { tipifiedAt: null } ] } },

      { $lookup: { from: "basesecodi", localField: "rucId", foreignField: "_id", as: "r" } },
      { $unwind: "$r" },

      ...(q ? [{
        $match: {
          $or: [
            { "r.razonSocial": { $regex: nameRx } },
            { "r.razon_social": { $regex: nameRx } },
            { "r.rucStr": { $regex: q } },
            { "r.ruc": { $regex: q } },
          ],
        },
      }] : []),

      { $facet: {
          items: [{ $skip: skip }, { $limit: parseInt(limit,10) }],
          total: [{ $count: "n" }],
      }},
    ];

    const agg = await Assignment.aggregate(pipeline);
    const itemsAgg = agg[0]?.items ?? [];
    const total = agg[0]?.total?.[0]?.n ?? 0;

    const items = itemsAgg.map(a => ({
      ...a.r,
      assignedAt: a.createdAt,
      assignedBy: a.assignedBy,
      note: a.note,
    }));

    return res.json({
      items,
      total,
      page: parseInt(page,10),
      pages: Math.max(1, Math.ceil(total / parseInt(limit,10))),
    });
  } catch (err) {
    console.error("[listAssigned]", err);
    res.status(500).json({ message: "Error cargando base asignada" });
  }
}

// controllers/baseSecodiController.js (getStats)
export async function getStats(req, res) {
  try {
    const userId = req.query.userId === "me" ? req.user?._id : req.query.userId;
    if (!userId) return res.status(400).json({ message: "Falta userId" });

    const oid = new mongoose.Types.ObjectId(userId);
    const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);

    const pipeline = [
      { $sort: { rucId: 1, createdAt: -1, _id: -1 } },
      { $group: { _id: "$rucId", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
      { $match: { toUserId: oid } }, // dueño vigente

      { $lookup: { from: "basesecodi", localField: "rucId", foreignField: "_id", as: "r" } },
      { $unwind: "$r" },

      { $group: {
          _id: null,
          totalAssigned:   { $sum: 1 },
          lastAssignedAt:  { $max: "$createdAt" },
          sumTotalLines:   { $sum: { $ifNull: ["$r.totalLines", 0] } },
          completedTotal:  { $sum: { $cond: [ { $ne: ["$tipifiedAt", null] }, 1, 0 ] } },
          completedToday:  { $sum: { $cond: [
                                { $and: [
                                  { $ne: ["$tipifiedAt", null] },
                                  { $gte: ["$tipifiedAt", startOfToday] }
                                ]},
                                1, 0
                              ] } },
      }},

      { $project: {
          total: { $subtract: ["$totalAssigned", "$completedTotal"] }, // Restantes
          lastAssignedAt: 1,
          sumTotalLines: 1,
          completedToday: 1,
      }},
    ];

    const s = (await Assignment.aggregate(pipeline))[0] || {};
    res.json({
      total: s.total || 0,
      lastAssignedAt: s.lastAssignedAt || null,
      sumTotalLines: s.sumTotalLines || 0,
      completedToday: s.completedToday || 0,
    });
  } catch (e) {
    console.error("getStats error:", e);
    res.status(500).json({ message: "Error en stats" });
  }
}

// GET /api/basesecodi/stats
export async function assignedStats(req, res) {
  try {
    const { userId = "me" } = req.query;
    const uid = userId === "me" ? req.user._id : userId;

    const total = await BaseSecodi.countDocuments({ assignedTo: uid });

    const lastDoc = await BaseSecodi.findOne({ assignedTo: uid })
      .sort({ assignedAt: -1 })
      .select("assignedAt")
      .lean();

    const sum = await BaseSecodi.aggregate([
      { $match: { assignedTo: uid } },
      { $group: { _id: null, sumTotalLines: { $sum: "$totalLines" } } },
    ]);

    const today = await BaseSecodi.countDocuments({
      assignedTo: uid,
      assignedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    });

    return res.json({
      total,
      lastAssignedAt: lastDoc?.assignedAt || null,
      sumTotalLines: sum[0]?.sumTotalLines || 0,
      today,
    });
  } catch (err) {
    console.error("[assignedStats]", err);
    return res.status(500).json({ message: "Error obteniendo stats" });
  }
}

export async function listBatches(req, res) {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || "50", 10)));
    const skip  = Math.max(0, parseInt(req.query.skip || "0", 10));

    const batches = await AssignmentBatch.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("toUserId", "name email")
      .populate("assignedBy", "name email")
      .lean();

    res.json(batches);
  } catch (err) {
    console.error("[listBatches]", err);
    res.status(500).json({ message: "Error obteniendo batches." });
  }
}


export async function getBatchLogs(req, res) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "batchId inválido" });
    }

    const logs = await AssignmentLog.find({ batchId: id })
      .sort({ createdAt: -1 }) // <-- antes decía { at: -1 }
      .populate("newOwner", "name email")
      .populate("prevOwner", "name email")
      .populate("assignedBy", "name email")
      .lean();

    res.json(logs);
  } catch (err) {
    console.error("[getBatchLogs]", err);
    res.status(500).json({ message: "Error obteniendo logs de batch." });
  }
}

export async function findByRucs(req, res) {
  try {
    const rucs = parseRucs(req.body?.rucs || []);
    if (!rucs.length) return res.status(400).json({ message: "Envía RUCs válidos (11 dígitos)." });

    const rucsNum = rucs.map((r) => Number(r));

    // Trae docs por rucStr | ruc string | ruc number
    const docs = await BaseSecodi.find({
      $or: [
        { rucStr: { $in: rucs } },
        { ruc:    { $in: rucs } },
        { ruc:    { $in: rucsNum } },
      ],
    })
      .select("_id ruc rucStr razonSocial razon_social")
      .lean();

    const key = (d) => d.rucStr || onlyDigits(d.ruc);
    const foundSet = new Set(docs.map(key));
    const missing = rucs.filter((r) => !foundSet.has(r));

    // Conflictos reales = ya tienen último owner (quien sea)
    const docIds = docs.map(d => d._id);
    const lastOwners = await Assignment.aggregate([
      { $match: { rucId: { $in: docIds } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$rucId", last: { $first: "$$ROOT" } } },
    ]);

    const hasOwner = new Set(lastOwners.map(x => String(x._id)));
    const conflicted = docs
      .filter(d => hasOwner.has(String(d._id)))
      .map(key);

    const found = docs.map(d => ({
      ruc: key(d),
      razonSocial: d.razonSocial || d.razon_social || "",
    }));

    return res.json({ found, missing, conflicted });
  } catch (err) {
    console.error("[findByRucs]", err);
    return res.status(500).json({ message: "Error buscando RUCs." });
  }
}

// controllers/baseSecodiController.js
// controllers/baseSecodiController.js
// controllers/baseSecodiController.js
export const markTipificada = async (req, res) => {
  try {
    const userId = String(req.user?._id || req.user?.id);
    const rucRaw = String(req.body?.ruc || "");
    const ruc = rucRaw.replace(/\D/g, "");
    if (ruc.length !== 11) return res.status(400).json({ error: "RUC inválido" });

    // Buscar el doc en BaseSecodi por rucStr o ruc (string/number)
    const base = await BaseSecodi.findOne({
      $or: [{ rucStr: ruc }, { ruc }, { ruc: Number(ruc) }],
    }).select("_id");
    if (!base) return res.status(404).json({ error: "RUC no encontrado" });

    // Verificar que el último assignment pertenece al usuario
    const last = await Assignment.findOne({ rucId: base._id })
      .sort({ createdAt: -1, _id: -1 })
      .select("toUserId")
      .lean();

    if (!last || String(last.toUserId) !== userId) {
      return res.status(403).json({ error: "Este RUC no está asignado a ti" });
    }

    // Marcar como completado en la base
    await BaseSecodi.updateOne(
      { _id: base._id },
      { $set: { assignedStatus: "completed", tipificadaAt: new Date() } }
    );

    return res.json({ ok: true });
  } catch (e) {
    console.error("markTipificada", e);
    return res.status(500).json({ error: "Error marcando tipificada" });
  }
};
