import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axios";

const MONTH_NAMES = [
  "",
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

function MultiSelect({
  label,
  options = [],
  value = [],
  onChange,
  placeholder = "Selecciona…",
  disabled = false,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [query] = useState("");
  const ref = React.useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      String(o.label ?? o.value ?? "")
        .toLowerCase()
        .includes(q)
    );
  }, [options, query]);

  const toggle = (val) => {
    const set = new Set(value || []);
    set.has(val) ? set.delete(val) : set.add(val);
    onChange?.(Array.from(set));
  };

  const allSelected = value?.length > 0 && value.length === options.length;
  const handleSelectAll = () => onChange?.(options.map((o) => o.value));
  const handleClear = () => onChange?.([]);

  const selectedLabels = options
    .filter((o) => (value || []).includes(o.value))
    .map((o) => o.label);

  let buttonText = placeholder;

  if (allSelected) {
    buttonText = `Todos (${options.length})`; // 👈 muestra "Todos (N)"
  } else if (selectedLabels.length > 1) {
    buttonText = `${selectedLabels.length} seleccionados`; // 👈 más claro
  } else if (selectedLabels.length === 1) {
    buttonText = selectedLabels[0]; // 👈 nombre único
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      {label && (
        <label className="mb-1 block text-[11px] font-semibold tracking-wide text-slate-700 dark:text-slate-200">
          {label}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={[
          (className =
            "h-10 w-auto min-w-[140px] max-w-[160px] rounded-md border  text-[11px]"),
          "bg-white text-black border-slate-300",
          "hover:border-slate-400",
          "shadow-sm transition",

          "disabled:opacity-60 disabled:cursor-not-allowed",
          "dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700 dark:hover:border-slate-600 dark:focus:ring-offset-slate-950",
        ].join(" ")}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex items-center justify-between w-full h-full px-3 truncate">
          <span className="truncate">{buttonText}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 20 20"
            className="ml-1 opacity-70"
          >
            <path d="M5 7l5 6 5-6H5z" fill="currentColor" />
          </svg>
        </span>
      </button>

      {open && (
        <div
          className={[
            "absolute z-20 mt-1 min-w-[140px] max-w-[140px] overflow-hidden border shadow-lg", // 👈 ancho fijo
            "bg-white border-slate-200",
            "dark:bg-slate-900 dark:border-slate-700",
          ].join(" ")}
        >
          {/* Header sticky con acciones */}
          <div
            className={[
              "sticky top-0 z-10 flex justify-between items-center gap-1 border-b px-2 py-1.5", // 👈 más compacto
              "bg-white/95 backdrop-blur",
              "border-slate-200",
              "dark:bg-slate-900/80 dark:border-slate-700",
            ].join(" ")}
          >
            <button
              className="flex-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-2 text-[10px] 
                   font-medium hover:bg-slate-100 transition
                   dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
              onClick={handleSelectAll}
            >
              Todo
            </button>
            <button
              className="flex-1 rounded-md border border-slate-300 bg-slate-50 px-2 py-2 text-[10px] 
                   font-medium hover:bg-slate-100 transition
                   dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
              onClick={handleClear}
            >
              Limpiar
            </button>
          </div>

          {/* Lista de opciones */}
          <ul role="listbox" className="max-h-[160px] overflow-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400">
                Sin resultados
              </li>
            )}
            {filtered.map((o) => {
              const checked = (value || []).includes(o.value);
              return (
                <li key={o.value}>
                  <label
                    className={[
                      "flex cursor-pointer items-center gap-2 px-3 py-1 text-[11px]",
                      "hover:bg-slate-50 dark:hover:bg-slate-800/60",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600"
                      checked={checked}
                      onChange={() => toggle(o.value)}
                    />
                    <span className="truncate">{o.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>

          {/* Footer con estado */}
          <div className="border-t px-2 py-1.5 text-[10px] text-slate-600 dark:text-slate-400 dark:border-slate-700">
            {allSelected
              ? "Todos seleccionados"
              : `${value?.length || 0} seleccionados`}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Filtro principal (compacto + mejor alineado)
────────────────────────────────────────────────────────── */
export default function EstadoVentaFilter({
  value,
  onChange,
  label = "",
  disabled = false,

  yearValue,
  onChangeYear,
  monthValue,
  onChangeMonth,

  tipoVentaValue,
  onChangeTipoVenta,
  pdvOnly,
  onChangePdvOnly,

  cfMode = "normal", // "normal" | "facturacion"
  onChangeCfMode, // setter

  onClear,
  className = "",
}) {
  // -------- Estado --------
  const [items, setItems] = useState([]);
  const [loadingEstados, setLoadingEstados] = useState(true);
  const [errEstados, setErrEstados] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingEstados(true);
      try {
        const res = await api.get("/estadosventa");
        const data = Array.isArray(res.data) ? res.data : [];

        if (!alive) return;
        const ESTADO_INACTIVO = "Inactivo";
        const activos = data.filter(
          (x) =>
            (x.nombre || x.name || "").toLowerCase() !==
            ESTADO_INACTIVO.toLowerCase()
        );

        setItems(
          activos.map((x) => ({
            id: x._id,
            label: x.nombre || x.name || x.slug || "",
            value: x.nombre || x.name || x.slug || "",
          }))
        );
      } catch {
        if (alive) setErrEstados("No pude cargar estados de venta.");
      } finally {
        if (alive) setLoadingEstados(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // -------- Año --------
  const [years, setYears] = useState([]);
  const [errYears, setErrYears] = useState("");
  const [yearLocal, setYearLocal] = useState([]);

  const estadosSel = Array.isArray(value) ? value : value ? [value] : [];
  const yearsSel = Array.isArray(yearValue)
    ? yearValue
    : Array.isArray(yearLocal)
    ? yearLocal
    : [];
  const monthsSel = Array.isArray(monthValue)
    ? monthValue
    : monthValue
    ? [monthValue]
    : [];
  const tiposSel = Array.isArray(tipoVentaValue)
    ? tipoVentaValue
    : tipoVentaValue
    ? [tipoVentaValue]
    : [];

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/ventas-activacion/activacion/years");
        setYears(Array.isArray(data) ? data : []);
      } catch {
        setErrYears("No pude cargar años.");
      }
    })();
  }, []);

  const handleYearChange = (arr) => {
    if (onChangeYear) onChangeYear(arr);
    else setYearLocal(arr);
  };
  const handleMonthChange = (arr) => {
    if (onChangeMonth) onChangeMonth(arr);
  };

  // --- Meses independientes (fijos) ---
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: MONTH_NAMES[i + 1],
      })),
    []
  );

  // -------- Tipos de Venta --------
  const [tiposVenta, setTiposVenta] = useState([]);
  const [errTipos, setErrTipos] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/tiposventas");
        setTiposVenta(Array.isArray(data) ? data : []);
      } catch {
        setErrTipos("No pude cargar tipos de venta.");
      }
    })();
  }, []);

  return (
    <div
      className={[
        "flex flex-wrap items-center gap-x-8 gap-y-2 px-3 py-3", // 👈 más compacto (py-3)
        className || "",
      ].join(" ")}
    >
      {/* Estado */}
      <div className="w-[140px]">
        <MultiSelect
          label={label}
          options={items.map((op) => ({ value: op.value, label: op.label }))}
          value={estadosSel}
          onChange={onChange}
          placeholder={loadingEstados ? "Cargando…" : "Estados…"}
          disabled={disabled || !!errEstados || loadingEstados}
        />
        {errEstados && (
          <span className="mt-1 block text-[8px] text-red-600 dark:text-red-400">
            {errEstados}
          </span>
        )}
      </div>

      {/* Año */}
      <div className="w-[140px]">
        <MultiSelect
          options={years.map((y) => ({ value: y, label: String(y) }))}
          value={yearsSel}
          onChange={handleYearChange}
          placeholder="Años…"
        />
        {errYears && (
          <span className="mt-1 block text-[10px] text-red-600 dark:text-red-400">
            {errYears}
          </span>
        )}
      </div>

      {/* Mes */}
      <div className="w-[140px]">
        <MultiSelect
          options={monthOptions}
          value={monthsSel}
          onChange={handleMonthChange}
          placeholder="Meses…"
        />
      </div>

      {/* Tipo de Venta */}
      <div className="w-[140px]">
        <MultiSelect
          options={tiposVenta.map((t) => ({
            value: t.nombre,
            label: t.nombre,
          }))}
          value={tiposSel}
          onChange={onChangeTipoVenta}
          placeholder="Tipos…"
        />
        {errTipos && (
          <span className="mt-1 block text-[10px] text-red-600 dark:text-red-400">
            {errTipos}
          </span>
        )}
      </div>

      {/* Toggle Solo PDV */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
          Ventas PDV
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={pdvOnly}
          onClick={() => onChangePdvOnly?.(!pdvOnly)}
          className={[
            "relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-300",
            pdvOnly ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600",
          ].join(" ")}
        >
          <span
            className={[
              "inline-block h-3 w-3 transform rounded-full bg-white shadow transition",
              pdvOnly ? "translate-x-5" : "translate-x-1",
            ].join(" ")}
          />
        </button>
      </div>

      {/* Selector CF (Normal vs Facturación SIN IGV) */}
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-md border border-slate-300 overflow-hidden dark:border-slate-600">
          <button
            type="button"
            onClick={() => onChangeCfMode?.("normal")}
            className={[
              "px-3 py-3 text-[11px] transition",
              cfMode === "normal"
                ? "bg-emerald-500 text-white"
                : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
            ].join(" ")}
            title="Usar CF SIN IGV"
          >
            Cf normal
          </button>
          <button
            type="button"
            onClick={() => onChangeCfMode?.("facturacion")}
            className={[
              "px-3 py-1.5 text-[11px] transition border-l border-slate-300 dark:border-slate-600",
              cfMode === "facturacion"
                ? "bg-emerald-500 text-white"
                : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
            ].join(" ")}
            title="Usar CF FACTURACIÓN DSCTO SIN IGV"
          >
            Cf real PDV
          </button>
        </div>
      </div>

      {/* Botón limpiar */}
      {onClear && (
        <button
          type="button"
          onClick={() => onClear()}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md 
             bg-slate-100 px-6 text-[11px] font-medium text-slate-700 shadow-sm
             hover:bg-slate-200 transition
             dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          title="Limpiar filtros"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M12 5V1L7 6l5 5V7c2.76 0 5 2.24 5 5a5 5 0 1 1-5-5z"
              fill="currentColor"
            />
          </svg>
          Limpiar
        </button>
      )}
    </div>
  );
}
