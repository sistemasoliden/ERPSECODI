// src/App.jsx
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useEffect } from "react";
import { initTheme } from "./lib/theme";

import WhatsAppHub from "./pages/mensajeria/WhatsAppHub";


import Home from "./pages/Home";
import Login from "./pages/Login";
import Cuenta from "./pages/Cuenta";
import Users from "./pages/Users";
import Historical from "./pages/Historical";
import HistoricalSales from "./pages/HistoricalSales";
import DashboardSales from "./pages/DashboardSales";
import DashboardEjecutives from "./pages/DashboardEjecutives";
import Ventas from "./pages/Ventas";
import Navbar from "./components/Navbar";
import Equipos from "./pages/Equipos";
import Asignacion from "./pages/Asignacion";
import MiBase from "./pages/MiBase";
import MisOportunidades from "./pages/MisOportunidades";
import Asignaciones from "./pages/Asignaciones";
import ClienteDetalle from "./pages/ClienteDetalle";
import SupervisionEjecutivos from "./pages/SupervisionEjecutivos";
import MisCitas from "./pages/MisCitas";

// Reportería (personal)
import ReportTipificacion from "./pages/reporteria/ReportTipificacion";
import ReportOportunidades from "./pages/reporteria/ReportOportunidades";
import ReportCitas from "./pages/reporteria/ReportCitas";

// Reportería (equipo / supervisor)
import ReportTipificacionSupervisor from "./pages/reporteria/ReportTipificacionSupervisor";
import ReportOportunidadesSupervisor from "./pages/reporteria/ReportOportunidadesSupervisor";
import ReportCitasSupervisor from "./pages/reporteria/ReportCitasSupervisor";
import OutlookMensajes from "./pages/mensajeria/OutllookMensajes";

const ROLES_IDS = {
  sistemas: "68a4f22d27e6abe98157a82c",
  administracion: "68a4f22d27e6abe98157a82d",
  recursoshumanos: "68a4f22d27e6abe98157a82e",
  gerencia: "68a4f22d27e6abe98157a82f",
  backoffice: "68a4f22d27e6abe98157a830",
  comercial: "68a4f22d27e6abe98157a831",
  supervisorcomercial: "68a4f22d27e6abe98157a832",
  postventa: "PUT_THE_REAL_ID_HERE",
};

// Grupos de permisos para reportería
const ROLES_REPORTES_PERSONALES = [ROLES_IDS.comercial, ROLES_IDS.gerencia];
const ROLES_REPORTES_EQUIPO = [ROLES_IDS.supervisorcomercial, ROLES_IDS.gerencia];

const ProtectedRoute = ({ children, roleIds }) => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) return <Navigate to="/login" replace />;

  const userRoleId =
    typeof user.role === "string" ? user.role : user.role?._id || "";
  if (roleIds && !roleIds.includes(userRoleId))
    return <Navigate to="/" replace />;

  return children;
};

