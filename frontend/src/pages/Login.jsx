import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import loginBg from "../assets/login.png";

const API_URL = import.meta.env.VITE_API_URL;

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

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
      className="flex justify-center items-center bg-cover"
      style={{
        backgroundPosition: "center 30%",
        backgroundImage: `url(${loginBg})`,
        height: "calc(100vh - 5rem - 8px)",
        overflow: "hidden",
        fontFamily: "'Poppins', sans-serif",
      }}
    >
      <div
        className="backdrop-blur-sm p-8 shadow-xl w-full max-w-sm"
        style={{
          boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
        }}
      >
        <h2 className="text-4xl font-extrabold mb-4 text-center text-black tracking-wide">
          SECODI
        </h2>
        <p className="text-center text-black mb-6 text-sm">
          Ingresa con tu correo corporativo
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-black text-sm mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              placeholder="abc@claronegocios-secodi.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="
                w-full px-4 py-2 rounded-sm bg-white/10 backdrop-blur-lg
                text-sm text-black placeholder-black
                focus:outline-none focus:ring-1 focus:ring-black
                transition
              "
            />
          </div>

          <div>
            <label className="block text-black text-sm mb-1">
              Contraseña
            </label>
            <input
              type="password"
              className="
                w-full px-4 py-2 rounded-sm bg-white/10 backdrop-blur-lg
                text-sm text-black placeholder-black
                focus:outline-none focus:ring-1 focus:ring-black
              "
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <div className="text-red-800 text-center text-sm">{error}</div>
          )}
          <button
            type="submit"
            className="mx-auto block w-2/3 bg-gray-800 text-white py-2 rounded-sm text-semibold transition-all duration-300 text-sm shadow-lg"
          >
            Iniciar Sesión
          </button>

        </form>
      </div>
    </div>
  );
}
