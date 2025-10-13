// controllers/reportes.citas.js
import mongoose from "mongoose";
import Cita from "../models/Cita.js";

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

/** Acepta: userId, userIds, userIds[], userIds[0]…, userIdsCsv y req.user._id|id */
function getScopedUserIds(req) {
  const fromToken = req.user?._id || req.user?.id || null;

  const one = req.query.userId;
  let many = req.query.userIds ?? req.query["userIds[]"];

  const indexed = Object.keys(req.query)
    .filter(k => /^userIds\[\d+\]$/.test(k))
    .map(k => req.query[k]);

  const csvAlt = (req.query.userIdsCsv || "").trim();

  let list = [];
  if (Array.isArray(many)) list = many;
  else if (typeof many === "string") list = many.split(",").map(s => s.trim()).filter(Boolean);

  if (indexed.length) list = list.concat(indexed);
  if (csvAlt) list = list.concat(csvAlt.split(",").map(s => s.trim()).filter(Boolean));
  if (one) list.push(one);
  if (!list.length && fromToken) list = [fromToken];

  return list.filter(isOID).map(id => new mongoose.Types.ObjectId(id));
}
function buildUserCriterion(ids) {
  if (!ids?.length) return { $expr: { $eq: [1, 0] } };
  return { userId: ids.length === 1 ? ids[0] : { $in: ids } };
}

/** Serie de citas por día (campo `inicio`) */
export async function serieCitas(req, res) {
  try {
    const ids = getScopedUserIds(req);
    const userCrit = buildUserCriterion(ids);

    const fmtYmdTZ = (d) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

    // Rango
    if (req.query.from && req.query.to) {
      const start = new Date(`${req.query.from}T00:00:00`);
      const end   = new Date(`${req.query.to}T23:59:59.999`);

      const itemsAgg = await Cita.aggregate([
        { $match: { ...userCrit, inicio: { $gte: start, $lte: end } } },
        { $group: { _id: { $dateTrunc: { date: "$inicio", unit: "day", timezone: TZ } }, total: { $sum: 1 } } },
        { $project: { _id: 0, date: { $dateToString: { date: "$_id", format: "%Y-%m-%d", timezone: TZ } }, total: 1 } },
        { $sort: { date: 1 } },
      ]);

      const map = new Map(itemsAgg.map(it => [it.date, it.total]));
      const filled = [];
      for (let cur = new Date(start.getTime()); cur <= end; cur.setDate(cur.getDate() + 1)) {
        const key = fmtYmdTZ(cur);
        filled.push({ date: key, total: map.get(key) ?? 0 });
      }
      return res.json({ items: filled });
    }

    // Mes/Año
    const month = Number(req.query.month || req.query.mes);
    const year  = Number(req.query.year  || req.query.anio);
    if (!month || !year) return res.status(400).json({ message: "month/year o from/to requeridos" });

    const { start, end } = monthRangeLocalTZ(year, month);
    const agg = await Cita.aggregate([
      { $match: { ...userCrit, inicio: { $gte: start, $lt: end } } },
      { $group: { _id: { $dayOfMonth: { date: "$inicio", timezone: TZ } }, total: { $sum: 1 } } },
      { $project: { _id: 0, day: "$_id", total: 1 } },
      { $sort: { day: 1 } },
    ]);

    const dim = daysInMonth(year, month);
    const mapMonth = new Map(agg.map(it => [it.day, it.total]));
    const filledMonth = Array.from({ length: dim }, (_, i) => ({ day: i + 1, total: mapMonth.get(i + 1) ?? 0 }));
    res.json({ items: filledMonth });
  } catch (err) {
    console.error("[reportes.citas.serie]", err);
    res.status(500).json({ message: "Error generando serie de citas" });
  }
}

/** Distribución por TIPO (presencial/virtual) en el periodo, usando `inicio` */
export async function distribucionCitas(req, res) {
  try {
    const ids = getScopedUserIds(req);
    const userCrit = buildUserCriterion(ids);

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

    const grouped = await Cita.aggregate([
      { $match: { ...userCrit, inicio: { $gte: start, $lte: end } } },
      { $group: { _id: { $toLower: { $ifNull: ["$tipo", "presencial"] } }, value: { $sum: 1 } } },
      { $project: {
          _id: 0,
          name: { $cond: [{ $in: ["$_id", ["presencial", "virtual"]] }, "$_id", "otro"] },
          value: 1
        }
      },
      { $sort: { value: -1 } },
    ]);

    res.json({ items: grouped });
  } catch (err) {
    console.error("[reportes.citas.distribucion]", err);
    res.status(500).json({ message: "Error generando distribución de citas" });
  }
}
