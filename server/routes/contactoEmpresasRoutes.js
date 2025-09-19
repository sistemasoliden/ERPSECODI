

import { Router } from "express";
import { verifyToken } from "../middlewares/auth.js";
import {
  listByBase,
  listByRucStr,
  searchByRucAndQuery,
  createContactoEmpresa,
} from "../controllers/contactoEmpresaController.js"; // 👈 nombre correcto del archivo

const router = Router();

// GET /api/contactos-empresas/by-base/:baseId
router.get("/by-base/:baseId", verifyToken, listByBase);

// GET /api/contactos-empresas/by-ruc/:ruc  (opcional)
router.get("/by-ruc/:ruc", verifyToken, listByRucStr);

// GET /api/contactos-empresas?ruc=XXXXXXXXXXX&q=...
router.get("/", verifyToken, searchByRucAndQuery);

// POST /api/contactos-empresas
router.post("/", verifyToken, createContactoEmpresa); // 👈 NO repitas el prefijo aquí

export default router;

