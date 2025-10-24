import mongoose from "mongoose";
import Opportunity from "../models/Opportunity.js";
import TipoOportunidad from "../models/TipoOportunidad.js";
import BaseSecodi from "../models/BaseSecodi.js";
import TipoVenta from "../models/TipoVenta.js";
import Producto from "../models/Producto.js";
import ModalidadVenta from "../models/ModalidadVenta.js";
import { ROLES_IDS } from "../middlewares/auth.js"; // ⬅️ NEW


const CLOSED_IDS = new Set([
  "68b859269d14cf7b7e51084d", // cerrada ganada
  "68b859269d14cf7b7e51084e", // cerrada perdida
]);

const NAME_GANADA = "Propuesta cerrada ganada";
const NAME_NEG_APROBADA = "Negociación aprobada";

// ID por defecto: "Propuesta identificada"
const DEFAULT_ESTADO_ID = new mongoose.Types.ObjectId("68b859269d14cf7b7e510848");

const isOID = (v) => mongoose.isValidObjectId(v);

function monthRangeLocalTZ(year, month) {
  const start = new Date(year, month - 1, 1, 0, 0, 0);
  const end   = new Date(year, month, 1, 0, 0, 0);
  return { start, end };
}

/* ================= Helpers de alcance (Sistemas / Supervisor) ================= */

// ⬅️ NEW: robusto, acepta id o slug/nombre y respeta isAdmin
function isSistemasRole(req) {
  const roleId = String(req.user?.roleId || req.user?.role?._id || req.user?.role?.id || "");
  const slugOrName = String(req.user?.role?.slug || req.user?.role?.nombre || req.user?.role?.name || "")
    .trim()
    .toLowerCase();
  if (roleId && ROLES_IDS?.sistemas && roleId === ROLES_IDS.sistemas) return true;
  if (slugOrName === "sistemas") return true;
  if (req.user?.isAdmin) return true;
  return false;
}

/** Acepta: userId, userIds[]=, userIds=csv, userIdsCsv, userIds[0]=... 
 *  + soporta ?noFallback=1 para NO caer al usuario del token
 */
function getScopedUserIds(req) {
  const noFallback = String(req.query.noFallback || req.query.nofallback || "") === "1"; // ⬅️ NEW
  const fromToken = req.user?._id || req.user?.id || null;
  const one = req.query.userId;

  let many = req.query.userIds ?? req.query["userIds[]"];
  const indexed = Object.keys(req.query)
    .filter((k) => /^userIds\[\d+\]$/.test(k))
    .map((k) => req.query[k]);
  const csvAlt = (req.query.userIdsCsv || "").trim();

  let list = [];
  if (Array.isArray(many)) list = many;
  else if (typeof many === "string") list = many.split(",").map((s) => s.trim()).filter(Boolean);

  if (indexed.length) list = list.concat(indexed);
  if (csvAlt) list = list.concat(csvAlt.split(",").map((s) => s.trim()).filter(Boolean));
  if (one) list.push(one);

  const parsed = list.filter(isOID).map((id) => new mongoose.Types.ObjectId(id));

  // si pidieron noFallback y quedó vacío, devolvemos vacío (nada de fallback)
  if (noFallback) return parsed; // ⬅️ NEW

  if (!parsed.length && fromToken) return [new mongoose.Types.ObjectId(fromToken)];
  return parsed;
}

function buildOwnerCriterion(ids) {
  // ids puede venir como ObjectId o string. Aceptemos ambos formatos en BD.
  if (!ids?.length) return { $expr: { $eq: [1, 0] } }; // nada

  const strIds = ids.map((v) => String(v));
  const oidIds = ids
    .map((v) => {
      try { return new mongoose.Types.ObjectId(String(v)); } catch { return null; }
    })
    .filter(Boolean);

  return {
    $or: [
      // Coincidir cuando ownerId es ObjectId
      ...(oidIds.length ? [{ ownerId: { $in: oidIds } }] : []),

      // Coincidir cuando ownerId quedó guardado como string
      // (hace stringify seguro del campo para comparar contra strIds)
      {
        $expr: { $in: [ { $toString: "$ownerId" }, strIds ] }
      },
    ],
  };
}


