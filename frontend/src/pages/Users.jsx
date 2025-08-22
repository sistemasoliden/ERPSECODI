// client/src/pages/Users.jsx
import React, { useState, useEffect } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { uploadToImgBB } from "../utils/imgbb";
import { jsPDF } from "jspdf";

const Users = () => {
  const { token } = useAuth();
  

  // ---------- State ----------
  const [users, setUsers] = useState([]);
  const [estados, setEstados] = useState([]);
  const [roles, setRoles] = useState([]);
  
  const [activoId, setActivoId] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = creando

  const [dniPreview, setDniPreview] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [subiendoDNI, setSubiendoDNI] = useState(false);
  const [subiendoAvatar, setSubiendoAvatar] = useState(false);
  // Estado del toggle
const [loadingEstadoId, setLoadingEstadoId] = useState(null);
const [inactivoId, setInactivoId] = useState(null);
const [newPassword, setNewPassword] = useState("");
const [changingPwd, setChangingPwd] = useState(false);


  const [error, setError] = useState("");
  // 1) Agrega una “llave” para forzar re-montaje del modal
const [modalKey, setModalKey] = useState(0);

  // ---------- Modal DNI ----------
  const [dniModalOpen, setDniModalOpen] = useState(false);
  const [dniModalUrl, setDniModalUrl] = useState("");
  const [dniModalLoading, setDniModalLoading] = useState(false);
  const [dniModalError, setDniModalError] = useState("");

  const openDniModal = (url) => {
    setDniModalUrl(url || "");
    setDniModalError("");
    setDniModalOpen(true);
  };
  const closeDniModal = () => {
    setDniModalOpen(false);
    setDniModalUrl("");
  };
  const downloadDniAsPdf = async () => {
    if (!dniModalUrl) return;
    try {
      setDniModalLoading(true);
      setDniModalError("");
      const resp = await fetch(dniModalUrl, { mode: "cors" });
      const blob = await resp.blob();
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });

      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const img = new Image();
      img.onload = () => {
        const imgW = img.width;
        const imgH = img.height;
        const maxW = pageWidth - 80;
        const maxH = pageHeight - 80;
        let drawW = maxW;
        let drawH = (imgH * drawW) / imgW;
        if (drawH > maxH) {
          drawH = maxH;
          drawW = (imgW * drawH) / imgH;
        }
        const x = (pageWidth - drawW) / 2;
        const y = (pageHeight - drawH) / 2;
        // si tu imagen es PNG, cambia 'JPEG' por 'PNG'
        pdf.addImage(dataUrl, "JPEG", x, y, drawW, drawH);
        pdf.save("dni.pdf");
        setDniModalLoading(false);
      };
      img.onerror = () => {
        setDniModalLoading(false);
        setDniModalError("No se pudo cargar la imagen.");
      };
      img.src = dataUrl;
    } catch (e) {
      console.error(e);
      setDniModalLoading(false);
      setDniModalError("No se pudo generar el PDF.");
    }
  };
const DOMAIN = "claronegocios-secodi.com";

function norm(s = "") {
  return s
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z]/g, ""); // solo letras
}

function firstToken(s = "") {
  return (s || "").trim().split(/\s+/)[0] || "";
}

