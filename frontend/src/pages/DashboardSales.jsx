// src/pages/TestFiltros.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Loader } from "../components/Loader";
import api from "../api/axios";
import FiltrosWrapper from "../components/FiltrosWrapper";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LabelList,
  ReferenceLine,
  ComposedChart,
} from "recharts";

const PIE_COLORS = [
  "#2563eb", // Azul intenso
  "#dc2626", // Rojo elegante
  "#16a34a", // Verde vibrante
  "#f59e0b", // Ámbar cálido
  "#9333ea", // Púrpura llamativo
];

/* ---------- Tooltips personalizados que muestran Q y CF ---------- */
const PieDualTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload || {};
  return (
    <div className="rounded-md border bg-white px-3 py-2 text-xs shadow">
      <div className="font-semibold mb-1">{p._id}</div>
      <div>
        Q: <b>{new Intl.NumberFormat("es-PE").format(p.totalQ ?? 0)}</b>
      </div>
      <div>
        CF:{" "}
        <b>
          {new Intl.NumberFormat("es-PE", {
            style: "currency",
            currency: "PEN",
            maximumFractionDigits: 0,
          }).format(p.totalCF ?? 0)}
        </b>
      </div>
    </div>
  );
};

const BarDualTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload || {};
  const fmtInt = (v) => new Intl.NumberFormat("es-PE").format(v ?? 0);
  const fmtMoney = (v) =>
    new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
      maximumFractionDigits: 0,
    }).format(v ?? 0);

  return (
    <div className="rounded-md border bg-white px-3 py-2 text-xs shadow">
      <div className="font-semibold mb-1">{p.name}</div>
      <div>
        Q: <b>{fmtInt(p.totalQ)}</b>
      </div>
      <div>
        CF: <b>{fmtMoney(p.totalCF)}</b>
      </div>
    </div>
  );
};

const PdvDualTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0]?.payload || {};
  return (
    <div className="rounded-md border bg-white px-3 py-2 text-xs shadow">
      <div className="font-semibold mb-1">{p._id}</div>
      <div>
        Q: <b>{new Intl.NumberFormat("es-PE").format(p.totalQ ?? 0)}</b>
      </div>
      <div>
        CF:{" "}
        <b>
          {new Intl.NumberFormat("es-PE", {
            style: "currency",
            currency: "PEN",
            maximumFractionDigits: 0,
          }).format(p.totalCF ?? 0)}
        </b>
      </div>
    </div>
  );
};

/* ---------- Componente interno para sincronizar filtros sin setState en render ---------- */
const SyncFiltros = ({ value, onChange, children }) => {
  const prevStr = React.useRef("");
  React.useEffect(() => {
    const nextStr = JSON.stringify(value || {});
    if (nextStr !== prevStr.current) {
      prevStr.current = nextStr;
      onChange(value);
    }
  }, [value, onChange]);
  return children;
};

const abreviarEtiqueta = (v) => {
  if (!v) return "";
  let s = String(v);

  s = s.replace(/Portabilidad Entel/gi, "Port. Entel");
  s = s.replace(/Portabilidad Movistar/gi, "Port. Mov.");
  s = s.replace(/Portabilidad Bitel/gi, "Port. Bitel");
  s = s.replace(/Portabilidad Claro/gi, "Port. Claro");
  s = s.replace(/Portabilidad Win/gi, "Port. Win");
  s = s.replace(/Lineas Adicionales/gi, "Lín. Add.");
  s = s.replace(/Líneas Adicionales/gi, "Lín. Add.");
  s = s.replace(/Upselling/gi, "Ups.");
  s = s.replace(/Renovacion/gi, "Renov.");
  s = s.replace(/Renovación/gi, "Renov.");
  s = s.replace(/Retencion/gi, "Ret.");
  s = s.replace(/Retención/gi, "Ret.");
  s = s.replace(/Alta Nueva/gi, "Alta N.");
  s = s.replace(/Baja/gi, "Baja");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > 12) s = s.slice(0, 12) + "…";
  return s;
};

