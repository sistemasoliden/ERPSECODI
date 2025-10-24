// src/pages/MisTipificaciones.jsx
import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import ReportRangeFilters from "../components/reporteria/ReportFilters";

/* Debounce simple */
function useDebouncedValue(value, delay = 450) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/* Helpers fecha */
function fmtDateYMD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function fmtDMY(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd} - ${mm} - ${yyyy}`;
}
const sanitize = (str = "") => String(str ?? "");

/* Title Case robusto (mejor que 'capitalize' de CSS)
   - Maneja textos en MAYÚSCULAS: "CONTACTO EXITOSO" -> "Contacto Exitoso"
   - Mantiene acrónimos comunes en mayúscula (S.A.C., SAC, S.R.L., RUC, DNI, etc.)
   - Respeta preposiciones comunes en minúscula salvo si son la primera palabra. */
const ACRONYMS = new Set([
  "SAC","S.A.C.","SRL","S.R.L.","SA","S.A.","EIRL","E.I.R.L.",
  "RUC","DNI","N°","Nº","CEO","TI","IT","GPS","VOIP","IP","LTE","5G"
]);
const SMALL_WORDS = new Set(["de","del","la","las","el","los","y","o","u","con","en","por","para","a"]);
function toTitleCase(raw = "") {
  if (!raw) return "";
  const s = String(raw).trim();
  // si contiene puntos y es acrónimo típico, respeta mayúsculas
  if (ACRONYMS.has(s.toUpperCase())) return s.toUpperCase();

  // divide por espacios, preservando separadores múltiples
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => {
      const upper = w.toUpperCase();
      if (ACRONYMS.has(upper)) return upper;
      if (i > 0 && SMALL_WORDS.has(w)) return w; // minúsculas intermedias
      // capitaliza primera letra (incluye tildes)
      return w.charAt(0).toLocaleUpperCase("es-PE") + w.slice(1);
    })
    .join(" ");
}

/* ===== Página ===== */
export default function MisTipificaciones() {
  const { token } = useAuth();
  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 450);
  const [from, setFrom] = useState(""); // yyyy-mm-dd
  const [to, setTo] = useState("");     // yyyy-mm-dd

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const canPrev = page > 1;
  const canNext = page < pages;

  const load = async () => {
    setLoading(true);
    try {
      const params = {
        userId: "me",
        page,
        limit,
        q: debouncedQ || undefined,
        from: from || undefined,
        to: to || undefined,
      };
      const res = await api.get("/assignments/tipificaciones", { ...authHeader, params });
      const items = (res.data?.items || []).map((r) => ({
        ...r,
        // formateo visual aquí:
        tipificacion: toTitleCase(r.tipificacion),
        subtipificacion: toTitleCase(r.subtipificacion),
      }));
      setRows(items);
      setTotal(res.data?.total || 0);
      setPages(res.data?.pages || 1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedQ, from, to, token]);

  const onRangeChange = ({ from: f, to: t }) => {
    setFrom(f || "");
    setTo(t || "");
    setPage(1);
  };

  /* ===== Exportación XLSX ===== */
  const mapForExport = (items) => {
    return (items || []).map((r) => {
      const d = r?.tipifiedAt ? new Date(r.tipifiedAt) : null;
      return {
        RUC: sanitize(r.ruc),
        "Razón Social": sanitize(r.razonSocial),
        Tipificación: toTitleCase(r.tipificacion),
        Subtipificación: toTitleCase(r.subtipificacion),
        Nota: sanitize(r.note),
        "Fecha de Tipificación": d ? fmtDMY(d) : "",
      };
    });
  };

  const exportAll = async () => {
    setLoading(true);
    try {
      const all = [];
      let p = 1;
      while (true) {
        const params = {
          userId: "me",
          page: p,
          limit: 200,
          q: debouncedQ || undefined,
          from: from || undefined,
          to: to || undefined,
        };
        const res = await api.get("/assignments/tipificaciones", { ...authHeader, params });
        const items = (res.data?.items || []).map((r) => ({
          ...r,
          tipificacion: toTitleCase(r.tipificacion),
          subtipificacion: toTitleCase(r.subtipificacion),
        }));
        all.push(...items);
        const totalPages = res.data?.pages || 1;
        if (p >= totalPages) break;
        p += 1;
      }
      if (!all.length) {
        alert("No hay registros para exportar.");
        return;
      }
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(mapForExport(all));

      // auto-ancho
      const range = XLSX.utils.decode_range(ws["!ref"]);
      const cols = [];
      for (let C = range.s.c; C <= range.e.c; ++C) {
        let max = 10;
        for (let R = range.s.r; R <= range.e.r; ++R) {
          const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
          const v = cell ? String(cell.v ?? "") : "";
          max = Math.max(max, Math.min(60, v.length + 2));
        }
        cols.push({ wch: max });
      }
      ws["!cols"] = cols;

      XLSX.utils.book_append_sheet(wb, ws, "Tipificaciones");
      const fname = `tipificaciones_${fmtDateYMD(new Date())}.xlsx`;
      XLSX.writeFile(wb, fname);
    } catch (e) {
      console.error("Export tipificaciones error", e);
      alert("No se pudo exportar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 min-h-dvh bg-[#F2F0F0]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 overflow-x-auto py-2 px-2 rounded-md">
        <input
          value={q}
          onChange={(e) => { setPage(1); setQ(e.target.value); }}
          placeholder="Buscar por RUC o Razón Social"
          className="w-64 md:w-80 border border-gray-900 rounded px-3 py-3 text-[12px] bg-white"
        />

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
          onClick={() => { setQ(""); setFrom(""); setTo(""); setPage(1); }}
          className="px-7 py-3.5 bg-gray-300 border border-gray-900 text-gray-900 text-xs font-bold rounded"
        >
          Limpiar
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={exportAll}
            disabled={loading}
            className="px-4 py-3.5 bg-indigo-600 border border-indigo-600 text-white text-xs font-bold rounded disabled:opacity-60"
          >
            Exportar Tipificaciones
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="mx-2.5 shadow overflow-hidden bg-white mt-2">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] text-center text-gray-900 font-semibold">
            <thead className="sticky top-0 bg-gray-800 text-white text-[11px] uppercase tracking-wide [&>tr]:h-11 [&>tr>th]:py-0 [&>tr>th]:font-extrabold">
              <tr>
                <th className="px-4">RUC</th>
                <th className="px-4">Razón Social</th>
                <th className="px-4">Tipificación</th>
                <th className="px-4">Subtipificación</th>
                <th className="px-4">Nota</th>
                <th className="px-4">Fecha de Tipificación</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-gray-300 text-[11px] font-semibold text-gray-900 [&>tr]:h-9 [&>tr>td]:py-0 [&>tr>td]:align-middle">
              {loading && Array.from({ length: 8 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4">
                      <div className="h-2 w-24 mx-auto bg-gray-200 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}

              {!loading && rows.map((r) => (
                <tr key={r._id} className="hover:bg-gray-50">
                  <td className="px-4 whitespace-nowrap">{r.ruc || "—"}</td>
                  <td className="px-4">
                    <div className="truncate max-w-[380px] mx-auto">{r.razonSocial || "—"}</div>
                  </td>
                  <td className="px-4 whitespace-nowrap">{r.tipificacion || "—"}</td>
                  <td className="px-4 whitespace-nowrap">{r.subtipificacion || "—"}</td>
                  <td className="px-4">
                    <div className="truncate max-w-[380px] mx-auto" title={r.note || ""}>
                      {r.note || "—"}
                    </div>
                  </td>
                  <td className="px-4 whitespace-nowrap">
                    {r.tipifiedAt ? fmtDMY(new Date(r.tipifiedAt)) : "—"}
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
    </div>
  );
}
