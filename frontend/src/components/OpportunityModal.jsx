// src/components/OpportunityModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import StagePath from "./StagePath.jsx";
import AgendaCitaModal from "./AgendaCitaModal.jsx";
import { useAuth } from "../context/AuthContext";
import useLockBodyScroll from "../hooks/useLockBodyScroll";

// Icons (lucide-react)
import {
  Calendar,
  Pencil,
  BadgeDollarSign,
  Phone,
  Mail,
  UserRound,
  BriefcaseBusiness,
  Tags,
  Package,
} from "lucide-react";

export default function OpportunityModal({
  open,
  onClose,
  op,
  tipos = [],
  onChangeEstado,
  onUpdate,
}) {
  useLockBodyScroll(open);

  const { token } = useAuth();
  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  // Helpers
  const contactFromOp = (o) => ({
    nombre: o?.contacto?.nombre ?? "",
    celular: o?.contacto?.celular ?? "",
    cargo: o?.contacto?.cargo ?? "",
    correo: o?.contacto?.correo ?? "",
  });
  const isEmptyContact = (c) =>
    !c?.nombre && !c?.celular && !c?.cargo && !c?.correo;

  // ---- State base
  const [contact, setContact] = useState(contactFromOp(op));
  const [contactResolved, setContactResolved] = useState(contactFromOp(op));
  const [savingContact, setSavingContact] = useState(false);

  // Tipificación
  const [editTip, setEditTip] = useState(false);
  const [editContact, setEditContact] = useState(false);
  const [monto, setMonto] = useState(Number(op?.monto || 0));
  const [cantidad, setCantidad] = useState(Number(op?.cantidad || 1));

  const [openAgenda, setOpenAgenda] = useState(false);

  // ids + nombres para selects
  const [tipoVentaId, setTipoVentaId] = useState(
    op?.tipoVentaId || op?.tipoVenta?._id || ""
  );
  const [tipoVentaName, setTipoVentaName] = useState(
    op?.tipoVentaNombre || op?.tipoVenta?.nombre || ""
  );

  const [productoId, setProductoId] = useState(
    op?.productoId || op?.producto?._id || ""
  );
  const [productoName, setProductoName] = useState(
    op?.productoNombre || op?.producto?.nombre || ""
  );

  const [savingTip, setSavingTip] = useState(false);

  // listas para selects (se cargan al entrar en edición)
  const [tiposVentaOpts, setTiposVentaOpts] = useState([]);
  const [productosOpts, setProductosOpts] = useState([]);
  const [loadingLists, setLoadingLists] = useState(false);

  // Data Salesforce (por RUC)
  const [sfItems, setSfItems] = useState([]);
  const [loadingSF, setLoadingSF] = useState(false);

  // ---------- DERIVADOS ----------
  const productosFiltrados = useMemo(() => {
    if (!Array.isArray(productosOpts)) return [];
    if (!tipoVentaId) return [];
    return productosOpts.filter(
      (p) => String(p.tipoVentaId) === String(tipoVentaId)
    );
  }, [productosOpts, tipoVentaId]);

  const isEmail = (v) => /\S+@\S+\.\S+/.test(String(v || "").trim());
  const digitsOnly = (v) => (String(v || "").match(/\d/g) || []).join("");

  const fmtPEN = (n) =>
    `S/ ${(Number(n) || 0).toLocaleString("es-PE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  // Resolver nombres para el RESUMEN cuando vengan solo IDs
  useEffect(() => {
    const needTipo = open && !tipoVentaName && !!op?.tipoVentaId;
    const needProd = open && !productoName && !!op?.productoId;
    if (!needTipo && !needProd) return;

    let cancelled = false;

    (async () => {
      try {
        const [tRes, pRes] = await Promise.all([
          needTipo
            ? api.get("/tiposventas", authHeader)
            : Promise.resolve(null),
          needProd ? api.get("/productos", authHeader) : Promise.resolve(null),
        ]);

        if (tRes?.data && needTipo && !cancelled) {
          const t = (tRes.data || []).find(
            (x) => String(x._id) === String(op?.tipoVentaId)
          );
          if (t) setTipoVentaName(t.nombre || t.name || "");
        }

        if (pRes?.data && needProd && !cancelled) {
          const p = (pRes.data || []).find(
            (x) => String(x._id) === String(op?.productoId)
          );
          if (p) {
            setProductoName(p.nombre || p.name || "");
            // si no vino el tipo pero el producto lo trae, completa también el tipo
            if (!op?.tipoVentaId && p.tipoVentaId) {
              setTipoVentaId(String(p.tipoVentaId));
            }
          }
        }
      } catch {
        // silencioso: si falla, el resumen seguirá mostrando "—"
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    open,
    op?.tipoVentaId,
    op?.productoId,
    tipoVentaName,
    productoName,
    authHeader,
  ]);

  // Si cambia tipo, validar producto
  useEffect(() => {
    if (!editTip) return;
    const sigue = productosFiltrados.some(
      (p) => String(p._id) === String(productoId)
    );
    if (!sigue) {
      setProductoId("");
      setProductoName("");
    }
  }, [tipoVentaId, productosFiltrados, productoId, editTip]);

  // Sync al cambiar op
  useEffect(() => {
    const c = contactFromOp(op);
    setContact(c);
    setContactResolved(c);

    setMonto(Number(op?.monto || 0));
    setCantidad(Number(op?.cantidad || 1));

    setTipoVentaId(op?.tipoVentaId || op?.tipoVenta?._id || "");
    setTipoVentaName(op?.tipoVentaNombre || op?.tipoVenta?.nombre || "");

    setProductoId(op?.productoId || op?.producto?._id || "");
    setProductoName(op?.productoNombre || op?.producto?.nombre || "");

    setEditTip(false);
    setEditContact(false);
  }, [op]);

  // Cargar SF
  useEffect(() => {
    const loadSF = async () => {
      if (!open || !op?.ruc) return;
      setLoadingSF(true);
      try {
        const { data } = await api.get(
          `/data-salesforce/by-ruc/${String(op.ruc)}`,
          authHeader
        );
        setSfItems(Array.isArray(data) ? data : []);
      } catch {
        setSfItems([]);
      } finally {
        setLoadingSF(false);
      }
    };
    loadSF();
  }, [open, op?.ruc, authHeader]);

  // Resolver contacto
  useEffect(() => {
    let alive = true;
    const loadContact = async () => {
      if (!open) return;

      const baseC = contactFromOp(op);
      if (!isEmptyContact(baseC)) {
        if (alive) setContactResolved(baseC);
        return;
      }

      try {
        if (op?.contactId) {
          const { data } = await api.get(
            `/contactos-empresas/${op.contactId}`,
            authHeader
          );
          const c = {
            nombre: data?.referenceName || data?.name || "",
            celular: data?.contactDescription || data?.phone || "",
            cargo: data?.position || "",
            correo: data?.email || "",
          };
          if (alive) setContactResolved(c);
          return;
        }

        if (op?.ruc) {
          const { data } = await api.get(
            `/contactos-empresas/by-ruc/${String(op.ruc)}`,
            authHeader
          );
          const first = Array.isArray(data) ? data[0] : data;
          if (first) {
            const c = {
              nombre: first?.referenceName || first?.name || "",
              celular: first?.contactDescription || first?.phone || "",
              cargo: first?.position || "",
              correo: first?.email || "",
            };
            if (alive) setContactResolved(c);
            return;
          }
        }

        if (alive)
          setContactResolved({
            nombre: "",
            celular: "",
            cargo: "",
            correo: "",
          });
      } catch {
        if (alive)
          setContactResolved({
            nombre: "",
            celular: "",
            cargo: "",
            correo: "",
          });
      }
    };

    loadContact();
    return () => {
      alive = false;
    };
  }, [open, op?.contactId, op?.ruc, authHeader]);

  // Cargar listas para selects
  useEffect(() => {
    const loadLists = async () => {
      if (!open || !editTip) return;
      setLoadingLists(true);
      try {
        const [tRes, pRes] = await Promise.all([
          api.get("/tiposventas", authHeader),
          api.get("/productos", authHeader),
        ]);
        setTiposVentaOpts(Array.isArray(tRes?.data) ? tRes.data : []);
        setProductosOpts(Array.isArray(pRes?.data) ? pRes.data : []);
      } catch {
        setTiposVentaOpts([]);
        setProductosOpts([]);
      } finally {
        setLoadingLists(false);
      }
    };
    loadLists();
  }, [open, editTip, authHeader]);

  // ESC para cerrar
  useEffect(() => {
    const handler = (e) => e.key === "Escape" && onClose?.();
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !op) return null;

  // Estado (solo texto con color)
  const estadoTxt = (op?.estadoNombre || "").trim();
  const estadoLower = estadoTxt.toLowerCase();
  const estadoColor = estadoLower.includes("ganada")
    ? "text-emerald-600"
    : estadoLower.includes("perdida")
    ? "text-red-600"
    : "text-indigo-600";

  const lastStageAt =
    op.estadoUpdatedAt || op.updatedAt || op.fechaGestion || null;

  // Guardar contacto
  const saveContact = async () => {
    setSavingContact(true);
    try {
      await onUpdate?.(op._id, { contacto: contact });
      setEditContact(false);
      setContactResolved(contact);
    } finally {
      setSavingContact(false);
    }
  };

  // Guardar tipificación
  const saveTipificacion = async () => {
    setSavingTip(true);
    try {
      await onUpdate?.(op._id, {
        monto: Number(monto) || 0,
        cantidad: Number(cantidad) || 1,
        tipoVentaId: tipoVentaId || undefined,
        tipoVentaNombre: (tipoVentaName || "").trim(),
        productoId: productoId || undefined,
        productoNombre: (productoName || "").trim(),
      });
      setEditTip(false);
    } finally {
      setSavingTip(false);
    }
  };

  const handleChangeEtapa = (estadoId) => {
    const nombreSel = (
      tipos.find((t) => t._id === estadoId)?.nombre || ""
    ).toLowerCase();
    const esCierre =
      nombreSel.includes("ganada") || nombreSel.includes("perdida");
    if (esCierre) {
      const label =
        tipos.find((t) => t._id === estadoId)?.nombre || "esta etapa";
      if (!window.confirm(`¿Confirmas cerrar la oportunidad como "${label}"?`))
        return;
    }
    onChangeEstado?.(op._id, estadoId);
  };

  // último registro Salesforce (reciente)
  const sf = sfItems?.[0];

  // Normalizar contacto para la vista
  const rawCel = contactResolved?.celular || "";
  const rawMail = contactResolved?.correo || "";
  const correoShow = isEmail(rawMail) ? rawMail : isEmail(rawCel) ? rawCel : "";
  const celularFromMail = !isEmail(rawMail) ? digitsOnly(rawMail) : "";
  const celularFromCel = !isEmail(rawCel) ? digitsOnly(rawCel) : "";
  const celularShow = celularFromCel || celularFromMail || "";

  return (
    <div className="fixed inset-0 z-50">
      {/* Fondo */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute inset-x-0 top-6 mx-auto w-[min(1100px,96%)]">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 z-10 p-5 border-b bg-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-2xl font-extrabold text-gray-900 leading-8">
                  {op.ruc}
                </div>
                <div className="text-xl text-gray-900 font-extrabold">
                  {op.razonSocial || op?.base?.razonSocial || "—"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold ${estadoColor}`}>
                  {estadoTxt}
                </span>
                <button
                  onClick={onClose}
                  className="h-9 w-9 rounded-full grid place-content-center hover:bg-gray-100"
                  title="Cerrar"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Etapas */}
            <div className="mt-4">
              <StagePath
                tipos={tipos}
                currentId={op.estadoId}
                onChange={handleChangeEtapa}
              />
            </div>

            {/* Última gestión */}
            <div className="mt-3 text-sm text-gray-700">
              <span className="text-gray-900">
                Fecha de gestión de oportunidad -{" "}
              </span>
              <b className="text-gray-900 font-semibold">
                {lastStageAt
                  ? new Date(lastStageAt).toLocaleString("es-PE", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                  : "—"}
              </b>
            </div>
          </div>

          {/* Body con scroll interno */}
          <div className="max-h-[64vh] overflow-y-auto">
            {/* Contenedor unificado */}
            <div className="px-5 py-5">
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {/* Cabecera del contenedor */}
                <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">
                      Detalle de la oportunidad
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenAgenda(true)}
                    className="mr-4 flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-900 text-gray-900 hover:bg-white bg-gray-100 text-xs shadow-sm"
                    title="Agendar cita"
                  >
                    <Calendar className="w-4 h-4" />
                    Agendar
                  </button>
                </div>

                {/* Cuerpo */}
                <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm text-gray-900">
                  {/* Columna izquierda */}
                  <div className="space-y-6">
                    {/* Tipificación */}
                    <Section
                      title="Resumen de tipificación"
                      badgeColor="white"
                      action={
                        <div className="shrink-0 inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!editTip) {
                                setMonto(Number(op?.monto || 0));
                                setCantidad(Number(op?.cantidad || 1));
                                setTipoVentaId(
                                  op?.tipoVentaId || op?.tipoVenta?._id || ""
                                );
                                setTipoVentaName(
                                  op?.tipoVentaNombre ||
                                    op?.tipoVenta?.nombre ||
                                    ""
                                );
                                setProductoId(
                                  op?.productoId || op?.producto?._id || ""
                                );
                                setProductoName(
                                  op?.productoNombre ||
                                    op?.producto?.nombre ||
                                    ""
                                );
                              }
                              setEditTip((v) => !v);
                            }}
                            className="h-9 px-3 rounded-lg border border-gray-900 text-gray-800 hover:bg-gray-50 text-xs inline-flex items-center gap-2"
                            title={editTip ? "Cancelar" : "Editar"}
                          >
                            <Pencil className="h-4 w-4" />
                            {editTip ? "Cancelar" : "Editar"}
                          </button>
                        </div>
                      }
                    >
                      {!editTip ? (
                        /* ------- RESUMEN ------- */
                        <div className="rounded-xl border border-gray-900 p-4 bg-white">
                          <div className="grid gap-4 sm:grid-cols-2">
                            {/* Monto */}
                            <Tile
                              icon={<BadgeDollarSign className="w-4 h-4" />}
                              label="Monto (S/.)"
                            >
                              {fmtPEN(op?.monto)}
                            </Tile>

                            {/* Cantidad */}
                            <Tile
                              icon={<Tags className="w-4 h-4" />}
                              label="Cantidad (Q)"
                            >
                              {op?.cantidad ?? 1}
                            </Tile>

                            {/* Tipo de venta */}
                            <Tile
                              icon={<Package className="w-4 h-4" />}
                              label="Tipo de venta"
                            >
                              {op?.tipoVentaNombre ||
                                op?.tipoVenta?.nombre ||
                                tipoVentaName ||
                                "—"}
                            </Tile>

                            {/* Producto */}
                            <Tile
                              icon={<Package className="w-4 h-4" />}
                              label="Producto"
                            >
                              {op?.productoNombre ||
                                op?.producto?.nombre ||
                                productoName ||
                                "—"}
                            </Tile>
                          </div>
                        </div>
                      ) : (
                        /* ------- EDICIÓN (mismo contenedor visual) ------- */
                        <div className="rounded-xl border border-gray-900 p-4 bg-white">
                          {loadingLists ? (
                            <div className="text-xs text-gray-500">
                              Cargando listas…
                            </div>
                          ) : (
                            <>
                              <FieldGrid cols={2}>
                                <TextField
                                  label="Monto (S/.)"
                                  type="number"
                                  value={monto}
                                  onChange={(v) => setMonto(Number(v) || 0)}
                                />
                                <TextField
                                  label="Cantidad (Q)"
                                  type="number"
                                  value={cantidad}
                                  onChange={(v) => setCantidad(Number(v) || 1)}
                                />

                                {/* Tipo de venta */}
                                <div>
                                  <Label>Tipo de venta</Label>
                                  <select
                                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                    value={tipoVentaId}
                                    onChange={(e) => {
                                      const id = e.target.value;
                                      const found = tiposVentaOpts.find(
                                        (t) => String(t._id) === String(id)
                                      );
                                      setTipoVentaId(id);
                                      setTipoVentaName(found?.nombre || "");
                                      setProductoId("");
                                      setProductoName("");
                                    }}
                                  >
                                    <option value="">Selecciona…</option>
                                    {tiposVentaOpts.map((t) => (
                                      <option key={t._id} value={t._id}>
                                        {t.nombre}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Producto */}
                                <div>
                                  <Label>Producto</Label>
                                  <select
                                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-100 disabled:text-gray-500"
                                    value={productoId}
                                    onChange={(e) => {
                                      const id = e.target.value;
                                      const found = productosFiltrados.find(
                                        (p) => String(p._id) === String(id)
                                      );
                                      setProductoId(id);
                                      setProductoName(found?.nombre || "");
                                    }}
                                    disabled={!tipoVentaId}
                                  >
                                    {!tipoVentaId && (
                                      <option value="">
                                        Primero elige tipo…
                                      </option>
                                    )}
                                    {tipoVentaId &&
                                      productosFiltrados.length === 0 && (
                                        <option value="">
                                          No hay productos para este tipo
                                        </option>
                                      )}
                                    {tipoVentaId &&
                                      productosFiltrados.map((p) => (
                                        <option key={p._id} value={p._id}>
                                          {p.nombre}
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              </FieldGrid>

                              <div className="flex justify-end gap-2 pt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditTip(false);
                                    // reset a los valores actuales
                                    setMonto(Number(op?.monto || 0));
                                    setCantidad(Number(op?.cantidad || 1));
                                    setTipoVentaId(
                                      op?.tipoVentaId ||
                                        op?.tipoVenta?._id ||
                                        ""
                                    );
                                    setTipoVentaName(
                                      op?.tipoVentaNombre ||
                                        op?.tipoVenta?.nombre ||
                                        ""
                                    );
                                    setProductoId(
                                      op?.productoId || op?.producto?._id || ""
                                    );
                                    setProductoName(
                                      op?.productoNombre ||
                                        op?.producto?.nombre ||
                                        ""
                                    );
                                  }}
                                  className="h-9 px-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={saveTipificacion}
                                  disabled={savingTip}
                                  className="h-9 px-3 rounded-lg bg-gray-900 text-white hover:bg-black/90 text-xs disabled:opacity-60"
                                >
                                  {savingTip ? "Guardando..." : "Guardar"}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </Section>

                    {/* Contacto */}
                    <Section title="Datos Salesforce" badgeColor="emerald">
                      {loadingSF ? (
                        <div className="text-xs text-gray-500">Cargando…</div>
                      ) : !sf ? (
                        <div className="text-gray-600">
                          Sin registros Salesforce para este RUC.
                        </div>
                      ) : (
                        <div className="rounded-xl border border-gray-900 p-4 bg-white">
                          <div className="grid gap-4 sm:grid-cols-3">
                            <Tile
                              icon={<UserRound className="w-4 h-4" />}
                              label="Consultor"
                            >
                              <span className="text-xs">
                                {sf.primaryConsultant || "—"}
                              </span>
                            </Tile>

                            <Tile
                              icon={<Tags className="w-4 h-4" />}
                              label="Tipo"
                            >
                              <span className="text-xs">
                                {(sf.type || "—")?.toString().toUpperCase()}
                              </span>
                            </Tile>

                            <Tile
                              icon={<BriefcaseBusiness className="w-4 h-4" />}
                              label="Segmento"
                            >
                              <span className="text-xs">
                                {(sf.segment || "—")?.toString().toUpperCase()}
                              </span>
                            </Tile>

                            <Tile
                              icon={<Calendar className="w-4 h-4" />}
                              label="Asignado"
                            >
                              <span className="text-xs">
                                {sf.lastAssignmentDate
                                  ? (() => {
                                      const d = new Date(sf.lastAssignmentDate);
                                      const dd = String(d.getDate()).padStart(
                                        2,
                                        "0"
                                      );
                                      const mm = String(
                                        d.getMonth() + 1
                                      ).padStart(2, "0");
                                      const yy = d.getFullYear();
                                      return `${dd}-${mm}-${yy}`;
                                    })()
                                  : "—"}
                              </span>
                            </Tile>

                            <Tile
                              icon={<Calendar className="w-4 h-4" />}
                              label="Desasignación"
                              className="sm:col-span-2"
                            >
                              <span className="text-xs">
                                {sf.nextDeassignmentDate
                                  ? (() => {
                                      const d = new Date(
                                        sf.nextDeassignmentDate
                                      );
                                      const dd = String(d.getDate()).padStart(
                                        2,
                                        "0"
                                      );
                                      const mm = String(
                                        d.getMonth() + 1
                                      ).padStart(2, "0");
                                      const yy = d.getFullYear();
                                      return `${dd}-${mm}-${yy}`;
                                    })()
                                  : "—"}
                              </span>
                            </Tile>
                          </div>
                        </div>
                      )}
                    </Section>
                  </div>

                  {/* Columna derecha */}
                  <div className="space-y-6">
                    <Section
                      title="Contacto"
                      badgeColor="indigo"
                      action={
                        <button
                          type="button"
                          onClick={() => {
                            if (!editContact) setContact(contactFromOp(op));
                            setEditContact((v) => !v);
                          }}
                          className="h-9 px-3 rounded-lg border border-gray-900 text-gray-800 hover:bg-gray-50 text-xs inline-flex items-center gap-2"
                          title={editContact ? "Cancelar" : "Editar contacto"}
                        >
                          <Pencil className="h-4 w-4" />
                          {editContact ? "Cancelar" : "Editar"}
                        </button>
                      }
                    >
                      {!editContact ? (
                        <div className="rounded-xl border border-gray-900 p-4 bg-white">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Tile
                              icon={<UserRound className="w-4 h-4" />}
                              label="Nombre"
                            >
                              {contactResolved?.nombre || "—"}
                            </Tile>

                            <Tile
                              icon={<Phone className="w-4 h-4" />}
                              label="Celular"
                            >
                              {celularShow ? (
                                <a
                                  href={`tel:${celularShow}`}
                                  className="underline underline-offset-2"
                                >
                                  {celularShow}
                                </a>
                              ) : (
                                "—"
                              )}
                            </Tile>

                            <Tile
                              icon={<Mail className="w-4 h-4" />}
                              label="Correo"
                            >
                              {correoShow ? (
                                <a
                                  href={`mailto:${correoShow}`}
                                  className=" underline-offset-2"
                                >
                                  {correoShow}
                                </a>
                              ) : (
                                "—"
                              )}
                            </Tile>

                            <Tile
                              icon={<BriefcaseBusiness className="w-4 h-4" />}
                              label="Cargo"
                            >
                              {contactResolved?.cargo || "—"}
                            </Tile>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-gray-900 p-4 bg-white">
                          <FieldGrid cols={2}>
                            <TextField
                              label="Nombre"
                              value={contact.nombre}
                              onChange={(v) =>
                                setContact({ ...contact, nombre: v })
                              }
                            />
                            <TextField
                              label="Celular"
                              value={contact.celular}
                              onChange={(v) =>
                                setContact({ ...contact, celular: v })
                              }
                            />
                            <TextField
                              label="Correo"
                              type="email"
                              value={contact.correo}
                              onChange={(v) =>
                                setContact({ ...contact, correo: v })
                              }
                            />
                            <TextField
                              label="Cargo"
                              value={contact.cargo}
                              onChange={(v) =>
                                setContact({ ...contact, cargo: v })
                              }
                            />
                          </FieldGrid>

                          <div className="pt-3 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditContact(false);
                                setContact(contactFromOp(op)); // reset
                              }}
                              className="h-9 px-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={saveContact}
                              disabled={savingContact}
                              className="h-9 px-3 rounded-lg bg-gray-800 text-white text-xs shadow hover:shadow-md disabled:opacity-60"
                            >
                              {savingContact
                                ? "Guardando..."
                                : "Guardar contacto"}
                            </button>
                          </div>
                        </div>
                      )}
                    </Section>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AgendaCitaModal
        open={openAgenda}
        onClose={() => setOpenAgenda(false)}
        defaultData={{
          ruc: op?.ruc,
          razonSocial: op?.razonSocial || op?.base?.razonSocial,
          opportunityId: op?._id,
          titulo: `Cita con ${(
            op?.razonSocial ||
            op?.base?.razonSocial ||
            op?.ruc ||
            ""
          ).trim()}`,
        }}
        onCreated={() => {}}
      />
    </div>
  );
}

/* ---------- Auxiliares UI + Utilidades ---------- */

function Section({ title, badgeColor = "gray", action, children }) {
  const badgeMap = {
    indigo: "text-indigo-700 bg-indigo-50",
    emerald: "text-emerald-700 bg-emerald-50",
    gray: "text-gray-700 bg-gray-200",
    white: "text-gray-900 bg-white border border-gray-900",
  };
  const badgeCls = badgeMap[badgeColor] || badgeMap.gray;

  return (
    <div className="rounded-xl border border-gray-900 bg-white p-4">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div
          className={`text-[11px] uppercase font-bold px-2.5 py-2 rounded ${badgeCls}`}
        >
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function FieldGrid({ cols = 2, children }) {
  const cls =
    cols === 1
      ? "grid grid-cols-1 gap-3"
      : "grid grid-cols-1 sm:grid-cols-2 gap-4";
  return <div className={cls}>{children}</div>;
}

function Label({ children }) {
  return <div className="text-[11px] uppercase text-gray-500">{children}</div>;
}

function TextField({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// Tile reutilizable con icono
function Tile({ icon, label, children, className = "" }) {
  return (
    <div
      className={
        "rounded-xl border border-gray-200 px-4 py-5 text-center min-h-[84px] flex flex-col justify-center " +
        className
      }
    >
      <div className="text-[11px] uppercase tracking-wide text-slate-900 font-semibold flex items-center justify-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-sm font-bold text-slate-900 break-words">
        {children}
      </div>
    </div>
  );
}
