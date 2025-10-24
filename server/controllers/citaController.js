// backend/controllers/citaController.js
import mongoose from "mongoose";
import Cita from "../models/Cita.js";
import Notification from "../models/Notification.js";
import { ROLES_IDS } from "../middlewares/auth.js";
import { getSupervisorsForUser } from "../helpers/supervision.js";

const isOID = (v) => mongoose.isValidObjectId(v);

function isSistemasRole(req) {
  const roleId = String(req.user?.roleId || "");
  // si decides que Gerencia también vea global, deja el isAdmin
  return roleId === ROLES_IDS.sistemas || !!req.user?.isAdmin;
}

function getScopedUserIds(req) {
  const noFallback = String(req.query.noFallback || "") === "1"; // 👈 respeta noFallback
  const fromToken = req.user?._id || req.user?.id || null;
  const one = req.query.userId;

  let many = req.query.userIds ?? req.query["userIds[]"];
  const indexed = Object.keys(req.query)
    .filter((k) => /^userIds\[\d+\]$/.test(k))
    .map((k) => req.query[k]);
  const csvAlt = (req.query.userIdsCsv || "").trim();

  let list = [];
  if (Array.isArray(many)) list = many;
  else if (typeof many === "string")
    list = many
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  if (indexed.length) list = list.concat(indexed);
  if (csvAlt)
    list = list.concat(
      csvAlt
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
  if (one) list.push(one);

  // Si pidieron noFallback y quedó vacío, devolvemos vacío
  const parsed = list
    .filter(isOID)
    .map((id) => new mongoose.Types.ObjectId(id));
  if (noFallback) return parsed;

  if (!parsed.length && fromToken)
    return [new mongoose.Types.ObjectId(fromToken)];
  return parsed;
}

function buildOwnerCriterion(ids) {
  if (!ids?.length) return { $expr: { $eq: [1, 0] } };
  // Versión robusta: soporta userId como ObjectId o como string
  return {
    $or: [
      { userId: { $in: ids } }, // ObjectId
      { $expr: { $in: [{ $toString: "$userId" }, ids.map(String)] } }, // string
    ],
  };
}

export const listCitas = async (req, res) => {
  try {
    const uid = req.user?._id || req.user?.id;
    if (!uid)
      return res.status(401).json({ error: "Sin usuario en la sesión" });

    const q = String(req.query.q || "").trim();
    const tipo = String(req.query.tipo || "").trim();
    const fromStr = req.query.from ? String(req.query.from) : null; // yyyy-mm-dd
    const toStr = req.query.to ? String(req.query.to) : null; // yyyy-mm-dd

    const match = { userId: uid };

    if (q) {
      match.$or = [
        { ruc: { $regex: q, $options: "i" } },
        { razonSocial: { $regex: q, $options: "i" } },
      ];
    }
    if (tipo) {
      match.tipo = tipo;
    }
    if (fromStr || toStr) {
      match.inicio = {};
      if (fromStr)
        match.inicio.$gte = new Date(`${fromStr}T00:00:00.000-05:00`);
      if (toStr) match.inicio.$lte = new Date(`${toStr}T23:59:59.999-05:00`);
    }

    const items = await Cita.find(match).sort({ inicio: -1 }).lean();
    return res.json({ items, total: items.length });
  } catch (e) {
    console.error("listCitas", e);
    return res.status(500).json({ error: "Error listando citas" });
  }
};

export const createCita = async (req, res) => {
  try {
    const {
      titulo,
      tipo,
      mensaje,
      direccion,
      inicio,
      fin,
      ruc,
      razonSocial,
      opportunityId,
    } = req.body;

    if (!inicio) return res.status(400).json({ error: "inicio es requerido" });
    const supervisorIds = await getSupervisorsForUser(req.user._id);

    const start = new Date(inicio);
    const end = fin
      ? new Date(fin)
      : new Date(start.getTime() + 60 * 60 * 1000);

    const cita = await Cita.create({
      userId: req.user?._id,
      opportunityId,
      ruc,
      razonSocial,
      titulo: (titulo || "Cita").trim(),
      tipo: (tipo || "presencial").toLowerCase(),
      mensaje,
      direccion,
      inicio: start,
      fin: end,
    });

    // ✅ Notificación para la campana
    await Notification.create({
      userId: req.user?._id,
      type: "cita",
      title: "Cita programada",
      message: `${cita.titulo} — ${razonSocial || ruc || ""}`,
      data: { citaId: cita._id, opportunityId, ruc, razonSocial },
      scheduledAt: start,
      read: false,
    });
    const ownerName =
      req.user?.name ||
      [req.user?.firstName, req.user?.lastName].filter(Boolean).join(" ") ||
      "Ejecutivo";
    await Promise.all(
      supervisorIds.map((supId) =>
        Notification.create({
          userId: supId, // 👈 supervisor destinatario
          type: "cita",
          title: "Cita programada (equipo)",
          message: `${cita.titulo} — ${razonSocial || ruc || ""}`,
          data: {
            citaId: cita._id,
            ownerId: req.user._id,
            ownerName, // 👈 aquí va el nombre del ejecutivo
            ruc,
            razonSocial,
          },
          scheduledAt: start,
          read: false,
        })
      )
    );

    return res.status(201).json({ item: cita });
  } catch (e) {
    console.error("createCita", e);
    return res.status(500).json({ error: "Error creando cita" });
  }
};

export const deleteCita = async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.user?._id || req.user?.id;
    const found = await Cita.findOne({ _id: id, userId: uid });
    if (!found) return res.status(404).json({ error: "No encontrada" });
    await Cita.deleteOne({ _id: id });
    return res.json({ ok: true });
  } catch (e) {
    console.error("deleteCita", e);
    return res.status(500).json({ error: "Error eliminando cita" });
  }
};