function buildOrgEmail(firstName, lastName) {
  const fn = norm(firstToken(firstName));
  const ln = norm(firstToken(lastName));
  if (!fn || !ln) return "";
  return `${fn}.${ln}@${DOMAIN}`;
}

  
  const [form, setForm] = useState({
  firstName: "",
  lastName: "",
  email: "",
  address: "",
  phone: "",
  dniUrl: "",
  avatar: "",
  documentType: "DNI",
  documentNumber: "",
  role: "",
  password: "",
});


  // ---------- Helpers ----------
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      orgEmail: "",
      address: "",
      phone: "",
      dniUrl: "",
      avatar: "",
      documentType: "DNI",
      documentNumber: "",
      role: roles?.[0]?._id || "",
      roleDescription: "",
      password: "",
    });
    setDniPreview("");
    setAvatarPreview("");
    setEditingId(null);
    setError("");
  };

  // ---------- Fetchers ----------
  const fetchUsers = async () => {
    try {
      const res = await api.get("/users", authHeader);
      setUsers(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };
  const fetchEstados = async () => {
  try {
    const res = await api.get("/estadosusuario", authHeader);
    const list = res.data || [];
    setEstados(list);

    const activo = list.find((e) => e.nombre?.toLowerCase() === "activo");
    const inactivo = list.find((e) => e.nombre?.toLowerCase() === "inactivo");

    if (activo) setActivoId(activo._id);
    if (inactivo) setInactivoId(inactivo._id);
  } catch (err) {
    console.error(err);
  }
};

  const fetchRoles = async () => {
  try {
    const res = await api.get("/rolesusuarios", authHeader);
    const list = res.data || [];

    const normalized = list.map((r) => ({
      _id: r._id,
      name: r.name || r.nombre || r.slug || String(r._id),
    }));

    setRoles(normalized);

    setForm((prev) => ({
      ...prev,
      role: prev.role || normalized[0]?._id || "",
    }));
  } catch (err) {
    console.error(err);
  }
};

  useEffect(() => {
    fetchUsers();
    fetchEstados();
    fetchRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ---------- Handlers ----------
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectDNI = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setDniPreview(reader.result);
    reader.readAsDataURL(file);
    try {
      setSubiendoDNI(true);
      const { url } = await uploadToImgBB(file, { name: "dni" });
      setForm((prev) => ({ ...prev, dniUrl: url }));
    } catch (err) {
      console.error(err);
      setError("No se pudo subir la imagen del DNI. Intenta nuevamente.");
    } finally {
      setSubiendoDNI(false);
    }
  };

  const handleSelectAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
    try {
      setSubiendoAvatar(true);
      const { url } = await uploadToImgBB(file, { name: "avatar" });
      setForm((prev) => ({ ...prev, avatar: url }));
    } catch (err) {
      console.error(err);
      setError("No se pudo subir la foto del ejecutivo. Intenta nuevamente.");
    } finally {
      setSubiendoAvatar(false);
    }
  };
  const isActivo = (u) => {
  const id = u.estadoUsuario?._id || u.estadoUsuario;
  const estado = estados.find((e) => e._id === id);
  return estado?.nombre?.toLowerCase() === "activo";
};

const toggleEstado = async (u) => {
  try {
    if (!activoId || !inactivoId) {
      return setError("No se encontraron estados 'Activo' e 'Inactivo' en la BD.");
    }

    const estaActivo = isActivo(u);
    const targetEstadoId = estaActivo ? inactivoId : activoId;

    // Optimista
    setLoadingEstadoId(u._id);
    setUsers((prev) =>
      prev.map((x) =>
        x._id === u._id ? { ...x, estadoUsuario: targetEstadoId } : x
      )
    );

    await api.patch(`/users/${u._id}/estado`, { estadoId: targetEstadoId }, authHeader);

    // Si prefieres, refresca desde servidor:
    // await fetchUsers();
  } catch (err) {
    console.error(err);
    setError("No se pudo actualizar el estado.");
    // revertir si falló
    await fetchUsers();
  } finally {
    setLoadingEstadoId(null);
  }
};



const openCreate = () => {
  setForm({
    name: "",
    email: "",
    orgEmail: "",
    address: "",
    phone: "",
    dniUrl: "",
    avatar: "",
    documentType: "DNI",
    documentNumber: "",
    role: roles?.[0]?._id || "",
    password: "",
  });
  setDniPreview("");
  setAvatarPreview("");
  setEditingId(null);
  setError("");
  setIsModalOpen(true);
  setModalKey((k) => k + 1); // 👈 fuerza re-mount
};

const openEdit = (u) => {
  setForm({
    name: u.name || "",
    email: u.email || "",
    orgEmail: u.orgEmail || "",
    address: u.address || "",
    phone: u.phone || "",
    dniUrl: u.dniUrl || "",
    avatar: u.avatar || "",
    documentType: u.documentType || "DNI",
    documentNumber: u.documentNumber || "", 
      role:
      u.role?._id || // si viene populado
      u.role ||      // si viene como string
      roles?.[0]?._id || "",
    roleDescription: u.roleDescription || "",
    password: "",
  });
  setDniPreview(u.dniUrl || "");
  setAvatarPreview(u.avatar || "");
  setEditingId(u._id);
  setIsModalOpen(true);
  setModalKey((k) => k + 1); // 👈 fuerza re-mount
};


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (!activoId) return setError("No se encontró el estado 'Activo' en la BD.");
      if (!form.role) return setError("Selecciona un rol válido.");

     const payload = {
  firstName: form.firstName,
  lastName: form.lastName,
  email: form.email || "",
  address: form.address || "",
  phone: form.phone || "",
  dniUrl: form.dniUrl || "",
  avatar: form.avatar || "",
  documentType: form.documentType || "DNI",
  documentNumber: form.documentNumber || "",
  role: form.role,
  estadoUsuario: activoId,
};


      if (editingId) {
        await api.put(`/users/${editingId}`, payload, authHeader);
      } else {
        if (!form.password || form.password.length < 6) {
          return setError("La contraseña es obligatoria y debe tener al menos 6 caracteres.");
        }
        await api.post("/users", { ...payload, password: form.password }, authHeader);
      }

      setIsModalOpen(false);
      resetForm();
      fetchUsers();
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Error al guardar usuario";
      setError(msg);
    }
  };

  // ---------- UI ----------
  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-lg uppercase font-bold text-black">Lista de Usuarios</h1>
        <button
          onClick={openCreate}
          className="px-4 py-3 bg-gray-800 text-white text-xs font-semibold uppercase rounded-sm transform hover:scale-105 transition"
        >
          Crear Usuario
        </button>
      </div>

      {/* Tabla */}
      <div className="rounded-sm border border-black bg-white transition-all duration-300 relative overflow-x-auto">
        <table className="w-full table-fixed border-collapse min-w-[980px]">
          <thead className="bg-red-800">
            <tr>
              <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide border border-black w-20">Avatar</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide border border-black">Nombre</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide border border-black">Correo Personal</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide border border-black">Correo Organizacional</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide border border-black">Teléfono</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide border border-black">Dirección</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide border border-black">Documento</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide border border-black w-24">N° Documento</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide border border-black w-24">DNI Imagen</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide border border-black">Estado</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide border border-black w-24">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, idx) => {
              const isOdd = idx % 2 !== 0;
              const estadoNombre =
                estados.find((e) => e._id === (u.estadoUsuario?._id || u.estadoUsuario))?.nombre || "—";
              return (
                <tr key={u._id} className={`${isOdd ? "bg-slate-50" : "bg-white"} hover:bg-slate-100 transition-colors duration-200`}>
                  <td className="px-4 py-3 text-center border border-black">
                    <img
                      src={u.avatar || "https://ui-avatars.com/api/?name=" + encodeURIComponent(u.name || "U")}
                      alt="avatar"
                      className="w-10 h-10 rounded-full object-cover inline-block"
                    />
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-slate-800 font-medium border border-black break-words">{u.name}</td>
                  <td className="px-4 py-3 text-center text-xs text-slate-800 font-medium border border-black break-words">{u.email}</td>
                  <td className="px-4 py-3 text-center text-xs text-slate-800 font-medium border border-black break-words">{u.orgEmail || "—"}</td>
                  <td className="px-4 py-3 text-center text-xs text-slate-800 font-medium border border-black break-words">{u.phone || "—"}</td>
                  <td className="px-4 py-3 text-center text-xs text-slate-800 font-medium border border-black break-words">{u.address || "—"}</td>
                  <td className="px-4 py-3 text-center text-xs text-slate-800 font-medium border border-black break-words">
                    {u.documentType || "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-slate-800 font-medium border border-black break-words">{u.documentNumber || "—"}</td>
                  <td className="px-4 py-3 text-center border border-black">
                    {u.dniUrl ? (
                      <button
                        type="button"
                        onClick={() => openDniModal(u.dniUrl)}
                        className="px-3 py-1 bg-blue-700 text-white uppercase text-[10px] rounded-sm hover:opacity-90"
                      >
                        Ver DNI
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs">No subido</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-xs border border-black">
  <button
    onClick={() => toggleEstado(u)}
    disabled={loadingEstadoId === u._id}
    className={`relative inline-flex h-6 w-12 items-center rounded-full transition
      ${isActivo(u) ? "bg-green-600" : "bg-gray-400"}
      ${loadingEstadoId === u._id ? "opacity-60 cursor-not-allowed" : "hover:opacity-90"}
    `}
    title={isActivo(u) ? "Cambiar a Inactivo" : "Cambiar a Activo"}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white transition
        ${isActivo(u) ? "translate-x-6" : "translate-x-1"}
      `}
    />
    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-slate-700">
      {isActivo(u) ? "Activo" : "Inactivo"}
    </span>
  </button>
</td>


                  <td className="px-4 py-3 text-center text-xs border border-black">
  {!isActivo(u) ? (
    <button
      disabled
      className="px-3 py-1 bg-gray-400 text-white uppercase text-[10px] rounded-sm cursor-not-allowed"
      title="Este usuario está inactivo"
    >
      Inactivo
    </button>
  ) : (
    <button
      onClick={() => openEdit(u)}
      className="px-3 py-1 bg-gray-800 text-white uppercase text-[10px] rounded-sm hover:opacity-90"
    >
      Editar
    </button>
    
    
  )}
</td>


                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center text-xs py-6 text-gray-600">
                  No hay usuarios registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Crear/Editar */}
      {isModalOpen && (
  <div className="fixed inset-0 flex items-center justify-center translate-y-4 sm:px-0">
    <div className="fixed inset-0 top-10 bg-black bg-opacity-50 transition-opacity duration-300" />
    <div className="relative bg-white w-full max-w-md p-6 border-black z-50 rounded-md shadow-lg">
      {/* … botón cerrar y título … */}

      {/* 2) Campos fantasma para “saciar” el autocompletado del navegador */}
      <form key={modalKey} onSubmit={handleSubmit} className="space-y-4"
            autoComplete="off" method="post">
        <input type="text" name="username" autoComplete="username"
               style={{ display: "none" }} />
        <input type="password" name="password" autoComplete="new-password"
               style={{ display: "none" }} />

        {/* Nombre */}
<div className="relative">
  <input
    id="user_firstName"
    name="firstName"
    value={form.firstName}
    onChange={handleChange}
    type="text"
    required
    placeholder="Nombre"
    className="peer w-full px-3 py-2 border border-gray-300 rounded-md ..."
  />
  
</div>

{/* Apellido */}
<div className="relative">
  <input
    id="user_lastName"
    name="lastName"
    value={form.lastName}
    onChange={handleChange}
    type="text"
    required
    placeholder="Apellido"
    className="peer w-full px-3 py-2 border border-gray-300 rounded-md ..."
  />
 
</div>
{/* Correo empresarial (auto-generado) */}
<div className="relative">
  <input
    type="text"
    value={buildOrgEmail(form.firstName, form.lastName)}
    readOnly
    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700 font-medium"
  />
  <label className="absolute left-3 -top-2.5 text-xs text-gray-500 bg-white px-1">
    Correo empresarial
  </label>
</div>


        {/* Correo personal */}
        <div className="relative">
          <input
            id="user_email"              // 👈 cambia id
            name="email"                 // puedes mantener name, pero…
            value={form.email}
            onChange={handleChange}
            type="email"
            required
            autoComplete="off"           // 👈 muy importante
            autoCorrect="off"
            autoCapitalize="none"
            placeholder="Correo personal"
            className="peer w-full px-3 py-2 border border-gray-300 rounded-md placeholder-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <label htmlFor="user_email" className="absolute left-3 -top-2.5 text-xs text-gray-500 bg-white px-1 transition-all
                       peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-2
                       peer-focus:-top-2.5 peer-focus:text-xs peer-focus:text-blue-500">
            Correo personal
          </label>
        </div>

        
              <input name="address" value={form.address} onChange={handleChange} placeholder="Dirección exacta" className="w-full px-2 py-1.5 bg-white text-black text-sm border border-black" />
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="Número de teléfono" className="w-full px-2 py-1.5 bg-white text-black text-sm border border-black" />

              {/* Tipo de documento */}
              <select
                name="documentType"
                value={form.documentType}
                onChange={handleChange}
                className="w-full px-2 py-1.5 bg-white text-black text-sm border border-black"
              >
                <option value="DNI">DNI</option>
                <option value="Carnet de Extranjería">Carnet de Extranjería</option>
              </select>

              {/* Documento */}
{/* Número de documento */}
<input
  id="documentNumber"
  name="documentNumber"                 // 👈 nombre correcto
  value={form.documentNumber}
  onChange={(e) => {
    const v = e.target.value;
    // Para DNI, solo dígitos
    if (form.documentType === "DNI") {
      const soloDigitos = v.replace(/\D/g, "").slice(0, 8);
      setForm((prev) => ({ ...prev, documentNumber: soloDigitos }));
    } else {
      // Carnet: cualquier número (permitimos dígitos; si quieres letras, quita el replace)
      const soloDigitos = v.replace(/\D/g, "");
      setForm((prev) => ({ ...prev, documentNumber: soloDigitos }));
    }
  }}
  type="text"
  placeholder="Número de documento"
  required
  pattern={form.documentType === "DNI" ? "\\d{8}" : "\\d+"}
  title={
    form.documentType === "DNI"
      ? "El DNI debe tener exactamente 8 dígitos"
      : "Ingrese un número válido"
  }
  className="w-full px-2 py-1.5 bg-white text-black text-sm border border-black"
/>

              {/* Avatar */}
              <div>
                <label className="block text-xs font-semibold mb-1">Foto del ejecutivo (avatar)</label>
                <input type="file" accept="image/*" onChange={handleSelectAvatar} />
                {subiendoAvatar && <p className="text-[11px] mt-1">Subiendo imagen…</p>}
                {(avatarPreview || form.avatar) && (
                  <img src={avatarPreview || form.avatar} alt="Avatar Preview" className="mt-2 h-24 w-24 rounded-full object-cover border" />
                )}
              </div>

              {/* DNI */}
              <div>
                <label className="block text-xs font-semibold mb-1">Documento (imagen)</label>
                <input type="file" accept="image/*" onChange={handleSelectDNI} />
                {subiendoDNI && <p className="text-[11px] mt-1">Subiendo imagen…</p>}
                {(dniPreview || form.dniUrl) && (
                  <img src={dniPreview || form.dniUrl} alt="DNI Preview" className="mt-2 max-h-32 border border-gray-300 object-contain" />
                )}
              </div>

              {/* Rol (nombre visible) */}
              <select
  name="role"
  value={form.role}
  onChange={handleChange}
  className="w-full px-2 py-1.5 bg-white text-black text-sm border border-black"
>
  {roles.map((r) => (
    <option key={r._id} value={r._id}>
  {r.name || r.nombre || r.label || r._id}
</option>

  ))}
</select>

{editingId && (
  <div className="mt-4 border-t pt-3">
    <label className="block text-xs font-semibold mb-1 text-gray-700">
      Cambiar contraseña (opcional)
    </label>
    <input
      type="password"
      value={newPassword}
      onChange={(e) => setNewPassword(e.target.value)}
      placeholder="Nueva contraseña"
      className="w-full px-2 py-1.5 bg-white text-black text-sm border border-black"
    />

    <button
      type="button"
      disabled={changingPwd || newPassword.length < 6}
      onClick={async () => {
        try {
          setChangingPwd(true);
          await api.patch(
            `/users/${editingId}/password/reset`,
            { newPassword },
            authHeader
          );
          alert("Contraseña actualizada correctamente");
          setNewPassword("");
        } catch (err) {
          console.error(err);
          alert("Error al actualizar contraseña");
        } finally {
          setChangingPwd(false);
        }
      }}
      className="mt-2 px-3 py-1 bg-red-700 text-white text-xs uppercase rounded-sm disabled:opacity-60"
    >
      {changingPwd ? "Guardando…" : "Actualizar contraseña"}
    </button>
  </div>
)}



               {!editingId && (
          <div className="relative">
            <input
              id="user_new_password"     // 👈 evita 'password' directo
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Contraseña (min 6)"
              required
              autoComplete="new-password" // 👈 clave para frenar autofill
              autoCorrect="off"
              autoCapitalize="none"
              className="peer w-full px-3 py-2 border border-gray-300 rounded-md placeholder-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <label htmlFor="user_new_password" className="absolute left-3 -top-2.5 text-xs text-gray-500 bg-white px-1 transition-all
                         peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-2
                         peer-focus:-top-2.5 peer-focus:text-xs peer-focus:text-blue-500">
              Contraseña (min 6)
            </label>
          </div>
        )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} className="px-3 py-2 bg-gray-800 text-white uppercase text-xs font-bold">
                  Cancelar
                </button>
                <button type="submit" className="px-3 py-2 bg-green-800 text-white uppercase text-xs font-bold">
                  Guardar
                </button>
              </div>
            </form>

            <div className="mt-3 text-[11px] text-gray-600">
              Estado a guardar: <b>{estados.find((e) => e._id === activoId)?.nombre || "Cargando..."}</b>
            </div>
          </div>
        </div>
      )}

      {/* Modal DNI */}
      {dniModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={closeDniModal} />
          <div className="relative bg-white w-[95%] max-w-2xl p-4 rounded-sm shadow-xl border">
            <button onClick={closeDniModal} className="absolute top-2 right-2 text-sm px-2 py-1 bg-gray-800 text-white rounded-sm">
              ✕
            </button>
            <h3 className="text-lg font-bold mb-3 text-black">Documento</h3>

            {dniModalError && <div className="text-red-700 text-sm mb-2">{dniModalError}</div>}

            <div className="w-full flex justify-center items-center">
              {dniModalUrl ? (
                <img
                  src={dniModalUrl}
                  alt="DNI"
                  className="max-h-[70vh] object-contain border"
                  onError={() => setDniModalError("No se pudo mostrar la imagen.")}
                />
              ) : (
                <div className="text-sm text-gray-600">Sin imagen</div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={downloadDniAsPdf}
                disabled={dniModalLoading || !dniModalUrl}
                className="px-3 py-2 bg-green-700 text-white uppercase text-xs font-bold rounded-sm disabled:opacity-60"
              >
                {dniModalLoading ? "Generando…" : "Descargar PDF"}
              </button>
              <button type="button" onClick={closeDniModal} className="px-3 py-2 bg-gray-800 text-white uppercase text-xs font-bold rounded-sm">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
