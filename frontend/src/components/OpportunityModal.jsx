// src/components/OpportunityModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import StagePath from "./StagePath.jsx";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function OpportunityModal({ open, onClose, op, tipos = [], onChangeEstado, onUpdate }) {
  const { token } = useAuth();
  const authHeader = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  // ---- Helpers seguros ----
  const contactFromOp = (o) => ({
    nombre:  o?.contacto?.nombre  ?? "",
    celular: o?.contacto?.celular ?? "",
    cargo:   o?.contacto?.cargo   ?? "",
    correo:  o?.contacto?.correo  ?? "",
  });

  // ---- State
  const [contact, setContact] = useState(contactFromOp(op));
  const [savingContact, setSavingContact] = useState(false);

  // cantidad editable (si no tienes en BD, será 1 por defecto)
  const [cantidad, setCantidad] = useState(Number(op?.cantidad || 1));

  // Data Salesforce (por RUC)
  const [sfItems, setSfItems] = useState([]);
  const [loadingSF, setLoadingSF] = useState(false);

  // Sincroniza cuando cambie la oportunidad
  useEffect(() => {
    setContact(contactFromOp(op));
    setCantidad(Number(op?.cantidad || 1));
  }, [op]);

  // Cargar Data Salesforce al abrir/cambiar RUC
  useEffect(() => {
    const loadSF = async () => {
      if (!open || !op?.ruc) return;
      setLoadingSF(true);
      try {
        const { data } = await api.get(`/data-salesforce/by-ruc/${String(op.ruc)}`, authHeader);
        setSfItems(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("datasf", e);
        setSfItems([]);
      } finally {
        setLoadingSF(false);
      }
    };
    loadSF();
  }, [open, op?.ruc, authHeader]);

  // Cerrar con ESC
  useEffect(() => {
    const handler = (e) => e.key === "Escape" && onClose?.();
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !op) return null;

  const badge =
    (op?.estadoNombre || "").toLowerCase().includes("ganada")
      ? "bg-emerald-100 text-emerald-700"
      : (op?.estadoNombre || "").toLowerCase().includes("perdida")
      ? "bg-red-100 text-red-700"
      : "bg-indigo-100 text-indigo-700";

  const ejecutiva = op.ejecutivo || op.ownerName || "—";
  const lastStageAt = op.estadoUpdatedAt || op.updatedAt || op.fechaGestion || null;

  const saveContact = async () => {
    setSavingContact(true);
    try {
      await onUpdate?.(op._id, { contacto: contact });
    } finally {
      setSavingContact(false);
    }
  };

  const handleChangeEtapa = (estadoId) => {
    const nombreSel = (tipos.find(t => t._id === estadoId)?.nombre || "").toLowerCase();
    const esCierre = nombreSel.includes("ganada") || nombreSel.includes("perdida");
    if (esCierre) {
      const label = tipos.find(t => t._id === estadoId)?.nombre || "esta etapa";
      if (!window.confirm(`¿Confirmas cerrar la oportunidad como "${label}"?`)) return;
    }
    onChangeEstado?.(op._id, estadoId);
  };

  // último registro Salesforce (el más reciente)
  const sf = sfItems?.[0];

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />

      <div className="absolute inset-x-0 top-10 mx-auto w-[min(980px,95%)]">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 p-5 border-b">
            <div>
              <div className="text-xs text-gray-500">RUC</div>
              <div className="text-2xl font-semibold text-gray-900 leading-6">{op.ruc}</div>
              <div className="text-sm text-gray-700">{op.razonSocial || op?.base?.razonSocial || "—"}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full ${badge}`}>{op.estadoNombre}</span>
              <button onClick={onClose} className="h-8 w-8 rounded-full grid place-content-center hover:bg-gray-100" title="Cerrar">✕</button>
            </div>
          </div>

          {/* Etapas */}
          <div className="px-5 pt-4">
            <StagePath tipos={tipos} currentId={op.estadoId} onChange={handleChangeEtapa} />
          </div>

          {/* Ejecutiva + Última gestión */}
          <div className="px-5 pt-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="text-sm text-gray-700">
                <span className="text-gray-500">Ejecutiva: </span><b className="text-gray-800">{ejecutiva}</b>
              </div>
              <div className="text-sm text-gray-700">
                <span className="text-gray-500">Última gestión de etapa: </span>
                <b className="text-gray-800">
                  {lastStageAt ? new Date(lastStageAt).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }) : "—"}
                </b>
              </div>
            </div>
          </div>

          {/* Contenido */}
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Monto & Cantidad */}
            <div className="space-y-4">
             


              {/* Data Salesforce */}
              <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
                <div className="text-[11px] uppercase text-emerald-700 font-semibold mb-2">
                  Datos Salesforce
                </div>
                {loadingSF ? (
                  <div className="text-xs text-gray-500">Cargando…</div>
                ) : !sf ? (
                  <div className="text-sm text-gray-600">Sin registros Salesforce para este RUC.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {sf.type && <Item label="Tipo" value={sf.type} />}
                    {sf.segment && <Item label="Segmento" value={sf.segment} />}
                    {sf.primaryConsultant && <Item label="Consultor" value={sf.primaryConsultant} />}
                    {sf.lastAssignmentDate && <Item label="Asignado" value={fmt(sf.lastAssignmentDate)} />}
                    {sf.nextDeassignmentDate && <Item label="Desasignación" value={fmt(sf.nextDeassignmentDate)} />}
                    <div className="col-span-2 text-[11px] text-gray-500">
                      Actualizado: {fmt(sf.updatedAt)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Contacto */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-800">Contacto</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextField label="Nombre"  value={contact.nombre}  onChange={(v)=>setContact({ ...contact, nombre: v })} />
                <TextField label="Celular" value={contact.celular} onChange={(v)=>setContact({ ...contact, celular: v })} />
                <TextField label="Cargo"   value={contact.cargo}   onChange={(v)=>setContact({ ...contact, cargo: v })} />
                <TextField label="Correo"  type="email" value={contact.correo} onChange={(v)=>setContact({ ...contact, correo: v })} />
              </div>
              <div className="pt-1">
                <button
                  onClick={saveContact}
                  disabled={savingContact}
                  className="px-3 py-2 rounded-lg bg-gray-800 text-white text-xs shadow hover:shadow-md disabled:opacity-60"
                >
                  {savingContact ? "Guardando..." : "Guardar contacto"}
                </button>
              </div>
            </div>
          </div>

          <div className="px-5 pb-5 pt-3 flex justify-end">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Item({ label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-900">{value ?? "—"}</div>
    </div>
  );
}

function TextField({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-indigo-200"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function fmt(d) {
  return d ? new Date(d).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" }) : "—";
}
