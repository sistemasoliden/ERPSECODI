// src/pages/SupervisarEjecutivos.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import * as XLSX from "xlsx"; // arriba del archivo (si no lo tienes, npm i xlsx)

const COMMERCIAL_ROLE_ID = "68a4f22d27e6abe98157a831"; // debe coincidir con backend

/* ---------- UI helpers ---------- */
function Chip({ label, value, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-800 border-slate-200",
    mint: "bg-emerald-100 text-emerald-800 border-emerald-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    violet: "bg-violet-100 text-violet-800 border-violet-200",
    zinc: "bg-zinc-100 text-zinc-800 border-zinc-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-[11px] ${tones[tone]}`}
    >
      <span className="opacity-80">{label}:</span>
      <b className="tabular-nums">{value ?? 0}</b>
    </span>
  );
}

function ExecCard({ row, onOpen }) {
  const initials =
    row.name
      ?.split(" ")
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "?";

  return (
    <div className="rounded-2xl border border-black/10 bg-white shadow-sm hover:shadow-md transition-shadow p-5">
      {/* Encabezado: avatar, nombre, botón */}
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="shrink-0 w-12 h-12 rounded-full bg-blue-900 text-white grid place-content-center font-semibold">
          {initials}
        </div>

        {/* Info principal */}
        <div className="flex-1">
          <div className="flex items-start justify-between">
            {/* Nombre centrado */}
            <div className="flex-1 text-center">
              <div className="font-bold text-gray-900 leading-snug break-words">
                {row.name}
              </div>
            </div>

            {/* Botón */}
            <button
              onClick={() => onOpen(row)}
              className="ml-3 text-[12px] px-4 py-3 rounded-lg bg-blue-900 text-white font-bold hover:opacity-90"
            >
              Ver base
            </button>
          </div>
        </div>
      </div>

      {/* Métricas centradas horizontalmente */}
      <div className="mt-4 flex justify-center">
        <div className="w-[90%] max-w-md">
          <div className="grid grid-cols-4 text-center divide-x divide-gray-200 border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
            {[
              { label: "Asignados", value: row.totalAsignados },
              { label: "Tipificados", value: row.tipificados },
              {
                label: "Restantes",
                value: row.restantes,
                color: row.restantes
                  ? "text-amber-700 font-bold"
                  : "text-green-700 font-bold",
              },
              {
                label: "Hoy",
                value: row.tipificadosHoy,
                color: row.tipificadosHoy
                  ? "text-violet-700 font-bold"
                  : "text-green-700 font-bold",
              },
            ].map((item, i) => (
              <div
                key={i}
                className={`flex flex-col items-center justify-center py-3 ${
                  i % 2 === 0 ? "bg-gray-50" : "bg-white"
                }`}
              >
                <span className="text-[12px] text-gray-600 font-medium">
                  {item.label}
                </span>
                <span
                  className={`text-[16px] ${
                    item.color || "text-gray-900 font-semibold"
                  }`}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Última asignación centrada */}
      <div className="mt-3 text-[12px] text-red-900 font-bold text-center">
        Última asignación:{" "}
        {row.ultimaAsignacion
          ? new Date(row.ultimaAsignacion)
              .toLocaleString("es-PE", {
                dateStyle: "medium",
                timeStyle: "short",
              })
              .replaceAll("/", "-")
              .replace(",", "")
          : "—"}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-black/10 bg-white shadow-[0_6px_22px_rgba(0,0,0,.06)] p-4 sm:p-5">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-gray-200" />
        <div className="flex-1 min-w-0">
          <div className="h-3.5 w-40 bg-gray-200 rounded mb-2" />
          <div className="h-2.5 w-28 bg-gray-200 rounded" />
        </div>
        <div className="h-7 w-20 bg-gray-200 rounded-lg" />
      </div>
      <div className="mt-4 flex gap-2 flex-wrap">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-6 w-28 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="mt-3 h-2.5 w-44 bg-gray-200 rounded" />
    </div>
  );
}

function EmptyState({ message = "Sin resultados" }) {
  return (
    <div className="col-span-full">
      <div className="rounded-2xl border border-black/10 bg-white p-10 text-center">
        <div className="mx-auto h-10 w-10 rounded-full bg-gray-200 mb-3" />
        <div className="text-sm text-gray-600">{message}</div>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function SupervisarEjecutivos() {
  const { token } = useAuth();
  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  // dashboard
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("restantes:desc");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(12);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // drawer detalle
  const [open, setOpen] = useState(false);
  const [exec, setExec] = useState(null);
  const [detail, setDetail] = useState({
    items: [],
    page: 1,
    pages: 1,
    total: 0,
    q: "",
    loading: false,
  });

  // ejecutivos para reasignar (select en modal)
  const [members, setMembers] = useState([]); // [{_id,name}]
  const [moveTargets, setMoveTargets] = useState({}); // { [rucKey]: toUserId }
  const [movingRuc, setMovingRuc] = useState("");
  const [moving, setMoving] = useState(false);


const [exporting, setExporting] = useState(false);
const [exportPct, setExportPct] = useState(0); // opcional para mostrar en UI

const handleExport = async () => {
  try {
    setExporting(true);
    setExportPct(0);

    const { data } = await api.get("/basesecodi/export", {
      ...authHeader,
     onDownloadProgress: (event) => {
  console.log("progress event:", event);

  if (event.total) {
    const percent = Math.round((event.loaded * 100) / event.total);
    setExportPct(percent);
    console.log(
      `Descarga export: ${percent}% (${event.loaded} / ${event.total} bytes)`
    );
  } else {
    console.log(
      `Descargado: ${event.loaded} bytes (sin total, no se puede calcular % real)`
    );
  }
},

    });

    const rows = (data || []).map((row) => ({
      RUC: row.ruc || "No Info",
      RazonSocial: row.razonSocial || "No Info",
      Direccion: row.direccion || "No Info",
      MovistarLines: row.movistarLines ?? "No Info",
      ClaroLines: row.claroLines ?? "No Info",
      EntelLines: row.entelLines ?? "No Info",
      OtherLines: row.otherLines ?? "No Info",
      UncountedLines: row.uncountedLines ?? "No Info",
      TotalLines: row.totalLines ?? "No Info",

      // De datasalesforce
      Tipo: row.type || "No Info",
      Segmento: row.segment || "No Info",
      ConsultorPrincipal: row.primaryConsultant || "No Info",
      LastAssignmentDate: row.lastAssignmentDate
        ? new Date(row.lastAssignmentDate).toLocaleString("es-PE")
        : "No Info",
      NextDeassignmentDate: row.nextDeassignmentDate
        ? new Date(row.nextDeassignmentDate).toLocaleString("es-PE")
        : "No Info",

      // De assignments / tipificaciones
      Ejecutivo: row.execName || "No Info",
      EjecutivoEmail: row.execEmail || "No Info",
      Tipificacion: row.tipificationName || "No Info",
      Subtipificacion: row.subtipificationName || "No Info",
      NotaTipificacion: row.tipificationNote || "No Info",
      FechaAsignacion: row.assignedAt
        ? new Date(row.assignedAt).toLocaleString("es-PE")
        : "No Info",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Base");

    const ts = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "");
    XLSX.writeFile(wb, `basesecodi_export_${ts}.xlsx`);
  } catch (e) {
    console.error(e);
    alert("No se pudo exportar la base");
  } finally {
    setExporting(false);
    setExportPct(0);
  }
};


  const fetchDashboard = async (signal) => {
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.get("/basesecodi/exec-dashboard", {
        ...authHeader,
        params: { search: search || undefined, page, limit, sort },
      });
      if (!signal.cancelled) {
        setRows(data.items || []);
        setPages(data.pages || 1);
        setTotal(data.total || 0);
      }
    } catch (e) {
      console.error(e);
      if (!signal.cancelled) setErr("No se pudo cargar la información.");
    } finally {
      if (!signal.cancelled) setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const { data } = await api.get("/users/activos", authHeader);
      setMembers(
        (data || [])
          .filter(Boolean)
          .filter(
            (m) =>
              String(m?.role?._id ?? m?.role ?? "") === COMMERCIAL_ROLE_ID &&
              m?.isActive !== false
          )
      );
    } catch (e) {
      console.error("members error", e);
      setMembers([]);
    }
  };

  const fetchDetail = async (userId, dPage = 1, q = "") => {
    setDetail((prev) => ({ ...prev, loading: true }));
    try {
      const { data } = await api.get("/basesecodi/assigned", {
        ...authHeader,
        params: { userId, page: dPage, limit: 12, q: q || undefined },
      });
      setDetail({
        items: data.items || [],
        page: data.page || dPage,
        pages: data.pages || 1,
        total: data.total || 0,
        q,
        loading: false,
      });
      setMoveTargets({}); // reset por página/búsqueda
    } catch (e) {
      console.error(e);
      setDetail((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchMembers(); // para el selector de reasignación
  }, [token]);

  useEffect(() => {
    const signal = { cancelled: false };
    fetchDashboard(signal);
    return () => {
      signal.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sort, limit, token]);

  const startSearch = () => {
    setPage(1);
    const signal = { cancelled: false };
    fetchDashboard(signal);
  };

  const openDrawer = (row) => {
    setExec(row);
    setOpen(true);
    setDetail((d) => ({ ...d, q: "" }));
    setMoveTargets({});
    fetchDetail(row.userId, 1, "");
  };

  // Reasignación por ítem
  const doReassign = async (toUserId, rucKey) => {
    if (!toUserId || !rucKey) return;
    setMoving(true);
    try {
      await api.post(
        "/basesecodi/reassign-one",
        {
          ruc: rucKey,
          toUserId,
          overwrite: true,
          ignoreTipificacion: true,
          note: "",
        },
        authHeader
      );
      // refrescamos listas
      if (exec) await fetchDetail(exec.userId, detail.page, detail.q);
      const signal = { cancelled: false };
      fetchDashboard(signal);
      // limpiar solo el select de ese RUC
      setMoveTargets((prev) => ({ ...prev, [rucKey]: "" }));
      setMovingRuc("");
    } catch (e) {
      console.error("reassign-one error", e);
      alert(e?.response?.data?.message || "No se pudo reasignar");
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="min-h-[calc(100dvh-64px)] bg-[#F2F0F0] p-4 sm:p-6">
      <div className="mx-auto w-full max-w-7xl">
        {/* Toolbar filtros (sticky) */}
        <div className=" z-20 -mt-2 mb-3 sm:mb-4  ">
          <div className="flex flex-wrap items-center gap-2 p-2 ">
            {/* Buscar */}
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && startSearch()}
                placeholder="Buscar por nombre o email"
                className="border border-black rounded-lg pl-3 pr-8 py-3 text-sm bg-white w-64"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-900 hover:text-gray-900 text-sm"
                  title="Limpiar"
                >
                  ×
                </button>
              )}
            </div>

            {/* Orden */}
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="border border-black rounded-lg px-3 py-3 text-sm bg-white"
              title="Ordenar"
            >
              <option value="restantes:desc">Restantes ↓</option>
              <option value="restantes:asc">Restantes ↑</option>
              <option value="tipificadosHoy:desc">Tipificados hoy ↓</option>
              <option value="totalAsignados:desc">Asignados ↓</option>
            </select>

            {/* Límite */}
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="border border-black rounded-lg px-4 py-3 text-sm bg-white"
              title="Filas por página"
            >
              <option value={6}>6</option>
              <option value={12}>12</option>
              <option value={24}>24</option>
            </select>

           <button
  onClick={handleExport}
  disabled={exporting}
  className="ml-auto px-6 py-3.5 text-sm rounded-lg bg-gray-900 text-white font-bold hover:opacity-90 disabled:opacity-50"
>
  {exporting ? `Exportando... ${exportPct}%` : "Exportar"}
</button>


          </div>
        </div>

        {/* Mensajes */}
        {err && (
          <div className="mt-2 sm:mt-4 text-red-700 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {err}
          </div>
        )}

        {/* Grid */}
        <div className="mt-4 grid gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {loading &&
            Array.from({ length: limit }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}

          {!loading && rows.length === 0 && (
            <EmptyState message="No se encontraron ejecutivos con el criterio actual." />
          )}

          {!loading &&
            rows.map((r) => (
              <ExecCard key={r.userId} row={r} onOpen={openDrawer} />
            ))}
        </div>

        {/* Paginación */}
        {pages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-2 text-xs rounded-lg border border-black/10 bg-white disabled:opacity-50"
              disabled={page <= 1}
            >
              ← Anterior
            </button>
            <div className="text-xs text-gray-600">
              Página <b>{page}</b> de <b>{pages}</b> ({total} ejecutivos)
            </div>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="px-3 py-2 text-xs rounded-lg border border-black/10 bg-white disabled:opacity-50"
              disabled={page >= pages}
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {/* Drawer lateral */}
      <div
        className={`fixed top-0 right-0 h-screen w-[480px] bg-white shadow-2xl border-l border-black/10 transition-transform duration-300 z-[60] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        {/* Header Drawer */}
        <div className="sticky top-0 z-10 bg-white border-b border-black/10">
          <div className="p-4 flex items-center gap-3">
            <div className="font-bold text-sm text-gray-900">
              Base no tipificada -
            </div>
            <div className="text-sm text-gray-900  truncate">{exec?.name}</div>
          </div>

          {/* Buscador del drawer */}
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2">
              <input
                value={detail.q}
                onChange={(e) =>
                  setDetail((prev) => ({ ...prev, q: e.target.value }))
                }
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  exec &&
                  fetchDetail(exec.userId, 1, detail.q)
                }
                placeholder="Buscar RUC o Razón Social"
                className="flex-1 border border-black rounded-lg px-3 py-3 text-sm bg-white"
              />
              <button
                onClick={() => exec && fetchDetail(exec.userId, 1, detail.q)}
                disabled={detail.loading}
                className="px-6 py-3 text-sm rounded-lg border border-black bg-white disabled:opacity-50"
              >
                Buscar
              </button>
            </div>
          </div>
        </div>

        {/* Body Drawer */}
        <div className="p-4 space-y-3 overflow-y-auto h-[calc(100vh-128px)]">
          {detail.loading && (
            <div className="text-sm text-gray-600">Cargando…</div>
          )}

          {!detail.loading &&
            detail.items.map((it) => {
              const rucKey = String(it.rucStr || it.ruc);
              return (
                <div
                  key={it._id || rucKey}
                  className="rounded-lg border border-black p-3 bg-gray-100 h-[160px] flex flex-col justify-between"
                >
                  <div className="text-xs font-bold text-gray-900 mt-1 mb-1">
                    {it.razonSocial || it.razon_social || "Sin razón social"}
                  </div>
                  <div className="text-[11px] text-gray-900 mt-2">
                    RUC: <b>{rucKey}</b>
                  </div>
                  <div className="text-[11px] text-gray-900 mt-2">
                    Asignado:{" "}
                    {it.assignedAt
                      ? new Date(it.assignedAt).toLocaleString("es-PE", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "—"}
                  </div>

                  {/* Reasignar */}
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value={moveTargets[rucKey] ?? ""}
                      onChange={(e) =>
                        setMoveTargets((prev) => ({
                          ...prev,
                          [rucKey]: e.target.value,
                        }))
                      }
                      className="flex-1 border border-gray-900 rounded-lg px-2 py-2 text-xs bg-white"
                      title="Reasignar a"
                    >
                      <option value="">— Reasignar a —</option>
                      {members.map((m) => (
                        <option key={m._id} value={m._id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const to = moveTargets[rucKey];
                        if (!to) return;
                        setMovingRuc(rucKey);
                        doReassign(to, rucKey);
                      }}
                      disabled={!moveTargets[rucKey] || moving}
                      className="px-3 py-2.5 text-xs rounded-lg bg-red-800 text-white disabled:opacity-50"
                      title="Reasignar este RUC"
                    >
                      {moving && movingRuc === rucKey ? "..." : "Reasignar"}
                    </button>
                  </div>
                </div>
              );
            })}

          {!detail.loading && detail.items.length === 0 && (
            <div className="text-sm text-gray-600 text-center py-4">
              Sin registros para este ejecutivo.
            </div>
          )}

          {detail.pages > 1 && (
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() =>
                  exec &&
                  detail.page > 1 &&
                  fetchDetail(exec.userId, detail.page - 1, detail.q)
                }
                className="px-3 py-1.5 text-xs rounded-lg border border-black/10 bg-white disabled:opacity-50"
                disabled={detail.page <= 1}
              >
                ←
              </button>
              <div className="text-xs text-gray-600">
                Página <b>{detail.page}</b> de <b>{detail.pages}</b> (
                {detail.total} registros)
              </div>
              <button
                onClick={() =>
                  exec &&
                  detail.page < detail.pages &&
                  fetchDetail(exec.userId, detail.page + 1, detail.q)
                }
                className="px-3 py-1.5 text-xs rounded-lg border border-black/10 bg-white disabled:opacity-50"
                disabled={detail.page >= detail.pages}
              >
                →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/30 z-[50]"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
