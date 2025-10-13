// src/pages/reporteria/ReportTipificacionSupervisor.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar, CartesianGrid
} from "recharts";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import ReportRangeFilters from "../../components/reporteria/ReportFilters";

/* —— Helpers UI (mismo estilo) —— */
function Box({ title, children, className = "" }) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      {title && <div className="mb-2 text-sm font-semibold text-slate-700">{title}</div>}
      {children}
    </div>
  );
}
function Empty({ text = "Sin datos" }) {
  return <div className="py-12 text-center text-sm text-gray-500">{text}</div>;
}

/* —— Normalización —— */
function normalizeSerieDaysFull(data, month, year) {
  const arr = Array.isArray(data) ? data : [];
  const map = new Map(
    arr
      .map((d) => {
        const dayRaw =
          Number(d.day ?? d.x ?? d.fechaDia ?? d.d) ||
          (typeof d.date === "string" ? Number(d.date.split("-")[2]) : 0);
        return { day: dayRaw || 0, total: Number(d.total ?? d.count ?? d.y ?? d.valor ?? 0) };
      })
      .filter((d) => d.day > 0)
      .map((d) => [d.day, d.total])
  );
  const dim = new Date(year, month, 0).getDate();
  return Array.from({ length: dim }, (_, i) => {
    const day = i + 1;
    return { day, total: map.get(day) || 0 };
  });
}
function normalizeDistribucion(objOrArr) {
  if (Array.isArray(objOrArr)) {
    return objOrArr.map((it, i) => ({
      name: String(it.label ?? it.name ?? `Cat ${i + 1}`),
      value: Number(it.value ?? it.count ?? 0),
    }));
  }
  const o = objOrArr || {};
  return Object.keys(o).map((k) => ({ name: k, value: Number(o[k] || 0) }));
}

/* —— Paleta & tooltips iguales —— */
const COLORS = ["#0ea5e9","#14b8a6","#f59e0b","#a855f7","#10b981","#ef4444","#fb7185","#6366f1"];
const LineTooltip = ({ active, payload, label }) =>
  !active || !payload?.length ? null : (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-md">
      <div className="text-[11px] font-semibold text-slate-700">Día {label}</div>
      <div className="text-sm font-extrabold text-slate-900">{payload[0].value ?? 0}</div>
    </div>
  );
const PieTooltip = ({ active, payload }) =>
  !active || !payload?.length ? null : (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-md">
      <div className="text-[11px] font-semibold text-slate-700">{payload[0].name}</div>
      <div className="text-sm font-extrabold text-slate-900">
        {payload[0].value}{" "}
        <span className="text-[11px] font-semibold text-slate-500">
          ({payload[0].payload.__pct ?? 0}%)
        </span>
      </div>
    </div>
  );

