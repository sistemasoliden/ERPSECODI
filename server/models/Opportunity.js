// models/Opportunity.js
import mongoose from "mongoose";

const OpportunitySchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    ruc: { type: String, required: true },
    razonSocial: { type: String, default: "" },

    // etapa (como ya tienes)
    estadoId: { type: String, required: true },
    estadoNombre: { type: String, required: true },
    cerrada: { type: Boolean, default: false },
    closedAt: { type: Date },

    // NUEVOS:
    contactId: { type: mongoose.Schema.Types.ObjectId, ref: "ContactoEmpresa", default: null },
    monto: { type: Number, default: 0 },
    cantidad: { type: Number, default: 1 },
    tipoVentaId: { type: mongoose.Schema.Types.ObjectId, ref: "TipoVenta", default: null },
    productoId: { type: mongoose.Schema.Types.ObjectId, ref: "Producto", default: null },
    modalidadVentaId: { type: mongoose.Schema.Types.ObjectId, ref: "ModalidadVenta", default: null },

    notas: { type: String, default: "" },
  },
  { timestamps: true, collection: "oportunidades" }
);

export default mongoose.model("Opportunity", OpportunitySchema);
