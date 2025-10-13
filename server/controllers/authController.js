// server/controllers/authController.js
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const ORG_DOMAIN = "@claronegocios-secodi.com";

export async function login(req, res) {
  try {
    const orgEmail = (req.body?.orgEmail ?? "").toString().trim().toLowerCase();
    const password = (req.body?.password ?? "").toString();

    if (!orgEmail) return res.status(400).json({ error: "Falta orgEmail" });
    if (!password) return res.status(400).json({ error: "Falta password" });
    if (!orgEmail.endsWith(ORG_DOMAIN)) {
      return res.status(400).json({ error: `El correo debe terminar en ${ORG_DOMAIN}` });
    }

    const user = await User.findOne({ orgEmail })
      .populate("role")
      .populate("estadoUsuario")
      .exec();

    if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

    // 🔒 Bloqueo si no está activo
    const estadoNombre = user.estadoUsuario?.nombre?.toLowerCase() || "";
    if (estadoNombre !== "activo") {
      return res.status(403).json({ error: "Usuario inactivo. Contacta a Sistemas." });
    }

    // Si está todo bien -> actualiza último login y genera token
    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Ojo: si no quieres enviar password al front
    const userSafe = user.toJSON(); // tu schema ya lo limpia

    res.json({ token, user: userSafe });
  } catch (e) {
    console.error("Error en login:", e);
    res.status(500).json({ error: "Error en login" });
  }
}
