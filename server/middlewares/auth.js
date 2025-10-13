import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js"; // ajusta la ruta si difiere


// IDs de rol (los que ya usas)
export const ROLES_IDS = {
  sistemas: "68a4f22d27e6abe98157a82c",
  administracion: "68a4f22d27e6abe98157a82d",
  recursoshumanos: "68a4f22d27e6abe98157a82e",
  gerencia: "68a4f22d27e6abe98157a82f",
  backoffice: "68a4f22d27e6abe98157a830",
  comercial: "68a4f22d27e6abe98157a831",
  supervisorcomercial: "68a4f22d27e6abe98157a832",
};

// (opcional) ID de estado "Activo" si lo manejas por catálogo
export const ESTADO_ACTIVO_ID = "68a4f3dc27e6abe98157a845";

/**
 * Verifica JWT y adjunta info completa de usuario a req.user:
 *  - _id (ObjectId)
 *  - roleId (string)
 *  - isAdmin (Sistemas/Gerencia)
 */
export async function verifyToken(req, res, next) {
  try {
    const raw = req.headers.authorization || "";
    const token = raw.startsWith("Bearer ") ? raw.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Token requerido" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded._id;
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({ message: "Token inválido" });
    }

    const user = await User.findById(userId)
      .select("_id role estadoUsuario name email")
      .lean();
    if (!user) return res.status(401).json({ message: "Usuario no encontrado" });

    const roleId = String(user.role?._id || user.role || "");
    req.user = {
      _id: user._id,
      roleId,
      isAdmin: [ROLES_IDS.sistemas, ROLES_IDS.gerencia].includes(roleId),
      name: user.name,
      email: user.email,
      estadoUsuario: user.estadoUsuario, // por si quieres validar activo
    };
    next();
  } catch (err) {
    console.error("verifyToken error:", err);
    return res.status(401).json({ message: "Token inválido" });
  }
}

/** Middleware de autorización por rol (RBAC) */
export function requireRoles(allowedRoleIds = []) {
  return (req, res, next) => {
    const roleId = String(req.user?.roleId || "");
    if (!roleId || !allowedRoleIds.includes(roleId)) {
      return res.status(403).json({ message: "No autorizado" });
    }
    next();
  };
}

/** Verifica que el user destino exista, esté ACTIVO y sea COMERCIAL */
export async function ensureTargetIsActiveCommercial(req, res, next) {
  try {
    const { userId } = req.body || req.query || {};
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "userId inválido" });
    }
    const u = await User.findById(userId)
      .select("_id role estadoUsuario name")
      .lean();

    if (!u) return res.status(404).json({ message: "Usuario destino no existe" });

    const roleId = String(u.role?._id || u.role || "");
    if (roleId !== ROLES_IDS.comercial) {
      return res.status(400).json({ message: "El usuario destino no es Comercial" });
    }

    // Si manejas catálogo de estados:
    const estadoId = String(u.estadoUsuario?._id || u.estadoUsuario || "");
    if (ESTADO_ACTIVO_ID && estadoId !== ESTADO_ACTIVO_ID) {
      return res.status(400).json({ message: "El usuario destino no está Activo" });
    }

    // pasa
    next();
  } catch (e) {
    console.error("ensureTargetIsActiveCommercial error:", e);
    return res.status(500).json({ message: "Error validando usuario destino" });
  }
}
