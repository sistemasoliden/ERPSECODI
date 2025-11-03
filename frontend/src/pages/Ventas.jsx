// src/pages/Ventas.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api/axios";
import VentaForm from "../components/VentaForm";
import FiltrosWrapper from "../components/FiltrosWrapper";
import { Loader } from "../components/Loader";
import Swal from "sweetalert2";

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
// Reemplaza tu COLUMN_ORDER por este (claves camelCase que sí llegan del backend)
const COLUMN_ORDER = [
  "fechaIngreso",
  "fechaActivacion",
  "ruc",
  "razonSocial",
  "segmento",
  "estadoFinal",
  "motivoRechazo",

  "consultores",
  "dniConsultor",
  "supervisor",
  "consultorRegistrado",

  "plan",
  "dsctoFacturacion",
  "tipoV",
  "producto",
  "pdv",

  "q",
  "cfSinIgv",
  "cfConIgv",
  "cfDescSinIgv",
  "cfDescConIgv",

  "equipo",
  "costoEquipo",
  "lineas",

  "secProyectoSot",

  "cuenta",

  "salesforce",
  "loteo",

  "distrito",

  "nombre",
  "numero",
  "correo",
  "nombre2",
  "numero3",
  "correo4",
];

const HEADERS_MAP = {
  fechaIngreso: "Fecha de Ingreso",
  fechaActivacion: "Fecha de Activación",
  ruc: "RUC",
  razonSocial: "Razón Social",
  segmento: "Segmento",

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
  cfDescSinIgv: "CF Descuento sin IGV",
  cfDescConIgv: "CF Descuento con IGV",
  distrito: "Distrito",
  plan: "Plan",
  costoEquipo: "Costo Equipo",
  pdv: "PDV",
  motivoRechazo: "Motivo Rechazo",

  dsctoFacturacion: "Descuento Facturación",
  nombre: "Nombre",
  numero: "Número",
  correo: "Correo",
  nombre2: "Nombre 2",
  numero3: "Número 2",
  correo4: "Correo 2",
};

// Min width por columna (ajusta a gusto)
// Usa camelCase, igual que la data que pintas en la tabla
const COL_MIN_W = {
  fechaIngreso: "min-w-[100px] whitespace-nowrap",
  fechaActivacion: "min-w-[100px] whitespace-nowrap",
  ruc: "min-w-[120px] whitespace-nowrap tabular-nums",
  razonSocial: "min-w-[100px] max-w-[360px] whitespace-nowrap",
  segmento: "min-w-[100px] whitespace-nowrap",

  estadoFinal: "min-w-[100px] whitespace-nowrap",
  secProyectoSot: "min-w-[100px] whitespace-nowrap",

  tipoV: "min-w-[100px] whitespace-nowrap",
  producto: "min-w-[100px] whitespace-nowrap",
  lineas: "min-w-[100px] whitespace-nowrap tabular-nums text-center",
  cuenta: "min-w-[100px] whitespace-nowrap tabular-nums text-center",
  equipo: "min-w-[100px] whitespace-nowrap",
  salesforce: "min-w-[100px] whitespace-nowrap",
  loteo: "min-w-[100px] whitespace-nowrap",

  q: "min-w-[80px] whitespace-nowrap tabular-nums text-center",
  cfSinIgv: "min-w-[100px] whitespace-nowrap tabular-nums text-center",
  cfConIgv: "min-w-[100px] whitespace-nowrap tabular-nums text-center",
  cfDescSinIgv: "min-w-[100px] whitespace-nowrap tabular-nums text-center",
  cfDescConIgv: "min-w-[100px] whitespace-nowrap tabular-nums text-center",

  distrito: "min-w-[100px] whitespace-nowrap",
  plan: "min-w-[100px] whitespace-nowrap",
  costoEquipo: "min-w-[100px] whitespace-nowrap tabular-nums text-center",
  pdv: "min-w-[50px] whitespace-nowrap",
  motivoRechazo: "min-w-[100px] whitespace-nowrap",

  dsctoFacturacion: "min-w-[100px] whitespace-nowrap",
  nombre: "min-w-[100px] whitespace-nowrap",
  numero: "min-w-[100px] whitespace-nowrap",
  correo: "min-w-[100px] whitespace-nowrap",
  nombre2: "min-w-[100px] whitespace-nowrap",
  numero3: "min-w-[100px] whitespace-nowrap",
  correo4: "min-w-[100px] whitespace-nowrap",
};

// fallback si falta alguna
const mw = (key) => COL_MIN_W[key] || "min-w-[140px] whitespace-nowrap";

