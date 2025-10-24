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
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

// Rol "Comercial"
const COMERCIAL_ROLE_IDS = new Set(["68a4f22d27e6abe98157a831"]);

/* ===================== Normalización de filtros ===================== */
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
      x.value ?? x.id ?? x._id ?? x.slug ?? x.key ?? x.code ??
      x.name ?? x.nombre ?? x.label ?? x
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
  if (Array.isArray(out.anio)) out.anio = out.anio.map(Number).filter(Boolean);
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
  const didAutoOpenRef = useRef(false);

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

        // Apertura inicial (una sola vez) si no hay filtro de año/mes
        if (!didAutoOpenRef.current && !nf.anio && !nf.mes) {
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
          didAutoOpenRef.current = true;
        }
      } catch (e) {
        console.error("❌ Error cargando:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [filtros]);

  // Usuarios activos (inyectar comerciales)
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

  /* === Agrupación: Año > Mes > Consultor > Tipo > Producto === */
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

    // 2) Inyectar año/mes actual si no hay filtros de Y/M
    const noYMFilters = !filtros?.anio && !filtros?.mes;
    if (noYMFilters) {
      const currentYear = new Date().getFullYear();
      const currentMonthName = MONTH_NAMES[new Date().getMonth()];
      years.add(currentYear);
      monthsByYear[currentYear] ??= new Set();
      monthsByYear[currentYear].add(currentMonthName);
    }

    // 3) Inyectar comerciales activos aunque no tengan ventas
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
    <div className="min-h-[calc(100vh-88px)] bg-[#F2F0F0] p-4 md:p-6">
      {loading && (
        <Loader variant="fullscreen" message="Cargando ventas…" navbarHeight={88} />
      )}

      {/* Filtros (barra superior) */}
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

      {/* Tabla */}
      <div className="mt-4 mx-6 rounded-lg border border-gray-200 bg-white shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-[12px] text-gray-900">
            <thead className="bg-gray-900 text-white uppercase text-[11px] font-semibold tracking-wide">
              <tr>
                {/* 7 columnas que suman ~100% */}
                <th className="w-[10%] px-4 h-12 text-center">Año</th>
                <th className="w-[12%] px-4 h-12 text-center">Mes</th>
                <th className="w-[24%] px-4 h-12 text-center">Consultor</th>
                <th className="w-[18%] px-4 h-12 text-center">Tipo</th>
                <th className="w-[18%] px-4 h-12 text-center">Producto</th>
                <th className="w-[9%]  px-4 h-12 text-center">CF</th>
                <th className="w-[9%]  px-4 h-12 text-center">Q</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 text-center">
              {Object.keys(grouped)
                .sort((a, b) => Number(b) - Number(a))
                .map((year) => (
                  <React.Fragment key={year}>
                    {/* Año */}
                    <tr
                      className="bg-gray-400 text-white cursor-pointer hover:bg-gray-700 transition-colors"
                      onClick={() => toggleYear(year)}
                    >
                      <td className="px-4 h-12 font-bold text-xs text-center tracking-wide">
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
                                  <div className="flex items-center gap-3 pl-8">
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
                                <td></td>
                                <td></td>
                                <td></td>
                                <td className="px-4 h-12 font-semibold text-blue-800">
                                  {fmtPEN(mSum.cf)}
                                </td>
                                <td className="px-4 h-12 font-semibold text-blue-800">
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
                                      grouped, year, month, consultor
                                    );

                                    return (
                                      <React.Fragment key={consultor}>
                                        <tr
                                          className="bg-white cursor-pointer hover:bg-gray-50 transition"
                                          onClick={() => toggleConsultor(year, month, consultor)}
                                        >
                                          <td></td>
                                          <td></td>
                                          <td className="px-4 h-12 font-semibold text-gray-700">
                                            <div className="flex items-center gap-3 pl-6">
                                              <ChevronDown
                                                className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${
                                                  expandedConsultores[cKey] ? "rotate-180" : ""
                                                }`}
                                              />
                                              <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                                                {consultor}
                                              </span>
                                            </div>
                                          </td>
                                          <td></td>
                                          <td></td>
                                          <td className="px-4 h-12 text-blue-800 font-semibold">
                                            {fmtPEN(cSum.cf)}
                                          </td>
                                          <td className="px-4 h-12 text-blue-800 font-semibold">
                                            {fmtNumber(cSum.q, 0)}
                                          </td>
                                        </tr>

                                        {/* Tipo */}
                                        {expandedConsultores[cKey] &&
                                          Object.keys(grouped[year][month][consultor]).map((tipo) => {
                                            const tKey = `${year}-${month}-${consultor}-${tipo}`;
                                            const tSum = getTipoTotals(
                                              grouped, year, month, consultor, tipo
                                            );

                                            return (
                                              <React.Fragment key={tipo}>
                                                <tr
                                                  className="bg-[#f7f7f7] cursor-pointer hover:bg-gray-100 transition"
                                                  onClick={() => toggleTipo(year, month, consultor, tipo)}
                                                >
                                                  <td></td>
                                                  <td></td>
                                                  <td></td>
                                                  <td className="px-4 h-12 font-medium text-gray-700">
                                                    <div className="flex items-center gap-3 pl-8">
                                                      <ChevronDown
                                                        className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${
                                                          expandedTipos[tKey] ? "rotate-180" : ""
                                                        }`}
                                                      />
                                                      <span>{tipo}</span>
                                                    </div>
                                                  </td>
                                                  <td></td>
                                                  <td className="px-4 h-12 text-slate-800 font-semibold">
                                                    {fmtPEN(tSum.cf)}
                                                  </td>
                                                  <td className="px-4 h-12 text-slate-800 font-semibold">
                                                    {fmtNumber(tSum.q, 0)}
                                                  </td>
                                                </tr>

                                                {/* Producto */}
                                                {expandedTipos[tKey] &&
                                                  Object.keys(
                                                    grouped[year][month][consultor][tipo]
                                                  ).map((prod) => {
                                                    const pSum = getProdTotals(
                                                      grouped, year, month, consultor, tipo, prod
                                                    );
                                                    return (
                                                      <tr
                                                        key={prod}
                                                        className="bg-white hover:bg-gray-50 transition"
                                                      >
                                                        <td></td>
                                                        <td></td>
                                                        <td></td>
                                                        <td></td>
                                                        <td className="px-4 h-12 text-gray-700 text-center">
                                                          {prod}
                                                        </td>
                                                        <td className="px-4 h-12">{fmtPEN(pSum.cf)}</td>
                                                        <td className="px-4 h-12">{fmtNumber(pSum.q, 0)}</td>
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
                  <td colSpan={7} className="py-6 text-center text-gray-500">
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
