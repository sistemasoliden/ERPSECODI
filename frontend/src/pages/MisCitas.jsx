import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { Pencil, Check, X } from "lucide-react";
import * as XLSX from "xlsx";
import ReportRangeFilters from "../components/reporteria/ReportFilters";

/* ─────────────────── helpers UI/table ─────────────────── */
const tbl = {
  shell: "mx-2.5 shadow overflow-hidden bg-white mt-2",
  table: "w-full text-[11px] text-center text-gray-900 font-semibold",
  thead:
    "sticky top-0 bg-gray-800 text-white text-[11px] capitalize tracking-wide [&>tr]:h-11 [&>tr>th]:py-0 [&>tr>th]:font-extrabold",
  tbody:
    "divide-y-2 divide-gray-300 text-[11px] font-semibold text-gray-900 [&>tr]:h-9 [&>tr>td]:py-0 [&>tr>td]:align-middle",
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
    <span
      className={`${tbl.chip} ${map[estado] || "bg-gray-100 text-gray-600"}`}
    >
      {estado}
    </span>
  );
}

/* Fecha y hora separadas */
function fmtFecha(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd} - ${mm} - ${yy}`;
}
function fmtHora(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mi}`;
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

/* helpers export */
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

/* ─────────────────── componente ─────────────────── */
export default function MisCitas() {
  const { token, user } = useAuth();
  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  // data
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // filtros
  const [q, setQ] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const debouncedQ = useDebouncedValue(q, 450);
  const [tipos, setTipos] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // edición inline
  const [editId, setEditId] = useState(null);
  const [editFecha, setEditFecha] = useState("");
  const [editHora, setEditHora] = useState("");

  // Capitaliza cada palabra (soporta espacios/guiones/underscores)
  const toCap = (s) =>
    String(s)
      .split(/[\s_-]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");

  // carga tipos
  const loadTipos = async () => {
    try {
      const { data } = await api.get("/citas/tipos", authHeader);
      if (Array.isArray(data) && data.length) {
        setTipos(data);
        return;
      }
    } catch {
      /* ignorar */
    }
    const uniques = Array.from(
      new Set((items || []).map((c) => (c.tipo || "").trim()).filter(Boolean))
    );
    setTipos(uniques);
  };

  // carga citas
  const load = async () => {
    setLoading(true);
    try {
      const params = {
        q: debouncedQ || undefined,
        tipo: filtroTipo || undefined,
        from: from || undefined,
        to: to || undefined,
      };
      const { data } = await api.get("/citas", { ...authHeader, params });
      const arr = Array.isArray(data.items)
        ? data.items
        : Array.isArray(data)
        ? data
        : [];
      setItems(arr);
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
    load();
  }, [token]);

  useEffect(() => {
    load();
  }, [debouncedQ, filtroTipo, from, to, token]);

  useEffect(() => {
    loadTipos();
  }, [items, token]);

  // edición
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
    const dur = new Date(cita.fin).getTime() - new Date(cita.inicio).getTime();
    const fin = new Date(inicio.getTime() + Math.max(dur, 30 * 60 * 1000));
    await api.put(`/citas/${cita._id}`, { inicio, fin }, authHeader);
    cancelEdit();
    load();
  };
  const completar = async (id) => {
    await api.patch(
      `/citas/${id}/estado`,
      { estado: "completada" },
      authHeader
    );
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

  /* ===== Exportar todo ===== */
  const userLabel =
    sanitizeUserLabel(
      user?.name ||
        user?.displayName ||
        user?.username ||
        (user?.email || "").split("@")[0]
    ) || "usuario";

  const mapItemsForExport = (arr) =>
    (arr || []).map((c) => {
      const dIni = c?.inicio ? new Date(c.inicio) : null;
      const dFin = c?.fin ? new Date(c.fin) : null;
      const fecha = dIni
        ? `${String(dIni.getDate()).padStart(2, "0")}-${String(
            dIni.getMonth() + 1
          ).padStart(2, "0")}-${dIni.getFullYear()}`
        : "";
      const horaIni = dIni
        ? `${String(dIni.getHours()).padStart(2, "0")}:${String(
            dIni.getMinutes()
          ).padStart(2, "0")}`
        : "";
      const horaFin = dFin
        ? `${String(dFin.getHours()).padStart(2, "0")}:${String(
            dFin.getMinutes()
          ).padStart(2, "0")}`
        : "";
      return {
        RUC: c?.ruc || "",
        "Razón Social": c?.razonSocial || "",
        Título: c?.titulo || "",
        Tipo: c?.tipo || "",
        Estado: c?.estado || "pendiente",
        Fecha: fecha,
        "Hora Inicio": horaIni,
        "Hora Fin": horaFin,
        Dirección: c?.direccion || c?.lugar || "",
        Nota: c?.notas || c?.mensaje || "",
      };
    });

  const exportAllXLSX = async () => {
    try {
      const params = {
        q: debouncedQ || undefined,
        tipo: filtroTipo || undefined,
        from: from || undefined,
        to: to || undefined,
      };
      const { data } = await api.get("/citas", { ...authHeader, params });
      const arr = Array.isArray(data.items)
        ? data.items
        : Array.isArray(data)
        ? data
        : [];
      if (!arr.length) {
        alert("No hay citas para exportar con el filtro actual.");
        return;
      }
      const rows = mapItemsForExport(arr);
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      const cols = Object.keys(rows[0] || {});
      ws["!cols"] = cols.map((k) => ({ wch: Math.max(k.length + 2, 16) }));
      XLSX.utils.book_append_sheet(wb, ws, "Citas");
      const fname = `citas_${getDateStamp()}_${userLabel}.xlsx`;
      XLSX.writeFile(wb, fname);
    } catch (e) {
      console.error("Export citas error", e);
      alert("No se pudo exportar.");
    }
  };

  return (
    <div className="p-6 min-h-dvh bg-[#F2F0F0]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4 overflow-x-auto py-2 px-2 rounded-md">
        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") load();
            }}
            placeholder="Buscar por RUC o Razón Social"
            className="w-64 md:w-80 border border-gray-900 rounded pl-3 pr-8 py-3 text-[12px] bg-white"
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

        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="w-42 border border-gray-900 rounded px-3 py-3 text-[12px] bg-white"
          title="Filtrar por tipo de cita"
        >
          <option value="">Todos los tipos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {toCap(t)}
            </option>
          ))}
        </select>

        <ReportRangeFilters
          from={from}
          to={to}
          minYear={2020}
          maxYear={2030}
          onChange={({ from: f, to: t }) => {
            setFrom(f || "");
            setTo(t || "");
          }}
        />

        <button
          onClick={load}
          disabled={loading}
          className="px-7 py-4 bg-gray-800 border border-gray-900 text-white font-bold text-xs rounded disabled:opacity-60"
        >
          {loading ? "Buscando…" : "Buscar"}
        </button>

        <button
          onClick={() => {
            setQ("");
            setFiltroTipo("");
            setFrom("");
            setTo("");
          }}
          disabled={!q && !filtroTipo && !from && !to}
          className="px-7 py-4 bg-gray-400 border border-gray-900  text-black text-xs font-bold rounded disabled:opacity-50"
        >
          Limpiar
        </button>

        <button
          onClick={exportAllXLSX}
          disabled={loading}
          className="ml-auto px-7 py-4 bg-indigo-600 text-white text-xs font-bold rounded disabled:opacity-60"
        >
          Exportar Citas
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
                <th className={tbl.th}>Fecha</th>
                <th className={tbl.th}>Hora</th>
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
                    {Array.from({ length: 8 }).map((__, j) => (
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
                      <td className={`${tbl.td} whitespace-nowrap`}>
                        {c.ruc || "—"}
                      </td>

                      <td className={tbl.td}>
                        <div className="truncate max-w-[360px] mx-auto">
                          {c.razonSocial || "—"}
                        </div>
                      </td>

                      {/* Fecha */}
                      <td className={`${tbl.td} whitespace-nowrap`}>
                        {!enEdicion ? (
                          fmtFecha(c.inicio)
                        ) : (
                          <input
                            type="date"
                            value={editFecha}
                            onChange={(e) => setEditFecha(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-[11px]"
                          />
                        )}
                      </td>

                      {/* Hora */}
                      <td className={`${tbl.td} whitespace-nowrap`}>
                        {!enEdicion ? (
                          fmtHora(c.inicio)
                        ) : (
                          <input
                            type="time"
                            value={editHora}
                            onChange={(e) => setEditHora(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-[11px]"
                          />
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
                              className="px-2 py-1 text-[11px] rounded border border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-2 py-1 text-[11px] rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
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
                  <td
                    className={`${tbl.td} text-center text-gray-500`}
                    colSpan={8}
                  >
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
