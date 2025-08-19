import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  getProfile, // ✅ Importado
} from '../controllers/userController.js';
import { verifyToken, isAdmin } from '../middlewares/auth.js';

const router = express.Router();

// 📦 Configurar multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// 📌 Rutas de usuarios
router.get('/', verifyToken, isAdmin, getAllUsers);             // Listar todos (admin)
router.get('/:id', verifyToken, getUserById);             // Obtener por ID
router.post('/', verifyToken, isAdmin, upload.single('avatar'), createUser); // Crear
router.put('/:id', verifyToken, upload.single('avatar'), updateUser);  // Actualizar
router.get('/profile', verifyToken, getProfile);                // ✅ Nuevo endpoint: Perfil

export default router;
