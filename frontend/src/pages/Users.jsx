import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const Users = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'comercial',
    roleDescription: ''
  });
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Carga inicial de usuarios
  const fetchUsers = async () => {
    try {
      const res = await api.get('/users', { headers: { Authorization: `Bearer ${token}` } });
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchUsers(); }, [token]);

  const handleChange = e =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', form, { headers: { Authorization: `Bearer ${token}` } });
      setIsModalOpen(false);
      setForm({ name: '', email: '', password: '', role: 'comercial', roleDescription: '' });
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear usuario');
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-lg uppercase font-bold text-black">Lista de Usuarios</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-3 bg-gray-800 text-white text-xs font-semibold uppercase  rounded-sm  transform hover:scale-105 transition"
        >
          Crear Usuario
        </button>
      </div>

      {/* Tabla de usuarios elegante y sobria */}
<div className="rounded-sm border border-black bg-white transition-all duration-300 relative">
  <table className="w-full table-fixed border-collapse">
    {/* HEADER */}
    <thead className="bg-red-800">
      <tr>
        <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide border border-black">
          Nombre
        </th>
        <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide border border-black">
          Email
        </th>
        <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide border border-black">
          Rol
        </th>
        <th className="px-4 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide border border-black">
          Descripción
        </th>
      </tr>
    </thead>

    {/* BODY */}
    <tbody>
      {users.map((u, idx) => (
        <tr
          key={u._id}
          className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                      hover:bg-slate-100 transition-colors duration-200`}
        >
          <td className="px-4 py-3 text-center text-xs text-slate-800 font-medium border border-black break-words">
            {u.name}
          </td>
          <td className="px-4 py-3 text-center text-xs text-slate-800 font-medium border border-black break-words">
            {u.email}
          </td>

          <td className="px-4 py-3 text-center text-xs text-slate-800 font-medium border border-black break-words">
            {u.role}
          </td>
          <td
  className="group relative px-4 py-3 text-center text-xs text-slate-800 font-medium border border-black truncate hover:bg-slate-100 cursor-pointer"
>
  <span>
    {u.roleDescription.length > 30 ? u.roleDescription.slice(0, 30) + '...' : u.roleDescription}
  </span>

  <div
  className="fixed z-50 opacity-0 group-hover:opacity-100
             bg-white/80 backdrop-blur-md border border-gray-300 text-gray-900 text-xs 
             px-4 py-3 w-72 max-w-sm shadow-xl
             transition-all duration-300 ease-in-out pointer-events-none
             break-words whitespace-pre-wrap"
  style={{ 
    top: `calc(${idx * 3}rem + 220px)`,
    left: 'calc(100% - 450px)'          
  }}
>
  {u.roleDescription}
</div>

</td>

        </tr>
      ))}
    </tbody>
  </table>
</div>


{isModalOpen && (
<div className="fixed inset-0 flex items-center justify-center translate-y-4 sm:px-0">
<div className="fixed inset-0 top-10 bg-black bg-opacity-50 transition-opacity duration-300">
</div>
  <div className="relative bg-white w-full max-w-sm max-h-95 p-4 sm:p-8 
    hover:scale-100 transition-transform z-50">

      <button
        onClick={() => setIsModalOpen(false)}
        className="absolute top-4 right-4 text-sm transition-colors"
      >
        ✕
      </button>

      <h2 className="text-2xl font-bold text-black text-center uppercase mb-6">Nuevo Usuario</h2> {/* ✅ Corregido text-2x1 a text-2xl */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-800">{error}</p>}
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Nombre completo"
          required
          className="w-full px-2 py-1.5 bg-white text-black text-sm border border-black
           transition duration-200 placeholder-gray-400"

        />
        <input
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="Correo electrónico"
          type="email"
          required
          className="w-full px-2 py-1.5 bg-white text-black text-sm border border-black
           transition duration-200 ease-in-out placeholder-gray-400"

        />
        <input
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Contraseña"
          type="password"
          required
          className="w-full px-2 py-1.5 bg-white text-black text-sm border border-black
           transition duration-200 ease-in-out placeholder-Black"

        />
        <select
          name="role"
          value={form.role}
          onChange={handleChange}
          className="w-full px-2 py-1.5 bg-white text-black text-sm border border-black
           transition duration-200 ease-in-out placeholder-gray-400"

        >
          {['administracion','backoffice','postventa','recursoshumanos','sistemas','gerencia','comercial']
            .map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <textarea
          name="roleDescription"
          value={form.roleDescription}
          onChange={handleChange}
          placeholder="Descripción del rol"
          rows={3}
          className="w-full px-2 py-1.5 bg-white text-black text-sm border border-black
           transition duration-200 ease-in-out placeholder-gray-400"

        />
        <div className="flex justify-end space-x-1 ">
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
className="px-3 py-2 sm:py-3 bg-gray-800 border text-white uppercase font-medium text-sm sm:text-xs font-bold "
          >
            Cancelar
          </button>
          <button
            type="submit"
className="px-3 py-2 sm:py-2 bg-green-800 border text-white font-mediumn uppercase text-sm sm:text-xs font-bold "
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  </div>
)}

    </div>

  );
}

export default Users;
