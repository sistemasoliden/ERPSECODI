import Notification from "../models/Notification.js";

/**
 * Lista notificaciones del usuario (últimos 30 días por defecto)
 * ?all=true para traer todas
 */
export const listNotifications = async (req, res) => {
  try {
    const userId = req.user?._id;
    const all = String(req.query.all || "").toLowerCase() === "true";

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const query = { userId };
    if (!all) query.createdAt = { $gte: since };

    const items = await Notification.find(query).sort({ createdAt: -1 }).lean();
    const unread = items.filter(n => !n.read).length;

    res.json({ items, unread });
  } catch (e) {
    console.error("listNotifications", e);
    res.status(500).json({ error: "Error listando notificaciones" });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    const n = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { $set: { read: true } },
      { new: true }
    ).lean();
    if (!n) return res.status(404).json({ error: "No encontrada" });
    res.json({ item: n });
  } catch (e) {
    console.error("markAsRead", e);
    res.status(500).json({ error: "Error marcando como leída" });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user?._id;
    await Notification.updateMany({ userId, read: false }, { $set: { read: true } });
    res.json({ ok: true });
  } catch (e) {
    console.error("markAllAsRead", e);
    res.status(500).json({ error: "Error marcando todas" });
  }
};
