// backend/controllers/baseSecodiController.js
import mongoose from "mongoose";
import BaseSecodi from "../models/BaseSecodi.js";
import AssignmentBatch from "../models/AssignmentBatch.js";
import AssignmentLog from "../models/AssignmentLog.js";
import Assignment from "../models/Assignment.js";
import Opportunity from "../models/Opportunity.js";
import User from "../models/User.js";
import EquipoSecodi from "../models/EquipoSecodi.js";

/* -------------------- Utils básicos -------------------- */
const onlyDigits = (v) => String(v || "").replace(/\D/g, "");
const isOID = (v) => mongoose.isValidObjectId(v);
const isRuc11 = (v) => /^\d{11}$/.test(String(v));

const findBaseByRuc = (rucPlain) => {
  return BaseSecodi.findOne(
    { $or: [{ rucStr: rucPlain }, { ruc: rucPlain }, { ruc: Number(rucPlain) }] },
    { _id: 1 }
  ).lean();
};

function parseRucs(raw = []) {
  return Array.from(
    new Set((raw || []).map((r) => onlyDigits(r)).filter((r) => /^\d{11}$/.test(r)))
  );
}

/* -------------------- Roles y scope -------------------- */
const ROLES = {
  comercial: "68a4f22d27e6abe98157a831",
  administracion: "68a4f22d27e6abe98157a82d",
  gerencia: "68a4f22d27e6abe98157a82f",
  sistemas: "68a4f22d27e6abe98157a82c",
  rrhh: "68a4f22d27e6abe98157a82e",
  supervisorcomercial: "68a4f22d27e6abe98157a832",
  postventa: "68acded5b9da48dd36769c47",
  capacitador: "68bb4fe47bddfef9d9c80239",
};

function roleOf(u) {
  return String(u?.role?._id ?? u?.role ?? u?.roleId ?? u?.role_id ?? "");
}

function isOneOf(u, roleIds) {
  const r = roleOf(u);
  return roleIds.map(String).includes(r);
}
function commercialRoleMatch() {
  return {
    $or: [
      { role: new mongoose.Types.ObjectId(ROLES.comercial) },
      { role: ROLES.comercial },
    ],
  };
}
const asObjectIdOrString = (v) =>
  mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(String(v)) : String(v);

/**
 * Devuelve el filtro de usuarios COMERCIALES visibles para el requester
 * - sistemas/gerencia: todos los comerciales activos
 * - supervisor: SOLO los comerciales cuyo "equipo" pertenezca a un EquipoSecodi con supervisor == req.user._id
 * - otros: nada
 */
async function buildUsersScopeMatch(req, extra = {}) {
  const baseActive = { isActive: { $ne: false }, ...extra };
  const roleIsCommercial = commercialRoleMatch();

  // Sistemas y Gerencia -> TODOS los comerciales
  if (isOneOf(req.user, [ROLES.sistemas, ROLES.gerencia])) {
    return { ...baseActive, $and: [roleIsCommercial] };
  }

  // Supervisor Comercial -> SOLO su equipo (con fallbacks)
  if (isOneOf(req.user, [ROLES.supervisorcomercial])) {
    const meStr = String(req.user._id);
    let meObj = null;
    try { meObj = new mongoose.Types.ObjectId(meStr); } catch {}

    // 1) Intentar por equipos en EquipoSecodi (supervisor como ObjectId o string)
    let equipoDocs = [];
    try {
      equipoDocs = await EquipoSecodi.find({
        $or: [
          ...(meObj ? [{ supervisor: meObj }] : []),
          { supervisor: meStr },
        ],
      }).select("_id name").lean();
    } catch (e) {
      console.warn("[scope] error consultando EquipoSecodi:", e?.message);
    }

    if (equipoDocs.length > 0) {
      const equipoIds = equipoDocs.map(e => e._id);
      console.log("[scope] equipos del supervisor:", equipoDocs.map(e => ({ id: e._id, name: e.name })));
      return {
        ...baseActive,
        $and: [ roleIsCommercial, { equipo: { $in: equipoIds } } ],
      };
    }

    // 2) Fallback por campos jerárquicos en User
    const anyOfMine = {
      $or: [
        ...(meObj ? [
          { supervisorId: meObj },
          { reportsTo: meObj },
          { managerId: meObj },
          { bossId: meObj },
          { teamLeads: meObj },
          { supervisors: meObj },
        ] : []),
        { supervisorId: meStr },
        { reportsTo: meStr },
        { managerId: meStr },
        { bossId: meStr },
        { teamLeads: meStr },
        { supervisors: meStr },
      ],
    };

    try {
      const cnt = await User.countDocuments({ ...baseActive, $and: [roleIsCommercial, anyOfMine] });
      if (cnt > 0) {
        console.log("[scope] usando fallback jerárquico en User; miembros:", cnt);
        return { ...baseActive, $and: [ roleIsCommercial, anyOfMine ] };
      }
    } catch (e) {
      console.warn("[scope] error en fallback jerárquico:", e?.message);
    }

    // 3) Último fallback (temporal): mostrar TODOS los comerciales
    console.warn("[scope] supervisor SIN equipos ni jerarquía -> usando fallback TODOS los comerciales (temporal)");
    return { ...baseActive, $and: [ roleIsCommercial ] };

    // ⛔️ Si prefieres vaciar en vez de mostrar todos, usa:
    // return { _id: { $exists: false } };
  }

  // Otros roles -> nada
  return { _id: { $exists: false } };
}


