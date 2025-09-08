import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/iconosecodi.png";

export default function Navbar() {
  const rawUser = localStorage.getItem("user");
  const user = rawUser ? JSON.parse(rawUser) : null;
  const navigate = useNavigate();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [showUsuariosMenu, setShowUsuariosMenu] = useState(false);

  const userMenuRef = useRef(null);
  const reportMenuRef = useRef(null);
  const usuariosMenuRef = useRef(null);

  // ---------------- Roles ----------------
  const ROLES_IDS = {
    sistemas: "68a4f22d27e6abe98157a82c",
    gerencia: "68a4f22d27e6abe98157a82f",
    comercial: "68a4f22d27e6abe98157a831",
    supervisorcomercial: "68a4f22d27e6abe98157a832",
    backoffice: "68a4f22d27e6abe98157a830"
  };

  // Menú de reportes: Sistemas y Gerencia
  const ROLES_REPORTES = [ROLES_IDS.sistemas, ROLES_IDS.gerencia];

  // Normaliza el id de rol desde user.role con cualquier forma
  function getNormalizedRoleId(u) {
    if (!u) return "";
    const r = u.role;

    // 1) si es string (ya es un id)
    if (typeof r === "string") return r;

    // 2) si es objeto, intenta _id / id / value
    if (r && typeof r === "object") {
      if (r._id) return String(r._id);
      if (r.id) return String(r.id);
      if (r.value) return String(r.value);

      // 3) si viene por nombre/slug
      const label = String(r.slug || r.nombre || r.name || "").trim().toLowerCase();
      if (label === "sistemas") return ROLES_IDS.sistemas;
      if (label === "gerencia") return ROLES_IDS.gerencia;
      if (label === "comercial") return ROLES_IDS.comercial;
      if (label === "supervisorcomercial" || label === "supervisor comercial")
        return ROLES_IDS.supervisorcomercial;
    }
    return "";
  }

  const userRoleId = getNormalizedRoleId(user);
  const isSistemas = userRoleId === ROLES_IDS.sistemas;
  const isBackoffice = userRoleId === ROLES_IDS.backoffice; // 👈 nuevo flag
  const isGerencia = userRoleId === ROLES_IDS.gerencia;
  const isSupervisorComercial = userRoleId === ROLES_IDS.supervisorcomercial;
  const canSeeReportsMenu = ROLES_REPORTES.includes(userRoleId);
  const isCommercial = [ROLES_IDS.comercial, ROLES_IDS.supervisorcomercial].includes(userRoleId);

  // ---------------- Listeners / UI ----------------
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (reportMenuRef.current && !reportMenuRef.current.contains(event.target)) {
        setShowReportMenu(false);
      }
      if (usuariosMenuRef.current && !usuariosMenuRef.current.contains(event.target)) {
        setShowUsuariosMenu(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Cierra menús al cambiar de usuario (logout/login)
  useEffect(() => {
    setShowUserMenu(false);
    setShowReportMenu(false);
    setShowUsuariosMenu(false);
  }, [rawUser]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const userInitial = user ? user.email?.charAt(0)?.toUpperCase() || "" : "";

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

        {/* Usuarios (solo Sistemas) */}
        {isSistemas && (
          <div className="relative" ref={usuariosMenuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowUsuariosMenu((prev) => !prev);
              }}
              className="text-sm hover:text-gray-300 transition flex items-center gap-1"
            >
              Usuarios
              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUsuariosMenu && (
              <div className="absolute bg-white text-black rounded-md shadow-md mt-2 min-w-[160px] z-50">
                <Link
                  to="/users"
                  className="block px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => setShowUsuariosMenu(false)}
                >
                  Usuarios
                </Link>
                <Link
                  to="/equipos"
                  className="block px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => setShowUsuariosMenu(false)}
                >
                  Equipos
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Accesos de Sistemas */}
        {/* Accesos de Sistemas o Backoffice */}
  {(isSistemas || isBackoffice|| isSupervisorComercial || isGerencia ) && (
    <>
    <Link to="/ventas" className="text-sm hover:text-gray-300 transition">
      Ventas
    </Link>
    {isSistemas && (
      <>
        <Link to="/estadofiltro" className="text-sm hover:text-gray-300 transition">
          Prueba de Filtros
        </Link>
        <Link to="/asignaciones" className="text-sm hover:text-gray-300 transition">
          Asignaciones
        </Link>
      </>
    )}
  </>
)}

        {/* Bloque Comercial / Supervisor: Mi Base + Mis oportunidades */}
        {isCommercial && (
          <div className="flex items-center gap-2">
            <Link
              to="/mi-base"
              className="px-3 py-2 text-sm font-semibold rounded-md border border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white transition"
              title="Mi Base"
            >
              Mi Base
            </Link>

            <Link
              to="/mis-oportunidades"
              className="px-3 py-2 text-sm font-semibold rounded-md border border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white transition"
              title="Mis oportunidades"
            >
              Mis oportunidades
            </Link>
          </div>
        )}

        {/* Dropdown Reportes/Ventas (Sistemas o Gerencia) */}
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

        {/* Menú de usuario */}
        {user && (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowUserMenu((prev) => !prev);
              }}
              className="w-10 h-10 rounded-full bg-red-800 flex items-center justify-center text-lg font-semibold transition"
              title={user?.email || "Cuenta"}
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
