import mongoose from "mongoose";
import Opportunity from "../models/Opportunity.js";
import TipoOportunidad from "../models/TipoOportunidad.js";
import BaseSecodi from "../models/BaseSecodi.js";
import TipoVenta from "../models/TipoVenta.js";
import Producto from "../models/Producto.js";
import ModalidadVenta from "../models/ModalidadVenta.js";

const CLOSED_IDS = new Set([
  "68b859269d14cf7b7e51084d", // cerrada ganada
  "68b859269d14cf7b7e51084e", // cerrada perdida
]);

// ID por defecto: "Propuesta identificada"
const DEFAULT_ESTADO_ID = new mongoose.Types.ObjectId("68b859269d14cf7b7e510848");

// ... imports y constantes
export async function createOpportunity(req, res) {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ error: "No autenticado" });

    const {
      ruc,                   // string (11 dígitos)
      monto,
      notas,
      estadoId,
      contactId,             // opcional
      cantidad,
      tipoVentaId,           // opcional
      productoId,            // opcional (depende de tipoVenta)
      modalidadVentaId,      // opcional
    } = req.body || {};

    if (!ruc) return res.status(400).json({ error: "RUC requerido" });

    // resolver razón social desde BaseSecodi
    const base = await BaseSecodi.findOne({ ruc: String(ruc).replace(/\D/g, "") });
    const razonSocial = base?.razonSocial || base?.RAZON_SOCIAL || "";

    // etapa
    const estadoObjId = estadoId ? new mongoose.Types.ObjectId(estadoId) : DEFAULT_ESTADO_ID;
    const tipo = await TipoOportunidad.findById(estadoObjId);
    if (!tipo) return res.status(400).json({ error: "Estado inválido" });

    // validar opcionales (si llegan)
    const clean = {};
    if (contactId && mongoose.isValidObjectId(contactId)) clean.contactId = contactId;
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

    const openOnly   = String(req.query.openOnly) === "true";
    const onlyClosed = String(req.query.onlyClosed) === "true";

    const match = { ownerId: new mongoose.Types.ObjectId(userId) };
    if (estadoId) match.estadoId = estadoId;
    if (!estadoId) {
      if (openOnly)   match.cerrada = false;
      if (onlyClosed) match.cerrada = true;
    }
    if (q) {
      match.$or = [
        { ruc: { $regex: q, $options: "i" } },
        { razonSocial: { $regex: q, $options: "i" } },
      ];
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
                direccion: 1, sunatDepartment: 1, sunatProvince: 1, sunatDistrict: 1,
                movistarLines: 1, claroLines: 1, entelLines: 1, otherLines: 1,
                uncountedLines: 1, totalLines: 1,
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
                        { $convert: { input: "$$id", to: "objectId", onError: null, onNull: null } },
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
                        { $convert: { input: "$$id", to: "objectId", onError: null, onNull: null } },
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
          tipoVentaNombre: { $ifNull: [{ $arrayElemAt: ["$_tv.nombre", 0] }, "$tipoVentaNombre"] },
          productoNombre:  { $ifNull: [{ $arrayElemAt: ["$_prod.nombre", 0] }, "$productoNombre"] },
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
                            { $convert: { input: "$$cid", to: "objectId", onError: null, onNull: null } },
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
                nombre:  { $ifNull: ["$referenceName", "$name"] },
                celular: { $ifNull: ["$contactDescription", { $ifNull: ["$phone", ""] }] },
                cargo:   { $ifNull: ["$position", ""] },
                correo:  { $ifNull: ["$email", ""] },
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
              { $ifNull: ["$contacto", { nombre: "", celular: "", cargo: "", correo: "" }] },
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
      { _id: id, ownerId: userId },             // 👈 ownerId
      {
        estadoId: estadoIdStr,                  // 👈 string
        estadoNombre: tipo.nombre,
        cerrada: willClose,                     // 👈 actualiza bandera
        closedAt: willClose ? new Date() : undefined,
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: "Oportunidad no encontrada" });
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
    return res.status(500).json({ error: "No se pudo actualizar la oportunidad" });
  }
}