export const updateCita = async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.user?._id || req.user?.id;

    const allowed = [
      "titulo",
      "tipo",
      "mensaje",
      "direccion",
      "inicio",
      "fin",
      "lugar",
      "notas",
    ];
    const patch = {};
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];

    const item = await Cita.findOneAndUpdate({ _id: id, userId: uid }, patch, {
      new: true,
    }).lean();

    if (!item) return res.status(404).json({ error: "No encontrada" });
    return res.json({ item });
  } catch (e) {
    console.error("updateCita", e);
    return res.status(500).json({ error: "Error actualizando cita" });
  }
};

export const setEstadoCita = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body; // "pendiente" | "completada" | "cancelada"
    const uid = req.user?._id || req.user?.id;

    if (!["pendiente", "completada", "cancelada"].includes(String(estado)))
      return res.status(400).json({ error: "Estado inválido" });

    const item = await Cita.findOneAndUpdate(
      { _id: id, userId: uid },
      { estado },
      { new: true }
    ).lean();

    if (!item) return res.status(404).json({ error: "No encontrada" });
    return res.json({ item });
  } catch (e) {
    console.error("setEstadoCita", e);
    return res.status(500).json({ error: "Error cambiando estado" });
  }
};

export async function listCitasSupervisor(req, res) {
  try {
    // === Ámbito (idéntico a oportunidades) ===
    const scopedIds = getScopedUserIds(req);

    const hasUserIds = Array.isArray(req.query.userIds)
      ? req.query.userIds.length > 0
      : typeof req.query.userIds === "string"
      ? req.query.userIds.trim().length > 0
      : Object.keys(req.query).some((k) => /^userIds\[\d+\]$/.test(k));

    const isSistemas = isSistemasRole(req);
    const forceGlobal = isSistemas && !hasUserIds;
    const allowAll =
      forceGlobal ||
      (isSistemas && String(req.query.includeAllTeams || "") === "1");

    console.log("======[listCitasSupervisor]======");
    console.log("user:", req.user?.email || req.user?._id);
    console.log("roleId:", req.user?.roleId, "isAdmin:", req.user?.isAdmin);
    console.log("isSistemas:", isSistemas, "allowAll:", allowAll);
    console.log("scopedIds:", scopedIds.map(String));

    // === Parámetros comunes ===
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 200);
    const q = String(req.query.q || "").trim();
    const tipo = String(req.query.tipo || "").trim();
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;

    // === Filtro base ===
    const match = allowAll ? {} : buildOwnerCriterion(scopedIds);
    if (!allowAll && !scopedIds.length) {
      console.log("⚠️  Sin scopedIds y no es allowAll → retorno vacío");
      return res.json({ items: [], total: 0, page: 1, pages: 1 });
    }

    // === Filtros adicionales ===
    if (q) {
      match.$or = [
        { ruc: { $regex: q, $options: "i" } },
        { razonSocial: { $regex: q, $options: "i" } },
        { titulo: { $regex: q, $options: "i" } },
        { mensaje: { $regex: q, $options: "i" } },
        { notas: { $regex: q, $options: "i" } },
      ];
    }

    if (tipo) match.tipo = tipo.toLowerCase();

    if (from || to) {
      match.inicio = {};
      if (from) match.inicio.$gte = new Date(`${from}T00:00:00.000-05:00`);
      if (to) match.inicio.$lte = new Date(`${to}T23:59:59.999-05:00`);
    }

    console.log("match final:", JSON.stringify(match, null, 2));

    // === Aggregation con join a usuarios ===
    const pipeline = [
      { $match: match },
      {
        $facet: {
          items: [
            { $sort: { inicio: -1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $lookup: {
                from: "users",
                let: { uid: "$userId" },
                pipeline: [
                  { $match: { $expr: { $eq: ["$_id", "$$uid"] } } },
                  {
                    $project: {
                      _id: 0,
                      ownerName: {
                        $ifNull: [
                          "$name",
                          {
                            $trim: {
                              input: {
                                $concat: [
                                  { $ifNull: ["$firstName", ""] },
                                  " ",
                                  { $ifNull: ["$lastName", ""] },
                                ],
                              },
                            },
                          },
                        ],
                      },
                      ownerEmail: "$email",
                    },
                  },
                ],
                as: "_owner",
              },
            },
            {
              $addFields: {
                ownerName: {
                  $ifNull: [{ $arrayElemAt: ["$_owner.ownerName", 0] }, ""],
                },
                ownerEmail: {
                  $ifNull: [{ $arrayElemAt: ["$_owner.ownerEmail", 0] }, ""],
                },
              },
            },
            { $unset: ["_owner"] },
            {
              $project: {
                ruc: 1,
                razonSocial: 1,
                titulo: 1,
                tipo: 1,
                estado: { $ifNull: ["$estado", "pendiente"] },
                inicio: 1,
                fin: 1,
                notas: { $ifNull: ["$notas", "$mensaje"] },
                ownerName: 1,
                ownerEmail: 1,
              },
            },
          ],
          total: [{ $count: "n" }],
        },
      },
      {
        $project: {
          items: 1,
          total: { $ifNull: [{ $arrayElemAt: ["$total.n", 0] }, 0] },
        },
      },
    ];

    const [{ items = [], total = 0 } = {}] = await Cita.aggregate(
      pipeline
    ).allowDiskUse(true);

    const pages = Math.max(1, Math.ceil(total / limit));
    console.log(`→ Resultado: ${total} registros, página ${page}`);
    return res.json({ items, total, page, pages });
  } catch (e) {
    console.error("[citas.supervisor.list] ERROR GENERAL", e);
    return res
      .status(500)
      .json({ error: "No se pudo listar citas (supervisor)" });
  }
}

