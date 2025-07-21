import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/iconosecodi.png";

export default function Navbar() {
  const rawUser = localStorage.getItem("user");
  const user = rawUser ? JSON.parse(rawUser) : null;
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  // Resetea menú solo cuando cambia el usuario (login/logout)
  useEffect(() => {
    setShowMenu(false);
  }, [rawUser]); // usa la cadena en localStorage, no el objeto parseado

  // Cierra menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("click", handleClickOutside); // cambiado de mousedown a click
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const toggleMenu = (e) => {
    e.stopPropagation(); // evita que el click llegue al listener global
    setShowMenu((prev) => !prev);
  };

  const userInitial = user ? user.email.charAt(0).toUpperCase() : "";

  return (
    <nav className="bg-gray-800 text-white px-6 py-5 flex justify-between items-center shadow-lg">
      {/* Logo */}
      <Link to="/" className="flex items-center">
        <img src={logo} alt="Logo SECODI" className="h-12 w-auto cursor-pointer" />
      </Link>

      {/* Enlaces y cuenta */}
      <div className="flex items-center space-x-6">
        {!user && (
          <Link to="/login" className="hover:text-gray-300 transition">
            Iniciar Sesión
          </Link>
        )}

        {user && user.role === "sistemas" && (
          <Link to="/users" className="hover:text-gray-300 transition">
            Usuarios
          </Link>
        )}

        {user && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={toggleMenu}
              onMouseDown={(e) => e.stopPropagation()} // también protege del mousedown
              className="w-10 h-10 rounded-full bg-red-800 flex items-center justify-center text-lg font-semibold transition"
            >
              {userInitial}
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-36 bg-white text-black shadow-xl py-2 z-50">
                <button
                  className="block w-full text-center text-black px-4 py-2 transition"
                  onClick={() => {
                    setShowMenu(false);
                    navigate("/cuenta");
                  }}
                >
                  Ver cuenta
                </button>

                <button
                  className="block w-full text-center px-4 py-2 text-red-800 transition"
                  onClick={handleLogout}
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
