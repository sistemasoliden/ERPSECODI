import mongoose from "mongoose";

const { Schema } = mongoose;

/* OJO: tu colección en Mongo se llama "contactosempresas" (sin guion),
   por eso fijamos 'collection' explícitamente. */
const ContactoEmpresaSchema = new Schema(
  {
    ruc: {                       // <- referencia al _id de BaseSecodi
      type: Schema.Types.ObjectId,
      ref: "BaseSecodi",
      required: true,
      index: true,
    },
    contactType: {               // <- p.e. { _id, nametypecontact }
      type: Schema.Types.ObjectId,
      ref: "ContactType",
      default: null,
    },
    referenceName: { type: String, default: "" },    // "JONATHAN …"
    position: { type: String, default: "" },         // "SIN INFORMACION"
    contactDescription: { type: String, default: "" }, // "955447870" | email | dni
    source: { type: Schema.Types.ObjectId, ref: "Source", default: null },
  },
  { timestamps: true, collection: "contactosempresas" }
);

export default mongoose.model("ContactoEmpresa", ContactoEmpresaSchema);
