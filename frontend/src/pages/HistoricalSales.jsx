// ReportVentasProductos.jsx
import api from "../api/axios";
import { ChevronDown } from "lucide-react";
import React, { useEffect, useState, useRef } from "react";

const formatoSoles = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

const MONTH_ORDER = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export default function ReportVentasProductos() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedYears, setExpandedYears] = useState({});
  const [expandedMonths, setExpandedMonths] = useState({});
  const [statuses, setStatuses] = useState([]);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [filtroAño, setFiltroAño] = useState("");
  const [filtroMeses, setFiltroMeses] = useState([]);
  const [showMesDropdown, setShowMesDropdown] = useState(false);
  const mesDropdownRef = useRef(null);
  const [productosDisponibles, setProductosDisponibles] = useState([]);
  const [filtroProductos, setFiltroProductos] = useState([]);
  const [showProductosDropdown, setShowProductosDropdown] = useState(false);
  const productosDropdownRef = useRef(null);
  const [totalesAnuales, setTotalesAnuales] = useState({});
  const [filtrarPDV, setFiltrarPDV] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState({});

  useEffect(() => {
    setLoading(true);

    const params = {};
    if (selectedStatus) params.estadoFinal = selectedStatus;
    if (filtroAño && filtroAño !== "Todos") params.año = filtroAño;
    if (filtroMeses.length > 0) {
      const indicesMeses = filtroMeses.map(
        (mes) => MONTH_ORDER.indexOf(mes.toLowerCase()) + 1
      );
      params.meses = indicesMeses.join(",");
    }
    if (filtroProductos.length > 0) {
      params.productos = filtroProductos.join(",");
    }
    if (filtrarPDV) {
      params.conPDV = true;
    }

    api
      .get("/ventas/productos", { params })
      .then((res) => {
        setData(res.data);

        // ✅ Expandir solo los años (NO los meses)
        const nuevosExpandedYears = {};
        res.data.forEach(({ year }) => {
          nuevosExpandedYears[year] = true;
        });
        setExpandedYears(nuevosExpandedYears);
      })
      .catch((err) => console.error("❌ Error al cargar datos:", err))
      .finally(() => setLoading(false));
  }, [selectedStatus, filtroAño, filtroMeses, filtroProductos, filtrarPDV]);

  useEffect(() => {
    api
      .get("/ventas/estados")
      .then((res) => setStatuses(res.data))
      .catch((err) => console.error("❌ Error al obtener estados:", err));
  }, []);

  useEffect(() => {
    api
      .get("/ventas/productos-disponibles") // Asegúrate de tener esta ruta en tu backend
      .then((res) => setProductosDisponibles(res.data))
      .catch((err) => console.error("❌ Error al obtener productos:", err));
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        productosDropdownRef.current &&
        !productosDropdownRef.current.contains(event.target)
      ) {
        setShowProductosDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        mesDropdownRef.current &&
        !mesDropdownRef.current.contains(event.target)
      ) {
        setShowMesDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  useEffect(() => {
    const params = {};
    if (selectedStatus) params.estadoFinal = selectedStatus;
    if (filtroAño && filtroAño !== "Todos") params.año = filtroAño;
    if (filtrarPDV) params.conPDV = true; // ✅ AÑADIR ESTO

    api
      .get("/ventas/productos", { params }) // sin filtro de mes
      .then((res) => {
        const agrupado = {};
        res.data.forEach(({ year, totalCF, Q }) => {
          if (!agrupado[year]) agrupado[year] = { totalCF: 0, totalQ: 0 };
          agrupado[year].totalCF += totalCF;
          agrupado[year].totalQ += Q;
        });
        setTotalesAnuales(agrupado);
      })
      .catch((err) =>
        console.error("❌ Error al obtener totales anuales:", err)
      );
  }, [selectedStatus, filtroAño, filtrarPDV]); // ✅ AÑADIR COMO DEPENDENCIA

  const handleMesChange = (mes) => {
    setFiltroMeses((prev) =>
      prev.includes(mes) ? prev.filter((m) => m !== mes) : [...prev, mes]
    );
  };

  const filteredData = data; // Los datos ya vienen filtrados del backend

  const groupedData = {};
  filteredData.forEach(({ year, month, producto, totalCF, Q, tipo }) => {
    const mesNombre = MONTH_ORDER[month - 1];
    const key = `${producto}|${tipo}`;

    if (!groupedData[year]) groupedData[year] = { __totalQ: 0 };
    if (!groupedData[year][mesNombre]) groupedData[year][mesNombre] = {};

    if (!groupedData[year][mesNombre][key]) {
      groupedData[year][mesNombre][key] = {
        producto,
        tipo,
        totalCF: 0,
        Q: 0,
      };
    }

    groupedData[year][mesNombre][key].totalCF += totalCF;
    groupedData[year][mesNombre][key].Q += Q;
    groupedData[year].__totalQ += Q;
  });

  const toggleYear = (year) => {
    setExpandedYears((prev) => ({ ...prev, [year]: !prev[year] }));
  };

  const toggleMonth = (year, mes) => {
    const key = `${year}-${mes}`;
    setExpandedMonths((prev) => ({ ...prev, [key]: !prev[key] }));
  };
if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-neutral-900 z-49 text-center">
        <div className="flex flex-col items-center translate-y-24">
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


  const years = Object.keys(groupedData).sort((a, b) => a - b);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-md font-bold uppercase font-['IBM Plex Sans'] mb-4">
        Histórico de Ventas
      </h1>

      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div className="flex flex-col">
          <label
            htmlFor="statusFilter"
            className="text-xs font-medium text-black dark:text-neutral-300 mb-1"
          >
            Estado Final
          </label>

          <select
            id="statusFilter"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border border-black dark:border-white bg-white dark:bg-neutral-800 text-xs px-2 py-2 text-center capitalize text-neutral-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-800"
          >
            <option value="" className="text-black text-left">
              Todos
            </option>
            {statuses
              .filter((status) => status?.trim())
              .map((status) => (
                <option
                  key={status}
                  value={status.trim()}
                  className="capitalize text-left "
                >
                  {status
                    .trim()
                    .toLowerCase()
                    .replace(/\b\w/g, (l) => l.toUpperCase())}
                </option>
              ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium text-black dark:text-neutral-300 mb-1">
            Año
          </label>
          <select
            value={filtroAño}
            onChange={(e) => setFiltroAño(e.target.value)}
            className="border border-black dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs px-2 py-2 text-neutral-800 dark:text-white w-24 focus:outline-none focus:ring-1 focus:ring-blue-800"
          >
            <option value="">Todos</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

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
              {MONTH_ORDER.map((mes) => (
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
        <div className="flex flex-col relative" ref={productosDropdownRef}>
          <label className="text-xs font-medium text-black dark:text-neutral-300 mb-1 ">
            Productos
          </label>
          <button
            type="button"
            onClick={() => setShowProductosDropdown((prev) => !prev)}
            className="border border-black dark:border-neutral-600 bg-white dark:bg-neutral-800 text-xs px-2 py-2 text-neutral-800 dark:text-white w-36 text-left focus:outline-none focus:ring-1 focus:ring-blue-800"
          >
            {filtroProductos.length > 0
              ? `${filtroProductos.length} seleccionados`
              : "Seleccionar"}
          </button>
          {showProductosDropdown && (
            <div className="absolute left-1/2 -translate-x-1/2 mt-12 w-32 border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 shadow z-10 max-h-60 overflow-auto">
              {productosDisponibles.map((producto) => (
                <label
                  key={producto}
                  className="flex items-center px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-xs capitalize text-neutral-800 dark:text-white"
                >
                  <input
                    type="checkbox"
                    checked={filtroProductos.includes(producto)}
                    onChange={() =>
                      setFiltroProductos((prev) =>
                        prev.includes(producto)
                          ? prev.filter((p) => p !== producto)
                          : [...prev, producto]
                      )
                    }
                    className="mr-2 accent-blue-800"
                  />
                  {producto.toLowerCase()}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <label className="text-xs font-medium text-black dark:text-neutral-300 mb-1">
            PDV
          </label>
          <button
            onClick={() => setFiltrarPDV((prev) => !prev)}
            className={`text-xs px-3 py-2 border rounded-none focus:outline-none transition
              ${
                filtrarPDV
                  ? "bg-blue-800 text-white"
                  : "border-black dark:border-neutral-600 text-black dark:text-white bg-white dark:bg-neutral-800"
              }`}
          >
            {filtrarPDV ? "Con PDV ✓" : "Solo con PDV"}
          </button>
        </div>

        <div className="flex flex-col justify-end">
          <button
            onClick={() => {
              setSelectedStatus("");
              setFiltroAño("");
              setFiltroMeses([]);
              setFiltroProductos([]);
              setShowMesDropdown(false);
              setExpandedYears({});
              setExpandedMonths({});
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

      <div className="w-full max-w-screen-2xl mx-auto px-4">
        <h2 className="text-md font-bold uppercase font-['IBM Plex Sans'] mb-4 text-center text-black dark:text-white">
          Resumen por Producto
        </h2>

        <div className="w-full overflow-x-visible border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900">
          <table className="min-w-full text-sm text-neutral-800 dark:text-neutral-100 font-['IBM Plex Sans']">
            <thead className="bg-neutral-100 dark:bg-neutral-800 text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 border-b border-neutral-300 dark:border-neutral-700">
              <tr>
                <th className="w-1/7 py-3 px-4 text-xs text-center">Año</th>
                <th className="w-1/7 py-3 px-4 text-xs text-center">Mes</th>
                <th className="w-1/7 py-3 px-4 text-xs text-center">
                  Tipo de Venta
                </th>
                <th className="w-1/7 py-3 px-4 text-xs text-center">
                  Producto
                </th>
                <th className="w-1/7 py-3 px-4 text-xs text-center">
                  CF sin IGV
                </th>
                <th className="w-1/7 py-3 px-4 text-xs text-center">% de CF</th>
                <th className="w-1/7 py-3 px-4 text-xs text-center">
                  Q de líneas
                </th>
                <th className="w-1/7 py-3 px-4 text-xs text-center">% de Q</th>
              </tr>
            </thead>
            <tbody>
              {years.map((year) => {
                const yearExpanded = expandedYears[year];
                const meses = Object.keys(groupedData[year] || {}).filter(
                  (k) => !k.startsWith("__")
                );
                const totalQAnual = totalesAnuales[year]?.totalQ || 0;
                const totalCFAnual = totalesAnuales[year]?.totalCF || 0;

                return (
                  <React.Fragment key={year}>
                    <tr
                      className="bg-neutral-600 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 dark:hover:bg-neutral-800 cursor-pointer group transition-colors"
                      onClick={() => toggleYear(year)}
                    >
                      <td className="w-1/7 py-3 px-4 text-center text-xs font-bold text-white dark:text-white">
                        <ChevronDown
                          className={`inline-block w-4 h-4 mr-1 transition-transform ${
                            yearExpanded ? "rotate-180" : ""
                          }`}
                        />
                        {year}
                      </td>
                      <td colSpan={2}></td>
                      <td></td>
                      <td className="text-xs text-center font-semibold text-white dark:text-neutral-200">
                        {formatoSoles.format(totalCFAnual)}
                      </td>
                      <td className="text-xs text-center font-semibold text-white dark:text-neutral-200">
                        100 %
                      </td>
                      <td className="text-xs text-center font-semibold text-white dark:text-neutral-200">
                        {totalQAnual}
                      </td>
                      <td className="text-xs text-center font-semibold text-white dark:text-neutral-200">
                        100 %
                      </td>
                    </tr>

                    {yearExpanded &&
                      meses.map((mes) => {
                        const monthKey = `${year}-${mes}`;
                        const isMonthExpanded = expandedMonths[monthKey];
                        const productos = groupedData[year][mes];
                        const groupedByProduct = {};
                        Object.entries(productos).forEach(([key, valores]) => {
                          const { producto } = valores;
                          if (!groupedByProduct[producto])
                            groupedByProduct[producto] = [];
                          groupedByProduct[producto].push({ ...valores, key });
                        });

                        const totalCFMes = Object.entries(productos)
                          .filter(([nombre]) => nombre !== "__totalQ")
                          .reduce(
                            (acc, [, val]) => acc + (val.totalCF || 0),
                            0
                          );

                        const totalQMes = Object.entries(productos)
                          .filter(([nombre]) => nombre !== "__totalQ")
                          .reduce((acc, [, val]) => acc + (val.Q || 0), 0);

                        const porcentajeCFMes =
                          totalCFAnual > 0
                            ? ((totalCFMes / totalCFAnual) * 100).toFixed(2)
                            : "0.00";
                        const porcentajeMes =
                          totalQAnual > 0
                            ? ((totalQMes / totalQAnual) * 100).toFixed(2)
                            : "0.00";

                        return (
                          <React.Fragment key={monthKey}>
                            <tr
                              className="even:bg-neutral-200 odd:bg-white  border-b border-neutral-200 dark:border-neutral-700 dark:hover:bg-neutral-600 cursor-pointer group transition-colors"
                              onClick={() => toggleMonth(year, mes)}
                            >
                              <td />
                              <td className="py-3 ps-16 pe-4 text-xs font-medium text-black dark:text-white capitalize flex items-center gap-2">
                                <ChevronDown
                                  className={`w-4 h-4 transition-transform ${
                                    isMonthExpanded ? "rotate-180" : ""
                                  }`}
                                />
                                {mes}
                              </td>
                              <td colSpan={1}></td>
                              <td></td>
                              <td className="text-xs text-center text-black dark:text-neutral-200">
                                {formatoSoles.format(totalCFMes)}
                              </td>
                              <td className="text-xs text-center text-black dark:text-neutral-200">
                                {porcentajeCFMes} %
                              </td>
                              <td className="text-xs text-center text-black dark:text-neutral-200">
                                {totalQMes}
                              </td>
                              <td className="text-xs text-center text-black dark:text-neutral-200">
                                {porcentajeMes} %
                              </td>
                            </tr>

                            {isMonthExpanded &&
                              (() => {
                                const groupedByProduct = {};
                                Object.entries(productos).forEach(
                                  ([key, valores]) => {
                                    const { producto } = valores;
                                    if (!groupedByProduct[producto])
                                      groupedByProduct[producto] = [];
                                    groupedByProduct[producto].push({
                                      ...valores,
                                      key,
                                    });
                                  }
                                );

                                return Object.entries(groupedByProduct).map(
                                  ([producto, tipos]) => {
                                    const isExpanded =
                                      expandedProducts[
                                        `${monthKey}-${producto}`
                                      ];
                                    const totalCF = tipos.reduce(
                                      (acc, t) => acc + t.totalCF,
                                      0
                                    );
                                    const totalQ = tipos.reduce(
                                      (acc, t) => acc + t.Q,
                                      0
                                    );
                                    const porcentaje =
                                      totalQAnual > 0
                                        ? (
                                            (totalQ / totalQAnual) *
                                            100
                                          ).toFixed(2)
                                        : "0.00";
                                    const porcentajeCF =
                                      totalCFAnual > 0
                                        ? (
                                            (totalCF / totalCFAnual) *
                                            100
                                          ).toFixed(2)
                                        : "0.00";

                                    return (
                                      <React.Fragment
                                        key={`${monthKey}-${producto}`}
                                      >
                                        <tr
                                          onClick={() =>
                                            setExpandedProducts((prev) => ({
                                              ...prev,
                                              [`${monthKey}-${producto}`]:
                                                !prev[
                                                  `${monthKey}-${producto}`
                                                ],
                                            }))
                                          }
                                          className="cursor-pointer hover:bg-sky-50 dark:hover:bg-neutral-600"
                                        >
                                          <td />
                                          <td />
                                          <td
                                            colSpan={1}
                                            className="py-2 px-8 text-xs text-capitalize text-left font-semibold "
                                          >
                                            <ChevronDown
                                              className={`inline w-4 h-4 mr-2 transition-transform ${
                                                isExpanded ? "rotate-180" : ""
                                              }`}
                                            />
                                            {producto.charAt(0).toUpperCase() +
                                              producto.slice(1).toLowerCase()}
                                          </td>

                                          <td />
                                          <td className="text-xs text-center">
                                            {formatoSoles.format(totalCF)}
                                          </td>
                                          <td className="text-xs text-center">
                                            {porcentajeCF} %
                                          </td>
                                          <td className="text-xs text-center">
                                            {totalQ}
                                          </td>
                                          <td className="text-xs text-center">
                                            {porcentaje} %
                                          </td>
                                        </tr>

                                        {isExpanded &&
                                          tipos.map(
                                            ({ tipo, totalCF, Q, key }) => {
                                              const pCF =
                                                totalCFAnual > 0
                                                  ? (
                                                      (totalCF / totalCFAnual) *
                                                      100
                                                    ).toFixed(2)
                                                  : "0.00";
                                              const pQ =
                                                totalQAnual > 0
                                                  ? (
                                                      (Q / totalQAnual) *
                                                      100
                                                    ).toFixed(2)
                                                  : "0.00";

                                              return (
                                                <tr
                                                  key={key}
                                                  className="text-xs bg-sky-50 dark:even:bg-neutral-800 dark:odd:bg-neutral-700  border-neutral-300 dark:border-neutral-700"
                                                >
                                                  <td />
                                                  <td />
                                                  <td className="text-center py-2 text-xs font-semibold">
                                                    {tipo
                                                      .charAt(0)
                                                      .toUpperCase() +
                                                      tipo
                                                        .slice(1)
                                                        .toLowerCase()}
                                                  </td>
                                                  <td />
                                                  <td className="text-center">
                                                    {formatoSoles.format(
                                                      totalCF
                                                    )}
                                                  </td>
                                                  <td className="text-center">
                                                    {pCF} %
                                                  </td>
                                                  <td className="text-center">
                                                    {Q}
                                                  </td>
                                                  <td className="text-center">
                                                    {pQ} %
                                                  </td>
                                                </tr>
                                              );
                                            }
                                          )}
                                      </React.Fragment>
                                    );
                                  }
                                );
                              })()}
                          </React.Fragment>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
