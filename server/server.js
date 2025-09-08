import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import fs from "fs";

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


// Tu modelo User ya está importado desde los controladores o rutas.


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
// 👉 Servir frontend (SPA)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveExistingPath(...candidates) {
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

if (process.env.NODE_ENV === "production") {
  const clientPath = resolveExistingPath(
    path.join(__dirname, "../frontend/dist"),
    path.join(__dirname, "../client/dist"),
    path.join(__dirname, "../dist"),
    path.join(__dirname, "./dist")
  );

  if (clientPath) {
    console.log(`🗂  Serving static from: ${clientPath}`);
    // No dejes que sirva index por defecto; lo controlamos abajo
    app.use(express.static(clientPath, { index: false }));

    // Cualquier GET que NO empiece con /api => index.html (React SPA)
    app.get(/^\/(?!api).*/, (req, res) => {
      res.sendFile(path.join(clientPath, "index.html"));
    });
  } else {
    console.warn("⚠️  No se encontró el build del frontend. Asegúrate de construirlo en deploy.");
  }
}