export default function App() {
  useEffect(() => {
    const cleanup = initTheme();
    return cleanup;
  }, []);

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Home />} />

        <Route
          path="/cuenta"
          element={
            <ProtectedRoute>
              <Cuenta />
            </ProtectedRoute>
          }
        />

        <Route
          path="/mi-base"
          element={
            <ProtectedRoute
              roleIds={[ROLES_IDS.comercial, ROLES_IDS.supervisorcomercial]}
            >
              <MiBase />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mis-oportunidades"
          element={
            <ProtectedRoute
              roleIds={[ROLES_IDS.comercial, ROLES_IDS.supervisorcomercial]}
            >
              <MisOportunidades />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mis-citas"
          element={
            <ProtectedRoute
              roleIds={[ROLES_IDS.comercial, ROLES_IDS.supervisorcomercial]}
            >
              <MisCitas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clientes/:ruc"
          element={
            <ProtectedRoute
              roleIds={[ROLES_IDS.comercial, ROLES_IDS.supervisorcomercial]}
            >
              <ClienteDetalle />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cliente-detalle/:id"
          element={
            <ProtectedRoute
              roleIds={[ROLES_IDS.comercial, ROLES_IDS.supervisorcomercial]}
            >
              <ClienteDetalle />
            </ProtectedRoute>
          }
        />
        <Route
          path="/asignaciones"
          element={
            <ProtectedRoute roleIds={[ROLES_IDS.sistemas]}>
              <Asignaciones />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supervision-ejecutivos"
          element={
            <ProtectedRoute roleIds={[ROLES_IDS.sistemas]}>
              <SupervisionEjecutivos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/ventas"
          element={
            <ProtectedRoute
              roleIds={[
                ROLES_IDS.sistemas,
                ROLES_IDS.backoffice,
                ROLES_IDS.supervisorcomercial,
                ROLES_IDS.gerencia,
              ]}
            >
              <Ventas />
            </ProtectedRoute>
          }
        />

        <Route
          path="/asignacion"
          element={
            <ProtectedRoute roleIds={[ROLES_IDS.sistemas]}>
              <Asignacion />
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute roleIds={[ROLES_IDS.sistemas]}>
              <Users />
            </ProtectedRoute>
          }
        />

        <Route
          path="/equipos"
          element={
            <ProtectedRoute roleIds={[ROLES_IDS.sistemas]}>
              <Equipos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/Historical"
          element={
            <ProtectedRoute
              roleIds={[
                ROLES_IDS.sistemas,
                ROLES_IDS.administracion,
                ROLES_IDS.backoffice,
                ROLES_IDS.postventa,
                ROLES_IDS.recursoshumanos,
                ROLES_IDS.gerencia,
                ROLES_IDS.supervisorcomercial,
              ]}
            >
              <Historical />
            </ProtectedRoute>
          }
        />

        <Route
          path="/DashboardEjecutives"
          element={
            <ProtectedRoute
              roleIds={[
                ROLES_IDS.sistemas,
                ROLES_IDS.administracion,
                ROLES_IDS.backoffice,
                ROLES_IDS.postventa,
                ROLES_IDS.recursoshumanos,
                ROLES_IDS.gerencia,
                ROLES_IDS.supervisorcomercial,
              ]}
            >
              <DashboardEjecutives />
            </ProtectedRoute>
          }
        />

        {/* Reportería PERSONAL (comercial + gerencia) */}
        <Route
          path="/reporteria/tipificacion"
          element={
            <ProtectedRoute roleIds={ROLES_REPORTES_PERSONALES}>
              <ReportTipificacion />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reporteria/oportunidades"
          element={
            <ProtectedRoute roleIds={ROLES_REPORTES_PERSONALES}>
              <ReportOportunidades />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reporteria/citas"
          element={
            <ProtectedRoute roleIds={ROLES_REPORTES_PERSONALES}>
              <ReportCitas />
            </ProtectedRoute>
          }
        />

        <Route
  path="/whatsapp"
  element={
    <ProtectedRoute roleIds={[ROLES_IDS.comercial]}>
      <WhatsAppHub />
    </ProtectedRoute>
  }
/>

<Route
  path="/outlook"
  element={
    <ProtectedRoute roleIds={[ROLES_IDS.comercial]}>
      <OutlookMensajes />
    </ProtectedRoute>
  }
/>


        {/* Reportería de EQUIPO (supervisor + gerencia) */}
       {/* Reportería de EQUIPO (supervisor + gerencia) */}
<Route
  path="/reporteria-supervisor/tipificacion"
  element={
    <ProtectedRoute roleIds={ROLES_REPORTES_EQUIPO}>
      <ReportTipificacionSupervisor />
    </ProtectedRoute>
  }
/>
<Route
  path="/reporteria-supervisor/oportunidades"
  element={
    <ProtectedRoute roleIds={ROLES_REPORTES_EQUIPO}>
      <ReportOportunidadesSupervisor />
    </ProtectedRoute>
  }
/>
<Route
  path="/reporteria-supervisor/citas"
  element={
    <ProtectedRoute roleIds={ROLES_REPORTES_EQUIPO}>
      <ReportCitasSupervisor />
    </ProtectedRoute>
  }
/>


        <Route
          path="/HistoricalSales"
          element={
            <ProtectedRoute
              roleIds={[
                ROLES_IDS.sistemas,
                ROLES_IDS.administracion,
                ROLES_IDS.backoffice,
                ROLES_IDS.postventa,
                ROLES_IDS.recursoshumanos,
                ROLES_IDS.gerencia,
                ROLES_IDS.supervisorcomercial,
              ]}
            >
              <HistoricalSales />
            </ProtectedRoute>
          }
        />

        <Route
          path="/DashboardSales"
          element={
            <ProtectedRoute
              roleIds={[
                ROLES_IDS.sistemas,
                ROLES_IDS.administracion,
                ROLES_IDS.backoffice,
                ROLES_IDS.postventa,
                ROLES_IDS.recursoshumanos,
                ROLES_IDS.gerencia,
                ROLES_IDS.supervisorcomercial,
              ]}
            >
              <DashboardSales />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
