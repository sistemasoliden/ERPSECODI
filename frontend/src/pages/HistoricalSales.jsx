// src/pages/ReportVentasProductos.jsx
import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { Loader } from "../components/Loader";
import FiltrosWrapper from "../components/FiltrosWrapper";
import { ChevronDown } from "lucide-react";

/* =================== Helpers =================== */
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
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];
const isMoviles = (t) => /ventas\s*m[oó]viles/i.test(String(t || ""));
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

/* =================== Página =================== */
export default function ReportVentasProductos() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
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

        const { data: res } = await api.get("/ventas/tablaproductos", { params });
        setData(res || []);

        // Expandir año/mes actual
        const yExp = {}, mExp = {}, tExp = {};
        const currentYear = new Date().getFullYear();
        const currentMonth = MONTH_NAMES[new Date().getMonth()];
        (res || []).forEach((r) => {
          const y = r.year;
          const m = MONTH_NAMES[(r.month ?? 1) - 1];
          const t = r.tipo || "";
          yExp[y] = y === currentYear;
          if (y === currentYear && m === currentMonth) {
            mExp[`${y}-${m}`] = true;
            if (isMoviles(t)) tExp[`${y}-${m}-${t}`] = true;
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

  // Agrupamiento: Año > Mes > Tipo > Producto
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

  /* =================== Render =================== */
  return (
    <div className="p-6 min-h-dvh bg-[#F2F0F0]">
      {/* === Barra de filtros (sticky superior) === */}
      <div className=" z-30 bg-[#F2F0F0] pb-2">
        <div className="px-2">
          <FiltrosWrapper>
            {(f) => {
              if (JSON.stringify(f) !== JSON.stringify(filtros)) {
                setTimeout(() => setFiltros(f), 0);
              }
              return <div className="h-0 overflow-hidden" />;
            }}
          </FiltrosWrapper>
        </div>
      </div>

      {loading && (
        <Loader variant="fullscreen" message="Cargando ventas…" navbarHeight={88} />
      )}

      {/* === Tabla === */}
      {!loading && (
  <div className="mt-4 mx-6 rounded-lg border border-gray-200 bg-white shadow-md overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-[12px] text-gray-900">
        <thead className="bg-gray-900 text-white uppercase text-[11px] font-semibold tracking-wide">
          <tr>
            <th className="w-1/6 px-4 h-12 text-center">Año</th>
            <th className="w-1/6 px-4 h-12 text-center">Mes</th>
            <th className="w-1/6 px-4 h-12 text-center">Tipo</th>
            <th className="w-1/6 px-4 h-12 text-center">Producto</th>
            <th className="w-1/6 px-4 h-12 text-center">CF</th>
            <th className="w-1/6 px-4 h-12 text-center">Q</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200 text-center text-[12px] font-medium">
          {Object.keys(grouped)
            .sort((a, b) => b - a)
            .map((year) => (
              <React.Fragment key={year}>
                {/* Año */}
                <tr
                  className="bg-gray-400 text-white cursor-pointer hover:bg-gray-700 transition-colors"
                  onClick={() => toggleYear(year)}
                >
                  <td className="px-4 h-12 font-bold text-xs text-center tracking-wide">
                    <ChevronDown
                      className={`inline w-3 h-3 mr-2 transition-transform duration-300 ${
                        expandedYears[year] ? "rotate-180" : ""
                      }`}
                    />
                    {year}
                  </td>
                  <td colSpan={5}></td>
                </tr>

                {/* Meses */}
                {expandedYears[year] &&
                  Object.keys(grouped[year])
                    .sort((a, b) => MONTH_NAMES.indexOf(b) - MONTH_NAMES.indexOf(a))
                    .map((month) => {
                      const mSum = getMonthTotals(grouped, year, month);
                      return (
                        <React.Fragment key={month}>
                          <tr
                            className="bg-gray-100 cursor-pointer hover:bg-gray-200 transition"
                            onClick={() => toggleMonth(year, month)}
                          >
                            <td></td>
                            <td className="px-4 h-12 font-semibold text-gray-800">
                              <div className="flex items-center gap-2 pl-8">
                                <ChevronDown
                                  className={`w-4 h-4 text-gray-700 transition-transform duration-300 ${
                                    expandedMonths[`${year}-${month}`]
                                      ? "rotate-180"
                                      : ""
                                  }`}
                                />
                                <span>{month}</span>
                              </div>
                            </td>
                            <td colSpan={2}></td>
                            <td className="px-4 h-12 font-bold text-blue-800">
                              {fmtPEN(mSum.cf)}
                            </td>
                            <td className="px-4 h-12 font-bold text-blue-800">
                              {fmtNumber(mSum.q)}
                            </td>
                          </tr>

                          {/* Tipos */}
                          {expandedMonths[`${year}-${month}`] &&
                            Object.keys(grouped[year][month]).map((tipo) => {
                              const tipoKey = `${year}-${month}-${tipo}`;
                              const tSum = getTipoTotals(grouped, year, month, tipo);
                              const movable = isMoviles(tipo);

                              return (
                                <React.Fragment key={tipo}>
                                  <tr
                                    className="bg-white cursor-pointer hover:bg-gray-50 transition"
                                    onClick={() => toggleTipo(year, month, tipo)}
                                  >
                                    <td></td>
                                    <td></td>
                                    <td className="px-4 h-12 font-semibold text-gray-700">
                                      <div className="flex items-center gap-2 pl-6">
                                        <ChevronDown
                                          className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${
                                            expandedTipos[tipoKey]
                                              ? "rotate-180"
                                              : ""
                                          }`}
                                        />
                                        <span>{tipo}</span>
                                      </div>
                                    </td>
                                    <td></td>
                                    <td className="px-4 h-12 text-blue-800 font-semibold">
                                      {fmtPEN(tSum.cf)}
                                    </td>
                                    <td className="px-4 bold text-blue-800 font-semibold">
                                      {fmtNumber(tSum.q)}
                                    </td>
                                  </tr>

                                  {/* Productos */}
                                  {movable &&
                                    expandedTipos[tipoKey] &&
                                    Object.keys(grouped[year][month][tipo]).map((prod) => {
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
                                          className="bg-[#fafafa] hover:bg-gray-100 transition"
                                        >
                                          <td></td>
                                          <td></td>
                                          <td></td>
                                          <td className="px-4 h-12 text-gray-700 text-center">
                                            {prod}
                                          </td>
                                          <td className="px-4 h-12 text-gray-800">
                                            {fmtPEN(pSum.cf)}
                                          </td>
                                          <td className="px-4 h-12 text-gray-800">
                                            {fmtNumber(pSum.q)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                </React.Fragment>
                              );
                            })}
                        </React.Fragment>
                      );
                    })}
              </React.Fragment>
            ))}

          {data.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-gray-500">
                🚫 Sin resultados
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
)}

    </div>
  );
}
