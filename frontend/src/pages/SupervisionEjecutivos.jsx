import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

function StatPill({ label, value, tone = "gray" }) {
  const tones = {
    gray:  "bg-gray-100 text-gray-800",
    green: "bg-emerald-100 text-emerald-800",
    blue:  "bg-blue-100 text-blue-800",
    amber: "bg-amber-100 text-amber-800",
    red:   "bg-red-100 text-red-800",
    violet:"bg-violet-100 text-violet-800",
  };
  return (
    <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${tones[tone] || tones.gray}`}>
      <span className="opacity-70">{label}:</span> <span className="ml-1">{value}</span>
    </div>
  );
}

function ExecCard({ row, onOpen }) {
  const initials = row.name?.split(" ").slice(0,2).map(s=>s[0]).join("").toUpperCase() || "?";
  return (
    <div className="rounded-2xl border border-black/5 bg-white shadow-sm hover:shadow-md transition p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white grid place-items-center font-bold">
          {initials}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 truncate">{row.name}</div>
          <div className="text-xs text-gray-500 truncate">{row.email || "—"}</div>
        </div>
        <button
          onClick={() => onOpen(row)}
          className="ml-auto text-xs bg-black text-white px-3 py-1.5 rounded-lg hover:opacity-90"
          title="Ver base no tipificada"
        >
          Ver base
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatPill label="Asignados" value={row.totalAsignados} tone="blue" />
        <StatPill label="Tipificados" value={row.tipificados} tone="green" />
        <StatPill label="Restantes" value={row.restantes} tone={row.restantes ? "amber" : "green"} />
        <StatPill label="Hoy" value={row.tipificadosHoy} tone={row.tipificadosHoy ? "violet" : "gray"} />
        <StatPill label="Líneas" value={row.sumTotalLines} tone="gray" />
      </div>

      <div className="text-[11px] text-gray-500">
        Última asignación: {row.ultimaAsignacion ? new Date(row.ultimaAsignacion).toLocaleString("es-PE",{dateStyle:"medium",timeStyle:"short"}) : "—"}
      </div>
    </div>
  );
}

export default function SupervisarEjecutivos() {
  const { token } = useAuth();
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  // dashboard
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("restantes:desc");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // drawer detalle
  const [open, setOpen] = useState(false);
  const [exec, setExec] = useState(null);
  const [detail, setDetail] = useState({ items: [], page: 1, pages: 1, total: 0, q: "", loading: false });

  const fetchDashboard = async () => {
    setLoading(true); setErr("");
    try {
      const { data } = await api.get("/basesecodi/exec-dashboard", {
        ...authHeader, params: { search: search || undefined, page, limit: 12, sort }
      });
      setRows(data.items || []);
      setPages(data.pages || 1);
      setTotal(data.total || 0);
    } catch (e) {
      setErr("No se pudo cargar la información.");
    } finally { setLoading(false); }
  };

  const fetchDetail = async (userId, dPage = 1, q = "") => {
    setDetail(prev => ({ ...prev, loading: true }));
    try {
      const { data } = await api.get("/basesecodi/assigned", {
        ...authHeader, params: { userId, page: dPage, limit: 12, q: q || undefined }
      });
      setDetail({
        items: data.items || [],
        page: data.page || dPage,
        pages: data.pages || 1,
        total: data.total || 0,
        q,
        loading: false
      });
    } catch {
      setDetail(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => { fetchDashboard(); /* eslint-disable-next-line */ }, [page, sort, token]);
  const startSearch = () => { setPage(1); fetchDashboard(); };

  const openDrawer = (row) => {
    setExec(row);
    setOpen(true);
    fetchDetail(row.userId, 1, "");
  };

  return (
    <div className="min-h-[calc(100dvh-64px)] bg-[#ebe8e8] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Supervisión de Ejecutivos</h1>
            <p className="text-xs text-gray-600">Estado de asignaciones y tipificaciones por ejecutivo.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre o email"
              className="border rounded-lg px-3 py-2 text-sm w-64"
            />
            <select
              value={sort}
              onChange={e => { setSort(e.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 text-sm"
              title="Ordenar"
            >
              <option value="restantes:desc">Restantes ↓</option>
              <option value="restantes:asc">Restantes ↑</option>
              <option value="tipificadosHoy:desc">Tipificados hoy ↓</option>
              <option value="totalAsignados:desc">Asignados ↓</option>
            </select>
            <button
              onClick={startSearch}
              className="px-3 py-2 text-sm rounded-lg bg-black text-white hover:opacity-90"
            >
              Buscar
            </button>
          </div>
        </div>

        {err && <div className="mt-4 text-red-700 text-sm">{err}</div>}
        {loading && <div className="mt-4 text-sm text-gray-600">Cargando…</div>}

        {/* grid de tarjetas */}
        <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(r => (
            <ExecCard key={r.userId} row={r} onOpen={openDrawer} />
          ))}
        </div>

        {/* paginación */}
        {pages > 1 && (
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-2 text-xs rounded-lg border bg-white disabled:opacity-50"
              disabled={page <= 1}
            >
              ← Anterior
            </button>
            <div className="text-xs text-gray-600">
              Página <b>{page}</b> de <b>{pages}</b> ({total} ejecutivos)
            </div>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              className="px-3 py-2 text-xs rounded-lg border bg-white disabled:opacity-50"
              disabled={page >= pages}
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {/* Drawer lateral */}
      <div className={`fixed top-0 right-0 h-screen w-full max-w-xl bg-white shadow-2xl border-l border-black/5 transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}>
        <div className="p-4 border-b flex items-center gap-3">
          <div className="font-bold text-gray-900">Base no tipificada</div>
          <div className="text-xs text-gray-500 ml-2 truncate">{exec?.name}</div>
          <button className="ml-auto text-sm px-3 py-1.5 rounded-lg bg-black text-white" onClick={() => setOpen(false)}>Cerrar</button>
        </div>

        <div className="p-4 flex items-center gap-2 border-b">
          <input
            value={detail.q}
            onChange={e => setDetail(prev => ({ ...prev, q: e.target.value }))}
            placeholder="Buscar RUC o Razón Social"
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={() => exec && fetchDetail(exec.userId, 1, detail.q)}
            className="px-3 py-2 text-sm rounded-lg border bg-white"
          >
            Buscar
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto h-[calc(100vh-160px)]">
          {detail.loading && <div className="text-sm text-gray-600">Cargando…</div>}
          {!detail.loading && detail.items.map(it => (
            <div key={it._id || it.rucStr || it.ruc} className="rounded-xl border border-black/5 p-3 bg-gray-50">
              <div className="text-sm font-semibold text-gray-900">{it.razonSocial || it.razon_social || "Sin razón social"}</div>
              <div className="text-xs text-gray-600 mt-0.5">RUC: <b>{String(it.rucStr || it.ruc)}</b></div>
              <div className="text-[11px] text-gray-500 mt-1">
                Asignado: {it.assignedAt ? new Date(it.assignedAt).toLocaleString("es-PE",{dateStyle:"medium",timeStyle:"short"}) : "—"}
              </div>
            </div>
          ))}

          {detail.pages > 1 && (
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => exec && detail.page > 1 && fetchDetail(exec.userId, detail.page - 1, detail.q)}
                className="px-3 py-1.5 text-xs rounded-lg border bg-white disabled:opacity-50"
                disabled={detail.page <= 1}
              >
                ←
              </button>
              <div className="text-xs text-gray-600">
                Página <b>{detail.page}</b> de <b>{detail.pages}</b> ({detail.total} registros)
              </div>
              <button
                onClick={() => exec && detail.page < detail.pages && fetchDetail(exec.userId, detail.page + 1, detail.q)}
                className="px-3 py-1.5 text-xs rounded-lg border bg-white disabled:opacity-50"
                disabled={detail.page >= detail.pages}
              >
                →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 bg-black/30 backdrop-blur-[1px]" />}
    </div>
  );
}