/* -------------------- Endpoints -------------------- */
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

/* ------------ Asignaciones ------------ */
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
    return res.status(400).json({ message: "Envía RUCs válidos (11 dígitos)." });
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
    const rucPlain = String(raw);

    try {
      let rucId = null;

      if (isOID(raw)) {
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

      const prev = await Assignment.findOne({ rucId }).sort({
        createdAt: -1,
        _id: -1,
      });

      if (!prev) {
        await Assignment.create({
          rucId,
          ruc: rucPlain,
          toUserId: toUserOid,
          assignedBy: asignadorId,
          assignedAt: new Date(),
          releasedAt: null,
          tipificationNote: note || "",
          tipificationId: null,
          subtipificationId: null,
          tipifiedAt: null,
          tipifiedBy: null,
        });

        result.matched += 1;
        result.modified += 1;
        continue;
      }

      const set = {
        rucId,
        ruc: rucPlain,
        toUserId: toUserOid,
        assignedBy: asignadorId,
        assignedAt: new Date(),
        releasedAt: null,
      };

      const sentNewTipif = Boolean(
        req.body.tipificationId || req.body.subtipificationId
      );

      if (sentNewTipif) {
        set.tipificationId = req.body.tipificationId ?? null;
        set.subtipificationId = req.body.subtipificationId ?? null;
        set.tipificationNote =
          typeof note === "string" ? note : prev.tipificationNote || "";
        set.tipifiedAt = new Date();
        set.tipifiedBy = asignadorId;
      } else if (overwrite && ignoreTipificacion) {
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
    } catch (err) {
      console.error("[assignRucs] error con RUC:", rucPlain, err);
      result.conflicted.push(rucPlain);
    }
  }

  return res.json(result);
}

/* ------------ Listar base no tipificada de un usuario ------------ */
// GET /api/basesecodi/assigned?userId=me&page=&limit=&q=
export async function listAssigned(req, res) {
  try {
    const { userId = "me", page = 1, limit = 24, q = "" } = req.query;

    // Supervisores solo pueden ver su equipo
    const requesterIsSupervisor = isOneOf(req.user, [ROLES.supervisorcomercial]);
    if (requesterIsSupervisor && userId !== "me") {
      const isSelf = String(userId) === String(req.user._id);
      if (!isSelf) {
        const scope = await buildUsersScopeMatch(req);
        const target = await User.findOne({ _id: userId, ...scope })
          .select("_id")
          .lean();
        if (!target) {
          return res
            .status(403)
            .json({ message: "No autorizado para ver este usuario." });
        }
      }
    }

    const oidStr = String(userId === "me" ? req.user._id : userId);
    const oidObj = mongoose.isValidObjectId(oidStr)
      ? new mongoose.Types.ObjectId(oidStr)
      : null;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const nameRx = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;

    const pipeline = [
      { $sort: { rucId: 1, assignedAt: -1, createdAt: -1, _id: -1 } },
      { $group: { _id: "$rucId", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },

      {
        $match: {
          $or: [...(oidObj ? [{ toUserId: oidObj }] : []), { toUserId: oidStr }],
        },
      },

      { $match: { $or: [{ tipifiedAt: { $exists: false } }, { tipifiedAt: null }] } },

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
                  {
                    $expr: { $regexMatch: { input: { $toString: "$r.ruc" }, regex: q } },
                  },
                ],
              },
            },
          ]
        : []),

      { $facet: { items: [{ $skip: skip }, { $limit: parseInt(limit, 10) }], total: [{ $count: "n" }] } },
    ];

    const agg = await Assignment.aggregate(pipeline);
    const itemsAgg = agg?.[0]?.items ?? [];
    const total = agg?.[0]?.total?.[0]?.n ?? 0;

    const items = itemsAgg.map((a) => ({
      ...a.r,
      assignedAt: a.assignedAt ?? a.createdAt,
      assignedBy: a.assignedBy,
      note: a.note,
    }));

    return res.json({
      items,
      total,
      page: parseInt(page, 10),
      pages: Math.max(1, Math.ceil(total / parseInt(limit, 10))),
    });
  } catch (err) {
    console.error("[listAssigned]", err);
    return res.status(500).json({ message: "Error cargando base asignada" });
  }
}

