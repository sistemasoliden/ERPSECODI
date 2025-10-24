// src/pages/reporteria/ReportOportunidades.jsx
import React, { useEffect, useMemo, useState } from "react";
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

/* ================== THEME / ESTILOS ================== */
const THEME = {
  pageBg: "#F2F0F0",
  card: "rounded-lg border border-gray-300 bg-white p-4 shadow-md",
  section: "rounded-lg border border-gray-200 bg-white p-4 shadow-sm",
  title: "text-sm font-bold text-blue-800",
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
const fmtNum = (n) =>
  new Intl.NumberFormat("es-PE").format(Math.round(Number(n || 0)));

/* Formateo numérico (miles) */
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
/* Gradiente */
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

/* ───────────── Página ───────────── */
export default function ReportOportunidades() {
  const { token } = useAuth();
  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  // Rango y mes/año
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const [loading, setLoading] = useState(false);
  const [serie, setSerie] = useState([]);
  const [dist, setDist] = useState([]);
  const [error, setError] = useState("");

  // ▼▼ Filtros + series del bloque inferior (solo estado) ▼▼
  const [miniEstado, setMiniEstado] = useState("ganada"); // "ganada" | "neg_aprobada" | "both"
  const [miniSerieMonto, setMiniSerieMonto] = useState([]);
  const [miniSerieCantidad, setMiniSerieCantidad] = useState([]);
  const [loadingMini, setLoadingMini] = useState(false);

  // Devuelve los params correctos según haya from/to o month/year
  const getRangeParams = () => (from && to ? { from, to } : { month, year });

  // Reset a mes/año actuales

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = getRangeParams();

      const r1 = await api.get("/reportes/oportunidades/serie", {
        ...authHeader,
        params,
      });
      const serieNorm = normalizeSerieDaysFull(
        r1.data?.items ?? r1.data,
        params.month ?? month,
        params.year ?? year
      );

      const r2 = await api.get("/reportes/oportunidades/distribucion", {
        ...authHeader,
        params,
      });
      let distNorm = normalizeDistribucion(r2.data?.items ?? r2.data);
      const sum = distNorm.reduce((a, b) => a + (b.value || 0), 0) || 1;
      distNorm = distNorm.map((d) => ({
        ...d,
        __pct: Math.round((d.value * 100) / sum),
      }));

      setSerie(serieNorm);
      setDist(distNorm);
      if (!serieNorm?.length && !distNorm?.length) {
        setError("El servidor respondió sin datos para este filtro.");
      }
    } catch (e) {
      console.error("[Oportunidades] load error:", e);
      setError("No se pudo cargar la reportería.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, month, year, token]);

  /* ▼ Cargar ambas series (monto/cantidad) para el bloque inferior */
  // Mini-resumen (Monto/Cantidad)
  useEffect(() => {
    const loadMiniBoth = async () => {
      setLoadingMini(true);
      try {
        const baseParams = getRangeParams();
        const common = { ...baseParams, estado: miniEstado };

        const [rMonto, rCant] = await Promise.all([
          api.get("/oportunidades/reportes/por-tipo-venta-resumen", {
            ...authHeader,
            params: { ...common, metric: "monto" },
          }),
          api.get("/oportunidades/reportes/por-tipo-venta-resumen", {
            ...authHeader,
            params: { ...common, metric: "cantidad" },
          }),
        ]);

        setMiniSerieMonto(
          Array.isArray(rMonto?.data?.items) ? rMonto.data.items : []
        );
        setMiniSerieCantidad(
          Array.isArray(rCant?.data?.items) ? rCant.data.items : []
        );
      } catch (e) {
        setMiniSerieMonto([]);
        setMiniSerieCantidad([]);
      } finally {
        setLoadingMini(false);
      }
    };
    loadMiniBoth();
  }, [from, to, month, year, miniEstado, authHeader]);

  /* Totales filtrados (tarjeta) */
  const totalFromDist = useMemo(
    () => dist.reduce((acc, d) => acc + (Number(d.value) || 0), 0),
    [dist]
  );
  const totalFromSerie = useMemo(
    () => serie.reduce((acc, d) => acc + (Number(d.total) || 0), 0),
    [serie]
  );
  const totalFiltrado = totalFromDist || totalFromSerie || 0;
  // formateo
  const formatCurrency = (v = 0) =>
    (Number(v) || 0).toLocaleString("es-PE", {
      style: "currency",
      currency: "PEN",
      maximumFractionDigits: 0,
    });

  const formatNumber = (v = 0) => (Number(v) || 0).toLocaleString("es-PE");

  // totales a partir de las series ya cargadas
  const totalMonto = useMemo(
    () => miniSerieMonto.reduce((acc, it) => acc + (Number(it?.valor) || 0), 0),
    [miniSerieMonto]
  );

  const totalCantidad = useMemo(
    () =>
      miniSerieCantidad.reduce((acc, it) => acc + (Number(it?.valor) || 0), 0),
    [miniSerieCantidad]
  );
  // fuerza a que el componente de filtros se "reinicie" visualmente al limpiar

  return (
    <div className="p-6 min-h-dvh" style={{ background: THEME.pageBg }}>
      {/* Encabezado + filtros + total en una fila */}
      <div className="mb-3 flex flex-col lg:flex-row items-start lg:items-center justify-start gap-3">
        {/* Tarjetas de KPIs */}
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
              {formatNumber(totalFiltrado)}
            </div>
          </div>

          {/* Monto total (S/.) */}
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
              {formatCurrency(totalMonto)}
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
              {formatNumber(totalCantidad)}
            </div>
          </div>
        </div>

        {/* Filtros (componente externo) + rango activo + limpiar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
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

          {/* Píldora: rango activo */}

          {/* Botón: limpiar filtros */}
          <button
            type="button"
            onClick={() => {
              setFrom("");
              setTo("");
              const now = new Date();
              setMonth(now.getMonth() + 1);
              setYear(now.getFullYear());
            }}
            className="h-12 px-8 rounded-lg text-xs bg-white border border-gray-900 "
            title="Volver al mes actual"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* ====== Línea ====== */}
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
                  />{" "}
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
                      formatter={(v) => formatNumber(v)}
                      style={{ fontSize: 10, fill: "#111" }}
                    />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Box>

        {/* ====== Dona ====== */}
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

      {/* ====== Filtros + 2 gráficos (Monto/Cantidad) ====== */}
      <div className="mt-3 grid grid-cols-1">
        <div className={`${THEME.card}`}>
          {/* Barra de filtros (SOLO estado) */}
          <div className="flex items-center gap-2 pb-3 ml-7 mt-2 ">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMiniEstado("ganada")}
                className={`  mt-2 h-10 px-3 rounded-lg text-xs border ${
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
                className={`mt-2 h-10 px-3 rounded-lg text-xs border ${
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
                className={`mt-2 h-10 px-6 rounded-lg text-xs border ${
                  miniEstado === "both"
                    ? "bg-gray-800 border-gray-800 text-white"
                    : "bg-white border-gray-300 text-gray-800 hover:bg-gray-50"
                }`}
              >
                Ambas
              </button>
            </div>
          </div>

          {/* Dos gráficos lado a lado */}
          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Monto */}
            <div className="h-[300px]">
              <div className="ml-7 mb-1 text-xs font-bold text-blue-800 ">
                Por tipo de venta — Monto
              </div>
              {loadingMini ? (
                <Empty text="Cargando…" />
              ) : !miniSerieMonto.length ? (
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
                      barSize={40} // 👈 más delgado (por defecto es ~50)
                      minPointSize={5} // 👈 alto mínimo (evita barras invisibles)
                    >
                      <LabelList
                        dataKey="valor"
                        position="top"
                        formatter={(v) => formatNumber(v)}
                        style={{
                          fontWeight: "bold",
                          fontSize: 10,
                          fill: "#111",
                        }}
                      />
                    </Bar>

                    <Legend iconType="circle" iconSize={8} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Cantidad */}
            <div className="h-[300px]">
              <div className="ml-7 mb-1 text-xs font-bold text-blue-800">
                Por tipo de venta — Cantidad
              </div>
              {loadingMini ? (
                <Empty text="Cargando…" />
              ) : !miniSerieCantidad.length ? (
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
                      barSize={40} // 👈 controla el ancho de cada barra
                      minPointSize={5} // 👈 altura mínima (para valores muy pequeños)
                    >
                      <LabelList
                        dataKey="valor"
                        position="top"
                        formatter={(v) => formatNumber(v)}
                        style={{
                          fontSize: 10,
                          fill: "#111",
                          fontWeight: "bold",
                        }}
                      />
                    </Bar>

                    <Legend iconType="circle" iconSize={8} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}
