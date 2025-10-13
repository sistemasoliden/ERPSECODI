// controllers/reportes.tipificacionsupervisor.js
import mongoose from "mongoose";
import Assignment from "../models/Assignment.js";
import Equipo from "../models/EquipoSecodi.js";
import User from "../models/User.js";

const TZ = "America/Lima";

// helpers de fecha
function monthRangeLocalTZ(year, month) {
  const start = new Date(year, month - 1, 1, 0, 0, 0);
  const end   = new Date(year, month, 1, 0, 0, 0);
  return { start, end };
}

/**
 * 📊 GET /api/reportes/tipificacion/por-ejecutivo
 * Resumen por ejecutivo del equipo del supervisor logueado.
 * Acepta filtros:
 *   - ?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   - o ?month=MM&year=YYYY
 */
export async function distribucionPorEjecutivo(req, res) {
  try {
    const supervisorId = req.user?._id;
    if (!supervisorId) return res.status(401).json({ message: "No autenticado" });

    // 1) Encuentra los equipos donde el usuario es supervisor
    const equipos = await Equipo.find({ supervisor: supervisorId }).select("_id").lean();
    if (!equipos.length) return res.json({ items: [] });

    const equipoIds = equipos.map(e => e._id);

    // 2) Miembros del/los equipo(s)
    const miembros = await User.find({ equipo: { $in: equipoIds } })
      .select({ _id: 1, name: 1 })
      .lean();

    if (!miembros.length) return res.json({ items: [] });

    const memberIds = miembros.map(m => m._id);
    const nameById = new Map(miembros.map(m => [String(m._id), m.name || "SIN NOMBRE"]));

    // 3) Rango de fechas
    let start, end, useLTE = false;
    if (req.query.from && req.query.to) {
      start = new Date(`${req.query.from}T00:00:00`);
      end   = new Date(`${req.query.to}T23:59:59.999`);
      useLTE = true; // cuando viene rango, usamos $lte para incluir el día final
    } else {
      const month = Number(req.query.month || req.query.mes);
      const year  = Number(req.query.year || req.query.anio);
      const r = monthRangeLocalTZ(year || new Date().getFullYear(), month || (new Date().getMonth() + 1));
      start = r.start;
      end   = r.end;   // fin exclusivo para mes/año
    }

    // 4) Agregación: agrupamos por ($ifNull(tipifiedBy, toUserId)) para contar bajo quien hizo la tipificación
    const match = {
      tipificationId: { $exists: true, $ne: null },
      // fecha
      tipifiedAt: useLTE ? { $gte: start, $lte: end } : { $gte: start, $lt: end },
      // alcance por usuarios del equipo
      $or: [
        { tipifiedBy: { $in: memberIds } },
        { $and: [
            { $or: [{ tipifiedBy: { $exists: false } }, { tipifiedBy: null }] },
            { toUserId: { $in: memberIds } }
          ]
        }
      ]
    };

    const grouped = await Assignment.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ["$tipifiedBy", "$toUserId"] },
          total: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } }
    ]);

    // 5) Unimos con TODOS los miembros (para que aparezcan en 0 si no tienen)
    // ...todo tu código arriba igual...

// 5) Unimos con TODOS los miembros (para que aparezcan en 0 si no tienen)
const totalsById = new Map(grouped.map(g => [String(g._id), g.total]));

const items = miembros.map(m => ({
  ejecutivoId: String(m._id),                          // 👈 añade el id
  ejecutivo: m.name || "SIN NOMBRE",
  total: totalsById.get(String(m._id)) || 0
})).sort((a,b) => b.total - a.total);

// 👇 añade members con {_id, name}
res.json({
  items,
  members: miembros.map(m => ({ _id: String(m._id), name: m.name || "SIN NOMBRE" }))
});

  } catch (err) {
    console.error("[reportes.tipificacion.supervisor] distribucionPorEjecutivo", err);
    res.status(500).json({ message: "Error generando reporte supervisor" });
  }
}
