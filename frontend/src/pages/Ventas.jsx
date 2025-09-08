// src/pages/Ventas.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api/axios";
import VentaForm from "../components/VentaForm";
import FiltrosWrapper from "../components/FiltrosWrapper";
import { Loader } from "../components/Loader";
import Swal from "sweetalert2";

const rawUser = localStorage.getItem("user");
const user = rawUser ? JSON.parse(rawUser) : null;

const ROLES_IDS = {
  sistemas: "68a4f22d27e6abe98157a82c",
  backoffice: "68a4f22d27e6abe98157a830",
  comercial: "68a4f22d27e6abe98157a831",
  supervisorcomercial: "68a4f22d27e6abe98157a832",
};

const userRoleId =
  typeof user?.role === "string" ? user.role : user?.role?._id || "";

// 👇 ahora sistemas y backoffice tienen permisos completos
const canManageVentas = [ROLES_IDS.sistemas, ROLES_IDS.backoffice].includes(
  userRoleId
);

// 👆 solo sistemas puede crear/editar/eliminar

/* Construye params con arrays como parámetros repetidos */
const buildParams = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
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

// sincroniza filtros sin setState en render
const SyncFiltros = ({ value, onChange, children }) => {
  const prev = React.useRef("");
  useEffect(() => {
    const next = JSON.stringify(value || {});
    if (next !== prev.current) {
      prev.current = next;
      onChange?.(value);
    }
  }, [value, onChange]);
  return children ?? null;
};

// -> timestamp: prioriza FECHA_ACTIVACION; fallback FECHA_INGRESO
const tsFrom = (row) => {
  const parse = (v) => {
    if (!v) return -Infinity;
    if (v instanceof Date) return v.getTime();
    const s = String(v);
    const d = new Date(/\d{4}-\d{2}-\d{2}/.test(s) ? `${s}T00:00:00Z` : s);
    const t = d.getTime();
    return Number.isFinite(t) ? t : -Infinity;
  };
  const ta = parse(row?.FECHA_ACTIVACION);
  if (ta !== -Infinity) return ta;
  return parse(row?.FECHA_INGRESO);
};

// Orden de columnas solicitado
const COLUMN_ORDER = [
  "FECHA_INGRESO",
  "FECHA_ACTIVACION",
  "RUC",
  "RAZON SOCIAL CLIENTE",
  "ESTADO FINAL",
  "SEC_PROYECTO_SOT",
  "TIPO_V",
  "PRODUCTO",
  "TIPO DE VENTA",
  "LINEAS",
  "CUENTA",
  "EQUIPO",
  "SALESFORCE",
  "Loteo",
  "CONSULTORES",
  "DNI_CONSULTOR",
  "SUPERVISOR",
  "CONSULTOR REGISTRADO",
  "Q",
  "CF SIN IGV",
  "CF INC IGV",
  "DISTRITO",
  "PLAN",
  "COSTO EQUIPO",
  "PDV",
  "MOTIVO RECHAZO",
  "SEGMENTO",
  "DSCTO FACTURACION",
  "PC CON IGV",
  "PC SIN IGV",
  "NOMBRE",
  "NUMERO",
  "CORREO",
  "NOMBRE2",
  "NUMERO3",
  "CORREO4",
];

const HEADERS_MAP = {
  fechaIngreso: "Fecha de Ingreso",
  fechaActivacion: "Fecha de Activación",
  ruc: "RUC",
  razonSocial: "Razón Social",
  estadoFinal: "Estado Final",
  secProyectoSot: "Sec. Proyecto SOT",
  tipoV: "Tipo de Venta",
  producto: "Producto",
  lineas: "Líneas",
  cuenta: "Cuenta",
  equipo: "Equipo",
  salesforce: "Salesforce",
  loteo: "Loteo",
  consultores: "Consultores",
  dniConsultor: "DNI Consultor",
  supervisor: "Supervisor",
  consultorRegistrado: "Consultor Registrado",
  q: "Q de Lineas",
  cfSinIgv: "CF sin IGV",
  cfConIgv: "CF con IGV",
  pcSinIgv: "PC sin IGV",
  pcConIgv: "PC con IGV",
  distrito: "Distrito",
  plan: "Plan",
  costoEquipo: "Costo Equipo",
  pdv: "PDV",
  motivoRechazo: "Motivo Rechazo",
  segmento: "Segmento",
  dsctoFacturacion: "Descuento Facturación",
  nombre: "Nombre",
  numero: "Número",
  correo: "Correo",
  nombre2: "Nombre 2",
  numero3: "Número 2",
  correo4: "Correo 2",
};

