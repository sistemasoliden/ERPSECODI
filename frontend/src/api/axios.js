// src/api/axios.js
import axios from "axios";

/* ================== Config básica ================== */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

/* ================== Inactividad (10 min) ================== */
const INACTIVITY_LIMIT_MS = 10 * 60 * 1000; // 10 minutos
let lastActivity = Date.now();

// Actualiza "actividad" ante cualquier interacción común
const markActivity = () => { lastActivity = Date.now(); };
["click", "keydown", "mousemove", "scroll", "touchstart", "wheel"].forEach((evt) =>
  window.addEventListener(evt, markActivity, { passive: true })
);
// También cuando regresa al tab
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") markActivity();
});

// Helpers de token
const getToken = () => localStorage.getItem("token");
const clearToken = () => {
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");
};

// 🔐 Interceptor de REQUEST: añade token y corta por inactividad
api.interceptors.request.use(
  (config) => {
    const isAuthRoute = config.url?.startsWith("/auth/");
    // No adjuntar Authorization para rutas /auth/*
    if (!isAuthRoute) {
      // Si pasó el límite sin actividad → cerrar sesión local
      if (Date.now() - lastActivity > INACTIVITY_LIMIT_MS) {
        clearToken();
        // (Opcional) redirigir al login:
        // window.location.href = "/login";
        // Corta la request con un error controlado
        return Promise.reject({
          isAxiosError: true,
          response: { status: 401, data: { code: "IDLE_TIMEOUT", message: "Sesión cerrada por inactividad" } },
          config,
        });
      }
      const token = getToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers?.Authorization) {
      delete config.headers.Authorization;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 🔒 Interceptor de RESPONSE: si llega 401, limpiar token y opcionalmente redirigir
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      clearToken();
      // (Opcional) redirigir al login si no fue ya por IDLE_TIMEOUT:
      // if (error?.response?.data?.code !== "IDLE_TIMEOUT") {
      //   window.location.href = "/login";
      // }
    }
    return Promise.reject(error);
  }
);

export default api;
