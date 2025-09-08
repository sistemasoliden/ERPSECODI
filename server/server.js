// server.js (ESM)
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Modelos referenciados por populate (si los necesitas cargados)
import "./models/RolUsuario.js";
import "./models/EstadoUsuario.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ──────────────────────────────────────────────────────────────
// CORS
// ──────────────────────────────────────────────────────────────
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const allowedOrigins = new Set([FRONTEND_URL, "http://localhost:5173"]);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.has(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());

// __dirname / __filename en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ──────────────────────────────────────────────────────────────
/** Helper para montar routers con logs y sin tumbar el server si uno falla */
async function mountRouter(mountPath, modulePath, name) {
  try {
    console.log(`➡️  Mounting ${name} at ${mountPath}  (${modulePath})`);
    const mod = await import(modulePath);
    app.use(mountPath, mod.default);
    console.log(`✅ Mounted ${name}`);
  } catch (err) {
    console.error(`❌ Failed mounting ${name} (${modulePath})`);
    console.error(err?.stack || err);
  }
}
// ──────────────────────────────────────────────────────────────

// 🔧 Montaje de routers
async function mountAllRouters() {
  await mountRouter("/api/auth", "./routes/authRoutes.js", "authRoutes");
  await mountRouter("/api/users", "./routes/userRoutes.js", "userRoutes");
  await mountRouter("/api/ventas", "./routes/ventasRoutes.js", "ventasRoutes");
  await mountRouter("/api/ejecutivos", "./routes/ejecutivesRoutes.js", "ejecutivesRoutes");

  await mountRouter("/api/rolesusuarios", "./routes/rolesUsuariosRoutes.js", "rolesUsuariosRoutes");
  await mountRouter("/api/estadosusuario", "./routes/estadosUsuarioRoutes.js", "estadosUsuarioRoutes");
  await mountRouter("/api/equipos", "./routes/equiposRoutes.js", "equipoRoutes");
  await mountRouter("/api/basesecodi", "./routes/baseSecodiRoutes.js", "baseSecodiRoutes");
  await mountRouter("/api/estadosventa", "./routes/estadoVentaRoutes.js", "estadoVentaRoutes");
  await mountRouter("/api/tiposventas", "./routes/tiposVentasRoutes.js", "tiposVentasRoutes");
  await mountRouter("/api/productos", "./routes/productosRoutes.js", "productosRoutes");
  await mountRouter("/api/modalidadventa", "./routes/modalidadVentaRoutes.js", "modalidadVentaRoutes");
  await mountRouter("/api/consultorregistrado", "./routes/consultorRegistradoRoutes.js", "consultorRegistradoRoutes");
  await mountRouter("/api/segmentoempresa", "./routes/segmentoEmpresaRoutes.js", "segmentoEmpresaRoutes");

  await mountRouter("/api/oportunidades", "./routes/opportunityRoutes.js", "opportunityRoutes");
  // Si este comparte base con /api/ventas y prefieres separarlo:
  await mountRouter("/api/ventas-activacion", "./routes/ventasActivacionRoutes.js", "ventasActivacionRoutes");
}

// ──────────────────────────────────────────────────────────────
// Servir frontend (SPA) si existe el build
// ──────────────────────────────────────────────────────────────
const clientPath = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(clientPath)) {
  console.log(`🗂  Serving static from: ${clientPath}`);
  app.use(express.static(clientPath, { index: false }));
  // Cualquier GET que NO empiece con /api => React index.html
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(clientPath, "index.html"));
  });
} else {
  console.warn(`⚠️  Frontend build not found at ${clientPath}`);
}

// ──────────────────────────────────────────────────────────────
// Arranque
// ──────────────────────────────────────────────────────────────
async function start() {
  console.log(`ENV: ${process.env.NODE_ENV || "development"}`);
  await mountAllRouters();

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Conectado a MongoDB Atlas");
  } catch (err) {
    console.error("❌ Error al conectar a MongoDB:", err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
  });
}

start();
