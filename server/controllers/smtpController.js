// controllers/smtpController.js
import nodemailer from "nodemailer";
import Correo from "../models/Correo.js";
import SmtpLog from "../models/SmtpLog.js";


function smtpHostFor(email) {
  const e = (email || "").toLowerCase();
  if (e.endsWith("@outlook.com") || e.endsWith("@hotmail.com") || e.endsWith("@live.com"))
    return "smtp-mail.outlook.com";
  return "smtp.office365.com"; // O365/Exchange
}

function buildTransport({ smtpEmail, smtpPassword }) {
  return nodemailer.createTransport({
    host: smtpHostFor(smtpEmail),
    port: 587,
    secure: false,        // STARTTLS
    requireTLS: true,
    auth: { user: smtpEmail, pass: smtpPassword },
    tls: { rejectUnauthorized: false }, // quítalo en prod si tienes CA correcta
  });
}

function ensureLogged(req, res) {
  if (!req.session?.smtpAuth?.smtpEmail || !req.session?.smtpAuth?.smtpPassword) {
    res.status(401).json({ error: "not_authenticated" });
    return false;
  }
  return true;
}

/* ==========================
   CREDENCIALES EN BD (texto plano)
   ========================== */
// GET /correos/me
export async function getCredenciales(req, res) {
  const uid = req.user?._id || req.user?.id;
  if (!uid) return res.status(401).json({ error: "not_authenticated" });
  const row = await Correo.findOne({ userId: uid }).lean();
  if (!row) return res.json({ exists: false });
  // No devolvemos la contraseña por seguridad básica de UI
  return res.json({ exists: true, smtpEmail: row.smtpEmail, updatedAt: row.updatedAt });
}

// POST /correos/me  body: { smtpEmail, smtpPassword }
export async function saveCredenciales(req, res) {
  const uid = req.user?._id || req.user?.id;
  if (!uid) return res.status(401).json({ error: "not_authenticated" });
  const { smtpEmail, smtpPassword } = req.body || {};
  if (!smtpEmail || !smtpPassword) return res.status(400).json({ error: "missing_credentials" });

  const doc = await Correo.findOneAndUpdate(
    { userId: uid },
    { smtpEmail, smtpPassword }, // ⚠️ texto plano
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  // Opcional: también refrescamos la sesión con estos datos
  req.session.smtpAuth = { smtpEmail: doc.smtpEmail, smtpPassword: doc.smtpPassword };
  req.session.save(() => res.json({ ok: true, smtpEmail: doc.smtpEmail }));
}

// DELETE /correos/me
export async function deleteCredenciales(req, res) {
  const uid = req.user?._id || req.user?.id;
  if (!uid) return res.status(401).json({ error: "not_authenticated" });
  await Correo.deleteOne({ userId: uid });
  // limpiar sesión si pertenece al mismo correo
  if (req.session?.smtpAuth) {
    delete req.session.smtpAuth;
  }
  res.json({ ok: true });
}

/* ==========================
   LOGIN SMTP (sesión) — mantiene tus endpoints
   ========================== */
export async function loginSmtp(req, res) {
  const { smtpEmail, smtpPassword } = req.body || {};
  if (!smtpEmail || !smtpPassword) return res.status(400).json({ error: "missing_credentials" });

  try {
    const t = buildTransport({ smtpEmail, smtpPassword });
    await t.verify(); // valida servidor/credenciales

    // guarda en sesión
    req.session.smtpAuth = { smtpEmail, smtpPassword };

    // guarda/actualiza en BD (texto plano)
    const uid = req.user?._id || req.user?.id;
    if (uid) {
      await Correo.findOneAndUpdate(
        { userId: uid },
        { smtpEmail, smtpPassword },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    req.session.save(() => res.json({ ok: true, email: smtpEmail }));
  } catch (err) {
    console.error("SMTP verify error:", err?.message || err);
    res.status(401).json({ error: "auth_failed", message: err?.message || "SMTP auth failed" });
  }
}

export function sessionStatus(req, res) {
  const email = req.session?.smtpAuth?.smtpEmail;
  res.json({ loggedIn: !!email, email: email || null });
}

export function logout(req, res) {
  req.session.destroy(() => res.json({ ok: true }));
}

export async function sendOne(req, res) {
  let { to, subject, html } = req.body || {};
  if (!to) return res.status(400).json({ error: "missing_fields", message: "to requerido" });

  let smtpEmail = req.session?.smtpAuth?.smtpEmail;
  let smtpPassword = req.session?.smtpAuth?.smtpPassword;

  if (!smtpEmail || !smtpPassword) {
    const uid = req.user?._id || req.user?.id;
    if (!uid) return res.status(401).json({ error: "not_authenticated" });
    const cred = await Correo.findOne({ userId: uid }).lean();
    if (!cred) return res.status(401).json({ error: "not_authenticated" });
    smtpEmail = cred.smtpEmail;
    smtpPassword = cred.smtpPassword;
  }

  const transporter = buildTransport({ smtpEmail, smtpPassword });

  const uid = req.user?._id || req.user?.id;

  try {
    await transporter.sendMail({
      from: smtpEmail,
      to,
      subject: subject || "Mensaje",
      html: html || "",
    });

    // 🔹 Guardar log “ok”
    await SmtpLog.create({ userId: uid, ok: true });
    res.json({ ok: true });
  } catch (err) {
    console.error("sendOne error:", err?.message || err);
    // 🔹 Guardar log “fail”
    await SmtpLog.create({ userId: uid, ok: false });
    res.status(500).json({ error: "send_failed", message: err?.message || "SMTP send failed" });
  }
}
export async function getStats(req, res) {
  const uid = req.user?._id || req.user?.id;
  if (!uid) return res.status(401).json({ error: "not_authenticated" });

  const byDay = await SmtpLog.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(uid) } },
    {
      $group: {
        _id: {
          y: { $year: "$date" },
          m: { $month: "$date" },
          d: { $dayOfMonth: "$date" },
        },
        total: { $sum: 1 },
        ok: { $sum: { $cond: ["$ok", 1, 0] } },
        fail: { $sum: { $cond: ["$ok", 0, 1] } },
      },
    },
    { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
  ]);

  res.json({ byDay });
}