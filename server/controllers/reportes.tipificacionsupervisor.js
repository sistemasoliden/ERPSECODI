import mongoose from "mongoose";
import Assignment from "../models/Assignment.js";
import Equipo from "../models/EquipoSecodi.js";
import User from "../models/User.js";
import { ROLES_IDS as AUTH_ROLES } from "../middlewares/auth.js";

const ROLES_IDS = { ...(AUTH_ROLES || {}) }; // Debe incluir .comercial y .sistemas
const dbg = (...a) => console.log("[tipificacion.supervisor]", ...a);

function monthRangeLocalTZ(year, month) {
  const start = new Date(year, month - 1, 1, 0, 0, 0);
  const end   = new Date(year, month, 1, 0, 0, 0);
  return { start, end }; // [start, end)
}

function isSistemas(user) {
  const roleId = String(user?.roleId || user?.role?._id || user?.role || "");
  if (user?.isAdmin) return true;
  if (ROLES_IDS?.sistemas && roleId === String(ROLES_IDS.sistemas)) return true;
  const slug = String(user?.role?.slug || user?.role?.nombre || user?.role?.name || "")
    .trim().toLowerCase();
  return slug === "sistemas";
}

function commercialRoleQuery() {
  const or = [];
  const rid = String(ROLES_IDS?.comercial || "");
  if (rid) {
    if (mongoose.isValidObjectId(rid)) {
      or.push({ role: new mongoose.Types.ObjectId(rid) });
      or.push({ roleId: new mongoose.Types.ObjectId(rid) });
      or.push({ "role._id": new mongoose.Types.ObjectId(rid) });
    }
    or.push({ role: rid }, { roleId: rid }, { "role._id": rid });
  }
  or.push(
    { "role.slug": "comercial" },
    { "role.name": "Comercial" },
    { "role.nombre": "Comercial" }
  );
  return { $or: or };
}

/**
 * GET /api/reportes/tipificacion/por-ejecutivo
 * Query:
 *   - from/to  (YYYY-MM-DD)   o  month/year
 *   - includeAllTeams=1 (solo efectivo para Sistemas)
 * Respuesta:
 *   { items:[{ejecutivoId, ejecutivo, total}], members:[{_id,name}] }
 */
export async function distribucionPorEjecutivo(req, res) {
  try {
    const u = req.user || {};
    if (!u?._id) return res.status(401).json({ message: "No autenticado" });

    dbg("init user=", u.email || u._id, "query=", req.query, "ROLES_IDS=", ROLES_IDS);

    const includeAllTeams =
      isSistemas(u) && String(req.query.includeAllTeams || "") === "1";

    dbg("isSistemas?", isSistemas(u), "includeAllTeams?", includeAllTeams);

    // 1) Miembros base
    let miembros = [];
    if (includeAllTeams) {
      // Sistemas -> TODOS los comerciales, aunque nunca hayan tipificado
      const q = commercialRoleQuery();
      dbg("commercialRoleQuery=", q);
      miembros = await User.find(q)
        .select({ _id: 1, name: 1, email: 1, role: 1, roleId: 1 })
        .lean();
      dbg("miembros(comercial) count=", miembros.length);
      if (miembros.length === 0) {
        dbg("WARN: No se encontraron usuarios con rol Comercial. Verifica ROLES_IDS.comercial y datos de usuarios.");
      }
    } else {
      // Supervisor -> sólo sus equipos
      const equipos = await Equipo.find({ supervisor: u._id })
        .select("_id")
        .lean();
      dbg("equipos del supervisor:", equipos.map(e => e._id.toString()));
      if (!equipos.length) {
     // 🔒 Fallback seguro: si es Sistemas y no tiene equipos, traer todos los comerciales
      if (isSistemas(u)) {
        dbg("No hay equipos y usuario es Sistemas → fallback a comerciales");
        const q = commercialRoleQuery();
        miembros = await User.find(q)
          .select({ _id: 1, name: 1, email: 1, role: 1, roleId: 1 })
          .lean();
        dbg("miembros(comercial,fallback) count=", miembros.length);
     } else {
        return res.json({ items: [], members: [] });
      }
   } else {
      const equipoIds = equipos.map(e => e._id);
      miembros = await User.find({ equipo: { $in: equipoIds } })
        .select({ _id: 1, name: 1, email: 1 })
        .lean();
      dbg("miembros(equipo) count=", miembros.length);
    }
    }

    if (!miembros.length) {
      dbg("No hay miembros → retorna vacío");
      return res.json({ items: [], members: [] });
    }

    const memberIds = miembros.map(m => m._id);
    const nameById = new Map(
      miembros.map(m => [String(m._id), m.name || m.email || "SIN NOMBRE"])
    );

    // 2) Rango de fechas
    let start, end, useLTE = false;
    if (req.query.from && req.query.to) {
      start = new Date(`${req.query.from}T00:00:00.000-05:00`);
      end   = new Date(`${req.query.to}T23:59:59.999-05:00`);
      useLTE = true; // inclusivo
    } else {
      const month = Number(req.query.month || req.query.mes) || (new Date().getMonth() + 1);
      const year  = Number(req.query.year  || req.query.anio) || new Date().getFullYear();
      const r = monthRangeLocalTZ(year, month);
      start = r.start; end = r.end; useLTE = false; // [start, end)
    }
    dbg("dateRange:", { start, end, useLTE });

    // 3) Aggregate de tipificaciones
    const match = {
      tipificationId: { $exists: true, $ne: null },
      tipifiedAt: useLTE ? { $gte: start, $lte: end } : { $gte: start, $lt: end },
      $or: [
        { tipifiedBy: { $in: memberIds } },
        {
          $and: [
            { $or: [{ tipifiedBy: { $exists: false } }, { tipifiedBy: null }] },
            { toUserId: { $in: memberIds } }
          ]
        }
      ]
    };
    dbg("match aggregate:", JSON.stringify({
      ...match,
      tipifiedAt: undefined // evito log de fechas largas
    }), "tipifiedAt=", match.tipifiedAt);

    const grouped = await Assignment.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ["$tipifiedBy", "$toUserId"] },
          total: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);
    dbg("grouped len=", grouped.length);

    // 4) Mezclar con TODOS los miembros (0 si no tienen)
    const totalsById = new Map(grouped.map(g => [String(g._id), g.total]));

    const items = miembros
      .map(m => ({
        ejecutivoId: String(m._id),
        ejecutivo: nameById.get(String(m._id)),
        total: totalsById.get(String(m._id)) || 0,
      }))
      .sort((a, b) => b.total - a.total);

    const members = miembros
      .map(m => ({ _id: String(m._id), name: nameById.get(String(m._id)) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    dbg("return sizes:", { items: items.length, members: members.length });

    return res.json({ items, members });
  } catch (err) {
    console.error("[reportes.tipificacion.supervisor] distribucionPorEjecutivo ERROR", err);
    return res.status(500).json({ message: "Error generando reporte supervisor" });
  }
}
