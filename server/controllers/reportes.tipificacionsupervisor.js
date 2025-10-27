// controllers/reportes.tipificacion.supervisor.js
import mongoose from "mongoose";
import Assignment from "../models/Assignment.js";
import Equipo from "../models/EquipoSecodi.js";
import User from "../models/User.js";
import Opportunity from "../models/Opportunity.js";
import TipoOportunidad from "../models/TipoOportunidad.js";
import { ROLES_IDS as AUTH_ROLES } from "../middlewares/auth.js";

const ROLES_IDS = { ...(AUTH_ROLES || {}) };
const dbg = (...a) => console.log("[tipificacion.supervisor]", ...a);

/* ============ Helpers ============ */
// Flags/estados comunes de usuario activo
function onlyActiveUsers() {
  return {
    $and: [
      { $or: [{ active: { $exists: false } }, { active: true }] },
      { $or: [{ isActive: { $exists: false } }, { isActive: true }] },
      { $or: [{ enabled: { $exists: false } }, { enabled: true }] },
      { $or: [{ disabledAt: { $exists: false } }, { disabledAt: null }] },
      { $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }] },
      { $or: [{ archivedAt: { $exists: false } }, { archivedAt: null }] },
      {
        $or: [
          { estado: { $exists: false } },
          { estado: { $nin: ["inactivo", "INACTIVO", "baja", "desactivado"] } },
        ],
      },
      {
        $or: [
          { status: { $exists: false } },
          {
            status: {
              $nin: ["inactive", "disabled", "terminated", "archived"],
            },
          },
        ],
      },
      {
        $or: [
          { endDate: { $exists: false } },
          { endDate: null },
          { endDate: { $gt: new Date() } },
        ],
      },
    ],
  };
}

