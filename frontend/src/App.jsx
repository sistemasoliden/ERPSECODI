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

// Definimos qué roles pueden ver ventas
const ROLES_VENTAS = [
  "sistemas",
  "administracion",
  "backoffice",
  "postventa",
  "recursoshumanos",
  "gerencia",
  "supervisorcomercial",
];


const ProtectedRoute = ({ children, roles }) => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

export default function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Home />} />

        {/* Otras rutas protegidas */}
        <Route
          path="/cuenta"
          element={
            <ProtectedRoute>
              <Cuenta />
            </ProtectedRoute>
          }
        />

        <Route
          path="/ventas"
          element={
            <ProtectedRoute roles={["backoffice"]}>
              <Ventas />
            </ProtectedRoute>
          }
        />
        
        {/* Ruta de Usuarios sólo para sistemas */}
        <Route
          path="/users"
          element={
            <ProtectedRoute roles={["sistemas"]}>
              <Users />
            </ProtectedRoute>
          }
        />
        
 <Route
    path="/Historical"
    element={
      <ProtectedRoute roles={ROLES_VENTAS}>
      
        <Historical />
      </ProtectedRoute>
    }
  />
  <Route
    path="/DashboardEjecutives"
    element={
      <ProtectedRoute roles={ROLES_VENTAS}>
        <DashboardEjecutives />
      </ProtectedRoute>
    }
  />

  {/* Ventas: accesibles para varios roles */}
  <Route
    path="/HistoricalSales"
    element={
      <ProtectedRoute roles={ROLES_VENTAS}>
        <HistoricalSales />
      </ProtectedRoute>
    }
  />
  <Route
    path="/DashboardSales"
    element={
      <ProtectedRoute roles={ROLES_VENTAS}>
        <DashboardSales />
      </ProtectedRoute>
    }
  />
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
    </Router>
  );

}
