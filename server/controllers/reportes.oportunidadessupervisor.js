// controllers/reportes.oportunidades.supervisor.js
import mongoose from "mongoose";
import Opportunity from "../models/Opportunity.js";
import Equipo from "../models/EquipoSecodi.js";
import User from "../models/User.js";
import { ROLES_IDS as AUTH_ROLES } from "../middlewares/auth.js";

const ROLES_IDS = { ...(AUTH_ROLES || {}) }; // Debe incluir .comercial y .sistemas
const dbg = (...a) => console.log("[rep.opps.supervisor]", ...a);

/* ==================== Helpers ==================== */

function monthRangeLocalTZ(year, month) {
  const start = new Date(year, month - 1, 1, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0);
  return { start, end }; // [start, end)
}

function isSistemas(user) {
  const roleId = String(
    user?.roleId || user?.role?._id || user?.role?.id || ""
  );
  const slug = String(
    user?.role?.slug || user?.role?.nombre || user?.role?.name || ""
  )
    .trim()
    .toLowerCase();
  if (user?.isAdmin) return true;
  if (ROLES_IDS?.sistemas && roleId === String(ROLES_IDS.sistemas)) return true;
  return slug === "sistemas";
}

function commercialRoleQuery() {
  const or = [];
  const rid = String(ROLES_IDS?.comercial || "");
  if (rid) {
    if (mongoose.isValidObjectId(rid)) {
      const oid = new mongoose.Types.ObjectId(rid);
      or.push({ role: oid }, { roleId: oid }, { "role._id": oid });
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

/** ownerId puede estar guardado como ObjectId o como string */
function buildOwnerCriterion(ids) {
  if (!ids?.length) return { $expr: { $eq: [1, 0] } };
  const strIds = ids.map((v) => String(v));
  const oidIds = ids
    .map((v) => {
      try {
        return new mongoose.Types.ObjectId(String(v));
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return {
    $or: [
      ...(oidIds.length ? [{ ownerId: { $in: oidIds } }] : []),
      { $expr: { $in: [{ $toString: "$ownerId" }, strIds] } },
    ],
  };
}

/* ==================== Controller ==================== */
/**
 * GET /api/reportes/oportunidades/por-ejecutivo
 * Query:
 *   - from/to (YYYY-MM-DD)  o  month/year
 *   - includeAllTeams=1  (efectivo solo para Sistemas/Admin)
 * Respuesta:
 *   { items:[{ejecutivoId, ejecutivo, total}], members:[{_id,name}] }
 */
export async function distribucionPorEjecutivoOportunidades(req, res) {
  try {
    const u = req.user || {};
    if (!u?._id) return res.status(401).json({ message: "No autenticado" });

    const includeAllTeams =
      isSistemas(u) && String(req.query.includeAllTeams || "") === "1";

    dbg("init", { user: u.email || u._id, includeAllTeams, query: req.query });

    // ===== 1) Obtener miembros (equipo o global) =====
    let miembros = [];
    if (includeAllTeams) {
      // Sistemas → todos los comerciales (aunque no tengan oportunidades)
      const q = commercialRoleQuery();
      miembros = await User.find(q)
        .select({ _id: 1, name: 1, email: 1 })
        .lean();
      dbg("miembros (global comerciales) =", miembros.length);
    } else {
      // Supervisor → sus equipos
      const equipos = await Equipo.find({ supervisor: u._id })
        .select("_id")
        .lean();
      dbg(
        "equipos supervisor =",
        equipos.map((e) => e._id.toString())
      );
      if (!equipos.length) {
        // Fallback: si es Sistemas sin equipos configurados, trae comerciales
        if (isSistemas(u)) {
          const q = commercialRoleQuery();
          miembros = await User.find(q)
            .select({ _id: 1, name: 1, email: 1 })
            .lean();
          dbg("fallback miembros (comerciales) =", miembros.length);
        } else {
          return res.json({ items: [], members: [] });
        }
      } else {
        const equipoIds = equipos.map((e) => e._id);
        miembros = await User.find({ equipo: { $in: equipoIds } })
          .select({ _id: 1, name: 1, email: 1 })
          .lean();
        dbg("miembros (equipos) =", miembros.length);
      }
    }

    if (!miembros.length) {
      dbg("sin miembros → vacío");
      return res.json({ items: [], members: [] });
    }

    const memberIds = miembros.map((m) => m._id);
    const nameById = new Map(
      miembros.map((m) => [String(m._id), m.name || m.email || "SIN NOMBRE"])
    );

    // ===== 2) Rango de fechas =====
    let start,
      end,
      useLTE = false;
    if (req.query.from && req.query.to) {
      // Inclusivo con zona local
      start = new Date(`${req.query.from}T00:00:00.000-05:00`);
      end = new Date(`${req.query.to}T23:59:59.999-05:00`);
      useLTE = true;
    } else {
      const month =
        Number(req.query.month || req.query.mes) || new Date().getMonth() + 1;
      const year =
        Number(req.query.year || req.query.anio) || new Date().getFullYear();
      const r = monthRangeLocalTZ(year, month);
      start = r.start;
      end = r.end;
      useLTE = false; // [start, end)
    }
    dbg("dateRange", { start, end, useLTE });

    // ===== 3) Aggregate oportunidades por owner =====
    const ownerCrit = buildOwnerCriterion(memberIds);
    const match = {
      ...ownerCrit,
      createdAt: useLTE
        ? { $gte: start, $lte: end }
        : { $gte: start, $lt: end },
    };

    const grouped = await Opportunity.aggregate([
      { $match: match },
      { $group: { _id: "$ownerId", total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);

    const totalsById = new Map(grouped.map((g) => [String(g._id), g.total]));

    // ===== 4) Combinar con todos los miembros (mostrar ceros) =====
    const items = miembros
      .map((m) => ({
        ejecutivoId: String(m._id),
        ejecutivo: nameById.get(String(m._id)),
        total: totalsById.get(String(m._id)) || 0,
      }))
      .sort((a, b) => b.total - a.total);

    const members = miembros
      .map((m) => ({ _id: String(m._id), name: nameById.get(String(m._id)) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.json({ items, members });
  } catch (err) {
    console.error(
      "[rep.opps.supervisor] distribucionPorEjecutivoOportunidades ERROR",
      err
    );
    return res
      .status(500)
      .json({ message: "Error generando reporte supervisor (oportunidades)" });
  }
}
