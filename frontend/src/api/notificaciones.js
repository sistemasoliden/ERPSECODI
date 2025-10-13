import api from "./axios";

export const getNotificaciones = (authHeader, params = {}) =>
  api.get("/notificaciones", { ...authHeader, params });

export const marcarLeida = (id, authHeader) =>
  api.patch(`/notificaciones/${id}/read`, {}, authHeader);

export const marcarTodasLeidas = (authHeader) =>
  api.post("/notificaciones/read-all", {}, authHeader);
