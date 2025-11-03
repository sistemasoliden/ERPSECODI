import { createContext, useContext, useEffect, useRef, useState } from "react";

const AuthContext = createContext();

// === Ajustes de seguridad ===
const INACTIVITY_LIMIT_MS = 1 * 60 * 1000; // 30 minutos de inactividad
const HEARTBEAT_MS = 15 * 1000;             // revisar cada 15s

const STORAGE_KEYS = {
  user: "user",
  token: "token",
  tokenExp: "token_exp",      // epoch (ms)
  lastActive: "last_active",  // epoch (ms)
  persist: "auth_persist",    // "1" (localStorage) o "0" (sessionStorage)
};

// Decodifica exp de un JWT (sin libs)
function decodeJwtExpMs(token) {
  try {
    const [, payload] = token.split(".");
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    );
    if (json?.exp) return json.exp * 1000; // a ms
  } catch (_) {}
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [tokenExpMs, setTokenExpMs] = useState(null);
  const [persist, setPersist] = useState(true); // “Recordarme” ON por defecto
  const timerRef = useRef(null);

  // Carga inicial desde el storage correcto
  useEffect(() => {
    const persisted = window.localStorage.getItem(STORAGE_KEYS.persist) === "1";
    setPersist(persisted);

    const S = persisted ? localStorage : sessionStorage;
    const userStr = S.getItem(STORAGE_KEYS.user);
    const tokenStr = S.getItem(STORAGE_KEYS.token);
    const expStr = S.getItem(STORAGE_KEYS.tokenExp);

    if (userStr) setUser(JSON.parse(userStr));
    if (tokenStr) setToken(tokenStr);
    if (expStr) setTokenExpMs(Number(expStr));

    if (!S.getItem(STORAGE_KEYS.lastActive)) {
      S.setItem(STORAGE_KEYS.lastActive, String(Date.now()));
    }
  }, []);

  // Sincroniza logout entre pestañas
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEYS.token && e.newValue == null) {
        hardLogout();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Actualiza lastActive ante actividad del usuario
  useEffect(() => {
    const bump = () => {
      const S = persist ? localStorage : sessionStorage;
      S.setItem(STORAGE_KEYS.lastActive, String(Date.now()));
    };
    const events = ["click", "mousemove", "keydown", "scroll", "touchstart", "focus"];
    events.forEach((ev) => window.addEventListener(ev, bump));
    return () => events.forEach((ev) => window.removeEventListener(ev, bump));
  }, [persist]);

  // Bucle de verificación de inactividad/expiración
  useEffect(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const S = persist ? localStorage : sessionStorage;
      const lastActive = Number(S.getItem(STORAGE_KEYS.lastActive) || Date.now());
      const inactiveMs = Date.now() - lastActive;

      if (inactiveMs > INACTIVITY_LIMIT_MS) {
        return softLogout("Sesión cerrada por inactividad.");
      }
      if (token && tokenExpMs && Date.now() > tokenExpMs) {
        return softLogout("Tu sesión expiró. Vuelve a iniciar.");
      }
    }, HEARTBEAT_MS);

    return () => clearInterval(timerRef.current);
  }, [token, tokenExpMs, persist]);

  // Mantiene exactamente la funcionalidad de “guardar token y user”
  const login = ({ userData, tokenValue, rememberMe = true }) => {
    const S = rememberMe ? localStorage : sessionStorage;
    setPersist(!!rememberMe);
    localStorage.setItem(STORAGE_KEYS.persist, rememberMe ? "1" : "0");

    S.setItem(STORAGE_KEYS.user, JSON.stringify(userData));
    S.setItem(STORAGE_KEYS.token, tokenValue);
    S.setItem(STORAGE_KEYS.lastActive, String(Date.now()));

    // Si el JWT trae exp, úsalo; si no, 8h por defecto
    const expMs = decodeJwtExpMs(tokenValue) ?? Date.now() + 8 * 60 * 60 * 1000;
    S.setItem(STORAGE_KEYS.tokenExp, String(expMs));

    setUser(userData);
    setToken(tokenValue);
    setTokenExpMs(expMs);
  };

  const hardLogout = () => {
    [localStorage, sessionStorage].forEach((S) => {
      S.removeItem(STORAGE_KEYS.user);
      S.removeItem(STORAGE_KEYS.token);
      S.removeItem(STORAGE_KEYS.tokenExp);
      S.removeItem(STORAGE_KEYS.lastActive);
    });
    setUser(null);
    setToken(null);
    setTokenExpMs(null);
  };

 const softLogout = (reason) => {
  hardLogout();

  // Opcional: mostrar un mensaje (si tienes algún sistema de notifs)
  // toast.info?.(reason || "Tu sesión ha finalizado");

  // 🔴 Redirigir al inicio / login
  window.location.href = "/";      // o "/login" según tus rutas
};


  const getAuthHeader = () =>
    token ? { headers: { Authorization: `Bearer ${token}` } } : {};

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        tokenExpMs,
        persist,
        login,
        logout: hardLogout,
        softLogout,
        getAuthHeader,
        INACTIVITY_LIMIT_MS,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