export async function exportCitasSupervisor(req, res) {
  try {
    const scopedIds = getScopedUserIds(req);

    const hasUserIds = Array.isArray(req.query.userIds)
      ? req.query.userIds.length > 0
      : typeof req.query.userIds === "string"
      ? req.query.userIds.trim().length > 0
      : false;

    const isSistemas = isSistemasRole(req);
    const forceGlobal = isSistemas && !hasUserIds;
    const allowAll =
      forceGlobal ||
      (isSistemas && String(req.query.includeAllTeams || "") === "1");

    const q = String(req.query.q || "").trim();
    const tipo = String(req.query.tipo || "").trim();
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;

    const TZ = process.env.TZ_OFFSET || "-05:00";
    const match = allowAll ? {} : buildOwnerCriterion(scopedIds);
    if (!allowAll && !scopedIds.length) {
      return res.json({ items: [], total: 0 });
    }

    if (q) {
      match.$or = [
        { ruc: { $regex: q, $options: "i" } },
        { razonSocial: { $regex: q, $options: "i" } },
        { titulo: { $regex: q, $options: "i" } },
        { mensaje: { $regex: q, $options: "i" } },
        { notas: { $regex: q, $options: "i" } },
      ];
    }
    if (tipo) match.tipo = tipo.toLowerCase();

    if (from || to) {
      match.inicio = {};
      if (from) match.inicio.$gte = new Date(`${from}T00:00:00.000${TZ}`);
      if (to) match.inicio.$lte = new Date(`${to}T23:59:59.999${TZ}`);
    }

    const items = await Cita.aggregate([
      { $match: match },
      { $sort: { inicio: -1 } },
      {
        $lookup: {
          from: "users",
          let: { uid: "$userId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$uid"] } } },
            {
              $project: {
                _id: 0,
                ownerName: {
                  $ifNull: [
                    "$name",
                    {
                      $trim: {
                        input: {
                          $concat: [
                            { $ifNull: ["$firstName", ""] },
                            " ",
                            { $ifNull: ["$lastName", ""] },
                          ],
                        },
                      },
                    },
                  ],
                },
                ownerEmail: "$email",
              },
            },
          ],
          as: "_owner",
        },
      },
      {
        $addFields: {
          ownerName: {
            $ifNull: [{ $arrayElemAt: ["$_owner.ownerName", 0] }, ""],
          },
          ownerEmail: {
            $ifNull: [{ $arrayElemAt: ["$_owner.ownerEmail", 0] }, ""],
          },
        },
      },
      { $unset: ["_owner"] },
      {
        $project: {
          ruc: 1,
          razonSocial: 1,
          titulo: 1,
          tipo: 1,
          estado: { $ifNull: ["$estado", "pendiente"] },
          inicio: 1,
          fin: 1,
          notas: { $ifNull: ["$notas", "$mensaje"] },
          ownerName: 1,
          ownerEmail: 1,
        },
      },
    ]);

    return res.json({ items, total: items.length });
  } catch (e) {
    console.error("[citas.supervisor.export] ERROR GENERAL", e);
    return res
      .status(500)
      .json({ error: "No se pudo exportar citas (supervisor)" });
  }
}
