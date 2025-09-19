// src/components/RucCard.jsx
import React, { useMemo, useState, useEffect } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

/* ───── UI helpers ───────────────────────────────────────────────────────── */

const Badge = ({ children }) => (
  <span className="inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded border border-gray-300 text-gray-700">
    {children}
  </span>
);

const Field = ({ label, children }) => (
  <div>
    <div className="text-[10px] uppercase text-gray-500">{label}</div>
    <div className="text-sm font-medium text-gray-900 break-words">
      {children ?? "—"}
    </div>
  </div>
);

const ESTADO_IDENTIFICADA = "68b859269d14cf7b7e510848";

const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const OBJETIVO_TIP = norm("CONTACTO EXITOSO");
const OBJETIVO_SUB = norm("CLIENTE INTERESADO");

const Modal = ({ open, onClose, title, children, maxWidth = "max-w-5xl" }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className={`w-full ${maxWidth} rounded-2xl bg-white shadow-2xl border border-gray-200`}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold uppercase text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Cerrar"
          >
            Cerrar
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("es-PE", { year: "numeric", month: "short", day: "2-digit" }) : "—";
const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" }) : "—";

/* Para contactos: auto-link si es correo o teléfono */
const renderLinkIfContact = (value) => {
  const v = String(value || "").trim();
  if (!v) return "—";
  if (/\S+@\S+\.\S+/.test(v)) return <a className="underline underline-offset-2" href={`mailto:${v}`}>{v}</a>;
  const phone = v.replace(/\s/g, "");
  if (/^\+?\d{5,}$/.test(phone)) return <a className="underline underline-offset-2" href={`tel:${phone}`}>{v}</a>;
  return v;
};

/* ───── Card principal ───────────────────────────────────────────────────── */

export default function RucCard({ item, onTipificar }) {
  const { token } = useAuth();
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  // Datos del card
  const {
    _id: baseId,
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

  // Modales
  const [openC, setOpenC] = useState(false);
  const [openU, setOpenU] = useState(false);
  const [openSF, setOpenSF] = useState(false);

  // Data y loaders
  const [loadingC, setLoadingC] = useState(false);
  const [loadingU, setLoadingU] = useState(false);
  const [loadingSF, setLoadingSF] = useState(false);

  const [contacts, setContacts] = useState(null);
  const [unidades, setUnidades] = useState(null);
  const [sfData, setSfData] = useState(null);

  // Cargar Contactos
  const openContacts = async () => {
    if (!openC && contacts == null && baseId) {
      setLoadingC(true);
      try {
        const { data } = await api.get(`/contactos-empresas/by-base/${baseId}`, authHeader);
        setContacts(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("contactos", e);
        setContacts([]);
      } finally {
        setLoadingC(false);
      }
    }
    setOpenC(true);
  };

  // Cargar Unidades
  const openUnidades = async () => {
    if (!openU && unidades == null && baseId) {
      setLoadingU(true);
      try {
        const { data } = await api.get(`/unidades-servicios/by-base/${baseId}`, authHeader);
        setUnidades(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("unidades", e);
        setUnidades([]);
      } finally {
        setLoadingU(false);
      }
    }
    setOpenU(true);
  };

  // Cargar Salesforce
  const openSalesforce = async () => {
    if (!openSF && sfData == null && baseId) {
      setLoadingSF(true);
      try {
        const { data } = await api.get(`/data-salesforce/by-base/${baseId}`, authHeader);
        setSfData(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("datasalesforce", e);
        setSfData([]);
      } finally {
        setLoadingSF(false);
      }
    }
    setOpenSF(true);
  };

  const assignedFmt = fmtDateTime(assignedAt);

  // Ordenación
  const unidadesSorted = useMemo(() => {
    if (!Array.isArray(unidades)) return [];
    return [...unidades].sort((a, b) => {
      const da = a?.lastDate ? new Date(a.lastDate).getTime() : 0;
      const db = b?.lastDate ? new Date(b.lastDate).getTime() : 0;
      return db - da;
    });
  }, [unidades]);

  const sfSorted = useMemo(() => {
    if (!Array.isArray(sfData)) return [];
    const getT = (x) =>
      x?.lastAssignmentDate
        ? new Date(x.lastAssignmentDate).getTime()
        : x?.updatedAt
        ? new Date(x.updatedAt).getTime()
        : x?.createdAt
        ? new Date(x.createdAt).getTime()
        : 0;
    return [...sfData].sort((a, b) => getT(b) - getT(a));
  }, [sfData]);

  // --- Tipificación ---
  const [openT, setOpenT] = useState(false);
  const [tipLoading, setTipLoading] = useState(false);
  const [tips, setTips] = useState(null);
  const [subs, setSubs] = useState([]);
  const [tipId, setTipId] = useState("");
  const [subId, setSubId] = useState("");
  const [tipNote, setTipNote] = useState("");
  const [savingTip, setSavingTip] = useState(false);
  const [marking, ] = useState(false);

  // --- Mini-form en el modal (Cliente interesado)
  const [tContacts, setTContacts] = useState([]);
  const [tLoadContacts, setTLoadContacts] = useState(false);
  const [contactTypes, setContactTypes] = useState([]);
  const [contactChoice, setContactChoice] = useState("existing"); // existing | new
  const [contactId, setContactId] = useState("");
  const [newContact, setNewContact] = useState({
    referenceName: "",
    position: "",
    contactDescription: "",
    contactType: "",
  });
  const [tipMonto, setTipMonto] = useState("");

  const openTipificar = async () => {
    if (!openT && tips == null) {
      setTipLoading(true);
      try {
        const { data } = await api.get(`/tipificaciones/tipostipificaciones`, authHeader);
        setTips(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("tipificaciones", e);
        setTips([]);
      } finally {
        setTipLoading(false);
      }
    }
    setOpenT(true);
  };

  const onChangeTip = async (e) => {
    const id = e.target.value;
    setTipId(id);
    setSubId("");
    setSubs([]);
    if (id) {
      try {
        const { data } = await api.get(`/tipificaciones/subtipificaciones/by-tipificacion/${id}`, authHeader);
        setSubs(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("subtipificaciones", e);
        setSubs([]);
      }
    }
  };

  const completeAndRemove = async () => {
    if (!ruc) return;
    if (typeof onTipificar === "function") {
      await onTipificar(ruc);
    }
  };

  // Selecciones actuales de tipificación
  const tipSel = (tips || []).find((t) => t._id === tipId);
  const subSel = (subs || []).find((s) => s._id === subId);
  const isClienteInteresado =
    norm(tipSel?.categorytip) === OBJETIVO_TIP &&
    norm(subSel?.name) === OBJETIVO_SUB;

const [tiposVenta, setTiposVenta] = useState([]);
 const [productos, setProductos] = useState([]);
 const [tipoVentaId, setTipoVentaId] = useState("");
 const [productoId, setProductoId] = useState("");
 const [cantidad, setCantidad] = useState(1);

  // Carga contactos + tipos cuando es cliente interesado
  useEffect(() => {
    const load = async () => {
      if (!isClienteInteresado || !baseId) return;
      try {
        setTLoadContacts(true);
        const resC = await api.get(`/contactos-empresas/by-base/${baseId}`, authHeader);
        setTContacts(Array.isArray(resC.data) ? resC.data : []);

        const resTipos = await api.get("/tiposventas", authHeader);
     const tv = Array.isArray(resTipos.data) ? resTipos.data : [];
    setTiposVenta(tv);
    setTipoVentaId(tv[0]?._id || "");

    // productos (todos) y filtrado por tipo seleccionado
     const resProd = await api.get("/productos", authHeader);
    const prods = Array.isArray(resProd.data) ? resProd.data : [];
     setProductos(prods);
    // preselección
     const firstForType = prods.find(p => String(p.tipoVentaId) === String(tv[0]?._id));
     setProductoId(firstForType?._id || "");

        const resT = await api.get("/contact-types", authHeader);
        const types = Array.isArray(resT.data) ? resT.data : [];
        setContactTypes(types);
        setNewContact((c) => ({ ...c, contactType: types[0]?._id || "" }));
        if ((resC.data || []).length) setContactId(resC.data[0]._id);
      } catch (e) {
        console.error(e);
        setTContacts([]);
        setContactTypes([]);
        setTiposVenta([]); setProductos([]);
      } finally {
        setTLoadContacts(false);
      }
    };
    load();

    if (!isClienteInteresado) {
      setContactChoice("existing");
      setContactId("");
      setNewContact({ referenceName: "", position: "", contactDescription: "", contactType: "" });
      setTipMonto("");
      setCantidad(1); setTipoVentaId(""); setProductoId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClienteInteresado, baseId]);

  const saveTipificacion = async () => {
    if (!tipId || !subId || !baseId) return;
    setSavingTip(true);
    try {
      // 1) Guardar tipificación
      await api.post(
        `/assignments/tipificar-latest`,
        { rucId: baseId, tipificationId: tipId, subtipificationId: subId, note: tipNote },
        authHeader
      );

      const tipName = norm(tipSel?.categorytip);
      const subName = norm(subSel?.name);

      // 2) Si NO es cliente interesado → cerrar y quitar card
      if (!(tipName === OBJETIVO_TIP && subName === OBJETIVO_SUB)) {
        await completeAndRemove();
        setOpenT(false);
        setTipId("");
        setSubId("");
        setTipNote("");
        return;
      }

      // 3) Sí es cliente interesado → crear/usar contacto + crear oportunidad
      let finalContactId = contactId;

      if (contactChoice === "new") {
        if (!newContact.referenceName || !newContact.contactType) {
          alert("Completa el nombre y el tipo de contacto.");
          setSavingTip(false);
          return;
        }
        const resNew = await api.post("/contactos-empresas", { ruc: String(ruc), ...newContact }, authHeader);
        finalContactId = resNew.data?.item?._id || resNew.data?._id;
        if (!finalContactId) throw new Error("No se pudo crear el contacto");
      } else {
        if (!finalContactId) {
          alert("Selecciona un contacto existente o crea uno nuevo.");
          setSavingTip(false);
          return;
        }
      }

      const montoNum = Number(String(tipMonto).replace(/[^\d.]/g, "")) || 0;

      await api.post(
        "/oportunidades",
{ruc: String(ruc),
   contactId: finalContactId,
   monto: montoNum,
   cantidad: Number(cantidad) || 1,
   tipoVentaId: tipoVentaId || undefined,
   productoId: productoId || undefined,
   estadoId: ESTADO_IDENTIFICADA,
 },        authHeader
      );

      await completeAndRemove();
      setOpenT(false);
      setTipId("");
      setSubId("");
      setTipNote("");
    } catch (e) {
      console.error("tipificar", e);
      alert("No se pudo completar el proceso.");
    } finally {
      setSavingTip(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="text-xs text-gray-500">RUC</div>
          <div className="text-base font-bold text-gray-900 truncate">{ruc}</div>
          <div className="text-sm font-semibold text-gray-800 truncate">{razonSocial || "—"}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sunatState && <Badge>SUNAT: {sunatState}</Badge>}
          {sunatCondition && <Badge>{sunatCondition}</Badge>}
          <Badge>Asignado: {assignedFmt}</Badge>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Dirección">{direccion || "—"}</Field>
        <Field label="Ubicación">
          {[sunatDepartment, sunatProvince, sunatDistrict].filter(Boolean).join(" / ") || "—"}
        </Field>

        <div className="sm:col-span-2">
          <div className="text-[10px] uppercase text-gray-500 mb-1">Líneas por operador</div>
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: "Movistar", val: movistarLines ?? 0 },
              { label: "Claro", val: claroLines ?? 0 },
              { label: "Entel", val: entelLines ?? 0 },
              { label: "Otros", val: otherLines ?? 0 },
              { label: "Sin contar", val: uncountedLines ?? 0 },
            ].map((x) => (
              <div key={x.label} className="rounded-lg border border-gray-200 p-2 text-center">
                <div className="text-[10px] text-gray-500">{x.label}</div>
                <div className="text-sm font-bold">{x.val}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2">
          <div className="rounded-lg border border-gray-200 p-3 flex items-center justify-between">
            <div className="text-[10px] uppercase text-gray-500">Total líneas</div>
            <div className="text-lg font-extrabold text-gray-900">{totalLines ?? 0}</div>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={openContacts} className="px-3 py-1.5 text-xs rounded-md bg-gray-900 text-white hover:bg-black">
          Contactos
        </button>
        <button
          onClick={openUnidades}
          className="px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Unidades y servicios
        </button>
        <button
          onClick={openSalesforce}
          className="px-3 py-1.5 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
        >
          Datos Salesforce
        </button>
        <button onClick={openTipificar} className="px-3 py-1.5 text-xs rounded-md bg-teal-600 text-white hover:bg-teal-700">
          Tipificar
        </button>
      </div>

      {/* ===== Modales ===== */}

      {/* Contactos */}
      <Modal open={openC} onClose={() => setOpenC(false)} title="Contactos de la empresa">
        {loadingC && <div className="text-xs text-gray-500">Cargando…</div>}

        {!loadingC && (!contacts || !contacts.length) && (
          <div className="text-sm text-gray-600">No hay contactos registrados.</div>
        )}

        {!loadingC && contacts && contacts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {contacts.map((c) => (
              <div key={c._id} className="rounded-xl border border-gray-200 p-3 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-gray-800 truncate">
                    {c.referenceName || "Sin nombre"}
                    {c.position && <span className="text-gray-500"> • {c.position}</span>}
                  </div>
                  {c.contactType?.nametypecontact && <Badge>{c.contactType.nametypecontact}</Badge>}
                </div>
                <div className="text-sm text-gray-700">
                  <div className="mb-1">
                    <span className="text-gray-500">Contacto: </span>
                    {renderLinkIfContact(c.contactDescription)}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-2">Actualizado: {fmtDateTime(c.updatedAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Unidades */}
      <Modal open={openU} onClose={() => setOpenU(false)} title="Unidades y servicios" maxWidth="max-w-6xl">
        {loadingU && <div className="text-xs text-gray-500">Cargando…</div>}

        {!loadingU && (!unidadesSorted || !unidadesSorted.length) && (
          <div className="text-sm text-gray-600">No hay unidades registradas.</div>
        )}

        {!loadingU && unidadesSorted && unidadesSorted.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="text-left text-[11px] uppercase text-gray-500">
                  <th className="px-3 py-2 border-b">Línea</th>
                  <th className="px-3 py-2 border-b">Estado</th>
                  <th className="px-3 py-2 border-b">Equipo</th>
                  <th className="px-3 py-2 border-b">Plan</th>
                  <th className="px-3 py-2 border-b">Contrato</th>
                  <th className="px-3 py-2 border-b">Estado desde</th>
                  <th className="px-3 py-2 border-b">Última fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {unidadesSorted.map((u) => (
                  <tr key={u._id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">{u.phoneNumber || "—"}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded-full border border-gray-300 px-2 py-0.5 text-[10px] uppercase text-gray-700">
                        {u.status || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-800">{u.equipmentType || "—"}</td>
                    <td className="px-3 py-2 text-gray-800">{u.plan || "—"}</td>
                    <td className="px-3 py-2 text-gray-700">{fmtDate(u.contractDate)}</td>
                    <td className="px-3 py-2 text-gray-700">{fmtDate(u.statusDate)}</td>
                    <td className="px-3 py-2 text-gray-700">{fmtDate(u.lastDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Salesforce */}
      <Modal open={openSF} onClose={() => setOpenSF(false)} title="Datos Salesforce">
        {loadingSF && <div className="text-xs text-gray-500">Cargando…</div>}

        {!loadingSF && (!sfSorted || !sfSorted.length) && (
          <div className="text-sm text-gray-600">No hay registros de Salesforce.</div>
        )}

        {!loadingSF && sfSorted && sfSorted.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sfSorted.map((s) => (
              <div key={s._id} className="rounded-xl border border-gray-200 p-3 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-gray-800 truncate">
                    {s.ruc?.razonSocial || razonSocial || "Registro Salesforce"}
                  </div>
                  {s.type && <Badge>{s.type}</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  {s.ruc?.ruc && <Field label="RUC base">{s.ruc.ruc}</Field>}
                  {s.segment && <Field label="Segmento">{s.segment}</Field>}
                  {s.primaryConsultant && <Field label="Consultor primario">{s.primaryConsultant}</Field>}
                  {s.lastAssignmentDate && <Field label="Asignado">{fmtDateTime(s.lastAssignmentDate)}</Field>}
                  {s.nextDeassignmentDate && (
                    <Field label="Desasignación">{fmtDateTime(s.nextDeassignmentDate)}</Field>
                  )}
                </div>

                <div className="mt-2 text-[11px] text-gray-500">Actualizado: {fmtDateTime(s.updatedAt)}</div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Tipificación */}
      <Modal open={openT} onClose={() => setOpenT(false)} title="Tipificación de contacto">
        {tipLoading ? (
          <div className="text-xs text-gray-500">Cargando tipificaciones…</div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase text-gray-500 mb-1">Tipificación</div>
                <select
                  className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                  value={tipId}
                  onChange={onChangeTip}
                >
                  <option value="">Seleccione…</option>
                  {(tips || []).map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.categorytip}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-[10px] uppercase text-gray-500 mb-1">Subtipificación</div>
                <select
                  className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                  value={subId}
                  onChange={(e) => setSubId(e.target.value)}
                  disabled={!tipId}
                >
                  <option value="">{tipId ? "Seleccione…" : "Seleccione tipificación primero"}</option>
                  {subs.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase text-gray-500 mb-1">Nota (opcional)</div>
              <textarea
                rows={3}
                className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                placeholder="Comentarios adicionales…"
                value={tipNote}
                onChange={(e) => setTipNote(e.target.value)}
              />
            </div>

            {/* Panel extra si es CLIENTE INTERESADO */}
            {isClienteInteresado && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                <div className="text-[11px] uppercase text-emerald-700 font-semibold mb-2">
                  Datos para crear la oportunidad
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Contacto */}
                  <div>
                    <div className="text-[10px] uppercase text-gray-600 mb-1">Contacto</div>

                    <div className="flex items-center gap-4 mb-2">
                      <label className="inline-flex items-center gap-1 text-sm">
                        <input
                          type="radio"
                          className="accent-emerald-600"
                          checked={contactChoice === "existing"}
                          onChange={() => setContactChoice("existing")}
                        />
                        Usar existente
                      </label>
                      <label className="inline-flex items-center gap-1 text-sm">
                        <input
                          type="radio"
                          className="accent-emerald-600"
                          checked={contactChoice === "new"}
                          onChange={() => setContactChoice("new")}
                        />
                        Crear nuevo
                      </label>
                    </div>

                    {contactChoice === "existing" ? (
                      <select
                        className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                        value={contactId}
                        onChange={(e) => setContactId(e.target.value)}
                        disabled={tLoadContacts}
                      >
                        {!tContacts.length && <option value="">Sin contactos</option>}
                        {tContacts.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.referenceName} {c.position ? `• ${c.position}` : ""} —{" "}
                            {c.contactType?.nametypecontact || "—"}{" "}
                            {c.contactDescription ? `(${c.contactDescription})` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        <input
                          className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                          placeholder="Nombre"
                          value={newContact.referenceName}
                          onChange={(e) => setNewContact({ ...newContact, referenceName: e.target.value })}
                        />
                        <input
                          className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                          placeholder="Cargo (opcional)"
                          value={newContact.position}
                          onChange={(e) => setNewContact({ ...newContact, position: e.target.value })}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            className="rounded-md border border-gray-300 px-2 py-2 text-sm"
                            value={newContact.contactType}
                            onChange={(e) => setNewContact({ ...newContact, contactType: e.target.value })}
                          >
                            {contactTypes.map((t) => (
                              <option key={t._id} value={t._id}>
                                {t.nametypecontact}
                              </option>
                            ))}
                          </select>
                          <input
                            className="rounded-md border border-gray-300 px-2 py-2 text-sm"
                            placeholder="Dato (teléfono/email)"
                            value={newContact.contactDescription}
                            onChange={(e) =>
                              setNewContact({ ...newContact, contactDescription: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Monto */}
                  <div>
                    <div className="text-[10px] uppercase text-gray-600 mb-1">Monto (S/)</div>
                    <input
                      className="w-40 rounded-md border border-gray-300 px-2 py-2 text-sm"
                      placeholder="0"
                      inputMode="numeric"
                      value={tipMonto}
                      onChange={(e) => setTipMonto(e.target.value)}
                    />

                     {/* Cantidad */}
<div>
   <div className="text-[10px] uppercase text-gray-600 mb-1">Cantidad</div>
   <input
     className="w-32 rounded-md border border-gray-300 px-2 py-2 text-sm"
     inputMode="numeric"
     value={cantidad}
     onChange={(e)=>setCantidad(Number(e.target.value) || 1)}
   />
 </div>
 {/* Tipo de venta */}
 <div>
   <div className="text-[10px] uppercase text-gray-600 mb-1">Tipo de venta</div>
   <select
     className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
     value={tipoVentaId}
     onChange={(e)=>{
       const v = e.target.value;
       setTipoVentaId(v);
       // ajustar preselección de producto al cambiar tipo
       const first = (productos || []).find(p => String(p.tipoVentaId) === String(v));
       setProductoId(first?._id || "");
     }}
   >
     {tiposVenta.map(t => (
       <option key={t._id} value={t._id}>{t.nombre || t.name}</option>
     ))}
   </select>
 </div>
 {/* Producto (filtrado por tipo de venta) */}
 <div>
   <div className="text-[10px] uppercase text-gray-600 mb-1">Producto</div>
   <select
     className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
    value={productoId}
     onChange={(e)=>setProductoId(e.target.value)}
   >
     {(productos || [])
       .filter(p => String(p.tipoVentaId) === String(tipoVentaId))
       .map(p => (
         <option key={p._id} value={p._id}>{p.nombre || p.name}</option>
       ))}
   </select>
 </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setOpenT(false)}
                className="px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={saveTipificacion}
                disabled={!tipId || !subId || savingTip || marking}
                className="px-3 py-1.5 text-xs rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {savingTip || marking ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
