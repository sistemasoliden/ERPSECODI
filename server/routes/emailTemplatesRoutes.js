// routes/emailTemplatesRoutes.js
import { Router } from "express";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "../controllers/emailTemplatesController.js";
import { verifyToken } from "../middlewares/auth.js";

const router = Router();
 router.use(verifyToken); // <-- asegura req.user en todas
router.get("/email-templates", listTemplates);
router.post("/email-templates", createTemplate);
router.put("/email-templates/:id", updateTemplate);
router.delete("/email-templates/:id", deleteTemplate);

export default router;