/* ------------ KPIs personales (Mi Base) ------------ */
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
          completedTotal: { $sum: { $cond: [{ $ne: ["$tipifiedAt", null] }, 1, 0] } },
          completedToday: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ["$tipifiedAt", null] }, { $gte: ["$tipifiedAt", startOfToday] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          total: { $subtract: ["$totalAssigned", "$completedTotal"] },
          totalAssigned: 1,
          lastAssignedAt: 1,
          completedToday: 1,
        },
      },
    ];

    const s = (await Assignment.aggregate(pipeline))[0] || {};
    res.json({
      total: s.total || 0,
      totalAssigned: s.totalAssigned || 0,
      lastAssignedAt: s.lastAssignedAt || null,
      completedToday: s.completedToday || 0,
    });
  } catch (e) {
    console.error("getStats error:", e);
    res.status(500).json({ message: "Error en stats" });
  }
}

/* ------------ (legacy) KPIs desde BaseSecodi ------------ */
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

/* ------------ Batches & Logs ------------ */
export async function listBatches(req, res) {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || "50", 10)));
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
      .sort({ createdAt: -1 })
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

/* ------------ Buscar por RUCs ------------ */
export async function findByRucs(req, res) {
  try {
    const rucs = parseRucs(req.body?.rucs || []);
    if (!rucs.length)
      return res.status(400).json({ message: "Envía RUCs válidos (11 dígitos)." });

    const rucsNum = rucs.map((r) => Number(r));

    const docs = await BaseSecodi.find({
      $or: [{ rucStr: { $in: rucs } }, { ruc: { $in: rucs } }, { ruc: { $in: rucsNum } }],
    })
      .select("_id ruc rucStr razonSocial razon_social")
      .lean();

    const key = (d) => d.rucStr || onlyDigits(d.ruc);
    const foundSet = new Set(docs.map(key));
    const missing = rucs.filter((r) => !foundSet.has(r));

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

/* ------------ Marcar tipificada ------------ */
export const markTipificada = async (req, res) => {
  try {
    const userId = String(req.user?._id || req.user?.id);
    const rucRaw = String(req.body?.ruc || "");
    const ruc = rucRaw.replace(/\D/g, "");
    if (ruc.length !== 11) return res.status(400).json({ error: "RUC inválido" });

    const base = await BaseSecodi.findOne({
      $or: [{ rucStr: ruc }, { ruc }, { ruc: Number(ruc) }],
    }).select("_id");
    if (!base) return res.status(404).json({ error: "RUC no encontrado" });

    const last = await Assignment.findOne({ rucId: base._id })
      .sort({ createdAt: -1, _id: -1 })
      .select("toUserId")
      .lean();

    if (!last || String(last.toUserId) !== userId) {
      return res.status(403).json({ error: "Este RUC no está asignado a ti" });
    }

    const now = new Date();

    await BaseSecodi.updateOne(
      { _id: base._id },
      { $set: { assignedStatus: "completed", tipificadaAt: now } }
    );

    await Assignment.findOneAndUpdate(
      { rucId: base._id },
      {
        $set: {
          tipificationId: req.body?.tipificationId ?? null,
          subtipificationId: req.body?.subtipificationId ?? null,
          tipificationNote: typeof req.body?.note === "string" ? req.body.note : "",
          tipifiedAt: now,
          tipifiedBy: userId,
        },
      },
      { sort: { createdAt: -1, _id: -1 } }
    );

    return res.json({ ok: true });
  } catch (e) {
    console.error("markTipificada", e);
    return res.status(500).json({ error: "Error marcando tipificada" });
  }
};

/* ------------ Dashboard de Ejecutivos ------------ */
// GET /api/basesecodi/exec-dashboard?search=&page=1&limit=20&sort=restantes:desc
export async function execDashboard(req, res) {
  console.log("[execDashboard] user:", {
    id: String(req.user?._id),
    role_raw: req.user?.role,
    role_id: req.user?.role?._id ?? req.user?.role ?? req.user?.roleId ?? req.user?.role_id,
  });

  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "12", 10)));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || "").trim();
    const sortParam = String(req.query.sort || "restantes:desc");
    const [sortField, sortDir] = sortParam.split(":");
    const dir = sortDir === "asc" ? 1 : -1;

  const scopeMatch = await buildUsersScopeMatch(req);
