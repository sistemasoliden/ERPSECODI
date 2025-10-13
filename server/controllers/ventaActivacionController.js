// backend/controllers/ventaActivacionController.js
import Venta from "../models/Venta.js";

function actDateProjection() {
  return {
    $addFields: {
      _actDate: {
        $let: {
          vars: {
            act: { $ifNull: ["$FECHA_ACTIVACION", "$FECHA ACTIVACION"] },
          },
          in: {
            $cond: [
              { $eq: [{ $type: "$$act" }, "date"] },
              "$$act", // ya es Date
              {
                $cond: [
                  {
                    $and: [
                      { $eq: [{ $type: "$$act" }, "string"] },
                      { $gt: [{ $strLenCP: "$$act" }, 0] },
                    ],
                  },
                  {
                    $dateFromString: {
                      dateString: "$$act",
                      format: "%Y-%m-%d", // 👈 formato fijo: YYYY-MM-DD
                      onError: null,
                      onNull: null,
                    },
                  },
                  null,
                ],
              },
            ],
          },
        },
      },
    },
  };
}

export async function getActivationYears(req, res) {
  try {
    const agg = await Venta.aggregate([
      actDateProjection(),
      { $match: { _actDate: { $ne: null } } },
      { $project: { year: { $year: "$_actDate" } } },
      { $group: { _id: "$year" } },
      { $sort: { _id: 1 } },
    ]);
    res.json(agg.map((d) => d._id));
  } catch (err) {
    console.error("❌ Error years:", err);
    res.status(500).json({ error: "Error al obtener años de activación" });
  }
}

export async function getActivationMonths(req, res) {
  try {
    const year = parseInt(req.query.year, 10);
    if (!year)
      return res.status(400).json({ error: "Parámetro 'year' requerido" });

    const agg = await Venta.aggregate([
      actDateProjection(),
      { $match: { _actDate: { $ne: null } } },
      { $project: { y: { $year: "$_actDate" }, m: { $month: "$_actDate" } } },
      { $match: { y: year } },
      { $group: { _id: "$m" } },
      { $sort: { _id: 1 } },
    ]);
    res.json(agg.map((d) => d._id));
  } catch (err) {
    console.error("❌ Error months:", err);
    res.status(500).json({ error: "Error al obtener meses de activación" });
  }
}
