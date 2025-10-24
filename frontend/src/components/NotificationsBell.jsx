// src/components/notifications/NotificationsBell.jsx
import React, { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import {
  getNotificaciones,
  marcarLeida,
  marcarTodasLeidas,
} from "../api/notificaciones";
import { Calendar } from "lucide-react";

/** Sonido de alerta (chime elegante) */
function playAlertSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();

    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-18, ctx.currentTime);
    comp.knee.setValueAtTime(24, ctx.currentTime);
    comp.ratio.setValueAtTime(4, ctx.currentTime);
    comp.attack.setValueAtTime(0.003, ctx.currentTime);
    comp.release.setValueAtTime(0.25, ctx.currentTime);
    comp.connect(master);

    const delay = ctx.createDelay(0.4);
    const feedback = ctx.createGain();
    const wet = ctx.createGain();
    const dry = ctx.createGain();
    delay.delayTime.value = 0.14;
    feedback.gain.value = 0.28;
    wet.gain.value = 0.35;
    dry.gain.value = 0.9;

    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);

    const mix = ctx.createGain();
    wet.connect(mix);
    dry.connect(mix);
    mix.connect(comp);

    function bell({ freq = 1400, when = ctx.currentTime }) {
      const o1 = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const g = ctx.createGain();
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 400;

      o1.type = "sine";
      o2.type = "triangle";

      o1.frequency.setValueAtTime(freq, when);
      o2.frequency.setValueAtTime(freq * 1.5, when);

      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(0.8, when + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.9);

      o1.connect(g);
      o2.connect(g);
      g.connect(dry);
      g.connect(delay);
      g.connect(hp);
      hp.connect(dry);
      hp.connect(delay);

      o1.start(when);
      o2.start(when);
      o1.stop(when + 1.0);
      o2.stop(when + 1.0);
    }

    const t0 = ctx.currentTime;
    bell({ freq: 1568, when: t0 }); // G6
    bell({ freq: 1319.5, when: t0 + 0.12 }); // E6

    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

/**
 * Campana de notificaciones desacoplada.
 * Props:
 *  - authHeader: { headers: { Authorization: `Bearer ${token}` } }
 *  - enabled?: boolean (default true) → si no hay usuario, pásalo en false y no se renderiza nada
 */
