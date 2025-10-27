// controllers/reportes.citas.supervisor.js
import mongoose from "mongoose";
import Cita from "../models/Cita.js";
import Equipo from "../models/EquipoSecodi.js";
import User from "../models/User.js";
import { ROLES_IDS as AUTH_ROLES } from "../middlewares/auth.js";
import EstadoUsuario from "../models/EstadoUsuario.js";

const ROLES_IDS = { ...(AUTH_ROLES || {}) };
const ACTIVE_STATUS_ID = new mongoose.Types.ObjectId("68a4f3dc27e6abe98157a845"); // Activo

/* ==================== Helpers ==================== */
function monthRangeLocalTZ(year, month) {
  const start = new Date(year, month - 1, 1, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0);
  return { start, end };
}

function isSistemasRole(user) {
  const roleId = String(user?.roleId || user?.role?._id || user?.role?.id || "");
  const slug = String(user?.role?.slug || user?.role?.nombre || user?.role?.name || "")
    .trim()
    .toLowerCase();
  return (
    user?.isAdmin === true ||
    slug === "sistemas" ||
    (ROLES_IDS?.sistemas && roleId === String(ROLES_IDS.sistemas))
  );
}

function buildCommercialRoleQuery() {
  const or = [];
  if (ROLES_IDS?.comercial) {
    const rid = String(ROLES_IDS.comercial);
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

// ✅ Mantener filtro de usuarios ACTIVO (no se toca)
function withActiveStatus(base = {}) {
  return {
    $and: [
      base,
      {
        $or: [
          { estadoUsuario: ACTIVE_STATUS_ID },
          { estadoUsuario: String(ACTIVE_STATUS_ID) },
          { "estadoUsuario._id": ACTIVE_STATUS_ID },
          { "estadoUsuario._id": String(ACTIVE_STATUS_ID) },
          { "estadoUsuario.nombre": "Activo" },
          { "estadoUsuario.slug": "activo" },
        ],
      },
    ],
  };
}

/* ==================== Controller ==================== */
export async function distribucionPorEjecutivoCitas(req, res) {
  try {
    const user = req.user || {};
    if (!user?._id) return res.status(401).json({ message: "No autenticado" });

    const isSistemas = isSistemasRole(user);
    const includeAllTeams = isSistemas && String(req.query.includeAllTeams || "") === "1";

    // Rango
    let start, end, useLTE = false;
    if (req.query.from && req.query.to) {
      start = new Date(`${req.query.from}T00:00:00.000-05:00`);
      end   = new Date(`${req.query.to}T23:59:59.999-05:00`);
      useLTE = true;
    } else {
      const month = Number(req.query.month || req.query.mes) || new Date().getMonth() + 1;
      const year  = Number(req.query.year  || req.query.anio) || new Date().getFullYear();
      const r = monthRangeLocalTZ(year, month);
      start = r.start;
      end   = r.end; // [start, end)
    }

    // Miembros (ACTIVOS) según el alcance
    let miembros = [];
    if (includeAllTeams) {
      miembros = await User.find(withActiveStatus(buildCommercialRoleQuery()))
        .select({ _id: 1, name: 1, email: 1, estadoUsuario: 1 })
        .lean();
    } else {
      const equipos = await Equipo.find({ supervisor: user._id }).select("_id").lean();
      if (!equipos.length) {
        if (isSistemas) {
          miembros = await User.find(withActiveStatus(buildCommercialRoleQuery()))
            .select({ _id: 1, name: 1, email: 1, estadoUsuario: 1 })
            .lean();
        } else {
          return res.json({ items: [], members: [] });
        }
      } else {
        const equipoIds = equipos.map((e) => e._id);
        miembros = await User.find(withActiveStatus({ equipo: { $in: equipoIds } }))
          .select({ _id: 1, name: 1, email: 1, estadoUsuario: 1 })
          .lean();
      }
    }

    if (!miembros.length) return res.json({ items: [], members: [] });

    const members = miembros
      .map((m) => ({ _id: String(m._id), name: m.name || m.email || "SIN NOMBRE" }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const memberIds = miembros.map((m) => m._id);

    // ===== group=week: devolver TODOS (incluyendo 0) por S1..S4 =====
    if (String(req.query.group || "") === "week") {
      const groupedWeeks = await Cita.aggregate([
        {
          $match: {
            userId: { $in: memberIds },
            inicio: useLTE ? { $gte: start, $lte: end } : { $gte: start, $lt: end },
          },
        },
        {
          $project: {
            userId: 1,
            day: { $dayOfMonth: { date: "$inicio", timezone: "America/Lima" } },
          },
        },
        {
          $addFields: {
            semana: {
              $switch: {
                branches: [
                  { case: { $lte: ["$day", 7] }, then: 1 },                       // 1–7
                  { case: { $and: [{ $gt: ["$day", 7] }, { $lte: ["$day", 15] }] }, then: 2 }, // 8–15
                  { case: { $and: [{ $gt: ["$day", 15] }, { $lte: ["$day", 23] }] }, then: 3 }, // 16–23
                ],
                default: 4, // 24–fin
              },
            },
          },
        },
        { $group: { _id: { userId: "$userId", semana: "$semana" }, total: { $sum: 1 } } },
      ]);

      // Mapa rápido de nombres
      const nameById = new Map(members.map((m) => [m._id, m.name]));

      // 1) Inicializa TODOS los miembros con S1..S4 en 0
      const items = [];
      for (const m of members) {
        for (let w = 1; w <= 4; w++) {
          items.push({
            ejecutivoId: m._id,
            ejecutivo: nameById.get(m._id) || "SIN NOMBRE",
            semana: w,
            total: 0,
          });
        }
      }

      // 2) Pisa con los totales reales
      const idx = new Map(); // key: `${id}-${w}` → index en items
      items.forEach((it, i) => idx.set(`${it.ejecutivoId}-${it.semana}`, i));

      for (const g of groupedWeeks) {
        const id = String(g._id.userId);
        const w = Number(g._id.semana);
        const key = `${id}-${w}`;
        if (idx.has(key)) {
          items[idx.get(key)].total = g.total;
        }
      }

      // (opcional) ordenar por nombre/id si quieres
      items.sort((a, b) =>
        a.ejecutivo === b.ejecutivo ? a.semana - b.semana : a.ejecutivo.localeCompare(b.ejecutivo)
      );

      return res.json({ items, members });
    }

    // ===== default: totales por ejecutivo (ya mostraba 0 para quien no tiene) =====
    const grouped = await Cita.aggregate([
      {
        $match: {
          userId: { $in: memberIds },
          inicio: useLTE ? { $gte: start, $lte: end } : { $gte: start, $lt: end },
        },
      },
      { $group: { _id: "$userId", total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);

    const totalsById = new Map(grouped.map((g) => [String(g._id), g.total]));

    const items = miembros
      .map((m) => ({
        ejecutivoId: String(m._id),
        ejecutivo: m.name || m.email || "SIN NOMBRE",
        total: totalsById.get(String(m._id)) || 0,
      }))
      .sort((a, b) => b.total - a.total);

    return res.json({ items, members });
  } catch (err) {
    console.error("[reportes.citas.supervisor] distribucionPorEjecutivoCitas", err);
    return res
      .status(500)
      .json({ message: "Error generando reporte supervisor (citas)" });
  }
}
