// src/components/Navbar.jsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import logo from "../assets/iconosecodi.png";
import NotificationsBell from "./NotificationsBell";

/* ───────────────────────── Roles / helpers ───────────────────────── */
const ROLES_IDS = {
  sistemas: "68a4f22d27e6abe98157a82c",
  gerencia: "68a4f22d27e6abe98157a82f",
  comercial: "68a4f22d27e6abe98157a831",
  supervisorcomercial: "68a4f22d27e6abe98157a832",
  backoffice: "68a4f22d27e6abe98157a830",
};

const ROLES_REPORTES = [
  ROLES_IDS.sistemas,
  ROLES_IDS.gerencia,
  ROLES_IDS.supervisorcomercial,
];

function getNormalizedRoleId(user) {
  if (!user) return "";
  const r = user.role;
  if (typeof r === "string") return r;
  if (r && typeof r === "object") {
    if (r._id) return String(r._id);
    if (r.id) return String(r.id);
    if (r.value) return String(r.value);
    const label = String(r.slug || r.nombre || r.name || "")
      .trim()
      .toLowerCase();
    const map = {
      sistemas: ROLES_IDS.sistemas,
      gerencia: ROLES_IDS.gerencia,
      comercial: ROLES_IDS.comercial,
      "supervisor comercial": ROLES_IDS.supervisorcomercial,
      supervisorcomercial: ROLES_IDS.supervisorcomercial,
      backoffice: ROLES_IDS.backoffice,
    };
    return map[label] || label;
  }
  return "";
}

