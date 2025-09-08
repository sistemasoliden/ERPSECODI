import mongoose from "mongoose";

const OpportunitySchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    baseId: { type: mongoose.Schema.Types.ObjectId, ref: "BaseGeneral" }, // ajusta si tu modelo se llama distinto
    ruc: { type: String, required: true, index: true },
    razonSocial: { type: String },

    // Estado (referencia + denormalizado para consultas rápidas)
    estadoId: { type: mongoose.Schema.Types.ObjectId, ref: "TipoOportunidad", required: true },
    estadoNombre: { type: String, required: true },

    monto: { type: Number, default: 0 },
    notas: { type: String, default: "" },
  },
  { timestamps: true, collection: "oportunidades" }
);

// Evitar duplicar por usuario y ruc (si así lo prefieres)
OpportunitySchema.index({ owner: 1, ruc: 1 }, { unique: false });

export default mongoose.model("Opportunity", OpportunitySchema);
