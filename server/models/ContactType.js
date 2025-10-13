// models/ContactType.js
import mongoose from "mongoose";

const ContactTypeSchema = new mongoose.Schema(
  {
    nametypecontact: { type: String, required: true },
  },
  { collection: "contacttype" } // 👈 asegúrate que sea exactamente el nombre en Mongo
);

export default mongoose.model("ContactType", ContactTypeSchema);