/* ───────────────────────── Component ───────────────────────── */
export default function Navbar() {
  const rawUser = localStorage.getItem("user");
  const user = rawUser ? JSON.parse(rawUser) : null;
  const navigate = useNavigate();

  // Menús
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState(false); // Reporte de Ventas
  const [showUsuariosMenu, setShowUsuariosMenu] = useState(false);
  const [openCRM, setOpenCRM] = useState(false);
  const [showReporteriasMenu, setShowReporteriasMenu] = useState(false); // Reportería personal
  const [showReporteriasSupervisorMenu, setShowReporteriasSupervisorMenu] =
    useState(false); // Reportería supervisor (grupos)
  const [showSupervisionMenu, setShowSupervisionMenu] = useState(false); // NUEVO: dropdown para Sistemas

  // Refs para cerrar al hacer click afuera
  const userMenuRef = useRef(null);
  const reportMenuRef = useRef(null);
  const usuariosMenuRef = useRef(null);
  const crmMenuRef = useRef(null);
  const reporteriasMenuRef = useRef(null);
  const reporteriasSupervisorMenuRef = useRef(null);
  const supervisionMenuRef = useRef(null);

  // Roles
  const userRoleId = getNormalizedRoleId(user);
  const isSistemas = userRoleId === ROLES_IDS.sistemas;
  const isBackoffice = userRoleId === ROLES_IDS.backoffice;
  const isGerencia = userRoleId === ROLES_IDS.gerencia;
  const isSupervisorComercial = userRoleId === ROLES_IDS.supervisorcomercial;
  const isComercial = userRoleId === ROLES_IDS.comercial;

  // Visibilidad de menús
  const canSeeReporteriasComercial = isComercial; // personales
  const canSeeReporteriasSupervisor =
    isSupervisorComercial || isGerencia || isSistemas; // por grupos
  const canSeeReportsMenu = ROLES_REPORTES.includes(userRoleId); // Reporte de ventas

  // CRM visible para Sistemas y Supervisor (si quieres incluir Gerencia, agrega || isGerencia)

  // Header de auth (para NotificationsBell)
  const authHeader = useMemo(() => {
    const token = localStorage.getItem("token");
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  }, [rawUser]);

  // Cerrar menús al click afuera / Escape
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target))
        setShowUserMenu(false);
      if (
        reportMenuRef.current &&
        !reportMenuRef.current.contains(event.target)
      )
        setShowReportMenu(false);
      if (
        usuariosMenuRef.current &&
        !usuariosMenuRef.current.contains(event.target)
      )
        setShowUsuariosMenu(false);
      if (crmMenuRef.current && !crmMenuRef.current.contains(event.target))
        setOpenCRM(false);
      if (
        reporteriasMenuRef.current &&
        !reporteriasMenuRef.current.contains(event.target)
      )
        setShowReporteriasMenu(false);
      if (
        reporteriasSupervisorMenuRef.current &&
        !reporteriasSupervisorMenuRef.current.contains(event.target)
      )
        setShowReporteriasSupervisorMenu(false);
      if (
        supervisionMenuRef.current &&
        !supervisionMenuRef.current.contains(event.target)
      )
        setShowSupervisionMenu(false);
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        setShowUserMenu(false);
        setShowReportMenu(false);
        setShowUsuariosMenu(false);
        setOpenCRM(false);
        setShowReporteriasMenu(false);
        setShowReporteriasSupervisorMenu(false);
        setShowSupervisionMenu(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  // Reset de menús al cambiar de usuario
  useEffect(() => {
    setShowUserMenu(false);
    setShowReportMenu(false);
    setShowUsuariosMenu(false);
    setOpenCRM(false);
    setShowReporteriasMenu(false);
    setShowReporteriasSupervisorMenu(false);
    setShowSupervisionMenu(false);
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
        <img
          src={logo}
          alt="Logo SECODI"
          className="h-12 w-auto cursor-pointer"
        />
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
              <svg
                className="w-3 h-3 ml-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
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

        {/* NUEVO: Dropdown "Supervisión" para SISTEMAS */}
        {isSistemas && (
          <div className="relative" ref={supervisionMenuRef}>
            <button
              type="button"
              className="flex items-center gap-1 text-sm hover:text-gray-300 transition focus:outline-none"
              onClick={(e) => {
                e.stopPropagation();
                setShowSupervisionMenu((v) => !v);
              }}
              aria-haspopup="menu"
              aria-expanded={showSupervisionMenu}
              aria-controls="supervision-menu"
              title="Vistas de supervisión"
            >
              Supervisión
            </button>

            {showSupervisionMenu && (
              <div
                id="supervision-menu"
                className="absolute left-1/2 -translate-x-1/2 mt-2 w-48 bg-white text-gray-800 rounded-sm text-center shadow-lg border border-gray-200 z-50 overflow-hidden transition-all duration-150 ease-out"
                role="menu"
              >
                <Link
                  to="/supervision-ejecutivos"
                  className="block px-4 py-2.5 text-sm hover:bg-gray-100 transition"
                  role="menuitem"
                  onClick={() => setShowSupervisionMenu(false)}
                >
                  Supervisión de Ejecutivos
                </Link>

                <div className="my-1 border-t border-gray-200" />

                <Link
                  to="/supervisartipificaciones"
                  className="block px-4 py-2.5 text-sm hover:bg-gray-100 transition"
                  role="menuitem"
                  onClick={() => setShowSupervisionMenu(false)}
                >
                  Supervisar Tipificaciones
                </Link>
                <Link
                  to="/supervisaroportunidadess"
                  className="block px-4 py-2.5 text-sm hover:bg-gray-100 transition"
                  role="menuitem"
                  onClick={() => setShowSupervisionMenu(false)}
                >
                  Supervisar Oportunidades
                </Link>
                <Link
                  to="/supervisarcitas"
                  className="block px-4 py-2.5 text-sm hover:bg-gray-100 transition"
                  role="menuitem"
                  onClick={() => setShowSupervisionMenu(false)}
                >
                  Supervisar Citas
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Reportería (personales): Comercial (+ opcional Gerencia) */}
        {canSeeReporteriasComercial && (
          <div className="relative" ref={reporteriasMenuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowReporteriasMenu((prev) => !prev);
              }}
              className="text-sm hover:text-gray-300 transition"
              title="Reportería (Tipificación, Oportunidades, Citas)"
            >
              Reportería
            </button>

            {showReporteriasMenu && (
              <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-36 bg-white text-gray-800 rounded-sm text-center shadow-lg border border-gray-200 z-50 overflow-hidden transition-all duration-150 ease-out">
                <Link
                  to="/reporteria/tipificacion"
                  className="block px-4 py-2.5 text-sm hover:bg-gray-100 transition"
                  onClick={() => setShowReporteriasMenu(false)}
                >
                  Tipificación
                </Link>
                <Link
                  to="/reporteria/oportunidades"
                  className="block px-4 py-2.5 text-sm hover:bg-gray-100 transition"
                  onClick={() => setShowReporteriasMenu(false)}
                >
                  Oportunidades
                </Link>
                <Link
                  to="/reporteria/citas"
                  className="block px-4 py-2.5 text-sm hover:bg-gray-100 transition"
                  onClick={() => setShowReporteriasMenu(false)}
                >
                  Citas
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Reportería Supervisor (por grupos): Supervisor + Gerencia + Sistemas */}
        {canSeeReporteriasSupervisor && (
          <div className="relative" ref={reporteriasSupervisorMenuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowReporteriasSupervisorMenu((prev) => !prev);
              }}
              className="text-sm hover:text-gray-300 transition"
              title="Reportería (por grupos)"
            >
              Reportería Supervisor
            </button>

            {showReporteriasSupervisorMenu && (
              <div className="absolute left-1/2 -translate-x-1/2  mt-2 w-36 bg-white text-gray-800 rounded-sm text-center shadow-lg border border-gray-200 z-50 overflow-hidden transition-all duration-150 ease-out">
                <Link
                  to="/reporteria-supervisor/tipificacion"
                  className="block px-4 py-2.5 text-sm hover:bg-gray-100 transition"
                  onClick={() => setShowReporteriasSupervisorMenu(false)}
                >
                  Tipificación
                </Link>
                <Link
                  to="/reporteria-supervisor/oportunidades"
                  className="block px-4 py-2.5 text-sm hover:bg-gray-100 transition"
                  onClick={() => setShowReporteriasSupervisorMenu(false)}
                >
                  Oportunidades
                </Link>
                <Link
                  to="/reporteria-supervisor/citas"
                  className="block px-4 py-2.5 text-sm hover:bg-gray-100 transition"
                  onClick={() => setShowReporteriasSupervisorMenu(false)}
                >
                  Citas
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Enlaces directos de tablas Supervisor (SOLO Supervisor/Gerencia; para Sistemas ya están en el dropdown de Supervisión) */}
        {(isSupervisorComercial || isGerencia) && (
          <>
            <Link
              to="/supervisartipificaciones"
              className="text-sm hover:text-gray-300 transition"
              title="Tipificaciones del equipo (tabla)"
            >
              Supervisar Tipificaciones
            </Link>
            <Link
              to="/supervisaroportunidadess"
              className="text-sm hover:text-gray-300 transition"
              title="Oportunidades del equipo (tabla)"
            >
              Supervisar Oportunidades{" "}
            </Link>
            <Link
              to="/supervisarcitas"
              className="text-sm hover:text-gray-300 transition"
              title="Citas del equipo (tabla)"
            >
              Supervisar Citas{" "}
            </Link>
          </>
        )}

        {/* Link Ventas (roles con acceso) */}
        {user &&
          (isSistemas ||
            isBackoffice ||
            isSupervisorComercial ||
            isGerencia) && (
            <Link
              to="/ventas"
              className="text-sm tet-center hover:text-gray-300 transition"
            >
              Ventas
            </Link>
          )}

        {/* Bloque Comercial + CRM */}
        {user && (
          <div className="flex items-center gap-4">
            {isComercial && (
              <>
                <Link
                  to="/mi-base"
                  className="text-sm hover:text-gray-300 transition"
                  title="Mi Base"
                >
                  Mi Base
                </Link>
                <Link
                  to="/mis-tipificaciones"
                  className="text-sm hover:text-gray-300 transition"
                  title="Mis tipificaciones"
                >
                  Mis tipificaciones
                </Link>
                <Link
                  to="/mis-oportunidades"
                  className="text-sm hover:text-gray-300 transition"
                  title="Mis oportunidades"
                >
                  Mis oportunidades
                </Link>
                <Link
                  to="/mis-citas"
                  className="text-sm hover:text-gray-300 transition"
                  title="Mis citas"
                >
                  Mis citas
                </Link>

                <Link
                  to="/whatsapp"
                  className="text-sm hover:text-emerald-400 transition"
                  title="WhatsApp (Conexión y plantillas)"
                >
                  WhatsApp
                </Link>

                <Link
                  to="/outlook"
                  className="text-sm hover:text-emerald-400 transition"
                  title="Correo (Outlook)"
                >
                  Correo
                </Link>
              </>
            )}

            {(isSistemas || isSupervisorComercial) && (
              <div className="relative" ref={crmMenuRef}>
                <button
                  type="button"
                  className="flex items-center gap-1 text-sm hover:text-gray-300 transition focus:outline-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenCRM((v) => !v);
                  }}
                  aria-haspopup="menu"
                  aria-expanded={openCRM}
                  aria-controls="crm-menu"
                  title="CRM (Asignación y Supervisión)"
                >
                  CRM
                </button>

                {openCRM && (
                  <div
                    id="crm-menu"
                    className="absolute left-1/2 -translate-x-1/2 mt-2 w-32 bg-white text-gray-800 rounded-sm text-center shadow-lg border border-gray-200 z-50 overflow-hidden transition-all duration-150 ease-out"
                    role="menu"
                  >
                    {isSistemas && (
                      <Link
                        to="/asignacion"
                        className="block px-4 py-2.5 text-sm hover:bg-gray-100 transition"
                        role="menuitem"
                        onClick={() => setOpenCRM(false)}
                      >
                        Asignar base
                      </Link>
                    )}

                    {(isSistemas || isSupervisorComercial) && (
                      <Link
                        to="/supervision-ejecutivos"
                        className="block px-4 py-2.5 text-sm hover:bg-gray-100 transition"
                        role="menuitem"
                        onClick={() => setOpenCRM(false)}
                      >
                        Supervisar Ejecutivos
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Asignaciones (solo Sistemas) */}
        {isSistemas && (
          <Link
            to="/asignaciones"
            className="text-sm hover:text-gray-300 transition"
          >
            Asignaciones
          </Link>
        )}

        {/* Reporte de Ventas (solo Sistemas/Gerencia) */}
        {canSeeReportsMenu && (
          <div className="relative" ref={reportMenuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowReportMenu((prev) => !prev);
              }}
              className=" text-sm hover:text-gray-300 transition"
              title="Reporte de Ventas"
            >
              Reporte de Ventas
            </button>

            {showReportMenu && (
              <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-36 bg-white text-gray-800 rounded-sm text-center shadow-lg border border-gray-200 z-50 overflow-hidden transition-all duration-150 ease-out">
                <Link
                  to="/HistoricalSales"
                  className="block px-4 py-2.5 text-sm hover:bg-gray-100 transition"
                  onClick={() => setShowReportMenu(false)}
                >
                  Histórico Ventas
                </Link>
                <Link
                  to="/DashboardSales"
                  className="block px-4 py-2.5 text-sm hover:bg-gray-100 transition"
                  onClick={() => setShowReportMenu(false)}
                >
                  Dashboard Ventas
                </Link>
                <Link
                  to="/Historical"
                  className="block px-4 py-2.5 text-sm hover:bg-gray-100 transition"
                  onClick={() => setShowReportMenu(false)}
                >
                  Histórico de Ejecutivos
                </Link>
                <Link
                  to="/DashboardEjecutives"
                  className="block px-4 py-2.5 text-sm hover:bg-gray-100 transition"
                  onClick={() => setShowReportMenu(false)}
                >
                  Dashboard Ejecutivos
                </Link>
              </div>
            )}
          </div>
        )}

        {/* 🔔 Notificaciones */}
        {user && <NotificationsBell authHeader={authHeader} enabled={!!user} />}

        {/* Menú de usuario */}
        {user && (
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowUserMenu((prev) => !prev);
              }}
              className="w-10 h-10 rounded-full bg-red-800 flex items-center justify-center text-lg font-semibold transition mr-4"
              title={user?.email || "Cuenta"}
            >
              {userInitial}
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-24 bg-white text-gray-800 rounded-sm text-center shadow-lg border border-gray-200 z-50 overflow-hidden transition-all duration-150 ease-out">
                <button
                  className="block w-full px-4 py-2.5 text-sm hover:bg-gray-100 transition"
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate("/cuenta");
                  }}
                >
                  Ver cuenta
                </button>
                <button
                  className="block w-full px-4 py-2.5 text-sm text-red-700 hover:bg-gray-100 transition"
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
