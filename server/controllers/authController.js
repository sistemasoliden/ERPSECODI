import User from "../models/User.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Validar correo corporativo
    if (!email.endsWith("@claronegocios-secodi.com")) {
      return res
        .status(400)
        .json({ error: "Solo correos corporativos son válidos" });
    }

    // Buscar usuario
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    // Validar contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    // Actualizar última conexión
    user.lastLogin = new Date();
    await user.save();

    // Generar JWT
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    // Respuesta al frontend
    res.json({
      message: "Login exitoso",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin, // 👈 Ahora el frontend puede mostrarlo
        createdAt: user.createdAt,  // 👈 Fecha creación
        updatedAt: user.updatedAt,  // 👈 Última actualización
      },
      token,
    });
  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};
