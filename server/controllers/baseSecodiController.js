// backend/controllers/baseSecodiController.js
import mongoose from "mongoose";
import BaseSecodi from "../models/BaseSecodi.js";
import AssignmentBatch from "../models/AssignmentBatch.js";
import AssignmentLog from "../models/AssignmentLog.js";
import Assignment from "../models/Assignment.js";
import Opportunity from "../models/Opportunity.js";
import User from "../models/User.js";

const onlyDigits = (v) => String(v || "").replace(/\D/g, "");
const keyOf = (d) => d?.rucStr || onlyDigits(d?.ruc);

const isOID = (v) => mongoose.isValidObjectId(v);
const isRuc11 = (v) => /^\d{11}$/.test(String(v));

// arriba del archivo (ya tienes import BaseSecodi)
const findBaseByRuc = (rucPlain) => {
  return BaseSecodi.findOne(
    {
      $or: [{ rucStr: rucPlain }, { ruc: rucPlain }, { ruc: Number(rucPlain) }],
    },
    { _id: 1 }
  ).lean();
};

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
  return Array.from(
    new Set(
      (raw || []).map((r) => onlyDigits(r)).filter((r) => /^\d{11}$/.test(r))
    )
  );
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

// controllers/baseS
export async function assignRucs(req, res) {
  const {
    rucs = [],
    userId: userIdDestino,
    note = "",
    overwrite = true,
    ignoreTipificacion = true,
  } = req.body;

  const asignadorId = req.user?._id;
  if (!asignadorId) return res.status(401).json({ message: "No autenticado" });

  if (!isOID(userIdDestino)) {
    return res.status(400).json({ message: "userId inválido" });
  }

  const cleanRucs = parseRucs(rucs);
  if (!cleanRucs.length) {
    return res
      .status(400)
      .json({ message: "Envía RUCs válidos (11 dígitos)." });
  }

  const result = {
    matched: 0,
    modified: 0,
    missing: [],
    conflicted: [],
    overwritten: 0,
    opportunitiesCreated: 0,
  };

  const toUserOid = new mongoose.Types.ObjectId(userIdDestino);

  for (const raw of cleanRucs) {
    const rucPlain = String(raw); // ya viene limpio (11 dígitos)

    try {
      // 1) Resolver rucId (ObjectId) a partir del RUC (BaseSecodi)
      let rucId = null;

      if (isOID(raw)) {
        // por si te envían directamente el _id de BaseSecodi (raro)
        rucId = raw;
      } else if (isRuc11(rucPlain)) {
        const base = await findBaseByRuc(rucPlain);
        if (!base) {
          result.missing.push(rucPlain);
          continue;
        }
        rucId = base._id;
      } else {
        result.missing.push(rucPlain);
        continue;
      }

      // 2) Último assignment por rucId
      const prev = await Assignment.findOne({ rucId }).sort({
        createdAt: -1,
        _id: -1,
      });

      // 3) Si no existe, crear uno nuevo
      if (!prev) {
        await Assignment.create({
          rucId,
          ruc: rucPlain, // denormalizado (útil en reportes)
          toUserId: toUserOid, // siempre ObjectId
          assignedBy: asignadorId,
          assignedAt: new Date(),
          releasedAt: null,
          tipificationNote: note || "",
          // tipificación vacía por defecto
          tipificationId: null,
          subtipificationId: null,
          tipifiedAt: null,
          tipifiedBy: null,
        });

        result.matched += 1;
        result.modified += 1;
        continue;
      }

      // 4) Reasignar en el MISMO documento
      const set = {
        rucId,
        ruc: rucPlain,
        toUserId: toUserOid, // forzamos ObjectId
        assignedBy: asignadorId,
        assignedAt: new Date(),
        releasedAt: null,
      };

      const sentNewTipif = Boolean(
        req.body.tipificationId || req.body.subtipificationId
      );

      if (sentNewTipif) {
        // Si envías nueva tipificación en este mismo POST, se sobreescribe
        set.tipificationId = req.body.tipificationId ?? null;
        set.subtipificationId = req.body.subtipificationId ?? null;
        set.tipificationNote =
          typeof note === "string" ? note : prev.tipificationNote || "";
        set.tipifiedAt = new Date();
        set.tipifiedBy = asignadorId;
      } else if (overwrite && ignoreTipificacion) {
        // Reabrir SIEMPRE (aunque sea el mismo owner)
        set.tipificationId = undefined;
        set.subtipificationId = undefined;
        set.tipificationNote = "";
        set.tipifiedAt = null;
        set.tipifiedBy = null;
      }

      await Assignment.updateOne({ _id: prev._id }, { $set: set });
      result.matched += 1;
      result.modified += 1;
      result.overwritten += 1;

      // (opcional) escribir log de reasignación
      // try {
      //   await AssignmentLog.create({
      //     rucId,
      //     prevOwner: prev.toUserId,
      //     newOwner: toUserOid,
      //     assignedBy: asignadorId,
      //     note: note || "",
      //   });
      // } catch {}
    } catch (err) {
      console.error("[assignRucs] error con RUC:", rucPlain, err);
      result.conflicted.push(rucPlain);
    }
  }

  return res.json(result);
}