const ROLES_IDS = {
  sistemas: "68a4f22d27e6abe98157a82c",
  backoffice: "68a4f22d27e6abe98157a830",
  comercial: "68a4f22d27e6abe98157a831",
  supervisorcomercial: "68a4f22d27e6abe98157a832",
};
// fallback si no está en el mapa

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

  const canManageVentas = React.useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      const u = raw ? JSON.parse(raw) : null;
      const roleId = typeof u?.role === "string" ? u.role : u?.role?._id || "";
      return [ROLES_IDS.sistemas, ROLES_IDS.backoffice].includes(roleId);
    } catch {
      return false;
    }
  }, []);
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
    const present = new Set();
    for (const r of ventas) for (const k of Object.keys(r)) present.add(k);
    // orden fijo, solo las que existen en algún registro
    return COLUMN_ORDER.filter((k) => present.has(k));
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

    const ids = Array.from(selected);
    const selCount = ids.length;

    const { value: times, isConfirmed } = await Swal.fire({
      icon: "question",
      title: "Generar copias",
      text: `Seleccionaste ${selCount} venta${
        selCount > 1 ? "s" : ""
      }. ¿Cuántas copias quieres por cada una?`,
      input: "number",
      inputValue: 1,
      inputAttributes: { min: 1, max: 50, step: 1 },
      inputLabel: "Cantidad (max 50)",
      showCancelButton: true,
      confirmButtonText: "Generar",
      cancelButtonText: "Cancelar",
      buttonsStyling: false,
      customClass: {
        popup: "w-[420px] max-w-full mt-16 rounded-lg",
        title: "text-base font-semibold text-slate-800",
        htmlContainer: "text-slate-600",
        confirmButton:
          "bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700",
        cancelButton:
          "bg-slate-200 text-slate-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-300 ml-12",
        input:
          "border border-slate-300 text-center rounded px-3 py-2 text-sm w-20 mx-auto block",
      },
      preConfirm: (val) => {
        const n = Number(val);
        if (!Number.isFinite(n) || n < 1 || n > 50) {
          Swal.showValidationMessage("Ingresa un número entre 1 y 50");
          return false;
        }
        return n;
      },
    });

    if (!isConfirmed) return;

    try {
      setLoading(true);
      await api.post("/ventas/duplicate", { ids, times }); // cambia la ruta si renombraste el endpoint
      await fetchVentas();

      setTimeout(() => setToast(null), 3500);
    } catch (e) {
      console.error("❌ Error generando copias:", e);
      setToast({ kind: "error", msg: "No se pudo generar las copias." });
    } finally {
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
    <div className="min-h-[calc(100vh-88px)]  bg-[#F2F0F0] dark:bg-slate-950 p-4 md:p-6">
      {" "}
      {/* bg-zinc-100 */}
      {loading && (
        <Loader
          variant="fullscreen"
          message="Cargando ventas…"
          navbarHeight={88}
        />
      )}
      {/* Filtros (arriba, compactos) */}
      <div className="relative z-30 -mt-1 px-6">
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
      <div className="-mt-2 max-w-full dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        {/* Botones */}
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
          <div className="flex flex-wrap items-center gap-3">
            {canManageVentas && (
              <>
                {/* Editar */}
                <button
                  onClick={handleEdit}
                  disabled={selected.size !== 1 || loading}
                  title="Editar"
                  className="min-w-[110px] h-12 inline-flex items-center justify-center gap-2 rounded-md
          border border-slate-400 bg-slate-200 text-xs font-medium text-slate-800 shadow-sm
          hover:bg-slate-300 transition disabled:opacity-50 disabled:cursor-not-allowed
          dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  <span>Editar</span>
                </button>

                {/* Generar Copia */}
                <button
                  onClick={handleDuplicate}
                  disabled={!someSelected || loading}
                  title="Generar Copia"
                  className="min-w-[140px] h-12 inline-flex items-center justify-center gap-2 rounded-md
          border border-purple-600 bg-purple-600 text-xs  text-white shadow-sm
          hover:bg-purple-800 transition disabled:opacity-50 disabled:cursor-not-allowed
          dark:border-purple-700 dark:bg-purple-800 dark:hover:bg-purple-700"
                >
                  <span>Generar Copia</span>
                </button>

                {/* Eliminar */}
                <button
                  onClick={handleDelete}
                  disabled={!someSelected || loading}
                  title="Eliminar"
                  className="min-w-[130px] h-12 inline-flex items-center justify-center gap-2 rounded-md
          border border-red-700 bg-red-800 text-xs  text-white shadow-sm
          hover:bg-red-900 transition disabled:opacity-50 disabled:cursor-not-allowed
          dark:border-red-800 dark:bg-red-900 dark:hover:bg-red-800"
                >
                  <span>Eliminar</span>
                </button>
              </>
            )}

            {/* Exportar */}
            <button
              onClick={handleExport}
              disabled={loading || exporting}
              title="Exportar Excel"
              className="min-w-[130px] h-12 inline-flex items-center justify-center gap-2 rounded-md
      border border-black bg-emerald-800 text-xs  text-white shadow-sm
      hover:bg-emerald-900 transition disabled:opacity-50 disabled:cursor-not-allowed
      dark:border-emerald-800 dark:bg-emerald-900 dark:hover:bg-emerald-800"
            >
              {exporting ? "Exportando…" : "Exportar"}
            </button>

            {/* Buscar */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => {
                  const term = e.target.value;
                  setSearchTerm(term);
                  fetchVentas(true, term);
                }}
                className="h-12 px-3 rounded-md border border-black text-xs shadow-sm
        focus:outline-none focus:ring-2 focus:ring-purple-500 text-center
        dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
              />
            </div>

            {/* Nueva Venta */}
            {canManageVentas && (
              <button
                onClick={() => {
                  setEditingVenta(null);
                  setShowForm(true);
                }}
                title="Añadir nueva"
                className="min-w-[130px] h-10 inline-flex items-center justify-center gap-2 rounded-md
        border border-blue-700 bg-blue-800 text-xs text-center  text-white shadow-sm
        hover:bg-blue-900 transition
        dark:border-blue-800 dark:bg-blue-900 dark:hover:bg-blue-800"
              >
                <span>Ingresar Venta</span>
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Modal crear/editar */}
      {showForm && (
        <div
          className="fixed inset-0 z-40 flex justify-center 
             bg-slate-900/30 backdrop-blur-xl p-6"
        >
          <div
            className="mt-24 relative flex max-h-[75vh] w-full max-w-2xl flex-col 
                    rounded-md border border-slate-200 bg-white shadow-xl"
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
                    prev.map((v) =>
                      v._id === updatedVenta._id ? updatedVenta : v
                    )
                  );
                }}
                onCancel={() => setShowForm(false)}
              />
            </div>
          </div>
        </div>
      )}
      {/* Tabla */}
      <div className="mt-4 overflow-hidden border border-slate-200 bg-white/70 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/60 relative ml-8 mr-6">
        <div className="relative overflow-x-auto">
          <table className="table-auto w-full text-[12px]">
            <thead className="sticky top-0 z-10 bg-white text-center dark:bg-slate-900">
              <tr className="h-12">
                {/* THEAD: columna de selección */}
                <th className="w-[56px] border-b px-0 py-2 text-center text-[11px] font-bold tracking-wide text-slate-600">
                  <div className="flex items-center justify-center pl-3">
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
                    className={`border-b px-3 py-3 text-[11px] font-semibold tracking-wide text-slate-700 ${mw(
                      col
                    )}`}
                    title={HEADERS_MAP[col] ?? col}
                  >
                    {HEADERS_MAP[col] ?? col}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="text-center text-[10.5px] divide-y divide-slate-100">
              {!loading &&
                ventas.map((v, idx) => {
                  const canSelect = !!v._id;
                  const checked = canSelect && selected.has(v._id);

                  return (
                    <tr
                      key={v._id || idx}
                      className={`h-12 ${idx % 2 ? "bg-slate-50" : "bg-white"}`}
                    >
                      {/* Columna de selección (reemplaza el <td> ... </td> que tenías) */}
                      <td className="w-[56px] px-0">
                        <div className="flex h-10 items-center justify-center pl-3">
                          <input
                            type="checkbox"
                            className="h-3 w-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                            checked={checked}
                            disabled={!canSelect}
                            onChange={() => toggleRow(v._id)}
                            aria-label={`Seleccionar fila ${idx + 1}`}
                          />
                        </div>
                      </td>

                      {/* Resto de columnas dinámicas */}
                      {campos.map((col) => (
                        <td
                          key={col}
                          className={`px-3 py-3.5 text-slate-700 ${mw(col)}`}
                        >
                          <div className="truncate">
                            {v[col] != null ? String(v[col]) : ""}
                          </div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
      {/* Paginación */}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 text-[12px] text-black mr-6">
        <label className="mr-1">Filas:</label>
        <div className="relative inline-flex">
          <select
            className="appearance-none h-9  border border-slate-300 bg-white px-3 pr-8 text-xs text-slate-700 shadow-sm
               focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
               dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            aria-label="Filas por página"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n} className="tabular-nums">
                {n}
              </option>
            ))}
          </select>

          {/* chevron */}
          <svg
            className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.7a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <div className="ml-2 inline-flex items-stretch overflow-hidden  border border-slate-300 bg-white shadow-sm">
          <button
            className="inline-flex items-center gap-1 px-3 py-2 text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:text-slate-300 disabled:pointer-events-none"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            aria-label="Página anterior"
          >
            {/* chevron-left */}
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12.707 15.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4A1 1 0 1112.707 7.7L9.414 11l3.293 3.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            <span className="hidden sm:inline">Ant</span>
          </button>

          <div className="flex items-center bg-slate-50/60 px-3 py-1.5 text-slate-700 border-l border-r border-slate-200 select-none">
            Página&nbsp;
            <b className="tabular-nums">{page}</b>
            &nbsp;/&nbsp;
            <b className="tabular-nums">{totalPages}</b>
          </div>

          <button
            className="inline-flex items-center gap-1 px-3 py-1.5 text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:text-slate-300 disabled:pointer-events-none"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            aria-label="Página siguiente"
          >
            <span className="hidden sm:inline">Sig</span>
            {/* chevron-right */}
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M7.293 4.293a1 1 0 011.414 0L13 8.586a1 1 0 010 1.414l-4.293 4.293a1 1 0 11-1.414-1.414L10.586 10 7.293 6.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
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
