// backend/controllers/userController.js
import mongoose from "mongoose";
import User from "../models/User.js";

// userController.js
export const listUsers = async (_req, res) => {
  try {
    const users = await User.find()
.populate("role", "name slug")
      .populate("estadoUsuario", "nombre")
      .lean();
    res.json(users);
  } catch (e) {
    console.error("listUsers error:", e);
    res.status(500).json({ error: "Error listando usuarios", detail: e.message });
  }
};

// Solo usuarios activos
export const listActiveUsers = async (_req, res) => {
  try {
    const ESTADO_ACTIVO_ID = new mongoose.Types.ObjectId("68a4f3dc27e6abe98157a845"); // 👈 ID de "Activo"

    const users = await User.find({ estadoUsuario: ESTADO_ACTIVO_ID })
      .populate("role", "nombre slug")
      .populate("estadoUsuario", "nombre")
      .lean();

    res.json(users);
  } catch (e) {
    console.error("listActiveUsers error:", e);
    res.status(500).json({ error: "Error listando usuarios activos", detail: e.message });
  }
};


export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("role", "nombre slug")
      .populate("estadoUsuario", "nombre");
    if (!user) return res.status(404).json({ error: "No encontrado" });
    res.json(user);
  } catch {
    res.status(500).json({ error: "Error obteniendo usuario" });
  }
};

// backend/controllers/userController.js

export const createUser = async (req, res) => {
  try {
    const body = { ...req.body };

    // Fuerza esquema: no aceptar orgEmail del cliente (se autogenera)
    delete body.orgEmail;

    // Asegura que vengan firstName y lastName (el schema ya los pide required=true)
    if (!body.firstName || !body.lastName) {
      return res.status(400).json({ error: "firstName y lastName son obligatorios" });
    }

    // Asegura que role/estadoUsuario sean ObjectId válidos
    if (typeof body.role === "string" && mongoose.Types.ObjectId.isValid(body.role)) {
      body.role = new mongoose.Types.ObjectId(body.role);
    }
    if (typeof body.estadoUsuario === "string" && mongoose.Types.ObjectId.isValid(body.estadoUsuario)) {
      body.estadoUsuario = new mongoose.Types.ObjectId(body.estadoUsuario);
    }

    const user = await User.create(body);
    const populated = await User.findById(user._id)
      .populate("role", "nombre slug")
      .populate("estadoUsuario", "nombre");
    res.status(201).json(populated);
  } catch (e) {
    res.status(400).json({ error: e.message || "Error creando usuario" });
  }
};


export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const body = { ...req.body };

    delete body.password;
    delete body.orgEmail;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "No encontrado" });

    Object.assign(user, body);
    await user.save(); // 👈 esto dispara pre("validate") y regenera orgEmail

    const populated = await User.findById(user._id)
      .populate("role", "nombre slug")
      .populate("estadoUsuario", "nombre");

    res.json(populated);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "Error actualizando usuario" });
  }
};


export const deleteUser = async (req, res) => {
  try {
    const ok = await User.findByIdAndDelete(req.params.id);
    if (!ok) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "Error eliminando usuario" });
  }
};

// --------- tus endpoints existentes (ajustados a /me/...) ----------
export const updateAvatar = async (req, res) => {
  try {
    const { avatar } = req.body;
    if (!avatar) return res.status(400).json({ error: "Falta avatar URL" });

    const user = await User.findByIdAndUpdate(req.user.id, { avatar }, { new: true })
      .populate("role", "nombre slug")
      .populate("estadoUsuario", "nombre");
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(user);
  } catch {
    res.status(500).json({ error: "Error actualizando avatar" });
  }
};

export const updateDniUrl = async (req, res) => {
  try {
    const { dniUrl } = req.body;
    if (!dniUrl) return res.status(400).json({ error: "Falta dniUrl" });

    const user = await User.findByIdAndUpdate(req.user.id, { dniUrl }, { new: true })
      .populate("role", "nombre slug")
      .populate("estadoUsuario", "nombre");
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(user);
  } catch {
    res.status(500).json({ error: "Error actualizando dniUrl" });
  }
};

export const cambiarEstadoUsuario = async (req, res) => {
  try {
    const { estadoId } = req.body; // nuevo ObjectId de estadousuario

    if (!estadoId) {
      return res.status(400).json({ error: "Se requiere estadoId" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { estadoUsuario: estadoId },
      { new: true, runValidators: true }
    ).populate("estadoUsuario", "nombre");

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({
      message: "Estado actualizado correctamente",
      user,
    });
  } catch (err) {
    console.error("Error en cambiarEstadoUsuario:", err);
    res.status(500).json({ error: "No se pudo cambiar estado" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }

    const bcrypt = (await import("bcryptjs")).default;
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);

    const user = await User.findByIdAndUpdate(
      id,
      { password: hashed },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (e) {
    console.error("resetPassword error:", e);
    res.status(500).json({ error: "Error actualizando contraseña" });
  }
};


export const asignarEquipo = async (req, res) => {
  try {
    const { id } = req.params;           // userId
    const { equipoId } = req.body;       // ObjectId del equipo o null

    const user = await User.findById(id).populate("role", "name");
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    // Solo permitir a roles Comercial o Supervisor Comercial
    const roleName = (user.role?.name || "").toLowerCase();
    const ok = roleName === "comercial" || roleName === "supervisor comercial";
    if (!ok) {
      return res.status(400).json({ error: "Este usuario no es Comercial ni Supervisor Comercial" });
    }

    user.equipo = equipoId || null;
    await user.save();

    const populated = await User.findById(user._id)
      .populate("equipo", "name")
      .populate("role", "name");

    res.json({ message: "Equipo asignado", user: populated });
  } catch (e) {
    console.error("asignarEquipo error:", e);
    res.status(400).json({ error: "No se pudo asignar equipo" });
  }
};
