import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ArrowLeftCircle } from "lucide-react";

export default function Cuenta() {
  const [user, setUser] = useState(null);
  const [clientInfo, setClientInfo] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    axios.get(`${import.meta.env.VITE_API_URL}/users/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    .then(res => setUser(res.data))
    .catch(err => {
      console.error("Error al obtener perfil:", err);
      navigate("/login");
    });

    axios.get("https://api.ipify.org?format=json")
      .then(res => {
        const os = window.navigator.platform;
        const browser = window.navigator.userAgent;
        setClientInfo({
          ip: res.data.ip,
          os,
          browser
        });
      })
      .catch(err => console.error("Error al obtener IP:", err));
  }, [navigate]);

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white">
        <p className="text-gray-600 text-lg animate-pulse">Cargando perfil...</p>
      </div>
    );
  }

return (
<div className="absolute inset-0 z-[-1] bg-white">
<div className="flex justify-center items-center min-h-screen bg-white sm:mt-0 pt-[50px]">
    <div className="w-full max-w-7xl bg-white p-24 flex flex-col md:flex-row gap-4">

      {/* Avatar + descripción */}
      <div className="flex flex-col items-center pt-6 flex-shrink-0">
        <img
  src={user.avatar}
  alt="Avatar"
  className="w-24 sm:w-28 md:w-32 lg:w-36 h-24 sm:h-28 md:h-32 lg:h-36 rounded-full border-4 border-black shadow-lg hover:shadow-red-400/50 hover:scale-105 transition-all duration-500 "/>


        {/* Nombre y correo */}
        <div className="mt-4 text-center">
          <h1 className="text-2xl font-bold uppercase">{user.name}</h1>
          <p className="text-black text-md">{user.email}</p>
        </div>

        {/* Descripción */}
        <p className="mt-3 text-gray-600 text-center max-w-md uppercase text-xs">
          {user.roleDescription}
        </p>

        {/* Botón volver */}
        <button
          onClick={() => navigate(-1)}
          className="mt-4 flex items-center gap-2 text-red-800 hover:text-red-600 transition"
        >
          <ArrowLeftCircle className="w-5 h-5" />
          <span className="font-medium">Volver</span>
        </button>
      </div>

      {/* Información a la derecha */}
      <div className="flex justify-center mt-4 flex-grow">
        <div className="bg-white border  p-8 max-w-md w-full shadow-sm">
<div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8 place-items-center max-w-2xl mx-auto">
  {[
    { title: "Rol", value: user.role },
    { title: "Creado", value: new Date(user.createdAt).toLocaleString() },
    { title: "Última Actualización", value: new Date(user.updatedAt).toLocaleString() },
    { title: "Último Login", value: new Date(user.lastLogin).toLocaleString() },
    { title: "IP Pública", value: clientInfo.ip || "No disponible" },
    { title: "Sistema Operativo", value: clientInfo.os || "No disponible" },
  ].map((item, idx) => (
    <div
  key={idx}
  className="transition transform hover:scale-105 bg-white shadow shadow-md border-t-4 border-black border-1 w-full sm:w-36 h-20 p-4 flex flex-col justify-center"
>
  <p className="text-xs text-black text-center uppercase tracking-wide font-bold mb-2">
    {item.title}
  </p>
  <p className="text-xs text-center text-gray-700">
    {item.value}
  </p>
</div>

  ))}
</div>


        </div>
      </div>
    </div>
  </div>
</div>

);}