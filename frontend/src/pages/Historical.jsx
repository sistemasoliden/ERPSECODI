// src/pages/ReportVentasConsultores.jsx
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
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

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

// ===== helpers sumas =====
const sumArray = (arr = []) =>
  arr.reduce(
    (acc, r) => {
      acc.cf += Number(r.totalCF || 0);
      acc.q += Number(r.Q || 0);
      return acc;
    },
    { cf: 0, q: 0 }
  );

const getProdTotals = (grouped, y, m, c, t, p) =>
  sumArray(grouped?.[y]?.[m]?.[c]?.[t]?.[p] || []);

const getTipoTotals = (grouped, y, m, c, t) =>
  Object.values(grouped?.[y]?.[m]?.[c]?.[t] || {}).reduce(
    (acc, arr) => {
      const s = sumArray(arr);
      acc.cf += s.cf;
      acc.q += s.q;
      return acc;
    },
    { cf: 0, q: 0 }
  );

const getConsultorTotals = (grouped, y, m, c) =>
  Object.values(grouped?.[y]?.[m]?.[c] || {}).reduce(
    (acc, prodObjByTipo) => {
      const s = Object.values(prodObjByTipo).reduce(
        (inner, arr) => {
          const s2 = sumArray(arr);
          inner.cf += s2.cf;
          inner.q += s2.q;
          return inner;
        },
        { cf: 0, q: 0 }
      );
      acc.cf += s.cf;
      acc.q += s.q;
      return acc;
    },
    { cf: 0, q: 0 }
  );

const getMonthTotals = (grouped, y, m) =>
  Object.values(grouped?.[y]?.[m] || {}).reduce(
    (acc, tiposByConsultor) => {
      const s = Object.values(tiposByConsultor).reduce(
        (inner, prodObjByTipo) => {
          // prodObjByTipo = { [producto]: [rows] }
          const s2 = Object.values(prodObjByTipo).reduce(
            (inner2, arr) => {
              const s3 = sumArray(arr);
              inner2.cf += s3.cf;
              inner2.q += s3.q;
              return inner2;
            },
            { cf: 0, q: 0 }
          );
          inner.cf += s2.cf;
          inner.q += s2.q;
          return inner;
        },
        { cf: 0, q: 0 }
      );
      acc.cf += s.cf;
      acc.q += s.q;
      return acc;
    },
    { cf: 0, q: 0 }
  );

