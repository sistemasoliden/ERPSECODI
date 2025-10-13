// src/components/RucCard.jsx
import React, { useMemo, useState, useEffect } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Mustache from "mustache";
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


    // Convierte raw -> E164 (Perú por defecto)
const toE164 = (raw, defaultCountry = "51") => {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  // si ya viene con 51xxxxxxxxx
  if (digits.length >= 11 && digits.startsWith(defaultCountry)) return digits;
  // si viene como 9xxxxxxxx (9 dígitos móviles PE)
  if (digits.length === 9) return defaultCountry + digits;
  // fallback: devuelve lo que haya
  return digits;
};


const OBJETIVO_TIP = norm("CONTACTO EXITOSO");
const OBJETIVO_SUB = norm("CLIENTE INTERESADO");

const Modal = ({ open, onClose, title, children, maxWidth = "max-w-2xl" }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
      <div className={`w-full ${maxWidth} rounded-xl bg-white shadow-2xl `}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold uppercase text-gray-800">
            {title}
          </h3>
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
  d
    ? new Date(d).toLocaleDateString("es-PE", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      })
    : "—";
const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("es-PE", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

// Helpers (arriba del archivo, junto a norm / fmtDate / renderLinkIfContact)
const toCap = (str) =>
  String(str || "")
    .toLowerCase()
    // Capitaliza cada secuencia de letras (funciona con acentos y ñ)
    .replace(
      /\p{L}+/gu,
      (word) => word.charAt(0).toUpperCase() + word.slice(1)
    );

/* Para contactos: auto-link si es correo o teléfono */
const renderLinkIfContact = (value) => {
  const v = String(value || "").trim();
  if (!v) return "—";
  if (/\S+@\S+\.\S+/.test(v))
    return (
      <a className="underline underline-offset-2" href={`mailto:${v}`}>
        {v}
      </a>
    );
  const phone = v.replace(/\s/g, "");
  if (/^\+?\d{5,}$/.test(phone))
    return (
      <a className="underline underline-offset-2" href={`tel:${phone}`}>
        {v}
      </a>
    );
  return v;
};

function QuickEmailModal({ open, onClose, to, defaults }) {
  const [templates, setTemplates] = React.useState([]);
  const [tplId, setTplId] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [html, setHtml] = React.useState("");
  const [vars, setVars] = React.useState({});
  const [preview, setPreview] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  // carga plantillas (usa cookie de la sesión SMTP)
  React.useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/email-templates", { withCredentials: true });
        const items = Array.isArray(data?.items) ? data.items : [];
        setTemplates(items);
        if (items.length) setTplId(items[0]._id);
      } catch {
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  // cuando cambia plantilla, precarga asunto/cuerpo y variables
  React.useEffect(() => {
    const tpl = templates.find(t => t._id === tplId);
    if (!tpl) { setSubject(""); setHtml(""); setVars({}); setPreview(""); return; }
    setSubject(tpl.subject || "");
    setHtml(tpl.body || "");
    // detecta {{variables}} y precarga defaults (nombre, empresa, ejecutivo)
    const keys = [...new Set((tpl.body || "").match(/{{\s*([\w.]+)\s*}}/g)?.map(s => s.replace(/[{}]/g, "").trim()) || [])];
    const next = {};
    keys.forEach(k => { next[k] = (defaults && defaults[k]) || ""; });
    setVars(next);
  }, [tplId, templates, defaults]);

  // preview render
  React.useEffect(() => {
    try { setPreview(Mustache.render(html || "", vars || {})); }
    catch { setPreview(""); }
  }, [html, vars]);

  const send = async () => {
    if (!to) return alert("Falta destinatario.");
    setSending(true);
    try {
      const rendered = Mustache.render(html || "", vars || {});
      await api.post("/send", { to, subject, html: rendered }, { withCredentials: true });
      onClose(true);
    } catch (e) {
      alert("No se pudo enviar el correo: " + (e?.response?.data?.message || e.message));
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="text-sm font-semibold">Enviar correo</div>
          <button className="text-sm px-2 py-1 rounded hover:bg-gray-100" onClick={() => onClose(false)}>Cerrar</button>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-xs text-slate-600">Para: <b>{to || "—"}</b></div>

          {loading ? (
            <div className="h-24 bg-gray-100 rounded animate-pulse" />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-[11px] font-semibold mb-1">Plantilla</div>
                  <select
                    className="w-full border rounded px-2 py-2 text-sm"
                    value={tplId}
                    onChange={e => setTplId(e.target.value)}
                  >
                    {templates.map(t => (
                      <option key={t._id} value={t._id}>
                        {t.isGlobal ? "🌐 " : ""}{t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-[11px] font-semibold mb-1">Asunto</div>
                  <input
                    className="w-full border rounded px-2 py-2 text-sm"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                  />
                </div>
              </div>

              {/* Variables detectadas */}
              {!!Object.keys(vars).length && (
                <div>
                  <div className="text-[11px] font-semibold mb-1">Variables</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.keys(vars).map(k => (
                      <div key={k} className="flex items-center gap-2">
                        <div className="w-32 text-right text-[11px] text-slate-600">{k}</div>
                        <input
                          className="flex-1 border rounded px-2 py-1 text-sm"
                          value={vars[k] || ""}
                          onChange={e => setVars(v => ({ ...v, [k]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] font-semibold mb-1">Cuerpo (HTML)</div>
                  <textarea
                    className="w-full border rounded p-2 text-sm h-40"
                    value={html}
                    onChange={e => setHtml(e.target.value)}
                  />
                </div>
                <div>
                  <div className="text-[11px] font-semibold mb-1">Previsualización</div>
                  <div className="border rounded p-2 text-sm h-40 overflow-auto bg-white"
                       dangerouslySetInnerHTML={{ __html: preview || "<i>—</i>" }} />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-3 border-t flex justify-end gap-2">
          <button className="px-3 py-2 text-sm border rounded" onClick={() => onClose(false)}>Cancelar</button>
          <button
            className="px-3 py-2 text-sm rounded bg-emerald-600 text-white disabled:opacity-50"
            disabled={sending || !to}
            onClick={send}
          >
            {sending ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}


function QuickWspModal({ open, onClose, phoneE164, authHeader }) {
  const [templates, setTemplates] = React.useState([]);
  const [template, setTemplate] = React.useState("");
  const [vars, setVars] = React.useState({});
  const [preview, setPreview] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  // cargar plantillas al abrir
  React.useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/wsp/templates", authHeader);
        const items = Array.isArray(data?.items) ? data.items : [];
        setTemplates(items);
        if (items.length) setTemplate(items[0].name);
      } catch (e) {
        console.error("wsp templates", e);
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  // re-render preview
  React.useEffect(() => {
    const tpl = templates.find((t) => t.name === template);
    if (!tpl) { setPreview(""); return; }
    try {
      setPreview(Mustache.render(tpl.body || "", vars));
    } catch { setPreview(""); }
  }, [template, vars, templates]);

  const tplBody = templates.find((t) => t.name === template)?.body || "";
  const varKeys = React.useMemo(
    () =>
      [...new Set((tplBody.match(/{{\s*([\w.]+)\s*}}/g) || [])
        .map((s) => s.replace(/[{}]/g, "").trim()))],
    [tplBody]
  );

 const send = async () => {
  if (!phoneE164 || !template) return;
  setSending(true);
  try {
    // 1) chequea estado y espera un poco si está initializing
    let st = (await api.get("/wsp/status", authHeader)).data?.status;
    const t0 = Date.now();
    while (st !== "ready" && Date.now() - t0 < 12000) {
      await new Promise(r => setTimeout(r, 800));
      st = (await api.get("/wsp/status", authHeader)).data?.status;
    }
    if (st !== "ready") {
      alert("La sesión de WhatsApp no está lista. Ve a WhatsApp > Conexión y asegúrate que esté ‘ready’.");
      return;
    }

    // 2) enviar
    await api.post("/wsp/send-template", { to: phoneE164, template, variables: vars }, authHeader);
    onClose(true);
  } catch (e) {
    console.error("wsp send", e);
    const msg = e?.response?.data?.error || e?.message || "Error";
    alert("No se pudo enviar el WhatsApp. Detalle: " + msg);
  } finally {
    setSending(false);
  }
};


  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="text-sm font-semibold">Enviar WhatsApp</div>
          <button className="text-sm px-2 py-1 rounded hover:bg-gray-100" onClick={() => onClose(false)}>Cerrar</button>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-xs text-slate-600">
            Destino: <b>{phoneE164}</b>
          </div>

          {loading ? (
            <div className="animate-pulse h-24 bg-gray-100 rounded" />
          ) : (
            <>
              <div>
                <div className="text-[11px] font-semibold mb-1">Plantilla</div>
                <select
                  className="w-full border rounded px-2 py-2 text-sm"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                >
                  {templates.map((t) => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
              </div>

              {varKeys.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold mb-1">
                    Variables
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {varKeys.map((k) => (
                      <div key={k} className="flex items-center gap-2">
                        <div className="w-32 text-right text-[11px] text-slate-600">{k}</div>
                        <input
                          className="flex-1 border rounded px-2 py-1 text-sm"
                          value={vars[k] || ""}
                          onChange={(e) =>
                            setVars((v) => ({ ...v, [k]: e.target.value }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] font-semibold mb-1">Cuerpo</div>
                  <pre className="text-xs bg-slate-50 border rounded p-2 whitespace-pre-wrap">{tplBody || "—"}</pre>
                </div>
                <div>
                  <div className="text-[11px] font-semibold mb-1">Previsualización</div>
                  <pre className="text-xs bg-slate-50 border rounded p-2 whitespace-pre-wrap">{preview || "—"}</pre>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-3 border-t flex justify-end gap-2">
          <button className="px-3 py-2 text-sm border rounded" onClick={() => onClose(false)}>
            Cancelar
          </button>
          <button
            className="px-3 py-2 text-sm rounded bg-emerald-600 text-white disabled:opacity-50"
            disabled={sending || !template}
            onClick={send}
          >
            {sending ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ───── Card principal ───────────────────────────────────────────────────── */

export default function RucCard({ item, onTipificar }) {
 const { token, user } = useAuth(); // <-- antes solo tomabas token
const authHeader = useMemo(
  () => ({ headers: { Authorization: `Bearer ${token}` } }),
  [token]
);
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
    sunatCondition,
    sunatState,
    sunatDepartment,
    sunatProvince,
    sunatDistrict,
  } = item || {};

  // Modales
  const [openC, setOpenC] = useState(false);
  const [openU, setOpenU] = useState(false);

  // Data y loaders
  const [loadingC, setLoadingC] = useState(false);
  const [loadingU, setLoadingU] = useState(false);
  const [loadingSF, setLoadingSF] = useState(false);

  const [contacts, setContacts] = useState(null);
  const [unidades, setUnidades] = useState(null);
  const [sfData, setSfData] = useState(null);
  // estado para envío rápido de WhatsApp
const [wspOpen, setWspOpen] = useState(false);
const [wspPhone, setWspPhone] = useState("");
const [mailOpen, setMailOpen] = useState(false);
const [mailTo, setMailTo] = useState("");

const openQuickMail = (addr) => {
  const v = String(addr || "").trim();
  if (!v || !/\S+@\S+\.\S+/.test(v)) return alert("Correo inválido.");
  setMailTo(v);
  setMailOpen(true);
};



const openQuickWsp = (rawPhone) => {
  const e164 = toE164(rawPhone);
  if (!e164) return alert("No se encontró un número válido.");
  setWspPhone(e164);
  setWspOpen(true);
};


  // Cargar Contactos
  const openContacts = async () => {
    if (!openC && contacts == null && baseId) {
      setLoadingC(true);
      try {
        const { data } = await api.get(
          `/contactos-empresas/by-base/${baseId}`,
          authHeader
        );
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
        const { data } = await api.get(
          `/unidades-servicios/by-base/${baseId}`,
          authHeader
        );
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

  const resetOpportunityFields = () => {
    setContactChoice("existing");
    setContactId(tContacts[0]?._id || "");
    setNewContact({
      referenceName: "",
      position: "SIN INFORMACION", // 👈 aquí
      contactDescription: "",
      contactType: contactTypes[0]?._id || "",
    });
    setTipMonto("");
    setCantidad(1);

    const firstTipo = tiposVenta[0]?._id || "";
    setTipoVentaId(firstTipo);
    const firstProd = (productos || []).find(
      (p) => String(p.tipoVentaId) === String(firstTipo)
    );
    setProductoId(firstProd?._id || "");
  };

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
  const [marking] = useState(false);

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
        const { data } = await api.get(
          `/tipificaciones/tipostipificaciones`,
          authHeader
        );
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
        const { data } = await api.get(
          `/tipificaciones/subtipificaciones/by-tipificacion/${id}`,
          authHeader
        );
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

  // Cargar Salesforce automáticamente (sin modal)
  useEffect(() => {
    const loadSF = async () => {
      if (!baseId || sfData !== null) return;
      setLoadingSF(true);
      try {
        const { data } = await api.get(
          `/data-salesforce/by-base/${baseId}`,
          authHeader
        );
        setSfData(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("datasalesforce", e);
        setSfData([]);
      } finally {
        setLoadingSF(false);
      }
    };
    loadSF();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseId]);

  // Carga contactos + tipos cuando es cliente interesado
  useEffect(() => {
    const load = async () => {
      if (!isClienteInteresado || !baseId) return;
      try {
        setTLoadContacts(true);
        const resC = await api.get(
          `/contactos-empresas/by-base/${baseId}`,
          authHeader
        );
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
        const firstForType = prods.find(
          (p) => String(p.tipoVentaId) === String(tv[0]?._id)
        );
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
        setTiposVenta([]);
        setProductos([]);
      } finally {
        setTLoadContacts(false);
      }
    };
    load();

    if (!isClienteInteresado) {
      setContactChoice("existing");
      setContactId("");
      setNewContact({
        referenceName: "",
        position: "",
        contactDescription: "",
        contactType: "",
      });
      setTipMonto("");
      setCantidad(1);
      setTipoVentaId("");
      setProductoId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClienteInteresado, baseId]);

  const saveTipificacion = async ({ addAnother = false } = {}) => {
    if (!tipId || !subId || !baseId) return;
    setSavingTip(true);
    try {
      // 1) Guardar tipificación
      await api.post(
        `/assignments/tipificar-latest`,
        {
          rucId: baseId,
          tipificationId: tipId,
          subtipificationId: subId,
          note: tipNote,
        },
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
        const resNew = await api.post(
          "/contactos-empresas",
          { ruc: String(ruc), ...newContact },
          authHeader
        );
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
        {
          ruc: String(ruc),
          contactId: finalContactId,
          monto: montoNum,
          cantidad: Number(cantidad) || 1,
          tipoVentaId: tipoVentaId || undefined,
          productoId: productoId || undefined,
          estadoId: ESTADO_IDENTIFICADA,
        },
        authHeader
      );

      if (addAnother) {
        // Mantener el modal abierto y la misma tipificación/subtipificación,
        // solo reiniciar los campos de la oportunidad para poder crear otra.
        resetOpportunityFields();
        return;
      }

      // Flujo original: finalizar y cerrar
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
      <div className="mb-3 grid grid-cols-[1fr_220px] items-start gap-4">
        {/* Izquierda: RUC + Razón social (una línea cada uno, sin wrap) */}
        <div className="min-w-0 text-center px-2">
          <div
            className="text-lg font-extrabold text-gray-900 truncate whitespace-nowrap"
            title={ruc}
          >
            {ruc}
          </div>
          <div
            className="text-sm font-bold text-gray-800 truncate whitespace-nowrap"
            title={razonSocial || "—"}
          >
            {razonSocial || "—"}
          </div>
        </div>

        {/* Derecha: Dirección + Ubicación (columna fija 220px) */}
        <div className="w-[220px] justify-self-start flex flex-col gap-2 -ml-[12px]">
          {" "}
          <div
            className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-[9px] uppercase tracking-wide text-gray-900 text-center truncate"
            title={direccion || "—"}
          >
            {direccion || "—"}
          </div>
          <div
            className="w-full px-2.5 py-1.5 rounded border border-gray-300 text-[9px] tracking-wide text-gray-900 text-center truncate"
            title={
              [sunatDepartment, sunatProvince, sunatDistrict]
                .filter(Boolean)
                .join(" / ") || "—"
            }
          >
            {[sunatDepartment, sunatProvince, sunatDistrict]
              .filter(Boolean)
              .join(" / ") || "—"}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className=" p-3">
        {/* SUNAT (cada pill 1.5rem de alto) */}
        <div className="flex gap-4 items-stretch">
          {/* Columna SUNAT (2 pills apilados) */}
          <div className="w-40 shrink-0 flex flex-col gap-2">
            <div className="h-7 px-2 rounded border border-gray-300 text-[9px] font-semibold uppercase tracking-wide text-gray-900 flex items-center justify-center">
              SUNAT: {sunatState || "—"}
            </div>
            <div className="h-7 px-2 rounded border border-gray-300 text-[10px] font-semibold uppercase tracking-wide text-gray-900 flex items-center justify-center">
              {sunatCondition || "—"}
            </div>
          </div>

          {/* Tarjetas de líneas (alto = suma de las 2 pills + gap) */}
          <div className="flex-1">
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Movistar", val: movistarLines ?? 0 },
                { label: "Claro", val: claroLines ?? 0 },
                { label: "Entel", val: entelLines ?? 0 },
                { label: "Otros", val: otherLines ?? 0 },
              ].map((x) => (
                <div
                  key={x.label}
                  className="h-16 px-2.5 rounded border border-gray-300 flex flex-col items-center justify-center text-center"
                >
                  <span className="text-[10px] uppercase font-extrabold tracking-wide text-gray-900">
                    {x.label}
                  </span>
                  <span className="text-xs font-semibold text-gray-900">
                    {x.val}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* --- SALESFORCE INLINE (compacto, 1 sola fila) --- */}
        <div className="mt-4">
          <div className="text-[11px] font-extrabold text-gray-700 mb-2 ml-1 uppercase tracking-wide">
            Datos Salesforce
          </div>

          {loadingSF && <div className="text-xs text-gray-500">Cargando…</div>}
          {!loadingSF && (!sfSorted || !sfSorted.length) && (
            <div className="text-sm text-gray-600">
              No hay registros de Salesforce.
            </div>
          )}

          {!loadingSF &&
            sfSorted &&
            sfSorted.length > 0 &&
            (() => {
              const s = sfSorted[0];
              return (
                <div className="grid grid-cols-[minmax(0,1fr)_176px] max-sm:grid-cols-1 gap-4 items-start">
                  {/* Panel compacto (SIN fijar altura) */}
                  <div className="rounded-md border border-gray-300 p-2 min-w-0">
                    <div className="grid gap-y-3 gap-x-6 lg:[grid-template-columns:80px_80px_80px] lg:[grid-template-rows:50px_50px]">
                      {/* Tipo */}
                      <div className="w-[100px] h-[50px] flex flex-col items-center justify-center text-center">
                        <div className="text-[9px] uppercase tracking-wide font-semibold text-gray-900 leading-none">
                          Tipo
                        </div>
                        <div className="text-[9px] font-extrabold uppercase mt-1 text-gray-900 leading-tight">
                          {s.type || "—"}
                        </div>
                      </div>

                      {/* Asignado */}
                      <div className="w-[100px] h-[50px] flex flex-col items-center justify-center px-1 text-center">
                        <div className="text-[9px] uppercase tracking-wide font-semibold text-gray-900 leading-none">
                          Asignado
                        </div>
                        <div className="text-[9px] font-extrabold uppercase text-gray-900 mt-1 truncate w-full">
                          {s.lastAssignmentDate
                            ? (() => {
                                const d = new Date(s.lastAssignmentDate);
                                const dia = String(d.getDate()).padStart(
                                  2,
                                  "0"
                                );
                                const mes = d
                                  .toLocaleString("es-PE", { month: "numeric" })
                                  .replace(/\.$/, "")
                                  .toLowerCase();
                                const anio = d.getFullYear();
                                return `${dia} - ${mes} - ${anio}`;
                              })()
                            : "—"}
                        </div>
                      </div>

                      {/* Consultor (doble altura) */}
                      <div className="w-[100px] h-[112px] flex flex-col items-center justify-center px-1 text-center lg:[grid-row:1/3]">
                        <div className="text-[9px] uppercase tracking-wide font-bold text-gray-900 leading-none">
                          Consultor
                        </div>
                        <div
                          className="text-xs font-extrabold text-gray-900 w-full mt-1 leading-snug break-words
                           overflow-hidden [display:-webkit-box] [-webkit-line-clamp:3] [-webkit-box-orient:vertical]"
                        >
                          {s.primaryConsultant || "—"}
                        </div>
                      </div>

                      {/* Segmento */}
                      <div className="w-[100px] h-[50px] flex flex-col items-center justify-center text-center">
                        <div className="text-[9px] uppercase tracking-wide font-semibold text-gray-900 leading-none">
                          Segmento
                        </div>
                        <div className="text-[9px] font-extrabold mt-0.5 uppercase text-gray-900 leading-tight">
                          {s.segment || "—"}
                        </div>
                      </div>

                      {/* Desasignación */}
                      <div className="w-[100px] h-[50px] flex flex-col items-center justify-center px-1 text-center">
                        <div className="text-[9px] font-semibold uppercase tracking-wide text-gray-900 leading-none">
                          Desasignacion
                        </div>
                        <div className="text-[9px] font-extrabold uppercase text-gray-900 mt-1 truncate w-full">
                          {s.nextDeassignmentDate
                            ? (() => {
                                const d = new Date(s.nextDeassignmentDate);
                                const dia = String(d.getDate()).padStart(
                                  2,
                                  "0"
                                );
                                const mes = d
                                  .toLocaleString("es-PE", { month: "numeric" })
                                  .replace(/\.$/, "")
                                  .toLowerCase();
                                const anio = d.getFullYear();
                                return `${dia} - ${mes} - ${anio}`;
                              })()
                            : "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Botones (anclados arriba, sin cambiar tamaño) */}
                  <div className="w-[176px] shrink-0 mx-auto sm:mx-0 flex flex-col items-center gap-2 self-start">
                    <button
                      onClick={openContacts}
                      className="w-44 px-4 py-2.5 text-xs font-bold rounded-md bg-[#77C7A5] text-black whitespace-nowrap"
                    >
                      Contactos
                    </button>
                    <button
                      onClick={openUnidades}
                      className="w-44 px-4 py-2.5 text-xs font-bold rounded-lg bg-[#77C7A5] text-black whitespace-nowrap"
                    >
                      Unidades y servicios
                    </button>
                    <button
                      onClick={openTipificar}
                      className="w-44 px-4 py-2.5 text-xs font-bold rounded-lg bg-[#77C7A5] text-black whitespace-nowrap"
                    >
                      Tipificar
                    </button>
                  </div>
                </div>
              );
            })()}
        </div>
      </div>

      {/* Contactos */}
      <Modal
        open={openC}
        onClose={() => setOpenC(false)}
        title="Contactos de la empresa"
      >
        {loadingC && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="mb-3 h-4 w-2/3 rounded bg-gray-100" />
                <div className="mb-2 h-3 w-1/2 rounded bg-gray-100" />
                <div className="mb-2 h-3 w-5/6 rounded bg-gray-100" />
                <div className="mt-4 flex gap-2">
                  <div className="h-8 w-16 rounded bg-gray-100" />
                  <div className="h-8 w-16 rounded bg-gray-100" />
                  <div className="h-8 w-16 rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loadingC && (!contacts || !contacts.length) && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
            <div className="text-sm text-gray-700 font-medium">
              No hay contactos registrados.
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Agrega contactos para esta empresa y aparecerán aquí.
            </div>
          </div>
        )}

        {!loadingC && contacts && contacts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {contacts.map((c) => {
              const contactStr = String(c.contactDescription || "");
              const isMail = contactStr.includes("@");
              const phoneMatch = contactStr.match(/\+?\d[\d\s()-]{5,}/);
              const phoneDigits = (contactStr.match(/\d/g) || []).join("");

              return (
                <div
                  key={c._id}
                  className="group rounded-2xl border border-gray-200 bg-white p-3 hover:shadow-sm transition"
                >
                  {/* Header */}
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900">
                        {c.referenceName || "Sin nombre"}
                      </div>
                      {c.position && (
                        <div className="truncate text-xs text-gray-500">
                          {c.position}
                        </div>
                      )}
                    </div>
                    {c.contactType?.nametypecontact && (
                      <Badge>{c.contactType.nametypecontact}</Badge>
                    )}
                  </div>

                  {/* Body */}
                  <div className="text-sm text-gray-700">
                    <div className="mb-2">
                      <span className="text-gray-500">Contacto: </span>
                      {renderLinkIfContact(c.contactDescription)}
                    </div>

                    {/* Quick actions */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {isMail && (
  <button
    type="button"
    onClick={() => openQuickMail(contactStr)}
    className="rounded-lg border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
  >
    Enviar correo
  </button>
)}

                      {phoneMatch && (
                        <>
                          <a
                            href={`tel:${contactStr.replace(/\s+/g, "")}`}
                            className="rounded-lg border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
                          >
                            Llamar
                          </a>
                         {phoneDigits && (
  <button
    type="button"
    onClick={() => openQuickWsp(phoneDigits)}
    className="rounded-lg border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
  >
    WhatsApp
  </button>
)}

                        </>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(contactStr);
                          } catch {}
                        }}
                        className="rounded-lg border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
                      >
                        Copiar
                      </button>
                    </div>

                    {/* Footer */}
                    <div className="mt-3 text-[11px] text-gray-500">
                      Actualizado: {fmtDateTime(c.updatedAt)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* Unidades */}
      <Modal
        open={openU}
        onClose={() => setOpenU(false)}
        title="Unidades y servicios"
        maxWidth="max-w-6xl"
      >
        {loadingU && <div className="text-xs text-gray-500">Cargando…</div>}

        {!loadingU && (!unidadesSorted || !unidadesSorted.length) && (
          <div className="text-sm text-gray-600">
            No hay unidades registradas.
          </div>
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
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {u.phoneNumber || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded-full border border-gray-300 px-2 py-0.5 text-[10px] uppercase text-gray-700">
                        {u.status || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-800">
                      {u.equipmentType || "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-800">{u.plan || "—"}</td>
                    <td className="px-3 py-2 text-gray-700">
                      {fmtDate(u.contractDate)}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {fmtDate(u.statusDate)}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {fmtDate(u.lastDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Tipificación */}
      <Modal
        open={openT}
        onClose={() => setOpenT(false)}
        title="Tipificación de contacto"
      >
        {tipLoading ? (
          <div className="text-xs text-gray-500">Cargando tipificaciones…</div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
              {/* Izquierda: Tipificación + Subtipificación (uno encima del otro) */}
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] font-bold uppercase text-gray-900 mb-2">
                    Tipificación
                  </div>
                  <select
                    className="w-full rounded-md border border-gray-300 px-2 py-2 text-[11px] text-black"
                    value={tipId}
                    onChange={onChangeTip}
                  >
                    <option value="">Seleccione…</option>
                    {(tips || []).map((t) => (
                      <option key={t._id} value={t._id}>
                        {toCap(t.categorytip)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase text-gray-900 mb-2">
                    Subtipificación
                  </div>

                  <select
                    className="w-full rounded-md border border-gray-300 px-2 py-2 text-[11px] text-black"
                    value={subId}
                    onChange={(e) => setSubId(e.target.value)}
                    disabled={!tipId}
                  >
                    <option value="">
                      {tipId
                        ? "Seleccione…"
                        : "Seleccione tipificación primero"}
                    </option>
                    {subs.map((s) => (
                      <option key={s._id} value={s._id}>
                        {toCap(s.name)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Derecha: Nota (misma altura que el bloque izquierdo) */}
              <div className="flex flex-col">
                <div className="text-[10px] uppercase font-bold text-gray-900 mb-2">
                  Nota (opcional)
                </div>
                <textarea
                  className="flex-1 min-h-[100px] rounded-md border border-gray-300 px-2 py-2 text-xs"
                  placeholder="Comentarios adicionales…"
                  value={tipNote}
                  onChange={(e) => setTipNote(e.target.value)}
                />
              </div>
            </div>

            {/* Panel extra si es CLIENTE INTERESADO */}
            {isClienteInteresado && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                <div className="text-[11px] uppercase text-emerald-700 font-bold mb-2">
                  Datos para crear la oportunidad
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Contacto */}
                  <div>
                    <div className="flex items-center gap-4 mb-2">
                      <label className="inline-flex items-center gap-1 font-semibold text-xs">
                        <input
                          type="radio"
                          className="accent-emerald-600"
                          checked={contactChoice === "existing"}
                          onChange={() => setContactChoice("existing")}
                        />
                        Usar existente
                      </label>
                      <label className="inline-flex items-center gap-1 font-semibold text-xs">
                        <input
                          type="radio"
                          className="accent-emerald-600"
                          checked={contactChoice === "new"}
                          onChange={() => {
                            setContactChoice("new");
                            setNewContact((n) => ({
                              ...n,
                              // solo si está vacío
                              position: n.position || "SIN INFORMACION",
                            }));
                          }}
                        />
                        Crear nuevo
                      </label>
                    </div>

                    {contactChoice === "existing" ? (
                      <div className="space-y-2">
                        {/* Dropdown: solo nombres */}
                        <select
                          className="w-full rounded-md border border-gray-300 px-2 py-2 text-[11px]"
                          value={contactId}
                          onChange={(e) => setContactId(e.target.value)}
                          disabled={tLoadContacts}
                        >
                          {!tContacts.length && (
                            <option value="">Sin contactos</option>
                          )}
                          {tContacts.map((c) => (
                            <option key={c._id} value={c._id}>
                              {toCap(c.referenceName)}
                            </option>
                          ))}
                        </select>

                        {/* Detalle del contacto seleccionado (SIN el campo "Nombre") */}
                        {contactId &&
                          (() => {
                            const sel = tContacts.find(
                              (x) => String(x._id) === String(contactId)
                            );
                            if (!sel) return null;
                            return (
                              <div className="grid grid-cols-1 gap-3">
                                {/* Línea informativa opcional (puedes eliminarla si no quieres mostrar el nombre) */}
                                <div className="text-xs capitalize text-gray-900 ml-2">
                                  Seleccionado:{" "}
                                  <span className="font-bold">
                                    {toCap(sel?.referenceName || "—")}
                                  </span>
                                </div>

                                <input
                                  className="w-full rounded-md border border-gray-300 px-2 py-2 text-xs bg-white"
                                  value={toCap(sel.position || "")} // 👈 Capitalize
                                  placeholder="Cargo"
                                  disabled
                                />

                                <div className="grid grid-cols-2 gap-4">
                                  <input
                                    className="rounded-md border border-gray-300 px-2 py-2 text-xs bg-white"
                                    value={toCap(
                                      sel.contactType?.nametypecontact || ""
                                    )} // 👈 Capitalize
                                    placeholder="Tipo de contacto"
                                    disabled
                                  />
                                  <input
                                    className="rounded-md border border-gray-300 px-2 py-2 text-xs bg-white"
                                    value={sel.contactDescription || ""} // 👈 NO capitalizar (email/teléfono)
                                    placeholder="Dato (teléfono/email)"
                                    disabled
                                  />
                                </div>
                              </div>
                            );
                          })()}
                      </div>
                    ) : (
                      // tu bloque de "Crear nuevo" tal cual
                      <div className="grid grid-cols-1 gap-3">
                        <input
                          className="w-full rounded-md border border-gray-300 px-2 py-2 text-xs"
                          placeholder="Nombre"
                          value={newContact.referenceName}
                          onChange={(e) =>
                            setNewContact({
                              ...newContact,
                              referenceName: e.target.value,
                            })
                          }
                        />
                        <input
                          className="w-full rounded-md border border-gray-300 px-2 py-2 text-xs"
                          placeholder="Cargo (opcional)"
                          value={newContact.position}
                          onChange={(e) =>
                            setNewContact({
                              ...newContact,
                              position: e.target.value,
                            })
                          }
                          onBlur={() => {
                            if (
                              contactChoice === "new" &&
                              !newContact.position?.trim()
                            ) {
                              setNewContact((n) => ({
                                ...n,
                                position: "SIN INFORMACION",
                              }));
                            }
                          }}
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <select
                            className="rounded-md border border-gray-300 px-2 py-2 text-xs capitalize"
                            value={newContact.contactType}
                            onChange={(e) =>
                              setNewContact({
                                ...newContact,
                                contactType: e.target.value,
                              })
                            }
                          >
                            {contactTypes.map((t) => (
                              <option key={t._id} value={t._id}>
                                {toCap(t.nametypecontact)}
                              </option>
                            ))}
                          </select>

                          <input
                            className="rounded-md border border-gray-300 px-2 py-2 text-xs"
                            placeholder="Dato (teléfono/email)"
                            value={newContact.contactDescription}
                            onChange={(e) =>
                              setNewContact({
                                ...newContact,
                                contactDescription: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Monto */}
                  {/* Derecha: Tipo/Producto arriba; Monto/Cantidad en una fila */}
                  <div className="flex flex-col gap-2">
                    {/* Tipo de venta */}
                    <div>
                      <div className="text-[10px] uppercase text-gray-900 font-bold mb-1">
                        Tipo de venta
                      </div>
                      <select
                        className="w-full rounded-md border border-gray-300 px-2 py-2 text-[11px]"
                        value={tipoVentaId}
                        onChange={(e) => {
                          const v = e.target.value;
                          setTipoVentaId(v);
                          // preseleccionar producto del tipo elegido
                          const first = (productos || []).find(
                            (p) => String(p.tipoVentaId) === String(v)
                          );
                          setProductoId(first?._id || "");
                        }}
                      >
                        {tiposVenta.map((t) => (
                          <option key={t._id} value={t._id}>
                            {t.nombre || t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Producto */}
                    <div>
                      <div className="text-[10px] uppercase text-gray-900 font-bold mb-1">
                        Producto
                      </div>
                      <select
                        className="w-full rounded-md border border-gray-300 px-2 py-2 text-[11px]"
                        value={productoId}
                        onChange={(e) => setProductoId(e.target.value)}
                      >
                        {(productos || [])
                          .filter(
                            (p) => String(p.tipoVentaId) === String(tipoVentaId)
                          )
                          .map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.nombre || p.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Fila: Monto y Cantidad lado a lado */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[10px] uppercase text-gray-900 font-bold mb-1">
                          Monto (S/)
                        </div>
                        <input
                          className="w-full rounded-md border border-gray-300 px-2 py-2 text-[11px]"
                          placeholder="0"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={tipMonto}
                          onChange={(e) => setTipMonto(e.target.value)}
                        />
                      </div>

                      <div>
                        <div className="text-[10px] uppercase text-gray-900 font-bold  mb-1">
                          Cantidad
                        </div>
                        <input
                          className="w-full rounded-md border border-gray-300 px-2 py-2 text-[11px]"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="1"
                          value={cantidad}
                          onChange={(e) => {
                            // permitir vacío y solo dígitos
                            const v = e.target.value.replace(/\D/g, "");
                            setCantidad(v);
                          }}
                          onBlur={() => {
                            // si quedó vacío, vuelve a 1 al salir
                            if (!cantidad) setCantidad("1");
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setOpenT(false)}
                  className="px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                  Cancelar
                </button>

                {isClienteInteresado && (
                  <button
                    onClick={() => saveTipificacion({ addAnother: true })}
                    disabled={!tipId || !subId || savingTip || marking}
                    className="px-3 py-1.5 text-xs rounded-md border border-teal-600 text-teal-700 hover:bg-teal-50 disabled:opacity-50"
                    title="Guarda esta oportunidad y deja el formulario listo para registrar otra"
                  >
                    {savingTip ? "Guardando…" : "Guardar y agregar otra"}
                  </button>
                )}

                <button
                  onClick={() => saveTipificacion({ addAnother: false })}
                  disabled={!tipId || !subId || savingTip || marking}
                  className="px-3 py-1.5 text-xs rounded-md bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {savingTip || marking ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      

      <QuickWspModal
  open={wspOpen}
  onClose={() => setWspOpen(false)}
  phoneE164={wspPhone}
  authHeader={authHeader}
/>

<QuickEmailModal
  open={mailOpen}
  onClose={() => setMailOpen(false)}
  to={mailTo}
  defaults={{
    nombre: razonSocial || "",
    empresa: "Claro Emprende PYME",
    ejecutivo: (user?.name || "").trim(), // <-- viene del usuario autenticado
  }}
/>

<QuickWspModal
  open={wspOpen}
  onClose={() => setWspOpen(false)}
  phoneE164={wspPhone}
  authHeader={authHeader}
/>


    </div>
  );
}
