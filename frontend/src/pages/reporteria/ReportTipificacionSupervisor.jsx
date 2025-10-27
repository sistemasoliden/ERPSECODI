// src/pages/reporteria/ReportTipificacionSupervisor.jsx
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
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import ReportRangeFilters from "../../components/reporteria/ReportFilters";
import qs from "qs";
import { Bold } from "lucide-react";

/* ================== THEME / ESTILOS ================== */
const THEME = {
  pageBg: "#F2F0F0",
  card: "rounded-lg border border-gray-300 bg-white p-4 shadow-md",
  section: "rounded-lg border border-gray-200 bg-white p-4 shadow-sm",
  title: "text-sm font-bold text-blue-800",
  tooltipBox: {
    backgroundColor: "white",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,.08)",
    padding: "8px 12px",
    fontSize: "12px",
    color: "#0f172a",
    textAlign: "center",
  },
  tooltipLabel: { color: "#0f172a", fontWeight: "bold", fontSize: "13px" },
  lineColor: "#0ea5e9",
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

/* ───────────── Helpers UI ───────────── */
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

/* ───────────── Formateo ───────────── */
const formatNumber = (n) =>
  new Intl.NumberFormat("es-PE").format(Math.round(Number(n || 0)));

/* Tooltips unificados */
const LineTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        ...THEME.tooltipBox,
        backgroundColor: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 4, // redondeo leve
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        padding: "6px 8px",
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
        Día {label}
      </div>

      <div className="text-[11px] font-bold text-slate-900 leading-tight">
        {formatNumber(payload[0]?.value ?? 0)}
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
        padding: "6px 8px",
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
        {formatNumber(payload[0]?.value ?? 0)}{" "}
        <span className="text-[10px] font-semibold text-slate-500">
          ({payload[0]?.payload?.__pct ?? 0}%)
        </span>
      </div>
    </div>
  );
};

