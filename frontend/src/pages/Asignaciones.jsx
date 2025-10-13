import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

function Modal({ open, onClose, children, title = "Detalle" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-5xl bg-white rounded-xl shadow-2xl p-4">
        <div className="flex items-center justify-between border-b pb-2 mb-3">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="px-3 py-1 bg-gray-800 text-white rounded text-xs">
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Asignaciones() {
  const { token } = useAuth();
  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  const [batches, setBatches] = useState([]);
  const [skip, setSkip] = useState(0);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Filtro simple por texto (nombre de usuario destino / asignador)
  const [q, setQ] = useState("");

  // Modal de logs
  const [openLogs, setOpenLogs] = useState(false);
  const [logs, setLogs] = useState(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);

  const fetchBatches = async (reset = false) => {
    setLoading(true);
    setErr("");
    try {
      const res = await api.get("/basesecodi/admin/batches", {
        ...authHeader,
        params: { limit, skip: reset ? 0 : skip },
      });
      const list = Array.isArray(res.data) ? res.data : [];
      setBatches((prev) => (reset ? list : [...prev, ...list]));
      if (reset) setSkip(list.length);
      else setSkip((s) => s + list.length);
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.message || "No se pudo cargar el historial.");
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => fetchBatches(true);

  const openLogsModal = async (batch) => {
    setSelectedBatch(batch);
    setOpenLogs(true);
    setLogs(null);
    setLogsLoading(true);
    try {
      const res = await api.get(`/basesecodi/admin/batch/${batch._id}/logs`, authHeader);
      setLogs(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, token]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return batches;
    return batches.filter((b) => {
      const toName = b.toUserId?.name?.toLowerCase?.() || "";
      const byName = b.assignedBy?.name?.toLowerCase?.() || "";
      return toName.includes(t) || byName.includes(t);
    });
  }, [batches, q]);

  // Agrupar logs por acción
  const groupedLogs = useMemo(() => {
    if (!logs) return null;
    const g = { assign: [], reassign: [], skip_conflict: [] };
    for (const l of logs) {
      if (g[l.action]) g[l.action].push(l);
    }
    return g;
  }, [logs]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold uppercase text-gray-800">Historial de Asignaciones</h1>
          <p className="text-xs text-gray-500">Solo Sistemas · Batches + detalle por RUC</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por usuario destino o asignador…"
            className="w-72 border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value, 10))}
            className="border border-gray-300 rounded px-2 py-2 text-sm"
            title="Registros por carga"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <button
            onClick={refresh}
            className="px-3 py-2 bg-gray-800 text-white text-xs rounded"
          >
            Refrescar
          </button>
        </div>
      </div>

      {err && <div className="text-red-700 text-sm">{err}</div>}

      <div className="overflow-auto border rounded bg-white">
        <table className="min-w-[960px] w-full">
          <thead className="bg-gray-50 text-[11px] uppercase">
            <tr>
              <th className="px-3 py-2 border text-left">Fecha</th>
              <th className="px-3 py-2 border text-left">Ejecutivo destino</th>
              <th className="px-3 py-2 border text-left">Asignado por</th>
              <th className="px-3 py-2 border text-center">Solic.</th>
              <th className="px-3 py-2 border text-center">Encontr.</th>
              <th className="px-3 py-2 border text-center">Asign.</th>
              <th className="px-3 py-2 border text-center">Falt.</th>
              <th className="px-3 py-2 border text-center">Conflic.</th>
              <th className="px-3 py-2 border text-left">Nota</th>
              <th className="px-3 py-2 border text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {filtered.map((b) => (
              <tr key={b._id} className="odd:bg-slate-50">
                <td className="px-3 py-2 border">
                  {new Date(b.createdAt).toLocaleString("es-PE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-3 py-2 border">
                  {b.toUserId?.name || b.toUserId?._id || "—"}
                </td>
                <td className="px-3 py-2 border">
                  {b.assignedBy?.name || b.assignedBy?._id || "—"}
                </td>
                <td className="px-3 py-2 border text-center">{b.countRequested ?? "—"}</td>
                <td className="px-3 py-2 border text-center">{b.countMatched ?? "—"}</td>
                <td className="px-3 py-2 border text-center">{b.countModified ?? "—"}</td>
                <td className="px-3 py-2 border text-center">{b.countMissing ?? "—"}</td>
                <td className="px-3 py-2 border text-center">{b.countConflicted ?? "—"}</td>
                <td className="px-3 py-2 border">{b.note || "—"}</td>
                <td className="px-3 py-2 border text-center">
                  <button
                    onClick={() => openLogsModal(b)}
                    className="px-3 py-1 text-xs bg-blue-700 text-white rounded hover:opacity-90"
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td className="px-3 py-6 border text-center text-xs text-gray-600" colSpan={10}>
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center pt-3">
        <button
          onClick={() => fetchBatches(false)}
          disabled={loading}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50"
        >
          {loading ? "Cargando…" : "Cargar más"}
        </button>
      </div>

      {/* Modal logs */}
      <Modal
        open={openLogs}
        onClose={() => setOpenLogs(false)}
        title={
          selectedBatch
            ? `Detalle del batch · ${new Date(selectedBatch.createdAt).toLocaleString("es-PE")}`
            : "Detalle del batch"
        }
      >
        {logsLoading && <div className="text-sm text-gray-600">Cargando logs…</div>}
        {!logsLoading && logs && (
          <div className="space-y-4">
            {/* Resumen por acción */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-gray-300 bg-white p-3">
                <div className="text-[10px] uppercase text-gray-500">Asignados nuevos</div>
                <div className="text-xl font-extrabold">{groupedLogs?.assign.length || 0}</div>
              </div>
              <div className="rounded-xl border border-gray-300 bg-white p-3">
                <div className="text-[10px] uppercase text-gray-500">Reasignados</div>
                <div className="text-xl font-extrabold">{groupedLogs?.reassign.length || 0}</div>
              </div>
              <div className="rounded-xl border border-gray-300 bg-white p-3">
                <div className="text-[10px] uppercase text-gray-500">Saltados por conflicto</div>
                <div className="text-xl font-extrabold">{groupedLogs?.skip_conflict.length || 0}</div>
              </div>
            </div>

            {/* Listados por columna */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="font-semibold text-green-700 mb-1">Asignados</h4>
                <div className="border rounded p-2 max-h-64 overflow-auto text-sm">
                  {groupedLogs?.assign.map((l) => (
                    <div key={l._id} className="flex justify-between gap-2">
                      <span>{l.rucStr}</span>
                      <span className="text-gray-500">{l.newOwner?.name || l.newOwner}</span>
                    </div>
                  ))}
                  {groupedLogs?.assign.length === 0 && <div className="text-gray-500">—</div>}
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-amber-700 mb-1">Reasignados</h4>
                <div className="border rounded p-2 max-h-64 overflow-auto text-sm">
                  {groupedLogs?.reassign.map((l) => (
                    <div key={l._id} className="flex justify-between gap-2">
                      <span>{l.rucStr}</span>
                      <span className="text-gray-500">
                        {l.prevOwner?.name || l.prevOwner} → {l.newOwner?.name || l.newOwner}
                      </span>
                    </div>
                  ))}
                  {groupedLogs?.reassign.length === 0 && <div className="text-gray-500">—</div>}
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-red-700 mb-1">Conflicto (omitidos)</h4>
                <div className="border rounded p-2 max-h-64 overflow-auto text-sm">
                  {groupedLogs?.skip_conflict.map((l) => (
                    <div key={l._id} className="flex justify-between gap-2">
                      <span>{l.rucStr}</span>
                      <span className="text-gray-500">{l.prevOwner?.name || l.prevOwner}</span>
                    </div>
                  ))}
                  {groupedLogs?.skip_conflict.length === 0 && <div className="text-gray-500">—</div>}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
