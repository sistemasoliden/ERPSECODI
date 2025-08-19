import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import { fileURLToPath } from "url";
import path from "path";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import ventasRoutes from "./routes/ventasRoutes.js";
import ejecutivesRoutes from "./routes/ejecutivesRoutes.js";

import User from "./models/User.js";
import bcrypt from "bcryptjs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
if (process.env.NODE_ENV === "production") {
    const clientPath = path.join(__dirname, "../frontend/dist");
  app.use(express.static(clientPath));

  // Cualquier ruta que no sea API debe devolver index.html
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientPath, "index.html"));
  });
}

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

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/ventas", ventasRoutes);
app.use("/api/ejecutivos", ejecutivesRoutes);


app.get("/", (req, res) => {
  res.send("ERP Backend conectado a MongoDB Atlas");
});

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(async () => {
  console.log("✅ Conectado a MongoDB Atlas");

  

  // Inicia el servidor
  app.listen(PORT, () =>
    console.log(`🚀 Servidor backend escuchando en http://localhost:${PORT}`)
  );
})
.catch((err) => console.error("❌ Error al conectar a MongoDB:", err));
