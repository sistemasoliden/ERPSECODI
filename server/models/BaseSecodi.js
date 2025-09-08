import mongoose from "mongoose";

const BaseSecodiSchema = new mongoose.Schema(
  {
    ruc:   { type: mongoose.Schema.Types.Mixed, required: false },
    rucStr:{ type: String, index: true }, // solo dígitos

    razonSocial:   { type: String, default: "" },
    razon_social:  { type: String, default: "" },
    sunatDistrict: { type: String, default: "" },
    distrito:      { type: String, default: "" },

    // (opcional) tus métricas
    totalLines: { type: Number, default: 0 },
  },
  { timestamps: false, collection: "basesecodi" }
);

// normaliza rucStr
BaseSecodiSchema.pre("save", function (next) {
  const onlyDigits = (v) => (v == null ? "" : String(v).replace(/\D/g, ""));
  if (!this.rucStr) this.rucStr = onlyDigits(this.ruc);
  else this.rucStr = onlyDigits(this.rucStr);
  next();
});

export default mongoose.model("BaseSecodi", BaseSecodiSchema);
