// src/pages/ReportVentasConsultores.jsx
import React, { useEffect, useState, useRef } from "react";
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

// Rol "Comercial"
const COMERCIAL_ROLE_IDS = new Set(["68a4f22d27e6abe98157a831"]);

/* ===================== Normalización de filtros (igual que Productos) ===================== */
const MONTH_NAME_TO_NUM = MONTH_NAMES.reduce((acc, name, i) => {
  acc[name.toLowerCase()] = i + 1;
  return acc;
}, {});

const pickVal = (x) => {
  if (x == null) return undefined;
  if (Array.isArray(x))
    return x.map(pickVal).filter((v) => v != null && v !== "");
  if (typeof x === "object") {
    return (
      x.value ??
      x.id ??
      x._id ??
      x.slug ??
      x.key ??
      x.code ??
      x.name ??
      x.nombre ??
      x.label ??
      x
    );
  }
  return x;
};

const normalizeMonth = (m) => {
  const toNum = (u) => {
    const v = pickVal(u);
    if (v == null || v === "") return undefined;
    if (typeof v === "number") return v;
    const s = String(v).trim().toLowerCase();
    if (/^\d+$/.test(s)) return Number(s);
    return MONTH_NAME_TO_NUM[s];
  };
  if (Array.isArray(m)) return m.map(toNum).filter(Boolean);
  return toNum(m);
};

const normalizeFilters = (f = {}) => {
  const out = { ...f };

  out.anio = pickVal(f.anio);
  if (Array.isArray(out.anio))
    out.anio = out.anio.map((x) => Number(x)).filter(Boolean);
  else if (out.anio != null) out.anio = Number(out.anio);

  out.mes = normalizeMonth(f.mes);
  out.estado = pickVal(f.estado);
  out.consultor = pickVal(f.consultor);
  out.producto = pickVal(f.producto);
  out.tipoVenta = pickVal(f.tipoVenta);
  out.soloPdv = Boolean(f.soloPdv);
out.cfMode = f.cfMode || "normal";
  return out;
};

/* ===================== Formatos ===================== */
const fmtNumber = (n, decimals = 0) =>
  new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(n || 0));

const fmtPEN = (n) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 3,
  }).format(Number(n || 0));

