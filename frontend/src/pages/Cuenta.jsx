// frontend/src/pages/Cuenta.jsx
import { useState } from 'react';
import axios from '../api/axios';
import { uploadToImgBB } from '../utils/imgbb';

export default function Cuenta() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);

  const onChangeFile = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setPreview(f ? URL.createObjectURL(f) : '');
  };

  const onSaveAvatar = async () => {
    if (!file) return alert('Selecciona una imagen');
    try {
      setSaving(true);
      const { url } = await uploadToImgBB(file, { name: 'avatar' });
      // 👉 aquí guardas la URL en MongoDB (campo avatar)
      const { data: user } = await axios.put('/users/avatar', { avatar: url });
      alert('Avatar actualizado');
      // actualizar estado global si usas context (opcional)
      // setUser(user);
    } catch (err) {
      alert(err.message || 'Error subiendo/guardando avatar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 max-w-md space-y-3">
      <h2 className="text-xl font-bold">Foto de perfil</h2>
      <input type="file" accept="image/*" onChange={onChangeFile} />
      {preview && (
        <img
          src={preview}
          alt="preview"
          className="w-28 h-28 rounded-full object-cover border"
        />
      )}
      <button
        disabled={saving || !file}
        onClick={onSaveAvatar}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {saving ? 'Guardando...' : 'Guardar avatar'}
      </button>
    </div>
  );
}
