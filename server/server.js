import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import fs from "fs";
import cookieParser from "cookie-parser";
import session from "express-session";
import { fileURLToPath } from "url";
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

// Rutas existentes
import wspRoutes from "./routes/wsp.routes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import ventasRoutes from "./routes/ventasRoutes.js";
import ejecutivesRoutes from "./routes/ejecutivesRoutes.js";
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
import ventasEquiposRoutes from "./routes/ventasEquiposRoutes.js";
import ventasPlanesRoutes from "./routes/ventasPlanesRoutes.js";
import contactoEmpresasRoutes from "./routes/contactoEmpresasRoutes.js";
import unidadServicioRoutes from "./routes/unidadServicioRoutes.js";
import dataSalesforceRoutes from "./routes/dataSalesforceRoutes.js";
import tipificacionesRoutes from "./routes/tipificacionesRoutes.js";
import assignmentsRoutes from "./routes/assignmentsRoutes.js";
import contactTypesRoutes from "./routes/contactTypesRoutes.js";
import citaRoutes from "./routes/citaRoutes.js";
import notificationRoutes from "./routes/notificacionRoutes.js";
import reportesTipificacionRoutes from "./routes/reportes.tipificacion.routes.js";
import reportesOportunidadesRoutes from "./routes/reportes.oportunidades.routes.js";
import reportesCitasRoutes from "./routes/reportes.citas.routes.js";
import reportesTipificacionSupervisorRoutes from "./routes/reportes.tipificacionsupervisor.routes.js";
import reportesOportunidadesSupervisorRoutes from "./routes/reportes.oportunidadessupervisor.routes.js";
import reportesCitasSupervisorRoutes from "./routes/reportes.citassupervisor.routes.js"
import emailTemplatesRoutes from "./routes/emailTemplatesRoutes.js";


// Modelos referenciados por populate
import "./models/RolUsuario.js";
import "./models/EstadoUsuario.js";

// 🔹 NUEVO: rutas SMTP (ESM)
import smtpRoutes from "./routes/smtpRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// (Opcional) si estás detrás de proxy, ej. Render/NGINX
app.set("trust proxy", 1);

// Middlewares
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:5174", "https://erpsecodi.onrender.com"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 🔹 NUEVO: sesión para guardar credenciales SMTP por usuario
app.use(
  session({
    name: "sid",
    secret: process.env.SESSION_SECRET || "cambia-esto-por-un-valor-largo-y-seguro",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // en prod: true con HTTPS y proxy
      maxAge: 1000 * 60 * 30, // 30 minutos
    },
  })
);

app.get("/healthz", (_req, res) => res.send("ok"));

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
app.use("/api/ventas-equipos", ventasEquiposRoutes);
app.use("/api/oportunidades", opportunityRoutes);
app.use("/api/ventas-planes", ventasPlanesRoutes);
app.use("/api/ventas-activacion", ventasActivacionRoutes);

app.use("/api/contactos-empresas", contactoEmpresasRoutes);
app.use("/api/contact-types", contactTypesRoutes);
app.use("/api/unidades-servicios", unidadServicioRoutes);
app.use("/api/data-salesforce", dataSalesforceRoutes);
app.use("/api/tipificaciones", tipificacionesRoutes);
app.use("/api/assignments", assignmentsRoutes);
app.use("/api/citas", citaRoutes);
app.use("/api/notificaciones", notificationRoutes);

// Puedes agrupar reportes con subrutas para mayor claridad
app.use("/api/reportes", reportesTipificacionRoutes);
app.use("/api/reportes", reportesOportunidadesRoutes);
app.use("/api/reportes", reportesCitasRoutes);
app.use("/api/reportes", reportesTipificacionSupervisorRoutes);
app.use("/api/reportes", reportesOportunidadesSupervisorRoutes);
app.use("/api/reportes", reportesCitasSupervisorRoutes);

// Rutas de WhatsApp
app.use("/api/wsp", wspRoutes);

// 🔹 NUEVO: monta aquí las rutas SMTP (mantiene los paths que usa tu front)
app.use("/api", smtpRoutes);

app.use("/api", emailTemplatesRoutes);


// 👉 Servir frontend (SPA) en producción
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
    app.use(express.static(clientPath, { index: false }));
    app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(clientPath, "index.html")));
  } else {
    console.warn("⚠️  No se encontró el build del frontend. Asegúrate de construirlo en deploy.");
  }
}

// 🔹 Conexión a Mongo y levantar servidor
async function start() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Conectado a MongoDB Atlas");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Servidor escuchando en http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Error al conectar a MongoDB:", err);
    process.exit(1);
  }
}
start();


export default app;
