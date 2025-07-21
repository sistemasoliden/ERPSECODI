// server/middlewares/auth.js
import jwt from 'jsonwebtoken';

// Verifica que haya un token válido
export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token' });

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token inválido' });
  }
}

// Comprueba que el rol sea "sistemas"
export function isAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'sistemas') {
    return res.status(403).json({ message: 'Acceso denegado' });
  }
  next();
}
