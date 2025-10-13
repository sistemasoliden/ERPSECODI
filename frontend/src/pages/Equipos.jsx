import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export default function Equipos() {
  const { token } = useAuth();
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const [equipos, setEquipos] = useState([]);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);

  // UI
  const [expanded, setExpanded] = useState(new Set());
  const [modal, setModal] = useState(null); // { tipo: "supervisor"|"ejecutivos", equipoId }
  const [pickerSupervisorId, setPickerSupervisorId] = useState("");
  const [pickerEjecutivosIds, setPickerEjecutivosIds] = useState(new Set());
  const [saving, setSaving] = useState(false);

  // cargar datos
  const fetchAll = async () => {
    const [eq, us, ro] = await Promise.all([
      api.get("/equipos", authHeader),
      api.get("/users", authHeader),
      api.get("/rolesusuarios", authHeader),
    ]);
    setEquipos(eq.data || []);
    setUsers(us.data || []);
    setRoles((ro.data || []).map(r => ({ _id: r._id, name: r.name || r.nombre || r.slug })));
  };

  useEffect(() => { fetchAll(); }, []);

  // roles
  const comercialRoleId  = useMemo(() => roleIdByName(roles, "Comercial"), [roles]);
  const supervisorRoleId = useMemo(() => roleIdByName(roles, "Supervisor Comercial"), [roles]);

  // helpers
  const toggleExpand = (id) => setExpanded(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });

  const supervisorLabel = (sup) =>
    sup ? `${(sup.firstName||"").trim()} ${(sup.lastName||"").trim()}`.trim() || sup.name || sup.email : "—";

  const ejecutivosDe = (equipoId) =>
    users
      .filter(u => (u.equipo?._id || u.equipo) === equipoId && (u.role?._id || u.role) === comercialRoleId)
      .map(u => ({ _id: u._id, label: `${(u.firstName||"")} ${(u.lastName||"")}`.trim() || u.name, email: u.email }));

  const supervisoresDisponibles = (equipoId) =>
    users.filter(u => (u.role?._id || u.role) === supervisorRoleId);
 
