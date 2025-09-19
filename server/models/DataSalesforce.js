// models/DataSalesforce.js
import mongoose from "mongoose";

const DataSalesforceSchema = new mongoose.Schema(
  {
    // 🔗 referencia al _id del documento en "basesecodi"
    ruc: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BaseSecodi",
      required: true,
      index: true,
    },

    // ⚠️ Campos típicos; dejamos strict:false para aceptar extras de tu colección
    accountId:    { type: String, default: "" },
    accountName:  { type: String, default: "" },
    ownerName:    { type: String, default: "" },
    phone:        { type: String, default: "" },
    website:      { type: String, default: "" },
    industry:     { type: String, default: "" },
    segment:      { type: String, default: "" },

    // Oportunidades / actividad (opcionales)
    opportunityName: { type: String, default: "" },
    stageName:       { type: String, default: "" },
    amount:          { type: Number },
    closeDate:       { type: Date },
    lastActivityDate:{ type: Date },
  },
  {
    timestamps: true,
    collection: "datasalesforce",
    strict: false, // 👈 acepta cualquier otro campo que ya exista en tu colección
  }
);

export default mongoose.model("DataSalesforce", DataSalesforceSchema);
