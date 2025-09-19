import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import OpportunityModal from "../components/OpportunityModal.jsx";

// --- debounce simple para el buscador
function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function MisOportunidades() {
  const { token } = useAuth();
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [rows, setRows] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 450);

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // modal
  const [openModal, setOpenModal] = useState(false);
  const [selected, setSelected] = useState(null);

  const loadTipos = async () => {
    const res = await api.get("/oportunidades/tipos/all", authHeader);
    setTipos(res.data || []);
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        q: debouncedQ || undefined,
        estadoId: filtroEstado || undefined,
      };
      const res = await api.get("/oportunidades", { ...authHeader, params });
      setRows(res.data.items || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTipos(); /* eslint-disable-next-line */ }, [token]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, debouncedQ, filtroEstado, token]);

  const canPrev = page > 1;
  const canNext = page < pages;

  const handleChangeEstado = async (id, estadoId) => {
    await api.patch(`/oportunidades/${id}/estado`, { estadoId }, authHeader);
    await load();
    if (selected?._id === id) {
      // refresca el seleccionado con la fila actualizada
      const updated = (rows || []).find(r => r._id === id);
      setSelected(updated ?? selected);
    }
  };

  const handleUpdate = async (id, data) => {
    await api.patch(`/oportunidades/${id}`, data, authHeader);
    await load();
    if (selected?._id === id) {
      const updated = (rows || []).find(r => r._id === id);
      setSelected(updated ?? { ...selected, ...data });
    }
  };

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="mb-4 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mis Oportunidades</h1>
          <p className="text-gray-600">Haz clic en el <b>RUC</b> para abrir la tarjeta y cambiar la etapa.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => { setPage(1); setQ(e.target.value); }}
              placeholder="Buscar por RUC o Razón Social"
              className="w-72 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200"
            />
            {q && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => { setQ(""); setPage(1); }}
                title="Limpiar búsqueda"
              >✕</button>
            )}
          </div>

          <select
            value={filtroEstado}
            onChange={(e) => { setPage(1); setFiltroEstado(e.target.value); }}
            className="border border-gray-300 rounded-lg px-2 py-2 text-sm"
            title="Filtrar por estado"
          >
            <option value="">Todos los estados</option>
            {tipos.map(t => <option key={t._id} value={t._id}>{t.nombre}</option>)}
          </select>

          <button onClick={load} className="px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow hover:shadow-md">
            Buscar
          </button>
          <button
            onClick={() => { setQ(""); setFiltroEstado(""); setPage(1); }}
            className="px-3 py-2 bg-gray-100 text-xs rounded-lg border border-gray-200 hover:bg-gray-200"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white shadow rounded-2xl overflow-hidden border border-gray-200">
        <table className="w-full text-sm text-left text-gray-700">
          <thead className="bg-gray-50 text-gray-900 font-semibold">
            <tr>
              <th className="px-4 py-3">RUC</th>
              <th className="px-4 py-3">Razón Social</th>
              <th className="px-4 py-3">Etapa</th>
              <th className="px-4 py-3">Monto (S/.)</th>
              <th className="px-4 py-3">Creado</th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={`sk-${i}`} className="border-t">
                <td className="px-4 py-3"><div className="h-3 w-20 bg-gray-200 rounded animate-pulse" /></td>
                <td className="px-4 py-3"><div className="h-3 w-40 bg-gray-200 rounded animate-pulse" /></td>
                <td className="px-4 py-3"><div className="h-3 w-24 bg-gray-200 rounded animate-pulse" /></td>
                <td className="px-4 py-3"><div className="h-3 w-24 bg-gray-200 rounded animate-pulse" /></td>
                <td className="px-4 py-3"><div className="h-3 w-28 bg-gray-200 rounded animate-pulse" /></td>
              </tr>
            ))}

            {!loading && rows.map((op) => (
              <tr key={op._id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
                    onClick={() => { setSelected(op); setOpenModal(true); }}
                    title="Ver/editar oportunidad"
                  >
                    {op.ruc}
                  </button>
                </td>
                <td className="px-4 py-3">{op.razonSocial || op?.base?.razonSocial || "—"}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                    {op.estadoNombre}
                  </span>
                </td>
                <td className="px-4 py-3">{Number(op.monto || 0).toLocaleString("es-PE")}</td>
                <td className="px-4 py-3">
                  {op.createdAt
                    ? new Date(op.createdAt).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })
                    : "—"}
                </td>
              </tr>
            ))}

            {!loading && !rows.length && (
              <tr><td className="px-4 py-8 text-center text-gray-500" colSpan={5}>Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            disabled={!canPrev}
            onClick={() => canPrev && setPage(p => p - 1)}
            className="px-3 py-2 text-xs rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
          >
            ← Anterior
          </button>
          <div className="text-xs text-gray-600">
            Página <b>{page}</b> de <b>{pages}</b> ({total} resultados)
          </div>
          <button
            disabled={!canNext}
            onClick={() => canNext && setPage(p => p + 1)}
            className="px-3 py-2 text-xs rounded-lg border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Modal de detalle */}
      <OpportunityModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        op={selected}
        tipos={tipos}
        onChangeEstado={handleChangeEstado}
        onUpdate={handleUpdate}
      />
    </div>
  );
}
