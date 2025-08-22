// frontend/src/utils/imgbb.js
export const uploadToImgBB = async (file, { maxMB = 5, name } = {}) => {
  if (!file) throw new Error("No se seleccionó ningún archivo.");
  const apiKey = import.meta.env.VITE_IMGBB_KEY;
  if (!apiKey) throw new Error("Falta VITE_IMGBB_KEY en el .env del frontend.");

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) {
    throw new Error("Formato no permitido. Usa JPG, PNG, WEBP o GIF.");
  }
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > maxMB) {
    throw new Error(`La imagen supera ${maxMB}MB (${sizeMB.toFixed(2)}MB).`);
  }

  const formData = new FormData();
  formData.append("image", file);
  if (name) formData.append("name", name);

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!data?.success) {
    const msg = data?.error?.message || "Error al subir imagen a ImgBB";
    throw new Error(msg);
  }

  return { url: data.data.url, displayUrl: data.data.display_url };
};
