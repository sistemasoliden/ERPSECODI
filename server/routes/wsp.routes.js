// server/routes/wsp.routes.js
import { Router } from "express";
import {
  ensure, status as statusFn, qr, send,
  restart, relogin, logout,
  getLogs, listSessions
} from "../wsp.sessions.js";

const router = Router();
const USER_ID = process.env.WSP_USER_ID || "default";

/* Arranca/asegura la sesión */
router.post("/start", async (_req, res) => {
  try {
    await ensure(USER_ID);
    res.json({ ok: true, status: statusFn(USER_ID).status });
  } catch (e) {
    res.status(500).json({ ok:false, err: e?.message || String(e) });
  }
});

/* Estado */
router.get(["/status","/session"], (_req, res) => {
  res.json({ ok:true, status: statusFn(USER_ID).status });
});

/* QR */
router.get("/qr", (_req, res) => {
  res.json({ ok:true, dataUrl: qr(USER_ID) });
});

/* Enviar */
router.post("/send", async (req, res) => {
  try {
    const { to, text } = req.body || {};
    const r = await send(USER_ID, to, text);
    res.json({ ok:true, id: r?.id?._serialized });
  } catch (e) {
    res.status(400).json({ ok:false, error: e?.message || String(e) });
  }
});

/* Control de sesión */
router.post("/restart", async (_req, res) => {
  try { await restart(USER_ID); res.json({ ok:true }); }
  catch (e) { res.status(500).json({ ok:false, error: e?.message || String(e) }); }
});
router.post("/relogin", async (_req, res) => {
  try { await relogin(USER_ID); res.json({ ok:true }); }
  catch (e) { res.status(500).json({ ok:false, error: e?.message || String(e) }); }
});
router.post("/logout", async (_req, res) => {
  try { await logout(USER_ID); res.json({ ok:true }); }
  catch (e) { res.status(500).json({ ok:false, error: e?.message || String(e) }); }
});

/* Logs y admin */
router.get("/logs", (_req, res) => {
  res.json({ ok:true, logs: getLogs(USER_ID) });
});
router.get("/admin/sessions", (_req, res) => {
  res.json({ ok:true, sessions: listSessions() });
});

export default router;
 