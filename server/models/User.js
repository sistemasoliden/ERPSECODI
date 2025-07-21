import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/^[\w.+\-]+@claronegocios-secodi\.com$/, 'Dominio no válido'],
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  role: {
    type: String,
    enum: ['administracion','backoffice','postventa','recursoshumanos','sistemas','gerencia','comercial'],
    required: true,
  },
  roleDescription: {
    type: String,
    default: ''
  },
  avatar: {
    type: String,
    default: function() {
      // avatar por defecto basado en inicial de email
      const initial = this.email.charAt(0).toUpperCase();
      return `https://ui-avatars.com/api/?name=${initial}&background=random`;
    }
  },
  lastLogin: { type: Date },
}, { timestamps: true });

// hashear password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);

    // si no subieron avatar manual, generar uno en función del email
    if (!this.avatar || this.avatar.includes('ui-avatars.com')) {
      const initial = this.email.charAt(0).toUpperCase();
      this.avatar = `https://ui-avatars.com/api/?name=${initial}&background=random`;
    }

    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
