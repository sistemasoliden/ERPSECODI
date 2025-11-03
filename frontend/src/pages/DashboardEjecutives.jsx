// src/pages/RankingYProgreso.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axios";
import { Loader } from "../components/Loader";
import FiltrosWrapper from "../components/FiltrosWrapper";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  LabelList,
} from "recharts";

/* ======================= THEME Reutilizable ======================= */
const THEME = {
  pageBg: "#F2F0F0",
  card: "rounded-lg border border-gray-300 bg-white p-4 shadow-md",
  title: "text-sm font-bold text-blue-800 text-center",
  tooltipBox: {
    background: "white",
    border: "1px solid #ddd",
    borderRadius: 8,
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
    padding: "8px 12px",
    fontSize: 12,
    color: "#111",
  },
  tooltipLabel: { color: "#111827", fontWeight: "bold", fontSize: 13 },
  palette: ["#0ea5e9", "#14b8a6", "#f59e0b", "#a855f7", "#10b981", "#ef4444"],
  lineColor: "#af0c0e",
};

/* ======================= Helpers comunes ======================= */
const buildParams = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (!v.length) continue;
      v.forEach((item) => {
        if (item !== undefined && item !== null && item !== "")
          p.append(k, item);
      });
    } else p.append(k, v);
  }
  return p;
};

const SyncFiltros = ({ value, onChange, children }) => {
  const prevStr = useRef("");
  useEffect(() => {
    const nextStr = JSON.stringify(value || {});
    if (nextStr !== prevStr.current) {
      prevStr.current = nextStr;
      onChange(value);
    }
  }, [value, onChange]);
  return children;
};

const fmtInt = (v) => new Intl.NumberFormat("es-PE").format(v ?? 0);
const fmtMoney = (v) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    maximumFractionDigits: 0,
  }).format(v ?? 0);

const monthLabel = {
  "01": "Ene",
  "02": "Feb",
  "03": "Mar",
  "04": "Abr",
  "05": "May",
  "06": "Jun",
  "07": "Jul",
  "08": "Ago",
  "09": "Sep",
  10: "Oct",
  11: "Nov",
  12: "Dic",
};

/* ======================= Componentes Tooltip ======================= */
const LineTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload || {};
  return (
    <div style={THEME.tooltipBox}>
      <div style={THEME.tooltipLabel}>{p.mesLabel}</div>
      <div>
        Q: <b>{fmtInt(p.Q)}</b>
      </div>
      <div>
        CF: <b>{fmtMoney(p.CF)}</b>
      </div>
    </div>
  );
};

const BarTooltip = ({ active, payload, label, type }) => {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value ?? 0;
  return (
    <div style={THEME.tooltipBox}>
      <div style={THEME.tooltipLabel}>{label}</div>
      <div>{type === "cf" ? fmtMoney(v) : fmtInt(v)}</div>
    </div>
  );
};

