// src/pages/RankingYProgreso.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axios";
import { Loader } from "../components/Loader";
import FiltrosWrapper from "../components/FiltrosWrapper";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from "recharts";

/* ======================= Helpers comunes ======================= */
const buildParams = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (!v.length) continue;
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

const SyncFiltros = ({ value, onChange, children }) => {
  const prevStr = useRef("");
  useEffect(() => {
    const nextStr = JSON.stringify(value || {});
    if (nextStr !== prevStr.current) {
      prevStr.current = nextStr;
      onChange(value);
    }
  }, [value, onChange]);
  return children;
};

const fmtInt = (v) => new Intl.NumberFormat("es-PE").format(v ?? 0);
const fmtMoney = (v) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    maximumFractionDigits: 0,
  }).format(v ?? 0);

const monthLabel = {
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
};

/* ======================= Página ======================= */
export default function RankingYProgreso() {
  const [filtros, setFiltros] = useState({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Ranking
  const [topQ, setTopQ] = useState([]); // {consultor, userId, totalQ, totalCF}
  const [topCF, setTopCF] = useState([]);

  // Progreso
  const [ejecutivo, setEjecutivo] = useState("");
  const [progreso, setProgreso] = useState([]); // [{mes:"01", Q, CF}]
  const [yearSeries, setYearSeries] = useState(new Date().getFullYear());
  const [usuariosActivos, setUsuariosActivos] = useState([]);

  // Opciones para selector (de ranking)
  const ejecutivosOpts = useMemo(() => {
    return (
      (usuariosActivos || [])
        // 👇 Filtramos solo el rol que te interesa
        .filter(
          (u) =>
            String(u.role) === "68a4f22d27e6abe98157a831" ||
            String(u.role?._id) === "68a4f22d27e6abe98157a831"
        )
        // 👇 Mostramos nombre completo, o fallback
        .map((u) => u.name || `${u.firstName} ${u.lastName}`.trim() || u.email)
        .sort((a, b) => a.localeCompare(b))
    );
  }, [usuariosActivos]);

  useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        const res = await api.get("/users/activos");
        setUsuariosActivos(res.data || []);
      } catch (err) {
        console.error("❌ Error cargando usuarios activos:", err);
      }
    };
    fetchUsuarios();
  }, []);

  useEffect(() => {
    if (ejecutivosOpts.length && !ejecutivo) {
      setEjecutivo(ejecutivosOpts[0] || "");
    }
  }, [ejecutivosOpts, ejecutivo]);

  // ========= Carga Ranking (Top Q / Top CF) =========
  useEffect(() => {
    let cancelled = false;

    const fetchRanking = async () => {
      try {
        if (initialLoading) setInitialLoading(true);
        else setRefreshing(true);

        const paramsBase = {
          estado: filtros.estado,
          year: filtros.anio,
          month: filtros.mes,
          producto: filtros.producto,
          tipoVenta: filtros.tipoVenta,
          pdv: filtros.soloPdv ? "si" : "",
          cfMode: filtros.cfMode || "normal",
        };

        const [resQ, resCF] = await Promise.all([
          api.get("/ventas/consultores-ranking", {
            params: buildParams({ ...paramsBase, sortBy: "Q" }),
          }),
          api.get("/ventas/consultores-ranking", {
            params: buildParams({ ...paramsBase, sortBy: "CF" }),
          }),
        ]);

        if (cancelled) return;

        setTopQ(resQ.data?.data || []);
        setTopCF(resCF.data?.data || []);
      } catch (err) {
        console.error("❌ Error cargando ranking:", err);
      } finally {
        if (cancelled);
        if (initialLoading) setInitialLoading(false);
        else setRefreshing(false);
      }
    };

    fetchRanking();
    return () => {
      cancelled = true;
    };
  }, [filtros]); // recarga con filtros

  // ========= Carga Progreso (línea mensual) =========
  useEffect(() => {
    let cancelled = false;

    const y =
      Array.isArray(filtros.anio) && filtros.anio.length
        ? Number(filtros.anio[0])
        : new Date().getFullYear();

    const fetchProgreso = async () => {
      if (!ejecutivo) {
        setProgreso([]);
        setYearSeries(y);
        return;
      }

      try {
        setRefreshing(true);

        const params = buildParams({
          consultor: ejecutivo,
          year: y,
          estado: filtros.estado,
          producto: filtros.producto,
          tipoVenta: filtros.tipoVenta,
          pdv: filtros.soloPdv ? "si" : "",
          cfMode: filtros.cfMode || "normal",
        });

        const res = await api.get("/ventas/consultor-progreso", { params });

        if (cancelled) return;

        const rows = res.data?.data || [];
        const mapped = rows.map((r) => ({
          mes: r.mes,
          mesLabel: monthLabel[r.mes] || r.mes,
          Q: +r.Q || 0,
          CF: +r.CF || 0,
        }));
        setProgreso(mapped);
        setYearSeries(y);
      } catch (err) {
        console.error("❌ Error cargando progreso:", err);
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    };

    fetchProgreso();
    return () => {
      cancelled = true;
    };
  }, [ejecutivo, filtros]);

  /* ======================= Render ======================= */
  return (
    <div className="min-h-[calc(100vh-88px)] w-full bg-[#ebe8e8] dark:bg-slate-950 p-4 md:p-6">
      {/* Filtros arriba (idéntico patrón) */}
      <div className="relative z-30 -mt-1 px-6">
        <FiltrosWrapper>
          {(f) => (
            <SyncFiltros value={f} onChange={setFiltros}>
              <div className="h-0 overflow-hidden" />
            </SyncFiltros>
          )}
        </FiltrosWrapper>
      </div>

      {/* Loader inicial de pantalla completa */}
      {initialLoading || refreshing ? (
        <Loader
          variant="fullscreen"
          message="Cargando ventas..."
          navbarHeight={88}
        />
      ) : (
        <div className="mx-auto max-w-7xl px-2 md:px-4 py-6 space-y-8">
          {/* ======= Controles superiores ======= */}

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:bg-neutral-900">
            <h3 className="mb-1 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
              Progreso de {ejecutivo || "(sin selección)"} ({yearSeries})
            </h3>

            <div className="mt-2 h-[320px]">
              <div className="flex justify-end">
                <select
                  value={ejecutivo}
                  onChange={(e) => setEjecutivo(e.target.value)}
                  className="ml-[280px] mt-[10px] mb-[20px] 
               rounded-md border border-slate-300 
               bg-white px-3 py-2 text-sm 
               text-slate-700 shadow-md transition 
               focus:border-blue-500 focus:ring-1 focus:ring-blue-500
               dark:border-slate-700 dark:bg-neutral-900 dark:text-slate-200"
                >
                  {ejecutivosOpts.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  {ejecutivosOpts.length === 0 && (
                    <option value="">(sin datos)</option>
                  )}
                </select>
              </div>

              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={progreso}
                  margin={{ top: 10, right: 50, left: 50, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="2 2" vertical={false} />
                  <XAxis dataKey="mesLabel" />
                  <Tooltip
                    content={({ payload }) => {
                      if (!payload || !payload.length) return null;
                      const p = payload[0]?.payload || {};
                      return (
                        <div className="rounded-md border bg-white px-3 py-2 text-xs shadow">
                          <div className="mb-1 font-semibold">{p.mesLabel}</div>
                          <div>
                            Q: <b>{fmtInt(p.Q)}</b>
                          </div>
                          <div>
                            CF: <b>{fmtMoney(p.CF)}</b>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="CF"
                    name="CF"
                    stroke="#10004bff"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={true}
                  />
                  <Line
                    type="monotone"
                    dataKey="Q"
                    name="Q"
                    stroke="#eaee1dff"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* ======= Dos barras horizontales con scroll ======= */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Top Q */}
            <div className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-lg dark:bg-neutral-900">
              <h3 className="mb-2 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
                Ranking por Q (líneas)
              </h3>

              <div className="h-[480px] overflow-y-auto pr-2">
                <BarChart
                  layout="vertical"
                  width={500} // 👈 ancho fijo, puedes ajustar
                  height={topQ.length * 40} // 👈 cada barra ocupa ~40px
                  data={topQ.map((r) => ({
                    name: r.consultor || "(Sin nombre)",
                    value: r.totalQ || 0,
                  }))}
                  margin={{ top: 15, right: 24, left: 12, bottom: 8 }}
                  barCategoryGap="14%"
                >
                  <CartesianGrid
                    strokeDasharray="2 2"
                    horizontal
                    vertical={false}
                  />
                  <XAxis type="number" tick={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={220}
                    tick={{ fontSize: 11, fill: "#334155" }}
                  />
                  <Tooltip
                    formatter={(val) => [fmtInt(val), "Q"]}
                    labelFormatter={(l) => l}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="value" name="Q" fill="#2563eb" />
                </BarChart>
              </div>
            </div>
            {/* Top CF */}
            <div className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-lg dark:bg-neutral-900">
              <h3 className="mb-2 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
                Ranking por CF (sin IGV)
              </h3>

              <div className="h-[480px] overflow-y-auto pr-2">
                <BarChart
                  layout="vertical"
                  width={500}
                  height={topCF.length * 40}
                  data={topCF.map((r) => ({
                    name: r.consultor || "(Sin nombre)",
                    value: r.totalCF || 0,
                  }))}
                  margin={{ top: 8, right: 24, left: 12, bottom: 8 }}
                  barCategoryGap="14%"
                >
                  <CartesianGrid
                    strokeDasharray="2 2"
                    horizontal
                    vertical={false}
                  />
                  <XAxis type="number" tick={false} axisLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={220}
                    tick={{ fontSize: 11, fill: "#334155" }}
                  />
                  <Tooltip
                    formatter={(val) => [fmtMoney(val), "CF"]}
                    labelFormatter={(l) => l}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="value" name="CF" fill="#16a34a" />
                </BarChart>
              </div>
            </div>
          </div>

          {/* ======= Progreso del ejecutivo ======= */}

          {/* Overlay de refresco suave */}
          {refreshing && (
            <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center">
              <div className="rounded-full bg-white/90 px-3 py-1 text-xs shadow ring-1 ring-slate-200">
                Actualizando…
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
