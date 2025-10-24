// src/components/AgendaCitaModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import useLockBodyScroll from "../hooks/useLockBodyScroll";

export default function AgendaCitaModal({
  open,
  onClose,
  defaultData = {}, // { ruc, razonSocial, opportunityId, titulo }
  onCreated, // callback opcional para refrescar padre
}) {
  useLockBodyScroll(open);

  const { token } = useAuth();
  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  const [tipo, setTipo] = useState("presencial");
  const [mensaje, setMensaje] = useState("");
  const [direccion, setDireccion] = useState("");
  const [fecha, setFecha] = useState(""); // yyyy-mm-dd
  const [hora, setHora] = useState(""); // HH:mm
  const [saving, setSaving] = useState(false);

  // precarga
  useEffect(() => {
    if (!open) return;
    setTipo("presencial");
    setMensaje("");
    setDireccion("");
    // fecha/hora inicial: ahora redondeado a próxima hora
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const HH = String(now.getHours()).padStart(2, "0");
    const MM = "00";
    setFecha(`${yyyy}-${mm}-${dd}`);
    setHora(`${HH}:${MM}`);
  }, [open, defaultData]);

  if (!open) return null;

  const close = () => !saving && onClose?.();

  const guardar = async () => {
    if (!fecha || !hora) {
      alert("Selecciona fecha y hora");
      return;
    }
    const inicioISO = new Date(`${fecha}T${hora}:00`);
    if (isNaN(inicioISO.getTime())) {
      alert("Fecha u hora inválida");
      return;
    }

    setSaving(true);
    try {
      const titulo = (defaultData?.titulo || "Cita").trim();
      const body = {
        titulo,
        tipo,
        mensaje,
        direccion,
        inicio: inicioISO.toISOString(), // el backend calculará fin (+1h) si no lo mandamos
        ruc: defaultData?.ruc,
        razonSocial: defaultData?.razonSocial,
        opportunityId: defaultData?.opportunityId,
      };
      await api.post("/citas", body, authHeader);
      window.dispatchEvent(
        new CustomEvent("notifications:push", {
          detail: {
            _id: `temp-${Date.now()}`,
            type: "cita",
            title: "Cita programada",
            message: `${titulo} — ${body.razonSocial || body.ruc || ""}`,
            scheduledAt: body.inicio,
            createdAt: new Date().toISOString(),
            read: false,
          },
        })
      );

      // Y pide una recarga al backend para reemplazar la “temp”
      window.dispatchEvent(new Event("notifications:reload"));
      onCreated?.();
      close();
    } catch (e) {
      console.error(e);
      alert("No se pudo crear la cita");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-[min(560px,94%)] max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-200">
          {/* Header */}
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div className="font-semibold text-gray-900">Agendar cita</div>
            <button
              onClick={close}
              className="h-9 w-9 rounded-full grid place-content-center hover:bg-gray-100"
              title="Cerrar"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="p-5 grid grid-cols-1 gap-4 text-sm">
            <div>
              <label className="text-[11px] uppercase text-gray-500">
                Empresa
              </label>
              <div className="mt-0.5 font-semibold text-gray-900">
                {defaultData?.razonSocial || "—"}{" "}
                {defaultData?.ruc ? `(${defaultData.ruc})` : ""}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] uppercase text-gray-500">
                  Tipo
                </label>
                <select
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                >
                  <option value="presencial">Presencial</option>
                  <option value="virtual">Virtual</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] uppercase text-gray-500">
                  Fecha
                </label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[11px] uppercase text-gray-500">
                  Hora
                </label>
                <input
                  type="time"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[11px] uppercase text-gray-500">
                  {tipo === "virtual" ? "Enlace / Dirección" : "Dirección"}
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder={
                    tipo === "virtual"
                      ? "Zoom/Meet/Teams"
                      : "Av. Siempre Viva 123"
                  }
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] uppercase text-gray-500">
                Mensaje / Nota
              </label>
              <textarea
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 resize-none"
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder="Breve objetivo de la reunión…"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t flex justify-end gap-2">
            <button
              onClick={close}
              className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Guardando…" : "Guardar cita"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
