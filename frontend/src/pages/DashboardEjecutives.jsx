import React, { useEffect, useState } from "react";
import api from "@/api/axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
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

export default function DashboardVentas() {
  const [dataOriginalCompleta, setDataOriginalCompleta] = useState([]);
  const [añoSeleccionado, setAñoSeleccionado] = useState("");
  const [productoSeleccionado, setProductoSeleccionado] = useState("Todos");
  const [mesSeleccionado, setMesSeleccionado] = useState("");
  const [estadoSeleccionado, setEstadoSeleccionado] = useState("");
  const [filtrarPDV, setFiltrarPDV] = useState(false);
  const [dataConsultores, setDataConsultores] = useState([]);
  const [estadosDisponibles, setEstadosDisponibles] = useState([]);
  const [cargaInicial, setCargaInicial] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cargaInicial) return;

    const hoy = new Date();
    const mesActual = (hoy.getMonth() + 1).toString();
    const añoActual = hoy.getFullYear().toString();

    setAñoSeleccionado(añoActual);
    setMesSeleccionado(mesActual);

    setTimeout(() => {
      api
        .get("/ejecutivos/consultores", {
          params: {
            año: añoActual,
            mes: mesActual,
          },
        })
        .then((res) => {
          setDataConsultores(res.data);
          setTimeout(() => setLoading(false), 300);
        })
        .catch((err) => {
          console.error("❌ Error inicial:", err);
          setLoading(false);
        });
    }, 100);

    setCargaInicial(false);
  }, [cargaInicial]);

  // Obtener datos completos al inicio (sin filtros)
  useEffect(() => {
    api
      .get("/ventas/productos")
      .then((res) => {
        const datos = res.data.map((d) => ({
          ...d,
          estado: d.estado?.trim().toUpperCase() || "",
        }));
        setDataOriginalCompleta(datos);
      })
      .catch((err) => console.error("❌ Error al cargar data completa:", err));
  }, []);

  // Cargar consultores
  useEffect(() => {
    const params = {};

    if (añoSeleccionado) params.año = añoSeleccionado;
    if (mesSeleccionado) params.mes = mesSeleccionado;
    if (estadoSeleccionado) params.estadoFinal = estadoSeleccionado;
    if (productoSeleccionado !== "Todos")
      params.producto = productoSeleccionado;
    if (filtrarPDV) params.conPDV = true;

    api
      .get("/ejecutivos/consultores", { params })
      .then((res) => setDataConsultores(res.data))
      .catch((err) =>
        console.error("❌ Error al cargar datos de consultores:", err)
      );
  }, [
    añoSeleccionado,
    mesSeleccionado,
    estadoSeleccionado,
    productoSeleccionado,
    filtrarPDV,
  ]);

  // Cargar estados disponibles
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

  const añosDisponibles = [
    ...new Set(dataOriginalCompleta.map((d) => d.year)),
  ].sort((a, b) => a - b);
  const mesesDisponibles = [
    ...new Set(dataOriginalCompleta.map((d) => d.month)),
  ].sort((a, b) => a - b);
  const todosLosProductos = [
    ...new Set(dataOriginalCompleta.map((d) => d.producto)),
  ].sort();

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-neutral-900 z-49 text-center">
        <div className="flex flex-col items-center translate-y-28">
          {/* Círculo animado */}
          <div className="flex flex-col items-center justify-center py-40 text-center text-black dark:text-white">
            <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-blue-500 border-solid mb-4"></div>
            <p className="text-base font-semibold">
              Cargando datos, por favor espera...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 w-full max-w-7xl mx-auto px-20 pb-5">
      <h2 className="text-1xl font-bold mb-4 text-black dark:text-white font-['IBM Plex Sans']">
        REPORTE DE VENTAS
      </h2>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
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
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
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
              setMesSeleccionado("");
              setProductoSeleccionado("Todos");
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

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Gráfico Q */}
        <div className="bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 p-6 shadow">
          <h3 className="text-xs font-bold mb-4 text-red-900 dark:text-white text-center uppercase">
            Consultores por Cantidad de Líneas
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={dataConsultores}
              margin={{ top: 10, bottom: 0, right: 10, left: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal
                vertical={false}
              />
              <XAxis
                dataKey="consultor"
                interval={0}
                height={80}
                tickLine={false}
                tick={({ x, y, payload }) => {
                  const partes = payload.value.trim().split(" ");
                  const primerNombre = partes[0] || "";
                  const segundaInicial = partes[1] ? partes[1][0] + "." : "";
                  const texto = `${primerNombre} ${segundaInicial}`;
                  const dy = 50;

                  return (
                    <text
                      x={x + 20}
                      y={y + 50}
                      textAnchor="middle"
                      fontSize={8}
                      fontWeight="bold"
                      fill="#333"
                      transform={`rotate(-90, ${x}, ${y + dy})`}
                      dominantBaseline={"middle"}
                    >
                      {texto}
                    </text>
                  );
                }}
              />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div
                        style={{
                          width: "150px",
                          height: "60px",
                          backgroundColor: "#fff",
                          border: "1px solid #ccc",
                          fontSize: "9px",
                          fontWeight: "bold",
                          textAlign: "center",
                          textTransform: "uppercase",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          alignItems: "center",
                          padding: "4px",
                        }}
                      >
                        <div
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            width: "100%",
                            color: "#111",
                          }}
                        >
                          {label}
                        </div>
                        <div
                          style={{
                            color: "#065f55da", // rojo oscuro para valor
                          }}
                        >
                          {`${payload[0].value} LÍNEAS`}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Bar
                dataKey="totalQ"
                fill="#065f55da"
                barSize={40}
                minPointSize={5}
              ></Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico CF */}
        <div className="bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 p-6 shadow">
          <h3 className="text-xs font-bold mb-4 text-red-900 dark:text-white text-center uppercase">
            Consultores por Cargo Fijo
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={dataConsultores}
              margin={{ top: 10, bottom: 0, right: 10, left: 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal
                vertical={false}
              />
              <XAxis
                dataKey="consultor"
                interval={0}
                height={80}
                tickLine={false}
                tick={({ x, y, payload }) => {
                  const partes = payload.value.trim().split(" ");
                  const primerNombre = partes[0] || "";
                  const segundaInicial = partes[1] ? partes[1][0] + "." : "";
                  const texto = `${primerNombre} ${segundaInicial}`;
                  const dy = 50;

                  return (
                    <text
                      x={x + 20}
                      y={y + 50}
                      textAnchor="middle"
                      fontSize={8}
                      fontWeight="bold"
                      fill="#333"
                      transform={`rotate(-90, ${x}, ${y + dy})`}
                      dominantBaseline={"middle"}
                    >
                      {texto}
                    </text>
                  );
                }}
              />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div
                        style={{
                          width: "150px",
                          height: "60px",
                          backgroundColor: "#fff",
                          border: "1px solid #ccc",
                          fontSize: "9px",
                          fontWeight: "bold",
                          textAlign: "center",
                          textTransform: "uppercase",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          alignItems: "center",
                          padding: "4px",
                        }}
                      >
                        <div
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            width: "100%",
                          }}
                        >
                          {label}
                        </div>
                        <div
                          style={{
                            color: "#0a0e70", // rojo oscuro para valor
                          }}
                        >
                          {new Intl.NumberFormat("es-PE", {
                            style: "currency",
                            currency: "PEN",
                          }).format(payload[0].value)}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Bar
                dataKey="totalCF"
                fill="#0a0e70"
                barSize={40}
                minPointSize={5}
              ></Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