/* === Helper clave: construir params con arrays repetidos === */
const buildParams = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      v.forEach((item) => {
        if (item !== undefined && item !== null && item !== "")
          p.append(k, item);
      });
    } else {
      p.append(k, v);
    }
  }
  return p;
};

export default function DashboardComparativas() {
  const [filtros, setFiltros] = useState({});

  const [tipoVistaComparativa, setTipoVistaComparativa] = useState("anual");
  const [mesComparativa, setMesComparativa] = useState(
    new Date().getMonth() + 1
  );
  const [trimestreComparativa, setTrimestreComparativa] = useState(1);
  const [dataComparativa, setDataComparativa] = useState([]);
  const [dataMesVsYTD, setDataMesVsYTD] = useState(null);
  const [vista, setVista] = useState("mes");

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estado → torta
  const [distEstado, setDistEstado] = useState([]);

  // Barras (tipo de venta / drilldown)
  const [tipoSeleccionado] = useState(null);
  const [barData, setBarData] = useState([]);
  const [barLoading, setBarLoading] = useState(false);

  // Dona PDV
  const [distPDV, setDistPDV] = useState([]);
  const firstRender = React.useRef(true);

  const [drillTipoV, setDrillTipoV] = useState(null);
  // Info de fecha actual
  const todayInfo = useMemo(() => {
    const now = new Date();
    const day = now.getDate();
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();
    const monthIndex = now.getMonth() + 1;
    return { day, daysInMonth, monthIndex };
  }, []);

  // Proyección de FIN DE MES (si API no la trae, la calculo con ratio de días)
  const proyMes = useMemo(() => {
    const api = dataMesVsYTD?.proy || {};
    const byDays = (v) =>
      v == null
        ? null
        : Math.round((v / Math.max(1, todayInfo.day)) * todayInfo.daysInMonth);
    return {
      Q: typeof api.Q === "number" ? api.Q : byDays(dataMesVsYTD?.mes?.Q),
      CF: typeof api.CF === "number" ? api.CF : byDays(dataMesVsYTD?.mes?.CF),
    };
  }, [dataMesVsYTD, todayInfo]);

  // Proyección de FIN DE AÑO (si API no la trae, anualizo por meses transcurridos)
  const proyAnual = useMemo(() => {
    const api = dataMesVsYTD?.proyYtd || {};
    const byMonths = (v) =>
      v == null
        ? null
        : Math.round((v / Math.max(1, todayInfo.monthIndex)) * 12);
    return {
      Q: typeof api.Q === "number" ? api.Q : byMonths(dataMesVsYTD?.ytd?.Q),
      CF: typeof api.CF === "number" ? api.CF : byMonths(dataMesVsYTD?.ytd?.CF),
    };
  }, [dataMesVsYTD, todayInfo]);

  // Asegura que las ReferenceLine entren en el gráfico
  const barDataSorted = React.useMemo(
    () => [...barData].sort((a, b) => a.name.localeCompare(b.name)),
    [barData]
  );
  const monthLabel = useMemo(
    () => ({
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
    }),
    []
  );

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    const load = async () => {
      setBarLoading(true);
      try {
        const params = buildParams({
          estado: filtros.estado,
          year: filtros.anio,
          month: filtros.mes,
          producto: filtros.producto,
          tipoVenta: filtros.tipoVenta,
          pdv: filtros.soloPdv ? "si" : "",
          cfMode: filtros.cfMode,
          // 👇 si hay drill, pide por productos de ese TIPO_V
          ...(drillTipoV ? { detallePor: "tipoVenta", tipo: drillTipoV } : {}),
        });
        const { data } = await api.get("/ventas/distribucion-tipo-venta", {
          params,
        });
        setBarData(data?.data || []);
      } catch (e) {
        console.error(e);
        setBarData([]);
      } finally {
        setBarLoading(false);
      }
    };
    load();
  }, [filtros, drillTipoV]);

  useEffect(() => {
    if (loading) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [loading]);

  // Líneas
  // 🚀 1 solo useEffect que carga todo en paralelo
  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);

        const params = buildParams({
          estado: filtros.estado,
          year: filtros.anio,
          month: filtros.mes,
          producto: filtros.producto,
          tipoVenta: filtros.tipoVenta,
          pdv: filtros.soloPdv ? "si" : "",
          cfMode: filtros.cfMode, // viene del FiltrosWrapper
        });

        const [
          resLineas,
          resEstado,
          resTipoVenta,
          resPdv,
          resComparativa,
          resMesVsYtd,
        ] = await Promise.all([
          api.get("/ventas/graficolineas", { params }),
          api.get("/ventas/distribucion-estado", { params }),
          api.get("/ventas/distribucion-tipo-venta", { params }),
          api.get("/ventas/distribucion-pdv", { params }),
          api.get("/ventas/comparativa", { params }),
          api.get("/ventas/mes-vs-ytd", { params }),
        ]);

        setData(resLineas.data?.data || []);
        setDistEstado(resEstado.data?.data || []);
        setBarData(resTipoVenta.data?.data || []);
        setDistPDV(resPdv.data?.data || []);
        setDataComparativa(resComparativa.data?.data || []);
        setDataMesVsYTD(resMesVsYtd.data || null);
      } catch (err) {
        console.error("❌ Error cargando datos:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [filtros, tipoSeleccionado]);

  /* --------- Helpers --------- */
  const fmtMoney = (v) =>
    new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
      maximumFractionDigits: 0,
    }).format(v ?? 0);
  const fmtInt = (v) => new Intl.NumberFormat("es-PE").format(v ?? 0);

  const chartData = useMemo(
    () => data.map((d) => ({ ...d, mesLabel: monthLabel[d.mes] || d.mes })),
    [data, monthLabel]
  );

  // Tooltip MES vs YTD con MTD, YTD y Proyección (mes o año)
  const MesVsYtdTooltip = ({
    active,
    payload,
    data,
    fmtInt,
    fmtMoney,
    vista,
    proyMes,
    proyAnual,
  }) => {
    if (!active || !payload || !payload.length) return null;

    const serie = payload[0]?.payload?.name; // "Q" o "CF"
    const isQ = serie === "Q";

    const MTD = isQ ? data?.mes?.Q ?? 0 : data?.mes?.CF ?? 0;
    const YTD = isQ ? data?.ytd?.Q ?? 0 : data?.ytd?.CF ?? 0;

    // elige proyección según vista
    const proySel =
      vista === "mes"
        ? isQ
          ? proyMes?.Q
          : proyMes?.CF
        : isQ
        ? proyAnual?.Q
        : proyAnual?.CF;

    const fmt = isQ ? fmtInt : fmtMoney;

    return (
      <div className="rounded-md border bg-white px-3 py-2 text-xs shadow">
        <div className="mb-1 font-semibold">{serie}</div>
        <div>
          MTD: <b>{fmt(MTD)}</b>
        </div>
        <div>
          YTD: <b>{fmt(YTD)}</b>
        </div>
        {typeof proySel === "number" && (
          <div>
            {vista === "mes" ? "Proyección mes" : "Proyección año"}:{" "}
            <b>{fmt(proySel)}</b>
          </div>
        )}
      </div>
    );
  };

  /* ============================== RETURN ============================== */