/* ===================== Helpers de sumatoria ===================== */
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

  // Expandibles
  const [expandedYears, setExpandedYears] = useState({});
  const [expandedMonths, setExpandedMonths] = useState({});
  const [expandedConsultores, setExpandedConsultores] = useState({});
  const [expandedTipos, setExpandedTipos] = useState({});

  const [filtros, setFiltros] = useState({});
  const [activos, setActivos] = useState([]);
  const didAutoOpenRef = useRef(false); // evita reconfigurar expandibles tras filtrar

  /* ===================== Carga de datos ===================== */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const nf = normalizeFilters(filtros);
        const params = buildParams({
          estado: nf.estado,
          year: nf.anio,
          month: nf.mes,
          consultor: nf.consultor,
          producto: nf.producto,
          tipoVenta: nf.tipoVenta,
          pdv: nf.soloPdv ? "si" : undefined,
           cfMode: nf.cfMode || "normal",
        });

        const { data: res } = await api.get("/ventas/tablaconsultores", {
          params,
        });
        setData(res || []);

        // Apertura inicial SOLO una vez y solo si NO hay filtro de año/mes
        if (!didAutoOpenRef.current && !nf.anio && !nf.mes) {
          const yExp = {},
            mExp = {},
            cExp = {},
            tExp = {};
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
          didAutoOpenRef.current = true;
        }
      } catch (e) {
        console.error("❌ Error cargando:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [filtros]);

  // Usuarios activos (para inyección de comerciales)
  useEffect(() => {
    (async () => {
      try {
        const { data: users } = await api.get("/users/activos");
        setActivos(users || []);
      } catch (err) {
        console.error("❌ Error cargando usuarios activos:", err);
      }
    })();
  }, []);

  /* ===================== Helpers ===================== */
  const isComercial = (u) => {
    const r = u.role;
    if (!r) return false;
    const roleId = typeof r === "string" ? r : r?._id ? String(r._id) : null;
    if (roleId && COMERCIAL_ROLE_IDS.has(roleId)) return true;
    const roleName = (r?.name || r?.nombre || r?.slug || "").toLowerCase();
    return roleName === "comercial";
  };

  /* ===================== Agrupación: Año > Mes > Consultor > Tipo > Producto ===================== */
  const grouped = React.useMemo(() => {
    const g = {};
    const years = new Set();
    const monthsByYear = {};

    // 1) Agrupar ventas del backend
    for (const r of data) {
      const year = r.year;
      const monthName = MONTH_NAMES[(r.month ?? 1) - 1];
      const c = r.consultor || "—";

      years.add(year);
      monthsByYear[year] ??= new Set();
      monthsByYear[year].add(monthName);

      g[year] ??= {};
      g[year][monthName] ??= {};
      g[year][monthName][c] ??= {};
      g[year][monthName][c][r.tipo] ??= {};
      g[year][monthName][c][r.tipo][r.producto] ??= [];
      g[year][monthName][c][r.tipo][r.producto].push(r);
    }

    // 3) Inyectar año/mes actual SOLO si NO hay filtro de año/mes
    const noYMFilters = !filtros?.anio && !filtros?.mes;
    if (noYMFilters) {
      const currentYear = new Date().getFullYear();
      const currentMonthName = MONTH_NAMES[new Date().getMonth()];
      years.add(currentYear);
      monthsByYear[currentYear] ??= new Set();
      monthsByYear[currentYear].add(currentMonthName);
    }

    // 3) Inyectar comerciales activos (aparezcan aunque no tengan ventas)
    const comerciales = activos.filter(isComercial);
    years.forEach((y) => {
      g[y] ??= {};
      (monthsByYear[y] || new Set()).forEach((m) => {
        g[y][m] ??= {};
        comerciales.forEach((user) => {
          const cName =
            user.name ||
            [user.firstName, user.lastName].filter(Boolean).join(" ") ||
            "—";
          if (!g[y][m][cName]) {
            // crea estructura vacía mínima
            g[y][m][cName] = { "—": { "—": [] } };
          }
        });
      });
    });

    return g;
  }, [data, activos, filtros.anio, filtros.mes]);

  /* ===================== Toggles ===================== */
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

  /* ===================== Render ===================== */
  return (
    <div className="min-h-[calc(100vh-88px)] bg-[#ebe8e8] dark:bg-slate-950 p-4 md:p-6">
      {loading && (
        <Loader
          variant="fullscreen"
          message="Cargando ventas…"
          navbarHeight={88}
        />
      )}

      {/* Filtros (mismo estilo y patrón que Productos) */}
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
      <div className="mt-4 overflow-hidden border border-slate-200 bg-white/70 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/60 relative ml-8 mr-8">
        <div className="relative overflow-x-auto">
          <table className="w-full table-fixed text-xs border">
            <thead className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-slate-800 dark:to-slate-700 text-gray-700 dark:text-gray-200 capitalize text-xs font-semibold">
              <tr>
                {/* 7 columnas que suman ~100% */}
                <th className="w-[10%] px-4 py-3 text-center">Año</th>
                <th className="w-[12%] px-4 py-3 text-center">Mes</th>
                <th className="w-[24%] px-4 py-3 text-center">Consultor</th>
                <th className="w-[18%] px-4 py-3 text-center">Tipo</th>
                <th className="w-[18%] px-4 py-3 text-center">Producto</th>
                <th className="w-[9%] px-4 py-3 text-center">CF</th>
                <th className="w-[9%] px-4 py-3 text-center">Q</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 dark:divide-slate-800 text-center">
              {Object.keys(grouped)
                .sort((a, b) => Number(b) - Number(a))
                .map((year) => (
                  <React.Fragment key={year}>
                    {/* Año */}
                    <tr
                      className="bg-red-800 text-white cursor-pointer hover:bg-red-900 transition"
                      onClick={() => toggleYear(year)}
                    >
                      <td className="px-4 py-3 font-bold tracking-wide text-center text-xs">
                        <ChevronDown
                          className={`inline w-3 h-3 mr-3 transition-transform duration-300 ${
                            expandedYears[year] ? "rotate-180" : ""
                          }`}
                        />
                        {year}
                      </td>
                      <td colSpan={6}></td>
                    </tr>

                    {/* Mes */}
                    {expandedYears[year] &&
                      Object.keys(grouped[year])
                        .sort(
                          (a, b) =>
                            MONTH_NAMES.indexOf(b) - MONTH_NAMES.indexOf(a)
                        )
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
                                  <div className="flex items-center gap-3 pl-8">
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
                                <td></td>
                                <td className="px-4 py-3 font-semibold text-red-800">
                                  {fmtPEN(mSum.cf)}
                                </td>
                                <td className="px-4 py-3 font-semibold text-red-800">
                                  {fmtNumber(mSum.q, 0)}
                                </td>
                              </tr>

                              {/* Consultor */}
                              {expandedMonths[`${year}-${month}`] &&
                                Object.keys(grouped[year][month])
                                  .sort((a, b) => a.localeCompare(b))
                                  .map((consultor) => {
                                    const cKey = `${year}-${month}-${consultor}`;
                                    const cSum = getConsultorTotals(
                                      grouped,
                                      year,
                                      month,
                                      consultor
                                    );

                                    return (
                                      <React.Fragment key={consultor}>
                                        <tr
                                          className="bg-white dark:bg-slate-900 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800"
                                          onClick={() =>
                                            toggleConsultor(
                                              year,
                                              month,
                                              consultor
                                            )
                                          }
                                        >
                                          <td></td>
                                          <td></td>
                                          <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                                            <div className="flex items-center gap-3 pl-6">
                                              <ChevronDown
                                                className={`w-4 h-4 transition-transform duration-300 ${
                                                  expandedConsultores[cKey]
                                                    ? "rotate-180"
                                                    : ""
                                                }`}
                                              />
                                              <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                                                {consultor}
                                              </span>
                                            </div>
                                          </td>
                                          <td></td>
                                          <td></td>
                                          <td className="px-4 py-3 text-xs font-semibold text-blue-900">
                                            {fmtPEN(cSum.cf)}
                                          </td>
                                          <td className="px-4 py-3 text-xs font-semibold text-blue-900">
                                            {fmtNumber(cSum.q, 0)}
                                          </td>
                                        </tr>

                                        {/* Tipo */}
                                        {expandedConsultores[cKey] &&
                                          Object.keys(
                                            grouped[year][month][consultor]
                                          ).map((tipo) => {
                                            const tKey = `${year}-${month}-${consultor}-${tipo}`;
                                            const tSum = getTipoTotals(
                                              grouped,
                                              year,
                                              month,
                                              consultor,
                                              tipo
                                            );

                                            return (
                                              <React.Fragment key={tipo}>
                                                <tr
                                                  className="bg-gray-50 dark:bg-slate-800 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700"
                                                  onClick={() =>
                                                    toggleTipo(
                                                      year,
                                                      month,
                                                      consultor,
                                                      tipo
                                                    )
                                                  }
                                                >
                                                  <td></td>
                                                  <td></td>
                                                  <td></td>
                                                  <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-200">
                                                    <div className="flex items-center gap-3 pl-8">
                                                      <ChevronDown
                                                        className={`w-4 h-4 transition-transform duration-300 ${
                                                          expandedTipos[tKey]
                                                            ? "rotate-180"
                                                            : ""
                                                        }`}
                                                      />
                                                      <span>{tipo}</span>
                                                    </div>
                                                  </td>
                                                  <td></td>
                                                  <td className="px-4 py-3 text-xs font-semibold text-slate-800">
                                                    {fmtPEN(tSum.cf)}
                                                  </td>
                                                  <td className="px-4 py-3 text-xs font-semibold text-slate-800">
                                                    {fmtNumber(tSum.q, 0)}
                                                  </td>
                                                </tr>

                                                {/* Producto */}
                                                {expandedTipos[tKey] &&
                                                  Object.keys(
                                                    grouped[year][month][
                                                      consultor
                                                    ][tipo]
                                                  ).map((prod) => {
                                                    const pSum = getProdTotals(
                                                      grouped,
                                                      year,
                                                      month,
                                                      consultor,
                                                      tipo,
                                                      prod
                                                    );
                                                    return (
                                                      <tr
                                                        key={prod}
                                                        className="bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800"
                                                      >
                                                        <td></td>
                                                        <td></td>
                                                        <td></td>
                                                        <td></td>
                                                        <td className="px-4 py-3 text-gray-700 dark:text-gray-200 text-center">
                                                          {prod}
                                                        </td>
                                                        <td className="px-4 py-3 text-xs">
                                                          {fmtPEN(pSum.cf)}
                                                        </td>
                                                        <td className="px-4 py-3 text-xs">
                                                          {fmtNumber(pSum.q, 0)}
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
                          );
                        })}
                  </React.Fragment>
                ))}

              {/* Mostrar "sin resultados" solo si de verdad no hay ventas */}
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
