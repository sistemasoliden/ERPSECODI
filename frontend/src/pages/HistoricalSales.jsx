// src/pages/ReportVentasProductos.jsx
import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { Loader } from "../components/Loader";
import FiltrosWrapper from "../components/FiltrosWrapper";
import { ChevronDown } from "lucide-react";

const buildParams = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj || {})) {
    if (!v || (Array.isArray(v) && v.length === 0)) continue;
    if (Array.isArray(v)) v.forEach((x) => p.append(k, x));
    else p.append(k, v);
  }
  return p;
};

const MONTH_NAMES = [
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

// Detecta “Ventas Móviles” con o sin acento/espacios
// Detecta “Ventas Móviles”
const isMoviles = (t) => /ventas\s*m[oó]viles/i.test(String(t || ""));

// Formatos
const fmtNumber = (n, decimals = 0) =>
  new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(n || 0));

const fmtPEN = (n) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(Number(n || 0));

// ===== Sumatorias sobre el objeto grouped =====
const sumArray = (arr = []) =>
  arr.reduce(
    (acc, r) => {
      acc.cf += Number(r.totalCF || 0);
      acc.q += Number(r.Q || 0);
      return acc;
    },
    { cf: 0, q: 0 }
  );

const getProdTotals = (grouped, y, m, t, p) =>
  sumArray(grouped?.[y]?.[m]?.[t]?.[p] || []);

const getTipoTotals = (grouped, y, m, t) =>
  Object.values(grouped?.[y]?.[m]?.[t] || {}).reduce(
    (acc, arr) => {
      const s = sumArray(arr);
      acc.cf += s.cf;
      acc.q += s.q;
      return acc;
    },
    { cf: 0, q: 0 }
  );

const getMonthTotals = (grouped, y, m) =>
  Object.keys(grouped?.[y]?.[m] || {}).reduce(
    (acc, t) => {
      const s = getTipoTotals(grouped, y, m, t);
      acc.cf += s.cf;
      acc.q += s.q;
      return acc;
    },
    { cf: 0, q: 0 }
  );

