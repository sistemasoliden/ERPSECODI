// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
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

const ROLES_IDS = {
  sistemas: "68a4f22d27e6abe98157a82c",
  administracion: "68a4f22d27e6abe98157a82d",
  recursoshumanos: "68a4f22d27e6abe98157a82e",
  gerencia: "68a4f22d27e6abe98157a82f",
  backoffice: "68a4f22d27e6abe98157a830",
  comercial: "68a4f22d27e6abe98157a831",
  supervisorcomercial: "68a4f22d27e6abe98157a832",
};

const ProtectedRoute = ({ children, roleIds }) => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) return <Navigate to="/login" replace />;

  const userRoleId =
    typeof user.role === "string"
      ? user.role
      : user.role?._id || "";

  if (roleIds && !roleIds.includes(userRoleId)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default function App() {
  return (
    <Router>
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

        {/* Ventas: solo Back Office */}
        <Route
          path="/ventas"
          element={
            <ProtectedRoute roleIds={[ROLES_IDS.backoffice]}>
              <Ventas />
            </ProtectedRoute>
          }
        />

        {/* Usuarios: solo Sistemas */}
        <Route
          path="/users"
          element={
            <ProtectedRoute roleIds={[ROLES_IDS.sistemas]}>
              <Users />
            </ProtectedRoute>
          }
        />

        {/* Reportes por varios roles */}
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
    </Router>
  );
}
