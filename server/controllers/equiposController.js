import EquipoSecodi from "../models/EquipoSecodi.js";
import User from "../models/User.js";

/** Lista equipos con conteo de ejecutivos (comerciales) */
export const listEquipos = async (_req, res) => {
  try {
    const equipos = await EquipoSecodi.find()
      .populate("supervisor", "firstName lastName name email")
      .sort({ name: 1 })
      .lean();

    const counts = await User.aggregate([
      { $match: { equipo: { $ne: null } } },
      { $group: { _id: "$equipo", total: { $sum: 1 } } },
    ]);
    const map = new Map(counts.map(c => [String(c._id), c.total]));

    const withCounts = equipos.map(e => ({
      ...e,
      members: map.get(String(e._id)) || 0,
    }));

    res.json(withCounts);
  } catch (e) {
    res.status(500).json({ error: "Error listando equipos" });
  }
};

export const createEquipo = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Nombre requerido" });
    const eq = await EquipoSecodi.create({ name: name.trim() });
    res.status(201).json(eq);
  } catch (e) {
    res.status(400).json({ error: e.message || "No se pudo crear equipo" });
  }
};

export const deleteEquipo = async (req, res) => {
  try {
    const { id } = req.params;
    // Libera ejecutivos del equipo eliminado
    await User.updateMany({ equipo: id }, { $set: { equipo: null } });
    await EquipoSecodi.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: "No se pudo eliminar equipo" });
  }
};

/** Miembros (supervisor + comerciales) de un equipo */
export const getMiembrosByEquipo = async (req, res) => {
  try {
    const equipoId = req.params.id;

    const [equipo, comerciales] = await Promise.all([
      EquipoSecodi.findById(equipoId)
        .populate("supervisor", "firstName lastName name email")
        .lean(),
      User.find({ equipo: equipoId })
        .populate("role", "name")
        .select("firstName lastName name email role equipo")
        .lean(),
    ]);

    res.json({
      equipo: equipo || null,
      supervisor: equipo?.supervisor || null,
      comerciales: comerciales || [],
    });
  } catch (e) {
    res.status(500).json({ error: "Error al obtener los miembros del equipo" });
  }
};

/** Asignar / cambiar supervisor */
export const setSupervisor = async (req, res) => {
  try {
    const { supervisorId } = req.body; // puede venir null
    const updated = await EquipoSecodi.findByIdAndUpdate(
      req.params.id,
      { supervisor: supervisorId || null },
      { new: true }
    ).populate("supervisor", "firstName lastName name email");
    res.json(updated);
  } catch (e) {
    res.status(400).json({ error: e.message || "No se pudo asignar supervisor" });
  }
};

/** Reemplaza los ejecutivos de un equipo (comerciales) */
export const setEjecutivos = async (req, res) => {
  try {
    const { ejecutivosIds } = req.body; // 👈 ahora sí lo traemos del body
    const ESTADO_ACTIVO_ID = "68a4f3dc27e6abe98157a845";

    // Libera todos los actuales de este equipo
    await User.updateMany({ equipo: req.params.id }, { $set: { equipo: null } });

    // Solo asignar los activos seleccionados
    if (Array.isArray(ejecutivosIds) && ejecutivosIds.length) {
      await User.updateMany(
        { _id: { $in: ejecutivosIds }, estadoUsuario: ESTADO_ACTIVO_ID },
        { $set: { equipo: req.params.id } }
      );
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("❌ setEjecutivos error:", e);
    res.status(400).json({ error: e.message || "No se pudieron asignar ejecutivos" });
  }
};


/** Quitar un ejecutivo de un equipo */
export const removeEjecutivo = async (req, res) => {
  try {
    const { userId } = req.params;
    await User.findByIdAndUpdate(userId, { $set: { equipo: null } });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: "No se pudo quitar el ejecutivo" });
  }
};
