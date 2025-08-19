import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/iconosecodi.png";

export default function Navbar() {
  const rawUser = localStorage.getItem("user");
  const user = rawUser ? JSON.parse(rawUser) : null;
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState(false);

  const ROLES_REPORTES = [
    "administracion",
    "backoffice",
    "postventa",
    "recursoshumanos",
    "sistemas",
    "gerencia",
    "comercial",
  ];

  const canSeeReportsMenu =
    user?.role && ROLES_REPORTES.includes(user.role);

  const isSistemas = user?.role === "sistemas";


  const userMenuRef = useRef(null);
  const reportMenuRef = useRef(null);

  // Cierra menús al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (reportMenuRef.current && !reportMenuRef.current.contains(event.target)) {
        setShowReportMenu(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Cierra menús al cambiar de usuario (logout/login)
  useEffect(() => {
    setShowUserMenu(false);
    setShowReportMenu(false);
  }, [rawUser]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const userInitial = user ? user.email.charAt(0).toUpperCase() : "";

  return (
    <nav className="bg-black text-white px-6 py-5 flex justify-between items-center shadow-lg z-50 relative">
      {/* Logo */}
      <Link to="/" className="flex items-center">
        <img src={logo} alt="Logo SECODI" className="h-12 w-auto cursor-pointer" />
      </Link>

      {/* Enlaces y cuenta */}
      <div className="flex items-center space-x-6">
        {!user && (
          <Link to="/login" className="text-sm hover:text-gray-300 transition">
            Iniciar Sesión
          </Link>
        )}

        {/* Usuarios solo para sistemas */}
        {isSistemas && (
          <Link to="/users" className="text-sm hover:text-gray-300 transition">
            Usuarios
          </Link>
        )}

        {user?.role === "backoffice" && (
  <Link 
    to="/ventas" 
    className="text-sm hover:text-gray-300 transition"
  >
    Ventas
  </Link>
)}


        {/* Dropdown Reportes/Ventas */}
        {canSeeReportsMenu && (
          <div className="relative" ref={reportMenuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowReportMenu((prev) => !prev);
              }}
              className="text-sm hover:text-gray-300 transition"
            >
              Reporte de Ventas
              
            </button>

            {showReportMenu && (
<div className="absolute left-1/2 transform -translate-x-1/2 mt-2 w-52 bg-white text-black rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in-down">
 
                {/* Opciones comunes */}
                <Link
                  to="/HistoricalSales"
                  className="block px-4 py-3 text-sm hover:bg-gray-100 transition"
                  onClick={() => setShowReportMenu(false)}
                >
                  Histórico Ventas
                </Link>
                <Link
                  to="/DashboardSales"
                  className="block px-4 py-3 text-sm hover:bg-gray-100 transition"
                  onClick={() => setShowReportMenu(false)}
                >
                  Dashboard Ventas
                </Link>
                    <Link
                      to="/Historical"
                      className="block px-4 py-3 text-sm hover:bg-gray-100 transition"
                      onClick={() => setShowReportMenu(false)}
                    >
                      Histórico de Ejecutivos
                    </Link>
                    <Link
                      to="/DashboardEjecutives"
                      className="block px-4 py-3 text-sm hover:bg-gray-100 transition"
                      onClick={() => setShowReportMenu(false)}
                    >
                      Dashboard Ejecutivos
                    </Link>
                 
              </div>
            )}
          </div>
        )}

        {/* Punto adicional solo para backoffice */}



        
        {/* Menú de usuario */}
        {user && (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowUserMenu((prev) => !prev);
              }}
              className="w-10 h-10 rounded-full bg-red-800 flex items-center justify-center text-lg font-semibold transition"
            >
              {userInitial}
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-36 bg-white text-black shadow-xl py-2 rounded-lg z-50">
                <button
                  className="block w-full text-center text-black px-4 py-2 hover:bg-gray-100 transition"
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate("/cuenta");
                  }}
                >
                  Ver cuenta
                </button>

                <button
                  className="block w-full text-center px-4 py-2 text-red-800 hover:bg-gray-100 transition"
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
