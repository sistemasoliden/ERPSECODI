// src/components/reporteria/ReportRangeFilters.jsx
import React from "react";

const pad = (n) => String(n).padStart(2, "0");
const fmtYmd = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function ReportRangeFilters({
  from = "",
  to = "",
  onChange, // ({ from, to })
  minYear = 2021,
  maxYear = 2026,
  className = "",
}) {
  const globalMin = fmtYmd(new Date(minYear, 0, 1));
  const globalMax = fmtYmd(new Date(maxYear, 11, 31));

  const handleFrom = (v) => {
    // Permitir limpiar
    if (!v) {
      onChange?.({ from: "", to });
      return;
    }
    // No autollenes TO; solo corrige si TO < FROM
    const nextTo = to && to < v ? v : to;
    onChange?.({ from: v, to: nextTo || "" });
  };

  const handleTo = (v) => {
    // Permitir limpiar
    if (!v) {
      onChange?.({ from, to: "" });
      return;
    }
    // Mantén FROM; si quedó > TO, clampa FROM a TO
    const nextFrom = from && from > v ? v : from;
    onChange?.({ from: nextFrom || "", to: v });
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <input
        type="date"
        value={from || ""}
        min={globalMin}
        max={to || globalMax} // evita seleccionar FROM posterior a TO
        onChange={(e) => handleFrom(e.target.value)}
        className="h-12 rounded-lg text-xs bg-white border border-gray-900 px-3"
        title="Desde"
      />
      <span className="text-xs text-gray-500">—</span>
      <input
        type="date"
        value={to || ""}
        min={from || globalMin} // evita seleccionar TO anterior a FROM
        max={globalMax}
        onChange={(e) => handleTo(e.target.value)}
        className="h-12 rounded-lg text-xs bg-white border border-gray-900 px-3"
        title="Hasta"
      />
    </div>
  );
}
