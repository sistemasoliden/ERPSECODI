import React, { useEffect, useState, useRef, useMemo } from "react";
import api from "@/api/axios";
import { ChevronDown, Search } from "lucide-react";

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
const MONTH_ORDER = [
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
  const [productoSeleccionado, setProductoSeleccionado] = useState("Todos");

  const [estadoSeleccionado, setEstadoSeleccionado] = useState("");
  const [filtrarPDV, setFiltrarPDV] = useState(false);
  const [dataConsultores, setDataConsultores] = useState([]);
  const [dataOriginalCompleta, setDataOriginalCompleta] = useState([]);
  const [estadosDisponibles, setEstadosDisponibles] = useState([]);

  const [expandedYears, setExpandedYears] = useState({});
  const [expandedMonths, setExpandedMonths] = useState({});
  const [consultoresDisponibles, setConsultoresDisponibles] = useState([]);
  const [consultoresSeleccionados, setConsultoresSeleccionados] = useState([]);
  const [showConsultorDropdown, setShowConsultorDropdown] = useState(false);
  const consultorDropdownRef = useRef(null);
  const [expandedConsultores, setExpandedConsultores] = useState({});

  const [filtroMeses, setFiltroMeses] = useState([]);
  const [showMesDropdown, setShowMesDropdown] = useState(false);
  const [añosOriginales, setAñosOriginales] = useState([]);
  const [añoSeleccionado, setAñoSeleccionado] = useState("");
  const [loading, setLoading] = useState(true);
  const mesDropdownRef = useRef(null);
  const firstLoadRef = useRef(true);

  const [consultorSearch, setConsultorSearch] = useState("");

  const normalize = (s = "") =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const consultoresFiltrados = useMemo(
    () =>
      consultoresDisponibles.filter((c) =>
        normalize(c).includes(normalize(consultorSearch))
      ),
    [consultoresDisponibles, consultorSearch]
  );

  const toggleConsultor = (nombre) =>
    setConsultoresSeleccionados((prev) =>
      prev.includes(nombre)
        ? prev.filter((n) => n !== nombre)
        : [...prev, nombre]
    );

  const seleccionarTodosFiltrados = () =>
    setConsultoresSeleccionados((prev) => [
      ...new Set([...prev, ...consultoresFiltrados]),
    ]);

  const limpiarSeleccion = () => setConsultoresSeleccionados([]);

  const formatoSoles = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  });

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        consultorDropdownRef.current &&
        !consultorDropdownRef.current.contains(event.target)
      ) {
        setShowConsultorDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        mesDropdownRef.current &&
        !mesDropdownRef.current.contains(event.target)
      ) {
        setShowMesDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const params = {};
    if (añoSeleccionado) params.año = añoSeleccionado;
    if (filtroMeses.length > 0) {
      params.meses = filtroMeses
        .map((m) => MESES_COMPLETOS.indexOf(m) + 1)
        .join(",");
    }
    if (estadoSeleccionado) params.estadoFinal = estadoSeleccionado;
    if (productoSeleccionado !== "Todos")
      params.producto = productoSeleccionado;
    if (filtrarPDV) params.conPDV = true;

    api
      .get("ejecutivos/consultores-disponibles", { params })
      .then((res) => {
        setConsultoresDisponibles(res.data);
      })
      .catch((err) => {
        console.error("❌ Error al cargar consultores:", err);
      });
  }, [
    añoSeleccionado,
    filtroMeses,
    estadoSeleccionado,
    productoSeleccionado,
    filtrarPDV,
  ]);

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
    api.get("/ejecutivos/consultorestabla").then((res) => {
      setDataOriginalCompleta(res.data);

      const añosUnicos = [
        ...new Set(res.data.map((item) => item.year).filter(Boolean)),
      ].sort((a, b) => a - b);

      setAñosOriginales(añosUnicos);
    });
  }, []);

  useEffect(() => {
    const params = {};
    if (añoSeleccionado) params.año = añoSeleccionado;
    if (filtroMeses.length > 0) {
      const mesesNumeros = filtroMeses.map(
        (m) => MESES_COMPLETOS.indexOf(m) + 1
      );
      params.meses = mesesNumeros;
    }
    if (estadoSeleccionado) params.estadoFinal = estadoSeleccionado;
    if (productoSeleccionado !== "Todos")
      params.producto = productoSeleccionado;
    if (filtrarPDV) params.conPDV = true;
    if (consultoresSeleccionados.length > 0) {
      params.consultor = consultoresSeleccionados.join(",");
    }

    // 👇 Solo mostramos el overlay en la PRIMERA carga
    const shouldShowLoader = firstLoadRef.current;
    if (shouldShowLoader) setLoading(true);

    api
      .get("/ejecutivos/consultorestabla", { params })
      .then((res) => {
        setDataConsultores(res.data);
        setDataOriginalCompleta(res.data);
      })
      .catch((err) =>
        console.error("❌ Error al cargar datos de consultores:", err)
      )
      .finally(() => {
        if (shouldShowLoader) {
          setLoading(false);
          firstLoadRef.current = false; // ✅ a partir de aquí, no volverá a mostrar overlay
        }
      });
  }, [
    añoSeleccionado,
    filtroMeses,
    estadoSeleccionado,
    productoSeleccionado,
    filtrarPDV,
    consultoresSeleccionados,
  ]);

  const productosDisponibles = [
    ...new Set(dataOriginalCompleta.map((d) => d.tipoV)),
  ].sort();
  const toggleYear = (year) => {
    setExpandedYears((prev) => ({
      ...prev,
      [year]: !(prev[year] ?? true), // si no existe, se asume true
    }));
  };

  const toggleMonth = (year, mes) => {
    const key = `${year}-${mes}`;
    setExpandedMonths((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const grouped = {};
  dataConsultores
    .filter((item) => {
      if (filtroMeses.length === 0) return true;
      const mesNombre = MESES_COMPLETOS[item.month - 1];
      return filtroMeses.includes(mesNombre);
    })
    .forEach((item) => {
      const { year, month, consultor, tipoV, totalCF, totalQ } = item;
      if (!grouped[year]) grouped[year] = {};
      if (!grouped[year][month]) grouped[year][month] = {};
      if (!grouped[year][month][consultor])
        grouped[year][month][consultor] = [];
      grouped[year][month][consultor].push({ tipoV, totalCF, totalQ });
    });

  const handleMesChange = (mes) => {
    setFiltroMeses((prev) =>
      prev.includes(mes) ? prev.filter((m) => m !== mes) : [...prev, mes]
    );
  };

  const years = Object.keys(grouped).sort((a, b) => a - b);

  return (
    <div className="relative mt-6 w-full max-w-7xl mx-auto px-20 pb-5">
      <h2 className="text-1xl font-bold mb-4 text-black dark:text-white font-['IBM Plex Sans']">
        REPORTE DE VENTAS
      </h2>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        {/* Estado */}
        <div className="flex flex-col">
          <label className="text-xs font-medium text-black dark:text-neutral-300 mb-1">
            Estado
          </label>
          <select
            value={estadoSeleccionado}
            onChange={(e) => setEstadoSeleccionado(e.target.value)}
            className="border border-black dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs px-2 py-2 text-neutral-800 dark:text-white w-24"
          >
            <option value="">Todos</option>
            {estadosDisponibles.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
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
            className="border border-black dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs px-2 py-2 text-neutral-800 dark:text-white w-24"
          >
            <option value="">Todos</option>
            {añosOriginales.map((año) => (
              <option key={año} value={año}>
                {año}
              </option>
            ))}
          </select>
        </div>

        {/* Mes */}
        <div className="flex flex-col relative" ref={mesDropdownRef}>
          <label className="text-xs font-medium text-black dark:text-neutral-300 mb-1">
            {" "}
            Mes{" "}
          </label>
          <button
            type="button"
            onClick={() => setShowMesDropdown((prev) => !prev)}
            className="border border-black dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs px-2 py-2 text-neutral-800 dark:text-white w-36 text-left focus:outline-none focus:ring-1 focus:ring-blue-800"
          >
            {filtroMeses.length > 0
              ? `${filtroMeses.length} seleccionados`
              : "Seleccionar"}
          </button>
          {showMesDropdown && (
            <div className="absolute left-1/2 -translate-x-1/2 mt-12 w-32 border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 shadow z-10 max-h-60 overflow-auto">
              {MESES_COMPLETOS.map((mes) => (
                <label
                  key={mes}
                  className="flex items-center px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-xs text-neutral-800 dark:text-white"
                >
                  <input
                    type="checkbox"
                    checked={filtroMeses.includes(mes)}
                    onChange={() => handleMesChange(mes)}
                    className="mr-2 accent-blue-800"
                  />
                  {mes.charAt(0).toUpperCase() + mes.slice(1)}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Consultores */}
        {/* Consultores */}
        <div className="flex flex-col relative" ref={consultorDropdownRef}>
          <label className="text-xs font-medium text-black dark:text-neutral-300 mb-1">
            Consultor
          </label>

          <button
            type="button"
            onClick={() => setShowConsultorDropdown((prev) => !prev)}
            className="border border-black dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs px-2 py-2 text-neutral-800 dark:text-white w-48 text-left focus:outline-none focus:ring-1 focus:ring-blue-800 whitespace-nowrap overflow-hidden text-ellipsis truncate"
          >
            {consultoresSeleccionados.length === 0
              ? "Seleccionar"
              : consultoresSeleccionados.length === 1
              ? consultoresSeleccionados[0]
                  .toLowerCase()
                  .replace(/\b\w/g, (l) => l.toUpperCase())
              : `${consultoresSeleccionados.length} seleccionados`}
          </button>

          {showConsultorDropdown && (
            <div className="absolute left-1/2 -translate-x-1/2 mt-12 w-56 border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 shadow z-10 max-h-72 overflow-auto rounded">
              {/* Buscar */}
              <div className="sticky top-0 bg-white dark:bg-neutral-800 p-2 border-b border-neutral-200 dark:border-neutral-700">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-2.5 text-neutral-400" />
                  <input
                    value={consultorSearch}
                    onChange={(e) => setConsultorSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        consultoresFiltrados.length > 0
                      ) {
                        toggleConsultor(consultoresFiltrados[0]);
                      }
                    }}
                    placeholder="Buscar consultor..."
                    className="w-full pl-7 pr-6 py-1.5 text-xs border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-800 rounded"
                    autoFocus
                  />
                  {consultorSearch && (
                    <button
                      type="button"
                      onClick={() => setConsultorSearch("")}
                      className="absolute right-2 top-2 text-neutral-400 hover:text-neutral-600"
                      aria-label="Limpiar búsqueda"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Acciones rápidas */}
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={seleccionarTodosFiltrados}
                    className="text-[11px] px-2 py-1 border border-neutral-300 dark:border-neutral-600 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    title="Selecciona todos los resultados filtrados"
                  >
                    Seleccionar filtrados
                  </button>
                  <button
                    type="button"
                    onClick={limpiarSeleccion}
                    className="text-[11px] px-2 py-1 border border-neutral-300 dark:border-neutral-600 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    title="Limpia la selección"
                  >
                    Limpiar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConsultorDropdown(false)}
                    className="ml-auto text-[11px] px-2 py-1 border border-blue-800 text-blue-800 rounded hover:bg-blue-50"
                  >
                    Aplicar
                  </button>
                </div>
              </div>

              {/* Lista */}
              {consultoresFiltrados.length === 0 ? (
                <div className="px-2 py-2 text-xs text-neutral-500 dark:text-neutral-400">
                  Sin resultados
                </div>
              ) : (
                consultoresFiltrados.map((consultor) => (
                  <label
                    key={consultor}
                    className="flex items-center px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-xs text-neutral-800 dark:text-white"
                  >
                    <input
                      type="checkbox"
                      checked={consultoresSeleccionados.includes(consultor)}
                      onChange={() => toggleConsultor(consultor)}
                      className="mr-2 accent-blue-800"
                    />
                    {consultor
                      .toLowerCase()
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        {/* Producto */}
        <div className="flex flex-col">
          <label className="text-xs font-medium text-black dark:text-neutral-300 mb-1">
            Producto
          </label>
          <select
            value={productoSeleccionado}
            onChange={(e) => setProductoSeleccionado(e.target.value)}
            className="border border-black dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs px-2 py-2 text-neutral-800 dark:text-white w-24"
          >
            <option value="Todos">Todos</option>
            {productosDisponibles.map((producto) => (
              <option key={producto} value={producto}>
                {producto
                  ? producto
                      .toLowerCase()
                      .replace(/\b\w/g, (c) => c.toUpperCase())
                  : ""}
              </option>
            ))}
          </select>
        </div>

        {/* PDV */}
        <div className="flex flex-col">
          <label className="text-xs font-medium text-black dark:text-neutral-300 mb-1">
            PDV
          </label>
          <button
            onClick={() => setFiltrarPDV((prev) => !prev)}
            className={`text-xs px-3 py-2 border rounded-none transition ${
              filtrarPDV
                ? "bg-blue-800 text-white"
                : "border-black dark:border-neutral-600 text-black dark:text-white bg-white dark:bg-neutral-800"
            }`}
          >
            {filtrarPDV ? "Con PDV" : "Solo con PDV"}
          </button>
        </div>

        {/* Borrar filtros */}
        <div className="flex flex-col justify-end">
          <button
            onClick={() => {
              setAñoSeleccionado("");
              setFiltroMeses([]);
              setProductoSeleccionado("Todos");
              setConsultoresSeleccionados([]);
              setEstadoSeleccionado("");
              setFiltrarPDV(false);
            }}
            className="flex items-center gap-2 text-xs px-3 py-2 border border-red-800 text-red-800 hover:bg-red-100 dark:hover:bg-red-900 rounded-none"
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

      {/* Tabla */}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-neutral-800 dark:text-neutral-100 font-['IBM Plex Sans']">
          <thead className="bg-neutral-100 dark:bg-neutral-800 text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 border-b border-neutral-300 dark:border-neutral-700">
            <tr>
              <th className="w-1/6 py-3 px-4 text-xs text-center">Año</th>
              <th className="w-1/6 py-3 px-4 text-xs text-center">Mes</th>
              <th className="w-1/6 py-3 px-4 text-xs text-center">Consultor</th>
              <th className="w-1/6 py-3 px-4 text-xs text-center">Producto</th>
              <th className="w-1/6 py-3 px-4 text-xs text-center">
                CF sin IGV
              </th>
              <th className="w-1/6 py-3 px-4 text-xs text-center">
                Q de líneas
              </th>
            </tr>
          </thead>
          <tbody>
            {years.map((year) => {
              const isYearOpen = expandedYears[year] ?? true; // abierto por defecto

              return (
                <React.Fragment key={year}>
                  <tr
                    className="cursor-pointer bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700"
                    onClick={() => toggleYear(year)}
                  >
                    <td
                      colSpan={6}
                      className="w-1/6 bg-neutral-600 text-white text-xs text-left py-2 px-12 font-bold"
                    >
                      <ChevronDown
                        className={`inline mr-4 w-4 h-4 transition-transform ${
                          isYearOpen ? "rotate-180" : ""
                        }`}
                      />
                      {year}
                    </td>
                  </tr>

                  {isYearOpen &&
                    Object.keys(grouped[year]).map((mes) => {
                      const ventasDelMes = Object.values(
                        grouped[year][mes]
                      ).flat();
                      const totalCFMes = ventasDelMes.reduce(
                        (acc, v) => acc + (v.totalCF || 0),
                        0
                      );
                      const totalQMes = ventasDelMes.reduce(
                        (acc, v) => acc + (v.totalQ || v.Q || 0),
                        0
                      );
                      const isMonthExpanded =
                        expandedMonths[`${year}-${mes}`] ?? false;

                      return (
                        <React.Fragment key={`${year}-${mes}`}>
                          <tr
                            className="cursor-pointer even:bg-white odd:bg-neutral-200 dark:even:bg-neutral-800 hover:bg-blue-50 dark:hover:bg-neutral-700"
                            onClick={() => toggleMonth(year, mes)}
                          >
                            <td></td>
                            <td className="w-1/7 py-2 px-4 text-xs font-medium text-black dark:text-white capitalize">
                              <div className="flex items-center gap-2 ps-6">
                                <ChevronDown
                                  className={`inline mr-4 w-4 h-4 transition-transform ${
                                    isMonthExpanded ? "rotate-180" : ""
                                  }`}
                                />
                                {MESES_COMPLETOS[mes - 1]}
                              </div>
                            </td>
                            <td></td>
                            <td></td>
                            <td className="text-center py-2 px-4 text-xs font-semibold text-black dark:text-white">
                              {formatoSoles.format(totalCFMes)}
                            </td>
                            <td className="text-center py-2 px-4 text-xs font-semibold text-black dark:text-white">
                              {totalQMes}
                            </td>
                          </tr>

                          {isMonthExpanded &&
                            Object.entries(grouped[year][mes]).map(
                              ([consultor, ventas]) => {
                                const totalCF = ventas.reduce(
                                  (acc, v) => acc + (v.totalCF || 0),
                                  0
                                );
                                const totalQ = ventas.reduce(
                                  (acc, v) => acc + (v.totalQ || v.Q || 0),
                                  0
                                );
                                const key = `${year}-${mes}-${consultor}`;
                                const isExpanded =
                                  expandedConsultores[key] ?? false;

                                return (
                                  <React.Fragment key={key}>
                                    <tr
                                      className="cursor-pointer border-b border-neutral-300 dark:border-neutral-600 even:bg-white odd:bg-neutral-50 dark:odd:bg-neutral-700 transition-colors"
                                      onClick={() =>
                                        setExpandedConsultores((prev) => ({
                                          ...prev,
                                          [key]: !prev[key],
                                        }))
                                      }
                                    >
                                      <td colSpan={2}></td>
                                      <td className="text-xs font-semibold text-left py-2 px-4 text-black dark:text-white max-w-[160px]">
                                        <div className="flex items-center gap-1 whitespace-nowrap overflow-hidden text-ellipsis">
                                          <ChevronDown
                                            className={`w-4 h-4 shrink-0 transition-transform ${
                                              isExpanded ? "rotate-180" : ""
                                            }`}
                                          />
                                          <span className="capitalize truncate">
                                            {consultor
                                              .toLowerCase()
                                              .replace(/\b\w/g, (c) =>
                                                c.toUpperCase()
                                              )}
                                          </span>
                                        </div>
                                      </td>
                                      <td></td>
                                      <td className="text-center py-2 px-4 text-xs text-black dark:text-white">
                                        {formatoSoles.format(totalCF)}
                                      </td>
                                      <td className="text-center py-2 px-4 text-xs text-black dark:text-white">
                                        {totalQ}
                                      </td>
                                    </tr>

                                    {isExpanded &&
                                      ventas.map((v, i) => (
                                        <tr
                                          key={i}
                                          className="bg-white dark:bg-neutral-800 border-b border-neutral-300 dark:border-neutral-700"
                                        >
                                          <td colSpan={3}></td>
                                          <td className="text-center font-semibold py-2 px-4 text-xs text-black dark:text-white">
                                            {v.tipoV
                                              ? v.tipoV
                                                  .toLowerCase()
                                                  .replace(/\b\w/g, (c) =>
                                                    c.toUpperCase()
                                                  )
                                              : ""}
                                          </td>
                                          <td className="text-center py-2 px-4 text-xs text-black dark:text-white">
                                            {formatoSoles.format(v.totalCF)}
                                          </td>
                                          <td className="text-center py-2 px-4 text-xs text-black dark:text-white">
                                            {v.totalQ}
                                          </td>
                                        </tr>
                                      ))}
                                  </React.Fragment>
                                );
                              }
                            )}
                        </React.Fragment>
                      );
                    })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {loading && (
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
      )}
    </div>
  );
}
