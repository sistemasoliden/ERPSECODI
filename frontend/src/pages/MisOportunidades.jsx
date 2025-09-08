import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import OpportunityCard from "../components/OpportunityCard.jsx";

export default function MisOportunidades() {
  const { token } = useAuth();
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [rows, setRows] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [vista, setVista] = useState("tabla"); // "tabla" | "tarjetas"

  const loadTipos = async () => {
    const res = await api.get("/oportunidades/tipos/all", authHeader);
    setTipos(res.data || []);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/oportunidades", {
        ...authHeader,
        params: { page, limit, q: q || undefined, estadoId: filtroEstado || undefined },
      });
      setRows(res.data.items || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTipos(); /* eslint-disable-next-line */ }, [token]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, q, filtroEstado, token]);

  const canPrev = page > 1;
  const canNext = page < pages;

  const handleChangeEstado = async (id, estadoId) => {
    await api.patch(`/oportunidades/${id}/estado`, { estadoId }, authHeader);
    load();
  };

  return (
    <div className="p-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mis Oportunidades</h1>
          <p className="text-gray-600">Listado de oportunidades creadas por ti.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => { setPage(1); setQ(e.target.value); }}
            placeholder="Buscar por RUC o Razón Social"
            className="w-72 border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <select
            value={filtroEstado}
            onChange={(e) => { setPage(1); setFiltroEstado(e.target.value); }}
            className="border border-gray-300 rounded px-2 py-2 text-sm"
          >
            <option value="">Todos los estados</option>
            {tipos.map(t => <option key={t._id} value={t._id}>{t.nombre}</option>)}
          </select>
          <button onClick={load} className="px-3 py-2 bg-gray-800 text-white text-xs rounded">Buscar</button>
          <button onClick={() => { setQ(""); setFiltroEstado(""); setPage(1); }} className="px-3 py-2 bg-gray-200 text-xs rounded">Limpiar</button>

          <div className="ml-2">
            <label className="text-xs text-gray-600 mr-1">Vista:</label>
            <select value={vista} onChange={(e) => setVista(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs">
              <option value="tabla">Tabla</option>
              <option value="tarjetas">Tarjetas</option>
            </select>
          </div>
        </div>
      </div>

      {vista === "tabla" ? (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="w-full text-sm text-left text-gray-700">
            <thead className="bg-gray-100 text-gray-900 font-semibold">
              <tr>
                <th className="px-4 py-2">RUC</th>
                <th className="px-4 py-2">Razón Social</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Monto (S/.)</th>
                <th className="px-4 py-2">Creado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((op) => (
                <tr key={op._id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <Link className="text-indigo-700 underline" to={`/clientes/${op.ruc}`}>{op.ruc}</Link>
                  </td>
                  <td className="px-4 py-2">{op.razonSocial || op?.base?.razonSocial || "—"}</td>
                  <td className="px-4 py-2">{op.estadoNombre}</td>
                  <td className="px-4 py-2">{Number(op.monto || 0).toLocaleString("es-PE")}</td>
                  <td className="px-4 py-2">
                    {op.createdAt ? new Date(op.createdAt).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }) : "—"}
                  </td>
                </tr>
              ))}
              {!rows.length && !loading && (
                <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={5}>Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((op) => (
            <OpportunityCard key={op._id} op={op} tipos={tipos} onChangeEstado={handleChangeEstado} />
          ))}
          {!rows.length && !loading && (
            <div className="text-center text-gray-500 col-span-full">Sin resultados</div>
          )}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-3">
          <button disabled={!canPrev} onClick={() => canPrev && setPage(p => p - 1)} className="px-3 py-2 text-xs rounded border border-gray-300 disabled:opacity-50">← Anterior</button>
          <div className="text-xs text-gray-600">Página <b>{page}</b> de <b>{pages}</b> ({total} resultados)</div>
          <button disabled={!canNext} onClick={() => canNext && setPage(p => p + 1)} className="px-3 py-2 text-xs rounded border border-gray-300 disabled:opacity-50">Siguiente →</button>
        </div>
      )}
    </div>
  );
}
