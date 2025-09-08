import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import RucCard from "../components/RucCard.jsx";

export default function MiBase() {
  const { token } = useAuth();
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(24);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const fetchAssigned = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await api.get("/basesecodi/assigned", {
        ...authHeader,
        params: { userId: "me", page, limit, q: q || undefined },
      });
      const { items, total, page: p, pages } = res.data || {};
      setItems(items || []);
      setTotal(total || 0);
      setPages(pages || 1);
      if (p) setPage(p);
    } catch (e) {
      setErr("No se pudo cargar tu base asignada.");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get("/basesecodi/stats", { ...authHeader, params: { userId: "me" } });
      setStats(res.data || null);
    } catch {}
  };

  useEffect(() => { fetchAssigned(); /* eslint-disable-next-line */ }, [page, q, token]);
  useEffect(() => { fetchStats(); /* eslint-disable-next-line */ }, [token]);

  const canPrev = page > 1;
  const canNext = page < pages;

  const handleAgregarOportunidad = async () => {
    const ruc = window.prompt("Ingresa el RUC del cliente para crear la oportunidad:");
    if (!ruc) return;
    try {
      await api.post("/oportunidades", { ruc: String(ruc).trim() }, authHeader);
navigate("/mis-oportunidades");
    } catch (e) {
      console.error(e);
      alert("No se pudo crear la oportunidad. Verifica el RUC.");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold uppercase text-gray-800">Mi Base Asignada</h1>
          <p className="text-xs text-gray-500">Aquí verás todos los RUCs que te han asignado, con detalle completo.</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => { setPage(1); setQ(e.target.value); }}
            placeholder="Buscar por RUC o Razón Social"
            className="w-64 border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <button onClick={() => { setPage(1); fetchAssigned(); }} className="px-3 py-2 bg-gray-800 text-white text-xs rounded">
            Buscar
          </button>
          <button onClick={() => { setQ(""); setPage(1); }} className="px-3 py-2 bg-gray-200 text-gray-800 text-xs rounded">
            Limpiar
          </button>
          <button onClick={handleAgregarOportunidad} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded">
            Agregar oportunidad
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-300 bg-white p-3">
          <div className="text-[10px] uppercase text-gray-500">Total asignados</div>
          <div className="text-xl font-extrabold">{stats?.total ?? total}</div>
        </div>
        <div className="rounded-xl border border-gray-300 bg-white p-3">
          <div className="text-[10px] uppercase text-gray-500">Última asignación</div>
          <div className="text-sm font-semibold">
            {stats?.lastAssignedAt ? new Date(stats.lastAssignedAt).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" }) : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-gray-300 bg-white p-3">
          <div className="text-[10px] uppercase text-gray-500">Total líneas</div>
          <div className="text-xl font-extrabold">{stats?.sumTotalLines ?? "—"}</div>
        </div>
        <div className="rounded-xl border border-gray-300 bg-white p-3">
          <div className="text-[10px] uppercase text-gray-500">Hoy</div>
          <div className="text-xl font-extrabold">{stats?.today ?? "—"}</div>
        </div>
      </div>

      {err && <div className="text-red-700 text-sm">{err}</div>}
      {loading && <div className="text-sm text-gray-600">Cargando…</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (<RucCard key={it._id || it.ruc} item={it} />))}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button onClick={() => canPrev && setPage((p) => p - 1)} disabled={!canPrev} className="px-3 py-2 text-xs rounded border border-gray-300 disabled:opacity-50">← Anterior</button>
          <div className="text-xs text-gray-600">Página <b>{page}</b> de <b>{pages}</b> ({total} resultados)</div>
          <button onClick={() => canNext && setPage((p) => p + 1)} disabled={!canNext} className="px-3 py-2 text-xs rounded border border-gray-300 disabled:opacity-50">Siguiente →</button>
        </div>
      )}
    </div>
  );
}
