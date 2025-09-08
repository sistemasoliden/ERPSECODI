import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function ClienteDetalle() {
  const { ruc } = useParams();
  const { token } = useAuth();
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [item, setItem] = useState(null);

  useEffect(() => {
    const load = async () => {
const res = await api.get(`/basesecodi/ruc/${ruc}`, authHeader);      setItem(res.data || null);
    };
    load();
  }, [ruc]); // eslint-disable-line

  if (!item) return <div className="p-6">Cargando…</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold text-gray-800">Cliente {item.razonSocial || item.RAZON_SOCIAL || "—"}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border p-4 space-y-2">
          <div><b>RUC:</b> {item.ruc || item.RUC || "—"}</div>
          <div><b>Razón Social:</b> {item.razonSocial || item.RAZON_SOCIAL || "—"}</div>
          <div><b>Departamento:</b> {item.departamento || item.DEPARTAMENTO || "—"}</div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div><b>Contacto:</b> {item.contactName || item.CONTACTO || "—"}</div>
            <div><b>Correo:</b> {item.email || item.CORREO || "—"}</div>
            <div><b>Celular:</b> {item.phone || item.CELULAR || "—"}</div>
            <div><b>Cargo:</b> {item.cargo || item.CARGO || "—"}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4 space-y-2">
          <div className="text-sm text-gray-500 uppercase">Líneas</div>
          <div><b>Claro:</b> {item.claroLines ?? item.LINEAS_CLARO ?? 0}</div>
          <div><b>Entel:</b> {item.entelLines ?? item.LINEAS_ENTEL ?? 0}</div>
          <div><b>Movistar:</b> {item.movistarLines ?? item.LINEAS_MOVISTAR ?? 0}</div>
          <div><b>Total:</b> {item.totalLines ?? item.LINEAS_TOTALES ?? 0}</div>
        </div>
      </div>
    </div>
  );
}
