// src/components/reporteria/ReportRangeFilters.jsx
import React from "react";

const pad = (n) => String(n).padStart(2, "0");
const fmtYmd = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function ReportRangeFilters({
  from,
  to,
  onChange,           // ({ from, to })
  minYear = 2021,
  maxYear = 2026,
  className = "",
}) {
  const globalMin = fmtYmd(new Date(minYear, 0, 1));
  const globalMax = fmtYmd(new Date(maxYear, 11, 31));

  const handleFrom = (v) => {
    if (!v) return;
    // Mantén 'to' como está, solo corrige si queda antes de 'from'
    const next = { from: v, to: to && to >= v ? to : v };
    onChange(next);
  };

  const handleTo = (v) => {
    if (!v) return;
    // Mantén 'from' como está, solo corrige si queda después de 'to'
    const next = { from: from && from <= v ? from : v, to: v };
    onChange(next);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <input
        type="date"
        value={from || ""}
        min={globalMin}
        max={globalMax}
        onChange={(e) => handleFrom(e.target.value)}
        className="border rounded px-3 py-3 text-[12px] bg-white"
        title="Desde"
      />
      <span className="text-xs text-gray-500">—</span>
      <input
        type="date"
        value={to || ""}
        min={globalMin}
        max={globalMax}
        onChange={(e) => handleTo(e.target.value)}
        className="border rounded px-3 py-3 text-[12px] bg-white"
        title="Hasta"
      />
    </div>
  );
}
