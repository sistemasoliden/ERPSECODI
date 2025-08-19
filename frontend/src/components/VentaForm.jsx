// src/components/VentaForm.jsx
import React, { useState } from "react";
import api from "../api/axios";

const FIELDS = [
  { key: "MES", label: "MES", type: "text", required: true, placeholder: "ENERO: 2024" },
  { key: "FECHA INGRESO", label: "Fecha Ingreso", type: "date" },
  { key: "FECHA ACTIVACION", label: "Fecha Activación", type: "date" },
  { key: "SEC_PROYECTO_SOT", label: "SEC_PROYECTO_SOT", type: "number" },
  { key: "TIPO_V", label: "TIPO_V", type: "text", placeholder: "VENTAS MOVILES" },
  { key: "PRODUCTO", label: "PRODUCTO", type: "text", placeholder: "MOVIL" },
  { key: "TIPO DE VENTA", label: "Tipo de Venta", type: "text", placeholder: "LINEAS ADICIONALES / UPSELLING" },
  { key: "RAZON SOCIAL CLIENTE", label: "Razón Social", type: "text" },
  { key: "ESTADO FINAL", label: "Estado Final", type: "text", placeholder: "APROBADO" },
  { key: "RUC", label: "RUC", type: "number" },
  { key: "LINEAS", label: "Líneas", type: "text" },
  { key: "CUENTA", label: "Cuenta", type: "text" },
  { key: "EQUIPO", label: "Equipo", type: "text" },
  { key: "SALESFORCE", label: "Salesforce", type: "text" },
  { key: "CONSULTORES", label: "Consultores", type: "text" },
  { key: "SUPERVISOR", label: "Supervisor", type: "text" },
  { key: "Q", label: "Q", type: "number" },

  // 👇 OJO: estos tienen espacios delante/detrás en la colección
  { key: " CF SIN IGV ", label: "CF sin IGV", type: "number", step: "0.0000001" },

  { key: "TIPO", label: "Tipo", type: "text", placeholder: "ALTA" },
  { key: "DISTRITO", label: "Distrito", type: "text" },
  { key: "CONSULTOR REGISTRADO", label: "Consultor Registrado", type: "text" },
  { key: "PLAN", label: "Plan", type: "text" },

  { key: " CF INC IGV ", label: "CF inc IGV", type: "number", step: "0.0000001" },
  { key: " COSTO EQUIPO ", label: "Costo Equipo", type: "number", step: "0.01" },

  { key: "PDV", label: "PDV", type: "text" },
  { key: "SEGMENTO", label: "Segmento", type: "text", placeholder: "PYME" },
  { key: "MOTIVO RECHAZO", label: "Motivo Rechazo", type: "text" },

  { key: " PLAN CONTRATADO FINAL PC INC IGV ", label: "Plan Final (inc IGV)", type: "number", step: "0.0000001" },
  { key: " PC SIN IGV ", label: "PC sin IGV", type: "number", step: "0.0000001" },
];

export default function VentaForm({ onCreated }) {
  const [form, setForm] = useState(() => {
    const initial = {};
    FIELDS.forEach(f => (initial[f.key] = ""));
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const parseNumber = (v) => (v === "" || v === null ? undefined : Number(v));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Pequeña validación mínima
    if (!form["MES"]) {
      setError("El campo MES es obligatorio.");
      return;
    }

    // Construimos el payload respetando las claves EXACTAS
    const payload = { ...form };

    // Convertimos a número donde corresponde
    ["SEC_PROYECTO_SOT","RUC","Q",
     " CF SIN IGV "," CF INC IGV "," COSTO EQUIPO ",
     " PLAN CONTRATADO FINAL PC INC IGV "," PC SIN IGV "
    ].forEach(k => {
      if (k in payload) {
        const n = parseNumber(payload[k]);
        if (n !== undefined && !Number.isNaN(n)) payload[k] = n;
      }
    });

    setSaving(true);
    try {
      await api.post("/ventas", payload);  // requiere ruta POST en backend
      // Limpia el formulario
      const cleared = {};
      FIELDS.forEach(f => (cleared[f.key] = ""));
      setForm(cleared);

      if (onCreated) onCreated(); // para refrescar la tabla
    } catch (err) {
      console.error("❌ Error creando venta:", err);
      setError("No se pudo guardar la venta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-3 mb-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold">Nueva venta</h2>
        <button
          type="submit"
          disabled={saving}
          className="text-[10px] px-2 py-1 border rounded disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>

      {error && (
        <div className="text-[10px] text-red-600 mb-2">{error}</div>
      )}

      {/* grid 2 columnas, super compacto */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {FIELDS.map(({ key, label, type, placeholder, step, required }) => (
          <label key={key} className="flex flex-col text-[10px]">
            <span className="mb-0.5">{label}{required && " *"}</span>
            <input
              type={type || "text"}
              step={step}
              required={!!required}
              className="border rounded px-2 py-1 text-[11px] h-7"
              placeholder={placeholder}
              value={form[key] ?? ""}
              onChange={(e) => handleChange(key, e.target.value)}
            />
          </label>
        ))}
      </div>
    </form>
  );
}
