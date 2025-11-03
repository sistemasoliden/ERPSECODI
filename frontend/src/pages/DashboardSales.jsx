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

        // 🔹 Filtros comunes para la mayoría de endpoints
        const paramsBase = buildParams({
          estado: filtros.estado,
          year: filtros.anio,
          month: filtros.mes,
          producto: filtros.producto,
          tipoVenta: filtros.tipoVenta,
          pdv: filtros.soloPdv ? "si" : "",
          cfMode: filtros.cfMode,
        });

        // 🔹 Parámetros específicos para /ventas/comparativa
        const tipo =
          tipoVistaComparativa === "mes"
            ? "mes"
            : tipoVistaComparativa === "trimestre"
            ? "trimestre"
            : "anual";

        const paramsComparativa = buildParams({
          ...Object.fromEntries(paramsBase), // reutiliza los filtros comunes
          tipo,
          year: filtros.anio || new Date().getFullYear(),
          mes: tipo === "mes" ? mesComparativa : "",
          trimestre: tipo === "trimestre" ? trimestreComparativa : "",
        });

        const [
          resLineas,
          resEstado,
          resTipoVenta,
          resPdv,
          resComparativa,
          resMesVsYtd,
        ] = await Promise.all([
          api.get("/ventas/graficolineas", { params: paramsBase }),
          api.get("/ventas/distribucion-estado", { params: paramsBase }),
          api.get("/ventas/distribucion-tipo-venta", { params: paramsBase }),
          api.get("/ventas/distribucion-pdv", { params: paramsBase }),
          api.get("/ventas/comparativa", { params: paramsComparativa }), // 👈
          api.get("/ventas/mes-vs-ytd", { params: paramsBase }),
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
    // 👇 agrega dependencias para que recargue al cambiar los selectores de comparativa
  }, [
    filtros,
    tipoSeleccionado,
    tipoVistaComparativa,
    mesComparativa,
    trimestreComparativa,
  ]);

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

  // 🔎 Filtra dataComparativa según "anual" | "trimestre" | "mes"
  const comparativaFiltrada = useMemo(
    () => (Array.isArray(dataComparativa) ? dataComparativa : []),
    [dataComparativa]
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
    <div className="min-h-[calc(100vh-88px)] w-full bg-[#F2F0F0] dark:bg-slate-950 px-2 md:px-3 py-4">
      {/* 🔹 Filtros (mismo patrón que Ventas.jsx) */}
      <div className="relative z-30 ml-1 mt-1 px-0 md:px-2">
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
        <Loader
          variant="fullscreen"
          message="Cargando datos…"
          navbarHeight={88}
        />
      ) : data.length === 0 ? (
        <div className="flex min-h-[60vh] items-center justify-center px-2 md:px-3">
          <div className="text-center">
            <div className="mb-3 text-3xl">📭</div>
            <p className="text-sm text-slate-500">No hay datos para mostrar</p>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-[96vw] mx-auto px-2 -mt-4 md:px-3 py-6">
          {/* ====== LÍNEA: CF / Q ====== */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* CF */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:bg-neutral-900">
              <h3 className="mb-3 text-left ml-4 mt-2 text-xs text-red-900 font-bold  dark:text-slate-100">
                {filtros.cfMode === "facturacion"
                  ? "CF Facturación Dscto "
                  : "Cargo Fijo "}
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 20, left: 20, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="2 2" vertical={false} />
                  <XAxis
                    dataKey="mesLabel"
                    tick={{ fontSize: 10, fontWeight: 600, fill: "#1f2937" }}
                  />
                  <Tooltip
                    content={({ label, payload }) => {
                      if (!payload || payload.length === 0) return null;
                      return (
                        <div className="border border-slate-200 bg-white px-4 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                          <div className="mb-1 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {payload[0]?.payload?.mes || label}
                          </div>
                          {payload.map((item, i) => (
                            <div
                              key={i}
                              className="flex justify-between text-xs text-slate-600 dark:text-slate-300"
                            >
                              <span className="font-medium">{item.name}:</span>
                              <span
                                className="ml-2 font-semibold"
                                style={{ color: item.stroke }}
                              >
                                {item.name === "CF"
                                  ? fmtMoney(item.value)
                                  : fmtInt(item.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, fontWeight: 600 }}
                    formatter={(value) => (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#1f2937",
                        }}
                      >
                        {value}
                      </span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="CF"
                    stroke="#328708ff"
                    strokeWidth={1.5}
                    dot={{ r: 2 }}
                    isAnimationActive={firstRender.current}
                    animationDuration={1200}
                    animationEasing="ease-in-out"
                    onAnimationEnd={() => {
                      firstRender.current = false;
                    }}
                  >
                    {/* 👇 LabelList DEBE ir dentro del <Line> */}
                    <LabelList
                      dataKey="CF"
                      position="top"
                      content={({ x, y, value }) => (
                        <text
                          x={x}
                          y={(y ?? 0) - 6}
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight={700}
                          fill="#111827"
                        >
                          {fmtMoney(value)}
                        </text>
                      )}
                    />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Q */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:bg-neutral-900">
              <h3 className="mb-3 text-left text- ml-4 mt-2 text-xs text-red-900 font-bold dark:text-slate-100">
                Q de Líneas
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 20, left: 20, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="2 2" vertical={false} />
                  <XAxis
                    dataKey="mesLabel"
                    tick={{ fontSize: 10, fontWeight: 600, fill: "#1f2937" }} // evita className
                  />
                  <Tooltip
                    content={({ label, payload }) => {
                      if (!payload || payload.length === 0) return null;
                      return (
                        <div className="border border-slate-200 bg-white px-4 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                          <div className="mb-1 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {payload[0]?.payload?.mes || label}
                          </div>
                          {payload.map((item, i) => (
                            <div
                              key={i}
                              className="flex justify-between text-xs text-slate-600 dark:text-slate-300"
                            >
                              <span className="font-medium">{item.name}:</span>
                              <span
                                className="ml-2 font-semibold"
                                style={{ color: item.stroke }}
                              >
                                {item.name === "Q"
                                  ? fmtInt(item.value)
                                  : item.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, fontWeight: 600 }}
                    formatter={(value) => (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#1f2937",
                        }}
                      >
                        {value}
                      </span>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="Q"
                    stroke="#9c0494ff"
                    strokeWidth={1.5}
                    dot={{ r: 2 }}
                    isAnimationActive={firstRender.current}
                    animationDuration={1200}
                    animationEasing="ease-in-out"
                    onAnimationEnd={() => {
                      firstRender.current = false;
                    }}
                  >
                    <LabelList
                      dataKey="Q"
                      position="top"
                      content={({ x, y, value }) => (
                        <text
                          x={x}
                          y={(y ?? 0) - 6}
                          textAnchor="middle"
                          fontSize={10}
                          fontWeight={700}
                          fill="#111827"
                        >
                          {fmtInt(value)}
                        </text>
                      )}
                    />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ====== TARJETAS: ESTADO / TIPO VENTA / PDV ====== */}
          <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
            {/* Torta por estado */}
            <div className="flex h-[400px] flex-col rounded-lg border border-slate-200 bg-white p-6 shadow-lg dark:bg-neutral-900">
              <div className="mb-4 flex flex-col items-start justify-center">
                <h3 className="mb-3 text-left text- ml-4 mt-2 text-xs text-red-900 font-bold dark:text-slate-100">
                  Distribución por Estado
                </h3>
              </div>

              <div className="relative min-h-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart
                    margin={{ top: 0, right: 12, bottom: 20, left: 12 }}
                  >
                    <Pie
                      data={[...distEstado].sort(
                        (a, b) => (b?.totalQ ?? 0) - (a?.totalQ ?? 0)
                      )}
                      dataKey="totalQ"
                      nameKey="_id"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={110}
                      paddingAngle={1}
                      cornerRadius={4}
                      labelLine={false}
                      isAnimationActive
                      minAngle={12}
                      // 👇 Etiqueta personalizada en cada segmento (muestra el valor)
                      label={({
                        cx,
                        cy,
                        midAngle,
                        innerRadius,
                        outerRadius,
                        value,
                      }) => {
                        const RADIAN = Math.PI / 180;
                        const r =
                          innerRadius + (outerRadius - innerRadius) * 0.6; // punto medio
                        const x = cx + r * Math.cos(-midAngle * RADIAN);
                        const y = cy + r * Math.sin(-midAngle * RADIAN);
                        return (
                          <text
                            x={x}
                            y={y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={10}
                            fontWeight={700}
                            fill="#0f172a"
                          >
                            {fmtInt(value)}
                          </text>
                        );
                      }}
                    >
                      {distEstado.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                          stroke="#fff"
                          strokeWidth={2}
                        />
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

                    {/* 👇 Leyenda xs y negrita */}
                    <Legend
                      verticalAlign="bottom"
                      align="center"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{
                        fontSize: 11,
                        fontWeight: 700,
                        marginTop: 8,
                      }}
                      formatter={(value) => (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "#1f2937",
                          }}
                        >
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Barras por tipo de venta / drill a productos */}
            <div className="flex h-[400px] flex-col rounded-lg border border-slate-200 bg-white p-6 shadow-lg dark:bg-neutral-900">
              <div className="mb-3">
                <h3 className="mb-1 ml-1 mt-1 text-left text-xs font-bold text-red-900 dark:text-slate-100">
                  {drillTipoV
                    ? `Productos en "${drillTipoV}"`
                    : "Distribución por Tipo de Venta"}
                </h3>
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
                    <BarChart
                      data={barDataSorted}
                      layout="vertical"
                      margin={{ top: 12, right: 16, left: -30, bottom: 8 }}
                      barCategoryGap="30%"
                    >
                      <defs>
                        {/* Gradiente horizontal para barras horizontales */}
                        <linearGradient
                          id="barFill"
                          x1="0"
                          y1="0"
                          x2="1"
                          y2="0"
                        >
                          <stop offset="0%" stopColor="#2563eb" />
                          <stop offset="100%" stopColor="#1e3a8a" />
                        </linearGradient>
                      </defs>

                      <CartesianGrid strokeDasharray="2 2" vertical={false} />

                      {/* Eje de valores */}
                      <XAxis
                        type="number"
                        tick={{
                          fontSize: 10,
                          fontWeight: 600,
                          fill: "#334155",
                        }}
                        axisLine={{ stroke: "#cbd5e1" }}
                      />

                      {/* Eje de categorías */}
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={140}
                        tick={({ x, y, payload }) => {
                          const raw = payload?.value ?? "";
                          const label = abreviarEtiqueta(raw);
                          return (
                            <text
                              x={x}
                              y={y}
                              dy={4}
                              textAnchor="end"
                              fontSize={10}
                              fontWeight={700}
                              fill="#334155"
                            >
                              {label}
                            </text>
                          );
                        }}
                        axisLine={{ stroke: "#cbd5e1" }}
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
                              <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                Q: {fmtInt(item?.totalQ)}
                              </div>
                              <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                CF: {fmtMoney(item?.totalCF)}
                              </div>
                            </div>
                          );
                        }}
                      />

                      {/* Leyenda xs + negrita */}
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{
                          fontSize: 11,
                          fontWeight: 700,
                          marginTop: 4,
                        }}
                        formatter={(value) => (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: "#1f2937",
                            }}
                          >
                            {value}
                          </span>
                        )}
                      />

                      <Bar
                        dataKey="totalQ"
                        name="Q"
                        fill="url(#barFill)"
                        barSize={30}
                        radius={[0, 6, 6, 0]} // 👈 punta derecha redondeada
                      >
                        {barDataSorted.map((entry, idx) => (
                          <Cell
                            key={`cell-${idx}`}
                            cursor="pointer"
                            onClick={() => {
                              if (!drillTipoV) setDrillTipoV(entry.name);
                            }}
                            fill={!drillTipoV ? "url(#barFill)" : "#102f72ff"}
                            opacity={
                              drillTipoV && entry.name !== drillTipoV ? 0.35 : 1
                            }
                          />
                        ))}

                        {/* Valores al extremo derecho de la barra */}
                        <LabelList
                          dataKey="totalQ"
                          position="right"
                          content={({ x, y, width, height, value }) => (
                            <text
                              x={(x ?? 0) + (width ?? 0) + 8}
                              y={(y ?? 0) + (height ?? 0) / 2}
                              textAnchor="start"
                              dominantBaseline="middle"
                              fontSize={10}
                              fontWeight={700}
                              fill="#0f172a"
                            >
                              {fmtInt(value)}
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
            <div className="flex h-[400px] flex-col rounded-lg border border-slate-200 bg-white p-6 shadow-lg dark:bg-neutral-900">
              <div className="mb-3 text-center">
                <h3 className="mb-3 text-left text- ml-4 mt-2 text-xs text-red-900 font-bold dark:text-slate-100">
                  PDV vs No PDV
                </h3>
              </div>

              <div className="min-h-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart
                    margin={{ top: 0, right: 12, bottom: 12, left: 12 }}
                  >
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
                      isAnimationActive
                      minAngle={6}
                      label={({
                        cx,
                        cy,
                        midAngle,
                        innerRadius,
                        outerRadius,
                        value,
                        percent,
                      }) => {
                        const RADIAN = Math.PI / 180;
                        // Punto intermedio entre radio interno y externo
                        const r =
                          innerRadius + (outerRadius - innerRadius) * 0.62;
                        const x = cx + r * Math.cos(-midAngle * RADIAN);
                        const y = cy + r * Math.sin(-midAngle * RADIAN);

                        // Oculta etiquetas en segmentos muy pequeños (ej. < 4%)
                        if (percent < 0.04) return null;

                        return (
                          <text
                            x={x}
                            y={y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={10}
                            fontWeight={700}
                            fill="#0f172a"
                          >
                            {fmtInt(value)}
                          </text>
                        );
                      }}
                    >
                      {distPDV.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                          stroke="#fff"
                          strokeWidth={2}
                        />
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

                    {/* 👇 Leyenda xs + negrita */}
                    <Legend
                      verticalAlign="bottom"
                      align="center"
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{
                        fontSize: 11,
                        fontWeight: 700,
                        marginTop: 8,
                      }}
                      formatter={(value) => (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "#1f2937",
                          }}
                        >
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ====== COMPARATIVA + MTD/YTD ====== */}
          <div className="mt-8 grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_1.8fr]">
            {/* Comparativa (1 col) */}
            <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-md dark:bg-neutral-900">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="mb-1 ml-4 mt-1 text-left text-xs font-bold text-red-900 dark:text-slate-100">
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
                      {k === "anual"
                        ? "Anual"
                        : k === "trimestre"
                        ? "Trim."
                        : "Mes"}
                    </button>
                  ))}

                  {tipoVistaComparativa === "mes" && (
                    <select
                      value={mesComparativa}
                      onChange={(e) =>
                        setMesComparativa(Number(e.target.value))
                      }
                      className="rounded border border-slate-300 px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-neutral-900 dark:text-slate-200"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          {new Date(2025, m - 1).toLocaleString("es-PE", {
                            month: "long",
                          })}
                        </option>
                      ))}
                    </select>
                  )}

                  {tipoVistaComparativa === "trimestre" && (
                    <select
                      value={trimestreComparativa}
                      onChange={(e) =>
                        setTrimestreComparativa(Number(e.target.value))
                      }
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

              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={[...comparativaFiltrada].sort((a, b) => {
                    // si existe un índice de orden (mes/trimestre), respétalo; si no, ordena por name
                    const ka = [
                      "mes",
                      "month",
                      "m",
                      "trimestre",
                      "trim",
                      "q",
                    ].find((k) => a?.[k] != null);
                    const kb = [
                      "mes",
                      "month",
                      "m",
                      "trimestre",
                      "trim",
                      "q",
                    ].find((k) => b?.[k] != null);
                    if (ka && kb) return Number(a[ka]) - Number(b[kb]);
                    return String(a?.name || "").localeCompare(
                      String(b?.name || "")
                    );
                  })}
                  margin={{ top: 20, right: 15, left: 15, bottom: 12 }}
                  barGap={20}
                  barCategoryGap="30%"
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
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fontWeight: 600, fill: "#334155" }}
                  />

                  <Tooltip
                    content={({ label, payload = [] }) => {
                      if (!payload.length) return null;
                      const p = payload.reduce((acc, it) => {
                        acc[it.dataKey] = it.value;
                        return acc;
                      }, {});
                      const vari = payload.find((it) => it.dataKey === "actual")
                        ?.payload?.variacion;
                      const n =
                        typeof vari === "string"
                          ? parseFloat(vari)
                          : Number(vari);
                      const sign = Number.isFinite(n) ? (n > 0 ? "+" : "") : "";
                      const textVar = Number.isFinite(n)
                        ? `${sign}${n.toFixed(1)}%`
                        : vari ?? "—";
                      const colorVar = Number.isFinite(n)
                        ? n >= 0
                          ? "#16a34a"
                          : "#dc2626"
                        : "#334155";

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
                          <div
                            className="mt-0.5 text-[11px] font-semibold"
                            style={{ color: colorVar }}
                          >
                            Variación: {textVar}
                          </div>
                        </div>
                      );
                    }}
                  />

                  {/* 👇 Leyenda xs + negrita */}
                  <Legend
                    iconType="circle"
                    iconSize={10}
                    wrapperStyle={{
                      fontSize: 11,
                      fontWeight: 700,
                      marginTop: 4,
                    }}
                    formatter={(value) => (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#1f2937",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          marginRight: "6px",
                          display: "inline-block",
                        }}
                      >
                        {value}
                      </span>
                    )}
                  />

                  {/* Barra Año Pasado con labels de valor */}
                  <Bar
                    dataKey="pasado"
                    fill="url(#barPast)"
                    name="Año Pasado"
                    barSize={50}
                    radius={[6, 6, 0, 0]} // 👈 redondea la parte superior
                  >
                    <LabelList
                      dataKey="pasado"
                      position="top"
                      content={({ x, y, width, value }) => (
                        <text
                          x={(x ?? 0) + (width ?? 0) / 2} // 👈 centrado horizontalmente
                          y={(y ?? 0) - 8} // 👈 un poco más arriba de la barra
                          fill="#334155"
                          fontSize={10}
                          fontWeight={700}
                          textAnchor="middle"
                        >
                          {fmtInt?.(value) ?? value}
                        </text>
                      )}
                    />
                  </Bar>

                  {/* Barra Año Actual con labels de valor + tu variación (%) */}
                  <Bar
                    dataKey="actual"
                    fill="url(#barActual)"
                    name="Año Actual"
                    barSize={45}
                    radius={[6, 6, 0, 0]} // 👈 redondeo superior
                  >
                    {/* Solo porcentaje centrado arriba */}
                    <LabelList
                      dataKey="variacion"
                      position="top"
                      content={({ x, y, width, value }) => {
                        const n =
                          typeof value === "string"
                            ? parseFloat(value)
                            : Number(value);
                        const sign = Number.isFinite(n)
                          ? n > 0
                            ? "+"
                            : ""
                          : "";
                        const text = Number.isFinite(n)
                          ? `${sign}${n.toFixed(1)}%`
                          : value ?? "";
                        const color = Number.isFinite(n)
                          ? n >= 0
                            ? "#16a34a"
                            : "#dc2626"
                          : "#334155";

                        return (
                          <text
                            x={(x ?? 0) + (width ?? 0) / 2} // 👈 centrado horizontal
                            y={(y ?? 0) - 8} // 👈 justo encima de la barra
                            fill={color}
                            fontSize={11}
                            fontWeight={700}
                            textAnchor="middle"
                          >
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
            <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-md dark:bg-neutral-900">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="mb-1 ml-8 mt-1 text-left text-xs font-bold text-red-900 dark:text-slate-100">
                  Proyección
                </h3>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setVista("mes")}
                    className={`rounded px-2 py-1 text-[11px] ${
                      vista === "mes"
                        ? "bg-emerald-600 text-white"
                        : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    MTD
                  </button>
                  <button
                    onClick={() => setVista("ytd")}
                    className={`rounded px-2 py-1 text-[11px] ${
                      vista === "ytd"
                        ? "bg-emerald-600 text-white"
                        : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    YTD
                  </button>
                </div>
              </div>

              {(() => {
                const metasMes = { Q: 350, CF: 12000 }; // metas MTD

                return (
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart
                      layout="vertical"
                      data={[
                        {
                          name: "Q",
                          actual:
                            vista === "mes"
                              ? dataMesVsYTD?.mes?.Q
                              : dataMesVsYTD?.ytd?.Q,
                          meta: vista === "mes" ? metasMes.Q : proyAnual?.Q,
                          proy: vista === "mes" ? proyMes?.Q : proyAnual?.Q,
                        },
                        {
                          name: "CF",
                          actual:
                            vista === "mes"
                              ? dataMesVsYTD?.mes?.CF
                              : dataMesVsYTD?.ytd?.CF,
                          meta: vista === "mes" ? metasMes.CF : proyAnual?.CF,
                          proy: vista === "mes" ? proyMes?.CF : proyAnual?.CF,
                        },
                      ]}
                      margin={{ top: 20, right: 40, left: 8, bottom: 20 }}
                      barCategoryGap="35%"
                    >
                      {/* Gradientes sutiles para Q y CF */}
                      <defs>
                        <linearGradient id="gradQ" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#16a34a" />
                          <stop offset="100%" stopColor="#0f8a5a" />
                        </linearGradient>
                        <linearGradient id="gradCF" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#2563eb" />
                          <stop offset="100%" stopColor="#1e40af" />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        strokeDasharray="2 2"
                        horizontal
                        vertical={false}
                        stroke="#000000ff"
                      />
                      <XAxis
                        type="number"
                        domain={[0, (dataMax) => Math.ceil(dataMax * 1.12)]}
                        tick={false}
                        axisLine={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{
                          fontSize: 12,
                          fontWeight: 600,
                          fill: "#334155",
                        }}
                        axisLine={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                      />

                      <Tooltip
                        content={({ payload }) => {
                          if (!payload || payload.length === 0) return null;
                          const item = payload[0]?.payload;
                          const isQ = item.name === "Q";
                          return (
                            <div className="border border-slate-200 bg-white px-3 py-2 shadow-lg dark:border-slate-700 dark:bg-slate-900 text-[11px]">
                              <div className="mb-1 text-center font-semibold text-slate-800 dark:text-slate-100">
                                {item.name}
                              </div>
                              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                <span>Actual:</span>
                                <span className="font-semibold">
                                  {isQ
                                    ? fmtInt(item.actual)
                                    : fmtMoney(item.actual)}
                                </span>
                              </div>
                              {item.proy && (
                                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                  <span>Proyección:</span>
                                  <span className="font-semibold text-amber-600">
                                    {isQ
                                      ? fmtInt(item.proy)
                                      : fmtMoney(item.proy)}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        }}
                      />

                      {/* Barra elegante con puntas redondeadas (6) y color por serie */}
                      <Bar dataKey="actual" barSize={45} radius={[0, 6, 6, 0]}>
                        {[
                          { name: "Q", fill: "url(#gradQ)" },
                          { name: "CF", fill: "url(#gradCF)" },
                        ].map((cfg, i) => (
                          <Cell key={i} fill={cfg.fill} />
                        ))}
                      </Bar>

                      {/* Líneas de referencia (proyecciones) */}
                      {["Q", "CF"].map((key) => (
                        <React.Fragment key={key}>
                          {vista === "mes" &&
                            typeof proyMes?.[key] === "number" && (
                              <ReferenceLine
                                x={proyMes[key]}
                                stroke={key === "Q" ? "#f59e0b" : "#10b981"}
                                strokeWidth={2}
                                strokeDasharray="4 4"
                                label={{
                                  value: `Proy ${key}`,
                                  position: "right",
                                  fill: key === "Q" ? "#b45309" : "#0f766e",
                                  fontSize: 10,
                                }}
                              />
                            )}
                          {vista === "ytd" &&
                            typeof proyAnual?.[key] === "number" && (
                              <ReferenceLine
                                x={proyAnual[key]}
                                stroke={key === "Q" ? "#f59e0b" : "#10b981"}
                                strokeWidth={2}
                                strokeDasharray="4 4"
                                label={{
                                  value: `Proy ${key}`,
                                  position: "right",
                                  fill: key === "Q" ? "#b45309" : "#0f766e",
                                  fontSize: 10,
                                }}
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