export default function ReportVentasProductos() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  // estados de expandido
  const [expandedYears, setExpandedYears] = useState({});
  const [expandedMonths, setExpandedMonths] = useState({});
  const [expandedTipos, setExpandedTipos] = useState({});
  const [filtros, setFiltros] = useState({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = buildParams({
          estado: filtros.estado,
          year: filtros.anio,
          month: filtros.mes,
          producto: filtros.producto,
          tipoVenta: filtros.tipoVenta,
          pdv: filtros.soloPdv ? "si" : undefined,
            cfMode: filtros.cfMode || "normal",
        });

        const { data: res } = await api.get("/ventas/tablaproductos", {
          params,
        });
        setData(res || []);

        // ======= Apertura inicial “todo desplegado” =======
        // ======= Apertura inicial =======
        // ======= Apertura inicial =======
        const yExp = {},
          mExp = {},
          tExp = {};

        const currentYear = new Date().getFullYear();
        const currentMonth = MONTH_NAMES[new Date().getMonth()];

        (res || []).forEach((r) => {
          const y = r.year;
          const m = MONTH_NAMES[(r.month ?? 1) - 1];
          const t = r.tipo || "";

          // Solo expandir año actual
          yExp[y] = y === currentYear;

          // Solo expandir el mes actual dentro del año actual
          if (y === currentYear && m === currentMonth) {
            mExp[`${y}-${m}`] = true;
            if (isMoviles(t)) {
              tExp[`${y}-${m}-${t}`] = true;
            }
          }
        });

        setExpandedYears(yExp);
        setExpandedMonths(mExp);
        setExpandedTipos(tExp);
      } catch (e) {
        console.error("❌ Error cargando:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [filtros]);

  // Agrupamos: Año > Mes > Tipo > Producto
  const grouped = {};
  for (const r of data) {
    const year = r.year;
    const monthName = MONTH_NAMES[(r.month ?? 1) - 1];
    grouped[year] ??= {};
    grouped[year][monthName] ??= {};
    grouped[year][monthName][r.tipo] ??= {};
    grouped[year][monthName][r.tipo][r.producto] ??= [];
    grouped[year][monthName][r.tipo][r.producto].push(r);
  }

  const toggleYear = (y) => setExpandedYears((p) => ({ ...p, [y]: !p[y] }));
  const toggleMonth = (y, m) =>
    setExpandedMonths((p) => ({ ...p, [`${y}-${m}`]: !p[`${y}-${m}`] }));
  const toggleTipo = (y, m, t) =>
    setExpandedTipos((p) => ({
      ...p,
      [`${y}-${m}-${t}`]: !p[`${y}-${m}-${t}`],
    }));

  return (
    <div className="min-h-[calc(100vh-88px)] bg-[#ebe8e8] dark:bg-slate-950 p-4 md:p-6">
      {loading && (
        <Loader
          variant="fullscreen"
          message="Cargando ventas…"
          navbarHeight={88}
        />
      )}

      {/* Filtros (arriba, compactos, misma altura que Ventas.jsx) */}
      <div className="relative z-30 -mt-1 px-6">
        <FiltrosWrapper>
          {(f) => {
            if (JSON.stringify(f) !== JSON.stringify(filtros)) {
              setTimeout(() => setFiltros(f), 0);
            }
            return <div className="h-0 overflow-hidden" />;
          }}
        </FiltrosWrapper>
      </div>

      {/* Tabla de reporte */}
      <div className="mt-4 overflow-hidden border border-slate-200 bg-white/70 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/60 relative ml-8 mr-8">
        <div className="relative overflow-x-auto">
          <table className="w-full table-fixed text-xs border">
            <thead className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-slate-800 dark:to-slate-700 text-gray-700 dark:text-gray-200 capitalize text-xs font-semibold">
              <tr>
                <th className="w-1/6 px-4 py-3 text-center">Año</th>
                <th className="w-1/6 px-4 py-3 text-center">Mes</th>
                <th className="w-1/6 px-4 py-3 text-center">Tipo</th>
                <th className="w-1/6 px-4 py-3 text-center">Producto</th>
                <th className="w-1/6 px-4 py-3 text-center">CF</th>
                <th className="w-1/6 px-4 py-3 text-center">Q</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 dark:divide-slate-800 text-center">
              {Object.keys(grouped)
                .sort((a, b) => b - a) // orden descendente
                .map((year) => (
                  <React.Fragment key={year}>
                    {/* Año */}
                    <tr
                      className="bg-red-800 text-white cursor-pointer hover:bg-red-900 transition"
                      onClick={() => toggleYear(year)}
                    >
                      <td className="px-4 py-3 font-bold tracking-wide text-center text-xs">
                        <ChevronDown
                          className={`inline w-3 h-3 mr-2 transition-transform duration-300 ${
                            expandedYears[year] ? "rotate-180" : ""
                          }`}
                        />
                        {year}
                      </td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>

                    {/* Mes */}
                    {expandedYears[year] &&
                      Object.keys(grouped[year])
                        .sort(
                          (a, b) =>
                            MONTH_NAMES.indexOf(b) - MONTH_NAMES.indexOf(a)
                        ) // descendente
                        .map((month) => {
                          const mSum = getMonthTotals(grouped, year, month);
                          return (
                            <React.Fragment key={month}>
                              <tr
                                className="bg-gray-100 dark:bg-slate-800 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition"
                                onClick={() => toggleMonth(year, month)}
                              >
                                <td></td>
                                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">
                                  <div className="flex items-center gap-2 pl-8">
                                    <ChevronDown
                                      className={`w-4 h-4 transition-transform duration-300 ${
                                        expandedMonths[`${year}-${month}`]
                                          ? "rotate-180"
                                          : ""
                                      }`}
                                    />
                                    <span>{month}</span>
                                  </div>
                                </td>
                                <td></td>
                                <td></td>
                                <td className="px-4 py-3 font-semibold text-red-800">
                                  {fmtPEN(mSum.cf)}
                                </td>
                                <td className="px-4 py-3 font-semibold text-red-800">
                                  {fmtNumber(mSum.q, 0)}
                                </td>
                              </tr>

                              {/* Tipo */}
                              {expandedMonths[`${year}-${month}`] &&
                                Object.keys(grouped[year][month]).map(
                                  (tipo) => {
                                    const movable = isMoviles(tipo);
                                    const tipoKey = `${year}-${month}-${tipo}`;
                                    const tSum = getTipoTotals(
                                      grouped,
                                      year,
                                      month,
                                      tipo
                                    );

                                    return (
                                      <React.Fragment key={tipo}>
                                        <tr
                                          className="bg-white dark:bg-slate-900 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800"
                                          onClick={() =>
                                            toggleTipo(year, month, tipo)
                                          }
                                        >
                                          <td></td>
                                          <td></td>
                                          <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                                            <div className="flex items-center gap-2 pl-6">
                                              <ChevronDown
                                                className={`w-4 h-4 transition-transform duration-300 ${
                                                  expandedTipos[tipoKey]
                                                    ? "rotate-180"
                                                    : ""
                                                }`}
                                              />
                                              <span>{tipo}</span>
                                            </div>
                                          </td>
                                          <td></td>
                                          <td className="px-4 py-3 text-xs font-semibold text-blue-900">
                                            {fmtPEN(tSum.cf)}
                                          </td>
                                          <td className="px-4 py-3 text-xs font-semibold text-blue-900">
                                            {fmtNumber(tSum.q, 0)}
                                          </td>
                                        </tr>

                                        {/* Productos */}
                                        {movable &&
                                          expandedTipos[tipoKey] &&
                                          Object.keys(
                                            grouped[year][month][tipo]
                                          ).map((prod) => {
                                            const pSum = getProdTotals(
                                              grouped,
                                              year,
                                              month,
                                              tipo,
                                              prod
                                            );
                                            return (
                                              <tr
                                                key={prod}
                                                className="bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700"
                                              >
                                                <td></td>
                                                <td></td>
                                                <td></td>
                                                <td className="px-4 py-3 font-xs text-gray-700 dark:text-gray-200 text-center">
                                                  {prod}
                                                </td>
                                                <td className="px-4 py-3 text-xs ">
                                                  {fmtPEN(pSum.cf)}
                                                </td>
                                                <td className="px-4 py-3 text-xs ">
                                                  {fmtNumber(pSum.q, 0)}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                      </React.Fragment>
                                    );
                                  }
                                )}
                            </React.Fragment>
                          );
                        })}
                  </React.Fragment>
                ))}

              {data.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-gray-500">
                    🚫 Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
