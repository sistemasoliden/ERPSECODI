// backend/controllers/citaController.js
import Cita from "../models/Cita.js";
import Notification from "../models/Notification.js";


export const listCitas = async (req, res) => {
  try {
    // tu verifyToken setea _id
    const uid = req.user?._id || req.user?.id; // por si acaso
    if (!uid) return res.status(401).json({ error: "Sin usuario en la sesión" });

    // si el Schema tiene userId: { type: ObjectId }, Mongoose castea string automáticamente
    const items = await Cita.find({ userId: uid })
      .sort({ inicio: -1 })
      .lean();

    return res.json({ items, total: items.length });
  } catch (e) {
    console.error("listCitas", e);
    return res.status(500).json({ error: "Error listando citas" });
  }
};

export const createCita = async (req, res) => {
  try {
    const {
      titulo, tipo, mensaje, direccion, inicio, fin,
      ruc, razonSocial, opportunityId,
    } = req.body;

    if (!inicio) return res.status(400).json({ error: "inicio es requerido" });

    const start = new Date(inicio);
    const end = fin ? new Date(fin) : new Date(start.getTime() + 60 * 60 * 1000);

    const cita = await Cita.create({
      userId: req.user?._id,
      opportunityId, ruc, razonSocial,
      titulo: (titulo || "Cita").trim(),
      tipo: (tipo || "presencial").toLowerCase(),
      mensaje, direccion,
      inicio: start, fin: end,
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
   const found = await Cita.findOne({ _id: id, userId: uid });    if (!found) return res.status(404).json({ error: "No encontrada" });
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

    const allowed = ["titulo", "tipo", "mensaje", "direccion", "inicio", "fin", "lugar", "notas"];
    const patch = {};
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];

    const item = await Cita.findOneAndUpdate(
{ _id: id, userId: uid },
      patch,
      { new: true }
    ).lean();

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
