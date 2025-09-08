
// backend/routes/userRoutes.js
import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import {
  listUsers, getUser, createUser, updateUser, deleteUser,
  updateAvatar, updateDniUrl, cambiarEstadoUsuario, resetPassword, asignarEquipo, listActiveUsers
} from "../controllers/userController.js";

const router = Router();

// Endpoints de archivos (ME) PRIMERO
router.put("/me/avatar", verifyToken, updateAvatar);
router.put("/me/dni", verifyToken, updateDniUrl);
router.get("/activos", listActiveUsers);

// CRUD básico DESPUÉS
router.get("/", verifyToken, listUsers);
router.get("/:id", verifyToken, getUser);
router.post("/", verifyToken, createUser);
router.put("/:id", verifyToken, updateUser);
router.delete("/:id", verifyToken, deleteUser);
router.patch("/:id/estado", verifyToken, cambiarEstadoUsuario);
router.patch("/:id/password/reset", verifyToken, resetPassword);
router.patch("/:id/equipo", verifyToken, asignarEquipo);


export default router;