function buildDateRange({ from, to, month, year }) {
  if (from && to) {
    const start = new Date(`${from}T00:00:00.000-05:00`);  // ⬅️ fija TZ local si quieres
    const end   = new Date(`${to}T23:59:59.999-05:00`);
    return { start, end, useLTE: true };
  }
  const m = Number(month), y = Number(year);
  if (m && y) {
    const { start, end } = monthRangeLocalTZ(y, m);
    return { start, end, useLTE: false };
  }
  return { start: null, end: null, useLTE: false };
}

// ... imports y constantes
export async function createOpportunity(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ error: "No autenticado" });

    const {
      ruc, // string (11 dígitos)
      monto,
      notas,
      estadoId,
      contactId, // opcional
      cantidad,
      tipoVentaId, // opcional
      productoId, // opcional (depende de tipoVenta)
      modalidadVentaId, // opcional
    } = req.body || {};

    if (!ruc) return res.status(400).json({ error: "RUC requerido" });

    // resolver razón social desde BaseSecodi
    const base = await BaseSecodi.findOne({
      ruc: String(ruc).replace(/\D/g, ""),
    });
    const razonSocial = base?.razonSocial || base?.RAZON_SOCIAL || "";

    // etapa
    const estadoObjId = estadoId
      ? new mongoose.Types.ObjectId(estadoId)
      : DEFAULT_ESTADO_ID;
    const tipo = await TipoOportunidad.findById(estadoObjId);
    if (!tipo) return res.status(400).json({ error: "Estado inválido" });

    // validar opcionales (si llegan)
    const clean = {};
    if (contactId && mongoose.isValidObjectId(contactId))
      clean.contactId = contactId;
    if (typeof monto === "number") clean.monto = monto;
    if (typeof cantidad === "number") clean.cantidad = cantidad;
    if (tipoVentaId && mongoose.isValidObjectId(tipoVentaId)) {
      const ok = await TipoVenta.findById(tipoVentaId).select("_id");
      if (ok) clean.tipoVentaId = tipoVentaId;
    }
    if (productoId && mongoose.isValidObjectId(productoId)) {
      const ok = await Producto.findById(productoId).select("_id");
      if (ok) clean.productoId = productoId;
    }
    if (modalidadVentaId && mongoose.isValidObjectId(modalidadVentaId)) {
      const ok = await ModalidadVenta.findById(modalidadVentaId).select("_id");
      if (ok) clean.modalidadVentaId = modalidadVentaId;
    }
    if (notas) clean.notas = String(notas);

    const item = await Opportunity.create({
      ownerId: new mongoose.Types.ObjectId(userId),
      ruc: String(ruc),
      razonSocial,
      estadoId: String(tipo._id),
      estadoNombre: tipo.nombre,
      monto: Number(monto) || 0,
      cantidad: Number(cantidad) || 1,
      ...clean,
    });

    res.json({ ok: true, item });
  } catch (err) {
    console.error("[oportunidades.create]", err);
    res.status(500).json({ error: "No se pudo crear la oportunidad" });
  }
}

