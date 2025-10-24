// src/pages/MisOportunidades.jsx
import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import OpportunityModal from "../components/OpportunityModal.jsx";
import ReportRangeFilters from "../components/reporteria/ReportFilters";

/* Debounce simple para el buscador */
function useDebouncedValue(value, delay = 450) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/* Helpers de fecha y nombre de archivo */
function getDateStamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const HH = String(now.getHours()).padStart(2, "0");
  const MM = String(now.getMinutes()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${HH}${MM}`;
}
function sanitizeUserLabel(raw) {
  return String(raw || "usuario")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export default function MisOportunidades() {
  const { token, user } = useAuth();
  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  // filtros tabla
  const [rows, setRows] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 450);

  // rango de fechas (como en Reportes)
  const [from, setFrom] = useState(""); // yyyy-mm-dd
  const [to, setTo] = useState(""); // yyyy-mm-dd

  // paginación
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // export state (para deshabilitar botones)
  const [exporting, setExporting] = useState(false);

  // modal
  const [openModal, setOpenModal] = useState(false);
  const [selected, setSelected] = useState(null);

  /* Carga de etapas */
  const loadTipos = async () => {
    const res = await api.get("/oportunidades/tipos/all", authHeader);
    setTipos(res.data || []);
  };

  /* Carga de oportunidades (respeta filtros y rango) */
  const load = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        q: debouncedQ || undefined,
        estadoId: filtroEstado || undefined,
        from: from || undefined,
        to: to || undefined,
      };
      const res = await api.get("/oportunidades", { ...authHeader, params });
      const items = res.data?.items || [];
      const t = res.data?.total || 0;
      const pgs = res.data?.pages || 1;
      setRows(items);
      setTotal(t);
      setPages(pgs);
      return { items, total: t, pages: pgs };
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
  }, [page, debouncedQ, filtroEstado, from, to, token]);

  const canPrev = page > 1;
  const canNext = page < pages;

  /* Actualización en modal */
  const handleUpdate = async (id, payload) => {
    await api.put(`/oportunidades/${id}`, payload, authHeader);
    const { items } = await load();
    if (selected?._id === id) {
      const updated = Array.isArray(items)
        ? items.find((r) => r._id === id)
        : null;
      setSelected(updated ?? { ...selected, ...payload });
    }
  };

  const handleChangeEstado = async (id, estadoId) => {
    await api.patch(`/oportunidades/${id}/estado`, { estadoId }, authHeader);
    const { items } = await load();
    if (selected?._id === id) {
      const updated = Array.isArray(items)
        ? items.find((r) => r._id === id)
        : null;
      setSelected(updated ?? selected);
    }
  };

  /* ===== Exportación a Excel ===== */
  const userLabel =
    sanitizeUserLabel(
      user?.name ||
        user?.displayName ||
        user?.username ||
        (user?.email || "").split("@")[0]
    ) || "usuario";

  const mapItemsForExport = (items) => {
    // Mapea a columnas legibles (ajusta/añade si lo necesitas)
    return (items || []).map((op) => {
      const d = op?.createdAt ? new Date(op.createdAt) : null;
      const fecha = d
        ? `${String(d.getDate()).padStart(2, "0")}-${String(
            d.getMonth() + 1
          ).padStart(2, "0")}-${d.getFullYear()}`
        : "";
      return {
        RUC: op?.ruc || "",
        "Razón Social": op?.razonSocial || op?.base?.razonSocial || "",
        Estado: op?.estadoNombre || "",
        "Cargo Fijo (S/.)": Number(op?.monto || 0),
        Cantidad: Number(op?.cantidad ?? 0),
        "Fecha de Gestión": fecha,
      };
    });
  };

  const exportXLSX = (dataArray, filename) => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dataArray);
    // Auto ancho simple
    const cols = Object.keys(dataArray[0] || {});
    ws["!cols"] = cols.map((k) => ({ wch: Math.max(k.length + 2, 16) }));
    XLSX.utils.book_append_sheet(wb, ws, "Oportunidades");
    XLSX.writeFile(wb, filename);
  };

  // Exporta SOLO la página visible

  // Exporta TODO (con filtros y rango). Vamos paginando hasta traer todo.
  const exportAllXLSX = async () => {
    setExporting(true);
    try {
      const all = [];
      let p = 1;
      // recorremos páginas con mismos filtros
      while (true) {
        const params = {
          page: p,
          limit: 200, // subimos el límite para acelerar la exportación
          q: debouncedQ || undefined,
          estadoId: filtroEstado || undefined,
          from: from || undefined,
          to: to || undefined,
        };
        const res = await api.get("/oportunidades", { ...authHeader, params });
        const items = res.data?.items || [];
        all.push(...items);
        const totalPages = res.data?.pages || 1;
        if (p >= totalPages) break;
        p += 1;
      }

      if (!all.length) {
        alert("No hay datos para exportar con el filtro actual.");
        return;
      }

      const data = mapItemsForExport(all);
      const filename = `oportunidades_${getDateStamp()}_${userLabel}.xlsx`;
      exportXLSX(data, filename);
    } catch (e) {
      console.error("Export All error", e);
      alert("No se pudo exportar.");
    } finally {
      setExporting(false);
    }
  };

  const onRangeChange = ({ from: f, to: t }) => {
    // mismo manejo que en reportería
    setFrom(f || "");
    setTo(t || "");
    setPage(1);
  };

  return (
    <div className="p-6 min-h-dvh bg-[#F2F0F0]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 overflow-x-auto py-2 px-2 rounded-md">
        <input
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder="Buscar por RUC o Razón Social"
          className="w-64 md:w-80 border border-gray-900 rounded px-3 py-3 text-[12px] bg-white"
        />

        <select
          value={filtroEstado}
          onChange={(e) => {
            setPage(1);
            setFiltroEstado(e.target.value);
          }}
          className="w-56 border border-gray-900 rounded px-3 py-3 text-[12px] bg-white"
          title="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {tipos.map((t) => (
            <option key={t._id} value={t._id}>
              {t.nombre}
            </option>
          ))}
        </select>

        {/* Rango de fechas (mismo componente que en reportería) */}
        <ReportRangeFilters
          from={from}
          to={to}
          minYear={2020}
          maxYear={2030}
          onChange={onRangeChange}
        />

        <button
          onClick={load}
          className="px-7 py-3.5 bg-gray-800 border border-gray-900 text-white font-bold text-xs rounded"
        >
          Buscar
        </button>

        <button
          onClick={() => {
            setQ("");
            setFiltroEstado("");
            setFrom("");
            setTo("");
            setPage(1);
          }}
          className="px-7 py-3.5 bg-gray-300 border border-gray-900 text-gray-900 text-xs font-bold rounded"
        >
          Limpiar
        </button>

        {/* Exportar */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={exportAllXLSX}
            disabled={loading || exporting}
            className="px-4 py-3.5 bg-indigo-600 border border-indigo-600 text-white text-xs font-bold rounded disabled:opacity-60"
            title="Exportar todo con filtros"
          >
            {exporting ? "Exportando…" : "Exportar Oportunidades "}
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="mx-2.5 shadow overflow-hidden bg-white mt-2">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] text-center text-gray-900 font-semibold">
            <thead
              className="
                sticky top-0 bg-gray-800 text-white
                text-[11px] uppercase tracking-wide
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
                text-[11px] font-semibold text-gray-900
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

                    <td className="px-4 whitespace-nowrap">
                      {op.cantidad ?? "—"}
                    </td>

                    <td className="px-4 whitespace-nowrap">
                      {op.createdAt
                        ? (() => {
                            const d = new Date(op.createdAt);
                            const dd = String(d.getDate()).padStart(2, "0");
                            const mm = String(d.getMonth() + 1).padStart(
                              2,
                              "0"
                            );
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
        onUpdate={handleUpdate}
      />
    </div>
  );
}
