// controllers/smtpController.js
import nodemailer from "nodemailer";

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

// === SOLO CONEXIÓN Y ENVÍO SIMPLE ===
export async function loginSmtp(req, res) {
  const { smtpEmail, smtpPassword } = req.body || {};
  if (!smtpEmail || !smtpPassword) return res.status(400).json({ error: "missing_credentials" });

  try {
    const t = buildTransport({ smtpEmail, smtpPassword });
    await t.verify(); // valida servidor/credenciales
    req.session.smtpAuth = { smtpEmail, smtpPassword }; // guarda en sesión de servidor
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
  if (!ensureLogged(req, res)) return;
  let { to, subject, html, templateId, variables } = req.body || {};
  if (!to) return res.status(400).json({ error: "missing_fields", message: "to requerido" });

  const { smtpEmail, smtpPassword } = req.session.smtpAuth;
  const transporter = buildTransport({ smtpEmail, smtpPassword });

  try {
    // Opcional: renderizar en backend si viene templateId
    if (!html && templateId) {
      const tpl = await EmailTemplate.findOne({
        _id: templateId,
        $or: [{ ownerEmail: smtpEmail }, { isGlobal: true }],
      }).lean();
      if (!tpl) return res.status(404).json({ error: "template_not_found" });
      html = Mustache.render(String(tpl.body || ""), variables || {});
      subject = subject || tpl.subject || "Mensaje";
    }

    await transporter.sendMail({
      from: smtpEmail,
      to,
      subject: subject || "Mensaje",
      html: html || "",
      // Si quisieras enviar texto plano alterno:
      // text: html ? html.replace(/<[^>]+>/g, " ") : undefined,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("sendOne error:", err?.message || err);
    res.status(500).json({ error: "send_failed", message: err?.message || "SMTP send failed" });
  }
}