export async function listMyOpportunities(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ error: "No autenticado" });

    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "20", 10);
    const q = String(req.query.q || "").trim();
    const estadoId = req.query.estadoId ? String(req.query.estadoId) : null;

    const fromStr = req.query.from ? String(req.query.from) : null; // "yyyy-mm-dd"
    const toStr = req.query.to ? String(req.query.to) : null; // "yyyy-mm-dd"
    const openOnly = String(req.query.openOnly) === "true";
    const onlyClosed = String(req.query.onlyClosed) === "true";

    const match = { ownerId: new mongoose.Types.ObjectId(userId) };
    if (estadoId) match.estadoId = estadoId;
    if (!estadoId) {
      if (openOnly) match.cerrada = false;
      if (onlyClosed) match.cerrada = true;
    }
    if (q) {
      match.$or = [
        { ruc: { $regex: q, $options: "i" } },
        { razonSocial: { $regex: q, $options: "i" } },
      ];
    }
    if (fromStr || toStr) {
      match.createdAt = {};
      if (fromStr)
        match.createdAt.$gte = new Date(`${fromStr}T00:00:00.000-05:00`);
      if (toStr) match.createdAt.$lte = new Date(`${toStr}T23:59:59.999-05:00`);
    }

    const pipeline = [
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },

      // BaseSecodi por RUC
      {
        $lookup: {
          from: "basesecodi",
          let: { r: "$ruc" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$ruc", "$$r"] },
                    { $eq: ["$rucStr", "$$r"] },
                    { $eq: ["$RUC", "$$r"] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 1,
                ruc: { $ifNull: ["$rucStr", { $toString: "$ruc" }] },
                razonSocial: { $ifNull: ["$razonSocial", "$RAZON_SOCIAL"] },
                direccion: 1,
                sunatDepartment: 1,
                sunatProvince: 1,
                sunatDistrict: 1,
                movistarLines: 1,
                claroLines: 1,
                entelLines: 1,
                otherLines: 1,
                uncountedLines: 1,
                totalLines: 1,
              },
            },
          ],
          as: "base",
        },
      },
      { $addFields: { base: { $arrayElemAt: ["$base", 0] } } },

      // Lookups para nombres (IDs -> nombres) SIN modalidad
      {
        $lookup: {
          from: "tiposventas", // nombre real de la colección
          let: { id: "$tipoVentaId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ["$$id", null] },
                    {
                      $eq: [
                        "$_id",
                        {
                          $convert: {
                            input: "$$id",
                            to: "objectId",
                            onError: null,
                            onNull: null,
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            },
            { $project: { _id: 0, nombre: 1 } },
          ],
          as: "_tv",
        },
      },
      {
        $lookup: {
          from: "productos",
          let: { id: "$productoId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ["$$id", null] },
                    {
                      $eq: [
                        "$_id",
                        {
                          $convert: {
                            input: "$$id",
                            to: "objectId",
                            onError: null,
                            onNull: null,
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            },
            { $project: { _id: 0, nombre: 1 } },
          ],
          as: "_prod",
        },
      },
      {
        $addFields: {
          tipoVentaNombre: {
            $ifNull: [{ $arrayElemAt: ["$_tv.nombre", 0] }, "$tipoVentaNombre"],
          },
          productoNombre: {
            $ifNull: [
              { $arrayElemAt: ["$_prod.nombre", 0] },
              "$productoNombre",
            ],
          },
        },
      },

      // Contacto: por contactId o por RUC (fallback)
      {
        $lookup: {
          from: "contactosempresas",
          let: {
            cid: "$contactId",
            baseId: "$base._id",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    {
                      $and: [
                        { $ne: ["$$cid", null] },
                        {
                          $eq: [
                            "$_id",
                            {
                              $convert: {
                                input: "$$cid",
                                to: "objectId",
                                onError: null,
                                onNull: null,
                              },
                            },
                          ],
                        },
                      ],
                    },
                    {
                      $and: [
                        { $ne: ["$$baseId", null] },
                        { $eq: ["$ruc", "$$baseId"] },
                      ],
                    },
                  ],
                },
              },
            },
            { $sort: { updatedAt: -1, createdAt: -1 } },
            { $limit: 1 },
            {
              $project: {
                _id: 0,
                nombre: { $ifNull: ["$referenceName", "$name"] },
                celular: {
                  $ifNull: ["$contactDescription", { $ifNull: ["$phone", ""] }],
                },
                cargo: { $ifNull: ["$position", ""] },
                correo: { $ifNull: ["$email", ""] },
              },
            },
          ],
          as: "_contacto",
        },
      },
      {
        $addFields: {
          contacto: {
            $cond: [
              { $gt: [{ $size: "$_contacto" }, 0] },
              { $arrayElemAt: ["$_contacto", 0] },
              {
                $ifNull: [
                  "$contacto",
                  { nombre: "", celular: "", cargo: "", correo: "" },
                ],
              },
            ],
          },
        },
      },

      // limpiar helpers
      { $unset: ["_tv", "_prod", "_contacto"] },
    ];

    const count = await Opportunity.countDocuments(match);
    const items = await Opportunity.aggregate(pipeline);

    res.json({ items, total: count, page, pages: Math.ceil(count / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo listar oportunidades" });
  }
}

export async function updateEstado(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.params;
    const { estadoId } = req.body || {};
    if (!userId) return res.status(401).json({ error: "No autenticado" });
    if (!estadoId) return res.status(400).json({ error: "estadoId requerido" });

    const tipo = await TipoOportunidad.findById(estadoId);
    if (!tipo) return res.status(400).json({ error: "Estado inválido" });

    const estadoIdStr = String(tipo._id);
    const willClose = CLOSED_IDS.has(estadoIdStr);

    const updated = await Opportunity.findOneAndUpdate(
      { _id: id, ownerId: new mongoose.Types.ObjectId(userId) },
      {
        estadoId: estadoIdStr, // 👈 string
        estadoNombre: tipo.nombre,
        cerrada: willClose, // 👈 actualiza bandera
        closedAt: willClose ? new Date() : undefined,
      },
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ error: "Oportunidad no encontrada" });
    res.json({ ok: true, item: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "No se pudo actualizar el estado" });
  }
}