if (scopeMatch._id && scopeMatch._id.$exists === false) {
  console.warn("[execDashboard] scope vacío para este usuario/rol");
  return res.json({ items: [], total: 0, page, pages: 1 });
}

    const usersMatch = {
      ...scopeMatch,
      ...(search
        ? {
            $or: [
              { name: { $regex: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") } },
              { email: { $regex: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") } },
            ],
          }
        : {}),
    };

    const countCandidates = await User.countDocuments(usersMatch);
    console.log("[execDashboard] usersMatch:", JSON.stringify(usersMatch));
    console.log("[execDashboard] candidates:", countCandidates);

    const allUsers = await User.find(usersMatch)
      .select("_id name email equipo")
      .sort({ name: 1 })
      .lean();

    if (!allUsers.length) {
      return res.json({ items: [], total: 0, page, pages: 1 });
    }

    // toUserId puede estar guardado como ObjectId o string
    const idsObj = allUsers
      .map((u) => {
        try {
          return new mongoose.Types.ObjectId(String(u._id));
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    const idsStr = allUsers.map((u) => String(u._id));

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const kpiAgg = await Assignment.aggregate([
      { $match: { $or: [{ toUserId: { $in: idsObj } }, { toUserId: { $in: idsStr } }] } },
      { $sort: { rucId: 1, createdAt: -1, _id: -1 } },
      { $group: { _id: "$rucId", last: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$last" } },
      {
        $lookup: {
          from: "basesecodi",
          localField: "rucId",
          foreignField: "_id",
          as: "base",
        },
      },
      { $unwind: { path: "$base", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$toUserId",
          totalAsignados: { $sum: 1 },
          tipificados: { $sum: { $cond: [{ $ne: ["$tipifiedAt", null] }, 1, 0] } },
          tipificadosHoy: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ["$tipifiedAt", null] }, { $gte: ["$tipifiedAt", startOfToday] }] },
                1,
                0,
              ],
            },
          },
          ultimaAsignacion: { $max: { $ifNull: ["$assignedAt", "$createdAt"] } },
          sumTotalLines: { $sum: { $ifNull: ["$base.totalLines", 0] } },
        },
      },
    ]);

    const kpiMap = new Map(kpiAgg.map((x) => [String(x._id), x]));

    const blended = allUsers.map((u) => {
      const kpi = kpiMap.get(String(u._id)) || {};
      const totalAsignados = kpi.totalAsignados || 0;
      const tipificados = kpi.tipificados || 0;
      return {
        userId: String(u._id),
        name: u.name || "(sin nombre)",
        email: u.email || "",
        totalAsignados,
        tipificados,
        restantes: totalAsignados - tipificados,
        tipificadosHoy: kpi.tipificadosHoy || 0,
        ultimaAsignacion: kpi.ultimaAsignacion || null,
        sumTotalLines: kpi.sumTotalLines || 0,
      };
    });

    blended.sort((a, b) => {
      const av = a[sortField] ?? 0;
      const bv = b[sortField] ?? 0;
      return dir === 1 ? av - bv : bv - av;
    });

    const total = blended.length;
    const items = blended.slice(skip, skip + limit);
    const pages = Math.max(1, Math.ceil(total / limit));

    // Debug opcional
    if (roleOf(req.user) === ROLES.supervisorcomercial) {
      try {
        const me = new mongoose.Types.ObjectId(String(req.user._id));
        const equipos = await EquipoSecodi.find({ supervisor: me }).select("_id name").lean();
        console.log("[execDashboard] equipos del supervisor:", equipos);
      } catch (e) {
        console.warn("[execDashboard] no se pudo listar equipos del supervisor:", e?.message);
      }
    }

    return res.json({ items, total, page, pages });
  } catch (err) {
    console.error("[execDashboard]", err);
    return res.status(500).json({ message: "Error obteniendo dashboard de ejecutivos" });
  }
}

/* ------------ Reasignación individual ------------ */
export async function reassignOne(req, res) {
  try {
    const asignadorId = req.user?._id;
    if (!asignadorId) return res.status(401).json({ message: "No autenticado" });

    const { ruc = "", toUserId = "", overwrite = true, ignoreTipificacion = true, note = "" } =
      req.body || {};

    if (!mongoose.isValidObjectId(toUserId)) {
      return res.status(400).json({ message: "userId inválido" });
    }

    const dest = await User.findById(toUserId).select("_id isActive role").lean();
    if (
      !dest ||
      dest.isActive === false ||
      String(dest.role?._id ?? dest.role) !== ROLES.comercial
    ) {
      return res
        .status(400)
        .json({ message: "El destino debe ser un usuario Comercial activo." });
    }

    req.body = { rucs: [String(ruc)], userId: toUserId, overwrite, ignoreTipificacion, note };
    return await assignRucs(req, res);
  } catch (err) {
    console.error("[reassignOne]", err);
    return res.status(500).json({ message: "Error al reasignar" });
  }
}
