import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import {
  listEquipos,
  createEquipo,
  deleteEquipo,
  getMiembrosByEquipo,
  setSupervisor,
  setEjecutivos,
  removeEjecutivo,
} from "../controllers/equiposController.js";

const router = Router();

router.get("/", verifyToken, listEquipos);
router.post("/", verifyToken, createEquipo);
router.delete("/:id", verifyToken, deleteEquipo);

// info / miembros
router.get("/:id/miembros", verifyToken, getMiembrosByEquipo);

// asignaciones
router.patch("/:id/supervisor", verifyToken, setSupervisor);
router.patch("/:id/ejecutivos", verifyToken, setEjecutivos);
router.patch("/:id/ejecutivos/:userId/remove", verifyToken, removeEjecutivo);

export default router;