export default function NotificationsBell({ authHeader, enabled = true }) {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);

  const bellRef = useRef(null);
  const lastUnreadRef = useRef(0);
  const firstFetchDoneRef = useRef(false);
  const skipSoundNextReload = useRef(false);

  const loadNotifs = async () => {
    try {
      const { data } = await getNotificaciones(authHeader);
      const items = Array.isArray(data.items) ? data.items : [];
      const newUnread = Number(data.unread || 0);

      const prevUnread = lastUnreadRef.current;
      const isFirst = !firstFetchDoneRef.current;

      setNotifs(items);
      setUnread(newUnread);

      // si no es el primer fetch y subieron las no leídas → ding
      if (!isFirst && newUnread > prevUnread && !skipSoundNextReload.current) {
        playAlertSound();
      }
      // resetea el flag (solo se usa cuando hicimos push optimista local)
      skipSoundNextReload.current = false;

      lastUnreadRef.current = newUnread;
      if (isFirst) firstFetchDoneRef.current = true;
    } catch {
      // ignore
    }
  };

  // Primer fetch + polling
  useEffect(() => {
    if (!enabled) return;
    loadNotifs();
    const id = setInterval(loadNotifs, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // reload externo
  useEffect(() => {
    if (!enabled) return;
    const handler = () => loadNotifs();
    window.addEventListener("notifications:reload", handler);
    return () => window.removeEventListener("notifications:reload", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // push optimista (ding)
  useEffect(() => {
    if (!enabled) return;
    const pushHandler = (e) => {
      const n = e.detail;
      if (!n) return;
      setNotifs((prev) => [n, ...prev].slice(0, 10));
      setUnread((prev) => {
        const next = prev + 1;
        lastUnreadRef.current = next;
        return next;
      });
      playAlertSound();
      skipSoundNextReload.current = true;
    };
    window.addEventListener("notifications:push", pushHandler);
    return () => window.removeEventListener("notifications:push", pushHandler);
  }, [enabled]);

  // cerrar al click fuera / Esc
  useEffect(() => {
    if (!enabled) return;
    const onDocClick = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target))
        setOpen(false);
    };
    const onEsc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="relative" ref={bellRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="relative rounded-full p-2 hover:bg-white/10 transition"
        title="Notificaciones"
      >
        <Bell className="w-6 h-6" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 text-[11px] min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white grid place-content-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[240px] max-h-[50vh] overflow-auto bg-white text-black rounded-sm shadow-2xl ring-1 ring-black/5 z-50">
          <div className="px-4 py-2 flex items-center justify-between border-b">
            <div className="font-semibold text-sm">Notificaciones</div>
            {unread > 0 && (
              <button
                className="text-xs text-indigo-600 hover:underline"
                onClick={async () => {
                  await marcarTodasLeidas(authHeader);
                  await loadNotifs();
                }}
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          {notifs.length === 0 ? (
            <div className="p-4 text-xs text-gray-900">Sin notificaciones.</div>
          ) : (
            <ul className="divide-y divide-gray-400">
              {notifs.slice(0, 10).map((n) => {
                const isUnread = !n.read;
                const isCita = n.type === "cita";

                // —————— Dedup de mensaje “Cita con X — X”
                const rawMsg = n.message || "";
                const parts = rawMsg
                  .split("—")
                  .map((s) => s.trim())
                  .filter(Boolean);
                const normalize = (s) =>
                  s.replace(/\s+/g, " ").trim().toLowerCase();

                let prettyMessage = rawMsg;
                if (parts.length === 2) {
                  // si “Cita con <A>” y “<A>” son iguales → deja solo “Cita con <A>”
                  const left = parts[0].replace(/^cita\s+con\s+/i, "").trim();
                  const right = parts[1];
                  if (normalize(left) === normalize(right)) {
                    prettyMessage = parts[0]; // “Cita con <A>”
                  }
                }

                return (
                  <li
                    key={n._id}
                    className={[
                      "p-3 sm:p-3.5 transition",
                      "hover:bg-gray-50/80",
                      isUnread ? "bg-indigo-50/40" : "bg-white",
                      isCita
                        ? "border-l-2 border-gray-900"
                        : "border-l-2 border-gray-300",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icono */}
                      <div className="shrink-0">
                        <div className="w-9 h-9 rounded-xl grid place-content-center">
                          {isCita ? (
                            <Calendar
                              className="w-4.5 h-4.5 text-gray-900"
                              strokeWidth={2}
                            />
                          ) : (
                            <Bell
                              className="w-4.5 h-4.5 text-gray-900"
                              strokeWidth={2}
                            />
                          )}
                        </div>
                      </div>

                      {/* Contenido */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Título → 2 líneas máx */}
                          <div
                            className="text-xs font-bold text-gray-900 break-words"
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                            title={n.title} // tooltip con el texto completo
                          >
                            {n.title}
                          </div>
                        </div>

                        {/* Mensaje → 2 líneas máx + dedup */}
                        {prettyMessage && (
                          <div
                            className="mt-0.5 text-xs font-bold text-red-900 leading-relaxed break-words"
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                            title={prettyMessage}
                          >
                            {prettyMessage}
                          </div>
                        )}

                        {n.data?.ownerName && (
                          <div className="mt-1 text-[10px] text-blue-900">
                            De:{" "}
                            <span className="font-medium">
                              {n.data.ownerName}
                            </span>
                          </div>
                        )}

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {n.scheduledAt && (
                            <div className="text-[11px] text-gray-900 font-semibold">
                              <span className="text-gray-900">Programada:</span>{" "}
                              {(() => {
                                const d = new Date(n.scheduledAt);
                                const fecha = d
                                  .toLocaleDateString("es-PE", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                  })
                                  .replaceAll("/", "-"); // cambia / por -
                                const hora = d.toLocaleTimeString("es-PE", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: true,
                                });
                                return `${fecha} ${hora}`; // junta sin coma
                              })()}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Botón Leída */}
                      <div className="shrink-0">
                        {!n.read && (
                          <button
                            className="text-[9px] font-bold px-2.5 py-1.5 rounded-lg border border-gray-900 text-gray-900 "
                            onClick={async () => {
                              await marcarLeida(n._id, authHeader);
                              await loadNotifs();
                            }}
                          >
                            Leída
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
