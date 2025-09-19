// server/routes/dataSalesforce.routes.js
import { Router } from "express";
import { listByBase, listByRuc } from "../controllers/dataSalesforceController.js";

const router = Router();
router.get("/by-base/:baseId", listByBase);
router.get("/by-ruc/:ruc", listByRuc);

export default router;
