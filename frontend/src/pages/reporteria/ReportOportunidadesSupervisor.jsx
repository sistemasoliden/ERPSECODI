// src/pages/reporteria/ReportOportunidadesSupervisor.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import ReportRangeFilters from "../../components/reporteria/ReportFilters";
import qs from "qs";
import { Bold } from "lucide-react";

/* ========= THEME ========= */
const THEME = {
  pageBg: "#F2F0F0",
  card: "rounded-lg border border-gray-300 bg-white p-4 shadow-md",
  tooltipBox: {
    backgroundColor: "white",
    border: "1px solid #ddd",
    borderRadius: "8px",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
    padding: "8px 12px",
    fontSize: "12px",
    color: "black",
    textAlign: "center",
  },
  tooltipLabel: { color: "#111827", fontWeight: "bold", fontSize: "13px" },
  lineColor: "#af0c0e",
  colors: [
    "#0ea5e9",
    "#14b8a6",
    "#f59e0b",
    "#a855f7",
    "#10b981",
    "#ef4444",
    "#fb7185",
    "#6366f1",
  ],
};

/* ========= UI helpers ========= */
function Box({ title, children, className = "" }) {
  return (
    <div className={`${THEME.card} ${className}`}>
      {title && (
        <div className="mb-2 mt-2 ml-7 text-xs font-bold text-red-900">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
function Empty({ text = "Sin datos" }) {
  return <div className="py-12 text-center text-sm text-gray-500">{text}</div>;
}
const fmtNum = (n) =>
  new Intl.NumberFormat("es-PE").format(Math.round(Number(n || 0)));
const fmtCurrency = (v = 0) =>
  (Number(v) || 0).toLocaleString("es-PE", {
    style: "currency",
    currency: "PEN",
    maximumFractionDigits: 0,
  });

/* ========= Tooltips ========= */
const LineTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        ...THEME.tooltipBox,
        backgroundColor: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 4, // borde sutil
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        padding: "6px 8px", // compacto
      }}
    >
      <div
        style={{
          ...THEME.tooltipLabel,
          color: "#475569",
          fontSize: 10, // letra xs
          fontWeight: 600,
          textTransform: "uppercase",
          marginBottom: 2,
        }}
      >
        Día {label}
      </div>

      <div className="text-[11px] font-bold text-slate-900 leading-tight">
        {fmtNum(payload[0]?.value ?? 0)}
      </div>
    </div>
  );
};

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        ...THEME.tooltipBox,
        backgroundColor: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 4, // redondeo leve
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        padding: "6px 8px", // compacto
      }}
    >
      <div
        style={{
          ...THEME.tooltipLabel,
          color: "#475569",
          fontSize: 10,
          fontWeight: 600,
          textTransform: "uppercase",
          marginBottom: 2,
        }}
      >
        {payload[0]?.name}
      </div>

      <div className="text-[11px] font-bold text-slate-900 leading-tight">
        {fmtNum(payload[0]?.value ?? 0)}{" "}
        <span className="text-[10px] font-semibold text-slate-500">
          ({payload[0]?.payload?.__pct ?? 0}%)
        </span>
      </div>
    </div>
  );
};

function LineGradientDef() {
  return (
    <defs>
      <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={THEME.lineColor} />
        <stop offset="100%" stopColor={THEME.lineColor} />
      </linearGradient>
    </defs>
  );
}

