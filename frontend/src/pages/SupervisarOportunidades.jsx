// src/pages/MisOportunidadesSupervisor.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import ReportRangeFilters from "../components/reporteria/ReportFilters";
import ExecMultiSelect from "../components/reporteria/ExecMultiSelect";
import qs from "qs";

/* Debounce simple */
function useDebouncedValue(value, delay = 450) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

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
  return String(raw || "supervisor")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export default function MisOportunidadesSupervisor() {
  const { token, user } = useAuth();
  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  // ===== detectar Sistemas (alineado con backend) =====
  const ROLES_IDS = { sistemas: "68a4f22d27e6abe98157a82c" }; // ajusta si cambia
  const isSistemas = useMemo(() => {
    const roleId =
      user?.roleId ||
      (typeof user?.role === "string" ? user?.role : user?.role?._id) ||
      "";
    const slug =
      String(user?.role?.slug || user?.role?.nombre || user?.role?.name || "")
        .trim()
        .toLowerCase() || "";
    return roleId === ROLES_IDS.sistemas || slug === "sistemas" || user?.isAdmin === true;
  }, [user]);

  // --------- Filtros ----------
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 450);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Equipo y selección
  const [members, setMembers] = useState([]); // [{_id, name}]
  const [selectedIds, setSelectedIds] = useState([]); // userIds[]

  // Datos tabla
  const [rows, setRows] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  // Loading y control de parpadeo
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Concurrencia
  const reqIdRef = useRef(0);
  const abortRef = useRef(null);

   const membersAbortRef = useRef(null);
   const membersReqIdRef = useRef(0);

  /* Cargar catálogo de etapas */
  const loadTipos = async () => {
    try {
      const res = await api.get("/oportunidades/tipos/all", authHeader);
      setTipos(res.data || []);
    } catch (e) {
      console.error("[OppSupervisor] tipos error", e);
      setTipos([]);
    }
  };

  /* Cargar equipo (obtener miembros) */