return (
  <div className="min-h-[calc(100vh-88px)] w-full bg-[#F2F0F0] dark:bg-slate-950 p-4 md:p-6">
    {/* 🔹 Filtros (mismo patrón que Ventas.jsx) */}
    <div className="relative z-30 -mt-1 px-6">
      <FiltrosWrapper>
        {(f) => (
          <SyncFiltros value={f} onChange={setFiltros}>
            <div className="h-0 overflow-hidden" />
          </SyncFiltros>
        )}
      </FiltrosWrapper>
    </div>

    {/* 🔹 Loader / vacío */}
    {loading ? (
      <Loader variant="fullscreen" message="Cargando datos…" navbarHeight={88} />
    ) : data.length === 0 ? (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="text-center">
          <div className="mb-3 text-3xl">📭</div>
          <p className="text-sm text-slate-500">No hay datos para mostrar</p>
        </div>
      </div>
    ) : (
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* ====== LÍNEA: CF / Q ====== */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* CF */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:bg-neutral-900">
            <h3 className="mb-3 text-center text-sm text-slate-900 dark:text-slate-100">
              {filtros.cfMode === "facturacion"
                ? "CF Facturación Dscto (SIN IGV)"
                : "Cargo Fijo (SIN IGV)"}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="2 2" vertical={false} />
                <XAxis dataKey="mesLabel" className="text-[10px]" />
                <Tooltip
                  content={({ label, payload }) => {
                    if (!payload || payload.length === 0) return null;
                    return (
                      <div className="border border-slate-200 bg-white px-4 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                        <div className="mb-1 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {payload[0]?.payload?.mes || label}
                        </div>
                        {payload.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                            <span className="font-medium">{item.name}:</span>
                            <span className="ml-2 font-semibold" style={{ color: item.stroke }}>
                              {item.name === "CF" ? fmtMoney(item.value) : fmtInt(item.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="CF"
                  stroke="#328708ff"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  isAnimationActive={firstRender.current}
                  animationDuration={1200}
                  animationEasing="ease-in-out"
                  onAnimationEnd={() => {
                    firstRender.current = false;
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Q */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:bg-neutral-900">
            <h3 className="mb-3 text-center text-sm text-slate-900 dark:text-slate-100">Q de Líneas</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="2 2" vertical={false} />
                <XAxis dataKey="mesLabel" className="text-[10px]" />
                <Tooltip
                  content={({ label, payload }) => {
                    if (!payload || payload.length === 0) return null;
                    return (
                      <div className="border border-slate-200 bg-white px-4 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                        <div className="mb-1 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {payload[0]?.payload?.mes || label}
                        </div>
                        {payload.map((item, i) => (
                          <div key={i} className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                            <span className="font-medium">{item.name}:</span>
                            <span className="ml-2 font-semibold" style={{ color: item.stroke }}>
                              {item.name === "Q" ? fmtInt(item.value) : item.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Q"
                  stroke="#9c0494ff"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  isAnimationActive={firstRender.current}
                  animationDuration={1200}
                  animationEasing="ease-in-out"
                  onAnimationEnd={() => {
                    firstRender.current = false;
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ====== TARJETAS: ESTADO / TIPO VENTA / PDV ====== */}
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Torta por estado */}
          <div className="flex h-[380px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:bg-neutral-900">
            <div className="mb-4 flex flex-col items-center justify-center">
              <h3 className="mb-3 text-center text-sm text-slate-900 dark:text-slate-100">Distribución por Estado</h3>
            </div>

            <div className="relative min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 12, bottom: 20, left: 12 }}>
                  <Pie
                    data={[...distEstado].sort((a, b) => (b?.totalQ ?? 0) - (a?.totalQ ?? 0))}
                    dataKey="totalQ"
                    nameKey="_id"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={110}
                    paddingAngle={1}
                    cornerRadius={8}
                    labelLine={false}
                    isAnimationActive
                    minAngle={6}
                    label={false}
                  >
                    {distEstado.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#fff" strokeWidth={2} />
                    ))}
                  </Pie>

                  <Tooltip
                    content={({ payload }) => {
                      if (!payload || payload.length === 0) return null;
                      const item = payload[0]?.payload;
                      return (
                        <div className="border border-slate-200 bg-white px-4 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                          <div className="mb-2 text-center text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {item?._id}
                          </div>
                          <div className="flex flex-col items-center gap-1 text-xs text-slate-700 dark:text-slate-300">
                            <div>
                              <span className="font-medium">Q: </span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {fmtInt(item?.totalQ)}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium">CF: </span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {fmtMoney(item?.totalCF)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />

                  <Legend verticalAlign="bottom" align="center" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, marginTop: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Barras por tipo de venta / drill a productos */}
          <div className="flex h-[380px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:bg-neutral-900">
            <div className="mb-3 text-center">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {drillTipoV ? `Productos en "${drillTipoV}"` : "Distribución por Tipo de Venta"}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Líneas (Q) y Cargo Fijo (CF)</p>
              {drillTipoV && (
                <button
                  className="mt-2 inline-flex items-center rounded-md border px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  onClick={() => setDrillTipoV(null)}
                >
                  ← Volver a Tipos de Venta
                </button>
              )}
            </div>

            {barLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader variant="inline" message="Cargando…" />
              </div>
            ) : (
              <div className="min-h-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barDataSorted} margin={{ top: 20, right: 12, left: 12, bottom: 25 }}>
                    <defs>
                      <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" />
                        <stop offset="100%" stopColor="#1e3a8a" />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="2 2" vertical={false} />

                    <XAxis
                      dataKey="name"
                      interval={0}
                      tickMargin={12}
                      tick={({ x, y, payload, index }) => {
                        const raw = payload?.value ?? "";
                        const label = abreviarEtiqueta(raw);
                        const offset = index % 2 === 0 ? 0 : 14;
                        return (
                          <text x={x} y={y + offset} dy={16} textAnchor="middle" fontSize={10} fontWeight={600} fill="#334155">
                            {label}
                          </text>
                        );
                      }}
                    />

                    <Tooltip
                      content={({ payload }) => {
                        if (!payload || payload.length === 0) return null;
                        const item = payload[0]?.payload;
                        return (
                          <div className="text-center border border-slate-200 bg-white px-4 py-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">
                              {item?.name}
                            </div>
                            <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">Q: {fmtInt(item?.totalQ)}</div>
                            <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">CF: {fmtMoney(item?.totalCF)}</div>
                          </div>
                        );
                      }}
                    />

                    <Bar dataKey="totalQ" fill="url(#barFill)" barSize={36}>
                      {barDataSorted.map((entry, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          cursor="pointer"
                          onClick={() => {
                            if (!drillTipoV) setDrillTipoV(entry.name);
                          }}
                          fill={!drillTipoV ? "url(#barFill)" : "#2563eb"}
                          opacity={drillTipoV && entry.name !== drillTipoV ? 0.35 : 1}
                        />
                      ))}
                      <LabelList
                        dataKey="totalQ"
                        position="top"
                        content={({ x, y, value }) => (
                          <text x={x + 18} y={y - 6} fill="#0f172a" fontSize={10} fontWeight={700} textAnchor="middle">
                            {value}
                          </text>
                        )}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Dona PDV */}
          <div className="flex h-[380px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:bg-neutral-900">
            <div className="mb-3 text-center">
              <h3 className="mb-3 text-center text-sm text-slate-900 dark:text-slate-100">PDV vs No PDV</h3>
            </div>

            <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 12, bottom: 12, left: 12 }}>
                  <Pie
                    data={distPDV}
                    dataKey="totalQ"
                    nameKey="_id"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={110}
                    paddingAngle={1}
                    cornerRadius={8}
                    labelLine={false}
                    label={false}
                    isAnimationActive
                    minAngle={6}
                  >
                    {distPDV.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#fff" strokeWidth={2} />
                    ))}
                  </Pie>

                  <Tooltip
                    content={({ payload }) => {
                      if (!payload || payload.length === 0) return null;
                      const item = payload[0]?.payload;
                      return (
                        <div className="border border-slate-200 bg-white px-4 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                          <div className="mb-2 text-center text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {item?._id}
                          </div>
                          <div className="flex flex-col items-center gap-1 text-xs text-slate-700 dark:text-slate-300">
                            <div>
                              <span className="font-medium">Q: </span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {fmtInt(item?.totalQ)}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium">CF: </span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {fmtMoney(item?.totalCF)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />

                  <Legend verticalAlign="bottom" align="center" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, marginTop: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ====== COMPARATIVA + MTD/YTD ====== */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Comparativa (1 col) */}
          <div className="col-span-1 flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-md dark:bg-neutral-900">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="w-full text-[11px] font-semibold uppercase tracking-wide text-center text-slate-900 dark:text-slate-100">
                Comparativa
              </h3>

              <div className="flex items-center gap-1.5">
                {["anual", "trimestre", "mes"].map((k) => (
                  <button
                    key={k}
                    onClick={() => setTipoVistaComparativa(k)}
                    aria-pressed={tipoVistaComparativa === k}
                    className={[
                      "rounded px-2 py-1 text-[11px] transition",
                      tipoVistaComparativa === k
                        ? "bg-blue-600 text-white shadow-sm"
                        : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-neutral-800",
                    ].join(" ")}
                  >
                    {k === "anual" ? "Anual" : k === "trimestre" ? "Trim." : "Mes"}
                  </button>
                ))}

                {tipoVistaComparativa === "mes" && (
                  <select
                    value={mesComparativa}
                    onChange={(e) => setMesComparativa(Number(e.target.value))}
                    className="rounded border border-slate-300 px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-neutral-900 dark:text-slate-200"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {new Date(2025, m - 1).toLocaleString("es-PE", { month: "long" })}
                      </option>
                    ))}
                  </select>
                )}

                {tipoVistaComparativa === "trimestre" && (
                  <select
                    value={trimestreComparativa}
                    onChange={(e) => setTrimestreComparativa(Number(e.target.value))}
                    className="rounded border border-slate-300 px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-neutral-900 dark:text-slate-200"
                  >
                    <option value={1}>1° Trimestre</option>
                    <option value={2}>2° Trimestre</option>
                    <option value={3}>3° Trimestre</option>
                    <option value={4}>4° Trimestre</option>
                  </select>
                )}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={[...dataComparativa].sort((a, b) => a.name.localeCompare(b.name))}
                margin={{ top: 8, right: 8, left: 8, bottom: 12 }}
              >
                <defs>
                  <linearGradient id="barPast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#b45309" />
                  </linearGradient>
                  <linearGradient id="barActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#1e3a8a" />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600, fill: "#334155" }} />

                <Tooltip
                  content={({ label, payload = [] }) => {
                    if (!payload.length) return null;
                    const p = payload.reduce((acc, it) => {
                      acc[it.dataKey] = it.value;
                      return acc;
                    }, {});
                    const vari = payload.find((it) => it.dataKey === "actual")?.payload?.variacion;
                    const n = typeof vari === "string" ? parseFloat(vari) : Number(vari);
                    const sign = Number.isFinite(n) ? (n > 0 ? "+" : "") : "";
                    const textVar = Number.isFinite(n) ? `${sign}${n.toFixed(1)}%` : vari ?? "—";
                    const colorVar = Number.isFinite(n) ? (n >= 0 ? "#16a34a" : "#dc2626") : "#334155";

                    return (
                      <div className="text-center border border-slate-200 bg-white px-3 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                        <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">
                          {label}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300">
                          Año Pasado: <b>{p.pasado ?? "—"}</b>
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300">
                          Año Actual: <b>{p.actual ?? "—"}</b>
                        </div>
                        <div className="mt-0.5 text-[11px] font-semibold" style={{ color: colorVar }}>
                          Variación: {textVar}
                        </div>
                      </div>
                    );
                  }}
                />

                <Legend wrapperStyle={{ fontSize: 10, marginTop: 2 }} />

                <Bar dataKey="pasado" fill="url(#barPast)" name="Año Pasado" barSize={40} />
                <Bar dataKey="actual" fill="url(#barActual)" name="Año Actual" barSize={40}>
                  <LabelList
                    dataKey="variacion"
                    position="top"
                    content={({ x, y, value }) => {
                      const n = typeof value === "string" ? parseFloat(value) : Number(value);
                      const sign = Number.isFinite(n) ? (n > 0 ? "+" : "") : "";
                      const text = Number.isFinite(n) ? `${sign}${n.toFixed(1)}%` : value ?? "";
                      const color = Number.isFinite(n) ? (n >= 0 ? "#16a34a" : "#dc2626") : "#334155";
                      return (
                        <text x={x + 12} y={y - 6} fill={color} fontSize={10} fontWeight={700} textAnchor="middle">
                          {text}
                        </text>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Mes vs YTD (2 cols) */}
          <div className="col-span-1 flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-md dark:bg-neutral-900 lg:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="w-full text-[13px] text-center font-semibold tracking-wide text-slate-900 dark:text-slate-100">
                Proyección
              </h3>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setVista("mes")}
                  className={`rounded px-2 py-1 text-[11px] ${
                    vista === "mes" ? "bg-emerald-600 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  MTD
                </button>
                <button
                  onClick={() => setVista("ytd")}
                  className={`rounded px-2 py-1 text-[11px] ${
                    vista === "ytd" ? "bg-emerald-600 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  YTD
                </button>
              </div>
            </div>

            {(() => {
              const metasMes = { Q: 350, CF: 12000 }; // metas MTD

              return (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart
                    layout="vertical"
                    data={[
                      {
                        name: "Q",
                        actual: vista === "mes" ? dataMesVsYTD?.mes?.Q : dataMesVsYTD?.ytd?.Q,
                        meta: vista === "mes" ? metasMes.Q : proyAnual?.Q,
                        proy: vista === "mes" ? proyMes?.Q : proyAnual?.Q,
                      },
                      {
                        name: "CF",
                        actual: vista === "mes" ? dataMesVsYTD?.mes?.CF : dataMesVsYTD?.ytd?.CF,
                        meta: vista === "mes" ? metasMes.CF : proyAnual?.CF,
                        proy: vista === "mes" ? proyMes?.CF : proyAnual?.CF,
                      },
                    ]}
                    margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
                    barCategoryGap="35%"
                  >
                    <CartesianGrid strokeDasharray="2 2" horizontal vertical={false} stroke="#000000ff" />
                    <XAxis type="number" domain={[0, (dataMax) => Math.ceil(dataMax * 1.12)]} tick={false} axisLine={{ stroke: "#cbd5e1", strokeWidth: 1 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 12, fontWeight: 600, fill: "#334155" }}
                      axisLine={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                    />

                    <Tooltip
                      content={({ payload }) => {
                        if (!payload || payload.length === 0) return null;
                        const item = payload[0]?.payload;
                        const isQ = item.name === "Q";
                        return (
                          <div className="border border-slate-200 bg-white px-3 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-900 text-[11px]">
                            <div className="mb-1 text-center font-semibold text-slate-800 dark:text-slate-100">{item.name}</div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-300">
                              <span>Actual:</span>
                              <span className="font-semibold">{isQ ? fmtInt(item.actual) : fmtMoney(item.actual)}</span>
                            </div>
                            {item.proy && (
                              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Proyección:</span>
                                <span className="font-semibold text-amber-600">
                                  {isQ ? fmtInt(item.proy) : fmtMoney(item.proy)}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />

                    <Bar dataKey="actual" barSize={40}>
                      {["Q", "CF"].map((key, i) => (
                        <Cell key={i} fill={key === "Q" ? "#16a34a" : "#2563eb"} />
                      ))}
                    </Bar>

                    {/* Líneas de referencia (proyecciones) */}
                    {["Q", "CF"].map((key) => (
                      <React.Fragment key={key}>
                        {vista === "mes" && typeof proyMes?.[key] === "number" && (
                          <ReferenceLine
                            x={proyMes[key]}
                            stroke={key === "Q" ? "#f59e0b" : "#10b981"}
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            label={{ value: `Proy ${key}`, position: "right", fill: key === "Q" ? "#b45309" : "#0f766e", fontSize: 10 }}
                          />
                        )}
                        {vista === "ytd" && typeof proyAnual?.[key] === "number" && (
                          <ReferenceLine
                            x={proyAnual[key]}
                            stroke={key === "Q" ? "#f59e0b" : "#10b981"}
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            label={{ value: `Proy ${key}`, position: "right", fill: key === "Q" ? "#b45309" : "#0f766e", fontSize: 10 }}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        </div>
      </div>
    )}
  </div>
);

}
