// src/components/OpportunityCard.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";

const Badge = ({ label }) => (
  <span className="inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded border border-gray-300 text-gray-700">
    {label}
  </span>
);

const Field = ({ label, children }) => (
  <div>
    <div className="text-[10px] uppercase text-gray-500">{label}</div>
    <div className="text-sm font-medium text-gray-800 break-words">
      {children ?? "—"}
    </div>
  </div>
);

export default function OpportunityCard({
  op,
  tipos = [],
  onChangeEstado,
  onUpdate,
}) {
  const base = op.base || {};
  const assignedFmt = op.createdAt
    ? new Date(op.createdAt).toLocaleString("es-PE", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

  // edición inline
  const [edit, setEdit] = useState(false);
  const [monto, setMonto] = useState(Number(op.monto || 0));
  const [cantidad, setCantidad] = useState(Number(op.cantidad || 1));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onUpdate?.(op._id, {
        monto: Number(monto) || 0,
        cantidad: Number(cantidad) || 1,
      });
      setEdit(false);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setEdit(false);
    setMonto(Number(op.monto || 0));
    setCantidad(Number(op.cantidad || 1));
  };

  return (
    <div className="rounded-xl border border-gray-300 bg-white p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="text-xs text-gray-500">RUC</div>
          <div className="text-base font-bold text-gray-900 truncate">
            <Link
              to={`/clientes/${op.ruc}`}
              className="underline text-indigo-700"
            >
              {op.ruc}
            </Link>
          </div>
          <div className="text-sm font-semibold text-gray-800 truncate">
            {op.razonSocial || base.razonSocial || "—"}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={`Estado: ${op.estadoNombre}`} />
          <Badge label={`Creado: ${assignedFmt}`} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Dirección">{base.direccion}</Field>
        <Field label="Ubicación">
          {[base.sunatDepartment, base.sunatProvince, base.sunatDistrict]
            .filter(Boolean)
            .join(" / ") || "—"}
        </Field>

        <div className="sm:col-span-2">
          <div className="text-[10px] uppercase text-gray-500 mb-1">
            Líneas por operador
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[
              ["Movistar", base.movistarLines],
              ["Claro", base.claroLines],
              ["Entel", base.entelLines],
              ["Otros", base.otherLines],
              ["Sin contar", base.uncountedLines],
            ].map(([label, val]) => (
              <div
                key={label}
                className="rounded-lg border border-gray-200 p-2 text-center"
              >
                <div className="text-[10px] text-gray-500">{label}</div>
                <div className="text-sm font-bold">{val ?? 0}</div>
              </div>
            ))}
          </div>
        </div>

        {/* MONTO + CANTIDAD (editable) */}
        {!edit ? (
          <>
            <Field label="Monto (S/.)">
              {Number(op.monto || 0).toLocaleString("es-PE")}
            </Field>
            <Field label="Cantidad (Q)">{op.cantidad ?? 1}</Field>
            <div className="sm:col-span-2 flex items-end justify-between">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                <div>
                  <div className="text-[10px] uppercase text-gray-500">
                    Cambiar estado
                  </div>
                  <select
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                    value={op.estadoId}
                    onChange={(e) => onChangeEstado?.(op._id, e.target.value)}
                  >
                    {tipos.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <Field label="Notas">{op.notas}</Field>
              </div>
              <button
                onClick={() => setEdit(true)}
                className="ml-3 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs"
              >
                Editar
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="text-[10px] uppercase text-gray-500">
                Monto (S/.)
              </div>
              <input
                type="number"
                className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
            <div>
              <div className="text-[10px] uppercase text-gray-500">
                Cantidad (Q)
              </div>
              <input
                type="number"
                className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value) || 1)}
              />
            </div>

            <div className="sm:col-span-2 flex justify-end gap-2">
              <button
                onClick={cancel}
                className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
