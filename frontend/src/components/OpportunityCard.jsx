import React from "react";
import { Link } from "react-router-dom";

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

export default function OpportunityCard({ op, tipos = [], onChangeEstado }) {
  const base = op.base || {};
  const assignedFmt = op.createdAt
    ? new Date(op.createdAt).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" })
    : "—";

  return (
    <div className="rounded-xl border border-gray-300 bg-white p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="text-xs text-gray-500">RUC</div>
          <div className="text-base font-bold text-gray-900 truncate">
            <Link to={`/clientes/${op.ruc}`} className="underline text-indigo-700">{op.ruc}</Link>
          </div>
          <div className="text-sm font-semibold text-gray-800 truncate">{op.razonSocial || base.razonSocial || "—"}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={`Estado: ${op.estadoNombre}`} />
          <Badge label={`Creado: ${assignedFmt}`} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Dirección">{base.direccion}</Field>
        <Field label="Ubicación">
          {[base.sunatDepartment, base.sunatProvince, base.sunatDistrict].filter(Boolean).join(" / ") || "—"}
        </Field>

        <div className="sm:col-span-2">
          <div className="text-[10px] uppercase text-gray-500 mb-1">Líneas por operador</div>
          <div className="grid grid-cols-5 gap-2">
            <div className="rounded-lg border border-gray-200 p-2 text-center">
              <div className="text-[10px] text-gray-500">Movistar</div>
              <div className="text-sm font-bold">{base.movistarLines ?? 0}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-2 text-center">
              <div className="text-[10px] text-gray-500">Claro</div>
              <div className="text-sm font-bold">{base.claroLines ?? 0}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-2 text-center">
              <div className="text-[10px] text-gray-500">Entel</div>
              <div className="text-sm font-bold">{base.entelLines ?? 0}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-2 text-center">
              <div className="text-[10px] text-gray-500">Otros</div>
              <div className="text-sm font-bold">{base.otherLines ?? 0}</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-2 text-center">
              <div className="text-[10px] text-gray-500">Sin contar</div>
              <div className="text-sm font-bold">{base.uncountedLines ?? 0}</div>
            </div>
          </div>
        </div>

        <div className="sm:col-span-2">
          <div className="rounded-lg border border-gray-200 p-3 flex items-center justify-between">
            <div className="text-[10px] uppercase text-gray-500">Total líneas</div>
            <div className="text-lg font-extrabold text-gray-900">{base.totalLines ?? 0}</div>
          </div>
        </div>

        <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Monto (S/.)">{Number(op.monto || 0).toLocaleString("es-PE")}</Field>
          <div>
            <div className="text-[10px] uppercase text-gray-500">Cambiar estado</div>
            <select
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              value={op.estadoId}
              onChange={(e) => onChangeEstado?.(op._id, e.target.value)}
            >
              {tipos.map(t => (
                <option key={t._id} value={t._id}>{t.nombre}</option>
              ))}
            </select>
          </div>
          <Field label="Notas">{op.notas}</Field>
        </div>
      </div>
    </div>
  );
}
