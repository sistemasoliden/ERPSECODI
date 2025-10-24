import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import loginBg from "../assets/login.png";
import { useAuth } from "../context/AuthContext";

const ORG_DOMAIN = "@claronegocios-secodi.com";

export default function Login() {
  const [orgEmail, setOrgEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth(); // usamos el contexto

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const emailNorm = orgEmail.trim().toLowerCase();
    if (!emailNorm.endsWith(ORG_DOMAIN)) {
      return setError(`El correo debe terminar en ${ORG_DOMAIN}`);
    }

    try {
      setLoading(true);
      const { data } = await api.post("/auth/login", {
        orgEmail: emailNorm,
        password,
      });

      // Mantiene la funcionalidad previa: persistir credenciales y navegar
      // Ahora lo centralizamos en AuthContext (equivalente a setItem + navigate).
      login({ userData: data.user, tokenValue: data.token, rememberMe: true });
      navigate("/");
    } catch (err) {
      console.error("Error al iniciar sesión:", err);
      const msg = err?.response?.data?.error || "Error al iniciar sesión";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`flex justify-center items-center bg-cover transition-all duration-700 ease-in-out ${
        loaded ? "opacity-100 blur-0" : "opacity-0 blur-[1px]"
      }`}
      style={{
        backgroundColor: "#0f172a",
        backgroundImage: `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url(${loginBg})`,
        backgroundPosition: "center 30%",
        backgroundSize: "cover",
        minHeight: "100vh",
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <div
        className={`backdrop-blur-sm p-6 sm:p-8 shadow-xl w-[90%] max-w-md bg-white/10 rounded-sm transform transition-all duration-700 ease-in-out ${
          loaded ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
        style={{ boxShadow: "0 8px 32px 0 rgba(31, 38, 135, .37)" }}
      >
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-4 text-center text-white tracking-wide">
          SECODI
        </h2>
        <p className="text-center text-white mb-6 text-sm">
          Ingresa con tu correo corporativo
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-white text-sm mb-1">Correo corporativo</label>
            <input
              type="email"
              placeholder={`tuusuario${ORG_DOMAIN}`}
              value={orgEmail}
              onChange={(e) => setOrgEmail(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-sm bg-white/20 text-sm text-white placeholder-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-300 transition"
            />
          </div>

          <div>
            <label className="block text-white text-sm mb-1">Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-sm bg-white/20 text-sm text-white placeholder-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-300 transition"
            />
          </div>

          {error && <div className="text-red-400 text-center text-sm">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="mx-auto block w-2/3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white py-2 rounded-sm font-semibold transition-all duration-300 text-sm shadow-lg"
          >
            {loading ? "Ingresando..." : "Iniciar Sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}
