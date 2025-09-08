import mongoose from "mongoose";

const { Schema, model } = mongoose;

const schema = new Schema({
  nombre: { type: String, required: true },
  fechaRegistro: { type: Date, default: Date.now },
});

export default model("ConsultorRegistrado", schema, "consultorregistrado");
