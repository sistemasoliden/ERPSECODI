// controllers/reportes.oportunidades.js
import mongoose from "mongoose";
import Opportunity from "../models/Opportunity.js";

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
/** Acepta: userId, userIds[]=, userIds=csv, userIdsCsv=csv, userIds[0]=, ... y req.user._id|id */
function getScopedUserIds(req) {
  const fromToken = req.user?._id || req.user?.id || null;

  const one = req.query.userId;

  // Captura userIds y userIds[] (axios por defecto)
  let many = req.query.userIds ?? req.query["userIds[]"];

  // Captura userIds[0], userIds[1], ... (otros serializadores)
  const indexed = Object.keys(req.query)
    .filter(k => /^userIds\[\d+\]$/.test(k))
    .map(k => req.query[k]);

  const csvAlt = (req.query.userIdsCsv || "").trim();

  let list = [];
  if (Array.isArray(many)) list = many;
  else if (typeof many === "string") list = many.split(",").map(s => s.trim()).filter(Boolean);

  // Agrega indexed (userIds[0]=...)
  if (indexed.length) list = list.concat(indexed);

  // Agrega CSV alterno si llega
  if (csvAlt) list = list.concat(csvAlt.split(",").map(s => s.trim()).filter(Boolean));

  // Agrega 'one' si llega
  if (one) list.push(one);

  // Si nada llegó, cae al usuario del token (para vista personal)
  if (!list.length && fromToken) list = [fromToken];

  // Normaliza a ObjectId válidos
  return list
    .filter((v) => mongoose.isValidObjectId(v))
    .map((id) => new mongoose.Types.ObjectId(id));
}

function buildOwnerCriterion(ids) {
  if (!ids?.length) return { $expr: { $eq: [1, 0] } };
  return { ownerId: ids.length === 1 ? ids[0] : { $in: ids } };
}

/**
 * Serie: oportunidades creadas por día (createdAt)
 * - Rango (from/to): { date:'YYYY-MM-DD', total }
 * - Mes/Año:         { day, total }
 * Rellena días faltantes con total: 0.
 */
export async function serieOportunidades(req, res) {
  try {
    const scopedIds = getScopedUserIds(req);
    const ownerCrit = buildOwnerCriterion(scopedIds);

    const fmtYmdTZ = (d) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
      }).format(d); // YYYY-MM-DD

    if (req.query.from && req.query.to) {
      const start = new Date(`${req.query.from}T00:00:00`);
      const end   = new Date(`${req.query.to}T23:59:59.999`);

      const itemsAgg = await Opportunity.aggregate([
        { $match: { ...ownerCrit, createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: { $dateTrunc: { date: "$createdAt", unit: "day", timezone: TZ } }, total: { $sum: 1 } } },
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

    const month = Number(req.query.month || req.query.mes);
    const year  = Number(req.query.year  || req.query.anio);
    if (!month || !year) return res.status(400).json({ message: "month/year o from/to requeridos" });

    const { start, end } = monthRangeLocalTZ(year, month);
    const agg = await Opportunity.aggregate([
      { $match: { ...ownerCrit, createdAt: { $gte: start, $lt: end } } },
      { $group: { _id: { $dayOfMonth: { date: "$createdAt", timezone: TZ } }, total: { $sum: 1 } } },
      { $project: { _id: 0, day: "$_id", total: 1 } },
      { $sort: { day: 1 } },
    ]);

    const dim = daysInMonth(year, month);
    const mapMonth = new Map(agg.map(it => [it.day, it.total]));
    const filledMonth = Array.from({ length: dim }, (_, i) => ({ day: i + 1, total: mapMonth.get(i + 1) ?? 0 }));

    res.json({ items: filledMonth });
  } catch (err) {
    console.error("[reportes.oportunidades.serie]", err);
    res.status(500).json({ message: "Error generando serie de oportunidades" });
  }
}

/** Distribución: oportunidades por etapa (estadoNombre) en el periodo */
export async function distribucionOportunidades(req, res) {
  try {
    const scopedIds = getScopedUserIds(req);
    const ownerCrit = buildOwnerCriterion(scopedIds);

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

    const grouped = await Opportunity.aggregate([
      { $match: { ...ownerCrit, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $ifNull: ["$estadoNombre", "SIN ETAPA"] }, value: { $sum: 1 } } },
      { $project: { _id: 0, name: "$_id", value: 1 } },
      { $sort: { value: -1 } },
    ]);

    res.json({ items: grouped });
  } catch (err) {
    console.error("[reportes.oportunidades.distribucion]", err);
    res.status(500).json({ message: "Error generando distribución de oportunidades" });
  }
}
