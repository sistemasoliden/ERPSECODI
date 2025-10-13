// src/pages/MisCitas.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { Pencil, Check, X } from "lucide-react";

/* ─────────────────── helpers UI/table ─────────────────── */
const tbl = {
  shell: "mx-2.5 shadow overflow-hidden bg-white mt-2",
  table: "w-full text-[9px] text-center text-gray-900 font-semibold",
  thead:
    "sticky top-0 bg-gray-800 text-white text-[10px] capitalize tracking-wide [&>tr]:h-11 [&>tr>th]:py-0 [&>tr>th]:font-extrabold",
  tbody:
    "divide-y-2 divide-gray-300 text-[9px] font-semibold text-gray-900 [&>tr]:h-9 [&>tr>td]:py-0 [&>tr>td]:align-middle",
  th: "px-4",
  td: "px-4",
  rowHover: "hover:bg-gray-50",
  skeleton: "h-2 w-24 mx-auto bg-gray-200 rounded animate-pulse",
  chip: "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
};

function ChipEstado({ estado }) {
  const map = {
    pendiente: "bg-amber-100 text-amber-800",
    completada: "bg-emerald-100 text-emerald-800",
    cancelada: "bg-rose-100 text-rose-800",
  };
  return (
    <span className={`${tbl.chip} ${map[estado] || "bg-gray-100 text-gray-600"}`}>
      {estado}
    </span>
  );
}

