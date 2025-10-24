// src/pages/MisTipificacionesSupervisor.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import ReportRangeFilters from "../components/reporteria/ReportFilters";
import ExecMultiSelect from "../components/reporteria/ExecMultiSelect";
import qs from "qs";

/* ===== Roles helpers (mapea tu catálogo) ===== */
const ROLES_IDS = {
  sistemas: "68a4f22d27e6abe98157a82c",
  gerencia: "68a4f22d27e6abe98157a82f",
  comercial: "68a4f22d27e6abe98157a831",
  supervisorcomercial: "68a4f22d27e6abe98157a832",
  backoffice: "68a4f22d27e6abe98157a830",
};
function getNormalizedRoleId(user) {
  if (!user) return "";
  const r = user.role;
  if (typeof r === "string") return r;
  if (r && typeof r === "object") {
    if (r._id) return String(r._id);
    if (r.id) return String(r.id);
    if (r.value) return String(r.value);
    const label = String(r.slug || r.nombre || r.name || "").trim().toLowerCase();
    const map = {
      sistemas: ROLES_IDS.sistemas,
      gerencia: ROLES_IDS.gerencia,
      comercial: ROLES_IDS.comercial,
      "supervisor comercial": ROLES_IDS.supervisorcomercial,
      supervisorcomercial: ROLES_IDS.supervisorcomercial,
      backoffice: ROLES_IDS.backoffice,
    };
    return map[label] || label;
  }
  return "";
}

/* Debounce */
function useDebouncedValue(value, delay = 450) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/* Helpers fecha / texto */
const fmtDMY = (d) =>
  `${String(d.getDate()).padStart(2, "0")} - ${String(d.getMonth() + 1).padStart(2, "0")} - ${d.getFullYear()}`;
const fmtDateYMD = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const toTitle = (s = "") =>
  String(s || "")
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => {
      const small = new Set(["de", "del", "la", "las", "el", "los", "y", "o", "u", "con", "en", "por", "para", "a"]);
      if (i > 0 && small.has(w)) return w;
      return w.charAt(0).toLocaleUpperCase("es-PE") + w.slice(1);
    })
    .join(" ");

