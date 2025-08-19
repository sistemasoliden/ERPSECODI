import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import ventasRoutes from "./routes/ventasRoutes.js";
import ejecutivesRoutes from "./routes/ejecutivesRoutes.js";

import User from "./models/User.js";
import bcrypt from "bcryptjs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: ["http://localhost:5173"], // 👈 Puerto del frontend
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
