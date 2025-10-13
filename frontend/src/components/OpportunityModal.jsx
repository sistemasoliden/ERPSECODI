// src/components/OpportunityModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import StagePath from "./StagePath.jsx";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import AgendaCitaModal from "./AgendaCitaModal.jsx";


export default function OpportunityModal({
  open,
  onClose,
  op,
  tipos = [],
  onChangeEstado,
  onUpdate,
}) {
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

  // Tipificación (edición completa)
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

  const [notas, setNotas] = useState(op?.notas || "");
  const [savingTip, setSavingTip] = useState(false);

  // listas para los selects (se cargan al entrar en edición)
  const [tiposVentaOpts, setTiposVentaOpts] = useState([]);
  const [productosOpts, setProductosOpts] = useState([]);
  const [loadingLists, setLoadingLists] = useState(false);

  // Data Salesforce (por RUC)
  const [sfItems, setSfItems] = useState([]);
  const [loadingSF, setLoadingSF] = useState(false);

  // ---------- DERIVADOS (cascada) ----------
  // Productos filtrados por el tipo seleccionado
  const productosFiltrados = useMemo(() => {
    if (!Array.isArray(productosOpts)) return [];
    if (!tipoVentaId) return [];
    return productosOpts.filter(
      (p) => String(p.tipoVentaId) === String(tipoVentaId)
    );
  }, [productosOpts, tipoVentaId]);

  // Si cambia el tipo y el producto actual ya no es válido, lo vaciamos
  useEffect(() => {
    if (!editTip) return; // sólo nos importa cuando estamos editando
    const sigueSiendoValido = productosFiltrados.some(
      (p) => String(p._id) === String(productoId)
    );
    if (!sigueSiendoValido) {
      setProductoId("");
      setProductoName("");
    }
  }, [tipoVentaId, productosFiltrados, productoId, editTip]);

  // --- Sync al cambiar op
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

    setNotas(op?.notas || "");

    setEditTip(false);
    setEditContact(false);
  }, [op]);

  // --- Cargar Data Salesforce
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

  // --- Resolver contacto (si no vino en la op)
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
          setContactResolved({ nombre: "", celular: "", cargo: "", correo: "" });
      } catch {
        if (alive)
          setContactResolved({ nombre: "", celular: "", cargo: "", correo: "" });
      }
    };

    loadContact();
    return () => {
      alive = false;
    };
  }, [open, op?.contactId, op?.ruc, authHeader]);

  // --- Cargar listas para los SELECTS
  useEffect(() => {
    const loadLists = async () => {
      if (!open || !editTip) return;
      setLoadingLists(true);
      try {
        const [tRes, pRes] = await Promise.all([
          api.get("/tiposventas", authHeader),  // colección: tiposventas
          api.get("/productos", authHeader),    // colección: productos
        ]);
        setTiposVentaOpts(Array.isArray(tRes?.data) ? tRes.data : []);
        setProductosOpts(Array.isArray(pRes?.data) ? pRes.data : []);
      } catch (e) {
        console.error("listas", e);
        setTiposVentaOpts([]);
        setProductosOpts([]);
      } finally {
        setLoadingLists(false);
      }
    };
    loadLists();
  }, [open, editTip, authHeader]);

  // Cerrar con ESC
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
      await onUpdate?.(op._id, { contacto: contact }); // PUT en el padre
      setEditContact(false);
      setContactResolved(contact);
    } finally {
      setSavingContact(false);
    }
  };

  // Guardar tipificación (manda id + nombre por si acaso)
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
        notas: (notas || "").trim(),
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

  // último registro Salesforce (el más reciente)
  const sf = sfItems?.[0];

  return (
    <div className="fixed inset-0 z-50">
      {/* Fondo */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />

      {/* Modal */}
      <div className="absolute inset-x-0 top-6 mx-auto w-[min(1100px,96%)]">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b bg-white">
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
                <span className={`text-sm font-bold ${estadoColor}`}>{estadoTxt}</span>
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
              <StagePath tipos={tipos} currentId={op.estadoId} onChange={handleChangeEtapa} />
            </div>

            {/* Última gestión */}
            <div className="mt-3 text-sm text-gray-700">
              <span className="text-gray-900">Fecha de gestión de oportunidad - </span>
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
          <div className="max-h-[72vh] overflow-y-auto">
            {/* Contenedor unificado */}
            <div className="px-5 py-5">
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {/* Cabecera del contenedor */}
                <div className="px-5 py-4 border-b bg-gray-50">
                  <div>
                  <h2 className="text-base font-semibold text-gray-900">Detalle de la oportunidad</h2>
                  <p className="text-xs text-gray-500">Tipificación, datos Salesforce y contacto</p>
                </div>
                  <button
                    type="button"
                    onClick={() => setOpenAgenda(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-white bg-gray-100 text-xs shadow-sm"
                    title="Agendar cita"
                  >
                    <CalendarIcon className="w-4 h-4" />
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
                      badgeColor="indigo"
                      action={
                        <button
                          type="button"
                          onClick={() => {
                            if (!editTip) {
                              // reset a valores actuales antes de abrir edición
                              setMonto(Number(op?.monto || 0));
                              setCantidad(Number(op?.cantidad || 1));
                              setTipoVentaId(op?.tipoVentaId || op?.tipoVenta?._id || "");
                              setTipoVentaName(op?.tipoVentaNombre || op?.tipoVenta?.nombre || "");
                              setProductoId(op?.productoId || op?.producto?._id || "");
                              setProductoName(op?.productoNombre || op?.producto?.nombre || "");
                              setNotas(op?.notas || "");
                            }
                            setEditTip((v) => !v);
                          }}
                          className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-xs"
                          title={editTip ? "Cancelar" : "Editar"}
                        >
                          {editTip ? "Cancelar" : "Editar"}
                        </button>
                      }
                    >
                      {!editTip ? (
                        <FieldGrid cols={2}>
                          <Item label="Monto (S/.)" value={Number(op?.monto || 0).toLocaleString("es-PE")} />
                          <Item label="Cantidad (Q)" value={op?.cantidad ?? 1} />
                          <Item label="Tipo de venta" value={tipoVentaName || "—"} />
                          <Item label="Producto" value={productoName || "—"} />
                          {op?.notas ? (
                            <div className="col-span-2">
                              <Label>Notas</Label>
                              <div className="mt-0.5 text-gray-800 whitespace-pre-wrap">{op.notas}</div>
                            </div>
                          ) : null}
                        </FieldGrid>
                      ) : (
                        <>
                          {loadingLists ? (
                            <div className="text-xs text-gray-500">Cargando listas…</div>
                          ) : (
                            <FieldGrid cols={2}>
                              <TextField
                                label="Monto (S/.)"
                                type="number"
                                value={monto}
                                onChange={(v) => setMonto(v)}
                              />
                              <TextField
                                label="Cantidad (Q)"
                                type="number"
                                value={cantidad}
                                onChange={(v) => setCantidad(Number(v) || 1)}
                              />

                              {/* TIPO DE VENTA */}
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
                                    // al cambiar tipo, limpiamos producto
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

                              {/* PRODUCTO (dependiente de tipo) */}
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
                                  {!tipoVentaId && <option value="">Primero elige tipo…</option>}
                                  {tipoVentaId && productosFiltrados.length === 0 && (
                                    <option value="">No hay productos para este tipo</option>
                                  )}
                                  {tipoVentaId &&
                                    productosFiltrados.map((p) => (
                                      <option key={p._id} value={p._id}>
                                        {p.nombre}
                                      </option>
                                    ))}
                                </select>
                              </div>

                              <TextArea
                                label="Notas"
                                rows={3}
                                value={notas}
                                onChange={(v) => setNotas(v)}
                                className="col-span-2"
                              />
                            </FieldGrid>
                          )}
                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditTip(false);
                                // reset
                                setMonto(Number(op?.monto || 0));
                                setCantidad(Number(op?.cantidad || 1));
                                setTipoVentaId(op?.tipoVentaId || op?.tipoVenta?._id || "");
                                setTipoVentaName(op?.tipoVentaNombre || op?.tipoVenta?.nombre || "");
                                setProductoId(op?.productoId || op?.producto?._id || "");
                                setProductoName(op?.productoNombre || op?.producto?.nombre || "");
                                setNotas(op?.notas || "");
                              }}
                              className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-xs"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={saveTipificacion}
                              disabled={savingTip}
                              className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors text-xs disabled:opacity-60"
                            >
                              {savingTip ? "Guardando..." : "Guardar"}
                            </button>
                          </div>
                        </>
                      )}
                    </Section>

                    {/* Salesforce */}
                    <Section title="Datos Salesforce" badgeColor="emerald">
                      {loadingSF ? (
                        <div className="text-xs text-gray-500">Cargando…</div>
                      ) : !sf ? (
                        <div className="text-gray-600">Sin registros Salesforce para este RUC.</div>
                      ) : (
                        <FieldGrid cols={2}>
                          {sf.primaryConsultant && <Item label="Consultor" value={sf.primaryConsultant} />}
                          {sf.type && <Item label="Tipo" value={sf.type} />}
                          {sf.lastAssignmentDate && <Item label="Asignado" value={fmt(sf.lastAssignmentDate)} />}
                          {sf.segment && <Item label="Segmento" value={sf.segment} />}
                          {sf.nextDeassignmentDate && (
                            <Item label="Desasignación" value={fmt(sf.nextDeassignmentDate)} />
                          )}
                          <div className="col-span-2">
                            <span className="text-[11px] text-gray-500">Actualizado: {fmt(sf.updatedAt)}</span>
                          </div>
                        </FieldGrid>
                      )}
                    </Section>
                  </div>

                  {/* Columna derecha: Contacto */}
                  <div className="space-y-6">
                    <Section
                      title="Contacto"
                      badgeColor="gray"
                      action={
                        <button
                          type="button"
                          onClick={() => {
                            if (!editContact) setContact(contactFromOp(op));
                            setEditContact((v) => !v);
                          }}
                          className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-xs"
                          title={editContact ? "Cancelar" : "Editar contacto"}
                        >
                          {editContact ? "Cancelar" : "Editar"}
                        </button>
                      }
                    >
                      {!editContact ? (
                        <FieldGrid cols={2}>
                          <Item label="Nombre" value={contactResolved?.nombre || "—"} />
                          <Item label="Celular" value={contactResolved?.celular || "—"} />
                          <Item label="Cargo" value={contactResolved?.cargo || "—"} />
                          <Item label="Correo" value={contactResolved?.correo || "—"} />
                        </FieldGrid>
                      ) : (
                        <>
                          <FieldGrid cols={2}>
                            <TextField
                              label="Nombre"
                              value={contact.nombre}
                              onChange={(v) => setContact({ ...contact, nombre: v })}
                            />
                            <TextField
                              label="Celular"
                              value={contact.celular}
                              onChange={(v) => setContact({ ...contact, celular: v })}
                            />
                            <TextField
                              label="Cargo"
                              value={contact.cargo}
                              onChange={(v) => setContact({ ...contact, cargo: v })}
                            />
                            <TextField
                              label="Correo"
                              type="email"
                              value={contact.correo}
                              onChange={(v) => setContact({ ...contact, correo: v })}
                            />
                          </FieldGrid>
                          <div className="pt-2 flex justify-end">
                            <button
                              onClick={saveContact}
                              disabled={savingContact}
                              className="px-3 py-2 rounded-lg bg-gray-800 text-white text-xs shadow hover:shadow-md disabled:opacity-60"
                            >
                              {savingContact ? "Guardando..." : "Guardar contacto"}
                            </button>
                          </div>
                        </>
                      )}
                    </Section>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer interno */}
            <div className="px-5 pb-5 pt-3 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                Cerrar
              </button>
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
          titulo: `Cita con ${op?.razonSocial || op?.base?.razonSocial || op?.ruc || ""}`.trim(),
        }}
        // refrescar datos SF/contacto si quieres luego
        onCreated={() => {
          // noop por ahora
        }}
      />

    </div>
  );
}

