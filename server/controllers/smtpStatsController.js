// controllers/smtpStatsController.js
import SmtpLog from "../models/SmtpLog.js";
import mongoose from "mongoose";

export async function getStats(req, res) {
  const uid = req.user?._id || req.user?.id;
  if (!uid) return res.status(401).json({ error: "not_authenticated" });

  try {
    const byDay = await SmtpLog.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(uid) } },
      {
        $group: {
          _id: {
            y: { $year: "$date" },
            m: { $month: "$date" },
            d: { $dayOfMonth: "$date" },
          },
          total: { $sum: 1 },
          ok: { $sum: { $cond: ["$ok", 1, 0] } },
          fail: { $sum: { $cond: ["$ok", 0, 1] } },
        },
      },
      { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
    ]);

    res.json({ byDay });
  } catch (err) {
    console.error("Error al obtener stats SMTP:", err);
    res.status(500).json({ error: "stats_failed", message: err.message });
  }
}