// GET /api/basesecodi/assigned?userId=me&page=&limit=&q=
// controllers/baseSecodiController.js
export async function listAssigned(req, res) {
  try {
    const { userId = "me", page = 1, limit = 24, q = "" } = req.query;

    const oidStr = String(userId === "me" ? req.user._id : userId);
    const oidObj = mongoose.isValidObjectId(oidStr)
      ? new mongoose.Types.ObjectId(oidStr)
      : null;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const nameRx = q
      ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
      : null;

    const pipeline = [
      { $sort: { rucId: 1, assignedAt: -1, createdAt: -1, _id: -1 } },
      { $group: { _id: "$rucId", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },

      // 👇 match por ObjectId y por string
      {
        $match: {
          $or: [
            ...(oidObj ? [{ toUserId: oidObj }] : []),
            { toUserId: oidStr },
          ],
        },
      },

      // Solo NO tipificados
      {
        $match: {
          $or: [{ tipifiedAt: { $exists: false } }, { tipifiedAt: null }],
        },
      },

      {
        $lookup: {
          from: "basesecodi",
          localField: "rucId",
          foreignField: "_id",
          as: "r",
        },
      },
      { $unwind: "$r" },

      ...(q
        ? [
            {
              $match: {
                $or: [
                  { "r.razonSocial": { $regex: nameRx } },
                  { "r.razon_social": { $regex: nameRx } },
                  { "r.rucStr": { $regex: q } },
                  { "r.ruc": { $regex: q } },
                ],
              },
            },
          ]
        : []),

      {
        $facet: {
          items: [{ $skip: skip }, { $limit: parseInt(limit, 10) }],
          total: [{ $count: "n" }],
        },
      },
    ];

    const agg = await Assignment.aggregate(pipeline);
    const itemsAgg = agg[0]?.items ?? [];
    const total = agg[0]?.total?.[0]?.n ?? 0;

    const items = itemsAgg.map((a) => ({
      ...a.r,
      assignedAt: a.assignedAt ?? a.createdAt, // 👈 usar assignedAt
      assignedBy: a.assignedBy,
      note: a.note,
    }));

    res.json({
      items,
      total,
      page: parseInt(page, 10),
      pages: Math.max(1, Math.ceil(total / parseInt(limit, 10))),
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

    const oidStr = String(userId);
    const oidObj = mongoose.isValidObjectId(oidStr)
      ? new mongoose.Types.ObjectId(oidStr)
      : null;

    const matchOwner = {
      $or: [...(oidObj ? [{ toUserId: oidObj }] : []), { toUserId: oidStr }],
    };

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const pipeline = [
      { $sort: { rucId: 1, assignedAt: -1, createdAt: -1, _id: -1 } },
      { $group: { _id: "$rucId", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
      { $match: matchOwner },

      {
        $group: {
          _id: null,
          totalAssigned: { $sum: 1 },
      lastAssignedAt: { $max: { $ifNull: ["$assignedAt", "$createdAt"] } },
          completedTotal: {
            $sum: { $cond: [{ $ne: ["$tipifiedAt", null] }, 1, 0] },
          },
          completedToday: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$tipifiedAt", null] },
                    { $gte: ["$tipifiedAt", startOfToday] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },

      {
        $project: {
          total: { $subtract: ["$totalAssigned", "$completedTotal"] }, // Restantes
          totalAssigned: 1,
          lastAssignedAt: 1,
          completedToday: 1,
        },
      },
    ];

    const s = (await Assignment.aggregate(pipeline))[0] || {};
    res.json({
      total: s.total || 0, // Restantes
      totalAssigned: s.totalAssigned || 0,
      lastAssignedAt: s.lastAssignedAt || null,
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
    const limit = Math.min(
      200,
      Math.max(1, parseInt(req.query.limit || "50", 10))
    );
    const skip = Math.max(0, parseInt(req.query.skip || "0", 10));

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
    if (!rucs.length)
      return res
        .status(400)
        .json({ message: "Envía RUCs válidos (11 dígitos)." });

    const rucsNum = rucs.map((r) => Number(r));

    // Trae docs por rucStr | ruc string | ruc number
    const docs = await BaseSecodi.find({
      $or: [
        { rucStr: { $in: rucs } },
        { ruc: { $in: rucs } },
        { ruc: { $in: rucsNum } },
      ],
    })
      .select("_id ruc rucStr razonSocial razon_social")
      .lean();

    const key = (d) => d.rucStr || onlyDigits(d.ruc);
    const foundSet = new Set(docs.map(key));
    const missing = rucs.filter((r) => !foundSet.has(r));

    // Conflictos reales = ya tienen último owner (quien sea)
    const docIds = docs.map((d) => d._id);
    const lastOwners = await Assignment.aggregate([
      { $match: { rucId: { $in: docIds } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$rucId", last: { $first: "$$ROOT" } } },
    ]);

    const hasOwner = new Set(lastOwners.map((x) => String(x._id)));
    const conflicted = docs.filter((d) => hasOwner.has(String(d._id))).map(key);

    const found = docs.map((d) => ({
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
    if (ruc.length !== 11)
      return res.status(400).json({ error: "RUC inválido" });

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



// GET /api/basesecodi/exec-dashboard?search=&page=1&limit=20&sort=restantes:desc
export async function execDashboard(req, res) {
  try {
    const page  = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "20", 10)));
    const skip  = (page - 1) * limit;
    const search = String(req.query.search || "").trim();
    const sortParam = String(req.query.sort || "restantes:desc");
    const [sortField, sortDir] = sortParam.split(":");
    const sort = { [sortField || "restantes"]: (sortDir === "asc" ? 1 : -1) };

    // Filtro opcional por role comercial (si lo deseas)
    // const COMMERCIAL_ROLE_ID = "68a4f22d27e6abe98157a831";

    // Query de usuarios a considerar (activos)
    const usersMatch = {
      // "role": new mongoose.Types.ObjectId(COMMERCIAL_ROLE_ID),
      isActive: { $ne: false },
      ...(search
        ? { $or: [
              { name:  { $regex: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") } },
              { email: { $regex: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") } },
            ] }
        : {})
    };

    // Traemos usuarios una vez para poder mostrar aunque no tengan asignaciones
    const users = await User.find(usersMatch).select("_id name email").lean();
    const userIds = users.map(u => u._id);

    // Agregación sobre Assignment: último assignment por ruc y agrupado por toUserId
    const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);

    const pipeline = [
      // Solo assignments cuyo dueño esté en la lista
      { $match: { toUserId: { $in: userIds } } },

      // Tomar el último por RUC
      { $sort: { rucId: 1, createdAt: -1, _id: -1 } },
      { $group: { _id: "$rucId", last: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$last" } },

      // Unir con BaseSecodi para sumar líneas (opcional)
      { $lookup: { from: "basesecodi", localField: "rucId", foreignField: "_id", as: "base" } },
      { $unwind: { path: "$base", preserveNullAndEmptyArrays: true } },

      // Agrupar por ejecutivo
      { $group: {
          _id: "$toUserId",
          totalAsignados: { $sum: 1 },
          tipificados:    { $sum: { $cond: [{ $ne: ["$tipifiedAt", null] }, 1, 0] } },
          tipificadosHoy: { $sum: { $cond: [
                                  { $and: [
                                    { $ne: ["$tipifiedAt", null] },
                                    { $gte: ["$tipifiedAt", startOfToday] }
                                  ]},
                                  1, 0
                                ] } },
          ultimaAsignacion: { $max: "$createdAt" },
          sumTotalLines:    { $sum: { $ifNull: ["$base.totalLines", 0] } },
        }
      },

      // Calcular restantes
      { $project: {
          _id: 1,
          totalAsignados: 1,
          tipificados: 1,
          restantes: { $subtract: ["$totalAsignados", "$tipificados"] },
          tipificadosHoy: 1,
          ultimaAsignacion: 1,
          sumTotalLines: 1,
        }
      },

      // Orden
      { $sort: sort },

      // Paginación
      { $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: "n" }]
      }}
    ];

    const agg = await Assignment.aggregate(pipeline);
    const itemsAgg = agg[0]?.items || [];
    const total = agg[0]?.total?.[0]?.n || 0;

    // Mezclamos con los usuarios para nombre/email
    const infoById = new Map(users.map(u => [String(u._id), u]));
    const items = itemsAgg.map(x => {
      const u = infoById.get(String(x._id)) || {};
      return {
        userId: String(x._id),
        name: u.name || "(sin nombre)",
        email: u.email || "",
        totalAsignados: x.totalAsignados || 0,
        tipificados: x.tipificados || 0,
        restantes: x.restantes || 0,
        tipificadosHoy: x.tipificadosHoy || 0,
        ultimaAsignacion: x.ultimaAsignacion || null,
        sumTotalLines: x.sumTotalLines || 0,
      };
    });

    return res.json({
      items,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error("[execDashboard]", err);
    res.status(500).json({ message: "Error obteniendo dashboard de ejecutivos" });
  }
}
