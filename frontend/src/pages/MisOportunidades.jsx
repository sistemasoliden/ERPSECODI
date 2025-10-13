// src/pages/MisOportunidades.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import OpportunityModal from "../components/OpportunityModal.jsx";

/* Debounce simple para el buscador */
function useDebouncedValue(value, delay = 450) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function MisOportunidades() {
  const { token } = useAuth();
  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  // tabla / filtros
  const [rows, setRows] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 450);

  // paginación
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // modal
  const [openModal, setOpenModal] = useState(false);
  const [selected, setSelected] = useState(null);

  /* Carga de etapas (para filtros y StagePath del modal) */
  const loadTipos = async () => {
    const res = await api.get("/oportunidades/tipos/all", authHeader);
    setTipos(res.data || []);
  };

  /* Carga de oportunidades */
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
      const items = res.data.items || [];
      const total = res.data.total || 0;
      const pages = res.data.pages || 1;
      setRows(items);
      setTotal(total);
      setPages(pages);
      return { items, total, pages };
    } finally {
      setLoading(false);
    }
  };

  /* efectos iniciales */
  useEffect(() => {
    loadTipos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedQ, filtroEstado, token]);

  const canPrev = page > 1;
  const canNext = page < pages;

  /* Cambiar etapa (StagePath del modal) */
// ⬇️ Reemplaza tu handleUpdate por este (usa PUT y desestructura items)
const handleUpdate = async (id, payload) => {
  await api.put(`/oportunidades/${id}`, payload, authHeader); // PUT (no PATCH)
  const { items } = await load();                             // <- desestructura

  if (selected?._id === id) {
    const updated = Array.isArray(items) ? items.find(r => r._id === id) : null;
    setSelected(updated ?? { ...selected, ...payload });
  }
};

// ⬇️ Reemplaza tu handleChangeEstado por este (misma idea)
const handleChangeEstado = async (id, estadoId) => {
  await api.patch(`/oportunidades/${id}/estado`, { estadoId }, authHeader);
  const { items } = await load(); // <- desestructura SIEMPRE

  if (selected?._id === id) {
    const updated = Array.isArray(items) ? items.find(r => r._id === id) : null;
    setSelected(updated ?? selected);
  }
};

  return (
    <div className="p-6 min-h-dvh bg-[#ebe8e8]">
      {/* Toolbar */}
      <div className="flex items-center gap-4 overflow-x-auto py-2 px-2 rounded-md">
        <input
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder="Buscar por RUC o Razón Social"
          className="w-64 md:w-80 border border-gray-300 rounded px-3 py-3 text-[12px] bg-white"
        />

        <select
          value={filtroEstado}
          onChange={(e) => {
            setPage(1);
            setFiltroEstado(e.target.value);
          }}
          className="w-56 border border-gray-300 rounded px-3 py-3 text-[12px] bg-white"
          title="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {tipos.map((t) => (
            <option key={t._id} value={t._id}>
              {t.nombre}
            </option>
          ))}
        </select>

        <button
          onClick={load}
          className="px-5 py-3.5 bg-gray-800 text-white font-bold text-xs rounded"
        >
          Buscar
        </button>

        <button
          onClick={() => {
            setQ("");
            setFiltroEstado("");
            setPage(1);
          }}
          className="px-5 py-3.5 bg-gray-300 text-gray-900 text-xs font-bold rounded"
        >
          Limpiar
        </button>
      </div>

      {/* Tabla */}
      <div className="mx-2.5 shadow overflow-hidden bg-white mt-2">
        <div className="overflow-x-auto">
          <table className="w-full text-[9px] text-center text-gray-900 font-semibold">
            <thead
              className="
                sticky top-0 bg-gray-800 text-white
                text-[10px] uppercase tracking-wide
                [&>tr]:h-11 [&>tr>th]:py-0
                [&>tr>th]:font-extrabold
              "
            >
              <tr>
                <th className="px-4">RUC</th>
                <th className="px-4">Razón Social</th>
                <th className="px-4">Cargo Fijo</th>
                <th className="px-4">Cantidad</th>
                <th className="px-4">Fecha de Gestión</th>
                <th className="px-4">Etapa</th>
              </tr>
            </thead>

            <tbody
              className="
                divide-y-2 divide-gray-300
                text-[9px] font-semibold text-gray-900
                [&>tr]:h-9 [&>tr>td]:py-0 [&>tr>td]:align-middle
              "
            >
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4">
                        <div className="h-2 w-24 mx-auto bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading &&
                rows.map((op) => (
                  <tr key={op._id} className="hover:bg-gray-50">
                    <td className="px-4 whitespace-nowrap">
                      <button
                        type="button"
                        className="text-indigo-900 font-semibold underline underline-offset-2 hover:text-indigo-900"
                        onClick={() => {
                          setSelected(op);
                          setOpenModal(true);
                        }}
                        title="Ver/editar"
                      >
                        {op.ruc}
                      </button>
                    </td>

                    <td className="px-4">
                      <div className="truncate max-w-[380px] mx-auto">
                        {op.razonSocial || op?.base?.razonSocial || "—"}
                      </div>
                    </td>

                    <td className="px-4 whitespace-nowrap">
                      {Number(op.monto || 0).toLocaleString("es-PE")}
                    </td>

                    <td className="px-4 whitespace-nowrap">{op.cantidad ?? "—"}</td>

                    <td className="px-4 whitespace-nowrap">
                      {op.createdAt
                        ? (() => {
                            const d = new Date(op.createdAt);
                            const dd = String(d.getDate()).padStart(2, "0");
                            const mm = String(d.getMonth() + 1).padStart(2, "0");
                            const yy = d.getFullYear();
                            return `${dd} - ${mm} - ${yy}`;
                          })()
                        : "—"}
                    </td>

                    <td className="px-4">
                      <span className="inline-flex items-center px-2 py-0.5 text-gray-700">
                        {op.estadoNombre}
                      </span>
                    </td>
                  </tr>
                ))}

              {!loading && !rows.length && (
                <tr>
                  <td className="px-4 text-center text-gray-500" colSpan={6}>
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            disabled={!canPrev}
            onClick={() => canPrev && setPage((p) => p - 1)}
            className="px-3 py-2 text-xs rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
          >
            ← Anterior
          </button>
          <div className="text-xs text-gray-600">
            Página <b>{page}</b> de <b>{pages}</b> ({total} resultados)
          </div>
          <button
            disabled={!canNext}
            onClick={() => canNext && setPage((p) => p + 1)}
            className="px-3 py-2 text-xs rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Modal */}
      <OpportunityModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        op={selected}
        tipos={tipos}
        onChangeEstado={handleChangeEstado}
        onUpdate={handleUpdate} // ← usa PUT en el padre
      />
    </div>
  );
}