export default function ReportVentasConsultores() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  // estados de expandido
  const [expandedYears, setExpandedYears] = useState({});
  const [expandedMonths, setExpandedMonths] = useState({});
  const [expandedConsultores, setExpandedConsultores] = useState({});
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
          consultor: filtros.consultor,      // 👈 si tu FiltrosWrapper lo expone
          producto: filtros.producto,
          tipoVenta: filtros.tipoVenta,
          pdv: filtros.soloPdv ? "si" : undefined,
        });

        const { data: res } = await api.get("/ventas/tablaconsultores", { params });
        setData(res || []);

        // Apertura inicial: año actual y mes actual
        const yExp = {}, mExp = {}, cExp = {}, tExp = {};
        const currentYear = new Date().getFullYear();
        const currentMonth = MONTH_NAMES[new Date().getMonth()];

        (res || []).forEach((r) => {
          const y = r.year;
          const m = MONTH_NAMES[(r.month ?? 1) - 1];

          yExp[y] = y === currentYear;
          if (y === currentYear && m === currentMonth) {
            mExp[`${y}-${m}`] = true;
          }
        });

        setExpandedYears(yExp);
        setExpandedMonths(mExp);
        setExpandedConsultores(cExp);
        setExpandedTipos(tExp);
      } catch (e) {
        console.error("❌ Error cargando:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [filtros]);

  // Agrupación: Año > Mes > Consultor > Tipo > Producto
  const grouped = {};
  for (const r of data) {
    const year = r.year;
    const monthName = MONTH_NAMES[(r.month ?? 1) - 1];
    const c = r.consultor || "—";
    grouped[year] ??= {};
    grouped[year][monthName] ??= {};
    grouped[year][monthName][c] ??= {};
    grouped[year][monthName][c][r.tipo] ??= {};
    grouped[year][monthName][c][r.tipo][r.producto] ??= [];
    grouped[year][monthName][c][r.tipo][r.producto].push(r);
  }

  const toggleYear = (y) => setExpandedYears((p) => ({ ...p, [y]: !p[y] }));
  const toggleMonth = (y, m) =>
    setExpandedMonths((p) => ({ ...p, [`${y}-${m}`]: !p[`${y}-${m}`] }));
  const toggleConsultor = (y, m, c) =>
    setExpandedConsultores((p) => ({
      ...p,
      [`${y}-${m}-${c}`]: !p[`${y}-${m}-${c}`],
    }));
  const toggleTipo = (y, m, c, t) =>
    setExpandedTipos((p) => ({
      ...p,
      [`${y}-${m}-${c}-${t}`]: !p[`${y}-${m}-${c}-${t}`],
    }));

  return (
    <div className="min-h-[calc(100vh-88px)] bg-gray-200 dark:bg-slate-950 p-4 md:p-6">
      {loading && (
        <Loader variant="fullscreen" message="Cargando ventas…" navbarHeight={88} />
      )}

      {/* Filtros arriba */}
      <div className="relative z-30 -mt-4 px-6">
        <FiltrosWrapper>
          {(f) => {
            if (JSON.stringify(f) !== JSON.stringify(filtros)) {
              setTimeout(() => setFiltros(f), 0);
            }
            return <div className="h-0 overflow-hidden" />;
          }}
        </FiltrosWrapper>
      </div>

      {/* Tabla */}
      <div className="mt-4 overflow-hidden border border-slate-200 bg-white/70 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/60 relative">
        <div className="relative overflow-x-auto">
          <table className="w-full table-fixed text-xs">
            <thead className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-slate-800 dark:to-slate-700 text-gray-700 dark:text-gray-200 capitalize text-xs font-semibold">
              <tr>
                <th className="w-[16.6%] px-4 py-2 text-center">Año</th>
                <th className="w-[16.6%] px-4 py-2 text-center">Mes</th>
                <th className="w-[16.6%] px-4 py-2 text-center">Consultor</th>
                <th className="w-[16.6%] px-4 py-2 text-center">Tipo</th>
                <th className="w-[16.6%] px-4 py-2 text-center">Producto</th>
                <th className="w-[16.6%] px-4 py-2 text-center">CF</th>
                <th className="w-[16.6%] px-4 py-2 text-center">Q</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 dark:divide-slate-800 text-center">
              {Object.keys(grouped)
                .sort((a, b) => b - a)
                .map((year) => (
                  <React.Fragment key={year}>
                    {/* Año */}
                    <tr
                      className="bg-red-900 text-white cursor-pointer hover:bg-red-600 transition"
                      onClick={() => toggleYear(year)}
                    >
                      <td className="px-4 py-2 font-bold tracking-wide text-center text-xs">
                        <ChevronDown
                          className={`inline w-3 h-3 mr-2 transition-transform duration-300 ${expandedYears[year] ? "rotate-180" : ""}`}
                        />
                        {year}
                      </td>
                      <td colSpan={6}></td>
                    </tr>

                    {/* Mes */}
                    {expandedYears[year] &&
                      Object.keys(grouped[year])
                        .sort((a, b) => MONTH_NAMES.indexOf(b) - MONTH_NAMES.indexOf(a))
                        .map((month) => {
                          const mSum = getMonthTotals(grouped, year, month);
                          return (
                            <React.Fragment key={month}>
                              <tr
                                className="bg-gray-100 dark:bg-slate-800 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-700 transition"
                                onClick={() => toggleMonth(year, month)}
                              >
                                <td></td>
                                <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">
                                  <div className="flex items-center gap-2 pl-8">
                                    <ChevronDown
                                      className={`w-4 h-4 transition-transform duration-300 ${expandedMonths[`${year}-${month}`] ? "rotate-180" : ""}`}
                                    />
                                    <span>{month}</span>
                                  </div>
                                </td>
                                <td></td>
                                <td></td>
                                <td></td>
                                <td className="px-4 py-2 font-semibold text-red-800">{fmtPEN(mSum.cf)}</td>
                                <td className="px-4 py-2 font-semibold text-red-800">{fmtNumber(mSum.q, 0)}</td>
                              </tr>

                              {/* Consultor */}
                              {expandedMonths[`${year}-${month}`] &&
                                Object.keys(grouped[year][month])
                                  .sort((a, b) => a.localeCompare(b))
                                  .map((consultor) => {
                                    const cKey = `${year}-${month}-${consultor}`;
                                    const cSum = getConsultorTotals(grouped, year, month, consultor);

                                    return (
                                      <React.Fragment key={consultor}>
                                        <tr
                                          className="bg-white dark:bg-slate-900 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800"
                                          onClick={() => toggleConsultor(year, month, consultor)}
                                        >
                                          <td></td>
                                          <td></td>
                                          <td className="px-4 py-2 font-semibold text-gray-700 dark:text-gray-200">
                                            <div className="flex items-center gap-2 pl-6">
  <ChevronDown
    className={`w-4 h-4 transition-transform duration-300 ${expandedConsultores[cKey] ? "rotate-180" : ""}`}
  />
  <span className="whitespace-nowrap overflow-hidden text-ellipsis">
    {consultor}
  </span>
</div>

                                          </td>
                                          <td></td>
                                          <td></td>
                                          <td className="px-4 py-2 text-xs font-semibold text-green-800">{fmtPEN(cSum.cf)}</td>
                                          <td className="px-4 py-2 text-xs font-semibold text-green-800">{fmtNumber(cSum.q, 0)}</td>
                                        </tr>

                                        {/* Tipo */}
                                        {expandedConsultores[cKey] &&
                                          Object.keys(grouped[year][month][consultor]).map((tipo) => {
                                            const tKey = `${year}-${month}-${consultor}-${tipo}`;
                                            const tSum = getTipoTotals(grouped, year, month, consultor, tipo);

                                            return (
                                              <React.Fragment key={tipo}>
                                                <tr
                                                  className="bg-gray-50 dark:bg-slate-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700"
                                                  onClick={() => toggleTipo(year, month, consultor, tipo)}
                                                >
                                                  <td></td>
                                                  <td></td>
                                                  <td></td>
                                                  <td className="px-4 py-2 font-medium text-gray-700 dark:text-gray-200">
                                                    <div className="flex items-center gap-2 pl-8">
                                                      <ChevronDown
                                                        className={`w-4 h-4 transition-transform duration-300 ${expandedTipos[tKey] ? "rotate-180" : ""}`}
                                                      />
                                                      <span>{tipo}</span>
                                                    </div>
                                                  </td>
                                                  <td></td>
                                                  <td className="px-4 py-2 text-xs font-semibold text-slate-800">
                                                    {fmtPEN(tSum.cf)}
                                                  </td>
                                                  <td className="px-4 py-2 text-xs font-semibold text-slate-800">
                                                    {fmtNumber(tSum.q, 0)}
                                                  </td>
                                                </tr>

                                                {/* Producto */}
                                                {expandedTipos[tKey] &&
                                                  Object.keys(grouped[year][month][consultor][tipo]).map((prod) => {
                                                    const pSum = getProdTotals(grouped, year, month, consultor, tipo, prod);
                                                    return (
                                                      <tr
                                                        key={prod}
                                                        className="bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800"
                                                      >
                                                        <td></td>
                                                        <td></td>
                                                        <td></td>
                                                        <td></td>
                                                        <td className="px-4 py-2 text-gray-700 dark:text-gray-200 text-center">
                                                          {prod}
                                                        </td>
                                                        <td className="px-4 py-2 text-xs">{fmtPEN(pSum.cf)}</td>
                                                        <td className="px-4 py-2 text-xs">{fmtNumber(pSum.q, 0)}</td>
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
                          );
                        })}
                  </React.Fragment>
                ))}

              {data.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-gray-500">
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
