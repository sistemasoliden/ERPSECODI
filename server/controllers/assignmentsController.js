import mongoose from "mongoose";
import Assignment from "../models/Assignment.js";
import BaseSecodi from "../models/BaseSecodi.js";
import Tipification from "../models/Tipification.js";
import Subtipification from "../models/Subtipification.js";

import { ROLES_IDS } from "../middlewares/auth.js";

// ===== helpers de rol / alcance =====
function isSistemasRole(req) {
  // si consideras gerencia “global”, deja el isAdmin
  return String(req.user?.roleId || "") === ROLES_IDS.sistemas || !!req.user?.isAdmin;
}

function getScopedUserIds(req) {
  const fromToken = req.user?._id || req.user?.id || null;
  const noFallback = String(req.query.noFallback || "") === "1";
  const one = req.query.userId;

  let many = req.query.userIds ?? req.query["userIds[]"];
  const indexed = Object.keys(req.query)
    .filter((k) => /^userIds\[\d+\]$/.test(k))
    .map((k) => req.query[k]);
  const csvAlt = (req.query.userIdsCsv || "").trim();

  let list = [];
  if (Array.isArray(many)) list = many;
  else if (typeof many === "string")
    list = many.split(",").map((s) => s.trim()).filter(Boolean);
  if (indexed.length) list = list.concat(indexed);
  if (csvAlt) list = list.concat(csvAlt.split(",").map((s) => s.trim()).filter(Boolean));
  if (one) list.push(one);

  const parsed = list
    .map(String)
    .filter((s) => s && mongoose.isValidObjectId(s))
    .map((s) => new mongoose.Types.ObjectId(s));

  // fallback: si NO hay ids y hay usuario, por defecto su scope
  if (!parsed.length && fromToken && !noFallback) {
    return [new mongoose.Types.ObjectId(fromToken)];
  }
  return parsed;
}

const isOID = (v) => mongoose.isValidObjectId(v);
const onlyDigits = (v) => String(v || "").replace(/\D/g, "");
const isRuc11   = (v) => /^\d{11}$/.test(String(v));

/* Debug helper */
const dbg = (...a) => console.log("[assignments]", ...a);

/* Resolve rucId (ObjectId en BaseSecodi) usando ruc o rucId */
async function resolveRucId({ rucId, ruc }) {
  if (isOID(rucId)) return rucId;
  const plain = onlyDigits(ruc);
  if (!isRuc11(plain)) return null;

  const base = await BaseSecodi.findOne({
    $or: [{ rucStr: plain }, { ruc: plain }, { ruc: Number(plain) }],
  }).select("_id");
  return base?._id || null;
}

/**
 * POST /api/assignments/tipificar-latest
 * body: { rucId?: string, ruc?: string, tipificationId: string, subtipificationId: string, note?: string, date?: 'yyyy-mm-dd' }
 */
