// server/controllers/contactosEmpresasController.js
import mongoose from "mongoose";
import ContactoEmpresa from "../models/ContactoEmpresa.js";
import BaseSecodi from "../models/BaseSecodi.js";
import ContactType from "../models/ContactType.js";

const isOID = (id) => mongoose.isValidObjectId(id);

/**
 * GET /contactos-empresas/by-base/:baseId
 * Usa el ObjectId de BaseSecodi para traer contactos.
 * Los contactos guardan ruc/base/rucId = ObjectId(BaseSecodi._id).
 */
export async function listByBase(req, res) {
  try {
    const { baseId } = req.params;
    if (!isOID(baseId)) return res.status(400).json({ message: "baseId inválido" });

    const filter = { $or: [{ ruc: baseId }, { base: baseId }, { rucId: baseId }] };

    const items = await ContactoEmpresa.find(filter)
      .populate("contactType", "nametypecontact")
      .sort({ updatedAt: -1 })
      .lean();

    return res.json(items);
  } catch (err) {
    console.error("[contactos.byBase]", err);
    return res.status(500).json({ message: "Error cargando contactos" });
  }
}

/**
 * GET /contactos-empresas/by-ruc/:ruc
 * 1) Normaliza el RUC (11 dígitos).
 * 2) Busca en BaseSecodi por ruc (string).
 * 3) Con el _id de la base, trae los contactos (por ObjectId).
 */
export async function listByRucStr(req, res) {
  try {
    const rucRaw = String(req.params.ruc || "");
    const ruc = rucRaw.replace(/\D/g, "");
    if (ruc.length !== 11) return res.status(400).json({ message: "RUC inválido" });

    const base = await BaseSecodi.findOne({ ruc }).select("_id").lean();
    if (!base?._id) return res.json([]);

    const baseId = base._id.toString();
    const filter = { $or: [{ ruc: baseId }, { base: baseId }, { rucId: baseId }] };

    const items = await ContactoEmpresa.find(filter)
      .populate("contactType", "nametypecontact")
      .sort({ updatedAt: -1 })
      .lean();

    return res.json(items);
  } catch (err) {
    console.error("[contactos.byRucStr]", err);
    return res.status(500).json({ message: "Error cargando contactos" });
  }
}

/**
 * GET /contactos-empresas?ruc=XXXXXXXXXXX&q=...
 * Búsqueda rápida por RUC (string) y texto libre (nombre/cargo/valor).
 */
export async function searchByRucAndQuery(req, res) {
  try {
    const rucRaw = String(req.query.ruc || "");
    const ruc = rucRaw.replace(/\D/g, "");
    const q = String(req.query.q || "").trim();

    if (!ruc || ruc.length !== 11) {
      return res.status(400).json({ error: "ruc (11 dígitos) es requerido" });
    }

    // obtener baseId desde BaseSecodi.ruc (string)
    const base = await BaseSecodi.findOne({ ruc }).select("_id").lean();
    if (!base?._id) return res.json({ items: [] });

    const baseId = base._id.toString();
    const match = { $or: [{ ruc: baseId }, { base: baseId }, { rucId: baseId }] };

    if (q) {
      match.$and = [
        {
          $or: [
            { referenceName: { $regex: q, $options: "i" } },
            { position: { $regex: q, $options: "i" } },
            { contactDescription: { $regex: q, $options: "i" } },
          ],
        },
      ];
    }

    const items = await ContactoEmpresa.find(match)
      .populate("contactType", "nametypecontact")
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    return res.json({ items });
  } catch (err) {
    console.error("[contactos.search]", err);
    return res.status(500).json({ error: "No se pudieron buscar contactos" });
  }
}

/**
 * POST /contactos-empresas
 * Crea un contacto y lo asocia a la empresa por su RUC (string) → resuelve baseId.
 * body: { ruc, referenceName, position?, contactDescription?, contactType, source? }
 */
export async function createContactoEmpresa(req, res) {
  try {
    const { ruc, referenceName, position, contactDescription, contactType, source } = req.body || {};
    if (!ruc) return res.status(400).json({ message: "RUC requerido" });

    // ruc viene como string (11 dígitos) -> buscamos BaseSecodi para obtener su _id
    const base = await BaseSecodi.findOne({ ruc: String(ruc).replace(/\D/g, "") }).select("_id");
    if (!base?._id) return res.status(404).json({ message: "Empresa no encontrada" });

    const item = await ContactoEmpresa.create({
      ruc: new mongoose.Types.ObjectId(base._id),  // <- guardamos el ObjectId de BaseSecodi
      referenceName: referenceName?.trim() || "",
      position: position?.trim() || "",
      contactDescription: contactDescription?.trim() || "",
      contactType: contactType || null,
      source: source || null,
    });

    const populated = await item.populate("contactType", "nametypecontact");
    res.json({ ok: true, item: populated });
  } catch (err) {
    console.error("[contactosempresas.create]", err);
    res.status(500).json({ message: "No se pudo crear el contacto" });
  }
}