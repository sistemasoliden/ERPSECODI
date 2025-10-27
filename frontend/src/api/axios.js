// src/api/axios.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // toma la URL de tu .env
});

// Interceptor para añadir el token automáticamente
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 🔒 Interceptor adicional: evita enviar el token en rutas de autenticación
api.interceptors.request.use(config => {
  const isAuthRoute = config.url?.startsWith('/auth/');
  if (isAuthRoute && config.headers?.Authorization) {
    delete config.headers.Authorization;
  }
  return config;
});

// (Opcional) Interceptor de respuesta para manejar expiraciones de sesión
api.interceptors.response.use(
  response => response,
  error => {
    if (error?.response?.status === 401) {
      console.warn('Token expirado o sesión inválida.');
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      // Aquí podrías redirigir al login o mostrar un mensaje global
    }
    return Promise.reject(error);
  }
);

export default api;