/* ---------- Auxiliares UI + Utilidades ---------- */

function CalendarIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="1.5"/>
      <line x1="16" y1="2.5" x2="16" y2="6" strokeWidth="1.5"/>
      <line x1="8" y1="2.5" x2="8" y2="6" strokeWidth="1.5"/>
      <line x1="3" y1="10" x2="21" y2="10" strokeWidth="1.5"/>
    </svg>
  );
}

function Section({ title, badgeColor = "gray", action, children }) {
  const badgeMap = {
    indigo: "text-indigo-700 bg-indigo-50",
    emerald: "text-emerald-700 bg-emerald-50",
    gray: "text-gray-700 bg-gray-50",
  };
  const badgeCls = badgeMap[badgeColor] || badgeMap.gray;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={`text-[11px] uppercase font-semibold px-2.5 py-1 rounded-full ${badgeCls}`}>
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function FieldGrid({ cols = 2, children }) {
  const cls = cols === 1 ? "grid grid-cols-1 gap-3" : "grid grid-cols-1 sm:grid-cols-2 gap-4";
  return <div className={cls}>{children}</div>;
}

function Label({ children }) {
  return <div className="text-[11px] uppercase text-gray-500">{children}</div>;
}

function Item({ label, value }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-0.5 font-semibold text-gray-900">{value ?? "—"}</div>
    </div>
  );
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

function TextArea({ label, value, onChange, rows = 3, className = "" }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <textarea
        rows={rows}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function fmt(d) {
  return d
    ? new Date(d).toLocaleString("es-PE", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
}
