// controllers/emailTemplatesController.js
import EmailTemplate from "../models/EmailTemplate.js";

function requireSmtpSession(req, res) {
  const email = req.session?.smtpAuth?.smtpEmail;
  if (!email) {
    res.status(401).json({ error: "not_authenticated" });
    return null;
  }
  return email;
}

export async function listTemplates(req, res) {
  const ownerEmail = requireSmtpSession(req, res);
  if (!ownerEmail) return;
  try {
    const items = await EmailTemplate.find({
      $or: [{ ownerEmail }, { isGlobal: true }],
    })
      .sort({ isGlobal: -1, updatedAt: -1, name: 1 })
      .lean();
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: "list_failed", message: e.message });
  }
}

export async function createTemplate(req, res) {
  const ownerEmail = requireSmtpSession(req, res);
  if (!ownerEmail) return;
  const { name, subject = "", body = "" } = req.body || {};
  if (!name) return res.status(400).json({ error: "name_required" });
  try {
    const item = await EmailTemplate.create({ ownerEmail, name, subject, body });
    res.json({ ok: true, item });
  } catch (e) {
    res.status(400).json({ error: "create_failed", message: e.message });
  }
}

export async function updateTemplate(req, res) {
  const ownerEmail = requireSmtpSession(req, res);
  if (!ownerEmail) return;
  const { id } = req.params;
  const { name, subject, body } = req.body || {};
  try {
    const item = await EmailTemplate.findOneAndUpdate(
      { _id: id, ownerEmail },
      { ...(name != null && { name }), ...(subject != null && { subject }), ...(body != null && { body }) },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true, item });
  } catch (e) {
    res.status(400).json({ error: "update_failed", message: e.message });
  }
}

export async function deleteTemplate(req, res) {
  const ownerEmail = requireSmtpSession(req, res);
  if (!ownerEmail) return;
  const { id } = req.params;
  try {
    const del = await EmailTemplate.deleteOne({ _id: id, ownerEmail });
    res.json({ ok: true, deleted: del.deletedCount });
  } catch (e) {
    res.status(400).json({ error: "delete_failed", message: e.message });
  }
}