/* Gradiente línea */
function LineGradientDef() {
  return (
    <defs>
      <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={THEME.lineColor} />
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
        return {
          day: dayRaw || 0,
          total: Number(d.total ?? d.count ?? d.y ?? d.valor ?? 0),
        };
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

/* ───────────── Multi-select de ejecutivos (con búsqueda) ───────────── */
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
    if (next.has(id)) next.delete(id);
    else next.add(id);
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
          className="h-4 w-4 text-slate-700"
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
        <div className="absolute z-20 mt-1 w-[280px] rounded-lg border border-gray-900 bg-white shadow-md">
          <div className="p-2 border-b border-gray-200 flex items-center gap-2">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar ejecutivos…"
              className="w-full rounded-md border border-gray-900 px-2 py-1 text-[12px]"
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
              const checked = selected.has(id);
              return (
                <label
                  key={id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-[12px]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
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

/* ───────────── Página ───────────── */
export default function ReportTipificacionSupervisor() {
  const { token } = useAuth();
  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  // Rangos
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  // Equipo
  const [members, setMembers] = useState([]); // [{_id, name}]
  const [selectedIds, setSelectedIds] = useState([]); // array<string>

  // Datos
  const [loading, setLoading] = useState(false);
  const [serie, setSerie] = useState([]);
  const [dist, setDist] = useState([]);
  const [bars, setBars] = useState([]); // [{ ejecutivoId, ejecutivo, total }]
  const [error, setError] = useState("");
  // Efectividad (Base vs Oportunidades)
  const [effRows, setEffRows] = useState([]);
  const [loadingEff, setLoadingEff] = useState(false);

  // 1) barras + miembros del equipo
  const loadBarsAndMembers = async () => {
    try {
      const base = from && to ? { from, to } : { month, year };
      const { data } = await api.get("/reportes/tipificacion/por-ejecutivo", {
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

      if (mem.length) {
        const allIds = mem.map((m) => String(m._id));
        setSelectedIds((prev) => (prev.length ? prev : allIds));
      }
    } catch (e) {
      console.error("[Supervisor Tipificación] load members/bars error:", e);
      setBars([]);
      setMembers([]);
    }
  };

  // 2) serie + distribución (con userIds seleccionados)
  const loadSerieAndDist = async () => {
    setLoading(true);
    setError("");
    try {
      // Si está “Ninguno”, limpiar y no consultar
      if (!selectedIds.length) {
        setSerie([]);
        setDist([]);
        setLoading(false);
        return;
      }

      const base = from && to ? { from, to } : { month, year };
      const params = { ...base, userIds: selectedIds };
      const common = {
        ...authHeader,
        params,
        paramsSerializer: (p) => qs.stringify(p, { arrayFormat: "brackets" }),
      };

      const r1 = await api.get("/reportes/tipificacion/serie", common);
      const serieNorm = normalizeSerieDaysFull(
        r1.data?.items ?? r1.data,
        params.month ?? month,
        params.year ?? year
      );

      const r2 = await api.get("/reportes/tipificacion/distribucion", common);
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
      console.error("[Supervisor Tipificación] load error:", e);
      setError("No se pudo cargar la reportería.");
    } finally {
      setLoading(false);
    }
  };

  const loadEfectividad = async () => {
    setLoadingEff(true);
    try {
      const base = from && to ? { from, to } : { month, year };
      const params = { ...base, userIds: selectedIds };
      const { data } = await api.get("/reportes/tipificacion/efectividad", {
        ...authHeader,
        params,
        paramsSerializer: (p) => qs.stringify(p, { arrayFormat: "brackets" }),
      });
      setEffRows(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      console.error("[Supervisor Tipificación] efectividad error:", e);
      setEffRows([]);
    } finally {
      setLoadingEff(false);
    }
  };

  // Primera carga
  useEffect(() => {
    loadBarsAndMembers(); /* eslint-disable-next-line */
  }, [from, to, month, year, token]);

  useEffect(() => {
    if (!members.length) return;
    loadEfectividad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, month, year, token, members.length, selectedIds.join(",")]);

  // Recalcular serie/dona cuando cambie selección o rango
  useEffect(() => {
    if (!members.length) return;
    loadSerieAndDist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, month, year, token, members.length, selectedIds.join(",")]);

  const onRangeChange = ({ from: f, to: t }) => {
    setFrom(f || "");
    setTo((prevTo) => {
      const candidate = (t ?? prevTo) || "";
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

  /* KPI (total tipificaciones del periodo/selección) */
  const totalFromDist = React.useMemo(
    () => dist.reduce((acc, d) => acc + (Number(d.value) || 0), 0),
    [dist]
  );
  const totalFromSerie = React.useMemo(
    () => serie.reduce((acc, d) => acc + (Number(d.total) || 0), 0),
    [serie]
  );
  const totalTipificaciones = totalFromDist || totalFromSerie || 0;

  const resetSelectedToAll = () =>
    setSelectedIds(members.map((m) => String(m._id)));

  return (
    <div className="p-6 min-h-dvh" style={{ background: THEME.pageBg }}>
      {/* Encabezado + filtros + KPI */}
      <div className="mb-3 flex flex-col lg:flex-row items-start lg:items-center justify-start gap-3">
        {/* KPI: Total tipificaciones */}
        <div className="grid grid-cols-1 sm:grid-cols-1 gap-2 w-fit ml-0 mr-auto">
          <div
            className={`${THEME.card} flex flex-col items-center justify-center text-center border border-black w-[200px] h-[90px] py-4`}
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
                  d="M3 7h18M7 7v10m5-10v10m5-10v10"
                />
              </svg>
            </div>
            <div className="text-[10px] uppercase tracking-wide text-gray-600">
              Total tipificaciones
            </div>
            <div className="text-sm font-extrabold text-slate-900 mt-0.5">
              {formatNumber(totalTipificaciones)}
            </div>
          </div>
        </div>

        {/* Filtros y selección */}
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
            onClick={() => {
              setFrom("");
              setTo("");
              const now = new Date();
              setMonth(now.getMonth() + 1);
              setYear(now.getFullYear());
              resetSelectedToAll(); // también reinicia ejecutivos
            }}
            className="h-12 px-8 rounded-lg text-xs bg-white border border-gray-900"
            title="Volver al mes actual"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Grid: línea + dona */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Box title="Mensual • Tipificaciones por día" className="lg:col-span-2">
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
                    tick={{ fontSize: 10, fontWeight: "bold", fill: "#0f172a" }}
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
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 5 }}
                  >
                    <LabelList
                      dataKey="total"
                      position="top"
                      formatter={(v) => formatNumber(v)}
                      style={{ fontSize: 10, fill: "#111" }}
                    />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Box>

        <Box title="Distribución de tipificación" className="lg:col-span-1">
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
                          {formatNumber(value)}
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

      {/* Barras por ejecutivo (bonitas / gradiente) */}
      <div className="mt-3 grid grid-cols-1 lg:grid-cols-[1.2fr_1.8fr] gap-3">
        <Box title="Tipificaciones por Ejecutivo " >
          {!bars.length ? (
            <Empty />
          ) : (
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={bars}
                  layout="vertical"
                  margin={{ top: 12, right: 24, left: 30, bottom: 12 }}
                  barCategoryGap={8}
                >
                  <CartesianGrid strokeDasharray="2 4" stroke="#828386ff" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#334155", fontWeight: "bold" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="ejecutivo"
                    width={180}
                    tick={{ fontSize: 10, fill: "#0f172a", fontWeight: "bold" }}
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
                      padding: "6px 8px", // más compacto
                    }}
                    labelStyle={{
                      ...THEME.tooltipLabel,
                      color: "#475569",
                      fontSize: 10, // letra xs
                      fontWeight: 600,
                      textTransform: "uppercase",
                      marginBottom: 2,
                    }}
                    formatter={(v) => [`${formatNumber(v)}`, "Tipificaciones"]}
                    itemStyle={{
                      color: "#0f172a",
                      fontSize: 10,
                      fontWeight: 500,
                    }}
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  />

                  <Bar
                    dataKey="total"
                    stroke="transparent"
                    fill={THEME.colors[0]} // 👈 color sólido (sin gradiente)
                    radius={[0, 3, 3, 0]}
                    minPointSize={2}
                    isAnimationActive
                    barSize={30}
                  >
                    <LabelList
                      dataKey="total"
                      position="right"
                      formatter={(v) => formatNumber(v)}
                      style={{ fontSize: 10, fill: "#0f172a", fontWeight: 700 }}
                      offset={8}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Box>

        {/* Tabla de Efectividad */}
        <Box title="Efectividad de tipificación → oportunidades">
  {loadingEff ? (
    <Empty text="Cargando…" />
  ) : !effRows.length ? (
    <Empty text="Sin datos para el filtro seleccionado" />
  ) : (
    <div className="h-[380px] relative overflow-y-auto overflow-x-hidden px-7">
      <table className="w-full mt-2 table-auto border border-gray-200">
        <colgroup>
          <col className="w-[14rem]" /> {/* ~224px: Ejecutivo */}
          <col className="w-[7rem]" />  {/* ~112px: Base */}
          <col className="w-[9rem]" />  {/* ~144px: Oportunidades */}
          <col className="w-[10rem]" /> {/* ~160px: Efectividad */}
        </colgroup>

        <thead className="sticky top-0 z-10 bg-gray-800 text-white text-[11px] capitalize">
          <tr>
            <th className="px-2 py-3 text-center">Ejecutivo</th>
            <th className="px-2 py-3 text-center">Base</th>
            <th className="px-2 py-3 text-center">Oportunidades de Negociacion</th>
            <th className="px-2 py-3 text-center">Efectividad</th>
          </tr>
        </thead>

        <tbody className="text-[11px]">
          {effRows.map((r, idx) => {
            const base = Number(r.base) || 0;
            const ops = Number(r.oportunidades) || 0;
            const pct = base > 0 ? Math.round((ops * 100) / base) : 0;
            return (
              <tr
                key={r.ejecutivoId || idx}
                className={idx % 2 ? "bg-[#fafafa]" : "bg-white"}
              >
                <td className="px-3 py-2 border-b border-gray-200 text-center  font-bold text-slate-800">
                  <div className="truncate" title={r.ejecutivo}>
                    {r.ejecutivo}
                  </div>
                </td>
                <td className="px-3 py-2 border-b border-gray-200 text-center text-orange-600 font-semibold">
                  {formatNumber(base)}
                </td>
                <td className="px-3 py-2 border-b border-gray-200 text-center text-slate-900 font-semibold">
                  {formatNumber(ops)}
                </td>
                <td className="px-3 py-2 border-b border-gray-200">
                  <div className="text-center font-semibold text-slate-900">
                    {pct}%
                  </div>
                  <div className="mt-1 h-3 w-full rounded bg-gray-200">
                    <div
                      className="h-3 rounded bg-emerald-700"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr className="bg-gray-100 font-bold text-slate-800">
            <td className="px-3 py-2 text-[10px]">Totales</td>
            <td className="px-3 py-2 text-center text-[10px]">
              {formatNumber(
                effRows.reduce((a, r) => a + (Number(r.base) || 0), 0)
              )}
            </td>
            <td className="px-3 py-2 text-center text-[10px]">
              {formatNumber(
                effRows.reduce(
                  (a, r) => a + (Number(r.oportunidades) || 0),
                  0
                )
              )}
            </td>
            <td className="px-3 py-2 text-center text-[10px]">—</td>
          </tr>
        </tfoot>
      </table>
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
