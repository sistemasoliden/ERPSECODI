// src/pages/Ventas.jsx
import React, { useEffect, useState, useCallback } from "react";
import api from "../api/axios";
import VentaForm from "../components/VentaForm";

export default function Ventas() {
  const [ventas, setVentas] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false); // 👈 controlar visibilidad del form

  // Campos a mostrar
  const campos = [
    "MES",
    "FECHA INGRESO",
    "FECHA ACTIVACION",
    "SEC_PROYECTO_SOT",
    "TIPO_V",
    "PRODUCTO",
    "TIPO DE VENTA",
    "RAZON SOCIAL CLIENTE",
    "ESTADO FINAL",
    "RUC",
    "LINEAS",
    "CUENTA",
    "EQUIPO",
    "SALESFORCE",
    "CONSULTORES",
    "SUPERVISOR",
    "Q",
    " CF SIN IGV ",
    "TIPO",
    "DISTRITO",
    "CONSULTOR REGISTRADO",
    "PLAN",
    " CF INC IGV ",
    " COSTO EQUIPO ",
    "PDV",
    "SEGMENTO",
    "MOTIVO RECHAZO",
    " PLAN CONTRATADO FINAL PC INC IGV ",
    " PC SIN IGV ",
  ];

  const totalPages = Math.max(1, Math.ceil(total / limit));

  // ✅ Memoriza la función para que no cambie en cada render
  const fetchVentas = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/ventas", { params: { page, limit } });
      setVentas(res.data?.data || []);
      setTotal(res.data?.total ?? 0);
    } catch (err) {
      console.error("❌ Error cargando ventas:", err);
      setVentas([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    fetchVentas();
  }, [fetchVentas]);

  return (
    <div className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xs font-bold">Ventas (Backoffice)</h1>

        <div className="flex items-center gap-2">
          {/* 👇 Botón para mostrar/ocultar formulario */}
          <button
            onClick={() => setShowForm((prev) => !prev)}
            className="text-[10px] px-2 py-1 border rounded bg-blue-500 text-white hover:bg-blue-600"
          >
            {showForm ? "Cancelar" : "Añadir nueva venta"}
          </button>

          <label className="text-[10px]">Filas:</label>
          <select
            className="border rounded px-1 py-0.5 text-[10px]"
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <button
            className="border rounded px-2 py-0.5 text-[10px] disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
          >
            ◀
          </button>
          <span className="text-[10px]">
            Página <b>{page}</b> de <b>{totalPages}</b>
          </span>
          <button
            className="border rounded px-2 py-0.5 text-[10px] disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >
            ▶
          </button>
        </div>
      </div>

      {/* 👇 Renderizar formulario solo si showForm === true */}
      {showForm && <VentaForm onCreated={fetchVentas} />}

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 text-[11px]">
          <thead className="bg-gray-100">
            <tr className="h-6">
              {campos.map((col) => (
                <th
                  key={col}
                  className="border px-1 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={campos.length}
                  className="text-center py-4 text-[11px]"
                >
                  Cargando...
                </td>
              </tr>
            ) : ventas.length > 0 ? (
              ventas.map((v) => (
                <tr key={v._id} className="h-6">
                  {campos.map((col) => (
                    <td
                      key={col}
                      className="border px-1 py-0.5 leading-tight whitespace-nowrap"
                    >
                      {v[col] != null ? String(v[col]) : ""}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={campos.length}
                  className="text-center py-3 text-[11px]"
                >
                  No hay registros de ventas disponibles
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