// Catálogo “Activo” por estadoUsuario (_id, string o embebido)
const ACTIVE_STATUS_ID = new mongoose.Types.ObjectId(
  "68a4f3dc27e6abe98157a845"
);
function activeStatusByCatalog() {
  return {
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

// Filtro final para usuarios activos
function activeUsersFilter() {
  return { $and: [onlyActiveUsers(), activeStatusByCatalog()] };
}

function monthRangeLocalTZ(year, month) {
  const start = new Date(year, month - 1, 1, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0);
  return { start, end }; // [start, end)
}
function isSistemas(user) {
  const roleId = String(user?.roleId || user?.role?._id || user?.role || "");
  if (user?.isAdmin) return true;
  if (ROLES_IDS?.sistemas && roleId === String(ROLES_IDS.sistemas)) return true;
  const slug = String(
    user?.role?.slug || user?.role?.nombre || user?.role?.name || ""
  )
    .trim()
    .toLowerCase();
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
function toObjectIds(ids = []) {
  return ids
    .map((v) => {
      try {
        return new mongoose.Types.ObjectId(String(v));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/* ============ GET /reportes/tipificacion/por-ejecutivo ============ */
export async function distribucionPorEjecutivo(req, res) {
  try {
    const u = req.user || {};
    if (!u?._id) return res.status(401).json({ message: "No autenticado" });

    const includeAllTeams =
      isSistemas(u) && String(req.query.includeAllTeams || "") === "1";

    // 1) miembros (solo activos)
    let miembros = [];
    if (includeAllTeams) {
      miembros = await User.find({
        $and: [commercialRoleQuery(), activeUsersFilter()],
      })
        .select({ _id: 1, name: 1, email: 1, role: 1, roleId: 1 })
        .lean();
    } else {
      const equipos = await Equipo.find({ supervisor: u._id })
        .select("_id")
        .lean();
      if (!equipos.length) {
        if (isSistemas(u)) {
          miembros = await User.find({
            $and: [commercialRoleQuery(), activeUsersFilter()],
          })
            .select({ _id: 1, name: 1, email: 1, role: 1, roleId: 1 })
            .lean();
        } else {
          return res.json({ items: [], members: [] });
        }
      } else {
        const equipoIds = equipos.map((e) => e._id);
        miembros = await User.find({
          $and: [{ equipo: { $in: equipoIds } }, activeUsersFilter()],
        })
          .select({ _id: 1, name: 1, email: 1 })
          .lean();
      }
    }
    if (!miembros.length) return res.json({ items: [], members: [] });

    // selección opcional userIds[] (desde el front)
    let memberIds = miembros.map((m) => String(m._id));
    const selected = []
      .concat(req.query.userIds || req.query["userIds[]"] || [])
      .flat()
      .map(String)
      .filter(Boolean);
    if (selected.length) {
      const want = new Set(selected);
      memberIds = memberIds.filter((id) => want.has(id));
    }
    if (!memberIds.length) return res.json({ items: [], members: [] });

    const memberObjIds = toObjectIds(memberIds);
    const nameById = new Map(
      miembros.map((m) => [String(m._id), m.name || m.email || "SIN NOMBRE"])
    );

    // 2) fechas
    let start,
      end,
      useLTE = false;
    if (req.query.from && req.query.to) {
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
    }

    // 3) aggregate tipificaciones
    const match = {
      tipificationId: { $exists: true, $ne: null },
      tipifiedAt: useLTE
        ? { $gte: start, $lte: end }
        : { $gte: start, $lt: end },
      $or: [
        { tipifiedBy: { $in: memberObjIds } },
        {
          $and: [
            { $or: [{ tipifiedBy: { $exists: false } }, { tipifiedBy: null }] },
            { toUserId: { $in: memberObjIds } },
          ],
        },
      ],
    };

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

    // 4) salida con ceros
    const totalsById = new Map(grouped.map((g) => [String(g._id), g.total]));
    const items = memberIds
      .map((id) => ({
        ejecutivoId: id,
        ejecutivo: nameById.get(id) || "SIN NOMBRE",
        total: totalsById.get(id) || 0,
      }))
      .sort((a, b) => b.total - a.total);

    const members = memberIds
      .map((id) => ({ _id: id, name: nameById.get(id) || "SIN NOMBRE" }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.json({ items, members });
  } catch (err) {
    console.error(
      "[reportes.tipificacion.supervisor] distribucionPorEjecutivo ERROR",
      err
    );
    return res
      .status(500)
      .json({ message: "Error generando reporte supervisor" });
  }
}

/* ============ GET /reportes/tipificacion/efectividad ============ */
export async function efectividadTipificacion(req, res) {
  try {
    const u = req.user || {};
    if (!u?._id) return res.status(401).json({ message: "No autenticado" });

    const includeAllTeams =
      isSistemas(u) && String(req.query.includeAllTeams || "") === "1";

    // 1) miembros (solo activos)
    let miembros = [];
    if (includeAllTeams) {
      miembros = await User.find({
        $and: [commercialRoleQuery(), activeUsersFilter()],
      })
        .select({ _id: 1, name: 1, email: 1 })
        .lean();
    } else {
      const equipos = await Equipo.find({ supervisor: u._id })
        .select("_id")
        .lean();
      if (!equipos.length) {
        if (isSistemas(u)) {
          miembros = await User.find({
            $and: [commercialRoleQuery(), activeUsersFilter()],
          })
            .select({ _id: 1, name: 1, email: 1 })
            .lean();
        } else {
          return res.json({ items: [], members: [] });
        }
      } else {
        const equipoIds = equipos.map((e) => e._id);
        miembros = await User.find({
          $and: [{ equipo: { $in: equipoIds } }, activeUsersFilter()],
        })
          .select({ _id: 1, name: 1, email: 1 })
          .lean();
      }
    }
    if (!miembros.length) return res.json({ items: [], members: [] });

    // selección opcional userIds[]
    let memberIds = miembros.map((m) => String(m._id));
    const selected = []
      .concat(req.query.userIds || req.query["userIds[]"] || [])
      .flat()
      .map(String)
      .filter(Boolean);
    if (selected.length) {
      const want = new Set(selected);
      memberIds = memberIds.filter((id) => want.has(id));
    }
    if (!memberIds.length) return res.json({ items: [], members: [] });

    const memberObjIds = toObjectIds(memberIds);
    const memberStrIds = memberIds.map(String);
    const nameById = new Map(
      miembros.map((m) => [String(m._id), m.name || m.email || "SIN NOMBRE"])
    );

    // 2) fechas
    let start,
      end,
      useLTE = false;
    if (req.query.from && req.query.to) {
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
    }
    const dateRange = useLTE
      ? { $gte: start, $lte: end }
      : { $gte: start, $lt: end };

    // 3) BASE = tipificaciones
    const matchTipi = {
      tipificationId: { $exists: true, $ne: null },
      tipifiedAt: dateRange,
      $or: [
        { tipifiedBy: { $in: memberObjIds } },
        {
          $and: [
            { $or: [{ tipifiedBy: { $exists: false } }, { tipifiedBy: null }] },
            { toUserId: { $in: memberObjIds } },
          ],
        },
      ],
    };
    const baseAgg = await Assignment.aggregate([
      { $match: matchTipi },
      {
        $addFields: {
          _ownerStr: { $toString: { $ifNull: ["$tipifiedBy", "$toUserId"] } },
        },
      },
      { $group: { _id: "_$KEEP", tmp: { $push: { key: "$_ownerStr" } } } },
      { $unwind: "$tmp" },
      { $group: { _id: "$tmp.key", base: { $sum: 1 } } },
    ]);
    const baseById = new Map(baseAgg.map((g) => [String(g._id), g.base]));

    // 4) OPORTUNIDADES (Negociación aprobada + Propuesta cerrada ganada)
    const TIPO_NOMBRES_OK = [
      "Negociación aprobada",
      "Propuesta cerrada ganada",
    ];
    const tiposOk = await TipoOportunidad.find({
      nombre: { $in: TIPO_NOMBRES_OK },
    })
      .select({ _id: 1, nombre: 1 })
      .lean();
    const tipoIds = tiposOk.map((t) => t._id);
    const tipoNombres = tiposOk.map((t) => t.nombre);

    const matchOpp = {
      $and: [
        {
          $or: [
            { ownerId: { $in: memberObjIds } },
            { $expr: { $in: [{ $toString: "$ownerId" }, memberStrIds] } },
          ],
        },
        { cerrada: true },
        { closedAt: dateRange },
        {
          $or: [
            { estadoId: { $in: tipoIds } },
            { "estado._id": { $in: tipoIds } },
            { estadoNombre: { $in: tipoNombres } },
          ],
        },
      ],
    };

    const oppAgg = await Opportunity.aggregate([
      { $match: matchOpp },
      { $addFields: { ownerIdStr: { $toString: "$ownerId" } } },
      { $group: { _id: "$ownerIdStr", oportunidades: { $sum: 1 } } },
    ]);
    const oppById = new Map(
      oppAgg.map((g) => [String(g._id), g.oportunidades])
    );

    // 5) salida
    const items = memberIds
      .map((id) => {
        const base = Number(baseById.get(id) || 0);
        const oportunidades = Number(oppById.get(id) || 0);
        const efectividad =
          base > 0 ? Math.round((oportunidades * 100) / base) : 0;
        return {
          ejecutivoId: id,
          ejecutivo: nameById.get(id) || "SIN NOMBRE",
          base,
          oportunidades,
          efectividad,
        };
      })
      .sort((a, b) => b.efectividad - a.efectividad);

    const members = memberIds
      .map((id) => ({ _id: id, name: nameById.get(id) || "SIN NOMBRE" }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.json({ items, members });
  } catch (err) {
    console.error(
      "[reportes.tipificacion.supervisor] efectividadTipificacion ERROR",
      err
    );
    return res
      .status(500)
      .json({ message: "Error generando efectividad de tipificación" });
  }
}