export async function listTipos(req, res) {
  try {
    const tipos = await TipoOportunidad.find().sort({ nombre: 1 });
    res.json(tipos);
  } catch (e) {
    res.status(500).json({ error: "No se pudieron listar los tipos" });
  }
}

// controllers/oportunidades.js  (donde ya tienes create/list/updateEstado
// controllers/opportunityController.js
export async function updateCamposBasicos(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ error: "No autenticado" });

    const { id } = req.params;
    const {
      monto,
      cantidad,
      notas,
      tipoVentaId,
      tipoVentaNombre,
      productoId,
      productoNombre,
      modalidadVentaId,
    } = req.body || {};

    const set = {};

    // numéricos
    if (typeof monto === "number") set.monto = Number(monto) || 0;
    if (typeof cantidad === "number") set.cantidad = Number(cantidad) || 1;

    // notas
    if (typeof notas === "string") set.notas = String(notas);

    // Tipo de venta (acepta id o nombre)
    if (tipoVentaId && mongoose.isValidObjectId(tipoVentaId)) {
      const tv = await TipoVenta.findById(tipoVentaId).select("nombre");
      if (tv) {
        set.tipoVentaId = String(tv._id);
        set.tipoVentaNombre = tv.nombre;
      }
    } else if (tipoVentaNombre) {
      set.tipoVentaNombre = String(tipoVentaNombre);
      // si mandas nombre manual, limpia id para no mostrar inconsistencia
      set.tipoVentaId = undefined;
    }

    // Producto (acepta id o nombre)
    if (productoId && mongoose.isValidObjectId(productoId)) {
      const p = await Producto.findById(productoId).select("nombre");
      if (p) {
        set.productoId = String(p._id);
        set.productoNombre = p.nombre;
      }
    } else if (productoNombre) {
      set.productoNombre = String(productoNombre);
      set.productoId = undefined;
    }

    // Modalidad (opcional)
    if (modalidadVentaId && mongoose.isValidObjectId(modalidadVentaId)) {
      set.modalidadVentaId = modalidadVentaId;
    }

    // IMPORTANTE: usa un nombre que SÍ exista aquí
    const updatedDoc = await Opportunity.findOneAndUpdate(
      { _id: id, ownerId: userId },
      { $set: set },
      { new: true }
    );

    if (!updatedDoc) {
      return res.status(404).json({ error: "Oportunidad no encontrada" });
    }

    return res.json({ ok: true, item: updatedDoc });
  } catch (err) {
    console.error("[oportunidades.updateCamposBasicos]", err);
    return res
      .status(500)
      .json({ error: "No se pudo actualizar la oportunidad" });
  }
}
export async function reportPorTipoVentaResumen(req, res) {
  try {
    // IDs del/los usuario(s) a considerar (supervisor puede enviar varios)
    const scopedIds = getScopedUserIds(req);
    if (!scopedIds.length) return res.json({ items: [], metric: req.query?.metric || "monto" });

    const {
      estado = "ganada",      // ganada | neg_aprobada | both
      tipoOppId,              // opcional: etapa específica (id)
      metric = "monto",       // monto | cantidad
      from, to, month, year,
    } = req.query || {};

    // catálogo de tipos de venta para mostrar categorías con 0
    const tiposVentaDocs = await TipoVenta.find().sort({ nombre: 1 }).lean();
    const allTipos = tiposVentaDocs.map((t) => t.nombre || "Sin tipo");
    if (!allTipos.length) return res.json({ items: [], metric });

    // match base por owner(s)
    const match = buildOwnerCriterion(scopedIds);

    // filtro por etapa
    if (tipoOppId) {
      match.estadoId = String(tipoOppId);
    } else {
      if (estado === "ganada") {
        match.estadoNombre = NAME_GANADA;
      } else if (estado === "neg_aprobada") {
        match.estadoNombre = NAME_NEG_APROBADA;
      } else {
        match.$or = [{ estadoNombre: NAME_GANADA }, { estadoNombre: NAME_NEG_APROBADA }];
      }
    }

    // fecha a usar
    let dateExpr;
    if (estado === "ganada" && !tipoOppId) {
      dateExpr = "$closedAt";
    } else if (estado === "neg_aprobada" && !tipoOppId) {
      dateExpr = "$updatedAt";
    } else {
      dateExpr = { $ifNull: ["$closedAt", "$updatedAt"] };
    }
    const { start, end, useLTE } = buildDateRange({ from, to, month, year });

    // métrica
   // métrica
const montoField = { $toDouble: { $ifNull: ["$monto", 0] } };
const cantidadField = { $toDouble: { $ifNull: ["$cantidad", 1] } };

// si metric === 'cantidad' suma el campo cantidad; si no, suma monto
const sumExpr = metric === "cantidad" ? { $sum: cantidadField } : { $sum: montoField };


    // pipeline
    const pipeline = [
      { $match: match },
      // resolver nombre de tipo de venta
      {
        $lookup: {
          from: "tiposventas",
          let: { id: "$tipoVentaId" },
          pipeline: [
            { $match: { $expr: { $and: [
              { $ne: ["$$id", null] },
              { $eq: ["$_id", { $convert: { input: "$$id", to: "objectId", onError: null, onNull: null } }] }
            ] } } },
            { $project: { _id: 0, nombre: 1 } },
          ],
          as: "_tv",
        },
      },
      {
        $addFields: {
          tipoVentaNombre: {
            $ifNull: [{ $arrayElemAt: ["$_tv.nombre", 0] }, "$tipoVentaNombre"],
          },
          _fechaFiltro: dateExpr,
        },
      },
      // rango
      ...(start && end ? [{ $match: { _fechaFiltro: useLTE ? { $gte: start, $lte: end } : { $gte: start, $lt: end } } }] : []),
      // agrupar
      {
        $group: {
          _id: { tv: { $ifNull: ["$tipoVentaNombre", "Sin tipo"] } },
          valor: sumExpr,
        },
      },
      { $project: { _id: 0, tipo: "$_id.tv", valor: 1 } },
      { $sort: { valor: -1 } },
    ];

    const rows = await Opportunity.aggregate(pipeline);

    // fusionar con catálogo para que aparezcan todas las categorías
    const map = new Map(rows.map((r) => [r.tipo, Number(r.valor) || 0]));
    const items = allTipos.map((tv) => ({ tipo: tv, valor: map.get(tv) || 0 }));

    return res.json({ items, metric });
  } catch (err) {
    console.error("[reportes.opps.por-tipo-venta-resumen]", err);
    return res.status(500).json({ error: "No se pudo generar el reporte" });
  }
}

