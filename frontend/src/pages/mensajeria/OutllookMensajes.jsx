import { useEffect, useMemo, useState } from "react";
import api from "@/api/axios";
import Mustache from "mustache";

export default function OutlookMensajes() {
  const [auth, setAuth] = useState({ loggedIn: false, email: "" });
  const [login, setLogin] = useState({ smtpEmail: "", smtpPassword: "" });

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");

  // plantillas
  const [templates, setTemplates] = useState([]);
  const [tplId, setTplId] = useState("");
  const [vars, setVars] = useState({});
  const [preview, setPreview] = useState("");

  // editor de plantilla
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null); // { _id?, name, subject, body }

  // estado
  const [loadingTpl, setLoadingTpl] = useState(false);

  useEffect(() => {
    api.get("/auth/smtp/status", { withCredentials: true })
      .then(r => setAuth(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!auth.loggedIn) return;
    loadTemplates();
  }, [auth.loggedIn]);

  const loadTemplates = async () => {
    setLoadingTpl(true);
    try {
      const { data } = await api.get("/email-templates", { withCredentials: true });
      setTemplates(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTpl(false);
    }
  };

  const conectar = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/auth/smtp/login", login, { withCredentials: true });
      setAuth({ loggedIn: true, email: data.email });
      await loadTemplates();
      alert("Conectado ✅");
    } catch (err) {
      alert("Error de autenticación: " + (err?.response?.data?.message || err.message));
    }
  };

  // Cuando el usuario elige una plantilla, precarga subject/html y variables
  useEffect(() => {
    const tpl = templates.find(t => t._id === tplId);
    if (!tpl) {
      setSubject("");
      setHtml("");
      setVars({});
      setPreview("");
      return;
    }
    setSubject(tpl.subject || "");
    setHtml(tpl.body || "");
    // detecta {{variables}}
    const keys = [...new Set((tpl.body || "").match(/{{\s*([\w.]+)\s*}}/g)?.map(s => s.replace(/[{}]/g,"").trim()) || [])];
    const next = { ...vars };
    keys.forEach(k => { if (!(k in next)) next[k] = ""; });
    // limpia keys viejas que ya no están
    Object.keys(next).forEach(k => { if (!keys.includes(k)) delete next[k]; });
    setVars(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tplId]);

  // render de preview
  useEffect(() => {
    try {
      setPreview(Mustache.render(html || "", vars || {}));
    } catch { setPreview(""); }
  }, [html, vars]);

  const enviar = async (e) => {
    e.preventDefault();
    try {
      // Si hay plantilla seleccionada, puedes renderizar en el front
      // y enviar subject/html; o enviar al backend con templateId+variables.
      if (tplId) {
        const rendered = Mustache.render(html || "", vars || {});
        await api.post("/send", { to, subject, html: rendered }, { withCredentials: true });
      } else {
        await api.post("/send", { to, subject, html }, { withCredentials: true });
      }
      alert("Enviado ✅");
      setTo("");
    } catch (err) {
      alert("Error al enviar: " + (err?.response?.data?.message || err.message));
    }
  };

  // CRUD plantillas
  const openNew = () => {
    setEditing({ name: "", subject: "Mensaje", body: defaultTemplateBody });
    setEditOpen(true);
  };
  const openEdit = (tpl) => {
    setEditing({ _id: tpl._id, name: tpl.name, subject: tpl.subject || "", body: tpl.body || "" });
    setEditOpen(true);
  };
  const saveEditing = async () => {
    try {
      if (editing._id) {
        await api.put(`/email-templates/${editing._id}`, editing, { withCredentials: true });
      } else {
        await api.post(`/email-templates`, editing, { withCredentials: true });
      }
      setEditOpen(false);
      await loadTemplates();
    } catch (e) {
      alert("No se pudo guardar la plantilla: " + (e?.response?.data?.message || e.message));
    }
  };
  const deleteTpl = async (tpl) => {
    if (!confirm(`Eliminar plantilla "${tpl.name}"?`)) return;
    try {
      await api.delete(`/email-templates/${tpl._id}`, { withCredentials: true });
      if (tplId === tpl._id) setTplId("");
      await loadTemplates();
    } catch (e) {
      alert("No se pudo eliminar: " + (e?.response?.data?.message || e.message));
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Outlook – SMTP</h1>

      {!auth.loggedIn ? (
        <form onSubmit={conectar} className="space-y-3 border p-4 rounded max-w-md">
          <h2 className="font-semibold">Conectar con mi correo</h2>
          <input
            className="border p-2 w-full"
            placeholder="tu-correo@empresa.com"
            value={login.smtpEmail}
            onChange={e=>setLogin({ ...login, smtpEmail: e.target.value })}
          />
          <input
            className="border p-2 w-full" type="password"
            placeholder="Contraseña"
            value={login.smtpPassword}
            onChange={e=>setLogin({ ...login, smtpPassword: e.target.value })}
          />
          <button className="border px-4 py-2 rounded">Conectar</button>
        </form>
      ) : (
        <>
          {/* Selector de plantilla + CRUD */}
          <div className="border rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Plantillas</div>
              <div className="flex gap-2">
                <button className="border px-2 py-1 rounded" onClick={openNew}>Nueva</button>
                <button className="border px-2 py-1 rounded" onClick={loadTemplates} disabled={loadingTpl}>
                  {loadingTpl ? "Cargando…" : "Refrescar"}
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <select
                  className="border rounded p-2 w-full"
                  value={tplId}
                  onChange={(e)=>setTplId(e.target.value)}
                >
                  <option value="">(Sin plantilla)</option>
                  {templates.map(t => (
                    <option key={t._id} value={t._id}>
                      {t.isGlobal ? "🌐 " : ""}{t.name}
                    </option>
                  ))}
                </select>

                {tplId && (
                  <div className="flex gap-2">
                    <button
                      className="border px-2 py-1 rounded"
                      onClick={()=>openEdit(templates.find(t=>t._id===tplId))}
                    >
                      Editar
                    </button>
                    <button
                      className="border px-2 py-1 rounded"
                      onClick={()=>deleteTpl(templates.find(t=>t._id===tplId))}
                    >
                      Eliminar
                    </button>
                  </div>
                )}

                {/* Variables detectadas */}
                {Object.keys(vars).length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold mb-1">Variables</div>
                    <div className="space-y-2">
                      {Object.keys(vars).map(k => (
                        <div key={k} className="flex items-center gap-2">
                          <div className="w-32 text-right text-xs text-slate-600">{k}</div>
                          <input
                            className="border rounded p-1 text-sm flex-1"
                            value={vars[k]}
                            onChange={(e)=>setVars(v => ({...v, [k]: e.target.value }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Editor rápido del envío */}
              <form onSubmit={enviar} className="space-y-2 md:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    className="border p-2 w-full"
                    placeholder="Destinatario (alguien@dominio.com)"
                    value={to}
                    onChange={e=>setTo(e.target.value)}
                  />
                  <input
                    className="border p-2 w-full"
                    placeholder="Asunto"
                    value={subject}
                    onChange={e=>setSubject(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
<div className="text-xs font-semibold mb-1">
  Cuerpo (HTML / {'{{'}}vars{'}}'})
</div>
                    <textarea
                      className="border p-2 w-full h-40"
                      placeholder="Escribe tu mensaje…"
                      value={html}
                      onChange={e=>setHtml(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold mb-1">Previsualización</div>
                    <div className="border rounded p-2 h-40 overflow-auto bg-white">
                      <div dangerouslySetInnerHTML={{ __html: preview || "<i>—</i>" }} />
                    </div>
                  </div>
                </div>

                <button className="border px-4 py-2 rounded">Enviar</button>
              </form>
            </div>
          </div>

          {/* Modal de edición/creación */}
          {editOpen && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg w-full max-w-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{editing?._id ? "Editar plantilla" : "Nueva plantilla"}</div>
                  <button className="px-2 py-1 rounded hover:bg-gray-100" onClick={()=>setEditOpen(false)}>Cerrar</button>
                </div>
                <input
                  className="border p-2 w-full"
                  placeholder="Nombre"
                  value={editing.name}
                  onChange={e=>setEditing(s=>({ ...s, name: e.target.value }))}
                />
                <input
                  className="border p-2 w-full"
                  placeholder="Asunto"
                  value={editing.subject}
                  onChange={e=>setEditing(s=>({ ...s, subject: e.target.value }))}
                />
                <textarea
                  className="border p-2 w-full h-48"
                  placeholder="Cuerpo (HTML con {{variables}})"
                  value={editing.body}
                  onChange={e=>setEditing(s=>({ ...s, body: e.target.value }))}
                />
                <div className="flex justify-end gap-2">
                  <button className="border px-3 py-1 rounded" onClick={()=>setEditOpen(false)}>Cancelar</button>
                  <button className="border px-3 py-1 rounded bg-emerald-600 text-white" onClick={saveEditing}>Guardar</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Plantilla ejemplo para “Hola …”:
const defaultTemplateBody = `
<p>Hola {{nombre}}:</p>

<p>Mi nombre es {{ejecutivo}} y actualmente soy su nuevo ejecutivo corporativo de <b>Claro Emprende PYME</b> 🧑🏻‍💻👩🏻‍💻.</p>
<p>Le acabo de compartir un correo donde encontrará mis datos y todas las soluciones que ofrecemos.</p>

<p><b>Planes ilimitados desde S/34.95</b> 🚨 al 50% de descuento.</p>

<p>✅ Si necesita más información, uno de nuestros ejecutivos se pondrá en contacto con usted.</p>

<p>Atentamente,<br/>{{ejecutivo}} – {{empresa}}</p>
`.trim();
