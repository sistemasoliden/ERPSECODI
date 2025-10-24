import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import qs from "qs";

import ReportRangeFilters from "../components/reporteria/ReportFilters";
import ExecMultiSelect from "../components/reporteria/ExecMultiSelect";

/* ========== utils ========== */
function useDebouncedValue(value, delay = 450) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
const fmtFecha = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} - ${String(
    d.getMonth() + 1
  ).padStart(2, "0")} - ${d.getFullYear()}`;
};
const fmtHora = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
};
const getDateStamp = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const HH = String(now.getHours()).padStart(2, "0");
  const MM = String(now.getMinutes()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${HH}${MM}`;
};
const sanitizeUserLabel = (raw) =>
  String(raw || "supervisor")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();

/* ========== estilos tabla ========== */
const tbl = {
  shell: "mx-2.5 shadow overflow-hidden bg-white mt-2",
  table: "w-full text-[11px] text-center text-gray-900 font-semibold",
  thead:
    "sticky top-0 bg-gray-800 text-white text-[11px] uppercase tracking-wide [&>tr]:h-11 [&>tr>th]:py-0 [&>tr>th]:font-extrabold",
  tbody:
    "divide-y-2 divide-gray-300 text-[11px] font-semibold text-gray-900 [&>tr]:h-9 [&>tr>td]:py-0 [&>tr>td]:align-middle",
  th: "px-4",
  td: "px-4",
  rowHover: "hover:bg-gray-50",
  skeleton: "h-2 w-24 mx-auto bg-gray-200 rounded animate-pulse",
};

/* ========== page ========== */
export default function SupervisorCitas() {
  const { token, user } = useAuth();
  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  const ROLES_IDS = {
    sistemas: "68a4f22d27e6abe98157a82c",
    gerencia: "68a4f22d27e6abe98157a82f",
    // ... (si quieres otros)
  };
  const isSistemas = useMemo(() => {
    const roleId =
      user?.roleId ||
      (typeof user?.role === "string" ? user?.role : user?.role?._id) ||
      "";
    // Si marcaste isAdmin en el token (Sistemas/Gerencia), úsalo también
    return roleId === ROLES_IDS.sistemas || user?.isAdmin === true;
  }, [user]);

  // filtros
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 450);
  const [tipo, setTipo] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // equipo y selección
  const [members, setMembers] = useState([]); // [{_id, name}]
  const [selectedIds, setSelectedIds] = useState([]); // userIds[]

  // datos
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  // UX carga sin parpadeo
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // concurrencia
  const reqIdRef = useRef(0);
  const abortRef = useRef(null);