export async function tipificarLatest(req, res) {
  try {
    dbg("tipificarLatest:init user=", req.user?.email || req.user?._id, "body keys=", Object.keys(req.body || {}));
    const userId = String(req.user?._id || "");
    if (!userId) return res.status(401).json({ message: "No autenticado" });

    const { rucId: rucIdRaw, ruc, tipificationId, subtipificationId, note, date } = req.body;

    dbg("validate ids", { tipificationId, subtipificationId });
    if (!isOID(tipificationId))   return res.status(400).json({ message: "tipificationId inválido" });
    if (!isOID(subtipificationId)) return res.status(400).json({ message: "subtipificationId inválido" });

    // Validar relación subtipo → tipo
    const sub = await Subtipification.findById(subtipificationId).select("_id tipificationId name").lean();
    dbg("sub found?", !!sub, "sub.tipificationId=", sub?.tipificationId?.toString());
    if (!sub) return res.status(404).json({ message: "Subtipificación no encontrada" });
    if (String(sub.tipificationId) !== String(tipificationId)) {
      return res.status(400).json({ message: "La subtipificación no corresponde a la tipificación seleccionada" });
    }

    // Resolver rucId
    const rucId = await resolveRucId({ rucId: rucIdRaw, ruc });
    dbg("resolved rucId=", rucId?.toString());
    if (!rucId) return res.status(400).json({ message: "RUC/RUCID inválido o no encontrado" });

    // Último assignment del usuario sobre ese RUC
    const assig = await Assignment.findOne({ rucId, toUserId: userId })
      .sort({ createdAt: -1, _id: -1 });
    dbg("found assignment?", !!assig, "assigId=", assig?._id?.toString());
    if (!assig) return res.status(404).json({ message: "No hay assignment activo para este RUC" });

    // Fecha (si viene yyyy-mm-dd)
    let tipifiedAt = new Date();
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [Y, M, D] = date.split("-").map(Number);
      tipifiedAt = new Date(Y, M - 1, D, 0, 0, 0, 0);
    }

    // Guardar
    assig.tipificationId     = tipificationId;
    assig.subtipificationId  = subtipificationId;
    assig.tipificationNote   = typeof note === "string" ? note.trim() : assig.tipificationNote;
    assig.tipifiedAt         = tipifiedAt;
    assig.tipifiedBy         = userId;

    await assig.save();
    dbg("assignment saved", assig._id?.toString(), "tipifiedAt=", tipifiedAt?.toISOString());

    await assig.populate([
      { path: "tipificationId", select: "categorytip name" },
      { path: "subtipificationId", select: "name" },
    ]);

    return res.json(assig.toObject());
  } catch (err) {
    console.error("[assignments.tipificarLatest] ERROR", err);
    return res.status(500).json({ message: "Error guardando tipificación" });
  }
}

/**
 * GET /api/assignments/tipificaciones
 * userId=me|<id>&page=1&limit=20&q=&from=yyyy-mm-dd&to=yyyy-mm-dd
 */
export async function listTipificadas(req, res) {
  try {
    dbg("listTipificadas:init query=", req.query);
    const { userId = "me", page = 1, limit = 20, q = "", from = "", to = "" } = req.query;

    const uidStr = String(userId === "me" ? req.user?._id : userId || "");
    if (!uidStr) return res.status(401).json({ message: "No autenticado" });

    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const skip     = (pageNum - 1) * limitNum;

    const nameRx = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
    const rucDigits = onlyDigits(q);

    // Rango de fechas
    let fromDate = null, toDate = null;
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      const [Y, M, D] = from.split("-").map(Number);
      fromDate = new Date(Y, M - 1, D, 0, 0, 0, 0);
    }
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      const [Y, M, D] = to.split("-").map(Number);
      toDate = new Date(Y, M - 1, D, 23, 59, 59, 999);
    }

    const matchOwner = { toUserId: isOID(uidStr) ? new mongoose.Types.ObjectId(uidStr) : uidStr };
    const matchTipified = {
      tipifiedAt: { $ne: null },
      ...((fromDate || toDate) && {
        tipifiedAt: {
          ...(fromDate ? { $gte: fromDate } : {}),
          ...(toDate ? { $lte: toDate } : {}),
        },
      }),
    };

    const TIP_COLL  = Tipification.collection.name;
    const SUB_COLL  = Subtipification.collection.name;
    const BASE_COLL = BaseSecodi.collection.name;

    const searchStage = q
      ? {
          $match: {
            $or: [
              { "b.razonSocial":  { $regex: nameRx } },
              { "b.razon_social": { $regex: nameRx } },
              ...(rucDigits ? [{ "b.rucStr": { $regex: new RegExp(rucDigits) } }] : []),
              ...(rucDigits ? [{
                $expr: {
                  $regexMatch: {
                    input: { $toString: "$b.ruc" },
                    regex: rucDigits,
                  },
                },
              }] : []),
            ],
          },
        }
      : null;

    dbg("pipeline: owner=", matchOwner, "dates=", { fromDate, toDate }, "hasSearch=", !!searchStage);

    const pipeline = [
      { $match: matchOwner },
      { $match: matchTipified },

      { $lookup: { from: BASE_COLL, localField: "rucId", foreignField: "_id", as: "b" } },
      { $unwind: { path: "$b", preserveNullAndEmptyArrays: true } },

      { $lookup: { from: TIP_COLL, localField: "tipificationId", foreignField: "_id", as: "tip" } },
      { $unwind: { path: "$tip", preserveNullAndEmptyArrays: true } },

      { $lookup: { from: SUB_COLL, localField: "subtipificationId", foreignField: "_id", as: "sub" } },
      { $unwind: { path: "$sub", preserveNullAndEmptyArrays: true } },

      ...(searchStage ? [searchStage] : []),

      { $sort: { tipifiedAt: -1, _id: -1 } },

      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: limitNum },
            {
              $project: {
                _id: 1,
                ruc: {
                  $ifNull: [
                    "$b.rucStr",
                    { $cond: [{ $ifNull: ["$b.ruc", false] }, { $toString: "$b.ruc" }, "" ] }
                  ],
                },
                razonSocial: { $ifNull: ["$b.razonSocial", "$b.razon_social"] },
                tipificacion: { $ifNull: ["$tip.name", "$tip.categorytip"] },
                subtipificacion: "$sub.name",
                note: "$tipificationNote",
                tipifiedAt: 1,
              },
            },
          ],
          total: [{ $count: "n" }],
        },
      },
    ];

    const agg = await Assignment.aggregate(pipeline);
    const bucket = Array.isArray(agg) && agg[0] ? agg[0] : { items: [], total: [] };
    const items = bucket.items || [];
    const totalDocs = bucket.total?.[0]?.n || 0;

    dbg("results:", { totalDocs, pageNum, limitNum, itemsLen: items.length });

    return res.json({
      items,
      total: totalDocs,
      page: pageNum,
      pages: Math.max(1, Math.ceil(totalDocs / limitNum)),
    });
  } catch (err) {
    console.error("[assignments.listTipificadas] ERROR", err);
    return res.status(500).json({ message: "Error listando tipificaciones" });
  }
}