export default function MisTipificacionesSupervisor() {
  const { token, user } = useAuth();
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const userRoleId = getNormalizedRoleId(user);
  const isSistemas = userRoleId === ROLES_IDS.sistemas;

  // filtros
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 450);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // equipo
  const [members, setMembers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]); // array<string>

  // tabla
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const abortRef = useRef(null);
  const reqIdRef = useRef(0);

  /* ===== cargar miembros (por ejecutivo) =====
     Para miembros usamos el endpoint correcto de TIPIFICACIÓN.
     Si es Sistemas, pedimos includeAllTeams=1 (verá todos). */
  const loadMembers = async () => {
    const { data } = await api.get("/reportes/tipificacion/por-ejecutivo", {
    ...authHeader,
    params: isSistemas ? { includeAllTeams: 1 } : {},
  });

    const mem = Array.isArray(data?.members)
      ? data.members
      : (Array.isArray(data?.items) ? data.items : [])
          .filter((i) => i.ejecutivoId)
          .map((i) => ({ _id: i.ejecutivoId, name: i.ejecutivo }));

    setMembers(mem);

    // Selección por defecto:
    // - Sistemas: sin selección → backend hará allowAll con includeAllTeams=1
    // - Supervisor: seleccionar todos
    if (isSistemas) {
      setSelectedIds([]);
    } else if (mem?.length) {
      setSelectedIds(mem.map((m) => String(m._id)));
    }
  };

  /* ===== cargar tabla ===== */
  const load = async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const myReq = ++reqIdRef.current;

    setLoading(!hasLoadedOnce);

    try {
      // Base params
      const baseParams = {
        page,
        limit,
        q: debouncedQ || undefined,
        from: from || undefined,
        to: to || undefined,
...(isSistemas && selectedIds.length === 0 ? { includeAllTeams: 1 } : {}),
      };

      // Selección:
      // - Si hay selectedIds → filtra por esos IDs
      // - Si NO hay selectedIds:
      //     - Sistemas: no mandamos userIds (global con includeAllTeams)
      //     - No Sistemas: forzamos noFallback para no caer en token user
      const selectionParams =
        selectedIds?.length > 0
          ? { userIds: selectedIds }
          : isSistemas
          ? {}
          : { noFallback: 1, userIds: [] };

      const params = { ...baseParams, ...selectionParams };

      // Logs útiles (puedes quitarlos luego)
      console.log("[MisTipificacionesSupervisor.load] params =", params);

      const res = await api.get("/assignments/tipificaciones/supervisor", {
        ...authHeader,
        signal: abortRef.current.signal,
        params,
        paramsSerializer: (p) => qs.stringify(p, { arrayFormat: "brackets" }),
      });

      if (myReq !== reqIdRef.current) return;

      const items = (res.data?.items || []).map((r) => ({
        ...r,
        tipificacion: toTitle(r.tipificacion),
        subtipificacion: toTitle(r.subtipificacion),
      }));

      setRows(items);
      setTotal(res.data?.total || 0);
      setPages(res.data?.pages || 1);
      setHasLoadedOnce(true);
    } catch (e) {
      if (e.name !== "CanceledError" && e.name !== "AbortError") {
        console.error("load sup tips error", e);
      }
    } finally {
      if (myReq === reqIdRef.current) setLoading(false);
    }
  };

  // bootstrap
  useEffect(() => {
    setLoading(true);
    (async () => {
      await loadMembers();
    })();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isSistemas]);

  // recarga por filtros/selección
  useEffect(() => {
    // Para no-sistemas, espera a tener members para evitar consulta vacía
    if (!isSistemas && !members.length) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedQ, from, to, token, isSistemas, selectedIds.join(","), members.length]);

  const onRangeChange = ({ from: f, to: t }) => {
    setFrom(f || "");
    setTo(t || "");
    setPage(1);
  };

  /* ===== Export ===== */
  const mapForExport = (items = []) =>
    items.map((r) => ({
      RUC: r.ruc || "",
      "Razón Social": r.razonSocial || "",
      Ejecutivo: r.ownerName || r.ownerEmail || "",
      Tipificación: toTitle(r.tipificacion || ""),
      Subtipificación: toTitle(r.subtipificacion || ""),
      Nota: r.note || "",
      "Fecha de Tipificación": r.tipifiedAt ? fmtDMY(new Date(r.tipifiedAt)) : "",
    }));

  const exportAll = async () => {
    try {
      const all = [];
      let p = 1;

      // Reusar misma política de params que load()
      const baseParams = {
        q: debouncedQ || undefined,
        from: from || undefined,
        to: to || undefined,
...(isSistemas && selectedIds.length === 0 ? { includeAllTeams: 1 } : {}),      };
      const selectionParams =
        selectedIds?.length > 0
          ? { userIds: selectedIds }
          : isSistemas
          ? {}
          : { noFallback: 1, userIds: [] };

      while (true) {
        const params = { ...baseParams, ...selectionParams, page: p, limit: 300 };
        const res = await api.get("/assignments/tipificaciones/supervisor", {
          ...authHeader,
          params,
          paramsSerializer: (prm) => qs.stringify(prm, { arrayFormat: "brackets" }),
        });
        const pageItems = (res.data?.items || []).map((r) => ({
          ...r,
          tipificacion: toTitle(r.tipificacion),
          subtipificacion: toTitle(r.subtipificacion),
        }));
        all.push(...pageItems);
        const totalPages = res.data?.pages || 1;
        if (p >= totalPages) break;
        p += 1;
      }

      if (!all.length) {
        alert("No hay datos para exportar.");
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

      XLSX.utils.book_append_sheet(wb, ws, "Tipificaciones Equipo");
      XLSX.writeFile(wb, `tipificaciones_equipo_${fmtDateYMD(new Date())}.xlsx`);
    } catch (e) {
      console.error("Export supervisor tips error", e);
      alert("No se pudo exportar.");
    }
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

        <ReportRangeFilters
          from={from}
          to={to}
          minYear={2020}
          maxYear={2030}
          onChange={onRangeChange}
        />

       <ExecMultiSelect
  members={members}
  value={selectedIds}
placeholder={isSistemas && !selectedIds.length ? "Sin selección (global)" : "Filtrar ejecutivos…"}
onChange={(ids) => { setSelectedIds(ids.map(String)); setPage(1); }}
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
            setFrom("");
            setTo("");
            setSelectedIds(isSistemas ? [] : members.map((m) => String(m._id)));
            setPage(1);
          }}
          className="px-7 py-3.5 bg-gray-300 border border-gray-900 text-gray-900 text-xs font-bold rounded"
        >
          Limpiar
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={exportAll}
            disabled={loading}
            className="px-4 py-3.5 bg-indigo-600 border border-indigo-600 text-white text-xs font-bold rounded disabled:opacity-60"
            title="Exportar todo con filtros y selección"
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
                <th className="px-4">Ejecutivo</th>
                <th className="px-4">Tipificación</th>
                <th className="px-4">Subtipificación</th>
                <th className="px-4">Nota</th>
                <th className="px-4">Fecha de Tipificación</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-gray-300 text-[11px] font-semibold text-gray-900 [&>tr]:h-9 [&>tr>td]:py-0 [&>tr>td]:align-middle">
              {loading &&
                !hasLoadedOnce &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4">
                        <div className="h-2 w-24 mx-auto bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}

              {(!loading || hasLoadedOnce) &&
                rows.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50">
                    <td className="px-4 whitespace-nowrap">{r.ruc || "—"}</td>
                    <td className="px-4">
                      <div className="truncate max-w-[380px] mx-auto">{r.razonSocial || "—"}</div>
                    </td>
                    <td className="px-4 whitespace-nowrap">
                      {r.ownerName || r.ownerEmail || "—"}
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

              {!loading && hasLoadedOnce && !rows.length && (
                <tr>
                  <td className="px-4 text-center text-gray-500" colSpan={7}>
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
        <nav
          className="mt-3 flex items-center justify-center gap-2 px-3 py-2 text-[11px] text-gray-700"
          aria-label="Paginación"
        >
          <div className="flex items-center gap-1 rounded-xl border border-gray-300 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => page > 1 && setPage(1)}
              disabled={page <= 1}
              className="px-3 py-2 rounded-l-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              title="Ir a la primera página"
            >
              «
            </button>
            <button
              type="button"
              onClick={() => page > 1 && setPage((p) => p - 1)}
              disabled={page <= 1}
              className="px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors border-l border-gray-200"
              title="Página anterior"
            >
              Anterior
            </button>
            <span className="px-4 py-2 font-semibold bg-gray-50 border-x border-gray-200">
              Página <b className="font-extrabold">{page}</b> de{" "}
              <b className="font-extrabold">{pages}</b>
            </span>
            <button
              type="button"
              onClick={() => page < pages && setPage((p) => p + 1)}
              disabled={page >= pages}
              className="px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors border-r border-gray-200"
              title="Página siguiente"
            >
              Siguiente
            </button>
            <button
              type="button"
              onClick={() => page < pages && setPage(pages)}
              disabled={page >= pages}
              className="px-3 py-2 rounded-r-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              title="Ir a la última página"
            >
              »
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