// Solo comerciales activos y sin equipo
const comercialesDisponibles = (equipoId) =>
  users.filter(u =>
    (u.role?._id || u.role) === comercialRoleId &&
    !(u.equipo?._id || u.equipo) &&
    (u.estadoUsuario?._id || u.estadoUsuario) === "68a4f3dc27e6abe98157a845" // 👈 Solo Activos
  );

  // abrir modales
  const openSupervisor = async (equipoId) => {
    const info = await api.get(`/equipos/${equipoId}/miembros`, authHeader);
    setPickerSupervisorId(info.data?.supervisor?._id || "");
    setModal({ tipo: "supervisor", equipoId });
  };

  const openEjecutivos = async (equipoId) => {
    const info = await api.get(`/equipos/${equipoId}/miembros`, authHeader);
    const current = new Set((info.data?.comerciales || []).map(x => x._id));
    setPickerEjecutivosIds(current);
    setModal({ tipo: "ejecutivos", equipoId });
  };

  const closeModal = () => {
    setModal(null);
    setPickerSupervisorId("");
    setPickerEjecutivosIds(new Set());
  };

  // acciones
  const saveSupervisor = async () => {
    try {
      setSaving(true);
      await api.patch(`/equipos/${modal.equipoId}/supervisor`, { supervisorId: pickerSupervisorId }, authHeader);
      await fetchAll();
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const togglePickEjecutivo = (id) => {
    setPickerEjecutivosIds(prev => {
      const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
    });
  };

  const saveEjecutivos = async () => {
    try {
      setSaving(true);
      await api.patch(`/equipos/${modal.equipoId}/ejecutivos`, { ejecutivosIds: [...pickerEjecutivosIds] }, authHeader);
      await fetchAll();
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const removeEjecutivo = async (equipoId, userId) => {
    if (!confirm("Quitar este ejecutivo del equipo?")) return;
    await api.patch(`/equipos/${equipoId}/ejecutivos/${userId}/remove`, {}, authHeader);
    await fetchAll();
  };

  // UI
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-lg uppercase font-bold text-black">Equipos</h1>

      <div className="rounded-md border border-gray-300 bg-white overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-red-800">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold text-white uppercase border">Equipo</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-white uppercase border">Supervisor</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-white uppercase border">Ejecutivos</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-white uppercase border w-[360px]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {equipos.map(eq => {
              const isOpen = expanded.has(eq._id);
              const ejec = ejecutivosDe(eq._id);
              const supName = supervisorLabel(eq.supervisor);

              return (
                <React.Fragment key={eq._id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm border">{eq.name}</td>
                    <td className="px-4 py-2 text-sm border">{supName}</td>
                    <td className="px-4 py-2 text-sm border">{ejec.length}</td>
                    <td className="px-4 py-2 text-sm border">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="px-3 py-1 bg-indigo-700 text-white text-xs rounded"
                          onClick={() => openSupervisor(eq._id)}
                          disabled={supervisoresDisponibles(eq._id).length === 0}
                        >
                          Asignar supervisor
                        </button>
                        <button
                          className="px-3 py-1 bg-green-700 text-white text-xs rounded"
                          onClick={() => openEjecutivos(eq._id)}
                        >
                          Asignar ejecutivos
                        </button>
                        <button
                          className="px-3 py-1 bg-gray-800 text-white text-xs rounded"
                          onClick={() => toggleExpand(eq._id)}
                        >
                          {isOpen ? "Ocultar info" : "Ver info"}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr>
                      <td colSpan={4} className="bg-slate-50 border-t">
                        <div className="p-4">
                          <h4 className="font-semibold mb-2">Detalle del equipo</h4>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded border bg-white">
                              <div className="px-3 py-2 font-medium border-b">Supervisor</div>
                              <div className="px-3 py-2 text-sm">{supName}</div>
                            </div>

                            <div className="rounded border bg-white">
                              <div className="px-3 py-2 font-medium border-b">
                                Ejecutivos ({ejec.length})
                              </div>
                              <div className="px-3 py-2 text-sm space-y-1">
                                {ejec.length ? (
                                  ejec.map(e => (
                                    <div key={e._id} className="flex items-center justify-between gap-2">
                                      <span>{e.label} — {e.email}</span>
                                      <button
                                        className="px-2 py-0.5 text-[11px] bg-red-600 text-white rounded"
                                        onClick={() => removeEjecutivo(eq._id, e._id)}
                                      >
                                        Quitar
                                      </button>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-gray-500">Sin ejecutivos asignados</div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {equipos.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-6 text-sm text-gray-600">
                  Sin equipos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL SUPERVISOR */}
      {modal?.tipo === "supervisor" && (
        <Modal title="Asignar supervisor" onClose={closeModal}>
          <select
            className="w-full px-3 py-2 border rounded mb-3"
            value={pickerSupervisorId}
            onChange={(e) => setPickerSupervisorId(e.target.value)}
          >
            <option value="">— Sin supervisor —</option>
            {supervisoresDisponibles(modal.equipoId).map(s => (
              <option key={s._id} value={s._id}>
                {(`${s.firstName||""} ${s.lastName||""}`).trim() || s.name} — {s.email}
              </option>
            ))}
          </select>

          <div className="flex justify-end gap-2">
            <button className="px-3 py-2 bg-gray-700 text-white text-xs rounded" onClick={closeModal}>
              Cancelar
            </button>
            <button
              className="px-3 py-2 bg-indigo-700 text-white text-xs rounded disabled:opacity-60"
              disabled={saving}
              onClick={saveSupervisor}
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL EJECUTIVOS */}
      {modal?.tipo === "ejecutivos" && (
  <Modal title="Asignar ejecutivos" onClose={closeModal}>
    {(() => {
      const disponibles = comercialesDisponibles(modal.equipoId);
      const hayDisponibles = disponibles.length > 0;

      // si no hay disponibles, asegúrate de no dejar selecciones colgando
      if (!hayDisponibles && pickerEjecutivosIds.size) {
        setPickerEjecutivosIds(new Set());
      }

      return (
        <>
          <div className="max-h-72 overflow-auto border rounded p-2 space-y-1">
            {hayDisponibles ? (
              disponibles.map((c) => {
                const checked = pickerEjecutivosIds.has(c._id);
                return (
                  <label key={c._id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePickEjecutivo(c._id)}
                    />
                    <span>
                      {(`${c.firstName || ""} ${c.lastName || ""}`).trim() || c.name} — {c.email}
                    </span>
                  </label>
                );
              })
            ) : (
              <div className="text-gray-500 text-sm">
                Todos los ejecutivos ya pertenecen a un equipo.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-3">
            <button
              className="px-3 py-2 bg-gray-700 text-white text-xs rounded"
              onClick={closeModal}
            >
              Cancelar
            </button>
            <button
              className="px-3 py-2 bg-green-700 text-white text-xs rounded disabled:opacity-60"
              disabled={saving || !hayDisponibles || pickerEjecutivosIds.size === 0}
              onClick={saveEjecutivos}
              title={
                !hayDisponibles
                  ? "No hay ejecutivos disponibles."
                  : pickerEjecutivosIds.size === 0
                  ? "Selecciona al menos un ejecutivo."
                  : "Guardar"
              }
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </>
      );
    })()}
  </Modal>
)}


    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white w-[95%] max-w-3xl p-5 rounded-md shadow-xl border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-black">{title}</h3>
          <button className="px-2 py-1 bg-gray-800 text-white rounded" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function roleIdByName(list, n) {
  return list.find(r => (r.name || r.nombre || r.slug || "").toLowerCase() === n.toLowerCase())?._id;
}
