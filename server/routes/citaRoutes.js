// backend/routes/citaRoutes.js
import { Router } from "express";
import { listCitas, createCita, deleteCita, updateCita , setEstadoCita} from "../controllers/citaController.js";
import { verifyToken } from "../middlewares/auth.js";

const router = Router();

router.get("/", verifyToken, listCitas);
router.post("/", verifyToken, createCita);
router.delete("/:id", verifyToken, deleteCita);
router.put("/:id", verifyToken, updateCita); 
router.patch("/:id/estado", verifyToken, setEstadoCita);
router.delete("/:id", verifyToken, deleteCita);

export default router;
