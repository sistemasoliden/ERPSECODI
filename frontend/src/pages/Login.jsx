import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import loginBg from "../assets/login.png";

const API_URL = import.meta.env.VITE_API_URL;

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();

  // Activar animación al montar
  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      navigate("/");
    } catch (err) {
      console.error("Error al iniciar sesión:", err);
      setError(err.response?.data?.error || "Error al iniciar sesión");
    }
  };

  return (
    <div
      className={`flex justify-center items-center bg-cover transition-all duration-700 ease-in-out ${
        loaded ? "opacity-100 blur-0" : "opacity-0 blur-[1px]"
      }`}
      style={{
        backgroundColor: "#0f172a", // color base para evitar flash blanco
        backgroundImage: `linear-gradient(
          rgba(0, 0, 0, 0.45), 
          rgba(0, 0, 0, 0.45)
        ), url(${loginBg})`,
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
  style={{
    boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
  }}
>

        <h2 className="text-2xl sm:text-3xl font-extrabold mb-4 text-center text-white tracking-wide">
          SECODI
        </h2>
        <p className="text-center text-white mb-6 text-sm">
          Ingresa con tu correo corporativo
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-white text-sm mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              placeholder="abc@claronegocios-secodi.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

          {error && (
            <div className="text-red-400 text-center text-sm">{error}</div>
          )}

          <button
            type="submit"
            className="mx-auto block w-2/3 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-sm font-semibold transition-all duration-300 text-sm shadow-lg"
          >
            Iniciar Sesión
          </button>
        </form>
      </div>
    </div>
  );
}