export default function ReportTipificacionSupervisor() {
  const { token } = useAuth();
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  // Rangos
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  // Equipo (para filtro)
  const [members, setMembers] = useState([]);         // [{_id, name}]
  const [selectedIds, setSelectedIds] = useState([]); // array<string>

  // Datos
  const [loading, setLoading] = useState(false);
  const [serie, setSerie] = useState([]);
  const [dist, setDist] = useState([]);
  const [bars, setBars] = useState([]); // [{ ejecutivo, total }]
  const [error, setError] = useState("");

  // Carga barras + miembros (del equipo del supervisor)
 const loadBarsAndMembers = async () => {
  const base = from && to ? { from, to } : { month, year };
  const { data } = await api.get("/reportes/tipificacion/por-ejecutivo", { ...authHeader, params: base });

  const items = Array.isArray(data?.items) ? data.items : [];
  setBars(items);

  // usa members si vienen; si no, derivar desde items (requiere ejecutivoId)
  const mem = Array.isArray(data?.members)
    ? data.members
    : items.filter(i => i.ejecutivoId).map(i => ({ _id: i.ejecutivoId, name: i.ejecutivo }));

  setMembers(mem);

  // selecciona TODOS por defecto
  if (mem.length) {
    const allIds = mem.map(m => String(m._id));
    setSelectedIds(prev => (prev.length ? prev : allIds));
  }
};
  const loadSerieAndDist = async () => {
    setLoading(true);
    setError("");
    try {
      const base = from && to ? { from, to } : { month, year };

      // Pasamos los userIds seleccionados (si hay); si no hay, el endpoint
      // por defecto usaría req.user — por eso nos aseguramos de enviar TODOS
      // los ids del equipo cuando está "Todos".
      const userIds = selectedIds.length ? selectedIds : members.map(m => String(m._id));

      const params = { ...base, ...(userIds.length ? { userIds } : {}) };

      const r1 = await api.get("/reportes/tipificacion/serie", { ...authHeader, params });
      const serieNorm = normalizeSerieDaysFull(r1.data?.items ?? r1.data, month, year);

      const r2 = await api.get("/reportes/tipificacion/distribucion", { ...authHeader, params });
      let distNorm = normalizeDistribucion(r2.data?.items ?? r2.data);
      const sum = distNorm.reduce((a, b) => a + (b.value || 0), 0) || 1;
      distNorm = distNorm.map((d) => ({ ...d, __pct: Math.round((d.value * 100) / sum) }));

      setSerie(serieNorm);
      setDist(distNorm);

      if (!serieNorm?.length && !distNorm?.length) setError("El servidor respondió sin datos para este filtro.");
    } catch (e) {
      console.error("[Supervisor Tipificación] load error:", e);
      setError("No se pudo cargar la reportería.");
    } finally {
      setLoading(false);
    }
  };

  // Primera carga: barras + miembros
  useEffect(() => {
    loadBarsAndMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, month, year, token]);

  // Cargar serie/dona cuando cambian filtros o selección
useEffect(() => {
  if (!members.length) return;       // 👈 importante
  loadSerieAndDist();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [from, to, month, year, token, members.length, selectedIds.join(",")]);

  // UI handlers
  const onRangeChange = ({ from: f, to: t }) => {
    setFrom(f);
    setTo(t);
    if (f) {
      const d = new Date(`${f}T00:00:00`);
      setMonth(d.getMonth() + 1);
      setYear(d.getFullYear());
    }
    if (!f && !t) {
      const now = new Date();
      setMonth(now.getMonth() + 1);
      setYear(now.getFullYear());
    }
  };

  return (
    <div className="p-6 min-h-dvh bg-gradient-to-b from-slate-100 to-slate-50">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
          Reportería • Tipificación (Supervisor)
        </h1>

        <div className="flex items-center gap-2">
          {/* Filtro de rango (igual que en la vista personal) */}
          <ReportRangeFilters from={from} to={to} minYear={2021} maxYear={2026} onChange={onRangeChange} />

          {/* Selector múltiple de ejecutivos del equipo */}
          <select
            multiple
            value={selectedIds}
            onChange={(e) => {
              const ids = Array.from(e.target.selectedOptions).map((o) => o.value);
              setSelectedIds(ids);
            }}
            className="min-w-56 border border-gray-300 rounded px-3 py-3 text-[12px] bg-white"
            title="Selecciona uno o varios ejecutivos del equipo"
          >
            {members.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid: línea + dona */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Box title="Línea de progreso (Tipificación por día)" className="lg:col-span-2">
          {loading ? <Empty text="Cargando…" /> : !serie.length ? <Empty /> : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serie} margin={{ top: 8, right: 18, bottom: 8, left: 6 }}>
                  <defs>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#0ea5e9" />
                      <stop offset="100%" stopColor="#14b8a6" />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip content={<LineTooltip />} />
                  <Line type="monotone" dataKey="total" stroke="url(#lineGrad)" strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 5 }}>
                    <LabelList dataKey="total" position="top" style={{ fontSize: 10, fill: "#334155" }} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Box>

        <Box title="Distribución de tipificación" className="lg:col-span-1">
          {loading ? <Empty text="Cargando…" /> : !dist.length ? <Empty /> : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dist} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2} isAnimationActive>
                    {dist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    <LabelList dataKey="__pct" formatter={(v) => (v > 0 ? `${v}%` : "")} position="outside" style={{ fontSize: 10, fill: "#334155" }} />
                  </Pie>
                  <Legend verticalAlign="bottom" height={40} wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Box>
      </div>

      {/* Barras horizontales por ejecutivo */}
      <div className="mt-3">
        <Box title="Tipificaciones por Ejecutivo (equipo)" className="lg:col-span-3">
          {!bars.length ? <Empty /> : (
            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={bars}
                  layout="vertical"
                  margin={{ top: 12, right: 18, left: 100, bottom: 12 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="ejecutivo" width={120} />
                  <Tooltip />
                  <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 4, 4]}>
                    <LabelList dataKey="total" position="right" style={{ fontSize: 12, fill: "#334155" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Box>
      </div>

      {error && (
        <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}
