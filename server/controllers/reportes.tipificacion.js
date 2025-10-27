// controllers/reportes.tipificacion.js
import mongoose from "mongoose";
import Assignment from "../models/Assignment.js";
import Tipification from "../models/Tipification.js";

const TZ = "America/Lima";
const isOID = (v) => mongoose.isValidObjectId(v);

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}
function monthRangeLocalTZ(year, month) {
  const start = new Date(year, month - 1, 1, 0, 0, 0);
  const end   = new Date(year, month, 1, 0, 0, 0);
  return { start, end };
}

/** Acepta: userId, userIds[]=, userIds=csv, userIdsCsv=csv y req.user._id|id */
function getScopedUserIds(req) {
  const fromToken = req.user?._id || req.user?.id || null;

  const one = req.query.userId;
let many = req.query.userIds ?? req.query["userIds[]"]; // 👈 soporta axios
  const csvAlt = (req.query.userIdsCsv || "").trim();

  let list = [];
  if (Array.isArray(many)) list = many;
  else if (typeof many === "string") list = many.split(",").map(s => s.trim()).filter(Boolean);
  if (csvAlt) list = list.concat(csvAlt.split(",").map(s => s.trim()).filter(Boolean));
  if (one) list.push(one);
  if (!list.length && fromToken) list = [fromToken];

  return list.filter(isOID).map(id => new mongoose.Types.ObjectId(id));
}

/** Crea la condición de usuario: preferimos tipifiedBy; si no existe, caemos a toUserId */
function buildUserCriterion(ids) {
  if (!ids?.length) {
    // Sin alcance => no devolvemos nada (evita traer todo el mundo por accidente)
    return { $expr: { $eq: [1, 0] } };
  }
  const inCond = ids.length === 1 ? ids[0] : { $in: ids };
  return {
    $or: [
      { tipifiedBy: inCond },
      {
        $and: [
          { $or: [{ tipifiedBy: { $exists: false } }, { tipifiedBy: null }] },
          { toUserId: inCond },
        ],
      },
    ],
  };
}

export async function serieTipificacion(req, res) {
  try {
    const scopedIds = getScopedUserIds(req);
    const userCrit = buildUserCriterion(scopedIds);

    // === RANGO explícito ===
    if (req.query.from && req.query.to) {
      const start = new Date(`${req.query.from}T00:00:00-05:00`);
      const end = new Date(`${req.query.to}T23:59:59.999-05:00`);

      const data = await Assignment.aggregate([
        {
          $match: {
            ...userCrit,
            tipificationId: { $exists: true, $ne: null },
            tipifiedAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$tipifiedAt",
                timezone: "America/Lima",
              },
            },
            total: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Compacto: rellena días faltantes sin Intl ni DateTimeFormat
      const map = new Map(data.map((d) => [d._id, d.total]));
      const result = [];
      let cur = new Date(start);
      while (cur <= end) {
        const key = cur.toISOString().slice(0, 10);
        result.push({ date: key, total: map.get(key) || 0 });
        cur.setDate(cur.getDate() + 1);
      }

      return res.json({ items: result });
    }

    // === MES/AÑO ===
    const month = Number(req.query.month || req.query.mes);
    const year = Number(req.query.year || req.query.anio);
    if (!month || !year)
      return res.status(400).json({ message: "month/year o from/to requeridos" });

    const { start, end } = monthRangeLocalTZ(year, month);

    const agg = await Assignment.aggregate([
      {
        $match: {
          ...userCrit,
          tipificationId: { $exists: true, $ne: null },
          tipifiedAt: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: { $dayOfMonth: { date: "$tipifiedAt", timezone: "America/Lima" } },
          total: { $sum: 1 },
        },
      },
    ]);

    const dim = new Date(year, month, 0).getDate();
    const map = new Map(agg.map((d) => [d._id, d.total]));
    const items = Array.from({ length: dim }, (_, i) => ({
      day: i + 1,
      total: map.get(i + 1) || 0,
    }));

    return res.json({ items });
  } catch (err) {
    console.error("[reportes.tipificacion.serie]", err);
    res.status(500).json({ message: "Error generando serie de tipificación" });
  }
}

export async function distribucionTipificacion(req, res) {
  try {
    const scopedIds = getScopedUserIds(req);
    const userCrit = buildUserCriterion(scopedIds);

    let start, end;
    if (req.query.from && req.query.to) {
      start = new Date(`${req.query.from}T00:00:00`);
      end   = new Date(`${req.query.to}T23:59:59.999`);
    } else {
      const month = Number(req.query.month || req.query.mes);
      const year  = Number(req.query.year  || req.query.anio);
      if (!month || !year) return res.status(400).json({ message: "month/year o from/to requeridos" });
      ({ start, end } = monthRangeLocalTZ(year, month));
    }

    const grouped = await Assignment.aggregate([
      {
        $match: {
          ...userCrit,
          tipificationId: { $exists: true, $ne: null },
          tipifiedAt: req.query.from && req.query.to ? { $gte: start, $lte: end } : { $gte: start, $lt: end },
        },
      },
      { $group: { _id: "$tipificationId", value: { $sum: 1 } } },
    ]);

    if (!grouped.length) return res.json({ items: [] });

    const ids = grouped
      .map(g => String(g._id))
      .filter(mongoose.isValidObjectId)
      .map(id => new mongoose.Types.ObjectId(id));

    const tips = await Tipification.find({ _id: { $in: ids } }).select({ _id: 1, categorytip: 1 }).lean();

    const nameById = new Map(
      tips.map(t => [String(t._id), String(t.categorytip || "").trim() || "SIN CATEGORÍA"])
    );

    const items = grouped
      .map(g => ({ name: nameById.get(String(g._id)) || "SIN CATEGORÍA", value: g.value || 0 }))
      .sort((a, b) => b.value - a.value);

    res.json({ items });
  } catch (err) {
    console.error("[reportes.tipificacion.distribucion]", err);
    res.status(500).json({ message: "Error generando distribución de tipificación" });
  }
}
