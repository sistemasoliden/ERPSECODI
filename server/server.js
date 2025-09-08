import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import ventasRoutes from "./routes/ventasRoutes.js";
import ejecutivesRoutes from "./routes/ejecutivesRoutes.js";
// Registra modelos referenciados por populate
import "./models/RolUsuario.js";
import "./models/EstadoUsuario.js";

import rolesUsuariosRoutes from "./routes/rolesUsuariosRoutes.js";
import estadosUsuarioRoutes from "./routes/estadosUsuarioRoutes.js";
import equipoRoutes from "./routes/equiposRoutes.js";
import baseSecodiRoutes from "./routes/baseSecodiRoutes.js";
import estadoVentaRoutes from "./routes/estadoVentaRoutes.js";
import tiposVentasRoutes from "./routes/tiposVentasRoutes.js";
import productosRoutes from "./routes/productosRoutes.js";
import modalidadVentaRoutes from "./routes/modalidadVentaRoutes.js";
import consultorRegistradoRoutes from "./routes/consultorRegistradoRoutes.js";
import segmentoEmpresaRoutes from "./routes/segmentoEmpresaRoutes.js";
import ventasActivacionRoutes from "./routes/ventasActivacionRoutes.js";
import opportunityRoutes from "./routes/opportunityRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://erpsecodi.onrender.com"
  ],
  credentials: true
}));
app.use(express.json());

// Rutas API
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/ventas", ventasRoutes);
app.use("/api/ejecutivos", ejecutivesRoutes);

app.use("/api/rolesusuarios", rolesUsuariosRoutes);
app.use("/api/estadosusuario", estadosUsuarioRoutes);
app.use("/api/equipos", equipoRoutes);
app.use("/api/basesecodi", baseSecodiRoutes);
app.use("/api/estadosventa", estadoVentaRoutes);

app.use("/api/tiposventas", tiposVentasRoutes);
app.use("/api/productos", productosRoutes);
app.use("/api/modalidadventa", modalidadVentaRoutes);
app.use("/api/consultorregistrado", consultorRegistradoRoutes);
app.use("/api/segmentoempresa", segmentoEmpresaRoutes);

// ...
app.use("/api/oportunidades", opportunityRoutes);

app.use("/api/ventas", ventasActivacionRoutes);

// 👉 Servir frontend (solo en producción)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV === "production") {
  const clientPath = path.join(__dirname, "../frontend/dist");
  app.use(express.static(clientPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientPath, "index.html"));
  });
}

// Conexión MongoDB y levantar servidor
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Conectado a MongoDB Atlas");
    app.listen(PORT, () =>
      console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`)
    );
  })
  .catch((err) => console.error("❌ Error al conectar a MongoDB:", err));
