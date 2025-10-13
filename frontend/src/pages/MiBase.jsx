import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import RucCard from "../components/RucCard.jsx";

export default function MiBase() {
  const { token } = useAuth();
  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(24);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  /* =========================
   *  DATA LOAD
   * ========================= */
  const fetchAssigned = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await api.get("/basesecodi/assigned", {
        ...authHeader,
        params: { userId: "me", page, limit, q: q || undefined },
      });
      const { items, total, page: p, pages } = res.data || {};
      setItems(items || []);
      setTotal(total || 0);
      setPages(pages || 1);
      if (p) setPage(p);
    } catch (err) {
      setErr("No se pudo cargar tu base asignada.");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get("/basesecodi/stats", {
        ...authHeader,
        params: { userId: "me" },
      });
      setStats(res.data || null);
    } catch {err}
  };

  useEffect(() => {
    fetchAssigned();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q, token]);

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const canPrev = page > 1;
  const canNext = page < pages;

  /* =========================
   *  QUITAR CARD AL TIPIFICAR
   * ========================= */
  const handleTipificar = async (ruc) => {
    setItems((prev) =>
      prev.filter(
        (it) => String(it.rucStr || it.ruc) !== String(ruc).replace(/\D/g, "")
      )
    );
    fetchStats(); // el backend ya cuenta usando Assignment.tipifiedAt
  };

  /* =========================
   *  EXPORTAR EXCEL
   * ========================= */
  const handleExportExcel = async () => {
    if (!items?.length) return;

    try {
      const rucRows = [];
      const contactRows = [];
      const unidadRows = [];

      // Obtener contactos y unidades para cada base en paralelo
      await Promise.all(
        items.map(async (it) => {
          const baseId = it._id;
          const rucStr = String(it.rucStr || it.ruc || "");
          const razonSocial = it.razonSocial || "";
          const direccion = it.direccion || "";
          const depto = it.sunatDepartment || "";
          const prov = it.sunatProvince || "";
          const dist = it.sunatDistrict || "";
          const sunatEstado = it.sunatState || "";
          const sunatCond = it.sunatCondition || "";
          const mov = it.movistarLines ?? 0;
          const cla = it.claroLines ?? 0;
          const ent = it.entelLines ?? 0;
          const otr = it.otherLines ?? 0;

          // Hoja 1: RUCs (datos de la tarjeta)
          rucRows.push({
            RUC: rucStr,
            "Razón Social": razonSocial,
            Dirección: direccion,
            Departamento: depto,
            Provincia: prov,
            Distrito: dist,
            "SUNAT Estado": sunatEstado,
            "SUNAT Condición": sunatCond,
            "Líneas Movistar": mov,
            "Líneas Claro": cla,
            "Líneas Entel": ent,
            "Líneas Otros": otr,
          });

          // Llamadas para completar hojas 2 y 3
          const [resContacts, resUnidades] = await Promise.all([
            api
              .get(`/contactos-empresas/by-base/${baseId}`, authHeader)
              .catch(() => ({ data: [] })),
            api
              .get(`/unidades-servicios/by-base/${baseId}`, authHeader)
              .catch(() => ({ data: [] })),
          ]);

          const contacts = Array.isArray(resContacts?.data)
            ? resContacts.data
            : [];
          const unidades = Array.isArray(resUnidades?.data)
            ? resUnidades.data
            : [];

          // Hoja 2: Contactos
          contacts.forEach((c) => {
            contactRows.push({
              RUC: rucStr,
              "Razón Social": razonSocial,
              "Nombre contacto": c.referenceName || "",
              Cargo: c.position || "",
              "Tipo contacto": c?.contactType?.nametypecontact || "",
              "Dato (tel/email)": c.contactDescription || "",
              Actualizado: c.updatedAt
                ? new Date(c.updatedAt).toLocaleString("es-PE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "",
            });
          });

          // Hoja 3: Unidades
          unidades.forEach((u) => {
            unidadRows.push({
              RUC: rucStr,
              "Razón Social": razonSocial,
              Línea: u.phoneNumber || "",
              Estado: u.status || "",
              Equipo: u.equipmentType || "",
              Plan: u.plan || "",
              "Fecha Contrato": u.contractDate
                ? new Date(u.contractDate).toLocaleDateString("es-PE")
                : "",
              "Estado desde": u.statusDate
                ? new Date(u.statusDate).toLocaleDateString("es-PE")
                : "",
              "Última fecha": u.lastDate
                ? new Date(u.lastDate).toLocaleDateString("es-PE")
                : "",
            });
          });
        })
      );

      // Construir workbook
      const wb = XLSX.utils.book_new();

      const wsRucs = XLSX.utils.json_to_sheet(rucRows);
      const wsContacts = XLSX.utils.json_to_sheet(contactRows);
      const wsUnidades = XLSX.utils.json_to_sheet(unidadRows);

      XLSX.utils.book_append_sheet(wb, wsRucs, "RUCs");
      XLSX.utils.book_append_sheet(wb, wsContacts, "Contactos");
      XLSX.utils.book_append_sheet(wb, wsUnidades, "Unidades");

      // Descargar
      XLSX.writeFile(
        wb,
        `MiBase_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (e) {
      console.error("Export Excel error:", e);
      alert("No se pudo exportar a Excel.");
    }
  };

  return (
<div className="p-6 min-h-dvh bg-[#ebe8e8]">    {/* Toolbar en una sola fila (scroll si no entra) */}
      {/* Toolbar 100% en una fila (con scroll horizontal si no entra) */}
      <div className="flex items-center gap-4 overflow-x-auto  py-3 px-2 rounded-md ">
        {/* stats compactos (mini-cards en línea) */}
        <div className="flex items-stretch gap-2.5 shrink-0">
          <div className="min-w-[140px] rounded-lg border border-gray-300 bg-white px-3 py-3 text-center">
            <div className="text-[10px] uppercase text-gray-900 font-semibold mb-1">
              Total asignados
            </div>
            <div className="text-lg font-extrabold leading-tight">
              {stats?.total ?? total}
            </div>
          </div>

          <div className="min-w-[140px] rounded-lg border border-gray-300 bg-white px-3 py-3 text-center">
            <div className="text-[10px] uppercase text-gray-900 font-semibold mb-1">
              Última asignación
            </div>
            <div className="text-md text-gray-900 font-extrabold leading-tight">
              {stats?.lastAssignedAt
                ? (() => {
                    const d = new Date(stats.lastAssignedAt);
                    const dd = String(d.getDate()).padStart(2, "0");
                    const mm = String(d.getMonth() + 1).padStart(2, "0");
                    const yyyy = d.getFullYear();
                    return `${dd} - ${mm} - ${yyyy}`;
                  })()
                : "—"}
            </div>
          </div>

          <div className="min-w-[140px] rounded-lg border border-gray-300 bg-white px-3 py-3 text-center">
            <div className="text-[10px] uppercase text-gray-900 font-semibold mb-1">
              Tipificadas hoy
            </div>
            <div className="text-lg font-extrabold leading-tight">
              {stats?.completedToday ?? 0}
            </div>
          </div>

          <div className="min-w-[140px] rounded-lg border border-gray-300 bg-white px-3 py-3 text-center">
            <div className="text-[10px] uppercase text-gray-900 font-semibold mb-1">
              Restantes
            </div>
            <div className="text-lg font-extrabold leading-tight">{total}</div>
          </div>
        </div>
        {/* buscador */}
        <input
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder="Buscar por RUC o Razón Social"
          className="w-64 md:w-80 border border-gray-300 rounded px-3 py-3 text-[12px]  "
        />

        {/* acciones */}
        <button
          onClick={() => {
            setPage(1);
            fetchAssigned();
          }}
          className="px-5 py-4 bg-gray-800 text-white font-bold text-xs rounded "
        >
          Buscar
        </button>

        <button
          onClick={() => {
            setQ("");
            setPage(1);
          }}
          className="px-5 py-4 bg-gray-400 text-gray-800 text-xs font-bold rounded "
        >
          Limpiar
        </button>
        {/* exportar (a la derecha, misma fila) */}
        <button
          onClick={handleExportExcel}
          disabled={loading || !items.length}
          className="ml-auto px-3 py-2 bg-[#77C7A5]  text-black font-bold text-xs rounded disabled:opacity-50 "
          title="Exportar RUCs, Contactos y Unidades a Excel"
        >
          Exportar Excel
        </button>
      </div>

      {/* Lista de RUCs */}
      {err && <div className="text-red-700 text-sm">{err}</div>}
      {loading && <div className="text-sm text-gray-600">Cargando…</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
        {items.map((it) => (
          <RucCard key={it._id} item={it} onTipificar={handleTipificar} />
        ))}
      </div>

      {/* Paginación */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => canPrev && setPage((p) => p - 1)}
            disabled={!canPrev}
            className="px-3 py-2 text-xs rounded border border-gray-300 disabled:opacity-50"
          >
            ← Anterior
          </button>
          <div className="text-xs text-gray-600">
            Página <b>{page}</b> de <b>{pages}</b> ({total} resultados)
          </div>
          <button
            onClick={() => canNext && setPage((p) => p + 1)}
            disabled={!canNext}
            className="px-3 py-2 text-xs rounded border border-gray-300 disabled:opacity-50"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
