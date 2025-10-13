// src/components/notifications/NotificationsBell.jsx
import React, { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { getNotificaciones, marcarLeida, marcarTodasLeidas } from "../api/notificaciones";

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
    bell({ freq: 1568, when: t0 });        // G6
    bell({ freq: 1319.5, when: t0 + 0.12 });// E6

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

      setNotifs(items);
      setUnread(newUnread);

      // actualiza "último visto"
      lastUnreadRef.current = newUnread;
      if (!firstFetchDoneRef.current) firstFetchDoneRef.current = true;
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
      if (bellRef.current && !bellRef.current.contains(e.target)) setOpen(false);
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
        <div className="absolute right-0 mt-2 w-[320px] max-h-[70vh] overflow-auto bg-white text-black rounded-xl shadow-2xl ring-1 ring-black/5 z-50">
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
            <div className="p-4 text-sm text-gray-600">Sin notificaciones.</div>
          ) : (
            <ul className="divide-y">
              {notifs.slice(0, 10).map((n) => (
                <li key={n._id} className={`p-3 ${!n.read ? "bg-indigo-50/40" : ""}`}>
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">{n.type === "cita" ? "📅" : "🔔"}</div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{n.title}</div>
                      {n.message && <div className="text-xs text-gray-700">{n.message}</div>}
                      {n.scheduledAt && (
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          Programada:{" "}
                          {n.scheduledAt
                            ? new Date(n.scheduledAt).toLocaleString("es-PE", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "—"}
                        </div>
                      )}
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {n.createdAt
                          ? new Date(n.createdAt).toLocaleString("es-PE", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : ""}
                      </div>
                    </div>
                    {!n.read && (
                      <button
                        className="text-[11px] px-2 py-0.5 rounded border hover:bg-gray-50"
                        onClick={async () => {
                          await marcarLeida(n._id, authHeader);
                          await loadNotifs();
                        }}
                      >
                        Leída
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