export async function listOpportunitiesSupervisor(req, res) {
  try {
    const scopedIds = getScopedUserIds(req);

    // ¿mandaron explícitamente userIds en el query?
    const hasUserIds =
      Array.isArray(req.query.userIds)
        ? req.query.userIds.length > 0
        : typeof req.query.userIds === "string"
          ? req.query.userIds.trim().length > 0
          : false;

    // Para Sistemas:
    // - si NO mandan userIds => modo global (forceGlobal)
    // - o si incluyen includeAllTeams=1 => global también
    const forceGlobal = isSistemasRole(req) && !hasUserIds; // ⬅️ NEW
    const allowAll =
  isSistemasRole(req) &&
  !hasUserIds &&
  String(req.query.includeAllTeams || "") === "1";

    const page  = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(Math.max(1, parseInt(req.query.limit || "20", 10)), 200);
    const q        = String(req.query.q || "").trim();
    const estadoId = req.query.estadoId ? String(req.query.estadoId) : null;
    const fromStr  = req.query.from ? String(req.query.from) : null;
    const toStr    = req.query.to   ? String(req.query.to)   : null;

    // Si NO es allowAll y no hay IDs válidos, devuelve vacío (respeta noFallback)
    const match = allowAll ? {} : buildOwnerCriterion(scopedIds); // ⬅️ NEW
    if (!allowAll && !scopedIds.length) {
      return res.json({ items: [], total: 0, page: 1, pages: 1 });
    }

    if (estadoId) match.estadoId = estadoId;
    if (q) {
      match.$or = [
        { ruc:         { $regex: q, $options: "i" } },
        { razonSocial: { $regex: q, $options: "i" } },
      ];
    }
    if (fromStr || toStr) {
      match.createdAt = {};
      if (fromStr) match.createdAt.$gte = new Date(`${fromStr}T00:00:00.000-05:00`);
      if (toStr)   match.createdAt.$lte = new Date(`${toStr}T23:59:59.999-05:00`);
    }

    const pipeline = [
      { $match: match },
      {
        $facet: {
          items: [
            { $sort: { createdAt: -1, _id: -1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $lookup: {
                from: "users",
                let: { oid: "$ownerId" },
                pipeline: [
                  { $match: { $expr: { $eq: ["$_id", "$$oid"] } } },
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
                ownerName:  { $ifNull: [{ $arrayElemAt: ["$_owner.ownerName", 0]  }, "" ] },
                ownerEmail: { $ifNull: [{ $arrayElemAt: ["$_owner.ownerEmail", 0] }, "" ] },
              },
            },
            { $unset: ["_owner"] },
            {
              $project: {
                ruc: 1,
                razonSocial: 1,
                ownerName: 1,
                ownerEmail: 1,
                estadoNombre: 1,
                monto: 1,
                cantidad: 1,
                createdAt: 1,
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

    const [{ items = [], total = 0 } = {}] =
      await Opportunity.aggregate(pipeline).allowDiskUse(true);

    const pages = Math.max(1, Math.ceil(total / limit));
    return res.json({ items, total, page, pages });
  } catch (err) {
    console.error("[oportunidades.supervisor.list] ERROR", err);
    return res.status(500).json({ error: "No se pudo listar oportunidades (supervisor)" });
  }
}
// controllers/oportunidades.js
