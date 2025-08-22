// backend/models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const DOMAIN = "claronegocios-secodi.com";

// Utilidad: quita acentos/espacios y deja solo letras
function norm(s = "") {
  return s
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z]/g, ""); // solo letras
}

// Toma primer token de cada campo
function firstToken(s = "") {
  return (s || "").trim().split(/\s+/)[0] || "";
}

const userSchema = new mongoose.Schema({
  // NUEVOS
  firstName: { type: String, required: true, trim: true },
  lastName:  { type: String, required: true, trim: true },

  // Mantén "name" por compatibilidad y para búsquedas; lo rellenamos automáticamente
  name: { type: String, trim: true },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },

  orgEmail: {
    type: String,
    unique: true,
    sparse: true,
    match: [
      new RegExp(`^[\\w.+\\-]+@${DOMAIN.replace(".", "\\.")}$`),
      `Dominio no válido (debe ser @${DOMAIN})`
    ],
    trim: true,
    lowercase: true
  },

  password: { type: String, required: true, minlength: 6 },

  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "rolesusuarios",
    required: true
  },

  documentType: {
    type: String,
    enum: ["DNI", "Carnet de Extranjería"],
    required: true,
    default: "DNI",
  },

  documentNumber: {
    type: String,
    required: true,
    set: (v) => (typeof v === "string" ? v.trim() : v),
    validate: {
      validator: function (val) {
        if (typeof val !== "string") return false;
        const v = val.trim();
        if (this.documentType === "DNI") return /^\d{8}$/.test(v);
        if (this.documentType === "Carnet de Extranjería") return /^\d+$/.test(v);
        return false;
      },
      message: function () {
        return `Número de documento inválido para el tipo ${this.documentType}`;
      },
    },
  },

  address: { type: String, default: "" },
  phone:   { type: String, default: "" },
  dniUrl:  { type: String, default: "" },

  estadoUsuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "estadousuario",
    required: true
  },

  avatar: { type: String, default: "" },
  lastLogin: { type: Date },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret) => {
      delete ret.password;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Virtual "fullName"
userSchema.virtual("fullName").get(function () {
  const fn = this.firstName || "";
  const ln = this.lastName || "";
  return `${fn} ${ln}`.trim();
});

async function generateUniqueOrgEmail(model, firstName, lastName) {
  const fn = norm(firstToken(firstName));
  const ln = norm(firstToken(lastName));
  if (!fn || !ln) return undefined;

  const base = `${fn}.${ln}`;
  const domain = DOMAIN;
  let candidate = `${base}@${domain}`;

  // Si no existe, úsalo
  const exists = await model.exists({ orgEmail: candidate });
  if (!exists) return candidate;

  // Si existe, buscar el siguiente sufijo libre
  // ej: juan.perez2@..., juan.perez3@...
  let i = 2;
  // Usa una expresión para capturar todos los que empiecen con base@
  // y tengan sufijo numérico
  while (true) {
    candidate = `${base}${i}@${domain}`;
    const taken = await model.exists({ orgEmail: candidate });
    if (!taken) return candidate;
    i++;
  }
}

// Antes de validar: setear name y orgEmail si faltan o si cambian nombres
userSchema.pre("validate", async function (next) {
  try {
    // Mantén name con el nombre completo SIEMPRE
    this.name = this.fullName || this.name;

    // Si no hay orgEmail, o si cambiaron firstName/lastName, regenera automáticamente
    if (!this.orgEmail || this.isModified("firstName") || this.isModified("lastName")) {
      const emailAuto = await generateUniqueOrgEmail(this.constructor, this.firstName, this.lastName);
      if (emailAuto) this.orgEmail = emailAuto;
    }

    next();
  } catch (e) {
    next(e);
  }
});

userSchema.pre("save", async function (next) {
  try {
    if (this.isModified("password")) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
