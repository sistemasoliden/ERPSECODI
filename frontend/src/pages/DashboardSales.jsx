import React, { useEffect, useState } from "react";
import api from "@/api/axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  LabelList,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  ComposedChart,
  ReferenceLine,
} from "recharts";

const MESES_COMPLETOS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const MONTHS_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const formatoSoles = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

export default function DashboardVentas() {
  const [dataOriginal, setDataOriginal] = useState([]);
  const [dataFiltrada, setDataFiltrada] = useState([]);
  const [añoSeleccionado, setAñoSeleccionado] = useState("");
  const [productoSeleccionado, setProductoSeleccionado] = useState("Todos");
  const [mesSeleccionado, setMesSeleccionado] = useState("");
  const [pdvSeleccionado, setPdvSeleccionado] = useState("");
  const [estadoSeleccionado, setEstadoSeleccionado] = useState("");
  const [loading, setLoading] = useState(true);
  const [dataSegmentos, setDataSegmentos] = useState([]);
  const [tipoDato, setTipoDato] = useState("CF");
  const [añosDisponibles, setAñosDisponibles] = useState([]);
  const [todosLosProductos, setTodosLosProductos] = useState([]);
  const [filtrarPDV, setFiltrarPDV] = useState(false);
  const [dataEstadosDona, setDataEstadosDona] = useState([]);
  const [dataTipoProductos, setDataTipoProductos] = useState([]);
  const [tipoSeleccionado, setTipoSeleccionado] = useState(null);
  const [dataPDV, setDataPDV] = useState([]);

  const [vista, setVista] = useState("mes");

  // Ya existente
  const [dataComparativa, setDataComparativa] = useState([]);

  // ✅ Nuevo estado para vista mensual/trimestral sin chocar
  const [tipoVistaComparativa, setTipoVistaComparativa] = useState("anual"); // anual | mes | trimestre
  const [mesComparativa, setMesComparativa] = useState(
    new Date().getMonth() + 1
  );
  const [trimestreComparativa, setTrimestreComparativa] = useState(1);

  const [dataMesVsYTD, setDataMesVsYTD] = useState({
    chart: [],
    mes: { Q: 0, CF: 0 },
    ytd: { Q: 0, CF: 0 },
  });

  useEffect(() => {
  api.get("/ventas/comparativa", {
    params: {
      // Solo modo 2: por tipo/mes/trimestre
      tipo: tipoVistaComparativa, // "anual" | "mes" | "trimestre"
      mes: tipoVistaComparativa === "mes" ? mesComparativa : undefined,
      trimestre: tipoVistaComparativa === "trimestre" ? trimestreComparativa : undefined,

      // Filtros
      productos: productoSeleccionado !== "Todos" ? productoSeleccionado : undefined, // string o array
      pdv: pdvSeleccionado || undefined,                                               // string o array
      estadoFinal: estadoSeleccionado || undefined,                                    // string o array
      conPDV: filtrarPDV ? "true" : undefined,                                          // enviar STRING
    },
  })
  .then((res) => setDataComparativa(res.data.comparativa))
  .catch((err) => console.error("❌ Error al cargar comparativa de ventas:", err));
}, [
  tipoVistaComparativa,
  mesComparativa,
  trimestreComparativa,
  productoSeleccionado,
  pdvSeleccionado,
  estadoSeleccionado,
  filtrarPDV,
]);



  const tituloComparativa =
    tipoVistaComparativa === "anual"
      ? "Comparativa Anual Q y CF"
      : tipoVistaComparativa === "mes"
      ? `Comparativa Mensual Q y CF (${
          [
            "Enero",
            "Febrero",
            "Marzo",
            "Abril",
            "Mayo",
            "Junio",
            "Julio",
            "Agosto",
            "Septiembre",
            "Octubre",
            "Noviembre",
            "Diciembre",
          ][mesComparativa - 1]
        })`
      : `Comparativa Trimestral Q y CF (T${trimestreComparativa})`;

  useEffect(() => {
    api
      .get("/ventas/pdv", {
        params: {
          año: añoSeleccionado || undefined,
          meses: mesSeleccionado || undefined,
          productos:
            productoSeleccionado !== "Todos" ? productoSeleccionado : undefined,
          pdv: pdvSeleccionado || undefined,
          estadoFinal: estadoSeleccionado || undefined, // 👈 si quieres que respete el filtro
          conPDV: filtrarPDV ? "true" : undefined, // 👈 ENVÍA STRING, no boolean
        },
      })
      .then((res) => setDataPDV(res.data))
      .catch((err) =>
        console.error("❌ Error al cargar el gráfico de PDV:", err)
      );
  }, [
    añoSeleccionado,
    mesSeleccionado,
    productoSeleccionado,
    pdvSeleccionado,
    estadoSeleccionado, // 👈 agrega si filtras por estado
    filtrarPDV,
  ]);

 useEffect(() => {
  const mesParam =
    mesSeleccionado && Number(mesSeleccionado) >= 1 && Number(mesSeleccionado) <= 12
      ? Number(mesSeleccionado)
      : undefined;

  api
    .get("/ventas/estados/conteo", {
      params: {
        año: añoSeleccionado || undefined,
        mes: mesParam,
        producto: productoSeleccionado !== "Todos" ? productoSeleccionado : undefined, // se interpreta como TIPO_V
        pdv: pdvSeleccionado || undefined,
        estadoFinal: estadoSeleccionado || undefined,   // 👈 ahora sí lo envías
        conPDV: filtrarPDV ? "true" : undefined,        // enviar STRING si está activo
      },
    })
    .then((res) => setDataEstadosDona(res.data))
    .catch((err) => console.error("❌ Error al cargar el gráfico de estados:", err));
}, [
  añoSeleccionado,
  mesSeleccionado,
  productoSeleccionado,
  pdvSeleccionado,
  estadoSeleccionado,   // 👈 agrégalo al array de dependencias
  filtrarPDV,
]);

  useEffect(() => {
    api
      .get("/ventas/productos")
      .then((res) => {
        const productosUnicos = [
          ...new Set(res.data.map((d) => d.producto)),
        ].sort();
        setTodosLosProductos(productosUnicos);

        // También: establecer años disponibles si no lo haces ya
        const años = [...new Set(res.data.map((d) => d.year))].sort(
          (a, b) => a - b
        );
        setAñosDisponibles(años.map(String));
      })
      .catch((err) => console.error("❌ Error al cargar productos:", err));
  }, []);

  useEffect(() => {
    api
      .get("/ventas/segmentos", {
        params: {
          año: añoSeleccionado,
          producto: productoSeleccionado,
          estadoFinal: estadoSeleccionado,
          mes: mesSeleccionado,
          pdv: pdvSeleccionado || undefined,
          conPDV: filtrarPDV,
        },
      })
      .then((res) => setDataSegmentos(res.data))
      .catch((err) => console.error("❌ Error al cargar segmentos:", err));
  }, [
    añoSeleccionado,
    productoSeleccionado,
    estadoSeleccionado,
    mesSeleccionado,
    pdvSeleccionado,
    filtrarPDV,
  ]);

  useEffect(() => {
    setLoading(true);
    api
      .get("/ventas/productos", {
        params: {
          estadoFinal: estadoSeleccionado || undefined,
          año: añoSeleccionado,
          productos:
            productoSeleccionado !== "Todos" ? productoSeleccionado : undefined,
          meses: mesSeleccionado || undefined,
          pdv: pdvSeleccionado || undefined,
          conPDV: filtrarPDV,
        },
      })
      .then((res) => {
        // Normaliza los estados a mayúsculas sin espacios
        const datosNormalizados = res.data.map((d) => ({
          ...d,
          estado: d.estado?.trim().toUpperCase() || "",
        }));
        setDataOriginal(datosNormalizados);
      })

      .catch((err) => console.error("❌ Error al cargar datos:", err))
      .finally(() => setLoading(false));
  }, [
    estadoSeleccionado,
    añoSeleccionado,
    productoSeleccionado,
    mesSeleccionado,
    pdvSeleccionado,
    filtrarPDV,
  ]);

  useEffect(() => {
    api
      .get("/ventas/tipos-productos", {
        params: {
          año: añoSeleccionado,
          mes: mesSeleccionado || undefined,
          producto:
            productoSeleccionado !== "Todos" ? productoSeleccionado : undefined,
          estadoFinal: estadoSeleccionado || undefined,
          pdv: pdvSeleccionado || undefined,
          conPDV: filtrarPDV,
        },
      })
      .then((res) => setDataTipoProductos(res.data))
      .catch((err) =>
        console.error("❌ Error al obtener tipos-productos:", err)
      );
  }, [
    añoSeleccionado,
    mesSeleccionado,
    productoSeleccionado,
    estadoSeleccionado,
    pdvSeleccionado,
    filtrarPDV,
  ]);

  const [estadosDisponibles, setEstadosDisponibles] = useState([]);

  useEffect(() => {
    api
      .get("/ventas/estados")
      .then((res) => {
        const estadosLimpiados = res.data
          .filter(
            (e) =>
              typeof e === "string" &&
              e.trim() !== "" &&
              e.toLowerCase() !== "null"
          )
          .map((e) => e.trim().toUpperCase());

        setEstadosDisponibles([...new Set(estadosLimpiados)]);
      })
      .catch((err) => console.error("❌ Error al cargar estados:", err));
  }, []);

  useEffect(() => {
    api
      .get("/ventas/mes-vs-ytd", {
        params: {
          año: añoSeleccionado || undefined,
          mes: mesSeleccionado || undefined,
          producto:
            productoSeleccionado !== "Todos" ? productoSeleccionado : undefined,
          pdv: pdvSeleccionado || undefined,
          estadoFinal: estadoSeleccionado || undefined,
          conPDV: filtrarPDV ? "true" : "false",
        },
      })
      .then((res) => setDataMesVsYTD(res.data)) // guarda res.data.chart para el BarChart
      .catch((err) => console.error("❌ Error Mes vs YTD:", err));
  }, [
    añoSeleccionado,
    mesSeleccionado,
    productoSeleccionado,
    pdvSeleccionado,
    estadoSeleccionado,
    filtrarPDV,
  ]);

  useEffect(() => {
    const filtrado = dataOriginal.filter(
      (d) =>
        (!añoSeleccionado || d.year === parseInt(añoSeleccionado)) &&
        (productoSeleccionado === "Todos" ||
          d.producto === productoSeleccionado) &&
        (!mesSeleccionado || d.month === parseInt(mesSeleccionado)) &&
        (!pdvSeleccionado || d.pdv === pdvSeleccionado)
    );

    const agrupado = MONTHS_SHORT.map((mes, i) => {
      const datosDelMes = filtrado.filter((d) => d.month === i + 1);
      const totalCF = datosDelMes.reduce((acc, cur) => acc + cur.totalCF, 0);
      const totalQ = datosDelMes.reduce((acc, cur) => acc + cur.Q, 0);
      return {
        name: mes,
        CF: totalCF,
        Q: totalQ,
      };
    });

    setDataFiltrada(agrupado);
  }, [
    añoSeleccionado,
    productoSeleccionado,
    mesSeleccionado,
    pdvSeleccionado,
    estadoSeleccionado,
    dataOriginal,
  ]);

  const datosMesSeleccionado = dataOriginal.filter(
    (d) =>
      (!añoSeleccionado || d.year === parseInt(añoSeleccionado)) &&
      (productoSeleccionado === "Todos" ||
        d.producto === productoSeleccionado) &&
      (!mesSeleccionado || d.month === parseInt(mesSeleccionado)) &&
      (!pdvSeleccionado || d.pdv === pdvSeleccionado)
  );

  const mesesDisponibles = Array.from({ length: 12 }, (_, i) => i + 1);
  const totalCF = datosMesSeleccionado.reduce(
    (acc, cur) => acc + cur.totalCF,
    0
  );
  const totalQ = datosMesSeleccionado.reduce((acc, cur) => acc + cur.Q, 0);

  const dataAgrupadaPorTipo = () => {
    const agrupado = new Map();

    dataTipoProductos.forEach((item) => {
      const tipo = item.tipo?.trim().toUpperCase() || "SIN INFORMACIÓN";
      agrupado.set(tipo, (agrupado.get(tipo) || 0) + item.total);
    });

    return Array.from(agrupado.entries()).map(([name, total]) => ({
      name,
      total,
    }));
  };

  const dataPorProducto = () => {
    if (!tipoSeleccionado) return [];

    return dataTipoProductos
      .filter((item) => item.tipo?.trim().toUpperCase() === tipoSeleccionado)
      .map((item) => ({
        name: item.producto?.trim().toUpperCase() || "SIN PRODUCTO",
        total: item.total,
      }));
  };

  return (
    <div className="mt-6 w-full max-w-7xl mx-auto px-20 pb-5">
      {loading ? (
        // 🔹 Loader global
        <div className="flex flex-col items-center justify-center py-40 text-center text-black dark:text-white">
          <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-blue-500 border-solid mb-4"></div>
          <p className="text-base font-semibold">
            Cargando datos, por favor espera...
          </p>
        </div>
      ) : (
        <>
          <h2 className="text-1xl font-bold mb-2 text-black dark:text-white font-['IBM Plex Sans']">
            REPORTE DE VENTAS
          </h2>

          <div className="flex flex-wrap items-end gap-4 mb-6">
            {/* Estado Final */}
            <div className="flex flex-col">
              <label className="text-xs font-medium text-black dark:text-neutral-300 mb-1">
                Estado
              </label>
              <select
                value={estadoSeleccionado}
                onChange={(e) => setEstadoSeleccionado(e.target.value)}
                className="border border-black dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs px-2 py-2 text-neutral-800 dark:text-white w-24 focus:outline-none focus:ring-1 focus:ring-blue-800"
              >
                <option value="">Todos</option>
                {estadosDisponibles.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado
                      .toLowerCase()
                      .split(" ")
                      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                      .join(" ")}
                  </option>
                ))}
              </select>
            </div>
            {/* Año */}
            <div className="flex flex-col">
              <label className="text-xs font-medium text-black dark:text-neutral-300 mb-1">
                Año
              </label>
              <select
                value={añoSeleccionado}
                onChange={(e) => setAñoSeleccionado(e.target.value)}
                className="border border-black dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs px-2 py-2 text-neutral-800 dark:text-white w-24 focus:outline-none focus:ring-1 focus:ring-blue-800"
              >
                <option value="">Todos</option>
                {añosDisponibles.map((año) => (
                  <option key={año} value={año}>
                    {año}
                  </option>
                ))}
              </select>
            </div>
            {/* Mes */}
            <div className="flex flex-col">
              <label className="text-xs font-medium text-black dark:text-neutral-300 mb-1">
                Mes
              </label>
              <select
                value={mesSeleccionado}
                onChange={(e) => setMesSeleccionado(e.target.value)}
                className="border border-black dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs px-2 py-2 text-neutral-800 dark:text-white w-24 focus:outline-none focus:ring-1 focus:ring-blue-800"
              >
                <option value="">Todos</option>
                {mesesDisponibles.map((mes) => (
                  <option key={mes} value={mes}>
                    {MESES_COMPLETOS[mes - 1]}
                  </option>
                ))}
              </select>
            </div>
            {/* Producto */}
            <div className="flex flex-col">
              <label className="text-xs font-medium text-black dark:text-neutral-300 mb-1">
                Producto
              </label>
              <select
                value={productoSeleccionado}
                onChange={(e) => setProductoSeleccionado(e.target.value)}
                className="border border-black dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs px-2 py-2 text-neutral-800 dark:text-white w-24 focus:outline-none focus:ring-1 focus:ring-blue-800"
              >
                <option value="Todos">Todos</option>
                {todosLosProductos.map((p) => (
                  <option key={p} value={p}>
                    {p
                      .toLowerCase()
                      .split(" ")
                      .map(
                        (word) => word.charAt(0).toUpperCase() + word.slice(1)
                      )
                      .join(" ")}
                  </option>
                ))}
              </select>
            </div>
            {/* PDV */}
            <div className="flex flex-col">
              <label className="text-xs font-medium text-black dark:text-neutral-300 px-2 py-2 w-24 mb-1">
                PDV
              </label>
              <button
                onClick={() => setFiltrarPDV((prev) => !prev)}
                className={
                  "text-xs px-3 py-2 border rounded-none focus:outline-none transition " +
                  (filtrarPDV
                    ? "bg-blue-800 text-white"
                    : "border-black dark:border-neutral-600 text-black dark:text-white bg-white dark:bg-neutral-800")
                }
              >
                {filtrarPDV ? "Con PDV " : "Solo con PDV"}
              </button>
            </div>

            <div className="flex flex-col justify-end">
              <button
                onClick={() => {
                  setAñoSeleccionado("");
                  setProductoSeleccionado("Todos");
                  setMesSeleccionado("");
                  setPdvSeleccionado("");
                  setEstadoSeleccionado("");
                  setFiltrarPDV(false);
                }}
                className="flex items-center gap-2 text-xs px-3 py-2 border border-red-800 text-red-800 hover:bg-red-100 dark:hover:bg-red-900 rounded-none focus:outline-none transition"
                title="Borrar todos los filtros"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m5 0H6"
                  />
                </svg>
                Borrar filtros
              </button>
            </div>
          </div>

          {/* Tarjetas resumen */}
          <div className="flex flex-col md:flex-row gap-4 md:justify-end w-full mb-6">
            {/* Tarjetas resumen */}
            <div className="grid grid-cols-1 items-center justify-center md:grid-cols-2 gap-4 w-full md:w-[36%] h-[100px]">
              <div className="bg-white dark:bg-neutral-800 border border-neutral-300 shadow  p-6">
                <h2 className="text-xs font-bold text-center text-black uppercase dark:text-neutral-300 mb-2">
                  Total de CF
                </h2>
                <p className="text-xl text-center font-bold text-red-800 dark:text-blue-400">
                  {formatoSoles.format(totalCF)}
                </p>
              </div>
              <div className="bg-white dark:bg-neutral-800 border border-neutral-300 shadow  p-6">
                <h2 className="text-xs font-bold text-center text-black uppercase dark:text-neutral-300 mb-2">
                  Total de Q
                </h2>
                <p className="text-xl text-center font-bold text-red-800 dark:text-green-400">
                  {totalQ.toLocaleString("es-PE")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
            {/* CONTENEDOR DE GRÁFICO DE LÍNEAS */}
            <div className="w-[700px] h-[350px] bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 p-8 shadow">
              <h3 className="text-xs font-bold mb-6 text-red-900 dark:text-white text-center uppercase">
                Gráfico de Progreso de Ventas
              </h3>

              <div className="flex gap-4 h-full">
                {/* Gráfico */}
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height={270}>
                    <LineChart
                      data={dataFiltrada}
                      margin={{ top: 20, left: 20, right: 20, bottom: 20 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={true}
                        horizontal={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10, fill: "#000" }}
                      />
                      <Tooltip
                        contentStyle={{
                          fontSize: "10px",
                          padding: "6px 8px",
                          minWidth: "80px",
                          textAlign: "center",
                          fontWeight: "bold",
                          textTransform: "Uppercase",
                        }}
                        formatter={(v) =>
                          tipoDato === "CF" ? formatoSoles.format(v) : v
                        }
                      />
                      <Legend
                        wrapperStyle={{
                          fontSize: "10px",
                          fontWeight: "bold",
                          color: "#000",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey={tipoDato}
                        stroke={tipoDato === "CF" ? "#0e8577ff" : "#0a0e70ff"}
                        strokeWidth={2}
                        dot
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Botones a la derecha */}
                <div className="flex flex-col gap-4 mt-16 items-center">
                  <button
                    onClick={() => setTipoDato("CF")}
                    className={`w-12 px-2 py-3 text-xs rounded-md transition text-center ${
                      tipoDato === "CF"
                        ? "bg-black text-white font-semibold"
                        : "bg-neutral-200 font-semibold text-black dark:bg-neutral-700 dark:text-white"
                    }`}
                  >
                    CF
                  </button>
                  <button
                    onClick={() => setTipoDato("Q")}
                    className={`w-12 px-2 py-3 text-xs rounded-md transition text-center ${
                      tipoDato === "Q"
                        ? "bg-black text-white font-semibold"
                        : "bg-neutral-200 font-semibold text-black dark:bg-neutral-700 dark:text-white"
                    }`}
                  >
                    Q
                  </button>
                </div>
              </div>
            </div>

            {/* CONTENEDOR DE GRÁFICO DE TORTA */}
            <div className="w-[400px] h-[350px] bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700  p-8 shadow">
              <h3 className="text-xs font-bold mb-6 text-red-900 dark:text-white text-center uppercase">
                Distribución por Segmento
              </h3>

              {dataSegmentos.length === 0 ? (
                <p className="text-xs text-black dark:text-white">
                  No hay datos
                </p>
              ) : (
                (() => {
                  const COLORS = [
                    "#001fcfff",
                    "#d12a00dc",
                    "#23e289d5",
                    "#FF8042",
                    "#AF19FF",
                    "#FF4560",
                    "#775DD0",
                    "#00E396",
                  ];

                  const total = dataSegmentos.reduce(
                    (sum, seg) => sum + seg.total,
                    0
                  );

                  return (
                    <div className="flex flex-col items-center justify-center">
                      <ResponsiveContainer width={300} height={200}>
                        <PieChart>
                          <Pie
                            data={dataSegmentos}
                            dataKey="total"
                            nameKey="segmento"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            innerRadius={50}
                            labelLine={false}
                            cornerRadius={6}
                          >
                            {dataSegmentos.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#ffffff",
                              border: "1px solid #ccc",
                              fontSize: "11px",
                              padding: "8px 12px",
                              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                              color: "#000",
                              textAlign: "center",
                              fontWeight: "bold",
                              textTransform: "uppercase",
                            }}
                            formatter={(value, name) => {
                              const porcentaje = (
                                (value / total) *
                                100
                              ).toFixed(2);
                              return [
                                `${value} EMPRESAS (${porcentaje}%)`,
                                name,
                              ];
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>

                      <ul className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-xs text-black font-semibold dark:text-white justify-center">
                        {dataSegmentos.map((entry, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full inline-block"
                              style={{
                                backgroundColor: COLORS[index % COLORS.length],
                              }}
                            />
                            <span className="text-black dark:text-white">
                              {entry.segmento
                                ? entry.segmento.charAt(0).toUpperCase() +
                                  entry.segmento.slice(1).toLowerCase()
                                : "Sin información"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
          {/* FILA DE PROYECCION*/}
          <div className="mt-4 flex flex-col lg:flex-row gap-4 w-full h-[350px]">
            {/* GRÁFICO 1 */}
            <div className="flex-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700  p-6 shadow">
              <h3 className="text-xs font-bold mb-4 text-red-900 dark:text-white text-center uppercase">
                Distribución por Estado Final
              </h3>

              {dataEstadosDona.length === 0 ? (
                <p className="text-sm text-center text-black dark:text-white">
                  No hay datos
                </p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={dataEstadosDona}
                        dataKey="total"
                        nameKey="estado"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40} // más grande para que se note más el borde interno
                        minAngle={25}
                        labelLine={false}
                        cornerRadius={6} // se aplicará en ambos lados, pero se verá más en el interior
                      >
                        {dataEstadosDona.map((entry, index) => {
                          const estado = entry.estado?.toUpperCase() || "OTRO";
                          const color =
                            estado === "APROBADO"
                              ? "#001fcfff"
                              : estado === "RECHAZADO"
                              ? "#23e289d5"
                              : estado === "EN EVALUACION"
                              ? "#d12a00dc"
                              : "#6c757d";

                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Pie>

                      <Tooltip
                        formatter={(value, name) => {
                          const total = dataEstadosDona.reduce(
                            (acc, cur) => acc + cur.total,
                            0
                          );
                          const porcentaje = ((value / total) * 100).toFixed(2);
                          return [`${value} registros (${porcentaje}%)`, name];
                        }}
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          fontSize: "11px",
                          fontWeight: "bold",
                          textTransform: "uppercase",
                          border: "1px solid #ccc",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Leyenda sincronizada */}
                  <ul className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-xs font-semibold justify-center text-black dark:text-white">
                    {dataEstadosDona.map((entry, index) => {
                      const estado = entry.estado?.toUpperCase() || "OTRO";
                      const color =
                        estado === "APROBADO"
                          ? "#001fcfff"
                          : estado === "RECHAZADO"
                          ? "#23e289d5"
                          : estado === "EN EVALUACION"
                          ? "#d12a00dc"
                          : "#6c757d";

                      return (
                        <li
                          key={index}
                          className="flex items-center gap-2 capitalize"
                        >
                          <span
                            className="w-3 h-3 rounded-full inline-block"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-black dark:text-white font-semibold">
                            {entry.estado?.toLowerCase()}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>

            {/* GRÁFICO 2 */}
            <div className="flex-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 p-6 shadow">
              {/* Título centrado */}
              <div className="relative mb-4">
                <h3 className="text-xs font-bold text-red-900 dark:text-white uppercase text-center">
                  Distribución por Tipo de Venta
                </h3>

                {tipoSeleccionado && (
                  <button
                    onClick={() => setTipoSeleccionado(null)}
                    className="absolute right-2 top-1 text-sm font-bold text-black hover:text-blue-600 dark:text-blue-300 dark:hover:text-blue-400"
                  >
                    🡸
                  </button>
                )}
              </div>

              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={
                    tipoSeleccionado ? dataPorProducto() : dataAgrupadaPorTipo()
                  }
                  margin={{ top: 20, right: 20, left: 20, bottom: 30 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={true}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    tick={({ x, y, payload, index }) => {
                      const dy = index % 2 === 0 ? 0 : 16;
                      const label =
                        typeof payload.value === "string"
                          ? payload.value.charAt(0).toUpperCase() +
                            payload.value.slice(1).toLowerCase()
                          : payload.value;
                      return (
                        <text
                          x={x}
                          y={y + dy}
                          dy={16}
                          textAlign="middle"
                          fontSize={10}
                          fontWeight="bold"
                          fill="#333"
                        >
                          {label}
                        </text>
                      );
                    }}
                  />
                  <Tooltip
                    formatter={(v) => `${v} registros`}
                    contentStyle={{
                      fontSize: "10px",
                      fontWeight: "bold",
                      textAlign: "center",
                      textTransform: "uppercase",
                    }}
                  />
                  <Bar
                    dataKey="total"
                    fill="#ac0202d0"
                    minPointSize={35}
                    barSize={45}
                    stroke="none"
                    animationDuration={300}
                    onClick={(data) => {
                      if (!tipoSeleccionado) {
                        setTipoSeleccionado(data.name);
                      }
                    }}
                  >
                    <LabelList
                      dataKey="total"
                      position="top"
                      content={({ x, y, value }) => (
                        <text
                          x={x + 22}
                          y={y - 6}
                          fill="#0e0e0efd"
                          fontSize={10}
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {value}
                        </text>
                      )}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* GRÁFICO 3 */}
            <div className="flex-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700  p-6 shadow">
              <h3 className="text-xs font-bold mb-4 text-red-900 dark:text-white text-center uppercase">
                Distribucion por Venta PDV
              </h3>
              {/* Puedes usar otro gráfico aquí */}
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={dataPDV}
                    dataKey="totalQ"
                    nameKey="tipo"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    minAngle={5} // 👈 más pequeño para permitir ángulos chicos
                    labelLine={false}
                    cornerRadius={6}
                  >
                    {dataPDV.map((entry, index) => {
                      const color =
                        entry.tipo?.toUpperCase() === "CON PDV"
                          ? "#001fcfff"
                          : "#d12a00dc";
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Pie>
                  <Tooltip
                    formatter={(value, name, props) => {
                      const totalQ = dataPDV.reduce(
                        (acc, cur) => acc + (cur.totalQ || 0),
                        0
                      );
                      const totalCF = dataPDV.reduce(
                        (acc, cur) => acc + (cur.totalCF || 0),
                        0
                      );

                      const q = props.payload.totalQ || 0;
                      const cf = props.payload.totalCF || 0;

                      const pQ = totalQ
                        ? ((q / totalQ) * 100).toFixed(2)
                        : "0.00";
                      const pCF = totalCF
                        ? ((cf / totalCF) * 100).toFixed(2)
                        : "0.00";

                      return [
                        `${q}  (${pQ}%)\n${formatoSoles.format(cf)} (${pCF}%)`,
                        name,
                      ];
                    }}
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      fontSize: "11px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      textAlign: "center",
                      whiteSpace: "pre-line",
                      maxWidth: "150px", // 👈 más angosto
                      padding: "6px 8px", // 👌 un poco de aire
                      border: "1px solid #ccc",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                      lineHeight: "1.3", // mejora lectura
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Leyenda */}
              <ul className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-xs font-semibold justify-center text-black dark:text-white">
                {dataPDV.map((entry, index) => {
                  const color =
                    entry.tipo?.toUpperCase() === "CON PDV"
                      ? "#001fcfff"
                      : "#d12a00dc";
                  return (
                    <li
                      key={index}
                      className="flex items-center gap-2 capitalize"
                    >
                      <span
                        className="w-3 h-3 rounded-full inline-block"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-black dark:text-white font-semibold">
                        {entry.tipo?.toLowerCase()}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="mt-4 flex flex-col lg:flex-row gap-4 w-full h-[350px]">
            {/* GRÁFICO 1 */}
            {/* 📌 Contenedor gráfico + filtros */}
            <div className="lg:basis-1/3 min-w-0 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 p-6 shadow flex flex-col">
              {/* 🔹 Selectores de vista */}
              <div className="flex gap-2 mb-4 justify-center flex-wrap">
                <select
                  value={tipoVistaComparativa}
                  onChange={(e) => setTipoVistaComparativa(e.target.value)}
                  className="border border-black px-2 py-1.5 text-xs"
                >
                  <option value="anual">Anual</option>
                  <option value="mes">Mensual</option>
                  <option value="trimestre">Trimestral</option>
                </select>

                {tipoVistaComparativa === "mes" && (
                  <select
                    value={mesComparativa}
                    onChange={(e) => setMesComparativa(Number(e.target.value))}
                    className="border rounded px-2 py-1 text-xs"
                  >
                    {[
                      "Enero",
                      "Febrero",
                      "Marzo",
                      "Abril",
                      "Mayo",
                      "Junio",
                      "Julio",
                      "Agosto",
                      "Septiembre",
                      "Octubre",
                      "Noviembre",
                      "Diciembre",
                    ].map((nombre, index) => (
                      <option key={index} value={index + 1}>
                        {nombre}
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
                    className="border rounded px-2 py-1 text-xs"
                  >
                    <option value={1}>T1 (Ene-Mar)</option>
                    <option value={2}>T2 (Abr-Jun)</option>
                    <option value={3}>T3 (Jul-Sep)</option>
                    <option value={4}>T4 (Oct-Dic)</option>
                  </select>
                )}
              </div>

              {/* 🔹 Título */}
              <h3 className="text-xs font-bold mb-4 text-red-900 dark:text-white text-center uppercase">
                {tituloComparativa}
              </h3>

              {/* 🔹 Gráfico */}
              {dataComparativa.length === 0 ? (
                <p className="text-sm text-center text-black dark:text-white">
                  No hay datos
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={dataComparativa}
                    margin={{ top: 20, right: 10, left: 10, bottom: 30 }}
                    barCategoryGap={30}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fontWeight: "bold", fill: "#333" }}
                    />

                    <Tooltip
                      formatter={(value, serieName, props) => {
                        const categoria = props?.payload?.name; // "Q" o "CF"
                        const isCF = categoria === "CF";
                        const val = isCF
                          ? formatoSoles.format(value)
                          : new Intl.NumberFormat("es-PE").format(value);
                        return [val, serieName.toUpperCase()];
                      }}
                      contentStyle={{
                        fontSize: "0.55rem",
                        textAlign: "center",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                      }}
                    />

                    <Legend
                      iconType="circle"
                      iconSize={10}
                      wrapperStyle={{
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                      }}
                    />

                    <Bar
                      dataKey="pasado"
                      fill="#9e2b0ee3"
                      name="Año Pasado"
                      minPointSize={25}
                    />
                    <Bar
                      dataKey="actual"
                      fill="#001279d2"
                      name="Año Actual"
                      minPointSize={25}
                    >
                      <LabelList
                        dataKey="variacion"
                        content={({ x, y, width, value }) => {
                          const formatted = `${
                            value > 0 ? "+" : ""
                          }${value.toFixed(1)}%`;
                          return (
                            <text
                              x={x + width / 2}
                              y={y - 10}
                              textAnchor="middle"
                              fill="#1a1a1a"
                              fontSize={10}
                              fontWeight="bold"
                            >
                              {formatted}
                            </text>
                          );
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* GRÁFICO 2 */}
            {/* TARJETA: Mes vs Acumulado del Año (YTD) */}
            {/* TARJETA: Mes vs Acumulado del Año (YTD) con PROYECCIONES */}
            <div className="lg:basis-2/3 min-w-0 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 p-6 shadow">
              <h3 className="text-xs font-bold mb-1 text-red-900 dark:text-white text-center uppercase mb-4">
                Mes vs Acumulado del Año (YTD)
              </h3>

              {!dataMesVsYTD || !dataMesVsYTD.meta ? (
                <p className="text-sm text-center text-black dark:text-white">
                  No hay datos
                </p>
              ) : (
                (() => {
                  const meta = dataMesVsYTD.meta;

                  // --- fechas/meta ---
                  const monthStart = new Date(meta.monthStartISO);
                  const monthEnd = new Date(meta.monthEndISO);
                  const ytdStart = new Date(meta.ytdStartISO);
                  const ytdEnd = new Date(meta.ytdEndISO); // "hoy + 1 día (exclusivo)"

                  // días transcurridos y totales
                  const msDia = 24 * 60 * 60 * 1000;
                  const diasMesTrans = Math.max(
                    1,
                    Math.round(
                      (Math.min(ytdEnd, monthEnd) - monthStart) / msDia
                    )
                  );
                  const diasMesTotal = Math.max(
                    1,
                    Math.round((monthEnd - monthStart) / msDia)
                  );
                  const anioEnd = new Date(meta.year + 1, 0, 1);
                  const diasAnioTrans = Math.max(
                    1,
                    Math.round((ytdEnd - ytdStart) / msDia)
                  );
                  const diasAnioTotal = Math.max(
                    1,
                    Math.round((anioEnd - ytdStart) / msDia)
                  );

                  // --- valores reales (del backend) ---
                  const YTD_Q = dataMesVsYTD?.ytd?.Q ?? 0;
                  const YTD_CF = dataMesVsYTD?.ytd?.CF ?? 0;

                  // Si tu endpoint devuelve MTD, úsalo; si no, puedes setearlo = mes completo o 0.
                  const MTD_Q = dataMesVsYTD?.mes?.Q ?? 0;
                  const MTD_CF = dataMesVsYTD?.mes?.CF ?? 0;

                  // --- proyecciones lineales ---
                  const proyMesQ =
                    diasMesTrans > 0
                      ? MTD_Q * (diasMesTotal / diasMesTrans)
                      : 0;
                  const proyMesCF =
                    diasMesTrans > 0
                      ? MTD_CF * (diasMesTotal / diasMesTrans)
                      : 0;

                  const proyAnioQ =
                    diasAnioTrans > 0
                      ? YTD_Q * (diasAnioTotal / diasAnioTrans)
                      : 0;
                  const proyAnioCF =
                    diasAnioTrans > 0
                      ? YTD_CF * (diasAnioTotal / diasAnioTrans)
                      : 0;

                  // dataset horizontal (Q y CF como categorías)
                  const data = [
                    {
                      name: "Q",
                      MTD: Math.round(MTD_Q),
                      YTD: Math.round(YTD_Q),
                      proyMesMTD: Math.round(proyMesQ), // 👈 para barra roja
                      proyAnioYTD: Math.round(proyAnioQ), // 👈 para barra verde
                      tipo: "Q",
                    },
                    {
                      name: "CF",
                      MTD: MTD_CF,
                      YTD: YTD_CF,
                      proyMesMTD: proyMesCF,
                      proyAnioYTD: proyAnioCF,
                      tipo: "CF",
                    },
                  ];

                  const fmt = (v, isCF) =>
                    isCF
                      ? formatoSoles.format(v)
                      : new Intl.NumberFormat("es-PE").format(v);

                  return (
                    <>
                      {/* 🔹 Botones de cambio de vista */}
                      <div className="flex justify-center gap-2 mb-4">
                        <button
                          onClick={() => setVista("mes")}
                          className={`px-3 py-2  text-xs font-bold ${
                            vista === "mes"
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 dark:bg-neutral-700 text-black dark:text-white"
                          }`}
                        >
                          Mes
                        </button>
                        <button
                          onClick={() => setVista("anio")}
                          className={`px-3 py-2 text-xs font-bold ${
                            vista === "anio"
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 dark:bg-neutral-700 text-black dark:text-white"
                          }`}
                        >
                          Año
                        </button>
                      </div>

                      <ResponsiveContainer width="100%" height={260}>
                        <ComposedChart
                          layout="vertical"
                          data={data}
                          margin={{ top: 0, right: 40, left: 0, bottom: 40 }}
                          barCategoryGap="80%"
                          barGap={0}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            horizontal={true}
                            vertical={false}
                          />

                          <XAxis
                            type="number"
                            tick={{ fontSize: 11, fill: "#333" }}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{
                              fontSize: 12,
                              fontWeight: "bold",
                              fill: "#333",
                            }}
                          />

                          <Tooltip
                            formatter={(value, serieName, { payload }) => {
                              const isCF = payload?.tipo === "CF";
                              return [
                                fmt(value, isCF).toUpperCase(),
                                serieName.toUpperCase(),
                              ];
                            }}
                            labelFormatter={(label, payload) => {
                              const item = payload[0]?.payload;
                              if (!item) return label.toUpperCase();
                              const isCF = item.tipo === "CF";

                              // Proyección según vista
                              const color =
                                vista === "mes" ? "#9e2b0ee3" : "#000000cb";

                              const proyLabel =
                                vista === "mes"
                                  ? "Proyección Mes"
                                  : "Proyección Año";
                              const proyValue =
                                vista === "mes"
                                  ? item.proyMesMTD
                                  : item.proyAnioYTD;

                              return (
                                <div
                                  style={{
                                    textAlign: "center",
                                    fontSize: "0.75rem",
                                    fontWeight: "bold",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  <div style={{ color }}>{proyLabel}</div>
                                  <div style={{ color: "#000000e3" }}>
                                    {fmt(proyValue, isCF).toUpperCase()}
                                  </div>
                                </div>
                              );
                            }}
                            contentStyle={{
                              fontSize: "0.75rem",
                              textAlign: "center",
                              fontWeight: "bold",
                              textTransform: "uppercase",
                              padding: "6px 8px",
                            }}
                          />

                          <Legend
                            iconType="circle"
                            iconSize={10}
                            wrapperStyle={{
                              fontSize: "0.75rem",
                              fontWeight: "bold",
                            }}
                          />

                          <Bar
                            dataKey={vista === "mes" ? "MTD" : "YTD"}
                            name={vista === "mes" ? "Ventas Mes" : "Ventas Año"}
                            fill={
                              vista === "mes"
                                ? "rgba(12, 175, 197, 1)"
                                : "#c92a03e7"
                            }
                            barSize={30}
                            minPointSize={10}
                          >
                            <LabelList
                              dataKey={vista === "mes" ? "MTD" : "YTD"}
                              content={({
                                x,
                                y,
                                width,
                                height,
                                value,
                                payload,
                              }) => {
                                if (!value) return null;
                                const isCF = payload?.tipo === "CF";
                                return (
                                  <text
                                    x={x + width + 5}
                                    y={y + height / 2 + 3}
                                    textAnchor="start"
                                    fontSize={10}
                                    fontWeight="bold"
                                    fill="#1a1a1a"
                                  >
                                    {fmt(value, isCF)}
                                  </text>
                                );
                              }}
                            />
                          </Bar>

                          {/* Línea de proyección condicionada */}
                          {data.map((item) => (
                            <ReferenceLine
                              key={item.name}
                              x={
                                vista === "mes"
                                  ? item.proyMesMTD
                                  : item.proyAnioYTD
                              }
                              stroke={
                                vista === "mes" ? "#794400ff" : "#9900a7ff"
                              }
                              strokeDasharray={vista === "mes" ? "6 4" : "4 3"}
                              strokeWidth={2}
                              ifOverflow="extendDomain"
                              label={{ position: "top", fontSize: 9 }}
                            />
                          ))}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </>
                  );
                })()
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