function hasExplicitUserIds(req) {
  const many = req.query.userIds ?? req.query['userIds[]'];
  if (Array.isArray(many) && many.length > 0) return true;
  if (typeof many === 'string' && many.trim().length > 0) return true;
  if (Object.keys(req.query).some(k => /^userIds\[\d+\]$/.test(k))) return true;
  if (req.query.userId && String(req.query.userId).trim().length > 0) return true;
  return false;
}

export async function listTipificadasSupervisor(req, res) {
  try {
    console.log("======[listTipificadasSupervisor]======");
    console.log("query:", req.query);
    console.log("user:", req.user?.email || req.user?._id);
    console.log("roleId:", req.user?.roleId, "isAdmin:", req.user?.isAdmin);

    // ───────── parámetros ─────────
    const pageNum = Math.max(1, parseInt(req.query.page || "1", 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(req.query.limit || "20", 10)));
    const skip = (pageNum - 1) * limitNum;

    const qRaw = String(req.query.q || "").trim();
    const from = String(req.query.from || "");
    const to   = String(req.query.to   || "");

    const scopedIds = getScopedUserIds(req);
    const hasUserIds = hasExplicitUserIds(req);

    const allowAll =
      isSistemasRole(req) &&
      !hasUserIds &&
      String(req.query.includeAllTeams || "") === "1";

    console.log("isSistemasRole:", isSistemasRole(req));
    console.log("hasUserIds:", hasUserIds, "includeAllTeams:", req.query.includeAllTeams, "=> allowAll:", allowAll);
    console.log("scopedIds:", scopedIds.map(String));

    // ───────── filtros básicos ─────────
    const TIP_COLL  = Tipification.collection.name;
    const SUB_COLL  = Subtipification.collection.name;
    const BASE_COLL = BaseSecodi.collection.name;

    const ownersMatch = allowAll
      ? {}
      : (scopedIds.length
          ? {
              $or: [
                { toUserId: { $in: scopedIds } },
                { $expr: { $in: [{ $toString: "$toUserId" }, scopedIds.map(String)] } },
              ],
            }
          : { $expr: { $eq: [1, 0] } });

    // fechas
    let fromDate = null, toDate = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      const [Y, M, D] = from.split("-").map(Number);
      fromDate = new Date(Y, M - 1, D, 0, 0, 0, 0);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      const [Y, M, D] = to.split("-").map(Number);
      toDate = new Date(Y, M - 1, D, 23, 59, 59, 999);
    }

    const matchTipified = {
      tipifiedAt: { $ne: null },
      ...((fromDate || toDate) && {
        tipifiedAt: {
          ...(fromDate ? { $gte: fromDate } : {}),
          ...(toDate ? { $lte: toDate } : {}),
        },
      }),
    };

    console.log("ownersMatch:", JSON.stringify(ownersMatch));
    console.log("dateRange:", { fromDate, toDate }, "qRaw:", qRaw);

    const safeRx = qRaw
      ? new RegExp(qRaw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;
    const rucDigits = qRaw.replace(/\D/g, "");

    const searchStage = qRaw
      ? {
          $match: {
            $or: [
              { "b.razonSocial": { $regex: safeRx } },
              { "b.razon_social": { $regex: safeRx } },
              ...(rucDigits ? [{ "b.rucStr": { $regex: new RegExp(rucDigits) } }] : []),
              ...(rucDigits
                ? [
                    {
                      $expr: {
                        $regexMatch: {
                          input: { $toString: "$b.ruc" },
                          regex: rucDigits,
                        },
                      },
                    },
                  ]
                : []),
            ],
          },
        }
      : null;

    // ───────── pipeline ─────────
    const pipeline = [
      { $match: ownersMatch },
      { $match: matchTipified },

      { $lookup: { from: BASE_COLL, localField: "rucId", foreignField: "_id", as: "b" } },
      { $unwind: { path: "$b", preserveNullAndEmptyArrays: true } },

      { $lookup: { from: TIP_COLL, localField: "tipificationId", foreignField: "_id", as: "tip" } },
      { $unwind: { path: "$tip", preserveNullAndEmptyArrays: true } },

      { $lookup: { from: SUB_COLL, localField: "subtipificationId", foreignField: "_id", as: "sub" } },
      { $unwind: { path: "$sub", preserveNullAndEmptyArrays: true } },

      { $lookup: { from: "users", localField: "toUserId", foreignField: "_id", as: "owner" } },
      { $unwind: { path: "$owner", preserveNullAndEmptyArrays: true } },

      ...(searchStage ? [searchStage] : []),

      { $sort: { tipifiedAt: -1, _id: -1 } },

      {
        $facet: {
          items: [
            { $skip: skip },
            { $limit: limitNum },
            {
              $project: {
                _id: 1,
                ruc: {
                  $ifNull: [
                    "$b.rucStr",
                    {
                      $cond: [
                        { $ifNull: ["$b.ruc", false] },
                        { $toString: "$b.ruc" },
                        "",
                      ],
                    },
                  ],
                },
                razonSocial: { $ifNull: ["$b.razonSocial", "$b.razon_social"] },
                tipificacion: { $ifNull: ["$tip.name", "$tip.categorytip"] },
                subtipificacion: "$sub.name",
                note: "$tipificationNote",
                tipifiedAt: 1,
                ownerName: { $ifNull: ["$owner.name", ""] },
                ownerEmail: { $ifNull: ["$owner.email", ""] },
              },
            },
          ],
          total: [{ $count: "n" }],
        },
      },
      {
        $project: {
          items: 1,
          total: { $ifNull: [{ $arrayElemAt: ["$total.n", 0] }, 0] },
        },
      },
    ];

    console.log("pipeline ready. page/limit/skip:", { pageNum, limitNum, skip });

    const [{ items = [], total = 0 } = {}] = await Assignment.aggregate(pipeline).allowDiskUse(true);

    const pages = Math.max(1, Math.ceil(total / limitNum));
    console.log(`→ Resultado: total=${total}, itemsLen=${items.length}, página ${pageNum}/${pages}`);

    return res.json({ items, total, page: pageNum, pages });
  } catch (err) {
    console.error("[assignments.listTipificadasSupervisor] ERROR", err);
    return res.status(500).json({ message: "Error listando tipificaciones del equipo" });
  }
}
