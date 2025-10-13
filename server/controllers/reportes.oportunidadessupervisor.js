// controllers/reportes.oportunidades.supervisor.js
import mongoose from "mongoose";
import Opportunity from "../models/Opportunity.js";
import Equipo from "../models/EquipoSecodi.js";
import User from "../models/User.js";

const TZ = "America/Lima";

function monthRangeLocalTZ(year, month) {
  const start = new Date(year, month - 1, 1, 0, 0, 0);
  const end   = new Date(year, month, 1, 0, 0, 0);
  return { start, end };
}

export async function distribucionPorEjecutivoOportunidades(req, res) {
  try {
    const supervisorId = req.user?._id;
    if (!supervisorId) return res.status(401).json({ message: "No autenticado" });

    const equipos = await Equipo.find({ supervisor: supervisorId }).select("_id").lean();
    if (!equipos.length) return res.json({ items: [], members: [] });

    const equipoIds = equipos.map(e => e._id);
    const miembros = await User.find({ equipo: { $in: equipoIds } })
      .select({ _id: 1, name: 1 })
      .lean();
    if (!miembros.length) return res.json({ items: [], members: [] });

    const memberIds = miembros.map(m => m._id);

    let start, end, useLTE = false;
    if (req.query.from && req.query.to) {
      start = new Date(`${req.query.from}T00:00:00`);
      end   = new Date(`${req.query.to}T23:59:59.999`);
      useLTE = true;
    } else {
      const month = Number(req.query.month || req.query.mes);
      const year  = Number(req.query.year  || req.query.anio);
      const r = monthRangeLocalTZ(year || new Date().getFullYear(), month || (new Date().getMonth() + 1));
      start = r.start; end = r.end;
    }

    const grouped = await Opportunity.aggregate([
      { $match: {
          ownerId: { $in: memberIds },
          createdAt: useLTE ? { $gte: start, $lte: end } : { $gte: start, $lt: end },
        }
      },
      { $group: { _id: "$ownerId", total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);

    const totalsById = new Map(grouped.map(g => [String(g._id), g.total]));
    const items = miembros.map(m => ({
      ejecutivoId: String(m._id),
      ejecutivo: m.name || "SIN NOMBRE",
      total: totalsById.get(String(m._id)) || 0,
    })).sort((a,b) => b.total - a.total);

    res.json({
      items,
      members: miembros.map(m => ({ _id: String(m._id), name: m.name || "SIN NOMBRE" })),
    });
  } catch (err) {
    console.error("[reportes.oportunidades.supervisor] distribucionPorEjecutivoOportunidades", err);
    res.status(500).json({ message: "Error generando reporte supervisor (oportunidades)" });
  }
}
