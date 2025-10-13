import React, { useEffect, useMemo, useRef, useState, Fragment } from "react";
import { Listbox, Transition } from "@headlessui/react";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";


const COMMERCIAL_ROLE_ID = "68a4f22d27e6abe98157a831";

/* ---------- Toast ultra-liviano (sin libs) ---------- */
function Toast({ id, type = "success", title, message, onClose }) {
  const icon =
    type === "success" ? (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ) : type === "error" ? (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
        <path d="M12 8v5m0 3h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
      </svg>
    ) : (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
        <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
      </svg>
    );

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "group relative w-[360px] max-w-[92vw] rounded-2xl border p-4 shadow-xl",
        "backdrop-blur bg-white/90 border-black/10",
        "animate-in fade-in slide-in-from-top-2",
        type === "success" ? "text-emerald-900" : type === "error" ? "text-red-900" : "text-gray-900",
      ].join(" ")}
    >
      <div className="absolute inset-0 rounded-2xl pointer-events-none"
           style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)" }} />
      <div className="flex items-start gap-3">
        <div
          className={[
            "mt-0.5 flex h-8 w-8 items-center justify-center rounded-full",
            type === "success" ? "bg-emerald-100 text-emerald-700" :
            type === "error" ? "bg-red-100 text-red-700" :
            "bg-gray-100 text-gray-700"
          ].join(" ")}
          aria-hidden="true"
        >
          {icon}
        </div>
        <div className="min-w-0">
          {title && <div className="font-semibold text-sm truncate">{title}</div>}
          {message && <div className="text-xs leading-5 text-gray-700 whitespace-pre-wrap">{message}</div>}
        </div>
        <button
          onClick={() => onClose?.(id)}
          className="ml-auto rounded-md p-1 text-gray-500 hover:text-gray-800 hover:bg-black/5"
          aria-label="Cerrar notificación"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function SelectUser({ users, value, onChange }) {
  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        {/* Botón */}
        <Listbox.Button className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs text-left focus:outline-none focus:ring-1 focus:ring-black">
          {value
            ? users.find(u => u._id === value)?.name
            : "-- Selecciona --"}
        </Listbox.Button>

        {/* Opciones (dropdown con borde negro) */}
        <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
          <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto 
           bg-white
                                     border border-black shadow-lg focus:outline-none">
            {users.map(u => (
              <Listbox.Option
                key={u._id}
                value={u._id}
                className={({ active, selected }) =>
                  `cursor-pointer select-none px-3 py-2 text-xs
                   ${active ? "bg-gray-100" : ""}
                   ${selected ? "font-semibold" : ""}`
                }
              >
                {u.name}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  );
}

export default function AsignarRucs() {
  const { token } = useAuth();
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [rawRucs, setRawRucs] = useState("");
  const [note, ] = useState("");

  const [ignoreTipificacion, setIgnoreTipificacion] = useState(true);
  const [overwrite, setOverwrite] = useState(true);

  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingAssign, setLoadingAssign] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const pushToast = (t) => {
    const id = crypto.randomUUID();
    const item = { id, ...t };
    setToasts((prev) => [item, ...prev].slice(0, 6));
    timers.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
      delete timers.current[id];
    }, t?.timeout ?? 5000);
  };
  const closeToast = (id) => {
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
    setToasts((prev) => prev.filter((x) => x.id !== id));
  };
  useEffect(() => () => {
    // cleanup
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/users/activos", authHeader);
        const onlyCommercial = (data || []).filter((u) => {
          const roleId = String(u?.role?._id ?? u?.role ?? "");
          return roleId === COMMERCIAL_ROLE_ID;
        });
        setUsers(onlyCommercial);
      } catch (e) {
        console.error(e);
        pushToast({
          type: "error",
          title: "No se pudo cargar ejecutivos",
          message: "Intenta nuevamente.",
        });
      }
    })();
  }, [authHeader]);

  const parseRucs = (text) =>
    Array.from(
      new Set(
        String(text || "")
          .split(/[\s,;\n]+/)
          .map((r) => r.replace(/\D/g, ""))
          .filter((r) => /^\d{11}$/.test(r))
      )
    );

  const handlePreview = async () => {
    const rucs = parseRucs(rawRucs);
    if (!rucs.length) {
      pushToast({ type: "error", title: "RUCs inválidos", message: "Ingresa al menos un RUC de 11 dígitos." });
      return;
    }
    setLoadingPreview(true);
    try {
      // Puedes enviar overwrite si quieres que el preview no marque conflictos cuando vayas a sobrescribir:
      const { data } = await api.post("/basesecodi/by-rucs", { rucs, overwrite }, authHeader);
      setPreview(
        data || { found: [], missing: [], conflicted: [] }
      );
      const msg = `Encontrados: ${data?.found?.length ?? 0}\nNo encontrados: ${data?.missing?.length ?? 0}\nConflictos: ${data?.conflicted?.length ?? 0}`;
      pushToast({ type: "success", title: "Previsualización lista", message: msg, timeout: 4500 });
    } catch (e) {
      console.error(e);
      pushToast({ type: "error", title: "Error al previsualizar", message: "Revisa el formato de los RUCs y tu conexión." });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleAssign = async () => {
    const rucs = parseRucs(rawRucs);

    if (!selectedUser) {
      pushToast({ type: "error", title: "Falta ejecutivo", message: "Selecciona un ejecutivo comercial." });
      return;
    }
    if (!rucs.length) {
      pushToast({ type: "error", title: "RUCs inválidos", message: "Ingresa al menos un RUC de 11 dígitos." });
      return;
    }

    setLoadingAssign(true);
    try {
      const payload = {
        rucs,
        userId: selectedUser,
        note: note?.trim() || "",
        ignoreTipificacion,
        overwrite,
      };

      const { data } = await api.post("/basesecodi/assign", payload, authHeader);

      // Toast de éxito con resumen compacto
      const lines = [];
      if (typeof data?.matched === "number") lines.push(`Coincidencias: ${data.matched}`);
      if (typeof data?.modified === "number") lines.push(`Modificados: ${data.modified}`);
      if (Array.isArray(data?.missing)) lines.push(`Faltantes: ${data.missing.length}`);
      if (Array.isArray(data?.conflicted)) lines.push(`Conflictos: ${data.conflicted.length}`);
      if (typeof data?.opportunitiesCreated === "number") lines.push(`Oportunidades: ${data.opportunitiesCreated}`);

      pushToast({
        type: "success",
        title: "Asignación completada",
        message: lines.join("\n") || "Se procesó la asignación.",
        timeout: 6000,
      });

      // opcional: limpiar textarea si quieres
      // setRawRucs(""); setPreview(null); setSelectedUser("");
    } catch (e) {
      console.error(e);
      pushToast({
        type: "error",
        title: "Error al asignar",
        message: e?.response?.data?.message || "No se pudo procesar la asignación.",
      });
    } finally {
      setLoadingAssign(false);
    }
  };

  return (
    <>
      {/* Contenedor de toasts (lateral, elegante) */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <Toast key={t.id} {...t} onClose={closeToast} />
        ))}
      </div>

<div className="min-h-[calc(100dvh-88px)] bg-[#ebe8e8] flex items-start justify-center pt-10 pb-6 overflow-y-auto">
  {/* tarjeta */}
<div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-black/5 p-6 min-h-[420px]">


          <h1 className="text-xl font-extrabold tracking-wide text-gray-900 text-center">
            Asignar RUCs
          </h1>
          

          {/* Form compact */}
          <div className="mt-4 space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-black">Ejecutivo comercial</label>
<SelectUser
  users={users}
  value={selectedUser}
  onChange={setSelectedUser}
/>

           
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-800">RUCs (uno por línea o separados por coma)</label>
              <textarea
                rows={5}
                value={rawRucs}
                onChange={(e) => setRawRucs(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-black"
                placeholder={`20123456789\n20567891234`}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-700">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-black"
                    checked={ignoreTipificacion}
                    onChange={(e) => setIgnoreTipificacion(e.target.checked)}
                  />
                  Reabrir aunque esté tipificado
                </label>

                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-black"
                    checked={overwrite}
                    onChange={(e) => setOverwrite(e.target.checked)}
                  />
                  Sobrescribir dueño si ya tiene
                </label>

                
                  
              </div>
            </div>

          </div>

          {/* Acciones compactas */}
          <div className="mt-4 flex justify-center gap-4">
  <button
    onClick={handleAssign}
    disabled={loadingAssign || !selectedUser || !parseRucs(rawRucs).length}
    className="w-28 py-2 rounded-lg bg-black text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
    title="Asignar ahora"
  >
    {loadingAssign ? "Asignando…" : "Asignar"}
  </button>

  <button
    onClick={handlePreview}
    disabled={loadingPreview || !parseRucs(rawRucs).length}
    className="w-28 py-2 rounded-lg border border-gray-300 bg-white text-xs font-semibold hover:bg-gray-50 disabled:opacity-50"
  >
    {loadingPreview ? "Cargando…" : "Previsualizar"}
  </button>
</div>


          {/* (Opcional) Puedes mantener una mini leyenda, sin resultados detallados */}
          {preview && (
            <div className="mt-3 text-[11px] text-gray-500">
              Previsualización realizada. Revisa el resumen en la notificación.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
