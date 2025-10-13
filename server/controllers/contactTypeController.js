import ContactType from "../models/ContactType.js";

export async function listContactTypes(_req, res) {
  try {
    const items = await ContactType.find().sort({ nametypecontact: 1 }).lean();
    res.json(items);
  } catch (err) {
    console.error("[contact-types.list]", err);
    res.status(500).json({ message: "Error cargando tipos de contacto" });
  }
}
