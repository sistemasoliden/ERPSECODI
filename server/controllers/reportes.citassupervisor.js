// controllers/reportes.citas.supervisor.js
import mongoose from "mongoose";
import Cita from "../models/Cita.js";
import Equipo from "../models/EquipoSecodi.js";
import User from "../models/User.js";
import { ROLES_IDS as AUTH_ROLES } from "../middlewares/auth.js";

const ROLES_IDS = { ...(AUTH_ROLES || {}) };

/* ======================================================
 * Helpers
 * ====================================================== */

// Devuelve rango de un mes en hora local
function monthRangeLocalTZ(year, month) {
  const start = new Date(year, month - 1, 1, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0);
  return { start, end };
}

// ✅ Determina si el usuario tiene rol Sistemas o Admin
function isSistemasRole(user) {
  const roleId = String(user?.roleId || user?.role?._id || user?.role?.id || "");
  const slug = String(
    user?.role?.slug || user?.role?.nombre || user?.role?.name || ""
  )
    .trim()
    .toLowerCase();

  return (
    user?.isAdmin === true ||
    slug === "sistemas" ||
    (ROLES_IDS?.sistemas && roleId === String(ROLES_IDS.sistemas))
  );
}

// 🔎 Construye un $or que cubra todas las formas de guardar “Comercial”
function buildCommercialRoleQuery() {
  const or = [];

  if (ROLES_IDS?.comercial) {
    const rid = String(ROLES_IDS.comercial);

    if (mongoose.isValidObjectId(rid)) {
      or.push({ role: new mongoose.Types.ObjectId(rid) });
      or.push({ roleId: new mongoose.Types.ObjectId(rid) });
      or.push({ "role._id": new mongoose.Types.ObjectId(rid) });
    }

    // Por si estuviera como string
    or.push({ role: rid });
    or.push({ roleId: rid });
    or.push({ "role._id": rid });
  }

  // Por si usas slug / nombre embebido
  or.push(
    { "role.slug": "comercial" },
    { "role.name": "Comercial" },
    { "role.nombre": "Comercial" }
  );

  return { $or: or };
}

/* ======================================================
 * GET /api/reportes/citas/por-ejecutivo
 * Devuelve:
 *   {
 *     items:   [{ ejecutivoId, ejecutivo, total }],
 *     members: [{ _id, name }]
 *   }
 * ====================================================== */

export async function distribucionPorEjecutivoCitas(req, res) {
  try {
    const user = req.user || {};
    const supervisorId = user?._id;
    if (!supervisorId)
      return res.status(401).json({ message: "No autenticado" });

    const isSistemas = isSistemasRole(user);
    const includeAllTeams =
      isSistemas && String(req.query.includeAllTeams || "") === "1";

    // ====== Rango de fechas ======
    let start, end, useLTE = false;
    if (req.query.from && req.query.to) {
      start = new Date(`${req.query.from}T00:00:00.000-05:00`);
      end = new Date(`${req.query.to}T23:59:59.999-05:00`);
      useLTE = true;
    } else {
      const month =
        Number(req.query.month || req.query.mes) ||
        new Date().getMonth() + 1;
      const year =
        Number(req.query.year || req.query.anio) ||
        new Date().getFullYear();
      const r = monthRangeLocalTZ(year, month);
      start = r.start;
      end = r.end; // [start, end)
    }

    // ====== Determinar miembros ======
    let miembros = [];

    if (includeAllTeams) {
      // ✅ Modo global: todos los comerciales
      const commercialQuery = buildCommercialRoleQuery();
      miembros = await User.find(commercialQuery)
        .select({ _id: 1, name: 1, email: 1 })
        .lean();
    } else {
      // Supervisor: busca sus equipos
      const equipos = await Equipo.find({ supervisor: supervisorId })
        .select("_id")
        .lean();

      if (!equipos.length) {
        // 🔒 Si no tiene equipos pero es Sistemas, devolver todos los comerciales
        if (isSistemas) {
          const commercialQuery = buildCommercialRoleQuery();
          miembros = await User.find(commercialQuery)
            .select({ _id: 1, name: 1, email: 1 })
            .lean();
        } else {
          return res.json({ items: [], members: [] });
        }
      } else {
        const equipoIds = equipos.map((e) => e._id);
        miembros = await User.find({ equipo: { $in: equipoIds } })
          .select({ _id: 1, name: 1, email: 1 })
          .lean();
      }
    }

    if (!miembros.length) return res.json({ items: [], members: [] });

    // ====== Conteo de citas ======
    const memberIds = miembros.map((m) => m._id);
    const grouped = await Cita.aggregate([
      {
        $match: {
          userId: { $in: memberIds },
          inicio: useLTE
            ? { $gte: start, $lte: end }
            : { $gte: start, $lt: end },
        },
      },
      { $group: { _id: "$userId", total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);

    const totalsById = new Map(grouped.map((g) => [String(g._id), g.total]));

    // ====== Formateo de respuesta ======
    const items = miembros
      .map((m) => ({
        ejecutivoId: String(m._id),
        ejecutivo: m.name || m.email || "SIN NOMBRE",
        total: totalsById.get(String(m._id)) || 0,
      }))
      .sort((a, b) => b.total - a.total);

    const members = miembros
      .map((m) => ({
        _id: String(m._id),
        name: m.name || m.email || "SIN NOMBRE",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.json({ items, members });
  } catch (err) {
    console.error(
      "[reportes.citas.supervisor] distribucionPorEjecutivoCitas",
      err
    );
    return res
      .status(500)
      .json({ message: "Error generando reporte supervisor (citas)" });
  }
}
