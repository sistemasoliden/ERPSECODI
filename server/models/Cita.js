// backend/models/Cita.js
import mongoose from "mongoose";

const CitaSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    opportunityId: { type: String }, // opcional: id de la oportunidad
    ruc: { type: String },
    razonSocial: { type: String },

    titulo: { type: String, required: true },

    // nuevos campos
    tipo: { type: String, enum: ["presencial", "virtual"], default: "presencial" },
    mensaje: { type: String },   // alias de "notas" que usas en la UI
    direccion: { type: String }, // alias de "lugar" que usas en la UI

    // compatibles con tu MisCitas actual
    inicio: { type: Date, required: true },
    fin: { type: Date, required: true },
    lugar: { type: String }, // mantengo compatibilidad: copiaré direccion aquí
    notas: { type: String }, // copiaré mensaje aquí
    // añade el campo estado
estado: { type: String, enum: ["pendiente", "completada", "cancelada"], default: "pendiente", index: true },

  },
  { timestamps: true }
);

// Normaliza compatibilidad antes de guardar
CitaSchema.pre("save", function (next) {
  if (!this.lugar && this.direccion) this.lugar = this.direccion;
  if (!this.notas && this.mensaje) this.notas = this.mensaje;
  next();
});

const Cita = mongoose.models.Cita || mongoose.model("Cita", CitaSchema);
export default Cita;
