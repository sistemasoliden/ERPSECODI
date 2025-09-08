import React from "react";

const Badge = ({ label }) => (
  <span className="inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded border border-gray-300 text-gray-700">
    {label}
  </span>
);

const Field = ({ label, children }) => (
  <div>
    <div className="text-[10px] uppercase text-gray-500">{label}</div>
    <div className="text-sm font-medium text-gray-800 break-words">{children || "—"}</div>
  </div>
);

export default function RucCard({ item }) {
  const {
    ruc,
    razonSocial,
    direccion,
    movistarLines,
    claroLines,
    entelLines,
    otherLines,
    uncountedLines,
    totalLines,
    sunatCondition,
    sunatState,
    sunatDepartment,
    sunatProvince,
    sunatDistrict,
    assignedAt,
  } = item || {};

  const assignedFmt = assignedAt
    ? new Date(assignedAt).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" })
    : "—";

  return (
    <div className="rounded-xl border border-gray-300 bg-white p-4 hover:bg-gray-50 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="text-xs text-gray-500">RUC</div>
          <div className="text-base font-bold text-gray-900 truncate">{ruc}</div>
          <div className="text-sm font-semibold text-gray-800 truncate">{razonSocial || "—"}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sunatState && <Badge label={`SUNAT: ${sunatState}`} />}
          {sunatCondition && <Badge label={sunatCondition} />}
          <Badge label={`Asignado: ${assignedFmt}`} />
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Dirección">{direccion}</Field>
        <Field label="Ubicación">
          {[sunatDepartment, sunatProvince, sunatDistrict].filter(Boolean).join(" / ") || "—"}
        </Field>

        <div className="sm:col-span-2">
          <div className="text-[10px] uppercase text-gray-500 mb-1">Líneas por operador</div>
          <div className="grid grid-cols-5 gap-2">
            <div className="rounded-lg border border-gray-200 p-2 text-center">
              <div className="text-[10px] text-gray-500">Movistar</div>
              <div className="text-sm font-bold">{movistarLines ?? 0}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-2 text-center">
              <div className="text-[10px] text-gray-500">Claro</div>
              <div className="text-sm font-bold">{claroLines ?? 0}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-2 text-center">
              <div className="text-[10px] text-gray-500">Entel</div>
              <div className="text-sm font-bold">{entelLines ?? 0}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-2 text-center">
              <div className="text-[10px] text-gray-500">Otros</div>
              <div className="text-sm font-bold">{otherLines ?? 0}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-2 text-center">
              <div className="text-[10px] text-gray-500">Sin contar</div>
              <div className="text-sm font-bold">{uncountedLines ?? 0}</div>
            </div>
          </div>
        </div>

        <div className="sm:col-span-2">
          <div className="rounded-lg border border-gray-200 p-3 flex items-center justify-between">
            <div className="text-[10px] uppercase text-gray-500">Total líneas</div>
            <div className="text-lg font-extrabold text-gray-900">{totalLines ?? 0}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
