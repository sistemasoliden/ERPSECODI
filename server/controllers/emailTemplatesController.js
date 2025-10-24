// controllers/emailTemplatesController.js
import EmailTemplate from "../models/EmailTemplate.js";
import Correo from "../models/Correo.js"; // tu modelo 'correos' { userId, smtpEmail, smtpPassword }

async function getOwnerEmail(req) {
  // 1) sesión SMTP si existe
  const fromSession = req.session?.smtpAuth?.smtpEmail;
  if (fromSession) return fromSession;

  // 2) credenciales persistidas del usuario logueado
  const uid = req.user?._id || req.user?.id;
  if (!uid) return null;

  const doc = await Correo.findOne({ userId: uid }).select("smtpEmail").lean();
  return doc?.smtpEmail || null;
}

export async function listTemplates(req, res) {
  try {
    const ownerEmail = await getOwnerEmail(req);
    if (!ownerEmail) return res.status(401).json({ error: "not_authenticated" });

    const items = await EmailTemplate.find({
      $or: [{ ownerEmail }, { isGlobal: true }],
    }).sort({ updatedAt: -1 }).lean();

    res.json({ items });
  } catch (err) {
    console.error("listTemplates:", err);
    res.status(500).json({ error: "server_error" });
  }
}

export async function createTemplate(req, res) {
  try {
    const ownerEmail = await getOwnerEmail(req);
    if (!ownerEmail) return res.status(401).json({ error: "not_authenticated" });

    const { name, subject = "", body = "" } = req.body || {};
    if (!name) return res.status(400).json({ error: "missing_name" });

    const doc = await EmailTemplate.findOneAndUpdate(
      { ownerEmail, name },
      { ownerEmail, name, subject, body },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({ ok: true, item: doc });
  } catch (err) {
    console.error("createTemplate:", err);
    res.status(500).json({ error: "server_error" });
  }
}

export async function updateTemplate(req, res) {
  try {
    const ownerEmail = await getOwnerEmail(req);
    if (!ownerEmail) return res.status(401).json({ error: "not_authenticated" });

    const { id } = req.params;
    const { name, subject = "", body = "" } = req.body || {};

    const doc = await EmailTemplate.findOneAndUpdate(
      { _id: id, ownerEmail },
      { name, subject, body },
      { new: true }
    ).lean();

    if (!doc) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true, item: doc });
  } catch (err) {
    console.error("updateTemplate:", err);
    res.status(500).json({ error: "server_error" });
  }
}

export async function deleteTemplate(req, res) {
  try {
    const ownerEmail = await getOwnerEmail(req);
    if (!ownerEmail) return res.status(401).json({ error: "not_authenticated" });

    const { id } = req.params;
    await EmailTemplate.deleteOne({ _id: id, ownerEmail });
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteTemplate:", err);
    res.status(500).json({ error: "server_error" });
  }
}