/* ======================= Página ======================= */
export default function RankingYProgreso() {
  const [filtros, setFiltros] = useState({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [topQ, setTopQ] = useState([]);
  const [topCF, setTopCF] = useState([]);
  const [ejecutivo, setEjecutivo] = useState("");
  const [progreso, setProgreso] = useState([]);
  const [yearSeries, setYearSeries] = useState(new Date().getFullYear());
  const [usuariosActivos, setUsuariosActivos] = useState([]);

  const ejecutivosOpts = useMemo(() => {
    return (usuariosActivos || [])
      .filter(
        (u) =>
          String(u.role) === "68a4f22d27e6abe98157a831" ||
          String(u.role?._id) === "68a4f22d27e6abe98157a831"
      )
      .map((u) => u.name || `${u.firstName} ${u.lastName}`.trim() || u.email)
      .sort((a, b) => a.localeCompare(b));
  }, [usuariosActivos]);

  useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        const res = await api.get("/users/activos");
        setUsuariosActivos(res.data || []);
      } catch (err) {
        console.error("❌ Error cargando usuarios activos:", err);
      }
    };
    fetchUsuarios();
  }, []);

  useEffect(() => {
    if (ejecutivosOpts.length && !ejecutivo)
      setEjecutivo(ejecutivosOpts[0] || "");
  }, [ejecutivosOpts, ejecutivo]);

  /* === Carga Ranking === */
  useEffect(() => {
    let cancelled = false;
    const fetchRanking = async () => {
      try {
        if (initialLoading) setInitialLoading(true);
        else setRefreshing(true);
        const paramsBase = {
          estado: filtros.estado,
          year: filtros.anio,
          month: filtros.mes,
          producto: filtros.producto,
          tipoVenta: filtros.tipoVenta,
          pdv: filtros.soloPdv ? "si" : "",
          cfMode: filtros.cfMode || "normal",
        };
        const [resQ, resCF] = await Promise.all([
          api.get("/ventas/consultores-ranking", {
            params: buildParams({ ...paramsBase, sortBy: "Q" }),
          }),
          api.get("/ventas/consultores-ranking", {
            params: buildParams({ ...paramsBase, sortBy: "CF" }),
          }),
        ]);
        if (cancelled) return;
        setTopQ(resQ.data?.data || []);
        setTopCF(resCF.data?.data || []);
      } catch (err) {
        console.error("❌ Error cargando ranking:", err);
      } finally {
        if (cancelled);
        if (initialLoading) setInitialLoading(false);
        else setRefreshing(false);
      }
    };
    fetchRanking();
    return () => {
      cancelled = true;
    };
  }, [filtros]);

  /* === Carga Progreso === */
  useEffect(() => {
    let cancelled = false;
    const y =
      Array.isArray(filtros.anio) && filtros.anio.length
        ? Number(filtros.anio[0])
        : new Date().getFullYear();

    const fetchProgreso = async () => {
      if (!ejecutivo) {
        setProgreso([]);
        setYearSeries(y);
        return;
      }
      try {
        setRefreshing(true);
        const params = buildParams({
          consultor: ejecutivo,
          year: y,
          estado: filtros.estado,
          producto: filtros.producto,
          tipoVenta: filtros.tipoVenta,
          pdv: filtros.soloPdv ? "si" : "",
          cfMode: filtros.cfMode || "normal",
        });
        const res = await api.get("/ventas/consultor-progreso", { params });
        if (cancelled) return;
        const rows = res.data?.data || [];
        const mapped = rows.map((r) => ({
          mes: r.mes,
          mesLabel: monthLabel[r.mes] || r.mes,
          Q: +r.Q || 0,
          CF: +r.CF || 0,
        }));
        setProgreso(mapped);
        setYearSeries(y);
      } catch (err) {
        console.error("❌ Error cargando progreso:", err);
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    };
    fetchProgreso();
    return () => {
      cancelled = true;
    };
  }, [ejecutivo, filtros]);

  /* ======================= Render ======================= */
  return (
  <div className="p-6 min-h-dvh bg-[#F2F0F0]">
    {/* Toolbar (Filtros arriba, sticky y visualmente separada) */}
    <div className="z-30 bg-[#F2F0F0] pb-2">
      <div className="px-2">
        <FiltrosWrapper>
          {(f) => (
            <SyncFiltros value={f} onChange={setFiltros}>
              <div className="h-0 overflow-hidden" />
            </SyncFiltros>
          )}
        </FiltrosWrapper>
      </div>
    </div>

    {/* Loader inicial */}
    {initialLoading || refreshing ? (
      <Loader
        variant="fullscreen"
        message="Cargando ventas..."
        navbarHeight={88}
      />
    ) : (
      // 🔹 Contenedor principal a ancho completo (sin max-width ni centrado)
      <div className="w-full px-4 py-6 space-y-6">
        {/* === Línea === */}
        <div className={THEME.card}>
          <h3 className={THEME.title}>
            Progreso de {ejecutivo || "(sin selección)"} ({yearSeries})
          </h3>

          <div className="mt-4 flex justify-end">
            <select
              value={ejecutivo}
              onChange={(e) => setEjecutivo(e.target.value)}
              className="border border-gray-900 bg-white rounded-md px-3 py-3 text-sm text-gray-700 shadow-sm focus:ring-1 focus:ring-blue-600"
            >
              {ejecutivosOpts.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              {ejecutivosOpts.length === 0 && (
                <option value="">(sin datos)</option>
              )}
            </select>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={progreso}
              margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
            >
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={THEME.lineColor}
                    stopOpacity={0.9}
                  />
                  <stop
                    offset="95%"
                    stopColor={THEME.lineColor}
                    stopOpacity={0.2}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="mesLabel"
                tick={{ fontSize: 10, fill: "#111", fontWeight: "bold" }}
              />
              <YAxis tick={false} axisLine={false} />
              <Tooltip content={<LineTooltip />} />
              <Legend
                iconType="circle"
                wrapperStyle={{
                  fontSize: 10,
                  fontWeight: "bold",
                  textTransform: "capitalize",
                }}
              />
              <Line
                type="monotone"
                dataKey="Q"
                name="Cantidad"
                stroke="#2563eb"
                strokeWidth={1.8}
                dot={{ r: 2 }}
                activeDot={{ r: 5 }}
              >
                <LabelList
                  dataKey="Q"
                  position="top"
                  fontSize={10}
                  fill="#111"
                />
              </Line>
              <Line
                type="monotone"
                dataKey="CF"
                name="CF (S/.)"
                stroke="#14b8a6"
                strokeWidth={1.8}
                dot={{ r: 2 }}
                activeDot={{ r: 5 }}
              >
                <LabelList
                  dataKey="CF"
                  position="top"
                  fontSize={10}
                  fill="#111"
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* === Barras === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Q */}
          <div className={THEME.card}>
            <h3 className={THEME.title}>Ranking por Q (Líneas)</h3>
            <div className="h-[460px] overflow-y-auto pr-2">
              <ResponsiveContainer width="100%" height={topQ.length * 38}>
                <BarChart
                  layout="vertical"
                  data={topQ.map((r) => ({
                    name: r.consultor || "(Sin nombre)",
                    value: r.totalQ || 0,
                  }))}
                >
                  <CartesianGrid strokeDasharray="2 2" vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={200}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip content={<BarTooltip type="q" />} />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: 10, fontWeight: "bold" }}
                  />
                  <Bar
                    dataKey="value"
                    name="Q"
                    fill={THEME.palette[0]}
                    radius={[0, 3, 3, 0]}
                  >
                    <LabelList
                      dataKey="value"
                      position="right"
                      fontSize={10}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CF */}
          <div className={THEME.card}>
            <h3 className={THEME.title}>Ranking por CF (sin IGV)</h3>
            <div className="h-[460px] overflow-y-auto pr-2">
              <ResponsiveContainer width="100%" height={topCF.length * 38}>
                <BarChart
                  layout="vertical"
                  data={topCF.map((r) => ({
                    name: r.consultor || "(Sin nombre)",
                    value: r.totalCF || 0,
                  }))}
                >
                  <CartesianGrid strokeDasharray="2 2" vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={200}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip content={<BarTooltip type="cf" />} />
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ fontSize: 10, fontWeight: "bold" }}
                  />
                  <Bar
                    dataKey="value"
                    name="CF"
                    fill={THEME.palette[1]}
                    radius={[0, 3, 3, 0]}
                  >
                    <LabelList
                      dataKey="value"
                      position="right"
                      fontSize={10}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);

}
