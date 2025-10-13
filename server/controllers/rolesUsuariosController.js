// controllers/rolesUsuariosController.js
import Rol from "../models/RolUsuario.js";

export const listarRoles = async (_req, res) => {
  try {
    // Trae ambos por si acaso y ordena por nombre si existe, si no por name
    const docs = await Rol.find()
      .select("_id name nombre slug")
      .sort({ nombre: 1, name: 1 })
      .lean();

    // Normaliza a { _id, name }
    const roles = docs.map((r) => ({
      _id: r._id,
      name: r.nombre || r.name || r.slug || String(r._id),
    }));

    res.json(roles);
  } catch (e) {
    res.status(500).json({ error: "Error listando roles" });
  }
};
