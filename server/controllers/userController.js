import User from '../models/User.js';
import path from 'path';
import fs from 'fs';

// 📄 Listar todos los usuarios (admin)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
};

// 📄 Obtener usuario por ID
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener usuario' });
  }
};

// ✨ Crear usuario con avatar opcional
export const createUser = async (req, res) => {
  try {
    const { name, email, password, role, roleDescription } = req.body;

    // Verificar si ya existe un usuario con el mismo email
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email ya registrado' });

    const userData = { name, email, password, role, roleDescription };

    if (req.file) {
      userData.avatar = `/uploads/${req.file.filename}`;
    }

    const newUser = new User(userData);
    await newUser.save();

    res.status(201).json({ message: 'Usuario creado exitosamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al crear usuario' });
  }
};

// ✨ Actualizar usuario (nombre, descripción y avatar opcional)
export const updateUser = async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      roleDescription: req.body.roleDescription,
    };

    if (req.file) {
      updateData.avatar = `/uploads/${req.file.filename}`;
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updated) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al actualizar usuario' });
  }
};

// 🆕 📄 Obtener perfil del usuario autenticado
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener perfil' });
  }
};