function fmtFechaHora(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd} - ${mm} - ${yy} ${hh}:${mi}`;
}

/* ─────────────────── debounce simple ─────────────────── */
function useDebouncedValue(value, delay = 450) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/* ─────────────────── componente ─────────────────── */
export default function MisCitas() {
  const { token } = useAuth();
  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  // data
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // filtros (estilo pedido)
  const [q, setQ] = useState(""); // buscar por RUC o Razón Social
  const [filtroTipo, setFiltroTipo] = useState(""); // tipo de cita
  const debouncedQ = useDebouncedValue(q, 450);
  const [tipos, setTipos] = useState([]); // lista de tipos para el select

  // edición inline
  const [editId, setEditId] = useState(null);
  const [editFecha, setEditFecha] = useState("");
  const [editHora, setEditHora] = useState("");

  // carga tipos (si existe endpoint /citas/tipos; si no, deriva de items)
  const loadTipos = async () => {
    try {
      const { data } = await api.get("/citas/tipos", authHeader);
      if (Array.isArray(data) && data.length) {
        setTipos(data); // e.g., ["virtual","presencial","llamada"]
        return;
      }
    } catch (e) {
      // ignorar y derivar luego
    }
    // fallback: derivar desde items actuales
    const uniques = Array.from(
      new Set((items || []).map((c) => (c.tipo || "").trim()).filter(Boolean))
    );
    setTipos(uniques);
  };

  // carga citas (respeta q/tipo)
  const load = async () => {
    setLoading(true);
    try {
      const params = {
        q: debouncedQ || undefined,
        tipo: filtroTipo || undefined,
      };
      const { data } = await api.get("/citas", { ...authHeader, params });
      const arr = Array.isArray(data.items) ? data.items : Array.isArray(data) ? data : [];
      setItems(arr);
      // si no hay endpoint de tipos, intenta derivarlos con la data fresca
      if (!tipos.length) {
        const uniques = Array.from(
          new Set(arr.map((c) => (c.tipo || "").trim()).filter(Boolean))
        );
        setTipos(uniques);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(); // primera carga
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    // recarga al cambiar filtros (debounced en q)
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, filtroTipo, token]);

  useEffect(() => {
    loadTipos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, token]);

  // acciones CRUD/estado
  const startEdit = (cita) => {
    setEditId(cita._id);
    const d = new Date(cita.inicio);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    setEditFecha(`${yyyy}-${mm}-${dd}`);
    setEditHora(`${hh}:${mi}`);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditFecha("");
    setEditHora("");
  };

  const saveEdit = async (cita) => {
    const inicio = new Date(`${editFecha}T${editHora}:00`);
    if (isNaN(inicio.getTime())) {
      alert("Fecha u hora inválida");
      return;
    }
    const dur =
      new Date(cita.fin).getTime() - new Date(cita.inicio).getTime();
    const fin = new Date(inicio.getTime() + Math.max(dur, 30 * 60 * 1000));
    await api.put(`/citas/${cita._id}`, { inicio, fin }, authHeader);
    cancelEdit();
    load();
  };

  const completar = async (id) => {
    await api.patch(`/citas/${id}/estado`, { estado: "completada" }, authHeader);
    load();
  };

  const volverPendiente = async (id) => {
    await api.patch(`/citas/${id}/estado`, { estado: "pendiente" }, authHeader);
    load();
  };

  const cancelar = async (id) => {
    if (!window.confirm("¿Cancelar la cita?")) return;
    await api.patch(`/citas/${id}/estado`, { estado: "cancelada" }, authHeader);
    load();
  };

  return (
    <div className="p-6 min-h-dvh bg-[#ebe8e8]">
      {/* Toolbar (mismo estilo) */}
      <div className="flex items-center gap-4 overflow-x-auto py-2 px-2 rounded-md">
        {/* Input con 'X' para limpiar solo texto + Enter para buscar */}
        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") load();
            }}
            placeholder="Buscar por RUC o Razón Social"
            className="w-64 md:w-80 border border-gray-300 rounded pl-3 pr-8 py-3 text-[12px] bg-white"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 text-sm"
              title="Limpiar texto"
            >
              ×
            </button>
          )}
        </div>

        {/* Select de Tipo de cita */}
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="w-56 border border-gray-300 rounded px-3 py-3 text-[12px] bg-white"
          title="Filtrar por tipo de cita"
        >
          <option value="">Todos los tipos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {String(t).toUpperCase()}
            </option>
          ))}
        </select>

        {/* Botón Buscar (con estado de carga) */}
        <button
          onClick={load}
          disabled={loading}
          className="px-5 py-4 bg-gray-800 text-white font-bold text-xs rounded disabled:opacity-60"
          title="Ejecutar búsqueda"
        >
          {loading ? "Buscando…" : "Buscar"}
        </button>

        {/* Botón Limpiar (desactivado si no hay filtros) */}
        <button
          onClick={() => {
            setQ("");
            setFiltroTipo("");
          }}
          disabled={!q && !filtroTipo}
          className="px-5 py-4 bg-gray-400 text-gray-800 text-xs font-bold rounded disabled:opacity-50"
          title="Restablecer filtros"
        >
          Limpiar
        </button>
      </div>

      {/* Tabla */}
      <div className={tbl.shell}>
        <div className="overflow-x-auto">
          <table className={tbl.table}>
            <thead className={tbl.thead}>
              <tr>
                <th className={tbl.th}>RUC</th>
                <th className={tbl.th}>Razón Social</th>
                <th className={tbl.th}>Fecha / Hora</th>
                <th className={tbl.th}>Tipo</th>
                <th className={tbl.th}>Nota</th>
                <th className={tbl.th}>Estado</th>
                <th className={tbl.th}>Acciones</th>
              </tr>
            </thead>

            <tbody className={tbl.tbody}>
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className={tbl.td}>
                        <div className={tbl.skeleton} />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading &&
                items.map((c) => {
                  const enEdicion = editId === c._id;
                  return (
                    <tr key={c._id} className={tbl.rowHover}>
                      <td className={`${tbl.td} whitespace-nowrap`}>{c.ruc || "—"}</td>
                      <td className={`${tbl.td}`}>
                        <div className="truncate max-w-[360px] mx-auto">
                          {c.razonSocial || "—"}
                        </div>
                      </td>

                      <td className={`${tbl.td} whitespace-nowrap`}>
                        {!enEdicion ? (
                          fmtFechaHora(c.inicio)
                        ) : (
                          <div className="flex items-center gap-1 justify-center">
                            <input
                              type="date"
                              value={editFecha}
                              onChange={(e) => setEditFecha(e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-[9px]"
                            />
                            <input
                              type="time"
                              value={editHora}
                              onChange={(e) => setEditHora(e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-[9px]"
                            />
                          </div>
                        )}
                      </td>

                     <td className={`${tbl.td} capitalize`}>
  {String(c.tipo || "—").trim()}
</td>

                      <td className={tbl.td}>
                        <div className="truncate max-w-[260px] mx-auto">
                          {c.notas || c.mensaje || "—"}
                        </div>
                      </td>

                      <td className={tbl.td}>
                        <ChipEstado estado={c.estado || "pendiente"} />
                      </td>

                      <td className={`${tbl.td} whitespace-nowrap`}>
                        {!enEdicion ? (
                          <div className="flex items-center justify-center gap-3 text-slate-700">
                            <button
                              title="Editar fecha/hora"
                              onClick={() => startEdit(c)}
                              className="hover:opacity-70"
                            >
                              <Pencil size={16} />
                            </button>

                            {c.estado === "completada" ? (
                              <button
                                title="Marcar como pendiente"
                                onClick={() => volverPendiente(c._id)}
                                className="hover:opacity-70"
                              >
                                <Check size={18} />
                              </button>
                            ) : (
                              <button
                                title="Marcar como completada"
                                onClick={() => completar(c._id)}
                                className="hover:opacity-70"
                              >
                                <Check size={18} />
                              </button>
                            )}

                            <button
                              title="Cancelar cita"
                              onClick={() => cancelar(c._id)}
                              className="hover:opacity-70"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-3">
                            <button
                              onClick={() => saveEdit(c)}
                              className="px-2 py-1 text-[10px] rounded border border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-2 py-1 text-[10px] rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

              {!loading && items.length === 0 && (
                <tr>
                  <td className={`${tbl.td} text-center text-gray-500`} colSpan={7}>
                    Sin citas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
