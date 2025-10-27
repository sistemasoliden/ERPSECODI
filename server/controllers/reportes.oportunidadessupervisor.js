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

/* === Filtro de usuarios ACTIVO (igual que en Citas) === */
const ACTIVE_STATUS_ID = new mongoose.Types.ObjectId(
  "68a4f3dc27e6abe98157a845"
); // _id "Activo"
function withActiveStatus(base = {}) {
  return {
    ...base,
    $or: [
      { estadoUsuario: ACTIVE_STATUS_ID },
      { estadoUsuario: String(ACTIVE_STATUS_ID) },
      { "estadoUsuario._id": ACTIVE_STATUS_ID },
      { "estadoUsuario._id": String(ACTIVE_STATUS_ID) },
      { "estadoUsuario.nombre": "Activo" },
      { "estadoUsuario.slug": "activo" },
    ],
  };
}

/* ==================== Controller ==================== */
export async function distribucionPorEjecutivoOportunidades(req, res) {
  try {
    const u = req.user || {};
    if (!u?._id) return res.status(401).json({ message: "No autenticado" });

    const includeAllTeams =
      isSistemas(u) && String(req.query.includeAllTeams || "") === "1";

    dbg("init", { user: u.email || u._id, includeAllTeams, query: req.query });

    // ===== 1) Obtener miembros (solo ACTIVO) =====
    let miembros = [];
    if (includeAllTeams) {
      // Sistemas → todos los comerciales ACTIVO
      miembros = await User.find(withActiveStatus(commercialRoleQuery()))
        .select({ _id: 1, name: 1, email: 1, estadoUsuario: 1 })
        .lean();
      dbg("miembros (global comerciales activos) =", miembros.length);
    } else {
      // Supervisor → sus equipos (ACTIVO)
      const equipos = await Equipo.find({ supervisor: u._id })
        .select("_id")
        .lean();
      dbg(
        "equipos supervisor =",
        equipos.map((e) => e._id.toString())
      );

      if (!equipos.length) {
        // Fallback: si es Sistemas sin equipos configurados, trae comerciales (ACTIVO)
        if (isSistemas(u)) {
          miembros = await User.find(withActiveStatus(commercialRoleQuery()))
            .select({ _id: 1, name: 1, email: 1, estadoUsuario: 1 })
            .lean();
          dbg("fallback miembros (comerciales activos) =", miembros.length);
        } else {
          return res.json({ items: [], members: [] });
        }
      } else {
        const equipoIds = equipos.map((e) => e._id);
        miembros = await User.find(
          withActiveStatus({ equipo: { $in: equipoIds } })
        )
          .select({ _id: 1, name: 1, email: 1, estadoUsuario: 1 })
          .lean();
        dbg("miembros (equipos activos) =", miembros.length);
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
      // Inclusivo con zona local (-05:00 Lima)
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

    // ===== 3) Criterios comunes =====
    const ownerCrit = buildOwnerCriterion(memberIds);
    const match = {
      ...ownerCrit,
      createdAt: useLTE
        ? { $gte: start, $lte: end }
        : { $gte: start, $lt: end },
    };

    // ===== 3A) group=week → devolver por semana (1..4) mostrando 0s =====
    if (String(req.query.group || "") === "week") {
      const groupedWeeks = await Opportunity.aggregate([
        { $match: match },
        {
          $project: {
            ownerId: 1,
            day: {
              $dayOfMonth: { date: "$createdAt", timezone: "America/Lima" },
            },
          },
        },
        {
          $addFields: {
            semana: {
              $switch: {
                branches: [
                  { case: { $lte: ["$day", 7] }, then: 1 }, // 1–7
                  {
                    case: {
                      $and: [{ $gt: ["$day", 7] }, { $lte: ["$day", 15] }],
                    },
                    then: 2,
                  }, // 8–15
                  {
                    case: {
                      $and: [{ $gt: ["$day", 15] }, { $lte: ["$day", 23] }],
                    },
                    then: 3,
                  }, // 16–23
                ],
                default: 4, // 24–fin
              },
            },
          },
        },
        {
          $group: {
            _id: { ownerId: "$ownerId", semana: "$semana" },
            total: { $sum: 1 },
          },
        },
      ]);

      // Inicializa TODOS con S1..S4 = 0
      const membersArr = miembros
        .map((m) => ({ _id: String(m._id), name: nameById.get(String(m._id)) }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const items = [];
      for (const m of membersArr) {
        for (let w = 1; w <= 4; w++) {
          items.push({
            ejecutivoId: m._id,
            ejecutivo: m.name || "SIN NOMBRE",
            semana: w,
            total: 0,
          });
        }
      }

      // Índice para pisar rápido
      const idx = new Map(); // `${id}-${w}` -> index
      items.forEach((it, i) => idx.set(`${it.ejecutivoId}-${it.semana}`, i));

      for (const g of groupedWeeks) {
        const id = String(g._id.ownerId);
        const w = Number(g._id.semana);
        const key = `${id}-${w}`;
        if (idx.has(key)) {
          items[idx.get(key)].total = g.total;
        }
      }

      // Orden por nombre y semana
      items.sort((a, b) =>
        a.ejecutivo === b.ejecutivo
          ? a.semana - b.semana
          : a.ejecutivo.localeCompare(b.ejecutivo)
      );

      const members = membersArr;
      return res.json({ items, members });
    }

    // ===== 3B) Rama por defecto: totales por ejecutivo (mostrar ceros) =====
    const grouped = await Opportunity.aggregate([
      { $match: match },
      { $group: { _id: "$ownerId", total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);

    const totalsById = new Map(grouped.map((g) => [String(g._id), g.total]));

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
