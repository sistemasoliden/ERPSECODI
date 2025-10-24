// src/pages/Mantenimiento.jsx
import React from "react";

export default function Mantenimiento() {
  return (
    <div
      style={{
        height: "88vh", // usar vh en lugar de dvh para compatibilidad
        overflow: "hidden", // evita scroll
        background: "#F2F0F0", // color de fondo unificado
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
          padding: 28,
          textAlign: "center",
        }}
      >
        {/* Icono */}
        <div
          style={{
            width: 80,
            height: 80,
            margin: "0 auto 16px",
            borderRadius: "50%",
            background: "#eef2ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
            color: "#4f46e5",
          }}
          aria-hidden
        >
          🛠️
        </div>

        {/* Título */}
        <h1
          style={{
            margin: "8px 0",
            fontSize: 22,
            fontWeight: 800,
            color: "#111827",
          }}
        >
          Estamos realizando mantenimiento
        </h1>

        {/* Mensaje */}
        <p style={{ margin: "6px 0 0", color: "#374151", lineHeight: 1.5 }}>
          Estamos trabajando para mejorar la plataforma. Vuelve a intentar en
          unos minutos. Gracias por tu paciencia.
        </p>

        {/* Pie con código */}
        <div style={{ marginTop: 18, fontSize: 12, color: "#6b7280" }}>
          Código: <b>MAINT-001</b> · Última actualización:{" "}
          {new Date().toLocaleString("es-PE")}
        </div>
      </div>
    </div>
  );
}