/* Cargar equipo (para el selector) */
const loadMembers = async () => {
   // evita llamadas si aún no hay user/tokens
   if (!user || !token) return;

   // cancelar petición anterior
  if (membersAbortRef.current) membersAbortRef.current.abort();
   membersAbortRef.current = new AbortController();
   const myReq = ++membersReqIdRef.current;  try {
 const params = isSistemas ? { includeAllTeams: "1" } : {};
    console.log("[OppSupervisor] loadMembers params =", params);
    const { data } = await api.get("/reportes/citas/por-ejecutivo", {      ...authHeader,
     params,
      signal: membersAbortRef.current.signal,
    });

    const arr = Array.isArray(data?.members)
      ? data.members
      : Array.isArray(data?.items)
      ? data.items
      : [];

    const mem = arr
      .map((i) => {
        const id =
          i.ejecutivoId || i.userId || i.ownerId || i._id || i.id || i.usuarioId;
        const name =
          i.ejecutivo ||
          i.ownerName ||
          i.name ||
          i.displayName ||
          i.usuario ||
          i.email;
        return id && name ? { _id: String(id), name: String(name) } : null;
      })
      .filter(Boolean);
if (myReq !== membersReqIdRef.current) return;

    setMembers(mem);

    if (isSistemas) {
      // Sistemas: deja vacío por defecto (modo global), o selecciona todos si quieres filtrar por IDs
      setSelectedIds([]);
    } else {
      setSelectedIds(mem.map((m) => m._id));
    }
  } catch (e) {

    if (e.name === "CanceledError" || e.name === "AbortError") return;

    console.error("[OppSupervisor] miembros error", e);
    setMembers([]);
    setSelectedIds([]);
  }
};


  /* Carga de oportunidades del supervisor (API) */
  const load = async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    const myReq = ++reqIdRef.current;
    setLoading(!hasLoadedOnce); // skeleton solo en la primera

    try {
      const baseParams = {
        page,
        limit,
        q: debouncedQ || undefined,
        estadoId: filtroEstado || undefined,
        from: from || undefined,
        to: to || undefined,
      };

      // Enviar explícitamente userIds si hay (preferente para Sistemas).
      // Si no hay selección y eres Sistemas, envía includeAllTeams=1.
      // Si no hay selección y NO eres Sistemas, evita fallback al token.
      const selectionParams =
        selectedIds.length > 0
          ? { userIds: selectedIds }
          : isSistemas
          ? { includeAllTeams: 1 }
          : { userIds: [], noFallback: 1 };

      const params = { ...baseParams, ...selectionParams };

      const res = await api.get("/oportunidades/supervisorop", {
        ...authHeader,
        signal: abortRef.current.signal,
        params,
        paramsSerializer: (p) => qs.stringify(p, { arrayFormat: "brackets" }),
      });

      if (myReq !== reqIdRef.current) return; // respuesta vieja

      const items = res.data?.items || [];
      const t = res.data?.total || 0;
      const pgs = res.data?.pages || 1;

      setRows(items);
      setTotal(t);
      setPages(pgs);
      setHasLoadedOnce(true);
    } catch (e) {
      if (e.name !== "CanceledError" && e.name !== "AbortError") {
        console.error("[OppSupervisor] load error", e);
      }
    } finally {
      if (myReq === reqIdRef.current) setLoading(false);
    }
  };

  // Bootstrap: tipos + miembros
  useEffect(() => {
    setLoading(true);
    (async () => {
 await loadTipos();
    await loadMembers();
      })();
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (membersAbortRef.current) membersAbortRef.current.abort();

    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [token, isSistemas, user?.roleId, user?.isAdmin]);
  // Disparar cargas cuando cambian filtros/selección/paginación
  useEffect(() => {
    // Sistemas puede cargar aunque no haya members (modo global o con ids del equipo)
    if (!isSistemas && !members.length) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    debouncedQ,
    filtroEstado,
    from,
    to,
    token,
    isSistemas,
    selectedIds.join(","),
    members.length,
  ]);

  const onRangeChange = ({ from: f, to: t }) => {
    setFrom(f || "");
    setTo(t || "");
    setPage(1);
  };

  /* ===== Exportación a Excel (Supervisor) ===== */
  const userLabel = sanitizeUserLabel(
    user?.name ||
      user?.displayName ||
      user?.username ||
      (user?.email || "").split("@")[0]
  );

  const mapItemsForExport = (items) =>
    (items || []).map((op) => {
      const d = op?.createdAt ? new Date(op.createdAt) : null;
      const fecha = d
        ? `${String(d.getDate()).padStart(2, "0")}-${String(
            d.getMonth() + 1
          ).padStart(2, "0")}-${d.getFullYear()}`
        : "";
      return {
        RUC: op?.ruc || "",
        "Razón Social": op?.razonSocial || "",
        Ejecutivo: op?.ownerName || op?.ownerEmail || "",
        Estado: op?.estadoNombre || "",
        "Cargo Fijo (S/.)": Number(op?.monto || 0),
        Cantidad: Number(op?.cantidad ?? 0),
        "Fecha de Gestión": fecha,
      };
    });

  const exportXLSX = (dataArray, filename) => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dataArray);
    const cols = Object.keys(dataArray[0] || {});
    ws["!cols"] = cols.map((k) => ({ wch: Math.max(k.length + 2, 16) }));
    XLSX.utils.book_append_sheet(wb, ws, "Oportunidades");
    XLSX.writeFile(wb, filename);
  };

  const exportAllXLSX = async () => {
    const all = [];
    let p = 1;
    try {
      while (true) {
        const baseParams = {
          page: p,
          limit: 300,
          q: debouncedQ || undefined,
          estadoId: filtroEstado || undefined,
          from: from || undefined,
          to: to || undefined,
        };

        const selectionParams =
          selectedIds.length > 0
            ? { userIds: selectedIds }
            : isSistemas
            ? { includeAllTeams: 1 }
            : { userIds: [], noFallback: 1 };

        const params = { ...baseParams, ...selectionParams };

        const res = await api.get("/oportunidades/supervisorop", {
          ...authHeader,
          params,
          paramsSerializer: (prm) => qs.stringify(prm, { arrayFormat: "brackets" }),
        });

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
      const filename = `oportunidades_supervisor_${getDateStamp()}_${userLabel}.xlsx`;
      exportXLSX(data, filename);
    } catch (e) {
      console.error("Export All (supervisor) error", e);
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
          placeholder={
            isSistemas && !selectedIds.length
              ? "Sin selección (global)"
              : "Filtrar ejecutivos…"
          }
          onChange={(ids) => {
            setSelectedIds(ids);
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
            setFiltroEstado("");
            setFrom("");
            setTo("");
            if (isSistemas) {
              // Sistemas: intenta todos los miembros (si existen), si no, global
              setSelectedIds(members.length ? members.map((m) => m._id) : []);
            } else {
              setSelectedIds(members.map((m) => m._id));
            }
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
            Exportar Oport.
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
                <th className="px-4">Ejecutivo</th>
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
                rows.map((op) => (
                  <tr key={op._id} className="hover:bg-gray-50">
                    <td className="px-4 whitespace-nowrap">{op.ruc}</td>
                    <td className="px-4">
                      <div className="truncate max-w-[380px] mx-auto">
                        {op.razonSocial || op?.base?.razonSocial || "—"}
                      </div>
                    </td>
                    <td className="px-4 whitespace-nowrap">
                      {op.ownerName || op.ownerEmail || "—"}
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