/* ========= Normalizadores ========= */
function normalizeSerieDaysFull(data, month, year) {
  const arr = Array.isArray(data) ? data : [];
  const map = new Map(
    arr
      .map((d) => {
        const dayRaw =
          Number(d.day ?? d.x ?? d.fechaDia ?? d.d) ||
          (typeof d.date === "string" ? Number(d.date.split("-")[2]) : 0);
        return {
          day: dayRaw || 0,
          total: Number(d.total ?? d.count ?? d.y ?? d.valor ?? 0),
        };
      })
      .filter((d) => d.day > 0)
      .map((d) => [d.day, d.total])
  );
  const dim = new Date(year, month, 0).getDate();
  return Array.from({ length: dim }, (_, i) => ({
    day: i + 1,
    total: map.get(i + 1) || 0,
  }));
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

/* ========= Multi-select Ejecutivos (con buscador + Todos/Ninguno) ========= */
function ExecMultiSelect({ members, value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const allIds = members.map((m) => String(m._id));
  const selected = new Set(value);
  const filtered = members.filter((m) =>
    (m.name || "").toLowerCase().includes(filter.toLowerCase())
  );

  const toggleOne = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange(Array.from(next));
  };
  const selectAll = () => onChange(allIds);
  const selectNone = () => onChange([]);

  const label = () => {
    if (!value.length) return "Sin selección";
    if (value.length === members.length) return "Todos";
    if (value.length <= 2)
      return members
        .filter((m) => value.includes(String(m._id)))
        .map((m) => m.name)
        .join(", ");
    return `${value.length} seleccionados`;
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-12 min-w-56 inline-flex items-center justify-between rounded-lg border border-gray-900 bg-white px-3 text-[12px]"
        title="Selecciona uno o varios ejecutivos del equipo"
      >
        <span className="truncate pr-2">{label()}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-slate-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-[280px] rounded-lg border border-gray-300 bg-white shadow-md">
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar ejecutivos…"
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-[12px]"
            />
          </div>
          <div className="p-2 flex items-center justify-between gap-2 border-b border-gray-200">
            <button
              type="button"
              onClick={selectAll}
              className="text-[11px] rounded border border-gray-300 px-2 py-1 bg-white hover:bg-gray-50"
            >
              Todos
            </button>
            <button
              type="button"
              onClick={selectNone}
              className="text-[11px] rounded border border-gray-300 px-2 py-1 bg-white hover:bg-gray-50"
            >
              Ninguno
            </button>
          </div>
          <div className="max-h-64 overflow-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-[12px] text-gray-500">
                Sin resultados
              </div>
            )}
            {filtered.map((m) => {
              const id = String(m._id);
              return (
                <label
                  key={id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-[12px]"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(id)}
                    onChange={() => toggleOne(id)}
                    className="h-3 w-3 rounded border-gray-400"
                  />
                  <span className="truncate">{m.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ========= Página ========= */
export default function ReportOportunidadesSupervisor() {
  const { token } = useAuth();
  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  // Rango
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  // Equipo
  const [members, setMembers] = useState([]); // [{_id, name}]
  const [selectedIds, setSelectedIds] = useState([]); // array<string>
  const didInitSelection = useRef(false);

  // Datos
  const [loading, setLoading] = useState(false);
  const [serie, setSerie] = useState([]);
  const [dist, setDist] = useState([]);
  const [bars, setBars] = useState([]); // [{ ejecutivoId, ejecutivo, total }]
  const [error, setError] = useState("");

  // Mini-resumen (Monto/Cantidad)
  const [miniEstado, setMiniEstado] = useState("ganada"); // "ganada" | "neg_aprobada" | "both"
  const [miniSerieMonto, setMiniSerieMonto] = useState([]);
  const [miniSerieCantidad, setMiniSerieCantidad] = useState([]);
  const [loadingMini, setLoadingMini] = useState(false);

  /* Helpers (puedes moverlos arriba del archivo) */
  const niceNumber = (v = 0) => (Number(v) || 0).toLocaleString("es-PE");

  const rankColor = (i) => {
    // top-3 resaltados, resto azul suave
    const TOP = ["#16a34a", "#0ea5e9", "#f59e0b"];
    return i < 3 ? TOP[i] : "#2563eb";
  };

  const PrettyBarTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="rounded-[4px] border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm text-center">
        <div className="text-[10px] font-semibold uppercase text-slate-600 tracking-wide mb-0.5">
          {label}
        </div>
        <div className="text-[11px] font-bold text-slate-900 leading-tight">
          {niceNumber(payload[0]?.value ?? 0)}
        </div>
      </div>
    );
  };

  const yTickFormatter = (v = "") =>
    String(v).length > 26 ? String(v).slice(0, 24) + "…" : v;

  const getRangeParams = () => (from && to ? { from, to } : { month, year });

  /* 1) Cargar barras y miembros */
  const loadBarsAndMembers = async () => {
    try {
      const base = getRangeParams();
      const { data } = await api.get("/reportes/oportunidades/por-ejecutivo", {
        ...authHeader,
        params: base,
      });
      const items = Array.isArray(data?.items) ? data.items : [];
      setBars(items);

      const mem = Array.isArray(data?.members)
        ? data.members
        : items
            .filter((i) => i.ejecutivoId)
            .map((i) => ({ _id: i.ejecutivoId, name: i.ejecutivo }));
      setMembers(mem);

      if (mem.length && !didInitSelection.current) {
        setSelectedIds(mem.map((m) => String(m._id))); // todos al inicio
        didInitSelection.current = true;
      }
    } catch (e) {
      setMembers([]);
      setBars([]);
    }
  };

  /* 2) Serie + Distribución (respetan userIds) */
  const loadSerieAndDist = async () => {
    if (selectedIds.length === 0) {
      setSerie([]);
      setDist([]);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const base = getRangeParams();
      const common = {
        ...authHeader,
        params: { ...base, userIds: selectedIds },
        paramsSerializer: (p) => qs.stringify(p, { arrayFormat: "brackets" }),
      };

      const r1 = await api.get("/reportes/oportunidades/serie", common);
      const serieNorm = normalizeSerieDaysFull(
        r1.data?.items ?? r1.data,
        base.month ?? month,
        base.year ?? year
      );

      const r2 = await api.get("/reportes/oportunidades/distribucion", common);
      let distNorm = normalizeDistribucion(r2.data?.items ?? r2.data);
      const sum = distNorm.reduce((a, b) => a + (b.value || 0), 0) || 1;
      distNorm = distNorm.map((d) => ({
        ...d,
        __pct: Math.round((d.value * 100) / sum),
      }));

      setSerie(serieNorm);
      setDist(distNorm);
      if (!serieNorm?.length && !distNorm?.length)
        setError("El servidor respondió sin datos para este filtro.");
    } catch (e) {
      console.error("[Supervisor Oportunidades] load error:", e);
      setError("No se pudo cargar la reportería.");
    } finally {
      setLoading(false);
    }
  };

  /* 3) Mini-resumen (Monto/Cantidad con userIds) */
  const loadMiniBoth = async () => {
    if (selectedIds.length === 0) {
      setMiniSerieMonto([]);
      setMiniSerieCantidad([]);
      return;
    }
    setLoadingMini(true);
    try {
      const baseParams = getRangeParams();
      const commonReq = {
        ...authHeader,
        paramsSerializer: (p) => qs.stringify(p, { arrayFormat: "brackets" }),
      };
      const commonParams = {
        ...baseParams,
        estado: miniEstado,
        userIds: selectedIds,
      };

      const [rMonto, rCant] = await Promise.all([
        api.get("/oportunidades/reportes/por-tipo-venta-resumen", {
          ...commonReq,
          params: { ...commonParams, metric: "monto" },
        }),
        api.get("/oportunidades/reportes/por-tipo-venta-resumen", {
          ...commonReq,
          params: { ...commonParams, metric: "cantidad" },
        }),
      ]);

      setMiniSerieMonto(
        Array.isArray(rMonto?.data?.items) ? rMonto.data.items : []
      );
      setMiniSerieCantidad(
        Array.isArray(rCant?.data?.items) ? rCant.data.items : []
      );
    } catch {
      setMiniSerieMonto([]);
      setMiniSerieCantidad([]);
    } finally {
      setLoadingMini(false);
    }
  };

  /* Efectos */
  useEffect(() => {
    loadBarsAndMembers(); /* eslint-disable-next-line */
  }, [from, to, month, year, token]);
  useEffect(() => {
    loadSerieAndDist(); /* eslint-disable-next-line */
  }, [from, to, month, year, token, selectedIds.join(",")]);
  useEffect(() => {
    loadMiniBoth(); /* eslint-disable-next-line */
  }, [from, to, month, year, miniEstado, selectedIds.join(",")]);

  /* Totales (tarjetas) */
  const totalFromDist = React.useMemo(
    () => dist.reduce((acc, d) => acc + (Number(d.value) || 0), 0),
    [dist]
  );
  const totalFromSerie = React.useMemo(
    () => serie.reduce((acc, d) => acc + (Number(d.total) || 0), 0),
    [serie]
  );
  const totalOportunidades = totalFromDist || totalFromSerie || 0;

  const totalMonto = React.useMemo(
    () => miniSerieMonto.reduce((acc, it) => acc + (Number(it?.valor) || 0), 0),
    [miniSerieMonto]
  );
  const totalCantidad = React.useMemo(
    () =>
      miniSerieCantidad.reduce((acc, it) => acc + (Number(it?.valor) || 0), 0),
    [miniSerieCantidad]
  );

  /* Rango + limpiar */
  const onRangeChange = ({ from: f, to: t }) => {
    setFrom(f || "");
    setTo((prev) => {
      const candidate = (t ?? prev) || "";
      if (f && candidate && candidate < f) return f;
      return candidate;
    });
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
  const onClear = () => {
    setFrom("");
    setTo("");
    const now = new Date();
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
    setSelectedIds(members.map((m) => String(m._id))); // vuelve a TODOS
  };

  return (
    <div className="p-6 min-h-dvh" style={{ background: THEME.pageBg }}>
      {/* Header: KPIs + filtros */}
      <div className="mb-3 flex flex-col lg:flex-row items-start lg:items-center justify-start gap-3">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-fit ml-0 mr-auto">
          {/* Total oportunidades */}
          <div
            className={`${THEME.card} flex flex-col items-center justify-center text-center border border-black w-[180px] h-[90px] py-4`}
          >
            <div className="p-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-700 mb-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18 20a6 6 0 10-12 0m12 0a6 6 0 00-12 0m12 0h-2m-8 0H6m6-12a4 4 0 110-8 4 4 0 010 8z"
                />
              </svg>
            </div>
            <div className="text-[10px] uppercase tracking-wide text-gray-600">
              Total de oportunidades
            </div>
            <div className="text-sm font-extrabold text-slate-900 mt-0.5">
              {fmtNum(totalOportunidades)}
            </div>
          </div>

          {/* Monto total */}
          <div
            className={`${THEME.card} flex flex-col items-center justify-center text-center border border-black w-[180px] h-[90px] py-2`}
          >
            <div className="p-1 rounded-full bg-sky-50 text-sky-700 border border-sky-700 mb-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8c-2.21 0-4 1.343-4 3s1.79 3 4 3 4 1.343 4 3-1.79 3-4 3m0-12c2.21 0 4 1.343 4 3M12 6v12"
                />
              </svg>
            </div>
            <div className="text-[10px] uppercase tracking-wide text-gray-600">
              Monto total (S/.)
            </div>
            <div className="text-sm font-extrabold text-slate-900 mt-0.5">
              {fmtCurrency(totalMonto)}
            </div>
          </div>

          {/* Cantidad total */}
          <div
            className={`${THEME.card} flex flex-col items-center justify-center text-center border border-black w-[180px] h-[90px] py-2`}
          >
            <div className="p-1 rounded-full bg-violet-50 text-violet-700 border border-violet-700 mb-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 7l9-4 9 4-9 4-9-4zm0 6l9 4 9-4M3 7v6m18-6v6M3 13v4l9 4 9-4v-4"
                />
              </svg>
            </div>
            <div className="text-[10px] uppercase tracking-wide text-gray-600">
              Cantidad total
            </div>
            <div className="text-sm font-extrabold text-slate-900 mt-0.5">
              {fmtNum(totalCantidad)}
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <ReportRangeFilters
            from={from}
            to={to}
            minYear={2021}
            maxYear={2026}
            onChange={onRangeChange}
          />
          <ExecMultiSelect
            members={members}
            value={selectedIds}
            onChange={setSelectedIds}
          />
          <button
            type="button"
            onClick={onClear}
            className="h-12 px-8 rounded-lg text-xs bg-white border border-gray-900"
            title="Volver al mes actual"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Línea + Dona */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Box title="Mensual • Oportunidades por día" className="lg:col-span-2">
          {loading ? (
            <Empty text="Cargando…" />
          ) : !serie.length ? (
            <Empty />
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={serie}
                  margin={{ top: 12, right: 20, bottom: 10, left: -30 }}
                >
                  <LineGradientDef />
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fontWeight: "bold", fill: "black" }}
                    interval={0}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={false}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<LineTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: "bold",
                          textTransform: "capitalize",
                        }}
                      >
                        {value}
                      </span>
                    )}
                    wrapperStyle={{ fontSize: 10 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="url(#lineGrad)"
                    strokeWidth={1.8}
                    dot={{ r: 2 }}
                    activeDot={{ r: 5 }}
                  >
                    <LabelList
                      dataKey="total"
                      position="top"
                      formatter={(v) => fmtNum(v)}
                      style={{ fontSize: 10, fill: "#111" }}
                    />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Box>

        <Box title="Distribución por etapa" className="lg:col-span-1">
          {loading ? (
            <Empty text="Cargando…" />
          ) : !dist.length ? (
            <Empty />
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 8, left: 8, bottom: 40 }}>
                  <Pie
                    data={dist}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="45%"
                    outerRadius="85%"
                    paddingAngle={6}
                    cornerRadius={10}
                    labelLine={false}
                    label={({
                      cx,
                      cy,
                      midAngle,
                      innerRadius,
                      outerRadius,
                      value,
                    }) => {
                      const RAD = Math.PI / 180;
                      const r = innerRadius + (outerRadius - innerRadius) / 2;
                      const x = cx + r * Math.cos(-midAngle * RAD);
                      const y = cy + r * Math.sin(-midAngle * RAD);
                      return (
                        <text
                          x={x}
                          y={y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={10}
                          fill="#111"
                          fontWeight="bold"
                        >
                          {fmtNum(value)}
                        </text>
                      );
                    }}
                  >
                    {dist.map((_, i) => (
                      <Cell
                        key={i}
                        fill={THEME.colors[i % THEME.colors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    verticalAlign="bottom"
                    align="center"
                    formatter={(value) => (
                      <span
                        style={{
                          fontSize: 10, // letra pequeña
                          fontWeight: "bold", // en negrita
                          textTransform: "capitalize", // mayúsculas
                        }}
                      >
                        {value}
                      </span>
                    )}
                    wrapperStyle={{ fontSize: 10 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Box>
      </div>

      {/* Mini: Monto / Cantidad por tipo de venta */}
      <div className="mt-3 grid grid-cols-1">
        <div className={`${THEME.card}`}>
          <div className="flex items-center gap-2 pb-3 ml-7 mt-2 ">
            <button
              type="button"
              onClick={() => setMiniEstado("ganada")}
              className={`h-10 px-3 rounded-lg text-xs border ${
                miniEstado === "ganada"
                  ? "bg-emerald-700 border-emerald-700 text-white"
                  : "bg-white border-gray-300 text-gray-800 hover:bg-gray-50"
              }`}
            >
              Cerradas ganadas
            </button>
            <button
              type="button"
              onClick={() => setMiniEstado("neg_aprobada")}
              className={`h-10 px-3 rounded-lg text-xs border ${
                miniEstado === "neg_aprobada"
                  ? "bg-indigo-700 border-indigo-700 text-white"
                  : "bg-white border-gray-300 text-gray-800 hover:bg-gray-50"
              }`}
            >
              Negociación aprobada
            </button>
            <button
              type="button"
              onClick={() => setMiniEstado("both")}
              className={`h-10 px-6 rounded-lg text-xs border ${
                miniEstado === "both"
                  ? "bg-gray-800 border-gray-800 text-white"
                  : "bg-white border-gray-300 text-gray-800 hover:bg-gray-50"
              }`}
            >
              Ambas
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Monto */}
            <div className="h-[300px]">
              <div className="ml-7 mb-1 text-xs font-bold text-red-900">
                Por tipo de venta — Monto
              </div>
              {loadingMini ? (
                <Empty text="Cargando…" />
              ) : !miniSerieMonto.length || selectedIds.length === 0 ? (
                <Empty text="Sin datos para el filtro seleccionado" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={miniSerieMonto}
                    margin={{ top: 30, right: 18, bottom: 25, left: -30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="tipo"
                      tick={{ fontSize: 10, fontWeight: "bold" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={false}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        ...THEME.tooltipBox,
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: 4, // redondeo leve
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                        padding: "6px 8px", // compacto
                      }}
                      labelStyle={{
                        ...THEME.tooltipLabel,
                        color: "#475569",
                        fontSize: 10, // letra xs
                        fontWeight: 600,
                        textTransform: "uppercase",
                        marginBottom: 2,
                      }}
                      formatter={(value) => [fmtNum(value), "Monto"]}
                      itemStyle={{
                        color: "#0f172a",
                        fontSize: 10,
                        fontWeight: 500,
                      }}
                      labelFormatter={(v) => v}
                      cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    />

                    <Bar
                      dataKey="valor"
                      fill={THEME.colors[0]}
                      radius={[4, 4, 0, 0]}
                      barSize={40}
                      minPointSize={5}
                    >
                      <LabelList
                        dataKey="valor"
                        position="top"
                        formatter={(v) => fmtNum(v)}
                        style={{
                          fontWeight: "bold",
                          fontSize: 10,
                          fill: "#111",
                        }}
                      />
                    </Bar>
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => (
                        <span
                          style={{
                            fontSize: 10, // letra más pequeña
                            fontWeight: "bold", // en negrita
                            textTransform: "capitalize", // todo en mayúsculas
                          }}
                        >
                          {value}
                        </span>
                      )}
                      wrapperStyle={{ fontSize: 10 }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Cantidad */}
            <div className="h-[300px]">
              <div className="ml-7 mb-1 text-xs font-bold text-red-900">
                Por tipo de venta — Cantidad
              </div>
              {loadingMini ? (
                <Empty text="Cargando…" />
              ) : !miniSerieCantidad.length || selectedIds.length === 0 ? (
                <Empty text="Sin datos para el filtro seleccionado" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={miniSerieCantidad}
                    margin={{ top: 30, right: 18, bottom: 25, left: -30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="tipo"
                      tick={{ fontSize: 10, fontWeight: "bold" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={false}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        ...THEME.tooltipBox,
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: 4, // leve redondeo
                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                        padding: "6px 8px", // compacto
                      }}
                      labelStyle={{
                        ...THEME.tooltipLabel,
                        color: "#475569",
                        fontSize: 10, // letra xs
                        fontWeight: 600,
                        textTransform: "uppercase",
                        marginBottom: 2,
                      }}
                      formatter={(value) => [fmtNum(value), "Cantidad"]}
                      itemStyle={{
                        color: "#0f172a",
                        fontSize: 10,
                        fontWeight: 500,
                      }}
                      labelFormatter={(v) => v}
                      cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    />
                    <Bar
                      dataKey="valor"
                      fill={THEME.colors[1]}
                      radius={[4, 4, 0, 0]}
                      barSize={40}
                      minPointSize={5}
                    >
                      <LabelList
                        dataKey="valor"
                        position="top"
                        dy={-7}
                        formatter={(v) => fmtNum(v)}
                        style={{
                          fontSize: 10,
                          fill: "#111",
                          fontWeight: "bold",
                        }}
                      />
                    </Bar>
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => (
                        <span
                          style={{
                            fontSize: 10, // letra más pequeña
                            fontWeight: "bold", // en negrita
                            textTransform: "capitalize", // todo en mayúsculas
                          }}
                        >
                          {value}
                        </span>
                      )}
                      wrapperStyle={{ fontSize: 10 }}
                    />{" "}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Barras por ejecutivo */}
      <div className="mt-3">
        <Box title="Oportunidades por Ejecutivo ">
          {!bars.length ? (
            <Empty />
          ) : (
            <>
              {/* mini-leyenda con totales */}
              <div className="flex flex-wrap items-center gap-2 mt-4 ml-4">
                <span className="inline-flex items-center gap-2  px-3 py-1.5 ">
                  <span className="text-gray-900 text-xs font-medium capitalize tracking-wide">
                    Ejecutivos
                  </span>
                  <strong className="text-gray-900 text-xs font-bold">
                    {bars.length}
                  </strong>
                </span>

                <span className="inline-flex items-center gap-2  px-3 py-1.5 ">
                  <span className="text-gray-900 text-xs font-medium capitalize tracking-wide">
                    Total oportunidades
                  </span>
                  <strong className="text-gray-900 text-xs font-bold">
                    {niceNumber(
                      bars.reduce((a, b) => a + (Number(b.total) || 0), 0)
                    )}
                  </strong>
                </span>
              </div>

              <div className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={bars}
                    layout="vertical"
                    margin={{ top: 12, right: 24, left: 30, bottom: 12 }}
                    barCategoryGap={8}
                  >
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#93c5fd" />
                        <stop offset="100%" stopColor="#2563eb" />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="2 4" stroke="#828386ff" />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fontSize: 11,
                        fill: "#475569",
                        fontWeight: "bold",
                      }}
                      domain={[
                        0,
                        (dataMax) =>
                          dataMax + Math.max(2, Math.round(dataMax * 0.05)),
                      ]}
                    />
                    <YAxis
                      type="category"
                      dataKey="ejecutivo"
                      width={150}
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fontSize: 10,
                        fill: "#334155",
                        fontWeight: "bold",
                      }}
                      tickFormatter={yTickFormatter}
                    />
                    <Tooltip content={<PrettyBarTooltip />} />

                    <Bar
                      dataKey="total"
                      radius={[0, 3, 3, 0]}
                      minPointSize={2}
                      barSize={30} // ← aumenta o reduce este valor (20 por defecto aprox.)
                    >
                      {/* Colorear por ranking */}
                      {bars.map((_, i) => (
                        <Cell key={`c-${i}`} fill={rankColor(i)} />
                      ))}
                      <LabelList
                        dataKey="total"
                        position="right"
                        formatter={(v) => niceNumber(v)}
                        style={{
                          fontSize: 10,
                          fill: "#334155",
                          fontWeight: 700,
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
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