export default function Ventas() {
  const [ventas, setVentas] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // selección y acciones
  const [selected, setSelected] = useState(() => new Set());

  // modal crear/editar
  const [showForm, setShowForm] = useState(false);
  const [editingVenta, setEditingVenta] = useState(null);

  const [filtros, setFiltros] = useState({}); // llegan desde FiltrosWrapper

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null); // { kind: 'info'|'success'|'error', msg: string }

  // filas que son seleccionables (requieren _id)
  const selectableRows = useMemo(() => ventas.filter((v) => !!v._id), [ventas]);
  const allSelected =
    selectableRows.length > 0 && selected.size === selectableRows.length;
  const someSelected = selected.size > 0;

  const [searchTerm, setSearchTerm] = useState("");

  // trae ventas cada vez que cambian página/limit/filtros
  // 👉 Cambia fetchVentas para aceptar un flag opcional
  const fetchVentas = useCallback(
    async (fromSearch = false, term = searchTerm) => {
      try {
        if (!fromSearch) setLoading(true);

        const params = buildParams({
          page,
          limit,
          estado: filtros.estado,
          year: filtros.anio,
          month: filtros.mes,
          producto: filtros.producto,
          tipoVenta: filtros.tipoVenta,
          pdv: filtros.soloPdv ? "si" : undefined,
          search: term || undefined, // 👈 usa el valor que le pasamos
        });

        const res = await api.get("/ventas", { params });
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        rows.sort((a, b) => tsFrom(b) - tsFrom(a));

        setVentas(rows);
        setTotal(res.data?.total ?? 0);
        setSelected(new Set());
      } catch (err) {
        console.error("❌ Error cargando ventas:", err);
        setVentas([]);
        setTotal(0);
        setSelected(new Set());
      } finally {
        if (!fromSearch) setLoading(false);
      }
    },
    [page, limit, filtros] // 👈 quitamos searchTerm
  );

  useEffect(() => {
    if (showForm) {
      document.body.style.overflow = "hidden"; // bloquea el scroll
    } else {
      document.body.style.overflow = ""; // restaura el scroll
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [showForm]);

  useEffect(() => {
    fetchVentas();
  }, [fetchVentas]);

  // columnas dinámicas según orden solicitado
  const campos = useMemo(() => {
    if (ventas.length === 0) return [];
    const keys = Object.keys(ventas[0] || {});
    // primero las del orden fijo que existan:
    const ordered = COLUMN_ORDER.filter((k) => keys.includes(k));
    // luego el resto (sin _id)
    const rest = keys.filter((k) => k !== "_id" && !ordered.includes(k));
    return [...ordered, ...rest];
  }, [ventas]);

  // toggle fila (con _id)
  const toggleRow = (id) => {
    if (!id) return; // sin id no se selecciona
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableRows.map((v) => v._id)));
    }
  };

  // ----- Acciones -----

  const handleDelete = async () => {
    if (selected.size === 0) return;

    // armar resumen

    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: `¿Estás seguro de eliminar ${selected.size} venta(s)?`,
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      buttonsStyling: false,
      customClass: {
        popup: "w-[500px] max-w-full p-4 rounded-lg", // 👈 más compacto
        title: "text-base font-semibold text-slate-800",
        htmlContainer: "text-slate-600",
        confirmButton:
          "bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700",
        cancelButton:
          "bg-slate-200 text-slate-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-300 ml-2",
      },
    });

    if (!isConfirmed) return;

    try {
      setLoading(true);
      const ids = Array.from(selected);
      const params = new URLSearchParams();
      ids.forEach((id) => params.append("ids", id));
      await api.delete(`/ventas?${params.toString()}`);
      await fetchVentas();
    } catch (e) {
      console.error("❌ Error eliminando:", e);
      setLoading(false);
    }
  };

  const handleDuplicate = async () => {
    if (selected.size === 0) return;
    try {
      setLoading(true);
      const ids = Array.from(selected);
      // usa endpoint batch de backend
      await api.post("/ventas/duplicate", { ids });
      await fetchVentas();
    } catch (e) {
      console.error("❌ Error duplicando:", e);
      setLoading(false);
    }
  };

  const handleEdit = () => {
    if (selected.size !== 1) {
      alert("Selecciona exactamente 1 fila para editar.");
      return;
    }
    const id = Array.from(selected)[0];
    const row = ventas.find((v) => v._id === id);
    if (!row) return;
    setEditingVenta(row);
    setShowForm(true);
  };

  const handleExport = useCallback(async () => {
    try {
      setExporting(true);
      setToast({ kind: "info", msg: "Preparando archivo para descarga…" });

      const params = buildParams({
        estado: filtros.estado, // puede ser string o array
        year: filtros.anio, // año seleccionado
        month: filtros.mes, // mes seleccionado
        producto: filtros.producto, // producto(s) seleccionados
        tipoVenta: filtros.tipoVenta, // tipo(s) de venta
        pdv: filtros.soloPdv ? "si" : undefined, // solo PDV
        search: searchTerm || undefined, // 👈 agregado
      });

      const res = await api.get("/ventas/export", {
        params,
        responseType: "blob",
      });

      const cd = res.headers["content-disposition"] || "";
      const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(cd);
      const filename =
        (match && decodeURIComponent(match[1])) ||
        `ReporteVentas(${new Date().toISOString().slice(0, 10)}).xlsx`;

      const blob = new Blob([res.data], {
        type:
          res.headers["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setToast({ kind: "success", msg: `Descarga iniciada: ${filename}` });
      setTimeout(() => setToast(null), 3500);
    } catch (err) {
      console.error("❌ Error exportando:", err);
      setToast({ kind: "error", msg: "No se pudo exportar el archivo." });
    } finally {
      setExporting(false);
    }
  }, [filtros, searchTerm]); // 👈 agrega searchTerm en dependencias

  return (
    <div className="min-h-[calc(100vh-88px)] bg-gray-200 dark:bg-slate-950 p-4 md:p-6">
      {loading && (
        <Loader
          variant="fullscreen"
          message="Cargando ventas…"
          navbarHeight={88}
        />
      )}

      {/* Filtros (arriba, auto-aplican) */}

      {/* Filtros (arriba, compactos) */}
      <div className="relative z-30 -mt-4 px-6">
        <FiltrosWrapper>
          {(f) => (
            <SyncFiltros
              value={f}
              onChange={(nf) => {
                setPage(1);
                setFiltros(nf || {});
              }}
            >
              <div className="h-0 overflow-hidden" />
            </SyncFiltros>
          )}
        </FiltrosWrapper>
      </div>

      {/* Header + Toolbar */}
      <div className="-mt-6 max-w-full dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-6 py-3">
          {/* Estado de selección */}
          <div className="flex items-center gap-3">
            {selected?.size > 0 && (
              <span
                className="hidden sm:inline-flex items-center gap-2 rounded-md 
                     border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 
                     text-[12px] font-medium text-emerald-700 shadow-sm
                     dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
              >
                <svg
                  className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 011.414-1.414L8.414 12.172l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {selected.size} seleccionada{selected.size > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Acciones */}
          {/* Acciones */}
          <div className="flex flex-wrap items-center gap-2">
            {canManageVentas && (
              <>
                <button
                  onClick={handleEdit}
                  disabled={selected.size !== 1 || loading}
                  title="Editar"
                  className="min-w-[100px] h-9 inline-flex items-center justify-center gap-1.5 rounded-md 
             border border-gray-400 bg-gray-200 text-[12px] font-medium text-slate-700 shadow-sm
             hover:bg-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed
             dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  ✏️ Editar
                </button>

                <button
                  onClick={handleDuplicate}
                  disabled={!someSelected || loading}
                  title="Duplicar"
                  className="min-w-[100px] h-9 inline-flex items-center justify-center gap-1.5 rounded-md 
             border border-indigo-500/30 bg-indigo-600 text-[12px] font-medium text-white shadow-sm
             hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed
             dark:border-indigo-700/40 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                >
                  📄 Duplicar
                </button>

                <button
                  onClick={handleDelete}
                  disabled={!someSelected || loading}
                  title="Eliminar"
                  className="min-w-[100px] h-9 inline-flex items-center justify-center gap-1.5 rounded-md 
             border border-red-500/30 bg-red-600 text-[12px] font-medium text-white shadow-sm
             hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed
             dark:border-red-700/40 dark:bg-red-600 dark:hover:bg-red-500"
                >
                  🗑️ Eliminar
                </button>
              </>
            )}

            {/* Exportar visible para todos */}
            <button
              onClick={handleExport}
              disabled={loading || exporting}
              title="Exportar Excel"
              className="min-w-[120px] h-9 inline-flex items-center justify-center gap-1.5 rounded-md 
         border border-emerald-500/30 bg-emerald-600 text-[12px] font-medium text-white shadow-sm
         hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed
         dark:border-emerald-700/40 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {exporting ? "⏳ Exportando…" : "Exportar"}
            </button>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => {
                  const term = e.target.value;
                  setSearchTerm(term);
                  fetchVentas(true, term); // 👈 busca sin loader
                }}
                className="h-9 px-3 rounded-md border border-slate-300 text-[12px] shadow-sm
             focus:outline-none focus:ring-2 focus:ring-blue-500
             dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
              />
            </div>

            {canManageVentas && (
              <button
                onClick={() => {
                  setEditingVenta(null);
                  setShowForm(true);
                }}
                title="Añadir nueva"
                className="min-w-[120px] h-9 inline-flex items-center justify-center gap-1.5 rounded-md 
           border border-blue-500/30 bg-blue-600 text-[12px] font-medium text-white shadow-sm
           hover:bg-blue-700 transition
           dark:border-blue-700/40 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                Ingresar Venta
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal crear/editar */}
      {showForm && (
        <div
          className="fixed inset-x-0 top-[88px] bottom-0 z-40 flex items-start justify-center 
                  bg-slate-900/30 backdrop-blur-sm p-6"
        >
          <div
            className="relative flex max-h-[75vh] w-full max-w-2xl flex-col 
                    rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-2">
              <h2 className="text-xs font-semibold uppercase text-slate-800">
                {editingVenta ? "Editar venta" : "Añadir nueva venta"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            {/* Contenido scrollable */}
            <div className="flex-1 overflow-y-auto p-4">
              <VentaForm
  key={editingVenta?._id || "new"}
  initialData={editingVenta || undefined}
  onCreated={(newVenta) => {
    if (!newVenta?._id) return;
    setShowForm(false);
    setVentas((prev) => [newVenta, ...prev]);
  }}
  onSaved={(updatedVenta) => {
    if (!updatedVenta?._id) return;
    setShowForm(false);
    setVentas((prev) =>
      prev.map((v) => (v._id === updatedVenta._id ? updatedVenta : v))
    );
  }}
  onCancel={() => setShowForm(false)}
/>

            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="mt-4 overflow-hidden border border-slate-200 bg-white/70 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/60 relative">
        <div className="relative overflow-x-auto">
          <table className="min-w-full text-[12px]">
            <thead className="sticky top-0 z-10 bg-gradient-to-b from-slate-50 to-white text-center dark:from-slate-900 dark:to-slate-950">
              <tr className="h-10">
                {/* Columna de selección */}
                <th className="w-[42px] border-b px-3 py-2 text-center text-[11px] font-semibold tracking-wide text-slate-600">
                  <div className="flex justify-center mt-1">
                    <input
                      type="checkbox"
                      className="h-3 w-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Seleccionar todo"
                    />
                  </div>
                </th>

                {/* Resto de columnas dinámicas */}
                {campos.map((col) => (
                  <th
                    key={col}
                    className="border-b px-3 py-2 text-center text-[11px] font-bold tracking-wide text-black"
                  >
                    {HEADERS_MAP[col] ?? col}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="text-center text-[10px] divide-y divide-slate-100">
              {!loading && ventas.length === 0 && (
                <tr>
                  <td
                    colSpan={campos.length + 1}
                    className="py-10 text-center text-[10px] text-slate-500"
                  >
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                      <span className="text-base">🗂️</span>
                      <span>No hay resultados para la búsqueda</span>
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                ventas.map((v, idx) => {
                  const canSelect = !!v._id;
                  const checked = canSelect && selected.has(v._id);

                  return (
                    <tr
                      key={`${v._id || idx}`}
                      className={[
                        "h-10 transition",
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50",
                        "hover:bg-slate-50",
                        checked
                          ? "bg-emerald-50/70 ring-1 ring-inset ring-emerald-200"
                          : "",
                      ].join(" ")}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          className="h-3 w-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                          checked={checked}
                          disabled={!canSelect}
                          onChange={() => toggleRow(v._id)}
                          aria-label={`Seleccionar fila ${idx + 1}`}
                        />
                      </td>

                      {campos.map((col) => (
                        <td
                          key={col}
                          className="max-w-[320px] truncate px-3 py-2 text-[11px] text-slate-700"
                          title={v[col] != null ? String(v[col]) : ""}
                        >
                          {v[col] != null ? String(v[col]) : ""}
                        </td>
                      ))}
                    </tr>
                  );
                })}
            </tbody>
          </table>

          {/* Sombras laterales para el scroll */}
        </div>
      </div>

      {/* Paginación */}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 text-[12px] text-black">
        <label className="mr-1">Filas:</label>
        <select
          className="border border-slate-300 bg-white px-2 py-1.5 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value));
            setPage(1);
          }}
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        <div className="ml-2 inline-flex overflow-hidden border border-slate-300 bg-white shadow-sm">
          <button
            className="px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            aria-label="Página anterior"
          >
            ◀
          </button>
          <div className="px-3 py-1.5 text-slate-700">
            Página <b>{page}</b> de <b>{totalPages}</b>
          </div>
          <button
            className="px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            aria-label="Página siguiente"
          >
            ▶
          </button>
        </div>

        {toast && (
          <div className="fixed bottom-4 right-4 z-50">
            <div
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white shadow-lg",
                toast.kind === "success"
                  ? "bg-emerald-600"
                  : toast.kind === "error"
                  ? "bg-red-600"
                  : "bg-sky-600",
              ].join(" ")}
              role="status"
              aria-live="polite"
            >
              <span>{toast.msg}</span>
              <button
                onClick={() => setToast(null)}
                className="rounded px-2 py-0.5 bg-white/10 hover:bg-white/20 transition"
                aria-label="Cerrar notificación"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
