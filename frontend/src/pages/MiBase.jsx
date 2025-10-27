import React, { useEffect, useMemo, useState, useRef } from "react";
import * as XLSX from "xlsx";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import RucCard from "../components/RucCard.jsx";
import SkeletonRucCard from "../components/SkeletonRucCard.jsx";

export default function MiBase() {
  const reqIdRef = useRef(0); // id de la última petición emitida

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

  // === Buckets de tamaño por Nº de líneas ===
  const BUCKETS = [
    { key: "few", label: "Sin Líneas ", range: "0", test: (n) => n === 0 },
    {
      key: "small",
      label: "Small (1 - 14)",
      range: "1-14",
      test: (n) => n >= 1 && n <= 14,
    },
    {
      key: "medium",
      label: "Medium (15 - 40)",
      range: "15-40",
      test: (n) => n >= 15 && n <= 40,
    },
    { key: "large", label: "Large (41 +)", range: "41+", test: (n) => n >= 41 },
  ];

  // Colores por bucket (idle = suave, active = sólido)
  const bucketClasses = (key, active) => {
    const map = {
      few: active
        ? "bg-gray-700 text-white border-black"
        : "bg-gray-50 text-gray-800 border-black hover:bg-gray-100",
      small: active
        ? "bg-emerald-700 text-white border-black"
        : "bg-emerald-50 text-emerald-800 border-black hover:bg-emerald-100",
      medium: active
        ? "bg-amber-700 text-white border-black"
        : "bg-amber-50 text-amber-800 border-black hover:bg-amber-100",
      large: active
        ? "bg-indigo-700 text-white border-black"
        : "bg-indigo-50 text-indigo-800 border-black hover:bg-indigo-100",
    };
    return (
      map[key] ||
      (active
        ? "bg-gray-700 text-white border-gray-700"
        : "bg-white text-gray-800 border-gray-300")
    );
  };

  // Normaliza número
  const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  // Total de líneas por empresa (suma de fuentes conocidas)
  // Total de líneas SOLO de Movistar + Entel
  const getTotalLineas = (it) => {
    const mov = toNum(it?.movistarLines);
    const ent = toNum(it?.entelLines);
    return mov + ent;
  };

  // Bucket para un total
  const getBucketKey = (total) => {
    if (total === 0) return "few";
    if (total <= 14) return "small";
    if (total <= 40) return "medium";
    return "large";
  };

  const [selectedBuckets, setSelectedBuckets] = useState(() => new Set()); // e.g. {'small','medium'}

  /* =========================
   *  DATA LOAD
   * ========================= */
  const fetchAssigned = async () => {
    const myReqId = ++reqIdRef.current;
    setLoading(true);
    setErr("");
    try {
      const res = await api.get("/basesecodi/assigned", {
        ...authHeader,
        params: { userId: "me", page, limit, q: q || undefined },
      });

      if (myReqId !== reqIdRef.current) return;

      const { items: rawItems, total, pages } = res.data || {};

      const itemsWithSF = await Promise.all(
        (rawItems || []).map(async (it) => {
          const baseId = it?._id;
          if (!baseId) return { ...it, __sf: [] };
          try {
            const { data } = await api.get(
              `/data-salesforce/by-base/${baseId}`,
              authHeader
            );
            return { ...it, __sf: Array.isArray(data) ? data : [] };
          } catch {
            return { ...it, __sf: [] };
          }
        })
      );

      if (myReqId !== reqIdRef.current) return;

      setItems(itemsWithSF);
      setTotal(total || 0);
      setPages(pages || 1);
    } catch (err) {
      if (myReqId !== reqIdRef.current) return;
      setErr("No se pudo cargar tu base asignada.", err);
    } finally {
      if (myReqId === reqIdRef.current) setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get("/basesecodi/stats", {
        ...authHeader,
        params: { userId: "me" },
      });
      setStats(res.data || null);
    } catch {
      // opcional: console.warn("No se pudieron cargar las stats", e);
    }
  };

  const toggleBucket = (key) => {
    setSelectedBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
   *  ENRIQUECER + CONTAR + FILTRAR
   * ========================= */
  const itemsWithLines = useMemo(() => {
    return (items || []).map((it) => {
      const totalLineas = getTotalLineas(it);
      const bucketKey = getBucketKey(totalLineas);
      return { ...it, __totalLineas: totalLineas, __bucketKey: bucketKey };
    });
  }, [items]);

  const bucketCounts = useMemo(() => {
    const counts = { few: 0, small: 0, medium: 0, large: 0 };
    for (const it of itemsWithLines)
      counts[it.__bucketKey] = (counts[it.__bucketKey] || 0) + 1;
    return counts;
  }, [itemsWithLines]);

  const filteredItems = useMemo(() => {
    if (!selectedBuckets || selectedBuckets.size === 0) return itemsWithLines;
    return itemsWithLines.filter((it) => selectedBuckets.has(it.__bucketKey));
  }, [itemsWithLines, selectedBuckets]);

  /* =========================
   *  QUITAR CARD AL TIPIFICAR
   * ========================= */
  const handleTipificar = async (ruc) => {
    setItems((prev) =>
      prev.filter(
        (it) => String(it.rucStr || it.ruc) !== String(ruc).replace(/\D/g, "")
      )
    );
    fetchStats();
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
            "Total líneas": (mov || 0) + (cla || 0) + (ent || 0) + (otr || 0),
          });

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

      const wb = XLSX.utils.book_new();
      const wsRucs = XLSX.utils.json_to_sheet(rucRows);
      const wsContacts = XLSX.utils.json_to_sheet(contactRows);
      const wsUnidades = XLSX.utils.json_to_sheet(unidadRows);

      XLSX.utils.book_append_sheet(wb, wsRucs, "RUCs");
      XLSX.utils.book_append_sheet(wb, wsContacts, "Contactos");
      XLSX.utils.book_append_sheet(wb, wsUnidades, "Unidades");

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
    <div className="p-6 min-h-dvh bg-[#F2F0F0]">
      {/* Toolbar */}
      <div className="flex items-center gap-4 overflow-x-auto py-3 px-2 rounded-md">
        {/* stats compactos */}
        <div className="flex items-stretch gap-2.5 shrink-0">
          <div className="min-w-[140px] rounded-lg border border-gray-900 bg-white px-3 py-3 text-center">
            <div className="text-[10px] uppercase text-gray-900 font-semibold mb-1">
              Total asignados
            </div>
            <div className="text-lg font-extrabold leading-tight">
              {stats?.total ?? total}
            </div>
          </div>

          <div className="min-w-[140px] rounded-lg border border-gray-900 bg-white px-3 py-3 text-center">
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

          <div className="min-w-[140px] rounded-lg border border-gray-900 bg-white px-3 py-3 text-center">
            <div className="text-[10px] uppercase text-gray-900 font-semibold mb-1">
              Tipificadas hoy
            </div>
            <div className="text-lg font-extrabold leading-tight">
              {stats?.completedToday ?? 0}
            </div>
          </div>

          <div className="min-w-[140px] rounded-lg border border-gray-900 bg-white px-3 py-3 text-center">
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
          className="w-64 md:w-80 border border-gray-900 rounded px-3 py-3 text-[12px]"
        />

        <button
          onClick={() => {
            setQ("");
            setPage(1);
          }}
          className="px-5 py-3.5 bg-gray-400 border-gray-900 text-gray-800 text-xs font-bold rounded"
        >
          Limpiar
        </button>

        {/* Filtro por tamaño de líneas */}

        {/* exportar (derecha) */}
        <button
          onClick={handleExportExcel}
          disabled={loading || !items.length}
          className="ml-auto px-3 py-3.5 border-gray-900 bg-[#77C7A5] text-black font-bold text-xs rounded disabled:opacity-50"
          title="Exportar RUCs, Contactos y Unidades a Excel"
        >
          Exportar Excel
        </button>
      </div>

      <div className="flex items-center gap-2.5 ml-2 shrink-0">
        {BUCKETS.map((b) => {
          const active = selectedBuckets.has(b.key); // <-- ahora Set
          return (
            <button
              key={b.key}
              onClick={() => toggleBucket(b.key)}
              className={[
                "flex flex-col items-center justify-center",
                "w-[140px] h-[50px] px-3 py-3 rounded-md border border-black text-xs font-bold transition mb-4",
                bucketClasses(b.key, active),
              ].join(" ")}
              title={b.label}
            >
              <span className="font-bold">{b.label}</span>
              <span className="text-[10px] opacity-80 mt-1">
                ({bucketCounts[b.key] || 0})
              </span>
            </button>
          );
        })}
      </div>

      {/* Lista de RUCs */}
      {err && <div className="text-red-700 text-sm">{err}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
        {loading
          ? Array.from({ length: Math.max(limit, 6) }).map((_, i) => (
              <SkeletonRucCard key={`sk-${i}`} />
            ))
          : filteredItems.map((it) => (
              <RucCard key={it._id} item={it} onTipificar={handleTipificar} />
            ))}
      </div>

      {/* Empty state */}
      {!loading && !filteredItems.length && !err && (
        <div className="text-sm text-gray-600 mt-4">
          No hay resultados para tu búsqueda.
        </div>
      )}

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
