// src/pages/reporteria/ReportCitas.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

// Ajusta el path si tu archivo se llama distinto (p.ej. ReportFilters.jsx)
import ReportRangeFilters from "../../components/reporteria/ReportFilters";

/* ───────────── Helpers UI inline ───────────── */
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
const REPORT_COLORS = [
  "#0ea5e9", "#14b8a6", "#f59e0b", "#a855f7",
  "#10b981", "#ef4444", "#fb7185", "#6366f1",
];
const LineTooltip = ({ active, payload, label }) =>
  !active || !payload?.length ? null : (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-md">
      <div className="text-[11px] font-semibold text-slate-700">Día {label}</div>
      <div className="text-sm font-extrabold text-slate-900">{payload[0]?.value ?? 0}</div>
    </div>
  );
const PieTooltip = ({ active, payload }) =>
  !active || !payload?.length ? null : (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-md">
      <div className="text-[11px] font-semibold text-slate-700">{payload[0]?.name}</div>
      <div className="text-sm font-extrabold text-slate-900">
        {payload[0]?.value ?? 0}{" "}
        <span className="text-[11px] font-semibold text-slate-500">
          ({payload[0]?.payload?.__pct ?? 0}%)
        </span>
      </div>
    </div>
  );
function LineGradientDef() {
  return (
    <defs>
      <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#0ea5e9" />
        <stop offset="100%" stopColor="#14b8a6" />
      </linearGradient>
    </defs>
  );
}

/* ───────────── Normalizadores ───────────── */
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

/* ───────────── Página ───────────── */
export default function ReportCitas() {
  const { token } = useAuth();
  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  // Rango
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Mes/Año para normalizar la serie (eje 1..31)
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const [loading, setLoading] = useState(false);
  const [serie, setSerie] = useState([]);
  const [dist, setDist] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = from && to ? { from, to } : { month, year };

      const r1 = await api.get("/reportes/citas/serie", { ...authHeader, params });
      const serieNorm = normalizeSerieDaysFull(r1.data?.items ?? r1.data, month, year);

      const r2 = await api.get("/reportes/citas/distribucion", { ...authHeader, params });
      let distNorm = normalizeDistribucion(r2.data?.items ?? r2.data);
      const sum = distNorm.reduce((a, b) => a + (b.value || 0), 0) || 1;
      distNorm = distNorm.map((d) => ({ ...d, __pct: Math.round((d.value * 100) / sum) }));

      setSerie(serieNorm);
      setDist(distNorm);
      if (!serieNorm?.length && !distNorm?.length) {
        setError("El servidor respondió sin datos para este filtro.");
      }
    } catch (e) {
      console.error("[Citas] load error:", e);
      setError("No se pudo cargar la reportería.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, month, year, token]);

  return (
    <div className="p-6 min-h-dvh bg-gradient-to-b from-slate-100 to-slate-50">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
          Reportería • Citas
        </h1>

        <ReportRangeFilters
          from={from}
          to={to}
          minYear={2021}
          maxYear={2026}
          onChange={({ from: f, to: t }) => {
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
          }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Box title="Línea de progreso (Citas por día)" className="lg:col-span-2">
          {loading ? <Empty text="Cargando…" /> : !serie.length ? <Empty /> : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serie} margin={{ top: 8, right: 18, bottom: 8, left: 6 }}>
                  <LineGradientDef />
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

<Box title="Distribución por tipo (Presencial / Virtual)" className="lg:col-span-1">          {loading ? <Empty text="Cargando…" /> : !dist.length ? <Empty /> : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dist} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2} isAnimationActive>
                    {dist.map((_, i) => <Cell key={i} fill={REPORT_COLORS[i % REPORT_COLORS.length]} />)}
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

      {error && (
        <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}