const membersAbortRef = useRef(null);
const membersReqIdRef = useRef(0);

  /* ====== Cargar miembros (equipo) ====== */
  const loadMembers = async () => {
     if (!user || !token) return;
  if (membersAbortRef.current) membersAbortRef.current.abort();
 membersAbortRef.current = new AbortController();
  const myReq = ++membersReqIdRef.current;
   const { data } = await api.get("/reportes/citas/por-ejecutivo", {
    ...authHeader,
   params: isSistemas ? { includeAllTeams: "1" } : {},
    signal: membersAbortRef.current.signal,
  });
const mem = Array.isArray(data?.members)
  ? data.members
  : (Array.isArray(data?.items) ? data.items : [])
      .filter((i) => i.ejecutivoId)
 .map((i) => ({ _id: String(i.ejecutivoId), name: String(i.ejecutivo) }));
setMembers(mem);

if (!isSistemas && mem?.length) {
setSelectedIds(mem.map((m) => m._id));
}

  };

  /* ====== Cargar citas (supervisor) ====== */
  const load = async () => {
    if (abortRef.current) {
      console.log("[load] abortando req previa");
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();
    const myReq = ++reqIdRef.current;

    console.log("[load] START reqId =", myReq, {
      page,
      tipo,
      from,
      to,
      q: debouncedQ,
      isSistemas,
      selectedIdsLen: selectedIds?.length,
    });

    setLoading(!hasLoadedOnce);
    try {
      const baseParams = {
        page,
        limit,
        q: debouncedQ || undefined,
        tipo: tipo || undefined,
        from: from || undefined,
        to: to || undefined,
...(isSistemas && selectedIds.length === 0 ? { includeAllTeams: 1 } : {}),
      };

      const selectionParams = selectedIds?.length
        ? { userIds: selectedIds }
        : isSistemas
        ? {}
        : { noFallback: 1, userIds: [] };

      const params = { ...baseParams, ...selectionParams };
      console.log("[load] params =", params);

      const { data } = await api.get("/citas/supervisor", {
        ...authHeader,
        signal: abortRef.current.signal,
        params,
paramsSerializer: (p) => qs.stringify(p, { arrayFormat: "repeat" })
      });

      if (myReq !== reqIdRef.current) {
        console.log(
          "[load] STALE response descartada, reqId =",
          myReq,
          "latest =",
          reqIdRef.current
        );
        return;
      }

      console.log(
        "[load] OK reqId =",
        myReq,
        "items =",
        data?.items?.length,
        "total =",
        data?.total
      );
      setRows(data?.items || []);
      setTotal(data?.total || 0);
      setPages(data?.pages || 1);
      setHasLoadedOnce(true);
    } catch (e) {
      console.log("[load] ERROR reqId =", myReq, e.name, e.message);
    } finally {
      if (myReq === reqIdRef.current) {
        console.log("[load] FINISH setLoading(false) reqId =", myReq);
        setLoading(false);
      } else {
        console.log(
          "[load] FINISH omitido (stale) reqId =",
          myReq,
          "latest =",
          reqIdRef.current
        );
      }
    }
  };

  // bootstrap
  useEffect(() => {
    console.log("[bootstrap] token/isSistemas cambiaron → loadMembers()");
    setLoading(true);
    (async () => {
      await loadMembers();
    })();
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (membersAbortRef.current) membersAbortRef.current.abort();
    };
}, [token, isSistemas, user?.roleId, user?.isAdmin]);
  // recargas por filtros/selección
  useEffect(() => {
    if (!isSistemas && !members.length) return;
    console.log("[effect] disparando load() por deps");
    load();
  }, [
    page,
    debouncedQ,
    tipo,
    from,
    to,
    token,
    isSistemas,
    selectedIds.join(","), // ok
    members.length,
  ]);
  // 👈 importante
  /* ===== Exportación (equipo) ===== */
  const userLabel =
    sanitizeUserLabel(
      user?.name ||
        user?.displayName ||
        user?.username ||
        (user?.email || "").split("@")[0]
    ) || "supervisor";

  const mapItemsForExport = (arr) =>
    (arr || []).map((c) => {
      const dIni = c?.inicio ? new Date(c.inicio) : null;
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

      return {
        RUC: c?.ruc || "",
        "Razón Social": c?.razonSocial || "",
        Ejecutivo: c?.ownerName || c?.ownerEmail || "",
        Título: c?.titulo || "",
        Tipo: c?.tipo || "",
        Estado: c?.estado || "pendiente",
        Fecha: fecha,
        "Hora Inicio": horaIni,
        // 👇 Hora Fin removida como pediste
        Nota: c?.notas || "",
      };
    });

  const exportAllXLSX = async () => {
    try {
      const baseParams = {
        q: debouncedQ || undefined,
        tipo: tipo || undefined,
        from: from || undefined,
        to: to || undefined,
        ...(isSistemas ? { includeAllTeams: 1 } : {}),
      };

      const selectionParams = selectedIds?.length
        ? { userIds: selectedIds }
        : isSistemas
        ? {}
        : { noFallback: 1, userIds: [] };

      const params = { ...baseParams, ...selectionParams };

      const { data } = await api.get("/citas/supervisor/export", {
        ...authHeader,
        params,
        paramsSerializer: (p) => qs.stringify(p, { arrayFormat: "brackets" }),
      });

      const all = Array.isArray(data?.items) ? data.items : [];
      if (!all.length) {
        alert("No hay datos para exportar con el filtro actual.");
        return;
      }

      const rows = mapItemsForExport(all);
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      const cols = Object.keys(rows[0] || {});
      ws["!cols"] = cols.map((k) => ({ wch: Math.max(k.length + 2, 16) }));
      XLSX.utils.book_append_sheet(wb, ws, "Citas (Equipo)");
      const fname = `citas_equipo_${getDateStamp()}_${userLabel}.xlsx`;
      XLSX.writeFile(wb, fname);
    } catch (e) {
      console.error("Export supervisor citas error", e);
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
          placeholder="Buscar por RUC, razón social, título o nota"
          className="w-64 md:w-80 border border-gray-900 rounded px-3 py-3 text-[12px] bg-white"
        />

        <select
          value={tipo}
          onChange={(e) => {
            setPage(1);
            setTipo(e.target.value);
          }}
          className="w-48 border border-gray-900 rounded px-3 py-3 text-[12px] bg-white"
          title="Filtrar por tipo"
        >
          <option value="">Todos los tipos</option>
          <option value="presencial">Presencial</option>
          <option value="virtual">Virtual</option>
          <option value="llamada">Llamada</option>
          <option value="visita">Visita</option>
        </select>

        <ReportRangeFilters
          from={from}
          to={to}
          minYear={2020}
          maxYear={2030}
          onChange={({ from: f, to: t }) => {
            setFrom(f || "");
            setTo(t || "");
            setPage(1);
          }}
        />

        <ExecMultiSelect
  members={members}
  value={selectedIds}
  onChange={(ids) => {
    // normaliza siempre a string (evita enviar objetos)
    const norm = (ids || []).map((v) => String(v?._id ?? v));
    setSelectedIds(norm);
    setPage(1);
  }}
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
            setTipo("");
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
            onClick={exportAllXLSX}
            disabled={loading}
            className="px-4 py-3.5 bg-indigo-600 border border-indigo-600 text-white text-xs font-bold rounded disabled:opacity-60"
            title="Exportar todo con filtros y selección"
          >
            Exportar Citas 
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className={tbl.shell}>
        <div className="overflow-x-auto">
          <table className={tbl.table}>
            <thead className={tbl.thead}>
              <tr>
                <th className={tbl.th}>RUC</th>
                <th className={tbl.th}>Razón Social</th>
                <th className={tbl.th}>Ejecutivo</th>
                <th className={tbl.th}>Título</th>
                <th className={tbl.th}>Tipo</th>
                <th className={tbl.th}>Fecha</th>
                <th className={tbl.th}>Hora</th>
                <th className={tbl.th}>Estado</th>
                <th className={tbl.th}>Nota</th>
              </tr>
            </thead>
            <tbody className={tbl.tbody}>
              {loading &&
                !hasLoadedOnce &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className={tbl.td}>
                        <div className={tbl.skeleton} />
                      </td>
                    ))}
                  </tr>
                ))}

              {(!loading || hasLoadedOnce) &&
                rows.map((c) => (
                  <tr key={c._id} className={tbl.rowHover}>
                    <td className={`${tbl.td} whitespace-nowrap`}>
                      {c.ruc || "—"}
                    </td>
                    <td className={tbl.td}>
                      <div className="truncate max-w-[260px] mx-auto">
                        {c.razonSocial || "—"}
                      </div>
                    </td>
                    <td className={`${tbl.td} whitespace-nowrap`}>
                      {c.ownerName || c.ownerEmail || "—"}
                    </td>
                    <td className={tbl.td}>
                      <div className="truncate max-w-[260px] mx-auto">
                        {c.titulo || "—"}
                      </div>
                    </td>
                    <td className={`${tbl.td} capitalize`}>{c.tipo || "—"}</td>
                    <td className={`${tbl.td} whitespace-nowrap`}>
                      {fmtFecha(c.inicio)}
                    </td>
                    <td className={`${tbl.td} whitespace-nowrap`}>
                      {fmtHora(c.inicio)}
                    </td>
                    <td className={`${tbl.td} whitespace-nowrap`}>
                      {c.estado || "pendiente"}
                    </td>
                    <td className={tbl.td}>
                      <div className="truncate max-w-[260px] mx-auto">
                        {c.notas || "—"}
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading && hasLoadedOnce && rows.length === 0 && (
                <tr>
                  <td
                    className={`${tbl.td} text-center text-gray-500`}
                    colSpan={9}
                  >
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
            disabled={page <= 1}
            onClick={() => page > 1 && setPage((p) => p - 1)}
            className="px-3 py-2 text-xs rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
          >
            ← Anterior
          </button>
          <div className="text-xs text-gray-600">
            Página <b>{page}</b> de <b>{pages}</b> ({total} resultados)
          </div>
          <button
            disabled={page >= pages}
            onClick={() => page < pages && setPage((p) => p + 1)}
            className="px-3 py-2 text-xs rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-50"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
